import { GoogleGenAI, Type } from "@google/genai";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

// Initialize Gemini SDK
const getAIClient = () => {
    if (!API_KEY) {
        console.error('Gemini API key not found');
        return null;
    }
    return new GoogleGenAI({ apiKey: API_KEY });
};

const MODEL_NAME = "gemini-1.5-flash";

/**
 * Call Gemini API using SDK
 */
const callGemini = async (prompt: string, pdfBase64?: string, options: { jsonMode?: boolean, responseSchema?: any } = {}): Promise<string | null> => {
    const ai = getAIClient();
    if (!ai) return null;

    try {
        const contents: any[] = [];

        if (pdfBase64) {
            contents.push({
                role: 'user',
                parts: [
                    {
                        inlineData: {
                            mimeType: 'application/pdf',
                            data: pdfBase64
                        }
                    },
                    { text: prompt }
                ]
            });
        } else {
            contents.push({
                role: 'user',
                parts: [{ text: prompt }]
            });
        }

        const config: any = {};
        if (options.jsonMode) {
            config.responseMimeType = "application/json";
            if (options.responseSchema) {
                config.responseSchema = options.responseSchema;
            }
        }

        const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: contents[0] ? contents[0].parts : [{ text: prompt }], // SDK expects parts or string
            config: config
        });

        return response.text || null;
    } catch (error) {
        console.error('Error calling Gemini:', error);
        return null;
    }
};

/**
 * Extract text content from a PDF file using Gemini's vision capabilities
 */
export const extractTextFromPDF = async (pdfBase64: string): Promise<string | null> => {
    const ai = getAIClient();
    if (!ai) return null;

    const prompt = `Analiza este documento PDF (incluyendo imágenes/escaneos) y extrae TODO el texto legible.
                  Si es un documento escaneado, realiza OCR completo.
                  Mantén la estructura original (títulos, párrafos).
                  Devuelve SOLO el texto plano extraído.`;

    // Direct SDK call for PDF to handle Part structure correctly
    try {
        const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: [
                {
                    role: 'user',
                    parts: [
                        {
                            inlineData: {
                                mimeType: 'application/pdf',
                                data: pdfBase64
                            }
                        },
                        { text: prompt }
                    ]
                }
            ]
        });
        return response.text || null;
    } catch (e) {
        console.error('Error extracting PDF text:', e);
        return null;
    }
};

/**
 * Generate flashcards from extracted text using Gemini
 */
export const generateFlashcardsFromText = async (
    text: string,
    topic: string,
    count: number = 10
): Promise<{ question: string; answer: string; category: string }[] | null> => {
    const ai = getAIClient();
    if (!ai) return null;

    const prompt = `Eres un experto educador. Basándote en el siguiente contenido sobre "${topic}", genera exactamente ${count} flashcards de estudio.

CONTENIDO:
${text.slice(0, 30000)}

INSTRUCCIONES:
1. Genera flashcards educativas basadas EXCLUSIVAMENTE en el texto proporcionado.
2. Prioriza la CALIDAD sobre la cantidad.
3. Cada flashcard debe tener una pregunta clara y una respuesta concisa.`;

    try {
        const response = await ai.models.generateContent({
            model: MODEL_NAME,
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
    } catch (error) {
        console.error('Error generating flashcards:', error);
        return null;
    }
};

export const generateStudyGuideFromMaterials = async (materialsContent: string[], studySetName: string, currentGuide?: string): Promise<string | null> => {
    if (materialsContent.length === 0) return null;
    const ai = getAIClient();
    if (!ai) return null;

    const combinedText = materialsContent.map((text, i) => `--- MATERIAL ${i + 1} ---\n${text.slice(0, 20000)}`).join('\n\n');

    const prompt = `
    [SISTEMA: REGLAS CRÍTICAS DE FORMATO - NIVEL MÁXIMO]
    1. 🚫 **PROHIBICIÓN ABSOLUTA DE TABLAS**: NO generes ninguna tabla.
    2. 🚫 **PROHIBICIÓN DEL CARACTER "|" (PIPE)**: NO uses el símbolo "|".
    
    Tarea General: Actúa como una IA experta en síntesis. Crea un manual de estudio completo y experto.
    
    Materiales de entrada:
    ${combinedText}
    `;

    try {
        const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: prompt
        });
        return response.text || null;
    } catch (error) {
        console.error('Error generating study guide:', error);
        return null;
    }
};

export const generateMaterialSummary = async (content: string, type: 'pdf' | 'text' | 'url' | 'video'): Promise<string | null> => {
    const ai = getAIClient();
    if (!ai || !content || content.length < 50) return null;

    const summaryPrompt = `
    Actúa como un asistente de estudio experto.
    Tu tarea es generar un "Micro-Resumen" para este material de estudio (${type}).
    Máximo 3-4 viñetas. Español.
    
    Material:
    ${content.slice(0, 10000)}
    `;

    try {
        const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: summaryPrompt
        });
        return response.text || null;
    } catch (error) {
        console.error('Error generating material summary:', error);
        return null;
    }
};

/**
 * Generate quiz questions from extracted text using Gemini
 */
export const generateQuizFromText = async (
    text: string,
    topic: string,
    count: number = 5
): Promise<{ question: string; options: string[]; correctIndex: number; explanation: string }[] | null> => {
    const ai = getAIClient();
    if (!ai) return null;

    const prompt = `Eres un experto educador. Basándote en el siguiente contenido sobre "${topic}", genera exactamente ${count} preguntas de opción múltiple.

CONTENIDO:
${text.slice(0, 30000)}`;

    try {
        const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: prompt,
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
                            correctIndex: { type: Type.NUMBER },
                            explanation: { type: Type.STRING }
                        },
                        required: ["question", "options", "correctIndex", "explanation"]
                    }
                }
            }
        });

        return JSON.parse(response.text || "[]");
    } catch (error) {
        console.error('Error generating quiz:', error);
        return null;
    }
};

/**
 * Generate study summary from content
 */
export const generateStudySummary = async (text: string, topic: string): Promise<string | null> => {
    const ai = getAIClient();
    if (!ai) return null;

    const prompt = `Resume el siguiente contenido educativo sobre "${topic}" en un formato fácil de estudiar:
    
CONTENIDO:
${text.slice(0, 20000)}

INSTRUCCIONES:
1. Crea un resumen estructurado.
2. Destaca definiciones importantes.
3. Máximo 500 palabras.
4. Markdown.
`;

    try {
        const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: prompt
        });
        return response.text || null;
    } catch (error) {
        console.error('Error generating study summary:', error);
        return null;
    }
};
