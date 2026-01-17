import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';

interface StudentProgressModalProps {
    studentId: string;
    classId: string;
    studentName: string;
    studentEmail: string;
    onClose: () => void;
}

interface StudentStats {
    xp: number;
    level: number;
    streak_days: number;
    flashcardsReviewed: number;
    quizAttempts: number;
    avgQuizScore: number;
    totalStudyMinutes: number;
    recentSessions: { date: string; duration: number; mode: string }[];
}

const StudentProgressModal: React.FC<StudentProgressModalProps> = ({
    studentId,
    classId,
    studentName,
    studentEmail,
    onClose
}) => {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<StudentStats | null>(null);

    useEffect(() => {
        const loadStudentData = async () => {
            try {
                setLoading(true);

                // 1. Get profile stats
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('xp, level, streak_days')
                    .eq('id', studentId)
                    .single();

                // 2. Get flashcard progress count
                const { count: flashcardsReviewed } = await supabase
                    .from('flashcard_progress')
                    .select('*', { count: 'exact', head: true })
                    .eq('student_id', studentId);

                // 3. Get quiz attempts for this class
                const { data: quizAttempts } = await supabase
                    .from('quiz_attempts')
                    .select('score, max_score, quiz_id')
                    .eq('student_id', studentId);

                // Filter by class (need to join with quizzes)
                const { data: classQuizzes } = await supabase
                    .from('quizzes')
                    .select('id')
                    .eq('class_id', classId);

                const classQuizIds = classQuizzes?.map(q => q.id) || [];
                const classAttempts = quizAttempts?.filter(a => classQuizIds.includes(a.quiz_id)) || [];

                const avgScore = classAttempts.length > 0
                    ? Math.round(classAttempts.reduce((sum, a) => sum + (a.score / a.max_score) * 100, 0) / classAttempts.length)
                    : 0;

                // 4. Get study sessions
                const { data: sessions } = await supabase
                    .from('study_sessions')
                    .select('duration_seconds, mode, completed_at')
                    .eq('student_id', studentId)
                    .eq('class_id', classId)
                    .order('completed_at', { ascending: false })
                    .limit(7);

                const totalMinutes = sessions?.reduce((sum, s) => sum + Math.round(s.duration_seconds / 60), 0) || 0;

                const recentSessions = sessions?.map(s => ({
                    date: new Date(s.completed_at).toLocaleDateString(),
                    duration: Math.round(s.duration_seconds / 60),
                    mode: s.mode
                })) || [];

                setStats({
                    xp: profile?.xp || 0,
                    level: profile?.level || 1,
                    streak_days: profile?.streak_days || 0,
                    flashcardsReviewed: flashcardsReviewed || 0,
                    quizAttempts: classAttempts.length,
                    avgQuizScore: avgScore,
                    totalStudyMinutes: totalMinutes,
                    recentSessions
                });

            } catch (error) {
                console.error('Error loading student data:', error);
            } finally {
                setLoading(false);
            }
        };

        loadStudentData();
    }, [studentId, classId]);

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="bg-gradient-to-r from-primary to-violet-600 p-6 text-white">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
                            <span className="material-symbols-outlined text-3xl">person</span>
                        </div>
                        <div>
                            <h2 className="text-2xl font-black">{studentName}</h2>
                            <p className="text-blue-100">{studentEmail}</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="ml-auto w-10 h-10 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"
                        >
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
                        </div>
                    ) : stats ? (
                        <>
                            {/* Quick Stats */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {[
                                    { label: 'Nivel', value: stats.level, icon: 'military_tech', color: 'violet' },
                                    { label: 'XP Total', value: stats.xp.toLocaleString(), icon: 'stars', color: 'amber' },
                                    { label: 'Racha', value: `${stats.streak_days}d`, icon: 'local_fire_department', color: 'orange' },
                                    { label: 'Tiempo Estudiado', value: `${stats.totalStudyMinutes}m`, icon: 'timer', color: 'blue' }
                                ].map((stat, i) => (
                                    <div key={i} className="bg-slate-50 p-4 rounded-xl text-center">
                                        <div className={`w-10 h-10 mx-auto rounded-lg flex items-center justify-center mb-2 ${stat.color === 'violet' ? 'bg-violet-100 text-violet-600' :
                                                stat.color === 'amber' ? 'bg-amber-100 text-amber-600' :
                                                    stat.color === 'orange' ? 'bg-orange-100 text-orange-600' :
                                                        'bg-blue-100 text-blue-600'
                                            }`}>
                                            <span className="material-symbols-outlined">{stat.icon}</span>
                                        </div>
                                        <p className="text-xl font-black text-slate-900">{stat.value}</p>
                                        <p className="text-xs text-slate-500">{stat.label}</p>
                                    </div>
                                ))}
                            </div>

                            {/* Activity Stats */}
                            <div className="grid md:grid-cols-2 gap-4">
                                <div className="bg-white p-4 rounded-xl border border-slate-100">
                                    <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                                        <span className="material-symbols-outlined text-blue-500">style</span>
                                        Flashcards
                                    </h3>
                                    <p className="text-3xl font-black text-blue-600">{stats.flashcardsReviewed}</p>
                                    <p className="text-sm text-slate-500">tarjetas repasadas</p>
                                </div>
                                <div className="bg-white p-4 rounded-xl border border-slate-100">
                                    <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                                        <span className="material-symbols-outlined text-violet-500">quiz</span>
                                        Quizzes
                                    </h3>
                                    <p className="text-3xl font-black text-violet-600">{stats.quizAttempts}</p>
                                    <p className="text-sm text-slate-500">intentos • Promedio: {stats.avgQuizScore}%</p>
                                </div>
                            </div>

                            {/* Recent Sessions */}
                            <div className="bg-white p-4 rounded-xl border border-slate-100">
                                <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-emerald-500">history</span>
                                    Sesiones Recientes
                                </h3>
                                {stats.recentSessions.length > 0 ? (
                                    <div className="space-y-2">
                                        {stats.recentSessions.map((session, i) => (
                                            <div key={i} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                                                <div className="flex items-center gap-3">
                                                    <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${session.mode === 'flashcards' ? 'bg-blue-100 text-blue-600' :
                                                            session.mode === 'quiz' ? 'bg-violet-100 text-violet-600' :
                                                                'bg-amber-100 text-amber-600'
                                                        }`}>
                                                        {session.mode === 'flashcards' ? '📚' : session.mode === 'quiz' ? '❓' : '⚡'}
                                                    </span>
                                                    <div>
                                                        <p className="font-medium text-slate-900 capitalize">{session.mode}</p>
                                                        <p className="text-xs text-slate-500">{session.date}</p>
                                                    </div>
                                                </div>
                                                <span className="text-sm font-bold text-slate-600">{session.duration} min</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-slate-500 text-center py-4">No hay sesiones registradas aún</p>
                                )}
                            </div>
                        </>
                    ) : (
                        <p className="text-center text-slate-500 py-8">No se pudo cargar la información</p>
                    )}
                </div>

                {/* Footer */}
                <div className="bg-slate-50 p-4 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-primary text-white font-bold rounded-xl hover:bg-blue-700 transition-colors"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default StudentProgressModal;
