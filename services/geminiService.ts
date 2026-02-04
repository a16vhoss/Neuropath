import { Type } from "@google/genai";
import { getBestGeminiModel, getGeminiSDK, getSearchModel } from "./geminiModelManager";
import { getYoutubeTranscript } from "./youtubeService";
import { searchRelevantContext } from "./embeddingService";
import { supabase } from "./supabaseClient";
import { generateMaterialSummary } from "./pdfProcessingService";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

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

  const response = await ai.models.generateContent({
    model: modelName,
    contents: prompt,
    config: Object.keys(config).length > 0 ? config : undefined
  });

  // Handle different SDK versions (text() method vs text property)
  // @ts-ignore - Handle potential SDK version mismatch
  const text = typeof response.text === 'function' ? response.text() : response.text;
  return text || "";
};

/**
 * Generate Flashcards from a general Topic
 */
export const generateStudyFlashcards = async (topic: string) => {
  if (!API_KEY || API_KEY === 'PLACEHOLDER_API_KEY') {
    console.warn('No valid Gemini API key provided, using fallback flashcards');
    return [];
  }

  try {
    const schema = {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          question: { type: Type.STRING },
          answer: { type: Type.STRING },
          category: { type: Type.STRING },
        },
        required: ["question", "answer"],
      },
    };

    const prompt = `
      Genera 5 tarjetas de estudio (flashcards) sobre: "${topic}".
      Formato JSON exacto.
      Cada tarjeta debe tener "question", "answer", y "category" (Ej: Concepto, Definición, Ejemplo).
      Idioma: Español.
    `;

    const result = await generateContent(prompt, { jsonSchema: schema });
    return JSON.parse(result);
  } catch (error) {
    console.error("Error generating flashcards with Gemini:", error);
    return [
      { question: "¿Qué es " + topic + "?", answer: "Es un concepto clave en el estudio...", category: "Definición" },
      { question: "Ejemplo de " + topic, answer: "Un ejemplo común es...", category: "Ejemplo" }
    ];
  }
};

/**
 * Search Result Interface
 */
export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  type: 'web' | 'youtube';
}

/**
 * AI Research: Search internet for educational resources
 * Generates high-quality educational resource recommendations
 */
export const searchInternet = async (topic: string, setContext: string, setName: string): Promise<SearchResult[]> => {
  const ai = getGeminiSDK();
  if (!ai) return [];

  try {
    console.log('Searching for educational resources about:', topic);

    const schema = {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          url: { type: Type.STRING },
          snippet: { type: Type.STRING },
          type: { type: Type.STRING }
        },
        required: ["title", "url", "snippet", "type"]
      }
    };

    const prompt = `
Eres un experto investigador académico. Necesito recursos educativos REALES sobre: "${topic}"
Contexto del estudio: "${setName}"
${setContext ? `Material relacionado: ${setContext.slice(0, 500)}` : ''}

INSTRUCCIONES CRÍTICAS:
1. Proporciona EXACTAMENTE 4 recursos educativos de alta calidad
2. Incluye 2 artículos web y 2 videos de YouTube
3. Las URLs deben ser de sitios REALES y confiables:
   - Para web: Wikipedia, Khan Academy, Coursera, edX, universidades (.edu)
   - Para YouTube: canales educativos conocidos

FORMATO DE RESPUESTA (JSON array):
[
  {
    "title": "Título descriptivo del recurso",
    "url": "https://es.wikipedia.org/wiki/...",
    "snippet": "Breve descripción de qué aprenderás",
    "type": "web"
  },
  {
    "title": "Nombre del video educativo",
    "url": "https://www.youtube.com/watch?v=...",
    "snippet": "De qué trata este video",
    "type": "youtube"
  }
]

Idioma: Español (preferir recursos en español cuando existan).
`;

    const response = await ai.models.generateContent({
      model: await getBestGeminiModel(),
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: 0.3
      }
    });

    const text = response.text || "[]";
    const results = JSON.parse(text);

    console.log('Search results:', results.length);
    return results;

  } catch (error) {
    console.error("Error in search:", error);

    // Fallback: return some default educational resources
    return [
      {
        title: `${topic} - Wikipedia`,
        url: `https://es.wikipedia.org/wiki/${encodeURIComponent(topic.replace(/ /g, '_'))}`,
        snippet: "Artículo enciclopédico con información general sobre el tema",
        type: "web"
      },
      {
        title: `${topic} explicado - Khan Academy`,
        url: "https://es.khanacademy.org/",
        snippet: "Lecciones y ejercicios interactivos gratuitos",
        type: "web"
      }
    ];
  }
};

/**
 * Check if search service is available (always true with Gemini)
 */
export const isSearchServiceAvailable = (): boolean => {
  return !!getGeminiSDK();
};

/**
 * Intelligent Clarification: Asks questions to narrow down research intent
 */
export const generateResearchClarifications = async (
  userInput: string,
  setContext: string,
  setName: string
): Promise<{ question: string; options: string[] }> => {
  try {
    const schema = {
      type: Type.OBJECT,
      properties: {
        question: { type: Type.STRING },
        options: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      },
      required: ["question", "options"]
    };

    const prompt = `
      Eres ZpBot, un asistente de estudio inteligente. El usuario quiere investigar sobre: "${userInput}".
      CONTEXTO DEL SET DE ESTUDIO ("${setName}"):
      ${setContext.slice(0, 1000)}

      OBJETIVO:
      En lugar de buscar directamente, haz una pregunta aclaratoria inteligente para guiar la investigación.
      Si el usuario fue vago (ej: "investiga algo de este tema"), usa el contexto del set para sugerir temas específicos.

      REQUISITOS:
      1. Genera una pregunta amable y conversacional.
      2. Ofrece 3 opciones (chips/botones) claras y cortas basándote en el contenido del set.
      3. Idioma: Español.
    `;

    const result = await generateContent(prompt, { jsonSchema: schema });
    return JSON.parse(result);

  } catch (error) {
    console.error("Error generating clarifications:", error);
    return {
      question: "¿Qué aspecto específico de este tema te gustaría investigar?",
      options: ["Conceptos clave", "Ejemplos prácticos", "Ejercicios"]
    };
  }
};

