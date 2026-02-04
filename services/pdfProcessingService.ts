import { Type } from "@google/genai";
import { getBestGeminiModel, getGeminiSDK } from "./geminiModelManager";
import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';
import JSZip from 'jszip';

// Configure PDF.js worker - use unpkg CDN with specific version
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@5.4.530/build/pdf.worker.min.mjs';

// Max file size for Gemini (approximately 20MB)
const MAX_GEMINI_FILE_SIZE = 20 * 1024 * 1024;

/**
 * Convert base64 to Blob
 */
const base64ToBlob = (base64: string, mimeType: string): Blob => {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
};

/**
 * Extract text from DOCX using Mammoth
 */
const extractTextFromDocx = async (file: File): Promise<string> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value.trim();
  } catch (error) {
    console.error('Error extracting text from DOCX:', error);
    throw new Error('No se pudo leer el archivo DOCX.');
  }
};

/**
 * Extract text from PPTX using JSZip (simple slide text extraction)
 */
const extractTextFromPptx = async (file: File): Promise<string> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);
    let text = '';

    // Find all slide XML files
    const slideFiles = Object.keys(zip.files).filter(fileName =>
      fileName.match(/ppt\/slides\/slide\d+\.xml/)
    );

    // Sort naturally (slide1, slide2, ..., slide10)
    slideFiles.sort((a, b) => {
      const numA = parseInt(a.match(/slide(\d+)\.xml/)?.[1] || '0');
      const numB = parseInt(b.match(/slide(\d+)\.xml/)?.[1] || '0');
      return numA - numB;
    });

    for (const fileName of slideFiles) {
      const content = await zip.file(fileName)?.async('string');
      if (content) {
        // Simple regex to remove xml tags and get text
        // This is a basic extraction, might improperly merge words depending on XML structure
        const slideText = content
          .replace(/<[^>]+>/g, ' ') // Replace tags with space
          .replace(/\s+/g, ' ')     // Collapse whitespace
          .trim();

        if (slideText) {
          text += `[DIAPOSITIVA ${fileName.match(/\d+/)?.[0] || '?'}]\n${slideText}\n\n`;
        }
      }
    }
    return text.trim();
  } catch (error) {
    console.error('Error extracting text from PPTX:', error);
    throw new Error('No se pudo leer el archivo PPTX.');
  }
};

/**
 * Read plain text file
 */
const extractTextFromTxt = async (file: File): Promise<string> => {
  return await file.text();
};


/**
 * Process any supported file content
 */
export const processFileContent = async (
  file: File,
  onProgress?: (message: string) => void
): Promise<string> => {
  const type = file.type;
  const name = file.name.toLowerCase();

  if (type === 'application/pdf' || name.endsWith('.pdf')) {
    return extractTextFromPdf(file, onProgress);
  } else if (
    type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    name.endsWith('.docx')
  ) {
    if (onProgress) onProgress('Procesando documento Word...');
    return extractTextFromDocx(file);
  } else if (
    type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
    name.endsWith('.pptx')
  ) {
    if (onProgress) onProgress('Procesando presentación PowerPoint...');
    return extractTextFromPptx(file);
  } else if (
    type === 'text/plain' ||
    name.endsWith('.txt') ||
    name.endsWith('.md')
  ) {
    if (onProgress) onProgress('Leyendo archivo de texto...');
    return extractTextFromTxt(file);
  } else {
    throw new Error(`Formato de archivo no soportado: ${file.name}`);
  }
}

/**
 * Extract text from PDF using PDF.js - FAST version using File directly
 * RENAMED internally to be used by processFileContent
 */
