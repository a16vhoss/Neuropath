import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../contexts/AuthContext';

interface SessionSummary {
    id: string;
    created_at: string;
    study_set_name: string;
    study_set_id: string;
    mode: string;
    score: number;
    total: number;
    accuracy: number;
}

interface WeeklyStats {
    totalSessions: number;
    totalQuestions: number;
    avgAccuracy: number;
    studyTime: number; // estimated minutes
}

const CumulativeReportsCard: React.FC = () => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [sessions, setSessions] = useState<SessionSummary[]>([]);
    const [weeklyStats, setWeeklyStats] = useState<WeeklyStats>({
        totalSessions: 0,
        totalQuestions: 0,
        avgAccuracy: 0,
        studyTime: 0
    });
    const [viewMode, setViewMode] = useState<'overview' | 'history'>('overview');

    useEffect(() => {
        if (user) {
            fetchReports();
        }
    }, [user]);

    const fetchReports = async () => {
        setLoading(true);
        try {
            // Fetch quiz sessions with study set names
            const { data: quizSessions, error: quizError } = await supabase
                .from('quiz_sessions')
                .select(`
                    id,
                    created_at,
                    score,
                    total_questions,
                    study_set_id,
                    study_sets(name)
                `)
                .eq('user_id', user!.id)
                .order('created_at', { ascending: false })
                .limit(50);

            if (quizError) console.error('Quiz sessions error:', quizError);

            // Fetch adaptive study sessions
            const { data: adaptiveSessions, error: adaptiveError } = await supabase
                .from('adaptive_study_sessions')
                .select(`
                    id,
                    created_at,
                    mode,
                    cards_correct,
                    cards_studied,
                    study_set_id,
                    study_sets(name)
                `)
                .eq('user_id', user!.id)
                .order('created_at', { ascending: false })
                .limit(50);

            if (adaptiveError) console.error('Adaptive sessions error:', adaptiveError);

            // Merge and format sessions
            const allSessions: SessionSummary[] = [];

            if (quizSessions) {
                quizSessions.forEach(s => {
                    allSessions.push({
                        id: s.id,
                        created_at: s.created_at,
                        study_set_name: (s.study_sets as any)?.name || 'Set Desconocido',
                        study_set_id: s.study_set_id,
                        mode: 'quiz',
                        score: s.score || 0,
                        total: s.total_questions || 0,
                        accuracy: s.total_questions ? Math.round((s.score / s.total_questions) * 100) : 0
                    });
                });
            }

            if (adaptiveSessions) {
                adaptiveSessions.forEach(s => {
                    allSessions.push({
                        id: s.id,
                        created_at: s.created_at,
                        study_set_name: (s.study_sets as any)?.name || 'Set Desconocido',
                        study_set_id: s.study_set_id,
                        mode: s.mode || 'flashcards',
                        score: s.cards_correct || 0,
                        total: s.cards_studied || 0,
                        accuracy: s.cards_studied ? Math.round((s.cards_correct / s.cards_studied) * 100) : 0
                    });
                });
            }

            // Sort by date
            allSessions.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            setSessions(allSessions);

            // Calculate weekly stats (last 7 days)
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);

            const weeklySessions = allSessions.filter(s => new Date(s.created_at) >= weekAgo);
            const totalQuestions = weeklySessions.reduce((sum, s) => sum + s.total, 0);
            const totalCorrect = weeklySessions.reduce((sum, s) => sum + s.score, 0);

            setWeeklyStats({
                totalSessions: weeklySessions.length,
                totalQuestions,
                avgAccuracy: totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0,
                studyTime: weeklySessions.length * 5 // Estimated 5 min per session
            });

        } catch (error) {
            console.error('Error fetching reports:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('es-MX', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getModeIcon = (mode: string) => {
        switch (mode) {
            case 'quiz': return 'quiz';
            case 'flashcards': return 'style';
            case 'exam': return 'assignment';
            case 'cramming': return 'bolt';
            default: return 'school';
        }
    };

    const getModeLabel = (mode: string) => {
        switch (mode) {
            case 'quiz': return 'Quiz';
            case 'flashcards': return 'Flashcards';
            case 'exam': return 'Examen';
            case 'cramming': return 'Cramming';
            default: return mode;
        }
    };

    if (loading) {
        return (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 animate-pulse">
                <div className="h-6 bg-slate-200 rounded w-1/3 mb-4"></div>
                <div className="h-20 bg-slate-200 rounded"></div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-violet-500">analytics</span>
                    <h3 className="font-bold text-slate-900">Reportes Acumulativos</h3>
                </div>
                <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
                    <button
                        onClick={() => setViewMode('overview')}
                        className={`px-3 py-1 text-xs font-semibold rounded-md transition ${viewMode === 'overview'
                                ? 'bg-white text-violet-600 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        Resumen
                    </button>
                    <button
                        onClick={() => setViewMode('history')}
                        className={`px-3 py-1 text-xs font-semibold rounded-md transition ${viewMode === 'history'
                                ? 'bg-white text-violet-600 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        Historial
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="p-4">
                {viewMode === 'overview' && (
                    <div className="space-y-4">
                        {/* Weekly Stats Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-xl p-4 border border-violet-100">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="material-symbols-outlined text-violet-500 text-lg">calendar_today</span>
                                    <span className="text-xs text-violet-600 font-medium">Esta Semana</span>
                                </div>
                                <div className="text-2xl font-black text-violet-700">{weeklyStats.totalSessions}</div>
                                <div className="text-xs text-violet-500">sesiones</div>
                            </div>
                            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="material-symbols-outlined text-blue-500 text-lg">help</span>
                                    <span className="text-xs text-blue-600 font-medium">Preguntas</span>
                                </div>
                                <div className="text-2xl font-black text-blue-700">{weeklyStats.totalQuestions}</div>
                                <div className="text-xs text-blue-500">respondidas</div>
                            </div>
                            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-4 border border-emerald-100">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="material-symbols-outlined text-emerald-500 text-lg">check_circle</span>
                                    <span className="text-xs text-emerald-600 font-medium">Precisión</span>
                                </div>
                                <div className="text-2xl font-black text-emerald-700">{weeklyStats.avgAccuracy}%</div>
                                <div className="text-xs text-emerald-500">promedio</div>
                            </div>
                            <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-4 border border-amber-100">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="material-symbols-outlined text-amber-500 text-lg">timer</span>
                                    <span className="text-xs text-amber-600 font-medium">Tiempo</span>
                                </div>
                                <div className="text-2xl font-black text-amber-700">{weeklyStats.studyTime}</div>
                                <div className="text-xs text-amber-500">minutos</div>
                            </div>
                        </div>

                        {/* Recent Sessions Preview */}
                        <div>
                            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Últimas Sesiones</h4>
                            <div className="space-y-2">
                                {sessions.slice(0, 3).map(session => (
                                    <div key={session.id} className="flex items-center justify-between bg-slate-50 rounded-lg p-3">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${session.mode === 'quiz' ? 'bg-indigo-100 text-indigo-600' :
                                                    session.mode === 'exam' ? 'bg-rose-100 text-rose-600' :
                                                        'bg-slate-200 text-slate-600'
                                                }`}>
                                                <span className="material-symbols-outlined text-sm">{getModeIcon(session.mode)}</span>
                                            </div>
                                            <div>
                                                <div className="text-sm font-medium text-slate-800">{session.study_set_name}</div>
                                                <div className="text-xs text-slate-400">{formatDate(session.created_at)}</div>
                                            </div>
                                        </div>
                                        <div className={`text-sm font-bold ${session.accuracy >= 80 ? 'text-emerald-600' :
                                                session.accuracy >= 60 ? 'text-amber-600' :
                                                    'text-red-500'
                                            }`}>
                                            {session.accuracy}%
                                        </div>
                                    </div>
                                ))}
                                {sessions.length === 0 && (
                                    <div className="text-center text-slate-400 py-4">
                                        No hay sesiones de estudio aún
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {viewMode === 'history' && (
                    <div className="max-h-80 overflow-y-auto">
                        <table className="w-full text-sm">
                            <thead className="text-xs text-slate-500 uppercase sticky top-0 bg-white">
                                <tr className="border-b border-slate-100">
                                    <th className="text-left py-2 px-2">Fecha</th>
                                    <th className="text-left py-2 px-2">Set</th>
                                    <th className="text-left py-2 px-2">Modo</th>
                                    <th className="text-right py-2 px-2">Score</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {sessions.map(session => (
                                    <tr key={session.id} className="hover:bg-slate-50">
                                        <td className="py-2 px-2 text-slate-600">{formatDate(session.created_at)}</td>
                                        <td className="py-2 px-2 font-medium text-slate-800 max-w-[120px] truncate">
                                            {session.study_set_name}
                                        </td>
                                        <td className="py-2 px-2">
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${session.mode === 'quiz' ? 'bg-indigo-100 text-indigo-700' :
                                                    session.mode === 'exam' ? 'bg-rose-100 text-rose-700' :
                                                        'bg-slate-100 text-slate-600'
                                                }`}>
                                                {getModeLabel(session.mode)}
                                            </span>
                                        </td>
                                        <td className="py-2 px-2 text-right">
                                            <span className={`font-bold ${session.accuracy >= 80 ? 'text-emerald-600' :
                                                    session.accuracy >= 60 ? 'text-amber-600' :
                                                        'text-red-500'
                                                }`}>
                                                {session.score}/{session.total}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {sessions.length === 0 && (
                            <div className="text-center text-slate-400 py-8">
                                No hay sesiones de estudio registradas
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default CumulativeReportsCard;