/**
 * Generate Flashcards from a Specific Prompt (ZpBot)
 */
export const generatePromptedFlashcards = async (userPrompt: string, materialContext: string, studySetName: string, count: number = 5) => {
  try {
    const schema = {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          question: { type: Type.STRING },
          answer: { type: Type.STRING },
          category: { type: Type.STRING }
        },
        required: ["question", "answer"]
      }
    };

    const prompt = `
      Eres un experto creador de material de estudio.
      Tu tarea es crear ${count} Flashcards de alta calidad sobre el Set de Estudio "${studySetName}", basadas en el tema solicitado: "${userPrompt}".

      FUENTE: Usa el siguiente contexto del material del estudiante como base principal:
      ${materialContext ? materialContext.slice(0, 30000) : "Usa tu conocimiento general."}

      REGLA CRÍTICA SOBRE EJERCICIOS:
      - NUNCA crees flashcards del tipo "Problema específico → Respuesta específica" (ej: "Resuelve 2x+5=15" → "x=5")
      - En su lugar, crea flashcards de METODOLOGÍA: "¿Cómo resolver ecuaciones lineales?" → "Pasos: 1... 2... 3..."
      - SÍ PUEDES crear: Fórmulas, definiciones, conceptos y metodologías

      REGLAS:
      - Preguntas claras y directas relacionadas con "${studySetName}".
      - Respuestas concisas pero completas.
      - Categoriza cada tarjeta (ej: Definición, Concepto, Fórmula, Metodología).
      - Idioma: Español.
    `;

    const result = await generateContent(prompt, { jsonSchema: schema });
    return JSON.parse(result);

  } catch (error) {
    console.error("Error generating prompted flashcards:", error);
    return [];
  }
};

/**
 * Detect if content is primarily theory, exercises, or mixed
 */
const detectContentType = async (text: string): Promise<'theory' | 'exercises' | 'mixed'> => {
  try {
    const detectionPrompt = `
Analiza este texto educativo y clasifícalo en UNA de estas categorías:

1. "exercises" - Si >70% son EJERCICIOS PRÁCTICOS/PROBLEMAS sin explicaciones teóricas extensas
   Indicadores: números específicos, "Resuelve...", "Calcula...", problemas enumerados (1., 2., 3.), preguntas con datos concretos

2. "theory" - Si >70% es TEORÍA: conceptos, definiciones, explicaciones, demostraciones
   Indicadores: definiciones, explicaciones largas, conceptos abstractos, ejemplos ilustrativos

3. "mixed" - Si mezcla ambos de forma balanceada

TEXTO A ANALIZAR (primeros 5000 caracteres):
${text.slice(0, 5000)}

RESPONDE SOLO CON UNA PALABRA: exercises, theory, o mixed
    `.trim();

    const result = await generateContent(detectionPrompt, {
      temperature: 0.1, // Low temperature for consistent classification
      maxTokens: 10
    });

    const cleaned = result.trim().toLowerCase();
    if (cleaned === 'exercises' || cleaned === 'theory' || cleaned === 'mixed') {
      console.log(`[Flashcard Generation] Content type detected: ${cleaned}`);
      return cleaned;
    }
    return 'theory';
  } catch (error) {
    console.error('[Flashcard Generation] Error detecting content type:', error);
    return 'theory';
  }
};

/**
 * Get prompt for exercise-mode flashcard generation (DEDUCTION MODE)
 */
const getExerciseModePrompt = (text: string, count: number): string => {
  const targetCount = count > 0 ? count : 12;

  return `
CONTEXTO: Este material contiene EJERCICIOS PRÁCTICOS y PROBLEMAS.
TU MISIÓN: IGNORAR LOS PROBLEMAS ESPECÍFICOS Y DEDUCIR LA TEORÍA DETRÁS.

🚫 POISON RULES (LO QUE ESTÁ PROHIBIDO):
- NUNCA generes una flashcard de un problema específico (Ej: "Resuelve 2+2" -> ❌).
- NUNCA uses números o datos del ejercicio en la pregunta/respuesta.
- NUNCA hagas preguntas de "Calcula el resultado de...".

✅ GOLDEN RULES (LO QUE DEBES HACER):
- DEDUCE el concepto teórico: Si ves "Calcula la integral de x^2", tu flashcard debe ser "¿Qué es una integral?" o "¿Pasos para integrar una potencia?".
- EXPLICA COMO TUTOR AMIGABLE: Tono "Explícame como si tuviera 12 años". Simple, directo, sin palabras rimbombantes.
- ENFÓCATE EN EL "CÓMO" y el "QUÉ": Definiciones, Procedimientos generales, Conceptos.

✨ ENRIQUECIMIENTO (NUEVO):
- MINI-EJEMPLO: Incluye un ejemplo cortito y simple (inventado si es necesario) para ilustrar.
- APLICACIÓN: Explica brevemente CÓMO o CUÁNDO se usa este concepto en un ejercicio real.

EJEMPLO DE TRANSFORMACIÓN:
Input: "Problema 1: Un tren viaja a 50km/h durante 2 horas..."
Flashcard Generada:
Q: "¿Qué es la velocidad?"
A: "Es qué tan rápido se mueve algo en una dirección. Se calcula dividiendo la distancia entre el tiempo.\n\n💡 Ejemplo: Si corres 10 metros en 2 segundos, tu velocidad es 5 m/s.\n🚀 Aplicación: Úsala para saber cuánto tardarás en llegar a un lugar si sabes la distancia."
(Nota cómo se ignoraron los números del tren)

OBJETIVO: Genera EXACTAMENTE ${targetCount} flashcards.
IDIOMA: Español.
TEXTO: "${text.slice(0, 50000)}"
  `.trim();
};

