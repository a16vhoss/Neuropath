import { Type } from "@google/genai";
import { getBestGeminiModel, getGeminiSDK } from "./geminiModelManager";
import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

// Max file size for Gemini (approximately 20MB)
const MAX_GEMINI_FILE_SIZE = 20 * 1024 * 1024;

/**
 * Convert base64 to Blob
 */
const base64ToBlob = (base64: string, mimeType: string): Blob => {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
};

/**
 * Convert base64 to ArrayBuffer
 */
const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
};

/**
 * Extract text from PDF using PDF.js (local, no API needed)
 * Processes page by page to handle large PDFs
 */
const extractTextWithPDFJS = async (
  pdfBase64: string,
  onProgress?: (current: number, total: number) => void
): Promise<string> => {
  try {
    const arrayBuffer = base64ToArrayBuffer(pdfBase64);
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    console.log(`PDF has ${pdf.numPages} pages`);
    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
      try {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ');
        fullText += pageText + '\n\n';

        // Report progress
        if (onProgress) {
          onProgress(i, pdf.numPages);
        }

        // Release page resources
        page.cleanup();
      } catch (pageError) {
        console.warn(`Error extracting page ${i}:`, pageError);
        // Continue with other pages
      }
    }

    return fullText.trim();
  } catch (error) {
    console.error('PDF.js extraction error:', error);
    return '';
  }
};

/**
 * Helper to generate content with the new SDK
 */
