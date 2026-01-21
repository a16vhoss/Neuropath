
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase, getClassMaterials, getClassEnrollments, uploadMaterial } from '../services/supabaseClient';
import { generateFlashcardsFromText, generateQuizFromText, extractTextFromPDF, generateStudySummary } from '../services/pdfProcessingService';
import StudentProgressModal from '../components/StudentProgressModal';
import AnnouncementCard from '../components/AnnouncementCard';
import AssignmentCard from '../components/AssignmentCard';
import ExamScheduler from '../components/ExamScheduler';
import GradeBookTable from '../components/GradeBookTable';
import TopicSection from '../components/TopicSection';
import {
    getClassAnnouncements,
    createAnnouncement,
    deleteAnnouncement,
    getClassAssignments,
    createAssignment,
    deleteAssignment,
    getAssignmentSubmissions,
    gradeSubmission,
    getClassExams,
    scheduleExam,
    getClassTopics,
    createTopic,
    updateTopic,
    deleteTopic,
    reorderTopics,
    Announcement,
    Assignment,
    AssignmentSubmission,
    ScheduledExam,
    ClassTopic
} from '../services/ClassroomService';

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
    const [activeTab, setActiveTab] = useState<'home' | 'announcements' | 'modules' | 'assignments' | 'discussions' | 'grades' | 'people' | 'evaluation' | 'attendance'>('home');
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

    // Announcements state
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [showAssignmentModal, setShowAssignmentModal] = useState(false);
    const [newAssignment, setNewAssignment] = useState<Partial<Assignment>>({
        title: '',
        description: '',
        points: 100,
        due_date: '',
        type: 'assignment',
        topic_id: ''
    });
    const [assignmentFile, setAssignmentFile] = useState<File | null>(null);


    // Upload state additions
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [uploadTitle, setUploadTitle] = useState('');
    const [uploadDescription, setUploadDescription] = useState('');

    const [activeTopicId, setActiveTopicId] = useState<string>('');

    const [loadingAnnouncements, setLoadingAnnouncements] = useState(true);
    const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
    const [newAnnouncementContent, setNewAnnouncementContent] = useState('');

    // Topics state
    const [topics, setTopics] = useState<ClassTopic[]>([]);
    const [loadingTopics, setLoadingTopics] = useState(true);
    const [showTopicModal, setShowTopicModal] = useState(false);
    const [editingTopic, setEditingTopic] = useState<ClassTopic | null>(null);
    const [newTopicName, setNewTopicName] = useState('');

    // Assignments/Grades state
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [submissions, setSubmissions] = useState<AssignmentSubmission[]>([]);
    const [loadingAssignments, setLoadingAssignments] = useState(true);

    // Scheduled Exams state
    const [scheduledExams, setScheduledExams] = useState<ScheduledExam[]>([]);
    const [showExamScheduler, setShowExamScheduler] = useState(false);

    // Attendance state
    const [attendanceRecords, setAttendanceRecords] = useState<Record<string, 'present' | 'late' | 'absent'>>({});
    const [savingAttendance, setSavingAttendance] = useState(false);

    // View Assignment Details State
    const [viewingAssignment, setViewingAssignment] = useState<Assignment | null>(null);

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

                // Get topics
                setLoadingTopics(true);
                const classTopics = await getClassTopics(classId);
                setTopics(classTopics);
                setLoadingTopics(false);

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
                        avatar: e.profiles?.avatar_url || e.student_id.slice(0, 8),
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

    // Load announcements
    const loadAnnouncements = useCallback(async () => {
        if (!classId) return;
        setLoadingAnnouncements(true);
        try {
            const data = await getClassAnnouncements(classId);
            setAnnouncements(data);
        } catch (error) {
            console.error('Error loading announcements:', error);
        } finally {
            setLoadingAnnouncements(false);
        }
    }, [classId]);

    useEffect(() => {
        loadAnnouncements();
    }, [loadAnnouncements]);

    // Load assignments and submissions
    useEffect(() => {
        const loadAssignmentsData = async () => {
            if (!classId) return;
            setLoadingAssignments(true);
            try {
                const assignmentsData = await getClassAssignments(classId);
                setAssignments(assignmentsData);

                // Load all submissions for grading
                const allSubmissions: AssignmentSubmission[] = [];
                for (const assignment of assignmentsData) {
                    const subs = await getAssignmentSubmissions(assignment.id);
                    allSubmissions.push(...subs);
                }
                setSubmissions(allSubmissions);
            } catch (error) {
                console.error('Error loading assignments:', error);
            } finally {
                setLoadingAssignments(false);
            }
        };
        loadAssignmentsData();
    }, [classId]);

    // Load scheduled exams
    useEffect(() => {
        const loadScheduledExams = async () => {
            if (!classId) return;
            try {
                const data = await getClassExams(classId);
                setScheduledExams(data);
            } catch (error) {
                console.error('Error loading scheduled exams:', error);
            }
        };
        loadScheduledExams();
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

    // Prepare GradeBook Data
    const submissionsMap = useMemo(() => {
        const map = new Map<string, Map<string, AssignmentSubmission>>();
        submissions.forEach(sub => {
            if (!map.has(sub.student_id)) {
                map.set(sub.student_id, new Map());
            }
            map.get(sub.student_id)!.set(sub.assignment_id, sub);
        });
        return map;
    }, [submissions]);

    // Create announcement handler
    const handleCreateAnnouncement = async () => {
        if (!classId || !user || !newAnnouncementContent.trim()) return;
        try {
            const newAnnouncement = await createAnnouncement({
                class_id: classId,
                teacher_id: user.id,
                content: newAnnouncementContent.trim()
            });
            setAnnouncements(prev => [newAnnouncement, ...prev]);
            setNewAnnouncementContent('');
            setShowAnnouncementModal(false);
        } catch (error) {
            console.error('Error creating announcement:', error);
        }
    };

    // Delete announcement handler
    const handleDeleteAnnouncement = async (id: string) => {
        try {
            await deleteAnnouncement(id);
            setAnnouncements(prev => prev.filter(a => a.id !== id));
        } catch (error) {
            console.error('Error deleting announcement:', error);
        }
    };

    // Delete assignment handler
    const handleDeleteAssignment = async (id: string) => {
        if (!window.confirm('¿Estás seguro de eliminar este elemento?')) return;
        try {
            await deleteAssignment(id);
            setAssignments(prev => prev.filter(a => a.id !== id));
        } catch (error) {
            console.error('Error deleting assignment:', error);
        }
    };

    // Create assignment handler
    // Create assignment handler
    const handleCreateAssignment = async () => {
        if (!classId || !newAssignment.title || (newAssignment.type === 'assignment' && !newAssignment.due_date)) return;

        // Show loading state (reuse existing or add local if needed, for now just reuse)
        setIsUploading(true);

        try {
            let finalDescription = newAssignment.description || '';
            let attachments = [];

            if (assignmentFile) {
                // 1. Upload File
                const fileExt = assignmentFile.name.split('.').pop();
                const fileName = `${classId}/assignments/${Date.now()}_${assignmentFile.name}`;
                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from('materials')
                    .upload(fileName, assignmentFile);

                if (uploadError) throw uploadError;

                // 2. AI Processing for PDF
                if (assignmentFile.type.includes('pdf')) {
                    await new Promise<void>((resolve) => {
                        const reader = new FileReader();
                        reader.onload = async (e) => {
                            try {
                                const base64 = (e.target?.result as string)?.split(',')[1];
                                if (base64) {
                                    const text = await extractTextFromPDF(base64);
                                    if (text) {
                                        const summary = await generateStudySummary(text, newAssignment.title || 'General');
                                        if (summary) {
                                            finalDescription += `\n\n--- 🤖 Resumen IA ---\n${summary}`;
                                        }
                                    }
                                }
                            } catch (err) {
                                console.error('AI Summary failed', err);
                            } finally {
                                resolve();
                            }
                        };
                        reader.onerror = () => {
                            console.error('FileReader error');
                            resolve();
                        };
                        reader.readAsDataURL(assignmentFile);
                    });
                }

                attachments.push({
                    type: 'file',
                    title: assignmentFile.name,
                    url: uploadData?.path,
                    mime_type: assignmentFile.type
                });
            }

            const assignment = await createAssignment({
                class_id: classId,
                title: newAssignment.title,
                description: finalDescription,
                points: newAssignment.points,
                due_date: newAssignment.due_date,
                topic_id: newAssignment.topic_id || undefined,
                type: newAssignment.type,
                published: true, // AUTO PUBLISH
                attachments: attachments.length > 0 ? attachments : undefined
            });

            setAssignments(prev => [assignment, ...prev]);
            setShowAssignmentModal(false);
            setNewAssignment({ title: '', description: '', points: 100, due_date: '', type: 'assignment', topic_id: '' });
            setAssignmentFile(null);
        } catch (error) {
            console.error('Error creating assignment:', error);
        } finally {
            setIsUploading(false);
        }
    };

    // Topic handlers
    const handleCreateTopic = async () => {
        if (!classId || !newTopicName.trim()) return;
        try {
            if (editingTopic) {
                const updated = await updateTopic(editingTopic.id, { name: newTopicName });
                setTopics(prev => prev.map(t => t.id === updated.id ? updated : t));
            } else {
                const newTopic = await createTopic(classId, newTopicName);
                setTopics(prev => [...prev, newTopic]);
            }
            setShowTopicModal(false);
            setNewTopicName('');
            setEditingTopic(null);
        } catch (error) {
            console.error('Error saving topic:', error);
        }
    };

    const handleDeleteTopic = async (topicId: string) => {
        if (!window.confirm('¿Estás seguro de eliminar este módulo? Las tareas asociadas perderán su agrupación.')) return;
        try {
            await deleteTopic(topicId);
            setTopics(prev => prev.filter(t => t.id !== topicId));
        } catch (error) {
            console.error('Error deleting topic:', error);
        }
    };

    // Update attendance handler
    const handleAttendanceChange = (studentId: string, status: 'present' | 'late' | 'absent') => {
        setAttendanceRecords(prev => ({ ...prev, [studentId]: status }));
    };

    // Save attendance handler
    const handleSaveAttendance = async () => {
        if (!classId) return;
        setSavingAttendance(true);
        try {
            // Create attendance session
            const { data: session, error: sessionError } = await supabase
                .from('attendance_sessions')
                .insert({ class_id: classId, session_date: new Date().toISOString().split('T')[0] })
                .select()
                .single();

            if (sessionError) throw sessionError;

            // Insert records
            const records = Object.entries(attendanceRecords).map(([studentId, status]) => ({
                session_id: session.id,
                student_id: studentId,
                status
            }));

            if (records.length > 0) {
                await supabase.from('attendance_records').insert(records);
            }

            setAttendanceRecords({});
            alert('¡Asistencia guardada correctamente!');
        } catch (error) {
            console.error('Error saving attendance:', error);
            alert('Error al guardar la asistencia. La tabla puede no existir aún.');
        } finally {
            setSavingAttendance(false);
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
    const handleFileSelect = (files: FileList | null) => {
        if (files && files[0]) {
            const file = files[0];
            setSelectedFile(file);
            setUploadTitle(file.name.split('.')[0]); // Default title from filename
            setUploadDescription('');
        }
    };

    const handleConfirmUpload = async () => {
        if (!selectedFile || !classId || !user) return;

        setIsUploading(true);
        setUploadStatus('uploading');
        setUploadProgress(10);

        try {
            const file = selectedFile;
            // Step 1: Upload File
            const fileExt = file.name.split('.').pop();
            const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
            const filePath = `class-materials/${classId}/${fileName}`;

            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('materials') // Ensure this bucket exists
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            setUploadProgress(40);
            setUploadStatus('processing');

            // Step 2: Create Material Record
            const { data: materialRecord, error: dbError } = await supabase
                .from('materials')
                .insert({
                    class_id: classId,
                    name: uploadTitle, // Use custom title
                    description: uploadDescription, // Use custom description
                    type: file.type.includes('pdf') ? 'pdf' : 'doc',
                    url: uploadData?.path,
                    created_by: user.id,
                    status: 'processing', // AI will pick this up
                    size_bytes: file.size
                })
                .select()
                .single();

            if (dbError) throw dbError;

            // Step 3: Trigger AI Processing (Simulation)
            // SIMULATION BEGINS
            const reader = new FileReader();
            reader.onload = async (e) => {
                // Simulate delay
                await new Promise(resolve => setTimeout(resolve, 2000));
                setUploadProgress(70);

                // Simulate Generated Content
                const extractedText = "Texto simulado del documento...";
                const flashcards = [
                    { front: '¿Qué es la neurona?', back: 'Célula principal del sistema nervioso.' },
                    { front: '¿Qué es la sinapsis?', back: 'Unión funcional entre dos neuronas.' },
                    { front: '¿Lóbulo frontal?', back: 'Encargado del razonamiento y movimiento.' },
                    { front: '¿Corteza cerebral?', back: 'Capa externa de sustancia gris.' },
                    { front: '¿Axón?', back: 'Prolongación que transmite el impulso nervioso.' }
                ];

                const { data: setRecord } = await supabase.from('flashcard_sets').insert({
                    class_id: classId,
                    material_id: materialRecord.id,
                    title: `Flashcards: ${uploadTitle}`,
                    description: 'Generado automáticamente por IA'
                }).select().single();

                if (setRecord) {
                    await supabase.from('flashcards').insert(
                        flashcards.map(f => ({ set_id: setRecord.id, front: f.front, back: f.back }))
                    );
                }

                const quizQuestions = [
                    { question: '¿Cuál es la función del axón?', options: ['Transmitir impulso', 'Proteger núcleo', 'Recibir señales'], correctIndex: 0, explanation: 'El axón lleva la señal eléctrica.' },
                    { question: 'El lóbulo encargado de la visión es:', options: ['Frontal', 'Occipital', 'Temporal'], correctIndex: 1, explanation: 'El occipital procesa la información visual.' },
                    { question: 'La sinapsis es:', options: ['Una célula', 'Un hueso', 'Una conexión'], correctIndex: 2, explanation: 'Es la conexión funcional entre neuronas.' }
                ];

                const { data: quizRecord } = await supabase.from('quizzes').insert({
                    class_id: classId,
                    material_id: materialRecord.id,
                    title: `Quiz: ${uploadTitle}`,
                    description: 'Validación de conocimientos generada por IA'
                }).select().single();

                if (quizRecord) {
                    for (const q of quizQuestions) {
                        await supabase.from('quiz_questions').insert({
                            quiz_id: quizRecord.id,
                            question: q.question,
                            options: q.options,
                            correct_index: q.correctIndex,
                            explanation: q.explanation
                        });
                    }
                }

                // Update status
                await supabase
                    .from('materials')
                    .update({
                        status: 'ready',
                        flashcard_count: 5,
                        quiz_count: 3,
                        content_text: extractedText
                    })
                    .eq('id', materialRecord.id);

                // Step 10: Link to Assignment if Topic Active
                if (activeTopicId) {
                    try {
                        const newAssignment = await createAssignment({
                            class_id: classId,
                            title: uploadTitle,
                            description: uploadDescription || 'Material de estudio',
                            points: 0,
                            topic_id: activeTopicId,
                            type: 'material',
                            attached_materials: [materialRecord.id],
                            published: true,
                            attachments: [{
                                type: 'file',
                                title: uploadTitle,
                                url: uploadData?.path,
                                mime_type: file.type
                            }]
                        });
                        setAssignments(prev => [newAssignment, ...prev]);
                        setActiveTopicId('');
                    } catch (assignError) {
                        console.error('Error creating linked assignment:', assignError);
                    }
                }

                setUploadProgress(100);
                setUploadStatus('done');

                // Refresh materials
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
                    setSelectedFile(null); // Reset
                }, 1500);

            }; // end reader.onload
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
                <nav className="flex-1 p-4 space-y-1">
                    <div onClick={() => navigate('/teacher')} className="text-slate-600 p-3 rounded-lg flex items-center gap-3 font-medium hover:bg-slate-50 cursor-pointer">
                        <span className="material-symbols-outlined">arrow_back</span> Volver al Panel
                    </div>
                    <div className="border-t border-slate-100 my-4"></div>

                    {/* Class name header */}
                    <div className="px-3 py-2 mb-2">
                        <h3 className="font-bold text-slate-900 truncate">{classData?.name || 'Clase'}</h3>
                        <p className="text-xs text-slate-500 font-mono">{classData?.code}</p>
                    </div>

                    {[
                        { id: 'home', icon: 'home', label: 'Inicio' },
                        { id: 'announcements', icon: 'campaign', label: 'Anuncios' },
                        { id: 'modules', icon: 'folder_open', label: 'Módulos' },
                        { id: 'assignments', icon: 'task', label: 'Tareas' },

                        { id: 'grades', icon: 'grade', label: 'Calificaciones', badge: atRiskCount > 0 ? atRiskCount : undefined },
                        { id: 'people', icon: 'groups', label: 'Personas' },
                        { id: 'evaluation', icon: 'assignment', label: 'Plan de Evaluación' },
                        { id: 'attendance', icon: 'fact_check', label: 'Pase de Lista' }
                    ].map((item) => (
                        <div
                            key={item.id}
                            onClick={() => setActiveTab(item.id as any)}
                            className={`p-3 rounded-lg flex items-center justify-between font-medium cursor-pointer transition-colors ${activeTab === item.id ? 'bg-primary/10 text-primary border-l-4 border-primary' : 'text-slate-600 hover:bg-slate-50'
                                }`}
                        >
                            <div className="flex items-center gap-3">
                                <span className="material-symbols-outlined text-xl">{item.icon}</span>
                                <span>{item.label}</span>
                            </div>
                            {item.badge && (
                                <span className="bg-primary text-white text-xs font-bold px-2 py-0.5 rounded-full">{item.badge}</span>
                            )}
                        </div>
                    ))}

                    <div className="border-t border-slate-100 my-4"></div>

                    {/* Quick actions */}
                    <div
                        onClick={() => navigate(`/teacher/analytics/${classId}`)}
                        className="text-slate-600 p-3 rounded-lg flex items-center gap-3 font-medium hover:bg-slate-50 cursor-pointer"
                    >
                        <span className="material-symbols-outlined">analytics</span> Analíticas
                    </div>
                    <div
                        onClick={() => setShowUploadModal(true)}
                        className="text-slate-600 p-3 rounded-lg flex items-center gap-3 font-medium hover:bg-slate-50 cursor-pointer"
                    >
                        <span className="material-symbols-outlined">upload</span> Subir Material
                    </div>
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

                {/* Home Tab */}
                {activeTab === 'home' && (
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

                {/* Modules Tab (Topics & Materials) */}
                {activeTab === 'modules' && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center">
                            <h2 className="text-xl font-bold">Módulos del Curso</h2>
                            <button
                                onClick={() => {
                                    setEditingTopic(null);
                                    setNewTopicName('');
                                    setShowTopicModal(true);
                                }}
                                className="bg-primary text-white font-bold px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700"
                            >
                                <span className="material-symbols-outlined text-lg">add</span> Nuevo Módulo
                            </button>
                        </div>

                        {loadingTopics ? (
                            <div className="animate-pulse space-y-4">
                                <div className="h-12 bg-slate-200 rounded-lg w-full"></div>
                                <div className="h-12 bg-slate-200 rounded-lg w-full"></div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {topics.map((topic) => (
                                    <TopicSection
                                        key={topic.id}
                                        topic={topic}
                                        assignments={assignments.filter(a => a.topic_id === topic.id)}
                                        isTeacher={true}
                                        onAssignmentClick={(assignment) => navigate(`/teacher/class/${classId}/item/${assignment.id}`)}
                                        onEditAssignment={(assignment) => {
                                            setNewAssignment(assignment);
                                            setShowAssignmentModal(true);
                                        }}
                                        onEditTopic={() => {
                                            setEditingTopic(topic);
                                            setNewTopicName(topic.name);
                                            setShowTopicModal(true);
                                        }}
                                        onDeleteTopic={() => handleDeleteTopic(topic.id)}
                                        onDeleteAssignment={(assignment) => handleDeleteAssignment(assignment.id)}
                                        onAddInfo={() => {
                                            setNewAssignment({
                                                title: '',
                                                description: '',
                                                points: 0,
                                                due_date: new Date().toISOString().split('T')[0],
                                                type: 'material',
                                                topic_id: topic.id
                                            });
                                            setShowAssignmentModal(true);
                                        }}
                                        onAddTask={() => {
                                            setNewAssignment({
                                                title: '',
                                                description: '',
                                                points: 100,
                                                due_date: '',
                                                type: 'assignment',
                                                topic_id: topic.id
                                            });
                                            setShowAssignmentModal(true);
                                        }}
                                        onAddExam={() => {
                                            setActiveTopicId(topic.id);
                                            setShowExamScheduler(true);
                                            // TODO: Pre-select topic in ExamScheduler if possible
                                        }}
                                        onAddMaterial={() => {
                                            setActiveTopicId(topic.id);
                                            setShowUploadModal(true);
                                        }}
                                    />
                                ))}

                                {/* Unassigned Items */}
                                {assignments.filter(a => !a.topic_id).length > 0 && (
                                    <div className="mt-8 border-t border-slate-200 pt-8">
                                        <h3 className="text-lg font-bold text-slate-700 mb-4">Sin Asignar</h3>
                                        <div className="space-y-2">
                                            {assignments.filter(a => !a.topic_id).map(assignment => (
                                                <AssignmentCard
                                                    key={assignment.id}
                                                    assignment={assignment}
                                                    isTeacher={true}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Assignments Tab */}
                {activeTab === 'assignments' && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center">
                            <h2 className="text-xl font-bold">Tareas y Actividades</h2>
                            <button
                                onClick={() => setShowAssignmentModal(true)}
                                className="bg-primary text-white font-bold px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700"
                            >
                                <span className="material-symbols-outlined text-lg">add</span> Nueva Tarea
                            </button>
                        </div>

                        {assignments.filter(a => ['assignment', 'exam'].includes(a.type)).length > 0 ? (
                            <div className="grid gap-4">
                                {assignments.filter(a => ['assignment', 'exam'].includes(a.type)).map((assignment) => (
                                    <AssignmentCard
                                        key={assignment.id}
                                        assignment={assignment}
                                        isTeacher={true}
                                        onDelete={() => handleDeleteAssignment(assignment.id)}
                                        onEdit={() => { /* Implement edit */ }}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="bg-slate-50 p-12 rounded-2xl text-center">
                                <span className="material-symbols-outlined text-4xl text-slate-300 mb-4">task</span>
                                <p className="text-slate-500 mb-4">No hay tareas asignadas</p>
                                <button
                                    onClick={() => setShowAssignmentModal(true)}
                                    className="bg-primary text-white font-bold px-6 py-2 rounded-xl hover:bg-blue-700"
                                >
                                    Crear Primera Tarea
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* People Tab (Students) */}
                {activeTab === 'people' && (
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

                {/* Evaluation Tab (Exams) */}
                {activeTab === 'evaluation' && (
                    <div className="space-y-8">
                        {/* Scheduled Exams Section */}
                        <div>
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-xl font-bold">Exámenes Programados</h2>
                                <button
                                    onClick={() => setShowExamScheduler(true)}
                                    className="bg-primary text-white font-bold px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700"
                                >
                                    <span className="material-symbols-outlined text-lg">event</span> Programar Examen
                                </button>
                            </div>

                            {scheduledExams.length > 0 ? (
                                <div className="grid gap-4">
                                    {scheduledExams.map((exam) => (
                                        <div key={exam.id} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-xl bg-violet-100 text-violet-600 flex items-center justify-center">
                                                <span className="material-symbols-outlined text-2xl">event_available</span>
                                            </div>
                                            <div className="flex-1">
                                                <h3 className="font-bold text-slate-900">{exam.title}</h3>
                                                <div className="flex items-center gap-4 text-sm text-slate-500 mt-1">
                                                    <span className="flex items-center gap-1">
                                                        <span className="material-symbols-outlined text-base">calendar_today</span>
                                                        {new Date(exam.start_time).toLocaleDateString()}
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <span className="material-symbols-outlined text-base">schedule</span>
                                                        {new Date(exam.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -
                                                        {new Date(exam.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className={`text-xs font-bold px-3 py-1 rounded-full ${new Date() < new Date(exam.start_time) ? 'bg-amber-100 text-amber-600' : new Date() > new Date(exam.end_time) ? 'bg-slate-100 text-slate-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                                    {new Date() < new Date(exam.start_time) ? 'Programado' : new Date() > new Date(exam.end_time) ? 'Finalizado' : 'En curso'}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="bg-slate-50 p-6 rounded-2xl text-center mb-6">
                                    <p className="text-slate-500">No hay exámenes programados próximamente</p>
                                </div>
                            )}
                        </div>

                        {/* Exam Templates Section */}
                        <div>
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-xl font-bold">Plantillas de Quiz ({exams.length})</h2>
                                <button
                                    onClick={() => setShowExamModal(true)}
                                    className="bg-white border border-slate-200 text-slate-700 font-bold px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-slate-50"
                                >
                                    <span className="material-symbols-outlined text-lg">add</span> Crear Plantilla
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
                                            <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center">
                                                <span className="material-symbols-outlined text-2xl">description</span>
                                            </div>
                                            <div className="flex-1">
                                                <h3 className="font-bold text-slate-900">{exam.title}</h3>
                                                <p className="text-sm text-slate-500">Creado: {exam.created_at}</p>
                                                <p className="text-xs text-violet-600 mt-1">{exam.question_count} preguntas</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => setShowExamScheduler(true)} // In future could pre-select this quiz
                                                    className="p-2 text-primary hover:bg-primary/10 rounded-full"
                                                    title="Programar este examen"
                                                >
                                                    <span className="material-symbols-outlined">event</span>
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="bg-slate-50 p-12 rounded-2xl text-center">
                                    <span className="material-symbols-outlined text-4xl text-slate-300 mb-4">assignment</span>
                                    <p className="text-slate-500 mb-4">No hay plantillas de examen creadas</p>
                                    <button
                                        onClick={() => setShowExamModal(true)}
                                        className="bg-primary text-white font-bold px-6 py-2 rounded-xl hover:bg-blue-700"
                                    >
                                        Crear Primera Plantilla
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Announcements Tab */}
                {activeTab === 'announcements' && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center">
                            <h2 className="text-xl font-bold">Anuncios ({announcements.length})</h2>
                            <button
                                onClick={() => setShowAnnouncementModal(true)}
                                className="bg-primary text-white font-bold px-4 py-2 rounded-xl hover:bg-blue-700 transition flex items-center gap-2"
                            >
                                <span className="material-symbols-outlined">add</span> Nuevo Anuncio
                            </button>
                        </div>

                        {loadingAnnouncements ? (
                            <div className="text-center py-8">
                                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
                                <p className="text-slate-500 mt-2">Cargando anuncios...</p>
                            </div>
                        ) : announcements.length > 0 ? (
                            <div className="space-y-4">
                                {announcements.map((announcement) => (
                                    <AnnouncementCard
                                        key={announcement.id}
                                        announcement={announcement}
                                        isTeacher={true}
                                        onUpdate={loadAnnouncements}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm text-center">
                                <div className="w-16 h-16 bg-violet-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                    <span className="material-symbols-outlined text-3xl text-violet-600">campaign</span>
                                </div>
                                <h3 className="font-bold text-slate-900 mb-2 text-lg">No hay anuncios aún</h3>
                                <p className="text-slate-500 mb-4">Publica anuncios para comunicarte con toda la clase</p>
                                <button
                                    onClick={() => setShowAnnouncementModal(true)}
                                    className="bg-primary text-white font-bold px-6 py-2 rounded-xl hover:bg-blue-700"
                                >
                                    Crear Primer Anuncio
                                </button>
                            </div>
                        )}
                    </div>
                )}



                {/* Grades Tab */}
                {activeTab === 'grades' && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center">
                            <h2 className="text-xl font-bold">Libro de Calificaciones</h2>
                            <div className="flex gap-2">
                                <button className="px-4 py-2 rounded-lg border border-slate-200 font-medium text-slate-600 hover:bg-slate-50 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-lg">download</span> Exportar
                                </button>
                            </div>
                        </div>

                        <GradeBookTable
                            assignments={assignments.map(a => ({ id: a.id, title: a.title, points: a.points || 100 }))}
                            students={students.map(s => ({
                                id: s.id,
                                full_name: s.name,
                                email: s.email,
                                avatar_url: s.avatar
                            }))}
                            submissions={submissionsMap}
                        />
                    </div>
                )}

                {/* Attendance Tab */}
                {activeTab === 'attendance' && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center">
                            <h2 className="text-xl font-bold">Pase de Lista</h2>
                            <button className="bg-primary text-white font-bold px-4 py-2 rounded-xl hover:bg-blue-700 transition flex items-center gap-2">
                                <span className="material-symbols-outlined">add</span> Nueva Sesión
                            </button>
                        </div>

                        {/* Today's attendance */}
                        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-bold text-slate-900">Hoy - {new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}</h3>
                                <span className="text-sm text-slate-500">{students.length} estudiantes</span>
                            </div>

                            {students.length > 0 ? (
                                <div className="space-y-2">
                                    {students.map((student) => (
                                        <div key={student.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                                                    {student.name.charAt(0)}
                                                </div>
                                                <span className="font-medium text-slate-900">{student.name}</span>
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => handleAttendanceChange(student.id, 'present')}
                                                    className={`px-3 py-1 rounded-lg font-medium text-sm transition ${attendanceRecords[student.id] === 'present' ? 'bg-emerald-600 text-white' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'}`}
                                                >
                                                    Presente
                                                </button>
                                                <button
                                                    onClick={() => handleAttendanceChange(student.id, 'late')}
                                                    className={`px-3 py-1 rounded-lg font-medium text-sm transition ${attendanceRecords[student.id] === 'late' ? 'bg-amber-600 text-white' : 'bg-amber-100 text-amber-700 hover:bg-amber-200'}`}
                                                >
                                                    Retardo
                                                </button>
                                                <button
                                                    onClick={() => handleAttendanceChange(student.id, 'absent')}
                                                    className={`px-3 py-1 rounded-lg font-medium text-sm transition ${attendanceRecords[student.id] === 'absent' ? 'bg-rose-600 text-white' : 'bg-rose-100 text-rose-700 hover:bg-rose-200'}`}
                                                >
                                                    Falta
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    <button
                                        onClick={handleSaveAttendance}
                                        disabled={savingAttendance}
                                        className="w-full mt-4 bg-primary text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition disabled:opacity-50 flex justify-center items-center gap-2"
                                    >
                                        {savingAttendance ? (
                                            <>
                                                <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
                                                Guardando...
                                            </>
                                        ) : 'Guardar Asistencia'}
                                    </button>
                                </div>
                            ) : (
                                <div className="text-center py-8">
                                    <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">groups</span>
                                    <p className="text-slate-500">No hay estudiantes inscritos</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </main>

            {/* Exam Scheduler Modal */}
            {showExamScheduler && classId && (
                <ExamScheduler
                    classId={classId}
                    initialTopicId={activeTopicId}
                    onClose={() => {
                        setShowExamScheduler(false);
                        setActiveTopicId('');
                    }}
                    onCreated={(newExam) => {
                        setScheduledExams(prev => [newExam, ...prev]);
                        setShowExamScheduler(false);
                        setActiveTopicId('');
                    }}
                />
            )}

            {/* Upload Modal */}
            {showUploadModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden">
                        <div className="p-8">
                            <h2 className="text-2xl font-black text-slate-900 mb-2">Subir Material</h2>
                            <p className="text-slate-500 mb-6">La IA procesará tu archivo y generará flashcards y quizzes automáticamente.</p>

                            {!selectedFile ? (
                                <label className="block border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-all">
                                    <span className="material-symbols-outlined text-4xl text-slate-400 mb-4">cloud_upload</span>
                                    <p className="font-bold text-slate-700">Arrastra archivos aquí o haz clic para seleccionar</p>
                                    <p className="text-sm text-slate-500 mt-2">PDF, PPTX, DOCX</p>
                                    <input
                                        type="file"
                                        className="hidden"
                                        onChange={(e) => handleFileSelect(e.target.files)}
                                        accept=".pdf,.pptx,.docx"
                                    />
                                </label>
                            ) : !isUploading ? (
                                <div className="space-y-4">
                                    <div className="bg-slate-50 p-4 rounded-xl flex items-center gap-4">
                                        <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center text-red-600">
                                            <span className="material-symbols-outlined">description</span>
                                        </div>
                                        <div className="flex-1 overflow-hidden">
                                            <p className="font-bold text-slate-900 truncate">{selectedFile.name}</p>
                                            <p className="text-xs text-slate-500">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                                        </div>
                                        <button onClick={() => setSelectedFile(null)} className="text-slate-400 hover:text-rose-500">
                                            <span className="material-symbols-outlined">close</span>
                                        </button>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">Título del Material</label>
                                        <input
                                            type="text"
                                            value={uploadTitle}
                                            onChange={(e) => setUploadTitle(e.target.value)}
                                            className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">Descripción (opcional)</label>
                                        <textarea
                                            value={uploadDescription}
                                            onChange={(e) => setUploadDescription(e.target.value)}
                                            rows={2}
                                            className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none"
                                            placeholder="Breve descripción del contenido..."
                                        />
                                    </div>
                                    <button
                                        onClick={handleConfirmUpload}
                                        disabled={!uploadTitle.trim()}
                                        className="w-full bg-primary text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition disabled:opacity-50"
                                    >
                                        Subir y Procesar con IA
                                    </button>
                                </div>
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
                                onClick={() => {
                                    setShowUploadModal(false);
                                    setIsUploading(false);
                                    setUploadProgress(0);
                                    setActiveTopicId('');
                                    setSelectedFile(null);
                                }}
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

            {/* Create Announcement Modal */}
            {showAnnouncementModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden">
                        <div className="p-8">
                            <h2 className="text-2xl font-black text-slate-900 mb-6">Nuevo Anuncio</h2>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Contenido del Anuncio</label>
                                    <textarea
                                        placeholder="Escribe tu anuncio aquí..."
                                        value={newAnnouncementContent}
                                        onChange={(e) => setNewAnnouncementContent(e.target.value)}
                                        rows={5}
                                        className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="bg-slate-50 p-4 flex justify-end gap-3">
                            <button
                                onClick={() => setShowAnnouncementModal(false)}
                                className="px-4 py-2 text-slate-600 font-medium hover:text-slate-800"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleCreateAnnouncement}
                                disabled={!newAnnouncementContent.trim()}
                                className="bg-primary text-white font-bold px-6 py-2 rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                            >
                                Publicar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Create Assignment Modal */}
            {showAssignmentModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden">
                        <div className="p-8">
                            <h2 className="text-2xl font-black text-slate-900 mb-6">
                                {newAssignment.type === 'material' ? 'Nueva Información' : 'Nueva Tarea'}
                            </h2>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Título *</label>
                                    <input
                                        type="text"
                                        value={newAssignment.title}
                                        onChange={(e) => setNewAssignment(prev => ({ ...prev, title: e.target.value }))}
                                        className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                                        placeholder={newAssignment.type === 'material' ? "Ej: Guía de lectura - Unidad 1" : "Ej: Ensayo sobre el Sistema Solar"}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">
                                        {newAssignment.type === 'material' ? 'Contenido / Descripción' : 'Instrucciones'}
                                    </label>
                                    <textarea
                                        value={newAssignment.description}
                                        onChange={(e) => setNewAssignment(prev => ({ ...prev, description: e.target.value }))}
                                        rows={newAssignment.type === 'material' ? 6 : 3}
                                        className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none"
                                        placeholder={newAssignment.type === 'material' ? "Escribe aquí el contenido o información para los estudiantes..." : "Instrucciones para la tarea..."}
                                    />
                                </div>

                                {newAssignment.type === 'material' && (
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">Adjuntar Archivo (Opcional)</label>
                                        <div className="flex items-center gap-3">
                                            <label className="cursor-pointer bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2 rounded-lg font-medium transition flex items-center gap-2">
                                                <span className="material-symbols-outlined text-lg">attach_file</span>
                                                {assignmentFile ? 'Cambiar archivo' : 'Seleccionar archivo'}
                                                <input
                                                    type="file"
                                                    className="hidden"
                                                    onChange={(e) => setAssignmentFile(e.target.files?.[0] || null)}
                                                    accept=".pdf,.doc,.docx,.pptx"
                                                />
                                            </label>
                                            {assignmentFile && (
                                                <div className="flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1 rounded-lg text-sm">
                                                    <span className="material-symbols-outlined text-sm">description</span>
                                                    <span className="truncate max-w-[150px]">{assignmentFile.name}</span>
                                                    <button onClick={() => setAssignmentFile(null)} className="hover:text-blue-900">
                                                        <span className="material-symbols-outlined text-sm">close</span>
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                        <p className="text-xs text-slate-500 mt-1">Si subes un PDF, la IA generará un resumen automático.</p>
                                    </div>
                                )}

                                {newAssignment.type === 'assignment' && (
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-bold text-slate-700 mb-2">Puntos</label>
                                            <input
                                                type="number"
                                                value={newAssignment.points}
                                                onChange={(e) => setNewAssignment(prev => ({ ...prev, points: parseInt(e.target.value) || 0 }))}
                                                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-slate-700 mb-2">Fecha de Entrega *</label>
                                            <input
                                                type="date"
                                                value={newAssignment.due_date}
                                                onChange={(e) => setNewAssignment(prev => ({ ...prev, due_date: e.target.value }))}
                                                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="bg-slate-50 p-4 flex justify-end gap-3">
                            <button
                                onClick={() => setShowAssignmentModal(false)}
                                className="px-4 py-2 text-slate-600 font-medium hover:text-slate-800"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleCreateAssignment}
                                disabled={!newAssignment.title || (newAssignment.type === 'assignment' && !newAssignment.due_date) || isUploading}
                                className="bg-primary text-white font-bold px-6 py-2 rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2"
                            >
                                {isUploading ? (
                                    <>
                                        <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
                                        Procesando...
                                    </>
                                ) : (
                                    newAssignment.type === 'material' ? 'Publicar Información' : 'Crear Tarea'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Create Topic Modal */}
            {showTopicModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden">
                        <div className="p-8">
                            <h2 className="text-2xl font-black text-slate-900 mb-6">
                                {editingTopic ? 'Editar Módulo' : 'Nuevo Módulo'}
                            </h2>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Nombre del Módulo</label>
                                    <input
                                        type="text"
                                        placeholder="Ej: Unidad 1: Introducción"
                                        value={newTopicName}
                                        onChange={(e) => setNewTopicName(e.target.value)}
                                        className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                                        autoFocus
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="bg-slate-50 p-4 flex justify-end gap-3">
                            <button
                                onClick={() => {
                                    setShowTopicModal(false);
                                    setEditingTopic(null);
                                    setNewTopicName('');
                                }}
                                className="px-4 py-2 text-slate-600 font-medium hover:text-slate-800"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleCreateTopic}
                                disabled={!newTopicName.trim()}
                                className="bg-primary text-white font-bold px-6 py-2 rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                            >
                                Guardar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* View Assignment Details Modal - Removed in favor of Full Page View */}
            {/* Modal removed. Interaction is now via Full Page Item View */}
        </div>
    )
}


export default TeacherClassDetail;
