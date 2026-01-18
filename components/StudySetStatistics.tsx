import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../contexts/AuthContext';

import { formatInterval } from '../services/AdaptiveLearningService';

interface SRSStats {
    id: string; // flashcard id
    question: string;
    state: string;
    next_review_at: string;
    mastery_level: number;
    difficulty: number;
    stability: number;
}

interface SessionHistory {
    id: string;
    created_at: string;
    mode: string;
    cards_correct: number;
    cards_studied: number;
    retention_rate: number;
}

const StudySetStatistics: React.FC<{ studySetId: string }> = ({ studySetId }) => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);

    // Data states
    const [flashcardStats, setFlashcardStats] = useState<SRSStats[]>([]);
    const [sessionHistory, setSessionHistory] = useState<SessionHistory[]>([]);
    const [viewMode, setViewMode] = useState<'flashcards' | 'history'>('flashcards');

    useEffect(() => {
        fetchStats();
    }, [studySetId]);

    const fetchStats = async () => {
        setLoading(true);
        try {
            // 1. Fetch all flashcards for this study set
            const { data: allCards, error: cardsError } = await supabase
                .from('flashcards')
                .select('id, question, category')
                .eq('study_set_id', studySetId);

            if (cardsError) {
                console.error('Error fetching flashcards:', cardsError);
            }

            // 2. Fetch SRS data for this user
            const flashcardIds = (allCards || []).map(c => c.id);

            let srsDataMap = new Map<string, any>();

            if (flashcardIds.length > 0) {
                const { data: srsData, error: srsError } = await supabase
                    .from('flashcard_srs_data')
                    .select('flashcard_id, state, next_review_at, mastery_level, difficulty, stability, interval_days')
                    .eq('user_id', user.id)
                    .in('flashcard_id', flashcardIds);

                if (srsError) {
                    console.error('Error fetching SRS data:', srsError);
                }

                // Create a map for quick lookup
                (srsData || []).forEach(srs => {
                    srsDataMap.set(srs.flashcard_id, srs);
                });
            }

            // 3. Merge flashcards with their SRS data
            const mergedStats: SRSStats[] = (allCards || []).map(c => {
                const srs = srsDataMap.get(c.id);
                return {
                    id: c.id,
                    question: c.question,
                    state: srs ? srs.state : 'new',
                    next_review_at: srs ? srs.next_review_at : null,
                    mastery_level: srs ? srs.mastery_level : 0,
                    difficulty: srs ? srs.difficulty : 0,
                    stability: srs ? srs.stability : 0
                };
            });

            setFlashcardStats(mergedStats);

            // 4. Fetch Session History (Adaptive Sessions)
            const { data: sessions, error: sessError } = await supabase
                .from('adaptive_study_sessions')
                .select('id, created_at, mode, cards_correct, cards_studied, retention_rate')
                .eq('study_set_id', studySetId)
                .eq('user_id', user.id);

            // 5. Fetch Quiz Sessions (New Adaptive Quizzes)
            const { data: quizSessions, error: quizError } = await supabase
                .from('quiz_sessions')
                .select('id, created_at, score, total_questions')
                .eq('study_set_id', studySetId)
                .eq('user_id', user.id);

            if (quizError) console.error('Error fetching quiz sessions:', quizError);

            // Merge and format
            let allSessions: SessionHistory[] = [];

            if (sessions) {
                allSessions = [...allSessions, ...sessions];
            }

            if (quizSessions) {
                const mappedQuizzes: SessionHistory[] = quizSessions.map(q => ({
                    id: q.id,
                    created_at: q.created_at,
                    mode: 'quiz',
                    cards_correct: q.score,
                    cards_studied: q.total_questions,
                    retention_rate: 0 // Not used for sorting, calculated on display
                }));
                allSessions = [...allSessions, ...mappedQuizzes];
            }

            // Sort by date desc
            allSessions.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

            setSessionHistory(allSessions);

        } catch (e) {
            console.error("Error loading stats", e);
        } finally {
            setLoading(false);
        }
    };

    const getNextReviewLabel = (dateStr: string | null) => {
        if (!dateStr) return 'Sin programar';
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = date.getTime() - now.getTime();

        if (diffMs < 0) return '¡Ahora!';

        const totalMinutes = Math.floor(diffMs / (1000 * 60));
        const totalHours = Math.floor(diffMs / (1000 * 60 * 60));
        const days = Math.floor(totalHours / 24);
        const hours = totalHours % 24;
        const minutes = totalMinutes % 60;

        // Less than 1 hour: show minutes
        if (totalHours < 1) {
            return `${totalMinutes} min`;
        }

        // Less than 24 hours: show hours and minutes
        if (days < 1) {
            if (minutes > 0) {
                return `${totalHours}h ${minutes}m`;
            }
            return `${totalHours} horas`;
        }

        // 1+ days: show days and hours
        if (hours > 0) {
            return `${days}d ${hours}h`;
        }
        return `${days} días`;
    };

    const getStateColor = (state: string) => {
        switch (state) {
            case 'new': return 'bg-gray-100 text-gray-600';
            case 'learning': return 'bg-blue-100 text-blue-600';
            case 'review': return 'bg-purple-100 text-purple-600';
            case 'relearning': return 'bg-orange-100 text-orange-600';
            default: return 'bg-gray-100 text-gray-600';
        }
    };

    if (loading) return <div className="p-8 text-center text-slate-500">Cargando estadísticas...</div>;

    return (
        <div className="space-y-8 animate-fade-in-up">
            {/* Overview Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <div className="text-sm text-slate-500 font-medium">Flashcards Activas</div>
                    <div className="text-2xl font-bold text-slate-800">{flashcardStats.filter(s => s.state !== 'new').length}</div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <div className="text-sm text-slate-500 font-medium">Dominadas (Lvl 4+)</div>
                    <div className="text-2xl font-bold text-emerald-600">{flashcardStats.filter(s => s.mastery_level >= 4).length}</div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <div className="text-sm text-slate-500 font-medium">Quizzes/Exámenes</div>
                    <div className="text-2xl font-bold text-indigo-600">{sessionHistory.filter(s => s.mode === 'exam' || s.mode === 'quiz').length}</div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <div className="text-sm text-slate-500 font-medium">Precisión Promedio</div>
                    <div className="text-2xl font-bold text-slate-800">
                        {sessionHistory.length > 0
                            ? Math.round(sessionHistory.reduce((acc, curr) => acc + (curr.cards_correct / curr.cards_studied || 0), 0) / sessionHistory.length * 100)
                            : 0}%
                    </div>
                </div>
            </div>

            {/* Tabs / Toggle */}
            <div className="flex space-x-2 border-b border-slate-200">
                <button
                    className={`px-4 py-2 font-medium text-sm transition-colors ${viewMode === 'flashcards' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                    onClick={() => setViewMode('flashcards')}
                >
                    Estado de Flashcards
                </button>
                <button
                    className={`px-4 py-2 font-medium text-sm transition-colors ${viewMode === 'history' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                    onClick={() => setViewMode('history')}
                >
                    Historial de Sesiones (Quiz/Exam)
                </button>
            </div>

            {/* Content */}
            {viewMode === 'flashcards' && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase tracking-wider">
                                <th className="p-4 font-semibold">Pregunta</th>
                                <th className="p-4 font-semibold">Estado</th>
                                <th className="p-4 font-semibold">Próximo Repaso</th>
                                <th className="p-4 font-semibold">Nivel Maestría</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-sm">
                            {flashcardStats.map(stat => (
                                <tr key={stat.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="p-4 text-slate-700 font-medium max-w-xs truncate" title={stat.question}>
                                        {stat.question}
                                    </td>
                                    <td className="p-4">
                                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStateColor(stat.state)}`}>
                                            {stat.state === 'new' ? 'Nuevo' :
                                                stat.state === 'learning' ? 'Aprendiendo' :
                                                    stat.state === 'review' ? 'Repaso' : 'Relearning'}
                                        </span>
                                    </td>
                                    <td className="p-4 text-slate-600">
                                        {getNextReviewLabel(stat.next_review_at)}
                                    </td>
                                    <td className="p-4">
                                        <div className="flex items-center space-x-2">
                                            <div className="w-24 bg-slate-200 rounded-full h-2">
                                                <div
                                                    className={`h-2 rounded-full ${stat.mastery_level >= 4 ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                                                    style={{ width: `${Math.min((stat.mastery_level / 5) * 100, 100)}%` }}
                                                ></div>
                                            </div>
                                            <span className="text-xs text-slate-500">{stat.mastery_level}/5</span>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {flashcardStats.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="p-8 text-center text-slate-400">
                                        No hay flashcards en este set.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {viewMode === 'history' && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase tracking-wider">
                                <th className="p-4 font-semibold">Fecha</th>
                                <th className="p-4 font-semibold">Modo</th>
                                <th className="p-4 font-semibold">Puntaje</th>
                                <th className="p-4 font-semibold">Detalles</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-sm">
                            {sessionHistory.map(sess => (
                                <tr key={sess.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="p-4 text-slate-700">
                                        {new Date(sess.created_at).toLocaleDateString()} {new Date(sess.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </td>
                                    <td className="p-4">
                                        <span className={`px-2 py-1 rounded-full text-xs font-semibold uppercase ${sess.mode === 'exam' ? 'bg-rose-100 text-rose-700' :
                                            sess.mode === 'quiz' ? 'bg-indigo-100 text-indigo-700' :
                                                'bg-slate-100 text-slate-600'
                                            }`}>
                                            {sess.mode}
                                        </span>
                                    </td>
                                    <td className="p-4 font-medium">
                                        <span className={
                                            (sess.cards_correct / sess.cards_studied) >= 0.8 ? 'text-emerald-600' :
                                                (sess.cards_correct / sess.cards_studied) >= 0.6 ? 'text-orange-600' : 'text-red-600'
                                        }>
                                            {Math.round((sess.cards_correct / sess.cards_studied) * 100)}%
                                        </span>
                                    </td>
                                    <td className="p-4 text-slate-500">
                                        {sess.cards_correct}/{sess.cards_studied} correctas
                                    </td>
                                </tr>
                            ))}
                            {sessionHistory.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="p-8 text-center text-slate-400">
                                        No has realizado sesiones de estudio aún.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default StudySetStatistics;
