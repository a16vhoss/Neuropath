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
import { generateQuizQuestions, generateAdvancedQuiz } from './geminiService';

export type QuestionType = 'true_false' | 'multiple_choice' | 'analysis' | 'design' | 'practical' | 'ordering' | 'matching' | 'fill_blank' | 'identify_error';
export type QuizGameMode = 'classic' | 'survival' | 'time_attack';
export type QuizPersona = 'standard' | 'socratic' | 'strict' | 'friendly';

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

    // New fields for advanced types
    orderingItems?: string[]; // For ordering: Items in CORRECT sequence.
    matchingPairs?: { left: string; right: string }[]; // For matching: Key-Value pairs.
    fillBlankText?: string; // For cloze: "The [blank] is blue."
    fillBlankAnswers?: string[]; // Correct words for blanks.
    errorText?: string; // For Identify Error: Text containing the error.
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
    // Balanced "God Mode" distribution:
    const distribution = {
        true_false: 0.10,
        multiple_choice: 0.20,
        analysis: 0.15,
        design: 0.10,
        practical: 0.15,
        ordering: 0.10,
        matching: 0.10,
        fill_blank: 0.05,
        identify_error: 0.05
    };

    // Calculate counts
    let counts = {
        true_false: Math.round(totalQuestions * distribution.true_false),
        multiple_choice: Math.round(totalQuestions * distribution.multiple_choice),
        analysis: Math.round(totalQuestions * distribution.analysis),
        design: Math.round(totalQuestions * distribution.design),
        practical: Math.round(totalQuestions * distribution.practical),
        ordering: Math.round(totalQuestions * distribution.ordering),
        matching: Math.round(totalQuestions * distribution.matching),
        fill_blank: Math.round(totalQuestions * distribution.fill_blank),
        identify_error: Math.round(totalQuestions * distribution.identify_error),
    };

    // Ensure variety for larger quizzes
    if (totalQuestions >= 10) {
        if (counts.ordering === 0) counts.ordering = 1;
        if (counts.matching === 0) counts.matching = 1;
    }

    return counts;
}

/**
 * Generate an adaptive quiz based on study set content and previous performance
 */
export interface QuizConfig {
    questionCount: number;
    questionTypes: QuestionType[];
    difficultyLevel?: number; // 1-4, if user overrides
    contentScope: 'all' | 'weak_topics' | 'specific_topics';
    selectedTopics?: string[]; // if specific_topics
    timeLimitPerQuestion?: number; // seconds, 0 for none
    immediateFeedback: boolean;
    gameMode?: QuizGameMode;
    persona?: QuizPersona;
}

/**
 * Generate an adaptive quiz based on study set content and previous performance
 */
