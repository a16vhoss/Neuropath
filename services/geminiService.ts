
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

// NEW: YouTube video analysis using oEmbed metadata
export interface YouTubeAnalysisResult {
  flashcards: Array<{ question: string; answer: string; category: string }>;
  summary: string;
  videoTitle: string;
  channelName: string;
  videoUrl: string;
}

export const generateFlashcardsFromYouTubeURL = async (youtubeUrl: string): Promise<YouTubeAnalysisResult> => {
  if (!API_KEY || API_KEY === 'PLACEHOLDER_API_KEY') {
    throw new Error('API key not configured');
  }

  try {
    // Extract video ID
    const videoIdMatch = youtubeUrl.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (!videoIdMatch) {
      throw new Error('No se pudo extraer el ID del video');
    }
    const videoId = videoIdMatch[1];

    // Get video metadata via oEmbed (no API key needed, no CORS issues)
    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    const metaResponse = await fetch(oembedUrl);

    if (!metaResponse.ok) {
      throw new Error('No se pudo obtener información del video. Verifica que el enlace sea correcto.');
    }

    const metadata = await metaResponse.json();
    const videoTitle = metadata.title || 'Video de YouTube';
    const channelName = metadata.author_name || '';

    console.log('YouTube metadata:', { videoTitle, channelName });

    // Use Gemini to generate educational flashcards AND detailed summary
    const ai = new GoogleGenAI({ apiKey: API_KEY });

    const prompt = `Eres un experto educador. Analiza el siguiente video de YouTube y genera:
1. Un RESUMEN ULTRA DETALLADO, EXTENSO Y ESPECÍFICO del contenido del video (mínimo 500 palabras)
2. 10-15 flashcards educativas en español

Video: "${videoTitle}"
Canal: ${channelName}
URL: ${youtubeUrl}

PARA EL RESUMEN:
- Escribe un análisis profundo y exhaustivo del tema del video
- Incluye todos los conceptos clave, teorías, metodologías mencionadas
- Explica cada subtema en detalle con ejemplos
- Organiza el contenido con subtítulos claros usando formato markdown (##, ###)
- Incluye puntos importantes, estadísticas, y datos relevantes
- El resumen debe servir como material de estudio completo
- MÍNIMO 500 palabras, idealmente más

PARA LAS FLASHCARDS:
- Cubre los conceptos más importantes del tema
- Preguntas claras y respuestas educativas concisas
- Categoría que refleje el tema principal`;

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: {
              type: Type.STRING,
              description: "Ultra detailed summary of the video content in Spanish, formatted with markdown"
            },
            flashcards: {
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
          },
          required: ["summary", "flashcards"]
        }
      }
    });

    const result = JSON.parse(response.text || "{}");

    if (!result.flashcards || result.flashcards.length === 0) {
      throw new Error('No se pudieron generar flashcards. Intenta con otro video.');
    }

    return {
      flashcards: result.flashcards,
      summary: result.summary || `Resumen del video: ${videoTitle}`,
      videoTitle,
      channelName,
      videoUrl: youtubeUrl
    };
  } catch (e: any) {
    console.error("Failed to analyze YouTube video:", e);

    if (e.message?.includes('No se pudo')) {
      throw e; // Re-throw our custom errors
    }

    throw new Error(`Error al procesar el video: ${e.message || 'intenta con otro enlace'}`);
  }
};

// Web URL analysis result interface
export interface WebAnalysisResult {
  flashcards: Array<{ question: string; answer: string; category: string }>;
  summary: string;
  pageTitle: string;
  sourceUrl: string;
}

