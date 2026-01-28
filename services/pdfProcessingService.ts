import { Type } from "@google/genai";
import { getBestGeminiModel, getGeminiSDK } from "./geminiModelManager";
import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker - use unpkg CDN with specific version
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@5.4.530/build/pdf.worker.min.mjs';

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
 * Extract text from PDF using PDF.js - FAST version using File directly
 */
const extractTextFromFile = async (
  file: File,
  onProgress?: (message: string) => void
): Promise<string> => {
  try {
    const sizeMB = Math.round(file.size / 1024 / 1024);
    if (onProgress) onProgress(`Abriendo PDF (${sizeMB}MB)...`);

    // Use file URL directly - much faster than base64 conversion
    const fileUrl = URL.createObjectURL(file);

    try {
      const loadingTask = pdfjsLib.getDocument(fileUrl);
      const pdf = await loadingTask.promise;
      const totalPages = pdf.numPages;

      console.log(`PDF has ${totalPages} pages`);
      if (onProgress) onProgress(`${totalPages} páginas encontradas. Extrayendo...`);

      let fullText = '';
      const startTime = Date.now();

      // Process pages in larger batches for speed
      const BATCH_SIZE = 10;
      for (let batchStart = 1; batchStart <= totalPages; batchStart += BATCH_SIZE) {
        const batchEnd = Math.min(batchStart + BATCH_SIZE - 1, totalPages);

        // Process batch of pages in parallel
        const batchPromises = [];
        for (let i = batchStart; i <= batchEnd; i++) {
          batchPromises.push(
            pdf.getPage(i).then(async (page) => {
              try {
                const textContent = await page.getTextContent();
                const pageText = textContent.items
                  .map((item: any) => item.str)
                  .join(' ');
                page.cleanup();
                return { pageNum: i, text: pageText };
              } catch (e) {
                return { pageNum: i, text: '' };
              }
            })
          );
        }

        const results = await Promise.all(batchPromises);
        results.sort((a, b) => a.pageNum - b.pageNum);
        for (const result of results) {
          fullText += result.text + '\n\n';
        }

        // Report progress
        if (onProgress) {
          const elapsed = Math.round((Date.now() - startTime) / 1000);
          const percent = Math.round((batchEnd / totalPages) * 100);
          onProgress(`Página ${batchEnd}/${totalPages} (${percent}%) - ${elapsed}s`);
        }
      }

      const totalTime = Math.round((Date.now() - startTime) / 1000);
      console.log(`Extraction complete in ${totalTime}s, ${fullText.length} chars`);

      return fullText.trim();
    } finally {
      URL.revokeObjectURL(fileUrl);
    }
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
 * Extract text content from a PDF File object (FAST - no base64 conversion)
 */
export const extractTextFromPDFFile = async (
  file: File,
  onProgress?: (message: string) => void
): Promise<string | null> => {
  try {
    const sizeMB = Math.round(file.size / 1024 / 1024);
    console.log('PDF size:', sizeMB, 'MB');

    // Step 1: Try PDF.js extraction (handles any size, processes page by page)
    console.log('Attempting local PDF.js text extraction...');
    const pdfJsText = await extractTextFromFile(file, onProgress);

    // If PDF.js extracted substantial text, use it
    if (pdfJsText && pdfJsText.length > 200) {
      console.log('PDF.js extracted', pdfJsText.length, 'characters');
      return pdfJsText;
    }

    // Step 2: PDF.js didn't extract much - likely a scanned PDF
    // For scanned PDFs, we need Gemini OCR but there's a size limit
    if (file.size > MAX_GEMINI_FILE_SIZE) {
      console.warn('Large scanned PDF detected - OCR not available for files > 20MB');
      if (pdfJsText && pdfJsText.length > 0) {
        return pdfJsText;
      }
      throw new Error(`Este PDF parece ser escaneado (imágenes) y es muy grande (${sizeMB}MB) para OCR. Por favor:\n• Usa un PDF con texto seleccionable, o\n• Comprime el PDF a menos de 20MB para usar OCR`);
    }

    // Convert to base64 only for Gemini OCR (small scanned PDFs)
    if (onProgress) onProgress('PDF escaneado detectado, preparando OCR...');
    console.log('PDF appears to be scanned, using Gemini OCR...');

    const pdfBase64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    if (onProgress) onProgress('Ejecutando OCR con IA...');

    const prompt = `
      TASK: Extract all text from this PDF document.
      CRITICAL INSTRUCTIONS:
      1. This document is a SCANNED IMAGE.
      2. YOU MUST PERFORM OCR to transcribe ALL visible text.
      3. Do NOT summarize. Return the FULL TRANSCRIPT.
      5. Output ONLY the raw extracted text. No markdown, no commentary.
    `;
    const text = await generateContent(prompt, { pdfBase64 });

    if (!text || text.trim().length === 0) {
      throw new Error('OCR no pudo extraer texto.');
    }

    return text;
  } catch (e: any) {
    console.error('Error extracting PDF text:', e);
    throw new Error(`Error procesando PDF: ${e.message || e}`);
  }
};

/**
 * Legacy function for base64 input (slower, avoid if possible)
 */
export const extractTextFromPDF = async (
  pdfBase64: string,
  onProgress?: (message: string) => void
): Promise<string | null> => {
  // Convert base64 to File for the fast path
  const cleanBase64 = pdfBase64.replace(/^data:application\/pdf;base64,/, '');
  const blob = base64ToBlob(cleanBase64, 'application/pdf');
  const file = new File([blob], 'document.pdf', { type: 'application/pdf' });
  return extractTextFromPDFFile(file, onProgress);
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
# PROMPT MAESTRO: GENERADOR DE "TEXTO MAESTRO" (NO RESUMEN)

## CONTEXTO
Eres el autor de un libro de texto universitario definitivo. Tu objetivo NO ES RESUMIR, sino **ENSEÑAR EXHAUSTIVAMENTE**.
Tienes acceso a los apuntes y materiales del estudiante. Tu trabajo es convertir esos materiales (quizás desordenados o dispersos) en un **CAPÍTULO DE LIBRO DE TEXTO COHESIVO Y PROFUNDO**.

## DIRECTIVA DE PRIMERA PRIORIDAD: "ANTI-RESUMEN"
- **PROHIBIDO RESUMIR**. Si el material menciona un concepto, TÚ LO DESARROLLAS COMPLETAMENTE.
- Si hay una lista de 3 puntos en el material, TÚ escribes 3 párrafos explicando cada punto.
- Si hay una fórmula, TÚ explicas cada variable, el porqué de la fórmula y das un ejemplo.
- Extensión esperada: Mínimo 2000-4000 palabras (o lo máximo que permitas). Queremos DETALLE.

## ESTRUCTURA DEL TEXTO MAESTRO

### SECCIÓN 1: FUNDAMENTACIÓN PROFUNDA
- No des una intro ligera. Define el tema con rigor académico.
- Contexto histórico o teórico si aplica.

### SECCIÓN 2: CUERPO DE CONOCIMIENTO (EL NÚCLEO)
- Esta es la sección más larga.
- Divide por temas lógicos.
- **EXPLICACIÓN TIPO TUTOR**: "Imagina que..." , "Es crucial entender que..."
- Usa **Negritas** para conceptos clave.
- Incorpora *ejemplos concretos* para cada concepto abstracto encontrado.

### SECCIÓN 3: INTEGRACIÓN Y RELACIONES
- Cómo se conecta el tema A con el tema B dentro de este material.
- Causalidades, contrastes, jerarquías.

### SECCIÓN 4: LABORATORIO DE PRÁCTICA (PREGUNTAS)
- Genera un banco de preguntas **EXTENSO** (Mínimo 10-15 preguntas).
- No solo preguntas simples. Incluye:
    1. Preguntas de memoria/definición.
    2. Preguntas de aplicación (casos).
    3. Preguntas de análisis "¿Qué pasaría si...?".
- **INCLUYE LAS RESPUESTAS** al final de esta sección (quizás colapsables o separadas).

### SECCIÓN 5: ESTRATEGIAS DE DOMINIO Y RECOMENDACIONES
- ¿Cómo recomiendas estudiar este tema específico?
- Mnemotecnias sugeridas para este contenido.
- "Trampas comunes": Dónde suelen fallar los estudiantes en este tema.
- Recomendaciones de enfoque: "¿Debería memorizar esto o entender la lógica?".

## FORMATO
- Markdown limpio.
- Encabezados claros (##, ###).
- Tablas si son útiles para comparar.
- Bloques de código para fórmulas o algoritmos.
- **CRÍTICO: NO envuelvas la respuesta en bloques de código markdown (\\\`\\\`\\\`markdown).Devuelve el texto RAW.**

    ---
    NOMBRE DEL SET DE ESTUDIO: ${studySetName}
CONTENIDO CRUDO DE LOS MATERIALES:
${materialsContent.map((t, i) => `[FUENTE ${i + 1}]:\n${t}`).join('\n\n')}
  ---

    PROCEDE A ESCRIBIR EL TEXTO MAESTRO AHORA.
`;

  try {
    // Increase output tokens for detailed guide
    return await generateContent(masterPrompt, {
      maxTokens: 8192,
      temperature: 0.5 // Lower temperature for more focused, less hallucinated but detailed content
    });
  } catch (error) {
    console.error('Error generating study guide:', error);
    return null;
  }
};

export const generateInfographicFromMaterials = async (
  materialsContent: { title: string; content: string; type: 'notebook' | 'material' }[],
  studySetName: string
): Promise<string | null> => {
  if (materialsContent.length === 0) return null;

  try {
    const schema = {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        centralIdea: { type: Type.STRING },
        keyConcepts: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              description: { type: Type.STRING },
              icon: { type: Type.STRING }
            },
            required: ["name", "description", "icon"]
          }
        },
        processSteps: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              step: { type: Type.NUMBER },
              description: { type: Type.STRING }
            },
            required: ["step", "description"]
          }
        },
        conclusion: { type: Type.STRING },
        detailedSections: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              content: { type: Type.STRING },
              icon: { type: Type.STRING },
              citations: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    sourceType: { type: Type.STRING, enum: ["Notebook", "Material"] },
                    title: { type: Type.STRING }
                  },
                  required: ["sourceType", "title"]
                }
              }
            },
            required: ["title", "content", "icon"]
          }
        }
      },
      required: ["title", "centralIdea", "keyConcepts", "processSteps", "detailedSections", "conclusion"]
    };

    const infographicPrompt = `
# ARQUITECTO DE INFOGRAFÍAS PEDAGÓGICAS(MODO DETALLADO)
Transforma estos materiales en un mapa mental visual GIGANTE y EXHAUSTIVO.
NO OMITAS DETALLES TÉCNICOS.

NOMBRE DEL SET DE ESTUDIO: ${studySetName}
  CONTENIDO:
${materialsContent.map(m => `--- FUENTE: [${m.type.toUpperCase()}] "${m.title}" ---\n${m.content}`).join('\n\n')}

  Instrucciones:
  1. "detailedSections": Crea secciones profundas para cada tema principal del material.
2. "icon": Usa iconos de Material Symbols.
3. El objetivo no es solo resumir, sino ESTRUCTURAR todo el conocimiento.
`;

    return await generateContent(infographicPrompt, { jsonSchema: schema });
  } catch (error) {
    console.error('Error generating infographic:', error);
    return null;
  }
};

