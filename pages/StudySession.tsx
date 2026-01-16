
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getClassFlashcards, getStudySetFlashcards, updateFlashcardProgress, supabase } from '../services/supabaseClient';
import { generateStudyFlashcards, getTutorResponse, generateQuizQuestions } from '../services/geminiService';
import SocraticChat from '../components/SocraticChat';

type StudyMode = 'flashcards' | 'quiz' | 'exam' | 'cramming';

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

  // Load flashcards from Supabase or generate with AI
  useEffect(() => {
    const fetchCards = async () => {
      setLoading(true);

      // First, try to get class info and flashcards from Supabase
      if (classId) {
        try {
          // Get class name
          const { data: classData } = await supabase
            .from('classes')
            .select('name, topics')
            .eq('id', classId)
            .single();

          if (classData) {
            setClassName(classData.name);
          }

          // Get flashcards from database
          setLoadingSource('db');
          const dbFlashcards = await getClassFlashcards(classId);

          if (dbFlashcards && dbFlashcards.length > 0) {
            setFlashcards(dbFlashcards.map((c: any) => ({
              id: c.id,
              question: c.question,
              answer: c.answer,
              category: c.category || 'General',
              difficulty: c.difficulty || 1
            })));
            setLoading(false);
            return;
          }

          // If no flashcards in DB, generate with AI based on class topics
          if (classData?.topics && classData.topics.length > 0) {
            setLoadingSource('ai');
            const topicString = classData.topics.join(', ');
            const aiCards = await generateStudyFlashcards(topicString);

            if (aiCards && aiCards.length > 0) {
              const formattedCards = aiCards.map((c: { question: string; answer: string; category: string }, i: number) => ({
                id: String(i),
                question: c.question,
                answer: c.answer,
                category: c.category
              }));
              setFlashcards(formattedCards);

              // Save AI-generated flashcards to database for future use
              for (const card of formattedCards) {
                await supabase.from('flashcards').insert({
                  class_id: classId,
                  question: card.question,
                  answer: card.answer,
                  category: card.category,
                  difficulty: 1
                });
              }

              setLoading(false);
              return;
            }
          }
        } catch (error) {
          console.error('Error loading flashcards:', error);
        }
      }

      // Handle personal study set
      if (studySetId) {
        try {
          // Get study set name
          const { data: setData } = await supabase
            .from('study_sets')
            .select('name, topics')
            .eq('id', studySetId)
            .single();

          if (setData) {
            setClassName(setData.name);
          }

          // Get flashcards from study set
          setLoadingSource('db');
          const dbFlashcards = await getStudySetFlashcards(studySetId);

          if (dbFlashcards && dbFlashcards.length > 0) {
            setFlashcards(dbFlashcards.map((c: any) => ({
              id: c.id,
              question: c.question,
              answer: c.answer,
              category: c.category || 'General',
              difficulty: c.difficulty || 1
            })));
            setLoading(false);
            return;
          }

          // If no flashcards, generate with AI based on study set topics
          if (setData?.topics && setData.topics.length > 0) {
            setLoadingSource('ai');
            const topicString = setData.topics.join(', ');
            const aiCards = await generateStudyFlashcards(topicString);

            if (aiCards && aiCards.length > 0) {
              const formattedCards = aiCards.map((c: { question: string; answer: string; category: string }, i: number) => ({
                id: String(i),
                question: c.question,
                answer: c.answer,
                category: c.category
              }));
              setFlashcards(formattedCards);

              // Save to study set
              for (const card of formattedCards) {
                await supabase.from('flashcards').insert({
                  study_set_id: studySetId,
                  question: card.question,
                  answer: card.answer,
                  category: card.category,
                  difficulty: 1
                });
              }

              setLoading(false);
              return;
            }
          }
        } catch (error) {
          console.error('Error loading study set flashcards:', error);
        }
      }

      // Fallback: generate with AI for general topic or use mock
      try {
        setLoadingSource('ai');
        const cards = await generateStudyFlashcards("Neurobiología básica y sinapsis");
        if (cards && cards.length > 0) {
          setFlashcards(cards.map((c: { question: string; answer: string; category: string }, i: number) => ({
            id: String(i),
            question: c.question,
            answer: c.answer,
            category: c.category
          })));
        } else {
          setLoadingSource('mock');
          setFlashcards(mockFlashcards);
        }
      } catch (error) {
        console.error('Error generating flashcards:', error);
        setLoadingSource('mock');
        setFlashcards(mockFlashcards);
      }

      setLoading(false);

      // Generate Quiz from loaded flashcards (Just-in-time)
      const currentCards = loadingSource === 'db' ?
        (classId ? await getClassFlashcards(classId) : await getStudySetFlashcards(studySetId!))
        : flashcards; // Logic slightly complex due to state updates, better to use the variable we just used

      // Let's refactor slightly to ensure we have the cards to generate quiz from.
      // Since state updates are async, we can't rely on 'flashcards' state immediately.
      // We will define a helper to generate quiz
      const prepareQuiz = async (cards: Flashcard[]) => {
        if (!cards || cards.length === 0) return;

        const context = cards.map(c => `Q: ${c.question} A: ${c.answer}`).join('\n');
        // Only generate if we have API key (checked inside service)
        const generatedQuiz = await generateQuizQuestions(context);

        if (generatedQuiz && generatedQuiz.length > 0) {
          setQuizQuestions(generatedQuiz);
          setExamAnswers(new Array(generatedQuiz.length).fill(null));
        }
      };

      // We need to call this with the cards we found.
      // Since the original code had multiple exit points (return;), we need to inject this call before returns or unify them.
      // Current structure has returns inside if blocks. I will insert the call before the returns in the original code logic.
      // BUT replace_file_content needs to be precise.
      // The original code is a bit scattered.
      // I will overwrite the `fetchCards` function end to unify the quiz generation.
    };
    fetchCards();
  }, [classId, studySetId]);

  // Effect to generate quiz when flashcards change (and are not empty)
  useEffect(() => {
    const generateQuiz = async () => {
      if (flashcards.length > 0 && quizQuestions === mockQuizQuestions) {
        const context = flashcards.slice(0, 15).map(c => `Q: ${c.question} A: ${c.answer}`).join('\n');
        try {
          const generated = await generateQuizQuestions(context);
          if (generated && generated.length > 0) {
            setQuizQuestions(generated);
            setExamAnswers(new Array(generated.length).fill(null));
          }
        } catch (e) {
          console.error("Quiz gen error", e);
        }
      }
    }
    generateQuiz();
  }, [flashcards]);


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



  const handleKnow = async () => {
    // Update flashcard progress in Supabase
    if (user && flashcards[currentIndex]?.id) {
      try {
        await updateFlashcardProgress(user.id, flashcards[currentIndex].id, true); // Correct answer
        setXpEarned(prev => prev + 10);
      } catch (error) {
        console.error('Error updating progress:', error);
      }
    }

    setStreak(s => s + 1);
    triggerConfetti();
    nextCard();
  };

  const handleDontKnow = async () => {
    // Update flashcard progress with low quality
    if (user && flashcards[currentIndex]?.id) {
      try {
        await updateFlashcardProgress(user.id, flashcards[currentIndex].id, false); // Incorrect answer
      } catch (error) {
        console.error('Error updating progress:', error);
      }
    }
    nextCard();
  };

  const nextCard = () => {
    setIsFlipped(false);
    if (currentIndex < flashcards.length - 1) {
      setCurrentIndex(currentIndex + 1);
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
      <header className={`p-4 md:p-6 flex items-center justify-between ${mode === 'exam' ? 'text-slate-900' : 'text-white'}`}>
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 font-medium hover:opacity-80">
          <span className="material-symbols-outlined">close</span>
          <span className="hidden md:inline">Finalizar Sesión</span>
        </button>
        <div className="flex-1 max-w-md mx-8">
          <div className="flex justify-between text-xs font-bold uppercase tracking-wider mb-1 opacity-80">
            <span>{className || 'Sesión de Estudio'}</span>
            <span>{mode === 'quiz' ? `${currentQuizIndex + 1}/${quizQuestions.length}` : `${currentIndex + 1}/${flashcards.length}`}</span>
          </div>
          <div className={`w-full h-2 rounded-full overflow-hidden ${mode === 'exam' ? 'bg-slate-200' : 'bg-white/20'}`}>
            <div
              className={`h-full rounded-full transition-all ${mode === 'exam' ? 'bg-primary' : 'bg-white'}`}
              style={{ width: `${mode === 'quiz' ? ((currentQuizIndex + 1) / quizQuestions.length) * 100 : ((currentIndex + 1) / flashcards.length) * 100}%` }}
            ></div>
          </div>
        </div>
        <div className={`flex items-center gap-2 px-4 py-2 rounded-full ${mode === 'exam' ? 'bg-slate-200 text-slate-700' : 'bg-white/20'}`}>
          {mode === 'exam' ? (
            <>
              <span className="material-symbols-outlined text-rose-500">timer</span>
              <span className="font-black text-xl">{formatTime(examTime)}</span>
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-amber-400 fill-1">local_fire_department</span>
              <span className="font-black">+{xpEarned} XP</span>
            </>
          )}
        </div>
      </header>

      {/* Mode Selector */}
      <div className="flex justify-center px-4 mb-6">
        <div className={`inline-flex p-1 rounded-xl ${mode === 'exam' ? 'bg-slate-200' : 'bg-white/20'}`}>
          {[
            { id: 'flashcards', label: 'Flashcards', icon: 'style' },
            { id: 'quiz', label: 'Quiz', icon: 'quiz' },
            { id: 'exam', label: 'Examen', icon: 'assignment' },
            { id: 'cramming', label: 'Cramming', icon: 'bolt' }
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

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 pb-8">
        {/* Flashcards Mode */}
        {mode === 'flashcards' && (
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

            <div className="flex gap-4 mt-8">
              <button
                onClick={handleDontKnow}
                className="bg-white/20 backdrop-blur-sm text-white font-bold px-8 py-4 rounded-xl hover:bg-white/30 transition-all flex items-center gap-2"
              >
                <span className="material-symbols-outlined">close</span> No lo sé
              </button>
              <button
                onClick={handleKnow}
                className="bg-white text-primary font-bold px-8 py-4 rounded-xl shadow-lg hover:scale-105 transition-all flex items-center gap-2"
              >
                <span className="material-symbols-outlined">check</span> Lo sé
              </button>
            </div>
          </>
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
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center mx-auto mb-6">
                <span className="material-symbols-outlined text-5xl text-white">emoji_events</span>
              </div>
              <h2 className="text-3xl font-black text-slate-900 mb-2">¡Quiz Completado!</h2>
              <p className="text-slate-500 mb-6">Has ganado <strong className="text-primary">+{xpEarned} XP</strong></p>
              <div className="text-6xl font-black text-primary mb-2">{score}/{quizQuestions.length}</div>
              <p className="text-slate-600 mb-8">respuestas correctas ({Math.round((score / quizQuestions.length) * 100)}%)</p>
              <div className="flex gap-4">
                <button
                  onClick={() => { setQuizComplete(false); setCurrentQuizIndex(0); setScore(0); setXpEarned(0); }}
                  className="flex-1 bg-slate-100 text-slate-700 font-bold py-3 rounded-xl hover:bg-slate-200"
                >
                  Reintentar
                </button>
                <button
                  onClick={() => navigate(-1)}
                  className="flex-1 bg-primary text-white font-bold py-3 rounded-xl hover:bg-blue-700"
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
                {quizQuestions.map((q, i) => (
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
                          {String.fromCharCode(65 + j)}. {opt}
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
              <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 ${score >= 4 ? 'bg-emerald-100' : 'bg-rose-100'}`}>
                <span className={`material-symbols-outlined text-5xl ${score >= 4 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {score >= 4 ? 'check_circle' : 'cancel'}
                </span>
              </div>
              <h2 className="text-3xl font-black text-slate-900 mb-2">Examen Enviado</h2>
              <p className="text-slate-500 mb-2">{score >= 4 ? '¡Excelente trabajo!' : 'Sigue practicando'}</p>
              <p className="text-primary font-bold mb-6">+{xpEarned} XP ganados</p>
              <div className={`text-6xl font-black mb-2 ${score >= 4 ? 'text-emerald-600' : 'text-rose-600'}`}>{score}/{quizQuestions.length}</div>
              <p className="text-slate-600 mb-8">{Math.round((score / quizQuestions.length) * 100)}%</p>
              <button
                onClick={() => navigate(-1)}
                className="w-full bg-primary text-white font-bold py-3 rounded-xl hover:bg-blue-700"
              >
                Volver al Dashboard
              </button>
            </div>
          </div>
        )}

        {/* Cramming Mode */}
        {mode === 'cramming' && (
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
      </main>

      {/* Socratic Chat */}
      {(mode === 'flashcards' || mode === 'quiz') && (
        <SocraticChat
          context={flashcards[currentIndex]?.question || className || "General"}
          studentName={profile?.full_name?.split(' ')[0]}
        />
      )}

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
