import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

let cachedModelName: string | null = null;
let modelResolutionPromise: Promise<string> | null = null;

// Priorities: Flash (Speed/Cost) > Pro (Power) > Others
const PREFERRED_KEYWORDS = ['flash', 'pro', 'gemini-1.5'];

/**
 * Dynamically resolves the best available Gemini model.
 * Fetches the list of models from the API and picks the best one.
 */
export const getBestGeminiModel = async (): Promise<string> => {
    // Return cached model if available
    if (cachedModelName) return cachedModelName;

    // If a request is already in progress, return that promise to avoid multiple fetches
    if (modelResolutionPromise) return modelResolutionPromise;

    modelResolutionPromise = (async () => {
        if (!API_KEY) {
            console.error("No API Key found for GeminiModelManager");
            return "gemini-1.5-flash"; // Fallback default
        }

        try {
            console.log("🔍 Resolving best Gemini model...");
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`);

            if (!response.ok) {
                console.error(`Failed to list models: ${response.status} ${response.statusText}`);
                return "gemini-1.5-flash"; // Fallback
            }

            const data = await response.json();
            const models = data.models || [];

            // Filter for models that support 'generateContent'
            const contentModels = models.filter((m: any) =>
                m.supportedGenerationMethods &&
                m.supportedGenerationMethods.includes("generateContent")
            );

            if (contentModels.length === 0) {
                console.warn("No models found supporting generateContent. Using fallback.");
                return "gemini-1.5-flash";
            }

            // Clean names (remove 'models/' prefix if present for logic, but keep it for usage if SDK needs it? 
            // SDK usually accepts just the name or models/name. use EXACT name from API.)

            // Sort/Find best based on preference
            let bestModel = contentModels.find((m: any) => m.name.includes("gemini-1.5-flash"));

            if (!bestModel) {
                bestModel = contentModels.find((m: any) => m.name.includes("gemini-1.5-pro"));
            }
            if (!bestModel) {
                bestModel = contentModels.find((m: any) => m.name.includes("gemini-pro"));
            }

            // Fallback to the first available if no preferences match
            if (!bestModel) {
                bestModel = contentModels[0];
            }

            // Remove 'models/' prefix because the SDK often adds it, or handle it consistent.
            // The SDK `getGenerativeModel({ model: 'name' })` handles it, but safer to strip "models/" if strict.
            // Actually, newer SDK versions might prefer just the ID. Let's try to strip it.
            const modelName = bestModel.name.replace("models/", "");

            console.log(`✅ Selected Gemini Model: ${modelName} (from ${bestModel.name})`);
            cachedModelName = modelName;
            return modelName;

        } catch (error) {
            console.error("Error resolving Gemini model:", error);
            return "gemini-1.5-flash"; // Ultimate fallback
        }
    })();

    return modelResolutionPromise;
};

/**
 * Helper to get an initialized SDK instance using the global key
 */
export const getGeminiSDK = () => {
    if (!API_KEY) return null;
    return new GoogleGenerativeAI(API_KEY);
};
