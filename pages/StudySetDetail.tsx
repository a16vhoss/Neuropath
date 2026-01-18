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
import { generateFlashcardsFromText, extractTextFromPDF, generateStudyGuideFromMaterials, generateMaterialSummary, generateStudySummary } from '../services/pdfProcessingService';

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
    summary?: string;
    content_text?: string;
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

    // Add material modals
    const [showTextModal, setShowTextModal] = useState(false);
    const [showUrlModal, setShowUrlModal] = useState(false);
    const [textContent, setTextContent] = useState('');
    const [urlInput, setUrlInput] = useState('');
    const [urlType, setUrlType] = useState<'youtube' | 'website'>('website');

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

    const [generatingGuide, setGeneratingGuide] = useState(false);

    const [viewContentModal, setViewContentModal] = useState<{
        isOpen: boolean;
        content: string;
        title: string;
        summary: string | null;
        activeTab: 'summary' | 'text';
        isGenerating: boolean;
    }>({
        isOpen: false,
        content: '',
        title: '',
        summary: null,
        activeTab: 'summary',
        isGenerating: false
    });

    const handleOpenMaterial = async (material: Material) => {
        setViewContentModal({
            isOpen: true,
            content: material.content_text || '',
            title: material.name,
            summary: null,
            activeTab: 'summary',
            isGenerating: true
        });

        // Generate summary if content exists
        if (material.content_text && material.content_text.length > 50) {
            try {
                const summary = await generateStudySummary(material.content_text, material.name);
                setViewContentModal(prev => ({
                    ...prev,
                    summary: summary,
                    isGenerating: false
                }));
            } catch (error) {
                console.error('Error generating summary:', error);
                setViewContentModal(prev => ({
                    ...prev,
                    summary: 'No se pudo generar el resumen. Intenta de nuevo más tarde.',
                    isGenerating: false
                }));
            }
        } else {
            setViewContentModal(prev => ({
                ...prev,
                summary: 'El contenido es demasiado corto para generar un resumen.',
                isGenerating: false
            }));
        }
    };

    const regenerateStudyGuide = async (newMaterialText?: string) => {
        if (!studySet) return;

        try {
            setGeneratingGuide(true);
            console.log('Regenerating study guide...');

            // Collect existing texts + new one
            // Lowered threshold to 10 chars to be safer
            const materials = studySet.materials.filter(m => m.content_text && m.content_text.length > 10).map(m => m.content_text!);
            if (newMaterialText) materials.push(newMaterialText);

            if (materials.length === 0) {
                console.log('No materials to generate guide from');
                alert('No se encontraron materiales con texto suficiente para generar la guía. Sube un PDF o agrega notas.');
                return;
            }

            const guide = await generateStudyGuideFromMaterials(materials, studySet.name, studySet.description);
            if (guide) {
                await updateStudySet(studySet.id, { description: guide });
                setStudySet(prev => prev ? { ...prev, description: guide } : null);
                setEditDescription(guide);
                console.log('Study guide updated');
            } else {
                alert('No se pudo generar la guía. Intenta de nuevo.');
            }
        } catch (error) {
            console.error('Error generating guide:', error);
            alert('Error al generar la guía. Revisa la consola para más detalles.');
        } finally {
            setGeneratingGuide(false);
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

    const addFlashcards = async (setId: string, cards: any[]) => {
        // Helper to add multiple flashcards
        for (const card of cards) {
            await addFlashcardToStudySet(setId, {
                question: card.question,
                answer: card.answer,
                category: card.category
            });
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
        if (!file || !studySet || !user) {
            console.log('Missing required data:', { file: !!file, studySet: !!studySet, user: !!user });
            return;
        }

        console.log('Starting file upload:', file.name);

        try {
            setUploading(true);
            setUploadProgress('Procesando PDF...');

            // Try to upload to storage (optional - may fail if bucket doesn't exist)
            let fileUrl = '';
            try {
                const fileName = `${user.id}/${studySet.id}/${Date.now()}_${file.name}`;
                const { error: uploadError } = await supabase.storage
                    .from('materials')
                    .upload(fileName, file);

                if (!uploadError) {
                    const { data: urlData } = supabase.storage.from('materials').getPublicUrl(fileName);
                    fileUrl = urlData.publicUrl;
                    console.log('File uploaded to storage:', fileUrl);
                } else {
                    console.log('Storage upload failed (optional):', uploadError.message);
                }
            } catch (storageError) {
                console.log('Storage not available, continuing without it');
            }

            setUploadProgress('Extrayendo texto del PDF...');
            console.log('Extracting text from PDF...');

            // Convert File to base64 for Gemini API
            const fileToBase64 = (file: File): Promise<string> => {
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.readAsDataURL(file);
                    reader.onload = () => {
                        const base64 = (reader.result as string).split(',')[1];
                        resolve(base64);
                    };
                    reader.onerror = reject;
                });
            };

            const pdfBase64 = await fileToBase64(file);
            console.log('PDF converted to base64, length:', pdfBase64.length);

            const extractedText = await extractTextFromPDF(pdfBase64);

            if (!extractedText || extractedText.length < 50) {
                throw new Error('No se pudo extraer suficiente texto del PDF. ¿Es un PDF con texto seleccionable?');
            }
            console.log('Extracted text length:', extractedText.length);

            setUploadProgress('Generando flashcards con IA...');
            console.log('Generating flashcards with AI...');
            const flashcards = await generateFlashcardsFromText(extractedText, studySet.name);

            setUploadProgress('Generando resumen del material...');
            const summary = await generateMaterialSummary(extractedText, 'pdf');

            if (!flashcards || flashcards.length === 0) {
                throw new Error('No se pudieron generar flashcards');
            }
            console.log('Generated flashcards:', flashcards.length);

            setUploadProgress(`Guardando ${flashcards.length} flashcards...`);

            // Generate unique IDs for flashcards and add study_set_id
            const newFlashcards = flashcards.map(fc => ({
                ...fc,
                id: crypto.randomUUID(),
                study_set_id: studySet.id
            }));

            // Duplicate upload logic removed


            // Save flashcards
            await addFlashcards(studySet.id, newFlashcards);

            // Track material
            try {
                await addMaterialToStudySet({
                    study_set_id: studySet.id,
                    name: file.name,
                    type: 'pdf',
                    file_url: fileUrl,
                    content_text: extractedText, // Save text for guide generation
                    flashcards_generated: flashcards.length,
                    summary: summary
                });

                // Regenerate guide with new text
                await regenerateStudyGuide(extractedText);

            } catch (matError: any) {
                console.error('Materials tracking skipped:', matError);
                alert(`Error al guardar material en base de datos: ${matError.message || JSON.stringify(matError)}`);
            }

            setUploadProgress('');
            // Reset file input
            e.target.value = '';
            loadStudySet();
            setActiveTab('materials'); // Switch to materials tab to show new upload
        } catch (error: any) {
            console.error('Error processing file:', error);
            setUploadProgress(`Error: ${error.message || 'Error al procesar archivo'}`);
            setTimeout(() => setUploadProgress(''), 5000);
        } finally {
            setUploading(false);
        }
    };

    const handleTextSubmit = async () => {
        if (!textContent.trim() || !studySet || !user) return;

        try {
            setUploading(true);
            setUploadProgress('Procesando texto...');
            setShowTextModal(false);

            const flashcards = await generateFlashcardsFromText(textContent, studySet.name);
            const summary = await generateMaterialSummary(textContent, 'text');

            if (flashcards && flashcards.length > 0) {
                const newFlashcards = flashcards.map(fc => ({
                    ...fc,
                    id: crypto.randomUUID(),
                    study_set_id: studySet.id
                }));
                await addFlashcards(studySet.id, newFlashcards);

                await addMaterialToStudySet({
                    study_set_id: studySet.id,
                    name: `Notas: ${textContent.slice(0, 20)}...`,
                    type: 'notes',
                    content_text: textContent,
                    flashcards_generated: newFlashcards.length,
                    summary: summary
                });

                // Regenerate guide with new text
                await regenerateStudyGuide(textContent);

                setTextContent('');
                loadStudySet();
                setActiveTab('materials');
            } else {
                throw new Error('No se pudieron generar flashcards del texto.');
            }
        } catch (error: any) {
            console.error('Error processing text:', error);
            alert('Error al procesar el texto: ' + error.message);
        } finally {
            setUploading(false);
            setUploadProgress('');
        }
    };

    const handleUrlSubmit = async () => {
        if (!urlInput.trim() || !studySet || !user) return;
        setUploading(true);
        setUploadProgress('Procesando enlace...');

        try {
            let finalType = urlType;
            let name = urlType === 'youtube' ? 'Video de YouTube' : 'Enlace Web';

            if (urlType === 'youtube') {
                // Simple check if it's a youtube link
                if (!urlInput.includes('youtube.com') && !urlInput.includes('youtu.be')) {
                    throw new Error('No parece ser un enlace de YouTube válido');
                }
                name = `YouTube: ${urlInput}`;
            } else {
                name = `Web: ${urlInput}`;
            }

            await addMaterialToStudySet({
                study_set_id: studySet.id,
                name: name,
                type: 'url',
                file_url: urlInput,
                flashcards_generated: 0
            });

            setUrlInput('');
            setUploadProgress('');
            loadStudySet();
        } catch (error: any) {
            console.error('Error processing URL:', error);
            setUploadProgress(`Error: ${error.message}`);
            setTimeout(() => setUploadProgress(''), 5000);
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
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                                <label className={`flex flex-col items-center gap-2 p-4 rounded-xl cursor-pointer transition border border-dashed border-emerald-200 ${uploading ? 'bg-slate-50' : 'bg-emerald-50 hover:bg-emerald-100'}`}>
                                    <span className="material-symbols-outlined text-3xl text-emerald-600">upload_file</span>
                                    <span className="font-medium text-sm text-emerald-700 text-center">
                                        {uploading ? uploadProgress : 'Subir PDF'}
                                    </span>
                                    <input type="file" accept=".pdf" onChange={handleFileUpload} className="hidden" disabled={uploading} />
                                </label>

                                <button
                                    onClick={() => setShowTextModal(true)}
                                    className="flex flex-col items-center gap-2 p-4 bg-orange-50 hover:bg-orange-100 rounded-xl transition border border-dashed border-orange-200"
                                >
                                    <span className="material-symbols-outlined text-3xl text-orange-600">description</span>
                                    <span className="font-medium text-sm text-orange-700 text-center">Pegar Texto</span>
                                </button>

                                <button
                                    onClick={() => { setUrlType('youtube'); setShowUrlModal(true); }}
                                    className="flex flex-col items-center gap-2 p-4 bg-red-50 hover:bg-red-100 rounded-xl transition border border-dashed border-red-200"
                                >
                                    <span className="material-symbols-outlined text-3xl text-red-600">play_circle</span>
                                    <span className="font-medium text-sm text-red-700 text-center">YouTube</span>
                                </button>

                                <button
                                    onClick={() => { setUrlType('website'); setShowUrlModal(true); }}
                                    className="flex flex-col items-center gap-2 p-4 bg-blue-50 hover:bg-blue-100 rounded-xl transition border border-dashed border-blue-200"
                                >
                                    <span className="material-symbols-outlined text-3xl text-blue-600">link</span>
                                    <span className="font-medium text-sm text-blue-700 text-center">Enlace</span>
                                </button>
                            </div>

                            <button
                                onClick={() => { setActiveTab('flashcards'); setShowAddFlashcard(true); }}
                                className="w-full mt-4 flex items-center justify-center gap-2 p-3 text-slate-600 hover:bg-slate-50 rounded-xl transition text-sm font-medium border border-slate-200"
                            >
                                <span className="material-symbols-outlined text-lg">add_circle</span>
                                Agregar flashcard manual
                            </button>
                        </div>

                        {/* Study Guide (formerly Description) */}
                        <div className="md:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                            <div className="flex justify-between items-center mb-2">
                                <h3 className="font-bold text-slate-900 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-indigo-500">auto_stories</span>
                                    Guía de Estudio
                                    <span className="text-xs font-normal text-indigo-500 bg-indigo-50 px-2 py-1 rounded-full border border-indigo-100">
                                        Auto-generada con IA
                                    </span>
                                </h3>
                                <button
                                    onClick={() => regenerateStudyGuide()}
                                    disabled={generatingGuide}
                                    className={`text-xs px-3 py-1.5 rounded-lg transition flex items-center gap-1 font-medium ${generatingGuide
                                        ? 'bg-indigo-50 text-indigo-400 cursor-not-allowed'
                                        : 'text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50'
                                        }`}
                                    title="Regenerar buscando nuevo contenido en todos los materiales"
                                >
                                    <span className={`material-symbols-outlined text-sm ${generatingGuide ? 'animate-spin' : ''}`}>
                                        {generatingGuide ? 'sync' : 'refresh'}
                                    </span>
                                    {generatingGuide ? 'Generando...' : 'Regenerar Guía'}
                                </button>
                            </div>

                            {isEditingName ? (
                                <textarea
                                    value={editDescription}
                                    onChange={(e) => setEditDescription(e.target.value)}
                                    className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-slate-700 min-h-[200px]"
                                    placeholder="La guía de estudio aparecerá aquí automáticamente..."
                                />
                            ) : (
                                <div className="prose prose-slate max-w-none">
                                    {studySet.description ? (
                                        <div className="whitespace-pre-wrap text-slate-600 bg-slate-50 p-6 rounded-xl border border-slate-100">
                                            {studySet.description}
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center py-12 px-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center">
                                            <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">magic_button</span>
                                            <p className="text-slate-500 font-medium">No hay guía de estudio aún</p>
                                            <p className="text-sm text-slate-400 mt-1 max-w-md">
                                                Sube materiales (PDF, Notas, Enlaces) y usa el botón "Regenerar" para crear una guía de estudio automática.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}
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
                                    <div key={material.id} className="group relative flex items-start gap-4 p-4 rounded-xl border border-slate-100 hover:border-slate-200 hover:shadow-sm transition bg-white">
                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${material.type === 'pdf' ? 'bg-rose-50 text-rose-500' :
                                            material.type === 'url' ? 'bg-blue-50 text-blue-500' :
                                                'bg-orange-50 text-orange-500'
                                            }`}>
                                            <span className="material-symbols-outlined">
                                                {material.type === 'pdf' ? 'picture_as_pdf' :
                                                    material.type === 'url' ? 'link' : 'description'}
                                            </span>
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <h4 className="font-medium text-slate-900 truncate pr-4">{material.name}</h4>
                                                    <p className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                                                        <span>{material.flashcards_generated || 0} flashcards generadas</span>
                                                        <span>•</span>
                                                        <span>{new Date(material.created_at || Date.now()).toLocaleDateString()}</span>
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Material Summary Section */}
                                            {material.summary && (
                                                <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
                                                    <div className="flex items-center gap-1.5 mb-1.5">
                                                        <span className="material-symbols-outlined text-xs text-indigo-500">auto_awesome</span>
                                                        <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Micro-Resumen</span>
                                                    </div>
                                                    <div className="text-sm text-slate-600 leading-relaxed text-left markdown-summary">
                                                        {/* Simple split for bullet points if they exist, or just text */}
                                                        {material.summary.split('\n').map((line, i) => (
                                                            <p key={i} className="mb-0.5">{line}</p>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            <div className="flex items-center gap-3 mt-3">
                                                {material.file_url && (
                                                    <a
                                                        href={material.file_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition"
                                                    >
                                                        <span className="material-symbols-outlined text-sm">visibility</span>
                                                        {material.type === 'url' ? 'Abrir Enlace' : 'Ver PDF'}
                                                    </a>
                                                )}
                                                <button
                                                    className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 bg-white border border-slate-200 hover:border-slate-300 px-3 py-1.5 rounded-lg transition"
                                                    onClick={() => handleOpenMaterial(material)}
                                                >
                                                    <span className="material-symbols-outlined text-sm">auto_awesome</span>
                                                    Estudiar Material
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </main>

            {/* Add Flashcard Modal */}
            {
                showAddFlashcard && (
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
                )
            }

            {/* Paste Text Modal */}
            {
                showTextModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-2xl p-6 w-full max-w-lg">
                            <h3 className="text-xl font-bold text-slate-900 mb-4">Pegar Texto de Estudio</h3>
                            <p className="text-sm text-slate-500 mb-4">
                                Pega aquí tus apuntes o resumen. La IA generará flashcards automáticamente.
                            </p>
                            <textarea
                                value={textContent}
                                onChange={(e) => setTextContent(e.target.value)}
                                className="w-full p-4 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary min-h-[200px]"
                                placeholder="Pega tu texto aquí..."
                            />
                            <div className="flex gap-3 mt-6">
                                <button
                                    onClick={() => setShowTextModal(false)}
                                    className="flex-1 py-3 bg-slate-100 text-slate-700 font-medium rounded-xl hover:bg-slate-200 transition"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleTextSubmit}
                                    disabled={!textContent.trim() || uploading}
                                    className="flex-1 py-3 bg-orange-500 text-white font-medium rounded-xl hover:bg-orange-600 transition disabled:opacity-50 flex justify-center items-center gap-2"
                                >
                                    {uploading ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                            Procesando...
                                        </>
                                    ) : (
                                        <>
                                            <span className="material-symbols-outlined">auto_awesome</span>
                                            Generar Flashcards
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* URL/Video Modal */}
            {
                showUrlModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-2xl p-6 w-full max-w-md">
                            <h3 className="text-xl font-bold text-slate-900 mb-4">
                                {urlType === 'youtube' ? 'Agregar Video de YouTube' : 'Agregar Enlace Web'}
                            </h3>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-slate-700 mb-1">URL del {urlType === 'youtube' ? 'Video' : 'Sitio Web'}</label>
                                <input
                                    type="text"
                                    value={urlInput}
                                    onChange={(e) => setUrlInput(e.target.value)}
                                    className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                    placeholder={urlType === 'youtube' ? 'https://youtube.com/watch?v=...' : 'https://example.com/article'}
                                />
                                {urlType === 'youtube' && (
                                    <p className="text-xs text-slate-500 mt-2">
                                        Se guardará como referencia. Próximamente: Generación automática desde videos.
                                    </p>
                                )}
                            </div>
                            <div className="flex gap-3 mt-6">
                                <button
                                    onClick={() => setShowUrlModal(false)}
                                    className="flex-1 py-3 bg-slate-100 text-slate-700 font-medium rounded-xl hover:bg-slate-200 transition"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleUrlSubmit}
                                    disabled={!urlInput.trim() || uploading}
                                    className="flex-1 py-3 bg-primary text-white font-medium rounded-xl hover:bg-blue-700 transition disabled:opacity-50"
                                >
                                    {uploading ? 'Agregando...' : 'Agregar'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

            {/* View Content Modal */}
            {viewContentModal.isOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-2xl max-h-[80vh] flex flex-col">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold text-slate-900 truncate pr-4">
                                {viewContentModal.title}
                            </h3>
                            <button
                                onClick={() => setViewContentModal(prev => ({ ...prev, isOpen: false }))}
                                className="text-slate-400 hover:text-slate-600 transition"
                            >
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        {/* Tabs */}
                        <div className="flex gap-2 mb-4 border-b border-slate-100">
                            <button
                                onClick={() => setViewContentModal(prev => ({ ...prev, activeTab: 'summary' }))}
                                className={`pb-2 px-4 font-medium text-sm transition ${viewContentModal.activeTab === 'summary' ? 'text-primary border-b-2 border-primary' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                Resumen IA
                            </button>
                            <button
                                onClick={() => setViewContentModal(prev => ({ ...prev, activeTab: 'text' }))}
                                className={`pb-2 px-4 font-medium text-sm transition ${viewContentModal.activeTab === 'text' ? 'text-primary border-b-2 border-primary' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                Texto Original
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 bg-slate-50 rounded-xl border border-slate-100">
                            {viewContentModal.activeTab === 'summary' ? (
                                viewContentModal.isGenerating ? (
                                    <div className="flex flex-col items-center justify-center py-10">
                                        <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mb-3"></div>
                                        <p className="text-sm text-slate-500">Analizando documento con IA...</p>
                                    </div>
                                ) : (
                                    <div className="whitespace-pre-wrap font-sans text-sm text-slate-700 leading-relaxed">
                                        {viewContentModal.summary || 'No hay resumen disponible.'}
                                    </div>
                                )
                            ) : (
                                <div className="font-mono text-xs text-slate-600 whitespace-pre-wrap">
                                    {viewContentModal.content}
                                </div>
                            )}
                        </div>

                        <div className="mt-6 flex justify-end">
                            <button
                                onClick={() => setViewContentModal(prev => ({ ...prev, isOpen: false }))}
                                className="px-6 py-2.5 bg-slate-100 text-slate-700 font-medium rounded-xl hover:bg-slate-200 transition"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StudySetDetail;
