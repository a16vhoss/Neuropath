
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



export const getTutorResponse = async (question: string, context: string, subject?: string, mode: 'standard' | 'hint' | 'analogy' = 'standard') => {
  if (!API_KEY) return "Lo siento, la IA no está disponible en este momento.";

  const ai = new GoogleGenAI({ apiKey: API_KEY });

  let systemInstruction = "Actúa como un tutor socrático experto.";
  if (subject) {
    systemInstruction += ` Tu especialidad es ${subject}. Adapta tus explicaciones, terminología y tono a esta materia.`;
  }

  if (mode === 'hint') {
    systemInstruction += " El estudiante pidió una pista. NO des la respuesta completa. Da una pequeña pista progresiva que lo desbloquee sin revelar la solución.";
  } else if (mode === 'analogy') {
    systemInstruction += " El estudiante pidió una analogía. Usa una metáfora creativa y cotidiana (vida real, deportes, cultura pop) para explicar el concepto complejo.";
  } else {
    systemInstruction += " No des la respuesta directamente. Haz preguntas que guíen al estudiante a descubrir la respuesta por sí mismo.";
  }

  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: `Contexto del estudio: ${context}. Pregunta/Comentario del estudiante: ${question}`,
    config: {
      systemInstruction: systemInstruction
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

export const generateQuizQuestions = async (context: string) => {
  if (!API_KEY || API_KEY === 'PLACEHOLDER_API_KEY') {
    return [];
  }

  try {
    const ai = new GoogleGenAI({ apiKey: API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: `Generate 5 multiple-choice quiz questions based on the following context.
      Context: ${context.substring(0, 20000)} ...
      
      Return JSON format.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              question: { type: Type.STRING },
              options: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              correctIndex: { type: Type.NUMBER, description: "Index of the correct option (0-3)" },
              explanation: { type: Type.STRING }
            },
            required: ["question", "options", "correctIndex", "explanation"]
          }
        }
      }
    });

    return JSON.parse(response.text || "[]");
  } catch (e) {
    console.error("Failed to generate quiz", e);
    return [];
  }
};

export const generatePodcastScript = async (context: string) => {
  if (!API_KEY || API_KEY === 'PLACEHOLDER_API_KEY') {
    return [];
  }

  try {
    const ai = new GoogleGenAI({ apiKey: API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: `Convert the following study notes into an engaging podcast script between two hosts, Alex (enthusiastic, asks questions) and Sam (expert, explains concepts with analogies). 
      Make it feel like a real conversation with banter. Keep it under 5 minutes reading time.
      
      Context: ${context.substring(0, 20000)} ...
      
      Return JSON format.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              speaker: { type: Type.STRING, enum: ["Alex", "Sam"] },
              text: { type: Type.STRING }
            },
            required: ["speaker", "text"]
          }
        }
      }
    });

    return JSON.parse(response.text || "[]");
  } catch (e) {
    console.error("Failed to generate podcast", e);
    return [];
  }
};
