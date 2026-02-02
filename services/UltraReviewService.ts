/**
 * UltraReviewService.ts
 *
 * ADAPTIVE comprehensive review service for last-day-before-exam studying.
 * Automatically adapts phases based on the subject type:
 * - Math/Physics: Formulas, Theorems, Problem-solving
 * - History/Law: Timelines, Key Figures, Events
 * - Programming: Syntax, Patterns, Code Examples
 * - Biology/Medicine: Processes, Systems, Terminology
 * - Languages: Grammar, Vocabulary, Rules
 * - General: Concepts, Key Points, Applications
 */

import { supabase } from './supabaseClient';
import { Type } from "@google/genai";
import { getGeminiSDK, getBestGeminiModel } from "./geminiModelManager";

// ============================================
// TYPES
// ============================================

export type DurationMode = 'express' | 'normal' | 'complete';
export type PhaseNumber = 1 | 2 | 3 | 4 | 5 | 6;
export type SessionStatus = 'in_progress' | 'completed' | 'abandoned';

// Subject types for adaptive content
export type SubjectType =
    | 'mathematical'      // Math, Physics, Chemistry, Engineering
    | 'historical'        // History, Law, Political Science
    | 'programming'       // Computer Science, Programming
    | 'scientific'        // Biology, Medicine, Natural Sciences
    | 'linguistic'        // Languages, Literature, Grammar
    | 'business'          // Economics, Business, Finance
    | 'general';          // General knowledge, mixed

export interface SubjectAnalysis {
    type: SubjectType;
    confidence: number;
    detectedTopics: string[];
    hasFormulas: boolean;
    hasCode: boolean;
    hasDates: boolean;
    hasProcesses: boolean;
    recommendedPhases: PhaseConfig[];
}

export interface PhaseConfig {
    phase: PhaseNumber;
    name: string;
    icon: string;
    description: string;
    color: string;
}

export interface UltraReviewSession {
    id: string;
    user_id: string;
    study_set_id?: string;  // Legacy support
    study_set_ids: string[]; // Multi-set support
    duration_mode: DurationMode;
    current_phase: PhaseNumber;
    phase_progress: Record<string, { completed: boolean; time_spent: number }>;
    status: SessionStatus;
    started_at: string;
    completed_at?: string;
    last_activity_at: string;
    total_time_seconds: number;
    generated_content?: {
        subjectType?: SubjectType;
        phaseConfig?: PhaseConfig[];
    };
}

// Adaptive content types
export interface AdaptiveSummaryContent {
    title: string;
    subjectType: SubjectType;
    sections: {
        topic: string;
        keyPoints: string[];
        importance: 'critical' | 'important' | 'helpful';
        mustKnow: string[]; // Things that MUST appear in exam
    }[];
    totalConcepts: number;
    examPredictions: string[]; // What's likely to be on the exam
}

export interface AdaptivePhase2Content {
    type: 'formulas' | 'keyPoints' | 'codePatterns' | 'timeline' | 'vocabulary' | 'principles';
    title: string;
    categories: {
        name: string;
        items: {
            name: string;
            content: string; // Formula, date, code, term, etc.
            explanation: string;
            example?: string;
            whenToUse?: string;
            commonMistake?: string;
        }[];
    }[];
}

export interface AdaptiveMethodologyContent {
    type: 'problemSolving' | 'analysis' | 'writing' | 'coding' | 'memorization';
    methodologies: {
        situationType: string;
        description: string;
        steps: string[];
        tips: string[];
        example?: string;
        commonErrors?: string[];
    }[];
}

export interface FlashcardReviewContent {
    flashcards: {
        id: string;
        question: string;
        answer: string;
        category: string;
        priority: 'must-know' | 'important' | 'good-to-know';
    }[];
    totalCount: number;
    groupedByTopic: Record<string, number>;
}

export interface AdaptiveExerciseContent {
    exercises: {
        id: string;
        type: string;
        problem: string;
        solution: string;
        steps: string[];
        topic: string;
        difficulty: number;
        examLikelihood: 'high' | 'medium' | 'low';
    }[];
    practiceStrategy: string;
}

export interface AdaptiveTipsContent {
    commonMistakes: {
        mistake: string;
        correction: string;
        howToAvoid: string;
        frequency: 'very-common' | 'common' | 'occasional';
    }[];
    examStrategies: {
        strategy: string;
        whenToUse: string;
    }[];
    lastMinuteReminders: string[];
    timeManagement: string[];
    confidenceBoosters: string[];
}

// Duration configuration - more comprehensive
const DURATION_CONFIG = {
    express: {
        summaryMaxSections: 8,
        maxPhase2Items: 15,
        maxMethodologies: 8,
        maxFlashcards: 30,
        maxExercises: 3,
        maxMistakes: 5
    },
    normal: {
        summaryMaxSections: 15,
        maxPhase2Items: 30,
        maxMethodologies: 15,
        maxFlashcards: 60,
        maxExercises: 6,
        maxMistakes: 8
    },
    complete: {
        summaryMaxSections: 999,
        maxPhase2Items: 999,
        maxMethodologies: 999,
        maxFlashcards: 999,
        maxExercises: 12,
        maxMistakes: 15
    }
};

// ============================================
// HELPER: Generate with Gemini
// ============================================

async function generateWithGemini(
    prompt: string,
    jsonSchema?: any,
    temperature: number = 0.7
): Promise<string> {
    const ai = getGeminiSDK();
    if (!ai) throw new Error("Gemini SDK not initialized");

    const modelName = await getBestGeminiModel();

    const config: any = { temperature };

    if (jsonSchema) {
        config.responseMimeType = "application/json";
        config.responseSchema = jsonSchema;
    }

    const response = await ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config
    });

    return response.text || "";
}

// ============================================
// SUBJECT DETECTION
// ============================================