const generateContent = async (
  prompt: string,
  options?: {
    model?: string;
    jsonSchema?: any;
    temperature?: number;
    maxTokens?: number;
    pdfBase64?: string;
  }
) => {
  const ai = getGeminiSDK();
  if (!ai) throw new Error("Gemini SDK not initialized");

  const modelName = options?.model || await getBestGeminiModel();

  const config: any = {};

  if (options?.jsonSchema) {
    config.responseMimeType = "application/json";
    config.responseSchema = options.jsonSchema;
  }

  if (options?.temperature !== undefined) {
    config.temperature = options.temperature;
  }

  if (options?.maxTokens) {
    config.maxOutputTokens = options.maxTokens;
  }

  let contents: any;

  if (options?.pdfBase64) {
    // Upload PDF using Files API first, then reference it
    console.log('Uploading PDF to Gemini Files API...');
    const pdfBlob = base64ToBlob(options.pdfBase64, 'application/pdf');

    try {
      const uploadedFile = await ai.files.upload({
        file: pdfBlob,
        config: { mimeType: 'application/pdf' }
      });

      console.log('PDF uploaded, file name:', uploadedFile.name, 'uri:', uploadedFile.uri);

      // Wait for file to be processed
      let file = uploadedFile;
      while (file.state === 'PROCESSING') {
        console.log('Waiting for file processing...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        const fileStatus = await ai.files.get({ name: file.name! });
        file = fileStatus;
      }

      if (file.state === 'FAILED') {
        throw new Error('File processing failed');
      }

      // Use the uploaded file reference - just Parts array
      contents = [
        { fileData: { fileUri: file.uri!, mimeType: 'application/pdf' } },
        { text: prompt }
      ];
    } catch (uploadError: any) {
      console.error('Files API error, falling back to inline data:', uploadError.message);
      // Fallback: try inline data directly - just Parts array
      contents = [
        { inlineData: { data: options.pdfBase64, mimeType: 'application/pdf' } },
        { text: prompt }
      ];
    }
  } else {
    // Text-only content
    contents = prompt;
  }

  const response = await ai.models.generateContent({
    model: modelName,
    contents,
    config: Object.keys(config).length > 0 ? config : undefined
  });

  // Handle different SDK versions (text() method vs text property)
  // @ts-ignore - Handle potential SDK version mismatch
  const text = typeof response.text === 'function' ? response.text() : response.text;
  return text || "";
};

/**
 * Extract text content from a PDF file
 * Strategy:
 * 1. Use PDF.js for local extraction (works for text-based PDFs, handles large files)
 * 2. If PDF.js returns little/no text (scanned PDF) AND file is small enough, use Gemini OCR
 */
export const extractTextFromPDF = async (
  pdfBase64: string,
  onProgress?: (message: string) => void
): Promise<string | null> => {
  try {
    // Clean base64 string - remove data URI prefix and any whitespace/newlines
    let cleanBase64 = pdfBase64
      .replace(/^data:application\/pdf;base64,/, '')
      .replace(/\s/g, ''); // Remove all whitespace including newlines

    // Validate base64
    if (!cleanBase64 || cleanBase64.length < 100) {
      throw new Error('PDF data is too small or empty');
    }

    // Calculate approximate file size
    const approximateSize = (cleanBase64.length * 3) / 4;
    const sizeMB = Math.round(approximateSize / 1024 / 1024);
    console.log('PDF size:', sizeMB, 'MB');

    // Step 1: Try PDF.js extraction (handles any size, processes page by page)
    if (onProgress) onProgress('Analizando PDF...');
    console.log('Attempting local PDF.js text extraction...');

    const pdfJsText = await extractTextWithPDFJS(cleanBase64, (current, total) => {
      if (onProgress) {
        onProgress(`Extrayendo texto: página ${current} de ${total}...`);
      }
    });

    // If PDF.js extracted substantial text, use it
    if (pdfJsText && pdfJsText.length > 200) {
      console.log('PDF.js extracted', pdfJsText.length, 'characters');
      return pdfJsText;
    }

    // Step 2: PDF.js didn't extract much - likely a scanned PDF
    // For scanned PDFs, we need Gemini OCR but there's a size limit
    if (approximateSize > MAX_GEMINI_FILE_SIZE) {
      // For large scanned PDFs, we can't use Gemini
      // Return whatever PDF.js got (might be empty) with a warning
      console.warn('Large scanned PDF detected - OCR not available for files > 20MB');
      if (pdfJsText && pdfJsText.length > 0) {
        return pdfJsText;
      }
      throw new Error(`Este PDF parece ser escaneado (imágenes) y es muy grande (${sizeMB}MB) para OCR. Por favor:\n• Usa un PDF con texto seleccionable, o\n• Comprime el PDF a menos de 20MB para usar OCR`);
    }

    if (onProgress) onProgress('PDF escaneado detectado, usando OCR...');
    console.log('PDF appears to be scanned, using Gemini OCR...');

    const prompt = `
      TASK: Extract all text from this PDF document.
      CRITICAL INSTRUCTIONS:
      1. This document may be a SCANNED IMAGE or contain key text in images/diagrams.
      2. YOU MUST PERFORM OCR on all images/scans to transcribe the text.
      3. Do NOT summarize. Return the FULL TRANSCRIPT.
      4. If the document is purely visual but contains text, transcribe that text.
      5. Output ONLY the raw extracted text. No markdown formatting, no "Here is the text:", just the content.
    `;
    const text = await generateContent(prompt, { pdfBase64: cleanBase64 });

    // Check if the model returned a refusal or empty string despite no error
    if (!text || text.trim().length === 0) {
      throw new Error('Gemini API returned empty response.');
    }

    return text;
  } catch (e: any) {
    console.error('Error extracting PDF text:', e);
    throw new Error(`Error procesando PDF: ${e.message || e}`);
  }
};

/**
 * Generate flashcards from extracted text using Gemini
 */
export const generateFlashcardsFromText = async (
  text: string,
  topic: string,
  count: number = 10
): Promise<{ question: string; answer: string; category: string }[] | null> => {
  try {
    const schema = {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          question: { type: Type.STRING },
          answer: { type: Type.STRING },
          category: { type: Type.STRING },
          source_name: { type: Type.STRING }
        },
        required: ["question", "answer", "category", "source_name"]
      }
    };

    let prompt = '';

    if (count > 0) {
      // Fixed count mode
      prompt = `
        OBJETIVO: Genera EXACTAMENTE ${count} flashcards de alta calidad sobre el tema "${topic}".

        INSTRUCCIONES DE COBERTURA Y FUENTES:
        1. ESCANEO PROFUNDO: Lee el texto párrafo por párrafo.
        2. EXTRACCIÓN DISTINTA: Identifica conceptos significativos.
        3. COBERTURA TOTAL: Cubre todo el material.
        4. NIVEL DE DETALLE: Entra en tecnicismos y ejemplos específicos.
        5. CANTIDAD EXACTA: Genera EXACTAMENTE ${count} tarjetas.
        6. IDENTIFICACIÓN DE FUENTE: Para cada tarjeta, indica el nombre del material de donde proviene en el campo "source_name".
        7. IDIOMA: Español.

        TEXTO DE REFERENCIA (ESCANEAR TODO):
        ${text.slice(0, 100000)}
      `;
    } else {
      // Auto-scale / Unlimited mode
      prompt = `
        OBJETIVO: Genera un conjunto COMPLETO de flashcards que cubra TODOS los conceptos clave del tema "${topic}" en el texto proporcionado.

        INSTRUCCIONES DE COBERTURA Y FUENTES:
        1. COBERTURA EXHAUSTIVA: Analiza TODO el documento. No dejes ningún concepto importante fuera.
        2. SIN LÍMITE ARTIFICIAL: Genera tantas tarjetas como sean necesarias para cubrir el material (pueden ser 10, 20 o 50+).
        3. GRANULARIDAD: Desglosa conceptos complejos en tarjetas más simples.
        4. TIPOS DE PREGUNTAS: Incluye definiciones, relaciones, ejemplos y causas/efectos.
        5. IDENTIFICACIÓN DE FUENTE: Para cada tarjeta, indica el nombre del material de donde proviene en el campo "source_name".
        6. IDIOMA: Español.

        TEXTO DE REFERENCIA (ESCANEAR TODO):
        ${text.slice(0, 100000)}
      `;
    }

    const result = await generateContent(prompt, {
      jsonSchema: schema,
      temperature: 0.7,
      maxTokens: 8192
    });

    return JSON.parse(result);
  } catch (error) {
    console.error('Error generating flashcards:', error);
    return null;
  }
};