const extractTextFromPdf = async (
  file: File,
  onProgress?: (message: string) => void
): Promise<string> => {
  try {
    const sizeMB = Math.round(file.size / 1024 / 1024);
    if (onProgress) onProgress(`Abriendo PDF (${sizeMB}MB)...`);

    // Use file URL directly - much faster than base64 conversion
    const fileUrl = URL.createObjectURL(file);

    try {
      const loadingTask = pdfjsLib.getDocument(fileUrl);
      const pdf = await loadingTask.promise;
      const totalPages = pdf.numPages;

      console.log(`PDF has ${totalPages} pages`);
      if (onProgress) onProgress(`${totalPages} páginas encontradas. Extrayendo...`);

      let fullText = '';
      const startTime = Date.now();

      // Process pages in larger batches for speed
      const BATCH_SIZE = 10;
      for (let batchStart = 1; batchStart <= totalPages; batchStart += BATCH_SIZE) {
        const batchEnd = Math.min(batchStart + BATCH_SIZE - 1, totalPages);

        // Process batch of pages in parallel
        const batchPromises = [];
        for (let i = batchStart; i <= batchEnd; i++) {
          batchPromises.push(
            pdf.getPage(i).then(async (page) => {
              try {
                const textContent = await page.getTextContent();
                const pageText = textContent.items
                  .map((item: any) => item.str)
                  .join(' ');
                page.cleanup();
                return { pageNum: i, text: pageText };
              } catch (e) {
                return { pageNum: i, text: '' };
              }
            })
          );
        }

        const results = await Promise.all(batchPromises);
        results.sort((a, b) => a.pageNum - b.pageNum);
        for (const result of results) {
          fullText += result.text + '\n\n';
        }

        // Report progress
        if (onProgress) {
          const elapsed = Math.round((Date.now() - startTime) / 1000);
          const percent = Math.round((batchEnd / totalPages) * 100);
          onProgress(`Página ${batchEnd}/${totalPages} (${percent}%) - ${elapsed}s`);
        }
      }

      const totalTime = Math.round((Date.now() - startTime) / 1000);
      console.log(`Extraction complete in ${totalTime}s, ${fullText.length} chars`);

      return fullText.trim();
    } finally {
      URL.revokeObjectURL(fileUrl);
    }
  } catch (error) {
    console.error('PDF.js extraction error:', error);
    return '';
  }
};

/**
 * Helper to generate content with the new SDK
 */
