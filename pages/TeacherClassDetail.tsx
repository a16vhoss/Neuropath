import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import MagicImportModal from '../components/MagicImportModal';
import { supabase, getClassMaterials, getClassEnrollments, uploadMaterial, createClassStudySet, getClassStudySet } from '../services/supabaseClient';
import {
    extractTextFromPDF,
    generateFlashcardsFromText,
    generateQuizFromText,
    generateStudySummary
} from '../services/pdfProcessingService';
import { generateFlashcardsFromYouTubeURL } from '../services/geminiService';
import StudentProgressModal from '../components/StudentProgressModal';
import AnnouncementCard from '../components/AnnouncementCard';
import AssignmentCard from '../components/AssignmentCard';
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
    getClassTopics,
    createTopic,
    updateTopic,
    deleteTopic,
    reorderTopics,
    Announcement,
    Assignment,
    AssignmentSubmission,
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


const TeacherClassDetail: React.FC = () => {
    const { classId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();

    const [classData, setClassData] = useState<ClassData | null>(null);
    const [activeTab, setActiveTab] = useState<'home' | 'announcements' | 'modules' | 'assignments' | 'discussions' | 'grades' | 'people' | 'attendance'>('home');
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadStatus, setUploadStatus] = useState<'uploading' | 'processing' | 'done' | 'error'>('uploading');
    const [studentFilter, setStudentFilter] = useState<'all' | 'risk' | 'inactive'>('all');

    const [materials, setMaterials] = useState<Material[]>([]);
    const [students, setStudents] = useState<Student[]>([]);
    const [loadingMaterials, setLoadingMaterials] = useState(true);
    const [loadingStudents, setLoadingStudents] = useState(true);
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);


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
    const [uploadTab, setUploadTab] = useState<'text' | 'pdf' | 'youtube'>('text');
    const [uploadInputValue, setUploadInputValue] = useState('');

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


    // Attendance state
    const [attendanceRecords, setAttendanceRecords] = useState<Record<string, 'present' | 'late' | 'absent' | 'excused'>>({});
    const [savingAttendance, setSavingAttendance] = useState(false);
    const [attendanceSessions, setAttendanceSessions] = useState<{ id: string, session_date: string }[]>([]);
    const [selectedSession, setSelectedSession] = useState<{ id: string, session_date: string } | null>(null);
    const [loadingSessions, setLoadingSessions] = useState(false);
    const [loadingRecords, setLoadingRecords] = useState(false);
    const [showSessionModal, setShowSessionModal] = useState(false);

    // View Assignment Details State
    const [viewingAssignment, setViewingAssignment] = useState<Assignment | null>(null);

    // Load class data
    const loadClassData = useCallback(async () => {
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
    }, [classId]);

    useEffect(() => {
        loadClassData();
    }, [loadClassData]);

    // Load attendance sessions
    const loadAttendanceSessions = useCallback(async () => {
        if (!classId) return;
        setLoadingSessions(true);
        try {
            const { data, error } = await supabase
                .from('attendance_sessions')
                .select('id, session_date')
                .eq('class_id', classId)
                .order('session_date', { ascending: false });

            if (error) throw error;
            setAttendanceSessions(data || []);

            // Auto-select latest session if none selected
            if (data && data.length > 0 && !selectedSession) {
                setSelectedSession(data[0]);
            }
        } catch (error) {
            console.error('Error loading attendance sessions:', error);
        } finally {
            setLoadingSessions(false);
        }
    }, [classId, selectedSession]);

    // Load records for a selected session
    const loadAttendanceRecords = useCallback(async (sessionId: string) => {
        setLoadingRecords(true);
        try {
            const { data, error } = await supabase
                .from('attendance_records')
                .select('student_id, status')
                .eq('session_id', sessionId);

            if (error) throw error;

            const records: Record<string, 'present' | 'late' | 'absent' | 'excused'> = {};
            data?.forEach(r => {
                records[r.student_id] = r.status as any;
            });
            setAttendanceRecords(records);
        } catch (error) {
            console.error('Error loading attendance records:', error);
        } finally {
            setLoadingRecords(false);
        }
    }, []);

    useEffect(() => {
        if (activeTab === 'attendance') {
            loadAttendanceSessions();
        }
    }, [activeTab, loadAttendanceSessions]);

    useEffect(() => {
        if (selectedSession) {
            loadAttendanceRecords(selectedSession.id);
        }
    }, [selectedSession, loadAttendanceRecords]);


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
    const loadAssignmentsData = useCallback(async () => {
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
    }, [classId]);

    useEffect(() => {
        loadAssignmentsData();
    }, [loadAssignmentsData]);



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
                const fileName = `${classId} /assignments/${Date.now()}_${assignmentFile.name} `;
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
                                            finalDescription += `\n\n-- - 🤖 Resumen IA-- -\n${summary} `;
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
    const handleAttendanceChange = (studentId: string, status: 'present' | 'late' | 'absent' | 'excused') => {
        setAttendanceRecords(prev => ({ ...prev, [studentId]: status }));
    };

    const handleMarkAllPresent = () => {
        const records: Record<string, 'present' | 'late' | 'absent' | 'excused'> = {};
        students.forEach(s => {
            records[s.id] = 'present';
        });
        setAttendanceRecords(records);
    };

    // Save attendance handler
    const handleSaveAttendance = async () => {
        if (!classId) return;
        setSavingAttendance(true);
        try {
            let sessionId = selectedSession?.id;

            // If no session selected or it's a new one (though usually we select one)
            if (!sessionId) {
                const { data: session, error: sessionError } = await supabase
                    .from('attendance_sessions')
                    .insert({ class_id: classId, session_date: new Date().toISOString().split('T')[0] })
                    .select()
                    .single();

                if (sessionError) throw sessionError;
                sessionId = session.id;
                setSelectedSession(session);
                loadAttendanceSessions();
            }

            // Insert/Upsert records
            const records = Object.entries(attendanceRecords).map(([studentId, status]) => ({
                session_id: sessionId,
                student_id: studentId,
                status
            }));

            if (records.length > 0) {
                const { error: upsertError } = await supabase
                    .from('attendance_records')
                    .upsert(records, { onConflict: 'session_id, student_id' });

                if (upsertError) throw upsertError;
            }

            alert('¡Asistencia guardada correctamente!');
        } catch (error) {
            console.error('Error saving attendance:', error);
            alert('Error al guardar la asistencia.');
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
        if (!classId || !user || !uploadTitle) return;

        setIsUploading(true);
        setUploadStatus('uploading');
        setUploadProgress(10);

        try {
            let materialUrl = '';
            let materialType = 'link'; // Default
            let extractedText = '';
            let flashcards: any[] = [];
            let quizQuestions: any[] = [];
            let fileSize = 0;

            // --- STEP 1: PREPARE MATERIAL & CONTENT ---

            if (uploadTab === 'pdf' && selectedFile) {
                const fileExt = selectedFile.name.split('.').pop();
                const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
                const filePath = `class-materials/${classId}/${fileName}`;

                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from('materials')
                    .upload(filePath, selectedFile);

                if (uploadError) throw uploadError;

                materialUrl = uploadData?.path || '';
                materialType = 'pdf';
                fileSize = selectedFile.size;

                // Extract text
                const base64 = await new Promise<string>((resolve) => {
                    const reader = new FileReader();
                    reader.onload = (e) => resolve((e.target?.result as string)?.split(',')[1]);
                    reader.readAsDataURL(selectedFile);
                });
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                extractedText = (await extractTextFromPDF(base64) as any) || '';

            } else if (uploadTab === 'youtube') {
                materialUrl = uploadInputValue;
                materialType = 'video';
                // Analyze YouTube
                setUploadStatus('processing');
                const result = await generateFlashcardsFromYouTubeURL(uploadInputValue);
                extractedText = result.summary;
                flashcards = result.flashcards;

            } else if (uploadTab === 'text') {
                extractedText = uploadInputValue;
                materialType = 'doc'; // Treating raw text as a document/note
            }

            setUploadProgress(50);
            setUploadStatus('processing');

            // --- STEP 2: GENERATE CONTENT IF MISSING ---

            // Generate Flashcards if not already from YouTube
            if (flashcards.length === 0 && extractedText) {
                flashcards = await generateFlashcardsFromText(extractedText, uploadTitle) || [];
            }

            setUploadProgress(70);

            // Generate Quiz
            // (Only if we have text/summary)
            if (extractedText) {
                quizQuestions = await generateQuizFromText(extractedText, uploadTitle) || [];
            }

            // --- STEP 3: SAVE TO SUPABASE ---

            const { data: materialRecord, error: dbError } = await supabase
                .from('materials')
                .insert({
                    class_id: classId,
                    name: uploadTitle,
                    description: uploadDescription,
                    type: materialType,
                    url: materialUrl,
                    created_by: user.id,
                    status: 'ready',
                    size_bytes: fileSize,
                    content_text: extractedText,
                    flashcard_count: flashcards.length,
                    quiz_count: quizQuestions.length
                })
                .select()
                .single();

            if (dbError) throw dbError;

            // Generate Study Guide Summary
            let studyGuide = 'Generado automáticamente por IA';
            if (extractedText) {
                const generatedGuide = await generateStudySummary(extractedText, uploadTitle);
                if (generatedGuide) studyGuide = generatedGuide;
            }

            // Save Quiz (Legacy/Separate system - wrapped in try/catch to avoid breaking flow)
            // ... (keeping legacy quiz if needed, but focused on Study Set here)

            // Save Study Set & Flashcards (New System)
            // Always create a Study Set container, even if AI fails to generate content,
            // so the Student View renders correctly (Unified View).
            if (materialRecord && materialRecord.id) {
                try {
                    // Create the Class Study Set container
                    const studySet = await createClassStudySet(
                        classId,
                        materialRecord.id, // Source material ID
                        user.id,
                        uploadTitle,
                        studyGuide
                    );

                    // Insert Flashcards linked to this set
                    if (studySet && flashcards.length > 0) {
                        const flashcardsPayload = flashcards.map(f => ({
                            study_set_id: studySet.id,
                            material_id: materialRecord.id,
                            question: f.question,
                            answer: f.answer,
                            category: 'General'
                        }));

                        const { error: fcError } = await supabase
                            .from('flashcards')
                            .insert(flashcardsPayload);

                        if (fcError) console.error("Error saving flashcards:", fcError);
                    }



                } catch (studySetError) {
                    console.error("Error creating study set:", studySetError);
                }
            }

            // Save Quiz (Legacy/Separate system - wrapped in try/catch to avoid breaking flow)
            if (quizQuestions.length > 0) {
                try {
                    const { data: quizRecord, error: quizError } = await supabase.from('quizzes').insert({
                        class_id: classId,
                        material_id: materialRecord.id,
                        title: `Quiz: ${uploadTitle}`,
                        description: 'Validación de conocimientos generada por IA'
                    }).select().single();

                    if (quizError) throw quizError;

                    if (quizRecord) {
                        const questionsPayload = quizQuestions.map(q => ({
                            quiz_id: quizRecord.id,
                            question: q.question,
                            options: q.options,
                            correct_index: q.correctIndex,
                            explanation: q.explanation
                        }));

                        await supabase.from('quiz_questions').insert(questionsPayload);
                    }
                } catch (err) {
                    console.error("Error saving quiz:", err);
                    // Don't throw, let the upload complete
                }
            }

            // Link as Assignment if Active Topic
            // Link as Assignment if Active Topic
            // Always link as Assignment (even if Unassigned)
            // Fix: Use correct table schema (attached_materials array, type='material')
            const { error: assignmentError } = await supabase.from('assignments').insert({
                topic_id: activeTopicId || null,
                class_id: classId,
                title: uploadTitle || `Material: ${selectedFile ? selectedFile.name : 'Nuevo Material'}`,
                description: uploadDescription || 'Material de estudio complementario',
                attached_materials: [materialRecord.id],
                type: 'material',
                points: 0,
                published: true // Ensure it's visible
            });

            if (assignmentError) {
                console.error('Error creating assignment link:', assignmentError);
                // We don't block the process but might want to notify
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

            // Refresh topics (to update modules view)
            const classTopics = await getClassTopics(classId);
            setTopics(classTopics);

            // Refresh assignments (to update grades/list view)
            const assignmentsData = await getClassAssignments(classId);
            setAssignments(assignmentsData);

            setTimeout(() => {
                setIsUploading(false);
                setUploadProgress(0);
                setShowUploadModal(false);
                setSelectedFile(null);
                setUploadInputValue('');
                setUploadTitle('');
                setUploadDescription('');
                setActiveTopicId('');
            }, 1500);

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
                    <span className="font-extrabold text-xl tracking-tighter text-slate-900">MHS</span>
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
                                    onClick={() => {
                                        setActiveTopicId('');
                                        setShowUploadModal(true);
                                    }}
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
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <h2 className="text-xl font-bold">Asistencia</h2>
                            <div className="flex flex-wrap gap-2">
                                <button
                                    onClick={handleMarkAllPresent}
                                    className="px-4 py-2 rounded-xl border border-slate-200 font-medium text-slate-600 hover:bg-slate-50 flex items-center gap-2 transition-colors"
                                >
                                    <span className="material-symbols-outlined text-lg">check_circle</span> Marcar todos presentes
                                </button>
                                <button
                                    onClick={() => setShowSessionModal(true)}
                                    className="bg-primary text-white font-bold px-4 py-2 rounded-xl hover:bg-blue-700 transition flex items-center gap-2 shadow-sm"
                                >
                                    <span className="material-symbols-outlined">calendar_today</span> Nueva Sesión
                                </button>
                            </div>
                        </div>

                        {/* Session Selector & Status */}
                        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Sesión Seleccionada</label>
                                    <div className="flex items-center gap-3">
                                        <select
                                            value={selectedSession?.id || ''}
                                            onChange={(e) => {
                                                const session = attendanceSessions.find(s => s.id === e.target.value);
                                                if (session) setSelectedSession(session);
                                            }}
                                            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 font-medium text-slate-900 focus:ring-2 focus:ring-primary/20 outline-none"
                                        >
                                            {attendanceSessions.length === 0 && <option value="">No hay sesiones</option>}
                                            {attendanceSessions.map(s => (
                                                <option key={s.id} value={s.id}>
                                                    {new Date(s.session_date).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' })}
                                                </option>
                                            ))}
                                        </select>
                                        {loadingSessions && <span className="material-symbols-outlined animate-spin text-primary">progress_activity</span>}
                                    </div>
                                </div>
                                <div className="flex gap-4">
                                    <div className="text-center">
                                        <div className="text-xl font-black text-slate-900">{students.length}</div>
                                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Estudiantes</div>
                                    </div>
                                    <div className="w-px h-8 bg-slate-100 self-center"></div>
                                    <div className="text-center">
                                        <div className="text-xl font-black text-emerald-600">
                                            {Object.values(attendanceRecords).filter(v => v === 'present').length}
                                        </div>
                                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Presentes</div>
                                    </div>
                                </div>
                            </div>

                            {loadingRecords ? (
                                <div className="text-center py-12">
                                    <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                                    <p className="text-slate-500 font-medium">Cargando registros...</p>
                                </div>
                            ) : students.length > 0 ? (
                                <div className="space-y-2">
                                    {students.map((student) => (
                                        <div key={student.id} className="flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100/80 rounded-xl transition-colors">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center text-primary font-bold text-sm border border-slate-100">
                                                    {student.name.charAt(0)}
                                                </div>
                                                <div>
                                                    <span className="font-semibold text-slate-900 block leading-tight">{student.name}</span>
                                                    <span className="text-[10px] text-slate-400 font-medium">{student.email}</span>
                                                </div>
                                            </div>
                                            <div className="flex gap-1 md:gap-2">
                                                {[
                                                    { id: 'present', label: 'P', full: 'Presente', active: 'bg-emerald-600 text-white', inactive: 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' },
                                                    { id: 'late', label: 'R', full: 'Retardo', active: 'bg-amber-500 text-white', inactive: 'bg-amber-50 text-amber-600 hover:bg-amber-100' },
                                                    { id: 'excused', label: 'J', full: 'Justificada', active: 'bg-blue-600 text-white', inactive: 'bg-blue-50 text-blue-600 hover:bg-blue-100' },
                                                    { id: 'absent', label: 'F', full: 'Falta', active: 'bg-rose-600 text-white', inactive: 'bg-rose-50 text-rose-600 hover:bg-rose-100' }
                                                ].map(s => (
                                                    <button
                                                        key={s.id}
                                                        onClick={() => handleAttendanceChange(student.id, s.id as any)}
                                                        title={s.full}
                                                        className={`w-8 h-8 md:w-auto md:px-3 md:py-1 rounded-lg font-bold text-xs transition-all ${attendanceRecords[student.id] === s.id ? s.active : s.inactive}`}
                                                    >
                                                        <span className="md:hidden">{s.label}</span>
                                                        <span className="hidden md:inline">{s.full}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                    <button
                                        onClick={handleSaveAttendance}
                                        disabled={savingAttendance || !selectedSession}
                                        className="w-full mt-6 bg-primary text-white font-black py-4 rounded-xl hover:bg-blue-700 transition-all disabled:opacity-50 flex justify-center items-center gap-2 shadow-lg shadow-primary/20"
                                    >
                                        {savingAttendance ? (
                                            <>
                                                <span className="material-symbols-outlined animate-spin">progress_activity</span>
                                                Guardando cambios...
                                            </>
                                        ) : (
                                            <>
                                                <span className="material-symbols-outlined">save</span>
                                                Guardar Pase de Lista
                                            </>
                                        )}
                                    </button>
                                </div>
                            ) : (
                                <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                                    <span className="material-symbols-outlined text-5xl text-slate-300 mb-2">groups</span>
                                    <h3 className="font-bold text-slate-900">No hay estudiantes</h3>
                                    <p className="text-slate-500 text-sm">Invita a tus estudiantes a unirse a la clase.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </main>


            {/* Upload Modal (Magic Import) */}
            {showUploadModal && (
                <MagicImportModal
                    isOpen={showUploadModal}
                    onClose={() => setShowUploadModal(false)}
                    onSuccess={(newSet: any) => {
                        loadClassData();
                        loadAssignmentsData();
                        setShowUploadModal(false);
                        if (newSet && newSet.linkedAssignmentId) {
                            navigate(`/teacher/class/${classId}/item/${newSet.linkedAssignmentId}`);
                        }
                    }}
                    classId={classId}
                    moduleId={activeTopicId} // Pass activeTopicId if matches logic
                />
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
                    <div className="bg-white w-full max-md rounded-3xl shadow-2xl overflow-hidden">
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

            {/* Attendance Session Modal */}
            {showSessionModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-100">
                        <div className="p-8">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                                    <span className="material-symbols-outlined text-3xl">calendar_add_on</span>
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-slate-900 leading-none">Nueva Sesión</h2>
                                    <p className="text-sm text-slate-500 font-medium mt-1">Selecciona la fecha de clase</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Fecha</label>
                                    <input
                                        type="date"
                                        defaultValue={new Date().toISOString().split('T')[0]}
                                        id="session-date-picker"
                                        className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none font-bold text-slate-900 transition-all"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="bg-slate-50 p-6 flex flex-col gap-3">
                            <button
                                onClick={async () => {
                                    const date = (document.getElementById('session-date-picker') as HTMLInputElement).value;
                                    if (!date || !classId) return;

                                    try {
                                        // Check if session for this date already exists
                                        const { data: existing } = await supabase
                                            .from('attendance_sessions')
                                            .select('id, session_date')
                                            .eq('class_id', classId)
                                            .eq('session_date', date)
                                            .single();

                                        if (existing) {
                                            setSelectedSession(existing);
                                        } else {
                                            const { data: session, error } = await supabase
                                                .from('attendance_sessions')
                                                .insert({ class_id: classId, session_date: date })
                                                .select()
                                                .single();

                                            if (error) throw error;
                                            setSelectedSession(session);
                                            loadAttendanceSessions();
                                        }
                                        setShowSessionModal(false);
                                    } catch (err) {
                                        console.error("Error creating session:", err);
                                        alert("Error al crear la sesión");
                                    }
                                }}
                                className="w-full bg-primary text-white font-black py-4 rounded-2xl hover:bg-blue-700 shadow-lg shadow-primary/30 transition-all active:scale-95"
                            >
                                Crear Sesión
                            </button>
                            <button
                                onClick={() => setShowSessionModal(false)}
                                className="w-full py-3 text-slate-500 font-bold hover:text-slate-800 transition-colors"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}


export default TeacherClassDetail;
