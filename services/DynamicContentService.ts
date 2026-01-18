/**
 * DynamicContentService.ts
 * 
 * Service for generating new study content dynamically based on
 * user progress and mastery levels. Uses AI to create progressively
 * harder questions from study set materials.
 */

import { supabase } from './supabaseClient';
import { generateStudySetFromContext, generateQuizQuestions } from './geminiService';

// ============================================
// TYPES
// ============================================

export type DifficultyTier = 1 | 2 | 3 | 4;
export type ContentType = 'flashcard' | 'quiz' | 'exam';

export interface GeneratedFlashcard {
    question: string;
    answer: string;
    category: string;
    difficulty_tier: DifficultyTier;
    parent_card_id?: string;
}

export interface GeneratedQuizQuestion {
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
    difficulty_tier: DifficultyTier;
}

export interface MasteryCheckResult {
    masteredCardIds: string[];
    currentTier: DifficultyTier;
    nextTier: DifficultyTier;
    shouldGenerateNew: boolean;
}

// ============================================
// DIFFICULTY TIER CONFIGURATION
// ============================================

const DIFFICULTY_TIERS: Record<DifficultyTier, {
    name: string;
    promptModifier: string;
    minMasteryLevel: number;
    minStabilityDays: number;
}> = {
    1: {
        name: 'Básico',
        promptModifier: 'Genera preguntas directas de memorización y definiciones. El estudiante debe recordar hechos básicos y conceptos fundamentales.',
        minMasteryLevel: 0,
        minStabilityDays: 0,
    },
    2: {
        name: 'Intermedio',
        promptModifier: 'Genera preguntas que requieren comprensión y conexión de conceptos. El estudiante debe explicar relaciones entre ideas y demostrar entendimiento.',
        minMasteryLevel: 2,
        minStabilityDays: 7,
    },
    3: {
        name: 'Avanzado',
        promptModifier: 'Genera preguntas de análisis, comparación y aplicación práctica. El estudiante debe resolver problemas y aplicar conocimiento a situaciones nuevas.',
        minMasteryLevel: 3,
        minStabilityDays: 21,
    },
    4: {
        name: 'Experto',
        promptModifier: 'Genera preguntas de síntesis, evaluación crítica y casos complejos. El estudiante debe integrar múltiples conceptos y hacer juicios fundamentados.',
        minMasteryLevel: 4,
        minStabilityDays: 30,
    },
};

// Mastery thresholds for archiving
const MASTERY_ARCHIVE_THRESHOLD = {
    masteryLevel: 4,
    stabilityDays: 30,
    consecutiveCorrect: 3,
};

// ============================================
// SOURCE MATERIAL EXTRACTION
// ============================================

/**
 * Get all source material text from a study set's materials
 */
export async function getSourceMaterial(studySetId: string): Promise<string> {
    const { data: materials, error } = await supabase
        .from('study_set_materials')
        .select('content_text, name, type')
        .eq('study_set_id', studySetId)
        .not('content_text', 'is', null);

    if (error || !materials || materials.length === 0) {
        console.error('Error fetching source materials:', error);
        return '';
    }

    // Combine all material texts
    const combinedText = materials
        .filter(m => m.content_text && m.content_text.length > 50)
        .map(m => `--- ${m.name} (${m.type}) ---\n${m.content_text}`)
        .join('\n\n');

    return combinedText;
}

/**
 * Get existing flashcards context to avoid duplicates
 */
async function getExistingCardsContext(studySetId: string): Promise<string> {
    const { data: flashcards, error } = await supabase
        .from('flashcards')
        .select('question, answer')
        .eq('study_set_id', studySetId)
        .limit(50);

    if (error || !flashcards) return '';

    return flashcards
        .map(f => `Q: ${f.question}\nA: ${f.answer}`)
        .join('\n---\n');
}

// ============================================
// CONTENT GENERATION
// ============================================

/**
 * Generate new flashcards at a specific difficulty tier
 */
