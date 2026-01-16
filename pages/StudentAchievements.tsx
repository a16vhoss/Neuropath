
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const badges = [
    { id: '1', name: 'Primera Racha', desc: '7 días seguidos estudiando', icon: 'local_fire_department', earned: true, date: '2026-01-08' },
    { id: '2', name: 'Explorador', desc: 'Completa 10 sesiones', icon: 'explore', earned: true, date: '2026-01-10' },
    { id: '3', name: 'Quiz Master', desc: 'Obtén 100% en un quiz', icon: 'military_tech', earned: true, date: '2026-01-12' },
    { id: '4', name: 'Cerebro de Acero', desc: 'Domina 5 temas', icon: 'psychology', earned: false, progress: 60 },
    { id: '5', name: 'Maratón', desc: 'Estudia 2 horas en un día', icon: 'timer', earned: false, progress: 45 },
    { id: '6', name: 'Ayudante', desc: 'Responde 20 dudas', icon: 'support_agent', earned: false, progress: 25 },
    { id: '7', name: 'Racha Legendaria', desc: '30 días seguidos', icon: 'whatshot', earned: false, progress: 40 },
    { id: '8', name: 'Perfeccionista', desc: '5 exámenes perfectos', icon: 'workspace_premium', earned: false, progress: 20 }
];

const leaderboard = [
    { rank: 1, name: 'María García', avatar: 'maria', xp: 4250, streak: 28 },
    { rank: 2, name: 'Carlos López', avatar: 'carlos', xp: 3890, streak: 21 },
    { rank: 3, name: 'Ana Martínez', avatar: 'ana', xp: 3650, streak: 18 },
    { rank: 4, name: 'Alex (Tú)', avatar: 'alex', xp: 2450, streak: 12, isUser: true },
    { rank: 5, name: 'Pedro Sánchez', avatar: 'pedro', xp: 2100, streak: 9 },
    { rank: 6, name: 'Laura Díaz', avatar: 'laura', xp: 1850, streak: 7 },
];

