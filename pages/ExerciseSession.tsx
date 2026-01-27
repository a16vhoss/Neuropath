import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import * as ExerciseService from '../services/ExerciseService';
import { ExerciseTemplate } from '../services/ExerciseService';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

const ExerciseSession: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    // State
    const [loading, setLoading] = useState(true);
    const [exercises, setExercises] = useState<ExerciseTemplate[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [startTime, setStartTime] = useState<number>(Date.now());
    const [userAnswer, setUserAnswer] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [feedback, setFeedback] = useState<{
        isCorrect: boolean;
        message: string;
        solution?: string;
        steps?: string[];
    } | null>(null);
    const [showSolution, setShowSolution] = useState(false);
    const [sessionStats, setSessionStats] = useState({ correct: 0, total: 0 });

    // Load exercises
    useEffect(() => {
        const loadExercises = async () => {
            if (!user) return;

            try {
                setLoading(true);
                const setIdsParam = searchParams.get('sets');
                const setIds = setIdsParam ? setIdsParam.split(',') : [];

                let loadedExercises: ExerciseTemplate[] = [];

                if (setIds.length > 0) {
                    for (const setId of setIds) {
                        const setExercises = await ExerciseService.getExercisesForStudySet(setId);
                        loadedExercises = [...loadedExercises, ...setExercises];
                    }
                } else {
                    // Fallback or empty state if no sets provided
                    // Ideally fetch generic or recent set exercises?
                }

                // Shuffle exercises for randomness
                loadedExercises = loadedExercises.sort(() => Math.random() - 0.5).slice(0, 10);

                if (loadedExercises.length > 0) {
                    setExercises(loadedExercises);
                    setStartTime(Date.now());
                } else {
                    // Handle empty state
                }
            } catch (error) {
                console.error('Error loading exercises:', error);
            } finally {
                setLoading(false);
            }
        };

        loadExercises();
    }, [user, searchParams]);

    const startAttempt = (template: ExerciseTemplate) => {
        setStartTime(Date.now());
        setUserAnswer('');
        setFeedback(null);
        setShowSolution(false);
    };

    const handleSubmit = async () => {
        if (!user || !userAnswer.trim()) return;

        setSubmitting(true);
        try {
            const currentExercise = exercises[currentIndex];
            const timeSpent = (Date.now() - startTime) / 1000;

            // Basic validation logic
            const isExactMatch = userAnswer.trim().toLowerCase() === (currentExercise.solution || '').trim().toLowerCase();

            // For MVP, if solution exists, check exact match. If not, assume correct (open text).
            // This is a simplification. 
            const isCorrect = currentExercise.solution ? isExactMatch : true;

            await ExerciseService.recordExerciseAttempt(
                user.id,
                currentExercise.id,
                isCorrect,
                Math.round(timeSpent)
            );

            setFeedback({
                isCorrect,
                message: isCorrect ? '¡Excelente trabajo!' : 'No es exactamente eso. Revisa la solución.',
                solution: currentExercise.solution,
                steps: currentExercise.step_by_step_explanation
            });

            if (isCorrect) {
                setSessionStats(prev => ({ ...prev, correct: prev.correct + 1, total: prev.total + 1 }));
            } else {
                setSessionStats(prev => ({ ...prev, total: prev.total + 1 }));
            }

        } catch (error) {
            console.error('Error submitting:', error);
        } finally {
            setSubmitting(false);
        }
    };

    const handleNext = () => {
        if (currentIndex < exercises.length - 1) {
            const nextIndex = currentIndex + 1;
            setCurrentIndex(nextIndex);
            startAttempt(exercises[nextIndex]);
        } else {
            // Finished
            navigate('/student'); // Or result summary
        }
    };

    if (loading) {
        return <div className="p-8 text-center">Cargando ejercicios...</div>;
    }

    if (exercises.length === 0) {
        return (
            <div className="p-8 text-center min-h-screen flex flex-col items-center justify-center">
                <h2 className="text-xl font-bold mb-2">No hay ejercicios disponibles</h2>
                <p className="text-slate-500 mb-6">Intenta generar ejercicios desde tus sets de estudio primero.</p>
                <button
                    onClick={() => navigate('/student')}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                    Volver al Dashboard
                </button>
            </div>
        );
    }

    const currentExercise = exercises[currentIndex];

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            {/* Header */}
            <header className="bg-white border-b px-6 py-4 flex items-center justify-between sticky top-0 z-10">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate(-1)} className="text-slate-400 hover:text-slate-600">
                        <span className="material-symbols-outlined">arrow_back</span>
                    </button>
                    <div>
                        <h1 className="text-lg font-bold text-slate-800">Práctica de Ejercicios</h1>
                        <div className="flex items-center gap-2 text-sm text-slate-500">
                            <span>{currentExercise.topic || 'General'}</span>
                            <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                            <span>Dificultad {currentExercise.difficulty}/5</span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="text-right">
                        <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Progreso</p>
                        <p className="font-bold text-slate-700">{currentIndex + 1} / {exercises.length}</p>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 max-w-4xl w-full mx-auto p-6 md:p-8">

                {/* Problem Statement */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
                    <div className="prose prose-slate max-w-none">
                        <ReactMarkdown
                            remarkPlugins={[remarkMath]}
                            rehypePlugins={[rehypeKatex]}
                        >
                            {currentExercise.problem_statement}
                        </ReactMarkdown>
                    </div>
                </div>

                {/* Answer Input */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
                    <h3 className="font-bold text-slate-700 mb-2">Tu Respuesta</h3>
                    <textarea
                        value={userAnswer}
                        onChange={(e) => setUserAnswer(e.target.value)}
                        className="w-full h-32 p-4 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none font-mono text-sm"
                        placeholder="Escribe tu respuesta o código aquí..."
                        disabled={feedback !== null}
                    />

                    {!feedback ? (
                        <div className="mt-4 flex justify-end">
                            <button
                                onClick={handleSubmit}
                                disabled={!userAnswer.trim() || submitting}
                                className={`px-6 py-2 rounded-lg font-bold text-white transition-all ${!userAnswer.trim() || submitting
                                        ? 'bg-slate-300 cursor-not-allowed'
                                        : 'bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200'
                                    }`}
                            >
                                {submitting ? 'Verificando...' : 'Verificar Respuesta'}
                            </button>
                        </div>
                    ) : (
                        <div className={`mt-6 p-4 rounded-lg border ${feedback.isCorrect ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'
                            }`}>
                            <div className="flex items-start gap-3">
                                <span className={`material-symbols-outlined text-2xl ${feedback.isCorrect ? 'text-green-600' : 'text-amber-600'
                                    }`}>
                                    {feedback.isCorrect ? 'check_circle' : 'help'}
                                </span>
                                <div>
                                    <h4 className={`font-bold ${feedback.isCorrect ? 'text-green-800' : 'text-amber-800'
                                        }`}>
                                        {feedback.message}
                                    </h4>

                                    {!feedback.isCorrect && (
                                        <div className="mt-2">
                                            <button
                                                onClick={() => setShowSolution(!showSolution)}
                                                className="text-sm font-medium text-amber-700 hover:text-amber-900 underline"
                                            >
                                                {showSolution ? 'Ocultar solución' : 'Ver solución completa'}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {(feedback.isCorrect || showSolution) && (
                                <div className="mt-4 pt-4 border-t border-black/5 animate-fadeIn">
                                    <h5 className="font-bold text-slate-700 mb-2">Solución:</h5>
                                    <div className="prose prose-sm max-w-none bg-white p-3 rounded border border-slate-200 mb-4">
                                        <ReactMarkdown
                                            remarkPlugins={[remarkMath]}
                                            rehypePlugins={[rehypeKatex]}
                                        >
                                            {feedback.solution || ''}
                                        </ReactMarkdown>
                                    </div>

                                    {feedback.steps && feedback.steps.length > 0 && (
                                        <>
                                            <h5 className="font-bold text-slate-700 mb-2">Explicación paso a paso:</h5>
                                            <ul className="space-y-2">
                                                {feedback.steps.map((step, idx) => (
                                                    <li key={idx} className="flex gap-2 text-sm text-slate-600">
                                                        <span className="font-bold text-slate-400">{idx + 1}.</span>
                                                        <span>{step}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </>
                                    )}
                                </div>
                            )}

                            <div className="mt-6 flex justify-end">
                                <button
                                    onClick={handleNext}
                                    className="px-6 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 font-medium flex items-center gap-2"
                                >
                                    <span>{currentIndex < exercises.length - 1 ? 'Siguiente Pregunta' : 'Finalizar Sesión'}</span>
                                    <span className="material-symbols-outlined text-sm">arrow_forward</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>

            </main>
        </div>
    );
};

export default ExerciseSession;
