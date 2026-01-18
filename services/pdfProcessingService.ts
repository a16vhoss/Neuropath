// PDF Processing Service using Gemini AI

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

// Gemini API endpoint
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

/**
 * Call Gemini API
 */
const callGemini = async (prompt: string, pdfBase64?: string): Promise<string | null> => {
    if (!API_KEY) {
        console.error('Gemini API key not found');
        return null;
    }

    try {
        const contents: any[] = [];

        if (pdfBase64) {
            contents.push({
                role: 'user',
                parts: [
                    {
                        inline_data: {
                            mime_type: 'application/pdf',
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

        const response = await fetch(`${GEMINI_API_URL}?key=${API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents })
        });

        if (!response.ok) {
            console.error('Gemini API error:', response.status);
            return null;
        }

        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
    } catch (error) {
        console.error('Error calling Gemini:', error);
        return null;
    }
};

/**
 * Extract text content from a PDF file using Gemini's vision capabilities
 */
export const extractTextFromPDF = async (pdfBase64: string): Promise<string | null> => {
    const prompt = `Extrae todo el texto de este documento PDF. 
                  Mantén la estructura del contenido (títulos, subtítulos, párrafos).
                  Devuelve solo el texto extraído, sin comentarios adicionales.`;

    return callGemini(prompt, pdfBase64);
};

/**
 * Generate flashcards from extracted text using Gemini
 */
export const generateFlashcardsFromText = async (
    text: string,
    topic: string,
    count: number = 10
): Promise<{ question: string; answer: string; category: string }[] | null> => {
    const prompt = `Eres un experto educador. Basándote en el siguiente contenido sobre "${topic}", genera exactamente ${count} flashcards de estudio.

CONTENIDO:
${text.slice(0, 15000)} 

INSTRUCCIONES:
1. Cada flashcard debe tener una pregunta clara y una respuesta concisa pero completa
2. Incluye una variedad de tipos de preguntas: definiciones, comparaciones, aplicaciones
3. Asigna una categoría relevante a cada flashcard
4. Las preguntas deben evaluar comprensión, no solo memorización

FORMATO DE RESPUESTA (JSON válido):
[
  {
    "question": "¿Cuál es la función principal de X?",
    "answer": "La función principal de X es...",
    "category": "Conceptos Básicos"
  }
]

Devuelve SOLO el JSON, sin texto adicional.`;

    try {
        const response = await callGemini(prompt);
        if (!response) return null;

        // Clean and parse JSON response
        let cleanJson = response
            .replace(/```json\n?|\n?```/g, '')  // Remove markdown code blocks
            .replace(/```\n?/g, '')              // Remove any remaining code blocks
            .trim();

        // Try to extract JSON array if there's extra text
        const jsonMatch = cleanJson.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
            cleanJson = jsonMatch[0];
        }

        // Fix common JSON issues
        cleanJson = cleanJson
            .replace(/,\s*]/g, ']')           // Remove trailing commas
            .replace(/,\s*}/g, '}')           // Remove trailing commas in objects
            .replace(/[\x00-\x1F\x7F]/g, ' ') // Remove control characters
            .replace(/\n/g, ' ')              // Replace newlines with spaces in strings
            .replace(/\t/g, ' ');             // Replace tabs with spaces

        try {
            const flashcards = JSON.parse(cleanJson);
            return flashcards;
        } catch (parseError) {
            console.error('JSON parse error, attempting recovery...');

            // Last resort: try to manually extract flashcards
            const cardMatches = cleanJson.matchAll(/"question"\s*:\s*"([^"]+)"\s*,\s*"answer"\s*:\s*"([^"]+)"/g);
            const recoveredCards = [];
            for (const match of cardMatches) {
                recoveredCards.push({
                    question: match[1],
                    answer: match[2],
                    category: 'General'
                });
            }

            if (recoveredCards.length > 0) {
                console.log('Recovered', recoveredCards.length, 'flashcards from malformed JSON');
                return recoveredCards;
            }

            console.error('Failed to parse or recover JSON:', parseError);
            return null;
        }
    } catch (error) {
        console.error('Error generating flashcards:', error);
        return null;
    }
};

export const generateStudyGuideFromMaterials = async (materialsContent: string[], studySetName: string, currentGuide?: string): Promise<string | null> => {
    if (materialsContent.length === 0) return null;

    // Combine texts (truncate if too long to avoid huge token usage, though Gemini 1.5 is generous)
    // We'll take first 10k chars of each to save context window and cost
    const combinedText = materialsContent.map((text, i) => `--- MATERIAL ${i + 1} ---\n${text.slice(0, 10000)}`).join('\n\n');

    const prompt = `
    [SISTEMA: REGLA CRÍTICA DE FORMATO]
    🚫 PROHIBIDO USAR TABLAS MARKDOWN. NUNCA uses el caracter "|" para estructurar datos.
    
    SIEMPRE transforma cualquier tabla en Liatas o Tarjetas de Texto.
    
    ❌ INCORRECTO (NO HAGAS ESTO):
    | Concepto | Definición | Ejemplo |
    |---|---|---|
    | Estrés | Tensión física | Dolor de cabeza |

    ✅ CORRECTO (HAZ ESTO ASÍ):
    *   **Concepto**: Estrés
        *   *Definición*: Tensión física y emocional.
        *   *Ejemplo*: Dolor de cabeza ante un examen.

    Tarea General
    Actúa como una IA experta en síntesis multifuente. Tu objetivo es transformar múltiples fuentes de información en un resumen: extensa, detallada, precisa y en español, sin omitir nada. El contenido debe permitir al usuario estudiar y dominar completamente una disciplina, con nivel experto (0.1% mundial).

    Contexto
    Recibirás fuentes. Tu tarea es analizarlas todas sin excluir ninguna y extraer lo mejor de cada una para construir un resumen completo.

    Rol
    Actúa como un investigador y escritor técnico de élite, especializado en sintetizar conocimiento complejo y redactar manuales de estudio profesionales.

    Acción
    1. Lee y analiza completamente todas las fuentes (sin omitir ninguna), identificando tema principal, argumentos clave, datos relevantes, conclusiones y contexto sin salirte del tema.
    2. Sintetiza e integra la información en un resumen preservando todos los puntos críticos, datos específicos, nombres, fórmulas, procesos, ejemplos, fechas, cifras y conclusiones.
    3. Redacta un resumen en capítulos. Que mantengan la siguiente estructura:
       - Tema/propósito
       - Puntos clave
       - Datos específicos
       - Conclusiones
    4. Incluye:
       - Ejemplos explicativos
       - Notas aclaratorias y definiciones técnicas
       - Listas (NO tablas - usa listas con viñetas o numeradas para estructurar datos)
       - Organiza con código de prioridad: 🔴 Crítico | 🟡 Importante | 🟢 Complementario
    5. Asegúrate de que el contenido sea comprensible, profundo, aplicable y que no se haya omitido nada.
    6. Enfócate en dar explicaciones detalladas basándote en que este contenido sirve para estudio y repaso para generar dominio total de la materia.
    7. El lector debe terminar con nivel experto sobre el tema.

    Formato
    - Introducción general
    - Capítulos por eje temático con Títulos, subtítulos, etc. Organizados por jerarquía de aprendizaje
    - Secciones claras
    - Notas (USA LISTAS, NUNCA TABLAS)
    - Conclusión con recomendaciones prácticas

    Público Objetivo
    - Usuario autodidacta
    - Nivel: Avanzado – Experto (0.1%)
    - Finalidad: Estudio profundo, dominio técnico, largo plazo

    Materiales de entrada:
    ${combinedText}
    
    ${currentGuide && currentGuide.length > 20 ? `Ya existe una guía previa. Por favor, actualízala y mejórala integrando la nueva información sin perder lo importante de la anterior. Guía previa: ${currentGuide}` : ''}
    `;

    try {
        const response = await callGemini(prompt);
        return response || null;
    } catch (error) {
        console.error('Error generating study guide:', error);
        return null; // Don't crash if guide fails, just return null
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
    const prompt = `Eres un experto educador. Basándote en el siguiente contenido sobre "${topic}", genera exactamente ${count} preguntas de opción múltiple.

CONTENIDO:
${text.slice(0, 15000)}

INSTRUCCIONES:
1. Cada pregunta debe tener 4 opciones de respuesta
2. Solo una opción debe ser correcta
3. Las opciones incorrectas deben ser plausibles pero claramente incorrectas
4. Incluye una explicación breve de por qué la respuesta correcta es correcta

FORMATO DE RESPUESTA (JSON válido):
[
  {
    "question": "¿Cuál de las siguientes afirmaciones es correcta?",
    "options": ["Opción A", "Opción B", "Opción C", "Opción D"],
    "correctIndex": 0,
    "explanation": "La respuesta correcta es A porque..."
  }
]

Devuelve SOLO el JSON, sin texto adicional.`;

    try {
        const response = await callGemini(prompt);
        if (!response) return null;

        const cleanJson = response.replace(/```json\n?|\n?```/g, '').trim();
        const questions = JSON.parse(cleanJson);

        return questions;
    } catch (error) {
        console.error('Error generating quiz:', error);
        return null;
    }
};

/**
 * Generate study summary from content
 */
export const generateStudySummary = async (text: string, topic: string): Promise<string | null> => {
    const prompt = `Resume el siguiente contenido educativo sobre "${topic}" en un formato fácil de estudiar:

CONTENIDO:
${text.slice(0, 10000)}

INSTRUCCIONES:
1. Crea un resumen estructurado con puntos clave
2. Destaca definiciones importantes
3. Incluye ejemplos cuando sea relevante
4. Máximo 500 palabras
5. Usa formato markdown con bullets y headers

Devuelve el resumen en español.`;

    return callGemini(prompt);
};
