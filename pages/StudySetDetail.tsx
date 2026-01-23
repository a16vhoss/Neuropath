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
    deleteMaterialFromStudySet,
    addFlashcardsBatch,
    supabase,
    createMaterialWithFlashcards,
    getClassEnrollments,
    toggleStudySetEditor
} from '../services/supabaseClient';
import { generateFlashcardsFromText, extractTextFromPDF, generateStudyGuideFromMaterials, generateMaterialSummary, generateStudySummary, generateInfographicFromMaterials, generatePresentationFromMaterials } from '../services/pdfProcessingService';
import { generateFlashcardsFromYouTubeURL, generateFlashcardsFromWebURL, autoCategorizeFlashcards } from '../services/geminiService';
import CumulativeReportsCard from '../components/CumulativeReportsCard';
import VisualProgressionMap from '../components/VisualProgressionMap';
import StudyGuideRenderer from '../components/StudyGuideRenderer';

interface Flashcard {
    id: string;
    question: string;
    answer: string;
    category?: string;
}

interface FlashcardProgress {
    flashcard_id: string;
    difficulty_level: number;
    mastery_percent: number;
    correct_at_level: number;
    attempts_at_level: number;
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
    class_id?: string;
    student_id: string; // Owner ID
    editors?: string[];
    teacher_id?: string;
    infographic?: string;
    presentation?: string;
}

interface RankingMember {
    student_id: string;
    full_name: string;
    avatar_url?: string;
    flashcards_mastered: number;
    avg_mastery: number; // New field
    total_flashcards: number;
    quiz_average: number;
    quizzes_taken: number;
    last_active: string;
    ranking_score: number;
}

type TabType = 'overview' | 'flashcards' | 'materials' | 'reports' | 'people';

interface StudySetDetailProps {
    studySetId?: string;
    embedded?: boolean;
    readOnly?: boolean;
}