export async function analyzeSubjectType(studySetIds: string | string[]): Promise<SubjectAnalysis> {
    const ids = Array.isArray(studySetIds) ? studySetIds : [studySetIds];
    const { allContent, flashcardContent } = await getStudySetContent(ids);

    // Get study set names for context
    const { data: studySets } = await supabase
        .from('study_sets')
        .select('name, description, topics')
        .in('id', ids);

    const studySetsInfo = studySets?.map(s =>
        `NOMBRE: ${s.name}\nDESCRIPCIÓN: ${s.description}\nTEMAS: ${s.topics?.join(', ')}`
    ).join('\n\n') || 'Sin información de sets';

    const schema = {
        type: Type.OBJECT,
        properties: {
            type: {
                type: Type.STRING,
                enum: ['mathematical', 'historical', 'programming', 'scientific', 'linguistic', 'business', 'general']
            },
            confidence: { type: Type.NUMBER },
            detectedTopics: { type: Type.ARRAY, items: { type: Type.STRING } },
            hasFormulas: { type: Type.BOOLEAN },
            hasCode: { type: Type.BOOLEAN },
            hasDates: { type: Type.BOOLEAN },
            hasProcesses: { type: Type.BOOLEAN }
        },
        required: ['type', 'confidence', 'detectedTopics', 'hasFormulas', 'hasCode', 'hasDates', 'hasProcesses']
    };

    const prompt = `
Analiza el siguiente contenido de estudio y determina qué tipo de materia es.

SETS DE ESTUDIO:
${studySetsInfo}

CONTENIDO:
${allContent.slice(0, 15000)}

FLASHCARDS:
${flashcardContent.slice(0, 5000)}

Clasifica en uno de estos tipos:
- "mathematical": Matemáticas, Física, Química, Ingeniería, Estadística (tiene fórmulas, ecuaciones, cálculos)
- "historical": Historia, Derecho, Ciencias Políticas, Filosofía (tiene fechas, eventos, personajes, leyes)
- "programming": Programación, Informática, Desarrollo (tiene código, algoritmos, sintaxis)
- "scientific": Biología, Medicina, Ciencias Naturales (tiene procesos, sistemas, terminología científica)
- "linguistic": Idiomas, Literatura, Comunicación (tiene gramática, vocabulario, reglas lingüísticas)
- "business": Economía, Negocios, Finanzas, Marketing (tiene principios de negocio, fórmulas financieras)
- "general": Contenido mixto o que no encaja en las anteriores

Responde con:
- type: El tipo de materia
- confidence: 0.0 a 1.0 qué tan seguro estás
- detectedTopics: Lista de temas específicos detectados
- hasFormulas: true si contiene fórmulas matemáticas/científicas
- hasCode: true si contiene código de programación
- hasDates: true si contiene fechas históricas importantes
- hasProcesses: true si describe procesos o sistemas
`;

    try {
        const result = await generateWithGemini(prompt, schema, 0.3);
        const analysis = JSON.parse(result);

        // Add recommended phases based on type
        analysis.recommendedPhases = getPhaseConfigForSubject(analysis.type);

        return analysis;
    } catch (error) {
        console.error('Error analyzing subject:', error);
        return {
            type: 'general',
            confidence: 0.5,
            detectedTopics: [],
            hasFormulas: false,
            hasCode: false,
            hasDates: false,
            hasProcesses: false,
            recommendedPhases: getPhaseConfigForSubject('general')
        };
    }
}

// Get adaptive phase configuration based on subject
export function getPhaseConfigForSubject(subjectType: SubjectType): PhaseConfig[] {
    const basePhases: Record<SubjectType, PhaseConfig[]> = {
        mathematical: [
            { phase: 1, name: 'Teoría y Conceptos', icon: 'menu_book', description: 'Definiciones, teoremas y propiedades', color: 'bg-blue-500' },
            { phase: 2, name: 'Fórmulas y Ecuaciones', icon: 'function', description: 'Todas las fórmulas que necesitas', color: 'bg-purple-500' },
            { phase: 3, name: 'Métodos de Resolución', icon: 'route', description: 'Paso a paso para cada tipo de problema', color: 'bg-amber-500' },
            { phase: 4, name: 'Flashcards', icon: 'style', description: 'Repaso rápido de conceptos', color: 'bg-emerald-500' },
            { phase: 5, name: 'Ejercicios Tipo Examen', icon: 'edit_note', description: 'Problemas representativos', color: 'bg-rose-500' },
            { phase: 6, name: 'Errores Comunes', icon: 'lightbulb', description: 'Lo que NO debes hacer', color: 'bg-cyan-500' }
        ],
        historical: [
            { phase: 1, name: 'Resumen Histórico', icon: 'menu_book', description: 'Contexto y conceptos clave', color: 'bg-blue-500' },
            { phase: 2, name: 'Línea del Tiempo', icon: 'timeline', description: 'Fechas, eventos y personajes', color: 'bg-purple-500' },
            { phase: 3, name: 'Análisis y Conexiones', icon: 'hub', description: 'Causas, efectos y relaciones', color: 'bg-amber-500' },
            { phase: 4, name: 'Flashcards', icon: 'style', description: 'Datos clave para memorizar', color: 'bg-emerald-500' },
            { phase: 5, name: 'Preguntas de Desarrollo', icon: 'edit_note', description: 'Práctica de ensayos y análisis', color: 'bg-rose-500' },
            { phase: 6, name: 'Tips de Redacción', icon: 'lightbulb', description: 'Cómo estructurar respuestas', color: 'bg-cyan-500' }
        ],
        programming: [
            { phase: 1, name: 'Conceptos Fundamentales', icon: 'menu_book', description: 'Teoría y principios', color: 'bg-blue-500' },
            { phase: 2, name: 'Sintaxis y Patrones', icon: 'code', description: 'Código esencial y estructuras', color: 'bg-purple-500' },
            { phase: 3, name: 'Algoritmos y Lógica', icon: 'schema', description: 'Cómo resolver problemas', color: 'bg-amber-500' },
            { phase: 4, name: 'Flashcards', icon: 'style', description: 'Comandos y conceptos', color: 'bg-emerald-500' },
            { phase: 5, name: 'Ejercicios de Código', icon: 'terminal', description: 'Problemas prácticos', color: 'bg-rose-500' },
            { phase: 6, name: 'Debugging Tips', icon: 'bug_report', description: 'Errores comunes y soluciones', color: 'bg-cyan-500' }
        ],
        scientific: [
            { phase: 1, name: 'Teoría y Sistemas', icon: 'menu_book', description: 'Conceptos y estructuras', color: 'bg-blue-500' },
            { phase: 2, name: 'Procesos y Ciclos', icon: 'autorenew', description: 'Mecanismos paso a paso', color: 'bg-purple-500' },
            { phase: 3, name: 'Terminología', icon: 'spellcheck', description: 'Vocabulario científico esencial', color: 'bg-amber-500' },
            { phase: 4, name: 'Flashcards', icon: 'style', description: 'Datos y definiciones', color: 'bg-emerald-500' },
            { phase: 5, name: 'Casos y Aplicaciones', icon: 'biotech', description: 'Ejemplos prácticos', color: 'bg-rose-500' },
            { phase: 6, name: 'Conexiones Clave', icon: 'lightbulb', description: 'Relaciones entre sistemas', color: 'bg-cyan-500' }
        ],
        linguistic: [
            { phase: 1, name: 'Reglas Gramaticales', icon: 'menu_book', description: 'Estructura del idioma', color: 'bg-blue-500' },
            { phase: 2, name: 'Vocabulario Esencial', icon: 'translate', description: 'Palabras y expresiones clave', color: 'bg-purple-500' },
            { phase: 3, name: 'Patrones y Usos', icon: 'pattern', description: 'Cuándo y cómo usar cada forma', color: 'bg-amber-500' },
            { phase: 4, name: 'Flashcards', icon: 'style', description: 'Vocabulario y conjugaciones', color: 'bg-emerald-500' },
            { phase: 5, name: 'Ejercicios de Práctica', icon: 'edit_note', description: 'Traducción y composición', color: 'bg-rose-500' },
            { phase: 6, name: 'Errores Frecuentes', icon: 'lightbulb', description: 'Falsos amigos y confusiones', color: 'bg-cyan-500' }
        ],
        business: [
            { phase: 1, name: 'Conceptos de Negocio', icon: 'menu_book', description: 'Teoría y principios', color: 'bg-blue-500' },
            { phase: 2, name: 'Fórmulas y Métricas', icon: 'analytics', description: 'KPIs, ratios y cálculos', color: 'bg-purple-500' },
            { phase: 3, name: 'Frameworks y Modelos', icon: 'account_tree', description: 'Herramientas de análisis', color: 'bg-amber-500' },
            { phase: 4, name: 'Flashcards', icon: 'style', description: 'Términos y definiciones', color: 'bg-emerald-500' },
            { phase: 5, name: 'Casos de Estudio', icon: 'cases', description: 'Aplicación práctica', color: 'bg-rose-500' },
            { phase: 6, name: 'Tips Estratégicos', icon: 'lightbulb', description: 'Consejos para el examen', color: 'bg-cyan-500' }
        ],
        general: [
            { phase: 1, name: 'Resumen de Conceptos', icon: 'menu_book', description: 'Todo lo que debes saber', color: 'bg-blue-500' },
            { phase: 2, name: 'Puntos Clave', icon: 'push_pin', description: 'Lo más importante', color: 'bg-purple-500' },
            { phase: 3, name: 'Cómo Aplicarlo', icon: 'route', description: 'Metodologías y procesos', color: 'bg-amber-500' },
            { phase: 4, name: 'Flashcards', icon: 'style', description: 'Repaso rápido', color: 'bg-emerald-500' },
            { phase: 5, name: 'Práctica', icon: 'edit_note', description: 'Ejercicios y ejemplos', color: 'bg-rose-500' },
            { phase: 6, name: 'Tips Finales', icon: 'lightbulb', description: 'Consejos para el examen', color: 'bg-cyan-500' }
        ]
    };

    return basePhases[subjectType];
}

