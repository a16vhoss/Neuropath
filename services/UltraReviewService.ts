/**
 * UltraReviewService.ts
 *
 * Comprehensive review service for last-day-before-exam studying.
 * Generates and manages content for 6 phases:
 * 1. Key Concepts Summary
 * 2. Formula Cheat Sheet
 * 3. Methodologies (How to solve problems)
 * 4. Priority Flashcards
 * 5. Practice Exercises
 * 6. Tips & Common Mistakes
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

export interface UltraReviewSession {
    id: string;
    user_id: string;
    study_set_id: string;
    duration_mode: DurationMode;
    current_phase: PhaseNumber;
    phase_progress: Record<string, { completed: boolean; time_spent: number }>;
    status: SessionStatus;
    started_at: string;
    completed_at?: string;
    last_activity_at: string;
    total_time_seconds: number;
}

export interface PhaseContent {
    phase: PhaseNumber;
    phase_name: string;
    content: any;
    generated_at: string;
}

// Phase-specific content types
export interface SummaryContent {
    title: string;
    sections: {
        topic: string;
        keyPoints: string[];
        importance: 'critical' | 'important' | 'helpful';
    }[];
    totalConcepts: number;
}

export interface FormulaContent {
    categories: {
        name: string;
        formulas: {
            name: string;
            formula: string;
            description: string;
            whenToUse?: string;
        }[];
    }[];
}

export interface MethodologyContent {
    methodologies: {
        problemType: string;
        steps: string[];
        tips: string[];
        example?: string;
    }[];
}

export interface FlashcardReviewContent {
    flashcards: {
        id: string;
        question: string;
        answer: string;
        category: string;
    }[];
    totalCount: number;
}

export interface ExerciseContent {
    exercises: {
        id: string;
        problem: string;
        solution: string;
        steps: string[];
        topic: string;
        difficulty: number;
    }[];
}

export interface TipsContent {
    commonMistakes: {
        mistake: string;
        correction: string;
        howToAvoid: string;
    }[];
    examTips: string[];
    lastMinuteReminders: string[];
}

// Duration configuration
const DURATION_CONFIG = {
    express: {
        summaryMaxSections: 5,
        maxFormulas: 10,
        maxMethodologies: 5,
        maxFlashcards: 20,
        maxExercises: 2,
        maxMistakes: 3
    },
    normal: {
        summaryMaxSections: 10,
        maxFormulas: 20,
        maxMethodologies: 10,
        maxFlashcards: 40,
        maxExercises: 4,
        maxMistakes: 5
    },
    complete: {
        summaryMaxSections: 999, // All
        maxFormulas: 999,
        maxMethodologies: 999,
        maxFlashcards: 999,
        maxExercises: 8,
        maxMistakes: 10
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
// SESSION MANAGEMENT
// ============================================

/**
 * Get or create an ultra review session
 */
export async function getOrCreateSession(
    userId: string,
    studySetId: string,
    durationMode: DurationMode = 'normal'
): Promise<UltraReviewSession> {
    // Check for existing in-progress session
    const { data: existing } = await supabase
        .from('ultra_review_sessions')
        .select('*')
        .eq('user_id', userId)
        .eq('study_set_id', studySetId)
        .eq('status', 'in_progress')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (existing) {
        return existing;
    }

    // Create new session
    const { data: newSession, error } = await supabase
        .from('ultra_review_sessions')
        .insert({
            user_id: userId,
            study_set_id: studySetId,
            duration_mode: durationMode,
            current_phase: 1,
            phase_progress: {},
            status: 'in_progress'
        })
        .select()
        .single();

    if (error) throw error;
    return newSession;
}

/**
 * Start a fresh session (abandons any existing one)
 */
export async function startFreshSession(
    userId: string,
    studySetId: string,
    durationMode: DurationMode
): Promise<UltraReviewSession> {
    // Mark existing sessions as abandoned
    await supabase
        .from('ultra_review_sessions')
        .update({ status: 'abandoned' })
        .eq('user_id', userId)
        .eq('study_set_id', studySetId)
        .eq('status', 'in_progress');

    // Create new session
    const { data: newSession, error } = await supabase
        .from('ultra_review_sessions')
        .insert({
            user_id: userId,
            study_set_id: studySetId,
            duration_mode: durationMode,
            current_phase: 1,
            phase_progress: {},
            status: 'in_progress'
        })
        .select()
        .single();

    if (error) throw error;
    return newSession;
}

