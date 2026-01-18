/**
 * AdaptiveLearningService.ts
 * 
 * Implementación del algoritmo FSRS (Free Spaced Repetition Scheduler)
 * basado en ciencia cognitiva para optimizar la retención a largo plazo.
 * 
 * Fundamentos científicos:
 * - Curva del olvido de Ebbinghaus
 * - Modelo de 3 componentes de memoria (Retrievability, Stability, Difficulty)
 * - Active Recall y Testing Effect
 * - Interleaving para mejor discriminación
 */

import { supabase } from './supabaseClient';

// ============================================
// TYPES
// ============================================

export type Rating = 1 | 2 | 3 | 4; // 1=Again, 2=Hard, 3=Good, 4=Easy
export type CardState = 'new' | 'learning' | 'review' | 'relearning';

export interface SRSCard {
    id: string;
    flashcard_id: string;
    user_id: string;
    stability: number;
    difficulty: number;
    retrievability: number;
    next_review_at: string;
    last_review_at: string | null;
    interval_days: number;
    reps: number;
    lapses: number;
    state: CardState;
    avg_response_time_ms: number;
    last_response_time_ms: number | null;
    mastery_level: number;
}

export interface FlashcardWithSRS {
    id: string;
    question: string;
    answer: string;
    category: string;
    difficulty?: number;
    srs?: SRSCard;
}

export interface StudySessionConfig {
    userId: string;
    studySetId?: string;
    classId?: string;
    mode: 'adaptive' | 'review_due' | 'learn_new' | 'cramming' | 'quiz' | 'exam';
    maxNewCards?: number;
    maxReviewCards?: number;
}

export interface SessionStats {
    cardsStudied: number;
    cardsCorrect: number;
    cardsAgain: number;
    avgResponseTimeMs: number;
    retentionRate: number;
    newCardsLearned: number;
    reviewsCompleted: number;
    xpEarned: number;
    streakBonus: number;
}

// ============================================
// FSRS ALGORITHM PARAMETERS
// ============================================

const FSRS_PARAMS = {
    // Initial stability for new cards (in days)
    INITIAL_STABILITY: 0.5,

    // Stability increase factor based on rating
    STABILITY_FACTORS: {
        1: 0.2,   // Again - significant decrease
        2: 0.8,   // Hard - slight decrease
        3: 1.0,   // Good - maintain/slight increase
        4: 1.3,   // Easy - significant increase
    },

    // Difficulty adjustment factors
    DIFFICULTY_DELTA: {
        1: 0.2,   // Again - increase difficulty
        2: 0.1,   // Hard - slight increase
        3: -0.05, // Good - slight decrease
        4: -0.15, // Easy - significant decrease
    },

    // Desired retention rate
    TARGET_RETENTION: 0.9,

    // Minimum and maximum intervals
    MIN_INTERVAL_MINUTES: 1,
    MAX_INTERVAL_DAYS: 60, // Max 2 months between reviews

    // Learning steps (in minutes)
    LEARNING_STEPS: [1, 10, 60, 1440], // 1min, 10min, 1hr, 1 day

    // Mastery thresholds
    MASTERY_THRESHOLDS: {
        1: 2,   // 2 successful reviews
        2: 5,   // 5 successful reviews  
        3: 10,  // 10 successful reviews with interval > 7 days
        4: 20,  // 20 successful reviews with interval > 21 days
        5: 30,  // 30 successful reviews with interval > 45 days
    }
};

// ============================================
// CORE FSRS CALCULATIONS
// ============================================

/**
 * Calculate retrievability (probability of recall) based on time elapsed
 * R(t) = e^(-t/S) where t = time elapsed, S = stability
 */
export function calculateRetrievability(
    stability: number,
    daysSinceLastReview: number
): number {
    if (daysSinceLastReview <= 0) return 1.0;
    const retrievability = Math.exp(-daysSinceLastReview / Math.max(stability, 0.1));
    return Math.max(0, Math.min(1, retrievability));
}

/**
 * Calculate new stability after a review
 * Based on current stability, difficulty, and user rating
 */