// ============================================
// SESSION MANAGEMENT
// ============================================

export async function getOrCreateSession(
    userId: string,
    studySetIds: string | string[],
    durationMode: DurationMode = 'normal'
): Promise<UltraReviewSession> {
    const ids = Array.isArray(studySetIds) ? studySetIds : [studySetIds];

    // Check for existing active session with same sets
    const { data: existing } = await supabase
        .from('ultra_review_sessions')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'in_progress')
        .or(`study_set_id.in.(${ids.join(',')}),study_set_ids.cs.{${ids.join(',')}}`)
        .order('created_at', { ascending: false })
        .limit(1);

    // Filter manually if needed to be strict about exact set match, 
    // but for now, if it contains the sets, we might resume it.
    // Ideally we want exact match on the array.
    if (existing && existing.length > 0) {
        // Simple check: match length and content (if careful)
        // For MVP, just returning the most recent active session for these might be okay, 
        // but let's try to find one where IDs match.
        const match = existing.find(s => {
            const sessionIds = s.study_set_ids || (s.study_set_id ? [s.study_set_id] : []);
            if (sessionIds.length !== ids.length) return false;
            return ids.every(id => sessionIds.includes(id));
        });

        if (match) return match as UltraReviewSession;
    }

    // Create new
    const { data: newSession, error } = await supabase
        .from('ultra_review_sessions')
        .insert({
            user_id: userId,
            study_set_id: ids.length === 1 ? ids[0] : null,
            study_set_ids: ids,
            duration_mode: durationMode,
            current_phase: 1,
            phase_progress: {},
            status: 'in_progress'
        })
        .select()
        .single();

    if (error) throw error;
    return newSession as UltraReviewSession;
}

export interface UltraReviewConfig {
    durationMode: DurationMode;
    selectedPhases: PhaseNumber[];
    focusMode: 'all' | 'weak_topics' | 'exam_prep';
}

export interface UltraReviewSession {
    id: string;
    user_id: string;
    study_set_id?: string;
    study_set_ids: string[];
    duration_mode: DurationMode;
    config?: UltraReviewConfig; // New field
    current_phase: PhaseNumber;
    phase_progress: Record<string, { completed: boolean; time_spent: number }>;
    status: SessionStatus;
    started_at: string;
    completed_at?: string;
    last_activity_at: string;
    total_time_seconds: number;
    generated_content?: {
        subjectType?: SubjectType;
        phaseConfig?: PhaseConfig[];
    };
}

/**
 * Creates a new session with explicit configuration and subject analysis
 * (Split from startFreshSession to allow progress tracking in UI)
 */