/**
 * Update session progress
 */
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

/**
 * Complete a session
 */
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
// CONTENT FETCHING (From Study Set)
// ============================================

async function getStudySetContent(studySetId: string) {
    // Fetch all content in parallel
    const [materials, notebooks, flashcards, exercises] = await Promise.all([
        supabase
            .from('study_set_materials')
            .select('name, content_text, summary')
            .eq('study_set_id', studySetId),
        supabase
            .from('notebooks')
            .select('title, content, last_saved_content')
            .eq('study_set_id', studySetId),
        supabase
            .from('flashcards')
            .select('id, question, answer, category')
            .eq('study_set_id', studySetId),
        supabase
            .from('exercise_templates')
            .select('id, problem_statement, solution, step_by_step_explanation, exercise_type, topic, difficulty')
            .eq('study_set_id', studySetId)
    ]);

    // Extract text from HTML
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

    // Combine all text content
    let allContent = '';

    if (materials.data) {
        materials.data.forEach(m => {
            allContent += `\n\n--- Material: ${m.name} ---\n`;
            if (m.content_text) allContent += m.content_text;
            if (m.summary) allContent += `\nResumen: ${m.summary}`;
        });
    }

    if (notebooks.data) {
        notebooks.data.forEach(n => {
            const text = extractTextFromHtml(n.content || n.last_saved_content || '');
            if (text) {
                allContent += `\n\n--- Cuaderno: ${n.title} ---\n${text}`;
            }
        });
    }

    // Flashcard content
    let flashcardContent = '';
    if (flashcards.data && flashcards.data.length > 0) {
        flashcardContent = flashcards.data
            .map(f => `P: ${f.question}\nR: ${f.answer}`)
            .join('\n\n');
    }

    return {
        allContent: allContent.slice(0, 80000), // Limit for API
        flashcards: flashcards.data || [],
        exercises: exercises.data || [],
        flashcardContent
    };
}

// ============================================
// PHASE 1: KEY CONCEPTS SUMMARY
// ============================================

export async function generateSummaryContent(
    studySetId: string,
    durationMode: DurationMode
): Promise<SummaryContent> {
    const config = DURATION_CONFIG[durationMode];
    const { allContent, flashcardContent } = await getStudySetContent(studySetId);

    const schema = {
        type: Type.OBJECT,
        properties: {
            title: { type: Type.STRING },
            sections: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        topic: { type: Type.STRING },
                        keyPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
                        importance: { type: Type.STRING, enum: ['critical', 'important', 'helpful'] }
                    },
                    required: ['topic', 'keyPoints', 'importance']
                }
            },
            totalConcepts: { type: Type.NUMBER }
        },
        required: ['title', 'sections', 'totalConcepts']
    };

    const prompt = `
Eres un experto preparando a un estudiante para su examen MAÑANA.
Genera un RESUMEN PERFECTO de los conceptos clave que DEBE saber.

MATERIAL DEL ESTUDIANTE:
${allContent}

FLASHCARDS EXISTENTES:
${flashcardContent}

INSTRUCCIONES:
1. Identifica TODOS los conceptos clave del material
2. Organízalos por temas
3. Para cada tema, lista los puntos clave de forma CONCISA pero COMPLETA
4. Marca la importancia: "critical" (sale seguro en el examen), "important" (muy probable), "helpful" (complementario)
5. Máximo ${config.summaryMaxSections} secciones
6. Cada punto clave debe ser memorizable en segundos

PRIORIZA:
- Definiciones fundamentales
- Conceptos que conectan otros temas
- Cosas que suelen preguntarse en exámenes

Idioma: Español
`;

    try {
        const result = await generateWithGemini(prompt, schema, 0.4);
        return JSON.parse(result);
    } catch (error) {
        console.error('Error generating summary:', error);
        return {
            title: 'Resumen de Conceptos',
            sections: [],
            totalConcepts: 0
        };
    }
}

// ============================================
// PHASE 2: FORMULA CHEAT SHEET
// ============================================

