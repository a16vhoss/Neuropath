

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getClassFlashcards, getStudySetFlashcards, updateFlashcardProgress, supabase } from '../services/supabaseClient';
import { generateStudyFlashcards, getTutorResponse, generateQuizQuestions } from '../services/geminiService';
import { GamificationService } from '../services/GamificationService';
import AITutorChat from '../components/AITutorChat';
import NeuroPodcast from '../components/NeuroPodcast';
import SRSRatingButtons from '../components/SRSRatingButtons';
import { updateCardAfterReview, Rating, getRatingLabel, getCardsForSession, FlashcardWithSRS } from '../services/AdaptiveLearningService';
import { handleSessionComplete, handleStrugglingSession, updateConsecutiveCorrect, DIFFICULTY_TIERS } from '../services/DynamicContentService';
import StudySetStatistics from '../components/StudySetStatistics';

type StudyMode = 'flashcards' | 'quiz' | 'exam' | 'cramming' | 'podcast';

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
  options: string[];
  correctIndex: number;
  explanation: string;
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
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>(mockQuizQuestions);
  const [currentQuizIndex, setCurrentQuizIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);
  const [quizComplete, setQuizComplete] = useState(false);

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
          // default stays adaptive
        }

        // Fetch priority cards using FSRS logic
        const adaptiveCards = await getCardsForSession({
          userId: user.id,
          classId: classId || undefined,
          studySetId: studySetId || undefined,
          mode: serviceMode,
          maxNewCards: 20,
          maxReviewCards: mode === 'exam' ? 50 : 20
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
            // Check if we have archived cards
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
              // Really no cards due?
              // Since we updated logic for quiz/exam, this means ABSOLUTELY NO cards exist or are available.
              // Try to fallback to ALL cards for quiz/exam if adaptive returned nothing (just safety net)
              if (mode === 'quiz' || mode === 'exam') {
                const { data: allCards } = await supabase.from('flashcards').select('*').eq('study_set_id', studySetId).limit(20);
                if (allCards && allCards.length > 0) {
                  sessionCards = allCards.map(c => ({ ...c, difficulty: c.difficulty || 1 }));
                  setFlashcards(sessionCards);
                } else {
                  setNoCardsDue(true);
                }
              } else {
                setNoCardsDue(true);
              }
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
  }, [classId, studySetId]);

  // Effect to generate quiz when flashcards change (and are not empty)
  const [quizGenerated, setQuizGenerated] = useState(false);

  useEffect(() => {
    const generateQuizAndExam = async () => {
      // Only generate once when we have real flashcards loaded
      if (flashcards.length > 0 && !quizGenerated && loadingSource !== 'mock') {
        const context = flashcards.slice(0, 15).map(c => `Q: ${c.question} A: ${c.answer}`).join('\n');
        try {
          console.log('Generating quiz from flashcards context...');
          const generatedQuiz = await generateQuizQuestions(context);

          if (generatedQuiz && generatedQuiz.length > 0) {
            setQuizQuestions(generatedQuiz);
            setQuizGenerated(true);
            console.log('Quiz generated successfully:', generatedQuiz.length);

            // Generate separate Exam questions (request a different variation if possible, or just generate again)
            console.log('Generating exam questions...');
            // We use a slightly different prompt context or just call again to get variation
            // (Gemini is non-deterministic enough usually)
            const generatedExam = await generateQuizQuestions(context + "\nGenera preguntas diferentes a las anteriores.");
            if (generatedExam && generatedExam.length > 0) {
              setExamQuestions(generatedExam);
              setExamAnswers(new Array(generatedExam.length).fill(null));
              console.log('Exam generated successfully:', generatedExam.length);
            } else {
              // Fallback: use same questions shuffled if 2nd gen fails
              setExamQuestions([...generatedQuiz].sort(() => Math.random() - 0.5));
              setExamAnswers(new Array(generatedQuiz.length).fill(null));
            }
          }
        } catch (e) {
          console.error("Quiz/Exam gen error", e);
        }
      }
    }
    generateQuizAndExam();
  }, [flashcards, loadingSource, quizGenerated]);


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
    } catch (error) {
      console.error('Error updating SRS progress:', error);
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

  const handleQuizAnswer = (optionIndex: number) => {
    if (showResult) return;
    setSelectedAnswer(optionIndex);
    setShowResult(true);
    if (optionIndex === quizQuestions[currentQuizIndex].correctIndex) {
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

  const nextQuizQuestion = () => {
    if (currentQuizIndex < quizQuestions.length - 1) {
      setCurrentQuizIndex(currentQuizIndex + 1);
      setSelectedAnswer(null);
      setShowResult(false);
    } else {
      setQuizComplete(true);
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
    <div className={`min-h-screen flex flex-col relative ${mode === 'cramming' ? 'bg-gradient-to-br from-rose-600 to-orange-500' : mode === 'exam' ? 'bg-slate-100' : 'gradient-hero'}`}>
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
      <header className={`relative z-40 p-4 md:p-6 flex items-center justify-between ${mode === 'exam' ? 'text-slate-900' : 'text-white'}`}>
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
      {mode !== 'exam' && !loading && (
        <div className="flex justify-center px-4 mb-6">
          <div className={`inline-flex p-1 rounded-xl ${mode === 'exam' ? 'bg-slate-200' : 'bg-white/20'}`}>
            {[
              { id: 'flashcards', label: 'Flashcards', icon: 'style' },
              { id: 'quiz', label: 'Quiz', icon: 'quiz' },
              { id: 'exam', label: 'Examen', icon: 'assignment' },
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
                }}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg font-bold text-sm transition-all ${mode === m.id
                  ? (mode === 'exam' ? 'bg-white text-slate-900 shadow-sm' : 'bg-white text-primary shadow-sm')
                  : (mode === 'exam' ? 'text-slate-500' : 'text-white/80')
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
      <main className="flex-1 flex flex-col items-center justify-center px-4 pb-8">

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

              <div className="space-y-4">
                <button
                  onClick={() => navigate('/classes')}
                  className="w-full bg-slate-100 text-slate-700 font-bold py-4 rounded-xl hover:bg-slate-200 transition flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined">arrow_back</span>
                  Volver al inicio
                </button>
                <div className="text-xs text-slate-400 mt-4">
                  ¿Quieres estudiar más? Intenta el modo "Cramming" (aprende sin afectar tu horario)
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Flashcards Mode */}
        {mode === 'flashcards' && !flashcardsComplete && !noCardsDue && (
          <>
            <div
              onClick={() => setIsFlipped(!isFlipped)}
              className="w-full max-w-lg aspect-[4/3] cursor-pointer perspective-1000"
            >
              <div className={`relative w-full h-full transition-transform duration-500 transform-style-3d ${isFlipped ? 'rotate-y-180' : ''}`}>
                {/* Front */}
                <div className="absolute w-full h-full bg-white rounded-3xl shadow-2xl flex flex-col items-center justify-center p-8 backface-hidden">
                  <span className="bg-blue-100 text-blue-600 text-xs font-bold px-3 py-1 rounded-full uppercase mb-4">{flashcards[currentIndex]?.category}</span>
                  <h2 className="text-2xl md:text-3xl font-black text-center text-slate-900 leading-snug">{flashcards[currentIndex]?.question}</h2>
                  <p className="text-sm text-slate-400 mt-6 flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">touch_app</span> Toca para girar
                  </p>
                </div>
                {/* Back */}
                <div className="absolute w-full h-full bg-white rounded-3xl shadow-2xl flex flex-col items-center justify-center p-8 backface-hidden rotate-y-180">
                  <span className="bg-emerald-100 text-emerald-600 text-xs font-bold px-3 py-1 rounded-full uppercase mb-4">Respuesta</span>
                  <p className="text-lg md:text-xl text-center text-slate-700 leading-relaxed">{flashcards[currentIndex]?.answer}</p>
                </div>
              </div>
            </div>

            {/* Rating Buttons (Adaptive Mode style) */}
            {isFlipped && (
              <div className="mt-8">
                <SRSRatingButtons
                  onRate={handleRate}
                  disabled={isProcessing}
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
            <div className="bg-white rounded-3xl shadow-2xl p-8">
              <div className="mb-6">
                <span className="bg-violet-100 text-violet-600 text-xs font-bold px-3 py-1 rounded-full">Pregunta {currentQuizIndex + 1}</span>
              </div>
              <h2 className="text-2xl font-black text-slate-900 mb-8">{quizQuestions[currentQuizIndex].question}</h2>

              <div className="space-y-3">
                {quizQuestions[currentQuizIndex].options.map((option, i) => (
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

              {showResult && (
                <div className="mt-6 p-4 bg-blue-50 rounded-xl text-sm text-blue-700">
                  <strong>Explicación:</strong> {quizQuestions[currentQuizIndex].explanation}
                </div>
              )}

              {showResult && (
                <button
                  onClick={nextQuizQuestion}
                  className="w-full mt-6 bg-primary text-white font-bold py-4 rounded-xl hover:bg-blue-700 transition-all"
                >
                  {currentQuizIndex < quizQuestions.length - 1 ? 'Siguiente Pregunta' : 'Ver Resultados'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Quiz Complete */}
        {mode === 'quiz' && quizComplete && (
          <div className="w-full max-w-md text-center">
            <div className="bg-white rounded-3xl shadow-2xl p-8">
              <div className="w-20 h-20 bg-gradient-to-br from-amber-400 to-amber-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="material-symbols-outlined text-4xl text-white">emoji_events</span>
              </div>
              <h2 className="text-3xl font-black text-slate-900 mb-2">¡Quiz Completado!</h2>
              <p className="text-slate-500 mb-6">Has terminado todas las preguntas</p>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-violet-50 rounded-xl p-4">
                  <div className="text-3xl font-black text-violet-600">+{xpEarned}</div>
                  <div className="text-xs text-violet-500 font-bold">XP GANADOS</div>
                </div>
                <div className="bg-emerald-50 rounded-xl p-4">
                  <div className="text-3xl font-black text-emerald-600">{score}/{quizQuestions.length}</div>
                  <div className="text-xs text-emerald-500 font-bold">CORRECTAS</div>
                </div>
              </div>

              <div className="bg-gradient-to-r from-orange-100 to-red-100 rounded-xl p-4 mb-6">
                <div className="flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined text-orange-500">local_fire_department</span>
                  <span className="text-lg font-bold text-orange-600">Racha activada</span>
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => { setQuizComplete(false); setCurrentQuizIndex(0); setScore(0); setXpEarned(0); }}
                  className="flex-1 bg-slate-100 text-slate-700 font-bold py-3 rounded-xl hover:bg-slate-200"
                >
                  Reintentar
                </button>
                <button
                  onClick={handleEndSession}
                  className="flex-1 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-bold py-3 rounded-xl hover:opacity-90"
                >
                  Finalizar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Exam Mode */}
        {mode === 'exam' && !examSubmitted && (
          <div className="w-full max-w-3xl">
            <div className="bg-white rounded-3xl shadow-xl p-6 mb-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">Examen de Práctica</h2>
                <span className={`px-3 py-1 rounded-full text-sm font-bold ${examTime < 60 ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'}`}>
                  {examTime < 60 ? '⚠️ Último minuto' : '✓ Tiempo restante'}
                </span>
              </div>

              <div className="space-y-6">
                {examQuestions.map((q, i) => (
                  <div key={i} className="p-4 bg-slate-50 rounded-xl">
                    <p className="font-bold text-slate-900 mb-3">{i + 1}. {q.question}</p>
                    <div className="grid grid-cols-2 gap-2">
                      {q.options.map((opt, j) => (
                        <button
                          key={j}
                          onClick={() => {
                            const newAnswers = [...examAnswers];
                            newAnswers[i] = j;
                            setExamAnswers(newAnswers);
                          }}
                          className={`p-3 rounded-lg text-left text-sm font-medium transition-all ${examAnswers[i] === j
                            ? 'bg-primary text-white'
                            : 'bg-white border border-slate-200 hover:border-primary'
                            }`}
                        >
                          <span className={`inline-block w-6 h-6 rounded-full text-center text-xs leading-6 mr-2 ${examAnswers[i] === j ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                            }`}>
                            {String.fromCharCode(65 + j)}
                          </span>
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <button
              onClick={handleExamSubmit}
              className="w-full bg-primary text-white font-bold py-4 rounded-xl shadow-lg hover:bg-blue-700 transition-all"
            >
              Entregar Examen
            </button>
          </div>
        )}

        {/* Exam Submitted */}
        {mode === 'exam' && examSubmitted && (
          <div className="w-full max-w-md text-center">
            <div className="bg-white rounded-3xl shadow-2xl p-8">
              <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${score >= (examQuestions.length * 0.6) ? 'bg-gradient-to-br from-emerald-400 to-teal-500' : 'bg-gradient-to-br from-rose-400 to-red-500'}`}>
                <span className="material-symbols-outlined text-4xl text-white">
                  {score >= (examQuestions.length * 0.6) ? 'school' : 'psychology'}
                </span>
              </div>
              <h2 className="text-3xl font-black text-slate-900 mb-2">¡Examen Completado!</h2>
              <p className="text-slate-500 mb-6">{score >= (examQuestions.length * 0.6) ? '¡Excelente trabajo!' : 'Sigue practicando'}</p>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-violet-50 rounded-xl p-4">
                  <div className="text-3xl font-black text-violet-600">+{xpEarned}</div>
                  <div className="text-xs text-violet-500 font-bold">XP GANADOS</div>
                </div>
                <div className={`rounded-xl p-4 ${score >= (examQuestions.length * 0.6) ? 'bg-emerald-50' : 'bg-rose-50'}`}>
                  <div className={`text-3xl font-black ${score >= (examQuestions.length * 0.6) ? 'text-emerald-600' : 'text-rose-600'}`}>{score}/{examQuestions.length}</div>
                  <div className={`text-xs font-bold ${score >= (examQuestions.length * 0.6) ? 'text-emerald-500' : 'text-rose-500'}`}>{Math.round((score / (examQuestions.length || 1)) * 100)}%</div>
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
                className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-bold py-4 rounded-xl hover:opacity-90 transition"
              >
                Finalizar y Guardar Progreso
              </button>
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
