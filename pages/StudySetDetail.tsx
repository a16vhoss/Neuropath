import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
    getStudySetWithDetails,
    updateStudySet,
    deleteStudySet,
    addFlashcardToStudySet,
    updateFlashcard,
    deleteFlashcard,
    addMaterialToStudySet,
    supabase
} from '../services/supabaseClient';
import { generateFlashcardsFromText, extractTextFromPDF } from '../services/pdfProcessingService';

interface Flashcard {
    id: string;
    question: string;
    answer: string;
    category?: string;
}

interface Material {
    id: string;
    name: string;
    type: 'pdf' | 'manual' | 'url' | 'notes';
    file_url?: string;
    flashcards_generated: number;
    created_at: string;
}

interface StudySetFull {
    id: string;
    name: string;
    description: string;
    topics: string[];
    flashcards: Flashcard[];
    materials: Material[];
    flashcard_count: number;
    material_count: number;
}

type TabType = 'overview' | 'flashcards' | 'materials';

const StudySetDetail: React.FC = () => {
    const { studySetId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();

    const [studySet, setStudySet] = useState<StudySetFull | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<TabType>('overview');

    // Edit states
    const [isEditingName, setIsEditingName] = useState(false);
    const [editName, setEditName] = useState('');
    const [editDescription, setEditDescription] = useState('');

    // Add flashcard modal
    const [showAddFlashcard, setShowAddFlashcard] = useState(false);
    const [newQuestion, setNewQuestion] = useState('');
    const [newAnswer, setNewAnswer] = useState('');

    // Upload states
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState('');

    useEffect(() => {
        if (studySetId) {
            loadStudySet();
        }
    }, [studySetId]);

    const loadStudySet = async () => {
        try {
            setLoading(true);
            const data = await getStudySetWithDetails(studySetId!);
            setStudySet(data);
            setEditName(data.name);
            setEditDescription(data.description || '');
        } catch (error) {
            console.error('Error loading study set:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateDetails = async () => {
        if (!studySet) return;
        try {
            await updateStudySet(studySet.id, { name: editName, description: editDescription });
            setStudySet({ ...studySet, name: editName, description: editDescription });
            setIsEditingName(false);
        } catch (error) {
            console.error('Error updating study set:', error);
        }
    };

    const handleAddFlashcard = async () => {
        if (!studySet || !newQuestion.trim() || !newAnswer.trim()) return;
        try {
            await addFlashcardToStudySet(studySet.id, { question: newQuestion, answer: newAnswer });
            setNewQuestion('');
            setNewAnswer('');
            setShowAddFlashcard(false);
            loadStudySet();
        } catch (error) {
            console.error('Error adding flashcard:', error);
        }
    };

    const handleDeleteFlashcard = async (flashcardId: string) => {
        try {
            await deleteFlashcard(flashcardId);
            loadStudySet();
        } catch (error) {
            console.error('Error deleting flashcard:', error);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !studySet || !user) return;

        try {
            setUploading(true);
            setUploadProgress('Subiendo archivo...');

            // Upload to storage
            const fileName = `${user.id}/${studySet.id}/${Date.now()}_${file.name}`;
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('materials')
                .upload(fileName, file);

            if (uploadError) throw uploadError;

            const { data: urlData } = supabase.storage.from('materials').getPublicUrl(fileName);

            setUploadProgress('Extrayendo texto del PDF...');
            const extractedText = await extractTextFromPDF(file);

            setUploadProgress('Generando flashcards con IA...');
            const flashcards = await generateFlashcardsFromText(extractedText, studySet.name);

            // Save flashcards
            for (const card of flashcards) {
                await addFlashcardToStudySet(studySet.id, {
                    question: card.question,
                    answer: card.answer,
                    category: card.category
                });
            }

            // Track material
            try {
                await addMaterialToStudySet({
                    study_set_id: studySet.id,
                    name: file.name,
                    type: 'pdf',
                    file_url: urlData.publicUrl,
                    flashcards_generated: flashcards.length
                });
            } catch (matError) {
                console.log('Materials table may not exist yet:', matError);
            }

            setUploadProgress('');
            loadStudySet();
        } catch (error) {
            console.error('Error uploading file:', error);
            setUploadProgress('Error al procesar archivo');
        } finally {
            setUploading(false);
        }
    };

    const handleDeleteSet = async () => {
        if (!studySet || !window.confirm('¿Estás seguro de eliminar este set? Esta acción no se puede deshacer.')) return;
        try {
            await deleteStudySet(studySet.id);
            navigate('/student');
        } catch (error) {
            console.error('Error deleting study set:', error);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
                    <p className="mt-4 text-slate-500">Cargando set de estudio...</p>
                </div>
            </div>
        );
    }

    if (!studySet) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="text-center">
                    <span className="material-symbols-outlined text-6xl text-slate-300">folder_off</span>
                    <p className="mt-4 text-slate-500">Set de estudio no encontrado</p>
                    <button onClick={() => navigate('/student')} className="mt-4 text-primary font-medium">
                        Volver al Dashboard
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Header */}
            <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
                <div className="max-w-5xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => navigate('/student')}
                                className="p-2 hover:bg-slate-100 rounded-lg transition"
                            >
                                <span className="material-symbols-outlined">arrow_back</span>
                            </button>

                            {isEditingName ? (
                                <div className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        value={editName}
                                        onChange={(e) => setEditName(e.target.value)}
                                        className="text-xl font-bold border-b-2 border-primary outline-none bg-transparent"
                                        autoFocus
                                    />
                                    <button onClick={handleUpdateDetails} className="text-primary">
                                        <span className="material-symbols-outlined">check</span>
                                    </button>
                                    <button onClick={() => setIsEditingName(false)} className="text-slate-400">
                                        <span className="material-symbols-outlined">close</span>
                                    </button>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-fuchsia-500 rounded-xl flex items-center justify-center">
                                        <span className="material-symbols-outlined text-white">folder</span>
                                    </div>
                                    <div>
                                        <h1 className="text-xl font-bold text-slate-900">{studySet.name}</h1>
                                        <p className="text-sm text-slate-500">{studySet.flashcard_count} flashcards</p>
                                    </div>
                                    <button
                                        onClick={() => setIsEditingName(true)}
                                        className="p-1 hover:bg-slate-100 rounded-lg text-slate-400"
                                    >
                                        <span className="material-symbols-outlined text-sm">edit</span>
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => navigate(`/student/study-set/${studySet.id}?mode=flashcards`)}
                                className="bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-bold px-6 py-2 rounded-xl hover:opacity-90 transition flex items-center gap-2"
                            >
                                <span className="material-symbols-outlined">play_arrow</span>
                                Estudiar Ahora
                            </button>
                            <button
                                onClick={handleDeleteSet}
                                className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition"
                                title="Eliminar set"
                            >
                                <span className="material-symbols-outlined">delete</span>
                            </button>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-6 mt-4 border-t border-slate-100 pt-4">
                        {(['overview', 'flashcards', 'materials'] as TabType[]).map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`pb-2 font-medium transition ${activeTab === tab
                                    ? 'text-primary border-b-2 border-primary'
                                    : 'text-slate-500 hover:text-slate-700'
                                    }`}
                            >
                                {tab === 'overview' && 'Resumen'}
                                {tab === 'flashcards' && `Flashcards (${studySet.flashcard_count})`}
                                {tab === 'materials' && `Materiales (${studySet.material_count})`}
                            </button>
                        ))}
                    </div>
                </div>
            </header>

            {/* Content */}
            <main className="max-w-5xl mx-auto px-4 py-6">
                {/* Overview Tab */}
                {activeTab === 'overview' && (
                    <div className="grid md:grid-cols-2 gap-6">
                        {/* Stats Card */}
                        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                            <h3 className="font-bold text-slate-900 mb-4">📊 Estadísticas</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-violet-50 rounded-xl p-4 text-center">
                                    <div className="text-3xl font-black text-violet-600">{studySet.flashcard_count}</div>
                                    <div className="text-xs text-violet-500 font-medium">Flashcards</div>
                                </div>
                                <div className="bg-amber-50 rounded-xl p-4 text-center">
                                    <div className="text-3xl font-black text-amber-600">{studySet.material_count}</div>
                                    <div className="text-xs text-amber-500 font-medium">Materiales</div>
                                </div>
                            </div>
                        </div>

                        {/* Quick Actions */}
                        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                            <h3 className="font-bold text-slate-900 mb-4">⚡ Acciones Rápidas</h3>
                            <div className="space-y-3">
                                <label className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition ${uploading ? 'bg-slate-100' : 'bg-emerald-50 hover:bg-emerald-100'}`}>
                                    <span className="material-symbols-outlined text-emerald-600">upload_file</span>
                                    <span className="font-medium text-emerald-700">
                                        {uploading ? uploadProgress : 'Subir PDF para generar flashcards'}
                                    </span>
                                    <input type="file" accept=".pdf" onChange={handleFileUpload} className="hidden" disabled={uploading} />
                                </label>
                                <button
                                    onClick={() => { setActiveTab('flashcards'); setShowAddFlashcard(true); }}
                                    className="w-full flex items-center gap-3 p-3 bg-blue-50 hover:bg-blue-100 rounded-xl transition"
                                >
                                    <span className="material-symbols-outlined text-blue-600">add_circle</span>
                                    <span className="font-medium text-blue-700">Agregar flashcard manual</span>
                                </button>
                            </div>
                        </div>

                        {/* Description */}
                        <div className="md:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                            <h3 className="font-bold text-slate-900 mb-2">📝 Descripción</h3>
                            <textarea
                                value={editDescription}
                                onChange={(e) => setEditDescription(e.target.value)}
                                onBlur={handleUpdateDetails}
                                placeholder="Agrega una descripción para este set..."
                                className="w-full p-3 bg-slate-50 rounded-xl border-0 resize-none focus:ring-2 focus:ring-primary/20"
                                rows={3}
                            />
                        </div>
                    </div>
                )}

                {/* Flashcards Tab */}
                {activeTab === 'flashcards' && (
                    <div>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-slate-900">Flashcards</h3>
                            <button
                                onClick={() => setShowAddFlashcard(true)}
                                className="flex items-center gap-2 bg-primary text-white font-medium px-4 py-2 rounded-xl hover:bg-blue-700 transition"
                            >
                                <span className="material-symbols-outlined">add</span>
                                Nueva Flashcard
                            </button>
                        </div>

                        {studySet.flashcards.length === 0 ? (
                            <div className="bg-white rounded-2xl p-12 text-center border border-slate-100">
                                <span className="material-symbols-outlined text-6xl text-slate-200">style</span>
                                <p className="mt-4 text-slate-500">No hay flashcards aún</p>
                                <p className="text-sm text-slate-400 mt-1">Sube un PDF o crea flashcards manuales</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {studySet.flashcards.map((card, index) => (
                                    <div key={card.id} className="bg-white rounded-xl p-4 border border-slate-100 hover:shadow-md transition">
                                        <div className="flex justify-between items-start">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className="bg-slate-100 text-slate-600 text-xs font-bold px-2 py-1 rounded">#{index + 1}</span>
                                                    {card.category && (
                                                        <span className="bg-violet-100 text-violet-600 text-xs font-medium px-2 py-1 rounded">{card.category}</span>
                                                    )}
                                                </div>
                                                <p className="font-medium text-slate-900 mb-1">{card.question}</p>
                                                <p className="text-sm text-slate-500">{card.answer}</p>
                                            </div>
                                            <button
                                                onClick={() => handleDeleteFlashcard(card.id)}
                                                className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition"
                                            >
                                                <span className="material-symbols-outlined text-sm">delete</span>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Materials Tab */}
                {activeTab === 'materials' && (
                    <div>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-slate-900">Materiales Subidos</h3>
                            <label className={`flex items-center gap-2 font-medium px-4 py-2 rounded-xl cursor-pointer transition ${uploading ? 'bg-slate-200 text-slate-500' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}>
                                <span className="material-symbols-outlined">upload</span>
                                {uploading ? 'Procesando...' : 'Subir PDF'}
                                <input type="file" accept=".pdf" onChange={handleFileUpload} className="hidden" disabled={uploading} />
                            </label>
                        </div>

                        {uploadProgress && (
                            <div className="bg-blue-50 text-blue-700 p-4 rounded-xl mb-4 flex items-center gap-3">
                                <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                                {uploadProgress}
                            </div>
                        )}

                        {studySet.materials.length === 0 ? (
                            <div className="bg-white rounded-2xl p-12 text-center border border-slate-100">
                                <span className="material-symbols-outlined text-6xl text-slate-200">folder_open</span>
                                <p className="mt-4 text-slate-500">No hay materiales aún</p>
                                <p className="text-sm text-slate-400 mt-1">Sube PDFs para generar flashcards automáticamente</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {studySet.materials.map((material) => (
                                    <div key={material.id} className="bg-white rounded-xl p-4 border border-slate-100 flex items-center gap-4">
                                        <div className="w-12 h-12 bg-rose-100 rounded-xl flex items-center justify-center">
                                            <span className="material-symbols-outlined text-rose-600">picture_as_pdf</span>
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-medium text-slate-900">{material.name}</p>
                                            <p className="text-sm text-slate-500">
                                                {material.flashcards_generated} flashcards generadas • {new Date(material.created_at).toLocaleDateString()}
                                            </p>
                                        </div>
                                        {material.file_url && (
                                            <a href={material.file_url} target="_blank" rel="noopener noreferrer" className="text-primary">
                                                <span className="material-symbols-outlined">open_in_new</span>
                                            </a>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </main>

            {/* Add Flashcard Modal */}
            {showAddFlashcard && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-md">
                        <h3 className="text-xl font-bold text-slate-900 mb-4">Nueva Flashcard</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Pregunta</label>
                                <textarea
                                    value={newQuestion}
                                    onChange={(e) => setNewQuestion(e.target.value)}
                                    className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                    rows={3}
                                    placeholder="¿Cuál es la pregunta?"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Respuesta</label>
                                <textarea
                                    value={newAnswer}
                                    onChange={(e) => setNewAnswer(e.target.value)}
                                    className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                    rows={3}
                                    placeholder="La respuesta es..."
                                />
                            </div>
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setShowAddFlashcard(false)}
                                className="flex-1 py-3 bg-slate-100 text-slate-700 font-medium rounded-xl hover:bg-slate-200 transition"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleAddFlashcard}
                                disabled={!newQuestion.trim() || !newAnswer.trim()}
                                className="flex-1 py-3 bg-primary text-white font-medium rounded-xl hover:bg-blue-700 transition disabled:opacity-50"
                            >
                                Agregar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StudySetDetail;
