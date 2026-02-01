import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { QuizConfig, QuestionType, getUserMasteryLevel } from '../services/QuizService';

interface QuizConfigModalProps {
    studySetIds: string[];
    userId: string;
    onStart: (config: QuizConfig) => void;
    onCancel: () => void;
}

const QuizConfigModal: React.FC<QuizConfigModalProps> = ({ studySetIds, userId, onStart, onCancel }) => {
    // State for configuration
    const [questionCount, setQuestionCount] = useState<number>(10);
    const [selectedTypes, setSelectedTypes] = useState<QuestionType[]>(['multiple_choice', 'true_false', 'analysis', 'practical']);
    const [difficultyOverride, setDifficultyOverride] = useState<boolean>(false);
    const [selectedDifficulty, setSelectedDifficulty] = useState<number>(2); // Default Intermedio
    const [userLevel, setUserLevel] = useState<number>(1);

    const [contentScope, setContentScope] = useState<'all' | 'weak_topics' | 'specific_topics'>('all');
    const [availableTopics, setAvailableTopics] = useState<string[]>([]);
    const [selectedTopics, setSelectedTopics] = useState<string[]>([]);

    const [timeLimitEnabled, setTimeLimitEnabled] = useState<boolean>(false);
    const [immediateFeedback, setImmediateFeedback] = useState<boolean>(true);

    // God Mode States
    const [gameMode, setGameMode] = useState<'classic' | 'survival' | 'time_attack'>('classic');
    const [persona, setPersona] = useState<'standard' | 'socratic' | 'strict' | 'friendly'>('standard');

    const [loadingInfo, setLoadingInfo] = useState(true);

    // Initial data fetch
    useEffect(() => {
        const fetchInfo = async () => {
            try {
                // Get user current level
                const level = await getUserMasteryLevel(studySetIds, userId);
                setUserLevel(level);
                setSelectedDifficulty(level);

                // Get topics
                const { data: flashcards } = await supabase
                    .from('flashcards')
                    .select('category')
                    .in('study_set_id', studySetIds);

                if (flashcards) {
                    const topics = Array.from(new Set(flashcards.map(f => f.category || 'General').filter(Boolean)));
                    setAvailableTopics(topics);
                }
            } catch (e) {
                console.error("Error fetching quiz config info", e);
            } finally {
                setLoadingInfo(false);
            }
        };
        fetchInfo();
    }, [JSON.stringify(studySetIds), userId]);

    // Handlers
    const handleTypeToggle = (type: QuestionType) => {
        setSelectedTypes(prev =>
            prev.includes(type)
                ? prev.filter(t => t !== type)
                : [...prev, type]
        );
    };

    const handleTopicToggle = (topic: string) => {
        setSelectedTopics(prev =>
            prev.includes(topic)
                ? prev.filter(t => t !== topic)
                : [...prev, topic]
        );
    };

    const handleStart = () => {
        // Validation
        if (selectedTypes.length === 0) {
            alert("Selecciona al menos un tipo de pregunta");
            return;
        }
        if (contentScope === 'specific_topics' && selectedTopics.length === 0) {
            alert("Selecciona al menos un tema");
            return;
        }

        const config: QuizConfig = {
            questionCount,
            questionTypes: selectedTypes,
            difficultyLevel: difficultyOverride ? selectedDifficulty : undefined,
            contentScope,
            selectedTopics: contentScope === 'specific_topics' ? selectedTopics : undefined,
            startWithTimeLimit: timeLimitEnabled,
            immediateFeedback,
            timeLimitPerQuestion: timeLimitEnabled ? 60 : 0,
            gameMode,
            persona
        } as any;

        onStart(config);
    };

    if (loadingInfo) return <div className="p-8 text-center text-white">Cargando opciones...</div>;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-white/20 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
                <div className="p-6 border-b border-white/10 flex justify-between items-center sticky top-0 bg-slate-900 z-10">
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        <span className="material-symbols-outlined text-purple-400">tune</span>
                        Personalizar Quiz
                    </h2>
                    <button onClick={onCancel} className="text-gray-400 hover:text-white transition-colors">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <div className="p-6 space-y-8 text-gray-200">

                    {/* 1. Cantidad */}
                    <div className="space-y-3">
                        <label className="text-sm font-bold uppercase tracking-wider text-purple-400">Cantidad de Preguntas</label>
                        <div className="flex items-center gap-4">
                            <input
                                type="range"
                                min="5"
                                max="50"
                                step="5"
                                value={questionCount}
                                onChange={(e) => setQuestionCount(parseInt(e.target.value))}
                                className="w-full accent-purple-500 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                            />
                            <span className="text-2xl font-bold min-w-[3ch] text-center">{questionCount}</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {[
                            { id: 'true_false', label: 'Verdadero / Falso', icon: 'check_circle' },
                            { id: 'multiple_choice', label: 'Opción Múltiple', icon: 'list_alt' },
                            { id: 'analysis', label: 'Análisis', icon: 'psychology' },
                            { id: 'design', label: 'Diseño', icon: 'draw' },
                            { id: 'practical', label: 'Práctica Real', icon: 'science' },
                            { id: 'ordering', label: 'Ordenar Secuencia', icon: 'sort' },
                            { id: 'matching', label: 'Relacionar', icon: 'join_inner' },
                            { id: 'fill_blank', label: 'Completar', icon: 'edit_square' },
                            { id: 'identify_error', label: 'Detectar Error', icon: 'bug_report' },
                        ].map((type) => (
                            <button
                                key={type.id}
                                onClick={() => handleTypeToggle(type.id as QuestionType)}
                                className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${selectedTypes.includes(type.id as QuestionType)
                                    ? 'bg-purple-500/20 border-purple-500 text-white'
                                    : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                                    }`}
                            >
                                <span className="material-symbols-outlined text-xl">{type.icon}</span>
                                <span className="font-medium text-sm">{type.label}</span>
                                {selectedTypes.includes(type.id as QuestionType) && (
                                    <span className="material-symbols-outlined ml-auto text-purple-400 text-sm">check</span>
                                )}
                            </button>
                        ))}
                    </div>


                    {/* New: Game Mode & Persona */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Game Mode */}
                        <div className="space-y-3">
                            <label className="text-sm font-bold uppercase tracking-wider text-purple-400">Modo de Juego</label>
                            <div className="space-y-2">
                                {[
                                    { id: 'classic', label: 'Clásico', desc: 'Sin presión extra', icon: 'school' },
                                    { id: 'survival', label: 'Supervivencia', desc: '1 error = Game Over', icon: 'skull' },
                                    { id: 'time_attack', label: 'Contra Reloj', desc: 'Máximas preguntas en 2 min', icon: 'timer' },
                                ].map((m) => (
                                    <button
                                        key={m.id}
                                        onClick={() => setGameMode(m.id as any)}
                                        className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${gameMode === m.id
                                            ? 'bg-gradient-to-r from-purple-900/50 to-blue-900/50 border-purple-500 text-white'
                                            : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'}`}
                                    >
                                        <span className={`material-symbols-outlined p-2 rounded-lg ${gameMode === m.id ? 'bg-purple-500 text-white' : 'bg-white/10'}`}>{m.icon}</span>
                                        <div>
                                            <p className="font-bold">{m.label}</p>
                                            <p className="text-xs opacity-70">{m.desc}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Persona */}
                        <div className="space-y-3">
                            <label className="text-sm font-bold uppercase tracking-wider text-purple-400">Examinador (IA)</label>
                            <div className="space-y-2">
                                {[
                                    { id: 'standard', label: 'Estándar', desc: 'Neutral y objetivo', icon: 'smart_toy' },
                                    { id: 'socratic', label: 'Sócrates', desc: 'Te guía con preguntas', icon: 'lightbulb' },
                                    { id: 'strict', label: 'Sargento', desc: 'Estricto y directo', icon: 'military_tech' },
                                    { id: 'friendly', label: 'Maya', desc: 'Amable y motivadora', icon: 'favorite' },
                                ].map((p) => (
                                    <button
                                        key={p.id}
                                        onClick={() => setPersona(p.id as any)}
                                        className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${persona === p.id
                                            ? 'bg-gradient-to-r from-emerald-900/50 to-teal-900/50 border-emerald-500 text-white'
                                            : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'}`}
                                    >
                                        <span className={`material-symbols-outlined p-2 rounded-lg ${persona === p.id ? 'bg-emerald-500 text-white' : 'bg-white/10'}`}>{p.icon}</span>
                                        <div>
                                            <p className="font-bold">{p.label}</p>
                                            <p className="text-xs opacity-70">{p.desc}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* 3. Dificultad */}
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <label className="text-sm font-bold uppercase tracking-wider text-purple-400">Nivel de Dificultad</label>
                            <button
                                onClick={() => setDifficultyOverride(!difficultyOverride)}
                                className={`text-xs px-3 py-1 rounded-full transition-colors ${difficultyOverride ? 'bg-purple-500 text-white' : 'bg-gray-700 text-gray-400'}`}
                            >
                                {difficultyOverride ? 'Manual' : 'Automático'}
                            </button>
                        </div>

                        {!difficultyOverride ? (
                            <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl flex items-center gap-3 text-blue-200">
                                <span className="material-symbols-outlined">auto_awesome</span>
                                <div>
                                    <p className="font-semibold">Modo Adaptativo Activo</p>
                                    <p className="text-sm opacity-80">El sistema detectó tu nivel como: <span className="font-bold text-white">{['Básico', 'Intermedio', 'Avanzado', 'Experto'][userLevel - 1]}</span></p>
                                </div>
                            </div>
                        ) : (
                            <div className="flex gap-2 bg-black/20 p-1 rounded-xl">
                                {[
                                    { lvl: 1, label: 'Básico' },
                                    { lvl: 2, label: 'Intermedio' },
                                    { lvl: 3, label: 'Avanzado' },
                                    { lvl: 4, label: 'Experto' }
                                ].map((l) => (
                                    <button
                                        key={l.lvl}
                                        onClick={() => setSelectedDifficulty(l.lvl)}
                                        className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${selectedDifficulty === l.lvl
                                            ? 'bg-purple-600 text-white shadow-lg'
                                            : 'text-gray-400 hover:bg-white/5'
                                            }`}
                                    >
                                        {l.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* 4. Enfoque de Contenido */}
                    <div className="space-y-3">
                        <label className="text-sm font-bold uppercase tracking-wider text-purple-400">Enfoque del Quiz</label>
                        <div className="grid grid-cols-1 gap-2">
                            <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${contentScope === 'all' ? 'bg-purple-500/20 border-purple-500' : 'bg-white/5 border-white/10'}`}>
                                <input type="radio" name="scope" className="hidden" checked={contentScope === 'all'} onChange={() => setContentScope('all')} />
                                <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${contentScope === 'all' ? 'border-purple-500' : 'border-gray-500'}`}>
                                    {contentScope === 'all' && <div className="w-3 h-3 bg-purple-500 rounded-full" />}
                                </div>
                                <div>
                                    <p className="font-bold">Todo el Contenido</p>
                                    <p className="text-xs opacity-70">Mezcla aleatoria de todos los temas</p>
                                </div>
                            </label>

                            <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${contentScope === 'weak_topics' ? 'bg-purple-500/20 border-purple-500' : 'bg-white/5 border-white/10'}`}>
                                <input type="radio" name="scope" className="hidden" checked={contentScope === 'weak_topics'} onChange={() => setContentScope('weak_topics')} />
                                <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${contentScope === 'weak_topics' ? 'border-purple-500' : 'border-gray-500'}`}>
                                    {contentScope === 'weak_topics' && <div className="w-3 h-3 bg-purple-500 rounded-full" />}
                                </div>
                                <div>
                                    <p className="font-bold">Repaso Inteligente</p>
                                    <p className="text-xs opacity-70">Priorizar temas donde he fallado antes</p>
                                </div>
                            </label>

                            <label className={`flex flex-col gap-3 p-3 rounded-lg border cursor-pointer transition-all ${contentScope === 'specific_topics' ? 'bg-purple-500/20 border-purple-500' : 'bg-white/5 border-white/10'}`}>
                                <div className="flex items-center gap-3" onClick={() => setContentScope('specific_topics')}>
                                    <input type="radio" name="scope" className="hidden" checked={contentScope === 'specific_topics'} readOnly />
                                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${contentScope === 'specific_topics' ? 'border-purple-500' : 'border-gray-500'}`}>
                                        {contentScope === 'specific_topics' && <div className="w-3 h-3 bg-purple-500 rounded-full" />}
                                    </div>
                                    <div>
                                        <p className="font-bold">Temas Específicos</p>
                                        <p className="text-xs opacity-70">Seleccionar manualmente</p>
                                    </div>
                                </div>
                                {contentScope === 'specific_topics' && (
                                    <div className="pl-8 pt-2 grid grid-cols-2 gap-2 animate-fadeIn">
                                        {availableTopics.map(topic => (
                                            <button
                                                key={topic}
                                                onClick={(e) => { e.preventDefault(); handleTopicToggle(topic); }}
                                                className={`text-xs px-2 py-1.5 rounded border text-left truncate ${selectedTopics.includes(topic) ? 'bg-purple-500 text-white border-purple-400' : 'bg-black/30 text-gray-400 border-white/10'}`}
                                            >
                                                {topic}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </label>
                        </div>
                    </div>

                    {/* 5. Configuración de Examen */}
                    <div className="space-y-3">
                        <label className="text-sm font-bold uppercase tracking-wider text-purple-400">Modo de Examen</label>
                        <div className="flex flex-col gap-3">
                            <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                                <div className="flex items-center gap-3">
                                    <span className="material-symbols-outlined text-yellow-400">timer</span>
                                    <div>
                                        <p className="font-bold">Límite de Tiempo</p>
                                        <p className="text-xs text-gray-400">Presión extra para simular examen real</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setTimeLimitEnabled(!timeLimitEnabled)}
                                    className={`w-12 h-6 rounded-full transition-colors relative ${timeLimitEnabled ? 'bg-green-500' : 'bg-gray-700'}`}
                                >
                                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${timeLimitEnabled ? 'left-7' : 'left-1'}`} />
                                </button>
                            </div>

                            <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                                <div className="flex items-center gap-3">
                                    <span className="material-symbols-outlined text-blue-400">visibility</span>
                                    <div>
                                        <p className="font-bold">Corrección Inmediata</p>
                                        <p className="text-xs text-gray-400">{immediateFeedback ? 'Ver resultado al responder cada pregunta' : 'Ver resultados al finalizar todo el quiz'}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setImmediateFeedback(!immediateFeedback)}
                                    className={`w-12 h-6 rounded-full transition-colors relative ${immediateFeedback ? 'bg-green-500' : 'bg-gray-700'}`}
                                >
                                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${immediateFeedback ? 'left-7' : 'left-1'}`} />
                                </button>
                            </div>
                        </div>
                    </div>

                </div>

                <div className="p-6 border-t border-white/10 bg-slate-900/50 sticky bottom-0 backdrop-blur-md flex justify-end gap-4">
                    <button
                        onClick={onCancel}
                        className="px-6 py-3 rounded-xl font-bold text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleStart}
                        className="px-8 py-3 rounded-xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white shadow-lg shadow-purple-500/20 transform hover:scale-[1.02] transition-all flex items-center gap-2"
                    >
                        <span>Comenzar Quiz</span>
                        <span className="material-symbols-outlined">arrow_forward</span>
                    </button>
                </div>
            </div>
        </div >
    );
};

export default QuizConfigModal;
