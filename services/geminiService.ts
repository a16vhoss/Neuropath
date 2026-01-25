import { SchemaType } from "@google/generative-ai";
import { getBestGeminiModel, getGeminiSDK } from "./geminiModelManager";
import { getYoutubeTranscript } from "./youtubeService";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

/**
 * Generate Flashcards from a general Topic
 */
export const generateStudyFlashcards = async (topic: string) => {
  if (!API_KEY || API_KEY === 'PLACEHOLDER_API_KEY') {
    console.warn('No valid Gemini API key provided, using fallback flashcards');
    return [];
  }

  try {
    const genAI = getGeminiSDK();
    if (!genAI) throw new Error("Failed to init SDK");

    const modelName = await getBestGeminiModel();

    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              question: { type: SchemaType.STRING },
              answer: { type: SchemaType.STRING },
              category: { type: SchemaType.STRING },
            },
            required: ["question", "answer"],
          },
        },
      },
    });

    const prompt = `
      Genera 5 tarjetas de estudio (flashcards) sobre: "${topic}".
      Formato JSON exacto.
      Cada tarjeta debe tener "question", "answer", y "category" (Ej: Concepto, Definición, Ejemplo).
      Idioma: Español.
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    return JSON.parse(text);
  } catch (error) {
    console.error("Error generating flashcards with Gemini:", error);
    return [
      { question: "¿Qué es " + topic + "?", answer: "Es un concepto clave en el estudio...", category: "Definición" },
      { question: "Ejemplo de " + topic, answer: "Un ejemplo común es...", category: "Ejemplo" }
    ];
  }
};

/**
 * Generate Study Set (Flashcards) from Context text
 */
export const generateStudySetFromContext = async (context: string, count: number = 10) => {
  if (!context || context.length < 10) return [];

  const genAI = getGeminiSDK();
  if (!genAI) return [];

  try {
    const modelName = await getBestGeminiModel('pro');
    console.log(`Using model ${modelName} for ${count} manual flashcards`);

    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        maxOutputTokens: 8192,
        temperature: 0.7,
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            flashcards: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  question: { type: SchemaType.STRING },
                  answer: { type: SchemaType.STRING },
                  category: { type: SchemaType.STRING },
                  source_name: { type: SchemaType.STRING }
                },
                required: ["question", "answer", "category", "source_name"]
              }
            }
          },
          required: ["flashcards"]
        }
      }
    });

    const prompt = `
        OBJETIVO: Genera EXACTAMENTE ${count} flashcards de alta calidad basadas en el texto proporcionado.
        
        INSTRUCCIONES CRÍTICAS DE COBERTURA Y FUENTES:
        1. ESCANEO DETALLADO: Escanea el texto secuencialmente.
        2. GRANULARIDAD EXTREMA: Extrae detalles finos para cumplir con la cuota de ${count}.
        3. COBERTURA GLOBAL: Distribuye las preguntas en todo el texto.
        4. IDENTIFICACIÓN DE FUENTE: Para cada tarjeta, indica el nombre del material del que proviene en "source_name". Si el texto tiene marcadores "[MATERIAL: Nombre]", usa ese nombre.
        5. CANTIDAD EXACTA: Genera EXACTAMENTE ${count} flashcards.
        6. IDIOMA: Español.
        
        TEXTO: "${context.slice(0, 100000)}"
        `;

    const result = await model.generateContent(prompt);
    const data = JSON.parse(result.response.text());
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
    // 1. Get Transcript via Proxy (CORS safe)
    const result = await getYoutubeTranscript(url);
    if (!result) {
      throw new Error("No se pudo obtener el contenido del video.");
    }

    const { transcript, title, description, isMetadataOnly } = result;

    // 2. Prepare Context for Gemini
    // If we only have metadata, we construct a descriptive context
    let promptContext = transcript;
    if (isMetadataOnly || !transcript) {
      promptContext = `
        TÍTULO DEL VIDEO: ${title}
        DESCRIPCIÓN DEL VIDEO: ${description}
        (Nota: Los subtítulos no están disponibles, genera flashcards basadas en esta descripción).
      `.trim();
    }

    const flashcards = await generateStudySetFromContext(promptContext, count);

    // Standardize video title
    const videoTitle = title || "Video de YouTube (" + (new URL(url).searchParams.get('v') || 'ID desconocido') + ")";

    // Return both flashcards and the summary text
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
 * Generate Flashcards from Web URL (Placeholder / Simple Text logic)
 */
export const generateFlashcardsFromWebURL = async (url: string, count: number = 10) => {
  try {
    const response = await fetch(url);
    const text = await response.text();
    const cleanText = text.replace(/<[^>]*>?/gm, ' ').slice(0, 20000); // Strip HTML tags

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
  const genAI = getGeminiSDK();
  if (!genAI || flashcards.length === 0) return flashcards;

  try {
    const modelName = await getBestGeminiModel();
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              id: { type: SchemaType.STRING }, // to match back
              category: { type: SchemaType.STRING }
            }
          }
        }
      }
    });

    const prompt = `
         Categoriza las siguientes flashcards en temas breves (ej: Historia, Definición, Fórmula).
         Input JSON: ${JSON.stringify(flashcards.map((f, i) => ({ id: i.toString(), q: f.question })))}
         Devuelve un array con {id, category}.
         `;

    const result = await model.generateContent(prompt);
    const categories = JSON.parse(result.response.text());

    // Merge back
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
  const genAI = getGeminiSDK();
  if (!genAI) return "Lo siento, no puedo conectar con mi cerebro IA en este momento.";

  try {
    const modelName = await getBestGeminiModel();
    const model = genAI.getGenerativeModel({ model: modelName });

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

    const result = await model.generateContent([
      systemInstruction,
      message
    ]);

    return result.response.text();

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
  contextMatches: string, // Retrieved snippets from materials
  chatHistory: { role: string; content: string }[],
): Promise<string> => {
  const genAI = getGeminiSDK();
  if (!genAI) return "Lo siento, ZpBot está desconectado.";

  try {
    const modelName = await getBestGeminiModel();
    const model = genAI.getGenerativeModel({ model: modelName });

    const systemPrompt = `
      Eres ZpBot, un asistente de estudio inteligente y amigable.
      
      TU MISIÓN:
      Ayudar al estudiante a aprender respondiendo sus dudas DIRECTAMENTE.
      A diferencia de un tutor socrático, TÚ SÍ PUEDES DAR RESPUESTAS si te las piden, pero siempre intenta explicar el "por qué".
      
      FUENTES DE CONOCIMIENTO (En orden de prioridad):
      1. USAR PRIMERO: El contexto proporcionado abajo (Materiales del estudiante). Si la respuesta está aquí, úsala y cítala implícitamente.
      2. USAR SEGUNDO: Tu conocimiento general. Si el contexto no tiene la respuesta, USA TU PROPIO CONOCIMIENTO para ayudar. NO digas "no tengo información", simplemente responde lo mejor que sepas, pero aclara sutilmente si estás saliendo del material del curso (ej: "Aunque esto no está en tus notas, generalmente...").
      
      PERSONALIDAD:
      - Nombre: ZpBot.
      - Tono: Profesional pero cercano, emojis ocasionales 🤖.
      - Memoria: Usa el historial de chat para mantener el hilo.
      
      CONTEXTO DE MATERIALES:
      ${contextMatches ? contextMatches.slice(0, 25000) : "No hay materiales específicos cargados para esta consulta."}
    `;

    // Construct chat history for the model
    // Note: Gemini API `generateContent` accepts a simpler format or Multi-turn `startChat`. 
    // For specific content generation with system prompt embedded, we'll maintain history in the prompt 
    // or use `startChat` if we were stateless, but here we rebuild context each time.
    // Let's use `startChat` for better multi-turn handling if possible, or just append history strings.
    // For simplicity and prompt control, we'll append history.

    const historyText = chatHistory.slice(-10).map(msg => `${msg.role === 'user' ? 'Estudiante' : 'ZpBot'}: ${msg.content}`).join('\n');

    const fullPrompt = `
      ${systemPrompt}

      HISTORIAL DE CONVERSACIÓN RECIENTE:
      ${historyText}

      ESTUDIANTE AHORA:
      ${message}

      RESPUESTA DE ZPBOT:
    `;

    const result = await model.generateContent(fullPrompt);
    return result.response.text();

  } catch (error) {
    console.error("Error getting ZpBot response:", error);
    return "Lo siento, mis circuitos están un poco cruzados. Intenta de nuevo.";
  }
};

/**
 * Generate Quiz Questions from Text
 */
export const generateQuizQuestions = async (text: string, count: number = 5): Promise<any[]> => {
  const genAI = getGeminiSDK();
  if (!genAI) return [];

  try {
    const modelName = await getBestGeminiModel();
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              question: { type: SchemaType.STRING },
              options: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
              correctAnswer: { type: SchemaType.STRING }, // index or text? Let's use text for simplicity here or update StudySession to match
              explanation: { type: SchemaType.STRING }
            },
            required: ["question", "options", "correctAnswer", "explanation"]
          }
        }
      }
    });

    const prompt = `Genera ${count} preguntas de opción múltiple basadas en este texto: ${text.slice(0, 10000)}.`;

    const result = await model.generateContent(prompt);
    return JSON.parse(result.response.text());

  } catch (error) {
    console.error("Error generating quiz:", error);
    return [];
  }
};

/**
 * Generate Advanced Adaptive Quiz (for QuizService)
 * Supports custom schema with correctIndex and question types
 */
export const generateAdvancedQuiz = async (prompt: string): Promise<any[]> => {
  const genAI = getGeminiSDK();
  if (!genAI) return [];

  try {
    const modelName = await getBestGeminiModel();
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              type: { type: SchemaType.STRING },
              question: { type: SchemaType.STRING },
              options: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
              correctIndex: { type: SchemaType.NUMBER },
              explanation: { type: SchemaType.STRING },
              topic: { type: SchemaType.STRING },
              scenario: { type: SchemaType.STRING },
              designPrompt: { type: SchemaType.STRING },
              evaluationCriteria: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
              realWorldExample: { type: SchemaType.STRING }
            },
            required: ["question", "options", "correctIndex", "explanation", "type"]
          }
        }
      }
    });

    // The prompt is already fully formed by QuizService, so we pass it directly
    const result = await model.generateContent(prompt);
    return JSON.parse(result.response.text());

  } catch (error) {
    console.error("Error generating advanced quiz:", error);
    return [];
  }
};

/**
 * Generate Podcast Script from Context
 */
export const generatePodcastScript = async (context: string) => {
  const genAI = getGeminiSDK();
  if (!genAI) return [];

  try {
    const modelName = await getBestGeminiModel();
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        // Return JSON array of {speaker, text}
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              speaker: { type: SchemaType.STRING },
              text: { type: SchemaType.STRING }
            },
            required: ["speaker", "text"]
          }
        }
      }
    });

    const prompt = `
        Crea un guion de podcast educativo (estilo conversación) sobre el siguiente tema.
        Dos presentadores: "Alex" (Experto/Profesor) y "Sam" (Curioso/Estudiante).
        
        Contexto: "${context.slice(0, 15000)}"
        
        Haz que sea dinámico, entretenido, con analogías. Duración breve (aprox 10-15 líneas de diálogo).
        Idioma: Español.
        `;

    const result = await model.generateContent(prompt);
    return JSON.parse(result.response.text());
  } catch (error) {
    console.error("Error generating podcast script:", error);
    return [];
  }
};