export async function createSessionWithConfig(
    userId: string,
    studySetIds: string | string[],
    config: UltraReviewConfig,
    subjectAnalysis: SubjectAnalysis
): Promise<UltraReviewSession> {
    const ids = Array.isArray(studySetIds) ? studySetIds : [studySetIds];

    // Abandon previous in-progress sessions for these sets
    // (We search for sessions that contain ANY of the target set IDs)
    // Note: This is an approximation/simplification. Ideally we match exact sets.
    await supabase
        .from('ultra_review_sessions')
        .update({ status: 'abandoned' })
        .eq('user_id', userId)
        .eq('status', 'in_progress')
        .or(`study_set_id.in.(${ids.join(',')})`);

    const { data: newSession, error } = await supabase
        .from('ultra_review_sessions')
        .insert({
            user_id: userId,
            study_set_id: ids.length === 1 ? ids[0] : null,
            study_set_ids: ids,
            duration_mode: config.durationMode,
            current_phase: 1,
            phase_progress: {},
            status: 'in_progress',
            generated_content: {
                subjectType: subjectAnalysis.type,
                phaseConfig: subjectAnalysis.recommendedPhases.filter(p => config.selectedPhases.includes(p.phase))
            },
            // We might need to store the full config in a JSON column if we want to persist focusMode
            // For now, duration_mode is a column, others can be capable inferred or stored in generated_content/metadata if needed.
            // But 'config' isn't a column in the DB schema yet. We can store it in generated_content for now or assume UI handles it.
            // Let's store it in generated_content to avoid schema change for 'config' column specifically.
        })
        .select()
        .single();

    if (error) throw error;

    // Inject the config back into the returned object for the frontend
    return {
        ...newSession,
        config
    } as UltraReviewSession;
}

export async function updateSessionProgress(
    sessionId: string,
    currentPhase: PhaseNumber,
    phaseProgress: Record<string, { completed: boolean; time_spent: number }>,
    totalTimeSeconds: number
): Promise<void> {
    await supabase
        .from('ultra_review_sessions')
        .update({
            current_phase: currentPhase,
            phase_progress: phaseProgress,
            total_time_seconds: totalTimeSeconds,
            last_activity_at: new Date().toISOString()
        })
        .eq('id', sessionId);
}

export async function completeSession(sessionId: string, totalTimeSeconds: number): Promise<void> {
    await supabase
        .from('ultra_review_sessions')
        .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            total_time_seconds: totalTimeSeconds,
            current_phase: 6,
            phase_progress: {
                "1": { completed: true, time_spent: 0 },
                "2": { completed: true, time_spent: 0 },
                "3": { completed: true, time_spent: 0 },
                "4": { completed: true, time_spent: 0 },
                "5": { completed: true, time_spent: 0 },
                "6": { completed: true, time_spent: 0 }
            }
        })
        .eq('id', sessionId);
}

// ============================================
// CONTENT FETCHING
// ============================================

async function getStudySetContent(studySetIds: string | string[]) {
    const ids = Array.isArray(studySetIds) ? studySetIds : [studySetIds];

    // First, get study set metadata
    const { data: studySets } = await supabase
        .from('study_sets')
        .select('id, name, description, topics')
        .in('id', ids);

    const studySetMap = new Map(studySets?.map(s => [s.id, s]) || []);

    const [materials, notebooks, flashcards, exercises] = await Promise.all([
        supabase
            .from('study_set_materials')
            .select('study_set_id, name, content_text, summary')
            .in('study_set_id', ids),
        supabase
            .from('notebooks')
            .select('study_set_id, title, content, last_saved_content')
            .in('study_set_id', ids),
        supabase
            .from('flashcards')
            .select('study_set_id, id, question, answer, category')
            .in('study_set_id', ids),
        supabase
            .from('exercise_templates')
            .select('study_set_id, id, problem_statement, solution, step_by_step_explanation, exercise_type, topic, difficulty')
            .in('study_set_id', ids)
    ]);

    const extractTextFromHtml = (html: string): string => {
        if (!html) return '';
        return html
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<\/p>/gi, '\n\n')
            .replace(/<\/li>/gi, '\n')
            .replace(/<\/h[1-6]>/gi, '\n\n')
            .replace(/<[^>]+>/g, '')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    };

    // Organize content by study set
    const contentBySet = ids.map(setId => {
        const studySet = studySetMap.get(setId);
        const setMaterials = materials.data?.filter(m => m.study_set_id === setId) || [];
        const setNotebooks = notebooks.data?.filter(n => n.study_set_id === setId) || [];
        const setFlashcards = flashcards.data?.filter(f => f.study_set_id === setId) || [];
        const setExercises = exercises.data?.filter(e => e.study_set_id === setId) || [];

        let setContent = '';

        setMaterials.forEach(m => {
            setContent += `\\n\\n--- Material: ${m.name} ---\\n`;
            if (m.content_text) setContent += m.content_text;
            if (m.summary) setContent += `\\nResumen: ${m.summary}`;
        });

        setNotebooks.forEach(n => {
            const text = extractTextFromHtml(n.content || n.last_saved_content || '');
            if (text) {
                setContent += `\\n\\n--- Cuaderno: ${n.title} ---\\n${text}`;
            }
        });

        const setFlashcardContent = setFlashcards
            .map(f => `P: ${f.question}\\nR: ${f.answer}`)
            .join('\\n\\n');

        return {
            setId,
            setName: studySet?.name || 'Set Desconocido',
            setTopics: studySet?.topics || [],
            setDescription: studySet?.description || '',
            content: setContent,
            flashcardContent: setFlashcardContent,
            materialCount: setMaterials.length,
            notebookCount: setNotebooks.length,
            flashcardCount: setFlashcards.length,
            exerciseCount: setExercises.length
        };
    });

    // Build the combined content with CLEAR set separation and headers
    let allContent = '';
    let allFlashcardContent = '';

    contentBySet.forEach((setData, index) => {
        const separator = '='.repeat(80);
        allContent += `\\n\\n${separator}\\nSET ${index + 1} DE ${contentBySet.length}: ${setData.setName.toUpperCase()}\\n`;
        allContent += `TEMAS: ${setData.setTopics.join(', ') || 'N/A'}\\n`;
        allContent += `DESCRIPCIÓN: ${setData.setDescription}\\n`;
        allContent += `CONTENIDO: ${setData.materialCount} materiales, ${setData.notebookCount} cuadernos, ${setData.flashcardCount} flashcards\\n`;
        allContent += `${separator}\\n`;
        allContent += setData.content;

        if (setData.flashcardContent) {
            allFlashcardContent += `\\n\\n--- FLASHCARDS DE: ${setData.setName} ---\\n`;
            allFlashcardContent += setData.flashcardContent;
        }
    });

    return {
        allContent: allContent.slice(0, 150000), // Increased limit
        flashcards: flashcards.data || [],
        exercises: exercises.data || [],
        flashcardContent: allFlashcardContent,
        contentBySet, // Return structured data for balanced processing
        setCount: ids.length
    };
}

// ============================================
// PHASE 1: ADAPTIVE SUMMARY (COMPLETE THEORY)
// ============================================

