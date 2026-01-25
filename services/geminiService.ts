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
 * AI Research: Search internet for high-quality resources
 */
export const searchInternet = async (topic: string, setContext: string, setName: string): Promise<any[]> => {
  const genAI = getGeminiSDK();
  if (!genAI) return [];

  try {
    const modelName = await getBestGeminiModel('pro');
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        maxOutputTokens: 2000,
        temperature: 0.2, // Low temperature for factual consistency
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              title: { type: SchemaType.STRING },
              url: { type: SchemaType.STRING },
              snippet: { type: SchemaType.STRING },
              type: { type: SchemaType.STRING }
            },
            required: ["title", "url", "snippet", "type"]
          }
        }
      }
    });

    const prompt = `
      Eres ZpBot, un experto investigador académico. El usuario quiere buscar recursos educativos sobre: "${topic}".
      
      CONTEXTO DEL SET DE ESTUDIO ("${setName}"):
      ${setContext.slice(0, 1500)}
      
      OBJETIVO:
      Identifica los 4 mejores recursos (artículos y videos) que ayuden específicamente a entender "${topic}" dentro del contexto de "${setName}". 
      Si "${topic}" es breve (ej: "fórmulas"), usa el contexto para saber de QUÉ fórmulas se trata (ej: fórmulas de probabilidad).
      
      REQUISITOS DE LOS RESULTADOS:
      1. CALIDAD: Selecciona solo sitios web de alta autoridad (.edu, .org, Khan Academy, Coursera, Wikipedia) o videos de YouTube de canales educativos reconocidos.
      2. VARIEDAD: Incluye al menos 2 videos de YouTube y 2 artículos web.
      3. RELEVANCIA: El snippet debe explicar brevemente por qué este recurso es útil para el tema específico del usuario.
      
      Estructura JSON: un array de objetos con "title", "url", "snippet" y "type" ("web" o "youtube").
      Idioma: Español.
    `;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    return JSON.parse(text);

  } catch (error) {
    console.error("Error in AI Research:", error);
    return [];
  }
};

/**
 * Intelligent Clarification: Asks questions to narrow down research intent
 */
export const generateResearchClarifications = async (
  userInput: string,
  setContext: string,
  setName: string
): Promise<{ question: string; options: string[] }> => {
  const genAI = getGeminiSDK();
  if (!genAI) return { question: "¿Qué te gustaría investigar exactamente?", options: [] };

  try {
    const modelName = await getBestGeminiModel('flash'); // Fast for conversation
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            question: { type: SchemaType.STRING },
            options: {
              type: SchemaType.ARRAY,
              items: { type: SchemaType.STRING }
            }
          },
          required: ["question", "options"]
        }
      }
    });

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
      
      EJEMPLO DE SALIDA:
      {
        "question": "Entiendo que quieres profundizar en Probabilidades. ¿Qué área te interesa más hoy?",
        "options": ["Casos Prácticos", "Teoría de Bayes", "Ejercicios de Examen"]
      }
    `;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    return JSON.parse(text);

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
  const genAI = getGeminiSDK();
  if (!genAI) return [];

  try {
    const modelName = await getBestGeminiModel('pro');
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
              category: { type: SchemaType.STRING }
            },
            required: ["question", "answer"]
          }
        }
      }
    });

    const systemInfo = `
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

    const result = await model.generateContent(systemInfo);
    const response = await result.response;
    return JSON.parse(response.text());

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
): Promise<{ text: string; suggestions: string[] }> => {
  const genAI = getGeminiSDK();
  if (!genAI) return { text: "Lo siento, ZpBot está desconectado.", suggestions: [] };

  try {
    const modelName = await getBestGeminiModel();
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            text: { type: SchemaType.STRING },
            suggestions: {
              type: SchemaType.ARRAY,
              items: { type: SchemaType.STRING }
            }
          },
          required: ["text", "suggestions"]
        }
      }
    });

    const systemPrompt = `
      Eres ZpBot, un compañero de estudio inteligente, divertido y experto en pedagogía.

      TU REGLA DE ORO:
      **RESPONDE EXACTAMENTE A LO QUE TE PREGUNTAN.** Pero hazlo memorable.

      TÉCNICAS DE ENSEÑANZA AVANZADAS (ÚSALAS):
      1.  **METÁFORAS Y ANALOGÍAS**: Explica conceptos abstractos comparándolos con cosas de la vida real (ej: "La mitocondria es como la planta de energía...").
      2.  **MNEMOTECNIAS**: Si hay una lista o pasos, inventa un acrónimo o frase divertida para recordarlos fácilmente.
      3.  **HILO SÓCRATICO LIGERO**: No solo escupas el dato, conecta la idea.

      PERSONALIDAD:
      - **EXPLICAR COMO A UN NIÑO DE 5 AÑOS**: Lenguaje súper sencillo.
      - **AMIGABLE**: Usa emojis 🤖✨.

      DIRECTRICES:
      - **LONGITUD**: Máximo 3-4 frases. ¡Sé breve!
      - **PRECISIÓN**: Aunque el tono sea divertido, la información debe ser exacta.

      FORMATO JSON OBLIGATORIO:
      {
        "text": "Tu explicación con metáfora/mnemotecnia aquí...",
        "suggestions": [
          "Pregunta 1: Para poner a prueba lo aprendido (ej: ¿Cómo aplicarías esto si...?)",
          "Pregunta 2: Curiosidad relacionada",
          "Pregunta 3: Siguiente tema lógico"
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

    const result = await model.generateContent(fullPrompt);
    const parsed = JSON.parse(result.response.text());
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

/**
 * Generate Flashcards from Notebook Content (Incremental)
 *
 * Sistema inteligente que genera flashcards SOLO del contenido nuevo
 * mientras usa el contexto previo para coherencia y evita duplicados.
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

  const genAI = getGeminiSDK();
  if (!genAI) {
    console.warn('No Gemini SDK available');
    return [];
  }

  try {
    const modelName = await getBestGeminiModel('pro');
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
                  category: { type: SchemaType.STRING },
                },
                required: ["question", "answer", "category"],
              },
            },
          },
          required: ["flashcards"],
        },
        temperature: 0.7,
        maxOutputTokens: 4000,
      },
    });

    const prompt = `
