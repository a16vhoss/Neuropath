import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext'; // Assuming context path
import {
    getAssignment,
    getAssignmentSubmissions,
    submitAssignment,
    updateAssignment
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

    useEffect(() => {
        loadItem();
    }, [itemId]);

    const loadItem = async () => {
        if (!itemId) return;
        setLoading(true);
        try {
            // We need a specific getAssignment function or filter from list
            // Assuming getClassAssignments can filter or we fetch all and find
            // Better to add getAssignmentById in service if not exists.
            // For now, I'll assume we can fetch it. I will implement getAssignmentById in service.

            // Temporary: Fetch all and find (Optimization: Add getAssignmentById later)
            // Actually, let's try to see if we can use a direct query in the component 
            // or better, update ClassroomService. 
            // Using a placeholder fetch for now.
            // Using a placeholder fetch for now.
            const itemData = await getAssignment(itemId);
            setItem(itemData);

            // Load submission if student
            if (!isTeacher) {
                // Fetch submission logic
            }

        } catch (err: any) {
            console.error(err);
            setError('Error al cargar el contenido module.');
        } finally {
            setLoading(false);
        }
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
    };

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
                        <button className="bg-primary text-white px-4 py-2 rounded-lg font-bold hover:bg-blue-700 transition">
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

                        {/* Description */}
                        <div className="prose prose-slate max-w-none">
                            <h3 className="text-lg font-bold text-slate-900 mb-4">Descripción</h3>
                            <div className="whitespace-pre-wrap text-slate-700 leading-relaxed">
                                {item.description || 'Sin descripción.'}
                            </div>
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
                                {submission ? (
                                    <div className="space-y-4">
                                        <div className={`p-3 rounded-lg border text-center ${submission.status === 'graded' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                                            submission.status === 'submitted' ? 'bg-blue-50 border-blue-200 text-blue-700' :
                                                'bg-slate-100 border-slate-200 text-slate-600'
                                            }`}>
                                            <p className="font-bold capitalize">{submission.status === 'submitted' ? 'Entregado' : submission.status}</p>
                                            {submission.grade && <p className="text-2xl font-black mt-1">{submission.grade}/{item.points}</p>}
                                        </div>
                                        <button className="w-full bg-white border border-slate-300 font-bold py-2.5 rounded-xl hover:bg-slate-50 transition text-slate-700">
                                            Ver Detalles
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <p className="text-sm text-slate-600">No has entregado esta tarea.</p>
                                        <button className="w-full bg-primary text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition shadow-lg shadow-blue-900/20">
                                            Empezar Tarea
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Teacher Sidebar Info (Stats could go here) */}
                        {isTeacher && (
                            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200 sticky top-24">
                                <h3 className="font-bold text-slate-900 mb-4 text-lg">Gestión</h3>
                                <div className="space-y-2">
                                    <button className="w-full text-left px-4 py-3 bg-white border border-slate-200 rounded-xl hover:border-primary hover:text-primary transition font-medium flex justify-between items-center group">
                                        <span>Ver Entregas</span>
                                        <span className="bg-slate-100 px-2 py-0.5 rounded-md text-xs text-slate-600 group-hover:bg-primary/10 group-hover:text-primary">12/24</span>
                                    </button>
                                    <button className="w-full text-left px-4 py-3 bg-white border border-slate-200 rounded-xl hover:border-primary hover:text-primary transition font-medium">
                                        Calificar (SpeedGrader)
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ClassItemDetail;