/**
 * Get prompt for theory-mode flaschard generation (SIMPLE TUTOR MODE)
 */
const getTheoryModePrompt = (text: string, count: number): string => {
  const targetCount = count > 0 ? count : 12;

  return `
OBJETIVO: Genera EXACTAMENTE ${targetCount} flashcards sobre este texto.

TONO: "TUTOR AMIGABLE Y SIMPLE" (Explícame como si tuviera 12 años).
- Respuestas cortas y punchy (3-4 oraciones máximo).
- Evita jerga académica innecesaria.
- Si es muy técnico, simplifícalo con una analogía.

🚫 PROHIBIDO:
- Copiar y pegar párrafos gigantes.
- Preguntas de problemas matemáticos específicos.

✅ ESTRUCTURA IDEAL:
Q: Concepto o Pregunta Clave
A: Definición simple + Por qué es importante.\n\n💡 Ejemplo: [Un ejemplo corto]\n🚀 Cómo se usa: [Breve tip de aplicación]

IDIOMA: Español.
TEXTO: "${text.slice(0, 50000)}"
  `.trim();
};

/**
 * Generate Study Set (Flashcards) from Context text
 */
export const generateStudySetFromContext = async (context: string, count: number = 0) => {
  if (!context || context.length < 10) return [];

  try {
    const schema = {
      type: Type.OBJECT,
      properties: {
        flashcards: {
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
        }
      },
      required: ["flashcards"]
    };

    // Step 1: Detect content type
    const contentType = await detectContentType(context);

    // Step 2: Select Prompt
    let prompt = '';
    if (contentType === 'exercises') {
      console.log('[Gemini] Using EXERCISE DEDUCTION prompt');
      prompt = getExerciseModePrompt(context, count);
    } else {
      console.log('[Gemini] Using SIMPLE THEORY prompt');
      prompt = getTheoryModePrompt(context, count);
    }

    const result = await generateContent(prompt, {
      jsonSchema: schema,
      temperature: 0.5, // Reduced temperature for better adherence to "Simple" tone
      maxTokens: 8192
    });

    const data = JSON.parse(result);
    return data.flashcards || [];

  } catch (error) {
    console.error("Error generating study set from context:", error);
    return [];
  }
};

/**
 * Generate Flashcards from YouTube URL (WITH DEEP CHUNKING)
 * Handles videos of any length (5-10+ hours) by processing in segments.
 * 
 * @param url - YouTube video URL
 * @param count - Target flashcard count (0 =  auto-scale based on content density)
 * @param onProgress - Optional callback for progress updates
 */
