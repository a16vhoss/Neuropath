/**
 * Educational Image Generation Service using Gemini API
 * Generates diagrams and illustrations for educational concepts
 */

import { getGeminiSDK, getImageModel } from "./geminiModelManager";

export interface GeneratedImage {
  url: string;
  prompt: string;
}

/**
 * Generate an educational image for a concept using Gemini
 */
export const generateEducationalImage = async (
  concept: string,
  context?: string
): Promise<GeneratedImage | null> => {
  const ai = getGeminiSDK();
  if (!ai) {
    console.warn('Gemini SDK not available - image generation disabled');
    return null;
  }

  try {
    // Create optimized prompt for educational image - NO TEXT
    const imagePrompt = `Create a simple, clean educational illustration about: ${concept}.

CRITICAL REQUIREMENTS:
- NO TEXT whatsoever - no labels, no words, no letters, no numbers
- Pure visual illustration only
- Simple, clean vector-style graphics
- Bright, vibrant colors
- Easy to understand visually without any text
- Minimalist design with clear shapes
- White or light background
- Professional educational illustration style`;

    console.log('Generating educational image with Gemini...');

    // Use Gemini's image generation capability
    const response = await ai.models.generateContent({
      model: getImageModel(),
      contents: imagePrompt,
      config: {
        responseModalities: ["image", "text"],
      }
    });

    // Extract image from response
    const parts = response.candidates?.[0]?.content?.parts || [];

    for (const part of parts) {
      if (part.inlineData) {
        // Convert base64 to data URL
        const mimeType = part.inlineData.mimeType || 'image/png';
        const base64Data = part.inlineData.data;
        const dataUrl = `data:${mimeType};base64,${base64Data}`;

        return {
          url: dataUrl,
          prompt: imagePrompt
        };
      }
    }

    console.warn('No image generated in response');
    return null;

  } catch (error) {
    console.error('Image generation error:', error);
    return null;
  }
};

/**
 * Detect if a concept would benefit from a visual explanation
 */
export const shouldGenerateImage = (
  userMessage: string,
  botResponse: string
): boolean => {
  // Keywords that suggest visual explanation would help
  const visualKeywords = [
    'diagrama', 'estructura', 'ciclo', 'proceso', 'anatomia',
    'celula', 'sistema', 'circuito', 'grafico', 'mapa',
    'organismo', 'molecula', 'atomo', 'arquitectura', 'flujo',
    'etapas', 'fases', 'partes', 'componentes', 'organo',
    'fotosintesis', 'mitosis', 'meiosis', 'respiracion',
    'ecosistema', 'cadena', 'red', 'modelo', 'esquema'
  ];

  const combinedText = `${userMessage} ${botResponse}`.toLowerCase();

  // Check if any visual keyword is present
  const hasVisualKeyword = visualKeywords.some(keyword =>
    combinedText.includes(keyword)
  );

  // Also check for explicit requests
  const explicitRequest = combinedText.includes('imagen') ||
    combinedText.includes('dibuja') ||
    combinedText.includes('muestra') ||
    combinedText.includes('visualiza');

  return hasVisualKeyword || explicitRequest;
};

/**
 * Check if image generation service is available
 */
export const isImageServiceAvailable = (): boolean => {
  return !!getGeminiSDK();
};