const generateContent = async (
  prompt: string,
  options?: {
    model?: string;
    jsonSchema?: any;
    temperature?: number;
    maxTokens?: number;
    pdfBase64?: string;
  }
) => {
  const ai = getGeminiSDK();
  if (!ai) throw new Error("Gemini SDK not initialized");

  const modelName = options?.model || await getBestGeminiModel();

  const config: any = {};

  if (options?.jsonSchema) {
    config.responseMimeType = "application/json";
    config.responseSchema = options.jsonSchema;
  }

  if (options?.temperature !== undefined) {
    config.temperature = options.temperature;
  }

  if (options?.maxTokens) {
    config.maxOutputTokens = options.maxTokens;
  }

  let contents: any;

  if (options?.pdfBase64) {
    // Upload PDF using Files API first, then reference it
    console.log('Uploading PDF to Gemini Files API...');
    const pdfBlob = base64ToBlob(options.pdfBase64, 'application/pdf');

    try {
      const uploadedFile = await ai.files.upload({
        file: pdfBlob,
        config: { mimeType: 'application/pdf' }
      });

      console.log('PDF uploaded, file name:', uploadedFile.name, 'uri:', uploadedFile.uri);

      // Wait for file to be processed
      let file = uploadedFile;
      while (file.state === 'PROCESSING') {
        console.log('Waiting for file processing...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        const fileStatus = await ai.files.get({ name: file.name! });
        file = fileStatus;
      }

      if (file.state === 'FAILED') {
        throw new Error('File processing failed');
      }

      // Use the uploaded file reference - just Parts array
      contents = [
        { fileData: { fileUri: file.uri!, mimeType: 'application/pdf' } },
        { text: prompt }
      ];
    } catch (uploadError: any) {
      console.error('Files API error, falling back to inline data:', uploadError.message);
      // Fallback: try inline data directly - just Parts array
      contents = [
        { inlineData: { data: options.pdfBase64, mimeType: 'application/pdf' } },
        { text: prompt }
      ];
    }
  } else {
    // Text-only content
    contents = prompt;
  }

  const response = await ai.models.generateContent({
    model: modelName,
    contents,
    config: Object.keys(config).length > 0 ? config : undefined
  });

  // Handle different SDK versions (text() method vs text property)
  // @ts-ignore - Handle potential SDK version mismatch
  const text = typeof response.text === 'function' ? response.text() : response.text;
  return text || "";
};

/**
 * Extract text content from a PDF File object (FAST - no base64 conversion)
 */
export const extractTextFromPDFFile = async (
  file: File,
  onProgress?: (message: string) => void
): Promise<string | null> => {
  try {
    const sizeMB = Math.round(file.size / 1024 / 1024);
    console.log('PDF size:', sizeMB, 'MB');

    // Step 1: Try PDF.js extraction (handles any size, processes page by page)
    console.log('Attempting local PDF.js text extraction...');
    const pdfJsText = await extractTextFromPdf(file, onProgress);

    // If PDF.js extracted substantial text, use it
    if (pdfJsText && pdfJsText.length > 200) {
      console.log('PDF.js extracted', pdfJsText.length, 'characters');
      return pdfJsText;
    }

    // Step 2: PDF.js didn't extract much - likely a scanned PDF
    // For scanned PDFs, we need Gemini OCR but there's a size limit
    if (file.size > MAX_GEMINI_FILE_SIZE) {
      console.warn('Large scanned PDF detected - OCR not available for files > 20MB');
      if (pdfJsText && pdfJsText.length > 0) {
        return pdfJsText;
      }
      throw new Error(`Este PDF parece ser escaneado (imágenes) y es muy grande (${sizeMB}MB) para OCR. Por favor:\n• Usa un PDF con texto seleccionable, o\n• Comprime el PDF a menos de 20MB para usar OCR`);
    }

    // Convert to base64 only for Gemini OCR (small scanned PDFs)
    if (onProgress) onProgress('PDF escaneado detectado, preparando OCR...');
    console.log('PDF appears to be scanned, using Gemini OCR...');

    const pdfBase64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    if (onProgress) onProgress('Ejecutando OCR con IA...');

    const prompt = `
      TASK: Extract all text from this PDF document.
      CRITICAL INSTRUCTIONS:
      1. This document is a SCANNED IMAGE.
      2. YOU MUST PERFORM OCR to transcribe ALL visible text.
      3. Do NOT summarize. Return the FULL TRANSCRIPT.
      5. Output ONLY the raw extracted text. No markdown, no commentary.
    `;
    const text = await generateContent(prompt, { pdfBase64 });

    if (!text || text.trim().length === 0) {
      throw new Error('OCR no pudo extraer texto.');
    }

    return text;
  } catch (e: any) {
    console.error('Error extracting PDF text:', e);
    throw new Error(`Error procesando PDF: ${e.message || e}`);
  }
};

/**
 * Legacy function for base64 input (slower, avoid if possible)
 */
export const extractTextFromPDF = async (
  pdfBase64: string,
  onProgress?: (message: string) => void
): Promise<string | null> => {
  // Convert base64 to File for the fast path
  const cleanBase64 = pdfBase64.replace(/^data:application\/pdf;base64,/, '');
  const blob = base64ToBlob(cleanBase64, 'application/pdf');
  const file = new File([blob], 'document.pdf', { type: 'application/pdf' });
  return extractTextFromPDFFile(file, onProgress);
};

/**
 * Detect if content is primarily theory, exercises, or mixed
 */
const detectContentType = async (text: string): Promise<'theory' | 'exercises' | 'mixed'> => {
  try {
    const detectionPrompt = `
Analiza este texto educativo y clasifícalo en UNA de estas categorías:

1. "exercises" - Si >70% son EJERCICIOS PRÁCTICOS/PROBLEMAS sin explicaciones teóricas extensas
   Indicadores: números específicos, "Resuelve...", "Calcula...", problemas enumerados (1., 2., 3.), preguntas con datos concretos

2. "theory" - Si >70% es TEORÍA: conceptos, definiciones, explicaciones, demostraciones
   Indicadores: definiciones, explicaciones largas, conceptos abstractos, ejemplos ilustrativos

3. "mixed" - Si mezcla ambos de forma balanceada

TEXTO A ANALIZAR (primeros 5000 caracteres):
${text.slice(0, 5000)}

RESPONDE SOLO CON UNA PALABRA: exercises, theory, o mixed
    `.trim();

    const result = await generateContent(detectionPrompt, {
      temperature: 0.3, // Low temperature for consistent classification
      maxTokens: 10
    });

    const cleaned = result.trim().toLowerCase();

    // Validate response
    if (cleaned === 'exercises' || cleaned === 'theory' || cleaned === 'mixed') {
      console.log(`[Flashcard Generation] Content type detected: ${cleaned}`);
      return cleaned;
    }

    // Default to theory if response is unclear
    console.warn(`[Flashcard Generation] Unclear detection result: "${result}", defaulting to theory`);
    return 'theory';
  } catch (error) {
    console.error('[Flashcard Generation] Error detecting content type:', error);
    return 'theory'; // Safe default
  }
};

/**
 * Get prompt for exercise-mode flashcard generation
 * Extracts underlying concepts instead of literal exercise problems
 */
const getExerciseModePrompt = (text: string, topic: string, count: number): string => {
  const targetCount = count > 0 ? count : 12;

  return `
CONTEXTO: Este material contiene EJERCICIOS PRÁCTICOS, no teoría directa.

TU TAREA: NO crear flashcards de los ejercicios individuales.
En su lugar, INFIERE y GENERA flashcards de los CONCEPTOS TEÓRICOS SUBYACENTES con EXPLICACIONES DETALLADAS Y PEDAGÓGICAS.

TEMA: "${topic}"

INSTRUCCIONES DE EXTRACCIÓN:
1. DETECTA: ¿Qué conceptos/temas cubren estos ejercicios?
2. IDENTIFICA: ¿Qué conocimientos teóricos se necesitan?
3. GENERA FLASHCARDS DE:
   ✅ Definiciones de conceptos clave
   ✅ Fórmulas fundamentales y variables
   ✅ Cuándo aplicar cada método
   ✅ Diferencias entre conceptos similares
   ✅ Pasos/procedimientos
   ✅ Casos especiales y errores comunes

CRÍTICO - CALIDAD DE LAS RESPUESTAS:
Las RESPUESTAS deben ser DETALLADAS, COMPLETAS y PEDAGÓGICAS:

✅ CADA RESPUESTA DEBE INCLUIR:
   - Definición clara y precisa
   - Explicación del POR QUÉ (razonamiento/lógica)
   - Ejemplo concreto e ilustrativo
   - Comparación o contraste cuando sea relevante
   - Tip práctico para recordar/aplicar

✅ LONGITUD: Mínimo 3-5 oraciones completas (NO solo 1 línea)
✅ FORMATO: Usa saltos de línea para organizar la explicación
✅ LENGUAJE: Claro y accesible, como si enseñaras a un estudiante

EJEMPLOS DE RESPUESTAS EXCELENTES:

Pregunta: "¿Qué es una permutación?"
Respuesta: "Una permutación es un arreglo ordenado de elementos donde el ORDEN SÍ importa. Esto significa que ABC y BAC son permutaciones DIFERENTES de las mismas letras.\n\nSe usa cuando necesitas contar de cuántas formas puedes organizar un conjunto de elementos y el orden de selección hace la diferencia.\n\nEjemplo: Si tienes 3 medallas (oro, plata, bronce) y 3 atletas, el número de formas de asignarlas es una permutación porque importa quién recibe cada medalla específica.\n\nTip: Piensa 'permutación = posiciones importan'."

Pregunta: "Fórmula de permutación P(n,r)"
Respuesta: "P(n,r) = n!/(n-r)!\n\nDonde:\n• n = total de elementos disponibles\n• r = elementos que vas a seleccionar y ordenar\n\n¿Por qué esta fórmula? Porque tienes n opciones para el primer lugar, (n-1) para el segundo, y así hasta r posiciones. El factorial (n-r)! en el denominador cancela las posiciones que no usas.\n\nEjemplo: P(5,3) = 5!/(5-3)! = 5!/2! = 5×4×3 = 60 formas de ordenar 3 elementos de 5.\n\nError común: No confundir con C(n,r) que NO considera el orden."

EVITAR:
❌ Respuestas de 1 línea sin explicación
❌ Ejercicios literales con números específicos
❌ Sin ejemplos o contexto

CANTIDAD: Genera EXACTAMENTE ${targetCount} flashcards.
CATEGORÍA: Asigna categorías relevantes
FUENTE: "${topic}"
IDIOMA: Español

EJERCICIOS PARA ANALIZAR:
${text.slice(0, 100000)}
  `.trim();
};

/**
 * Get prompt for theory-mode flashcard generation
 * Standard behavior for theoretical content
 */
const getTheoryModePrompt = (text: string, topic: string, count: number): string => {
  const qualityGuidelines = `
CRÍTICO - CALIDAD DE LAS RESPUESTAS:
Las RESPUESTAS deben ser DETALLADAS, COMPLETAS y FÁCILES DE ENTENDER:

✅ CADA RESPUESTA DEBE INCLUIR:
   1. Definición/Concepto principal (claro y preciso)
   2. Explicación del "POR QUÉ" o contexto (razonamiento)
   3. Ejemplo concreto y específico del material
   4. Implicaciones o aplicaciones prácticas
   5. Conexiones con otros conceptos cuando sea relevante

✅ CARACTERÍSTICAS:
   - LONGITUD: Mínimo 3-5 oraciones completas (NO respuestas de 1 línea)
   - CLARIDAD: Lenguaje accesible, como si enseñaras a un estudiante
   - ESTRUCTURA: Usa saltos de línea (\\n) para organizar ideas
   - EJEMPLOS: Siempre que sea posible, incluye ejemplos del texto
   - PEDAGOGÍA: Anticipa dudas comunes y aclara conceptos relacionados

EJEMPLO DE RESPUESTA EXCELENTE:
Pregunta: "¿Qué es la fotosíntesis?"
Respuesta: "La fotosíntesis es el proceso mediante el cual las plantas convierten la luz solar en energía química almacenada en glucosa.\\n\\nOcurre en los cloroplastos de las células vegetales, donde la clorofila (pigmento verde) captura la energía lumínica. El proceso usa CO₂ del aire y H₂O del suelo para producir glucosa (C₆H₁₂O₆) y liberar oxígeno como subproducto.\\n\\nImportancia: Es la base de casi todas las cadenas alimenticias en la Tierra, ya que las plantas producen el alimento que sostiene a herbívoros y carnivoros.\\n\\nEcuación simplificada: 6CO₂ + 6H₂O + luz → C₆H₁₂O₆ + 6O₂"

EVITAR:
❌ Respuestas cortas tipo diccionario sin explicación
❌ Sin ejemplos o contexto del material
❌ Lenguaje demasiado técnico sin aclaraciones
  `.trim();

  if (count > 0) {
    // Fixed count mode
    return `
OBJETIVO: Genera EXACTAMENTE ${count} flashcards de ALTA CALIDAD PEDAGÓGICA sobre el tema "${topic}".

INSTRUCCIONES DE COBERTURA Y FUENTES:
1. ESCANEO PROFUNDO: Lee el texto párrafo por párrafo.
2. EXTRACCIÓN DISTINTA: Identifica conceptos significativos.
3. COBERTURA TOTAL: Cubre todo el material.
4. NIVEL DE DETALLE: Entra en tecnicismos y ejemplos específicos.
5. CANTIDAD EXACTA: Genera EXACTAMENTE ${count} tarjetas.
6. IDENTIFICACIÓN DE FUENTE: Para cada tarjeta, indica el nombre del material de donde proviene en el campo "source_name".
7. IDIOMA: Español.

${qualityGuidelines}

TEXTO DE REFERENCIA (ESCANEAR TODO):
${text.slice(0, 100000)}
    `.trim();
  } else {
    // Auto-scale / Unlimited mode
    return `
OBJETIVO: Genera un conjunto COMPLETO de flashcards de ALTA CALIDAD PEDAGÓGICA que cubra TODOS los conceptos clave del tema "${topic}".

INSTRUCCIONES DE COBERTURA Y FUENTES:
1. COBERTURA EXHAUSTIVA: Analiza TODO el documento. No dejes ningún concepto importante fuera.
2. SIN LÍMITE ARTIFICIAL: Genera tantas tarjetas como sean necesarias para cubrir el material (pueden ser 10, 20 o 50+).
3. GRANULARIDAD: Desglosa conceptos complejos en tarjetas más simples.
4. TIPOS DE PREGUNTAS: Incluye definiciones, relaciones, ejemplos y causas/efectos.
5. IDENTIFICACIÓN DE FUENTE: Para cada tarjeta, indica el nombre del material de donde proviene en el campo "source_name".
6. IDIOMA: Español.

${qualityGuidelines}

TEXTO DE REFERENCIA (ESCANEAR TODO):
${text.slice(0, 100000)}
    `.trim();
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
  try {
    const schema = {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          question: { type: Type.STRING },
          answer: { type: Type.STRING },
          category: { type: Type.STRING },
          source_name: { type: Type.STRING }
        },
        required: ["question", "answer", "category", "source_name"]
      }
    };

    // Step 1: Detect content type (theory, exercises, or mixed)
    const contentType = await detectContentType(text);

    // Step 2: Choose appropriate prompt based on content type
    let prompt = '';

    if (contentType === 'exercises') {
      // Use exercise-mode prompt to extract concepts
      console.log(`[Flashcard Generation] Using EXERCISE MODE for topic: ${topic}`);
      prompt = getExerciseModePrompt(text, topic, count);
    } else {
      // Use theory-mode prompt (standard behavior)
      console.log(`[Flashcard Generation] Using THEORY MODE for topic: ${topic}`);
      prompt = getTheoryModePrompt(text, topic, count);
    }

    // Step 3: Generate flashcards with appropriate prompt
    const result = await generateContent(prompt, {
      jsonSchema: schema,
      temperature: 0.7,
      maxTokens: 8192
    });

    return JSON.parse(result);
  } catch (error) {
    console.error('Error generating flashcards:', error);
    return null;
  }
};

