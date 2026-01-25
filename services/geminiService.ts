import { Type } from "@google/genai";
import { getBestGeminiModel, getGeminiSDK, getSearchModel } from "./geminiModelManager";
import { getYoutubeTranscript } from "./youtubeService";

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

  return response.text || "";
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

      REGLAS:
      - Preguntas claras y directas relacionadas con "${studySetName}".
      - Respuestas concisas pero completas.
      - Categoriza cada tarjeta (ej: Definición, Concepto, Relación, Importante).
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
 * Generate Study Set (Flashcards) from Context text
 */
export const generateStudySetFromContext = async (context: string, count: number = 10) => {
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

    const prompt = `
      OBJETIVO: Genera EXACTAMENTE ${count} flashcards de alta calidad basadas en el texto proporcionado.

      INSTRUCCIONES CRÍTICAS DE COBERTURA Y FUENTES:
      1. ESCANEO DETALLADO: Escanea el texto secuencialmente.
      2. GRANULARIDAD EXTREMA: Extrae detalles finos para cumplir con la cuota de ${count}.
      3. COBERTURA GLOBAL: Distribuye las preguntas en todo el texto.
      4. IDENTIFICACIÓN DE FUENTE: Para cada tarjeta, indica el nombre del material del que proviene en "source_name".
      5. CANTIDAD EXACTA: Genera EXACTAMENTE ${count} flashcards.
      6. IDIOMA: Español.

      TEXTO: "${context.slice(0, 100000)}"
    `;

    const result = await generateContent(prompt, {
      jsonSchema: schema,
      temperature: 0.7,
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
 * Generate Flashcards from YouTube URL
 */
export const generateFlashcardsFromYouTubeURL = async (url: string, count: number = 10) => {
  try {
    const result = await getYoutubeTranscript(url);
    if (!result) {
      throw new Error("No se pudo obtener el contenido del video.");
    }

    const { transcript, title, description, isMetadataOnly } = result;

    let promptContext = transcript;
    if (isMetadataOnly || !transcript) {
      promptContext = `
        TÍTULO DEL VIDEO: ${title}
        DESCRIPCIÓN DEL VIDEO: ${description}
        (Nota: Los subtítulos no están disponibles, genera flashcards basadas en esta descripción).
      `.trim();
    }

    const flashcards = await generateStudySetFromContext(promptContext, count);

    const videoTitle = title || "Video de YouTube (" + (new URL(url).searchParams.get('v') || 'ID desconocido') + ")";

    return {
      flashcards,
      summary: (isMetadataOnly || !transcript) ? description.slice(0, 1000) : transcript.slice(0, 1000) + "...",
      videoUrl: url,
      videoTitle,
      channelName: "YouTube"
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

    return {
      flashcards,
      summary: cleanText.slice(0, 1000) + "...",
      pageTitle: "Página Web (" + new URL(url).hostname + ")",
      sourceUrl: url
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
): Promise<{ text: string; suggestions: string[] }> => {
  try {
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
      Eres ZpBot, un compañero de estudio inteligente, divertido y experto en pedagogía.

      TU REGLA DE ORO:
      **RESPONDE EXACTAMENTE A LO QUE TE PREGUNTAN.** Pero hazlo memorable.

      TÉCNICAS DE ENSEÑANZA AVANZADAS (ÚSALAS):
      1. **METÁFORAS Y ANALOGÍAS**: Explica conceptos abstractos comparándolos con cosas de la vida real.
      2. **MNEMOTECNIAS**: Si hay una lista o pasos, inventa un acrónimo o frase divertida.
      3. **HILO SOCRÁTICO LIGERO**: No solo escupas el dato, conecta la idea.

      PERSONALIDAD:
      - **EXPLICAR COMO A UN NIÑO DE 5 AÑOS**: Lenguaje súper sencillo.
      - **AMIGABLE**: Usa emojis.

      DIRECTRICES:
      - **LONGITUD**: Máximo 3-4 frases. ¡Sé breve!
      - **PRECISIÓN**: Aunque el tono sea divertido, la información debe ser exacta.

      FORMATO JSON OBLIGATORIO:
      {
        "text": "Tu explicación con metáfora/mnemotecnia aquí...",
        "suggestions": [
          "Pregunta 1",
          "Pregunta 2",
          "Pregunta 3"
        ]
      }

      CONTEXTO DE MATERIALES:
      ${contextMatches ? contextMatches.slice(0, 25000) : "No hay contexto específico."}
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
  onComplete: (suggestions: string[]) => void
): Promise<string> => {
  const ai = getGeminiSDK();
  if (!ai) {
    const errorMsg = "Lo siento, ZpBot está desconectado.";
    onChunk(errorMsg);
    onComplete([]);
    return errorMsg;
  }

  try {
    const modelName = await getBestGeminiModel();

    const systemPrompt = `
      Eres ZpBot, un compañero de estudio inteligente, divertido y experto en pedagogía.

      TU REGLA DE ORO:
      **RESPONDE EXACTAMENTE A LO QUE TE PREGUNTAN.** Pero hazlo memorable.

      TÉCNICAS DE ENSEÑANZA:
      1. **METÁFORAS Y ANALOGÍAS**: Explica conceptos con comparaciones de la vida real.
      2. **MNEMOTECNIAS**: Si hay listas, inventa frases para recordar.
      3. **HILO SOCRÁTICO**: Conecta las ideas.

      PERSONALIDAD:
      - Lenguaje súper sencillo.
      - Usa emojis.

      DIRECTRICES:
      - **LONGITUD**: Máximo 3-4 frases. ¡Sé breve!
      - **FORMATO**: Solo texto plano, NO uses JSON.

      CONTEXTO DE MATERIALES:
      ${contextMatches ? contextMatches.slice(0, 20000) : "No hay contexto específico."}
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
          realWorldExample: { type: Type.STRING }
        },
        required: ["question", "options", "correctIndex", "explanation", "type"]
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

TAREA: Genera exactamente ${count} flashcards de ALTA CALIDAD basadas en el NUEVO CONTENIDO.

CUADERNO: "${notebookTitle}" (parte del set de estudio "${studySetName}")

NUEVO CONTENIDO (genera flashcards ÚNICAMENTE de esto):
---
${newContent.slice(0, 25000)}
---

${previousContent ? `
CONTEXTO PREVIO (usa para entender relaciones y terminología, pero NO generes flashcards de aquí):
---
${previousContent.slice(0, 15000)}
---
` : ''}

${existingFlashcards ? `
FLASHCARDS EXISTENTES (evita preguntas similares o duplicadas):
${existingFlashcards.slice(0, 3000)}
` : ''}

REGLAS ESTRICTAS:
1. Las flashcards deben venir ÚNICAMENTE del nuevo contenido
2. Usa el contexto previo para entender terminología
3. Evita preguntas que ya existen
4. Cada flashcard debe ser autocontenida
5. Prioriza: definiciones > conceptos clave > relaciones > ejemplos
6. Categoriza: Definición, Concepto, Relación, Ejemplo, Importante, Proceso, Fórmula

Idioma: Español.
Genera EXACTAMENTE ${count} flashcards de alta calidad.
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
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        maxOutputTokens: 1000,
        temperature: 0.7, // Higher creativity for drafting
      }
    });

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

    const result = await model.generateContent(systemPrompt);
    return result.response.text();

  } catch (error) {
    console.error("Error in AI Notebook Gen:", error);
    return '<p><em>Error generando contenido AI. Intenta de nuevo.</em></p>';
  }
};
