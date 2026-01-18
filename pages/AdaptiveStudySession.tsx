/**
 * AdaptiveStudySession.tsx
 * 
 * Página de sesión de estudio adaptativo basada en el algoritmo FSRS.
 * Implementa: Spaced Repetition, Active Recall, Interleaving
 * 
 * Flujo:
 * 1. Carga tarjetas priorizadas (vencidas > aprendiendo > nuevas)
 * 2. Muestra pregunta, usuario intenta recordar
 * 3. Revela respuesta, usuario califica (1-4)
 * 4. Sistema calcula nuevo intervalo con FSRS
 * 5. Actualiza estadísticas y XP
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { GamificationService } from '../services/GamificationService';
import {
    Rating,
    FlashcardWithSRS,
    SessionStats,
    getCardsForSession,
    updateCardAfterReview,
    createAdaptiveSession,
    endAdaptiveSession,
    calculateCardXP,
    formatInterval,
    getRatingLabel,
} from '../services/AdaptiveLearningService';
import MasteryIndicator from '../components/MasteryIndicator';
import SRSRatingButtons from '../components/SRSRatingButtons';
import AITutorChat from '../components/AITutorChat';

type SessionMode = 'adaptive' | 'review_due' | 'learn_new' | 'cramming';

const AdaptiveStudySession: React.FC = () => {
    const { classId, studySetId } = useParams();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const modeParam = (searchParams.get('mode') as SessionMode) || 'adaptive';
    const { user, profile } = useAuth();

    // Session state
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [cards, setCards] = useState<FlashcardWithSRS[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [loading, setLoading] = useState(true);
    const [sessionComplete, setSessionComplete] = useState(false);

    // Response timing
    const [responseStartTime, setResponseStartTime] = useState<number>(0);
    const [lastResponseTime, setLastResponseTime] = useState<number | null>(null);
    const [lastInterval, setLastInterval] = useState<number | null>(null);

    // Streak tracking
    const [correctStreak, setCorrectStreak] = useState(0);
    const [showStreakAnimation, setShowStreakAnimation] = useState(false);

    // Stats
    const [stats, setStats] = useState<SessionStats>({
        cardsStudied: 0,
        cardsCorrect: 0,
        cardsAgain: 0,
        avgResponseTimeMs: 0,
        retentionRate: 0,
        newCardsLearned: 0,
        reviewsCompleted: 0,
        xpEarned: 0,
        streakBonus: 0,
    });

    // AI Tutor
    const [showTutor, setShowTutor] = useState(false);

    // Confetti
    const [showConfetti, setShowConfetti] = useState(false);

    // Timer ref
    const sessionStartRef = useRef<number>(Date.now());

    // Load cards on mount
    useEffect(() => {
        const initSession = async () => {
            if (!user) {
                navigate('/auth');
                return;
            }

            setLoading(true);

            try {
                // Create session
                const newSessionId = await createAdaptiveSession(user.id, {
                    classId: classId || undefined,
                    studySetId: studySetId || undefined,
                    mode: modeParam,
                    maxNewCards: 10,
                    maxReviewCards: 30,
                });
                setSessionId(newSessionId);

                // Load cards
                const sessionCards = await getCardsForSession({
                    userId: user.id,
                    classId: classId || undefined,
                    studySetId: studySetId || undefined,
                    mode: modeParam,
                    maxNewCards: 10,
                    maxReviewCards: 30,
                });

                if (sessionCards.length === 0) {
                    // No cards available
                    setSessionComplete(true);
                } else {
                    setCards(sessionCards);
                    setResponseStartTime(Date.now());
                }
            } catch (error) {
                console.error('Error initializing session:', error);
            } finally {
                setLoading(false);
            }
        };

        initSession();
    }, [user, classId, studySetId, modeParam, navigate]);

    // Current card
    const currentCard = cards[currentIndex];

    // Handle rating
    const handleRate = useCallback(async (rating: Rating) => {
        if (!user || !currentCard || isFlipped === false) return;

        const responseTime = Date.now() - responseStartTime;
        setLastResponseTime(responseTime);

        // Update card with FSRS
        const result = await updateCardAfterReview(
            user.id,
            currentCard.id,
            rating,
            responseTime,
            sessionId || undefined
        );

        if (result) {
            setLastInterval(result.newInterval);
        }

        // Calculate XP
        const xpResult = calculateCardXP(rating, responseTime, correctStreak);
        const totalXP = xpResult.baseXP + xpResult.speedBonus + xpResult.streakBonus;

        // Update stats
        setStats(prev => {
            const newCardsStudied = prev.cardsStudied + 1;
            const newCardsCorrect = rating >= 3 ? prev.cardsCorrect + 1 : prev.cardsCorrect;
            const newCardsAgain = rating === 1 ? prev.cardsAgain + 1 : prev.cardsAgain;
            const newAvgTime = Math.round(
                (prev.avgResponseTimeMs * prev.cardsStudied + responseTime) / newCardsStudied
            );

            return {
                ...prev,
                cardsStudied: newCardsStudied,
                cardsCorrect: newCardsCorrect,
                cardsAgain: newCardsAgain,
                avgResponseTimeMs: newAvgTime,
                retentionRate: (newCardsCorrect / newCardsStudied) * 100,
                reviewsCompleted: prev.reviewsCompleted + 1,
                xpEarned: prev.xpEarned + totalXP,
                streakBonus: prev.streakBonus + xpResult.streakBonus,
                newCardsLearned: !currentCard.srs || currentCard.srs.state === 'new'
                    ? prev.newCardsLearned + 1
                    : prev.newCardsLearned,
            };
        });

        // Update streak
        if (rating >= 3) {
            const newStreak = correctStreak + 1;
            setCorrectStreak(newStreak);

            // Streak milestone animation
            if (newStreak % 5 === 0) {
                setShowStreakAnimation(true);
                setTimeout(() => setShowStreakAnimation(false), 1500);
            }
        } else {
            setCorrectStreak(0);
        }

        // Move to next card after brief delay
        setTimeout(() => {
            if (currentIndex < cards.length - 1) {
                setCurrentIndex(prev => prev + 1);
                setIsFlipped(false);
                setResponseStartTime(Date.now());
                setLastInterval(null);
            } else {
                // Session complete
                handleEndSession();
            }
        }, 800);
    }, [user, currentCard, isFlipped, responseStartTime, correctStreak, currentIndex, cards.length, sessionId]);

    // End session
    const handleEndSession = async () => {
        if (!user) return;

        setSessionComplete(true);
        setShowConfetti(true);

        // Calculate session duration
        const durationSeconds = Math.round((Date.now() - sessionStartRef.current) / 1000);

        // Update session in DB
        if (sessionId) {
            await endAdaptiveSession(sessionId, stats);
        }

        // Award XP to user
        if (stats.xpEarned > 0) {
            try {
                await GamificationService.awardXP(user.id, stats.xpEarned);
                await GamificationService.updateStreak(user.id);
            } catch (error) {
                console.error('Error awarding XP:', error);
            }
        }
    };

    // Flip card
    const handleFlip = () => {
        if (!isFlipped) {
            setIsFlipped(true);
        }
    };

    // Render loading state
    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-slate-600 font-medium">Preparando sesión adaptativa...</p>
                    <p className="text-sm text-slate-400 mt-2">Analizando tu historial de aprendizaje</p>
                </div>
            </div>
        );
    }

    // Render session complete
    if (sessionComplete) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 flex items-center justify-center p-4">
                {/* Confetti */}
                {showConfetti && (
                    <div className="fixed inset-0 pointer-events-none overflow-hidden">
                        {[...Array(50)].map((_, i) => (
                            <div
                                key={i}
                                className="absolute animate-confetti"
                                style={{
                                    left: `${Math.random() * 100}%`,
                                    animationDelay: `${Math.random() * 2}s`,
                                    backgroundColor: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8'][Math.floor(Math.random() * 5)],
                                    width: '10px',
                                    height: '10px',
                                    borderRadius: Math.random() > 0.5 ? '50%' : '0',
                                }}
                            />
                        ))}
                    </div>
                )}

                <div className="bg-white rounded-3xl shadow-xl p-8 max-w-md w-full text-center">
                    <div className="w-20 h-20 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full flex items-center justify-center mx-auto mb-6">
                        <span className="material-symbols-outlined text-white text-4xl">celebration</span>
                    </div>

                    <h1 className="text-2xl font-bold text-slate-900 mb-2">¡Sesión Completada!</h1>
                    <p className="text-slate-500 mb-6">Excelente trabajo. Aquí está tu resumen:</p>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="bg-slate-50 rounded-xl p-4">
                            <div className="text-3xl font-bold text-indigo-600">{stats.cardsStudied}</div>
                            <div className="text-sm text-slate-500">Tarjetas</div>
                        </div>
                        <div className="bg-slate-50 rounded-xl p-4">
                            <div className="text-3xl font-bold text-emerald-600">{Math.round(stats.retentionRate)}%</div>
                            <div className="text-sm text-slate-500">Retención</div>
                        </div>
                        <div className="bg-slate-50 rounded-xl p-4">
                            <div className="text-3xl font-bold text-amber-600">+{stats.xpEarned}</div>
                            <div className="text-sm text-slate-500">XP Ganados</div>
                        </div>
                        <div className="bg-slate-50 rounded-xl p-4">
                            <div className="text-3xl font-bold text-purple-600">{Math.round(stats.avgResponseTimeMs / 1000)}s</div>
                            <div className="text-sm text-slate-500">Tiempo Prom.</div>
                        </div>
                    </div>

                    {/* Streak Bonus */}
                    {stats.streakBonus > 0 && (
                        <div className="bg-gradient-to-r from-orange-100 to-amber-100 rounded-xl p-4 mb-6 flex items-center justify-center gap-2">
                            <span className="material-symbols-outlined text-orange-500">local_fire_department</span>
                            <span className="font-bold text-orange-700">+{stats.streakBonus} XP de racha</span>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="space-y-3">
                        <button
                            onClick={() => window.location.reload()}
                            className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition"
                        >
                            Otra Sesión
                        </button>
                        <button
                            onClick={() => navigate(-1)}
                            className="w-full py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition"
                        >
                            Volver
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Render no cards
    if (cards.length === 0) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-3xl shadow-xl p-8 max-w-md w-full text-center">
                    <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <span className="material-symbols-outlined text-emerald-600 text-4xl">check_circle</span>
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900 mb-2">¡Todo al día!</h1>
                    <p className="text-slate-500 mb-6">No tienes tarjetas pendientes para revisar.</p>
                    <button
                        onClick={() => navigate(-1)}
                        className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition"
                    >
                        Volver
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50">
            {/* Header */}
            <header className="bg-white/80 backdrop-blur-lg border-b border-slate-100 sticky top-0 z-40">
                <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
                    <button
                        onClick={() => navigate(-1)}
                        className="flex items-center gap-2 text-slate-600 hover:text-slate-900"
                    >
                        <span className="material-symbols-outlined">arrow_back</span>
                    </button>

                    {/* Progress */}
                    <div className="flex items-center gap-4">
                        <div className="text-sm font-medium text-slate-600">
                            {currentIndex + 1} / {cards.length}
                        </div>
                        <div className="w-32 h-2 bg-slate-200 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-indigo-500 transition-all duration-300"
                                style={{ width: `${((currentIndex + 1) / cards.length) * 100}%` }}
                            />
                        </div>
                    </div>

                    {/* Streak */}
                    {correctStreak > 0 && (
                        <div className={`flex items-center gap-1 px-3 py-1 rounded-full transition-all ${showStreakAnimation ? 'bg-orange-500 text-white scale-110' : 'bg-orange-100 text-orange-600'
                            }`}>
                            <span className="material-symbols-outlined text-sm">local_fire_department</span>
                            <span className="font-bold text-sm">{correctStreak}</span>
                        </div>
                    )}

                    {/* XP */}
                    <div className="flex items-center gap-1 text-amber-600 font-bold">
                        <span className="material-symbols-outlined text-sm">stars</span>
                        +{stats.xpEarned}
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-2xl mx-auto px-4 py-8">
                {/* Card Category & Mastery */}
                <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-medium text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
                        {currentCard?.category || 'General'}
                    </span>
                    <MasteryIndicator
                        level={currentCard?.srs?.mastery_level || 0}
                        size="md"
                        showLabel
                    />
                </div>

                {/* Flashcard */}
                <div
                    onClick={handleFlip}
                    className={`
                        relative bg-white rounded-3xl shadow-xl p-8 min-h-[300px]
                        cursor-pointer transition-all duration-500 transform
                        ${isFlipped ? 'rotate-y-180' : ''}
                        hover:shadow-2xl
                    `}
                    style={{ perspective: '1000px' }}
                >
                    <div className="flex flex-col items-center justify-center min-h-[250px]">
                        {!isFlipped ? (
                            <>
                                <span className="material-symbols-outlined text-5xl text-indigo-200 mb-4">help</span>
                                <p className="text-xl text-center font-medium text-slate-800 leading-relaxed">
                                    {currentCard?.question}
                                </p>
                                <p className="text-sm text-slate-400 mt-6">
                                    Toca para ver la respuesta
                                </p>
                            </>
                        ) : (
                            <>
                                <span className="material-symbols-outlined text-5xl text-emerald-200 mb-4">lightbulb</span>
                                <p className="text-xl text-center font-medium text-slate-800 leading-relaxed">
                                    {currentCard?.answer}
                                </p>
                                {lastInterval && (
                                    <div className="mt-4 text-sm text-slate-500">
                                        Próxima revisión: {formatInterval(lastInterval)}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {/* Rating Buttons or Reveal Button */}
                <div className="mt-6">
                    {isFlipped ? (
                        <SRSRatingButtons
                            onRate={handleRate}
                            currentStability={currentCard?.srs?.stability || 1}
                            showIntervals={true}
                        />
                    ) : (
                        <button
                            onClick={handleFlip}
                            className="w-full py-4 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition flex items-center justify-center gap-2"
                        >
                            <span className="material-symbols-outlined">visibility</span>
                            Mostrar Respuesta
                            <span className="text-sm opacity-70">[Espacio]</span>
                        </button>
                    )}
                </div>

                {/* AI Tutor Button */}
                <div className="mt-4 text-center">
                    <button
                        onClick={() => setShowTutor(true)}
                        className="text-sm text-indigo-600 hover:text-indigo-800 flex items-center justify-center gap-1 mx-auto"
                    >
                        <span className="material-symbols-outlined text-lg">smart_toy</span>
                        ¿Necesitas ayuda?
                    </button>
                </div>

                {/* Response Time Display */}
                {lastResponseTime && (
                    <div className="mt-4 text-center text-sm text-slate-400">
                        Tiempo de respuesta: {(lastResponseTime / 1000).toFixed(1)}s
                        {lastResponseTime < 3000 && <span className="text-emerald-500 ml-2">⚡ Rápido!</span>}
                    </div>
                )}
            </main>

            {/* AI Tutor Modal */}
            {showTutor && currentCard && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
                        <div className="p-4 border-b flex items-center justify-between">
                            <h3 className="font-bold text-lg">Tutor IA</h3>
                            <button onClick={() => setShowTutor(false)}>
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4">
                            <AITutorChat
                                context={`Pregunta: ${currentCard.question}\nRespuesta: ${currentCard.answer}`}
                                onClose={() => setShowTutor(false)}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Confetti Animation Styles */}
            <style>{`
                @keyframes confetti-fall {
                    0% { transform: translateY(-100vh) rotate(0deg); opacity: 1; }
                    100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
                }
                .animate-confetti {
                    animation: confetti-fall 3s ease-out forwards;
                }
                @keyframes rotate-y {
                    from { transform: rotateY(0deg); }
                    to { transform: rotateY(180deg); }
                }
                .rotate-y-180 {
                    transform: rotateY(180deg);
                }
            `}</style>
        </div>
    );
};

export default AdaptiveStudySession;