export const generateFlashcardsFromYouTubeURL = async (
  url: string,
  count: number = 0,
  onProgress?: (progress: { current: number; total: number; status: string }) => void
) => {
  try {
    const result = await getYoutubeTranscript(url);
    if (!result) {
      throw new Error("No se pudo obtener el contenido del video.");
    }

    // Destructure rich content
    const {
      fullTranscriptText,
      transcript: structuredTranscript,
      title,
      description,
      metadata,
      comments,
      chapters,
      isMetadataOnly
    } = result;

    // Import chunking service dynamically
    const { chunkTranscript, estimateFlashcardCount, deduplicateFlashcards } = await import('./videoChunkingService');

    // --- METADATA HEADER (for all chunks) ---
    const metadataHeader = `
[METADATA DEL VIDEO]
TÍTULO: ${title}
CANAL: ${metadata?.channelTitle || 'Desconocido'}
DURACIÓN: ${metadata?.duration || 'Desconocida'}
TAGS: ${metadata?.tags?.join(', ') || 'N/A'}
FECHA: ${metadata?.publishedAt || 'N/A'}
    `.trim();

    // Check if we have a real transcript or just metadata
    // BUG FIX: Check fullTranscriptText (works in dev mode) instead of structuredTranscript
    const hasTranscript = fullTranscriptText && fullTranscriptText.trim().length > 0 && !isMetadataOnly;

    if (!hasTranscript) {
      console.log('[YouTube] No transcript available, using description only');

      // Fallback to old method for metadata-only videos
      let promptContext = metadataHeader + "\n\n";

      if (comments && comments.length > 0) {
        promptContext += `\n[NOTAS DE LA COMUNIDAD]\n${comments.map((c: string) => `- ${c}`).join('\n')}\n\n`;
      }

      promptContext += `\n[CONTENIDO (Solo Descripción)]\n${description}\n`;

      const flashcards = await generateStudySetFromContext(promptContext, count || 5);
      const summary = await generateMaterialSummary(promptContext, 'video');

      return {
        flashcards,
        summary: summary || description.slice(0, 1000),
        videoUrl: url,
        videoTitle: title,
        channelName: metadata?.channelTitle || "YouTube",
        content: promptContext
      };
    }


    // --- CHUNKING STRATEGY FOR LONG VIDEOS (up to 10+ hours) ---
    // BUG FIX: Handle dev mode where structuredTranscript is empty but fullTranscriptText exists
    const transcriptToChunk = (structuredTranscript && structuredTranscript.length > 0)
      ? structuredTranscript
      : [{ offset: 0, duration: 0, text: fullTranscriptText, formattedTime: '0:00' }];

    console.log(`[YouTube] Processing video with ${transcriptToChunk.length} transcript segment(s)`);

    const chunks = chunkTranscript(transcriptToChunk, chapters, 18, 45);
    console.log(`[YouTube] Created ${chunks.length} chunks for processing`);

    // --- PROCESS EACH CHUNK ---
    const allFlashcards: any[] = [];
    const chunkSummaries: { timeRange: string; summary: string }[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];

      onProgress?.({
        current: i + 1,
        total: chunks.length,
        status: `Analizando segmento ${i + 1}/${chunks.length} (${chunk.startTime} - ${chunk.endTime})...`
      });

      // Build context for this chunk
      let chunkContext = metadataHeader + "\n\n";

      if (chapters && chapters.length > 0 && i === 0) {
        chunkContext += `[TABLA DE CONTENIDOS]\n${chapters.map((c: any) => `- ${c.time} ${c.title}`).join('\n')}\n\n`;
      }

      if (comments && comments.length > 0 && i === 0) {
        chunkContext += `[NOTAS DE LA COMUNIDAD]\n${comments.slice(0, 10).map((c: string) => `- ${c}`).join('\n')}\n\n`;
      }

      chunkContext += `[TRANSCRIPCIÓN - SEGMENTO ${i + 1}/${chunks.length}]\n`;
      chunkContext += `Tiempo: ${chunk.startTime} - ${chunk.endTime}\n\n`;
      chunkContext += chunk.text;

      // Estimate optimal flashcard count for this chunk
      const targetCount = count > 0
        ? Math.ceil(count / chunks.length) // Distribute fixed count across chunks
        : estimateFlashcardCount(chunk.text); // Auto-scale based on density

      console.log(`[Chunk ${i + 1}] Generating ${targetCount} flashcards from ${chunk.durationMinutes.toFixed(1)} min segment`);

      // Generate flashcards for this chunk
      const chunkFlashcards = await generateStudySetFromContext(chunkContext, targetCount);

      // Add time range metadata to each flashcard
      chunkFlashcards.forEach((fc: any) => {
        fc.source_timestamp = `${chunk.startTime} - ${chunk.endTime}`;
      });

      allFlashcards.push(...chunkFlashcards);

      // OPTIMIZATION: Reduce summary API calls based on video length
      const summaryFrequency = chunks.length <= 15 ? 1 : chunks.length <= 30 ? 2 : 3;
      const shouldGenerateSummary = (i % summaryFrequency === 0) || (i === chunks.length - 1);

      if (shouldGenerateSummary) {
        const chunkSummary = await generateContent(`
Resume este segmento de video educativo (${chunk.startTime} - ${chunk.endTime}):

${chunkContext.slice(0, 30000)}

Incluye:
- Conceptos principales explicados
- Definiciones clave
- Ejemplos o casos mencionados
- Fórmulas, procedimientos o metodologías

Extensión: 2-4 párrafos detallados.
        `.trim());

        chunkSummaries.push({
          timeRange: `${chunk.startTime} - ${chunk.endTime}`,
          summary: chunkSummary
        });
      }
    }

    // --- DEDUPLICATE FLASHCARDS ---
    onProgress?.({
      current: chunks.length,
      total: chunks.length,
      status: 'Consolidando flashcards y eliminando duplicados...'
    });

    const uniqueFlashcards = deduplicateFlashcards(allFlashcards);
    console.log(`[YouTube] Total flashcards: ${allFlashcards.length} → ${uniqueFlashcards.length} (after dedup)`);

    // --- GENERATE COMPREHENSIVE MASTER SUMMARY ---
    onProgress?.({
      current: chunks.length,
      total: chunks.length,
      status: 'Generando resumen completo del video...'
    });

    const masterSummary = await generateContent(`
Crea un resumen maestro COMPLETO Y DETALLADO de este video educativo.

TÍTULO: ${title}
CANAL: ${metadata?.channelTitle}
DURACIÓN: ${metadata?.duration}

RESÚMENES POR SEGMENTOS:
${chunkSummaries.map((s: any) => `\n[${s.timeRange}]\n${s.summary}`).join('\n\n')}

ESTRUCTURA DEL RESUMEN MAESTRO:
1. **Introducción**: ¿De qué trata el video? (1-2 párrafos)
2. **Conceptos Principales**: Lista exhaustiva de todos los conceptos clave explicados
3. **Contenido Cronológico**: Organiza el contenido por secciones de tiempo, resumiendo qué se explica en cada parte
4. **Conclusiones y Puntos Clave**: Síntesis final de las ideas más importantes

REQUISITOS:
- SIN LÍMITE de extensión. Cubre TODO el contenido.
- Incluye TODOS los conceptos mencionados en los segmentos.
- Usa listas, subtítulos y estructura clara.
- Idioma: Español.
    `.trim(), { maxTokens: 8192 });

    const videoTitle = title || "Video de YouTube (" + (new URL(url).searchParams.get('v') || 'ID desconocido') + ")";

    return {
      flashcards: uniqueFlashcards,
      summary: masterSummary || fullTranscriptText.slice(0, 2000) + "...",
      videoUrl: url,
      videoTitle,
      channelName: metadata?.channelTitle || "YouTube",
      content: fullTranscriptText || description // Full transcript for vector indexing
    };

  } catch (error) {
    console.error("Error processing YouTube URL:", error);
    throw error;
  }
};

/**
 * Generate Flashcards from Web URL
 */
export const generateFlashcardsFromWebURL = async (url: string, count: number = 10) => {
  try {
    const response = await fetch(url);
    const text = await response.text();
    const cleanText = text.replace(/<[^>]*>?/gm, ' ').slice(0, 20000);

    const flashcards = await generateStudySetFromContext(cleanText, count);

    // Generate comprehensive summary
    const detailedSummary = await generateMaterialSummary(cleanText, 'url');

    return {
      flashcards,
      summary: detailedSummary || cleanText.slice(0, 1000) + "...",
      pageTitle: "Página Web (" + new URL(url).hostname + ")",
      sourceUrl: url,
      content: cleanText // Return full content for vector indexing
    };
  } catch (error) {
    console.warn("Could not fetch web URL directly (likely CORS):", error);
    throw new Error("No se pudo acceder a la URL web (posible restricción CORS). Intenta copiar y pegar el texto manualmente.");
  }
};

