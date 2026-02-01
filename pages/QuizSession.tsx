import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { generateAdaptiveQuiz, QuizConfig, QuizQuestion, QuizSession as IQuizSession, saveQuizSession } from '../services/QuizService';
import ReactMarkdown from 'react-markdown';
import confetti from 'canvas-confetti';

const QuizSession: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const [loading, setLoading] = useState(true);
    const [questions, setQuestions] = useState<QuizQuestion[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [answers, setAnswers] = useState<Record<number, any>>({}); // index -> answer
    const [results, setResults] = useState<any[]>([]); // To store local results before save
    const [sessionComplete, setSessionComplete] = useState(false);
    const [score, setScore] = useState(0);
    const [startTime, setStartTime] = useState(Date.now());

    // Config from state
    const config = location.state?.config as QuizConfig;
    const studySetIds = location.state?.studySetIds as string[];

    useEffect(() => {
        if (!user || !config || !studySetIds) {
            navigate('/student');
            return;
        }

        const initQuiz = async () => {
            try {
                setLoading(true);
                const generatedQuestions = await generateAdaptiveQuiz(studySetIds, user.id, config);
                if (generatedQuestions.length === 0) {
                    alert('No se pudieron generar preguntas con el contenido seleccionado.');
                    navigate('/student');
                    return;
                }
                setQuestions(generatedQuestions);
                setStartTime(Math.round(Date.now() / 1000)); // Seconds for duration calc? Or ms for tracking
            } catch (error) {
                console.error('Error generating quiz:', error);
                alert('Error al generar el quiz.');
                navigate('/student');
            } finally {
                setLoading(false);
            }
        };

        if (questions.length === 0) {
            initQuiz();
        }
    }, [user, config, studySetIds, navigate, questions.length]); // Added dependency

    const submitAnswer = (index: number, answerVal: any) => {
        const question = questions[index];
        let isCorrect = false;

        if (['multiple_choice', 'true_false', 'analysis', 'practical'].includes(question.type)) {
            isCorrect = answerVal === question.correctIndex;
        } else {
            // For open text or complex types, we might need stricter validation or AI grading.
            // For now assuming correct if non-empty for design/exercise, or matching logic.
            if (question.type === 'exercise' || question.type === 'design') isCorrect = true; // Self-reported or AI
        }

        const result = {
            questionIndex: index,
            question: question.question,
            userAnswerIndex: typeof answerVal === 'number' ? answerVal : -1,
            correctAnswerIndex: question.correctIndex,
            isCorrect: isCorrect,
            topic: question.topic,
            textAnswer: typeof answerVal === 'string' ? answerVal : undefined
        };

        // Don't mutate state directly in logic if possible, but spread is fine
        const newResults = [...results, result];
        setResults(newResults);

        if (isCorrect) {
            setScore(prev => prev + 1);
            if (config.immediateFeedback) {
                // confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
            }
        }

        // Next or Finish
        if (index < questions.length - 1) {
            setCurrentIndex(index + 1);
        } else {
            finishQuiz(newResults);
        }
    };

    const finishQuiz = async (finalResults: any[]) => {
        setSessionComplete(true);
        const duration = Math.round((Date.now() / 1000) - (startTime / 1000)); // Ensure proper unit
        if (user) {
            await saveQuizSession(user.id, studySetIds, questions, finalResults, duration);
            confetti({ particleCount: 200, spread: 100, origin: { y: 0.6 } });
        }
    };

    const currentQuestion = questions[currentIndex];

    if (loading) return <div className="min-h-screen flex items-center justify-center text-white bg-slate-900">Generando tu Quiz Personalizado...</div>;
    if (sessionComplete) return (
        <div className="min-h-screen bg-slate-900 text-white p-8 flex flex-col items-center justify-center">
            <h1 className="text-4xl font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">¡Quiz Completado!</h1>
            <div className="text-6xl font-bold mb-8">{Math.round((score / questions.length) * 100)}%</div>
            <div className="grid grid-cols-2 gap-8 mb-8 text-center">
                <div>
                    <p className="text-gray-400">Correctas</p>
                    <p className="text-2xl font-bold text-green-400">{score}</p>
                </div>
                <div>
                    <p className="text-gray-400">Total</p>
                    <p className="text-2xl font-bold">{questions.length}</p>
                </div>
            </div>
            <button onClick={() => navigate('/student')} className="px-8 py-3 bg-purple-600 rounded-xl font-bold hover:bg-purple-500 transition-all">Volver al Dashboard</button>
        </div>
    );

    // Render Question
    return (
        <div className="min-h-screen bg-slate-900 text-gray-100 flex flex-col">
            <div className="h-2 bg-slate-800">
                <div
                    className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300"
                    style={{ width: `${((currentIndex) / questions.length) * 100}%` }}
                />
            </div>

            <div className="flex-1 max-w-4xl w-full mx-auto p-6 flex flex-col justify-center">
                <div className="mb-8">
                    <span className="inline-block px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 text-xs font-bold mb-4 border border-blue-500/20">
                        {currentQuestion.type.replace('_', ' ').toUpperCase()} • {currentQuestion.topic}
                    </span>
                    <h2 className="text-2xl md:text-3xl font-bold leading-tight">
                        {currentQuestion.question}
                    </h2>
                </div>

                <div className="space-y-4">
                    {['multiple_choice', 'true_false', 'analysis', 'practical'].includes(currentQuestion.type) && currentQuestion.options.map((option, idx) => (
                        <button
                            key={idx}
                            onClick={() => submitAnswer(currentIndex, idx)}
                            className="w-full text-left p-6 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-purple-500/50 transition-all group"
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-8 h-8 rounded-full border border-white/30 flex items-center justify-center group-hover:border-purple-400 group-hover:bg-purple-500/20">
                                    {String.fromCharCode(65 + idx)}
                                </div>
                                <span className="text-lg">{option}</span>
                            </div>
                        </button>
                    ))}

                    {/* Basic fallback for other types for now */}
                    {!['multiple_choice', 'true_false', 'analysis', 'practical'].includes(currentQuestion.type) && (
                        <div className="text-center p-8 bg-white/5 rounded-xl border border-white/10">
                            <p className="mb-4 text-gray-300">Este tipo de pregunta ({currentQuestion.type}) requiere interacción especial.</p>
                            <button
                                onClick={() => submitAnswer(currentIndex, 0)}
                                className="px-6 py-2 bg-purple-600 rounded-lg font-bold"
                            >
                                Continuar (Simular Correcto)
                            </button>
                        </div>
                    )}

                    {/* Escape hatch for testing */}
                    <button
                        onClick={() => navigate('/student')}
                        className="fixed top-4 right-4 text-gray-500 hover:text-white"
                    >
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default QuizSession;