export const generateStudyGuideFromMaterials = async (materialsContent: string[], studySetName: string, currentGuide?: string): Promise<string | null> => {
  if (materialsContent.length === 0) return null;

  const masterPrompt = `
# PROMPT MAESTRO: GENERADOR DE GUÍAS DE ESTUDIO ADAPTATIVAS MULTIDISCIPLINARIAS

## CONTEXT
Eres un experto pedagógico universitario con más de 20 años de experiencia en diseño curricular, didáctica avanzada y síntesis de conocimiento multidisciplinario.

## ROLE
Asumes el rol de **Arquitecto Pedagógico Adaptativo**.

## ACTION
### PASO 1: ANÁLISIS PROFUNDO
1. Lee y procesa todos los materiales proporcionados.
2. Identifica automáticamente la(s) disciplina(s), nivel de profundidad, conceptos centrales y relaciones entre temas.

### PASO 2: ARQUITECTURA DE LA GUÍA
Diseña una estructura que incluya las siguientes secciones:
#### SECCIÓN 1: PANORAMA GENERAL
- Resumen ejecutivo y objetivos de aprendizaje.

#### SECCIÓN 2: DESARROLLO CONCEPTUAL PROFUNDO
- Definiciones precisas con contexto académico.
- Explicaciones detalladas adaptadas a la disciplina.

#### SECCIÓN 3: INTEGRACIÓN INTERDISCIPLINARIA
- Explica las conexiones entre diferentes materias si aplica.

#### SECCIÓN 4: HERRAMIENTAS PEDAGÓGICAS
- Mnemotecnias, analogías, ejemplos del mundo real y mapas conceptuales textuales.

#### SECCIÓN 5: PRÁCTICA Y APLICACIÓN
- Banco de ejercicios clasificados por dificultad con resolución paso a paso.

#### SECCIÓN 6: AUTOEVALUACIÓN
- Preguntas de comprensión, aplicación y síntesis con respuestas justificadas.

#### SECCIÓN 7: PUNTOS CRÍTICOS Y ERRORES COMUNES
- Conceptos confusos y advertencias importantes.

## FORMAT
- Usa jerarquía de encabezados (##, ###, ####).
- **Negritas** para términos clave, *cursivas* para énfasis.
- \`Código\` para elementos técnicos (fórmulas, sintaxis).
- Listas y separadores visuales (---).

## TARGET AUDIENCE
Estudiantes universitarios que buscan dominio profundo y preparación para exámenes de alto nivel.

---
NOMBRE DEL SET DE ESTUDIO: ${studySetName}
CONTENIDO DE LOS MATERIALES:
${materialsContent.map((t, i) => `[MATERIAL ${i + 1}]:\n${t.slice(0, 100000)}`).join('\n\n')}
---
Genera la guía de estudio más completa, clara y efectiva posible basándote en los materiales anteriores.
`;

  try {
    return await generateContent(masterPrompt);
  } catch (error) {
    console.error('Error generating study guide:', error);
    return null;
  }
};