export const generateStudyGuideFromMaterials = async (materialsContent: string[], studySetName: string, currentGuide?: string): Promise<string | null> => {
  if (materialsContent.length === 0) return null;

  const masterPrompt = `
# PROMPT MAESTRO: GENERADOR DE "TEXTO MAESTRO" (NO RESUMEN)

## CONTEXTO
Eres el autor de un libro de texto universitario definitivo. Tu objetivo NO ES RESUMIR, sino **ENSEÑAR EXHAUSTIVAMENTE**.
Tienes acceso a los apuntes y materiales del estudiante. Tu trabajo es convertir esos materiales (quizás desordenados o dispersos) en un **CAPÍTULO DE LIBRO DE TEXTO COHESIVO Y PROFUNDO**.

## DIRECTIVA DE PRIMERA PRIORIDAD: "ANTI-RESUMEN"
- **PROHIBIDO RESUMIR**. Si el material menciona un concepto, TÚ LO DESARROLLAS COMPLETAMENTE.
- Si hay una lista de 3 puntos en el material, TÚ escribes 3 párrafos explicando cada punto.
- Si hay una fórmula, TÚ explicas cada variable, el porqué de la fórmula y das un ejemplo.
- Extensión esperada: Mínimo 2000-4000 palabras (o lo máximo que permitas). Queremos DETALLE.

## ESTRUCTURA DEL TEXTO MAESTRO

## SECCIÓN 1: FUNDAMENTACIÓN PROFUNDA
- No des una intro ligera. Define el tema con rigor académico.
- Contexto histórico o teórico si aplica.

## SECCIÓN 2: CUERPO DE CONOCIMIENTO (EL NÚCLEO)
- Esta es la sección más larga.
- Divide por temas lógicos.
- **EXPLICACIÓN TIPO TUTOR**: "Imagina que..." , "Es crucial entender que..."
- Usa **Negritas** para conceptos clave.
- Incorpora *ejemplos concretos* para cada concepto abstracto encontrado.

## SECCIÓN 3: INTEGRACIÓN Y RELACIONES
- Cómo se conecta el tema A con el tema B dentro de este material.
- Causalidades, contrastes, jerarquías.

## SECCIÓN 4: LABORATORIO DE PRÁCTICA (PREGUNTAS)
- Genera un banco de preguntas **EXTENSO** (Mínimo 10-15 preguntas).
- No solo preguntas simples. Incluye:
    1. Preguntas de memoria/definición.
    2. Preguntas de aplicación (casos).
    3. Preguntas de análisis "¿Qué pasaría si...?".
- **INCLUYE LAS RESPUESTAS** al final de esta sección (quizás colapsables o separadas).

## SECCIÓN 5: ESTRATEGIAS DE DOMINIO Y RECOMENDACIONES
- ¿Cómo recomiendas estudiar este tema específico?
- Mnemotecnias sugeridas para este contenido.
- "Trampas comunes": Dónde suelen fallar los estudiantes en este tema.
- Recomendaciones de enfoque: "¿Debería memorizar esto o entender la lógica?".

## FORMATO
- Markdown limpio.
- **USO ESTRICTO DE ENCABEZADOS**:
  - Usa "##" (H2) para los Títulos de las 5 Secciones principales.
  - Usa "###" (H3) SOLO para subtítulos DENTRO de las secciones.
- Tablas si son útiles para comparar.
- Bloques de código para fórmulas o algoritmos.
- **CRÍTICO: NO envuelvas la respuesta en bloques de código markdown (\\\`\\\`\\\`markdown).Devuelve el texto RAW.**

    ---
    NOMBRE DEL SET DE ESTUDIO: ${studySetName}
CONTENIDO CRUDO DE LOS MATERIALES:
${materialsContent.map((t, i) => `[FUENTE ${i + 1}]:\n${t}`).join('\n\n')}
  ---

    PROCEDE A ESCRIBIR EL TEXTO MAESTRO AHORA.
`;

  try {
    // Increase output tokens for detailed guide
    return await generateContent(masterPrompt, {
      maxTokens: 8192,
      temperature: 0.5 // Lower temperature for more focused, less hallucinated but detailed content
    });
  } catch (error) {
    console.error('Error generating study guide:', error);
    return null;
  }
};