/**
 * Auto categorize flashcards
 */
export const autoCategorizeFlashcards = async (flashcards: any[]) => {
  if (flashcards.length === 0) return flashcards;

  try {
    const schema = {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          category: { type: Type.STRING }
        }
      }
    };

    const prompt = `
      Categoriza las siguientes flashcards en temas breves (ej: Historia, Definición, Fórmula).
      Input JSON: ${JSON.stringify(flashcards.map((f, i) => ({ id: i.toString(), q: f.question })))}
      Devuelve un array con {id, category}.
    `;

    const result = await generateContent(prompt, { jsonSchema: schema });
    const categories = JSON.parse(result);

    return flashcards.map((f, i) => {
      const cat = categories.find((c: any) => c.id === i.toString());
      return { ...f, category: cat ? cat.category : 'General' };
    });

  } catch (error) {
    console.error("Error auto-categorizing:", error);
    return flashcards;
  }
};

/**
 * Get AI Tutor Response
 */
export const getTutorResponse = async (
  message: string,
  context: string,
  topic?: string,
  mode: 'standard' | 'hint' | 'analogy' = 'standard',
  currentCardContext?: string
): Promise<string> => {
  try {
    let systemInstruction = `Eres un tutor de IA experto y paciente, especializado en el método Socrático. ayúdame a entender.`;

    if (context) systemInstruction += `\nUsa este contexto de la clase: ${context.slice(0, 20000)}`;
    if (topic) systemInstruction += `\nEstamos estudiando: ${topic}`;
    if (currentCardContext) systemInstruction += `\nEl estudiante está viendo esta tarjeta/pregunta: ${currentCardContext}`;

    if (mode === 'hint') {
      systemInstruction += `\nEL ESTUDIANTE PIDIÓ UNA PISTA. NO des la respuesta. Da una pista sutil para guiarlo.`;
    } else if (mode === 'analogy') {
      systemInstruction += `\nEXPLICA CON UNA ANALOGÍA o METÁFORA creativa.`;
    } else {
      systemInstruction += `\nResponde de forma concisa y educativa. Si el estudiante hace una pregunta, guíalo.`;
    }

    const prompt = `${systemInstruction}\n\nEstudiante: ${message}`;
    return await generateContent(prompt);

  } catch (error) {
    console.error("Error getting tutor response:", error);
    return "Lo siento, tuve un problema pensando la respuesta.";
  }
};

/**
 * Get ZpBot Response (Hybrid RAG + General Knowledge)
 */
export const getZpBotResponse = async (
  message: string,
  contextMatches: string,
  chatHistory: { role: string; content: string }[],
  studySetId?: string
): Promise<{ text: string; suggestions: string[] }> => {
  try {
    // RAG Retrieval
    let ragContext = "";
    if (studySetId) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const chunks = await searchRelevantContext(message, user.id, 5, studySetId);
          if (chunks && chunks.length > 0) {
            ragContext = chunks.map(c => `[Fuente: ${c.source_name}]\n${c.content}`).join('\n\n');
            console.log(`RAG: Retrieved ${chunks.length} chunks for context.`);
          }
        }
      } catch (err) {
        console.warn("RAG retrieval failed, falling back to static context", err);
      }
    }

    // Determine effective context (RAG > Provided Context > None)
    const effectiveContext = ragContext || contextMatches || "No hay contexto específico.";

    const schema = {
      type: Type.OBJECT,
      properties: {
        text: { type: Type.STRING },
        suggestions: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      },
      required: ["text", "suggestions"]
    };

    const systemPrompt = `
Eres ZpBot, un tutor de estudio EXPERTO y DIRECTO. Tu objetivo principal es EDUCAR de forma clara y completa.

## REGLA #1: RESPONDE LO QUE TE PREGUNTAN
- Si preguntan "qué es X" → DEFINE X claramente con sus características principales
- Si preguntan "cómo funciona X" → EXPLICA el proceso paso a paso
- Si preguntan "por qué X" → DA LAS RAZONES

## ESTRUCTURA DE RESPUESTA:
1. **RESPUESTA DIRECTA**: Primero contesta la pregunta en 1-2 oraciones claras
2. **DESARROLLO**: Amplía con detalles importantes (características, ejemplos, datos clave)

## ESTILO:
- Lenguaje claro y accesible
- Puedes usar 1-2 emojis máximo
- Extensión: 4-8 oraciones según la complejidad

## PRIORIDAD DE FUENTES:
1. USA PRIMERO el contexto de materiales del estudiante
2. Si el contexto no tiene la información, usa tu conocimiento general

FORMATO JSON OBLIGATORIO:
{
  "text": "Tu respuesta educativa aquí...",
  "suggestions": ["Pregunta de seguimiento 1", "Pregunta 2", "Pregunta 3"]
}

## CONTEXTO DE MATERIALES DEL ESTUDIANTE (Recuperado de Memoria):
${effectiveContext.slice(0, 30000)}
    `;

    const historyText = chatHistory.slice(-10).map(msg => `${msg.role === 'user' ? 'Estudiante' : 'ZpBot'}: ${msg.content}`).join('\n');

    const fullPrompt = `
      ${systemPrompt}

      HISTORIAL DE CONVERSACIÓN RECIENTE:
      ${historyText}

      ESTUDIANTE AHORA:
      ${message}

      RESPUESTA (JSON):
    `;

    const result = await generateContent(fullPrompt, { jsonSchema: schema });
    const parsed = JSON.parse(result);
    return {
      text: parsed.text || "Lo siento, no pude generar una respuesta.",
      suggestions: parsed.suggestions?.slice(0, 3) || []
    };

  } catch (error) {
    console.error("Error getting ZpBot response:", error);
    return { text: "Lo siento, mis circuitos están un poco cruzados. Intenta de nuevo.", suggestions: [] };
  }
};

