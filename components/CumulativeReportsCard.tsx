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
            // Fetch quiz sessions WITHOUT join (avoid PGRST200 error)
            const { data: quizSessions, error: quizError } = await supabase
                .from('quiz_sessions')
                .select('id, created_at, score, total_questions, study_set_id')
                .eq('user_id', user!.id)
                .order('created_at', { ascending: false })
                .limit(50);

            if (quizError) console.error('Quiz sessions error:', quizError);

            // Fetch adaptive study sessions WITHOUT join (avoid PGRST200 error)
            const { data: adaptiveSessions, error: adaptiveError } = await supabase
                .from('adaptive_study_sessions')
                .select('id, created_at, mode, cards_correct, cards_studied, study_set_id, started_at, ended_at, duration_seconds')
                .eq('user_id', user!.id)
                .order('created_at', { ascending: false })
                .limit(50);

            if (adaptiveError) console.error('Adaptive sessions error:', adaptiveError);

            // Fetch review_logs for more accurate data (last 7 days)
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);

            const { data: reviewLogs, error: reviewError } = await supabase
                .from('review_logs')
                .select('id, rating, reviewed_at, response_time_ms, session_id')
                .eq('user_id', user!.id)
                .gte('reviewed_at', weekAgo.toISOString())
                .order('reviewed_at', { ascending: false });

            if (reviewError) console.error('Review logs error:', reviewError);

            // Group review logs by session or by day (for flashcard sessions without session_id)
            const reviewsByDay = new Map<string, { total: number; correct: number; timeMs: number }>();

            (reviewLogs || []).forEach(log => {
                const dateKey = new Date(log.reviewed_at).toDateString();
                const existing = reviewsByDay.get(dateKey) || { total: 0, correct: 0, timeMs: 0 };
                existing.total += 1;
                existing.correct += (log.rating >= 3) ? 1 : 0;
                existing.timeMs += log.response_time_ms || 0;
                reviewsByDay.set(dateKey, existing);
            });

            // Collect all unique study_set_ids to fetch names separately
            const studySetIds = new Set<string>();
            (quizSessions || []).forEach(s => s.study_set_id && studySetIds.add(s.study_set_id));
            (adaptiveSessions || []).forEach(s => s.study_set_id && studySetIds.add(s.study_set_id));

            // Fetch study set names separately (avoid PGRST200 join errors)
            const studySetNames = new Map<string, string>();
            if (studySetIds.size > 0) {
                const { data: studySets } = await supabase
                    .from('study_sets')
                    .select('id, name')
                    .in('id', Array.from(studySetIds));

                (studySets || []).forEach(s => studySetNames.set(s.id, s.name));
            }

            // Merge and format sessions from quiz_sessions and adaptive_study_sessions
            const allSessions: SessionSummary[] = [];

            if (quizSessions) {
                quizSessions.forEach(s => {
                    allSessions.push({
                        id: s.id,
                        created_at: s.created_at,
                        study_set_name: studySetNames.get(s.study_set_id) || 'Set Desconocido',
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
                        study_set_name: studySetNames.get(s.study_set_id) || 'Set Desconocido',
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

            // Calculate weekly stats using review_logs for accuracy
            const reviewLogStats = {
                totalQuestions: (reviewLogs || []).length,
                totalCorrect: (reviewLogs || []).filter(r => r.rating >= 3).length,
                totalTimeMs: (reviewLogs || []).reduce((sum, r) => sum + (r.response_time_ms || 0), 0)
            };

            // Use review_logs data if available, otherwise fallback to session data
            const weeklySessions = allSessions.filter(s => new Date(s.created_at) >= weekAgo);

            // Calculate total time from adaptive sessions with duration, or estimate from review logs
            let totalStudyTimeMinutes = 0;

            // First try to get real duration from adaptive sessions
            (adaptiveSessions || []).forEach(s => {
                if (new Date(s.created_at) >= weekAgo) {
                    if (s.duration_seconds) {
                        totalStudyTimeMinutes += s.duration_seconds / 60;
                    } else if (s.started_at && s.ended_at) {
                        const duration = (new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 1000 / 60;
                        totalStudyTimeMinutes += Math.min(duration, 60); // Cap at 60 min per session
                    }
                }
            });

            // If no duration data, estimate from review logs (avg 15 sec per question)
            if (totalStudyTimeMinutes === 0 && reviewLogStats.totalQuestions > 0) {
                totalStudyTimeMinutes = Math.max(1, Math.round(reviewLogStats.totalTimeMs / 1000 / 60));
                // Fallback: if response times weren't tracked, estimate 15 sec per question
                if (totalStudyTimeMinutes === 0) {
                    totalStudyTimeMinutes = Math.round(reviewLogStats.totalQuestions * 0.25); // 15 sec per question
                }
            }

            // Use the better data source for questions/accuracy
            const finalTotalQuestions = reviewLogStats.totalQuestions > 0
                ? reviewLogStats.totalQuestions
                : weeklySessions.reduce((sum, s) => sum + s.total, 0);

            const finalTotalCorrect = reviewLogStats.totalQuestions > 0
                ? reviewLogStats.totalCorrect
                : weeklySessions.reduce((sum, s) => sum + s.score, 0);

            setWeeklyStats({
                totalSessions: weeklySessions.length || (reviewLogStats.totalQuestions > 0 ? 1 : 0),
                totalQuestions: finalTotalQuestions,
                avgAccuracy: finalTotalQuestions > 0 ? Math.round((finalTotalCorrect / finalTotalQuestions) * 100) : 0,
                studyTime: Math.max(1, Math.round(totalStudyTimeMinutes))
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
                        {/* Weekly Stats Grid - 2x2 for sidebar */}
                        <div className="grid grid-cols-2 gap-2">
                            <div className="bg-violet-50 rounded-xl p-3 text-center">
                                <div className="text-2xl font-black text-violet-600">{weeklyStats.totalSessions}</div>
                                <div className="text-[10px] text-violet-500 font-medium uppercase">Sesiones</div>
                            </div>
                            <div className="bg-blue-50 rounded-xl p-3 text-center">
                                <div className="text-2xl font-black text-blue-600">{weeklyStats.totalQuestions}</div>
                                <div className="text-[10px] text-blue-500 font-medium uppercase">Preguntas</div>
                            </div>
                            <div className="bg-emerald-50 rounded-xl p-3 text-center">
                                <div className="text-2xl font-black text-emerald-600">{weeklyStats.avgAccuracy}%</div>
                                <div className="text-[10px] text-emerald-500 font-medium uppercase">Precisión</div>
                            </div>
                            <div className="bg-amber-50 rounded-xl p-3 text-center">
                                <div className="text-2xl font-black text-amber-600">{weeklyStats.studyTime}m</div>
                                <div className="text-[10px] text-amber-500 font-medium uppercase">Tiempo</div>
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
