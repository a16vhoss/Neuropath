/**
 * ExerciseService.ts
 *
 * Comprehensive service for the adaptive exercise system:
 * - Classify content (study material vs exercises)
 * - Extract exercises from uploaded content
 * - Generate exercises from study material
 * - Create step-by-step explanations
 * - Generate similar exercises for practice
 * - Track exercise progress and adapt learning
 */

import { supabase } from './supabaseClient';
import { Type } from "@google/genai";
import { getGeminiSDK, getBestGeminiModel } from "./geminiModelManager";

// ============================================
// TYPES
// ============================================

export type ContentType = 'study_material' | 'exercises' | 'mixed';
export type ExerciseType = 'mathematical' | 'programming' | 'case_study' | 'conceptual' | 'practical' | 'general';

export interface ContentClassification {
    type: ContentType;
    confidence: number;
    reasoning: string;
    detectedTopics: string[];
    exerciseCount?: number;
}

export interface ExtractedExercise {
    problemStatement: string;
    solution?: string;
    stepByStepExplanation: string[];
    exerciseType: ExerciseType;
    difficulty: number;
    topic: string;
    subtopic?: string;
    variables?: Record<string, any>;
    relatedConcepts: string[];
}

export interface ExerciseTemplate {
    id: string;
    study_set_id: string;
    material_id?: string;
    problem_statement: string;
    solution?: string;
    step_by_step_explanation: string[];
    exercise_type: ExerciseType;
    difficulty: number;
    topic: string;
    subtopic?: string;
    related_concepts: string[];
    related_flashcard_ids: string[];
    variables?: Record<string, any>;
    generation_template?: string;
    times_practiced: number;
    avg_success_rate: number;
}

export interface GeneratedExercise {
    problem: string;
    solution: string;
    steps: string[];
    difficulty: number;
    basedOnTemplateId?: string;
}

export interface UserExerciseProgress {
    id: string;
    user_id: string;
    exercise_template_id: string;
    attempts: number;
    correct_attempts: number;
    mastery_level: number;
    next_review_at: string;
    avg_time_seconds: number;
}

export interface LearningStats {
    theoryMastery: number;
    exerciseMastery: number;
    recommendedExerciseRatio: number;
    weakTheoryTopics: string[];
    weakExerciseTypes: string[];
}

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
// CONTENT CLASSIFICATION
// ============================================

/**
 * Classify content to determine if it's study material, exercises, or mixed
 */
export async function classifyContent(text: string): Promise<ContentClassification> {
    const schema = {
        type: Type.OBJECT,
        properties: {
            type: { type: Type.STRING, enum: ['study_material', 'exercises', 'mixed'] },
            confidence: { type: Type.NUMBER },
            reasoning: { type: Type.STRING },
            detectedTopics: { type: Type.ARRAY, items: { type: Type.STRING } },
            exerciseCount: { type: Type.NUMBER }
        },
        required: ['type', 'confidence', 'reasoning', 'detectedTopics']
    };

    const prompt = `
Analiza el siguiente contenido y clasifícalo:

CONTENIDO:
"""
${text.substring(0, 8000)}
"""

Clasifica el contenido en una de estas categorías:
- "study_material": Material teórico, explicaciones, definiciones, conceptos (presentaciones, apuntes, libros)
- "exercises": Principalmente ejercicios, problemas, actividades para resolver (guías de ejercicios, exámenes)
- "mixed": Contiene tanto teoría como ejercicios mezclados

Analiza:
1. ¿Hay problemas numerados o ejercicios para resolver?
2. ¿Hay explicaciones teóricas extensas?
3. ¿Hay ejemplos resueltos?
4. ¿Qué porcentaje es teoría vs ejercicios?

Responde con:
- type: La clasificación
- confidence: 0.0 a 1.0 qué tan seguro estás
- reasoning: Breve explicación de por qué elegiste esa clasificación
- detectedTopics: Lista de temas/tópicos detectados
- exerciseCount: Número aproximado de ejercicios detectados (0 si es solo material)
`;

    try {
        const result = await generateWithGemini(prompt, schema, 0.3);
        return JSON.parse(result);
    } catch (error) {
        console.error('Error classifying content:', error);
        return {
            type: 'study_material',
            confidence: 0.5,
            reasoning: 'Error en clasificación, asumiendo material de estudio',
            detectedTopics: []
        };
    }
}