export function calculateNewStability(
    currentStability: number,
    difficulty: number,
    rating: Rating,
    retrievability: number
): number {
    const factor = FSRS_PARAMS.STABILITY_FACTORS[rating];

    // The "surprise" factor - how unexpected was this result?
    const successProbability = retrievability;
    const outcome = rating >= 3 ? 1 : 0;
    const surprise = Math.abs(outcome - successProbability);

    // New stability calculation
    let newStability: number;

    if (rating === 1) {
        // Again - reset to near initial
        newStability = FSRS_PARAMS.INITIAL_STABILITY * factor;
    } else {
        // Increase stability based on success
        const stabilityIncrease = (1 + (11 - difficulty * 10) * Math.pow(currentStability, -0.5)) * factor;
        newStability = currentStability * stabilityIncrease;

        // Bonus for successful recall when retrievability was low
        if (rating >= 3 && retrievability < 0.7) {
            newStability *= (1 + (1 - retrievability) * 0.5);
        }
    }

    // Clamp to reasonable range (max stability = max interval in days)
    return Math.max(0.1, Math.min(60, newStability));
}

/**
 * Calculate new difficulty based on performance
 */
export function calculateNewDifficulty(
    currentDifficulty: number,
    rating: Rating
): number {
    const delta = FSRS_PARAMS.DIFFICULTY_DELTA[rating];
    const newDifficulty = currentDifficulty + delta;

    // Clamp between 0.1 and 1.0
    return Math.max(0.1, Math.min(1.0, newDifficulty));
}

/**
 * Calculate next review interval in days
 */
export function calculateNextInterval(
    stability: number,
    state: CardState
): number {
    // For learning cards, use fixed steps
    if (state === 'learning' || state === 'relearning') {
        return FSRS_PARAMS.LEARNING_STEPS[0] / (60 * 24); // First step in days
    }

    // For review cards, interval based on stability and target retention
    // I = S * ln(R_target)^(-1)
    const interval = stability * Math.pow(-Math.log(FSRS_PARAMS.TARGET_RETENTION), -1);

    // Add some randomness to prevent "card clusters"
    const fuzz = 1 + (Math.random() - 0.5) * 0.1;

    return Math.max(
        FSRS_PARAMS.MIN_INTERVAL_MINUTES / (60 * 24),
        Math.min(FSRS_PARAMS.MAX_INTERVAL_DAYS, interval * fuzz)
    );
}

/**
 * Calculate mastery level based on reps and stability
 */
export function calculateMasteryLevel(
    reps: number,
    lapses: number,
    stability: number
): number {
    const successfulReps = reps - lapses * 2; // Lapses count against progress

    if (successfulReps >= FSRS_PARAMS.MASTERY_THRESHOLDS[5] && stability >= 45) return 5;
    if (successfulReps >= FSRS_PARAMS.MASTERY_THRESHOLDS[4] && stability >= 21) return 4;
    if (successfulReps >= FSRS_PARAMS.MASTERY_THRESHOLDS[3] && stability >= 7) return 3;
    if (successfulReps >= FSRS_PARAMS.MASTERY_THRESHOLDS[2]) return 2;
    if (successfulReps >= FSRS_PARAMS.MASTERY_THRESHOLDS[1]) return 1;
    return 0;
}

// ============================================
// DATABASE OPERATIONS
// ============================================

/**
 * Get or create SRS data for a flashcard
 */
export async function getOrCreateSRSData(
    userId: string,
    flashcardId: string
): Promise<SRSCard | null> {
    // Try to get existing SRS data
    const { data: existing, error: fetchError } = await supabase
        .from('flashcard_srs_data')
        .select('*')
        .eq('user_id', userId)
        .eq('flashcard_id', flashcardId)
        .single();

    if (existing) return existing as SRSCard;

    // Create new SRS data for this card
    const { data: newData, error: insertError } = await supabase
        .from('flashcard_srs_data')
        .insert({
            user_id: userId,
            flashcard_id: flashcardId,
            stability: FSRS_PARAMS.INITIAL_STABILITY,
            difficulty: 0.3,
            retrievability: 1.0,
            state: 'new',
            next_review_at: new Date().toISOString(),
        })
        .select()
        .single();

    if (insertError) {
        console.error('Error creating SRS data:', insertError);
        return null;
    }

    return newData as SRSCard;
}