export const generateInfographicFromMaterials = async (
  materialsContent: { title: string; content: string; type: 'notebook' | 'material' }[],
  studySetName: string
): Promise<string | null> => {
  if (materialsContent.length === 0) return null;

  try {
    const schema = {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        centralIdea: { type: Type.STRING },
        keyConcepts: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              description: { type: Type.STRING },
              icon: { type: Type.STRING }
            },
            required: ["name", "description", "icon"]
          }
        },
        processSteps: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              step: { type: Type.NUMBER },
              description: { type: Type.STRING }
            },
            required: ["step", "description"]
          }
        },
        conclusion: { type: Type.STRING },
        detailedSections: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              content: { type: Type.STRING },
              icon: { type: Type.STRING },
              citations: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    sourceType: { type: Type.STRING, enum: ["Notebook", "Material"] },
                    title: { type: Type.STRING }
                  },
                  required: ["sourceType", "title"]
                }
              }
            },
            required: ["title", "content", "icon"]
          }
        }
      },
      required: ["title", "centralIdea", "keyConcepts", "processSteps", "detailedSections", "conclusion"]
    };

    const infographicPrompt = `
# ARQUITECTO DE INFOGRAFÍAS PEDAGÓGICAS(MODO DETALLADO)
Transforma estos materiales en un mapa mental visual GIGANTE y EXHAUSTIVO.
NO OMITAS DETALLES TÉCNICOS.

NOMBRE DEL SET DE ESTUDIO: ${studySetName}
  CONTENIDO:
${materialsContent.map(m => `--- FUENTE: [${m.type.toUpperCase()}] "${m.title}" ---\n${m.content}`).join('\n\n')}

  Instrucciones:
  1. "detailedSections": Crea secciones profundas para cada tema principal del material.
  2. "icon": Usa iconos de Material Symbols.
  3. El objetivo no es solo resumir, sino ESTRUCTURAR todo el conocimiento.
  4. IDIOMA DE SALIDA: SIEMPRE ESPAÑOL (incluso si el contenido original está en otro idioma).
`;

    return await generateContent(infographicPrompt, { jsonSchema: schema });
  } catch (error) {
    console.error('Error generating infographic:', error);
    return null;
  }
};

