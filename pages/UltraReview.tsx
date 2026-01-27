/**
 * UltraReview.tsx
 *
 * Comprehensive last-day-before-exam review page.
 * 6 phases covering everything: summary, formulas, methodologies, flashcards, exercises, tips
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabaseClient';
import {
    DurationMode,
    PhaseNumber,
    UltraReviewSession,
    PhaseConfig,
    AdaptiveSummaryContent,
    AdaptivePhase2Content,
    AdaptiveMethodologyContent,
    FlashcardReviewContent,
    AdaptiveExerciseContent,
    AdaptiveTipsContent,
    CompletionSummary,
    getOrCreateSession,
    startFreshSession,
    updateSessionProgress,
    completeSession,
    generatePhaseContent,
    getCompletionSummary,
    getPhaseConfigForSubject
} from '../services/UltraReviewService';

// Default phase metadata (used before session loads)
const DEFAULT_PHASES: PhaseConfig[] = [
    { phase: 1, name: 'Resumen', icon: 'menu_book', description: '', color: 'bg-blue-500' },
    { phase: 2, name: 'Puntos Clave', icon: 'push_pin', description: '', color: 'bg-purple-500' },
    { phase: 3, name: 'Metodologías', icon: 'route', description: '', color: 'bg-amber-500' },
    { phase: 4, name: 'Flashcards', icon: 'style', description: '', color: 'bg-emerald-500' },
    { phase: 5, name: 'Ejercicios', icon: 'edit_note', description: '', color: 'bg-rose-500' },
    { phase: 6, name: 'Tips', icon: 'lightbulb', description: '', color: 'bg-cyan-500' }
];

const UltraReview: React.FC = () => {
    const { studySetId } = useParams<{ studySetId: string }>();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { user } = useAuth();

    // State
    const [session, setSession] = useState<UltraReviewSession | null>(null);
    const [currentPhase, setCurrentPhase] = useState<PhaseNumber>(1);
    const [phaseContent, setPhaseContent] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [generatingContent, setGeneratingContent] = useState(false);
    const [studySetName, setStudySetName] = useState('');
    const [showConfig, setShowConfig] = useState(true);
    const [selectedDuration, setSelectedDuration] = useState<DurationMode>('normal');
    const [showCompletion, setShowCompletion] = useState(false);
    const [completionSummary, setCompletionSummary] = useState<CompletionSummary | null>(null);

    // Timer
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const [timerActive, setTimerActive] = useState(false);

    // Flashcard state
    const [currentFlashcardIndex, setCurrentFlashcardIndex] = useState(0);
    const [flashcardFlipped, setFlashcardFlipped] = useState(false);

    // Exercise state
    const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
    const [showExerciseSolution, setShowExerciseSolution] = useState(false);

    // Fetch study set name
    useEffect(() => {
        const fetchStudySet = async () => {
            if (!studySetId) return;
            const { data } = await supabase
                .from('study_sets')
                .select('name')
                .eq('id', studySetId)
                .single();
            if (data) setStudySetName(data.name);
        };
        fetchStudySet();
    }, [studySetId]);

    // Check for existing session
    useEffect(() => {
        const checkExistingSession = async () => {
            if (!user || !studySetId) return;

            const mode = searchParams.get('mode') as DurationMode;
            if (mode) {
                // Starting fresh with specified mode
                setSelectedDuration(mode);
                setShowConfig(false);
                const newSession = await startFreshSession(user.id, studySetId, mode);
                setSession(newSession);
                setCurrentPhase(1);
                setTimerActive(true);
                loadPhaseContent(newSession.id, 1, mode);
            } else {
                // Check for existing in-progress session
                const { data: existing } = await supabase
                    .from('ultra_review_sessions')
                    .select('*')
                    .eq('user_id', user.id)
                    .eq('study_set_id', studySetId)
                    .eq('status', 'in_progress')
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .single();

                if (existing) {
                    setSession(existing);
                    setCurrentPhase(existing.current_phase as PhaseNumber);
                    setSelectedDuration(existing.duration_mode as DurationMode);
                    setElapsedSeconds(existing.total_time_seconds || 0);
                    setShowConfig(false);
                    setTimerActive(true);
                    loadPhaseContent(existing.id, existing.current_phase as PhaseNumber, existing.duration_mode as DurationMode);
                }
            }
            setLoading(false);
        };

        checkExistingSession();
    }, [user, studySetId, searchParams]);

    // Timer effect
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (timerActive && !showCompletion) {
            interval = setInterval(() => {
                setElapsedSeconds(prev => prev + 1);
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [timerActive, showCompletion]);

    // Save progress periodically
    useEffect(() => {
        if (session && timerActive) {
            const saveInterval = setInterval(() => {
                updateSessionProgress(
                    session.id,
                    currentPhase,
                    session.phase_progress,
                    elapsedSeconds
                );
            }, 30000); // Save every 30 seconds

            return () => clearInterval(saveInterval);
        }
    }, [session, currentPhase, elapsedSeconds, timerActive]);

    // Load phase content
    const loadPhaseContent = useCallback(async (sessionId: string, phase: PhaseNumber, duration: DurationMode) => {
        setGeneratingContent(true);
        setPhaseContent(null);

        try {
            const content = await generatePhaseContent(sessionId, studySetId!, phase, duration);
            setPhaseContent(content);

            // Reset phase-specific state
            if (phase === 4) {
                setCurrentFlashcardIndex(0);
                setFlashcardFlipped(false);
            }
            if (phase === 5) {
                setCurrentExerciseIndex(0);
                setShowExerciseSolution(false);
            }
        } catch (error) {
            console.error('Error loading phase content:', error);
        } finally {
            setGeneratingContent(false);
        }
    }, [studySetId]);

    // Start session
    const handleStartSession = async () => {
        if (!user || !studySetId) return;

        setShowConfig(false);
        setLoading(true);

        const newSession = await startFreshSession(user.id, studySetId, selectedDuration);
        setSession(newSession);
        setCurrentPhase(1);
        setElapsedSeconds(0);
        setTimerActive(true);

        await loadPhaseContent(newSession.id, 1, selectedDuration);
        setLoading(false);
    };

    // Navigate phases
    const goToPhase = async (phase: PhaseNumber) => {
        if (!session) return;

        setCurrentPhase(phase);
        await loadPhaseContent(session.id, phase, session.duration_mode as DurationMode);

        // Update progress
        const newProgress = {
            ...session.phase_progress,
            [currentPhase.toString()]: { completed: true, time_spent: 0 }
        };
        setSession({ ...session, phase_progress: newProgress, current_phase: phase });
        await updateSessionProgress(session.id, phase, newProgress, elapsedSeconds);
    };

    const nextPhase = () => {
        if (currentPhase < 6) {
            goToPhase((currentPhase + 1) as PhaseNumber);
        } else {
            handleComplete();
        }
    };

    const prevPhase = () => {
        if (currentPhase > 1) {
            goToPhase((currentPhase - 1) as PhaseNumber);
        }
    };

    // Complete session
    const handleComplete = async () => {
        if (!session) return;

        setTimerActive(false);
        await completeSession(session.id, elapsedSeconds);

        const summary = await getCompletionSummary(session.id);
        setCompletionSummary(summary);
        setShowCompletion(true);
    };

    // Format time
    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Render loading
    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
                <div className="text-center text-white">
                    <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-xl">Preparando Ultra Repaso...</p>
                </div>
            </div>
        );
    }

    // Render configuration modal
    if (showConfig) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
                <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-8">
                    <div className="text-center mb-8">
                        <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <span className="material-symbols-outlined text-white text-4xl">bolt</span>
                        </div>
                        <h1 className="text-3xl font-black text-slate-800">Ultra Repaso</h1>
                        <p className="text-slate-500 mt-2">{studySetName}</p>
                        <p className="text-sm text-slate-400 mt-1">Tu arma secreta para el día antes del examen</p>
                    </div>

                    <div className="space-y-4 mb-8">
                        <p className="text-sm font-bold text-slate-600 mb-2">Elige la duración:</p>

                        {[
                            { mode: 'express' as DurationMode, label: 'Express', time: '~15 min', desc: 'Lo esencial', icon: 'speed' },
                            { mode: 'normal' as DurationMode, label: 'Normal', time: '~30 min', desc: 'Balanceado', icon: 'balance' },
                            { mode: 'complete' as DurationMode, label: 'Completo', time: '1h+', desc: 'Todo el material', icon: 'all_inclusive' }
                        ].map(option => (
                            <button
                                key={option.mode}
                                onClick={() => setSelectedDuration(option.mode)}
                                className={`w-full p-4 rounded-xl border-2 transition-all flex items-center gap-4 ${selectedDuration === option.mode
                                        ? 'border-purple-500 bg-purple-50'
                                        : 'border-slate-200 hover:border-purple-300'
                                    }`}
                            >
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${selectedDuration === option.mode ? 'bg-purple-500 text-white' : 'bg-slate-100 text-slate-500'
                                    }`}>
                                    <span className="material-symbols-outlined">{option.icon}</span>
                                </div>
                                <div className="flex-1 text-left">
                                    <div className="font-bold text-slate-800">{option.label}</div>
                                    <div className="text-sm text-slate-500">{option.desc}</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-sm font-bold text-purple-600">{option.time}</div>
                                </div>
                            </button>
                        ))}
                    </div>

                    <button
                        onClick={handleStartSession}
                        className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold text-lg rounded-xl hover:from-purple-700 hover:to-pink-700 transition shadow-lg flex items-center justify-center gap-2"
                    >
                        <span className="material-symbols-outlined">play_arrow</span>
                        Comenzar Ultra Repaso
                    </button>

                    <button
                        onClick={() => navigate(-1)}
                        className="w-full mt-4 py-3 text-slate-500 font-medium hover:text-slate-700 transition"
                    >
                        Volver al Set
                    </button>
                </div>
            </div>
        );
    }

    // Render completion screen
    if (showCompletion && completionSummary) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-emerald-900 via-teal-900 to-cyan-900 flex items-center justify-center p-4">
                <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-8 text-center">
                    <div className="w-24 h-24 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-full flex items-center justify-center mx-auto mb-6">
                        <span className="material-symbols-outlined text-white text-5xl">celebration</span>
                    </div>

                    <h1 className="text-3xl font-black text-slate-800 mb-2">¡Ultra Repaso Completado!</h1>
                    <p className="text-slate-500 mb-8">Estás listo para tu examen</p>

                    <div className="grid grid-cols-2 gap-4 mb-8">
                        <div className="bg-slate-50 rounded-xl p-4">
                            <div className="text-3xl font-black text-purple-600">{completionSummary.totalTime}</div>
                            <div className="text-sm text-slate-500">Tiempo total</div>
                        </div>
                        <div className="bg-slate-50 rounded-xl p-4">
                            <div className="text-3xl font-black text-emerald-600">{completionSummary.phasesCompleted}/6</div>
                            <div className="text-sm text-slate-500">Fases completadas</div>
                        </div>
                        <div className="bg-slate-50 rounded-xl p-4">
                            <div className="text-3xl font-black text-blue-600">{completionSummary.flashcardsReviewed}</div>
                            <div className="text-sm text-slate-500">Flashcards</div>
                        </div>
                        <div className="bg-slate-50 rounded-xl p-4">
                            <div className="text-3xl font-black text-amber-600">{completionSummary.exercisesCompleted}</div>
                            <div className="text-sm text-slate-500">Ejercicios</div>
                        </div>
                    </div>

                    <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-4 mb-8 text-left">
                        <h3 className="font-bold text-purple-800 mb-2 flex items-center gap-2">
                            <span className="material-symbols-outlined">tips_and_updates</span>
                            Recomendaciones
                        </h3>
                        <ul className="space-y-2">
                            {completionSummary.recommendations.map((rec, i) => (
                                <li key={i} className="text-sm text-purple-700 flex items-start gap-2">
                                    <span className="material-symbols-outlined text-purple-400 text-lg">check_circle</span>
                                    {rec}
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="space-y-3">
                        <button
                            onClick={() => {
                                setShowCompletion(false);
                                setShowConfig(true);
                                setSession(null);
                            }}
                            className="w-full py-3 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 transition"
                        >
                            Hacer otro Ultra Repaso
                        </button>
                        <button
                            onClick={() => navigate(`/study-set/${studySetId}`)}
                            className="w-full py-3 text-slate-600 font-medium hover:text-slate-800 transition"
                        >
                            Volver al Set de Estudio
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Main review interface
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
            {/* Header */}
            <div className="bg-black/20 backdrop-blur-sm border-b border-white/10">
                <div className="max-w-6xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => navigate(`/study-set/${studySetId}`)}
                                className="p-2 hover:bg-white/10 rounded-lg transition text-white/70 hover:text-white"
                            >
                                <span className="material-symbols-outlined">arrow_back</span>
                            </button>
                            <div>
                                <h1 className="text-xl font-bold text-white">Ultra Repaso</h1>
                                <p className="text-sm text-white/60">{studySetName}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="bg-white/10 px-4 py-2 rounded-xl flex items-center gap-2">
                                <span className="material-symbols-outlined text-purple-400">timer</span>
                                <span className="text-white font-mono font-bold">{formatTime(elapsedSeconds)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Phase Progress */}
                    <div className="flex items-center gap-2 mt-4 overflow-x-auto pb-2">
                        {PHASES.map((phase, index) => (
                            <React.Fragment key={phase.num}>
                                <button
                                    onClick={() => goToPhase(phase.num)}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-xl transition whitespace-nowrap ${currentPhase === phase.num
                                            ? `${phase.color} text-white shadow-lg`
                                            : currentPhase > phase.num
                                                ? 'bg-white/20 text-white'
                                                : 'bg-white/5 text-white/50'
                                        }`}
                                >
                                    <span className="material-symbols-outlined text-lg">{phase.icon}</span>
                                    <span className="font-medium text-sm">{phase.name}</span>
                                    {session?.phase_progress[phase.num.toString()]?.completed && (
                                        <span className="material-symbols-outlined text-emerald-400 text-sm">check_circle</span>
                                    )}
                                </button>
                                {index < PHASES.length - 1 && (
                                    <div className={`w-8 h-0.5 ${currentPhase > phase.num ? 'bg-white/40' : 'bg-white/10'}`} />
                                )}
                            </React.Fragment>
                        ))}
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-4xl mx-auto px-4 py-8">
                {generatingContent ? (
                    <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-12 text-center">
                        <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="text-white text-lg">Generando contenido...</p>
                        <p className="text-white/60 text-sm mt-2">Esto puede tomar unos segundos</p>
                    </div>
                ) : (
                    <>
                        {/* Phase 1: Summary */}
                        {currentPhase === 1 && phaseContent && (
                            <Phase1Summary content={phaseContent as SummaryContent} />
                        )}

                        {/* Phase 2: Formulas */}
                        {currentPhase === 2 && phaseContent && (
                            <Phase2Formulas content={phaseContent as FormulaContent} />
                        )}

                        {/* Phase 3: Methodologies */}
                        {currentPhase === 3 && phaseContent && (
                            <Phase3Methodologies content={phaseContent as MethodologyContent} />
                        )}

                        {/* Phase 4: Flashcards */}
                        {currentPhase === 4 && phaseContent && (
                            <Phase4Flashcards
                                content={phaseContent as FlashcardReviewContent}
                                currentIndex={currentFlashcardIndex}
                                setCurrentIndex={setCurrentFlashcardIndex}
                                flipped={flashcardFlipped}
                                setFlipped={setFlashcardFlipped}
                            />
                        )}

                        {/* Phase 5: Exercises */}
                        {currentPhase === 5 && phaseContent && (
                            <Phase5Exercises
                                content={phaseContent as ExerciseContent}
                                currentIndex={currentExerciseIndex}
                                setCurrentIndex={setCurrentExerciseIndex}
                                showSolution={showExerciseSolution}
                                setShowSolution={setShowExerciseSolution}
                            />
                        )}

                        {/* Phase 6: Tips */}
                        {currentPhase === 6 && phaseContent && (
                            <Phase6Tips content={phaseContent as TipsContent} />
                        )}
                    </>
                )}

                {/* Navigation */}
                {!generatingContent && (
                    <div className="flex justify-between mt-8">
                        <button
                            onClick={prevPhase}
                            disabled={currentPhase === 1}
                            className={`px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition ${currentPhase === 1
                                    ? 'bg-white/5 text-white/30 cursor-not-allowed'
                                    : 'bg-white/10 text-white hover:bg-white/20'
                                }`}
                        >
                            <span className="material-symbols-outlined">arrow_back</span>
                            Anterior
                        </button>

                        <button
                            onClick={nextPhase}
                            className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-xl hover:from-purple-700 hover:to-pink-700 transition flex items-center gap-2 shadow-lg"
                        >
                            {currentPhase === 6 ? 'Finalizar' : 'Siguiente'}
                            <span className="material-symbols-outlined">
                                {currentPhase === 6 ? 'check' : 'arrow_forward'}
                            </span>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

// ============================================
// PHASE COMPONENTS
// ============================================

const Phase1Summary: React.FC<{ content: SummaryContent }> = ({ content }) => {
    const getImportanceStyle = (importance: string) => {
        switch (importance) {
            case 'critical': return 'border-l-red-500 bg-red-50/10';
            case 'important': return 'border-l-amber-500 bg-amber-50/10';
            default: return 'border-l-blue-500 bg-blue-50/10';
        }
    };

    const getImportanceLabel = (importance: string) => {
        switch (importance) {
            case 'critical': return { text: 'CRÍTICO', color: 'text-red-400' };
            case 'important': return { text: 'IMPORTANTE', color: 'text-amber-400' };
            default: return { text: 'ÚTIL', color: 'text-blue-400' };
        }
    };

    return (
        <div className="space-y-6">
            <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-white mb-2">Resumen de Conceptos Clave</h2>
                <p className="text-white/60">{content.totalConcepts} conceptos identificados</p>
            </div>

            {content.sections.map((section, i) => {
                const label = getImportanceLabel(section.importance);
                return (
                    <div
                        key={i}
                        className={`bg-white/10 backdrop-blur-sm rounded-xl p-6 border-l-4 ${getImportanceStyle(section.importance)}`}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-white">{section.topic}</h3>
                            <span className={`text-xs font-bold ${label.color}`}>{label.text}</span>
                        </div>
                        <ul className="space-y-2">
                            {section.keyPoints.map((point, j) => (
                                <li key={j} className="flex items-start gap-3 text-white/80">
                                    <span className="material-symbols-outlined text-purple-400 text-sm mt-1">arrow_right</span>
                                    <span>{point}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                );
            })}
        </div>
    );
};

const Phase2Formulas: React.FC<{ content: FormulaContent }> = ({ content }) => (
    <div className="space-y-6">
        <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-white mb-2">Cheat Sheet de Fórmulas</h2>
            <p className="text-white/60">Todas las fórmulas que necesitas</p>
        </div>

        {content.categories.map((category, i) => (
            <div key={i} className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
                <h3 className="text-lg font-bold text-purple-400 mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined">category</span>
                    {category.name}
                </h3>
                <div className="grid gap-4">
                    {category.formulas.map((formula, j) => (
                        <div key={j} className="bg-white/5 rounded-lg p-4">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                    <div className="text-sm text-white/60 mb-1">{formula.name}</div>
                                    <div className="text-xl font-mono font-bold text-white bg-black/20 px-3 py-2 rounded-lg inline-block">
                                        {formula.formula}
                                    </div>
                                    <div className="text-sm text-white/70 mt-2">{formula.description}</div>
                                    {formula.whenToUse && (
                                        <div className="text-xs text-purple-400 mt-1">
                                            <span className="font-bold">Usar cuando:</span> {formula.whenToUse}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        ))}
    </div>
);

const Phase3Methodologies: React.FC<{ content: MethodologyContent }> = ({ content }) => {
    const [expandedIndex, setExpandedIndex] = useState<number | null>(0);

    return (
        <div className="space-y-6">
            <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-white mb-2">Metodologías de Resolución</h2>
                <p className="text-white/60">Paso a paso para cada tipo de problema</p>
            </div>

            {content.methodologies.map((method, i) => (
                <div key={i} className="bg-white/10 backdrop-blur-sm rounded-xl overflow-hidden">
                    <button
                        onClick={() => setExpandedIndex(expandedIndex === i ? null : i)}
                        className="w-full p-4 flex items-center justify-between text-left hover:bg-white/5 transition"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center">
                                <span className="material-symbols-outlined text-amber-400">route</span>
                            </div>
                            <span className="font-bold text-white">{method.problemType}</span>
                        </div>
                        <span className="material-symbols-outlined text-white/60">
                            {expandedIndex === i ? 'expand_less' : 'expand_more'}
                        </span>
                    </button>

                    {expandedIndex === i && (
                        <div className="px-4 pb-4 space-y-4">
                            <div className="bg-white/5 rounded-lg p-4">
                                <h4 className="text-sm font-bold text-amber-400 mb-3">PASOS:</h4>
                                <ol className="space-y-2">
                                    {method.steps.map((step, j) => (
                                        <li key={j} className="flex items-start gap-3 text-white/80">
                                            <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 text-sm font-bold flex items-center justify-center flex-shrink-0">
                                                {j + 1}
                                            </span>
                                            <span>{step}</span>
                                        </li>
                                    ))}
                                </ol>
                            </div>

                            {method.tips.length > 0 && (
                                <div className="bg-purple-500/10 rounded-lg p-4">
                                    <h4 className="text-sm font-bold text-purple-400 mb-2">TIPS:</h4>
                                    <ul className="space-y-1">
                                        {method.tips.map((tip, j) => (
                                            <li key={j} className="text-sm text-white/70 flex items-start gap-2">
                                                <span className="material-symbols-outlined text-purple-400 text-sm">lightbulb</span>
                                                {tip}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {method.example && (
                                <div className="bg-blue-500/10 rounded-lg p-4">
                                    <h4 className="text-sm font-bold text-blue-400 mb-2">EJEMPLO:</h4>
                                    <p className="text-sm text-white/70">{method.example}</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};

const Phase4Flashcards: React.FC<{
    content: FlashcardReviewContent;
    currentIndex: number;
    setCurrentIndex: (i: number) => void;
    flipped: boolean;
    setFlipped: (f: boolean) => void;
}> = ({ content, currentIndex, setCurrentIndex, flipped, setFlipped }) => {
    const card = content.flashcards[currentIndex];

    if (!card) {
        return (
            <div className="text-center text-white/60 py-12">
                No hay flashcards en este set
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="text-center mb-4">
                <h2 className="text-2xl font-bold text-white mb-2">Repaso de Flashcards</h2>
                <p className="text-white/60">{currentIndex + 1} de {content.totalCount}</p>
            </div>

            {/* Progress bar */}
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all"
                    style={{ width: `${((currentIndex + 1) / content.totalCount) * 100}%` }}
                />
            </div>

            {/* Card */}
            <div
                onClick={() => setFlipped(!flipped)}
                className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 min-h-[300px] flex flex-col items-center justify-center cursor-pointer hover:bg-white/15 transition"
            >
                {card.category && (
                    <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 text-xs font-bold rounded-full mb-4">
                        {card.category}
                    </span>
                )}

                <div className="text-center">
                    {!flipped ? (
                        <>
                            <p className="text-xl text-white font-medium">{card.question}</p>
                            <p className="text-sm text-white/40 mt-4">Toca para ver respuesta</p>
                        </>
                    ) : (
                        <>
                            <p className="text-sm text-white/40 mb-2">Respuesta:</p>
                            <p className="text-xl text-emerald-400 font-medium">{card.answer}</p>
                        </>
                    )}
                </div>
            </div>

            {/* Navigation */}
            <div className="flex justify-center gap-4">
                <button
                    onClick={() => { setCurrentIndex(Math.max(0, currentIndex - 1)); setFlipped(false); }}
                    disabled={currentIndex === 0}
                    className="px-6 py-3 bg-white/10 text-white rounded-xl disabled:opacity-30 hover:bg-white/20 transition"
                >
                    <span className="material-symbols-outlined">arrow_back</span>
                </button>
                <button
                    onClick={() => { setCurrentIndex(Math.min(content.totalCount - 1, currentIndex + 1)); setFlipped(false); }}
                    disabled={currentIndex === content.totalCount - 1}
                    className="px-6 py-3 bg-white/10 text-white rounded-xl disabled:opacity-30 hover:bg-white/20 transition"
                >
                    <span className="material-symbols-outlined">arrow_forward</span>
                </button>
            </div>
        </div>
    );
};

const Phase5Exercises: React.FC<{
    content: ExerciseContent;
    currentIndex: number;
    setCurrentIndex: (i: number) => void;
    showSolution: boolean;
    setShowSolution: (s: boolean) => void;
}> = ({ content, currentIndex, setCurrentIndex, showSolution, setShowSolution }) => {
    const exercise = content.exercises[currentIndex];

    if (!exercise) {
        return (
            <div className="text-center text-white/60 py-12">
                No hay ejercicios en este set
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="text-center mb-4">
                <h2 className="text-2xl font-bold text-white mb-2">Ejercicios de Práctica</h2>
                <p className="text-white/60">{currentIndex + 1} de {content.exercises.length}</p>
            </div>

            {/* Exercise */}
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-4">
                    <span className="px-3 py-1 bg-rose-500/20 text-rose-400 text-xs font-bold rounded-full">
                        Dificultad {exercise.difficulty}/5
                    </span>
                    <span className="px-3 py-1 bg-white/10 text-white/60 text-xs rounded-full">
                        {exercise.topic}
                    </span>
                </div>

                <div className="bg-white/5 rounded-xl p-4 mb-4">
                    <h4 className="text-sm font-bold text-white/60 mb-2">PROBLEMA:</h4>
                    <p className="text-white whitespace-pre-wrap">{exercise.problem}</p>
                </div>

                {!showSolution ? (
                    <button
                        onClick={() => setShowSolution(true)}
                        className="w-full py-3 bg-rose-500 text-white font-bold rounded-xl hover:bg-rose-600 transition"
                    >
                        Ver Solución
                    </button>
                ) : (
                    <div className="space-y-4">
                        <div className="bg-emerald-500/10 rounded-xl p-4">
                            <h4 className="text-sm font-bold text-emerald-400 mb-2">SOLUCIÓN:</h4>
                            <p className="text-white whitespace-pre-wrap">{exercise.solution}</p>
                        </div>

                        {exercise.steps && exercise.steps.length > 0 && (
                            <div className="bg-blue-500/10 rounded-xl p-4">
                                <h4 className="text-sm font-bold text-blue-400 mb-2">PASO A PASO:</h4>
                                <ol className="space-y-2">
                                    {exercise.steps.map((step, i) => (
                                        <li key={i} className="flex items-start gap-3 text-white/80 text-sm">
                                            <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold flex items-center justify-center flex-shrink-0">
                                                {i + 1}
                                            </span>
                                            <span>{step}</span>
                                        </li>
                                    ))}
                                </ol>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Navigation */}
            <div className="flex justify-center gap-4">
                <button
                    onClick={() => { setCurrentIndex(Math.max(0, currentIndex - 1)); setShowSolution(false); }}
                    disabled={currentIndex === 0}
                    className="px-6 py-3 bg-white/10 text-white rounded-xl disabled:opacity-30 hover:bg-white/20 transition"
                >
                    <span className="material-symbols-outlined">arrow_back</span>
                </button>
                <button
                    onClick={() => { setCurrentIndex(Math.min(content.exercises.length - 1, currentIndex + 1)); setShowSolution(false); }}
                    disabled={currentIndex === content.exercises.length - 1}
                    className="px-6 py-3 bg-white/10 text-white rounded-xl disabled:opacity-30 hover:bg-white/20 transition"
                >
                    <span className="material-symbols-outlined">arrow_forward</span>
                </button>
            </div>
        </div>
    );
};

const Phase6Tips: React.FC<{ content: TipsContent }> = ({ content }) => (
    <div className="space-y-6">
        <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-white mb-2">Tips y Errores Comunes</h2>
            <p className="text-white/60">Lo que debes recordar para el examen</p>
        </div>

        {/* Common Mistakes */}
        {content.commonMistakes.length > 0 && (
            <div className="bg-red-500/10 backdrop-blur-sm rounded-xl p-6">
                <h3 className="text-lg font-bold text-red-400 mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined">error</span>
                    Errores Comunes a Evitar
                </h3>
                <div className="space-y-4">
                    {content.commonMistakes.map((mistake, i) => (
                        <div key={i} className="bg-white/5 rounded-lg p-4">
                            <div className="flex items-start gap-3">
                                <span className="material-symbols-outlined text-red-400 mt-1">close</span>
                                <div>
                                    <p className="text-white font-medium">{mistake.mistake}</p>
                                    <p className="text-emerald-400 text-sm mt-1">
                                        <span className="font-bold">Correcto:</span> {mistake.correction}
                                    </p>
                                    <p className="text-white/60 text-sm mt-1">
                                        <span className="font-bold">Evítalo:</span> {mistake.howToAvoid}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {/* Exam Tips */}
        {content.examTips.length > 0 && (
            <div className="bg-amber-500/10 backdrop-blur-sm rounded-xl p-6">
                <h3 className="text-lg font-bold text-amber-400 mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined">lightbulb</span>
                    Tips para el Examen
                </h3>
                <ul className="space-y-2">
                    {content.examTips.map((tip, i) => (
                        <li key={i} className="flex items-start gap-3 text-white/80">
                            <span className="material-symbols-outlined text-amber-400 text-sm mt-1">arrow_right</span>
                            <span>{tip}</span>
                        </li>
                    ))}
                </ul>
            </div>
        )}

        {/* Last Minute Reminders */}
        {content.lastMinuteReminders.length > 0 && (
            <div className="bg-cyan-500/10 backdrop-blur-sm rounded-xl p-6">
                <h3 className="text-lg font-bold text-cyan-400 mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined">notifications_active</span>
                    Recordatorios de Última Hora
                </h3>
                <ul className="space-y-2">
                    {content.lastMinuteReminders.map((reminder, i) => (
                        <li key={i} className="flex items-start gap-3 text-white/80">
                            <span className="material-symbols-outlined text-cyan-400 text-sm mt-1">check</span>
                            <span>{reminder}</span>
                        </li>
                    ))}
                </ul>
            </div>
        )}
    </div>
);

export default UltraReview;
