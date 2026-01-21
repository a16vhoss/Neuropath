import { SchemaType } from "@google/generative-ai";
import { getBestGeminiModel, getGeminiSDK } from "./geminiModelManager";
import { YoutubeTranscript } from 'youtube-transcript';

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
export const generateStudySetFromContext = async (context: string) => {
  if (!context || context.length < 10) return [];

  const genAI = getGeminiSDK();
  if (!genAI) return [];

  try {
    const modelName = await getBestGeminiModel();
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
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
                  category: { type: SchemaType.STRING }
                },
                required: ["question", "answer", "category"]
              }
            }
          },
          required: ["flashcards"]
        }
      }
    });

    const prompt = `
        Genera un set de flashcards basado en el siguiente texto.
        Texto: "${context.slice(0, 15000)}"
        
        Genera entre 5 y 15 flashcards dependiendo de la longitud y densidad del texto.
        Idioma: Español.
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
export const generateFlashcardsFromYouTubeURL = async (url: string) => {
  try {
    // 1. Get Transcript
    const transcriptItems = await YoutubeTranscript.fetchTranscript(url, { lang: 'es' });
    if (!transcriptItems || transcriptItems.length === 0) {
      throw new Error("No transcript found (or not in Spanish)");
    }

    const fullText = transcriptItems.map(item => item.text).join(' ');

    // 2. Generate Flashcards from Transcript
    const flashcards = await generateStudySetFromContext(fullText);

    // Return both flashcards and the summary text (transcript)
    return {
      flashcards,
      summary: fullText.slice(0, 1000) + "..." // Simple summary for now
    };

  } catch (error) {
    console.error("Error processing YouTube URL:", error);
    throw error;
  }
};

/**
 * Generate Flashcards from Web URL (Placeholder / Simple Text logic)
 */
export const generateFlashcardsFromWebURL = async (url: string) => {
  try {
    const response = await fetch(url);
    const text = await response.text();
    const cleanText = text.replace(/<[^>]*>?/gm, ' ').slice(0, 20000); // Strip HTML tags
    return await generateStudySetFromContext(cleanText);
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
