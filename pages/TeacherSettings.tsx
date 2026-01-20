import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabaseClient';

const TeacherSettings: React.FC = () => {
    const navigate = useNavigate();
    const { user, profile, signOut } = useAuth();

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    // Profile settings
    const [fullName, setFullName] = useState('');
    const [institution, setInstitution] = useState('');
    const [department, setDepartment] = useState('');

    // Notification settings
    const [emailNotifications, setEmailNotifications] = useState(true);
    const [studentJoinNotifications, setStudentJoinNotifications] = useState(true);
    const [submissionNotifications, setSubmissionNotifications] = useState(true);
    const [weeklyDigest, setWeeklyDigest] = useState(true);

    // AI settings
    const [autoGenerateContent, setAutoGenerateContent] = useState(true);
    const [aiGradingAssist, setAiGradingAssist] = useState(true);
    const [atRiskAlerts, setAtRiskAlerts] = useState(true);

    useEffect(() => {
        if (profile) {
            setFullName(profile.full_name || '');
            setInstitution(profile.institution || '');
            setDepartment(profile.department || '');
        }
    }, [profile]);

    const handleSaveProfile = async () => {
        if (!user) return;

        setSaving(true);
        setMessage({ type: '', text: '' });

        try {
            const { error } = await supabase
                .from('profiles')
                .update({
                    full_name: fullName,
                    institution,
                    department,
                    updated_at: new Date().toISOString()
                })
                .eq('id', user.id);

            if (error) throw error;

            setMessage({ type: 'success', text: 'Perfil actualizado correctamente' });
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message || 'Error al guardar' });
        } finally {
            setSaving(false);
        }
    };

    const handlePasswordReset = async () => {
        if (!user?.email) return;

        try {
            const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
                redirectTo: `${window.location.origin}/auth?reset=true`
            });

            if (error) throw error;

            setMessage({ type: 'success', text: 'Se envió un enlace de restablecimiento a tu correo' });
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message });
        }
    };

    return (
        <div className="min-h-screen bg-[#F9FAFB] flex">
            {/* Sidebar */}
            <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
                <div className="p-6 flex items-center gap-2 border-b border-slate-100">
                    <span className="material-symbols-outlined text-primary text-3xl font-bold">neurology</span>
                    <span className="font-extrabold text-xl tracking-tighter text-slate-900">NEUROPATH</span>
                </div>
                <nav className="flex-1 p-4 space-y-2">
                    <div
                        onClick={() => navigate('/teacher')}
                        className="text-slate-600 p-3 rounded-lg flex items-center gap-3 font-medium hover:bg-slate-50 cursor-pointer"
                    >
                        <span className="material-symbols-outlined">dashboard</span> Panel
                    </div>
                    <div
                        onClick={() => navigate('/teacher')}
                        className="text-slate-600 p-3 rounded-lg flex items-center gap-3 font-medium hover:bg-slate-50 cursor-pointer"
                    >
                        <span className="material-symbols-outlined">school</span> Mis Clases
                    </div>
                    <div className="text-slate-600 p-3 rounded-lg flex items-center gap-3 font-medium hover:bg-slate-50 cursor-pointer">
                        <span className="material-symbols-outlined">analytics</span> Analíticas
                    </div>
                    <div className="text-slate-600 p-3 rounded-lg flex items-center gap-3 font-medium hover:bg-slate-50 cursor-pointer">
                        <span className="material-symbols-outlined">folder</span> Materiales
                    </div>
                    <div className="bg-primary/5 text-primary p-3 rounded-lg flex items-center gap-3 font-bold">
                        <span className="material-symbols-outlined">settings</span> Configuración
                    </div>
                </nav>
                <div className="p-4 border-t border-slate-100">
                    <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 cursor-pointer" onClick={signOut}>
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="material-symbols-outlined text-primary">person</span>
                        </div>
                        <div>
                            <p className="font-bold text-slate-900 text-sm">{profile?.full_name || 'Profesor'}</p>
                            <p className="text-xs text-slate-500">Cerrar Sesión</p>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 p-10 overflow-y-auto">
                <div className="max-w-3xl">
                    {/* Header */}
                    <div className="flex items-center gap-4 mb-8">
                        <button
                            onClick={() => navigate('/teacher')}
                            className="p-2 hover:bg-slate-100 rounded-lg transition"
                        >
                            <span className="material-symbols-outlined text-slate-600">arrow_back</span>
                        </button>
                        <div>
                            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Configuración</h1>
                            <p className="text-slate-500">Personaliza tu experiencia en NeuropPath</p>
                        </div>
                    </div>

                    {/* Message */}
                    {message.text && (
                        <div className={`mb-6 p-4 rounded-xl flex items-center gap-2 ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                            }`}>
                            <span className="material-symbols-outlined">
                                {message.type === 'success' ? 'check_circle' : 'error'}
                            </span>
                            {message.text}
                        </div>
                    )}

                    {/* Profile Section */}
                    <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 mb-6">
                        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-6">
                            <span className="material-symbols-outlined text-primary">person</span>
                            Perfil
                        </h2>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Nombre completo</label>
                                <input
                                    type="text"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                                    placeholder="Tu nombre"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Correo electrónico</label>
                                <input
                                    type="email"
                                    value={user?.email || ''}
                                    disabled
                                    className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-slate-50 text-slate-500"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Institución</label>
                                    <input
                                        type="text"
                                        value={institution}
                                        onChange={(e) => setInstitution(e.target.value)}
                                        className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                                        placeholder="Universidad/Escuela"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Departamento</label>
                                    <input
                                        type="text"
                                        value={department}
                                        onChange={(e) => setDepartment(e.target.value)}
                                        className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                                        placeholder="Ciencias, Medicina, etc."
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={handleSaveProfile}
                                    disabled={saving}
                                    className="bg-primary text-white font-bold px-6 py-3 rounded-xl hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-2"
                                >
                                    {saving ? (
                                        <>
                                            <span className="material-symbols-outlined animate-spin">progress_activity</span>
                                            Guardando...
                                        </>
                                    ) : (
                                        <>
                                            <span className="material-symbols-outlined">save</span>
                                            Guardar Cambios
                                        </>
                                    )}
                                </button>
                                <button
                                    onClick={handlePasswordReset}
                                    className="px-6 py-3 border border-slate-200 rounded-xl text-slate-600 font-medium hover:bg-slate-50 transition"
                                >
                                    Cambiar Contraseña
                                </button>
                            </div>
                        </div>
                    </section>

                    {/* Notifications Section */}
                    <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 mb-6">
                        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-6">
                            <span className="material-symbols-outlined text-violet-500">notifications</span>
                            Notificaciones
                        </h2>

                        <div className="space-y-4">
                            {[
                                { id: 'email', label: 'Notificaciones por correo', desc: 'Recibe actualizaciones importantes por email', checked: emailNotifications, setter: setEmailNotifications },
                                { id: 'studentJoin', label: 'Nuevos estudiantes', desc: 'Cuando un estudiante se une a tu clase', checked: studentJoinNotifications, setter: setStudentJoinNotifications },
                                { id: 'submissions', label: 'Entregas de tareas', desc: 'Cuando un estudiante entrega una tarea', checked: submissionNotifications, setter: setSubmissionNotifications },
                                { id: 'weekly', label: 'Resumen semanal', desc: 'Recibe un resumen del progreso de tus clases', checked: weeklyDigest, setter: setWeeklyDigest }
                            ].map((option) => (
                                <label key={option.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl cursor-pointer hover:bg-slate-100 transition">
                                    <div>
                                        <p className="font-medium text-slate-900">{option.label}</p>
                                        <p className="text-sm text-slate-500">{option.desc}</p>
                                    </div>
                                    <div className="relative">
                                        <input
                                            type="checkbox"
                                            checked={option.checked}
                                            onChange={(e) => option.setter(e.target.checked)}
                                            className="sr-only"
                                        />
                                        <div className={`w-12 h-7 rounded-full transition ${option.checked ? 'bg-primary' : 'bg-slate-300'}`}>
                                            <div className={`w-5 h-5 bg-white rounded-full shadow absolute top-1 transition-all ${option.checked ? 'left-6' : 'left-1'}`} />
                                        </div>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </section>

                    {/* AI Settings Section */}
                    <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 mb-6">
                        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-6">
                            <span className="material-symbols-outlined text-emerald-500">auto_awesome</span>
                            Inteligencia Artificial
                        </h2>

                        <div className="space-y-4">
                            {[
                                { id: 'autoGen', label: 'Generación automática de contenido', desc: 'La IA genera flashcards y quizzes al subir material', checked: autoGenerateContent, setter: setAutoGenerateContent },
                                { id: 'aiGrading', label: 'Asistente de calificación', desc: 'Sugerencias de IA para calificar respuestas abiertas', checked: aiGradingAssist, setter: setAiGradingAssist },
                                { id: 'atRisk', label: 'Alertas de estudiantes en riesgo', desc: 'Detecta estudiantes que necesitan atención', checked: atRiskAlerts, setter: setAtRiskAlerts }
                            ].map((option) => (
                                <label key={option.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl cursor-pointer hover:bg-slate-100 transition">
                                    <div>
                                        <p className="font-medium text-slate-900">{option.label}</p>
                                        <p className="text-sm text-slate-500">{option.desc}</p>
                                    </div>
                                    <div className="relative">
                                        <input
                                            type="checkbox"
                                            checked={option.checked}
                                            onChange={(e) => option.setter(e.target.checked)}
                                            className="sr-only"
                                        />
                                        <div className={`w-12 h-7 rounded-full transition ${option.checked ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                                            <div className={`w-5 h-5 bg-white rounded-full shadow absolute top-1 transition-all ${option.checked ? 'left-6' : 'left-1'}`} />
                                        </div>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </section>

                    {/* Danger Zone */}
                    <section className="bg-white rounded-2xl border border-rose-200 shadow-sm p-6">
                        <h2 className="text-lg font-bold text-rose-600 flex items-center gap-2 mb-4">
                            <span className="material-symbols-outlined">warning</span>
                            Zona de Peligro
                        </h2>

                        <div className="flex items-center justify-between p-4 bg-rose-50 rounded-xl">
                            <div>
                                <p className="font-medium text-slate-900">Cerrar sesión en todos los dispositivos</p>
                                <p className="text-sm text-slate-500">Esto cerrará tu sesión en todos los navegadores</p>
                            </div>
                            <button
                                onClick={signOut}
                                className="px-4 py-2 bg-rose-100 text-rose-600 font-medium rounded-lg hover:bg-rose-200 transition"
                            >
                                Cerrar Sesión
                            </button>
                        </div>
                    </section>
                </div>
            </main>
        </div>
    );
};

export default TeacherSettings;
