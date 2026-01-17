
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase, getClassMaterials, getClassEnrollments, uploadMaterial } from '../services/supabaseClient';
import { generateFlashcardsFromText, generateQuizFromText, extractTextFromPDF } from '../services/pdfProcessingService';
import StudentProgressModal from '../components/StudentProgressModal';

interface Material {
    id: string;
    name: string;
    type: 'pdf' | 'video' | 'pptx' | 'link';
    status: 'processing' | 'ready' | 'error';
    uploadedAt: string;
    generatedContent: { flashcards: number; quizzes: number; guides: number };
}

interface Student {
    id: string;
    name: string;
    email: string;
    avatar: string;
    progress: number;
    lastActive: string;
    status: 'ok' | 'risk' | 'inactive';
}

interface ClassData {
    id: string;
    name: string;
    code: string;
    topics: string[];
}

interface Exam {
    id: string;
    title: string;
    type: 'exam' | 'quiz' | 'practice';
    created_at: string;
    question_count: number;
}

const TeacherClassDetail: React.FC = () => {
    const { classId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();

    const [classData, setClassData] = useState<ClassData | null>(null);
    const [activeTab, setActiveTab] = useState<'overview' | 'materials' | 'students' | 'exams'>('overview');
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [showExamModal, setShowExamModal] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadStatus, setUploadStatus] = useState<'uploading' | 'processing' | 'done' | 'error'>('uploading');
    const [studentFilter, setStudentFilter] = useState<'all' | 'risk' | 'inactive'>('all');

    const [materials, setMaterials] = useState<Material[]>([]);
    const [students, setStudents] = useState<Student[]>([]);
    const [loadingMaterials, setLoadingMaterials] = useState(true);
    const [loadingStudents, setLoadingStudents] = useState(true);
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

    // Exam state
    const [exams, setExams] = useState<Exam[]>([]);
    const [loadingExams, setLoadingExams] = useState(true);
    const [examForm, setExamForm] = useState({ name: '', date: '', type: 'exam' as 'exam' | 'quiz' | 'practice', topics: [] as string[] });
    const [creatingExam, setCreatingExam] = useState(false);

    // Load class data
    useEffect(() => {
        const loadClassData = async () => {
            if (!classId) return;

            try {
                // Get class info
                const { data: cls } = await supabase
                    .from('classes')
                    .select('id, name, code, topics')
                    .eq('id', classId)
                    .single();

                if (cls) {
                    setClassData(cls);
                }

                // Get materials
                setLoadingMaterials(true);
                const mats = await getClassMaterials(classId);
                if (mats) {
                    setMaterials(mats.map((m: any) => ({
                        id: m.id,
                        name: m.name,
                        type: m.type || 'pdf',
                        status: m.status || 'ready',
                        uploadedAt: new Date(m.created_at).toLocaleDateString(),
                        generatedContent: {
                            flashcards: m.flashcard_count || 0,
                            quizzes: m.quiz_count || 0,
                            guides: 0
                        }
                    })));
                }
                setLoadingMaterials(false);

                // Get enrolled students
                setLoadingStudents(true);
                const enrollments = await getClassEnrollments(classId);
                if (enrollments) {
                    setStudents(enrollments.map((e: any) => ({
                        id: e.profiles?.id || e.student_id,
                        name: e.profiles?.full_name || 'Estudiante',
                        email: e.profiles?.email || '',
                        avatar: e.student_id.slice(0, 8),
                        progress: e.progress || 0,
                        lastActive: e.profiles?.updated_at
                            ? getTimeAgo(new Date(e.profiles.updated_at))
                            : 'Desconocido',
                        status: e.progress < 30 ? 'risk' : e.progress < 50 ? 'inactive' : 'ok'
                    })));
                }
                setLoadingStudents(false);
            } catch (error) {
                console.error('Error loading class data:', error);
                setLoadingMaterials(false);
                setLoadingStudents(false);
            }
        };

        loadClassData();
    }, [classId]);

    // Load exams
    useEffect(() => {
        const loadExams = async () => {
            if (!classId) return;
            setLoadingExams(true);
            try {
                const { data } = await supabase
                    .from('quizzes')
                    .select('id, title, material_id, created_at')
                    .eq('class_id', classId)
                    .order('created_at', { ascending: false });

                if (data) {
                    // Get question counts
                    const examsWithCounts = await Promise.all(data.map(async (exam) => {
                        const { count } = await supabase
                            .from('quiz_questions')
                            .select('*', { count: 'exact', head: true })
                            .eq('quiz_id', exam.id);
                        return {
                            id: exam.id,
                            title: exam.title,
                            type: 'exam' as const,
                            created_at: new Date(exam.created_at).toLocaleDateString(),
                            question_count: count || 0
                        };
                    }));
                    setExams(examsWithCounts);
                }
            } catch (error) {
                console.error('Error loading exams:', error);
            } finally {
                setLoadingExams(false);
            }
        };
        loadExams();
    }, [classId]);

    // Create exam handler
    const handleCreateExam = async () => {
        if (!classId || !examForm.name) return;
        setCreatingExam(true);
        try {
            const { data: newExam, error } = await supabase
                .from('quizzes')
                .insert({
                    class_id: classId,
                    title: examForm.name,
                    material_id: null
                })
                .select()
                .single();

            if (error) throw error;

            // Refresh exams list
            setExams(prev => [{
                id: newExam.id,
                title: newExam.title,
                type: 'exam',
                created_at: new Date().toLocaleDateString(),
                question_count: 0
            }, ...prev]);

            setShowExamModal(false);
            setExamForm({ name: '', date: '', type: 'exam', topics: [] });
        } catch (error) {
            console.error('Error creating exam:', error);
        } finally {
            setCreatingExam(false);
        }
    };

    const getTimeAgo = (date: Date): string => {
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const days = Math.floor(hours / 24);

        if (hours < 1) return 'Hace menos de 1 hora';
        if (hours < 24) return `Hace ${hours} horas`;
        if (days === 1) return 'Hace 1 día';
        return `Hace ${days} días`;
    };

    // Handle PDF upload and processing
    const handleUpload = async (files: FileList | null) => {
        if (!files || files.length === 0 || !classId || !user) return;

        const file = files[0];
        setIsUploading(true);
        setUploadStatus('uploading');
        setUploadProgress(10);

        try {
            // Step 1: Upload file to Supabase Storage
            const fileName = `${classId}/${Date.now()}_${file.name}`;
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('materials')
                .upload(fileName, file);

            if (uploadError) throw uploadError;
            setUploadProgress(30);

            // Step 2: Create material record
            const { data: materialRecord, error: materialError } = await supabase
                .from('materials')
                .insert({
                    class_id: classId,
                    name: file.name,
                    type: file.type.includes('pdf') ? 'pdf' :
                        file.type.includes('video') ? 'video' :
                            file.type.includes('presentation') ? 'pptx' : 'other',
                    file_url: uploadData?.path,
                    status: 'processing'
                })
                .select()
                .single();

            if (materialError) throw materialError;
            setUploadProgress(40);
            setUploadStatus('processing');

            // Step 3: Read file as base64 for processing
            const reader = new FileReader();
            reader.onload = async (e) => {
                const base64 = (e.target?.result as string)?.split(',')[1];
                if (!base64) {
                    setUploadStatus('error');
                    return;
                }

                setUploadProgress(50);

                try {
                    // Step 4: Extract text from PDF using Gemini
                    const extractedText = await extractTextFromPDF(base64);
                    setUploadProgress(60);

                    if (!extractedText) {
                        throw new Error('Could not extract text from PDF');
                    }

                    // Step 5: Generate flashcards
                    const topic = classData?.topics?.[0] || classData?.name || 'General';
                    const flashcards = await generateFlashcardsFromText(extractedText, topic, 15);
                    setUploadProgress(75);

                    // Step 6: Save flashcards to database
                    let flashcardCount = 0;
                    if (flashcards && flashcards.length > 0) {
                        for (const card of flashcards) {
                            await supabase.from('flashcards').insert({
                                class_id: classId,
                                material_id: materialRecord.id,
                                question: card.question,
                                answer: card.answer,
                                category: card.category,
                                difficulty: 1
                            });
                            flashcardCount++;
                        }
                    }
                    setUploadProgress(85);

                    // Step 7: Generate quiz questions
                    const quizQuestions = await generateQuizFromText(extractedText, topic, 5);
                    setUploadProgress(90);

                    // Step 8: Save quiz if a quiz record exists
                    let quizCount = 0;
                    if (quizQuestions && quizQuestions.length > 0) {
                        // Create a quiz for this material
                        const { data: quizRecord } = await supabase
                            .from('quizzes')
                            .insert({
                                class_id: classId,
                                title: `Quiz: ${file.name.replace('.pdf', '')}`,
                                material_id: materialRecord.id
                            })
                            .select()
                            .single();

                        if (quizRecord) {
                            for (const q of quizQuestions) {
                                await supabase.from('quiz_questions').insert({
                                    quiz_id: quizRecord.id,
                                    question: q.question,
                                    options: q.options,
                                    correct_index: q.correctIndex,
                                    explanation: q.explanation
                                });
                                quizCount++;
                            }
                        }
                    }

                    // Step 9: Update material status
                    await supabase
                        .from('materials')
                        .update({
                            status: 'ready',
                            flashcard_count: flashcardCount,
                            quiz_count: quizCount,
                            content_text: extractedText // Save for AI Tutor
                        })
                        .eq('id', materialRecord.id);

                    setUploadProgress(100);
                    setUploadStatus('done');

                    // Refresh materials list
                    const mats = await getClassMaterials(classId);
                    if (mats) {
                        setMaterials(mats.map((m: any) => ({
                            id: m.id,
                            name: m.name,
                            type: m.type || 'pdf',
                            status: m.status || 'ready',
                            uploadedAt: new Date(m.created_at).toLocaleDateString(),
                            generatedContent: {
                                flashcards: m.flashcard_count || 0,
                                quizzes: m.quiz_count || 0,
                                guides: 0
                            }
                        })));
                    }

                    setTimeout(() => {
                        setIsUploading(false);
                        setUploadProgress(0);
                        setShowUploadModal(false);
                    }, 1500);

                } catch (processingError) {
                    console.error('Error processing PDF:', processingError);
                    // Update material status to error
                    await supabase
                        .from('materials')
                        .update({ status: 'error' })
                        .eq('id', materialRecord.id);
                    setUploadStatus('error');
                }
            };

            reader.readAsDataURL(file);

        } catch (error) {
            console.error('Error uploading file:', error);
            setUploadStatus('error');
            setTimeout(() => {
                setIsUploading(false);
                setUploadProgress(0);
            }, 2000);
        }
    };

    const filteredStudents = students.filter(s =>
        studentFilter === 'all' ? true :
            studentFilter === 'risk' ? s.status === 'risk' :
                s.status === 'inactive'
    );

    // Stats calculations
    const totalStudents = students.length;
    const avgProgress = students.length > 0
        ? Math.round(students.reduce((sum, s) => sum + s.progress, 0) / students.length)
        : 0;
    const atRiskCount = students.filter(s => s.status === 'risk').length;

    return (
        <div className="min-h-screen bg-[#F9FAFB] flex flex-col md:flex-row">
            {/* Sidebar */}
            <aside className="w-full md:w-64 bg-white border-r border-slate-200 flex flex-col">
                <div className="p-6 flex items-center gap-2 border-b border-slate-100">
                    <span className="material-symbols-outlined text-primary text-3xl font-bold">neurology</span>
                    <span className="font-extrabold text-xl tracking-tighter text-slate-900">NEUROPATH</span>
                </div>
                <nav className="flex-1 p-4 space-y-2">
                    <div onClick={() => navigate('/teacher')} className="text-slate-600 p-3 rounded-lg flex items-center gap-3 font-medium hover:bg-slate-50 cursor-pointer">
                        <span className="material-symbols-outlined">arrow_back</span> Volver
                    </div>
                    <div className="border-t border-slate-100 my-4"></div>
                    {[
                        { id: 'overview', icon: 'dashboard', label: 'Resumen' },
                        { id: 'materials', icon: 'folder', label: 'Materiales' },
                        { id: 'students', icon: 'groups', label: 'Estudiantes' },
                        { id: 'exams', icon: 'assignment', label: 'Exámenes' }
                    ].map((item) => (
                        <div
                            key={item.id}
                            onClick={() => setActiveTab(item.id as any)}
                            className={`p-3 rounded-lg flex items-center gap-3 font-medium cursor-pointer transition-colors ${activeTab === item.id ? 'bg-primary/5 text-primary' : 'text-slate-600 hover:bg-slate-50'
                                }`}
                        >
                            <span className="material-symbols-outlined">{item.icon}</span> {item.label}
                        </div>
                    ))}
                </nav>
            </aside>

            {/* Main Content */}
            <main className="flex-1 p-6 md:p-10 space-y-8 overflow-y-auto">
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight">
                            {classData?.name || 'Cargando...'}
                        </h1>
                        <p className="text-slate-500">
                            Código: <span className="font-mono bg-slate-100 px-2 py-0.5 rounded">{classData?.code || '---'}</span>
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={() => navigate(`/teacher/analytics/${classId}`)}
                            className="px-4 py-2 rounded-lg border border-slate-200 font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-2"
                        >
                            <span className="material-symbols-outlined text-lg">analytics</span> Ver Analíticas
                        </button>
                    </div>
                </header>

                {/* Overview Tab */}
                {activeTab === 'overview' && (
                    <div className="space-y-8">
                        {/* Quick Stats */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {[
                                { label: 'Estudiantes', value: totalStudents.toString(), icon: 'groups', color: 'blue' },
                                { label: 'Progreso Promedio', value: `${avgProgress}%`, icon: 'trending_up', color: 'emerald' },
                                { label: 'Materiales', value: materials.length.toString(), icon: 'folder', color: 'violet' },
                                { label: 'En Riesgo', value: atRiskCount.toString(), icon: 'warning', color: 'rose' }
                            ].map((stat, i) => (
                                <div key={i} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white ${stat.color === 'blue' ? 'bg-blue-500' : stat.color === 'emerald' ? 'bg-emerald-500' : stat.color === 'violet' ? 'bg-violet-500' : 'bg-rose-500'
                                        }`}>
                                        <span className="material-symbols-outlined text-lg">{stat.icon}</span>
                                    </div>
                                    <div>
                                        <p className="text-2xl font-black text-slate-900">{stat.value}</p>
                                        <p className="text-xs text-slate-500">{stat.label}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Topics */}
                        {classData?.topics && classData.topics.length > 0 && (
                            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                                <h3 className="font-bold text-lg mb-4">Temas del Curso</h3>
                                <div className="flex flex-wrap gap-2">
                                    {classData.topics.map((topic, i) => (
                                        <span key={i} className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-medium">
                                            {topic}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Empty state */}
                        {materials.length === 0 && students.length === 0 && (
                            <div className="bg-blue-50 border border-blue-100 p-8 rounded-2xl text-center">
                                <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                    <span className="material-symbols-outlined text-3xl text-blue-600">upload_file</span>
                                </div>
                                <h3 className="font-bold text-blue-700 mb-2 text-xl">¡Comienza subiendo tu primer material!</h3>
                                <p className="text-blue-600 mb-6">Sube un PDF y la IA generará flashcards y quizzes automáticamente.</p>
                                <button
                                    onClick={() => setShowUploadModal(true)}
                                    className="bg-primary text-white font-bold px-8 py-3 rounded-xl hover:bg-blue-700 transition-all"
                                >
                                    Subir Material
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Materials Tab */}
                {activeTab === 'materials' && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center">
                            <h2 className="text-xl font-bold">Materiales del Curso</h2>
                            <button
                                onClick={() => setShowUploadModal(true)}
                                className="bg-primary text-white font-bold px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700"
                            >
                                <span className="material-symbols-outlined text-lg">upload</span> Subir Material
                            </button>
                        </div>

                        {loadingMaterials ? (
                            <div className="grid gap-4">
                                {[1, 2].map((i) => (
                                    <div key={i} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm animate-pulse">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-xl bg-slate-200"></div>
                                            <div className="flex-1">
                                                <div className="h-5 bg-slate-200 rounded w-3/4 mb-2"></div>
                                                <div className="h-3 bg-slate-100 rounded w-1/2"></div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : materials.length > 0 ? (
                            <div className="grid gap-4">
                                {materials.map((material) => (
                                    <div key={material.id} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${material.type === 'pdf' ? 'bg-rose-100 text-rose-600' :
                                            material.type === 'video' ? 'bg-violet-100 text-violet-600' :
                                                'bg-amber-100 text-amber-600'
                                            }`}>
                                            <span className="material-symbols-outlined text-2xl">
                                                {material.type === 'pdf' ? 'picture_as_pdf' : material.type === 'video' ? 'videocam' : 'slideshow'}
                                            </span>
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="font-bold text-slate-900">{material.name}</h3>
                                            <p className="text-sm text-slate-500">Subido: {material.uploadedAt}</p>
                                            {material.status === 'ready' && (
                                                <div className="flex gap-4 mt-2 text-xs">
                                                    <span className="text-blue-600">{material.generatedContent.flashcards} flashcards</span>
                                                    <span className="text-violet-600">{material.generatedContent.quizzes} quizzes</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-3">
                                            {material.status === 'processing' ? (
                                                <div className="flex items-center gap-2 text-amber-600">
                                                    <div className="w-4 h-4 border-2 border-amber-600 border-t-transparent rounded-full animate-spin"></div>
                                                    <span className="text-sm font-medium">Procesando...</span>
                                                </div>
                                            ) : material.status === 'ready' ? (
                                                <span className="bg-emerald-100 text-emerald-600 text-xs font-bold px-3 py-1 rounded-full">Listo</span>
                                            ) : (
                                                <span className="bg-rose-100 text-rose-600 text-xs font-bold px-3 py-1 rounded-full">Error</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="bg-slate-50 p-12 rounded-2xl text-center">
                                <span className="material-symbols-outlined text-4xl text-slate-300 mb-4">folder_open</span>
                                <p className="text-slate-500 mb-4">No hay materiales subidos aún</p>
                                <button
                                    onClick={() => setShowUploadModal(true)}
                                    className="bg-primary text-white font-bold px-6 py-2 rounded-xl hover:bg-blue-700"
                                >
                                    Subir Primer Material
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Students Tab */}
                {activeTab === 'students' && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center">
                            <h2 className="text-xl font-bold">Estudiantes ({students.length})</h2>
                            <div className="flex gap-2">
                                {['all', 'risk', 'inactive'].map((filter) => (
                                    <button
                                        key={filter}
                                        onClick={() => setStudentFilter(filter as any)}
                                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${studentFilter === filter ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                            }`}
                                    >
                                        {filter === 'all' ? 'Todos' : filter === 'risk' ? 'En Riesgo' : 'Inactivos'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {loadingStudents ? (
                            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 animate-pulse">
                                <div className="space-y-4">
                                    {[1, 2, 3].map((i) => (
                                        <div key={i} className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-full bg-slate-200"></div>
                                            <div className="flex-1">
                                                <div className="h-4 bg-slate-200 rounded w-1/3"></div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : students.length > 0 ? (
                            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                                <table className="w-full">
                                    <thead>
                                        <tr className="bg-slate-50 text-xs font-bold text-slate-500 uppercase tracking-wide">
                                            <th className="p-4 text-left">Estudiante</th>
                                            <th className="p-4 text-left">Email</th>
                                            <th className="p-4 text-center">Progreso</th>
                                            <th className="p-4 text-left">Última Actividad</th>
                                            <th className="p-4 text-center">Estado</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {filteredStudents.map((student) => (
                                            <tr key={student.id} onClick={() => setSelectedStudent(student)} className="hover:bg-slate-50 transition-colors cursor-pointer">
                                                <td className="p-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                                            <span className="material-symbols-outlined text-primary">person</span>
                                                        </div>
                                                        <span className="font-bold text-slate-900">{student.name}</span>
                                                    </div>
                                                </td>
                                                <td className="p-4 text-slate-600 text-sm">{student.email}</td>
                                                <td className="p-4">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <div className="w-20 h-2 bg-slate-100 rounded-full overflow-hidden">
                                                            <div
                                                                className={`h-full rounded-full ${student.progress >= 70 ? 'bg-emerald-500' : student.progress >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                                                                    }`}
                                                                style={{ width: `${student.progress}%` }}
                                                            ></div>
                                                        </div>
                                                        <span className={`text-sm font-bold ${student.progress >= 70 ? 'text-emerald-600' : student.progress >= 50 ? 'text-amber-600' : 'text-rose-600'
                                                            }`}>{student.progress}%</span>
                                                    </div>
                                                </td>
                                                <td className="p-4 text-slate-500 text-sm">{student.lastActive}</td>
                                                <td className="p-4 text-center">
                                                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${student.status === 'ok' ? 'bg-emerald-100 text-emerald-600' :
                                                        student.status === 'risk' ? 'bg-rose-100 text-rose-600' :
                                                            'bg-slate-100 text-slate-600'
                                                        }`}>
                                                        {student.status === 'ok' ? 'OK' : student.status === 'risk' ? 'Riesgo' : 'Inactivo'}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="bg-slate-50 p-12 rounded-2xl text-center">
                                <span className="material-symbols-outlined text-4xl text-slate-300 mb-4">groups</span>
                                <p className="text-slate-500">No hay estudiantes inscritos aún</p>
                                <p className="text-sm text-slate-400 mt-2">Comparte el código <strong>{classData?.code}</strong> con tus estudiantes</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Exams Tab */}
                {activeTab === 'exams' && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center">
                            <h2 className="text-xl font-bold">Gestión de Exámenes</h2>
                            <button
                                onClick={() => setShowExamModal(true)}
                                className="bg-primary text-white font-bold px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700"
                            >
                                <span className="material-symbols-outlined text-lg">add</span> Crear Examen
                            </button>
                        </div>

                        {loadingExams ? (
                            <div className="grid gap-4">
                                {[1, 2].map((i) => (
                                    <div key={i} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm animate-pulse">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-xl bg-slate-200"></div>
                                            <div className="flex-1">
                                                <div className="h-5 bg-slate-200 rounded w-3/4 mb-2"></div>
                                                <div className="h-3 bg-slate-100 rounded w-1/2"></div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : exams.length > 0 ? (
                            <div className="grid gap-4">
                                {exams.map((exam) => (
                                    <div key={exam.id} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-xl bg-violet-100 text-violet-600 flex items-center justify-center">
                                            <span className="material-symbols-outlined text-2xl">assignment</span>
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="font-bold text-slate-900">{exam.title}</h3>
                                            <p className="text-sm text-slate-500">Creado: {exam.created_at}</p>
                                            <p className="text-xs text-violet-600 mt-1">{exam.question_count} preguntas</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="bg-violet-100 text-violet-600 text-xs font-bold px-3 py-1 rounded-full capitalize">
                                                {exam.type}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="bg-slate-50 p-12 rounded-2xl text-center">
                                <span className="material-symbols-outlined text-4xl text-slate-300 mb-4">assignment</span>
                                <p className="text-slate-500 mb-4">No hay exámenes creados aún</p>
                                <button
                                    onClick={() => setShowExamModal(true)}
                                    className="bg-primary text-white font-bold px-6 py-2 rounded-xl hover:bg-blue-700"
                                >
                                    Crear Primer Examen
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </main>

            {/* Upload Modal */}
            {showUploadModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden">
                        <div className="p-8">
                            <h2 className="text-2xl font-black text-slate-900 mb-2">Subir Material</h2>
                            <p className="text-slate-500 mb-6">La IA procesará tu archivo y generará flashcards y quizzes automáticamente.</p>

                            {!isUploading ? (
                                <label className="block border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-all">
                                    <span className="material-symbols-outlined text-4xl text-slate-400 mb-4">cloud_upload</span>
                                    <p className="font-bold text-slate-700">Arrastra archivos aquí o haz clic para seleccionar</p>
                                    <p className="text-sm text-slate-500 mt-2">PDF, PPTX, DOCX</p>
                                    <input
                                        type="file"
                                        className="hidden"
                                        onChange={(e) => handleUpload(e.target.files)}
                                        accept=".pdf,.pptx,.docx"
                                    />
                                </label>
                            ) : (
                                <div className="text-center py-8">
                                    <div className="w-16 h-16 mx-auto mb-4">
                                        <div className="w-full h-full border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                                    </div>
                                    <p className="font-bold text-slate-900 mb-2">
                                        {uploadStatus === 'uploading' && 'Subiendo archivo...'}
                                        {uploadStatus === 'processing' && '🤖 IA procesando contenido...'}
                                        {uploadStatus === 'done' && '✅ ¡Procesamiento completado!'}
                                        {uploadStatus === 'error' && '❌ Error al procesar'}
                                    </p>
                                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mb-2">
                                        <div
                                            className={`h-full rounded-full transition-all ${uploadStatus === 'error' ? 'bg-rose-500' : uploadStatus === 'done' ? 'bg-emerald-500' : 'bg-primary'}`}
                                            style={{ width: `${uploadProgress}%` }}
                                        ></div>
                                    </div>
                                    <p className="text-sm text-slate-500">
                                        {uploadStatus === 'processing' && 'Generando flashcards y quizzes...'}
                                        {uploadStatus === 'done' && 'Flashcards y quizzes listos para tus estudiantes'}
                                        {uploadStatus === 'error' && 'Intenta de nuevo con otro archivo'}
                                    </p>
                                </div>
                            )}
                        </div>
                        <div className="bg-slate-50 p-4 flex justify-end gap-3">
                            <button
                                onClick={() => { setShowUploadModal(false); setIsUploading(false); setUploadProgress(0); }}
                                className="px-4 py-2 text-slate-600 font-medium hover:text-slate-800"
                            >
                                {uploadStatus === 'done' ? 'Cerrar' : 'Cancelar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Create Exam Modal */}
            {showExamModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden">
                        <div className="p-8">
                            <h2 className="text-2xl font-black text-slate-900 mb-6">Crear Nuevo Examen</h2>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Nombre del Examen</label>
                                    <input
                                        type="text"
                                        placeholder="Ej: Parcial 2 - Sistema Nervioso"
                                        value={examForm.name}
                                        onChange={(e) => setExamForm(prev => ({ ...prev, name: e.target.value }))}
                                        className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Fecha</label>
                                    <input
                                        type="date"
                                        value={examForm.date}
                                        onChange={(e) => setExamForm(prev => ({ ...prev, date: e.target.value }))}
                                        className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Tipo</label>
                                    <select
                                        value={examForm.type}
                                        onChange={(e) => setExamForm(prev => ({ ...prev, type: e.target.value as 'exam' | 'quiz' | 'practice' }))}
                                        className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                                    >
                                        <option value="exam">Examen</option>
                                        <option value="quiz">Quiz</option>
                                        <option value="practice">Práctica</option>
                                    </select>
                                </div>
                                {classData?.topics && classData.topics.length > 0 && (
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">Temas a Evaluar</label>
                                        <div className="flex flex-wrap gap-2">
                                            {classData.topics.map((topic) => (
                                                <label key={topic} className="flex items-center gap-2 bg-slate-100 px-3 py-2 rounded-lg cursor-pointer hover:bg-slate-200">
                                                    <input type="checkbox" className="rounded" />
                                                    <span className="text-sm">{topic}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="bg-slate-50 p-4 flex justify-end gap-3">
                            <button onClick={() => setShowExamModal(false)} className="px-4 py-2 text-slate-600 font-medium hover:text-slate-800">
                                Cancelar
                            </button>
                            <button
                                onClick={handleCreateExam}
                                disabled={creatingExam || !examForm.name}
                                className="bg-primary text-white font-bold px-6 py-2 rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                {creatingExam && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                                {creatingExam ? 'Creando...' : 'Crear Examen'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Student Progress Modal */}
            {selectedStudent && classId && (
                <StudentProgressModal
                    studentId={selectedStudent.id}
                    classId={classId}
                    studentName={selectedStudent.name}
                    studentEmail={selectedStudent.email}
                    onClose={() => setSelectedStudent(null)}
                />
            )}
        </div>
    );
};

export default TeacherClassDetail;