const EmptyAIBox: React.FC<{
    icon: string;
    title: string;
    desc: string;
    onAction: () => void;
    loading: boolean;
    actionText: string;
    color?: 'indigo' | 'amber' | 'cyan';
}> = ({ icon, title, desc, onAction, loading, actionText, color = 'indigo' }) => {
    const colorClasses = {
        indigo: 'text-indigo-500 bg-indigo-50 border-indigo-100 hover:bg-indigo-100',
        amber: 'text-amber-500 bg-amber-50 border-amber-100 hover:bg-amber-100',
        cyan: 'text-cyan-500 bg-cyan-50 border-cyan-100 hover:bg-cyan-100'
    };

    return (
        <div className="flex flex-col items-center justify-center py-12 px-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center">
            <span className={`material-symbols-outlined text-4xl mb-2 ${color === 'amber' ? 'text-amber-300' : color === 'cyan' ? 'text-cyan-300' : 'text-slate-300'}`}>{icon}</span>
            <p className="text-slate-500 font-medium">{title}</p>
            <p className="text-sm text-slate-400 mt-1 max-w-md mb-6">{desc}</p>
            <button
                onClick={onAction}
                disabled={loading}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition shadow-sm ${colorClasses[color]}`}
            >
                <span className={`material-symbols-outlined text-lg ${loading ? 'animate-spin' : ''}`}>
                    {loading ? 'sync' : 'magic_button'}
                </span>
                {loading ? 'Generando...' : actionText}
            </button>
        </div>
    );
};

const StudySetDetail: React.FC<StudySetDetailProps> = ({ studySetId: propId, embedded = false, readOnly = false }) => {
    const { studySetId: paramId } = useParams();
    const studySetId = propId || paramId;

    const navigate = useNavigate();
    const { user } = useAuth();

    // Derived permissions
    // Note: studySet isn't loaded yet on first render, so we check inside render or after load
    // But we need derived state. We'll compute it during render.


    const [studySet, setStudySet] = useState<StudySetFull | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<TabType>('overview');
    const [refreshReports, setRefreshReports] = useState(0);
    const [flashcardProgress, setFlashcardProgress] = useState<Map<string, FlashcardProgress>>(new Map());
    const [viewingStatsFlashcard, setViewingStatsFlashcard] = useState<Flashcard | null>(null);

    // Edit states
    const [isEditingName, setIsEditingName] = useState(false);
    const [editName, setEditName] = useState('');
    const [editDescription, setEditDescription] = useState('');

    // Add flashcard modal
    const [showAddFlashcard, setShowAddFlashcard] = useState(false);
    const [editingFlashcard, setEditingFlashcard] = useState<Flashcard | null>(null);
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
    const [targetFlashcardCount, setTargetFlashcardCount] = useState(10);

    // Track expanded summaries
    const [expandedSummaries, setExpandedSummaries] = useState<Set<string>>(new Set());

    // People tab state
    const [classMembers, setClassMembers] = useState<any[]>([]);
    const [loadingMembers, setLoadingMembers] = useState(false);

    // Ranking state
    const [rankingData, setRankingData] = useState<RankingMember[]>([]);
    const [loadingRanking, setLoadingRanking] = useState(false);

    useEffect(() => {
        if (activeTab === 'people') {
            // If class-based, we might fetch members, but we prefer ranking now
            if (studySet?.class_id) fetchClassMembers();
            fetchRanking();
        }
    }, [activeTab, studySet]);

    const fetchRanking = async () => {
        if (!studySetId) return;
        setLoadingRanking(true);
        try {
            const { data, error } = await supabase.rpc('get_study_set_ranking', {
                p_study_set_id: studySetId
            });
            if (error) throw error;
            setRankingData(data || []);
        } catch (error) {
            console.error('Error fetching ranking:', error);
        } finally {
            setLoadingRanking(false);
        }
    };

    const fetchClassMembers = async () => {
        if (!studySet?.class_id) return;
        setLoadingMembers(true);
        try {
            const enrollments = await getClassEnrollments(studySet.class_id);
            setClassMembers(enrollments || []);
        } catch (error) {
            console.error("Error loading class members", error);
        } finally {
            setLoadingMembers(false);
        }
    };

    const handleToggleEditor = async (memberId: string, memberName: string) => {
        if (!studySet) return;
        const isEditor = studySet.editors?.includes(memberId);
        const action = isEditor ? 'revocar permisos de edición' : 'dar permisos de edición';

        if (!window.confirm(`¿Estás seguro de ${action} a ${memberName}?`)) return;

        try {
            await toggleStudySetEditor(studySet.id, memberId);
            // Optimistic update
            const newEditors = isEditor
                ? (studySet.editors || []).filter(id => id !== memberId)
                : [...(studySet.editors || []), memberId];

            setStudySet({ ...studySet, editors: newEditors });
            alert(isEditor ? 'Permisos revocados' : 'Permisos asignados correctamente');
        } catch (error) {
            console.error('Error toggling editor:', error);
            alert('Error al actualizar permisos');
        }
    };

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

            // Fetch flashcard progress for mastery display
            if (user && data.flashcards.length > 0) {
                const flashcardIds = data.flashcards.map((f: Flashcard) => f.id);
                const { data: progress, error } = await supabase
                    .from('flashcard_progress')
                    .select('flashcard_id, difficulty_level, mastery_percent, correct_at_level, attempts_at_level')
                    .eq('student_id', user.id)
                    .in('flashcard_id', flashcardIds);

                if (!error && progress) {
                    const progressMap = new Map<string, FlashcardProgress>();
                    progress.forEach((p: any) => progressMap.set(p.flashcard_id, p));
                    setFlashcardProgress(progressMap);
                }
            }
        } catch (error) {
            console.error('Error loading study set:', error);
        } finally {
            setLoading(false);
        }
    };

    const [generatingGuide, setGeneratingGuide] = useState(false);
    const [generatingInfographic, setGeneratingInfographic] = useState(false);
    const [generatingPresentation, setGeneratingPresentation] = useState(false);
    const [activeGuideTab, setActiveGuideTab] = useState<'guide' | 'infographic' | 'presentation'>('guide');

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

    const handleUpdateFlashcard = async () => {
        if (!editingFlashcard || !editingFlashcard.question || !editingFlashcard.answer) return;

        try {
            await updateFlashcard(editingFlashcard.id, {
                question: editingFlashcard.question,
                answer: editingFlashcard.answer,
                category: editingFlashcard.category
            });
            // Update local state
            setStudySet(prev => prev ? {
                ...prev,
                flashcards: prev.flashcards.map(fc => fc.id === editingFlashcard.id ? editingFlashcard : fc)
            } : null);
            setEditingFlashcard(null);
            setRefreshReports(prev => prev + 1);
        } catch (error) {
            console.error('Error updating flashcard:', error);
        }
    };

    const handleAutoCategorize = async () => {
        if (!studySet || studySet.flashcards.length === 0) return;
        setUploading(true); // Reuse uploading spinner state

        try {
            const categorized = await autoCategorizeFlashcards(studySet.flashcards);

            // Batch update is best, but for now we loop or use a supabase RPC if available.
            // Let's loop for simplicity as the set size is usually small (<100) or use the upsert if we had it exposed.
            // We will update one by one for safety or use a Promise.all

            await Promise.all(categorized.map(c =>
                updateFlashcard(c.id, { category: c.category })
            ));

            // Refresh data
            loadStudySet();
            setRefreshReports(prev => prev + 1);
        } catch (error) {
            console.error('Error auto-categorizing:', error);
            alert('Error al categorizar automáticamente.');
        } finally {
            setUploading(false);
        }
    };

    const handleAutoFlashcards = async () => {
        if (!studySet || studySet.materials.length === 0) {
            alert('Sube materiales primero para poder generar flashcards automáticamente.');
            return;
        }

        setUploading(true);
        setUploadProgress('Analizando materiales y generando flashcards...');

        try {
            // Aggregate all content_text from materials
            const allContent = studySet.materials
                .filter(m => m.content_text)
                .map(m => m.content_text)
                .join('\n\n---\n\n');

            if (!allContent || allContent.trim().length < 100) {
                alert('No hay suficiente texto extraído para generar flashcards. Prueba subiendo más materiales.');
                return;
            }

            console.log(`Generating auto-flashcards from ${allContent.length} characters...`);

            const newFlashcards = await generateFlashcardsFromText(
                allContent,
                studySet.name,
                targetFlashcardCount
            );

            if (newFlashcards && newFlashcards.length > 0) {
                await addFlashcardsBatch(newFlashcards.map(fc => ({
                    ...fc,
                    study_set_id: studySet.id
                })));
                loadStudySet();
                setRefreshReports(prev => prev + 1);
            } else {
                alert('La IA no pudo generar flashcards. Intenta con materiales más claros.');
            }
        } catch (error) {
            console.error('Error in Auto-Flashcards:', error);
            alert('Error al generar flashcards automáticamente.');
        } finally {
            setUploading(false);
            setUploadProgress(null);
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
            const flashcards = await generateFlashcardsFromText(extractedText, studySet.name, targetFlashcardCount);

            setUploadProgress('Generando resumen del material...');
            const summary = await generateMaterialSummary(extractedText, 'pdf');

            if (!flashcards || flashcards.length === 0) {
                throw new Error('No se pudieron generar flashcards');
            }
            console.log('Generated flashcards:', flashcards.length);

            setUploadProgress('Guardando material...');

            setUploadProgress('Guardando material y flashcards...');

            // Use RPC to create material and flashcards transactionally
            try {
                // Ensure flashcards don't have IDs yet, but include question/answer/category
                const flashcardsPayload = flashcards.map(fc => ({
                    question: fc.question,
                    answer: fc.answer,
                    category: fc.category || 'General'
                }));

                await createMaterialWithFlashcards({
                    study_set_id: studySet.id,
                    name: file.name,
                    type: 'pdf',
                    file_url: fileUrl,
                    content_text: extractedText,
                    summary: summary,
                    flashcards: flashcardsPayload
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

            const flashcards = await generateFlashcardsFromText(textContent, studySet.name, targetFlashcardCount);
            const summary = await generateMaterialSummary(textContent, 'text');

            if (flashcards && flashcards.length > 0) {
                setUploadProgress('Guardando notas...');

                setUploadProgress('Guardando notas y flashcards...');

                const flashcardsPayload = flashcards.map(fc => ({
                    question: fc.question,
                    answer: fc.answer,
                    category: fc.category || 'General'
                }));

                await createMaterialWithFlashcards({
                    study_set_id: studySet.id,
                    name: `Notas: ${textContent.slice(0, 20)}...`,
                    type: 'notes',
                    content_text: textContent,
                    summary: summary,
                    flashcards: flashcardsPayload
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
        setShowUrlModal(false);

        try {
            if (urlType === 'youtube') {
                // Validate YouTube URL
                if (!urlInput.includes('youtube.com') && !urlInput.includes('youtu.be')) {
                    throw new Error('No parece ser un enlace de YouTube válido');
                }

                setUploadProgress('Analizando video con Gemini IA...');

                // Use Gemini to analyze YouTube video and generate flashcards + summary
                const youtubeResult = await generateFlashcardsFromYouTubeURL(urlInput, targetFlashcardCount);

                setUploadProgress('Guardando material...');

                setUploadProgress('Guardando material y flashcards...');

                const flashcardsPayload = youtubeResult.flashcards.map(fc => ({
                    question: fc.question,
                    answer: fc.answer,
                    category: fc.category || 'General'
                }));

                await createMaterialWithFlashcards({
                    study_set_id: studySet.id,
                    name: youtubeResult.videoTitle || 'Video de YouTube',
                    type: 'url',
                    file_url: youtubeResult.videoUrl,
                    content_text: `Canal: ${youtubeResult.channelName}\n\n${youtubeResult.summary}`,
                    summary: youtubeResult.summary,
                    flashcards: flashcardsPayload
                });

            } else {
                // Website link - analyze with Gemini and generate flashcards
                setUploadProgress('Analizando página web con IA...');

                const webResult = await generateFlashcardsFromWebURL(urlInput, targetFlashcardCount);

                setUploadProgress('Guardando material...');

                setUploadProgress('Guardando material y flashcards...');

                const flashcardsPayload = webResult.flashcards.map(fc => ({
                    question: fc.question,
                    answer: fc.answer,
                    category: fc.category || 'General'
                }));

                await createMaterialWithFlashcards({
                    study_set_id: studySet.id,
                    name: webResult.pageTitle || 'Enlace Web',
                    type: 'url',
                    file_url: webResult.sourceUrl,
                    content_text: webResult.summary,
                    summary: webResult.summary,
                    flashcards: flashcardsPayload
                });
            }

            setUrlInput('');
            setUploadProgress('');
            loadStudySet();
            setActiveTab('materials'); // Show materials tab to see result
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

    // Toggle summary expanded/collapsed
    const toggleSummary = (materialId: string) => {
        setExpandedSummaries(prev => {
            const newSet = new Set(prev);
            if (newSet.has(materialId)) {
                newSet.delete(materialId);
            } else {
                newSet.add(materialId);
            }
            return newSet;
        });
    };

    // Delete material and its associated flashcards
    const handleDeleteMaterial = async (material: Material) => {
        if (!window.confirm(`¿Eliminar "${material.name}"? También se eliminarán las ${material.flashcards_generated || 0} flashcards asociadas.`)) return;

        try {
            // First, delete associated flashcards if material has a content source
            // The flashcards table may have a material_id or we can identify by study_set_id and timeframe
            // For now, just delete the material - DB cascade should handle flashcards if configured
            await deleteMaterialFromStudySet(material.id);

            // Reload the study set to refresh data
            loadStudySet();
        } catch (error) {
            console.error('Error deleting material:', error);
            alert('Error al eliminar el material');
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

    const isOwner = studySet && user ? (studySet.student_id === user.id || studySet.teacher_id === user.id) : false;
    const isEditor = studySet && user ? ((studySet.editors || []).includes(user.id) || isOwner) : false;
    const canEdit = !readOnly && isEditor;

    // Debug permissions
    console.log("StudySet Permissions:", {
        setName: studySet.name,
        userId: user?.id,
        ownerId: studySet.student_id,
        teacherId: studySet.teacher_id,
        isOwner,
        canEdit
    });

    return (
        <div className={embedded ? "" : "min-h-screen bg-slate-50"}>
            {/* Header */}
            <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
                <div className="max-w-5xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            {!embedded && (
                                <button
                                    onClick={() => navigate('/student')}
                                    className="p-2 hover:bg-slate-100 rounded-lg transition"
                                >
                                    <span className="material-symbols-outlined">arrow_back</span>
                                </button>
                            )}

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
                                    {canEdit && (
                                        <button
                                            onClick={() => setIsEditingName(true)}
                                            className="p-1 hover:bg-slate-100 rounded-lg text-slate-400"
                                        >
                                            <span className="material-symbols-outlined text-sm">edit</span>
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => navigate(`/student/study-set/${studySet.id}?mode=flashcards`)}
                                className="bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-bold px-6 py-2 rounded-xl hover:opacity-90 transition flex items-center gap-2"
                            >
                                <span className="material-symbols-outlined">auto_awesome</span>
                                Estudiar (Adaptativo)
                            </button>
                            <button
                                onClick={() => navigate(`/student/study-set/${studySet.id}?mode=exam`)}
                                className="bg-white text-slate-700 border border-slate-200 font-bold px-6 py-2 rounded-xl hover:bg-slate-50 transition flex items-center gap-2"
                            >
                                <span className="material-symbols-outlined">timer</span>
                                Simulacro
                            </button>
                            {!readOnly && isOwner && (
                                <button
                                    onClick={handleDeleteSet}
                                    className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition"
                                    title="Eliminar set"
                                >
                                    <span className="material-symbols-outlined">delete</span>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-6 mt-4 border-t border-slate-100 pt-4">
                        {(['overview', 'flashcards', 'materials', 'reports', 'people'] as TabType[]).map((tab) => (
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
                                {tab === 'reports' && 'Reportes'}
                                {tab === 'people' && 'Personas'}
                            </button>
                        ))}
                    </div>
                </div>
            </header>

            {/* Content */}
            <main className="max-w-5xl mx-auto px-2 md:px-4 py-4 md:py-6">
                {/* People Tab (Ranking) */}
                {activeTab === 'people' && (
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h3 className="font-bold text-slate-900 text-lg">Ranking del Set 🏆</h3>
                                <p className="text-slate-500 text-sm">Competencia basada en aprendizaje de flashcards (60%) y quizzes (40%).</p>
                            </div>
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(window.location.href);
                                    alert("Enlace copiado al portapapeles");
                                }}
                                className="bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-4 py-2 rounded-lg font-bold transition flex items-center gap-2"
                            >
                                <span className="material-symbols-outlined">share</span>
                                Compartir
                            </button>
                        </div>

                        {loadingRanking ? (
                            <div className="py-12 text-center text-slate-400">
                                <span className="material-symbols-outlined animate-spin text-2xl mb-2">sync</span>
                                <p>Cargando ranking...</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-slate-100 text-slate-500 text-sm">
                                            <th className="py-3 px-4 font-medium w-16">#</th>
                                            <th className="py-3 px-4 font-medium">Estudiante</th>
                                            <th className="py-3 px-4 font-medium">Dominio General (Avg)</th>
                                            <th className="py-3 px-4 font-medium">Quiz Promedio</th>
                                            <th className="py-3 px-4 font-medium text-right">Puntaje</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {rankingData.map((member, index) => {
                                            const rank = index + 1;
                                            const isTop3 = rank <= 3;

                                            let rankIcon = <span className="text-slate-500 font-bold text-lg">{rank}</span>;
                                            if (rank === 1) rankIcon = <span className="text-3xl">🥇</span>;
                                            if (rank === 2) rankIcon = <span className="text-3xl">🥈</span>;
                                            if (rank === 3) rankIcon = <span className="text-3xl">🥉</span>;

                                            const masteryPercent = Math.round(member.avg_mastery || 0);

                                            return (
                                                <tr key={member.student_id} className={`hover:bg-slate-50 transition ${member.student_id === user?.id ? 'bg-indigo-50/50' : ''}`}>
                                                    <td className="py-4 px-4 align-middle">
                                                        <div className="flex justify-center w-8">
                                                            {rankIcon}
                                                        </div>
                                                    </td>
                                                    <td className="py-4 px-4 align-middle">
                                                        <div className="flex items-center gap-3">
                                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center overflow-hidden border-2 ${isTop3 ? 'border-amber-400' : 'border-slate-200'}`}>
                                                                {member.avatar_url ? (
                                                                    <img src={member.avatar_url} alt="" className="w-full h-full object-cover" />
                                                                ) : (
                                                                    <span className="material-symbols-outlined text-slate-400">person</span>
                                                                )}
                                                            </div>
                                                            <div>
                                                                <p className="font-bold text-slate-900 text-sm">{member.full_name}</p>
                                                                {member.student_id === user?.id && (
                                                                    <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-bold">TÚ</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="py-4 px-4 align-middle">
                                                        <div className="w-full max-w-[140px]">
                                                            <div className="flex justify-between text-xs mb-1">
                                                                <span className="font-medium text-slate-700">{masteryPercent}% Dominio</span>
                                                                {member.flashcards_mastered > 0 && (
                                                                    <span className="text-emerald-600 font-bold" title="Cartas dominadas">{member.flashcards_mastered} Master</span>
                                                                )}
                                                            </div>
                                                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                                                <div
                                                                    className="h-full bg-emerald-500 rounded-full transition-all duration-1000"
                                                                    style={{ width: `${masteryPercent}%` }}
                                                                ></div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="py-4 px-4 align-middle">
                                                        {member.quizzes_taken > 0 ? (
                                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${member.quiz_average >= 90 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                                                member.quiz_average >= 70 ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                                                    'bg-amber-50 text-amber-700 border-amber-200'
                                                                }`}>
                                                                {Math.round(member.quiz_average)}%
                                                                <span className="ml-1 text-[10px] opacity-70">({member.quizzes_taken})</span>
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-400 text-xs">-</span>
                                                        )}
                                                    </td>
                                                    <td className="py-4 px-4 align-middle text-right">
                                                        <span className="font-mono font-bold text-slate-900">{Math.round(member.ranking_score)}</span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {rankingData.length === 0 && (
                                            <tr>
                                                <td colSpan={5} className="py-12 text-center text-slate-500">
                                                    No hay datos de actividad aún. ¡Sé el primero en estudiar!
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

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

                        {/* Quick Actions - Only for editors */}
                        {canEdit && (
                            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                                <h3 className="font-bold text-slate-900 mb-4 flex items-center justify-between">
                                    <span>⚡ Acciones Rápidas</span>
                                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
                                        <span className="text-[10px] font-bold text-slate-500 uppercase">Flashcards:</span>
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => setTargetFlashcardCount(Math.max(5, targetFlashcardCount - 5))}
                                                className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-white text-slate-600 transition"
                                            >
                                                <span className="material-symbols-outlined text-xs">remove</span>
                                            </button>
                                            <span className="text-sm font-bold text-indigo-600 w-5 text-center">{targetFlashcardCount}</span>
                                            <button
                                                onClick={() => setTargetFlashcardCount(Math.min(50, targetFlashcardCount + 5))}
                                                className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-white text-slate-600 transition"
                                            >
                                                <span className="material-symbols-outlined text-xs">add</span>
                                            </button>
                                        </div>
                                    </div>
                                </h3>
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
                        )}


                        {/* AI Content Section (NotebookLM Style) */}
                        <div className="md:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                            {/* Tabs Header */}
                            <div className="flex border-b border-slate-100 bg-slate-50/50">
                                <button
                                    onClick={() => setActiveGuideTab('guide')}
                                    className={`flex-1 px-4 py-3 flex items-center justify-center gap-2 text-sm font-semibold transition-all border-b-2 ${activeGuideTab === 'guide' ? 'text-indigo-600 border-indigo-600 bg-white' : 'text-slate-500 border-transparent hover:bg-slate-50'}`}
                                >
                                    <span className="material-symbols-outlined text-lg">auto_stories</span>
                                    Guía
                                </button>
                                <button
                                    onClick={() => setActiveGuideTab('infographic')}
                                    className={`flex-1 px-4 py-3 flex items-center justify-center gap-2 text-sm font-semibold transition-all border-b-2 ${activeGuideTab === 'infographic' ? 'text-amber-600 border-amber-600 bg-white' : 'text-slate-500 border-transparent hover:bg-slate-50'}`}
                                >
                                    <span className="material-symbols-outlined text-lg">leaderboard</span>
                                    Infografía
                                </button>
                                <button
                                    onClick={() => setActiveGuideTab('presentation')}
                                    className={`flex-1 px-4 py-3 flex items-center justify-center gap-2 text-sm font-semibold transition-all border-b-2 ${activeGuideTab === 'presentation' ? 'text-cyan-600 border-cyan-600 bg-white' : 'text-slate-500 border-transparent hover:bg-slate-50'}`}
                                >
                                    <span className="material-symbols-outlined text-lg">slideshow</span>
                                    Presentación
                                </button>
                            </div>

                            <div className="p-6">
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="font-bold text-slate-900 flex items-center gap-2">
                                        <span className={`material-symbols-outlined ${activeGuideTab === 'guide' ? 'text-indigo-500' : activeGuideTab === 'infographic' ? 'text-amber-500' : 'text-cyan-500'}`}>
                                            {activeGuideTab === 'guide' ? 'auto_stories' : activeGuideTab === 'infographic' ? 'leaderboard' : 'slideshow'}
                                        </span>
                                        {activeGuideTab === 'guide' ? 'Guía de Estudio' : activeGuideTab === 'infographic' ? 'Infografía del Tema' : 'Estructura de Presentación'}
                                        <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full border ${activeGuideTab === 'guide' ? 'bg-indigo-50 text-indigo-500 border-indigo-100' : activeGuideTab === 'infographic' ? 'bg-amber-50 text-amber-500 border-amber-100' : 'bg-cyan-50 text-cyan-500 border-cyan-100'}`}>
                                            IA
                                        </span>
                                    </h3>

                                    <div className="flex items-center gap-2">
                                        {canEdit && activeGuideTab === 'guide' && (
                                            <button
                                                onClick={() => regenerateStudyGuide()}
                                                disabled={generatingGuide}
                                                className={`text-xs px-3 py-1.5 rounded-lg transition flex items-center gap-1 font-medium ${generatingGuide ? 'bg-indigo-50 text-indigo-400' : 'text-indigo-600 hover:bg-indigo-50'}`}
                                            >
                                                <span className={`material-symbols-outlined text-sm ${generatingGuide ? 'animate-spin' : ''}`}>refresh</span>
                                                {generatingGuide ? 'Generando...' : 'Regenerar'}
                                            </button>
                                        )}
                                        {canEdit && activeGuideTab === 'infographic' && (
                                            <button
                                                onClick={async () => {
                                                    console.log('[Generation Flow] Starting infographic generation...');
                                                    setGeneratingInfographic(true);
                                                    try {
                                                        const contents = studySet?.materials
                                                            .map(m => m.content_text || m.summary || '')
                                                            .filter(t => (t?.trim().length || 0) > 10) || [];

                                                        console.log(`[Generation Flow] Found ${contents.length} materials with text.`);
                                                        if (contents.length === 0) {
                                                            alert('No hay suficiente texto en los materiales para generar la infografía.');
                                                            return;
                                                        }

                                                        const infographic = await generateInfographicFromMaterials(contents, studySet?.name || '');
                                                        console.log(`[Generation Flow] AI returned infographic: ${!!infographic}`);

                                                        if (infographic) {
                                                            console.log('[Generation Flow] Updating Supabase...');
                                                            await updateStudySet(studySetId!, { infographic });
                                                            setStudySet(prev => prev ? { ...prev, infographic } : null);
                                                            console.log('[Generation Flow] Success!');
                                                        } else {
                                                            alert('La IA no devolvió contenido para la infografía. Intenta de nuevo.');
                                                        }
                                                    } catch (err: any) {
                                                        console.error('[Generation Flow] Error in infographic chain:', err);
                                                        alert(`Error al generar infografía: ${err.message || 'Error desconocido'}`);
                                                    } finally {
                                                        setGeneratingInfographic(false);
                                                    }
                                                }}
                                                disabled={generatingInfographic}
                                                className={`text-xs px-3 py-1.5 rounded-lg transition flex items-center gap-1 font-medium ${generatingInfographic ? 'bg-amber-50 text-amber-400' : 'text-amber-600 hover:bg-amber-50'}`}
                                            >
                                                <span className={`material-symbols-outlined text-sm ${generatingInfographic ? 'animate-spin' : ''}`}>refresh</span>
                                                {generatingInfographic ? 'Generando...' : 'Regenerar'}
                                            </button>
                                        )}
                                        {canEdit && activeGuideTab === 'presentation' && (
                                            <button
                                                onClick={async () => {
                                                    console.log('[Generation Flow] Starting presentation generation...');
                                                    setGeneratingPresentation(true);
                                                    try {
                                                        const contents = studySet?.materials
                                                            .map(m => m.content_text || m.summary || '')
                                                            .filter(t => (t?.trim().length || 0) > 10) || [];

                                                        console.log(`[Generation Flow] Found ${contents.length} materials with text.`);
                                                        if (contents.length === 0) {
                                                            alert('No hay suficiente texto en los materiales para generar la presentación.');
                                                            return;
                                                        }

                                                        const presentation = await generatePresentationFromMaterials(contents, studySet?.name || '');
                                                        console.log(`[Generation Flow] AI returned presentation: ${!!presentation}`);

                                                        if (presentation) {
                                                            console.log('[Generation Flow] Updating Supabase...');
                                                            await updateStudySet(studySetId!, { presentation });
                                                            setStudySet(prev => prev ? { ...prev, presentation } : null);
                                                            console.log('[Generation Flow] Success!');
                                                        } else {
                                                            alert('La IA no devolvió contenido para la presentación. Intenta de nuevo.');
                                                        }
                                                    } catch (err: any) {
                                                        console.error('[Generation Flow] Error in presentation chain:', err);
                                                        alert(`Error al generar presentación: ${err.message || 'Error desconocido'}`);
                                                    } finally {
                                                        setGeneratingPresentation(false);
                                                    }
                                                }}
                                                disabled={generatingPresentation}
                                                className={`text-xs px-3 py-1.5 rounded-lg transition flex items-center gap-1 font-medium ${generatingPresentation ? 'bg-cyan-50 text-cyan-400' : 'text-cyan-600 hover:bg-cyan-50'}`}
                                            >
                                                <span className={`material-symbols-outlined text-sm ${generatingPresentation ? 'animate-spin' : ''}`}>refresh</span>
                                                {generatingPresentation ? 'Generando...' : 'Regenerar'}
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {activeGuideTab === 'guide' && (
                                    isEditingName ? (
                                        <textarea
                                            value={editDescription}
                                            onChange={(e) => setEditDescription(e.target.value)}
                                            className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-slate-700 min-h-[400px] font-mono text-sm leading-relaxed"
                                            placeholder="La guía de estudio aparecerá aquí automáticamente..."
                                        />
                                    ) : (
                                        <div className="max-w-none">
                                            {studySet.description ? (
                                                <StudyGuideRenderer content={studySet.description} />
                                            ) : (
                                                <EmptyAIBox
                                                    icon="magic_button"
                                                    title="No hay guía de estudio aún"
                                                    desc="Sube materiales y regenera para crear una guía automática con IA."
                                                    onAction={() => regenerateStudyGuide()}
                                                    loading={generatingGuide}
                                                    actionText="Generar Guía"
                                                />
                                            )}
                                        </div>
                                    )
                                )}

                                {activeGuideTab === 'infographic' && (
                                    <div className="max-w-none">
                                        {studySet.infographic ? (
                                            <StudyGuideRenderer content={studySet.infographic} />
                                        ) : (
                                            <EmptyAIBox
                                                icon="leaderboard"
                                                title="Visualiza tu conocimiento"
                                                desc="Genera una infografía estructurada basada en tus materiales de estudio."
                                                onAction={async () => {
                                                    console.log('[Generation Flow] Starting infographic generation from empty box...');
                                                    setGeneratingInfographic(true);
                                                    try {
                                                        const contents = studySet?.materials
                                                            .map(m => m.content_text || m.summary || '')
                                                            .filter(t => (t?.trim().length || 0) > 10) || [];

                                                        console.log(`[Generation Flow] Found ${contents.length} materials with text.`);
                                                        if (contents.length === 0) {
                                                            alert('No hay suficiente texto en los materiales para generar la infografía.');
                                                            return;
                                                        }

                                                        const infographic = await generateInfographicFromMaterials(contents, studySet?.name || '');
                                                        console.log(`[Generation Flow] AI returned infographic: ${!!infographic}`);

                                                        if (infographic) {
                                                            console.log('[Generation Flow] Updating Supabase...');
                                                            await updateStudySet(studySetId!, { infographic });
                                                            setStudySet(prev => prev ? { ...prev, infographic } : null);
                                                            console.log('[Generation Flow] Success!');
                                                        } else {
                                                            alert('La IA no devolvió contenido para la infografía.');
                                                        }
                                                    } catch (err: any) {
                                                        console.error('[Generation Flow] Error in infographic chain:', err);
                                                        alert(`Error al generar infografía: ${err.message || 'Error desconocido'}`);
                                                    } finally {
                                                        setGeneratingInfographic(false);
                                                    }
                                                }}
                                                loading={generatingInfographic}
                                                actionText="Generar Infografía"
                                                color="amber"
                                            />
                                        )}
                                    </div>
                                )}

                                {activeGuideTab === 'presentation' && (
                                    <div className="max-w-none">
                                        {studySet.presentation ? (
                                            <StudyGuideRenderer content={studySet.presentation} />
                                        ) : (
                                            <EmptyAIBox
                                                icon="slideshow"
                                                title="Estructura para exponer"
                                                desc="Crea un esquema de diapositivas ideal para presentaciones o repasos rápidos."
                                                onAction={async () => {
                                                    console.log('[Generation Flow] Starting presentation generation from empty box...');
                                                    setGeneratingPresentation(true);
                                                    try {
                                                        const contents = studySet?.materials
                                                            .map(m => m.content_text || m.summary || '')
                                                            .filter(t => (t?.trim().length || 0) > 10) || [];

                                                        console.log(`[Generation Flow] Found ${contents.length} materials with text.`);
                                                        if (contents.length === 0) {
                                                            alert('No hay suficiente texto en los materiales para generar la presentación.');
                                                            return;
                                                        }

                                                        const presentation = await generatePresentationFromMaterials(contents, studySet?.name || '');
                                                        console.log(`[Generation Flow] AI returned presentation: ${!!presentation}`);

                                                        if (presentation) {
                                                            console.log('[Generation Flow] Updating Supabase...');
                                                            await updateStudySet(studySetId!, { presentation });
                                                            setStudySet(prev => prev ? { ...prev, presentation } : null);
                                                            console.log('[Generation Flow] Success!');
                                                        } else {
                                                            alert('La IA no devolvió contenido para la presentación.');
                                                        }
                                                    } catch (err: any) {
                                                        console.error('[Generation Flow] Error in presentation chain:', err);
                                                        alert(`Error al generar presentación: ${err.message || 'Error desconocido'}`);
                                                    } finally {
                                                        setGeneratingPresentation(false);
                                                    }
                                                }}
                                                loading={generatingPresentation}
                                                actionText="Generar Presentación"
                                                color="cyan"
                                            />
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Reports Tab */}
                {activeTab === 'reports' && (
                    <div className="space-y-6">
                        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                            <h3 className="font-bold text-slate-900 mb-4">📈 Rendimiento en este Set</h3>
                            <CumulativeReportsCard studySetId={studySet.id} />
                        </div>

                        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                            <h3 className="font-bold text-slate-900 mb-4">🎯 Mapa de Dominio por Temas</h3>
                            <div className="h-[600px]">
                                <VisualProgressionMap studySetId={studySet.id} refreshTrigger={refreshReports} />
                            </div>
                        </div>
                    </div>
                )}

                {/* Flashcards Tab */}
                {activeTab === 'flashcards' && (
                    <div>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-slate-900">Flashcards</h3>
                            <div className="flex flex-wrap gap-2">
                                {canEdit && (
                                    <button
                                        onClick={handleAutoFlashcards}
                                        disabled={uploading || studySet.materials.length === 0}
                                        className="flex items-center gap-2 bg-emerald-100 text-emerald-700 font-medium px-4 py-2 rounded-xl hover:bg-emerald-200 transition disabled:opacity-50"
                                        title="Generar flashcards de todos los materiales"
                                    >
                                        <span className="material-symbols-outlined text-lg">psychology</span>
                                        {uploading ? 'Generando...' : 'Auto-Flashcards'}
                                    </button>
                                )}
                                {canEdit && (
                                    <button
                                        onClick={handleAutoCategorize}
                                        disabled={uploading || studySet.flashcards.length === 0}
                                        className="flex items-center gap-2 bg-indigo-100 text-indigo-700 font-medium px-4 py-2 rounded-xl hover:bg-indigo-200 transition disabled:opacity-50"
                                        title="Organizar automáticamente con IA"
                                    >
                                        <span className="material-symbols-outlined text-lg">auto_awesome</span>
                                        {uploading ? 'Categorizando...' : 'Auto-Categorizar'}
                                    </button>
                                )}
                                {canEdit && (
                                    <button
                                        onClick={() => setShowAddFlashcard(true)}
                                        className="flex items-center gap-2 bg-primary text-white font-medium px-4 py-2 rounded-xl hover:bg-blue-700 transition"
                                    >
                                        <span className="material-symbols-outlined">add</span>
                                        Nueva Flashcard
                                    </button>
                                )}
                            </div>
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
                                                    {/* Mastery Stats */}
                                                    {flashcardProgress.get(card.id) && (
                                                        <span className={`text-xs font-medium px-2 py-1 rounded ${(flashcardProgress.get(card.id)?.difficulty_level || 0) >= 3
                                                            ? 'bg-emerald-100 text-emerald-700'
                                                            : (flashcardProgress.get(card.id)?.difficulty_level || 0) >= 2
                                                                ? 'bg-blue-100 text-blue-700'
                                                                : 'bg-amber-100 text-amber-700'
                                                            }`}>
                                                            {'⭐'.repeat(flashcardProgress.get(card.id)?.difficulty_level || 1)} Nv.{flashcardProgress.get(card.id)?.difficulty_level || 1}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="font-medium text-slate-900 mb-1">{card.question}</p>
                                                <p className="text-sm text-slate-500">{card.answer}</p>
                                                {/* Progress bar */}
                                                {flashcardProgress.get(card.id) && (
                                                    <div className="mt-2 flex items-center gap-2">
                                                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                            <div
                                                                className="h-full bg-gradient-to-r from-violet-500 to-purple-500 rounded-full transition-all"
                                                                style={{ width: `${flashcardProgress.get(card.id)?.mastery_percent || 0}%` }}
                                                            />
                                                        </div>
                                                        <span className="text-xs text-slate-500">
                                                            {flashcardProgress.get(card.id)?.mastery_percent || 0}%
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => setViewingStatsFlashcard(card)}
                                                    className="p-2 text-slate-400 hover:text-violet-500 hover:bg-violet-50 rounded-lg transition"
                                                    title="Ver estadísticas"
                                                >
                                                    <span className="material-symbols-outlined text-sm">bar_chart</span>
                                                </button>
                                                {canEdit && (
                                                    <>
                                                        <button
                                                            onClick={() => setEditingFlashcard(card)}
                                                            className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition"
                                                            title="Editar"
                                                        >
                                                            <span className="material-symbols-outlined text-sm">edit</span>
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteFlashcard(card.id)}
                                                            className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition"
                                                            title="Eliminar"
                                                        >
                                                            <span className="material-symbols-outlined text-sm">delete</span>
                                                        </button>
                                                    </>
                                                )}
                                            </div>
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
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                            <h3 className="font-bold text-slate-900">Materiales Subidos</h3>
                            <div className="flex items-center gap-3">
                                {canEdit && (
                                    <div className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-2 rounded-xl shadow-sm">
                                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Límite Flashcards</span>
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => setTargetFlashcardCount(Math.max(5, targetFlashcardCount - 5))}
                                                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-50 text-slate-600 transition"
                                            >
                                                <span className="material-symbols-outlined text-base">remove</span>
                                            </button>
                                            <div className="w-8 text-center">
                                                <span className="text-sm font-bold text-indigo-600">{targetFlashcardCount}</span>
                                            </div>
                                            <button
                                                onClick={() => setTargetFlashcardCount(Math.min(50, targetFlashcardCount + 5))}
                                                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-50 text-slate-600 transition"
                                            >
                                                <span className="material-symbols-outlined text-base">add</span>
                                            </button>
                                        </div>
                                    </div>
                                )}
                                {canEdit && (
                                    <label className={`flex items-center gap-2 font-medium px-5 py-2.5 rounded-xl cursor-pointer transition shadow-sm ${uploading ? 'bg-slate-200 text-slate-500 cursor-not-allowed' : 'bg-emerald-600 text-white hover:bg-emerald-700 active:transform active:scale-95'}`}>
                                        <span className="material-symbols-outlined">upload</span>
                                        {uploading ? 'Procesando...' : 'Subir PDF'}
                                        <input type="file" accept=".pdf" onChange={handleFileUpload} className="hidden" disabled={uploading} />
                                    </label>
                                )}
                            </div>
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
                                    <div key={material.id} className="group relative flex flex-col p-4 rounded-xl border border-slate-100 hover:border-slate-200 hover:shadow-sm transition bg-white">
                                        {/* Header with icon and name */}
                                        <div className="flex items-start gap-4">
                                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${material.type === 'pdf' ? 'bg-rose-50 text-rose-500' :
                                                material.type === 'url' ? 'bg-red-50 text-red-500' :
                                                    'bg-orange-50 text-orange-500'
                                                }`}>
                                                <span className="material-symbols-outlined">
                                                    {material.type === 'pdf' ? 'picture_as_pdf' :
                                                        material.type === 'url' ? 'play_circle' : 'description'}
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
                                            </div>
                                        </div>

                                        {/* YouTube Link Button (prominent) */}
                                        {material.type === 'url' && material.file_url && material.file_url.includes('youtu') && (
                                            <div className="mt-4 flex items-center gap-3">
                                                <a
                                                    href={material.file_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white font-medium px-4 py-2 rounded-lg transition"
                                                >
                                                    <span className="material-symbols-outlined text-lg">play_circle</span>
                                                    Ver Video en YouTube
                                                </a>
                                                <span className="text-xs text-slate-400 truncate flex-1">{material.file_url}</span>
                                            </div>
                                        )}

                                        {/* Detailed Summary Section - Collapsible */}
                                        {material.summary && (
                                            <div className="mt-4 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl border border-indigo-100 overflow-hidden">
                                                <button
                                                    onClick={() => toggleSummary(material.id)}
                                                    className="w-full flex items-center justify-between p-4 hover:bg-indigo-100/50 transition"
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <span className="material-symbols-outlined text-indigo-500">auto_awesome</span>
                                                        <span className="text-sm font-bold text-indigo-700">Resumen Detallado (Generado por IA)</span>
                                                    </div>
                                                    <span className="material-symbols-outlined text-indigo-500 transition-transform duration-200" style={{ transform: expandedSummaries.has(material.id) ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                                                        expand_more
                                                    </span>
                                                </button>
                                                {expandedSummaries.has(material.id) && (
                                                    <div className="px-4 pb-4 text-sm text-slate-700 leading-relaxed prose prose-sm prose-indigo max-w-none">
                                                        {/* Render markdown-style content */}
                                                        {material.summary.split('\n').map((line, i) => {
                                                            if (line.startsWith('## ')) {
                                                                return <h3 key={i} className="text-base font-bold text-indigo-800 mt-4 mb-2">{line.replace('## ', '')}</h3>;
                                                            } else if (line.startsWith('### ')) {
                                                                return <h4 key={i} className="text-sm font-semibold text-indigo-700 mt-3 mb-1">{line.replace('### ', '')}</h4>;
                                                            } else if (line.startsWith('- ') || line.startsWith('• ')) {
                                                                return <li key={i} className="ml-4 mb-1">{line.replace(/^[-•] /, '')}</li>;
                                                            } else if (line.trim() === '') {
                                                                return <br key={i} />;
                                                            } else {
                                                                return <p key={i} className="mb-2">{line}</p>;
                                                            }
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Action buttons */}
                                        <div className="flex items-center gap-3 mt-4">
                                            {material.file_url && material.type !== 'url' && (
                                                <a
                                                    href={material.file_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition"
                                                >
                                                    <span className="material-symbols-outlined text-sm">visibility</span>
                                                    Ver PDF
                                                </a>
                                            )}
                                            <button
                                                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 bg-white border border-slate-200 hover:border-slate-300 px-3 py-1.5 rounded-lg transition"
                                                onClick={() => handleOpenMaterial(material)}
                                            >
                                                <span className="material-symbols-outlined text-sm">auto_awesome</span>
                                                Estudiar Material
                                            </button>

                                            <div className="flex-1"></div>

                                            {canEdit && (
                                                <button
                                                    className="inline-flex items-center gap-1.5 text-xs font-medium text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition ml-auto"
                                                    onClick={() => handleDeleteMaterial(material)}
                                                    title="Eliminar material y sus flashcards"
                                                >
                                                    <span className="material-symbols-outlined text-sm">delete</span>
                                                    Eliminar
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )
                }
            </main >

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
                            <div className="mt-4 mb-2">
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Cantidad de Flashcards</label>
                                <div className="flex items-center gap-4 bg-slate-50 border border-slate-200 p-2 rounded-xl">
                                    <button
                                        onClick={() => setTargetFlashcardCount(Math.max(5, targetFlashcardCount - 5))}
                                        className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-white border border-transparent hover:border-slate-200 text-slate-600 transition"
                                    >
                                        <span className="material-symbols-outlined">remove</span>
                                    </button>
                                    <div className="flex-1 text-center">
                                        <span className="text-xl font-bold text-indigo-600">{targetFlashcardCount}</span>
                                        <span className="ml-2 text-sm text-slate-500 font-medium">Tarjetas</span>
                                    </div>
                                    <button
                                        onClick={() => setTargetFlashcardCount(Math.min(50, targetFlashcardCount + 5))}
                                        className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-white border border-transparent hover:border-slate-200 text-slate-600 transition"
                                    >
                                        <span className="material-symbols-outlined">add</span>
                                    </button>
                                </div>
                            </div>
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
                            </div>
                            {urlType === 'youtube' && (
                                <div className="p-3 bg-gradient-to-r from-violet-50 to-fuchsia-50 rounded-lg border border-violet-100">
                                    <div className="flex items-center gap-2 text-violet-700 text-sm font-medium">
                                        <span className="material-symbols-outlined text-lg">auto_awesome</span>
                                        IA analizará el video y generará flashcards + resumen detallado
                                    </div>
                                </div>
                            )}
                            {urlType === 'website' && (
                                <div className="p-3 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg border border-blue-100">
                                    <div className="flex items-center gap-2 text-blue-700 text-sm font-medium">
                                        <span className="material-symbols-outlined text-lg">auto_awesome</span>
                                        IA extraerá el contenido y generará flashcards + resumen detallado
                                    </div>
                                </div>
                            )}
                            <div className="mt-4 mb-4">
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Cantidad de Flashcards</label>
                                <div className="flex items-center gap-4 bg-slate-50 border border-slate-200 p-2 rounded-xl">
                                    <button
                                        type="button"
                                        onClick={() => setTargetFlashcardCount(Math.max(5, targetFlashcardCount - 5))}
                                        className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-white border border-transparent hover:border-slate-200 text-slate-600 transition"
                                    >
                                        <span className="material-symbols-outlined">remove</span>
                                    </button>
                                    <div className="flex-1 text-center">
                                        <span className="text-xl font-bold text-indigo-600">{targetFlashcardCount}</span>
                                        <span className="ml-2 text-sm text-slate-500 font-medium">Tarjetas</span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setTargetFlashcardCount(Math.min(50, targetFlashcardCount + 5))}
                                        className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-white border border-transparent hover:border-slate-200 text-slate-600 transition"
                                    >
                                        <span className="material-symbols-outlined">add</span>
                                    </button>
                                </div>
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
                )
            }

            {/* View Content Modal */}
            {
                viewContentModal.isOpen && (
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
                )
            }
            {/* Edit Flashcard Modal */}
            {
                editingFlashcard && (
                    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl overflow-hidden">
                            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                                <h3 className="font-bold text-lg text-slate-900">Editar Flashcard</h3>
                                <button onClick={() => setEditingFlashcard(null)} className="text-slate-400 hover:text-slate-600">
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                            </div>
                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Tema / Categoría</label>
                                    <input
                                        type="text"
                                        value={editingFlashcard.category || ''}
                                        onChange={(e) => setEditingFlashcard({ ...editingFlashcard, category: e.target.value })}
                                        placeholder="Ej: Historia, Definiciones, Fórmulas..."
                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition"
                                    />
                                    <p className="text-xs text-slate-500 mt-1">
                                        Agrupa tus flashcards por temas para verlos en el Mapa de Dominio.
                                    </p>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Pregunta (Anverso)</label>
                                    <textarea
                                        value={editingFlashcard.question}
                                        onChange={(e) => setEditingFlashcard({ ...editingFlashcard, question: e.target.value })}
                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl h-24 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition resize-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Respuesta (Reverso)</label>
                                    <textarea
                                        value={editingFlashcard.answer}
                                        onChange={(e) => setEditingFlashcard({ ...editingFlashcard, answer: e.target.value })}
                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl h-24 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition resize-none"
                                    />
                                </div>
                            </div>
                            <div className="p-6 bg-slate-50 flex justify-end gap-3">
                                <button
                                    onClick={() => setEditingFlashcard(null)}
                                    className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-200 rounded-xl transition"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleUpdateFlashcard}
                                    className="px-6 py-2 bg-primary text-white font-bold rounded-xl hover:bg-blue-700 transition shadow-lg shadow-blue-500/30"
                                >
                                    Guardar Cambios
                                </button>
                            </div>
                        </div>
                    </div>
                )}

            {/* Flashcard Stats Modal */}
            {viewingStatsFlashcard && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setViewingStatsFlashcard(null)}>
                    <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-slate-100">
                            <div className="flex justify-between items-center">
                                <h2 className="text-xl font-bold text-slate-900">📊 Estadísticas de Flashcard</h2>
                                <button onClick={() => setViewingStatsFlashcard(null)} className="text-slate-400 hover:text-slate-600">
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                            </div>
                        </div>
                        <div className="p-6 space-y-6">
                            {/* Question/Answer Preview */}
                            <div className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-2xl p-4 border border-violet-100">
                                <p className="text-sm text-violet-600 font-medium mb-1">Pregunta</p>
                                <p className="text-slate-800 font-medium">{viewingStatsFlashcard.question}</p>
                                <p className="text-sm text-violet-600 font-medium mt-3 mb-1">Respuesta</p>
                                <p className="text-slate-600 text-sm">{viewingStatsFlashcard.answer}</p>
                            </div>

                            {flashcardProgress.get(viewingStatsFlashcard.id) ? (
                                <>
                                    {/* Mastery Level */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-slate-50 rounded-2xl p-4 text-center">
                                            <p className="text-sm text-slate-500 mb-1">Nivel de Dominio</p>
                                            <p className="text-3xl font-bold text-violet-600">
                                                {'⭐'.repeat(flashcardProgress.get(viewingStatsFlashcard.id)?.difficulty_level || 1)}
                                            </p>
                                            <p className="text-sm font-medium text-slate-700 mt-1">
                                                Nivel {flashcardProgress.get(viewingStatsFlashcard.id)?.difficulty_level || 1} / 4
                                            </p>
                                        </div>
                                        <div className="bg-slate-50 rounded-2xl p-4 text-center">
                                            <p className="text-sm text-slate-500 mb-1">Porcentaje de Dominio</p>
                                            <p className="text-3xl font-bold text-emerald-600">
                                                {flashcardProgress.get(viewingStatsFlashcard.id)?.mastery_percent || 0}%
                                            </p>
                                            <div className="w-full h-2 bg-slate-200 rounded-full mt-2 overflow-hidden">
                                                <div
                                                    className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full transition-all"
                                                    style={{ width: `${flashcardProgress.get(viewingStatsFlashcard.id)?.mastery_percent || 0}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Detailed Stats */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-blue-50 rounded-xl p-4">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="material-symbols-outlined text-blue-600 text-lg">check_circle</span>
                                                <p className="text-sm text-slate-600">Correctas en nivel actual</p>
                                            </div>
                                            <p className="text-2xl font-bold text-blue-700">
                                                {flashcardProgress.get(viewingStatsFlashcard.id)?.correct_at_level || 0}
                                            </p>
                                        </div>
                                        <div className="bg-amber-50 rounded-xl p-4">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="material-symbols-outlined text-amber-600 text-lg">replay</span>
                                                <p className="text-sm text-slate-600">Intentos en nivel actual</p>
                                            </div>
                                            <p className="text-2xl font-bold text-amber-700">
                                                {flashcardProgress.get(viewingStatsFlashcard.id)?.attempts_at_level || 0}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Level Explanation */}
                                    <div className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-xl p-4">
                                        <p className="text-sm text-slate-600">
                                            {flashcardProgress.get(viewingStatsFlashcard.id)?.difficulty_level === 4
                                                ? '🎉 ¡Excelente! Has dominado esta tarjeta completamente.'
                                                : flashcardProgress.get(viewingStatsFlashcard.id)?.difficulty_level === 3
                                                    ? '💪 Muy bien, estás casi en el nivel máximo.'
                                                    : flashcardProgress.get(viewingStatsFlashcard.id)?.difficulty_level === 2
                                                        ? '📈 Buen progreso, sigue practicando para subir de nivel.'
                                                        : '🚀 Apenas empezando. Practica más para mejorar tu dominio.'}
                                        </p>
                                    </div>
                                </>
                            ) : (
                                <div className="text-center py-8">
                                    <span className="material-symbols-outlined text-5xl text-slate-200 mb-3">school</span>
                                    <p className="text-slate-500 font-medium">Aún no has estudiado esta tarjeta</p>
                                    <p className="text-sm text-slate-400 mt-1">Las estadísticas aparecerán después de practicarla.</p>
                                </div>
                            )}
                        </div>
                        <div className="p-6 bg-slate-50 rounded-b-3xl">
                            <button
                                onClick={() => setViewingStatsFlashcard(null)}
                                className="w-full px-4 py-3 bg-primary text-white font-bold rounded-xl hover:bg-blue-700 transition"
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
