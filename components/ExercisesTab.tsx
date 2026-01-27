/**
 * ExercisesTab.tsx
 *
 * Tab component for viewing and practicing exercises in a study set.
 * Shows extracted exercises, allows practice, and displays explanations.
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
    ExerciseTemplate,
    UserExerciseProgress,
    getExercisesForStudySet,
    getUserExerciseProgress,
    generateSimilarExercise,
    generateExercisesForStudySet,
    recordExerciseAttempt,
    GeneratedExercise
} from '../services/ExerciseService';

interface ExercisesTabProps {
    studySetId: string;
    studySetName: string;
    canEdit: boolean;
}

type ViewMode = 'list' | 'practice' | 'review';

const ExercisesTab: React.FC<ExercisesTabProps> = ({
    studySetId,
    studySetName,
    canEdit
}) => {
    const { user } = useAuth();

    const [exercises, setExercises] = useState<ExerciseTemplate[]>([]);
    const [progress, setProgress] = useState<Map<string, UserExerciseProgress>>(new Map());
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);

    // View state
    const [viewMode, setViewMode] = useState<ViewMode>('list');
    const [selectedExercise, setSelectedExercise] = useState<ExerciseTemplate | null>(null);
    const [showSolution, setShowSolution] = useState(false);
    const [expandedExplanations, setExpandedExplanations] = useState<Set<string>>(new Set());

    // Practice mode state
    const [practiceExercise, setPracticeExercise] = useState<GeneratedExercise | null>(null);
    const [practiceAnswer, setPracticeAnswer] = useState('');
    const [practiceSubmitted, setPracticeSubmitted] = useState(false);
    const [practiceStartTime, setPracticeStartTime] = useState<number>(0);
    const [generatingPractice, setGeneratingPractice] = useState(false);

    // Filter state
    const [filterType, setFilterType] = useState<string>('all');
    const [filterDifficulty, setFilterDifficulty] = useState<number>(0);

    useEffect(() => {
        loadExercises();
    }, [studySetId]);

    const loadExercises = async () => {
        setLoading(true);
        try {
            const exerciseData = await getExercisesForStudySet(studySetId);
            setExercises(exerciseData);

            if (user?.id) {
                const progressData = await getUserExerciseProgress(user.id, studySetId);
                setProgress(progressData);
            }
        } catch (error) {
            console.error('Error loading exercises:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleGenerateExercises = async () => {
        setGenerating(true);
        try {
            const newExercises = await generateExercisesForStudySet(studySetId, 5);
            setExercises(prev => [...prev, ...newExercises]);
        } catch (error: any) {
            alert(error.message || 'Error generando ejercicios');
        } finally {
            setGenerating(false);
        }
    };

    const handleStartPractice = async (exercise: ExerciseTemplate) => {
        setGeneratingPractice(true);
        setSelectedExercise(exercise);

        try {
            const generated = await generateSimilarExercise(exercise);
            setPracticeExercise(generated);
            setPracticeAnswer('');
            setPracticeSubmitted(false);
            setPracticeStartTime(Date.now());
            setViewMode('practice');
        } catch (error) {
            // Fallback to original exercise
            setPracticeExercise({
                problem: exercise.problem_statement,
                solution: exercise.solution || '',
                steps: exercise.step_by_step_explanation || [],
                difficulty: exercise.difficulty,
                basedOnTemplateId: exercise.id
            });
            setPracticeAnswer('');
            setPracticeSubmitted(false);
            setPracticeStartTime(Date.now());
            setViewMode('practice');
        } finally {
            setGeneratingPractice(false);
        }
    };

    const handleSubmitPractice = async (isCorrect: boolean) => {
        if (!user?.id || !selectedExercise) return;

        const timeSpent = Math.round((Date.now() - practiceStartTime) / 1000);
        setPracticeSubmitted(true);

        await recordExerciseAttempt(
            user.id,
            selectedExercise.id,
            isCorrect,
            timeSpent
        );

        // Refresh progress
        const progressData = await getUserExerciseProgress(user.id, studySetId);
        setProgress(progressData);
    };

    const handleNextPractice = () => {
        // Find next exercise or generate another similar one
        const currentIndex = exercises.findIndex(e => e.id === selectedExercise?.id);
        if (currentIndex < exercises.length - 1) {
            handleStartPractice(exercises[currentIndex + 1]);
        } else {
            setViewMode('list');
            setSelectedExercise(null);
            setPracticeExercise(null);
        }
    };

    const toggleExplanation = (exerciseId: string) => {
        setExpandedExplanations(prev => {
            const newSet = new Set(prev);
            if (newSet.has(exerciseId)) {
                newSet.delete(exerciseId);
            } else {
                newSet.add(exerciseId);
            }
            return newSet;
        });
    };

    const getExerciseTypeLabel = (type: string) => {
        const labels: Record<string, string> = {
            mathematical: 'Matemático',
            programming: 'Programación',
            case_study: 'Caso de Estudio',
            conceptual: 'Conceptual',
            practical: 'Práctico',
            general: 'General'
        };
        return labels[type] || type;
    };

    const getExerciseTypeIcon = (type: string) => {
        const icons: Record<string, string> = {
            mathematical: 'calculate',
            programming: 'code',
            case_study: 'cases',
            conceptual: 'lightbulb',
            practical: 'build',
            general: 'assignment'
        };
        return icons[type] || 'assignment';
    };

    const getDifficultyColor = (difficulty: number) => {
        if (difficulty <= 2) return 'text-emerald-600 bg-emerald-50';
        if (difficulty <= 3) return 'text-amber-600 bg-amber-50';
        return 'text-rose-600 bg-rose-50';
    };

    const getMasteryBadge = (exerciseId: string) => {
        const p = progress.get(exerciseId);
        if (!p || p.attempts === 0) return null;

        const rate = (p.correct_attempts / p.attempts) * 100;
        if (rate >= 80) return { label: 'Dominado', color: 'bg-emerald-100 text-emerald-700' };
        if (rate >= 50) return { label: 'En progreso', color: 'bg-amber-100 text-amber-700' };
        return { label: 'Necesita práctica', color: 'bg-rose-100 text-rose-700' };
    };

    // Filter exercises
    const filteredExercises = exercises.filter(ex => {
        if (filterType !== 'all' && ex.exercise_type !== filterType) return false;
        if (filterDifficulty > 0 && ex.difficulty !== filterDifficulty) return false;
        return true;
    });

    // Get unique types for filter
    const exerciseTypes = [...new Set(exercises.map(e => e.exercise_type))] as string[];

    // Loading state
    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-16">
                <div className="w-10 h-10 border-4 border-violet-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-slate-500">Cargando ejercicios...</p>
            </div>
        );
    }

    // Practice mode
    if (viewMode === 'practice' && practiceExercise) {
        return (
            <div className="max-w-3xl mx-auto">
                {/* Practice Header */}
                <div className="flex items-center justify-between mb-6">
                    <button
                        onClick={() => {
                            setViewMode('list');
                            setSelectedExercise(null);
                            setPracticeExercise(null);
                        }}
                        className="flex items-center gap-2 text-slate-500 hover:text-slate-700"
                    >
                        <span className="material-symbols-outlined">arrow_back</span>
                        Volver a ejercicios
                    </button>
                    <span className={`px-3 py-1 rounded-full text-sm font-bold ${getDifficultyColor(practiceExercise.difficulty)}`}>
                        Dificultad {practiceExercise.difficulty}/5
                    </span>
                </div>

                {/* Exercise Card */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    {/* Problem */}
                    <div className="p-6 border-b border-slate-100">
                        <div className="flex items-center gap-2 text-violet-600 mb-3">
                            <span className="material-symbols-outlined">edit_note</span>
                            <span className="font-bold text-sm uppercase tracking-wide">Problema</span>
                        </div>
                        <div className="prose prose-slate max-w-none">
                            <p className="text-lg text-slate-800 whitespace-pre-wrap">
                                {practiceExercise.problem}
                            </p>
                        </div>
                    </div>

                    {/* Answer Area */}
                    {!practiceSubmitted && (
                        <div className="p-6 bg-slate-50">
                            <label className="block text-sm font-bold text-slate-700 mb-2">
                                Tu respuesta:
                            </label>
                            <textarea
                                value={practiceAnswer}
                                onChange={(e) => setPracticeAnswer(e.target.value)}
                                placeholder="Escribe tu respuesta aquí..."
                                className="w-full p-4 border border-slate-200 rounded-xl resize-none h-32 focus:ring-2 focus:ring-violet-200 focus:border-violet-400 outline-none"
                            />
                            <div className="flex gap-3 mt-4">
                                <button
                                    onClick={() => setShowSolution(true)}
                                    className="flex-1 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition"
                                >
                                    Ver solución
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Solution (shown after clicking "Ver solución" or submitting) */}
                    {showSolution && (
                        <div className="p-6 border-t border-slate-100">
                            <div className="flex items-center gap-2 text-emerald-600 mb-3">
                                <span className="material-symbols-outlined">check_circle</span>
                                <span className="font-bold text-sm uppercase tracking-wide">Solución</span>
                            </div>
                            <div className="bg-emerald-50 rounded-xl p-4 mb-4">
                                <p className="text-emerald-800 whitespace-pre-wrap">
                                    {practiceExercise.solution}
                                </p>
                            </div>

                            {/* Step by step */}
                            {practiceExercise.steps && practiceExercise.steps.length > 0 && (
                                <div className="mt-4">
                                    <div className="flex items-center gap-2 text-blue-600 mb-3">
                                        <span className="material-symbols-outlined">format_list_numbered</span>
                                        <span className="font-bold text-sm uppercase tracking-wide">Paso a Paso</span>
                                    </div>
                                    <ol className="space-y-3">
                                        {practiceExercise.steps.map((step, i) => (
                                            <li key={i} className="flex gap-3">
                                                <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-bold flex-shrink-0">
                                                    {i + 1}
                                                </span>
                                                <p className="text-slate-700">{step}</p>
                                            </li>
                                        ))}
                                    </ol>
                                </div>
                            )}

                            {/* Self-evaluation */}
                            {!practiceSubmitted && (
                                <div className="mt-6 pt-6 border-t border-slate-100">
                                    <p className="text-center text-slate-600 mb-4">
                                        ¿Resolviste correctamente el ejercicio?
                                    </p>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => handleSubmitPractice(false)}
                                            className="flex-1 py-3 bg-rose-100 text-rose-700 font-bold rounded-xl hover:bg-rose-200 transition flex items-center justify-center gap-2"
                                        >
                                            <span className="material-symbols-outlined">close</span>
                                            No lo logré
                                        </button>
                                        <button
                                            onClick={() => handleSubmitPractice(true)}
                                            className="flex-1 py-3 bg-emerald-100 text-emerald-700 font-bold rounded-xl hover:bg-emerald-200 transition flex items-center justify-center gap-2"
                                        >
                                            <span className="material-symbols-outlined">check</span>
                                            ¡Lo resolví!
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* After submission */}
                            {practiceSubmitted && (
                                <div className="mt-6 pt-6 border-t border-slate-100">
                                    <div className="text-center">
                                        <p className="text-slate-600 mb-4">¡Respuesta registrada!</p>
                                        <div className="flex gap-3">
                                            <button
                                                onClick={() => handleStartPractice(selectedExercise!)}
                                                className="flex-1 py-3 bg-violet-100 text-violet-700 font-bold rounded-xl hover:bg-violet-200 transition"
                                            >
                                                Practicar otro similar
                                            </button>
                                            <button
                                                onClick={handleNextPractice}
                                                className="flex-1 py-3 bg-violet-600 text-white font-bold rounded-xl hover:bg-violet-700 transition"
                                            >
                                                Siguiente ejercicio
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // Empty state
    if (exercises.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-20 h-20 bg-violet-100 rounded-full flex items-center justify-center mb-4">
                    <span className="material-symbols-outlined text-4xl text-violet-500">exercise</span>
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">No hay ejercicios aún</h3>
                <p className="text-slate-500 max-w-md mb-6">
                    Sube material con ejercicios o genera ejercicios automáticamente basados en tu contenido de estudio.
                </p>
                <button
                    onClick={handleGenerateExercises}
                    disabled={generating}
                    className="px-6 py-3 bg-violet-600 text-white font-bold rounded-xl hover:bg-violet-700 transition flex items-center gap-2 disabled:opacity-50"
                >
                    {generating ? (
                        <>
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            Generando...
                        </>
                    ) : (
                        <>
                            <span className="material-symbols-outlined">auto_awesome</span>
                            Generar ejercicios con IA
                        </>
                    )}
                </button>
            </div>
        );
    }

    // List view
    return (
        <div className="space-y-6">
            {/* Header & Actions */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h3 className="text-lg font-bold text-slate-800">
                        {exercises.length} Ejercicio{exercises.length !== 1 ? 's' : ''}
                    </h3>
                    <p className="text-sm text-slate-500">
                        Practica con ejercicios similares generados por IA
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={handleGenerateExercises}
                        disabled={generating}
                        className="px-4 py-2 bg-violet-100 text-violet-700 font-bold rounded-xl hover:bg-violet-200 transition flex items-center gap-2 text-sm disabled:opacity-50"
                    >
                        {generating ? (
                            <div className="w-4 h-4 border-2 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                            <span className="material-symbols-outlined text-lg">add</span>
                        )}
                        Generar más
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-2">
                <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-violet-200"
                >
                    <option value="all">Todos los tipos</option>
                    {exerciseTypes.map(type => (
                        <option key={type} value={type}>{getExerciseTypeLabel(type)}</option>
                    ))}
                </select>
                <select
                    value={filterDifficulty}
                    onChange={(e) => setFilterDifficulty(Number(e.target.value))}
                    className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-violet-200"
                >
                    <option value={0}>Todas las dificultades</option>
                    <option value={1}>Dificultad 1</option>
                    <option value={2}>Dificultad 2</option>
                    <option value={3}>Dificultad 3</option>
                    <option value={4}>Dificultad 4</option>
                    <option value={5}>Dificultad 5</option>
                </select>
            </div>

            {/* Exercise List */}
            <div className="space-y-4">
                {filteredExercises.map((exercise, index) => {
                    const mastery = getMasteryBadge(exercise.id);
                    const isExpanded = expandedExplanations.has(exercise.id);

                    return (
                        <div
                            key={exercise.id}
                            className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-md transition-shadow"
                        >
                            {/* Exercise Header */}
                            <div className="p-4 flex items-start gap-4">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-slate-100 text-slate-600`}>
                                    <span className="material-symbols-outlined">
                                        {getExerciseTypeIcon(exercise.exercise_type)}
                                    </span>
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap mb-1">
                                        <span className="text-xs font-bold text-slate-400">
                                            #{index + 1}
                                        </span>
                                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${getDifficultyColor(exercise.difficulty)}`}>
                                            Dif. {exercise.difficulty}
                                        </span>
                                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600">
                                            {getExerciseTypeLabel(exercise.exercise_type)}
                                        </span>
                                        {mastery && (
                                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${mastery.color}`}>
                                                {mastery.label}
                                            </span>
                                        )}
                                    </div>

                                    <p className="text-slate-800 line-clamp-2">
                                        {exercise.problem_statement}
                                    </p>

                                    {exercise.topic && (
                                        <p className="text-xs text-slate-400 mt-1">
                                            Tema: {exercise.topic}
                                            {exercise.subtopic && ` › ${exercise.subtopic}`}
                                        </p>
                                    )}
                                </div>

                                <div className="flex gap-2 flex-shrink-0">
                                    <button
                                        onClick={() => toggleExplanation(exercise.id)}
                                        className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition"
                                        title="Ver explicación"
                                    >
                                        <span className="material-symbols-outlined">
                                            {isExpanded ? 'expand_less' : 'expand_more'}
                                        </span>
                                    </button>
                                    <button
                                        onClick={() => handleStartPractice(exercise)}
                                        disabled={generatingPractice}
                                        className="px-4 py-2 bg-violet-600 text-white font-bold rounded-lg hover:bg-violet-700 transition text-sm flex items-center gap-1"
                                    >
                                        <span className="material-symbols-outlined text-lg">play_arrow</span>
                                        Practicar
                                    </button>
                                </div>
                            </div>

                            {/* Expanded Explanation */}
                            {isExpanded && (
                                <div className="px-4 pb-4 pt-0 border-t border-slate-100 mt-2">
                                    {/* Solution */}
                                    {exercise.solution && (
                                        <div className="mt-4">
                                            <h4 className="text-sm font-bold text-emerald-600 mb-2 flex items-center gap-1">
                                                <span className="material-symbols-outlined text-lg">check_circle</span>
                                                Solución
                                            </h4>
                                            <div className="bg-emerald-50 rounded-lg p-3 text-emerald-800 text-sm whitespace-pre-wrap">
                                                {exercise.solution}
                                            </div>
                                        </div>
                                    )}

                                    {/* Step by step */}
                                    {exercise.step_by_step_explanation && exercise.step_by_step_explanation.length > 0 && (
                                        <div className="mt-4">
                                            <h4 className="text-sm font-bold text-blue-600 mb-2 flex items-center gap-1">
                                                <span className="material-symbols-outlined text-lg">format_list_numbered</span>
                                                Explicación paso a paso
                                            </h4>
                                            <ol className="space-y-2">
                                                {exercise.step_by_step_explanation.map((step, i) => (
                                                    <li key={i} className="flex gap-2 text-sm">
                                                        <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                                                            {i + 1}
                                                        </span>
                                                        <span className="text-slate-700">{step}</span>
                                                    </li>
                                                ))}
                                            </ol>
                                        </div>
                                    )}

                                    {/* Related concepts */}
                                    {exercise.related_concepts && exercise.related_concepts.length > 0 && (
                                        <div className="mt-4">
                                            <h4 className="text-sm font-bold text-slate-500 mb-2">
                                                Conceptos relacionados
                                            </h4>
                                            <div className="flex flex-wrap gap-1">
                                                {exercise.related_concepts.map((concept, i) => (
                                                    <span
                                                        key={i}
                                                        className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs"
                                                    >
                                                        {concept}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Generating overlay */}
            {generatingPractice && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center">
                    <div className="bg-white rounded-2xl p-8 text-center shadow-xl">
                        <div className="w-12 h-12 border-4 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="text-slate-700 font-bold">Generando ejercicio similar...</p>
                        <p className="text-sm text-slate-500 mt-1">La IA está creando una variación para ti</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ExercisesTab;
