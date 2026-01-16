
import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

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

const mockMaterials: Material[] = [
    { id: '1', name: 'Capítulo 1 - Neuroanatomía.pdf', type: 'pdf', status: 'ready', uploadedAt: '2026-01-10', generatedContent: { flashcards: 45, quizzes: 12, guides: 3 } },
    { id: '2', name: 'Video Sinapsis Explicada.mp4', type: 'video', status: 'ready', uploadedAt: '2026-01-12', generatedContent: { flashcards: 28, quizzes: 8, guides: 2 } },
    { id: '3', name: 'Presentación Sistema Limbico.pptx', type: 'pptx', status: 'processing', uploadedAt: '2026-01-15', generatedContent: { flashcards: 0, quizzes: 0, guides: 0 } }
];

const mockStudents: Student[] = [
    { id: '1', name: 'Alice Freeman', email: 'alice@school.edu', avatar: '1', progress: 92, lastActive: 'Hace 2 horas', status: 'ok' },
    { id: '2', name: 'Bob Smith', email: 'bob@school.edu', avatar: '2', progress: 68, lastActive: 'Hace 1 día', status: 'ok' },
    { id: '3', name: 'Charlie Davis', email: 'charlie@school.edu', avatar: '3', progress: 38, lastActive: 'Hace 3 días', status: 'risk' },
    { id: '4', name: 'Diana Evans', email: 'diana@school.edu', avatar: '4', progress: 85, lastActive: 'Hace 5 horas', status: 'ok' },
    { id: '5', name: 'Eva García', email: 'eva@school.edu', avatar: '5', progress: 25, lastActive: 'Hace 7 días', status: 'inactive' }
];