export async function generateNewFlashcards(
    studySetId: string,
    userId: string,
    difficultyTier: DifficultyTier,
    count: number = 5,
    parentCardIds?: string[]
): Promise<GeneratedFlashcard[]> {
    const sourceMaterial = await getSourceMaterial(studySetId);

    if (!sourceMaterial || sourceMaterial.length < 100) {
        console.log('Insufficient source material for generation');
        return [];
    }

    const existingCards = await getExistingCardsContext(studySetId);
    const tierConfig = DIFFICULTY_TIERS[difficultyTier];

    // Build the enhanced prompt
    const enhancedPrompt = `
${tierConfig.promptModifier}

NIVEL DE DIFICULTAD: ${tierConfig.name} (Tier ${difficultyTier})

INSTRUCCIONES IMPORTANTES:
- Genera exactamente ${count} flashcards nuevas
- Las preguntas deben ser DIFERENTES a las existentes
- Usa SOLO información del material proporcionado
- No inventes información que no esté en el material

PREGUNTAS EXISTENTES (NO REPETIR):
${existingCards.slice(0, 2000)}

MATERIAL DE ESTUDIO:
${sourceMaterial.slice(0, 8000)}
`;

    try {
        // Use existing Gemini service (generateStudySetFromContext takes content and type)
        const flashcards = await generateStudySetFromContext(enhancedPrompt, 'text');

        if (!flashcards || flashcards.length === 0) {
            return [];
        }

        // Map to our interface with tier info
        const result: GeneratedFlashcard[] = flashcards.slice(0, count).map((fc: any, index: number) => ({
            question: fc.question,
            answer: fc.answer,
            category: fc.category || 'General',
            difficulty_tier: difficultyTier,
            parent_card_id: parentCardIds?.[index] || undefined,
        }));

        // Log generation
        await logGeneration(studySetId, userId, 'flashcard', difficultyTier, result.length, parentCardIds);

        return result;
    } catch (error) {
        console.error('Error generating flashcards:', error);
        return [];
    }
}

/**
 * Generate new quiz questions at a specific difficulty tier
 */
export async function generateNewQuizQuestions(
    studySetId: string,
    userId: string,
    difficultyTier: DifficultyTier,
    count: number = 5
): Promise<GeneratedQuizQuestion[]> {
    const sourceMaterial = await getSourceMaterial(studySetId);

    if (!sourceMaterial || sourceMaterial.length < 100) {
        return [];
    }

    const tierConfig = DIFFICULTY_TIERS[difficultyTier];

    const enhancedPrompt = `
${tierConfig.promptModifier}

NIVEL: ${tierConfig.name}

Genera ${count} preguntas de opción múltiple (4 opciones cada una) basándote ÚNICAMENTE en este material:

${sourceMaterial.slice(0, 8000)}
`;

    try {
        const questions = await generateQuizQuestions(enhancedPrompt);

        if (!questions || questions.length === 0) {
            return [];
        }

        const result: GeneratedQuizQuestion[] = questions.map((q: any) => ({
            question: q.question,
            options: q.options,
            correctIndex: q.correctIndex,
            explanation: q.explanation || '',
            difficulty_tier: difficultyTier,
        }));

        await logGeneration(studySetId, userId, 'quiz', difficultyTier, result.length);

        return result;
    } catch (error) {
        console.error('Error generating quiz questions:', error);
        return [];
    }
}

// ============================================
// DATABASE OPERATIONS
// ============================================

/**
 * Save generated flashcards to database
 */
export async function saveGeneratedFlashcards(
    studySetId: string,
    flashcards: GeneratedFlashcard[]
): Promise<string[]> {
    const insertData = flashcards.map(fc => ({
        study_set_id: studySetId,
        question: fc.question,
        answer: fc.answer,
        category: fc.category,
        difficulty_tier: fc.difficulty_tier,
        parent_card_id: fc.parent_card_id || null,
        difficulty: fc.difficulty_tier, // Also set legacy difficulty field
    }));

    const { data, error } = await supabase
        .from('flashcards')
        .insert(insertData)
        .select('id');

    if (error) {
        console.error('Error saving flashcards:', error);
        return [];
    }

    return data?.map(d => d.id) || [];
}

/**
 * Log content generation for tracking
 */
async function logGeneration(
    studySetId: string,
    userId: string,
    contentType: ContentType,
    difficultyTier: DifficultyTier,
    generatedCount: number,
    sourceCardIds?: string[]
): Promise<void> {
    await supabase.from('content_generation_log').insert({
        study_set_id: studySetId,
        user_id: userId,
        content_type: contentType,
        difficulty_tier: difficultyTier,
        generated_count: generatedCount,
        source_card_ids: sourceCardIds || [],
    });
}

// ============================================
// MASTERY CHECKING
// ============================================

/**
 * Check which cards are fully mastered and ready for archival
 */