// Enhanced Signature: Accepts structured content objects
export const generatePresentationFromMaterials = async (
  materialsContent: { title: string; content: string; type: 'notebook' | 'material' }[],
  studySetName: string
): Promise<string | null> => {

  if (materialsContent.length === 0) return null;

  try {
    const schema = {
      type: Type.OBJECT,
      properties: {
        visualTheme: { type: Type.STRING, enum: ["modern_dark", "clean_light", "professional_blue", "warm_paper"] },
        slides: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              layout: { type: Type.STRING, enum: ["title_slide", "content_list", "two_column", "quote_visual", "data_highlight", "section_header"] },
              title: { type: Type.STRING },
              subtitle: { type: Type.STRING },
              content: { type: Type.ARRAY, items: { type: Type.STRING } },
              visualCue: { type: Type.STRING },
              speakerNotes: { type: Type.STRING },
              citations: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    sourceType: { type: Type.STRING, enum: ["Notebook", "Material"] },
                    title: { type: Type.STRING }
                  },
                  required: ["sourceType", "title"]
                }
              }
            },
            required: ["layout", "title", "content", "speakerNotes"]
          }
        }
      },
      required: ["visualTheme", "slides"]
    };

    const presentationPrompt = `
# ARQUITECTO DE PRESENTACIONES EXPERTO
Tu misión es transformar el material de estudio en una presentación EDUCACIONAL MAESTRA con un diseño tipográfico potente.

    OBJETIVO:
Crear una presentación EXHAUSTIVA(10 a 20 diapositivas) que cubra TODO el material provisto.
NO OMITAS INFORMACIÓN.Queremos profundidad y claridad.

REGLAS DE CONTENIDO:
  1. "speakerNotes": DEBE SER UN GUIÓN COMPLETO para que el estudiante lo lea mientras estudia.Explica el slide profundamente.
2. "content": Puntos clave detallados.Cada punto debe ser una frase completa y contundente que aporte valor real, no solo etiquetas.
3. "subtitle": Usa esto para añadir una capa extra de profundidad o una pregunta provocativa que guíe la diapositiva.

ESTUDIO DE LAYOUTS:
  - layouts: Usarás "title_slide", "content_list", "two_column", "quote_visual", "data_highlight", "section_header" para mantener el dinamismo.
- NO generes campos de "visualCue" o sugerencias de imagen; el diseño se enfocará en la tipografía y la estructura de los datos.

NOMBRE DEL SET: ${studySetName}
 
 MATERIALES DISPONIBLES(Con títulos):
 ${materialsContent.map(m => `--- FUENTE: [${m.type.toUpperCase()}] "${m.title}" ---\n${m.content}`).join('\n\n')}
 
 Genera la presentación completa en JSON.
 `;

    return await generateContent(presentationPrompt, { jsonSchema: schema });
  } catch (error) {
    console.error('Error generating presentation:', error);
    return null;
  }
};

