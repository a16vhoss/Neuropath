import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { BattleService, BattleQuestion } from '../services/BattleService';

const BattleArena: React.FC = () => {
    const { battleId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();

    const [loading, setLoading] = useState(true);
    const [questions, setQuestions] = useState<BattleQuestion[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [userAnswer, setUserAnswer] = useState('');
    const [showAnswer, setShowAnswer] = useState(false);
    const [score, setScore] = useState(0);
    const [startTime, setStartTime] = useState<number>(0);
    const [submitting, setSubmitting] = useState(false);
    const [battleComplete, setBattleComplete] = useState(false);
    const [result, setResult] = useState<{ won: boolean; tied: boolean } | null>(null);

    useEffect(() => {
        if (!battleId || !user) return;
        loadBattle();
    }, [battleId, user]);

    const loadBattle = async () => {
        if (!battleId) return;
        setLoading(true);
        try {
            const qs = await BattleService.getBattleQuestions(battleId);
            setQuestions(qs);
            setStartTime(Date.now());
        } catch (error) {
            console.error('Error loading battle:', error);
        } finally {
            setLoading(false);
        }
    };

    const normalizeAnswer = (answer: string): string => {
        return answer.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    };

    const checkAnswer = async (isCorrect: boolean) => {
        if (!battleId || !user || submitting) return;
        setSubmitting(true);

        const currentQuestion = questions[currentIndex];
        const answerTime = Date.now() - startTime;

        try {
            await BattleService.submitAnswer(
                battleId,
                currentQuestion.id,
                user.id,
                userAnswer,
                isCorrect,
                answerTime
            );

            if (isCorrect) {
                setScore(prev => prev + 1);
            }

            setShowAnswer(true);

            // Check if battle is complete
            const { completed, winner_id } = await BattleService.checkBattleComplete(battleId);
            if (completed) {
                setBattleComplete(true);
                setResult({
                    won: winner_id === user.id,
                    tied: winner_id === null
                });
            }
        } catch (error) {
            console.error('Error submitting answer:', error);
        } finally {
            setSubmitting(false);
        }
    };

    const handleSubmit = () => {
        const currentQuestion = questions[currentIndex];
        const correctAnswer = currentQuestion.flashcard?.answer || '';
        const isCorrect = normalizeAnswer(userAnswer).includes(normalizeAnswer(correctAnswer)) ||
            normalizeAnswer(correctAnswer).includes(normalizeAnswer(userAnswer));
        checkAnswer(isCorrect);
    };

    const handleNext = () => {
        if (currentIndex < questions.length - 1) {
            setCurrentIndex(prev => prev + 1);
            setUserAnswer('');
            setShowAnswer(false);
            setStartTime(Date.now());
        } else {
            setBattleComplete(true);
        }
    };

    const handleSelfGrade = (correct: boolean) => {
        checkAnswer(correct);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-violet-900 via-purple-800 to-violet-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
            </div>
        );
    }

    if (battleComplete) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-violet-900 via-purple-800 to-violet-900 flex items-center justify-center p-4">
                <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full text-center">
                    {result?.won ? (
                        <>
                            <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mb-6">
                                <span className="material-symbols-outlined text-5xl text-white">emoji_events</span>
                            </div>
                            <h1 className="text-3xl font-black text-slate-900 mb-2">¡VICTORIA!</h1>
                            <p className="text-slate-500 mb-6">Has ganado la batalla</p>
                        </>
                    ) : result?.tied ? (
                        <>
                            <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-slate-400 to-slate-500 flex items-center justify-center mb-6">
                                <span className="material-symbols-outlined text-5xl text-white">handshake</span>
                            </div>
                            <h1 className="text-3xl font-black text-slate-900 mb-2">¡EMPATE!</h1>
                            <p className="text-slate-500 mb-6">Ambos jugadores empataron</p>
                        </>
                    ) : (
                        <>
                            <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-slate-300 to-slate-400 flex items-center justify-center mb-6">
                                <span className="material-symbols-outlined text-5xl text-white">sentiment_dissatisfied</span>
                            </div>
                            <h1 className="text-3xl font-black text-slate-900 mb-2">Batalla Completada</h1>
                            <p className="text-slate-500 mb-6">Esperando al oponente...</p>
                        </>
                    )}

                    <div className="bg-slate-50 p-4 rounded-xl mb-6">
                        <p className="text-4xl font-black text-violet-600">{score}/{questions.length}</p>
                        <p className="text-sm text-slate-500">respuestas correctas</p>
                    </div>

                    <button
                        onClick={() => navigate('/student/battles')}
                        className="w-full bg-gradient-to-r from-violet-600 to-purple-600 text-white font-bold py-3 rounded-xl hover:shadow-lg"
                    >
                        Volver a Batallas
                    </button>
                </div>
            </div>
        );
    }

    const currentQuestion = questions[currentIndex];

    return (
        <div className="min-h-screen bg-gradient-to-br from-violet-900 via-purple-800 to-violet-900 p-4">
            {/* Header */}
            <div className="max-w-2xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <button
                        onClick={() => navigate('/student/battles')}
                        className="text-white/60 hover:text-white flex items-center gap-2"
                    >
                        <span className="material-symbols-outlined">close</span>
                    </button>
                    <div className="flex items-center gap-4">
                        <span className="text-white/80 font-medium">Pregunta {currentIndex + 1}/{questions.length}</span>
                        <div className="bg-white/20 px-4 py-1 rounded-full">
                            <span className="text-white font-bold">{score} pts</span>
                        </div>
                    </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full h-2 bg-white/20 rounded-full mb-8 overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-300"
                        style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
                    ></div>
                </div>

                {/* Question Card */}
                <div className="bg-white rounded-3xl shadow-2xl p-8">
                    <div className="mb-8">
                        <p className="text-sm text-violet-600 font-bold mb-2">PREGUNTA</p>
                        <h2 className="text-xl font-black text-slate-900">
                            {currentQuestion?.flashcard?.question || 'Cargando...'}
                        </h2>
                    </div>

                    {!showAnswer ? (
                        <div className="space-y-4">
                            <input
                                type="text"
                                value={userAnswer}
                                onChange={(e) => setUserAnswer(e.target.value)}
                                placeholder="Escribe tu respuesta..."
                                className="w-full px-6 py-4 border-2 border-slate-200 rounded-2xl focus:ring-4 focus:ring-violet-500/20 focus:border-violet-500 outline-none text-lg"
                                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                                autoFocus
                            />
                            <button
                                onClick={handleSubmit}
                                disabled={!userAnswer.trim() || submitting}
                                className="w-full bg-gradient-to-r from-violet-600 to-purple-600 text-white font-bold py-4 rounded-2xl hover:shadow-lg disabled:opacity-50 transition-all"
                            >
                                {submitting ? 'Enviando...' : 'Verificar Respuesta'}
                            </button>

                            <div className="flex items-center justify-center gap-4 pt-4">
                                <p className="text-slate-400 text-sm">¿No estás seguro?</p>
                                <button
                                    onClick={() => setShowAnswer(true)}
                                    className="text-violet-600 font-medium text-sm hover:underline"
                                >
                                    Ver respuesta y autoevaluar
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="bg-violet-50 p-4 rounded-xl border border-violet-100">
                                <p className="text-sm text-violet-600 font-bold mb-1">RESPUESTA CORRECTA</p>
                                <p className="text-lg font-bold text-slate-900">{currentQuestion?.flashcard?.answer}</p>
                            </div>

                            {userAnswer && (
                                <div className="bg-slate-50 p-4 rounded-xl">
                                    <p className="text-sm text-slate-500 mb-1">Tu respuesta:</p>
                                    <p className="text-slate-900">{userAnswer}</p>
                                </div>
                            )}

                            <div className="pt-4">
                                <p className="text-center text-slate-500 mb-4">¿Tu respuesta fue correcta?</p>
                                <div className="flex gap-4">
                                    <button
                                        onClick={() => handleSelfGrade(false)}
                                        className="flex-1 bg-rose-100 text-rose-600 font-bold py-4 rounded-2xl hover:bg-rose-200 transition-colors"
                                    >
                                        <span className="material-symbols-outlined align-middle mr-2">close</span>
                                        Incorrecta
                                    </button>
                                    <button
                                        onClick={() => handleSelfGrade(true)}
                                        className="flex-1 bg-emerald-100 text-emerald-600 font-bold py-4 rounded-2xl hover:bg-emerald-200 transition-colors"
                                    >
                                        <span className="material-symbols-outlined align-middle mr-2">check</span>
                                        Correcta
                                    </button>
                                </div>
                            </div>

                            {!submitting && showAnswer && (
                                <button
                                    onClick={handleNext}
                                    className="w-full bg-slate-100 text-slate-600 font-bold py-3 rounded-xl hover:bg-slate-200 mt-4"
                                >
                                    {currentIndex < questions.length - 1 ? 'Siguiente Pregunta' : 'Finalizar'}
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BattleArena;