// Generate flashcards and summary from a web URL
export const generateFlashcardsFromWebURL = async (webUrl: string): Promise<WebAnalysisResult> => {
  if (!API_KEY) {
    throw new Error("No se encontró la API key de Gemini.");
  }

  try {
    // Fetch the webpage content
    const response = await fetch(webUrl);
    if (!response.ok) {
      throw new Error('No se pudo acceder a la página web. Verifica el enlace.');
    }

    const html = await response.text();

    // Extract text content from HTML (simple extraction)
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;

    // Remove scripts and styles
    tempDiv.querySelectorAll('script, style, nav, header, footer, aside').forEach(el => el.remove());

    // Get text content
    let textContent = tempDiv.textContent || tempDiv.innerText || '';
    textContent = textContent.replace(/\s+/g, ' ').trim();

    // Get page title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const pageTitle = titleMatch ? titleMatch[1].trim() : 'Página Web';

    // Limit content length for API
    const maxLength = 15000;
    if (textContent.length > maxLength) {
      textContent = textContent.substring(0, maxLength) + '...';
    }

    if (textContent.length < 100) {
      throw new Error('No se pudo extraer suficiente contenido de la página. Intenta con otro enlace.');
    }

    console.log('Web content extracted:', { pageTitle, contentLength: textContent.length });

    const ai = new GoogleGenAI({ apiKey: API_KEY });

    const prompt = `Eres un experto educador. Analiza el siguiente contenido de una página web y genera:

1. UN RESUMEN ULTRA DETALLADO Y EXTENSO en español (mínimo 400 palabras):
   - Cubre TODOS los conceptos importantes
   - Usa formato markdown con secciones (##), puntos clave, y listas
   - El resumen debe ser educativo y completo

2. 10-15 FLASHCARDS EDUCATIVAS en español:
   - Preguntas claras y específicas
   - Respuestas concisas pero completas
   - Categoría temática para cada flashcard

TÍTULO DE LA PÁGINA: "${pageTitle}"
URL: ${webUrl}

CONTENIDO:
${textContent}`;

    const apiResponse = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: {
              type: Type.STRING,
              description: "Ultra detailed summary of the page content in Spanish, formatted with markdown"
            },
            flashcards: {
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
          },
          required: ["summary", "flashcards"]
        }
      }
    });

    const result = JSON.parse(apiResponse.text || "{}");

    if (!result.flashcards || result.flashcards.length === 0) {
      throw new Error('No se pudieron generar flashcards. Intenta con otro enlace.');
    }

    return {
      flashcards: result.flashcards,
      summary: result.summary || `Resumen de: ${pageTitle}`,
      pageTitle,
      sourceUrl: webUrl
    };
  } catch (e: any) {
    console.error("Failed to analyze web URL:", e);

    if (e.message?.includes('No se pudo') || e.message?.includes('No se encontró')) {
      throw e;
    }

    // If direct fetch fails, try using Gemini's knowledge about the topic
    try {
      console.log('Direct fetch failed, using Gemini knowledge...');
      const ai = new GoogleGenAI({ apiKey: API_KEY });

      // Extract domain/topic from URL
      const urlParts = webUrl.split('/');
      const domain = urlParts[2] || webUrl;
      const pathParts = urlParts.slice(3).join(' ').replace(/[-_]/g, ' ');

      const fallbackPrompt = `Eres un experto educador. Basándote en la URL "${webUrl}" y lo que sabes sobre el tema, genera:

1. UN RESUMEN ULTRA DETALLADO en español (mínimo 400 palabras) sobre el tema probable de esta página
2. 10-15 FLASHCARDS EDUCATIVAS en español

Dominio: ${domain}
Ruta: ${pathParts}

Usa tu conocimiento para crear contenido educativo relevante.`;

      const fallbackResponse = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: fallbackPrompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING },
              flashcards: {
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
            },
            required: ["summary", "flashcards"]
          }
        }
      });

      const fallbackResult = JSON.parse(fallbackResponse.text || "{}");

      return {
        flashcards: fallbackResult.flashcards || [],
        summary: fallbackResult.summary || 'Contenido generado desde la URL',
        pageTitle: pathParts || domain,
        sourceUrl: webUrl
      };
    } catch (fallbackError) {
      throw new Error(`Error al procesar el enlace: ${e.message || 'intenta con otro enlace'}`);
    }
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
      contents: context.substring(0, 25000),
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              type: {
                type: Type.STRING,
                description: "Question type: true_false, multiple_choice, analysis, design, or practical"
              },
              question: { type: Type.STRING },
              options: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Answer options. For true_false: ['Verdadero', 'Falso']. For multiple_choice/analysis/practical: 4 options. For design: ['Mi solución está lista']"
              },
              correctIndex: {
                type: Type.NUMBER,
                description: "Index of the correct option (0-based)"
              },
              explanation: { type: Type.STRING },
              topic: { type: Type.STRING },
              scenario: {
                type: Type.STRING,
                description: "For analysis type: a real-world case or scenario to analyze"
              },
              designPrompt: {
                type: Type.STRING,
                description: "For design type: what solution to design/create"
              },
              evaluationCriteria: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "For design type: 3 criteria to evaluate the response"
              },
              realWorldExample: {
                type: Type.STRING,
                description: "For practical type: a concrete, relatable example from daily life or industry showing how the concept is applied"
              }
            },
            required: ["type", "question", "options", "correctIndex", "explanation", "topic"]
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