const getComprehensivePrompt = (content: string, type: string) => `
# PROMPT MAESTRO: GENERADOR DE "TEXTO MAESTRO" (NO RESUMEN)

## CONTEXTO
Eres el autor de un libro de texto universitario definitivo. Tu objetivo NO ES RESUMIR, sino **ENSEÑAR EXHAUSTIVAMENTE**.
Estás analizando un material de tipo "${type}". Tu trabajo es convertir ese material en un **CAPÍTULO DE LIBRO DE TEXTO COHESIVO Y PROFUNDO**.

## DIRECTIVA DE PRIMERA PRIORIDAD: "ANTI-RESUMEN"
- **PROHIBIDO RESUMIR**. Si el material menciona un concepto, TÚ LO DESARROLLAS COMPLETAMENTE.
- Si hay una lista de puntos, explica cada uno.
- Si hay ejemplos en el texto, úsalos y mejóralos.
- Extensión esperada: Mínimo 1500 palabras (o lo necesario para cubrir TODO).

## ESTRUCTURA DEL TEXTO MAESTRO

### 1. INTRODUCCIÓN Y CONTEXTO
- Define el tema central con rigor académico.
- ¿Cuál es la tesis o argumento principal de este material?

### 2. DESARROLLO PROFUNDO (EL NÚCLEO)
- Divide por temas lógicos encontrados en el texto.
- **EXPLICACIÓN TIPO TUTOR**: Usa un tono explicativo, claro y detallado.
- Usa **Negritas** para conceptos clave.

### 3. ELEMENTOS CLAVE DETALLADOS
- Si hay fórmulas, explícalas variable por variable.
- Si hay fechas o eventos, dales contexto.
- Si hay argumentos, desglósalos en premisas y conclusiones.

### 4. CONCLUSIONES Y PUNTOS DE RETENCIÓN
- Resumen ejecutivo de lo aprendido.
- "Takeaways" principales.

## NOTE SOBRE FORMATO
- Markdown limpio.
- Usa H3 (###) para títulos de sección.
- NO uses bloques de código para el texto principal.

CONTENIDO A PROCESAR:
${content.slice(0, 90000)}
`;

