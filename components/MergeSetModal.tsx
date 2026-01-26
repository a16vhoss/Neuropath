/**
 * MergeSetModal.tsx
 *
 * Modal for selecting another study set to merge with the current one.
 * Merging moves all flashcards and materials from the selected set into the current set.
 */

import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';

interface StudySetOption {
    id: string;
    name: string;
    description?: string;
    flashcard_count: number;
    material_count: number;
}

interface MergeSetModalProps {
    isOpen: boolean;
    onClose: () => void;
    onMerge: (sourceSetId: string) => Promise<void>;
    currentSetId: string;
    currentSetName: string;
    userId: string;
}

const MergeSetModal: React.FC<MergeSetModalProps> = ({
    isOpen,
    onClose,
    onMerge,
    currentSetId,
    currentSetName,
    userId
}) => {
    const [studySets, setStudySets] = useState<StudySetOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedSetId, setSelectedSetId] = useState<string | null>(null);
    const [merging, setMerging] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        if (isOpen) {
            loadStudySets();
            setSelectedSetId(null);
            setSearchQuery('');
        }
    }, [isOpen]);

    const loadStudySets = async () => {
        setLoading(true);
        try {
            // Get all user's study sets except the current one
            const { data: sets, error } = await supabase
                .from('study_sets')
                .select('id, name, description')
                .eq('student_id', userId)
                .neq('id', currentSetId)
                .order('name', { ascending: true });

            if (error) throw error;

            // Get flashcard and material counts for each set
            const setsWithCounts = await Promise.all(
                (sets || []).map(async (set) => {
                    const [flashcardResult, materialResult] = await Promise.all([
                        supabase
                            .from('flashcards')
                            .select('*', { count: 'exact', head: true })
                            .eq('study_set_id', set.id),
                        supabase
                            .from('study_set_materials')
                            .select('*', { count: 'exact', head: true })
                            .eq('study_set_id', set.id)
                    ]);

                    return {
                        ...set,
                        flashcard_count: flashcardResult.count || 0,
                        material_count: materialResult.count || 0
                    };
                })
            );

            setStudySets(setsWithCounts);
        } catch (error) {
            console.error('Error loading study sets:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleMerge = async () => {
        if (!selectedSetId) return;

        setMerging(true);
        try {
            await onMerge(selectedSetId);
            onClose();
        } catch (error) {
            console.error('Error merging sets:', error);
        } finally {
            setMerging(false);
        }
    };

    const selectedSet = studySets.find(s => s.id === selectedSetId);

    const filteredSets = studySets.filter(set =>
        set.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        set.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[85vh]">
                {/* Header */}
                <div className="p-5 border-b border-slate-100">
                    <div className="flex items-center justify-between mb-1">
                        <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                            <span className="material-symbols-outlined text-violet-500">merge</span>
                            Fusionar Sets
                        </h3>
                        <button
                            onClick={onClose}
                            className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                        >
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    </div>
                    <p className="text-sm text-slate-500">
                        Selecciona un set para fusionar con <strong>"{currentSetName}"</strong>
                    </p>
                </div>

                {/* Search */}
                <div className="p-3 border-b border-slate-100 bg-slate-50">
                    <div className="relative">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
                            search
                        </span>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Buscar set..."
                            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-400"
                        />
                    </div>
                </div>

                {/* Study Sets List */}
                <div className="flex-1 overflow-y-auto p-3 min-h-[250px]">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-12">
                            <div className="w-8 h-8 border-3 border-violet-500 border-t-transparent rounded-full animate-spin mb-3"></div>
                            <p className="text-sm text-slate-400">Cargando sets...</p>
                        </div>
                    ) : filteredSets.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">
                                {searchQuery ? 'search_off' : 'folder_off'}
                            </span>
                            <p className="text-slate-500 font-medium">
                                {searchQuery ? 'No se encontraron sets' : 'No tienes otros sets'}
                            </p>
                            <p className="text-sm text-slate-400 mt-1">
                                {searchQuery ? 'Intenta con otro término' : 'Crea más sets para poder fusionarlos'}
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {filteredSets.map(set => (
                                <div
                                    key={set.id}
                                    onClick={() => setSelectedSetId(set.id)}
                                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                                        selectedSetId === set.id
                                            ? 'border-violet-500 bg-violet-50 shadow-sm'
                                            : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50'
                                    }`}
                                >
                                    <div className="flex items-start gap-3">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                                            selectedSetId === set.id
                                                ? 'bg-violet-500 text-white'
                                                : 'bg-slate-100 text-slate-500'
                                        }`}>
                                            <span className="material-symbols-outlined">auto_stories</span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className={`font-bold truncate ${
                                                selectedSetId === set.id ? 'text-violet-900' : 'text-slate-800'
                                            }`}>
                                                {set.name}
                                            </h4>
                                            {set.description && (
                                                <p className="text-sm text-slate-500 truncate mt-0.5">
                                                    {set.description}
                                                </p>
                                            )}
                                            <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                                                <span className="flex items-center gap-1">
                                                    <span className="material-symbols-outlined text-sm">style</span>
                                                    {set.flashcard_count} flashcards
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <span className="material-symbols-outlined text-sm">description</span>
                                                    {set.material_count} materiales
                                                </span>
                                            </div>
                                        </div>
                                        {selectedSetId === set.id && (
                                            <span className="material-symbols-outlined text-violet-500">
                                                check_circle
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Preview & Action */}
                {selectedSet && (
                    <div className="p-4 bg-amber-50 border-t border-amber-100">
                        <div className="flex items-start gap-3">
                            <span className="material-symbols-outlined text-amber-500 text-xl mt-0.5">info</span>
                            <div className="text-sm">
                                <p className="text-amber-800 font-medium">
                                    Se moverán a "{currentSetName}":
                                </p>
                                <ul className="text-amber-700 mt-1 space-y-0.5">
                                    <li>• {selectedSet.flashcard_count} flashcards</li>
                                    <li>• {selectedSet.material_count} materiales</li>
                                </ul>
                                <p className="text-amber-600 mt-2 text-xs">
                                    El set "{selectedSet.name}" será eliminado después de la fusión.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Footer */}
                <div className="p-4 border-t border-slate-100 bg-white flex gap-3">
                    <button
                        onClick={onClose}
                        disabled={merging}
                        className="flex-1 py-3 px-4 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleMerge}
                        disabled={!selectedSetId || merging}
                        className="flex-1 py-3 px-4 rounded-xl font-bold bg-violet-600 text-white hover:bg-violet-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {merging ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                Fusionando...
                            </>
                        ) : (
                            <>
                                <span className="material-symbols-outlined text-lg">merge</span>
                                Fusionar
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MergeSetModal;