export async function generateAdaptiveSummary(
    studySetIds: string | string[],
    durationMode: DurationMode,
    subjectType: SubjectType
): Promise<AdaptiveSummaryContent> {
    const config = DURATION_CONFIG[durationMode];
    const { allContent, flashcardContent, contentBySet, setCount } = await getStudySetContent(studySetIds);

    const schema = {
        type: Type.OBJECT,
        properties: {
            title: { type: Type.STRING },
            subjectType: { type: Type.STRING },
            sections: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        topic: { type: Type.STRING },
                        keyPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
                        importance: { type: Type.STRING, enum: ['critical', 'important', 'helpful'] },
                        mustKnow: { type: Type.ARRAY, items: { type: Type.STRING } }
                    },
                    required: ['topic', 'keyPoints', 'importance', 'mustKnow']
                }
            },
            totalConcepts: { type: Type.NUMBER },
            examPredictions: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ['title', 'subjectType', 'sections', 'totalConcepts', 'examPredictions']
    };

    const subjectContext = {
        mathematical: 'Este es contenido matemático/científico. Enfócate en teoremas, propiedades, definiciones formales y relaciones.',
        historical: 'Este es contenido histórico/social. Enfócate en contexto, causas, consecuencias, personajes y fechas importantes.',
        programming: 'Este es contenido de programación. Enfócate en conceptos, paradigmas, estructuras de datos y principios.',
        scientific: 'Este es contenido científico/biológico. Enfócate en sistemas, procesos, funciones y terminología.',
        linguistic: 'Este es contenido lingüístico. Enfócate en reglas, excepciones, usos y estructuras.',
        business: 'Este es contenido de negocios. Enfócate en conceptos, modelos, métricas y aplicaciones.',
        general: 'Analiza el contenido y extrae los conceptos más importantes de forma estructurada.'
    };

    // Build set summary for explicit coverage requirement
    const setSummary = contentBySet?.map((set, idx) =>
        `SET ${idx + 1}: "${set.setName}" (${set.flashcardCount} flashcards, ${set.materialCount + set.notebookCount} documentos)`
    ).join('\n') || '';

    const balancedCoverageInstruction = setCount > 1 ? `
⚠️ CRÍTICO - BALANCE DE SETS:
Tienes ${setCount} SETS DIFERENTES que cubrir. DEBES incluir contenido de TODOS Y CADA UNO de los sets:
${setSummary}

REGLA OBLIGATORIA: Distribuye las ${config.summaryMaxSections} secciones PROPORCIONALMENTE entre los ${setCount} sets.
- Aproximadamente ${Math.ceil(config.summaryMaxSections / setCount)} secciones por set como MÍNIMO.
- NO te enfoques solo en un set o dejes alguno sin cubrir.
- Si un set tiene menos contenido, igualmente incluye sus conceptos clave.
- Identifica cada sección con el nombre del set del que proviene.
` : '';

    const prompt = `
Eres el MEJOR profesor preparando a un estudiante para sacar 90+ en su examen de MAÑANA.
Genera un resumen COMPLETO y PERFECTO que cubra TODA la teoría.

${subjectContext[subjectType]}
${balancedCoverageInstruction}

MATERIAL COMPLETO DEL ESTUDIANTE:
${allContent}

FLASHCARDS EXISTENTES:
${flashcardContent}

INSTRUCCIONES CRÍTICAS:
1. NO OMITAS NADA IMPORTANTE. Este es el repaso final antes del examen.
2. Organiza por temas de forma lógica
3. Para cada tema incluye:
   - keyPoints: TODOS los puntos clave (definiciones, propiedades, relaciones)
   - importance: "critical" si seguro sale en examen, "important" si muy probable, "helpful" si complementa
   - mustKnow: Las cosas que el estudiante DEBE saber de memoria (máximo 3-5 por tema)
4. Máximo ${config.summaryMaxSections} secciones pero cubre TODO
5. examPredictions: Lista de 5-8 cosas que probablemente pregunten en el examen

PRIORIZA:
- Definiciones fundamentales que pueden preguntar directamente
- Relaciones entre conceptos (causas, efectos, comparaciones)
- Cosas que los profesores suelen preguntar
- Conceptos que conectan múltiples temas

Idioma: Español
`;

    try {
        const result = await generateWithGemini(prompt, schema, 0.4);
        return JSON.parse(result);
    } catch (error) {
        console.error('Error generating adaptive summary:', error);
        return {
            title: 'Resumen de Conceptos',
            subjectType,
            sections: [],
            totalConcepts: 0,
            examPredictions: []
        };
    }
}

// ============================================
// PHASE 2: ADAPTIVE KEY ELEMENTS (Formulas/Dates/Code/etc)
// ============================================