export const generateMaterialSummary = async (content: string, type: 'pdf' | 'text' | 'url' | 'video'): Promise<string | null> => {
  if (!content) return null;

  try {
    const summaryPrompt = getComprehensivePrompt(content, type);

    // Use a high token limit to ensure we get the full "textbook chapter"
    return await generateContent(summaryPrompt, {
      maxTokens: 8192,
      temperature: 0.4 // Lower temperature for accuracy
    });
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
  try {
    const schema = {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          question: { type: Type.STRING },
          options: { type: Type.ARRAY, items: { type: Type.STRING } },
          correctIndex: { type: Type.NUMBER },
          explanation: { type: Type.STRING }
        },
        required: ["question", "options", "correctIndex", "explanation"]
      }
    };

    const prompt = `Genera ${count} preguntas de quiz sobre "${topic}".JSON.`;
    const result = await generateContent(prompt, { jsonSchema: schema });
    return JSON.parse(result);
  } catch (error) {
    console.error('Error generating quiz:', error);
    return null;
  }
};

/**
 * Generate study summary with dynamic model
 */
export const generateStudySummary = async (text: string, topic: string): Promise<string | null> => {
  try {
    // Reuse the comprehensive prompt logic logic, treating it as text
    const prompt = getComprehensivePrompt(text, 'study_text');
    return await generateContent(prompt, { maxTokens: 8192, temperature: 0.4 });
  } catch (error) {
    console.error('Error generating study summary:', error);
    return null;
  }
};