export async function checkForMasteredCards(
    userId: string,
    studySetId: string
): Promise<MasteryCheckResult> {
    // Get all SRS data for this user's cards in this study set
    const { data: flashcards, error: fcError } = await supabase
        .from('flashcards')
        .select('id, difficulty_tier')
        .eq('study_set_id', studySetId);

    if (fcError || !flashcards) {
        return { masteredCardIds: [], currentTier: 1, nextTier: 1, shouldGenerateNew: false };
    }

    const flashcardIds = flashcards.map(f => f.id);

    const { data: srsData, error: srsError } = await supabase
        .from('flashcard_srs_data')
        .select('*')
        .eq('user_id', userId)
        .in('flashcard_id', flashcardIds)
        .eq('archived', false);

    if (srsError || !srsData) {
        return { masteredCardIds: [], currentTier: 1, nextTier: 1, shouldGenerateNew: false };
    }

    // Find cards that meet mastery threshold
    const masteredCardIds: string[] = [];

    for (const srs of srsData) {
        const meetsLevel = srs.mastery_level >= MASTERY_ARCHIVE_THRESHOLD.masteryLevel;
        const meetsStability = srs.stability >= MASTERY_ARCHIVE_THRESHOLD.stabilityDays;
        const meetsConsecutive = (srs.consecutive_correct || 0) >= MASTERY_ARCHIVE_THRESHOLD.consecutiveCorrect;

        if (meetsLevel && meetsStability && meetsConsecutive) {
            masteredCardIds.push(srs.flashcard_id);
        }
    }

    // Determine current tier based on mastered cards
    const masteredTiers = flashcards
        .filter(f => masteredCardIds.includes(f.id))
        .map(f => f.difficulty_tier || 1);

    const currentTier = Math.max(...masteredTiers, 1) as DifficultyTier;
    const nextTier = Math.min(currentTier + 1, 4) as DifficultyTier;

    // Should generate new content if:
    // 1. We have mastered cards to archive
    // 2. We're not already at max tier
    const shouldGenerateNew = masteredCardIds.length > 0 && currentTier < 4;

    return {
        masteredCardIds,
        currentTier,
        nextTier,
        shouldGenerateNew,
    };
}

/**
 * Archive mastered cards (they won't appear in future sessions)
 */
export async function archiveMasteredCards(
    userId: string,
    cardIds: string[]
): Promise<boolean> {
    if (cardIds.length === 0) return true;

    const { error } = await supabase
        .from('flashcard_srs_data')
        .update({
            archived: true,
            archived_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .in('flashcard_id', cardIds);

    if (error) {
        console.error('Error archiving cards:', error);
        return false;
    }

    return true;
}

/**
 * Update consecutive correct counter after a review
 */
export async function updateConsecutiveCorrect(
    userId: string,
    flashcardId: string,
    wasCorrect: boolean
): Promise<void> {
    if (wasCorrect) {
        // Increment counter
        const { data } = await supabase
            .from('flashcard_srs_data')
            .select('consecutive_correct')
            .eq('user_id', userId)
            .eq('flashcard_id', flashcardId)
            .single();

        const current = data?.consecutive_correct || 0;

        await supabase
            .from('flashcard_srs_data')
            .update({ consecutive_correct: current + 1 })
            .eq('user_id', userId)
            .eq('flashcard_id', flashcardId);
    } else {
        // Reset counter on incorrect
        await supabase
            .from('flashcard_srs_data')
            .update({ consecutive_correct: 0 })
            .eq('user_id', userId)
            .eq('flashcard_id', flashcardId);
    }
}

// ============================================
// SESSION COMPLETION FLOW
// ============================================

/**
 * Main function to call after a study session completes
 * Handles archival and new content generation
 */
export async function handleSessionComplete(
    userId: string,
    studySetId: string,
    sessionStats: { correctRate: number; cardsStudied: number }
): Promise<{
    archivedCount: number;
    newCardsGenerated: number;
    newTier: DifficultyTier | null;
}> {
    // Only proceed if session was successful (≥80% correct)
    if (sessionStats.correctRate < 0.8) {
        console.log('Session not successful enough for content generation');
        return { archivedCount: 0, newCardsGenerated: 0, newTier: null };
    }

    // Check for mastered cards
    const masteryResult = await checkForMasteredCards(userId, studySetId);

    if (!masteryResult.shouldGenerateNew || masteryResult.masteredCardIds.length === 0) {
        return { archivedCount: 0, newCardsGenerated: 0, newTier: null };
    }

    // Archive the mastered cards
    const archived = await archiveMasteredCards(userId, masteryResult.masteredCardIds);

    if (!archived) {
        return { archivedCount: 0, newCardsGenerated: 0, newTier: null };
    }

    // Generate new harder content
    const newFlashcards = await generateNewFlashcards(
        studySetId,
        userId,
        masteryResult.nextTier,
        masteryResult.masteredCardIds.length, // Generate same number as archived
        masteryResult.masteredCardIds
    );

    // Save the new flashcards
    const savedIds = await saveGeneratedFlashcards(studySetId, newFlashcards);

    return {
        archivedCount: masteryResult.masteredCardIds.length,
        newCardsGenerated: savedIds.length,
        newTier: masteryResult.nextTier,
    };
}

// ============================================
// EXPORTS
// ============================================

export {
    DIFFICULTY_TIERS,
    MASTERY_ARCHIVE_THRESHOLD,
};