const TeacherClassDetail: React.FC = () => {
    const { classId } = useParams();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'overview' | 'materials' | 'students' | 'exams'>('overview');
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [showExamModal, setShowExamModal] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isUploading, setIsUploading] = useState(false);
    const [studentFilter, setStudentFilter] = useState<'all' | 'risk' | 'inactive'>('all');

    const handleUpload = (files: FileList | null) => {
        if (!files || files.length === 0) return;
        setIsUploading(true);
        let progress = 0;
        const interval = setInterval(() => {
            progress += 10;
            setUploadProgress(progress);
            if (progress >= 100) {
                clearInterval(interval);
                setTimeout(() => {
                    setIsUploading(false);
                    setUploadProgress(0);
                    setShowUploadModal(false);
                }, 500);
            }
        }, 200);
    };

    const filteredStudents = mockStudents.filter(s =>
        studentFilter === 'all' ? true :
            studentFilter === 'risk' ? s.status === 'risk' :
                s.status === 'inactive'
    );

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
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Neurobiología 101</h1>
                        <p className="text-slate-500">Código: <span className="font-mono bg-slate-100 px-2 py-0.5 rounded">NB-101</span></p>
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
                                { label: 'Estudiantes', value: '32', icon: 'groups', color: 'blue' },
                                { label: 'Progreso Promedio', value: '65%', icon: 'trending_up', color: 'emerald' },
                                { label: 'Materiales', value: '12', icon: 'folder', color: 'violet' },
                                { label: 'En Riesgo', value: '3', icon: 'warning', color: 'rose' }
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

                        {/* Upcoming Exams */}
                        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-bold text-lg">Próximos Exámenes</h3>
                                <button onClick={() => setShowExamModal(true)} className="text-primary font-bold text-sm flex items-center gap-1">
                                    <span className="material-symbols-outlined text-lg">add</span> Nuevo Examen
                                </button>
                            </div>
                            <div className="space-y-3">
                                {[
                                    { name: 'Parcial 1 - Neuroanatomía', date: '2026-01-20', students: 32, avgPrep: 67 },
                                    { name: 'Quiz Semanal', date: '2026-01-18', students: 28, avgPrep: 72 }
                                ].map((exam, i) => (
                                    <div key={i} className="p-4 bg-slate-50 rounded-xl flex items-center justify-between">
                                        <div>
                                            <p className="font-bold text-slate-900">{exam.name}</p>
                                            <p className="text-sm text-slate-500">{exam.date} • {exam.students} estudiantes</p>
                                        </div>
                                        <div className="text-right">
                                            <p className={`font-bold ${exam.avgPrep >= 70 ? 'text-emerald-600' : 'text-amber-600'}`}>{exam.avgPrep}%</p>
                                            <p className="text-xs text-slate-500">preparación</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Recent Activity */}
                        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                            <h3 className="font-bold text-lg mb-4">Actividad Reciente</h3>
                            <div className="space-y-4">
                                {[
                                    { icon: 'person_add', text: 'Eva García se unió a la clase', time: 'Hace 2 horas', color: 'blue' },
                                    { icon: 'upload_file', text: 'Subiste "Presentación Sistema Limbico.pptx"', time: 'Hace 5 horas', color: 'violet' },
                                    { icon: 'warning', text: 'Charlie Davis cayó por debajo del 40%', time: 'Hace 1 día', color: 'rose' },
                                    { icon: 'check_circle', text: 'Material "Video Sinapsis" procesado exitosamente', time: 'Hace 3 días', color: 'emerald' }
                                ].map((activity, i) => (
                                    <div key={i} className="flex items-start gap-4">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${activity.color === 'blue' ? 'bg-blue-100 text-blue-600' :
                                                activity.color === 'violet' ? 'bg-violet-100 text-violet-600' :
                                                    activity.color === 'rose' ? 'bg-rose-100 text-rose-600' :
                                                        'bg-emerald-100 text-emerald-600'
                                            }`}>
                                            <span className="material-symbols-outlined text-sm">{activity.icon}</span>
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-sm text-slate-700">{activity.text}</p>
                                            <p className="text-xs text-slate-400">{activity.time}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
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

                        <div className="grid gap-4">
                            {mockMaterials.map((material) => (
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
                                                <span className="text-emerald-600">{material.generatedContent.guides} guías</span>
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
                                        <button className="p-2 hover:bg-slate-100 rounded-lg">
                                            <span className="material-symbols-outlined text-slate-400">more_vert</span>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Students Tab */}
                {activeTab === 'students' && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center">
                            <h2 className="text-xl font-bold">Estudiantes ({mockStudents.length})</h2>
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
                                        <tr key={student.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="p-4">
                                                <div className="flex items-center gap-3">
                                                    <img src={`https://picsum.photos/seed/${student.avatar}/40`} className="w-10 h-10 rounded-full" alt={student.name} />
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

                        <div className="grid md:grid-cols-2 gap-6">
                            {[
                                { name: 'Parcial 1 - Neuroanatomía', date: '2026-01-20', type: 'Examen', topics: ['Neuronas', 'Sinapsis'], avgPrep: 67, students: 32 },
                                { name: 'Quiz Semanal #3', date: '2026-01-18', type: 'Quiz', topics: ['Sistema Limbico'], avgPrep: 72, students: 28 }
                            ].map((exam, i) => (
                                <div key={i} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <span className={`text-xs font-bold px-2 py-1 rounded-full ${exam.type === 'Examen' ? 'bg-rose-100 text-rose-600' : 'bg-blue-100 text-blue-600'}`}>
                                                {exam.type}
                                            </span>
                                            <h3 className="font-bold text-lg mt-2">{exam.name}</h3>
                                            <p className="text-sm text-slate-500">📅 {exam.date}</p>
                                        </div>
                                        <button className="p-2 hover:bg-slate-100 rounded-lg">
                                            <span className="material-symbols-outlined text-slate-400">more_vert</span>
                                        </button>
                                    </div>
                                    <div className="flex flex-wrap gap-2 mb-4">
                                        {exam.topics.map((topic, j) => (
                                            <span key={j} className="bg-slate-100 text-slate-600 text-xs px-2 py-1 rounded-full">{topic}</span>
                                        ))}
                                    </div>
                                    <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                                        <div>
                                            <p className="text-xs text-slate-500">{exam.students} estudiantes</p>
                                        </div>
                                        <div className="text-right">
                                            <p className={`text-lg font-black ${exam.avgPrep >= 70 ? 'text-emerald-600' : 'text-amber-600'}`}>{exam.avgPrep}%</p>
                                            <p className="text-xs text-slate-500">preparación promedio</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </main>

            {/* Upload Modal */}
            {showUploadModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden">
                        <div className="p-8">
                            <h2 className="text-2xl font-black text-slate-900 mb-2">Subir Material</h2>
                            <p className="text-slate-500 mb-6">La IA procesará tu archivo y generará contenido educativo automáticamente.</p>

                            {!isUploading ? (
                                <label className="block border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-all">
                                    <span className="material-symbols-outlined text-4xl text-slate-400 mb-4">cloud_upload</span>
                                    <p className="font-bold text-slate-700">Arrastra archivos aquí o haz clic para seleccionar</p>
                                    <p className="text-sm text-slate-500 mt-2">PDF, PPTX, DOCX, MP4, Links</p>
                                    <input
                                        type="file"
                                        multiple
                                        className="hidden"
                                        onChange={(e) => handleUpload(e.target.files)}
                                        accept=".pdf,.pptx,.docx,.mp4"
                                    />
                                </label>
                            ) : (
                                <div className="text-center py-8">
                                    <div className="w-16 h-16 mx-auto mb-4">
                                        <div className="w-full h-full border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                                    </div>
                                    <p className="font-bold text-slate-900 mb-2">Subiendo y procesando...</p>
                                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mb-2">
                                        <div className="bg-primary h-full rounded-full transition-all" style={{ width: `${uploadProgress}%` }}></div>
                                    </div>
                                    <p className="text-sm text-slate-500">{uploadProgress}%</p>
                                </div>
                            )}
                        </div>
                        <div className="bg-slate-50 p-4 flex justify-end gap-3">
                            <button onClick={() => setShowUploadModal(false)} className="px-4 py-2 text-slate-600 font-medium hover:text-slate-800">
                                Cancelar
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
                                    <input type="text" placeholder="Ej: Parcial 2 - Sistema Nervioso" className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Fecha</label>
                                    <input type="date" className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Tipo</label>
                                    <select className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none">
                                        <option value="exam">Examen</option>
                                        <option value="quiz">Quiz</option>
                                        <option value="practice">Práctica</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Temas a Evaluar</label>
                                    <div className="flex flex-wrap gap-2">
                                        {['Neuronas', 'Sinapsis', 'Sistema Limbico', 'Neurotransmisores'].map((topic) => (
                                            <label key={topic} className="flex items-center gap-2 bg-slate-100 px-3 py-2 rounded-lg cursor-pointer hover:bg-slate-200">
                                                <input type="checkbox" className="rounded" />
                                                <span className="text-sm">{topic}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="bg-slate-50 p-4 flex justify-end gap-3">
                            <button onClick={() => setShowExamModal(false)} className="px-4 py-2 text-slate-600 font-medium hover:text-slate-800">
                                Cancelar
                            </button>
                            <button onClick={() => setShowExamModal(false)} className="bg-primary text-white font-bold px-6 py-2 rounded-xl hover:bg-blue-700">
                                Crear Examen
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TeacherClassDetail;
