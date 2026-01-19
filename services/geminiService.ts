
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



export const getTutorResponse = async (question: string, context: string, subject?: string, mode: 'standard' | 'hint' | 'analogy' = 'standard', currentContext?: string) => {
  if (!API_KEY) return "Lo siento, la IA no está disponible en este momento.";

  const ai = new GoogleGenAI({ apiKey: API_KEY });

  let systemInstruction = "Actúa como un tutor socrático experto.";
  if (subject) {
    systemInstruction += ` Tu especialidad es ${subject}. Adapta tus explicaciones, terminología y tono a esta materia.`;
  }

  // Add visibility of what the student is looking at
  if (currentContext) {
    systemInstruction += ` El estudiante está viendo actualmente: "${currentContext}". Usa esto como referencia principal para tus explicaciones si es relevante.`;
  }

  if (mode === 'hint') {
    systemInstruction += " El estudiante pidió una pista para lo que está viendo. NO des la respuesta completa. Da una pequeña pista progresiva que lo desbloquee sin revelar la solución.";
  } else if (mode === 'analogy') {
    systemInstruction += " El estudiante pidió una analogía para lo que está viendo. Usa una metáfora creativa y cotidiana (vida real, deportes, cultura pop) para explicar el concepto complejo.";
  } else {
    systemInstruction += " No des la respuesta directamente. Haz preguntas que guíen al estudiante a descubrir la respuesta por sí mismo.";
  }

  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: `Contexto del estudio (materiales): ${context}. \n\nLo que ve el estudiante ahora (Pregunta activa): ${currentContext || 'N/A'} \n\nPregunta/Comentario del estudiante: ${question}`,
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

// NEW: Direct YouTube video analysis - Gemini analyzes the video from URL
export const generateFlashcardsFromYouTubeURL = async (youtubeUrl: string) => {
  if (!API_KEY || API_KEY === 'PLACEHOLDER_API_KEY') {
    throw new Error('API key not configured');
  }

  try {
    const ai = new GoogleGenAI({ apiKey: API_KEY });

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              fileData: {
                fileUri: youtubeUrl,
                mimeType: "video/*"
              }
            },
            {
              text: `Analiza este video de YouTube y genera 10-15 flashcards educativas de alta calidad en español.
              
              Para cada flashcard:
              - La pregunta debe ser clara y específica sobre un concepto del video
              - La respuesta debe ser completa pero concisa
              - La categoría debe reflejar el tema principal
              
              Las flashcards deben cubrir los conceptos más importantes del video.`
            }
          ]
        }
      ],
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

    const cards = JSON.parse(response.text || "[]");

    if (!cards || cards.length === 0) {
      throw new Error('No se pudieron generar flashcards del video');
    }

    return cards;
  } catch (e: any) {
    console.error("Failed to analyze YouTube video:", e);

    // Provide more helpful error messages
    if (e.message?.includes('PERMISSION_DENIED')) {
      throw new Error('El video es privado o tiene restricciones de acceso');
    } else if (e.message?.includes('NOT_FOUND')) {
      throw new Error('No se encontró el video. Verifica que el enlace sea correcto');
    } else if (e.message?.includes('INVALID_ARGUMENT')) {
      throw new Error('Enlace de YouTube inválido. Usa el formato: youtube.com/watch?v=...');
    }

    throw new Error(`Error al analizar el video: ${e.message || 'intenta con otro video'}`);
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
