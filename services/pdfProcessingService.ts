import { Type } from "@google/genai";
import { getBestGeminiModel, getGeminiSDK } from "./geminiModelManager";

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

  let contents: any = prompt;

  if (options?.pdfBase64) {
    contents = [
      { inlineData: { mimeType: "application/pdf", data: options.pdfBase64 } },
      { text: prompt }
    ];
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
 * Extract text content from a PDF file using Gemini
 */
export const extractTextFromPDF = async (pdfBase64: string): Promise<string | null> => {
  try {
    // Use rigid 1.5-flash versioned
    const model = 'gemini-1.5-flash-001';
    console.log(`Using Gemini ${model} for PDF extraction. Size:`, pdfBase64.length);
    const prompt = `
      TASK: Extract all text from this PDF document.
      CRITICAL INSTRUCTIONS:
      1. This document may be a SCANNED IMAGE or contain key text in images/diagrams.
      2. YOU MUST PERFORM OCR on all images/scans to transcribe the text.
      3. Do NOT summarize. Return the FULL TRANSCRIPT.
      4. If the document is purely visual but contains text, transcribe that text.
      5. Output ONLY the raw extracted text. No markdown formatting, no "Here is the text:", just the content.
    `;
    const text = await generateContent(prompt, { pdfBase64, model: 'gemini-1.5-flash' });

    // Check if the model returned a refusal or empty string despite no error
    if (!text || text.trim().length === 0) {
      throw new Error('Gemini API returned empty response.');
    }

    return text;
  } catch (e: any) {
    console.error('Error extracting PDF text:', e);

    // Debug: List available models to find the correct one
    try {
      const ai = getGeminiSDK();
      if (ai) {
        const models = await ai.models.list();
        const modelNames = [];
        // @ts-ignore - Pager definition might vary, ensuring iteration
        for await (const m of models) {
          if (m.name) modelNames.push(m.name);
        }
        console.log('Available Models:', modelNames.join(', '));
        throw new Error(`Gemini Error: ${e.message}. Available models: ${modelNames.join(', ')}`);
      }
    } catch (listError) {
      // Ignore listing error
    }

    throw new Error(`Gemini Extraction Error: ${e.message || e}`);
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
