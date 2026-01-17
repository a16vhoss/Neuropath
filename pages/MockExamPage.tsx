import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { generateMockExam, MockExam, ExamQuestion } from '../services/ExamService';

const MockExamPage: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    const [status, setStatus] = useState<'intro' | 'loading' | 'active' | 'results'>('intro');
    const [exam, setExam] = useState<MockExam | null>(null);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
    const [score, setScore] = useState(0);
    const [loadingText, setLoadingText] = useState("Analizando tus sets de estudio...");

    useEffect(() => {
        // Fun loading messages
        if (status === 'loading') {
            const msgs = [
                "Analizando tus sets de estudio...",
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

    const startExam = async () => {
        if (!user) return;
        setStatus('loading');
        try {
            const generatedExam = await generateMockExam(user.id);
            if (generatedExam) {
                setExam(generatedExam);
                setStatus('active');
            } else {
                alert("No pudimos generar un examen. Asegúrate de tener sets de estudio creados.");
                setStatus('intro');
            }
        } catch (e) {
            console.error(e);
            alert("Error al generar el examen.");
            setStatus('intro');
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

    const submitExam = () => {
        if (!exam) return;
        // Calculate Score
        let correctCount = 0;
        exam.questions.forEach(q => {
            const userAnswer = userAnswers[q.id]?.toLowerCase().trim();
            const correctAnswer = q.correctAnswer.toLowerCase().trim();

            // Fuzzy match for short answer could be improved, strict for now
            if (userAnswer === correctAnswer) {
                correctCount++;
            } else if (q.type === 'multiple_choice' && userAnswer === correctAnswer) {
                correctCount++;
            }
        });
        setScore(correctCount);
        setStatus('results');
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
                        La IA generará un examen único basado en todos tus sets de estudio actuales.
                        ¡Ideal para prepararte antes del examen real!
                    </p>

                    <div className="space-y-4 text-left bg-slate-50 p-4 rounded-xl mb-8">
                        <div className="flex items-center gap-3">
                            <span className="material-symbols-outlined text-green-500">check_circle</span>
                            <span className="text-sm text-slate-600">10 Preguntas Variadas</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="material-symbols-outlined text-green-500">check_circle</span>
                            <span className="text-sm text-slate-600">Evaluación Instantánea</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="material-symbols-outlined text-green-500">check_circle</span>
                            <span className="text-sm text-slate-600">Basado en TU contenido</span>
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <button onClick={() => navigate('/student')} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-100 rounded-xl transition-colors">
                            Volver
                        </button>
                        <button onClick={startExam} className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 transition-all transform hover:scale-105">
                            Comenzar
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
                                    const isCorrect = userAnswer?.toLowerCase().trim() === q.correctAnswer.toLowerCase().trim();

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