/**
 * Update card after review with FSRS algorithm
 */
export async function updateCardAfterReview(
    userId: string,
    flashcardId: string,
    rating: Rating,
    responseTimeMs: number,
    sessionId?: string
): Promise<{ newInterval: number; newStability: number; masteryLevel: number } | null> {
    // Get current SRS data
    const srsData = await getOrCreateSRSData(userId, flashcardId);
    if (!srsData) return null;

    // Calculate time since last review
    const now = new Date();
    const lastReview = srsData.last_review_at ? new Date(srsData.last_review_at) : now;
    const daysSinceLastReview = (now.getTime() - lastReview.getTime()) / (1000 * 60 * 60 * 24);

    // Calculate current retrievability
    const currentRetrievability = calculateRetrievability(srsData.stability, daysSinceLastReview);

    // Calculate new values
    const newStability = calculateNewStability(
        srsData.stability,
        srsData.difficulty,
        rating,
        currentRetrievability
    );

    const newDifficulty = calculateNewDifficulty(srsData.difficulty, rating);

    // Determine new state
    let newState: CardState = srsData.state;
    let newReps = srsData.reps + 1;
    let newLapses = srsData.lapses;

    if (rating === 1) {
        // Failed - go to relearning
        newState = 'relearning';
        newLapses += 1;
    } else if (srsData.state === 'new' || srsData.state === 'learning') {
        // Success in learning - graduate to review
        if (rating >= 3) {
            newState = 'review';
        } else {
            newState = 'learning';
        }
    } else {
        // Continue in review state
        newState = 'review';
    }

    // Calculate next interval
    const nextIntervalDays = calculateNextInterval(newStability, newState);
    const nextReviewAt = new Date(now.getTime() + nextIntervalDays * 24 * 60 * 60 * 1000);

    // Calculate mastery level
    const masteryLevel = calculateMasteryLevel(newReps, newLapses, newStability);

    // Calculate average response time
    const newAvgResponseTime = srsData.avg_response_time_ms > 0
        ? Math.round((srsData.avg_response_time_ms + responseTimeMs) / 2)
        : responseTimeMs;

    // Update SRS data
    const { error: updateError } = await supabase
        .from('flashcard_srs_data')
        .update({
            stability: newStability,
            difficulty: newDifficulty,
            retrievability: 1.0, // Reset after review
            next_review_at: nextReviewAt.toISOString(),
            last_review_at: now.toISOString(),
            interval_days: nextIntervalDays,
            reps: newReps,
            lapses: newLapses,
            state: newState,
            avg_response_time_ms: newAvgResponseTime,
            last_response_time_ms: responseTimeMs,
            mastery_level: masteryLevel,
            updated_at: now.toISOString(),
        })
        .eq('id', srsData.id);

    if (updateError) {
        console.error('Error updating SRS data:', updateError);
        return null;
    }

    // Log the review
    await supabase.from('review_logs').insert({
        user_id: userId,
        flashcard_id: flashcardId,
        rating,
        response_time_ms: responseTimeMs,
        stability_before: srsData.stability,
        difficulty_before: srsData.difficulty,
        retrievability_at_review: currentRetrievability,
        stability_after: newStability,
        difficulty_after: newDifficulty,
        next_interval_days: nextIntervalDays,
        session_id: sessionId,
    });

    return {
        newInterval: nextIntervalDays,
        newStability: newStability,
        masteryLevel,
    };
}

/**
 * Get cards for a study session, prioritized by FSRS algorithm
 */
