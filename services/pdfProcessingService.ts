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

// FALLBACK STRATEGY: List of models to try in order
const MODEL_CANDIDATES = [
    "gemini-1.5-flash",
    "gemini-1.5-flash-001",
    "gemini-1.5-pro",
    "gemini-1.5-pro-001",
    "gemini-pro-vision", // Legacy, might still work for some
];

const fallbackGenerate = async (
    operationName: string,
    fn: (modelName: string) => Promise<any>
): Promise<any> => {
    let lastError: any = null;

    for (const modelName of MODEL_CANDIDATES) {
        try {
            console.log(`[${operationName}] Trying model: ${modelName}`);
            const result = await fn(modelName);
            // If successful, return immediately
            console.log(`[${operationName}] Success with model: ${modelName}`);
            return result;
        } catch (error: any) {
            console.warn(`[${operationName}] Failed with ${modelName}:`, error.message);
            lastError = error;
            // Continue to next model if 404 or other potentially recoverable error
            // If it's an API Key error (400/403), we might want to stop, but for now try all.
        }
    }

    // If all failed
    console.error(`[${operationName}] All models failed.`);
    // Diagnostic
    await logAvailableModels();
    alert(`Error Crítico en Gemini: No se pudo conectar con ningún modelo (${MODEL_CANDIDATES.join(', ')}). \nÚltimo error: ${lastError?.message}`);
    throw lastError;
};

/**
 * Call Gemini API using SDK with Fallback
 */
const callGemini = async (prompt: string, pdfBase64?: string, options: { jsonMode?: boolean, responseSchema?: any } = {}): Promise<string | null> => {
    const genAI = getAIClient();
    if (!genAI) return null;

    try {
        return await fallbackGenerate("callGemini", async (modelName) => {
            const modelConfig: any = { model: modelName };
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
                    { inlineData: { mimeType: "application/pdf", data: pdfBase64 } },
                    prompt
                ]);
            } else {
                result = await model.generateContent(prompt);
            }
            return result.response.text();
        });
    } catch (error) {
        console.error('Error calling Gemini (All models failed):', error);
        return null;
    }
};

/**
 * Extract text content from a PDF file using Gemini with Fallback
 */
export const extractTextFromPDF = async (pdfBase64: string): Promise<string | null> => {
    const genAI = getAIClient();
    if (!genAI) return null;

    const prompt = `Analiza este documento PDF y extrae TODO el texto legible. Mantén la estructura original. Devuelve SOLO texto plano.`;

    try {
        return await fallbackGenerate("extractTextFromPDF", async (modelName) => {
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent([
                { inlineData: { mimeType: "application/pdf", data: pdfBase64 } },
                prompt
            ]);
            return result.response.text();
        });
    } catch (e: any) {
        console.error('Error extracting PDF text (All models failed):', e);
        return null;
    }
};

const logAvailableModels = async (): Promise<string> => {
    if (!API_KEY) return "No API Key";
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`);
        if (!response.ok) return `Error listing models: ${response.status}`;
        const data = await response.json();
        console.log("📜 Available Gemini Models:", data);
        if (data.models) return data.models.map((m: any) => m.name).join(', ');
        return "No models found";
    } catch (e: any) {
        return `Failed to list models: ${e.message}`;
    }
};

/**
 * Generate flashcards with Fallback
 */
export const generateFlashcardsFromText = async (
    text: string,
    topic: string,
    count: number = 10
): Promise<{ question: string; answer: string; category: string }[] | null> => {
    const genAI = getAIClient();
    if (!genAI) return null;

    const prompt = `Genera ${count} flashcards sobre "${topic}" basándote en: ${text.slice(0, 10000)}... Formato JSON.`;

    try {
        return await fallbackGenerate("generateFlashcards", async (modelName) => {
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
                            required: ["question", "answer", "category"]
                        }
                    }
                }
            });
            const result = await model.generateContent(prompt);
            return JSON.parse(result.response.text());
        });
    } catch (error) {
        console.error('Error generating flashcards:', error);
        return null;
    }
};

export const generateStudyGuideFromMaterials = async (materialsContent: string[], studySetName: string, currentGuide?: string): Promise<string | null> => {
    if (materialsContent.length === 0) return null;
    const genAI = getAIClient();
    if (!genAI) return null;

    const prompt = `Crea un manual de estudio basado en: ${materialsContent.map(t => t.slice(0, 5000)).join('\n')}`;

    try {
        return await fallbackGenerate("generateStudyGuide", async (modelName) => {
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent(prompt);
            return result.response.text();
        });
    } catch (error) {
        console.error('Error generating study guide:', error);
        return null;
    }
};

export const generateMaterialSummary = async (content: string, type: 'pdf' | 'text' | 'url' | 'video'): Promise<string | null> => {
    const genAI = getAIClient();
    if (!genAI || !content) return null;

    const summaryPrompt = `Resume esto (${type}): ${content.slice(0, 5000)}`;

    try {
        return await fallbackGenerate("generateMaterialSummary", async (modelName) => {
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent(summaryPrompt);
            return result.response.text();
        });
    } catch (error) {
        console.error('Error generating material summary:', error);
        return null;
    }
};

/**
 * Generate quiz with Fallback
 */
export const generateQuizFromText = async (
    text: string,
    topic: string,
    count: number = 5
): Promise<{ question: string; options: string[]; correctIndex: number; explanation: string }[] | null> => {
    const genAI = getAIClient();
    if (!genAI) return null;

    const prompt = `Genera ${count} preguntas de quiz sobre "${topic}". JSON.`;

    try {
        return await fallbackGenerate("generateQuiz", async (modelName) => {
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
        });
    } catch (error) {
        console.error('Error generating quiz:', error);
        return null;
    }
};

/**
 * Generate study summary with Fallback
 */
export const generateStudySummary = async (text: string, topic: string): Promise<string | null> => {
    const genAI = getAIClient();
    if (!genAI) return null;

    const prompt = `Resume esto: ${text.slice(0, 5000)}`;

    try {
        return await fallbackGenerate("generateStudySummary", async (modelName) => {
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent(prompt);
            return result.response.text();
        });
    } catch (error) {
        console.error('Error generating study summary:', error);
        return null;
    }
};
