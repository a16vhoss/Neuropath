/**
 * Educational Image Generation Service using Gemini API
 * Generates diagrams and illustrations for educational concepts
 */

import { getGeminiSDK, getImageModel, getBestGeminiModel } from "./geminiModelManager";

export interface GeneratedImage {
  url: string;
  prompt: string;
  description?: string;
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
    // Create optimized prompt for educational image - ABSOLUTELY NO TEXT
    // Using negative prompt style and very explicit instructions
    const imagePrompt = `Generate a pure visual educational diagram about: "${concept}"

MANDATORY STYLE:
- Flat design infographic illustration
- Bold geometric shapes
- Vibrant colors on white background
- Icons and symbols only
- Scientific/educational diagram style
- Clean vector graphics

ABSOLUTELY FORBIDDEN (will reject the image):
- Any letters (A-Z, a-z)
- Any numbers (0-9)
- Any words or labels
- Any text annotations
- Any writing of any kind
- Any symbols that look like text

The image must communicate the concept PURELY through visual elements like:
- Arrows showing flow/direction
- Color coding to show relationships
- Size differences to show importance
- Shapes to represent different elements
- Icons to represent concepts

Create a professional, text-free educational illustration.`;

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
 * Generate a description of an educational image
 * This explains what the image shows to the user
 */
export const generateImageDescription = async (
  concept: string,
  imageUrl: string
): Promise<string | null> => {
  const ai = getGeminiSDK();
  if (!ai) return null;

  try {
    const modelName = await getBestGeminiModel();

    // Extract base64 data from data URL
    const base64Match = imageUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!base64Match) {
      console.warn('Invalid image URL format for description');
      return null;
    }

    const mimeType = base64Match[1];
    const base64Data = base64Match[2];

    const prompt = `Observa esta imagen educativa sobre "${concept}" y describe lo que muestra de forma clara y concisa en español.

INSTRUCCIONES:
- Explica qué elementos visuales hay en la imagen
- Describe cómo estos elementos representan el concepto
- Usa un tono educativo y amigable
- Máximo 2-3 oraciones
- NO uses emojis

Ejemplo de formato: "La imagen muestra [descripción]. Los colores/flechas/formas representan [explicación]."`;

    const response = await ai.models.generateContent({
      model: modelName,
      contents: [
        {
          inlineData: {
            mimeType: mimeType,
            data: base64Data
          }
        },
        prompt
      ]
    });

    return response.text || null;
  } catch (error) {
    console.error('Error generating image description:', error);
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