export async function generateAdaptiveQuiz(
    studySetId: string,
    userId: string,
    config?: QuizConfig // Now optional/customizable
): Promise<QuizQuestion[]> {
    try {
        const questionCount = config?.questionCount || 5;

        // 1. Fetch flashcards from study set for content
        let flashcardsQuery = supabase
            .from('flashcards')
            .select('question, answer, category')
            .eq('study_set_id', studySetId);

        // Filter by topic if requested
        if (config?.contentScope === 'specific_topics' && config.selectedTopics && config.selectedTopics.length > 0) {
            flashcardsQuery = flashcardsQuery.in('category', config.selectedTopics);
        }

        const { data: flashcards, error: flashcardsError } = await flashcardsQuery;

        // 1b. Fetch notebooks content from study set
        const { data: notebooks } = await supabase
            .from('notebooks')
            .select('title, content, last_saved_content')
            .eq('study_set_id', studySetId);

        // Allow quiz generation even if no flashcards, as long as there's notebook content
        const hasFlashcards = flashcards && flashcards.length > 0;
        const hasNotebooks = notebooks && notebooks.length > 0 && notebooks.some(n => n.content || n.last_saved_content);

        if (!hasFlashcards && !hasNotebooks) {
            console.error('Error: No flashcards or notebooks found for quiz generation');
            return [];
        }

        // 2. Determine User Level (Auto or Manual)
        let userLevel = 1;
        if (config?.difficultyLevel) {
            userLevel = config.difficultyLevel;
            console.log(`[Quiz] Using MANUAL difficulty level: ${userLevel}`);
        } else {
            userLevel = await getUserMasteryLevel(studySetId, userId);
            console.log(`[Quiz] Using AUTO difficulty level: ${userLevel}`);
        }

        // 3. Get weak topics logic (only if scope is not specific)
        let weakTopics: string[] = [];
        if (config?.contentScope === 'weak_topics') {
            weakTopics = await getWeakTopics(studySetId, userId);
            // If no weak topics found but requested, warn or fallback? 
            // Logic below handles empty weakTopics by just not adding the specific prompt context, 
            // but for "weak_topics" scope we might want to prioritize differently.
            // For now, we'll let the prompt handle the emphasis.
            if (weakTopics.length === 0) {
                console.log('[Quiz] No weak topics found for review mode, defaulting to general mix');
            }
        } else if (config?.contentScope === 'all') {
            // Still fetch them to possibly weight them, but not exclusively
            weakTopics = await getWeakTopics(studySetId, userId);
        }

        // 4. Get previously asked questions to avoid repetition
        const previousQuestions = await getPreviousQuestions(studySetId, userId);

        // 5. Build context for Gemini (flashcards + notebooks)
        const flashcardsSummary = (flashcards || [])
            .map(f => `Q: ${f.question}\nA: ${f.answer}\nTopic: ${f.category || 'General'}`)
            .join('\n\n');

        // Extract text from notebooks HTML content
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

        const notebooksSummary = (notebooks || [])
            .filter(n => n.content || n.last_saved_content)
            .map(n => {
                const text = extractTextFromHtml(n.content || n.last_saved_content || '');
                return `--- Cuaderno: ${n.title} ---\n${text}`;
            })
            .join('\n\n');

        // Combine both sources
        let contentSummary = '';
        if (flashcardsSummary) {
            contentSummary += `FLASHCARDS DEL SET:\n${flashcardsSummary}`;
        }
        if (notebooksSummary) {
            contentSummary += `\n\nAPUNTES DE CUADERNOS:\n${notebooksSummary}`;
        }

        console.log('[Quiz] Content sources - Flashcards:', (flashcards || []).length, 'Notebooks:', (notebooks || []).filter(n => n.content).length);

        let scopeInstruction = "";
        if (config?.contentScope === 'weak_topics' && weakTopics.length > 0) {
            scopeInstruction = `\n\nIMPORTANT: FOCUS EXCLUSIVELY on these weak topics: ${weakTopics.join(', ')}. Do not generate questions for other topics unless necessary.`;
        } else if (config?.contentScope === 'specific_topics' && config?.selectedTopics) {
            scopeInstruction = `\n\nIMPORTANT: Focus ONLY on these selected topics: ${config.selectedTopics.join(', ')}.`;
        } else {
            // Normal adaptive behavior
            scopeInstruction = weakTopics.length > 0
                ? `\n\nIMPORTANT: The student has struggled with these topics. Include questions about them: ${weakTopics.join(', ')}`
                : '';
        }

        const avoidContext = previousQuestions.length > 0
            ? `\n\nAvoid repeating these exact questions:\n${previousQuestions.slice(0, 10).join('\n')}`
            : '';

        // 6. Get question type distribution 
        // Logic: Use user selection if provided, otherwise default balanced
        let typeCounts: Record<string, number> = {};

        if (config && config.questionTypes && config.questionTypes.length > 0) {
            // Distribute evenly among selected types
            const typeCount = Math.floor(questionCount / config.questionTypes.length);
            const remainder = questionCount % config.questionTypes.length;

            config.questionTypes.forEach((type, index) => {
                typeCounts[type] = typeCount + (index < remainder ? 1 : 0);
            });
        } else {
            // Default balanced
            typeCounts = getQuestionTypeDistribution(questionCount);
        }

        const typeInstructions = `
QUESTION TYPE DISTRIBUTION (generate exactly this mix):
${Object.entries(typeCounts).map(([type, count]) => `- ${type}: ${count}`).join('\n')}

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

        // Persona Injection
        let personaInstruction = "";
        if (config?.persona) {
            switch (config.persona) {
                case 'socratic':
                    personaInstruction = "ROLE: You are Socrates. Never give the answer directly in the explanation. Ask leading questions and guide the student to the truth. Use a philosophical tone.";
                    break;
                case 'strict':
                    personaInstruction = "ROLE: You are Drill Sergeant Hartman. Be extremely strict, precise, and demanding. Tolerate no ambiguity. If they are wrong, tell them why they are weak. Use military discipline tone.";
                    break;
                case 'friendly':
                    personaInstruction = "ROLE: You are Maya, a super supportive study buddy. Be encouraging, use emojis, and celebrate every attempt. Make learning feel like a party.";
                    break;
                // standard is default
            }
        }

        const typeDetails = `
6. ORDERING TYPE:
   - Provide a list of items to sequence chronologically or logically.
   - "orderingItems": ["Step 1", "Step 2", "Step 3"] (The CORRECT order)
   - The user will have to drag and drop them.
   - "question": "Order the following steps of..."

7. MATCHING TYPE:
   - Match concepts to definitions.
   - "matchingPairs": [{"left": "Term A", "right": "Def A"}, {"left": "Term B", "right": "Def B"}] (Max 4 pairs)
   - "question": "Match the concepts..."

8. FILL_BLANK (Cloze):
   - A sentence with ONE missing key term represented by "[blank]".
   - "fillBlankText": "The [blank] is the powerhouse of the cell."
   - "fillBlankAnswers": ["mitochondria", "mitochondrion"] (Acceptable correct answers)
   - "question": "Complete the sentence."

9. IDENTIFY_ERROR:
   - A short text or code snippet that contains a factual or logical error.
   - "errorText": "The heart pumps oxygenated blood to the lungs."
   - "correctIndex": 0 (Irrelevant here, but keep schema consistent)
   - "explanation": "Actually, the heart pumps deoxygenated blood to the lungs."
   - "question": "Find the error in this statement."
`;

        const prompt = `Based on this study material, generate a quiz with ${questionCount} questions.
${personaInstruction}

STUDENT LEVEL: ${userLevel}/4 (${['Básico', 'Intermedio', 'Avanzado', 'Experto'][userLevel - 1]})

Study Material:
${contentSummary}
${scopeInstruction}
${avoidContext}

${typeInstructions}
${typeDetails}

Return as JSON array. IMPORTANT: Include specific fields for each type:
[{
  "type": "true_false" | "multiple_choice" | "analysis" | "design" | "practical" | "ordering" | "matching" | "fill_blank" | "identify_error",
  "question": "...",
  "options": [...],
  "correctIndex": 0,
  "explanation": "...",
  "topic": "...",
  "scenario": "...",
  "designPrompt": "...",
  "evaluationCriteria": [],
  "realWorldExample": "...",
  "orderingItems": ["Item 1", "Item 2"...] (correct sequence),
  "matchingPairs": [{"left": "A", "right": "B"}...],
  "fillBlankText": "Text with [blank]...",
  "fillBlankAnswers": ["word1", "word2"],
  "errorText": "Text with error..."
}]`;

        // 7. Generate questions with Gemini
        const generatedQuestions = await generateAdvancedQuiz(prompt);

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
                // Map new fields
                orderingItems: q.orderingItems,
                matchingPairs: q.matchingPairs,
                fillBlankText: q.fillBlankText,
                fillBlankAnswers: q.fillBlankAnswers,
                errorText: q.errorText
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
