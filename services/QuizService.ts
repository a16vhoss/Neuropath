/**
 * QuizService.ts
 * 
 * Service for adaptive quiz generation and result tracking.
 * Features:
 * - Generate quiz questions based on study set content
 * - Track quiz performance and weak topics
 * - Generate next quiz prioritizing weak areas
 */

import { supabase } from './supabaseClient';
import { generateQuizQuestions } from './geminiService';

export type QuestionType = 'true_false' | 'multiple_choice' | 'analysis' | 'design' | 'practical';

export interface QuizQuestion {
    id: string;
    question: string;
    type: QuestionType;  // Type of question based on difficulty
    options: string[];
    correctIndex: number;
    explanation?: string;
    topic?: string;
    scenario?: string;       // For analysis questions - provides context/case
    designPrompt?: string;   // For design questions - what to design/solve
    evaluationCriteria?: string[]; // For design questions - rubric for AI evaluation
    realWorldExample?: string;  // For practical questions - real-world application example
}

export interface QuizResult {
    questionIndex: number;
    question: string;
    userAnswerIndex: number;
    correctAnswerIndex: number;
    isCorrect: boolean;
    topic?: string;
    textAnswer?: string;
}

export interface QuizSession {
    id: string;
    userId: string;
    studySetId: string;
    score: number;
    totalQuestions: number;
    percentCorrect: number;
    durationSeconds?: number;
    weakTopics: string[];
    completedAt: string;
}

export interface QuizReport {
    session: QuizSession;
    results: QuizResult[];
    correctQuestions: QuizResult[];
    incorrectQuestions: QuizResult[];
    topicBreakdown: { topic: string; correct: number; total: number; percentage: number }[];
}

/**
 * Get user's average mastery level for a study set (1-4 scale)
 */
export async function getUserMasteryLevel(
    studySetId: string,
    userId: string
): Promise<number> {
    try {
        // Get flashcard IDs in this study set
        const { data: flashcards } = await supabase
            .from('flashcards')
            .select('id')
            .eq('study_set_id', studySetId);

        if (!flashcards || flashcards.length === 0) return 1;

        const flashcardIds = flashcards.map(f => f.id);

        // Get SRS data for user's progress on these cards
        const { data: srsData } = await supabase
            .from('flashcard_srs_data')
            .select('mastery_level')
            .eq('user_id', userId)
            .in('flashcard_id', flashcardIds);

        if (!srsData || srsData.length === 0) return 1;

        // Calculate average mastery (0-5 scale from DB)
        const avgMastery = srsData.reduce((sum, d) => sum + (d.mastery_level || 0), 0) / srsData.length;

        // Convert to 1-4 level scale
        if (avgMastery >= 4) return 4;      // Expert
        if (avgMastery >= 2.5) return 3;    // Advanced
        if (avgMastery >= 1) return 2;      // Intermediate
        return 1;                            // Basic
    } catch (error) {
        console.error('Error getting user mastery level:', error);
        return 1;
    }
}

/**
 * Get question type distribution - balanced mix for variety
 * Independent of user level - all quizzes get a variety of types
 */
function getQuestionTypeDistribution(totalQuestions: number): Record<QuestionType, number> {
    // Balanced distribution for all quizzes:
    // ~15% True/False, ~30% Multiple Choice, ~20% Analysis, ~15% Design, ~20% Practical
    const distribution = {
        true_false: 0.15,
        multiple_choice: 0.30,
        analysis: 0.20,
        design: 0.15,
        practical: 0.20,  // Real-world application examples
    };

    // Calculate counts
    let counts = {
        true_false: Math.round(totalQuestions * distribution.true_false),
        multiple_choice: Math.round(totalQuestions * distribution.multiple_choice),
        analysis: Math.round(totalQuestions * distribution.analysis),
        design: Math.round(totalQuestions * distribution.design),
        practical: Math.round(totalQuestions * distribution.practical),
    };

    // Ensure we have at least 1 of each main type for quizzes with 5+ questions
    if (totalQuestions >= 5) {
        if (counts.true_false === 0) counts.true_false = 1;
        if (counts.analysis === 0) counts.analysis = 1;
        if (counts.practical === 0) counts.practical = 1;
    }

    return counts;
}

/**
 * Generate an adaptive quiz based on study set content and previous performance
 */