/**
 * Get ZpBot Response with STREAMING (Progressive text display)
 */
export const getZpBotResponseStream = async (
  message: string,
  contextMatches: string,
  chatHistory: { role: string; content: string }[],
  onChunk: (accumulatedText: string) => void,
  onComplete: (suggestions: string[]) => void,
  studySetId?: string
): Promise<string> => {
  const ai = getGeminiSDK();
  if (!ai) {
    const errorMsg = "Lo siento, ZpBot está desconectado.";
    onChunk(errorMsg);
    onComplete([]);
    return errorMsg;
  }

  try {

    // RAG Retrieval
    let ragContext = "";
    if (studySetId) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // Fetch more chunks for streaming to ensure good coverage
          const chunks = await searchRelevantContext(message, user.id, 8, studySetId);
          if (chunks && chunks.length > 0) {
            ragContext = chunks.map(c => `[Fuente: ${c.source_name}]\n${c.content}`).join('\n\n');
            console.log(`RAG (Stream): Retrieved ${chunks.length} chunks.`);
          }
        }
      } catch (err) {
        console.warn("RAG retrieval failed (stream), falling back", err);
      }
    }

    // Determine effective context
    const effectiveContext = ragContext || contextMatches || "No hay contexto específico de materiales.";

    const modelName = await getBestGeminiModel();

    const systemPrompt = `
Eres ZpBot, un tutor de estudio EXPERTO y DIRECTO. Tu objetivo principal es EDUCAR de forma clara y completa.

## REGLA #1: RESPONDE LO QUE TE PREGUNTAN
- Si preguntan "qué es X" → DEFINE X claramente con sus características principales
- Si preguntan "cómo funciona X" → EXPLICA el proceso paso a paso
- Si preguntan "por qué X" → DA LAS RAZONES
- NO te vayas por las ramas. RESPONDE PRIMERO, decora después.

## ESTRUCTURA DE RESPUESTA:
1. **RESPUESTA DIRECTA**: Primero contesta la pregunta en 1-2 oraciones claras
2. **DESARROLLO**: Amplía con detalles importantes (características, ejemplos, datos clave)
3. **CONEXIÓN**: Si es relevante, relaciona con otros conceptos del material

## ESTILO:
- Lenguaje claro y accesible (pero NO infantil)
- Puedes usar 1-2 emojis máximo al inicio
- Si hay una analogía útil, úsala brevemente
- Extensión: 4-8 oraciones según la complejidad de la pregunta
- FORMATO: Solo texto plano, NO uses JSON ni markdown excesivo

## PRIORIDAD DE FUENTES:
1. USA PRIMERO el contexto de materiales del estudiante si contiene información relevante
2. Si el contexto no tiene la información, usa tu conocimiento general
3. NUNCA inventes datos específicos (fechas, números, nombres) si no estás seguro

## CONTEXTO DE MATERIALES DEL ESTUDIANTE (Recuperado de Memoria):
${effectiveContext.slice(0, 30000)}
    `;

    const historyText = chatHistory.slice(-10)
      .map(msg => `${msg.role === 'user' ? 'Estudiante' : 'ZpBot'}: ${msg.content}`)
      .join('\n');

    const fullPrompt = `${systemPrompt}\n\nHISTORIAL:\n${historyText}\n\nESTUDIANTE: ${message}\n\nZpBot:`;

    // Use streaming
    const stream = await ai.models.generateContentStream({
      model: modelName,
      contents: fullPrompt,
      config: {
        maxOutputTokens: 1024,
        temperature: 0.7,
      }
    });

    let fullText = '';

    for await (const chunk of stream) {
      const chunkText = chunk.text || '';
      fullText += chunkText;
      onChunk(fullText);
    }

    // Generate suggestions separately
    const suggestions = await generateSuggestionsOnly(message, fullText);
    onComplete(suggestions);

    return fullText;

  } catch (error) {
    console.error("Error in streaming response:", error);
    const errorMsg = "Lo siento, tuve un problema. Intenta de nuevo.";
    onChunk(errorMsg);
    onComplete([]);
    return errorMsg;
  }
};

/**
 * Generate follow-up suggestions
 */
const generateSuggestionsOnly = async (
  userMessage: string,
  botResponse: string
): Promise<string[]> => {
  try {
    const schema = {
      type: Type.ARRAY,
      items: { type: Type.STRING }
    };

    const prompt = `
      Basado en esta conversación educativa:
      Pregunta: "${userMessage}"
      Respuesta: "${botResponse.slice(0, 500)}"

      Genera exactamente 3 preguntas de seguimiento cortas y relevantes.
      Idioma: Español.
    `;

    const result = await generateContent(prompt, { jsonSchema: schema });
    return JSON.parse(result).slice(0, 3);
  } catch {
    return [];
  }
};

/**
 * Generate Quiz Questions from Text
 */
export const generateQuizQuestions = async (text: string, count: number = 5): Promise<any[]> => {
  try {
    const schema = {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          question: { type: Type.STRING },
          options: { type: Type.ARRAY, items: { type: Type.STRING } },
          correctAnswer: { type: Type.STRING },
          explanation: { type: Type.STRING }
        },
        required: ["question", "options", "correctAnswer", "explanation"]
      }
    };

    const prompt = `Genera ${count} preguntas de opción múltiple basadas en este texto: ${text.slice(0, 10000)}.`;

    const result = await generateContent(prompt, { jsonSchema: schema });
    return JSON.parse(result);

  } catch (error) {
    console.error("Error generating quiz:", error);
    return [];
  }
};