export async function generateAdaptivePhase2(
    studySetIds: string | string[],
    durationMode: DurationMode,
    subjectType: SubjectType
): Promise<AdaptivePhase2Content> {
    const config = DURATION_CONFIG[durationMode];
    const { allContent, flashcardContent, contentBySet, setCount } = await getStudySetContent(studySetIds);

    const phase2Config: Record<SubjectType, { type: string; title: string; instruction: string }> = {
        mathematical: {
            type: 'formulas',
            title: 'Fórmulas y Ecuaciones',
            instruction: 'Extrae TODAS las fórmulas, ecuaciones, teoremas y propiedades matemáticas. Incluye: nombre, fórmula exacta, explicación de variables, ejemplo de uso, error común.'
        },
        historical: {
            type: 'timeline',
            title: 'Línea del Tiempo y Datos Clave',
            instruction: 'Extrae TODAS las fechas importantes, eventos, personajes y sus roles. Para cada uno: fecha/periodo, evento/persona, significado/impacto, conexiones con otros eventos.'
        },
        programming: {
            type: 'codePatterns',
            title: 'Sintaxis y Patrones de Código',
            instruction: 'Extrae TODA la sintaxis importante, patrones de diseño, estructuras de datos. Para cada uno: nombre, sintaxis/código, explicación, cuándo usarlo, ejemplo.'
        },
        scientific: {
            type: 'processes',
            title: 'Procesos y Sistemas',
            instruction: 'Extrae TODOS los procesos, ciclos, sistemas y mecanismos. Para cada uno: nombre, pasos/fases, función, relación con otros sistemas.'
        },
        linguistic: {
            type: 'vocabulary',
            title: 'Vocabulario y Reglas Gramaticales',
            instruction: 'Extrae TODAS las reglas gramaticales, vocabulario esencial, expresiones. Para cada uno: regla/término, forma correcta, excepciones, ejemplos de uso.'
        },
        business: {
            type: 'principles',
            title: 'Conceptos y Estrategias de Negocio',
            instruction: 'Extrae TODAS las estrategias, conceptos clave, fórmulas financieras, KPIs, frameworks y modelos. Para cada uno: nombre, definición/fórmula, interpretación, aplicación práctica y ejemplo.'
        },
        general: {
            type: 'keyPoints',
            title: 'Puntos Clave y Reglas',
            instruction: 'Extrae TODOS los datos clave, reglas, definiciones y principios importantes. Para cada uno: nombre, contenido, explicación, ejemplo de aplicación.'
        }
    };

    const phaseConfig = phase2Config[subjectType];

    const schema = {
        type: Type.OBJECT,
        properties: {
            type: { type: Type.STRING },
            title: { type: Type.STRING },
            categories: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        name: { type: Type.STRING },
                        items: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    name: { type: Type.STRING },
                                    content: { type: Type.STRING },
                                    explanation: { type: Type.STRING },
                                    example: { type: Type.STRING },
                                    whenToUse: { type: Type.STRING },
                                    commonMistake: { type: Type.STRING }
                                },
                                required: ['name', 'content', 'explanation']
                            }
                        }
                    },
                    required: ['name', 'items']
                }
            }
        },
        required: ['type', 'title', 'categories']
    };

    const balancedCoverageInstruction = setCount > 1 ? `
⚠️ IMPORTANTE: Estás trabajando con ${setCount} SETS diferentes:
${contentBySet?.map((s, i) => `  - SET ${i + 1}: ${s.setName}`).join('\\n')}
Asegúrate de incluir elementos de TODOS los sets proporcionalmente.
` : '';

    const prompt = `
Genera un CHEAT SHEET PERFECTO para el día antes del examen.
Tipo de materia: ${subjectType}

${balancedCoverageInstruction}
${phaseConfig.instruction}

MATERIAL:
        ${allContent}

FLASHCARDS:
        ${flashcardContent}

INSTRUCCIONES:
        1. Agrupa por categorías / temas lógicos
2. Máximo ${config.maxPhase2Items} elementos en total
3. Cada elemento debe tener:
        - name: Nombre descriptivo
    - content: El contenido principal(fórmula, fecha, código, regla, etc.)
    - explanation: Explicación clara y concisa
    - example: Un ejemplo de aplicación(cuando aplique)
    - whenToUse: Cuándo usar esto(si aplica)
    - commonMistake: Error común a evitar(si hay uno relevante)
4. PRIORIZA lo que más probablemente pregunten en el examen
5. Si no hay contenido de este tipo, genera los puntos clave más importantes

Responde con type: "${phaseConfig.type}" y title: "${phaseConfig.title}"

Idioma: Español
        `;

    try {
        const result = await generateWithGemini(prompt, schema, 0.4);
        return JSON.parse(result);
    } catch (error) {
        console.error('Error generating adaptive phase 2:', error);
        return {
            type: phaseConfig.type as any,
            title: phaseConfig.title,
            categories: []
        };
    }
}

// ============================================
// PHASE 3: ADAPTIVE METHODOLOGIES
// ============================================

export async function generateAdaptiveMethodologies(
    studySetIds: string | string[],
    durationMode: DurationMode,
    subjectType: SubjectType
): Promise<AdaptiveMethodologyContent> {
    const config = DURATION_CONFIG[durationMode];
    const { allContent, exercises } = await getStudySetContent(studySetIds);

    const exerciseContext = exercises
        .filter(e => e.step_by_step_explanation && e.step_by_step_explanation.length > 0)
        .slice(0, 10)
        .map(e => `Tipo: ${e.exercise_type}\nProblema: ${e.problem_statement}\nPasos: ${JSON.stringify(e.step_by_step_explanation)}`)
        .join('\n\n');

    const methodologyConfig: Record<SubjectType, { type: string; instruction: string }> = {
        mathematical: {
            type: 'problemSolving',
            instruction: 'Genera metodologías para RESOLVER cada tipo de problema matemático. Incluye: identificar el tipo, pasos exactos, verificación, errores comunes.'
        },
        historical: {
            type: 'analysis',
            instruction: 'Genera metodologías para ANALIZAR y REDACTAR sobre temas históricos. Incluye: cómo estructurar ensayos, cómo comparar períodos, cómo argumentar.'
        },
        programming: {
            type: 'coding',
            instruction: 'Genera metodologías para DISEÑAR y ESCRIBIR código. Incluye: análisis del problema, diseño de solución, implementación, testing.'
        },
        scientific: {
            type: 'analysis',
            instruction: 'Genera metodologías para EXPLICAR procesos y RESOLVER problemas científicos. Incluye: identificar componentes, describir mecanismos, predecir resultados.'
        },
        linguistic: {
            type: 'writing',
            instruction: 'Genera metodologías para APLICAR reglas gramaticales y REDACTAR. Incluye: identificar la estructura, aplicar reglas, verificar coherencia.'
        },
        business: {
            type: 'analysis',
            instruction: 'Genera metodologías para ANALIZAR casos y CALCULAR métricas. Incluye: identificar datos, aplicar frameworks, interpretar resultados.'
        },
        general: {
            type: 'problemSolving',
            instruction: 'Genera metodologías generales para abordar diferentes tipos de preguntas y problemas.'
        }
    };

    const methConfig = methodologyConfig[subjectType];

    const schema = {
        type: Type.OBJECT,
        properties: {
            type: { type: Type.STRING },
            methodologies: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        situationType: { type: Type.STRING },
                        description: { type: Type.STRING },
                        steps: { type: Type.ARRAY, items: { type: Type.STRING } },
                        tips: { type: Type.ARRAY, items: { type: Type.STRING } },
                        example: { type: Type.STRING },
                        commonErrors: { type: Type.ARRAY, items: { type: Type.STRING } }
                    },
                    required: ['situationType', 'description', 'steps', 'tips']
                }
            }
        },
        required: ['type', 'methodologies']
    };

    const prompt = `
Genera una GUÍA DE METODOLOGÍAS PERFECTA para resolver cualquier pregunta del examen.
Tipo de materia: ${subjectType}

${methConfig.instruction}

MATERIAL DEL CURSO:
        ${allContent.slice(0, 50000)}

EJERCICIOS DE EJEMPLO:
        ${exerciseContext}

INSTRUCCIONES:
        1. Identifica TODOS los tipos de problemas / preguntas que pueden aparecer
2. Para cada tipo incluye:
        - situationType: Nombre del tipo de problema
    - description: Cuándo aplica esta metodología
    - steps: Pasos EXACTOS y CLAROS(que se puedan seguir sin pensar)
    - tips: Consejos para no equivocarse
    - example: Un ejemplo breve
    - commonErrors: Errores típicos y cómo evitarlos
3. Máximo ${config.maxMethodologies} metodologías
4. Los pasos deben ser lo suficientemente detallados para seguirlos mecánicamente

Idioma: Español
        `;

    try {
        const result = await generateWithGemini(prompt, schema, 0.5);
        return JSON.parse(result);
    } catch (error) {
        console.error('Error generating methodologies:', error);
        return { type: methConfig.type as any, methodologies: [] };
    }
}

