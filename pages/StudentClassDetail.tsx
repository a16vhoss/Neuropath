
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabaseClient';
import {
    getClassAnnouncements,
    getClassAssignments,
    getAssignmentSubmissions,
    getClassExams,
    getClassMaterials,
    getClassTopics,
    getClassStudentGroups,
    getStudentClassProgress,
    Announcement,
    Assignment,
    AssignmentSubmission,
    ScheduledExam,
    ClassTopic
} from '../services/ClassroomService';
import AnnouncementCard from '../components/AnnouncementCard';
import AssignmentCard from '../components/AssignmentCard';
import TopicSection from '../components/TopicSection';
import CalendarView from '../components/CalendarView';

interface ClassData {
    id: string;
    name: string;
    code: string;
    description?: string;
    teacher_id: string;
    teacher?: { full_name: string; avatar_url: string };
}

const StudentClassDetail: React.FC = () => {
    const { classId } = useParams<{ classId: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();

    // UI State
    const [activeTab, setActiveTab] = useState('home');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Data State
    const [classData, setClassData] = useState<ClassData | null>(null);
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [submissions, setSubmissions] = useState<AssignmentSubmission[]>([]);
    const [exams, setExams] = useState<ScheduledExam[]>([]);
    const [materials, setMaterials] = useState<any[]>([]); // Using 'any' for now as Material type is defined in component
    const [topics, setTopics] = useState<ClassTopic[]>([]);
    const [progress, setProgress] = useState<any>(null);

    useEffect(() => {
        if (classId && user) {
            loadClassData();
        }
    }, [classId, user]);

    const loadClassData = async () => {
        if (!classId || !user) return;
        setLoading(true);
        try {
            // 1. Get Class Info
            const { data: cls, error } = await supabase
                .from('classes')
                .select('*, teacher:profiles!teacher_id(full_name, avatar_url)')
                .eq('id', classId)
                .single();

            if (error) throw error;
            setClassData(cls);

            // 2. Load all other data in parallel
            const [
                anns,
                assig,
                subs,
                exms,
                mats,
                tops,
                prog
            ] = await Promise.all([
                getClassAnnouncements(classId),
                getClassAssignments(classId),
                // Get submissions for THIS student
                supabase.from('assignment_submissions').select('*').eq('student_id', user.id).then(res => res.data || []),
                getClassExams(classId), // Should verify if this returns only published exams for students?
                supabase.from('materials').select('*').eq('class_id', classId).eq('status', 'ready'),
                getClassTopics(classId),
                getStudentClassProgress(classId, user.id)
            ]);

            setAnnouncements(anns);
            setAssignments(assig.filter(a => a.published || a.type === 'material')); // Show published assignments AND all materials
            setSubmissions(subs);
            setExams(exms.filter(e => e.published)); // Only published exams
            setMaterials(mats.data || []);
            setTopics(tops);
            setProgress(prog);

        } catch (err) {
            console.error('Error loading class data:', err);
            setError('Error al cargar la clase.');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="text-center">
                    <span className="material-symbols-outlined text-4xl text-primary animate-spin">refresh</span>
                    <p className="mt-2 text-slate-500">Cargando clase...</p>
                </div>
            </div>
        );
    }

    if (!classData) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="text-center">
                    <span className="material-symbols-outlined text-4xl text-slate-400">school</span>
                    <p className="mt-2 text-slate-500">Clase no encontrada</p>
                    <button onClick={() => navigate('/student')} className="mt-4 text-primary font-bold hover:underline">
                        Volver al Panel
                    </button>
                </div>
            </div>
        );
    }

    // Helper to get grade for assignment
    const getMySubmission = (assignmentId: string) => {
        return submissions.find(s => s.assignment_id === assignmentId);
    };

    return (
        <div className="min-h-screen bg-[#F9FAFB] flex flex-col md:flex-row">
            {/* Sidebar */}
            <aside className="w-full md:w-64 bg-white border-r border-slate-200 flex flex-col">
                <div className="p-6 flex items-center gap-2 border-b border-slate-100">
                    <span className="material-symbols-outlined text-primary text-3xl font-bold">neurology</span>
                    <span className="font-extrabold text-xl tracking-tighter text-slate-900">MHS</span>
                </div>
                <nav className="flex-1 p-4 space-y-1">
                    <div onClick={() => navigate('/student')} className="text-slate-600 p-3 rounded-lg flex items-center gap-3 font-medium hover:bg-slate-50 cursor-pointer">
                        <span className="material-symbols-outlined">arrow_back</span> Volver
                    </div>
                    <div className="border-t border-slate-100 my-4"></div>

                    <div className="px-3 py-2 mb-2">
                        <h3 className="font-bold text-slate-900 truncate">{classData.name}</h3>
                        <p className="text-xs text-slate-500 font-mono">{classData.teacher?.full_name}</p>
                    </div>

                    {[
                        { id: 'home', icon: 'home', label: 'Inicio' },
                        { id: 'announcements', icon: 'campaign', label: 'Anuncios' },
                        { id: 'modules', icon: 'folder_open', label: 'Materiales' },
                        { id: 'assignments', icon: 'assignment', label: 'Tareas' },
                        { id: 'calendar', icon: 'calendar_month', label: 'Calendario' },
                        { id: 'grades', icon: 'grade', label: 'Calificaciones' },
                    ].map((item) => (
                        <div
                            key={item.id}
                            onClick={() => setActiveTab(item.id)}
                            className={`p-3 rounded-lg flex items-center gap-3 font-medium cursor-pointer transition-all ${activeTab === item.id ? 'bg-primary text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'
                                }`}
                        >
                            <span className="material-symbols-outlined">{item.icon}</span>
                            {item.label}
                        </div>
                    ))}
                    <div className="border-t border-slate-100 my-4"></div>
                    <div
                        onClick={() => navigate(`/student/study/${classId}`)}
                        className="text-white bg-gradient-to-r from-violet-600 to-indigo-600 p-3 rounded-lg flex items-center gap-3 font-bold hover:shadow-lg cursor-pointer transition-all"
                    >
                        <span className="material-symbols-outlined">school</span> Zona de Estudio
                    </div>
                </nav>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto h-screen p-8">
                {/* Home Tab */}
                {activeTab === 'home' && (
                    <div className="max-w-4xl mx-auto space-y-8">
                        <header>
                            <h1 className="text-3xl font-black text-slate-900 mb-2">{classData.name}</h1>
                            <p className="text-slate-600 text-lg">{classData.description || 'Sin descripción'}</p>
                        </header>

                        {/* Recent Activity / Overview */}
                        <div className="grid md:grid-cols-3 gap-6">
                            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600">
                                        <span className="material-symbols-outlined">assignment</span>
                                    </div>
                                    <h3 className="font-bold text-slate-900">Tareas Pendientes</h3>
                                </div>
                                <p className="text-3xl font-black text-slate-900">
                                    {assignments.filter(a => a.type !== 'material').filter(a => {
                                        const sub = getMySubmission(a.id);
                                        return !sub || sub.status !== 'turned_in' && sub.status !== 'graded';
                                    }).length}
                                </p>
                            </div>
                            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600">
                                        <span className="material-symbols-outlined">grade</span>
                                    </div>
                                    <h3 className="font-bold text-slate-900">Promedio</h3>
                                </div>
                                <p className="text-3xl font-black text-slate-900">{progress?.gradePercent || 0}%</p>
                            </div>
                            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center text-violet-600">
                                        <span className="material-symbols-outlined">folder</span>
                                    </div>
                                    <h3 className="font-bold text-slate-900">Materiales</h3>
                                </div>
                                <p className="text-3xl font-black text-slate-900">{materials.length}</p>
                            </div>
                        </div>

                        {/* Recent Announcements Preview */}
                        <section>
                            <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary">campaign</span> Avisos Recientes
                            </h2>
                            {announcements.length > 0 ? (
                                <div className="space-y-4">
                                    {announcements.slice(0, 2).map(announcement => (
                                        <AnnouncementCard
                                            key={announcement.id}
                                            announcement={announcement}
                                            isTeacher={false}
                                        />
                                    ))}
                                    <button
                                        onClick={() => setActiveTab('announcements')}
                                        className="text-primary font-bold text-sm hover:underline"
                                    >
                                        Ver todos los anuncios →
                                    </button>
                                </div>
                            ) : (
                                <div className="text-center py-8 bg-white rounded-2xl border border-slate-100">
                                    <p className="text-slate-500">No hay anuncios recientes.</p>
                                </div>
                            )}
                        </section>
                    </div>
                )}

                {/* Announcements Tab */}
                {activeTab === 'announcements' && (
                    <div className="max-w-3xl mx-auto space-y-6">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-2xl font-bold text-slate-900">Anuncios de Clase</h2>
                        </div>
                        {announcements.length > 0 ? (
                            announcements.map(announcement => (
                                <AnnouncementCard
                                    key={announcement.id}
                                    announcement={announcement}
                                    isTeacher={false}
                                />
                            ))
                        ) : (
                            <div className="text-center py-12 bg-white rounded-2xl border border-slate-100">
                                <span className="material-symbols-outlined text-5xl text-slate-200 mb-4">campaign</span>
                                <h3 className="text-lg font-bold text-slate-900">Sin anuncios</h3>
                                <p className="text-slate-500">Tu profesor no ha publicado anuncios todavía.</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Modules/Materials Tab */}
                {activeTab === 'modules' && (
                    <div className="max-w-4xl mx-auto space-y-6">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-2xl font-bold text-slate-900">Materiales de Clase</h2>
                        </div>

                        {topics.length > 0 || assignments.filter(a => !a.topic_id).length > 0 ? (
                            <div className="space-y-4">
                                {topics.map(topic => (
                                    <TopicSection
                                        key={topic.id}
                                        topic={topic}
                                        assignments={assignments.filter(a => a.topic_id === topic.id)}
                                        isTeacher={false}
                                        onAssignmentClick={(assignment) => navigate(`/student/class/${classId}/item/${assignment.id}`)}
                                    />
                                ))}
                                {assignments.filter(a => !a.topic_id).length > 0 && (
                                    <div className="mt-8 border-t border-slate-200 pt-8">
                                        <h3 className="text-lg font-bold text-slate-700 mb-4">Otros Materiales</h3>
                                        <div className="space-y-2">
                                            {assignments.filter(a => !a.topic_id).map(assignment => (
                                                <AssignmentCard
                                                    key={assignment.id}
                                                    assignment={assignment}
                                                    isTeacher={false}
                                                    onClick={() => navigate(`/student/class/${classId}/item/${assignment.id}`)}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="text-center py-12 bg-white rounded-2xl border border-slate-100">
                                <span className="material-symbols-outlined text-5xl text-slate-200 mb-4">folder_off</span>
                                <h3 className="text-lg font-bold text-slate-900">Sin materiales</h3>
                                <p className="text-slate-500">Aún no se han organizado materiales por módulos.</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Assignments Tab */}
                {activeTab === 'assignments' && (
                    <div className="max-w-3xl mx-auto space-y-6">
                        <h2 className="text-2xl font-bold text-slate-900 mb-6">Tareas y Actividades</h2>
                        {assignments.filter(a => a.type !== 'material').length > 0 ? (
                            assignments.filter(a => a.type !== 'material').map(assignment => {
                                const submission = getMySubmission(assignment.id);
                                return (
                                    <AssignmentCard
                                        key={assignment.id}
                                        assignment={assignment}
                                        isTeacher={false}
                                        onClick={() => navigate(`/student/class/${classId}/item/${assignment.id}`)}
                                    />
                                );
                            })
                        ) : (
                            <div className="text-center py-12 bg-white rounded-2xl border border-slate-100">
                                <span className="material-symbols-outlined text-5xl text-slate-200 mb-4">assignment_turned_in</span>
                                <h3 className="text-lg font-bold text-slate-900">Todo al día</h3>
                                <p className="text-slate-500">No tienes tareas asignadas por el momento.</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Grades Tab */}
                {activeTab === 'grades' && (
                    <div className="max-w-4xl mx-auto space-y-6">
                        <h2 className="text-2xl font-bold text-slate-900 mb-6">Mis Calificaciones</h2>

                        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200">
                                        <th className="p-4 font-bold text-slate-700 text-sm">Actividad</th>
                                        <th className="p-4 font-bold text-slate-700 text-sm">Estado</th>
                                        <th className="p-4 font-bold text-slate-700 text-sm">Fecha Entrega</th>
                                        <th className="p-4 font-bold text-slate-700 text-sm text-right">Calificación</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {assignments.map(assignment => {
                                        const submission = getMySubmission(assignment.id);
                                        const status = submission?.status || 'assigned';

                                        return (
                                            <tr key={assignment.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                                                <td className="p-4">
                                                    <div className="font-bold text-slate-900">{assignment.title}</div>
                                                    <div className="text-xs text-slate-500">{assignment.points} puntos posibles</div>
                                                </td>
                                                <td className="p-4">
                                                    <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase ${status === 'graded' ? 'bg-emerald-100 text-emerald-700' :
                                                        status === 'turned_in' ? 'bg-blue-100 text-blue-700' :
                                                            status === 'missing' ? 'bg-rose-100 text-rose-700' :
                                                                'bg-slate-100 text-slate-600'
                                                        }`}>
                                                        {status === 'graded' ? 'Calificado' :
                                                            status === 'turned_in' ? 'Entregado' :
                                                                status === 'missing' ? 'Sin Entregar' : 'Asignado'}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-sm text-slate-600">
                                                    {assignment.due_date ? new Date(assignment.due_date).toLocaleDateString() : 'Sin fecha'}
                                                </td>
                                                <td className="p-4 text-right">
                                                    {submission?.grade !== undefined ? (
                                                        <span className="font-bold text-slate-900">{submission.grade} <span className="text-slate-400 text-xs">/ {assignment.points}</span></span>
                                                    ) : (
                                                        <span className="text-slate-400">-</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Calendar Tab */}
                {activeTab === 'calendar' && (
                    <div className="max-w-6xl mx-auto space-y-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-2xl font-bold text-slate-900">Agenda de Clase</h2>
                        </div>
                        <CalendarView
                            assignments={assignments}
                            submissions={submissions}
                            onAssignmentClick={(id) => navigate(`/student/class/${classId}/item/${id}`)}
                        />
                    </div>
                )}

            </main>
        </div>
    );
};

export default StudentClassDetail;