const StudentAchievements: React.FC = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'badges' | 'leaderboard' | 'stats'>('badges');

    return (
        <div className="min-h-screen bg-[#F9FAFB] flex flex-col">
            {/* Mobile Bottom Nav */}
            <nav className="fixed bottom-0 left-0 w-full bg-white border-t border-slate-200 py-3 px-6 flex justify-around md:hidden z-50">
                <button onClick={() => navigate('/student')} className="flex flex-col items-center text-slate-400">
                    <span className="material-symbols-outlined">dashboard</span>
                    <span className="text-[10px]">Inicio</span>
                </button>
                <button className="flex flex-col items-center text-slate-400">
                    <span className="material-symbols-outlined">school</span>
                    <span className="text-[10px]">Cursos</span>
                </button>
                <button className="flex flex-col items-center text-primary font-bold">
                    <span className="material-symbols-outlined">emoji_events</span>
                    <span className="text-[10px]">Logros</span>
                </button>
                <button className="flex flex-col items-center text-slate-400">
                    <span className="material-symbols-outlined">person</span>
                    <span className="text-[10px]">Perfil</span>
                </button>
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
                        { label: 'Racha Actual', value: '12 días', icon: 'local_fire_department', color: 'amber' },
                        { label: 'XP Total', value: '2,450', icon: 'stars', color: 'violet' },
                        { label: 'Badges', value: '3/8', icon: 'emoji_events', color: 'blue' },
                        { label: 'Posición', value: '#4', icon: 'leaderboard', color: 'emerald' }
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
                        {badges.map((badge) => (
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
                                        <p className="text-sm text-slate-500">{badge.desc}</p>
                                        {badge.earned ? (
                                            <p className="text-xs text-emerald-600 font-medium mt-1">Obtenido el {badge.date}</p>
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
                            <h3 className="font-bold text-center">🏆 Top 10 de tu Clase</h3>
                        </div>
                        <div className="divide-y divide-slate-50">
                            {leaderboard.map((user) => (
                                <div
                                    key={user.rank}
                                    className={`p-4 flex items-center gap-4 ${user.isUser ? 'bg-primary/5' : 'hover:bg-slate-50'} transition-colors`}
                                >
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm ${user.rank === 1 ? 'bg-amber-100 text-amber-600' :
                                            user.rank === 2 ? 'bg-slate-200 text-slate-600' :
                                                user.rank === 3 ? 'bg-orange-100 text-orange-600' :
                                                    'bg-slate-100 text-slate-500'
                                        }`}>
                                        {user.rank <= 3 ? ['🥇', '🥈', '🥉'][user.rank - 1] : user.rank}
                                    </div>
                                    <img src={`https://picsum.photos/seed/${user.avatar}/40`} className="w-10 h-10 rounded-full" alt={user.name} />
                                    <div className="flex-1">
                                        <p className={`font-bold ${user.isUser ? 'text-primary' : 'text-slate-900'}`}>
                                            {user.name}
                                        </p>
                                        <p className="text-xs text-slate-500">🔥 {user.streak} días de racha</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-black text-slate-900">{user.xp.toLocaleString()}</p>
                                        <p className="text-xs text-slate-500">XP</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'stats' && (
                    <div className="space-y-6">
                        {/* Study Time Chart Placeholder */}
                        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                            <h3 className="font-bold text-slate-900 mb-4">Tiempo de Estudio (Última Semana)</h3>
                            <div className="flex items-end justify-between h-40 gap-2">
                                {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((day, i) => {
                                    const heights = [60, 80, 45, 90, 70, 30, 55];
                                    return (
                                        <div key={day} className="flex-1 flex flex-col items-center gap-2">
                                            <div className="w-full bg-primary/20 rounded-t-lg relative" style={{ height: `${heights[i]}%` }}>
                                                <div className="absolute bottom-0 w-full bg-primary rounded-t-lg" style={{ height: '100%' }}></div>
                                            </div>
                                            <span className="text-xs text-slate-500">{day}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Detailed Stats */}
                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                                <h3 className="font-bold text-slate-900 mb-4">Resumen General</h3>
                                <div className="space-y-4">
                                    {[
                                        { label: 'Sesiones completadas', value: '47' },
                                        { label: 'Preguntas respondidas', value: '892' },
                                        { label: 'Precisión promedio', value: '78%' },
                                        { label: 'Tiempo total estudiado', value: '24h 35m' },
                                        { label: 'Racha más larga', value: '18 días' }
                                    ].map((stat, i) => (
                                        <div key={i} className="flex justify-between items-center">
                                            <span className="text-slate-500">{stat.label}</span>
                                            <span className="font-bold text-slate-900">{stat.value}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                                <h3 className="font-bold text-slate-900 mb-4">Temas Dominados</h3>
                                <div className="space-y-3">
                                    {[
                                        { name: 'Neuroanatomía', progress: 92 },
                                        { name: 'Sinapsis', progress: 78 },
                                        { name: 'Sistema Limbico', progress: 65 },
                                        { name: 'Neurotransmisores', progress: 45 }
                                    ].map((topic, i) => (
                                        <div key={i}>
                                            <div className="flex justify-between text-sm mb-1">
                                                <span className="text-slate-600">{topic.name}</span>
                                                <span className={`font-bold ${topic.progress >= 80 ? 'text-emerald-600' : topic.progress >= 60 ? 'text-amber-600' : 'text-slate-600'}`}>
                                                    {topic.progress}%
                                                </span>
                                            </div>
                                            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full ${topic.progress >= 80 ? 'bg-emerald-500' : topic.progress >= 60 ? 'bg-amber-500' : 'bg-primary'}`}
                                                    style={{ width: `${topic.progress}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    ))}
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
