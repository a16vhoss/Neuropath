import React, { useState, useEffect } from 'react';

interface StudySet {
    id: string;
    name: string;
    type: 'class' | 'personal';
    count: number;
}

interface AdaptiveConfigModalProps {
    isOpen: boolean;
    onClose: () => void;
    onStartSession: (selectedSetIds: string[], mode: string) => void;
    availableSets: StudySet[];
    initialMode?: 'adaptive' | 'review_due' | 'learn_new' | 'cramming' | 'ultra_review' | 'quiz';
}

const AdaptiveConfigModal: React.FC<AdaptiveConfigModalProps> = ({
    isOpen,
    onClose,
    onStartSession,
    availableSets,
    initialMode = 'adaptive'
}) => {
    const [selectedSetIds, setSelectedSetIds] = useState<string[]>([]);
    const [sessionMode, setSessionMode] = useState<'adaptive' | 'review_due' | 'learn_new' | 'cramming' | 'ultra_review' | 'quiz'>(initialMode);

    useEffect(() => {
        if (isOpen) {
            setSessionMode(initialMode);
            setSelectedSetIds([]);
        }
    }, [isOpen, initialMode]);

    if (!isOpen) return null;

    const toggleSetSelection = (setId: string) => {
        if (selectedSetIds.includes(setId)) {
            setSelectedSetIds(prev => prev.filter(id => id !== setId));
        } else {
            setSelectedSetIds(prev => [...prev, setId]);
        }
    };

    const selectAllSets = () => {
        if (selectedSetIds.length === availableSets.length) {
            setSelectedSetIds([]);
        } else {
            setSelectedSetIds(availableSets.map(s => s.id));
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">

                {/* Header */}
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-indigo-50 to-white">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                            <span className="material-symbols-outlined text-indigo-600">psychology</span>
                            Configurar Sesión de Estudio
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">Personaliza tu experiencia de aprendizaje</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white rounded-full transition-colors text-gray-400 hover:text-gray-600 flex items-center justify-center"
                    >
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8">

                    {/* 1. Select Content */}
                    <section>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-semibold text-gray-700 flex items-center gap-2">
                                <span className="bg-indigo-100 text-indigo-700 w-6 h-6 rounded-full flex items-center justify-center text-xs">1</span>
                                Selecciona el contenido
                            </h3>
                            <button
                                onClick={selectAllSets}
                                className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
                            >
                                {selectedSetIds.length === availableSets.length ? 'Deseleccionar todo' : 'Seleccionar todo'}
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto pr-2">
                            {availableSets.map(set => (
                                <div
                                    key={set.id}
                                    onClick={() => toggleSetSelection(set.id)}
                                    className={`
                    p-3 rounded-xl border-2 cursor-pointer transition-all flex items-center gap-3
                    ${selectedSetIds.includes(set.id)
                                            ? 'border-indigo-500 bg-indigo-50'
                                            : 'border-gray-100 hover:border-indigo-200 hover:bg-gray-50'}
                  `}
                                >
                                    <div className={`
                    w-5 h-5 rounded border flex items-center justify-center transition-colors
                    ${selectedSetIds.includes(set.id)
                                            ? 'bg-indigo-500 border-indigo-500 text-white'
                                            : 'border-gray-300 bg-white'}
                  `}>
                                        {selectedSetIds.includes(set.id) && <span className="material-symbols-outlined text-xs">check</span>}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-gray-900 truncate">{set.name}</p>
                                        <p className="text-xs text-gray-500 flex items-center gap-1">
                                            <span className={`w-2 h-2 rounded-full ${set.type === 'class' ? 'bg-blue-400' : 'bg-green-400'}`}></span>
                                            {set.type === 'class' ? 'Clase' : 'Personal'} • {set.count} tarjetas
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                        {availableSets.length === 0 && (
                            <div className="text-center py-8 text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                No hay sets de estudio disponibles
                            </div>
                        )}
                    </section>

                    {/* 2. Select Mode */}
                    <section>
                        <h3 className="font-semibold text-gray-700 flex items-center gap-2 mb-4">
                            <span className="bg-indigo-100 text-indigo-700 w-6 h-6 rounded-full flex items-center justify-center text-xs">2</span>
                            Elige el modo de estudio
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <button
                                onClick={() => setSessionMode('adaptive')}
                                className={`
                  p-4 rounded-xl border-2 text-left transition-all relative overflow-hidden group
                  ${sessionMode === 'adaptive'
                                        ? 'border-indigo-500 bg-indigo-50 shadow-sm'
                                        : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'}
                `}
                            >
                                <div className="mb-3 w-10 h-10 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center">
                                    <span className="material-symbols-outlined">psychology</span>
                                </div>
                                <h4 className="font-bold text-gray-900 mb-1">Adaptativo IA</h4>
                                <p className="text-xs text-gray-500 leading-relaxed">
                                    El algoritmo selecciona las tarjetas más relevantes para optimizar tu retención.
                                </p>
                                {sessionMode === 'adaptive' && (
                                    <div className="absolute top-2 right-2 text-indigo-600">
                                        <span className="material-symbols-outlined text-sm">check</span>
                                    </div>
                                )}
                            </button>

                            <button
                                onClick={() => setSessionMode('ultra_review')}
                                className={`
                  p-4 rounded-xl border-2 text-left transition-all relative overflow-hidden group
                  ${sessionMode === 'ultra_review'
                                        ? 'border-purple-500 bg-purple-50 shadow-sm'
                                        : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'}
                `}
                            >
                                <div className="mb-3 w-10 h-10 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center">
                                    <span className="material-symbols-outlined">bolt</span>
                                </div>
                                <h4 className="font-bold text-gray-900 mb-1">Ultra Repaso</h4>
                                <p className="text-xs text-gray-500 leading-relaxed">
                                    Sesión intensiva completa: resumen, fórmulas, flashcards y ejercicios. Ideal antes de exámenes.
                                </p>
                                {sessionMode === 'ultra_review' && (
                                    <div className="absolute top-2 right-2 text-purple-600">
                                        <span className="material-symbols-outlined text-sm">check</span>
                                    </div>
                                )}
                            </button>

                            <button
                                onClick={() => setSessionMode('review_due')}
                                className={`
                  p-4 rounded-xl border-2 text-left transition-all relative overflow-hidden group
                  ${sessionMode === 'review_due'
                                        ? 'border-indigo-500 bg-indigo-50 shadow-sm'
                                        : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'}
                `}
                            >
                                <div className="mb-3 w-10 h-10 rounded-lg bg-red-100 text-red-600 flex items-center justify-center">
                                    <span className="material-symbols-outlined">emoji_events</span>
                                </div>
                                <h4 className="font-bold text-gray-900 mb-1">Repaso Urgente</h4>
                                <p className="text-xs text-gray-500 leading-relaxed">
                                    Enfócate solo en las tarjetas que estás a punto de olvidar según tu curva de olvido.
                                </p>
                                {sessionMode === 'review_due' && (
                                    <div className="absolute top-2 right-2 text-indigo-600">
                                        <span className="material-symbols-outlined text-sm">check</span>
                                    </div>
                                )}
                            </button>

                            <button
                                onClick={() => setSessionMode('quiz')}
                                className={`
                  p-4 rounded-xl border-2 text-left transition-all relative overflow-hidden group
                  ${sessionMode === 'quiz'
                                        ? 'border-amber-500 bg-amber-50 shadow-sm'
                                        : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'}
                `}
                            >
                                <div className="mb-3 w-10 h-10 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center">
                                    <span className="material-symbols-outlined">quiz</span>
                                </div>
                                <h4 className="font-bold text-gray-900 mb-1">Quiz</h4>
                                <p className="text-xs text-gray-500 leading-relaxed">
                                    Evalúa tus conocimientos con preguntas de opción múltiple, verdadero/falso y análisis.
                                </p>
                                {sessionMode === 'quiz' && (
                                    <div className="absolute top-2 right-2 text-amber-600">
                                        <span className="material-symbols-outlined text-sm">check</span>
                                    </div>
                                )}
                            </button>



                            <button
                                onClick={() => setSessionMode('learn_new')}
                                className={`
                  p-4 rounded-xl border-2 text-left transition-all relative overflow-hidden group
                  ${sessionMode === 'learn_new'
                                        ? 'border-indigo-500 bg-indigo-50 shadow-sm'
                                        : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'}
                `}
                            >
                                <div className="mb-3 w-10 h-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                                    <span className="material-symbols-outlined">menu_book</span>
                                </div>
                                <h4 className="font-bold text-gray-900 mb-1">Aprender Nuevo</h4>
                                <p className="text-xs text-gray-500 leading-relaxed">
                                    Prioriza tarjetas nuevas o que nunca has visto para expandir tu conocimiento.
                                </p>
                                {sessionMode === 'learn_new' && (
                                    <div className="absolute top-2 right-2 text-indigo-600">
                                        <span className="material-symbols-outlined text-sm">check</span>
                                    </div>
                                )}
                            </button>
                        </div>
                    </section>

                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-between items-center">
                    <div className="text-sm text-gray-500">
                        <span className="font-medium text-gray-900">{selectedSetIds.length}</span> sets seleccionados
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="px-5 py-2.5 rounded-xl text-gray-600 font-medium hover:bg-gray-200 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={() => onStartSession(selectedSetIds, sessionMode)}
                            disabled={selectedSetIds.length === 0}
                            className={`
                px-6 py-2.5 rounded-xl font-bold text-white shadow-lg transition-all flex items-center gap-2
                ${selectedSetIds.length > 0
                                    ? 'bg-indigo-600 hover:bg-indigo-700 hover:shadow-indigo-500/25 transform hover:-translate-y-0.5'
                                    : 'bg-gray-300 cursor-not-allowed'}
              `}
                        >
                            <span className="material-symbols-outlined text-sm">psychology</span>
                            Comenzar Sesión
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default AdaptiveConfigModal;
