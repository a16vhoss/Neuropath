

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getClassFlashcards, getStudySetFlashcards, updateFlashcardProgress, supabase, updateFlashcardMastery, MasteryResult, getDifficultyLevelInfo } from '../services/supabaseClient';
import DifficultyLevelIndicator, { LevelUpNotification } from '../components/DifficultyLevelIndicator';
import { generateStudyFlashcards, getTutorResponse, generateQuizQuestions } from '../services/geminiService';
import { GamificationService } from '../services/GamificationService';
import AITutorChat from '../components/AITutorChat';
import NeuroPodcast from '../components/NeuroPodcast';
import SRSRatingButtons from '../components/SRSRatingButtons';
import { updateCardAfterReview, Rating, getRatingLabel, getCardsForSession, FlashcardWithSRS } from '../services/AdaptiveLearningService';
import { handleSessionComplete, handleStrugglingSession, updateConsecutiveCorrect, DIFFICULTY_TIERS } from '../services/DynamicContentService';
import StudySetStatistics from '../components/StudySetStatistics';
import { generateAdaptiveQuiz, saveQuizSession, QuizQuestion as AdaptiveQuizQuestion, QuizResult, QuizReport, QuestionType, QuizConfig, QuizGameMode, QuizPersona } from '../services/QuizService';
import QuizConfigModal from '../components/QuizConfigModal';

type StudyMode = 'flashcards' | 'quiz' | 'cramming' | 'podcast' | 'daily';

interface Flashcard {
  id: string;
  question: string;
  answer: string;
  category: string;
  difficulty?: number;
}

interface QuizQuestion {
  id: string;
  question: string;
  type?: QuestionType;  // Question type: true_false, multiple_choice, analysis, design, practical
  options: string[];
  correctIndex: number;
  explanation: string;
  scenario?: string;       // For analysis questions
  designPrompt?: string;   // For design questions
  evaluationCriteria?: string[]; // For design questions
  realWorldExample?: string; // For practical questions - real-world application

  // New fields for advanced types
  orderingItems?: string[];
  matchingPairs?: { left: string; right: string }[];
  fillBlankText?: string;
  fillBlankAnswers?: string[];
  errorText?: string;

  // Exercise-based question fields
  exerciseProblem?: string;
  exerciseSolution?: string;
  exerciseSteps?: string[];
  exerciseType?: 'mathematical' | 'programming' | 'case_study' | 'conceptual' | 'practical' | 'general';
  exerciseTemplateId?: string;
}

const mockFlashcards: Flashcard[] = [
  { id: '1', question: '¿Cuál es la función principal del hipocampo?', answer: 'El hipocampo es crucial para la formación de nuevas memorias y la navegación espacial. Es parte del sistema límbico.', category: 'Anatomía' },
  { id: '2', question: '¿Qué es la sinapsis?', answer: 'Es la unión funcional entre dos neuronas que permite la transmisión de señales nerviosas.', category: 'Neurología' },
  { id: '3', question: '¿Cuáles son los principales neurotransmisores?', answer: 'Dopamina, serotonina, acetilcolina, glutamato y GABA son los principales neurotransmisores.', category: 'Neurología' },
  { id: '4', question: '¿Qué función tiene la mielina?', answer: 'La mielina aísla los axones neuronales y acelera la transmisión de impulsos nerviosos.', category: 'Anatomía' },
  { id: '5', question: '¿Qué es la plasticidad neuronal?', answer: 'Es la capacidad del cerebro para reorganizarse formando nuevas conexiones sinápticas a lo largo de la vida.', category: 'Neurología' }
];

const mockQuizQuestions: QuizQuestion[] = [
  { id: '1', question: '¿Qué estructura es responsable de la memoria a largo plazo?', options: ['Hipocampo', 'Tálamo', 'Cerebelo', 'Médula'], correctIndex: 0, explanation: 'El hipocampo es esencial para convertir memorias a corto plazo en memorias a largo plazo.' },
  { id: '2', question: '¿Cuál neurotransmisor está asociado con el placer y la recompensa?', options: ['Serotonina', 'GABA', 'Dopamina', 'Acetilcolina'], correctIndex: 2, explanation: 'La dopamina está involucrada en los circuitos de recompensa del cerebro.' },
  { id: '3', question: '¿Qué parte del cerebro controla el equilibrio?', options: ['Corteza frontal', 'Cerebelo', 'Amígdala', 'Hipotálamo'], correctIndex: 1, explanation: 'El cerebelo coordina el movimiento y mantiene el equilibrio.' },
  { id: '4', question: '¿Cuántas neuronas tiene aproximadamente el cerebro humano?', options: ['10 millones', '100 millones', '86 mil millones', '1 billón'], correctIndex: 2, explanation: 'El cerebro humano tiene aproximadamente 86 mil millones de neuronas.' },
  { id: '5', question: '¿Qué es una dendrita?', options: ['Parte transmisora', 'Parte receptora', 'Cuerpo celular', 'Vaina de mielina'], correctIndex: 1, explanation: 'Las dendritas son extensiones ramificadas que reciben señales de otras neuronas.' }
];

