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

    const prompt = `
        OBJETIVO: Genera EXACTAMENTE ${count} flashcards de alta calidad sobre el tema "${topic}".
        
        INSTRUCCIONES DE COBERTURA Y GRANULARIDAD (SÍGUELAS RIGUROSAMENTE):
        1. ESCANEO PROFUNDO: Lee el texto párrafo por párrafo. No saltes ninguna sección.
        2. EXTRACCIÓN DISTINTA: Debes identificar al menos ${count} datos, conceptos, ejemplos o definiciones independientes y significativos.
        3. COBERTURA TOTAL: Asegúrate de que las tarjetas cubran TODO el material, desde la primera palabra hasta la última.
        4. NIVEL DE DETALLE: Si pides muchas tarjetas (${count}), entra en detalles específicos, matices técnicos y ejemplos prácticos mencionados en el texto. Evita generalidades.
        5. CANTIDAD EXACTA: Es una orden estricta: genera EXACTAMENTE ${count} tarjetas en el array JSON.
        6. IDIOMA: Todo en Español.
        
        TEXTO DE REFERENCIA (ESCANEAR TODO):
        ${text.slice(0, 100000)}
    `;

    try {
        const modelName = await getBestGeminiModel('pro');
        console.log(`Using model ${modelName} for ${count} flashcards`);

        const model = genAI.getGenerativeModel({
            model: modelName,
            generationConfig: {
                maxOutputTokens: 8192,
                temperature: 0.7,
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

    const masterPrompt = `
# 📚 PROMPT MAESTRO: GENERADOR DE GUÍAS DE ESTUDIO ADAPTATIVAS MULTIDISCIPLINARIAS

## 🎯 CONTEXT
Eres un experto pedagógico universitario con más de 20 años de experiencia en diseño curricular, didáctica avanzada y síntesis de conocimiento multidisciplinario. Tu especialidad es transformar materiales diversos, complejos y a veces desorganizados en guías de estudio coherentes, profundas y perfectamente adaptadas a cada disciplina académica.

## 👤 ROLE
Asumes el rol de **Arquitecto Pedagógico Adaptativo**, con maestría en análisis y síntesis de información académica compleja y diseño instruccional basado en evidencia.

## ⚙️ ACTION
### PASO 1: ANÁLISIS PROFUNDO
1. Lee y procesa todos los materiales proporcionados.
2. Identifica automáticamente la(s) disciplina(s), nivel de profundidad, conceptos centrales y relaciones entre temas.

### PASO 2: ARQUITECTURA DE LA GUÍA
Diseña una estructura que incluya las siguientes secciones:
#### 📌 SECCIÓN 1: PANORAMA GENERAL
- Resumen ejecutivo y objetivos de aprendizaje.

#### 📌 SECCIÓN 2: DESARROLLO CONCEPTUAL PROFUNDO
- Definiciones precisas con contexto académico.
- Explicaciones detalladas adaptadas a la disciplina (STEM, Negocios, Derecho, Salud, IT, Sociales, Humanidades).

#### 📌 SECCIÓN 3: INTEGRACIÓN INTERDISCIPLINARIA
- Explica las conexiones entre diferentes materias si aplica.

#### 📌 SECCIÓN 4: HERRAMIENTAS PEDAGÓGICAS
- Mnemotecnias, analogías, ejemplos del mundo real y mapas conceptuales textuales.

#### 📌 SECCIÓN 5: PRÁCTICA Y APLICACIÓN
- Banco de ejercicios clasificados por dificultad con resolución paso a paso.

#### 📌 SECCIÓN 6: AUTOEVALUACIÓN
- Preguntas de comprensión, aplicación y síntesis con respuestas justificadas.

#### 📌 SECCIÓN 7: PUNTOS CRÍTICOS Y ERRORES COMUNES
- Conceptos confusos y advertencias importantes.

## 📄 FORMAT
- Usa jerarquía de encabezados (##, ###, ####).
- **Negritas** para términos clave, *cursivas* para énfasis.
- \`Código\` para elementos técnicos (fórmulas, sintaxis).
- Listas y separadores visuales (---).

## 🎓 TARGET AUDIENCE
Estudiantes universitarios que buscan dominio profundo y preparación para exámenes de alto nivel.

---
NOMBRE DEL SET DE ESTUDIO: ${studySetName}
CONTENIDO DE LOS MATERIALES:
${materialsContent.map((t, i) => `[MATERIAL ${i + 1}]:\n${t.slice(0, 100000)}`).join('\n\n')}
---
Genera la guía de estudio más completa, clara y efectiva posible basándote en los materiales anteriores.
`;

    const prompt = masterPrompt;

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

export const generateInfographicFromMaterials = async (materialsContent: string[], studySetName: string): Promise<string | null> => {
    if (materialsContent.length === 0) return null;
    const genAI = getGeminiSDK();
    if (!genAI) return null;

    const infographicPrompt = `
# 🎨 ARQUITECTO DE INFOGRAFÍAS PEDAGÓGICAS
Eres un experto en comunicación visual y síntesis de información. Tu objetivo es transformar materiales académicos en un "blueprint" de infografía de alto impacto.

## 🎯 ESTRUCTURA REQUERIDA (MANTENER ESTOS ENCABEZADOS):
### 🚀 TÍTULO IMPACTANTE: [Nombre del Tema]
### 💡 IDEA CENTRAL: [Resumen en una frase]
### 📊 DATOS/CONCEPTOS CLAVE:
- [Concepto 1]: [Explicación breve + Icono sugerido]
- [Concepto 2]: [Explicación breve + Icono sugerido]
### 🔄 PROCESO O FLUJO:
- Paso 1: [Descripción]
- Paso 2: [Descripción]
### 📌 CONCLUSIÓN VISUAL:
- [Punto final clave]

---
NOMBRE DEL SET DE ESTUDIO: ${studySetName}
CONTENIDO:
${materialsContent.map(t => t.slice(0, 10000)).join('\n\n')}
---
Genera el contenido para la infografía más clara y visualmente estructurada posible.
`;

    try {
        const modelName = await getBestGeminiModel();
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(infographicPrompt);
        return result.response.text();
    } catch (error) {
        console.error('Error generating infographic:', error);
        return null;
    }
};

export const generatePresentationFromMaterials = async (materialsContent: string[], studySetName: string): Promise<string | null> => {
    if (materialsContent.length === 0) return null;
    const genAI = getGeminiSDK();
    if (!genAI) return null;

    const presentationPrompt = `
# 📽️ DISEÑADOR DE PRESENTACIONES EJECUTIVAS
Eres un experto en oratoria y diseño de presentaciones. Crea una estructura de diapositivas (slides) para una exposición de alto nivel.

## 🎯 FORMATO REQUERIDA (MANTENER ESTO):
### 🎬 SLIDE 1: PORTADA
- Título: [Nombre]
- Subtítulo: [Propósito]

### 📝 SLIDE 2: AGENDA
- Puntos que se tratarán.

### 🖼️ SLIDE [N]: [TÍTULO DE LA DIAPOSITIVA]
- [Punto clave 1]
- [Punto clave 2]
- **Nota del orador:** [Explicación para el presentador]

### 🏁 SLIDE FINAL: CIERRE Y PREGUNTAS
- Resumen final.

---
NOMBRE DEL SET DE ESTUDIO: ${studySetName}
CONTENIDO:
${materialsContent.map(t => t.slice(0, 10000)).join('\n\n')}
---
Genera una presentación de entre 8 y 12 slides.
`;

    try {
        const modelName = await getBestGeminiModel();
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(presentationPrompt);
        return result.response.text();
    } catch (error) {
        console.error('Error generating presentation:', error);
        return null;
    }
};

export const generateMaterialSummary = async (content: string, type: 'pdf' | 'text' | 'url' | 'video'): Promise<string | null> => {
    const genAI = getGeminiSDK();
    if (!genAI || !content) return null;

    const summaryPrompt = `Resume esto (${type}): ${content.slice(0, 50000)}`;

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