/**
 * Generate Advanced Adaptive Quiz
 */
export const generateAdvancedQuiz = async (prompt: string): Promise<any[]> => {
  try {
    const schema = {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          type: { type: Type.STRING },
          question: { type: Type.STRING },
          options: { type: Type.ARRAY, items: { type: Type.STRING } },
          correctIndex: { type: Type.NUMBER },
          explanation: { type: Type.STRING },
          topic: { type: Type.STRING },
          scenario: { type: Type.STRING },
          designPrompt: { type: Type.STRING },
          evaluationCriteria: { type: Type.ARRAY, items: { type: Type.STRING } },
          realWorldExample: { type: Type.STRING },
          // Advanced types support
          orderingItems: { type: Type.ARRAY, items: { type: Type.STRING } },
          matchingPairs: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: { left: { type: Type.STRING }, right: { type: Type.STRING } }
            }
          },
          fillBlankText: { type: Type.STRING },
          fillBlankAnswers: { type: Type.ARRAY, items: { type: Type.STRING } },
          errorText: { type: Type.STRING }
        },
        required: ["question", "explanation", "type", "options", "correctIndex"]
      }
    };

    const result = await generateContent(prompt, { jsonSchema: schema });
    return JSON.parse(result);

  } catch (error) {
    console.error("Error generating advanced quiz:", error);
    return [];
  }
};

/**
 * Generate Podcast Script from Context
 */
export const generatePodcastScript = async (context: string) => {
  try {
    const schema = {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          speaker: { type: Type.STRING },
          text: { type: Type.STRING }
        },
        required: ["speaker", "text"]
      }
    };

    const prompt = `
      Crea un guion de podcast educativo (estilo conversación) sobre el siguiente tema.
      Dos presentadores: "Alex" (Experto/Profesor) y "Sam" (Curioso/Estudiante).

      Contexto: "${context.slice(0, 15000)}"

      Haz que sea dinámico, entretenido, con analogías. Duración breve (aprox 10-15 líneas de diálogo).
      Idioma: Español.
    `;

    const result = await generateContent(prompt, { jsonSchema: schema });
    return JSON.parse(result);
  } catch (error) {
    console.error("Error generating podcast script:", error);
    return [];
  }
};

/**
 * Generate Flashcards from Notebook Content (Incremental)
 */
export const generateFlashcardsFromNotebook = async (params: {
  newContent: string;
  previousContent: string;
  existingFlashcards: string;
  studySetName: string;
  notebookTitle: string;
  count: number;
}): Promise<{ question: string; answer: string; category: string }[]> => {
  const { newContent, previousContent, existingFlashcards, studySetName, notebookTitle, count } = params;

  if (!newContent || newContent.trim().length < 20) {
    return [];
  }

  try {
    const schema = {
      type: Type.OBJECT,
      properties: {
        flashcards: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              question: { type: Type.STRING },
              answer: { type: Type.STRING },
              category: { type: Type.STRING },
            },
            required: ["question", "answer", "category"],
          },
        },
      },
      required: ["flashcards"],
    };

    const prompt = `
Eres un experto creador de material de estudio con amplia experiencia en pedagogía.

TAREA: Genera TODAS las flashcards necesarias para cubrir EXHAUSTIVAMENTE el NUEVO CONTENIDO.

CUADERNO: "${notebookTitle}" (parte del set de estudio "${studySetName}")

NUEVO CONTENIDO (Analiza cada frase para extraer conocimiento):
---
${newContent.slice(0, 30000)}
---

${previousContent ? `
CONTEXTO PREVIO (usa para entender relaciones, NO generes flashcards de aquí):
---
${previousContent.slice(0, 15000)}
---
` : ''}

${existingFlashcards ? `
FLASHCARDS EXISTENTES (evita duplicados):
${existingFlashcards.slice(0, 3000)}
` : ''}

REGLA CRÍTICA SOBRE EJERCICIOS:
- NUNCA crees flashcards del tipo "Problema específico → Respuesta específica"
- Ejemplo INCORRECTO: "Resuelve 2x + 5 = 15" → "x = 5" (NO HAGAS ESTO)
- En su lugar, crea FLASHCARDS DE METODOLOGÍA:
- Ejemplo CORRECTO: "¿Cómo resolver una ecuación lineal?" → "1. Agrupar términos con variable, 2. Agrupar constantes, 3. Despejar"
- SÍ PUEDES crear: Fórmulas, definiciones, conceptos teóricos y metodologías (pasos para resolver TIPOS de problemas)

REGLAS DE COBERTURA:
1. CANTIDAD OBJETIVO: Genera aproximadamente ${count} flashcards. Si hay suficiente información, cumple este objetivo.
2. Si hay una lista, intenta crear una tarjeta sobre el concepto general y otras específicas si son importantes.
3. Prioriza la CALIDAD pero sin sacrificar la COBERTURA. Si está en el texto y es relevante, haz una tarjeta.
4. Cada flashcard debe ser autocontenida.
5. Categoriza inteligentemente (usa "Metodología" para pasos de resolución).

Idioma: Español.
Genera el JSON array con las tarjetas.
`;

    const result = await generateContent(prompt, {
      jsonSchema: schema,
      temperature: 0.7,
      maxTokens: 4000
    });

    const parsed = JSON.parse(result);
    return parsed.flashcards || [];

  } catch (error) {
    console.error("Error generating flashcards from notebook:", error);
    return [{
      question: `¿Cuáles son los puntos clave de las notas sobre ${notebookTitle}?`,
      answer: newContent.slice(0, 200) + '...',
      category: 'Resumen'
    }];
  }
};

