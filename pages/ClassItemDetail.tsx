import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext'; // Assuming context path
import {
    getAssignment,
    getAssignmentSubmissions,
    submitAssignment,
    updateAssignment,
    getStudentSubmission,
    gradeSubmission
} from '../services/ClassroomService'; // Verify imports
import { Assignment } from '../services/ClassroomService';
import { supabase } from '../services/supabaseClient';
import { extractTextFromPDF, generateStudySummary } from '../services/pdfProcessingService';

const ClassItemDetail: React.FC = () => {
    const { classId, itemId } = useParams<{ classId: string; itemId: string }>();
    const navigate = useNavigate();
    const { user, profile } = useAuth();
    const isTeacher = profile?.role === 'teacher';

    const [item, setItem] = useState<Assignment | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [submission, setSubmission] = useState<any | null>(null); // Type properly

    // Teacher specific states
    const [publishing, setPublishing] = useState(false);
    const [generatingSummary, setGeneratingSummary] = useState(false);
    const [isGradingModalOpen, setIsGradingModalOpen] = useState(false);
    const [submissionsList, setSubmissionsList] = useState<any[]>([]);

    // Study Set / Material States
    const [materials, setMaterials] = useState<any[]>([]);
    const [flashcards, setFlashcards] = useState<any[]>([]);
    const [currentFlashIndex, setCurrentFlashIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [materialLoading, setMaterialLoading] = useState(false);

    // Edit State
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState<{
        title: string;
        description: string;
        due_date: string;
        points: number;
    }>({ title: '', description: '', due_date: '', points: 0 });
    const [saving, setSaving] = useState(false);

    // Student Submission State
    const [submitting, setSubmitting] = useState(false);
    const [isSubmissionModalOpen, setIsSubmissionModalOpen] = useState(false);
    const [submissionFile, setSubmissionFile] = useState<File | null>(null);
    const [submissionLink, setSubmissionLink] = useState('');
    const [submissionText, setSubmissionText] = useState('');

    useEffect(() => {
        if (user) {
            loadItem();
        }
    }, [itemId, user]);

    const loadItem = async () => {
        if (!itemId) return;
        setLoading(true);
        try {
            const itemData = await getAssignment(itemId);
            setItem(itemData);

            if (!isTeacher && user) {
                const sub = await getStudentSubmission(itemId, user.id);
                setSubmission(sub);
            }

            // If it's a material, load its related data
            if (itemData.type === 'material') {
                await loadMaterialData(itemData);
            }

        } catch (err: any) {
            console.error(err);
            setError('Error al cargar el contenido del módulo.');
        } finally {
            setLoading(false);
        }
    };

    const loadMaterialData = async (assignment: Assignment) => {
        if (!assignment.attached_materials || assignment.attached_materials.length === 0) return;

        setMaterialLoading(true);
        try {
            // Fetch materials
            const { data: mats, error: matsError } = await supabase
                .from('materials')
                .select('*')
                .in('id', assignment.attached_materials);

            if (matsError) throw matsError;
            setMaterials(mats || []);

            // Fetch flashcards for these materials
            const { data: flashes, error: flashesError } = await supabase
                .from('flashcards')
                .select('*')
                .in('material_id', assignment.attached_materials);

            if (flashesError) throw flashesError;
            setFlashcards(flashes || []);

        } catch (err) {
            console.error('Error loading material/flashcards:', err);
        } finally {
            setMaterialLoading(false);
        }
    };

    const renderStudySet = () => {
        if (flashcards.length === 0) return (
            <div className="bg-white p-12 rounded-3xl border-2 border-dashed border-slate-200 text-center">
                <div className="bg-slate-50 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-400">
                    <span className="material-symbols-outlined text-3xl">style</span>
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">No hay flashcards generadas</h3>
                <p className="text-slate-500 max-w-xs mx-auto text-sm">Este material aún no tiene flashcards. Si eres profesor, puedes intentar regenerar el material.</p>
            </div>
        );

        const currentCard = flashcards[currentFlashIndex];

        return (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* Flashcard Carousel */}
                <div className="flex flex-col items-center">
                    <div className="w-full max-w-xl card-perspective h-80 relative group">
                        <div
                            onClick={() => setIsFlipped(!isFlipped)}
                            className={`w-full h-full relative card-inner cursor-pointer ${isFlipped ? 'card-flipped' : ''}`}
                        >
                            {/* Front */}
                            <div className="absolute inset-0 backface-hidden bg-white rounded-3xl shadow-xl border border-slate-100 flex flex-col items-center justify-center p-12 text-center">
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Pregunta</span>
                                <p className="text-2xl font-bold text-slate-900 leading-tight">
                                    {currentCard.question}
                                </p>
                                <span className="absolute bottom-6 text-slate-400 text-sm font-medium flex items-center gap-2">
                                    <span className="material-symbols-outlined text-sm">touch_app</span>
                                    Click para ver respuesta
                                </span>
                            </div>

                            {/* Back */}
                            <div className="absolute inset-0 backface-hidden bg-primary rounded-3xl shadow-xl flex flex-col items-center justify-center p-12 text-center rotate-y-180">
                                <span className="text-xs font-bold text-white/60 uppercase tracking-widest mb-4">Respuesta</span>
                                <p className="text-xl font-medium text-white leading-relaxed">
                                    {currentCard.answer}
                                </p>
                                <span className="absolute bottom-6 text-white/60 text-sm font-medium">Click para volver</span>
                            </div>
                        </div>
                    </div>

                    {/* Controls */}
                    <div className="flex items-center gap-8 mt-8">
                        <button
                            onClick={() => {
                                setCurrentFlashIndex(prev => Math.max(0, prev - 1));
                                setIsFlipped(false);
                            }}
                            disabled={currentFlashIndex === 0}
                            className="p-3 rounded-full bg-white shadow-md border border-slate-100 text-slate-600 hover:text-primary transition disabled:opacity-30 flex items-center justify-center"
                        >
                            <span className="material-symbols-outlined">chevron_left</span>
                        </button>

                        <div className="text-slate-500 font-bold bg-white px-4 py-1 rounded-full border border-slate-100 shadow-sm">
                            {currentFlashIndex + 1} <span className="opacity-40 mx-1">/</span> {flashcards.length}
                        </div>

                        <button
                            onClick={() => {
                                setCurrentFlashIndex(prev => Math.min(flashcards.length - 1, prev + 1));
                                setIsFlipped(false);
                            }}
                            disabled={currentFlashIndex === flashcards.length - 1}
                            className="p-3 rounded-full bg-white shadow-md border border-slate-100 text-slate-600 hover:text-primary transition disabled:opacity-30 flex items-center justify-center"
                        >
                            <span className="material-symbols-outlined">chevron_right</span>
                        </button>
                    </div>
                </div>

                {/* Study Tools Card */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button
                        onClick={() => navigate(`/student/adaptive/${materials[0]?.id}`)}
                        className="bg-gradient-to-br from-indigo-500 to-blue-600 p-6 rounded-3xl text-white shadow-lg shadow-indigo-900/20 cursor-pointer hover:scale-[1.02] transition active:scale-95 group text-left"
                    >
                        <div className="flex items-center justify-between mb-4">
                            <div className="bg-white/20 p-2 rounded-xl">
                                <span className="material-symbols-outlined">quiz</span>
                            </div>
                            <span className="material-symbols-outlined opacity-0 group-hover:opacity-100 transition translate-x-[-8px] group-hover:translate-x-0">arrow_forward</span>
                        </div>
                        <h3 className="text-xl font-black mb-1">Cuestionario IA</h3>
                        <p className="text-white/80 text-sm">Prueba tus conocimientos con un quiz adaptativo de 5 preguntas.</p>
                    </button>

                    <button
                        onClick={() => navigate(`/student/study-set/${materials[0]?.id}`)}
                        className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm cursor-pointer hover:border-primary/30 hover:shadow-md transition active:scale-95 group text-left"
                    >
                        <div className="flex items-center justify-between mb-4">
                            <div className="bg-slate-100 p-2 rounded-xl text-slate-600 group-hover:bg-primary/10 group-hover:text-primary transition">
                                <span className="material-symbols-outlined">style</span>
                            </div>
                            <span className="material-symbols-outlined opacity-0 group-hover:opacity-100 transition text-primary translate-x-[-8px] group-hover:translate-x-0">arrow_forward</span>
                        </div>
                        <h3 className="text-xl font-black text-slate-900 mb-1">Sesión Focalizada</h3>
                        <p className="text-slate-500 text-sm">Inicia una sesión de estudio completa con el algoritmo FSRS.</p>
                    </button>
                </div>
            </div>
        );
    };

    const handleTogglePublish = async () => {
        if (!item) return;
        setPublishing(true);
        try {
            const updated = await updateAssignment(item.id, { published: !item.published });
            setItem(updated);
        } catch (err) {
            console.error(err);
        } finally {
            setPublishing(false);
        }
    };

    const handleGenerateSummary = async () => {
        if (!item || !item.attachments || item.attachments.length === 0) return;

        // Find PDF attachment
        const pdfAttachment = item.attachments.find((a: any) =>
            a.mime_type?.includes('pdf') || a.url?.endsWith('.pdf') || a.title?.endsWith('.pdf')
        );

        if (!pdfAttachment) {
            alert('No se encontró un archivo PDF adjunto.');
            return;
        }

        setGeneratingSummary(true);
        try {
            // Download file from Storage
            // assignment.url contains the storage path (e.g. "classId/assignments/filename.pdf")
            const { data: blob, error: downloadError } = await supabase.storage
                .from('materials')
                .download(pdfAttachment.url);

            if (downloadError) throw downloadError;

            // Convert to Base64
            const reader = new FileReader();
            reader.readAsDataURL(blob);

            reader.onload = async (e) => {
                const base64 = (e.target?.result as string)?.split(',')[1];
                if (base64) {
                    const text = await extractTextFromPDF(base64);
                    if (text) {
                        const summary = await generateStudySummary(text, item.title);
                        if (summary) {
                            const newDescription = (item.description || '') + `\n\n--- 🤖 Resumen IA ---\n${summary}`;
                            const updated = await updateAssignment(item.id, { description: newDescription });
                            setItem(updated);
                        } else {
                            alert('No se pudo generar el resumen.');
                        }
                    } else {
                        alert('No se pudo extraer texto del PDF.');
                    }
                }
                setGeneratingSummary(false);
            };

            reader.onerror = () => {
                console.error('File reading failed');
                setGeneratingSummary(false);
            };

        } catch (err) {
            console.error('Error generating summary:', err);
            alert('Error al generar resumen.');
            setGeneratingSummary(false);
        }
    }




    const handleStartAssignment = async () => {
        if (!user || !item) return;
        setSubmitting(true);
        try {
            if (submission) {
                setIsSubmissionModalOpen(true);
                return;
            }

            const { data, error } = await supabase
                .from('assignment_submissions')
                .insert({
                    assignment_id: item.id,
                    student_id: user.id,
                    status: 'in_progress',
                    is_late: item.due_date ? new Date(item.due_date) < new Date() : false
                })
                .select()
                .single();

            if (error) throw error;
            setSubmission(data);
            setIsSubmissionModalOpen(true);
        } catch (err) {
            console.error(err);
            alert('Error al iniciar la tarea.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleSubmitWork = async () => {
        if (!submission || !user || !item) return;
        setSubmitting(true);
        try {
            let attachments = submission.attachments || [];

            // Upload File
            if (submissionFile) {
                const fileName = `submissions/${item.id}/${user.id}/${Date.now()}_${submissionFile.name}`;
                const { error: uploadError } = await supabase.storage
                    .from('materials')
                    .upload(fileName, submissionFile);

                if (uploadError) throw uploadError;

                const { data: { publicUrl } } = supabase.storage
                    .from('materials')
                    .getPublicUrl(fileName);

                attachments = [...attachments, {
                    type: 'file',
                    title: submissionFile.name,
                    url: publicUrl,
                    mime_type: submissionFile.type
                }];
            }

            // Append link if provided
            let finalLink = submission.link_response;
            if (submissionLink) {
                finalLink = submissionLink; // Simple override for now
            }

            // Append text if provided
            let finalText = submission.text_response;
            if (submissionText) {
                finalText = submissionText;
            }

            await submitAssignment(submission.id, {
                text_response: finalText,
                link_response: finalLink,
                attachments: attachments
            });

            // Refresh
            const updated = await getStudentSubmission(item.id, user.id);
            setSubmission(updated);
            setIsSubmissionModalOpen(false);
            setSubmissionFile(null);
            setSubmissionLink('');
            setSubmissionText('');

        } catch (err) {
            console.error(err);
            alert('Error al entregar tarea.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleViewSubmissions = async () => {
        if (!item) return;
        try {
            const subs = await getAssignmentSubmissions(item.id);
            setSubmissionsList(subs);
            setIsGradingModalOpen(true);
        } catch (err) {
            console.error(err);
            alert('Error al cargar entregas.');
        }
    };

    const handleGradeSubmission = async (submissionId: string, grade: number) => {
        try {
            const updated = await gradeSubmission(submissionId, grade);
            setSubmissionsList(prev => prev.map(s => s.id === submissionId ? { ...s, ...updated } : s));
        } catch (err) {
            console.error(err);
            alert('Error al calificar.');
        }
    };

    const handleEditClick = () => {
        if (!item) return;
        setEditForm({
            title: item.title,
            description: mainDescription, // Use main description without AI summary for editing
            due_date: item.due_date ? new Date(item.due_date).toISOString().split('T')[0] : '',
            points: item.points || 100
        });
        setIsEditing(true);
    };

    const handleSaveEdit = async () => {
        if (!item) return;
        setSaving(true);
        try {
            // Re-append AI summary if it exists
            let finalDescription = editForm.description;
            if (aiSummary) {
                finalDescription += `\n\n--- 🤖 Resumen IA ---\n${aiSummary}`;
            }

            const updates: Partial<Assignment> = {
                title: editForm.title,
                description: finalDescription,
                points: editForm.points,
                due_date: editForm.due_date ? new Date(editForm.due_date).toISOString() : null as any // Allow null to clear date
            };

            const updated = await updateAssignment(item.id, updates);
            setItem(updated);
            setIsEditing(false);
        } catch (err) {
            console.error('Error updating assignment:', err);
            alert('Error al guardar cambios.');
        } finally {
            setSaving(false);
        }
    };

    // Parse description to separate AI Summary
    const [isSummaryOpen, setIsSummaryOpen] = useState(false);

    const { mainDescription, aiSummary } = React.useMemo(() => {
        if (!item?.description) return { mainDescription: '', aiSummary: null };
        // Split by the specific separator we added
        const parts = item.description.split('--- 🤖 Resumen IA ---');
        if (parts.length > 1) {
            return {
                mainDescription: parts[0].trim(),
                aiSummary: parts.slice(1).join('--- 🤖 Resumen IA ---').trim()
            };
        }
        return { mainDescription: item.description, aiSummary: null };
    }, [item?.description]);

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
        </div>
    );

    if (error || !item) return (
        <div className="p-8 text-center">
            <h2 className="text-xl font-bold text-slate-800">No encontrado</h2>
            <button onClick={() => navigate(-1)} className="text-primary hover:underline mt-4">Regresar</button>
        </div>
    );

    return (
        <div className="min-h-screen bg-white">
            {/* Header / Breadcrumbs */}
            <div className="border-b border-slate-200 bg-white sticky top-0 z-10 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-slate-500">
                    <button onClick={() => navigate(isTeacher ? `/teacher/class/${classId}` : `/student/class/${classId}`)} className="hover:text-primary transition">
                        <span className="material-symbols-outlined align-middle text-lg">arrow_back</span> Volver a Módulos
                    </button>
                    <span>/</span>
                    <span className="text-slate-900 font-medium truncate max-w-[300px]">{item.title}</span>
                </div>
                {isTeacher && (
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleTogglePublish}
                            disabled={publishing}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition flex items-center gap-2 ${item.published ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                        >
                            <span className="material-symbols-outlined text-lg">
                                {item.published ? 'check_circle' : 'visibility_off'}
                            </span>
                            {item.published ? 'Publicado' : 'Borrador'}
                        </button>
                        <button
                            onClick={handleEditClick}
                            className="bg-primary text-white px-4 py-2 rounded-lg font-bold hover:bg-blue-700 transition"
                        >
                            Editar
                        </button>
                    </div>
                )}
                {isTeacher && item.attachments?.some((a: any) => a.mime_type?.includes('pdf') || a.url?.endsWith('.pdf')) && (
                    <button
                        onClick={handleGenerateSummary}
                        disabled={generatingSummary}
                        className="flex items-center gap-2 text-indigo-600 hover:text-indigo-800 font-medium px-2 py-1 rounded-lg hover:bg-indigo-50 transition ml-2"
                        title="Generar Resumen con IA"
                    >
                        <span className={`material-symbols-outlined text-lg ${generatingSummary ? 'animate-spin' : ''}`}>
                            {generatingSummary ? 'autorenew' : 'smart_toy'}
                        </span>
                        {generatingSummary ? 'Generando...' : 'Resumen IA'}
                    </button>
                )}
            </div>

            {/* Edit Modal */}
            {isEditing && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-8">
                            <h2 className="text-2xl font-black text-slate-900 mb-6">Editar Contenido</h2>
                            <div className="space-y-5">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Título</label>
                                    <input
                                        type="text"
                                        value={editForm.title}
                                        onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                                        className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none font-medium"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">Fecha de Entrega</label>
                                        <div className="flex gap-2">
                                            <input
                                                type="date"
                                                value={editForm.due_date}
                                                onChange={(e) => setEditForm({ ...editForm, due_date: e.target.value })}
                                                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                                            />
                                            {editForm.due_date && (
                                                <button
                                                    onClick={() => setEditForm({ ...editForm, due_date: '' })}
                                                    className="px-3 py-2 bg-slate-100 text-slate-500 rounded-xl hover:bg-rose-50 hover:text-rose-600 transition"
                                                    title="Quitar fecha"
                                                >
                                                    <span className="material-symbols-outlined">close</span>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    {item?.type === 'assignment' && (
                                        <div>
                                            <label className="block text-sm font-bold text-slate-700 mb-2">Puntos</label>
                                            <input
                                                type="number"
                                                value={editForm.points}
                                                onChange={(e) => setEditForm({ ...editForm, points: parseInt(e.target.value) || 0 })}
                                                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                                            />
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Descripción</label>
                                    <textarea
                                        value={editForm.description}
                                        onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                                        rows={8}
                                        className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none"
                                    />
                                    <p className="text-xs text-slate-400 mt-2 text-right">
                                        {aiSummary ? '* El resumen IA se mantendrá adjunto al guardar.' : ''}
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="bg-slate-50 p-6 flex justify-end gap-3 border-t border-slate-100">
                            <button
                                onClick={() => setIsEditing(false)}
                                className="px-5 py-2.5 text-slate-600 font-bold hover:bg-slate-200 rounded-xl transition"
                                disabled={saving}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSaveEdit}
                                disabled={saving || !editForm.title}
                                className="bg-primary text-white font-bold px-6 py-2.5 rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-blue-900/20"
                            >
                                {saving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                                {saving ? 'Guardando...' : 'Guardar Cambios'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Main Content */}
            <div className="max-w-5xl mx-auto px-6 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column: Content */}
                    <div className="lg:col-span-2 space-y-8">
                        {/* Header Info */}
                        <div>
                            <div className="flex items-center gap-3 mb-4">
                                <span className={`p-2 rounded-lg ${item.type === 'assignment' ? 'bg-indigo-100 text-indigo-700' : 'bg-blue-100 text-blue-700'}`}>
                                    <span className="material-symbols-outlined">
                                        {item.type === 'assignment' ? 'assignment' : 'folder_open'}
                                    </span>
                                </span>
                                <h1 className="text-3xl font-bold text-slate-900">{item.title}</h1>
                            </div>

                            <div className="flex items-center gap-6 text-slate-500 text-sm">
                                {item.due_date && (
                                    <div className="flex items-center gap-2">
                                        <span className="material-symbols-outlined text-lg">event</span>
                                        <span>Entrega: {new Date(item.due_date).toLocaleString()}</span>
                                    </div>
                                )}
                                {item.points !== undefined && item.type === 'assignment' && (
                                    <div className="flex items-center gap-2">
                                        <span className="material-symbols-outlined text-lg">stars</span>
                                        <span>{item.points} Puntos</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <hr className="border-slate-100" />

                        {/* Study Set Section for Materials */}
                        {item.type === 'material' && (
                            <div className="mt-4">
                                <div className="flex items-center gap-2 mb-6">
                                    <span className="material-symbols-outlined text-primary">auto_awesome</span>
                                    <h2 className="text-xl font-black text-slate-900">Tu Set de Estudio</h2>
                                </div>
                                {renderStudySet()}
                                <hr className="border-slate-100 my-8" />
                            </div>
                        )}

                        {/* Description */}
                        <div className="prose prose-slate max-w-none">
                            <h3 className="text-lg font-bold text-slate-900 mb-4">Descripción</h3>
                            <div className="whitespace-pre-wrap text-slate-700 leading-relaxed mb-6">
                                {mainDescription || 'Sin descripción.'}
                            </div>

                            {/* AI Summary Accordion */}
                            {aiSummary && (
                                <div className="border border-indigo-100 rounded-xl overflow-hidden bg-white shadow-sm">
                                    <button
                                        onClick={() => setIsSummaryOpen(!isSummaryOpen)}
                                        className="w-full flex items-center justify-between p-4 bg-indigo-50/50 hover:bg-indigo-50 transition text-left group"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="bg-indigo-100 p-2 rounded-lg text-indigo-600 group-hover:bg-indigo-200 transition">
                                                <span className="material-symbols-outlined text-xl">smart_toy</span>
                                            </div>
                                            <div>
                                                <span className="font-bold text-indigo-900 block">Resumen IA</span>
                                                <span className="text-xs text-indigo-600/70">Generado automáticamente del material adjunto</span>
                                            </div>
                                        </div>
                                        <span className={`material-symbols-outlined text-indigo-400 transition-transform duration-300 ${isSummaryOpen ? 'rotate-180' : ''}`}>
                                            expand_more
                                        </span>
                                    </button>

                                    {isSummaryOpen && (
                                        <div className="p-6 border-t border-indigo-100 bg-white animate-in slide-in-from-top-2 duration-200">
                                            <div className="whitespace-pre-wrap text-slate-700">
                                                {aiSummary}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Attachments */}
                        {item.attachments && item.attachments.length > 0 && (
                            <div className="mt-8">
                                <h3 className="text-lg font-bold text-slate-900 mb-4">Recursos Adjuntos</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {item.attachments.map((att: any, idx: number) => (
                                        <a
                                            key={idx}
                                            href={att.url || '#'}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-3 p-4 border border-slate-200 rounded-xl hover:border-primary hover:shadow-md transition bg-white group"
                                        >
                                            <div className="bg-slate-100 p-2 rounded-lg text-slate-500 group-hover:bg-primary/10 group-hover:text-primary transition">
                                                <span className="material-symbols-outlined">description</span>
                                            </div>
                                            <div className="overflow-hidden">
                                                <p className="font-medium text-slate-900 truncate">{att.title || att.name || 'Archivo'}</p>
                                                <p className="text-xs text-slate-500">Click para abrir</p>
                                            </div>
                                            <span className="material-symbols-outlined ml-auto text-slate-300 group-hover:text-primary">open_in_new</span>
                                        </a>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right Column: Actions (Submission, etc) */}
                    <div className="lg:col-span-1">
                        {!isTeacher && item.type === 'assignment' && (
                            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200 sticky top-24">
                                <h3 className="font-bold text-slate-900 mb-4 text-lg">Tu Entrega</h3>
                                {!submission ? (
                                    <div className="space-y-4">
                                        <p className="text-sm text-slate-600">No has empezado esta tarea.</p>
                                        <button
                                            onClick={handleStartAssignment}
                                            disabled={submitting}
                                            className="w-full bg-primary text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition shadow-lg shadow-blue-900/20 disabled:opacity-50"
                                        >
                                            {submitting ? 'Iniciando...' : 'Empezar Tarea'}
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <div className={`p-3 rounded-lg border text-center ${submission.status === 'graded' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                                            submission.status === 'turned_in' ? 'bg-blue-50 border-blue-200 text-blue-700' :
                                                'bg-amber-50 border-amber-200 text-amber-700'
                                            }`}>
                                            <p className="font-bold capitalize mb-1">
                                                {submission.status === 'graded' ? 'Calificado' :
                                                    submission.status === 'turned_in' ? 'Entregado' :
                                                        submission.status === 'in_progress' ? 'En Progreso' : 'Asignado'}
                                            </p>
                                            {submission.grade !== undefined && submission.grade !== null && (
                                                <p className="text-2xl font-black">{submission.grade}/{item.points}</p>
                                            )}
                                        </div>

                                        {(submission.status === 'in_progress' || submission.status === 'assigned' || submission.status === 'returned') && (
                                            <div className="space-y-3">
                                                <button
                                                    onClick={() => {
                                                        setSubmissionText(submission.text_response || '');
                                                        setSubmissionLink(submission.link_response || '');
                                                        setIsSubmissionModalOpen(true);
                                                    }}
                                                    className="w-full bg-white border border-slate-300 font-bold py-2.5 rounded-xl hover:bg-slate-50 transition text-slate-700 shadow-sm"
                                                >
                                                    {submission.status === 'returned' ? 'Reenviar Tarea' : 'Editar Entrega'}
                                                </button>
                                            </div>
                                        )}

                                        {/* Display attached info summary if exists */}
                                        {submission.attachments?.length > 0 && (
                                            <div className="text-xs text-slate-500 mt-2">
                                                <p className="font-bold">Adjuntos:</p>
                                                <ul className="list-disc list-inside">
                                                    {submission.attachments.map((a: any, i: number) => (
                                                        <li key={i} className="truncate">{a.title}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Teacher Sidebar Info (Stats could go here) */}
                        {isTeacher && (
                            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200 sticky top-24">
                                <h3 className="font-bold text-slate-900 mb-4 text-lg">Gestión</h3>
                                <div className="space-y-2">
                                    <button
                                        onClick={handleViewSubmissions}
                                        className="w-full text-left px-4 py-3 bg-white border border-slate-200 rounded-xl hover:border-primary hover:text-primary transition font-medium flex justify-between items-center group"
                                    >
                                        <span>Ver Entregas</span>
                                        <span className="material-symbols-outlined text-slate-400 group-hover:text-primary">visibility</span>
                                    </button>
                                    <button
                                        onClick={handleViewSubmissions}
                                        className="w-full text-left px-4 py-3 bg-white border border-slate-200 rounded-xl hover:border-primary hover:text-primary transition font-medium flex justify-between items-center group"
                                    >
                                        <span>Calificar</span>
                                        <span className="material-symbols-outlined text-slate-400 group-hover:text-primary">grading</span>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            {/* Student Submission Modal */}
            {isSubmissionModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-8">
                            <h2 className="text-2xl font-black text-slate-900 mb-6">Entrega de Tarea</h2>

                            <div className="space-y-6">
                                {/* Text Response */}
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Respuesta de Texto</label>
                                    <textarea
                                        value={submissionText}
                                        onChange={(e) => setSubmissionText(e.target.value)}
                                        placeholder="Escribe tu respuesta aquí..."
                                        rows={4}
                                        className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none"
                                    />
                                </div>

                                {/* Link Response */}
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Enlace (Link)</label>
                                    <input
                                        type="url"
                                        value={submissionLink}
                                        onChange={(e) => setSubmissionLink(e.target.value)}
                                        placeholder="https://..."
                                        className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                                    />
                                </div>

                                {/* File Attachment */}
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Adjuntar Archivo</label>
                                    <div className="flex items-center justify-center w-full">
                                        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-300 border-dashed rounded-xl cursor-pointer bg-slate-50 hover:bg-slate-100 transition">
                                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                                <span className="material-symbols-outlined text-3xl text-slate-400 mb-2">cloud_upload</span>
                                                <p className="mb-2 text-sm text-slate-500"><span className="font-semibold">Click para subir</span></p>
                                                <p className="text-xs text-slate-500">{submissionFile ? submissionFile.name : 'PDF, DOCX, PNG, JPG'}</p>
                                            </div>
                                            <input
                                                type="file"
                                                className="hidden"
                                                onChange={(e) => {
                                                    if (e.target.files && e.target.files[0]) {
                                                        setSubmissionFile(e.target.files[0]);
                                                    }
                                                }}
                                            />
                                        </label>
                                    </div>
                                    {submissionFile && (
                                        <div className="mt-2 flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 p-2 rounded-lg">
                                            <span className="material-symbols-outlined text-base">check_circle</span>
                                            <span className="truncate">{submissionFile.name}</span>
                                            <button onClick={() => setSubmissionFile(null)} className="ml-auto text-slate-400 hover:text-rose-500">
                                                <span className="material-symbols-outlined text-base">close</span>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="bg-slate-50 p-6 flex justify-end gap-3 border-t border-slate-100">
                            <button
                                onClick={() => setIsSubmissionModalOpen(false)}
                                className="px-5 py-2.5 text-slate-600 font-bold hover:bg-slate-200 rounded-xl transition"
                                disabled={submitting}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSubmitWork}
                                disabled={submitting}
                                className="bg-primary text-white font-bold px-6 py-2.5 rounded-xl hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-blue-900/20"
                            >
                                {submitting ? 'Entregando...' : 'Entregar Tarea'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Teacher Grading Modal */}
            {isTeacher && isGradingModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <h2 className="text-2xl font-black text-slate-900">Entregas de Estudiantes</h2>
                            <button onClick={() => setIsGradingModalOpen(false)} className="bg-slate-200 p-2 rounded-full hover:bg-slate-300 transition">
                                <span className="material-symbols-outlined text-slate-600">close</span>
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6">
                            {submissionsList.length === 0 ? (
                                <div className="text-center py-20 text-slate-500">
                                    <span className="material-symbols-outlined text-5xl mb-4 text-slate-300">inbox</span>
                                    <p>No hay entregas aún.</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {submissionsList.map((sub) => (
                                        <div key={sub.id} className="border border-slate-200 rounded-xl p-5 hover:border-blue-200 transition bg-white shadow-sm">
                                            <div className="flex justify-between items-start mb-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden">
                                                        {sub.student?.avatar_url ? (
                                                            <img src={sub.student.avatar_url} alt="Av" className="w-full h-full object-cover" />
                                                        ) : (
                                                            <span className="material-symbols-outlined text-slate-400">person</span>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-slate-900">{sub.student?.full_name || 'Estudiante'}</p>
                                                        <p className="text-xs text-slate-500">{new Date(sub.submitted_at || sub.created_at).toLocaleString()}</p>
                                                    </div>
                                                </div>
                                                <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${sub.status === 'graded' ? 'bg-emerald-100 text-emerald-700' :
                                                    sub.status === 'turned_in' ? 'bg-blue-100 text-blue-700' :
                                                        'bg-amber-100 text-amber-700'
                                                    }`}>
                                                    {sub.status === 'graded' ? 'Calificado' : sub.status === 'turned_in' ? 'Entregado' : 'En Progreso'}
                                                </div>
                                            </div>

                                            {/* Submission Content */}
                                            <div className="mb-4 bg-slate-50 p-4 rounded-lg text-sm">
                                                {sub.text_response && <p className="mb-2 whitespace-pre-wrap text-slate-700">{sub.text_response}</p>}
                                                {sub.link_response && (
                                                    <a href={sub.link_response} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-blue-600 hover:underline mb-2">
                                                        <span className="material-symbols-outlined text-base">link</span>
                                                        <span className="truncate">{sub.link_response}</span>
                                                    </a>
                                                )}
                                                {sub.attachments && sub.attachments.length > 0 && (
                                                    <div className="flex flex-wrap gap-2 mt-2">
                                                        {sub.attachments.map((att: any, idx: number) => (
                                                            <a key={idx} href={att.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium hover:border-primary hover:text-primary transition text-slate-700">
                                                                <span className="material-symbols-outlined text-sm">attachment</span>
                                                                <span className="truncate max-w-[150px]">{att.title || 'Archivo'}</span>
                                                            </a>
                                                        ))}
                                                    </div>
                                                )}
                                                {!sub.text_response && !sub.link_response && (!sub.attachments || sub.attachments.length === 0) && (
                                                    <p className="text-slate-400 italic">Sin contenido.</p>
                                                )}
                                            </div>

                                            {/* Grading Input */}
                                            <div className="flex items-center gap-4 border-t border-slate-100 pt-4">
                                                <div className="flex-1">
                                                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Calificación (/{item.points})</label>
                                                    <div className="flex items-center gap-2">
                                                        <input
                                                            type="number"
                                                            defaultValue={sub.grade}
                                                            placeholder="-"
                                                            className="w-24 px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-slate-900 font-bold"
                                                            onBlur={(e) => {
                                                                const val = parseFloat(e.target.value);
                                                                if (!isNaN(val)) handleGradeSubmission(sub.id, val);
                                                            }}
                                                        />
                                                        {sub.grade !== null && sub.grade !== undefined && <span className="material-symbols-outlined text-emerald-500 animate-in fade-in">check_circle</span>}
                                                    </div>
                                                </div>
                                                <div className="flex-1">
                                                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Feedback</label>
                                                    <input
                                                        type="text"
                                                        placeholder="Opcional..."
                                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ClassItemDetail;