// ============================================
// EXERCISE EXTRACTION
// ============================================

/**
 * Extract individual exercises from content that contains exercises
 */
export async function extractExercises(
    text: string,
    topic: string
): Promise<ExtractedExercise[]> {
    const schema = {
        type: Type.ARRAY,
        items: {
            type: Type.OBJECT,
            properties: {
                problemStatement: { type: Type.STRING },
                solution: { type: Type.STRING },
                stepByStepExplanation: { type: Type.ARRAY, items: { type: Type.STRING } },
                exerciseType: {
                    type: Type.STRING,
                    enum: ['mathematical', 'programming', 'case_study', 'conceptual', 'practical', 'general']
                },
                difficulty: { type: Type.NUMBER },
                topic: { type: Type.STRING },
                subtopic: { type: Type.STRING },
                relatedConcepts: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ['problemStatement', 'exerciseType', 'difficulty', 'topic', 'relatedConcepts']
        }
    };

    const prompt = `
Extrae TODOS los ejercicios del siguiente contenido.
Para cada ejercicio, proporciona una explicación paso a paso de cómo resolverlo.

TEMA GENERAL: ${topic}

CONTENIDO:
"""
${text.substring(0, 12000)}
"""

Para CADA ejercicio encontrado, extrae:
1. problemStatement: El enunciado completo del ejercicio
2. solution: La solución si está disponible (puede estar vacío)
3. stepByStepExplanation: Array con los pasos para resolver (genera si no está explícito)
4. exerciseType: Tipo de ejercicio:
   - "mathematical": Cálculos, ecuaciones, álgebra, cálculo
   - "programming": Código, algoritmos, debugging
   - "case_study": Análisis de casos, situaciones
   - "conceptual": Preguntas teóricas, definiciones
   - "practical": Aplicación práctica, laboratorio
   - "general": Otros
5. difficulty: 1 (muy fácil) a 5 (muy difícil)
6. topic: Tema específico del ejercicio
7. subtopic: Subtema si aplica
8. relatedConcepts: Conceptos teóricos necesarios para resolver

IMPORTANTE:
- Si no hay solución explícita, genera una solución y explicación paso a paso.
- Extrae TODOS los ejercicios, no solo algunos.
- Cada paso de la explicación debe ser claro y didáctico.
`;

    try {
        const result = await generateWithGemini(prompt, schema, 0.4);
        return JSON.parse(result);
    } catch (error) {
        console.error('Error extracting exercises:', error);
        return [];
    }
}

// ============================================
// EXERCISE GENERATION FROM THEORY
// ============================================

/**
 * Generate exercises based on study material content
 * Used when user only uploads theory and needs practice exercises
 */
export async function generateExercisesFromTheory(
    text: string,
    topic: string,
    count: number = 5,
    existingFlashcards?: { question: string; answer: string }[]
): Promise<ExtractedExercise[]> {
    const schema = {
        type: Type.ARRAY,
        items: {
            type: Type.OBJECT,
            properties: {
                problemStatement: { type: Type.STRING },
                solution: { type: Type.STRING },
                stepByStepExplanation: { type: Type.ARRAY, items: { type: Type.STRING } },
                exerciseType: {
                    type: Type.STRING,
                    enum: ['mathematical', 'programming', 'case_study', 'conceptual', 'practical', 'general']
                },
                difficulty: { type: Type.NUMBER },
                topic: { type: Type.STRING },
                subtopic: { type: Type.STRING },
                relatedConcepts: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ['problemStatement', 'solution', 'stepByStepExplanation', 'exerciseType', 'difficulty', 'topic', 'relatedConcepts']
        }
    };

    const flashcardsContext = existingFlashcards
        ? `\n\nFLASHCARDS EXISTENTES (para contexto):\n${existingFlashcards.map(f => `Q: ${f.question}\nA: ${f.answer}`).join('\n\n')}`
        : '';

    const prompt = `
Basándote en el siguiente material de estudio, GENERA ${count} ejercicios prácticos para que el estudiante practique.

TEMA: ${topic}

MATERIAL DE ESTUDIO:
"""
${text.substring(0, 10000)}
"""
${flashcardsContext}

GENERA ${count} ejercicios que:
1. Apliquen los conceptos del material
2. Tengan dificultad variada (1-5)
3. Incluyan diferentes tipos según el contenido
4. Tengan solución completa y explicación paso a paso

Para cada ejercicio incluye:
- problemStatement: Enunciado claro y completo
- solution: Solución correcta
- stepByStepExplanation: Array con pasos detallados para resolver
- exerciseType: Tipo apropiado según el contenido
- difficulty: 1-5
- topic: Tema específico
- subtopic: Subtema si aplica
- relatedConcepts: Conceptos teóricos que se aplican

IMPORTANTE:
- Los ejercicios deben ser ORIGINALES, no copias del material
- Deben requerir APLICAR los conceptos, no solo recordarlos
- Varía los tipos de ejercicios según lo que permita el contenido
- Si es matemático, genera números diferentes
- Si es programación, genera escenarios diferentes
- Si es teórico, genera casos de análisis
`;

    try {
        const result = await generateWithGemini(prompt, schema, 0.8);
        return JSON.parse(result);
    } catch (error) {
        console.error('Error generating exercises from theory:', error);
        return [];
    }
}

// ============================================
// SIMILAR EXERCISE GENERATION
// ============================================

/**
 * Generate a similar exercise based on a template
 */
export async function generateSimilarExercise(
    template: ExerciseTemplate,
    difficulty?: number
): Promise<GeneratedExercise> {
    const schema = {
        type: Type.OBJECT,
        properties: {
            problem: { type: Type.STRING },
            solution: { type: Type.STRING },
            steps: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ['problem', 'solution', 'steps']
    };

    const targetDifficulty = difficulty || template.difficulty;

    const prompt = `
Genera un ejercicio SIMILAR pero DIFERENTE al siguiente ejercicio de ejemplo.

EJERCICIO ORIGINAL:
"""
${template.problem_statement}
"""

SOLUCIÓN ORIGINAL:
"""
${template.solution || 'No disponible'}
"""

TIPO: ${template.exercise_type}
TEMA: ${template.topic}
DIFICULTAD OBJETIVO: ${targetDifficulty}/5 ${targetDifficulty > template.difficulty ? '(más difícil que el original)' : targetDifficulty < template.difficulty ? '(más fácil que el original)' : '(similar al original)'}

GENERA un ejercicio que:
1. Sea del MISMO TIPO y TEMA
2. Tenga la dificultad indicada (${targetDifficulty}/5)
3. Use DIFERENTES datos/números/escenarios
4. Requiera los MISMOS conceptos pero aplicados diferente
5. Tenga solución completa y pasos claros

Responde con:
- problem: El nuevo enunciado
- solution: La solución correcta
- steps: Array de pasos para resolver
`;

    try {
        const result = await generateWithGemini(prompt, schema, 0.9);
        const parsed = JSON.parse(result);
        return {
            ...parsed,
            difficulty: targetDifficulty,
            basedOnTemplateId: template.id
        };
    } catch (error) {
        console.error('Error generating similar exercise:', error);
        throw error;
    }
}

// ============================================
// DATABASE OPERATIONS
// ============================================

/**
 * Save extracted exercises to database
 */
export async function saveExerciseTemplates(
    studySetId: string,
    materialId: string | undefined,
    exercises: ExtractedExercise[]
): Promise<ExerciseTemplate[]> {
    const templates = exercises.map(ex => ({
        study_set_id: studySetId,
        material_id: materialId || null,
        problem_statement: ex.problemStatement,
        solution: ex.solution || null,
        step_by_step_explanation: ex.stepByStepExplanation,
        exercise_type: ex.exerciseType,
        difficulty: ex.difficulty,
        topic: ex.topic,
        subtopic: ex.subtopic || null,
        related_concepts: ex.relatedConcepts,
        related_flashcard_ids: [],
        variables: ex.variables || {}
    }));

    const { data, error } = await supabase
        .from('exercise_templates')
        .insert(templates)
        .select();

    if (error) {
        console.error('Error saving exercise templates:', error);
        throw error;
    }

    return data || [];
}

/**
 * Get all exercises for a study set
 */
export async function getExercisesForStudySet(studySetId: string): Promise<ExerciseTemplate[]> {
    const { data, error } = await supabase
        .from('exercise_templates')
        .select('*')
        .eq('study_set_id', studySetId)
        .order('difficulty', { ascending: true });

    if (error) {
        console.error('Error fetching exercises:', error);
        return [];
    }

    return data || [];
}

/**
 * Get user's progress on exercises
 */
export async function getUserExerciseProgress(
    userId: string,
    studySetId: string
): Promise<Map<string, UserExerciseProgress>> {
    const { data: exercises } = await supabase
        .from('exercise_templates')
        .select('id')
        .eq('study_set_id', studySetId);

    if (!exercises || exercises.length === 0) return new Map();

    const exerciseIds = exercises.map(e => e.id);

    const { data: progress, error } = await supabase
        .from('user_exercise_progress')
        .select('*')
        .eq('user_id', userId)
        .in('exercise_template_id', exerciseIds);

    if (error) {
        console.error('Error fetching exercise progress:', error);
        return new Map();
    }

    const progressMap = new Map<string, UserExerciseProgress>();
    (progress || []).forEach(p => progressMap.set(p.exercise_template_id, p));

    return progressMap;
}

/**
 * Record an exercise attempt
 */
export async function recordExerciseAttempt(
    userId: string,
    exerciseTemplateId: string,
    isCorrect: boolean,
    timeSeconds: number
): Promise<void> {
    // Get or create progress record
    const { data: existing } = await supabase
        .from('user_exercise_progress')
        .select('*')
        .eq('user_id', userId)
        .eq('exercise_template_id', exerciseTemplateId)
        .single();

    if (existing) {
        // Update existing
        const newAttempts = existing.attempts + 1;
        const newCorrect = existing.correct_attempts + (isCorrect ? 1 : 0);
        const successRate = newCorrect / newAttempts;

        // Calculate new mastery level
        let newMastery = existing.mastery_level;
        if (isCorrect && successRate > 0.8) {
            newMastery = Math.min(5, existing.mastery_level + 1);
        } else if (!isCorrect && successRate < 0.5) {
            newMastery = Math.max(0, existing.mastery_level - 1);
        }

        // Calculate next review (simple SRS)
        const intervals = [0, 1, 3, 7, 14, 30]; // days
        const nextReview = new Date();
        nextReview.setDate(nextReview.getDate() + intervals[newMastery]);

        const { error } = await supabase
            .from('user_exercise_progress')
            .update({
                attempts: newAttempts,
                correct_attempts: newCorrect,
                last_attempt_at: new Date().toISOString(),
                last_correct_at: isCorrect ? new Date().toISOString() : existing.last_correct_at,
                mastery_level: newMastery,
                next_review_at: nextReview.toISOString(),
                avg_time_seconds: Math.round((existing.avg_time_seconds + timeSeconds) / 2)
            })
            .eq('id', existing.id);

        if (error) console.error('Error updating exercise progress:', error);
    } else {
        // Create new
        const { error } = await supabase
            .from('user_exercise_progress')
            .insert({
                user_id: userId,
                exercise_template_id: exerciseTemplateId,
                attempts: 1,
                correct_attempts: isCorrect ? 1 : 0,
                last_attempt_at: new Date().toISOString(),
                last_correct_at: isCorrect ? new Date().toISOString() : null,
                mastery_level: isCorrect ? 1 : 0,
                next_review_at: new Date().toISOString(),
                avg_time_seconds: timeSeconds
            });

        if (error) console.error('Error creating exercise progress:', error);
    }

    // Update template stats
    try {
        await supabase.rpc('increment_exercise_practice', {
            template_id: exerciseTemplateId,
            was_correct: isCorrect
        });
    } catch {
        // Fallback if RPC doesn't exist
        console.log('RPC not available, skipping template stats update');
    }
}

// ============================================
// LEARNING STATS & ADAPTIVE BALANCE
// ============================================

/**
 * Get or create learning stats for a user's study set
 */
export async function getLearningStats(
    userId: string,
    studySetId: string
): Promise<LearningStats> {
    const { data, error } = await supabase
        .from('study_set_learning_stats')
        .select('*')
        .eq('user_id', userId)
        .eq('study_set_id', studySetId)
        .single();

    if (data) {
        return {
            theoryMastery: data.theory_mastery_avg || 0,
            exerciseMastery: data.exercise_mastery_avg || 0,
            recommendedExerciseRatio: data.recommended_exercise_ratio || 50,
            weakTheoryTopics: data.weak_theory_topics || [],
            weakExerciseTypes: data.weak_exercise_types || []
        };
    }

    // Create default stats
    const { data: newStats } = await supabase
        .from('study_set_learning_stats')
        .insert({
            user_id: userId,
            study_set_id: studySetId
        })
        .select()
        .single();

    return {
        theoryMastery: 0,
        exerciseMastery: 0,
        recommendedExerciseRatio: 50,
        weakTheoryTopics: [],
        weakExerciseTypes: []
    };
}

/**
 * Update learning stats after a study session
 */
export async function updateLearningStats(
    userId: string,
    studySetId: string,
    theoryResults: { correct: number; total: number },
    exerciseResults: { correct: number; total: number }
): Promise<void> {
    const { data: current } = await supabase
        .from('study_set_learning_stats')
        .select('*')
        .eq('user_id', userId)
        .eq('study_set_id', studySetId)
        .single();

    const theoryRate = theoryResults.total > 0
        ? (theoryResults.correct / theoryResults.total) * 100
        : (current?.theory_mastery_avg || 50);

    const exerciseRate = exerciseResults.total > 0
        ? (exerciseResults.correct / exerciseResults.total) * 100
        : (current?.exercise_mastery_avg || 50);

    // Calculate recommended ratio based on weaknesses
    // If theory is weak, decrease exercise ratio (more theory)
    // If exercises are weak, increase exercise ratio (more practice)
    let recommendedRatio = 50;
    if (theoryRate < exerciseRate - 20) {
        recommendedRatio = 30; // More theory needed
    } else if (exerciseRate < theoryRate - 20) {
        recommendedRatio = 70; // More exercises needed
    }

    if (current) {
        await supabase
            .from('study_set_learning_stats')
            .update({
                theory_total_reviews: (current.theory_total_reviews || 0) + theoryResults.total,
                theory_correct_reviews: (current.theory_correct_reviews || 0) + theoryResults.correct,
                theory_mastery_avg: theoryRate,
                exercise_total_attempts: (current.exercise_total_attempts || 0) + exerciseResults.total,
                exercise_correct_attempts: (current.exercise_correct_attempts || 0) + exerciseResults.correct,
                exercise_mastery_avg: exerciseRate,
                recommended_exercise_ratio: recommendedRatio,
                last_updated: new Date().toISOString()
            })
            .eq('id', current.id);
    } else {
        await supabase
            .from('study_set_learning_stats')
            .insert({
                user_id: userId,
                study_set_id: studySetId,
                theory_total_reviews: theoryResults.total,
                theory_correct_reviews: theoryResults.correct,
                theory_mastery_avg: theoryRate,
                exercise_total_attempts: exerciseResults.total,
                exercise_correct_attempts: exerciseResults.correct,
                exercise_mastery_avg: exerciseRate,
                recommended_exercise_ratio: recommendedRatio
            });
    }
}

// ============================================
// COMPLETE CONTENT PROCESSING PIPELINE
// ============================================

/**
 * Process uploaded content - classify, extract/generate exercises, create flashcards
 */
export async function processUploadedContent(
    studySetId: string,
    materialId: string,
    text: string,
    materialName: string
): Promise<{
    contentType: ContentType;
    exercisesCreated: number;
    flashcardsCreated: number;
}> {
    // 1. Classify the content
    const classification = await classifyContent(text);

    // 2. Update material with content type
    await supabase
        .from('study_set_materials')
        .update({ content_type: classification.type })
        .eq('id', materialId);

    let exercisesCreated = 0;
    let flashcardsCreated = 0;

    // 3. Process based on type
    if (classification.type === 'exercises' || classification.type === 'mixed') {
        // Extract exercises
        const exercises = await extractExercises(text, materialName);
        if (exercises.length > 0) {
            await saveExerciseTemplates(studySetId, materialId, exercises);
            exercisesCreated = exercises.length;
        }
    }

    if (classification.type === 'study_material' || classification.type === 'mixed') {
        // Generate exercises from theory if none exist
        const { count: existingCount } = await supabase
            .from('exercise_templates')
            .select('*', { count: 'exact', head: true })
            .eq('study_set_id', studySetId);

        if ((existingCount || 0) < 5) {
            const generatedExercises = await generateExercisesFromTheory(
                text,
                materialName,
                5 - (existingCount || 0)
            );
            if (generatedExercises.length > 0) {
                await saveExerciseTemplates(studySetId, materialId, generatedExercises);
                exercisesCreated += generatedExercises.length;
            }
        }
    }

    return {
        contentType: classification.type,
        exercisesCreated,
        flashcardsCreated
    };
}

/**
 * Generate exercises for a study set that has only study material
 * Called manually or when user requests practice
 */
export async function generateExercisesForStudySet(
    studySetId: string,
    count: number = 10
): Promise<ExerciseTemplate[]> {
    // Get study set content
    const { data: materials } = await supabase
        .from('study_set_materials')
        .select('name, content_text')
        .eq('study_set_id', studySetId);

    const { data: flashcards } = await supabase
        .from('flashcards')
        .select('question, answer')
        .eq('study_set_id', studySetId)
        .limit(20);

    const { data: notebooks } = await supabase
        .from('notebooks')
        .select('title, content')
        .eq('study_set_id', studySetId);

    // Combine all content
    let combinedContent = '';
    let topic = '';

    if (materials && materials.length > 0) {
        combinedContent += materials.map(m => m.content_text || '').join('\n\n');
        topic = materials[0].name || 'General';
    }

    if (notebooks && notebooks.length > 0) {
        combinedContent += '\n\n' + notebooks.map(n => `${n.title}:\n${n.content || ''}`).join('\n\n');
    }

    if (!combinedContent.trim()) {
        // Use flashcards as base
        if (flashcards && flashcards.length > 0) {
            combinedContent = flashcards.map(f => `Concepto: ${f.question}\nRespuesta: ${f.answer}`).join('\n\n');
        } else {
            throw new Error('No hay contenido suficiente para generar ejercicios');
        }
    }

    // Generate exercises
    const exercises = await generateExercisesFromTheory(
        combinedContent,
        topic,
        count,
        flashcards || undefined
    );

    if (exercises.length === 0) {
        throw new Error('No se pudieron generar ejercicios');
    }

    // Save to database
    return await saveExerciseTemplates(studySetId, undefined, exercises);
}
