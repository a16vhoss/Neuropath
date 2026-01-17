import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { GamificationService, Achievement, UserStats } from '../services/GamificationService';

interface ExtendedAchievement extends Achievement {
    earned: boolean;
    earnedDate?: string;
    progress: number;
}

const StudentAchievements: React.FC = () => {
    const navigate = useNavigate();
    const { user, signOut } = useAuth();
    const [activeTab, setActiveTab] = useState<'badges' | 'leaderboard' | 'stats'>('badges');

    // State
    const [stats, setStats] = useState<UserStats | null>(null);
    const [achievements, setAchievements] = useState<ExtendedAchievement[]>([]);
    const [leaderboard, setLeaderboard] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) return;

        const loadData = async () => {
            try {
                setLoading(true);

                // 1. Load User Stats
                const userStats = await GamificationService.getUserStats(user.id);
                setStats(userStats);

                // 2. Load Achievements
                const allAchievements = await GamificationService.getAchievements();
                const myAchievements = await GamificationService.getStudentAchievements(user.id);

                const mergedAchievements = allAchievements.map(ach => {
                    const earnedRecord = myAchievements.find(ma => ma.achievement_id === ach.id);
                    return {
                        ...ach,
                        earned: !!earnedRecord,
                        earnedDate: earnedRecord ? new Date(earnedRecord.earned_at).toLocaleDateString() : undefined,
                        progress: earnedRecord ? 100 : 0 // Todo: Calculate real progress
                    };
                });
                setAchievements(mergedAchievements);

                // 3. Load Leaderboard
                const lbData = await GamificationService.getLeaderboard();
                setLeaderboard(lbData);

            } catch (error) {
                console.error("Error loading gamification data:", error);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [user]);

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>;
    }

    return (
        <div className="min-h-screen bg-[#F9FAFB] flex flex-col pb-24">
            {/* Bottom Navigation Bar */}
            <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-lg z-50 pb-safe">
                <div className="max-w-lg mx-auto px-4">
                    <div className="flex justify-around items-center py-2">
                        <button
                            onClick={() => navigate('/student')}
                            className="flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-colors text-slate-500 hover:text-primary"
                        >
                            <span className="material-symbols-outlined text-2xl">home</span>
                            <span className="text-xs font-medium">Inicio</span>
                        </button>
                        <button
                            onClick={() => navigate('/student')}
                            className="flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-colors text-slate-500 hover:text-primary"
                        >
                            <span className="material-symbols-outlined text-2xl">auto_stories</span>
                            <span className="text-xs font-medium">Mis Sets</span>
                        </button>
                        <button
                            className="flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-colors text-primary bg-primary/10"
                        >
                            <span className="material-symbols-outlined text-2xl">emoji_events</span>
                            <span className="text-xs font-medium">Logros</span>
                        </button>
                        <button
                            onClick={() => signOut()}
                            className="flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-colors text-slate-500 hover:text-rose-500"
                        >
                            <span className="material-symbols-outlined text-2xl">logout</span>
                            <span className="text-xs font-medium">Salir</span>
                        </button>
                    </div>
                </div>
            </nav>

            <main className="flex-1 p-6 md:p-12 max-w-5xl mx-auto w-full space-y-8 pb-24 md:pb-12">
                {/* Header */}
                <header className="flex items-center gap-4">
                    <button onClick={() => navigate('/student')} className="w-10 h-10 rounded-full hover:bg-slate-100 flex items-center justify-center md:hidden">
                        <span className="material-symbols-outlined">arrow_back</span>
                    </button>
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Logros y Rachas</h1>
                        <p className="text-slate-500">Tu progreso y posición en la comunidad</p>
                    </div>
                </header>

                {/* Stats Summary */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                        { label: 'Racha Actual', value: `${stats?.streak_days || 0} días`, icon: 'local_fire_department', color: 'amber' },
                        { label: 'XP Total', value: stats?.xp?.toLocaleString() || '0', icon: 'stars', color: 'violet' },
                        { label: 'Badges', value: `${achievements.filter(a => a.earned).length}/${achievements.length}`, icon: 'emoji_events', color: 'blue' },
                        { label: 'Nivel', value: `Lvl ${stats?.level || 1}`, icon: 'leaderboard', color: 'emerald' }
                    ].map((stat, i) => (
                        <div key={i} className={`bg-white p-4 rounded-2xl border border-slate-100 shadow-sm text-center`}>
                            <div className={`w-10 h-10 mx-auto rounded-xl flex items-center justify-center mb-2 ${stat.color === 'amber' ? 'bg-amber-100 text-amber-600' :
                                stat.color === 'violet' ? 'bg-violet-100 text-violet-600' :
                                    stat.color === 'blue' ? 'bg-blue-100 text-blue-600' :
                                        'bg-emerald-100 text-emerald-600'
                                }`}>
                                <span className="material-symbols-outlined">{stat.icon}</span>
                            </div>
                            <p className="text-2xl font-black text-slate-900">{stat.value}</p>
                            <p className="text-xs text-slate-500">{stat.label}</p>
                        </div>
                    ))}
                </div>

                {/* Tabs */}
                <div className="flex bg-slate-100 p-1 rounded-xl">
                    {[
                        { id: 'badges', label: 'Badges', icon: 'emoji_events' },
                        { id: 'leaderboard', label: 'Leaderboard', icon: 'leaderboard' },
                        { id: 'stats', label: 'Estadísticas', icon: 'bar_chart' }
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-bold transition-all ${activeTab === tab.id ? 'bg-white text-primary shadow-sm' : 'text-slate-500'
                                }`}
                        >
                            <span className="material-symbols-outlined text-lg">{tab.icon}</span>
                            <span className="hidden sm:inline">{tab.label}</span>
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                {activeTab === 'badges' && (
                    <div className="grid md:grid-cols-2 gap-4">
                        {achievements.map((badge) => (
                            <div
                                key={badge.id}
                                className={`p-6 rounded-2xl border ${badge.earned ? 'bg-white border-slate-100' : 'bg-slate-50 border-slate-100'} relative overflow-hidden`}
                            >
                                {badge.earned && (
                                    <div className="absolute top-2 right-2">
                                        <span className="material-symbols-outlined text-emerald-500">verified</span>
                                    </div>
                                )}
                                <div className="flex items-center gap-4">
                                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${badge.earned ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-white' : 'bg-slate-200 text-slate-400'
                                        }`}>
                                        <span className="material-symbols-outlined text-3xl">{badge.icon}</span>
                                    </div>
                                    <div className="flex-1">
                                        <h3 className={`font-bold ${badge.earned ? 'text-slate-900' : 'text-slate-500'}`}>{badge.name}</h3>
                                        <p className="text-sm text-slate-500">{badge.description}</p>
                                        {badge.earned ? (
                                            <p className="text-xs text-emerald-600 font-medium mt-1">Obtenido el {badge.earnedDate}</p>
                                        ) : (
                                            <div className="mt-2">
                                                <div className="flex justify-between text-xs mb-1">
                                                    <span className="text-slate-400">Progreso</span>
                                                    <span className="text-slate-600 font-bold">{badge.progress}%</span>
                                                </div>
                                                <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                                    <div className="bg-primary h-full rounded-full" style={{ width: `${badge.progress}%` }}></div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {activeTab === 'leaderboard' && (
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                        <div className="p-4 bg-gradient-to-r from-primary to-violet-600 text-white">
                            <h3 className="font-bold text-center">🏆 Top Estudiantes</h3>
                        </div>
                        <div className="divide-y divide-slate-50">
                            {leaderboard.map((lbUser, index) => {
                                const isUser = lbUser.id === user?.id;
                                const rank = index + 1;
                                return (
                                    <div
                                        key={lbUser.id}
                                        className={`p-4 flex items-center gap-4 ${isUser ? 'bg-primary/5' : 'hover:bg-slate-50'} transition-colors`}
                                    >
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm ${rank === 1 ? 'bg-amber-100 text-amber-600' :
                                            rank === 2 ? 'bg-slate-200 text-slate-600' :
                                                rank === 3 ? 'bg-orange-100 text-orange-600' :
                                                    'bg-slate-100 text-slate-500'
                                            }`}>
                                            {rank <= 3 ? ['🥇', '🥈', '🥉'][rank - 1] : rank}
                                        </div>
                                        <img
                                            src={lbUser.avatar_url || `https://ui-avatars.com/api/?name=${lbUser.full_name || 'User'}&background=random`}
                                            className="w-10 h-10 rounded-full object-cover"
                                            alt={lbUser.full_name}
                                        />
                                        <div className="flex-1">
                                            <p className={`font-bold ${isUser ? 'text-primary' : 'text-slate-900'}`}>
                                                {lbUser.full_name || 'Estudiante'} {isUser && '(Tú)'}
                                            </p>
                                            <p className="text-xs text-slate-500">🔥 {lbUser.streak_days || 0} días de racha</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-black text-slate-900">{(lbUser.xp || 0).toLocaleString()}</p>
                                            <p className="text-xs text-slate-500">XP</p>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}

                {activeTab === 'stats' && (
                    <div className="space-y-6">
                        {/* Placeholder for Stats for now */}
                        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm text-center">
                            <h3 className="font-bold text-slate-900 mb-2">Estadísticas Detalladas</h3>
                            <p className="text-slate-500">Próximamente verás aquí tus gráficos de estudio.</p>
                            <div className="grid md:grid-cols-2 gap-4 mt-8 text-left">
                                <div className="bg-slate-50 p-4 rounded-xl">
                                    <h4 className="font-bold text-slate-700">XP Total</h4>
                                    <p className="text-2xl font-black text-primary">{stats?.xp?.toLocaleString()}</p>
                                </div>
                                <div className="bg-slate-50 p-4 rounded-xl">
                                    <h4 className="font-bold text-slate-700">Nivel Actual</h4>
                                    <p className="text-2xl font-black text-violet-600">{stats?.level}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default StudentAchievements;