// ============================================
// PHASE 4: FLASHCARDS (Enhanced)
// ============================================

export async function getFlashcardsForReview(
    studySetIds: string | string[],
    durationMode: DurationMode
): Promise<FlashcardReviewContent> {
    const config = DURATION_CONFIG[durationMode];
    const ids = Array.isArray(studySetIds) ? studySetIds : [studySetIds];

    const { data: flashcards } = await supabase
        .from('flashcards')
        .select('id, question, answer, category')
        .in('study_set_id', ids)
        .limit(config.maxFlashcards);

    // Group by topic
    const groupedByTopic: Record<string, number> = {};
    (flashcards || []).forEach(f => {
        const cat = f.category || 'General';
        groupedByTopic[cat] = (groupedByTopic[cat] || 0) + 1;
    });

    return {
        flashcards: (flashcards || []).map(f => ({
            ...f,
            priority: 'important' as const
        })),
        totalCount: flashcards?.length || 0,
        groupedByTopic
    };
}

// ============================================
// PHASE 5: EXERCISES (Enhanced)
// ============================================

export async function getExercisesForReview(
    studySetIds: string | string[],
    durationMode: DurationMode,
    subjectType: SubjectType
): Promise<AdaptiveExerciseContent> {
    const config = DURATION_CONFIG[durationMode];
    const ids = Array.isArray(studySetIds) ? studySetIds : [studySetIds];

    const { data: exercises } = await supabase
        .from('exercise_templates')
        .select('id, problem_statement, solution, step_by_step_explanation, topic, difficulty, exercise_type')
        .in('study_set_id', ids)
        .order('difficulty', { ascending: true })
        .limit(config.maxExercises);

    const strategyBySubject: Record<SubjectType, string> = {
        mathematical: 'Practica primero los más fáciles para ganar confianza, luego intenta los difíciles. Verifica SIEMPRE tus respuestas.',
        historical: 'Lee cada pregunta cuidadosamente. Estructura tu respuesta antes de escribir. Incluye fechas y nombres específicos.',
        programming: 'Piensa en el algoritmo antes de codificar. Traza con ejemplos pequeños. Considera casos borde.',
        scientific: 'Identifica los conceptos involucrados primero. Relaciona con procesos conocidos. Verifica la lógica.',
        linguistic: 'Lee el contexto completo. Aplica las reglas paso a paso. Verifica la concordancia.',
        business: 'Identifica los datos clave. Aplica las fórmulas correctas. Interpreta los resultados.',
        general: 'Lee cuidadosamente. Identifica qué te piden. Estructura tu respuesta.'
    };

    return {
        exercises: (exercises || []).map(e => ({
            id: e.id,
            type: e.exercise_type || 'general',
            problem: e.problem_statement,
            solution: e.solution || '',
            steps: e.step_by_step_explanation || [],
            topic: e.topic || 'General',
            difficulty: e.difficulty,
            examLikelihood: e.difficulty >= 3 ? 'high' : e.difficulty >= 2 ? 'medium' : 'low'
        })),
        practiceStrategy: strategyBySubject[subjectType]
    };
}

// ============================================
// PHASE 6: ADAPTIVE TIPS
// ============================================

export async function generateAdaptiveTips(
    studySetIds: string | string[],
    durationMode: DurationMode,
    subjectType: SubjectType
): Promise<AdaptiveTipsContent> {
    const config = DURATION_CONFIG[durationMode];
    const { allContent, flashcardContent, contentBySet, setCount } = await getStudySetContent(studySetIds);

    const schema = {
        type: Type.OBJECT,
        properties: {
            commonMistakes: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        mistake: { type: Type.STRING },
                        correction: { type: Type.STRING },
                        howToAvoid: { type: Type.STRING },
                        frequency: { type: Type.STRING, enum: ['very-common', 'common', 'occasional'] }
                    },
                    required: ['mistake', 'correction', 'howToAvoid', 'frequency']
                }
            },
            examStrategies: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        strategy: { type: Type.STRING },
                        whenToUse: { type: Type.STRING }
                    },
                    required: ['strategy', 'whenToUse']
                }
            },
            lastMinuteReminders: { type: Type.ARRAY, items: { type: Type.STRING } },
            timeManagement: { type: Type.ARRAY, items: { type: Type.STRING } },
            confidenceBoosters: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ['commonMistakes', 'examStrategies', 'lastMinuteReminders', 'timeManagement', 'confidenceBoosters']
    };

    const tipsContext: Record<SubjectType, string> = {
        mathematical: 'En exámenes de matemáticas: verificar cálculos, revisar signos, no olvidar unidades, mostrar todo el procedimiento.',
        historical: 'En exámenes de historia: citar fechas específicas, argumentar con evidencia, estructurar ensayos con intro-desarrollo-conclusión.',
        programming: 'En exámenes de programación: pensar antes de codificar, manejar casos borde, nombrar variables claramente, comentar código si ayuda.',
        scientific: 'En exámenes de ciencias: usar terminología correcta, explicar procesos completos, relacionar conceptos entre sí.',
        linguistic: 'En exámenes de idiomas: revisar concordancia, cuidar acentos y ortografía, mantener coherencia en tiempos verbales.',
        business: 'En exámenes de negocios: mostrar cálculos, interpretar resultados, aplicar frameworks correctamente.',
        general: 'Estrategias generales: leer todo antes de empezar, gestionar tiempo, revisar respuestas.'
    };

    const balancedCoverageInstruction = setCount > 1 ? `
⚠️ CRÍTICO: El estudiante estudió ${setCount} SETS diferentes:
${contentBySet?.map((s, i) => `  ${i + 1}. ${s.setName}`).join('\\n')}
Asegúrate de dar tips y errores comunes que cubran TODOS los sets, no solo uno.
` : '';

    const prompt = `
Genera TIPS PERFECTOS para que el estudiante NO cometa errores en su examen de mañana.
Tipo de materia: ${subjectType}

${balancedCoverageInstruction}
Contexto específico: ${tipsContext[subjectType]}

CONTENIDO DEL CURSO:
        ${allContent.slice(0, 40000)}

FLASHCARDS:
        ${flashcardContent.slice(0, 10000)}

GENERA:

        1. ERRORES COMUNES(${config.maxMistakes} errores):
        - mistake: El error específico que cometen los estudiantes
    - correction: La forma correcta
    - howToAvoid: Cómo asegurarse de no cometerlo
    - frequency: "very-common", "common", u "occasional"

2. ESTRATEGIAS DE EXAMEN(5 - 8):
        - strategy: La estrategia específica
    - whenToUse: Cuándo aplicarla

3. RECORDATORIOS DE ÚLTIMA HORA(8 - 12):
        - Cosas específicas del contenido que suelen olvidarse
    - Detalles cruciales
    - "No olvides que..."

4. GESTIÓN DEL TIEMPO(4 - 6):
        - Cómo distribuir el tiempo en el examen
    - Qué hacer si te atascas

5. MENSAJES DE CONFIANZA(3 - 5):
        - Recordatorios positivos para antes del examen
    - Por qué el estudiante está preparado

Sé MUY ESPECÍFICO al contenido del curso.No des consejos genéricos.
        Idioma: Español
        `;

    try {
        const result = await generateWithGemini(prompt, schema, 0.6);
        return JSON.parse(result);
    } catch (error) {
        console.error('Error generating tips:', error);
        return {
            commonMistakes: [],
            examStrategies: [],
            lastMinuteReminders: ['Revisa tus respuestas antes de entregar'],
            timeManagement: ['Distribuye tu tiempo entre todas las preguntas'],
            confidenceBoosters: ['Has estudiado, confía en ti']
        };
    }
}

