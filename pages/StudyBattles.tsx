import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { BattleService, Battle } from '../services/BattleService';
import { supabase } from '../services/supabaseClient';

const StudyBattles: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [battles, setBattles] = useState<Battle[]>([]);
    const [pendingBattles, setPendingBattles] = useState<Battle[]>([]);
    const [showChallengeModal, setShowChallengeModal] = useState(false);
    const [classmates, setClassmates] = useState<any[]>([]);
    const [selectedClass, setSelectedClass] = useState<string | null>(null);
    const [enrolledClasses, setEnrolledClasses] = useState<any[]>([]);
    const [leaderboard, setLeaderboard] = useState<any[]>([]);
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        if (!user) return;
        loadData();
    }, [user]);

    const loadData = async () => {
        if (!user) return;
        setLoading(true);
        try {
            // Load all battles
            const allBattles = await BattleService.getBattles(user.id);
            setBattles(allBattles.filter(b => b.status !== 'pending' || b.challenger_id === user.id));

            // Load pending challenges for me
            const pending = await BattleService.getPendingBattles(user.id);
            setPendingBattles(pending);

            // Load enrolled classes for challenge selection
            const { data: enrollments } = await supabase
                .from('enrollments')
                .select('class_id, classes(id, name)')
                .eq('student_id', user.id);

            const classes = enrollments?.map(e => e.classes).filter(Boolean) || [];
            setEnrolledClasses(classes as any[]);

            // Load leaderboard for first class if available
            if (classes.length > 0) {
                const firstClassId = (classes[0] as any).id;
                setSelectedClass(firstClassId);
                const lb = await BattleService.getWeeklyLeaderboard(firstClassId);
                setLeaderboard(lb);
            }
        } catch (error) {
            console.error('Error loading battles:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAcceptBattle = async (battle: Battle) => {
        try {
            await BattleService.acceptBattle(battle.id);
            navigate(`/student/battle/${battle.id}`);
        } catch (error) {
            console.error('Error accepting battle:', error);
        }
    };

    const handleStartChallenge = async () => {
        if (!selectedClass) return;
        try {
            const mates = await BattleService.getClassmates(user!.id, selectedClass);
            setClassmates(mates);
            setShowChallengeModal(true);
        } catch (error) {
            console.error('Error loading classmates:', error);
        }
    };

    const handleCreateBattle = async (opponentId: string) => {
        if (!user || !selectedClass) return;
        setCreating(true);
        try {
            const battle = await BattleService.createBattle(user.id, opponentId, selectedClass);
            setShowChallengeModal(false);
            loadData(); // Refresh
        } catch (error) {
            console.error('Error creating battle:', error);
        } finally {
            setCreating(false);
        }
    };

    const getStatusBadge = (battle: Battle) => {
        if (battle.status === 'pending') {
            return <span className="bg-amber-100 text-amber-600 px-3 py-1 rounded-full text-xs font-bold">Pendiente</span>;
        }
        if (battle.status === 'active') {
            return <span className="bg-blue-100 text-blue-600 px-3 py-1 rounded-full text-xs font-bold">En Progreso</span>;
        }
        if (battle.status === 'completed') {
            if (battle.winner_id === user?.id) {
                return <span className="bg-emerald-100 text-emerald-600 px-3 py-1 rounded-full text-xs font-bold">¡Ganaste!</span>;
            } else if (battle.winner_id) {
                return <span className="bg-rose-100 text-rose-600 px-3 py-1 rounded-full text-xs font-bold">Perdiste</span>;
            }
            return <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-bold">Empate</span>;
        }
        return <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-bold">Expirado</span>;
    };

    const getOpponentName = (battle: Battle) => {
        if (battle.challenger_id === user?.id) {
            return battle.opponent?.full_name || 'Oponente';
        }
        return battle.challenger?.full_name || 'Retador';
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-100 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-100">
            {/* Header */}
            <header className="bg-gradient-to-r from-violet-600 to-purple-700 text-white px-6 py-8">
                <div className="max-w-4xl mx-auto">
                    <button onClick={() => navigate('/student')} className="flex items-center gap-2 text-white/80 hover:text-white mb-4">
                        <span className="material-symbols-outlined">arrow_back</span>
                        Volver
                    </button>
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center">
                            <span className="material-symbols-outlined text-3xl">swords</span>
                        </div>
                        <div>
                            <h1 className="text-2xl font-black">Batallas de Estudio</h1>
                            <p className="text-violet-200">Reta a tus compañeros y demuestra lo que sabes</p>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
                {/* Pending Challenges Section */}
                {pendingBattles.length > 0 && (
                    <section>
                        <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                            <span className="material-symbols-outlined text-amber-500">notifications_active</span>
                            Te han retado ({pendingBattles.length})
                        </h2>
                        <div className="space-y-3">
                            {pendingBattles.map(battle => (
                                <div key={battle.id} className="bg-gradient-to-r from-amber-50 to-orange-50 p-5 rounded-2xl border-2 border-amber-200 flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-full bg-amber-200 flex items-center justify-center">
                                        <span className="material-symbols-outlined text-amber-700">person</span>
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-bold text-slate-900">{battle.challenger?.full_name}</p>
                                        <p className="text-sm text-slate-500">{battle.question_count} preguntas • Expira pronto</p>
                                    </div>
                                    <button
                                        onClick={() => handleAcceptBattle(battle)}
                                        className="bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold px-5 py-2 rounded-xl hover:shadow-lg transition-all"
                                    >
                                        ¡Aceptar Reto!
                                    </button>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* New Challenge Button */}
                <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-violet-100 flex items-center justify-center">
                                <span className="material-symbols-outlined text-violet-600 text-2xl">add_circle</span>
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-900">Iniciar Nueva Batalla</h3>
                                <p className="text-sm text-slate-500">Reta a un compañero de clase</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            {enrolledClasses.length > 0 && (
                                <select
                                    value={selectedClass || ''}
                                    onChange={(e) => setSelectedClass(e.target.value)}
                                    className="px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none"
                                >
                                    {enrolledClasses.map((cls: any) => (
                                        <option key={cls.id} value={cls.id}>{cls.name}</option>
                                    ))}
                                </select>
                            )}
                            <button
                                onClick={handleStartChallenge}
                                disabled={!selectedClass}
                                className="bg-gradient-to-r from-violet-600 to-purple-600 text-white font-bold px-6 py-2 rounded-xl hover:shadow-lg transition-all disabled:opacity-50"
                            >
                                <span className="material-symbols-outlined align-middle mr-1">swords</span>
                                Retar
                            </button>
                        </div>
                    </div>
                </section>

                {/* Leaderboard */}
                <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                        <span className="material-symbols-outlined text-amber-500">emoji_events</span>
                        Ranking Semanal
                    </h2>
                    {leaderboard.length > 0 ? (
                        <div className="space-y-3">
                            {leaderboard.slice(0, 5).map((player, index) => (
                                <div key={player.player_id} className={`flex items-center gap-4 p-3 rounded-xl ${index === 0 ? 'bg-amber-50 border border-amber-100' : 'bg-slate-50'}`}>
                                    <span className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm ${index === 0 ? 'bg-amber-500 text-white' :
                                            index === 1 ? 'bg-slate-400 text-white' :
                                                index === 2 ? 'bg-amber-700 text-white' :
                                                    'bg-slate-200 text-slate-600'
                                        }`}>
                                        {index + 1}
                                    </span>
                                    <div className="flex-1">
                                        <p className="font-bold text-slate-900">{player.full_name}</p>
                                        <p className="text-xs text-slate-500">{player.battles} batallas</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-black text-violet-600">{player.wins} W</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-slate-500 text-center py-6">No hay batallas esta semana. ¡Sé el primero en retar!</p>
                    )}
                </section>

                {/* Battle History */}
                <section>
                    <h2 className="text-lg font-bold text-slate-900 mb-4">Historial de Batallas</h2>
                    {battles.length > 0 ? (
                        <div className="space-y-3">
                            {battles.map(battle => (
                                <div key={battle.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-full bg-violet-100 flex items-center justify-center">
                                        <span className="material-symbols-outlined text-violet-600">person</span>
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-bold text-slate-900">vs {getOpponentName(battle)}</p>
                                        <p className="text-sm text-slate-500">
                                            {battle.challenger_id === user?.id
                                                ? `${battle.challenger_score} - ${battle.opponent_score}`
                                                : `${battle.opponent_score} - ${battle.challenger_score}`
                                            }
                                        </p>
                                    </div>
                                    {getStatusBadge(battle)}
                                    {battle.status === 'active' && (
                                        <button
                                            onClick={() => navigate(`/student/battle/${battle.id}`)}
                                            className="bg-violet-600 text-white font-bold px-4 py-2 rounded-xl"
                                        >
                                            Continuar
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="bg-slate-50 p-12 rounded-2xl text-center">
                            <span className="material-symbols-outlined text-4xl text-slate-300 mb-4">swords</span>
                            <p className="text-slate-500">No has tenido batallas aún</p>
                            <p className="text-sm text-slate-400 mt-1">¡Reta a un compañero para comenzar!</p>
                        </div>
                    )}
                </section>
            </main>

            {/* Challenge Modal */}
            {showChallengeModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden">
                        <div className="p-6 border-b border-slate-100">
                            <h2 className="text-xl font-black text-slate-900">Elige a tu oponente</h2>
                            <p className="text-slate-500 text-sm">Selecciona un compañero de clase</p>
                        </div>
                        <div className="p-4 max-h-80 overflow-y-auto">
                            {classmates.length > 0 ? (
                                <div className="space-y-2">
                                    {classmates.map(mate => (
                                        <button
                                            key={mate.id}
                                            onClick={() => handleCreateBattle(mate.id)}
                                            disabled={creating}
                                            className="w-full flex items-center gap-4 p-4 rounded-xl hover:bg-violet-50 transition-colors border border-slate-100 disabled:opacity-50"
                                        >
                                            <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center">
                                                <span className="material-symbols-outlined text-violet-600">person</span>
                                            </div>
                                            <span className="font-bold text-slate-900">{mate.full_name}</span>
                                            <span className="material-symbols-outlined ml-auto text-slate-400">chevron_right</span>
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-slate-500 text-center py-8">No hay compañeros disponibles en esta clase</p>
                            )}
                        </div>
                        <div className="bg-slate-50 p-4 flex justify-end">
                            <button
                                onClick={() => setShowChallengeModal(false)}
                                className="px-4 py-2 text-slate-600 font-medium hover:text-slate-800"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StudyBattles;