export async function getCardsForSession(
    config: StudySessionConfig
): Promise<FlashcardWithSRS[]> {
    const { userId, studySetId, classId, mode, maxNewCards = 10, maxReviewCards = 30 } = config;

    const now = new Date().toISOString();

    // First, get all flashcards for this study set or class
    let flashcardsQuery = supabase.from('flashcards').select('*');

    // Note: studySetId would need to be linked via study_set_materials
    // For now, we'll focus on class-based flashcards
    if (classId) {
        flashcardsQuery = flashcardsQuery.eq('class_id', classId);
    }

    const { data: flashcards, error: flashcardsError } = await flashcardsQuery;

    if (flashcardsError || !flashcards) {
        console.error('Error fetching flashcards:', flashcardsError);
        return [];
    }

    // Get SRS data for all these cards
    const flashcardIds = flashcards.map(f => f.id);

    const { data: srsDataList, error: srsError } = await supabase
        .from('flashcard_srs_data')
        .select('*')
        .eq('user_id', userId)
        .in('flashcard_id', flashcardIds)
        .eq('archived', false); // Exclude archived cards

    // Create a map for quick lookup
    const srsMap = new Map<string, SRSCard>();
    (srsDataList || []).forEach(srs => {
        srsMap.set(srs.flashcard_id, srs as SRSCard);
    });

    // Categorize cards
    const dueCards: FlashcardWithSRS[] = [];
    const learningCards: FlashcardWithSRS[] = [];
    const newCards: FlashcardWithSRS[] = [];

    for (const flashcard of flashcards) {
        const srs = srsMap.get(flashcard.id);
        const cardWithSRS: FlashcardWithSRS = {
            id: flashcard.id,
            question: flashcard.question,
            answer: flashcard.answer,
            category: flashcard.category || 'General',
            difficulty: flashcard.difficulty,
            srs: srs || undefined,
        };

        if (!srs) {
            // New card (no SRS data yet)
            newCards.push(cardWithSRS);
        } else {
            // Check if card is due
            const isDue = new Date(srs.next_review_at) <= new Date();

            // For quiz/exam: Don't include cards rated "easy" (mastery >= 3) that still have a long 
            // interval remaining - they should stay on their schedule. But DO include:
            // 1. Learning/relearning cards (mistakes)
            // 2. Due cards
            // 3. Cards that are close to being due (within 50% of their interval)
            // 4. Low mastery cards that need more practice

            if (mode === 'quiz' || mode === 'exam') {
                if (srs.state === 'learning' || srs.state === 'relearning') {
                    // Priority 1: Cards currently being learned/relearned (mistakes)
                    learningCards.push(cardWithSRS);
                } else if (isDue) {
                    // Priority 2: Due cards - definitely include
                    dueCards.push(cardWithSRS);
                } else {
                    // Check if card should be excluded (high mastery and far from due)
                    const daysUntilDue = (new Date(srs.next_review_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
                    const intervalDays = srs.interval_days || 1;
                    const closeTodue = daysUntilDue <= intervalDays * 0.5; // Within 50% of interval
                    const lowMastery = (srs.mastery_level || 0) < 3;

                    // Include if close to due OR low mastery (needs more practice)
                    if (closeTodue || lowMastery) {
                        dueCards.push(cardWithSRS);
                    }
                    // Otherwise, skip this card - it was rated easy and isn't due yet
                }
            } else if (mode === 'cramming' || isDue) {
                if (srs.state === 'learning' || srs.state === 'relearning') {
                    // Priority 1: Cards currently being learned/relearned (mistakes)
                    learningCards.push(cardWithSRS);
                } else {
                    // Priority 2: Due Review cards (or all reviews in cramming mode)
                    dueCards.push(cardWithSRS);
                }
            }
        }
    }

    // Sort appropriately
    // 1. Learning cards first (struggling items)
    learningCards.sort((a, b) => {
        // Sort by how forgotten they are (lower retrievability) or just random
        return (a.srs?.retrievability || 0) - (b.srs?.retrievability || 0);
    });

    // 2. New cards (generated higher difficulty content)
    // Randomize new cards to avoid predictable order
    newCards.sort(() => Math.random() - 0.5);

    // 3. Due cards
    // Sort by due date (most overdue first)
    dueCards.sort((a, b) => {
        const dateA = new Date(a.srs?.next_review_at || 0).getTime();
        const dateB = new Date(b.srs?.next_review_at || 0).getTime();
        return dateA - dateB;
    });

    let selectedCards: FlashcardWithSRS[] = [];

    // Final selection based on mode
    if (mode === 'quiz' || mode === 'exam') {
        const needed = maxReviewCards;

        // Take ALL learning cards (mistakes from previous sessions)
        selectedCards = [...learningCards];

        // Fill with NEW cards (new/advanced content generated)
        if (selectedCards.length < needed) {
            const spaceLeft = needed - selectedCards.length;
            selectedCards = [...selectedCards, ...newCards.slice(0, spaceLeft)];
        }

        // Fill remaining space with Due/Review cards
        // Ideally prioritizing ones that haven't been mastered yet, but here we just take available reviews
        if (selectedCards.length < needed) {
            const spaceLeft = needed - selectedCards.length;
            selectedCards = [...selectedCards, ...dueCards.slice(0, spaceLeft)];
        }
    } else if (mode === 'cramming') {
        // Mix all cards, prioritizing low mastery
        selectedCards = [...dueCards, ...learningCards, ...newCards]
            .sort((a, b) => (a.srs?.mastery_level || 0) - (b.srs?.mastery_level || 0))
            .slice(0, maxReviewCards + maxNewCards);

    } else if (mode === 'review_due') {
        selectedCards = dueCards.slice(0, maxReviewCards);

    } else if (mode === 'learn_new') {
        selectedCards = newCards.slice(0, maxNewCards);

    } else {
        // Default / Adaptive Mode
        // Priority: Due > Learning > New (limited)
        const reviewBatch = dueCards.slice(0, maxReviewCards);
        const learningBatch = learningCards;
        const newBatch = newCards.slice(0, maxNewCards);

        // Interleave for better learning
        selectedCards = interleaveCards([...reviewBatch, ...learningBatch], newBatch);
    }

    return selectedCards;
}

/**
 * Interleave review cards with new cards for optimal learning
 * New cards are inserted every few review cards
 */
function interleaveCards(
    reviewCards: FlashcardWithSRS[],
    newCards: FlashcardWithSRS[]
): FlashcardWithSRS[] {
    if (newCards.length === 0) return reviewCards;
    if (reviewCards.length === 0) return newCards;

    const result: FlashcardWithSRS[] = [];
    const insertInterval = Math.max(3, Math.floor(reviewCards.length / newCards.length));

    let newIndex = 0;

    for (let i = 0; i < reviewCards.length; i++) {
        result.push(reviewCards[i]);

        // Insert a new card every `insertInterval` cards
        if ((i + 1) % insertInterval === 0 && newIndex < newCards.length) {
            result.push(newCards[newIndex]);
            newIndex++;
        }
    }

    // Add remaining new cards at the end
    while (newIndex < newCards.length) {
        result.push(newCards[newIndex]);
        newIndex++;
    }

    return result;
}

/**
 * Get user's study statistics
 */
export async function getUserStudyStats(userId: string): Promise<{
    dueToday: number;
    learningCount: number;
    newCount: number;
    masteredCount: number;
    avgRetention: number;
    streakDays: number;
}> {
    const now = new Date().toISOString();

    // Get all SRS data for user
    const { data: srsData, error } = await supabase
        .from('flashcard_srs_data')
        .select('*')
        .eq('user_id', userId);

    if (error || !srsData) {
        return {
            dueToday: 0,
            learningCount: 0,
            newCount: 0,
            masteredCount: 0,
            avgRetention: 0,
            streakDays: 0,
        };
    }

    let dueToday = 0;
    let learningCount = 0;
    let masteredCount = 0;
    let totalRetrievability = 0;

    for (const card of srsData) {
        // Count due cards
        if (new Date(card.next_review_at) <= new Date()) {
            dueToday++;
        }

        // Count learning cards
        if (card.state === 'learning' || card.state === 'relearning') {
            learningCount++;
        }

        // Count mastered cards
        if (card.mastery_level >= 4) {
            masteredCount++;
        }

        // Calculate current retrievability
        const daysSinceReview = card.last_review_at
            ? (new Date().getTime() - new Date(card.last_review_at).getTime()) / (1000 * 60 * 60 * 24)
            : 0;
        totalRetrievability += calculateRetrievability(card.stability, daysSinceReview);
    }

    const avgRetention = srsData.length > 0 ? (totalRetrievability / srsData.length) * 100 : 0;

    // Get streak from profile
    const { data: profile } = await supabase
        .from('profiles')
        .select('streak_days')
        .eq('id', userId)
        .single();

    return {
        dueToday,
        learningCount,
        newCount: 0, // Would need to count cards without SRS data
        masteredCount,
        avgRetention: Math.round(avgRetention),
        streakDays: profile?.streak_days || 0,
    };
}

/**
 * Create a new adaptive study session
 */
export async function createAdaptiveSession(
    userId: string,
    config: Omit<StudySessionConfig, 'userId'>
): Promise<string | null> {
    const { data, error } = await supabase
        .from('adaptive_study_sessions')
        .insert({
            user_id: userId,
            study_set_id: config.studySetId,
            class_id: config.classId,
            mode: config.mode,
            target_cards: (config.maxNewCards || 10) + (config.maxReviewCards || 30),
        })
        .select('id')
        .single();

    if (error) {
        console.error('Error creating session:', error);
        return null;
    }

    return data.id;
}

/**
 * End an adaptive study session and calculate rewards
 */
export async function endAdaptiveSession(
    sessionId: string,
    stats: SessionStats
): Promise<void> {
    const now = new Date();

    await supabase
        .from('adaptive_study_sessions')
        .update({
            ended_at: now.toISOString(),
            cards_studied: stats.cardsStudied,
            cards_correct: stats.cardsCorrect,
            cards_again: stats.cardsAgain,
            avg_response_time_ms: stats.avgResponseTimeMs,
            retention_rate: stats.retentionRate,
            new_cards_learned: stats.newCardsLearned,
            reviews_completed: stats.reviewsCompleted,
            xp_earned: stats.xpEarned,
            streak_bonus: stats.streakBonus,
        })
        .eq('id', sessionId);
}

// ============================================
// XP CALCULATION HELPERS
// ============================================

/**
 * Calculate XP for a single card response
 */
export function calculateCardXP(
    rating: Rating,
    responseTimeMs: number,
    currentStreak: number
): { baseXP: number; speedBonus: number; streakBonus: number } {
    // Base XP based on rating
    const baseXP = rating === 1 ? 0 : rating === 2 ? 5 : rating === 3 ? 10 : 15;

    // Speed bonus for fast correct answers (< 3 seconds)
    const speedBonus = rating >= 3 && responseTimeMs < 3000 ? 5 : 0;

    // Streak bonus every 5 correct answers
    let streakBonus = 0;
    if (rating >= 3 && currentStreak > 0 && currentStreak % 5 === 0) {
        streakBonus = currentStreak >= 10 ? 50 : 25;
    }

    return { baseXP, speedBonus, streakBonus };
}

/**
 * Get label for rating
 */
export function getRatingLabel(rating: Rating): string {
    switch (rating) {
        case 1: return 'Olvidé';
        case 2: return 'Difícil';
        case 3: return 'Bien';
        case 4: return 'Fácil';
    }
}

/**
 * Get color for rating button
 */
export function getRatingColor(rating: Rating): string {
    switch (rating) {
        case 1: return 'bg-red-500 hover:bg-red-600';
        case 2: return 'bg-orange-500 hover:bg-orange-600';
        case 3: return 'bg-emerald-500 hover:bg-emerald-600';
        case 4: return 'bg-blue-500 hover:bg-blue-600';
    }
}

/**
 * Format interval for display
 */
export function formatInterval(days: number): string {
    if (days < 1 / 24) {
        return `${Math.round(days * 24 * 60)} min`;
    } else if (days < 1) {
        return `${Math.round(days * 24)} horas`;
    } else if (days < 30) {
        return `${Math.round(days)} días`;
    } else if (days < 365) {
        return `${Math.round(days / 30)} meses`;
    } else {
        return `${(days / 365).toFixed(1)} años`;
    }
}