export async function generateFormulaContent(
    studySetId: string,
    durationMode: DurationMode
): Promise<FormulaContent> {
    const config = DURATION_CONFIG[durationMode];
    const { allContent, flashcardContent } = await getStudySetContent(studySetId);

    const schema = {
        type: Type.OBJECT,
        properties: {
            categories: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        name: { type: Type.STRING },
                        formulas: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    name: { type: Type.STRING },
                                    formula: { type: Type.STRING },
                                    description: { type: Type.STRING },
                                    whenToUse: { type: Type.STRING }
                                },
                                required: ['name', 'formula', 'description']
                            }
                        }
                    },
                    required: ['name', 'formulas']
                }
            }
        },
        required: ['categories']
    };

    const prompt = `
Extrae TODAS las fórmulas, ecuaciones y expresiones matemáticas/científicas del siguiente material.
Si no hay fórmulas matemáticas, extrae reglas, leyes o principios que funcionen como "fórmulas conceptuales".

MATERIAL:
${allContent}

FLASHCARDS:
${flashcardContent}

INSTRUCCIONES:
1. Agrupa las fórmulas por categoría/tema
2. Para cada fórmula incluye:
   - Nombre descriptivo
   - La fórmula exacta (usa notación clara)
   - Descripción breve de qué calcula/representa
   - Cuándo usarla (opcional pero muy útil)
3. Máximo ${config.maxFormulas} fórmulas en total
4. Prioriza las más importantes para un examen

Si el material no tiene fórmulas matemáticas, incluye:
- Definiciones clave (formato: "X = definición")
- Relaciones importantes (formato: "Si A entonces B")
- Reglas fundamentales

Idioma: Español
`;

    try {
        const result = await generateWithGemini(prompt, schema, 0.3);
        return JSON.parse(result);
    } catch (error) {
        console.error('Error generating formulas:', error);
        return { categories: [] };
    }
}

// ============================================
// PHASE 3: METHODOLOGIES
// ============================================

export async function generateMethodologyContent(
    studySetId: string,
    durationMode: DurationMode
): Promise<MethodologyContent> {
    const config = DURATION_CONFIG[durationMode];
    const { allContent, exercises } = await getStudySetContent(studySetId);

    // Include exercise methodologies
    const exerciseMethodologies = exercises
        .filter(e => e.step_by_step_explanation && e.step_by_step_explanation.length > 0)
        .slice(0, 10)
        .map(e => `Tipo: ${e.exercise_type}\nProblema: ${e.problem_statement}\nPasos: ${JSON.stringify(e.step_by_step_explanation)}`)
        .join('\n\n');

    const schema = {
        type: Type.OBJECT,
        properties: {
            methodologies: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        problemType: { type: Type.STRING },
                        steps: { type: Type.ARRAY, items: { type: Type.STRING } },
                        tips: { type: Type.ARRAY, items: { type: Type.STRING } },
                        example: { type: Type.STRING }
                    },
                    required: ['problemType', 'steps', 'tips']
                }
            }
        },
        required: ['methodologies']
    };

    const prompt = `
Genera una guía de METODOLOGÍAS: cómo resolver cada TIPO de problema que puede aparecer en el examen.

MATERIAL DEL CURSO:
${allContent.slice(0, 40000)}

EJERCICIOS DE EJEMPLO:
${exerciseMethodologies}

INSTRUCCIONES:
1. Identifica los TIPOS de problemas que el estudiante debe saber resolver
2. Para cada tipo, proporciona:
   - Nombre descriptivo del tipo de problema
   - Pasos CLAROS y ORDENADOS para resolverlo
   - Tips para no equivocarse
   - Un ejemplo breve (opcional)
3. Genera máximo ${config.maxMethodologies} metodologías
4. Los pasos deben ser lo suficientemente específicos para seguirlos sin pensar

EJEMPLO DE FORMATO:
- Tipo: "Resolver ecuación cuadrática"
- Pasos: ["1. Identificar a, b, c", "2. Calcular discriminante", "3. Aplicar fórmula", "4. Simplificar"]
- Tips: ["Cuidado con el signo de b", "Si discriminante < 0, no hay solución real"]

Idioma: Español
`;

    try {
        const result = await generateWithGemini(prompt, schema, 0.5);
        return JSON.parse(result);
    } catch (error) {
        console.error('Error generating methodologies:', error);
        return { methodologies: [] };
    }
}

// ============================================
// PHASE 4: FLASHCARDS REVIEW
// ============================================

export async function getFlashcardsForReview(
    studySetId: string,
    durationMode: DurationMode
): Promise<FlashcardReviewContent> {
    const config = DURATION_CONFIG[durationMode];

    const { data: flashcards } = await supabase
        .from('flashcards')
        .select('id, question, answer, category')
        .eq('study_set_id', studySetId)
        .limit(config.maxFlashcards);

    return {
        flashcards: flashcards || [],
        totalCount: flashcards?.length || 0
    };
}