export const generateInfographicFromMaterials = async (materialsContent: string[], studySetName: string): Promise<string | null> => {
  if (materialsContent.length === 0) return null;

  const infographicPrompt = `
# ARQUITECTO DE INFOGRAFÍAS PEDAGÓGICAS
Eres un experto en comunicación visual y síntesis de información. Tu objetivo es transformar materiales académicos en un "blueprint" de infografía de alto impacto.

## ESTRUCTURA REQUERIDA (MANTENER ESTOS ENCABEZADOS):
### TÍTULO IMPACTANTE: [Nombre del Tema]
### IDEA CENTRAL: [Resumen en una frase]
### DATOS/CONCEPTOS CLAVE:
- [Concepto 1]: [Explicación breve + Icono sugerido]
- [Concepto 2]: [Explicación breve + Icono sugerido]
### PROCESO O FLUJO:
- Paso 1: [Descripción]
- Paso 2: [Descripción]
### CONCLUSIÓN VISUAL:
- [Punto final clave]

---
NOMBRE DEL SET DE ESTUDIO: ${studySetName}
CONTENIDO:
${materialsContent.map(t => t.slice(0, 10000)).join('\n\n')}
---
Genera el contenido para la infografía más clara y visualmente estructurada posible.
`;

  try {
    return await generateContent(infographicPrompt);
  } catch (error) {
    console.error('Error generating infographic:', error);
    return null;
  }
};

export const generatePresentationFromMaterials = async (materialsContent: string[], studySetName: string): Promise<string | null> => {
  if (materialsContent.length === 0) return null;

  const presentationPrompt = `
# DISEÑADOR DE PRESENTACIONES EJECUTIVAS
Eres un experto en oratoria y diseño de presentaciones. Crea una estructura de diapositivas (slides) para una exposición de alto nivel.

## FORMATO REQUERIDA (MANTENER ESTO):
### SLIDE 1: PORTADA
- Título: [Nombre]
- Subtítulo: [Propósito]

### SLIDE 2: AGENDA
- Puntos que se tratarán.

### SLIDE [N]: [TÍTULO DE LA DIAPOSITIVA]
- [Punto clave 1]
- [Punto clave 2]
- **Nota del orador:** [Explicación para el presentador]

### SLIDE FINAL: CIERRE Y PREGUNTAS
- Resumen final.

---
NOMBRE DEL SET DE ESTUDIO: ${studySetName}
CONTENIDO:
${materialsContent.map(t => t.slice(0, 10000)).join('\n\n')}
---
Genera una presentación de entre 8 y 12 slides.
`;

  try {
    return await generateContent(presentationPrompt);
  } catch (error) {
    console.error('Error generating presentation:', error);
    return null;
  }
};

export const generateMaterialSummary = async (content: string, type: 'pdf' | 'text' | 'url' | 'video'): Promise<string | null> => {
  if (!content) return null;

  try {
    const summaryPrompt = `Resume esto (${type}): ${content.slice(0, 50000)}`;
    return await generateContent(summaryPrompt);
  } catch (error) {
    console.error('Error generating material summary:', error);
    return null;
  }
};

/**
 * Generate quiz questions with dynamic model
 */
export const generateQuizFromText = async (
  text: string,
  topic: string,
  count: number = 5
): Promise<{ question: string; options: string[]; correctIndex: number; explanation: string }[] | null> => {
  try {
    const schema = {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          question: { type: Type.STRING },
          options: { type: Type.ARRAY, items: { type: Type.STRING } },
          correctIndex: { type: Type.NUMBER },
          explanation: { type: Type.STRING }
        },
        required: ["question", "options", "correctIndex", "explanation"]
      }
    };

    const prompt = `Genera ${count} preguntas de quiz sobre "${topic}". JSON.`;
    const result = await generateContent(prompt, { jsonSchema: schema });
    return JSON.parse(result);
  } catch (error) {
    console.error('Error generating quiz:', error);
    return null;
  }
};

/**
 * Generate study summary with dynamic model
 */
export const generateStudySummary = async (text: string, topic: string): Promise<string | null> => {
  try {
    const prompt = `Resume esto: ${text.slice(0, 5000)}`;
    return await generateContent(prompt);
  } catch (error) {
    console.error('Error generating study summary:', error);
    return null;
  }
};
