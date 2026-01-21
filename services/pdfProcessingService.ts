import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

// Initialize Gemini SDK
const getAIClient = () => {
    if (!API_KEY) {
        console.error('Gemini API key not found');
        return null;
    }
    return new GoogleGenerativeAI(API_KEY);
};

const MODEL_NAME = "gemini-1.5-flash-001";

/**
 * Call Gemini API using SDK
 */
const callGemini = async (prompt: string, pdfBase64?: string, options: { jsonMode?: boolean, responseSchema?: any } = {}): Promise<string | null> => {
    const genAI = getAIClient();
    if (!genAI) return null;

    try {
        const modelConfig: any = {
            model: MODEL_NAME,
        };

        if (options.jsonMode) {
            modelConfig.generationConfig = {
                responseMimeType: "application/json",
                responseSchema: options.responseSchema
            };
        }

        const model = genAI.getGenerativeModel(modelConfig);

        let result;
        if (pdfBase64) {
            result = await model.generateContent([
                {
                    inlineData: {
                        mimeType: "application/pdf",
                        data: pdfBase64
                    }
                },
                prompt
            ]);
        } else {
            result = await model.generateContent(prompt);
        }

        return result.response.text();
    } catch (error) {
        console.error('Error calling Gemini:', error);
        await logAvailableModels();
        return null;
    }
};

const logAvailableModels = async () => {
    if (!API_KEY) return;
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`);
        const data = await response.json();
        console.log("📜 Available Gemini Models:", data);
    } catch (e) {
        console.error("Failed to list models:", e);
    }
};

/**
 * Extract text content from a PDF file using Gemini's vision capabilities
 */
export const extractTextFromPDF = async (pdfBase64: string): Promise<string | null> => {
    const genAI = getAIClient();
    if (!genAI) return null;

    const prompt = `Analiza este documento PDF (incluyendo imágenes/escaneos) y extrae TODO el texto legible.
                  Si es un documento escaneado, realiza OCR completo.
                  Mantén la estructura original (títulos, párrafos).
                  Devuelve SOLO el texto plano extraído.`;

    try {
        const model = genAI.getGenerativeModel({ model: MODEL_NAME });
        const result = await model.generateContent([
            {
                inlineData: {
                    mimeType: "application/pdf",
                    data: pdfBase64
                }
            },
            prompt
        ]);
        return result.response.text();
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
    const genAI = getAIClient();
    if (!genAI) return null;

    const prompt = `Eres un experto educador. Basándote en el siguiente contenido sobre "${topic}", genera exactamente ${count} flashcards de estudio.

CONTENIDO:
${text.slice(0, 30000)}

INSTRUCCIONES:
1. Genera flashcards educativas basadas EXCLUSIVAMENTE en el texto proporcionado.
2. Prioriza la CALIDAD sobre la cantidad.
3. Cada flashcard debe tener una pregunta clara y una respuesta concisa.`;

    try {
        const model = genAI.getGenerativeModel({
            model: MODEL_NAME,
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
                        required: ["question", "answer", "category"]
                    }
                }
            }
        });

        const result = await model.generateContent(prompt);
        return JSON.parse(result.response.text());
    } catch (error) {
        console.error('Error generating flashcards:', error);
        return null;
    }
};

export const generateStudyGuideFromMaterials = async (materialsContent: string[], studySetName: string, currentGuide?: string): Promise<string | null> => {
    if (materialsContent.length === 0) return null;
    const genAI = getAIClient();
    if (!genAI) return null;

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
        const model = genAI.getGenerativeModel({ model: MODEL_NAME });
        const result = await model.generateContent(prompt);
        return result.response.text();
    } catch (error) {
        console.error('Error generating study guide:', error);
        return null;
    }
};

export const generateMaterialSummary = async (content: string, type: 'pdf' | 'text' | 'url' | 'video'): Promise<string | null> => {
    const genAI = getAIClient();
    if (!genAI || !content || content.length < 50) return null;

    const summaryPrompt = `
    Actúa como un asistente de estudio experto.
    Tu tarea es generar un "Micro-Resumen" para este material de estudio (${type}).
    Máximo 3-4 viñetas. Español.
    
    Material:
    ${content.slice(0, 10000)}
    `;

    try {
        const model = genAI.getGenerativeModel({ model: MODEL_NAME });
        const result = await model.generateContent(summaryPrompt);
        return result.response.text();
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
    const genAI = getAIClient();
    if (!genAI) return null;

    const prompt = `Eres un experto educador. Basándote en el siguiente contenido sobre "${topic}", genera exactamente ${count} preguntas de opción múltiple.

CONTENIDO:
${text.slice(0, 30000)}`;

    try {
        const model = genAI.getGenerativeModel({
            model: MODEL_NAME,
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: SchemaType.ARRAY,
                    items: {
                        type: SchemaType.OBJECT,
                        properties: {
                            question: { type: SchemaType.STRING },
                            options: {
                                type: SchemaType.ARRAY,
                                items: { type: SchemaType.STRING }
                            },
                            correctIndex: { type: SchemaType.NUMBER },
                            explanation: { type: SchemaType.STRING }
                        },
                        required: ["question", "options", "correctIndex", "explanation"]
                    }
                }
            }
        });

        const result = await model.generateContent(prompt);
        return JSON.parse(result.response.text());
    } catch (error) {
        console.error('Error generating quiz:', error);
        return null;
    }
};

/**
 * Generate study summary from content
 */
export const generateStudySummary = async (text: string, topic: string): Promise<string | null> => {
    const genAI = getAIClient();
    if (!genAI) return null;

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
        const model = genAI.getGenerativeModel({ model: MODEL_NAME });
        const result = await model.generateContent(prompt);
        return result.response.text();
    } catch (error) {
        console.error('Error generating study summary:', error);
        return null;
    }
};
