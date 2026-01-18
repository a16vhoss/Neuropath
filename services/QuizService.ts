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

export interface QuizQuestion {
    id: string;
    question: string;
    options: string[];
    correctIndex: number;
    explanation?: string;
    topic?: string;
}

export interface QuizResult {
    questionIndex: number;
    question: string;
    userAnswerIndex: number;
    correctAnswerIndex: number;
    isCorrect: boolean;
    topic?: string;
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

        // 2. Get weak topics from previous quiz sessions
        const weakTopics = await getWeakTopics(studySetId, userId);

        // 3. Get previously asked questions to avoid repetition
        const previousQuestions = await getPreviousQuestions(studySetId, userId);

        // 4. Build context for Gemini
        const contentSummary = flashcards
            .map(f => `Q: ${f.question}\nA: ${f.answer}\nTopic: ${f.category || 'General'}`)
            .join('\n\n');

        const weakTopicsContext = weakTopics.length > 0
            ? `\n\nIMPORTANT: The student has struggled with these topics. Generate MORE questions about them: ${weakTopics.join(', ')}`
            : '';

        const avoidContext = previousQuestions.length > 0
            ? `\n\nAvoid repeating these exact questions (but similar topics are OK):\n${previousQuestions.slice(0, 10).join('\n')}`
            : '';

        const prompt = `Based on this study material, generate ${questionCount} multiple-choice quiz questions.

Study Material:
${contentSummary}
${weakTopicsContext}
${avoidContext}

Requirements:
- Each question should have 4 options (A, B, C, D)
- Include the correct answer index (0-3)
- Add a brief explanation for each answer
- Include a topic/category for each question

ADAPTIVE RULES:
1. For "Weak Topics" listed above: Generate questions that verify the core concept again, but with different phrasing.
2. For TOPICS NOT LISTED as weak (mastered topics): Generate MORE COMPLEX questions. Move from simple recall to application or analysis scenarios. EVOLVE the difficulty.

Return as JSON array:
[{
  "question": "...",
  "options": ["A", "B", "C", "D"],
  "correctIndex": 0,
  "explanation": "...",
  "topic": "..."
}]`;

        // 5. Generate questions with Gemini
        const generatedQuestions = await generateQuizQuestions(prompt);

        if (generatedQuestions && generatedQuestions.length > 0) {
            return generatedQuestions.map((q: any, i: number) => ({
                id: `quiz-${Date.now()}-${i}`,
                question: q.question,
                options: q.options,
                correctIndex: q.correctIndex,
                explanation: q.explanation || '',
                topic: q.topic || 'General'
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
            user_answer: questions[r.questionIndex]?.options[r.userAnswerIndex] || '',
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