// Enhanced Signature: Accepts structured content objects
export const generatePresentationFromMaterials = async (
  materialsContent: { title: string; content: string; type: 'notebook' | 'material' }[],
  studySetName: string
): Promise<string | null> => {

  if (materialsContent.length === 0) return null;

  try {
    const schema = {
      type: Type.OBJECT,
      properties: {
        visualTheme: { type: Type.STRING, enum: ["modern_dark", "clean_light", "professional_blue", "warm_paper"] },
        slides: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              layout: { type: Type.STRING, enum: ["title_slide", "content_list", "two_column", "quote_visual", "data_highlight", "section_header"] },
              title: { type: Type.STRING },
              subtitle: { type: Type.STRING },
              content: { type: Type.ARRAY, items: { type: Type.STRING } },
              visualCue: { type: Type.STRING },
              speakerNotes: { type: Type.STRING },
              citations: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    sourceType: { type: Type.STRING, enum: ["Notebook", "Material"] },
                    title: { type: Type.STRING }
                  },
                  required: ["sourceType", "title"]
                }
              }
            },
            required: ["layout", "title", "content", "speakerNotes"]
          }
        }
      },
      required: ["visualTheme", "slides"]
    };

    const presentationPrompt = `
# ARQUITECTO DE PRESENTACIONES EXPERTO
Tu misión es transformar el material de estudio en una presentación EDUCACIONAL MAESTRA con un diseño tipográfico potente.

    OBJETIVO:
Crear una presentación EXHAUSTIVA(10 a 20 diapositivas) que cubra TODO el material provisto.
NO OMITAS INFORMACIÓN.Queremos profundidad y claridad.

REGLAS DE CONTENIDO:
  1. "speakerNotes": DEBE SER UN GUIÓN COMPLETO para que el estudiante lo lea mientras estudia.Explica el slide profundamente.
2. "content": Puntos clave detallados.Cada punto debe ser una frase completa y contundente que aporte valor real, no solo etiquetas.
3. "subtitle": Usa esto para añadir una capa extra de profundidad o una pregunta provocativa que guíe la diapositiva.

ESTUDIO DE LAYOUTS:
  - layouts: Usarás "title_slide", "content_list", "two_column", "quote_visual", "data_highlight", "section_header" para mantener el dinamismo.
- NO generes campos de "visualCue" o sugerencias de imagen; el diseño se enfocará en la tipografía y la estructura de los datos.

NOMBRE DEL SET: ${studySetName}
 
 MATERIALES DISPONIBLES(Con títulos):
 ${materialsContent.map(m => `--- FUENTE: [${m.type.toUpperCase()}] "${m.title}" ---\n${m.content}`).join('\n\n')}
 
 Genera la presentación completa en JSON.
 `;

    return await generateContent(presentationPrompt, { jsonSchema: schema });
  } catch (error) {
    console.error('Error generating presentation:', error);
    return null;
  }
};

export const generateMaterialSummary = async (content: string, type: 'pdf' | 'text' | 'url' | 'video'): Promise<string | null> => {
  if (!content) return null;

  try {
    const summaryPrompt = `Resume esto(${type}): ${content.slice(0, 50000)} `;
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

    const prompt = `Genera ${count} preguntas de quiz sobre "${topic}".JSON.`;
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
    const prompt = `Resume esto: ${text.slice(0, 5000)} `;
    return await generateContent(prompt);
  } catch (error) {
    console.error('Error generating study summary:', error);
    return null;
  }
};
