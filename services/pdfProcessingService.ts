import { SchemaType } from "@google/generative-ai";
import { getBestGeminiModel, getGeminiSDK } from "./geminiModelManager";

/**
 * Call Gemini API using SDK with Dynamic Model Resolution
 */
const callGemini = async (prompt: string, pdfBase64?: string, options: { jsonMode?: boolean, responseSchema?: any } = {}): Promise<string | null> => {
    const genAI = getGeminiSDK();
    if (!genAI) return null;

    try {
        const modelName = await getBestGeminiModel();

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
    } catch (error) {
        console.error('Error calling Gemini:', error);
        return null; // Model manager logs errors too
    }
};

/**
 * Extract text content from a PDF file using Gemini
 */
export const extractTextFromPDF = async (pdfBase64: string): Promise<string | null> => {
    const genAI = getGeminiSDK();
    if (!genAI) return null;

    const prompt = `Analiza este documento PDF y extrae TODO el texto legible. Mantén la estructura original. Devuelve SOLO texto plano.`;

    try {
        const modelName = await getBestGeminiModel();
        const model = genAI.getGenerativeModel({ model: modelName });

        const result = await model.generateContent([
            { inlineData: { mimeType: "application/pdf", data: pdfBase64 } },
            prompt
        ]);
        return result.response.text();
    } catch (e: any) {
        console.error('Error extracting PDF text:', e);
        // Fallback or alert could go here, but Manager handles best-effort
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
    const genAI = getGeminiSDK();
    if (!genAI) return null;

    const prompt = `Genera ${count} flashcards sobre "${topic}" basándote en: ${text.slice(0, 10000)}... Formato JSON.`;

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
    const genAI = getGeminiSDK();
    if (!genAI) return null;

    const prompt = `Crea un manual de estudio basado en: ${materialsContent.map(t => t.slice(0, 5000)).join('\n')}`;

    try {
        const modelName = await getBestGeminiModel();
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(prompt);
        return result.response.text();
    } catch (error) {
        console.error('Error generating study guide:', error);
        return null;
    }
};

export const generateMaterialSummary = async (content: string, type: 'pdf' | 'text' | 'url' | 'video'): Promise<string | null> => {
    const genAI = getGeminiSDK();
    if (!genAI || !content) return null;

    const summaryPrompt = `Resume esto (${type}): ${content.slice(0, 5000)}`;

    try {
        const modelName = await getBestGeminiModel();
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(summaryPrompt);
        return result.response.text();
    } catch (error) {
        console.error('Error generating material summary:', error);
        return null;
    }
};

/**
 * Generate quiz questions with dynamic model
 */
export const generateQuizFromText = async (
    text: string,
    topic: string,
    count: number = 5
): Promise<{ question: string; options: string[]; correctIndex: number; explanation: string }[] | null> => {
    const genAI = getGeminiSDK();
    if (!genAI) return null;

    const prompt = `Genera ${count} preguntas de quiz sobre "${topic}". JSON.`;

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
 * Generate study summary with dynamic model
 */
export const generateStudySummary = async (text: string, topic: string): Promise<string | null> => {
    const genAI = getGeminiSDK();
    if (!genAI) return null;

    const prompt = `Resume esto: ${text.slice(0, 5000)}`;

    try {
        const modelName = await getBestGeminiModel();
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(prompt);
        return result.response.text();
    } catch (error) {
        console.error('Error generating study summary:', error);
        return null;
    }
};
