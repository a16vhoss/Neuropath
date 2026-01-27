import { GoogleGenAI } from "@google/genai";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

let cachedSDK: GoogleGenAI | null = null;

/**
 * Get the Gemini SDK instance (new unified SDK)
 */
export const getGeminiSDK = (): GoogleGenAI | null => {
    if (!API_KEY || API_KEY === 'PLACEHOLDER_API_KEY') {
        console.warn('No valid Gemini API key provided');
        return null;
    }

    if (!cachedSDK) {
        cachedSDK = new GoogleGenAI({ apiKey: API_KEY });
    }

    return cachedSDK;
};

/**
 * Get the best available model name
 * @param preferredTier Optional preference for 'pro', 'flash', or 'image'
 */
export const getBestGeminiModel = async (preferredTier?: 'pro' | 'flash' | 'image'): Promise<string> => {
    // Model selection based on preference
    switch (preferredTier) {
        case 'pro':
            return 'gemini-2.0-flash'; // Pro-level capabilities
        case 'flash':
            return 'gemini-2.0-flash'; // Fast and efficient
        case 'image':
            return 'gemini-2.0-flash'; // Supports image/vision
        default:
            return 'gemini-2.0-flash'; // Default to 2.0 flash
    }
};

/**
 * Model for image generation
 */
export const getImageModel = (): string => {
    return 'gemini-2.0-flash'; // Supports native image generation
};

/**
 * Model for grounded search
 */
export const getSearchModel = (): string => {
    return 'gemini-2.0-flash'; // Supports Google Search grounding
};
