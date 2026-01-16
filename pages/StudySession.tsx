
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { generateStudyFlashcards, getTutorResponse } from '../services/geminiService';

type StudyMode = 'flashcards' | 'quiz' | 'exam' | 'cramming';

interface Flashcard {
  id: string;
  question: string;
  answer: string;
  category: string;
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
  const { classId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const modeParam = searchParams.get('mode') as StudyMode || 'flashcards';

  const [mode, setMode] = useState<StudyMode>(modeParam);
  const [loading, setLoading] = useState(true);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [streak, setStreak] = useState(12);
  const [showTutor, setShowTutor] = useState(false);
  const [tutorQuestion, setTutorQuestion] = useState('');
  const [tutorResponse, setTutorResponse] = useState('');
  const [tutorLoading, setTutorLoading] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

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

  useEffect(() => {
    const fetchCards = async () => {
      setLoading(true);
      const cards = await generateStudyFlashcards("Neurobiología básica y sinapsis");
      if (cards && cards.length > 0) {
        setFlashcards(cards.map((c: { question: string; answer: string; category: string }, i: number) => ({
          id: String(i),
          question: c.question,
          answer: c.answer,
          category: c.category
        })));
      } else {
        setFlashcards(mockFlashcards);
      }
      setLoading(false);
    };
    fetchCards();
  }, []);

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

  const handleAskTutor = async () => {
    if (!tutorQuestion.trim()) return;
    setTutorLoading(true);
    const response = await getTutorResponse(tutorQuestion, flashcards[currentIndex]?.question || "Neurobiología");
    setTutorResponse(response || "Lo siento, no pude procesar tu pregunta.");
    setTutorLoading(false);
  };

  const handleKnow = () => {
    setStreak(s => s + 1);
    triggerConfetti();
    nextCard();
  };

  const handleDontKnow = () => {
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

  const handleExamSubmit = () => {
    let examScore = 0;
    examAnswers.forEach((answer, i) => {
      if (answer === quizQuestions[i].correctIndex) {
        examScore++;
      }
    });
    setScore(examScore);
    setExamSubmitted(true);
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
        <p className="text-xl font-bold">IA generando tu sesión personalizada...</p>
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
        <button onClick={() => navigate('/student')} className="flex items-center gap-2 font-medium hover:opacity-80">
          <span className="material-symbols-outlined">close</span>
          <span className="hidden md:inline">Finalizar Sesión</span>
        </button>
        <div className="flex-1 max-w-md mx-8">
          <div className="flex justify-between text-xs font-bold uppercase tracking-wider mb-1 opacity-80">
            <span>Progreso</span>
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
              <span className="font-black">Racha x{streak}</span>
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
              <p className="text-slate-500 mb-6">Has terminado el quiz</p>
              <div className="text-6xl font-black text-primary mb-2">{score}/{quizQuestions.length}</div>
              <p className="text-slate-600 mb-8">respuestas correctas ({Math.round((score / quizQuestions.length) * 100)}%)</p>
              <div className="flex gap-4">
                <button
                  onClick={() => { setQuizComplete(false); setCurrentQuizIndex(0); setScore(0); }}
                  className="flex-1 bg-slate-100 text-slate-700 font-bold py-3 rounded-xl hover:bg-slate-200"
                >
                  Reintentar
                </button>
                <button
                  onClick={() => navigate('/student')}
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
              <p className="text-slate-500 mb-6">{score >= 4 ? '¡Excelente trabajo!' : 'Sigue practicando'}</p>
              <div className={`text-6xl font-black mb-2 ${score >= 4 ? 'text-emerald-600' : 'text-rose-600'}`}>{score}/{quizQuestions.length}</div>
              <p className="text-slate-600 mb-8">{Math.round((score / quizQuestions.length) * 100)}%</p>
              <button
                onClick={() => navigate('/student')}
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

      {/* AI Tutor Button */}
      {(mode === 'flashcards' || mode === 'quiz') && (
        <button
          onClick={() => setShowTutor(true)}
          className="fixed bottom-6 right-6 w-14 h-14 bg-violet-600 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-violet-700 transition-all hover:scale-110"
        >
          <span className="material-symbols-outlined">smart_toy</span>
        </button>
      )}

      {/* AI Tutor Modal */}
      {showTutor && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-t-3xl md:rounded-3xl shadow-2xl max-h-[80vh] flex flex-col">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center">
                  <span className="material-symbols-outlined text-violet-600">smart_toy</span>
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">Tutor IA Socrático</h3>
                  <p className="text-xs text-slate-500">Te guío con preguntas, no respuestas</p>
                </div>
              </div>
              <button onClick={() => setShowTutor(false)} className="p-2 hover:bg-slate-100 rounded-full">
                <span className="material-symbols-outlined text-slate-400">close</span>
              </button>
            </div>
            <div className="flex-1 p-6 overflow-y-auto">
              {tutorResponse && (
                <div className="bg-violet-50 p-4 rounded-2xl mb-4">
                  <p className="text-slate-700 leading-relaxed">{tutorResponse}</p>
                </div>
              )}
              {tutorLoading && (
                <div className="flex items-center gap-2 text-violet-600">
                  <div className="w-4 h-4 border-2 border-violet-600 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-sm">Pensando...</span>
                </div>
              )}
            </div>
            <div className="p-4 border-t border-slate-100">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={tutorQuestion}
                  onChange={(e) => setTutorQuestion(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAskTutor()}
                  placeholder="¿Qué no entiendes?"
                  className="flex-1 px-4 py-3 bg-slate-100 rounded-xl focus:ring-2 focus:ring-violet-200 outline-none"
                />
                <button
                  onClick={handleAskTutor}
                  disabled={tutorLoading}
                  className="bg-violet-600 text-white px-4 rounded-xl hover:bg-violet-700 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined">send</span>
                </button>
              </div>
            </div>
          </div>
        </div>
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
      `}</style>
    </div>
  );
};

export default StudySession;