Eres un experto creador de material de estudio con amplia experiencia en pedagogia.

TAREA: Genera exactamente ${count} flashcards de ALTA CALIDAD basadas en el NUEVO CONTENIDO.

CUADERNO: "${notebookTitle}" (parte del set de estudio "${studySetName}")

NUEVO CONTENIDO (genera flashcards UNICAMENTE de esto):
---
${newContent.slice(0, 25000)}
---

${previousContent ? `
CONTEXTO PREVIO (usa para entender relaciones y terminologia, pero NO generes flashcards de aqui):
---
${previousContent.slice(0, 15000)}
---
` : ''}

${existingFlashcards ? `
FLASHCARDS EXISTENTES (evita preguntas similares o duplicadas):
${existingFlashcards.slice(0, 3000)}
` : ''}

REGLAS ESTRICTAS:
1. Las flashcards deben venir UNICAMENTE del nuevo contenido
2. Usa el contexto previo para:
   - Entender terminologia ya definida
   - Crear conexiones con conceptos anteriores si es relevante
   - Mantener consistencia en el nivel de detalle
3. Evita preguntas que ya existen o son muy similares
4. Cada flashcard debe ser autocontenida (entendible sin ver las notas)
5. Prioriza en este orden: definiciones > conceptos clave > relaciones > ejemplos > detalles
6. Categoriza cada tarjeta con una de estas categorias: Definicion, Concepto, Relacion, Ejemplo, Importante, Proceso, Formula

FORMATO DE RESPUESTA:
{
  "flashcards": [
    {
      "question": "pregunta clara y directa",
      "answer": "respuesta concisa pero completa",
      "category": "categoria apropiada"
    }
  ]
}

Idioma: Espanol.
Genera EXACTAMENTE ${count} flashcards de alta calidad.
`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const parsed = JSON.parse(text);

    return parsed.flashcards || [];

  } catch (error) {
    console.error("Error generating flashcards from notebook:", error);

    // Fallback: generar flashcards basicas
    return [{
      question: `¿Cuales son los puntos clave de las notas sobre ${notebookTitle}?`,
      answer: newContent.slice(0, 200) + '...',
      category: 'Resumen'
    }];
  }
};