export async function generateAdaptiveQuiz(
    studySetId: string,
    userId: string,
    questionCount: number = 5
): Promise<QuizQuestion[]> {
    try {
        // 1. Fetch flashcards from study set for content
        const { data: flashcards, error: flashcardsError } = await supabase
            .from('flashcards')
            .select('question, answer, category')
            .eq('study_set_id', studySetId);

        if (flashcardsError || !flashcards || flashcards.length === 0) {
            console.error('Error fetching flashcards:', flashcardsError);
            return [];
        }

        // 2. Get user's mastery level
        const userLevel = await getUserMasteryLevel(studySetId, userId);
        console.log(`[Quiz] User level for study set: ${userLevel}`);

        // 3. Get weak topics from previous quiz sessions
        const weakTopics = await getWeakTopics(studySetId, userId);

        // 4. Get previously asked questions to avoid repetition
        const previousQuestions = await getPreviousQuestions(studySetId, userId);

        // 5. Build context for Gemini
        const contentSummary = flashcards
            .map(f => `Q: ${f.question}\nA: ${f.answer}\nTopic: ${f.category || 'General'}`)
            .join('\n\n');

        const weakTopicsContext = weakTopics.length > 0
            ? `\n\nIMPORTANT: The student has struggled with these topics. Include questions about them: ${weakTopics.join(', ')}`
            : '';

        const avoidContext = previousQuestions.length > 0
            ? `\n\nAvoid repeating these exact questions:\n${previousQuestions.slice(0, 10).join('\n')}`
            : '';

        // 6. Get question type distribution (balanced mix for all users)
        const distribution = getQuestionTypeDistribution(questionCount);

        const typeInstructions = `
QUESTION TYPE DISTRIBUTION (generate exactly this mix):
- True/False questions: ${distribution.true_false}
- Multiple Choice questions (4 options): ${distribution.multiple_choice}
- Analysis questions (scenario-based): ${distribution.analysis}
- Design questions (open-ended solutions): ${distribution.design}
- Practical Application questions: ${distribution.practical}

QUESTION TYPE FORMATS:

1. TRUE_FALSE TYPE:
   - Simple statement that is either true or false
   - Options: ["Verdadero", "Falso"]
   - correctIndex: 0 for true, 1 for false

2. MULTIPLE_CHOICE TYPE:
   - Traditional question with 4 options
   - Options: ["A", "B", "C", "D"]
   - correctIndex: 0-3

3. ANALYSIS TYPE:
   - Includes a "scenario" field with a real-world case
   - Question asks to analyze the scenario
   - Options: 4 possible interpretations/conclusions
   - correctIndex: 0-3

4. DESIGN TYPE:
   - Open-ended problem that requires designing a solution
   - "designPrompt" field describes what to create
   - Options: ["Mi solución está lista"] (single option, user will write)
   - correctIndex: 0
   - "evaluationCriteria": array of 3 criteria to evaluate the response

5. PRACTICAL TYPE:
   - Question about applying concepts to real-world situations
   - "realWorldExample" field: A concrete, relatable example from daily life, work, or industry showing how the concept is used in practice
   - Options: 4 application scenarios
   - correctIndex: 0-3
   - The example should make the abstract concept tangible and memorable`;

        const prompt = `Based on this study material, generate a quiz with ${questionCount} questions.

STUDENT LEVEL: ${userLevel}/4 (${['Básico', 'Intermedio', 'Avanzado', 'Experto'][userLevel - 1]})

Study Material:
${contentSummary}
${weakTopicsContext}
${avoidContext}

${typeInstructions}

Return as JSON array. IMPORTANT: Include "type" field for each question:
[{
  "type": "true_false" | "multiple_choice" | "analysis" | "design" | "practical",
  "question": "...",
  "options": [...],
  "correctIndex": 0,
  "explanation": "...",
  "topic": "...",
  "scenario": "..." (only for analysis type),
  "designPrompt": "..." (only for design type),
  "evaluationCriteria": ["...", "...", "..."] (only for design type),
  "realWorldExample": "..." (only for practical type - concrete real-world application)
}]`;

        // 7. Generate questions with Gemini
        const generatedQuestions = await generateQuizQuestions(prompt);

        if (generatedQuestions && generatedQuestions.length > 0) {
            return generatedQuestions.map((q: any, i: number) => ({
                id: `quiz-${Date.now()}-${i}`,
                type: q.type || 'multiple_choice',
                question: q.question,
                options: q.options,
                correctIndex: q.correctIndex,
                explanation: q.explanation || '',
                topic: q.topic || 'General',
                scenario: q.scenario,
                designPrompt: q.designPrompt,
                evaluationCriteria: q.evaluationCriteria,
                realWorldExample: q.realWorldExample,
            }));
        }

        return [];
    } catch (error) {
        console.error('Error generating adaptive quiz:', error);
        return [];
    }
}

/**
 * Get topics the user has struggled with in past quizzes
 */
export async function getWeakTopics(
    studySetId: string,
    userId: string
): Promise<string[]> {
    try {
        // Get recent quiz question results
        const { data: sessions } = await supabase
            .from('quiz_sessions')
            .select('id')
            .eq('study_set_id', studySetId)
            .eq('user_id', userId)
            .order('completed_at', { ascending: false })
            .limit(5);

        if (!sessions || sessions.length === 0) return [];

        const sessionIds = sessions.map(s => s.id);

        const { data: results } = await supabase
            .from('quiz_question_results')
            .select('topic, is_correct')
            .in('quiz_session_id', sessionIds);

        if (!results || results.length === 0) return [];

        // Calculate topic performance
        const topicStats: Record<string, { correct: number; total: number }> = {};

        results.forEach(r => {
            const topic = r.topic || 'General';
            if (!topicStats[topic]) {
                topicStats[topic] = { correct: 0, total: 0 };
            }
            topicStats[topic].total++;
            if (r.is_correct) topicStats[topic].correct++;
        });

        // Find topics with < 60% accuracy
        const weakTopics = Object.entries(topicStats)
            .filter(([_, stats]) => (stats.correct / stats.total) < 0.6)
            .map(([topic]) => topic);

        return weakTopics;
    } catch (error) {
        console.error('Error getting weak topics:', error);
        return [];
    }
}