// ============================================
// CONTENT CACHING
// ============================================

export async function savePhaseContent(
    sessionId: string,
    phase: PhaseNumber,
    phaseName: string,
    content: any
): Promise<void> {
    await supabase
        .from('ultra_review_content')
        .upsert({
            session_id: sessionId,
            phase,
            phase_name: phaseName,
            content,
            generated_at: new Date().toISOString()
        }, {
            onConflict: 'session_id,phase'
        });
}

export async function getPhaseContent(
    sessionId: string,
    phase: PhaseNumber
): Promise<any | null> {
    const { data } = await supabase
        .from('ultra_review_content')
        .select('content')
        .eq('session_id', sessionId)
        .eq('phase', phase)
        .single();

    return data?.content || null;
}

// ============================================
// MAIN GENERATION FUNCTION
// ============================================

export async function generatePhaseContent(
    sessionId: string,
    studySetIds: string | string[],
    phase: PhaseNumber,
    durationMode: DurationMode,
    subjectType?: SubjectType
): Promise<any> {
    // Check cache first
    const cached = await getPhaseContent(sessionId, phase);
    if (cached) return cached;

    // Get subject type if not provided
    let subject = subjectType;
    if (!subject) {
        const { data: session } = await supabase
            .from('ultra_review_sessions')
            .select('generated_content')
            .eq('id', sessionId)
            .single();

        subject = session?.generated_content?.subjectType || 'general';
    }

    let content: any;
    let phaseName: string;

    switch (phase) {
        case 1:
            phaseName = 'summary';
            content = await generateAdaptiveSummary(studySetIds, durationMode, subject);
            break;
        case 2:
            phaseName = 'phase2';
            content = await generateAdaptivePhase2(studySetIds, durationMode, subject);
            break;
        case 3:
            phaseName = 'methodologies';
            content = await generateAdaptiveMethodologies(studySetIds, durationMode, subject);
            break;
        case 4:
            phaseName = 'flashcards';
            content = await getFlashcardsForReview(studySetIds, durationMode);
            break;
        case 5:
            phaseName = 'exercises';
            content = await getExercisesForReview(studySetIds, durationMode, subject);
            break;
        case 6:
            phaseName = 'tips';
            content = await generateAdaptiveTips(studySetIds, durationMode, subject);
            break;
        default:
            throw new Error(`Invalid phase: ${phase}`);
    }

    // Cache the content
    await savePhaseContent(sessionId, phase, phaseName, content);

    return content;
}

// ============================================
// COMPLETION SUMMARY
// ============================================

export interface CompletionSummary {
    totalTime: string;
    phasesCompleted: number;
    conceptsReviewed: number;
    flashcardsReviewed: number;
    exercisesCompleted: number;
    subjectType: SubjectType;
    recommendations: string[];
}

export async function getCompletionSummary(sessionId: string): Promise<CompletionSummary> {
    const { data: session } = await supabase
        .from('ultra_review_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

    const { data: contents } = await supabase
        .from('ultra_review_content')
        .select('phase, content')
        .eq('session_id', sessionId);

    let conceptsReviewed = 0;
    let flashcardsReviewed = 0;
    let exercisesCompleted = 0;

    contents?.forEach(c => {
        if (c.phase === 1 && c.content?.totalConcepts) {
            conceptsReviewed = c.content.totalConcepts;
        }
        if (c.phase === 4 && c.content?.totalCount) {
            flashcardsReviewed = c.content.totalCount;
        }
        if (c.phase === 5 && c.content?.exercises) {
            exercisesCompleted = c.content.exercises.length;
        }
    });

    const totalSeconds = session?.total_time_seconds || 0;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    const subjectType = session?.generated_content?.subjectType || 'general';

    return {
        totalTime: `${minutes}: ${seconds.toString().padStart(2, '0')}`,
        phasesCompleted: 6,
        conceptsReviewed,
        flashcardsReviewed,
        exercisesCompleted,
        subjectType,
        recommendations: [
            'Descansa bien esta noche - el sueño consolida la memoria',
            'Mañana antes del examen, solo repasa la Fase 6 (Tips y Errores)',
            'Come bien y llega con tiempo al examen',
            '¡Has repasado TODO, confía en tu preparación!'
        ]
    };
}
