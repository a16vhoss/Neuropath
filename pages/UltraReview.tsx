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
    UltraReviewConfig,
    SubjectAnalysis,
    getOrCreateSession,
    createSessionWithConfig,
    analyzeSubjectType,
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

// Error Boundary
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: Error | null }> {
    constructor(props: { children: React.ReactNode }) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error) {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error("UltraReview Error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-slate-900 flex items-center justify-center p-8">
                    <div className="bg-red-500/10 border border-red-500 rounded-xl p-6 max-w-2xl w-full">
                        <h2 className="text-2xl font-bold text-red-500 mb-4">Algo salió mal</h2>
                        <p className="text-white/80 mb-4">Se produjo un error al cargar el Ultra Repaso.</p>
                        <pre className="bg-black/30 p-4 rounded text-red-300 text-xs overflow-auto font-mono mb-4">
                            {this.state.error?.message}
                            {'\n'}
                            {this.state.error?.stack}
                        </pre>
                        <button
                            onClick={() => window.location.reload()}
                            className="bg-red-500 text-white px-6 py-2 rounded-lg hover:bg-red-600 transition"
                        >
                            Recargar Página
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

const UltraReviewContent: React.FC = () => {
    console.log('UltraReview: Component Mounting');
    const { studySetId } = useParams<{ studySetId: string }>();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { user } = useAuth();

    // Derived state for multi-set IDs
    const setsParam = searchParams.get('sets');
    const targetSetIds = setsParam ? setsParam.split(',') : (studySetId ? [studySetId] : []);
    const isMultiSet = targetSetIds.length > 1;

    // State
    const [session, setSession] = useState<UltraReviewSession | null>(null);
    const [currentPhase, setCurrentPhase] = useState<PhaseNumber>(1);
    const [phaseContent, setPhaseContent] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [generatingContent, setGeneratingContent] = useState(false);
    const [studySetName, setStudySetName] = useState('');
    const [showConfig, setShowConfig] = useState(true);
    const [showCompletion, setShowCompletion] = useState(false);
    const [completionSummary, setCompletionSummary] = useState<CompletionSummary | null>(null);

    // New Loading State
    const [loadingStep, setLoadingStep] = useState<'idle' | 'analyzing' | 'creating' | 'generating'>('idle');
    const [loadingMessage, setLoadingMessage] = useState('');

    // Configuration State
    const [config, setConfig] = useState<UltraReviewConfig>({
        durationMode: 'normal',
        selectedPhases: [1, 2, 3, 4, 5, 6],
        focusMode: 'all'
    });

    // Adaptive phases from session
    const [phases, setPhases] = useState<PhaseConfig[]>(DEFAULT_PHASES);

    // Timer
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const [timerActive, setTimerActive] = useState(false);

    // Flashcard state
    const [currentFlashcardIndex, setCurrentFlashcardIndex] = useState(0);
    const [flashcardFlipped, setFlashcardFlipped] = useState(false);

    // Exercise state
    const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
    const [showExerciseSolution, setShowExerciseSolution] = useState(false);

    // Fetch study set name(s)
    useEffect(() => {
        const fetchStudySetInfo = async () => {
            if (targetSetIds.length === 0) return;

            if (targetSetIds.length === 1) {
                const { data } = await supabase
                    .from('study_sets')
                    .select('name')
                    .eq('id', targetSetIds[0])
                    .single();
                if (data) setStudySetName(data.name);
            } else {
                setStudySetName(`${targetSetIds.length} sets seleccionados`);
            }
        };
        fetchStudySetInfo();
    }, [JSON.stringify(targetSetIds)]);

    // Check for existing session
    useEffect(() => {
        const checkExistingSession = async () => {
            if (!user || targetSetIds.length === 0) return;

            // Check for existing in-progress session
            const existing = await getOrCreateSession(user.id, targetSetIds);

            if (existing && existing.status === 'in_progress') {
                setSession(existing);
                setCurrentPhase(existing.current_phase as PhaseNumber);
                // Respect saved duration mode
                setConfig(prev => ({ ...prev, durationMode: existing.duration_mode as DurationMode }));

                setElapsedSeconds(existing.total_time_seconds || 0);
                setShowConfig(false);
                setTimerActive(true);
                // Set adaptive phases from existing session
                if (existing.generated_content?.phaseConfig) {
                    setPhases(existing.generated_content.phaseConfig);
                }
                loadPhaseContent(existing.id, existing.current_phase as PhaseNumber, existing.duration_mode as DurationMode);
            }
            setLoading(false);
        };

        checkExistingSession();
    }, [user, JSON.stringify(targetSetIds)]);

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
            const content = await generatePhaseContent(sessionId, targetSetIds, phase, duration);
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
            alert("Hubo un error generando el contenido. Intenta recargar.");
        } finally {
            setGeneratingContent(false);
        }
    }, [JSON.stringify(targetSetIds)]);

    // Start session
    const handleStartSession = async () => {
        if (!user || targetSetIds.length === 0) return;

        setShowConfig(false);
        setLoading(true); // Keep main loading true to show the progress screen

        try {
            // Updated Flow with Progress Tracking
            setLoadingStep('analyzing');
            setLoadingMessage('Analizando tus apuntes para entender el tipo de materia...');

            const subjectAnalysis = await analyzeSubjectType(targetSetIds);

            setLoadingStep('creating');
            setLoadingMessage(`Detectado: ${subjectAnalysis.type}. Configurando sesión personalizada...`);

            const newSession = await createSessionWithConfig(user.id, targetSetIds, config, subjectAnalysis);
            setSession(newSession);

            // Generate first phase
            setLoadingStep('generating');
            setLoadingMessage('Generando el resumen inicial y plan de estudio...');

            setCurrentPhase(1);
            setElapsedSeconds(0);
            setTimerActive(true);

            // Set adaptive phases from session
            if (newSession.generated_content?.phaseConfig) {
                setPhases(newSession.generated_content.phaseConfig);
            }

            await loadPhaseContent(newSession.id, 1, config.durationMode);

        } catch (error) {
            console.error("Critical error starting session:", error);
            setShowConfig(true); // Go back to config
            alert("No pudimos iniciar la sesión. Por favor verifica tu conexión e intenta de nuevo.");
        } finally {
            setLoading(false);
            setLoadingStep('idle');
        }
    };

    const handleBack = () => {
        if (isMultiSet) {
            navigate('/student');
        } else if (studySetId && studySetId !== 'undefined') {
            navigate(`/student/set/${studySetId}`);
        } else {
            navigate('/student');
        }
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

    // Render loading with detailed progress
    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
                <div className="text-center text-white max-w-md px-8 w-full">
                    <div className="relative w-24 h-24 mx-auto mb-8">
                        <div className="absolute inset-0 border-4 border-white/10 rounded-full"></div>
                        <div className="absolute inset-0 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                        <div className="absolute inset-0 flex items-center justify-center text-purple-300">
                            <span className="material-symbols-outlined text-3xl animate-pulse">
                                {loadingStep === 'analyzing' ? 'search' :
                                    loadingStep === 'creating' ? 'architecture' :
                                        loadingStep === 'generating' ? 'smart_toy' : 'hourglass_top'}
                            </span>
                        </div>
                    </div>

                    <h2 className="text-2xl font-black mb-3">
                        {loadingStep === 'analyzing' ? 'Analizando tu Contenido' :
                            loadingStep === 'creating' ? 'Diseñando Estructura' :
                                loadingStep === 'generating' ? 'Creando Materiales' : 'Cargando...'}
                    </h2>

                    <p className="text-white/60 mb-8 min-h-[3rem] text-lg font-medium">
                        {loadingMessage || 'Por favor espera un momento...'}
                    </p>

                    {/* Progress Steps */}
                    <div className="grid grid-cols-3 gap-2">
                        {['analyzing', 'creating', 'generating'].map((step, i) => {
                            const steps = ['analyzing', 'creating', 'generating'];
                            const currentIndex = steps.indexOf(loadingStep);
                            const stepIndex = i;
                            const isActive = stepIndex === currentIndex;
                            const isCompleted = stepIndex < currentIndex;

                            return (
                                <div key={step} className="flex flex-col items-center gap-2">
                                    <div className={`h-1.5 w-full rounded-full transition-all duration-700 ${isCompleted ? 'bg-emerald-500' :
                                        isActive ? 'bg-purple-500 animate-pulse' : 'bg-white/10'
                                        }`}></div>
                                    <span className={`text-xs font-bold uppercase tracking-wider transition-colors ${isActive || isCompleted ? 'text-white/80' : 'text-white/20'
                                        }`}>
                                        {step === 'analyzing' ? 'Análisis' : step === 'creating' ? 'Diseño' : 'IA'}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    }

    // Render configuration modal
    if (showConfig) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
                <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-8 max-h-[90vh] overflow-y-auto">
                    <div className="text-center mb-6">
                        <div className="w-16 h-16 bg-gradient-to-br from-purple-600 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-purple-500/30">
                            <span className="material-symbols-outlined text-white text-3xl">bolt</span>
                        </div>
                        <h1 className="text-2xl font-black text-slate-800">Ultra Repaso</h1>
                        <p className="text-slate-500 mt-1 font-medium">{studySetName}</p>
                    </div>

                    <div className="space-y-6">
                        {/* Duration Selection */}
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Duración de la Sesión</p>
                            <div className="grid grid-cols-1 gap-3">
                                {[
                                    { mode: 'express', label: 'Express', time: '~15 min', desc: 'Resumen y conceptos vitales', icon: 'speed' },
                                    { mode: 'normal', label: 'Estándar', time: '~30 min', desc: 'Balance perfecto de teoría y práctica', icon: 'balance' },
                                    { mode: 'complete', label: 'Profundo', time: '1h+', desc: 'Cobertura exhaustiva de todo', icon: 'all_inclusive' }
                                ].map(option => (
                                    <button
                                        key={option.mode}
                                        onClick={() => setConfig(prev => ({ ...prev, durationMode: option.mode as DurationMode }))}
                                        className={`w-full p-3 rounded-xl border-2 transition-all flex items-center gap-3 relative overflow-hidden group ${config.durationMode === option.mode
                                            ? 'border-purple-600 bg-purple-50 ring-2 ring-purple-600/20'
                                            : 'border-slate-100 hover:border-purple-200 hover:bg-slate-50'
                                            }`}
                                    >
                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${config.durationMode === option.mode ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-400 group-hover:bg-purple-100 group-hover:text-purple-600'
                                            }`}>
                                            <span className="material-symbols-outlined text-xl">{option.icon}</span>
                                        </div>
                                        <div className="flex-1 text-left">
                                            <div className="flex items-center justify-between">
                                                <span className={`font-bold ${config.durationMode === option.mode ? 'text-purple-900' : 'text-slate-700'}`}>
                                                    {option.label}
                                                </span>
                                                <span className={`text-xs font-bold ${config.durationMode === option.mode ? 'text-purple-600' : 'text-slate-400'}`}>
                                                    {option.time}
                                                </span>
                                            </div>
                                            <div className="text-xs text-slate-500 mt-0.5">{option.desc}</div>
                                        </div>
                                        {config.durationMode === option.mode && (
                                            <div className="absolute right-0 top-0 bottom-0 w-1 bg-purple-600"></div>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Focus Mode Selection (Optional Feature) */}
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Enfoque Principal</p>
                            <div className="flex bg-slate-100 p-1 rounded-xl">
                                {[
                                    { id: 'all', label: 'General' },
                                    { id: 'exam_prep', label: 'Simulacro Examen' }
                                ].map(mode => (
                                    <button
                                        key={mode.id}
                                        onClick={() => setConfig(prev => ({ ...prev, focusMode: mode.id as any }))}
                                        className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${config.focusMode === mode.id
                                            ? 'bg-white text-slate-800 shadow-sm'
                                            : 'text-slate-400 hover:text-slate-600'
                                            }`}
                                    >
                                        {mode.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 space-y-3">
                        <button
                            onClick={handleStartSession}
                            disabled={loading}
                            className={`w-full py-4 text-white font-bold text-lg rounded-2xl transition shadow-xl shadow-purple-500/20 flex items-center justify-center gap-3 ${loading ? 'bg-slate-400 cursor-not-allowed' : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:scale-[1.02] active:scale-[0.98]'
                                }`}
                        >
                            <span className="material-symbols-outlined">rocket_launch</span>
                            {loading ? 'Preparando...' : 'Comenzar Ultra Repaso'}
                        </button>

                        <button
                            onClick={handleBack}
                            className="w-full py-3 text-slate-400 font-medium hover:text-slate-600 transition text-sm"
                        >
                            {isMultiSet ? 'Cancelar y volver al Dashboard' : 'Volver al material de estudio'}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Helper to get subject type label
    const getSubjectTypeLabel = (type: string) => {
        const labels: Record<string, { label: string; icon: string; color: string }> = {
            mathematical: { label: 'Matemáticas/Ciencias', icon: 'function', color: 'text-purple-600' },
            historical: { label: 'Historia/Humanidades', icon: 'history_edu', color: 'text-amber-600' },
            programming: { label: 'Programación', icon: 'code', color: 'text-cyan-600' },
            scientific: { label: 'Ciencias Naturales', icon: 'biotech', color: 'text-green-600' },
            linguistic: { label: 'Idiomas/Literatura', icon: 'translate', color: 'text-blue-600' },
            business: { label: 'Negocios/Economía', icon: 'trending_up', color: 'text-orange-600' },
            general: { label: 'General', icon: 'school', color: 'text-slate-600' }
        };
        return labels[type] || labels.general;
    };

    // Render completion screen
    if (showCompletion && completionSummary) {
        const subjectLabel = getSubjectTypeLabel(completionSummary.subjectType);

        return (
            <div className="min-h-screen bg-gradient-to-br from-emerald-900 via-teal-900 to-cyan-900 flex items-center justify-center p-4">
                <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-8 text-center">
                    <div className="w-24 h-24 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-full flex items-center justify-center mx-auto mb-6">
                        <span className="material-symbols-outlined text-white text-5xl">celebration</span>
                    </div>

                    <h1 className="text-3xl font-black text-slate-800 mb-2">¡Ultra Repaso Completado!</h1>
                    <p className="text-slate-500 mb-2">Estás listo para tu examen</p>

                    {/* Subject Type Badge */}
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-full mb-8">
                        <span className={`material-symbols-outlined ${subjectLabel.color}`}>{subjectLabel.icon}</span>
                        <span className="text-sm font-medium text-slate-600">{subjectLabel.label}</span>
                    </div>

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
                            onClick={handleBack}
                            className="w-full py-3 text-slate-600 font-medium hover:text-slate-800 transition"
                        >
                            {isMultiSet ? 'Volver al Dashboard' : 'Volver al Set'}
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
                                onClick={handleBack}
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
                            {/* Subject Type Badge */}
                            {session?.generated_content?.subjectType && (
                                <div className="hidden sm:flex bg-white/10 px-3 py-2 rounded-xl items-center gap-2">
                                    <span className={`material-symbols-outlined text-sm ${session.generated_content.subjectType === 'mathematical' ? 'text-purple-400' :
                                        session.generated_content.subjectType === 'historical' ? 'text-amber-400' :
                                            session.generated_content.subjectType === 'programming' ? 'text-cyan-400' :
                                                session.generated_content.subjectType === 'scientific' ? 'text-green-400' :
                                                    session.generated_content.subjectType === 'linguistic' ? 'text-blue-400' :
                                                        session.generated_content.subjectType === 'business' ? 'text-orange-400' :
                                                            'text-white/60'
                                        }`}>
                                        {session.generated_content.subjectType === 'mathematical' ? 'function' :
                                            session.generated_content.subjectType === 'historical' ? 'history_edu' :
                                                session.generated_content.subjectType === 'programming' ? 'code' :
                                                    session.generated_content.subjectType === 'scientific' ? 'biotech' :
                                                        session.generated_content.subjectType === 'linguistic' ? 'translate' :
                                                            session.generated_content.subjectType === 'business' ? 'trending_up' :
                                                                'school'}
                                    </span>
                                    <span className="text-white/70 text-sm">Adaptado</span>
                                </div>
                            )}
                            <div className="bg-white/10 px-4 py-2 rounded-xl flex items-center gap-2">
                                <span className="material-symbols-outlined text-purple-400">timer</span>
                                <span className="text-white font-mono font-bold">{formatTime(elapsedSeconds)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Phase Progress */}
                    <div className="flex items-center gap-2 mt-4 overflow-x-auto pb-2">
                        {phases.map((phase, index) => (
                            <React.Fragment key={phase.phase}>
                                <button
                                    onClick={() => goToPhase(phase.phase)}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-xl transition whitespace-nowrap ${currentPhase === phase.phase
                                        ? `${phase.color} text-white shadow-lg`
                                        : currentPhase > phase.phase
                                            ? 'bg-white/20 text-white'
                                            : 'bg-white/5 text-white/50'
                                        }`}
                                >
                                    <span className="material-symbols-outlined text-lg">{phase.icon}</span>
                                    <span className="font-medium text-sm">{phase.name}</span>
                                    {session?.phase_progress[phase.phase.toString()]?.completed && (
                                        <span className="material-symbols-outlined text-emerald-400 text-sm">check_circle</span>
                                    )}
                                </button>
                                {index < phases.length - 1 && (
                                    <div className={`w-8 h-0.5 ${currentPhase > phase.phase ? 'bg-white/40' : 'bg-white/10'}`} />
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
                            <Phase1Summary content={phaseContent as AdaptiveSummaryContent} />
                        )}

                        {/* Phase 2: Adaptive Key Elements (Formulas/Timeline/Code/etc) */}
                        {currentPhase === 2 && phaseContent && (
                            <Phase2Adaptive content={phaseContent as AdaptivePhase2Content} phaseConfig={phases[1]} />
                        )}

                        {/* Phase 3: Methodologies */}
                        {currentPhase === 3 && phaseContent && (
                            <Phase3Methodologies content={phaseContent as AdaptiveMethodologyContent} />
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
                                content={phaseContent as AdaptiveExerciseContent}
                                currentIndex={currentExerciseIndex}
                                setCurrentIndex={setCurrentExerciseIndex}
                                showSolution={showExerciseSolution}
                                setShowSolution={setShowExerciseSolution}
                            />
                        )}

                        {/* Phase 6: Tips */}
                        {currentPhase === 6 && phaseContent && (
                            <Phase6Tips content={phaseContent as AdaptiveTipsContent} />
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

const Phase1Summary: React.FC<{ content: AdaptiveSummaryContent }> = ({ content }) => {
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
                <h2 className="text-2xl font-bold text-white mb-2">{content.title || 'Resumen de Conceptos Clave'}</h2>
                <p className="text-white/60">{content.totalConcepts} conceptos identificados</p>
            </div>

            {/* Exam Predictions */}
            {content.examPredictions && content.examPredictions.length > 0 && (
                <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 backdrop-blur-sm rounded-xl p-6 border border-purple-500/30">
                    <h3 className="text-lg font-bold text-purple-300 mb-4 flex items-center gap-2">
                        <span className="material-symbols-outlined">psychology</span>
                        Predicciones para el Examen
                    </h3>
                    <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {content.examPredictions.map((prediction, i) => (
                            <li key={i} className="flex items-start gap-2 text-white/80 text-sm">
                                <span className="material-symbols-outlined text-pink-400 text-sm mt-0.5">star</span>
                                <span>{prediction}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

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

                        {/* Must Know section */}
                        {section.mustKnow && section.mustKnow.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-white/10">
                                <h4 className="text-sm font-bold text-emerald-400 mb-2 flex items-center gap-1">
                                    <span className="material-symbols-outlined text-sm">verified</span>
                                    DEBES SABER:
                                </h4>
                                <ul className="space-y-1">
                                    {section.mustKnow.map((item, k) => (
                                        <li key={k} className="flex items-start gap-2 text-emerald-300 text-sm">
                                            <span className="material-symbols-outlined text-emerald-400 text-xs mt-0.5">check</span>
                                            <span>{item}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

const Phase2Adaptive: React.FC<{ content: AdaptivePhase2Content; phaseConfig: PhaseConfig }> = ({ content, phaseConfig }) => {
    // Get icon color based on content type
    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'formulas': return { icon: 'function', color: 'text-purple-400' };
            case 'timeline': return { icon: 'timeline', color: 'text-amber-400' };
            case 'codePatterns': return { icon: 'code', color: 'text-cyan-400' };
            case 'processes': return { icon: 'autorenew', color: 'text-green-400' };
            case 'vocabulary': return { icon: 'translate', color: 'text-blue-400' };
            case 'principles': return { icon: 'analytics', color: 'text-orange-400' };
            default: return { icon: 'push_pin', color: 'text-purple-400' };
        }
    };

    const typeStyle = getTypeIcon(content.type);

    return (
        <div className="space-y-6">
            <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-white mb-2">{content.title}</h2>
                <p className="text-white/60">{phaseConfig?.description || 'Información clave para el examen'}</p>
            </div>

            {content.categories.map((category, i) => (
                <div key={i} className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
                    <h3 className={`text-lg font-bold ${typeStyle.color} mb-4 flex items-center gap-2`}>
                        <span className="material-symbols-outlined">{typeStyle.icon}</span>
                        {category.name}
                    </h3>
                    <div className="grid gap-4">
                        {(category.items || []).map((item, j) => (
                            <div key={j} className="bg-white/5 rounded-lg p-4">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1">
                                        <div className="text-sm text-white/60 mb-1">{item.name}</div>
                                        <div className={`text-xl font-mono font-bold text-white bg-black/20 px-3 py-2 rounded-lg inline-block ${content.type === 'codePatterns' ? 'text-sm whitespace-pre-wrap' : ''}`}>
                                            {item.content}
                                        </div>
                                        <div className="text-sm text-white/70 mt-2">{item.explanation}</div>

                                        {item.example && (
                                            <div className="text-xs text-blue-400 mt-2">
                                                <span className="font-bold">Ejemplo:</span> {item.example}
                                            </div>
                                        )}
                                        {item.whenToUse && (
                                            <div className="text-xs text-emerald-400 mt-1">
                                                <span className="font-bold">Usar cuando:</span> {item.whenToUse}
                                            </div>
                                        )}
                                        {item.commonMistake && (
                                            <div className="text-xs text-red-400 mt-1">
                                                <span className="font-bold">Error común:</span> {item.commonMistake}
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
};

const Phase3Methodologies: React.FC<{ content: AdaptiveMethodologyContent }> = ({ content }) => {
    const [expandedIndex, setExpandedIndex] = useState<number | null>(0);

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'problemSolving': return 'calculate';
            case 'analysis': return 'analytics';
            case 'writing': return 'edit_document';
            case 'coding': return 'code';
            case 'memorization': return 'psychology';
            default: return 'route';
        }
    };

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
                                <span className="material-symbols-outlined text-amber-400">{getTypeIcon(content.type)}</span>
                            </div>
                            <div>
                                <span className="font-bold text-white">{method.situationType}</span>
                                {method.description && (
                                    <p className="text-sm text-white/50">{method.description}</p>
                                )}
                            </div>
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

                            {method.tips && method.tips.length > 0 && (
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
                                    <p className="text-sm text-white/70 whitespace-pre-wrap">{method.example}</p>
                                </div>
                            )}

                            {method.commonErrors && method.commonErrors.length > 0 && (
                                <div className="bg-red-500/10 rounded-lg p-4">
                                    <h4 className="text-sm font-bold text-red-400 mb-2">ERRORES A EVITAR:</h4>
                                    <ul className="space-y-1">
                                        {method.commonErrors.map((error, j) => (
                                            <li key={j} className="text-sm text-white/70 flex items-start gap-2">
                                                <span className="material-symbols-outlined text-red-400 text-sm">close</span>
                                                {error}
                                            </li>
                                        ))}
                                    </ul>
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
    content: AdaptiveExerciseContent;
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

    const getLikelihoodStyle = (likelihood: string) => {
        switch (likelihood) {
            case 'high': return { text: 'Muy probable', color: 'bg-red-500/20 text-red-400' };
            case 'medium': return { text: 'Probable', color: 'bg-amber-500/20 text-amber-400' };
            default: return { text: 'Posible', color: 'bg-blue-500/20 text-blue-400' };
        }
    };

    const likelihood = getLikelihoodStyle(exercise.examLikelihood);

    return (
        <div className="space-y-6">
            <div className="text-center mb-4">
                <h2 className="text-2xl font-bold text-white mb-2">Ejercicios de Práctica</h2>
                <p className="text-white/60">{currentIndex + 1} de {content.exercises.length}</p>
            </div>

            {/* Practice Strategy */}
            {content.practiceStrategy && currentIndex === 0 && (
                <div className="bg-purple-500/10 backdrop-blur-sm rounded-xl p-4 border border-purple-500/30">
                    <div className="flex items-start gap-2">
                        <span className="material-symbols-outlined text-purple-400">tips_and_updates</span>
                        <p className="text-sm text-purple-200">{content.practiceStrategy}</p>
                    </div>
                </div>
            )}

            {/* Exercise */}
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-4 flex-wrap">
                    <span className="px-3 py-1 bg-rose-500/20 text-rose-400 text-xs font-bold rounded-full">
                        Dificultad {exercise.difficulty}/5
                    </span>
                    <span className="px-3 py-1 bg-white/10 text-white/60 text-xs rounded-full">
                        {exercise.topic}
                    </span>
                    <span className={`px-3 py-1 ${likelihood.color} text-xs font-bold rounded-full`}>
                        {likelihood.text} en examen
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

const Phase6Tips: React.FC<{ content: AdaptiveTipsContent }> = ({ content }) => {
    const getFrequencyBadge = (frequency: string) => {
        switch (frequency) {
            case 'very-common': return { text: 'Muy común', color: 'bg-red-500/30 text-red-300' };
            case 'common': return { text: 'Común', color: 'bg-amber-500/30 text-amber-300' };
            default: return { text: 'Ocasional', color: 'bg-blue-500/30 text-blue-300' };
        }
    };

    return (
        <div className="space-y-6">
            <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-white mb-2">Tips y Errores Comunes</h2>
                <p className="text-white/60">Lo que debes recordar para el examen</p>
            </div>

            {/* Common Mistakes */}
            {content.commonMistakes && content.commonMistakes.length > 0 && (
                <div className="bg-red-500/10 backdrop-blur-sm rounded-xl p-6">
                    <h3 className="text-lg font-bold text-red-400 mb-4 flex items-center gap-2">
                        <span className="material-symbols-outlined">error</span>
                        Errores Comunes a Evitar
                    </h3>
                    <div className="space-y-4">
                        {content.commonMistakes.map((mistake, i) => {
                            const freqBadge = getFrequencyBadge(mistake.frequency);
                            return (
                                <div key={i} className="bg-white/5 rounded-lg p-4">
                                    <div className="flex items-start gap-3">
                                        <span className="material-symbols-outlined text-red-400 mt-1">close</span>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <p className="text-white font-medium">{mistake.mistake}</p>
                                                <span className={`px-2 py-0.5 text-xs rounded-full ${freqBadge.color}`}>
                                                    {freqBadge.text}
                                                </span>
                                            </div>
                                            <p className="text-emerald-400 text-sm mt-1">
                                                <span className="font-bold">Correcto:</span> {mistake.correction}
                                            </p>
                                            <p className="text-white/60 text-sm mt-1">
                                                <span className="font-bold">Evítalo:</span> {mistake.howToAvoid}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Exam Strategies */}
            {content.examStrategies && content.examStrategies.length > 0 && (
                <div className="bg-amber-500/10 backdrop-blur-sm rounded-xl p-6">
                    <h3 className="text-lg font-bold text-amber-400 mb-4 flex items-center gap-2">
                        <span className="material-symbols-outlined">psychology</span>
                        Estrategias para el Examen
                    </h3>
                    <div className="space-y-3">
                        {content.examStrategies.map((item, i) => (
                            <div key={i} className="bg-white/5 rounded-lg p-3">
                                <p className="text-white font-medium">{item.strategy}</p>
                                <p className="text-amber-300 text-sm mt-1">
                                    <span className="font-bold">Usar cuando:</span> {item.whenToUse}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Time Management */}
            {content.timeManagement && content.timeManagement.length > 0 && (
                <div className="bg-purple-500/10 backdrop-blur-sm rounded-xl p-6">
                    <h3 className="text-lg font-bold text-purple-400 mb-4 flex items-center gap-2">
                        <span className="material-symbols-outlined">schedule</span>
                        Gestión del Tiempo
                    </h3>
                    <ul className="space-y-2">
                        {content.timeManagement.map((tip, i) => (
                            <li key={i} className="flex items-start gap-3 text-white/80">
                                <span className="material-symbols-outlined text-purple-400 text-sm mt-1">timer</span>
                                <span>{tip}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Last Minute Reminders */}
            {content.lastMinuteReminders && content.lastMinuteReminders.length > 0 && (
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

            {/* Confidence Boosters */}
            {content.confidenceBoosters && content.confidenceBoosters.length > 0 && (
                <div className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 backdrop-blur-sm rounded-xl p-6 border border-emerald-500/20">
                    <h3 className="text-lg font-bold text-emerald-400 mb-4 flex items-center gap-2">
                        <span className="material-symbols-outlined">favorite</span>
                        Confía en Ti
                    </h3>
                    <ul className="space-y-2">
                        {content.confidenceBoosters.map((boost, i) => (
                            <li key={i} className="flex items-start gap-3 text-emerald-200">
                                <span className="material-symbols-outlined text-emerald-400 text-sm mt-1">star</span>
                                <span>{boost}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

const UltraReview: React.FC = () => (
    <ErrorBoundary>
        <UltraReviewContent />
    </ErrorBoundary>
);

export default UltraReview;