/**
 * Get previously asked questions to avoid repetition
 */
async function getPreviousQuestions(
    studySetId: string,
    userId: string
): Promise<string[]> {
    try {
        const { data: sessions } = await supabase
            .from('quiz_sessions')
            .select('id')
            .eq('study_set_id', studySetId)
            .eq('user_id', userId)
            .order('completed_at', { ascending: false })
            .limit(3);

        if (!sessions || sessions.length === 0) return [];

        const { data: results } = await supabase
            .from('quiz_question_results')
            .select('question_text')
            .in('quiz_session_id', sessions.map(s => s.id));

        return results?.map(r => r.question_text) || [];
    } catch (error) {
        return [];
    }
}

/**
 * Save quiz session and results to database
 */
export async function saveQuizSession(
    userId: string,
    studySetId: string,
    questions: QuizQuestion[],
    results: QuizResult[],
    durationSeconds?: number
): Promise<QuizReport | null> {
    try {
        const correctCount = results.filter(r => r.isCorrect).length;
        const totalCount = results.length;
        const percentCorrect = totalCount > 0 ? (correctCount / totalCount) * 100 : 0;

        // Find weak topics
        const topicStats: Record<string, { correct: number; total: number }> = {};
        results.forEach(r => {
            const topic = r.topic || 'General';
            if (!topicStats[topic]) topicStats[topic] = { correct: 0, total: 0 };
            topicStats[topic].total++;
            if (r.isCorrect) topicStats[topic].correct++;
        });

        const weakTopics = Object.entries(topicStats)
            .filter(([_, stats]) => (stats.correct / stats.total) < 0.6)
            .map(([topic]) => topic);

        // 1. Save session
        const { data: session, error: sessionError } = await supabase
            .from('quiz_sessions')
            .insert({
                user_id: userId,
                study_set_id: studySetId,
                score: correctCount,
                total_questions: totalCount,
                percent_correct: percentCorrect,
                duration_seconds: durationSeconds,
                weak_topics: weakTopics
            })
            .select()
            .single();

        if (sessionError || !session) {
            console.error('Error saving quiz session:', sessionError);
            return null;
        }

        // 2. Save individual question results
        const questionResults = results.map(r => ({
            quiz_session_id: session.id,
            question_text: r.question,
            correct_answer: questions[r.questionIndex]?.options[r.correctAnswerIndex] || '',
            user_answer: r.textAnswer || (questions[r.questionIndex]?.options[r.userAnswerIndex] || ''),
            is_correct: r.isCorrect,
            topic: r.topic
        }));

        const { error: resultsError } = await supabase
            .from('quiz_question_results')
            .insert(questionResults);

        if (resultsError) {
            console.error('Error saving question results:', resultsError);
        }

        // 3. Build report
        const topicBreakdown = Object.entries(topicStats).map(([topic, stats]) => ({
            topic,
            correct: stats.correct,
            total: stats.total,
            percentage: Math.round((stats.correct / stats.total) * 100)
        }));

        return {
            session: {
                id: session.id,
                userId: session.user_id,
                studySetId: session.study_set_id,
                score: correctCount,
                totalQuestions: totalCount,
                percentCorrect,
                durationSeconds,
                weakTopics,
                completedAt: session.completed_at
            },
            results,
            correctQuestions: results.filter(r => r.isCorrect),
            incorrectQuestions: results.filter(r => !r.isCorrect),
            topicBreakdown
        };
    } catch (error) {
        console.error('Error saving quiz session:', error);
        return null;
    }
}

/**
 * Get quiz history for a study set
 */
export async function getQuizHistory(
    studySetId: string,
    userId: string,
    limit: number = 10
): Promise<QuizSession[]> {
    try {
        const { data, error } = await supabase
            .from('quiz_sessions')
            .select('*')
            .eq('study_set_id', studySetId)
            .eq('user_id', userId)
            .order('completed_at', { ascending: false })
            .limit(limit);

        if (error || !data) return [];

        return data.map(s => ({
            id: s.id,
            userId: s.user_id,
            studySetId: s.study_set_id,
            score: s.score,
            totalQuestions: s.total_questions,
            percentCorrect: s.percent_correct,
            durationSeconds: s.duration_seconds,
            weakTopics: s.weak_topics || [],
            completedAt: s.completed_at
        }));
    } catch (error) {
        console.error('Error getting quiz history:', error);
        return [];
    }
}