/**
 * Notebook AI: Generate or expand content for unstructured notes
 */
export const generateUnstructuredNoteContent = async (
  prompt: string,
  previousContext: string,
  studySetContext: string
): Promise<string> => {
  const genAI = getGeminiSDK();
  if (!genAI) return '';

  try {
    const modelName = await getBestGeminiModel('pro');

    const systemPrompt = `
      Eres un experto asistente de redacción académica. Ayuda al estudiante a completar sus notas.
      
      CONTEXTO DE LA NOTA ACTUAL (último fragmento):
      ${previousContext.slice(-1000)}
      
      CONTEXTO DE MATERIAL DE ESTUDIO (Referencia):
      ${studySetContext.slice(0, 3000)}
      
      SOLICITUD:
      "${prompt}"
      
      FORMATO DE SALIDA:
      - Devuelve HTML crudo para insertar en el editor Tiptap.
      - Usa etiquetas semánticas: <p>, <ul>, <li>, <strong>, <blockquote>.
      - NO uses markdown ticks (\`\`\`). Solo el HTML.
      - Sé directo y útil.
    `;

    const response = await genAI.models.generateContent({
      model: modelName,
      contents: systemPrompt,
      config: {
        maxOutputTokens: 1000,
        temperature: 0.7,
      }
    });

    // Handle potential markdown code block wrapping in the output
    let text = response.text || '';
    text = text.replace(/^```html\s*/i, '').replace(/\s*```$/, '');

    return text;

  } catch (error) {
    console.error("Error in AI Notebook Gen:", error);
    return '<p><em>Error generando contenido AI. Intenta de nuevo.</em></p>';
  }
};

/**
 * Mind Map Node and Edge types for concept visualization
 */
export interface MindMapNode {
  id: string;
  label: string;
  type: 'root' | 'concept' | 'subconcept' | 'detail';
  color?: string;
}

export interface MindMapEdge {
  source: string;
  target: string;
  label?: string;
}

export interface MindMapData {
  nodes: MindMapNode[];
  edges: MindMapEdge[];
}

/**
 * Generate a concept mind map from materials and notebooks content
 */
export const generateMindMapFromContent = async (
  materials: { name: string; content: string }[],
  notebooks: { title: string; content: string }[],
  studySetName: string
): Promise<MindMapData> => {
  const genAI = getGeminiSDK();
  if (!genAI) {
    console.warn('Gemini SDK not available');
    return { nodes: [], edges: [] };
  }

  try {
    const modelName = await getBestGeminiModel('pro');

    // Combine content from materials and notebooks
    const materialContent = materials
      .filter(m => m.content && m.content.trim().length > 10)
      .map(m => `[MATERIAL: ${m.name}]\n${m.content.substring(0, 2000)}`)
      .join('\n\n');

    const notebookContent = notebooks
      .filter(n => n.content && n.content.trim().length > 10)
      .map(n => `[CUADERNO: ${n.title}]\n${n.content.substring(0, 2000)}`)
      .join('\n\n');

    const combinedContent = `${materialContent}\n\n${notebookContent}`.substring(0, 8000);

    if (combinedContent.trim().length < 50) {
      return { nodes: [], edges: [] };
    }

    const prompt = `
Analiza el siguiente contenido educativo y genera un mapa mental de conceptos.

CONTENIDO:
${combinedContent}

NOMBRE DEL SET: ${studySetName}

INSTRUCCIONES:
1. Identifica los 4-7 conceptos principales del contenido
2. Para cada concepto principal, identifica 2-4 subconceptos o detalles importantes
3. Genera conexiones lógicas entre los conceptos

FORMATO DE RESPUESTA (JSON estricto):
{
  "nodes": [
    {"id": "root", "label": "Tema Principal", "type": "root"},
    {"id": "c1", "label": "Concepto 1", "type": "concept"},
    {"id": "c1_1", "label": "Subconcepto 1.1", "type": "subconcept"},
    ...
  ],
  "edges": [
    {"source": "root", "target": "c1"},
    {"source": "c1", "target": "c1_1"},
    ...
  ]
}

REGLAS:
- El nodo "root" debe tener el nombre del tema principal (no el nombre del set)
- Máximo 20 nodos en total
- Cada concepto principal debe conectarse al root
- Los subconceptos se conectan a su concepto padre
- Labels cortos (máximo 30 caracteres)
- IDs únicos sin espacios
`;

    const response = await genAI.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        maxOutputTokens: 2000,
        temperature: 0.3,
      }
    });

    const text = response.text || '';
    const data = JSON.parse(text);

    // Validate and sanitize the response
    if (!data.nodes || !Array.isArray(data.nodes) || !data.edges || !Array.isArray(data.edges)) {
      throw new Error('Invalid mind map structure');
    }

    // Ensure all nodes have required fields
    const validNodes: MindMapNode[] = data.nodes
      .filter((n: any) => n.id && n.label && n.type)
      .map((n: any) => ({
        id: String(n.id),
        label: String(n.label).substring(0, 40),
        type: ['root', 'concept', 'subconcept', 'detail'].includes(n.type) ? n.type : 'concept'
      }));

    // Ensure all edges reference valid nodes
    const nodeIds = new Set(validNodes.map(n => n.id));
    const validEdges: MindMapEdge[] = data.edges
      .filter((e: any) => e.source && e.target && nodeIds.has(e.source) && nodeIds.has(e.target))
      .map((e: any) => ({
        source: String(e.source),
        target: String(e.target),
        label: e.label ? String(e.label) : undefined
      }));

    return { nodes: validNodes, edges: validEdges };

  } catch (error) {
    console.error('Error generating mind map:', error);
    return { nodes: [], edges: [] };
  }
};
