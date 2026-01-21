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
  // Note: Fetching web content client-side often hits CORS.
  // Ideally this would be server-side. For now, we will assume
  // we can't easily fetch arbitrary URLs client-side without a proxy.
  // We'll implement a "best effort" or mock for now, OR rely on the user pasting text.
  // If the requirement is strict, we'd need a proxy function in Supabase.

  // For this 'fix', we will just implement it to avoid build errors, 
  // maybe try to fetch if CORS allows, else fail gracefully.
  try {
    const response = await fetch(url);
    const text = await response.text();
    // Very basic scraping (extract body text) - likely to be messy HTML
    // Use a simple regex to strip tags? Or just pass to Gemini if it's not too huge?
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
