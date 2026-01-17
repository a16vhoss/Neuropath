import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { generateMockExam, validateExamAnswers, MockExam, ExamQuestion } from '../services/ExamService';
import { getStudentStudySets } from '../services/supabaseClient';

const MockExamPage: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    const [status, setStatus] = useState<'intro' | 'selection' | 'loading' | 'grading' | 'active' | 'results'>('intro');
    const [gradingResults, setGradingResults] = useState<Record<string, boolean>>({});

    // Restored states
    const [exam, setExam] = useState<MockExam | null>(null);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
    const [score, setScore] = useState(0);
    const [loadingText, setLoadingText] = useState("Analizando tus sets de estudio...");

    const submitExam = async () => {
        if (!exam) return;
        setStatus('grading');
        setLoadingText("La IA está corrigiendo tu examen...");

        try {
            // Use AI for semantic grading
            const results = await validateExamAnswers(exam.questions, userAnswers);
            setGradingResults(results);

            // Calculate Score based on AI results
            const correctCount = Object.values(results).filter(Boolean).length;
            setScore(correctCount);
        } catch (e) {
            console.error("Link grading failed", e);
            // Fallback local calc
            let correctCount = 0;
            const fallbackResults: Record<string, boolean> = {};
            exam.questions.forEach(q => {
                const isCorrect = normalizeAnswer(userAnswers[q.id]) === normalizeAnswer(q.correctAnswer);
                if (isCorrect) correctCount++;
                fallbackResults[q.id] = isCorrect;
            });
            setGradingResults(fallbackResults);
            setScore(correctCount);
        }

        setStatus('results');
    };

    const normalizeAnswer = (text: string | null | undefined): string => {
        if (!text) return '';
        let normalized = text.toLowerCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remove accents
            .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()¡¿"']/g, "") // remove punctuation
            .trim();

        // Map english boolean strings to spanish standard for robust comparison
        if (normalized === 'true') return 'verdadero';
        if (normalized === 'false') return 'falso';

        return normalized;
    };

    // Selection State
    const [availableSets, setAvailableSets] = useState<any[]>([]);
    const [selectedSetIds, setSelectedSetIds] = useState<string[]>([]);
    const [loadingSets, setLoadingSets] = useState(false);

    useEffect(() => {
        if (user) {
            loadSets();
        }
    }, [user]);

    const loadSets = async () => {
        if (!user) return;
        setLoadingSets(true);
        try {
            const sets = await getStudentStudySets(user.id);
            setAvailableSets(sets || []);
        } catch (e) {
            console.error("Error loading sets", e);
        } finally {
            setLoadingSets(false);
        }
    };

    useEffect(() => {
        // Fun loading messages
        if (status === 'loading') {
            const msgs = [
                "Analizando los sets seleccionados...",
                "Diseñando preguntas desafiantes...",
                "Calibrando dificultad...",
                "¡Casi listo!"
            ];
            let i = 0;
            const interval = setInterval(() => {
                i = (i + 1) % msgs.length;
                setLoadingText(msgs[i]);
            }, 2000);
            return () => clearInterval(interval);
        }
    }, [status]);

    const handleSetToggle = (setId: string) => {
        setSelectedSetIds(prev => {
            if (prev.includes(setId)) {
                return prev.filter(id => id !== setId);
            } else {
                return [...prev, setId];
            }
        });
    };

    const toggleSelectAll = () => {
        if (selectedSetIds.length === availableSets.length) {
            setSelectedSetIds([]);
        } else {
            setSelectedSetIds(availableSets.map(s => s.id));
        }
    };

    const startExam = async () => {
        if (!user) return;
        setStatus('loading');
        try {
            // Pass the selectedSetIds to the service
            // If array is empty (which shouldn't happen due to UI validation), it follows default logic
            const generatedExam = await generateMockExam(user.id, selectedSetIds);

            if (generatedExam) {
                setExam(generatedExam);
                setStatus('active');
            } else {
                alert("No pudimos generar un examen con los sets seleccionados. Intenta elegir otros.");
                setStatus('selection');
            }
        } catch (e) {
            console.error(e);
            alert("Error al generar el examen.");
            setStatus('selection');
        }
    };

    const handleAnswer = (answer: string) => {
        if (!exam) return;
        const question = exam.questions[currentQuestionIndex];
        setUserAnswers(prev => ({ ...prev, [question.id]: answer }));
    };

    const nextQuestion = () => {
        if (!exam) return;
        if (currentQuestionIndex < exam.questions.length - 1) {
            setCurrentQuestionIndex(prev => prev + 1);
        } else {
            submitExam();
        }
    };



    if (status === 'intro') {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
                <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 text-center">
                    <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <span className="material-symbols-outlined text-4xl text-indigo-600">school</span>
                    </div>
                    <h1 className="text-3xl font-bold text-slate-900 mb-2">Examen Simulacro</h1>
                    <p className="text-slate-500 mb-8">
                        La IA generará un examen único basado en tus sets de estudio.
                        Puedes elegir temas específicos o evaluar todo tu conocimiento.
                    </p>

                    <div className="space-y-4 text-left bg-slate-50 p-4 rounded-xl mb-8">
                        <div className="flex items-center gap-3">
                            <span className="material-symbols-outlined text-green-500">check_circle</span>
                            <span className="text-sm text-slate-600">Personaliza tus temas</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="material-symbols-outlined text-green-500">check_circle</span>
                            <span className="text-sm text-slate-600">Evaluación Instantánea</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="material-symbols-outlined text-green-500">check_circle</span>
                            <span className="text-sm text-slate-600">Mezcla todos tus temas</span>
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <button onClick={() => navigate('/student')} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-100 rounded-xl transition-colors">
                            Volver
                        </button>
                        <button onClick={() => setStatus('selection')} className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 transition-all transform hover:scale-105">
                            Configurar
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (status === 'selection') {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <div className="max-w-2xl w-full bg-white rounded-3xl shadow-xl flex flex-col max-h-[90vh]">
                    <div className="p-8 border-b">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-2xl font-black text-slate-900">Elige tus temas</h2>
                            <button
                                onClick={toggleSelectAll}
                                className="text-sm font-bold text-indigo-600 hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors"
                            >
                                {selectedSetIds.length === availableSets.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
                            </button>
                        </div>
                        <p className="text-slate-500">Selecciona al menos un set de estudio para generar tu examen simulacro.</p>
                    </div>

                    <div className="p-4 overflow-y-auto flex-1 bg-slate-50/50">
                        {loadingSets ? (
                            <div className="flex justify-center py-12">
                                <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                            </div>
                        ) : availableSets.length === 0 ? (
                            <div className="text-center py-12 text-slate-400">
                                No tienes sets de estudio creados aún.
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {availableSets.map(set => {
                                    const isSelected = selectedSetIds.includes(set.id);
                                    return (
                                        <div
                                            key={set.id}
                                            onClick={() => handleSetToggle(set.id)}
                                            className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex items-center gap-3
                                                ${isSelected
                                                    ? 'border-indigo-600 bg-indigo-50 shadow-sm'
                                                    : 'border-slate-200 bg-white hover:border-indigo-300'
                                                }
                                            `}
                                        >
                                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0
                                                ${isSelected ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300'}
                                            `}>
                                                {isSelected && <span className="material-symbols-outlined text-white text-xs font-bold leading-none">check</span>}
                                            </div>
                                            <div className="overflow-hidden">
                                                <h3 className={`font-bold truncate ${isSelected ? 'text-indigo-900' : 'text-slate-700'}`}>{set.name}</h3>
                                                <p className="text-xs text-slate-400 truncate">{set.flashcard_count || 0} tarjetas</p>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>

                    <div className="p-6 border-t bg-white rounded-b-3xl flex justify-between items-center gap-4">
                        <button
                            onClick={() => setStatus('intro')}
                            className="px-6 py-3 font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors"
                        >
                            Atrás
                        </button>
                        <div className="text-sm font-bold text-slate-400">
                            {selectedSetIds.length} seleccionados
                        </div>
                        <button
                            onClick={startExam}
                            disabled={selectedSetIds.length === 0}
                            className="px-8 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:shadow-none transition-all transform active:scale-95"
                        >
                            Comenzar Examen
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (status === 'loading') {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-6"></div>
                    <h2 className="text-xl font-bold text-slate-800 animate-pulse">{loadingText}</h2>
                </div>
            </div>
        );
    }

    if (status === 'active' && exam) {
        const question = exam.questions[currentQuestionIndex];
        const progress = ((currentQuestionIndex + 1) / exam.questions.length) * 100;

        return (
            <div className="min-h-screen bg-slate-50 flex flex-col">
                {/* Header */}
                <div className="bg-white h-16 border-b flex items-center px-6 justify-between sticky top-0 z-10">
                    <span className="font-bold text-slate-500">Pregunta {currentQuestionIndex + 1}/{exam.questions.length}</span>
                    <button onClick={submitExam} className="text-sm text-rose-500 font-bold hover:underline">
                        Terminar Examen
                    </button>
                </div>
                <div className="h-1 bg-slate-200 w-full">
                    <div className="h-full bg-indigo-600 transition-all duration-500" style={{ width: `${progress}%` }}></div>
                </div>

                {/* Content */}
                <div className="flex-1 max-w-3xl w-full mx-auto p-6 flex flex-col justify-center">
                    <span className="inline-block px-3 py-1 bg-indigo-100 text-indigo-700 text-xs font-bold rounded-full mb-4 w-fit uppercase tracking-wider">
                        {question.type.replace('_', ' ')}
                    </span>
                    <h2 className="text-2xl font-bold text-slate-900 mb-8 leading-relaxed">
                        {question.question}
                    </h2>

                    <div className="space-y-4">
                        {question.type === 'multiple_choice' && question.options?.map((opt, i) => (
                            <button
                                key={i}
                                onClick={() => handleAnswer(opt)}
                                className={`w-full text-left p-6 rounded-2xl border-2 transition-all group flex items-center gap-4
                                    ${userAnswers[question.id] === opt
                                        ? 'border-indigo-600 bg-indigo-50 text-indigo-900 shadow-md transform scale-[1.01]'
                                        : 'border-slate-200 hover:border-indigo-300 hover:bg-white text-slate-700 bg-white'
                                    }
                                `}
                            >
                                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center
                                     ${userAnswers[question.id] === opt ? 'border-indigo-600' : 'border-slate-300 group-hover:border-indigo-400'}
                                `}>
                                    {userAnswers[question.id] === opt && <div className="w-3 h-3 bg-indigo-600 rounded-full"></div>}
                                </div>
                                <span className="font-medium text-lg">{opt}</span>
                            </button>
                        ))}

                        {question.type === 'true_false' && (
                            <div className="flex gap-4">
                                {['Verdadero', 'Falso'].map(opt => (
                                    <button
                                        key={opt}
                                        onClick={() => handleAnswer(opt)}
                                        className={`flex-1 p-8 rounded-2xl border-2 font-bold text-xl transition-all
                                            ${userAnswers[question.id] === opt
                                                ? 'border-indigo-600 bg-indigo-50 text-indigo-900'
                                                : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-300'
                                            }
                                        `}
                                    >
                                        {opt}
                                    </button>
                                ))}
                            </div>
                        )}

                        {question.type === 'short_answer' && (
                            <textarea
                                value={userAnswers[question.id] || ''}
                                onChange={(e) => handleAnswer(e.target.value)}
                                placeholder="Escribe tu respuesta aquí..."
                                className="w-full p-6 text-lg border-2 border-slate-200 rounded-2xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 outline-none transition-all resize-none h-40"
                            />
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="bg-white p-6 border-t flex justify-between max-w-3xl w-full mx-auto">
                    <button
                        onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
                        disabled={currentQuestionIndex === 0}
                        className="px-6 py-3 font-bold text-slate-500 disabled:opacity-30 hover:bg-slate-50 rounded-xl"
                    >
                        Anterior
                    </button>
                    <button
                        onClick={nextQuestion}
                        disabled={!userAnswers[question.id]}
                        className="px-8 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:shadow-none transition-all"
                    >
                        {currentQuestionIndex === exam.questions.length - 1 ? 'Finalizar' : 'Siguiente'}
                    </button>
                </div>
            </div>
        );
    }

    if (status === 'results' && exam) {
        const percentage = Math.round((score / exam.questions.length) * 100);

        return (
            <div className="min-h-screen bg-slate-50 p-6">
                <div className="max-w-4xl mx-auto">
                    <div className="bg-white rounded-3xl shadow-xl overflow-hidden mb-8">
                        <div className="bg-indigo-600 p-12 text-center text-white">
                            <h2 className="text-2xl font-bold opacity-90 mb-2">Resultado Final</h2>
                            <div className="text-8xl font-black mb-4 tracking-tight">{percentage}%</div>
                            <p className="text-indigo-200 text-lg">
                                Has acertado {score} de {exam.questions.length} preguntas
                            </p>
                        </div>

                        <div className="p-8">
                            <h3 className="font-bold text-xl text-slate-800 mb-6 border-b pb-4">Revisión de Respuestas</h3>
                            <div className="space-y-8">
                                {exam.questions.map((q, i) => {
                                    const userAnswer = userAnswers[q.id];
                                    // Use AI result if available, otherwise fallback to local normalization
                                    const isCorrect = gradingResults[q.id] ?? (normalizeAnswer(userAnswer) === normalizeAnswer(q.correctAnswer));

                                    return (
                                        <div key={q.id} className={`p-6 rounded-2xl border-l-4 ${isCorrect ? 'bg-green-50 border-green-500' : 'bg-red-50 border-red-500'}`}>
                                            <div className="flex gap-4 mb-3">
                                                <span className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-sm ${isCorrect ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                    {i + 1}
                                                </span>
                                                <div>
                                                    <p className="font-bold text-slate-800 text-lg">{q.question}</p>
                                                    {q.options && (
                                                        <div className="mt-2 text-sm text-slate-500">
                                                            Opciones: {q.options.join(', ')}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="ml-12 space-y-2">
                                                <div className="flex gap-2 text-sm">
                                                    <span className="font-bold text-slate-500 w-24">Tu respuesta:</span>
                                                    <span className={isCorrect ? 'text-green-700 font-medium' : 'text-red-600 font-medium line-through'}>
                                                        {userAnswer || '(Sin responder)'}
                                                    </span>
                                                </div>
                                                {!isCorrect && (
                                                    <div className="flex gap-2 text-sm">
                                                        <span className="font-bold text-slate-500 w-24">Correcta:</span>
                                                        <span className="text-green-700 font-bold">{q.correctAnswer}</span>
                                                    </div>
                                                )}
                                                <div className="mt-4 p-4 bg-white/50 rounded-xl text-sm italic text-slate-600 border border-black/5">
                                                    💡 {q.explanation}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="p-6 bg-slate-50 border-t flex justify-end">
                            <button onClick={() => navigate('/student')} className="px-8 py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-all">
                                Volver al Dashboard
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return null;
};

export default MockExamPage;
