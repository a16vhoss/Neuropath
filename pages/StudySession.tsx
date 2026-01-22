

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
import { generateAdaptiveQuiz, saveQuizSession, QuizQuestion as AdaptiveQuizQuestion, QuizResult, QuizReport, QuestionType } from '../services/QuizService';

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

  useEffect(() => {
    const generateQuizAndExam = async () => {
      // Only generate once when we have real flashcards loaded
      if (flashcards.length > 0 && !quizGenerated && loadingSource !== 'mock' && studySetId && user) {
        setQuizLoading(true);
        try {
          console.log('Generating adaptive quiz from flashcards...');

          // Use adaptive quiz service that considers weak topics
          const adaptiveQuestions = await generateAdaptiveQuiz(studySetId, user.id, 5);

          if (adaptiveQuestions && adaptiveQuestions.length > 0) {
            // Map to local QuizQuestion format
            const mappedQuestions: QuizQuestion[] = adaptiveQuestions.map((q, i) => ({
              id: q.id,
              question: q.question,
              options: q.options,
              correctIndex: q.correctIndex,
              explanation: q.explanation
            }));

            setQuizQuestions(mappedQuestions);
            setQuizGenerated(true);
            setQuizStartTime(Date.now());
            setQuizResults([]);
            console.log('Adaptive quiz generated:', mappedQuestions.length);
          } else {
            // Fallback to basic generation
            const context = flashcards.slice(0, 15).map(c => `Q: ${c.question} A: ${c.answer}`).join('\n');
            const generatedQuiz = await generateQuizQuestions(context);
            if (generatedQuiz && generatedQuiz.length > 0) {
              setQuizQuestions(generatedQuiz);
              setQuizGenerated(true);
              setQuizStartTime(Date.now());
            }
          }
        } catch (e) {
          console.error("Quiz gen error", e);
        } finally {
          setQuizLoading(false);
        }
      }
    }
    generateQuizAndExam();
  }, [flashcards, loadingSource, quizGenerated, studySetId, user]);


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
    setTimeout(() => setShowConfetti(false), 1000);
  };

  const handleQuizAnswer = (optionIndex: number, textAnswer?: string) => {
    if (showResult) return;
    setSelectedAnswer(optionIndex);
    setShowResult(true);

    const currentQ = quizQuestions[currentQuizIndex];
    const isCorrect = optionIndex === currentQ.correctIndex;

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
      triggerConfetti();

      // Update Adaptive SRS for correct answer (Rating 4 - Easy/Perfect)
      if (user && flashcards[currentQuizIndex]?.id) {
        updateCardAfterReview(
          user.id,
          flashcards[currentQuizIndex].id,
          4, // Easy/Perfect
          5000 // Assumed response time
        ).catch(console.error);
      }
    } else {
      // Update Adaptive SRS for incorrect answer (Rating 1 - Again)
      if (user && flashcards[currentQuizIndex]?.id) {
        updateCardAfterReview(
          user.id,
          flashcards[currentQuizIndex].id,
          1, // Again/Fail
          5000
        ).catch(console.error);
      }
    }
  };

  const nextQuizQuestion = async () => {
    if (currentQuizIndex < quizQuestions.length - 1) {
      setCurrentQuizIndex(currentQuizIndex + 1);
      setSelectedAnswer(null);
      setShowResult(false);
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
      console.log('Calling updateStreak');
      const newStreak = await GamificationService.updateStreak(user.id);
      console.log('updateStreak result - new streak:', newStreak);

      // Show confetti for good performance
      if (xpEarned >= 50) {
        setShowConfetti(true);
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    } catch (error) {
      console.error('ERROR in handleEndSession:', error);
    }

    navigate(-1);
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
    <div className={`min-h-[100dvh] h-[100dvh] flex flex-col relative overflow-hidden ${mode === 'cramming' ? 'bg-gradient-to-br from-rose-600 to-orange-500' : 'gradient-hero'}`}>
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

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-2 md:px-4 pb-[calc(0.5rem+env(safe-area-inset-bottom))] md:pb-8 w-full min-h-0">

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
                <div className="mb-6 flex items-center gap-2">
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
                          quizQuestions[currentQuizIndex]?.type === 'practical' ? '🚀 Aplicación' : '📝 Opción Múltiple'}
                  </span>
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
                  <div className="mt-6 p-4 bg-blue-50 rounded-xl text-sm text-blue-700">
                    <strong>Explicación:</strong> {quizQuestions[currentQuizIndex].explanation}
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