// ============================================
// PHASE 5: PRACTICE EXERCISES
// ============================================

export async function getExercisesForReview(
    studySetId: string,
    durationMode: DurationMode
): Promise<ExerciseContent> {
    const config = DURATION_CONFIG[durationMode];

    const { data: exercises } = await supabase
        .from('exercise_templates')
        .select('id, problem_statement, solution, step_by_step_explanation, topic, difficulty')
        .eq('study_set_id', studySetId)
        .order('difficulty', { ascending: true })
        .limit(config.maxExercises);

    return {
        exercises: (exercises || []).map(e => ({
            id: e.id,
            problem: e.problem_statement,
            solution: e.solution || '',
            steps: e.step_by_step_explanation || [],
            topic: e.topic || 'General',
            difficulty: e.difficulty
        }))
    };
}

// ============================================
// PHASE 6: TIPS & COMMON MISTAKES
// ============================================

export async function generateTipsContent(
    studySetId: string,
    durationMode: DurationMode
): Promise<TipsContent> {
    const config = DURATION_CONFIG[durationMode];
    const { allContent, flashcardContent } = await getStudySetContent(studySetId);

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
                        howToAvoid: { type: Type.STRING }
                    },
                    required: ['mistake', 'correction', 'howToAvoid']
                }
            },
            examTips: { type: Type.ARRAY, items: { type: Type.STRING } },
            lastMinuteReminders: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ['commonMistakes', 'examTips', 'lastMinuteReminders']
    };

    const prompt = `
Eres un profesor experimentado que ha visto a miles de estudiantes cometer errores en exámenes.
Genera consejos CRÍTICOS para un estudiante que tiene su examen MAÑANA.

CONTENIDO DEL CURSO:
${allContent.slice(0, 40000)}

FLASHCARDS:
${flashcardContent.slice(0, 10000)}

GENERA:

1. ERRORES COMUNES (máximo ${config.maxMistakes}):
   - Error típico que cometen los estudiantes
   - La corrección correcta
   - Cómo evitarlo

2. TIPS PARA EL EXAMEN (5-8):
   - Consejos prácticos para el día del examen
   - Estrategias de tiempo
   - Cómo abordar preguntas difíciles

3. RECORDATORIOS DE ÚLTIMA HORA (5-10):
   - Cosas que SIEMPRE se olvidan
   - Detalles cruciales
   - "No olvides que..."

Sé ESPECÍFICO al contenido del curso, no des consejos genéricos.
Idioma: Español
`;

    try {
        const result = await generateWithGemini(prompt, schema, 0.6);
        return JSON.parse(result);
    } catch (error) {
        console.error('Error generating tips:', error);
        return {
            commonMistakes: [],
            examTips: ['Lee todas las preguntas antes de empezar', 'Administra tu tiempo'],
            lastMinuteReminders: ['Revisa tus respuestas antes de entregar']
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
    studySetId: string,
    phase: PhaseNumber,
    durationMode: DurationMode
): Promise<any> {
    // Check cache first
    const cached = await getPhaseContent(sessionId, phase);
    if (cached) return cached;

    // Generate based on phase
    let content: any;
    let phaseName: string;

    switch (phase) {
        case 1:
            phaseName = 'summary';
            content = await generateSummaryContent(studySetId, durationMode);
            break;
        case 2:
            phaseName = 'formulas';
            content = await generateFormulaContent(studySetId, durationMode);
            break;
        case 3:
            phaseName = 'methodologies';
            content = await generateMethodologyContent(studySetId, durationMode);
            break;
        case 4:
            phaseName = 'flashcards';
            content = await getFlashcardsForReview(studySetId, durationMode);
            break;
        case 5:
            phaseName = 'exercises';
            content = await getExercisesForReview(studySetId, durationMode);
            break;
        case 6:
            phaseName = 'tips';
            content = await generateTipsContent(studySetId, durationMode);
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

    return {
        totalTime: `${minutes}:${seconds.toString().padStart(2, '0')}`,
        phasesCompleted: 6,
        conceptsReviewed,
        flashcardsReviewed,
        exercisesCompleted,
        recommendations: [
            'Descansa bien esta noche - el sueño consolida la memoria',
            'Mañana antes del examen, solo repasa los Tips y Errores Comunes',
            '¡Confía en tu preparación, lo vas a hacer genial!'
        ]
    };
}
