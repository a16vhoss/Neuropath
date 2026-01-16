
import { GoogleGenAI, Type } from "@google/genai";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

export const generateStudyFlashcards = async (topic: string) => {
  if (!API_KEY || API_KEY === 'PLACEHOLDER_API_KEY') {
    console.warn('No valid Gemini API key provided, using fallback flashcards');
    return [];
  }

  try {
    const ai = new GoogleGenAI({ apiKey: API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: `Generate 5 educational flashcards about "${topic}" in Spanish.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              question: { type: Type.STRING },
              answer: { type: Type.STRING },
              category: { type: Type.STRING }
            },
            required: ["question", "answer", "category"]
          }
        }
      }
    });

    return JSON.parse(response.text || "[]");
  } catch (e) {
    console.error("Failed to generate flashcards", e);
    return [];
  }
};


export const getTutorResponse = async (question: string, context: string) => {
  if (!API_KEY) return "Lo siento, la IA no está disponible en este momento.";

  const ai = new GoogleGenAI({ apiKey: API_KEY });
  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: `Actúa como un tutor socrático. El estudiante está estudiando: ${context}. El estudiante pregunta: ${question}`,
    config: {
      systemInstruction: "No des la respuesta directamente. Haz preguntas que guíen al estudiante a descubrir la respuesta por sí mismo."
    }
  });

  return response.text;
};

// Unified function for Magic Import
export const generateStudySetFromContext = async (content: string, type: 'text' | 'pdf' | 'youtube') => {
  if (!API_KEY || API_KEY === 'PLACEHOLDER_API_KEY') {
    console.warn('No valid Gemini API key provided, using fallback flashcards');
    return [];
  }

  try {
    const ai = new GoogleGenAI({ apiKey: API_KEY });

    let prompt = `Analyze the following content and generate 10 high-quality educational flashcards in Spanish.
    Content Type: ${type}
    Content: ${content.substring(0, 30000)} ... (truncated for token limit)`;

    if (type === 'youtube') {
      prompt = `Analyze the following YouTube video transcript/description and generate 10 key concept flashcards in Spanish.
      Content: ${content.substring(0, 30000)}`;
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              question: { type: Type.STRING },
              answer: { type: Type.STRING },
              category: { type: Type.STRING }
            },
            required: ["question", "answer", "category"]
          }
        }
      }
    });

    return JSON.parse(response.text || "[]");
  } catch (e) {
    console.error("Failed to generate study set from context", e);
    throw e;
  }
};