const StudySession: React.FC = () => {
  const { classId, studySetId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const modeParam = searchParams.get('mode') as StudyMode || 'flashcards';
  const { user, profile } = useAuth();

  const [className, setClassName] = useState('');
  const [activeClassId, setActiveClassId] = useState<string | null>(classId || null);

  const [mode, setMode] = useState<StudyMode>(modeParam);
  const [loading, setLoading] = useState(true);
  const [loadingSource, setLoadingSource] = useState<'db' | 'ai' | 'mock'>('db');
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [streak, setStreak] = useState(profile?.streak_days || 0);
  const [showTutor, setShowTutor] = useState(false);
  const [tutorQuestion, setTutorQuestion] = useState('');
  const [tutorResponse, setTutorResponse] = useState('');
  const [tutorLoading, setTutorLoading] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [xpEarned, setXpEarned] = useState(0);
  const [flashcardsComplete, setFlashcardsComplete] = useState(false);
  const [correctFlashcards, setCorrectFlashcards] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [responseStartTime, setResponseStartTime] = useState<number>(Date.now());

  // Quiz state
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuizIndex, setCurrentQuizIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);
  const [quizComplete, setQuizComplete] = useState(false);
  const [quizResults, setQuizResults] = useState<QuizResult[]>([]);
  const [quizReport, setQuizReport] = useState<QuizReport | null>(null);
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizStartTime, setQuizStartTime] = useState<number>(Date.now());
  const [designAnswer, setDesignAnswer] = useState<string>(''); // For design type questions

  // God Mode States
  const [gameMode, setGameMode] = useState<QuizGameMode>('classic');
  const [persona, setPersona] = useState<QuizPersona>('standard');
  const [timeRemaining, setTimeRemaining] = useState<number>(0); // For Time Attack or per-question
  const [orderingState, setOrderingState] = useState<string[]>([]);
  const [matchingState, setMatchingState] = useState<Record<string, string>>({}); // Left -> Right
  const [fillBlankAnswer, setFillBlankAnswer] = useState<string>('');
  const [selectedErrorOption, setSelectedErrorOption] = useState<number | null>(null);
  const [exerciseAnswer, setExerciseAnswer] = useState<string>('');
  const [showExerciseSolution, setShowExerciseSolution] = useState(false);

  // Custom Quiz Configuration
  const [showQuizConfig, setShowQuizConfig] = useState(false);
  const [quizConfig, setQuizConfig] = useState<QuizConfig | null>(null);
  const [questionTimer, setQuestionTimer] = useState<number>(0); // Current question timer
  const [questionTimeExpired, setQuestionTimeExpired] = useState(false);

  // Exam state
  const [examTime, setExamTime] = useState(15 * 60); // 15 minutes
  const [examAnswers, setExamAnswers] = useState<(number | null)[]>(new Array(mockQuizQuestions.length).fill(null));
  const [examSubmitted, setExamSubmitted] = useState(false);

  // Cramming state
  const [crammingIntensity, setCrammingIntensity] = useState<'low' | 'medium' | 'high'>('high');
  const [crammingComplete, setCrammingComplete] = useState(false);

  // Dynamic content generation state
  const [generatingNewContent, setGeneratingNewContent] = useState(false);
  const [newContentMessage, setNewContentMessage] = useState<string | null>(null);
  const [regressionMessage, setRegressionMessage] = useState<string | null>(null);
  const [failedCardIds, setFailedCardIds] = useState<string[]>([]);
  const [noCardsDue, setNoCardsDue] = useState(false);
  const [showStats, setShowStats] = useState(false);

  // Mastery level tracking
  const [currentMasteryResult, setCurrentMasteryResult] = useState<MasteryResult | null>(null);
  const [showLevelUp, setShowLevelUp] = useState(false);

  // Daily Session state
  const [dailySessionTime, setDailySessionTime] = useState(15 * 60); // 15 minutes
  const [dailySessionActive, setDailySessionActive] = useState(false);
  const [dailySessionComplete, setDailySessionComplete] = useState(false);
  const [dailyQuestionsAnswered, setDailyQuestionsAnswered] = useState(0);
  const DAILY_SESSION_QUESTIONS = 10; // Target 8-12, we'll use 10

  // Separate exam state
  const [examQuestions, setExamQuestions] = useState<QuizQuestion[]>([]);


  // Load flashcards from Supabase or generate with AI
  useEffect(() => {
    const fetchCards = async () => {
      setLoading(true);


      let sessionCards: Flashcard[] = [];
      try {
        setLoadingSource('db');

        // Determine service mode based on component mode
        let serviceMode: 'adaptive' | 'review_due' | 'learn_new' | 'cramming' | 'quiz' | 'exam' = 'adaptive';

        switch (mode) {
          case 'quiz':
            serviceMode = 'quiz';
            break;
          case 'exam':
            serviceMode = 'exam';
            break;
          case 'cramming':
            serviceMode = 'cramming';
            break;
          case 'daily':
            serviceMode = 'adaptive'; // Daily uses adaptive mode
            break;
          // default stays adaptive
        }

        // For daily mode, limit to 10 cards
        const maxCards = mode === 'daily' ? DAILY_SESSION_QUESTIONS : 20;

        // Fetch priority cards using FSRS logic
        const adaptiveCards = await getCardsForSession({
          userId: user.id,
          classId: classId || undefined,
          studySetId: studySetId || undefined,
          mode: serviceMode,
          maxNewCards: maxCards,
          maxReviewCards: mode === 'exam' ? 50 : maxCards
        });

        if (adaptiveCards && adaptiveCards.length > 0) {
          // Map FlashcardWithSRS to local Flashcard interface
          sessionCards = adaptiveCards.map(c => ({
            id: c.id,
            question: c.question,
            answer: c.answer,
            category: c.category || 'General',
            difficulty: c.difficulty || 1,
          }));
          setFlashcards(sessionCards);

          // If we have a class/set name, try to fetch it separately just for display
          if (studySetId && !className) {
            const { data } = await supabase.from('study_sets').select('name').eq('id', studySetId).single();
            if (data) setClassName(data.name);
          } else if (classId && !className) {
            const { data } = await supabase.from('classes').select('name').eq('id', classId).single();
            if (data) setClassName(data.name);
          }
        } else {
          // No adaptive cards found
          if (studySetId) {
            // For quiz/exam/cramming/daily modes, get all cards - no SRS restriction
            if (mode === 'quiz' || mode === 'exam' || mode === 'cramming' || mode === 'daily') {
              const cardLimit = mode === 'daily' ? DAILY_SESSION_QUESTIONS : (mode === 'exam' ? 50 : 20);
              const { data: allCards } = await supabase
                .from('flashcards')
                .select('*')
                .eq('study_set_id', studySetId)
                .limit(cardLimit);

              if (allCards && allCards.length > 0) {
                sessionCards = allCards.map(c => ({
                  id: c.id,
                  question: c.question,
                  answer: c.answer,
                  category: c.category || 'General',
                  difficulty: c.difficulty || 1
                }));
                setFlashcards(sessionCards);
              } else {
                // Only show "no cards" if there are literally zero flashcards
                sessionCards = mockFlashcards;
                setFlashcards(sessionCards);
                setLoadingSource('mock');
              }
              setLoading(false);
              // Quiz/exam questions will be generated in the useEffect that watches flashcards
              return;
            }

            // For flashcards mode, check archived/mastered status
            const { count: archivedCount } = await supabase
              .from('flashcard_srs_data')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', user.id)
              .eq('archived', true);

            const { count: totalCards } = await supabase
              .from('flashcards')
              .select('*', { count: 'exact', head: true })
              .eq('study_set_id', studySetId);

            if (archivedCount && totalCards && archivedCount >= totalCards) {
              console.log('All cards mastered. Generating next level content...');
              setGeneratingNewContent(true);
              const result = await handleSessionComplete(user.id, studySetId, { correctRate: 1.0, cardsStudied: 10 });
              if (result.newCardsGenerated > 0) {
                const newCards = await getCardsForSession({ userId: user.id, studySetId: studySetId, mode: serviceMode });
                if (newCards && newCards.length > 0) {
                  sessionCards = newCards.map(c => ({
                    id: c.id, question: c.question, answer: c.answer, category: c.category || 'General', difficulty: c.difficulty || 1,
                  }));
                  setFlashcards(sessionCards);
                  setNewContentMessage(`Generated ${result.newCardsGenerated} new questions.`);
                }
              } else {
                // Fallback to all cards
                const { data: allCards } = await supabase.from('flashcards').select('*').eq('study_set_id', studySetId);
                if (allCards) {
                  sessionCards = allCards.map(c => ({ ...c, difficulty: c.difficulty || 1 }));
                  setFlashcards(sessionCards);
                }
              }
              setGeneratingNewContent(false);
            } else {
              // Flashcards mode - no cards due, show "Todo al día"
              setNoCardsDue(true);
              setLoading(false);
              return;
            }
          } else {
            sessionCards = mockFlashcards;
            setFlashcards(sessionCards);
            setLoadingSource('mock');
          }
        }

      } catch (error) {
        console.error('Error fetching cards:', error);
        sessionCards = mockFlashcards;
        setFlashcards(sessionCards);
        setLoadingSource('mock');
      }

      setLoading(false);
      /* Quiz generation will happen in the useEffect dependent on 'flashcards' state, 
         which we just updated. We don't need to manually call generation here anymore 
         because we fixed the logic flow. */
    };
    fetchCards();
  }, [classId, studySetId, mode]);

  // Effect to generate quiz when flashcards change (and are not empty)
  const [quizGenerated, setQuizGenerated] = useState(false);



  // NEW: Dedicated effect for Quiz Mode Generation
  useEffect(() => {
    // Only trigger if we have flashcards, haven't generated yet, and we are in quiz mode
    // AND we are not currently loading a quiz
    if (flashcards.length > 0 && !quizGenerated && mode === 'quiz' && !quizConfig && !showQuizConfig && loadingSource !== 'mock' && !quizLoading) {
      // Stop! We need config first.
      setQuizConfig(null);
      setShowQuizConfig(true);
    }
  }, [flashcards, quizGenerated, mode, quizConfig, showQuizConfig, loadingSource, quizLoading]);

  // EFFECT: Initialize Question State when index changes
  useEffect(() => {
    if (quizQuestions.length > 0) {
      const currentQ = quizQuestions[currentQuizIndex];

      // Ordering: Shuffle items initially
      if (currentQ.type === 'ordering' && currentQ.orderingItems) {
        // Simple shuffle
        const shuffled = [...currentQ.orderingItems].sort(() => Math.random() - 0.5);
        setOrderingState(shuffled);
      }

      // Matching: Clear selection
      if (currentQ.type === 'matching') {
        setMatchingState({}); // Reset pairs
      }

      // Fill Blank: Clear
      if (currentQ.type === 'fill_blank') {
        setFillBlankAnswer('');
      }

      // Error ID: Clear
      if (currentQ.type === 'identify_error') {
        setSelectedErrorOption(null);
      }

      // Exercise: Clear answer and solution visibility
      if (currentQ.type === 'exercise') {
        setExerciseAnswer('');
        setShowExerciseSolution(false);
      }
    }
  }, [currentQuizIndex, quizQuestions]);

  // EFFECT: Time Attack & Survival Timer
  useEffect(() => {
    // If result is shown, pause timer
    if (showResult) return;
    if (quizComplete) return;

    if ((gameMode === 'time_attack' || quizConfig?.timeLimitPerQuestion) && questionTimer > 0) {
      const interval = setInterval(() => {
        setQuestionTimer(prev => {
          if (prev <= 1) {
            clearInterval(interval);

            if (gameMode === 'time_attack') {
              // Time Attack Over!
              setQuizComplete(true);
              setQuestionTimeExpired(true);
              return 0;
            } else {
              // Standard Question Timeout
              setQuestionTimeExpired(true);
              if (quizConfig?.immediateFeedback) setShowResult(true);
              return 0;
            }
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [gameMode, quizConfig, showResult, quizComplete, questionTimer]);

  // Actual Generation when Config is ready (or if we want to support auto-start later)
  const generateCustomQuiz = async (config: QuizConfig) => {
    if (!user || !studySetId) return;

    setQuizLoading(true);
    setShowQuizConfig(false);

    try {
      console.log('Generating CUSTOM quiz with config:', config);
      const adaptiveQuestions = await generateAdaptiveQuiz(studySetId, user.id, config);

      if (adaptiveQuestions && adaptiveQuestions.length > 0) {
        const mappedQuestions: QuizQuestion[] = adaptiveQuestions.map((q, i) => {
          // Validate special question types have required fields
          let questionType = q.type as any;

          // If ordering type but no items, convert to multiple_choice
          if (questionType === 'ordering' && (!q.orderingItems || q.orderingItems.length === 0)) {
            console.warn('[Quiz] Ordering question missing items, converting to multiple_choice');
            questionType = 'multiple_choice';
          }

          // If matching type but no pairs, convert to multiple_choice
          if (questionType === 'matching' && (!q.matchingPairs || q.matchingPairs.length === 0)) {
            console.warn('[Quiz] Matching question missing pairs, converting to multiple_choice');
            questionType = 'multiple_choice';
          }

          // If fill_blank but no text, convert to multiple_choice
          if (questionType === 'fill_blank' && !q.fillBlankText) {
            console.warn('[Quiz] Fill blank question missing text, converting to multiple_choice');
            questionType = 'multiple_choice';
          }

          // If identify_error but no error text, convert to multiple_choice
          if (questionType === 'identify_error' && !q.errorText) {
            console.warn('[Quiz] Identify error question missing text, converting to multiple_choice');
            questionType = 'multiple_choice';
          }

          // If exercise type but no problem/solution, convert to multiple_choice
          if (questionType === 'exercise' && (!q.exerciseProblem || !q.exerciseSolution)) {
            console.warn('[Quiz] Exercise question missing problem/solution, converting to multiple_choice');
            questionType = 'multiple_choice';
          }

          return {
            id: q.id,
            question: q.question,
            options: q.options || [],
            correctIndex: q.correctIndex || 0,
            explanation: q.explanation,
            type: questionType,
            scenario: q.scenario,
            designPrompt: q.designPrompt,
            evaluationCriteria: q.evaluationCriteria,
            realWorldExample: q.realWorldExample,
            // God Mode Mappings
            orderingItems: q.orderingItems,
            matchingPairs: q.matchingPairs,
            fillBlankText: q.fillBlankText,
            fillBlankAnswers: q.fillBlankAnswers,
            errorText: q.errorText,
            // Exercise type mappings
            exerciseProblem: q.exerciseProblem,
            exerciseSolution: q.exerciseSolution,
            exerciseSteps: q.exerciseSteps,
            exerciseType: q.exerciseType,
            exerciseTemplateId: q.exerciseTemplateId
          };
        });

        setQuizQuestions(mappedQuestions);
        setQuizGenerated(true);
        setQuizConfig(config); // Save for timer logic

        // Initialize God Mode States
        if (config.gameMode) setGameMode(config.gameMode);
        if (config.persona) setPersona(config.persona);

        // Initialize Time Attack
        if (config.gameMode === 'time_attack') {
          const timeLimit = 120; // 2 minutes for time attack? Should be configurable or fixed
          setTimeRemaining(timeLimit);
          setQuestionTimer(timeLimit); // Reuse question timer variable for simplicity
        } else if (config.timeLimitPerQuestion) {
          setTimeRemaining(config.timeLimitPerQuestion);
        }
        setQuizStartTime(Date.now());
        setQuizResults([]);
        setQuizConfig(config);

        // Setup first question timer if enabled
        if (config.timeLimitPerQuestion && config.timeLimitPerQuestion > 0) {
          setQuestionTimer(config.timeLimitPerQuestion);
          setQuestionTimeExpired(false);
        }
      }
    } catch (e) {
      console.error("Custom quiz gen error", e);
    } finally {
      setQuizLoading(false);
    }
  };


  // Exam timer
  useEffect(() => {
    if (mode === 'exam' && !examSubmitted && examTime > 0) {
      const timer = setInterval(() => {
        setExamTime((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(timer);
    }
    if (examTime === 0 && !examSubmitted) {
      handleExamSubmit();
    }
  }, [mode, examTime, examSubmitted]);

  // Daily Session timer
  useEffect(() => {
    if (mode === 'daily' && dailySessionActive && !dailySessionComplete && dailySessionTime > 0) {
      const timer = setInterval(() => {
        setDailySessionTime((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(timer);
    }
    if (dailySessionTime === 0 && !dailySessionComplete && mode === 'daily') {
      setDailySessionComplete(true);
      setShowConfetti(true);
    }
  }, [mode, dailySessionTime, dailySessionActive, dailySessionComplete]);

  // Start daily session when mode changes to daily
  useEffect(() => {
    if (mode === 'daily' && !dailySessionActive && !dailySessionComplete) {
      setDailySessionActive(true);
      setDailySessionTime(15 * 60);
      setDailyQuestionsAnswered(0);
    }
  }, [mode]);


  // Initialize timer for first card
  useEffect(() => {
    if (!loading && flashcards.length > 0) {
      setResponseStartTime(Date.now());
    }
  }, [loading, flashcards.length]);

  const handleRate = async (rating: Rating) => {
    if (isProcessing || !user || !flashcards[currentIndex]?.id) return;
    setIsProcessing(true);

    const responseTime = Date.now() - responseStartTime;

    // Always track XP and correct count locally
    // Rating 3 (Good) and 4 (Easy) are considered "Correct"
    if (rating >= 3) {
      setXpEarned(prev => prev + 10);
      setCorrectFlashcards(prev => prev + 1);
      setStreak(s => s + 1);
      triggerConfetti();
    } else {
      setStreak(0);
      // Track failed cards for regression handling
      setFailedCardIds(prev => [...prev, flashcards[currentIndex].id]);
    }

    // Update Adaptive SRS system
    try {
      console.log(`[SRS] Updating card ${flashcards[currentIndex].id} with rating ${rating}`);
      await updateCardAfterReview(
        user.id,
        flashcards[currentIndex].id,
        rating,
        responseTime
      );

      // Update mastery level system
      const masteryResult = await updateFlashcardMastery(
        user.id,
        flashcards[currentIndex].id,
        rating >= 3 // correct if rating is Good or Easy
      );
      setCurrentMasteryResult(masteryResult);

      // Show level up notification if level changed
      if (masteryResult.level_changed && masteryResult.new_level > masteryResult.previous_level) {
        setShowLevelUp(true);
      }
    } catch (error) {
      console.error('Error updating SRS/Mastery progress:', error);
    }

    // Move to next
    setIsFlipped(false);
    if (currentIndex < flashcards.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setResponseStartTime(Date.now()); // Reset timer
      setTimeout(() => setIsProcessing(false), 300);
    } else {
      // Session complete!
      if (mode === 'cramming') {
        const result = {
          totalCards: flashcards.length,
          correct: correctFlashcards + (rating >= 3 ? 1 : 0),
          wrong: flashcards.length - (correctFlashcards + (rating >= 3 ? 1 : 0)),
          skipped: 0
        };
        // TODO: Save cramming result if needed
      }

      setFlashcardsComplete(true);
      setShowConfetti(true);

      // Award XP
      try {
        const finalXp = xpEarned + (rating >= 3 ? 10 : 0);
        await GamificationService.awardXP(user.id, finalXp);
        await GamificationService.updateStreak(user.id);

        // Update consecutive correct counter
        await updateConsecutiveCorrect(user.id, flashcards[currentIndex].id, rating >= 3);

        // Trigger dynamic content generation if study set exists
        if (studySetId) {
          setGeneratingNewContent(true);
          const correctRate = (correctFlashcards + (rating >= 3 ? 1 : 0)) / flashcards.length;

          // Check if session was successful (progression) or struggling (regression)
          if (correctRate >= 0.8) {
            // Successful session - try to generate harder content
            const result = await handleSessionComplete(user.id, studySetId, {
              correctRate,
              cardsStudied: flashcards.length
            });

            if (result.newCardsGenerated > 0) {
              const tierName = DIFFICULTY_TIERS[result.newTier!]?.name || 'nuevo';
              setNewContentMessage(
                `🎉 ¡Has dominado ${result.archivedCount} tarjetas! Se generaron ${result.newCardsGenerated} preguntas nivel "${tierName}".`
              );
            }
          } else if (correctRate < 0.5) {
            // Struggling session - bring back easier content
            const regressionResult = await handleStrugglingSession(
              user.id,
              studySetId,
              { correctRate, cardsStudied: flashcards.length },
              failedCardIds
            );

            if (regressionResult.message) {
              setRegressionMessage(regressionResult.message);
            }
          }

          setGeneratingNewContent(false);
        }
      } catch (error) {
        console.error('Error in session completion:', error);
        setGeneratingNewContent(false);
      }
      setIsProcessing(false);
    }
  };

  // Legacy handlers for backward compatibility or Cramming mode if strictly required
  // But we will prefer SRS buttons for 'flashcards' mode
  const handleKnow = async () => handleRate(3);
  const handleDontKnow = async () => handleRate(1);

  const nextCard = () => {
    setIsFlipped(false);
    if (currentIndex < flashcards.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setTimeout(() => setIsProcessing(false), 300); // Small delay to prevent accidental double taps
    } else {
      // Session complete!
      if (mode === 'cramming') {
        setCrammingComplete(true);
      } else {
        setFlashcardsComplete(true);
      }
    }
  };

  const triggerConfetti = () => {
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 2000);
  };

  // Timer Effect
  // Timer Effect handled in new effect block
  /* 
  useEffect(() => {
    ...
  }, ...);
  */


  const handleQuizAnswer = (optionIndex: number, textAnswer?: string, isTimeout: boolean = false, isCorrectOverride?: boolean) => {
    // Prevent answer if result is already shown (unless it's a timeout forcing it)
    if (showResult && !isTimeout) return;

    // If we have a timeout but user answered, that's fine, we process it.

    setSelectedAnswer(optionIndex);

    // Logic for "Immediate Feedback" toggle
    const feedbackMode = quizConfig?.immediateFeedback ?? true;

    if (feedbackMode) {
      setShowResult(true);
    } else {
      // If NO immediate feedback, we just record and maybe auto-advance or wait for user to click separate "Next"
      // For flow, let's just set selectedAnswer. The UI needs to show "Next" button instead of "Check"
    }

    const currentQ = quizQuestions[currentQuizIndex];
    // Note: correctIndex check
    let isCorrect = false;
    if (isCorrectOverride !== undefined) {
      isCorrect = isCorrectOverride;
    } else if (!isTimeout && optionIndex !== -1) {
      isCorrect = optionIndex === currentQ.correctIndex;
    }

    // Track this result
    const result: QuizResult = {
      questionIndex: currentQuizIndex,
      question: currentQ.question,
      userAnswerIndex: optionIndex,
      correctAnswerIndex: currentQ.correctIndex,
      isCorrect,
      topic: (currentQ as any).topic || 'General',
      textAnswer: textAnswer
    };
    setQuizResults(prev => [...prev, result]);

    if (isCorrect) {
      setScore(score + 1);
      setXpEarned(prev => prev + 20);
      if (feedbackMode) triggerConfetti();

      // Update Adaptive SRS
      if (user && flashcards[currentQuizIndex]?.id) {
        updateCardAfterReview(user.id, flashcards[currentQuizIndex].id, 4, 5000).catch(console.error);
      }
    } else {
      // Update Adaptive SRS
      if (user && flashcards[currentQuizIndex]?.id) {
        updateCardAfterReview(user.id, flashcards[currentQuizIndex].id, 1, 5000).catch(console.error);
      }
    }

    // If deferred feedback, we might want to auto-advance or let user click Next.
    // Let's wait for Next click in UI.
  };

  const nextQuizQuestion = async () => {
    if (currentQuizIndex < quizQuestions.length - 1) {
      setCurrentQuizIndex(currentQuizIndex + 1);
      setSelectedAnswer(null);
      setShowResult(false);
      setDesignAnswer(''); // Reset design answer
      setFillBlankAnswer('');
      setOrderingState([]);
      setMatchingState({});
      setExerciseAnswer('');
      setShowExerciseSolution(false);
      setSelectedErrorOption(null);

      // Reset Timer
      if (gameMode !== 'time_attack' && quizConfig?.timeLimitPerQuestion) {
        setQuestionTimer(quizConfig.timeLimitPerQuestion);
        setQuestionTimeExpired(false);
      }
    } else {
      // Quiz complete - save session and generate report
      setQuizComplete(true);

      if (user && studySetId && quizResults.length > 0) {
        const durationSeconds = Math.floor((Date.now() - quizStartTime) / 1000);

        const report = await saveQuizSession(
          user.id,
          studySetId,
          quizQuestions as any,
          quizResults,
          durationSeconds
        );

        if (report) {
          setQuizReport(report);
          console.log('Quiz report saved:', report);
        }
      }
    }
  };

  const handleExamSubmit = async () => {
    let examScore = 0;
    examAnswers.forEach((answer, i) => {
      if (answer === quizQuestions[i].correctIndex) {
        examScore++;
        // Update Adaptive SRS for correct answer
        if (user && flashcards[i]?.id) {
          updateCardAfterReview(user.id, flashcards[i].id, 4, 3000).catch(console.error);
        }
      } else {
        // Update Adaptive SRS for incorrect answer
        if (user && flashcards[i]?.id) {
          updateCardAfterReview(user.id, flashcards[i].id, 1, 3000).catch(console.error);
        }
      }
    });
    setScore(examScore);
    setXpEarned(examScore * 25);
    setExamSubmitted(true);

    // Log study session
    if (user && classId) {
      try {
        await supabase.from('study_sessions').insert({
          student_id: user.id,
          class_id: classId,
          mode: 'exam',
          duration_minutes: Math.floor((15 * 60 - examTime) / 60),
          cards_reviewed: quizQuestions.length,
          correct_count: examScore,
          xp_earned: examScore * 25
        });

        // Update user XP
        if (profile) {
          await supabase.from('profiles').update({
            xp: (profile.xp || 0) + (examScore * 25)
          }).eq('id', user.id);
        }
      } catch (error) {
        console.error('Error logging session:', error);
      }
    }
  };

  // End session: award XP and update streak
  const handleEndSession = async () => {
    console.log('=== handleEndSession called ===');
    console.log('User:', user?.id);
    console.log('XP Earned in session:', xpEarned);

    if (!user) {
      console.log('No user found, navigating back');
      navigate(-1);
      return;
    }

    try {
      // Calculate XP: xpEarned already tracks session XP (10 per correct flashcard, 25 per correct exam question)
      if (xpEarned > 0) {
        console.log('Calling awardXP with:', user.id, xpEarned);
        const newTotal = await GamificationService.awardXP(user.id, xpEarned);
        console.log('awardXP result - new total XP:', newTotal);
      } else {
        console.log('XP is 0, skipping awardXP');
      }

      // Update streak
      await GamificationService.updateStreak(user.id);

      // Check for unlocked achievements
      const unlocked = await GamificationService.checkAndUnlockAchievements(user.id);

      if (unlocked.length > 0) {
        // Trigger confetti again for achievement
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 5000);

        // Show alert/toast for the first unlocked achievement
        const ach = unlocked[0];
        alert(`🏆 ¡Logro Desbloqueado: ${ach.name}!\n\n${ach.description}\n+${ach.xp_reward} XP`);
      }

      navigate(-1);
    } catch (error) {
      console.error('ERROR in handleEndSession:', error);
      navigate(-1);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen gradient-hero flex flex-col items-center justify-center text-white gap-6 p-8">
        <div className="w-16 h-16 border-4 border-white/40 border-t-white rounded-full animate-spin"></div>
        <p className="text-xl font-bold">
          {loadingSource === 'db' && 'Cargando flashcards...'}
          {loadingSource === 'ai' && 'IA generando tu sesión personalizada...'}
          {loadingSource === 'mock' && 'Preparando sesión de estudio...'}
        </p>
        {className && <p className="text-blue-100">{className}</p>}
      </div>
    );
  }

  return (
    <div className={`fixed inset-0 w-full h-full flex flex-col overflow-hidden ${mode === 'cramming' ? 'bg-gradient-to-br from-rose-600 to-orange-500' : 'gradient-hero'}`}>
      {/* Confetti Animation */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none z-50">
          {[...Array(30)].map((_, i) => (
            <div
              key={i}
              className="absolute animate-fall"
              style={{
                left: `${Math.random() * 100}%`,
                top: `-20px`,
                animation: `fall ${1 + Math.random()}s linear forwards`,
                animationDelay: `${Math.random() * 0.5}s`
              }}
            >
              <div
                className={`w-3 h-3 ${['bg-yellow-400', 'bg-pink-500', 'bg-blue-500', 'bg-green-500'][Math.floor(Math.random() * 4)]}`}
                style={{ transform: `rotate(${Math.random() * 360}deg)` }}
              ></div>
            </div>
          ))}
        </div>
      )}

      {/* Header */}
      <header className="relative z-40 px-4 py-3 md:p-6 flex items-center justify-between text-white shrink-0">
        <button onClick={handleEndSession} className="flex items-center gap-2 font-medium hover:opacity-80">
          <span className="material-symbols-outlined">close</span>
          <span className="hidden md:inline">Finalizar Sesión</span>
        </button>
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-full hover:bg-white/10 transition-colors"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div className="flex flex-col">
            <h1 className="text-xl md:text-2xl font-black tracking-tight">{className}</h1>
            <p className="text-sm opacity-80 flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">school</span>
              Sesión de Estudio
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {studySetId && (
            <button
              onClick={() => {
                console.log('Stats button clicked, toggling showStats from', showStats, 'to', !showStats);
                setShowStats(!showStats);
              }}
              className="hidden md:flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-semibold transition-colors backdrop-blur-md border border-white/20 cursor-pointer relative z-50"
            >
              <span className="material-symbols-outlined text-sm">analytics</span>
              Estadísticas
            </button>
          )}

          <div className="flex items-center gap-2 bg-black/20 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
            <span className="material-symbols-outlined text-yellow-400 text-sm">local_fire_department</span>
            <span className="font-bold text-sm">{streak}</span>
          </div>
          <div className="flex items-center gap-2 bg-black/20 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
            <span className="font-bold text-sm">{profile?.xp || 0} XP</span>
          </div>
        </div>
      </header>

      {/* Mode Selector */}
      {!loading && (
        <div className="flex justify-center px-4 mb-2 md:mb-6 w-full shrink-0">
          <div className="flex overflow-x-auto max-w-full p-1 rounded-xl bg-white/20 scrollbar-hide">
            {[
              { id: 'flashcards', label: 'Flashcards', icon: 'style' },
              { id: 'quiz', label: 'Quiz', icon: 'quiz' },
              { id: 'cramming', label: 'Cramming', icon: 'bolt' },
              { id: 'podcast', label: 'Podcast', icon: 'headphones' }
            ].map((m) => (
              <button
                key={m.id}
                onClick={() => {
                  setMode(m.id as StudyMode);
                  setCurrentIndex(0);
                  setCurrentQuizIndex(0);
                  setQuizComplete(false);
                  setExamSubmitted(false);
                  setExamTime(15 * 60);
                  setScore(0);
                  setNoCardsDue(false);
                }}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg font-bold text-sm transition-all whitespace-nowrap flex-shrink-0 ${mode === m.id
                  ? 'bg-white text-primary shadow-sm'
                  : 'text-white/80 hover:text-white hover:bg-white/10'
                  }`}
              >
                <span className="material-symbols-outlined text-lg">{m.icon}</span>
                <span className="hidden sm:inline">{m.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Quiz Config Modal */}
      {showQuizConfig && user && studySetId && (
        <QuizConfigModal
          studySetId={studySetId}
          userId={user.id}
          onStart={generateCustomQuiz}
          onCancel={() => {
            setShowQuizConfig(false);
            navigate(-1); // Go back if cancelled
          }}
        />
      )}

      {/* Main Content */}
      <main className="flex-1 w-full min-h-0 overflow-y-auto relative z-0 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
        <div className="flex flex-col items-center justify-center min-h-full w-full px-2 md:px-4 py-6 md:py-10">

          {/* No Cards Due - Caught Up Screen */}
          {noCardsDue && (
            <div className="w-full max-w-md text-center animate-fade-in-up">
              <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl p-8 border border-white/50">
                <div className="w-24 h-24 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-200">
                  <span className="material-symbols-outlined text-5xl text-white">check_circle</span>
                </div>
                <h2 className="text-3xl font-black text-slate-800 mb-3">¡Todo al día!</h2>
                <p className="text-slate-600 mb-8 leading-relaxed">
                  Has repasado todas tus tarjetas pendientes. El sistema SR (Repetición Espaciada) te avisará cuando sea el momento óptimo para repasar de nuevo.
                </p>

                {/* Mode Navigation */}
                <div className="grid grid-cols-3 gap-3 mb-6">
                  <button
                    onClick={() => { setNoCardsDue(false); setMode('flashcards'); }}
                    className="bg-indigo-600 text-white font-bold py-3 px-4 rounded-xl hover:bg-indigo-700 transition flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-lg">style</span>
                    Flashcards
                  </button>
                  <button
                    onClick={() => { setNoCardsDue(false); setMode('quiz'); }}
                    className="bg-purple-600 text-white font-bold py-3 px-4 rounded-xl hover:bg-purple-700 transition flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-lg">quiz</span>
                    Quiz
                  </button>
                  <button
                    onClick={() => { setNoCardsDue(false); setMode('cramming'); }}
                    className="bg-teal-600 text-white font-bold py-3 px-4 rounded-xl hover:bg-teal-700 transition flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-lg">speed</span>
                    Cramming
                  </button>
                </div>

                <div className="space-y-4">
                  <button
                    onClick={() => navigate('/classes')}
                    className="w-full bg-slate-100 text-slate-700 font-bold py-4 rounded-xl hover:bg-slate-200 transition flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined">arrow_back</span>
                    Volver al inicio
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Daily Session Mode */}
          {mode === 'daily' && !dailySessionComplete && (
            <>
              {/* Timer and Progress Header */}
              <div className="w-full max-w-lg mb-6">
                <div className="bg-white/90 backdrop-blur-xl rounded-2xl p-4 shadow-lg border border-white/50">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-indigo-500">timer</span>
                      <span className="text-2xl font-black text-slate-900">
                        {Math.floor(dailySessionTime / 60)}:{(dailySessionTime % 60).toString().padStart(2, '0')}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-slate-500">Pregunta</div>
                      <div className="text-lg font-bold text-slate-900">{currentIndex + 1} / {Math.min(flashcards.length, DAILY_SESSION_QUESTIONS)}</div>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-300"
                      style={{ width: `${(dailySessionTime / (15 * 60)) * 100}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Flashcard */}
              <div
                onClick={() => setIsFlipped(!isFlipped)}
                className="w-full max-w-lg flex-1 min-h-0 md:flex-none md:h-auto md:aspect-[4/3] cursor-pointer perspective-1000"
              >
                <div className={`relative w-full h-full transition-transform duration-500 transform-style-3d ${isFlipped ? 'rotate-y-180' : ''}`}>
                  {/* Front */}
                  <div className="absolute w-full h-full bg-white rounded-3xl shadow-2xl flex flex-col items-center justify-center p-5 md:p-8 backface-hidden overflow-y-auto hide-scrollbar">
                    <div className="flex items-center gap-3 mb-4 flex-shrink-0">
                      <span className="bg-indigo-100 text-indigo-600 text-xs font-bold px-3 py-1 rounded-full uppercase">{flashcards[currentIndex]?.category}</span>
                      <span className="bg-amber-100 text-amber-600 text-xs font-bold px-2 py-1 rounded-full">Sesión Diaria</span>
                    </div>
                    <h2 className="text-lg md:text-3xl font-black text-center text-slate-900 leading-snug overflow-y-auto max-h-full py-2">{flashcards[currentIndex]?.question}</h2>
                    <p className="text-sm text-slate-400 mt-6 flex items-center gap-1 flex-shrink-0">
                      <span className="material-symbols-outlined text-sm">touch_app</span> Toca para girar
                    </p>
                  </div>
                  {/* Back */}
                  <div className="absolute w-full h-full bg-white rounded-3xl shadow-2xl flex flex-col items-center justify-center p-8 backface-hidden rotate-y-180 overflow-y-auto hide-scrollbar">
                    <span className="bg-emerald-100 text-emerald-600 text-xs font-bold px-3 py-1 rounded-full uppercase mb-4 flex-shrink-0">Respuesta</span>
                    <p className="text-lg md:text-xl text-center text-slate-700 leading-relaxed overflow-y-auto max-h-full py-2">{flashcards[currentIndex]?.answer}</p>
                  </div>
                </div>
              </div>

              {/* Rating Buttons */}
              {isFlipped && (
                <div className="mt-2 md:mt-8 w-full max-w-lg shrink-0">
                  <SRSRatingButtons
                    onRate={(rating) => {
                      handleRate(rating);
                      setDailyQuestionsAnswered(prev => prev + 1);
                      // Check if we've reached the target questions or end of cards
                      if (currentIndex + 1 >= Math.min(flashcards.length, DAILY_SESSION_QUESTIONS)) {
                        setDailySessionComplete(true);
                        setShowConfetti(true);
                      }
                    }}
                    disabled={isProcessing}
                    cardState="new"
                  />
                </div>
              )}
            </>
          )}

          {/* Daily Session Complete */}
          {mode === 'daily' && dailySessionComplete && (
            <div className="w-full max-w-md animate-fade-in-up">
              <div className="bg-white rounded-3xl shadow-2xl p-8 text-center">
                <div className="w-20 h-20 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-6">
                  <span className="material-symbols-outlined text-4xl text-white">event_available</span>
                </div>
                <h2 className="text-3xl font-black text-slate-900 mb-2">¡Sesión Diaria Completada!</h2>
                <p className="text-slate-500 mb-6">15 minutos de estudio efectivo</p>

                <div className="grid grid-cols-3 gap-3 mb-8">
                  <div className="bg-indigo-50 rounded-xl p-4">
                    <div className="text-2xl font-black text-indigo-600">{dailyQuestionsAnswered}</div>
                    <div className="text-xs text-indigo-500 font-bold">PREGUNTAS</div>
                  </div>
                  <div className="bg-emerald-50 rounded-xl p-4">
                    <div className="text-2xl font-black text-emerald-600">{correctFlashcards}</div>
                    <div className="text-xs text-emerald-500 font-bold">CORRECTAS</div>
                  </div>
                  <div className="bg-amber-50 rounded-xl p-4">
                    <div className="text-2xl font-black text-amber-600">+{xpEarned}</div>
                    <div className="text-xs text-amber-500 font-bold">XP</div>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-indigo-100 to-purple-100 rounded-xl p-4 mb-6">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <span className="material-symbols-outlined text-indigo-500">calendar_today</span>
                    <span className="text-lg font-bold text-indigo-600">Racha mantenida</span>
                  </div>
                  <p className="text-sm text-indigo-500">Vuelve mañana para otra sesión diaria</p>
                </div>

                <button
                  onClick={handleEndSession}
                  className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold py-4 rounded-xl hover:opacity-90 transition shadow-lg"
                >
                  Finalizar
                </button>
              </div>
            </div>
          )}

          {/* Flashcards Mode */}
          {mode === 'flashcards' && !flashcardsComplete && !noCardsDue && (
            <>
              {/* Progress Counter */}
              <div className="w-full max-w-lg mb-4">
                <div className="bg-white/90 backdrop-blur-xl rounded-2xl px-4 py-3 shadow-lg border border-white/50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-blue-500">style</span>
                    <span className="text-sm font-medium text-slate-600">Flashcards</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-lg font-bold text-slate-900">{currentIndex + 1} / {flashcards.length}</div>
                    </div>
                    {/* Mini progress bar */}
                    <div className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-300"
                        style={{ width: `${((currentIndex + 1) / flashcards.length) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div
                onClick={() => setIsFlipped(!isFlipped)}
                className="w-full max-w-lg aspect-[3/4] md:aspect-[4/3] cursor-pointer perspective-1000"
              >
                <div className={`relative w-full h-full transition-transform duration-500 transform-style-3d ${isFlipped ? 'rotate-y-180' : ''}`}>
                  {/* Front */}
                  <div className="absolute w-full h-full bg-white rounded-3xl shadow-2xl flex flex-col items-center justify-center p-5 md:p-8 backface-hidden overflow-y-auto hide-scrollbar">
                    <div className="flex items-center gap-3 mb-4 flex-shrink-0">
                      <span className="bg-blue-100 text-blue-600 text-xs font-bold px-3 py-1 rounded-full uppercase">{flashcards[currentIndex]?.category}</span>
                      {currentMasteryResult && (
                        <DifficultyLevelIndicator
                          level={currentMasteryResult.new_level}
                          masteryPercent={currentMasteryResult.mastery_percent}
                          size="sm"
                          showLabel={false}
                        />
                      )}
                    </div>
                    <h2 className="text-lg md:text-3xl font-black text-center text-slate-900 leading-snug overflow-y-auto max-h-full py-2">{flashcards[currentIndex]?.question}</h2>
                    <p className="text-sm text-slate-400 mt-6 flex items-center gap-1 flex-shrink-0">
                      <span className="material-symbols-outlined text-sm">touch_app</span> Toca para girar
                    </p>
                  </div>
                  {/* Back */}
                  <div className="absolute w-full h-full bg-white rounded-3xl shadow-2xl flex flex-col items-center justify-center p-8 backface-hidden rotate-y-180 overflow-y-auto hide-scrollbar">
                    <span className="bg-emerald-100 text-emerald-600 text-xs font-bold px-3 py-1 rounded-full uppercase mb-4 flex-shrink-0">Respuesta</span>
                    <p className="text-lg md:text-xl text-center text-slate-700 leading-relaxed overflow-y-auto max-h-full py-2">{flashcards[currentIndex]?.answer}</p>
                  </div>
                </div>
              </div>

              {/* Rating Buttons (Adaptive Mode style) */}
              {isFlipped && (
                <div className="mt-2 md:mt-8 w-full max-w-lg shrink-0">
                  <SRSRatingButtons
                    onRate={handleRate}
                    disabled={isProcessing}
                    cardState="new"
                  />
                </div>
              )}

            </>
          )}

          {/* Flashcards Complete Screen */}
          {mode === 'flashcards' && flashcardsComplete && (
            <div className="w-full max-w-md">
              <div className="bg-white rounded-3xl shadow-2xl p-8 text-center">
                <div className="w-20 h-20 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full flex items-center justify-center mx-auto mb-6">
                  <span className="material-symbols-outlined text-4xl text-white">celebration</span>
                </div>
                <h2 className="text-3xl font-black text-slate-900 mb-2">¡Sesión Completada!</h2>
                <p className="text-slate-500 mb-6">Has terminado todas las flashcards</p>

                <div className="grid grid-cols-2 gap-4 mb-8">
                  <div className="bg-violet-50 rounded-xl p-4">
                    <div className="text-3xl font-black text-violet-600">+{xpEarned}</div>
                    <div className="text-xs text-violet-500 font-bold">XP GANADOS</div>
                  </div>
                  <div className="bg-amber-50 rounded-xl p-4">
                    <div className="text-3xl font-black text-amber-600">{correctFlashcards}/{flashcards.length}</div>
                    <div className="text-xs text-amber-500 font-bold">CORRECTAS</div>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-orange-100 to-red-100 rounded-xl p-4 mb-6">
                  <div className="flex items-center justify-center gap-2">
                    <span className="material-symbols-outlined text-orange-500">local_fire_department</span>
                    <span className="text-lg font-bold text-orange-600">Racha activada</span>
                  </div>
                </div>

                {/* Dynamic Content Generation Notification */}
                {generatingNewContent && (
                  <div className="bg-gradient-to-r from-indigo-100 to-purple-100 rounded-xl p-4 mb-6 animate-pulse">
                    <div className="flex items-center justify-center gap-2">
                      <span className="material-symbols-outlined text-indigo-500 animate-spin">autorenew</span>
                      <span className="text-lg font-bold text-indigo-600">Generando nuevas preguntas...</span>
                    </div>
                  </div>
                )}

                {newContentMessage && (
                  <div className="bg-gradient-to-r from-emerald-100 to-teal-100 rounded-xl p-4 mb-6">
                    <div className="flex items-center justify-center gap-2">
                      <span className="material-symbols-outlined text-emerald-500">auto_awesome</span>
                      <span className="text-sm font-bold text-emerald-700">{newContentMessage}</span>
                    </div>
                  </div>
                )}

                {/* Regression Notification - when user is struggling */}
                {regressionMessage && (
                  <div className="bg-gradient-to-r from-amber-100 to-orange-100 rounded-xl p-4 mb-6">
                    <div className="flex items-center justify-center gap-2">
                      <span className="material-symbols-outlined text-amber-600">psychology_alt</span>
                      <span className="text-sm font-bold text-amber-700">{regressionMessage}</span>
                    </div>
                  </div>
                )}

                <button
                  onClick={handleEndSession}
                  className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-bold py-4 rounded-xl hover:opacity-90 transition"
                >
                  Finalizar y Guardar Progreso
                </button>
              </div>
            </div>
          )}

          {/* Quiz Mode */}
          {mode === 'quiz' && !quizComplete && (
            <div className="w-full max-w-2xl">
              {quizLoading ? (
                <div className="bg-white rounded-3xl shadow-2xl p-8 text-center">
                  <div className="animate-pulse">
                    <div className="w-16 h-16 bg-violet-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <span className="material-symbols-outlined text-3xl text-violet-600 animate-spin">sync</span>
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mb-2">Generando Quiz...</h3>
                    <p className="text-slate-500">Creando preguntas basadas en el contenido del set</p>
                  </div>
                </div>
              ) : quizQuestions.length === 0 ? (
                <div className="bg-white rounded-3xl shadow-2xl p-8 text-center animate-fade-in-up">
                  <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="material-symbols-outlined text-3xl text-red-600">error</span>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">No pudimos generar el quiz</h3>
                  <p className="text-slate-500 mb-6">Hubo un problema al crear las preguntas con IA. Por favor, intenta de nuevo.</p>
                  <button
                    onClick={() => setQuizGenerated(false)}
                    className="px-6 py-3 bg-violet-600 text-white font-bold rounded-xl hover:bg-violet-700 transition-colors shadow-lg hover:shadow-xl"
                  >
                    Intentar Nuevamente
                  </button>
                </div>
              ) : (
                <div className="bg-white rounded-3xl shadow-2xl p-8">
                  {/* Question header with type badge */}
                  <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="bg-violet-100 text-violet-600 text-xs font-bold px-3 py-1 rounded-full">
                        Pregunta {currentQuizIndex + 1}/{quizQuestions.length}
                      </span>
                      <span className={`text-xs font-bold px-3 py-1 rounded-full ${quizQuestions[currentQuizIndex]?.type === 'true_false' ? 'bg-emerald-100 text-emerald-600' :
                        quizQuestions[currentQuizIndex]?.type === 'analysis' ? 'bg-amber-100 text-amber-600' :
                          (quizQuestions[currentQuizIndex]?.type === 'design' || quizQuestions[currentQuizIndex]?.options?.[0]?.includes('solución')) ? 'bg-purple-100 text-purple-600' :
                            quizQuestions[currentQuizIndex]?.type === 'practical' ? 'bg-cyan-100 text-cyan-600' :
                              'bg-blue-100 text-blue-600'
                        }`}>
                        {quizQuestions[currentQuizIndex]?.type === 'true_false' ? '✓✗ V/F' :
                          quizQuestions[currentQuizIndex]?.type === 'analysis' ? '🔍 Análisis' :
                            (quizQuestions[currentQuizIndex]?.type === 'design' || quizQuestions[currentQuizIndex]?.options?.[0]?.includes('solución')) ? '✏️ Diseño' :
                              quizQuestions[currentQuizIndex]?.type === 'ordering' ? '⚡ Ordenar' :
                                quizQuestions[currentQuizIndex]?.type === 'matching' ? '🔗 Relacionar' :
                                  quizQuestions[currentQuizIndex]?.type === 'fill_blank' ? '✍️ Completar' :
                                    quizQuestions[currentQuizIndex]?.type === 'identify_error' ? '🚫 Error' :
                                      quizQuestions[currentQuizIndex]?.type === 'practical' ? '🚀 Aplicación' :
                                        quizQuestions[currentQuizIndex]?.type === 'exercise' ? '📐 Ejercicio' : '📝 Opción Múltiple'}
                      </span>
                    </div>

                    {/* TIMER Display */}
                    {(gameMode === 'time_attack' || quizConfig?.timeLimitPerQuestion) && (
                      <div className={`flex items-center gap-2 px-3 py-1 rounded-full font-mono font-bold ${questionTimer < 10 ? 'bg-red-100 text-red-600 animate-pulse' :
                        'bg-slate-100 text-slate-600'
                        }`}>
                        <span className="material-symbols-outlined text-sm">timer</span>
                        {gameMode === 'time_attack' ? (
                          <span>{Math.floor(questionTimer / 60)}:{(questionTimer % 60).toString().padStart(2, '0')}</span>
                        ) : (
                          <span>{questionTimer}s</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Scenario for analysis questions */}
                  {quizQuestions[currentQuizIndex]?.type === 'analysis' && quizQuestions[currentQuizIndex]?.scenario && (
                    <div className="mb-6 p-4 bg-amber-50 border-l-4 border-amber-400 rounded-r-xl">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="material-symbols-outlined text-amber-600">cases</span>
                        <span className="font-bold text-amber-700">Escenario</span>
                      </div>
                      <p className="text-slate-700 text-sm leading-relaxed">{quizQuestions[currentQuizIndex].scenario}</p>
                    </div>
                  )}

                  {/* Real-world example for practical questions */}
                  {quizQuestions[currentQuizIndex]?.type === 'practical' && quizQuestions[currentQuizIndex]?.realWorldExample && (
                    <div className="mb-6 p-4 bg-cyan-50 border-l-4 border-cyan-400 rounded-r-xl">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="material-symbols-outlined text-cyan-600">public</span>
                        <span className="font-bold text-cyan-700">Ejemplo del Mundo Real</span>
                      </div>
                      <p className="text-slate-700 text-sm leading-relaxed">{quizQuestions[currentQuizIndex].realWorldExample}</p>
                    </div>
                  )}

                  <h2 className="text-2xl font-black text-slate-900 mb-8">{quizQuestions[currentQuizIndex]?.question}</h2>

                  {/* TRUE/FALSE TYPE - Large V/F buttons */}
                  {quizQuestions[currentQuizIndex]?.type === 'true_false' ? (
                    <div className="grid grid-cols-2 gap-4">
                      {['Verdadero', 'Falso'].map((option, i) => (
                        <button
                          key={i}
                          onClick={() => handleQuizAnswer(i)}
                          disabled={showResult}
                          className={`p-8 rounded-2xl font-bold text-xl transition-all flex flex-col items-center justify-center gap-3 ${showResult
                            ? i === quizQuestions[currentQuizIndex].correctIndex
                              ? 'bg-emerald-100 text-emerald-700 border-4 border-emerald-500 scale-105'
                              : selectedAnswer === i
                                ? 'bg-rose-100 text-rose-700 border-4 border-rose-500'
                                : 'bg-slate-100 text-slate-400'
                            : selectedAnswer === i
                              ? i === 0 ? 'bg-emerald-500 text-white scale-105' : 'bg-rose-500 text-white scale-105'
                              : i === 0 ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-2 border-emerald-200'
                                : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border-2 border-rose-200'
                            }`}
                        >
                          <span className="material-symbols-outlined text-4xl">
                            {i === 0 ? 'check_circle' : 'cancel'}
                          </span>
                          {option}
                        </button>
                      ))}
                    </div>
                  ) : quizQuestions[currentQuizIndex]?.type === 'ordering' ? (
                    <div className="space-y-4">
                      <div className="space-y-2 bg-slate-50 p-4 rounded-xl border-2 border-dashed border-slate-200">
                        {orderingState.map((item, i) => (
                          <div key={i} className="flex items-center gap-3 p-4 bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md transition-all animate-fade-in">
                            <div className="flex flex-col gap-1 text-slate-400">
                              <button
                                onClick={() => {
                                  if (i === 0 || showResult) return;
                                  const newOrder = [...orderingState];
                                  [newOrder[i], newOrder[i - 1]] = [newOrder[i - 1], newOrder[i]];
                                  setOrderingState(newOrder);
                                }}
                                disabled={i === 0 || showResult}
                                className="hover:text-violet-600 disabled:opacity-30"
                              >
                                <span className="material-symbols-outlined text-sm">keyboard_arrow_up</span>
                              </button>
                              <button
                                onClick={() => {
                                  if (i === orderingState.length - 1 || showResult) return;
                                  const newOrder = [...orderingState];
                                  [newOrder[i], newOrder[i + 1]] = [newOrder[i + 1], newOrder[i]];
                                  setOrderingState(newOrder);
                                }}
                                disabled={i === orderingState.length - 1 || showResult}
                                className="hover:text-violet-600 disabled:opacity-30"
                              >
                                <span className="material-symbols-outlined text-sm">keyboard_arrow_down</span>
                              </button>
                            </div>
                            <span className="font-bold text-slate-500 mr-2">#{i + 1}</span>
                            <span className="text-slate-800 font-medium">{item}</span>
                          </div>
                        ))}
                      </div>
                      {!showResult && (
                        <button
                          onClick={() => {
                            const currentQ = quizQuestions[currentQuizIndex];
                            const isCorrect = JSON.stringify(orderingState) === JSON.stringify(currentQ.orderingItems);
                            handleQuizAnswer(isCorrect ? currentQ.correctIndex : -1, orderingState.join(', '), false, isCorrect);
                          }}
                          className="w-full py-4 bg-violet-600 text-white font-bold rounded-xl hover:bg-violet-700 shadow-lg"
                        >
                          Confirmar Orden
                        </button>
                      )}
                    </div>
                  ) : quizQuestions[currentQuizIndex]?.type === 'matching' ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4 md:gap-8">
                        {/* Left Side */}
                        <div className="space-y-2">
                          {(quizQuestions[currentQuizIndex].matchingPairs || []).map((pair, i) => (
                            <div key={i} className="h-24 flex items-center p-3 bg-white border-2 border-slate-100 rounded-xl font-medium text-sm md:text-base shadow-sm">
                              <div className="w-6 h-6 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center mr-2 text-xs font-bold border border-violet-200">
                                {i + 1}
                              </div>
                              {pair.left}
                            </div>
                          ))}
                        </div>
                        {/* Right Side - Selectors */}
                        <div className="space-y-2">
                          {(quizQuestions[currentQuizIndex].matchingPairs || []).map((pair, i) => (
                            <div key={i} className="h-24 relative">
                              <select
                                value={matchingState[pair.left] || ''}
                                onChange={(e) => setMatchingState({ ...matchingState, [pair.left]: e.target.value })}
                                disabled={showResult}
                                className={`w-full h-full p-3 rounded-xl border-2 appearance-none cursor-pointer transition-all ${showResult
                                  ? matchingState[pair.left] === pair.right
                                    ? 'bg-emerald-100 border-emerald-500 text-emerald-800' // Correct
                                    : 'bg-rose-100 border-rose-500 text-rose-800' // Wrong
                                  : matchingState[pair.left]
                                    ? 'bg-violet-50 border-violet-500 text-violet-900'
                                    : 'bg-slate-50 border-slate-200 hover:border-violet-300'
                                  } text-sm md:text-base font-medium focus:ring-4 ring-violet-100`}
                              >
                                <option value="">Seleccionar...</option>
                                {/* We need all RIGHT options here. Since we can't shuffle easily in inline render, we map from the pairs but show all available rights */}
                                {(quizQuestions[currentQuizIndex].matchingPairs || []).map(p => p.right).sort().map(r => (
                                  <option key={r} value={r}>{r}</option>
                                ))}
                              </select>
                              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                                <span className="material-symbols-outlined text-slate-400">unfold_more</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      {!showResult && (
                        <button
                          onClick={() => {
                            const currentQ = quizQuestions[currentQuizIndex];
                            const allCorrect = (currentQ.matchingPairs || []).every(p => matchingState[p.left] === p.right);
                            handleQuizAnswer(allCorrect ? currentQ.correctIndex : -1, JSON.stringify(matchingState), false, allCorrect);
                          }}
                          disabled={Object.keys(matchingState).length < (quizQuestions[currentQuizIndex].matchingPairs?.length || 0)}
                          className="w-full py-4 bg-violet-600 text-white font-bold rounded-xl hover:bg-violet-700 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Confirmar Parejas
                        </button>
                      )}
                    </div>
                  ) : quizQuestions[currentQuizIndex]?.type === 'fill_blank' ? (
                    <div className="space-y-6 py-6">
                      <div className="text-xl md:text-2xl leading-relaxed font-medium text-slate-800 text-center">
                        {quizQuestions[currentQuizIndex].fillBlankText?.split('[blank]').map((part, i, arr) => (
                          <React.Fragment key={i}>
                            {part}
                            {i < arr.length - 1 && (
                              <input
                                type="text"
                                value={fillBlankAnswer}
                                onChange={(e) => setFillBlankAnswer(e.target.value)}
                                disabled={showResult}
                                placeholder="?"
                                className={`mx-2 bg-transparent border-b-2 font-bold px-2 py-1 w-40 text-center focus:outline-none transition-all ${showResult
                                  ? (quizQuestions[currentQuizIndex].fillBlankAnswers || []).map(a => a.toLowerCase().trim()).includes(fillBlankAnswer.toLowerCase().trim())
                                    ? 'border-emerald-500 text-emerald-600 bg-emerald-50 rounded'
                                    : 'border-rose-500 text-rose-600 bg-rose-50 rounded'
                                  : 'border-slate-300 focus:border-violet-500 focus:bg-violet-50 text-violet-700'
                                  }`}
                              />
                            )}
                          </React.Fragment>
                        ))}
                      </div>

                      {showResult && (
                        <div className="mt-4 p-3 bg-emerald-50 rounded-lg text-emerald-700 text-center font-bold">
                          Respuesta Correcta: {(quizQuestions[currentQuizIndex].fillBlankAnswers || []).join(' o ')}
                        </div>
                      )}

                      {!showResult && (
                        <button
                          onClick={() => {
                            const currentQ = quizQuestions[currentQuizIndex];
                            const isCorrect = (currentQ.fillBlankAnswers || []).map(a => a.toLowerCase().trim()).includes(fillBlankAnswer.toLowerCase().trim());
                            handleQuizAnswer(isCorrect ? currentQ.correctIndex : -1, fillBlankAnswer, false, isCorrect);
                          }}
                          disabled={!fillBlankAnswer.trim()}
                          className="w-full py-4 bg-violet-600 text-white font-bold rounded-xl hover:bg-violet-700 shadow-lg disabled:opacity-50"
                        >
                          Comprobar
                        </button>
                      )}
                    </div>
                  ) : quizQuestions[currentQuizIndex]?.type === 'identify_error' ? (
                    <div className="space-y-4">
                      <div className={`p-6 rounded-xl border-2 relative overflow-hidden group transition-all ${showResult ? 'bg-slate-50 border-slate-200' : 'bg-white border-slate-200 hover:border-violet-300'}`}>
                        <div className="absolute top-0 right-0 p-2 bg-rose-100 text-rose-600 rounded-bl-xl text-xs font-bold flex items-center gap-1">
                          <span className="material-symbols-outlined text-sm">bug_report</span>
                          Encuentra el error
                        </div>
                        <p className="text-lg md:text-xl font-mono text-slate-700 leading-relaxed">
                          {quizQuestions[currentQuizIndex].errorText}
                        </p>
                      </div>

                      {/* Reuse Options for Error ID if provided in options, otherwise text input? prompt usually includes options for "Where is the error" */}
                      {quizQuestions[currentQuizIndex].options && quizQuestions[currentQuizIndex].options.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {quizQuestions[currentQuizIndex].options.map((option, i) => (
                            <button
                              key={i}
                              onClick={() => handleQuizAnswer(i)}
                              disabled={showResult}
                              className={`p-4 rounded-xl text-left border-2 transition-all ${showResult
                                ? i === quizQuestions[currentQuizIndex].correctIndex
                                  ? 'bg-emerald-100 border-emerald-500 text-emerald-800'
                                  : selectedAnswer === i ? 'bg-rose-100 border-rose-500 text-rose-800' : 'bg-slate-50 border-slate-100 text-slate-400'
                                : 'bg-white border-slate-100 hover:border-violet-500 hover:bg-violet-50'
                                }`}
                            >
                              {option}
                            </button>
                          ))}
                        </div>
                      ) : (
                        // Fallback if no options -> simple button "I spotted it" revealed in explanation
                        <button onClick={() => handleQuizAnswer(0)} className="w-full p-4 bg-violet-600 text-white rounded-xl">Ver Respuesta</button>
                      )}
                    </div>
                  ) : quizQuestions[currentQuizIndex]?.type === 'exercise' ? (
                    /* EXERCISE TYPE - Problem solving with solution reveal */
                    <div className="space-y-4">
                      {/* Exercise Problem */}
                      <div className="p-6 bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200 rounded-xl">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="material-symbols-outlined text-amber-600">calculate</span>
                          <span className="font-bold text-amber-700">
                            {quizQuestions[currentQuizIndex].exerciseType === 'mathematical' ? 'Problema Matemático' :
                              quizQuestions[currentQuizIndex].exerciseType === 'programming' ? 'Ejercicio de Programación' :
                              quizQuestions[currentQuizIndex].exerciseType === 'case_study' ? 'Caso de Estudio' :
                              quizQuestions[currentQuizIndex].exerciseType === 'conceptual' ? 'Ejercicio Conceptual' :
                              quizQuestions[currentQuizIndex].exerciseType === 'practical' ? 'Ejercicio Práctico' : 'Ejercicio'}
                          </span>
                        </div>
                        <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">
                          {quizQuestions[currentQuizIndex].exerciseProblem}
                        </p>
                      </div>

                      {/* Answer input area */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-600">Tu respuesta:</label>
                        <textarea
                          value={exerciseAnswer}
                          onChange={(e) => setExerciseAnswer(e.target.value)}
                          disabled={showResult}
                          placeholder="Escribe tu solución aquí..."
                          className="w-full h-32 p-4 border-2 border-slate-200 rounded-xl focus:border-amber-500 focus:ring-2 focus:ring-amber-200 transition-all resize-none text-slate-700 font-mono"
                        />
                      </div>

                      {/* Submit button */}
                      {!showResult && (
                        <button
                          onClick={() => {
                            setShowExerciseSolution(true);
                            // For exercises, we let the student self-evaluate
                            // The handleQuizAnswer will be called when they confirm correct/incorrect
                          }}
                          disabled={!exerciseAnswer.trim()}
                          className={`w-full py-4 font-bold rounded-xl transition-all ${exerciseAnswer.trim()
                            ? 'bg-amber-600 text-white hover:bg-amber-700 shadow-md'
                            : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                          }`}
                        >
                          Ver Solución
                        </button>
                      )}

                      {/* Solution reveal with step-by-step */}
                      {showExerciseSolution && (
                        <div className="space-y-4 animate-fade-in">
                          {/* Solution */}
                          <div className="p-5 bg-emerald-50 border-2 border-emerald-200 rounded-xl">
                            <div className="flex items-center gap-2 mb-3">
                              <span className="material-symbols-outlined text-emerald-600">check_circle</span>
                              <span className="font-bold text-emerald-700">Solución Correcta</span>
                            </div>
                            <p className="text-slate-700 whitespace-pre-wrap font-medium">
                              {quizQuestions[currentQuizIndex].exerciseSolution}
                            </p>
                          </div>

                          {/* Step by step explanation */}
                          {quizQuestions[currentQuizIndex].exerciseSteps && quizQuestions[currentQuizIndex].exerciseSteps!.length > 0 && (
                            <div className="p-5 bg-blue-50 border-2 border-blue-200 rounded-xl">
                              <div className="flex items-center gap-2 mb-3">
                                <span className="material-symbols-outlined text-blue-600">format_list_numbered</span>
                                <span className="font-bold text-blue-700">Paso a Paso</span>
                              </div>
                              <ol className="space-y-2">
                                {quizQuestions[currentQuizIndex].exerciseSteps!.map((step, i) => (
                                  <li key={i} className="flex gap-3 text-slate-700">
                                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-200 text-blue-700 text-xs font-bold flex items-center justify-center">
                                      {i + 1}
                                    </span>
                                    <span>{step}</span>
                                  </li>
                                ))}
                              </ol>
                            </div>
                          )}

                          {/* Self-evaluation buttons */}
                          {!showResult && (
                            <div className="flex gap-3">
                              <button
                                onClick={() => handleQuizAnswer(0, exerciseAnswer, false, true)}
                                className="flex-1 py-4 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 shadow-md flex items-center justify-center gap-2"
                              >
                                <span className="material-symbols-outlined">thumb_up</span>
                                Lo hice bien
                              </button>
                              <button
                                onClick={() => handleQuizAnswer(-1, exerciseAnswer, false, false)}
                                className="flex-1 py-4 bg-rose-600 text-white font-bold rounded-xl hover:bg-rose-700 shadow-md flex items-center justify-center gap-2"
                              >
                                <span className="material-symbols-outlined">thumb_down</span>
                                Me equivoqué
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (quizQuestions[currentQuizIndex]?.type === 'design' || quizQuestions[currentQuizIndex]?.options?.[0]?.includes('solución')) ? (
                    /* DESIGN TYPE - Text area for open response */
                    <div className="space-y-4">
                      {quizQuestions[currentQuizIndex]?.designPrompt && (
                        <div className="p-4 bg-purple-50 border-l-4 border-purple-400 rounded-r-xl mb-4">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="material-symbols-outlined text-purple-600">design_services</span>
                            <span className="font-bold text-purple-700">Tu Reto</span>
                          </div>
                          <p className="text-slate-700 text-sm">{quizQuestions[currentQuizIndex].designPrompt}</p>
                        </div>
                      )}

                      {quizQuestions[currentQuizIndex]?.evaluationCriteria && (
                        <div className="text-xs text-slate-500 mb-2">
                          <span className="font-semibold">Se evaluará:</span> {quizQuestions[currentQuizIndex].evaluationCriteria?.join(' • ')}
                        </div>
                      )}

                      <textarea
                        value={designAnswer}
                        onChange={(e) => setDesignAnswer(e.target.value)}
                        disabled={showResult}
                        placeholder="Escribe tu solución aquí..."
                        className="w-full h-40 p-4 border-2 border-slate-200 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all resize-none text-slate-700"
                      />

                      {!showResult && (
                        <button
                          onClick={() => handleQuizAnswer(0, designAnswer)}
                          disabled={!designAnswer.trim()}
                          className={`w-full py-4 font-bold rounded-xl transition-all ${designAnswer.trim()
                            ? 'bg-purple-600 text-white hover:bg-purple-700 shadow-md transform hover:-translate-y-1'
                            : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                            }`}
                        >
                          Enviar mi Solución
                        </button>
                      )}
                    </div>
                  ) : (
                    /* MULTIPLE CHOICE / ANALYSIS - Standard options */
                    <div className="space-y-3">
                      {quizQuestions[currentQuizIndex]?.options.map((option, i) => (
                        <button
                          key={i}
                          onClick={() => handleQuizAnswer(i)}
                          disabled={showResult}
                          className={`w-full p-4 rounded-xl text-left font-medium transition-all flex items-center gap-3 ${showResult
                            ? i === quizQuestions[currentQuizIndex].correctIndex
                              ? 'bg-emerald-100 text-emerald-700 border-2 border-emerald-500'
                              : selectedAnswer === i
                                ? 'bg-rose-100 text-rose-700 border-2 border-rose-500'
                                : 'bg-slate-100 text-slate-500'
                            : selectedAnswer === i
                              ? 'bg-primary text-white'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                            }`}
                        >
                          <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${showResult && i === quizQuestions[currentQuizIndex].correctIndex ? 'bg-emerald-500 text-white' :
                            showResult && selectedAnswer === i ? 'bg-rose-500 text-white' :
                              selectedAnswer === i ? 'bg-white/20 text-white' : 'bg-white text-slate-600'
                            }`}>
                            {String.fromCharCode(65 + i)}
                          </span>
                          {option}
                          {showResult && i === quizQuestions[currentQuizIndex].correctIndex && (
                            <span className="material-symbols-outlined ml-auto text-emerald-600">check_circle</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}

                  {showResult && (
                    <div className={`mt-6 p-4 rounded-xl text-sm relative overflow-hidden transition-all animate-fade-in ${persona === 'strict' ? 'bg-slate-800 text-slate-200 border-l-4 border-red-500' :
                      persona === 'socratic' ? 'bg-amber-50 text-amber-800 border-l-4 border-amber-500' :
                        persona === 'friendly' ? 'bg-pink-50 text-pink-800 border-l-4 border-pink-400' :
                          'bg-blue-50 text-blue-700 border-l-4 border-blue-400'
                      }`}>
                      <div className="flex items-start gap-4">
                        <div className={`w-12 h-12 rounded-full shrink-0 flex items-center justify-center text-2xl shadow-sm ${persona === 'strict' ? 'bg-slate-700 text-red-500' :
                          persona === 'socratic' ? 'bg-amber-100 text-amber-600' :
                            persona === 'friendly' ? 'bg-pink-100 text-pink-500' :
                              'bg-blue-100 text-blue-600'
                          }`}>
                          {persona === 'strict' ? '👮‍♂️' : persona === 'socratic' ? '🦉' : persona === 'friendly' ? '🎉' : '🤖'}
                        </div>
                        <div>
                          <p className="font-bold mb-1 opacity-90 text-xs uppercase tracking-wider">
                            {persona === 'strict' ? 'Sargento Hartman dice:' :
                              persona === 'socratic' ? 'Reflexión Socrática:' :
                                persona === 'friendly' ? 'Maya dice:' :
                                  'Explicación:'}
                          </p>
                          <p className="leading-relaxed text-base">{quizQuestions[currentQuizIndex].explanation}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {showResult && (
                    <button
                      onClick={() => { nextQuizQuestion(); setDesignAnswer(''); }}
                      className="w-full mt-6 bg-primary text-white font-bold py-4 rounded-xl hover:bg-blue-700 transition-all"
                    >
                      {currentQuizIndex < quizQuestions.length - 1 ? 'Siguiente Pregunta' : 'Ver Resultados'}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Quiz Complete - Detailed Report */}
          {mode === 'quiz' && quizComplete && (
            <div className="w-full max-w-2xl">
              <div className="bg-white rounded-3xl shadow-2xl p-8">
                {/* Header */}
                <div className="text-center mb-8">
                  <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 ${score >= (quizQuestions.length * 0.6)
                    ? 'bg-gradient-to-br from-emerald-400 to-emerald-600'
                    : 'bg-gradient-to-br from-amber-400 to-amber-600'
                    }`}>
                    <span className="material-symbols-outlined text-4xl text-white">
                      {score >= (quizQuestions.length * 0.6) ? 'school' : 'psychology'}
                    </span>
                  </div>
                  <h2 className="text-3xl font-black text-slate-900 mb-2">Reporte del Quiz</h2>
                  <p className="text-slate-500">
                    {score >= (quizQuestions.length * 0.6) ? '¡Excelente trabajo!' : 'Sigue practicando los temas difíciles'}
                  </p>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-4 mb-8">
                  <div className="bg-violet-50 rounded-xl p-4 text-center">
                    <div className="text-3xl font-black text-violet-600">+{xpEarned}</div>
                    <div className="text-xs text-violet-500 font-bold">XP GANADOS</div>
                  </div>
                  <div className={`rounded-xl p-4 text-center ${score >= (quizQuestions.length * 0.6) ? 'bg-emerald-50' : 'bg-rose-50'}`}>
                    <div className={`text-3xl font-black ${score >= (quizQuestions.length * 0.6) ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {Math.round((score / quizQuestions.length) * 100)}%
                    </div>
                    <div className={`text-xs font-bold ${score >= (quizQuestions.length * 0.6) ? 'text-emerald-500' : 'text-rose-500'}`}>PRECISIÓN</div>
                  </div>
                  <div className="bg-blue-50 rounded-xl p-4 text-center">
                    <div className="text-3xl font-black text-blue-600">{score}/{quizQuestions.length}</div>
                    <div className="text-xs text-blue-500 font-bold">CORRECTAS</div>
                  </div>
                </div>

                {/* Topic Breakdown */}
                {quizReport && quizReport.topicBreakdown.length > 0 && (
                  <div className="mb-8">
                    <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                      <span className="material-symbols-outlined text-lg">analytics</span>
                      Rendimiento por Tema
                    </h3>
                    <div className="space-y-2">
                      {quizReport.topicBreakdown.map((topic, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <div className="flex-1">
                            <div className="flex justify-between text-sm mb-1">
                              <span className="font-medium text-slate-700">{topic.topic}</span>
                              <span className={`font-bold ${topic.percentage >= 60 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {topic.correct}/{topic.total} ({topic.percentage}%)
                              </span>
                            </div>
                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${topic.percentage >= 60 ? 'bg-emerald-500' : 'bg-rose-500'}`}
                                style={{ width: `${topic.percentage}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Questions Review */}
                <div className="mb-8">
                  <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                    <span className="material-symbols-outlined text-lg">fact_check</span>
                    Revisión de Preguntas
                  </h3>
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {quizResults.map((result, i) => (
                      <div
                        key={i}
                        className={`p-3 rounded-xl border-2 ${result.isCorrect ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50'}`}
                      >
                        <div className="flex items-start gap-3">
                          <span className={`material-symbols-outlined ${result.isCorrect ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {result.isCorrect ? 'check_circle' : 'cancel'}
                          </span>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-slate-800 line-clamp-2">{result.question}</p>
                            {!result.isCorrect && (
                              <p className="text-xs text-rose-600 mt-1">
                                Tu respuesta: {quizQuestions[result.questionIndex]?.options[result.userAnswerIndex]}
                              </p>
                            )}
                            <p className={`text-xs mt-1 ${result.isCorrect ? 'text-emerald-600' : 'text-slate-600'}`}>
                              Respuesta correcta: {quizQuestions[result.questionIndex]?.options[result.correctAnswerIndex]}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Weak Topics Alert */}
                {quizReport && quizReport.incorrectQuestions.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
                    <div className="flex items-center gap-2 text-amber-700">
                      <span className="material-symbols-outlined">lightbulb</span>
                      <span className="font-bold">El próximo quiz enfatizará:</span>
                    </div>
                    <p className="text-sm text-amber-600 mt-1">
                      Las preguntas que fallaste se repetirán y las que acertaste serán reemplazadas por contenido nuevo o más avanzado.
                    </p>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-4">
                  <button
                    onClick={async () => {
                      // Generate new adaptive quiz
                      setQuizComplete(false);
                      setQuizGenerated(false);
                      setCurrentQuizIndex(0);
                      setScore(0);
                      setXpEarned(0);
                      setQuizResults([]);
                      setQuizReport(null);
                      setSelectedAnswer(null);
                      setShowResult(false);
                    }}
                    className="flex-1 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-bold py-4 rounded-xl hover:opacity-90 transition flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined">autorenew</span>
                    Siguiente Quiz
                  </button>
                  <button
                    onClick={handleEndSession}
                    className="flex-1 bg-slate-100 text-slate-700 font-bold py-4 rounded-xl hover:bg-slate-200 transition"
                  >
                    Finalizar
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Cramming Mode */}
          {mode === 'cramming' && !crammingComplete && (
            <>
              <div className="text-center text-white mb-8">
                <span className="material-symbols-outlined text-6xl mb-4 animate-pulse">bolt</span>
                <h2 className="text-3xl font-black">🔥 Modo Cramming</h2>
                <p className="text-white/80 mt-2">Repaso intensivo antes del examen</p>
              </div>

              <div
                onClick={() => setIsFlipped(!isFlipped)}
                className="w-full max-w-lg aspect-[4/3] cursor-pointer perspective-1000"
              >
                <div className={`relative w-full h-full transition-transform duration-300 transform-style-3d ${isFlipped ? 'rotate-y-180' : ''}`}>
                  <div className="absolute w-full h-full bg-white rounded-3xl shadow-2xl flex flex-col items-center justify-center p-8 backface-hidden border-4 border-amber-400">
                    <span className="bg-rose-100 text-rose-600 text-xs font-bold px-3 py-1 rounded-full uppercase mb-4">⚡ Cramming</span>
                    <h2 className="text-2xl md:text-3xl font-black text-center text-slate-900 leading-snug">{flashcards[currentIndex]?.question}</h2>
                  </div>
                  <div className="absolute w-full h-full bg-white rounded-3xl shadow-2xl flex flex-col items-center justify-center p-8 backface-hidden rotate-y-180 border-4 border-emerald-400">
                    <span className="bg-emerald-100 text-emerald-600 text-xs font-bold px-3 py-1 rounded-full uppercase mb-4">Respuesta</span>
                    <p className="text-lg md:text-xl text-center text-slate-700 leading-relaxed">{flashcards[currentIndex]?.answer}</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-4 mt-8">
                <button
                  onClick={handleDontKnow}
                  className="bg-white/20 text-white font-bold px-6 py-4 rounded-xl hover:bg-white/30 transition-all"
                >
                  Repasar más tarde
                </button>
                <button
                  onClick={handleKnow}
                  className="bg-white text-rose-600 font-bold px-6 py-4 rounded-xl shadow-lg hover:scale-105 transition-all"
                >
                  ¡Lo domino! 🔥
                </button>
              </div>
            </>
          )}

          {/* Cramming Complete Screen */}
          {mode === 'cramming' && crammingComplete && (
            <div className="w-full max-w-md">
              <div className="bg-white rounded-3xl shadow-2xl p-8 text-center">
                <div className="w-20 h-20 bg-gradient-to-br from-rose-500 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-6">
                  <span className="material-symbols-outlined text-4xl text-white">bolt</span>
                </div>
                <h2 className="text-3xl font-black text-slate-900 mb-2">🔥 ¡Cramming Completado!</h2>
                <p className="text-slate-500 mb-6">Repaso intensivo terminado</p>

                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-violet-50 rounded-xl p-4">
                    <div className="text-3xl font-black text-violet-600">+{xpEarned}</div>
                    <div className="text-xs text-violet-500 font-bold">XP GANADOS</div>
                  </div>
                  <div className="bg-amber-50 rounded-xl p-4">
                    <div className="text-3xl font-black text-amber-600">{correctFlashcards}/{flashcards.length}</div>
                    <div className="text-xs text-amber-500 font-bold">DOMINADAS</div>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-orange-100 to-red-100 rounded-xl p-4 mb-6">
                  <div className="flex items-center justify-center gap-2">
                    <span className="material-symbols-outlined text-orange-500">local_fire_department</span>
                    <span className="text-lg font-bold text-orange-600">Racha activada</span>
                  </div>
                </div>

                <button
                  onClick={handleEndSession}
                  className="w-full bg-gradient-to-r from-rose-600 to-orange-600 text-white font-bold py-4 rounded-xl hover:opacity-90 transition"
                >
                  Finalizar y Guardar Progreso
                </button>
              </div>
            </div>
          )}
          {mode === 'podcast' && (
            <div className="max-w-4xl mx-auto">
              <NeuroPodcast
                context={flashcards.map(f => `Q: ${f.question} A: ${f.answer}`).join('\n\n')}
                topicTitle={className || "Sesión de Estudio"}
              />
            </div>
          )}
        </div>
      </main>

      {/* Statistics Modal */}
      {showStats && studySetId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowStats(false)}
          />
          {/* Modal Content */}
          <div className="relative z-10 w-full max-w-4xl max-h-[90vh] overflow-auto bg-white rounded-2xl shadow-2xl">
            <div className="sticky top-0 z-20 flex items-center justify-between p-4 bg-white border-b">
              <h2 className="text-xl font-bold text-slate-800">Estadísticas del Set</h2>
              <button
                onClick={() => setShowStats(false)}
                className="p-2 rounded-full hover:bg-slate-100 transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-4">
              <StudySetStatistics studySetId={studySetId} />
            </div>
          </div>
        </div>
      )}

      {/* AI Tutor Chat - Always visible */}
      {(() => {
        let activeContext = '';
        if (mode === 'flashcards' && flashcards.length > 0) {
          activeContext = `Flashcard Actual: ${flashcards[currentIndex]?.question} (Respuesta oculta: ${flashcards[currentIndex]?.answer})`;
        } else if (mode === 'quiz' && quizQuestions.length > 0 && !quizComplete) {
          activeContext = `Pregunta de Quiz Actual: ${quizQuestions[currentQuizIndex]?.question}`;
        }

        return (
          <AITutorChat
            classId={activeClassId || undefined}
            topic={className || 'General Study'}
            currentContext={activeContext}
          />
        );
      })()}

      {/* CSS for animations */}
      <style>{`
        .perspective-1000 { perspective: 1000px; }
        .transform-style-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; }
        .rotate-y-180 { transform: rotateY(180deg); }
        @keyframes fall {
          to { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
        .animate-fall { animation: fall 1s linear forwards; }
      `}
      </style>
    </div>
  );
};

export default StudySession;
