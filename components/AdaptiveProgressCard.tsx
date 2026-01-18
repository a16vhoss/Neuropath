/**
 * AdaptiveProgressCard.tsx
 * 
 * Dashboard widget showing adaptive learning progress
 * Displays due cards, retention rate, streak, and study recommendations
 */

import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getUserStudyStats } from '../services/AdaptiveLearningService';

interface AdaptiveProgressCardProps {
    onStartSession?: (mode: 'adaptive' | 'review_due' | 'learn_new') => void;
}

const AdaptiveProgressCard: React.FC<AdaptiveProgressCardProps> = ({ onStartSession }) => {
    const { user } = useAuth();
    const [stats, setStats] = useState({
        dueToday: 0,
        learningCount: 0,
        newCount: 0,
        masteredCount: 0,
        avgRetention: 0,
        streakDays: 0,
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadStats = async () => {
            if (!user) return;

            try {
                const userStats = await getUserStudyStats(user.id);
                setStats(userStats);
            } catch (error) {
                console.error('Error loading adaptive stats:', error);
            } finally {
                setLoading(false);
            }
        };

        loadStats();
    }, [user]);

    if (loading) {
        return (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 animate-pulse">
                <div className="h-6 bg-slate-200 rounded w-1/3 mb-4"></div>
                <div className="h-20 bg-slate-100 rounded"></div>
            </div>
        );
    }

    const getRetentionColor = (retention: number) => {
        if (retention >= 80) return 'text-emerald-600';
        if (retention >= 60) return 'text-yellow-600';
        return 'text-red-600';
    };

    const getRecommendation = () => {
        if (stats.dueToday > 0) {
            return {
                icon: 'schedule',
                text: `Tienes ${stats.dueToday} tarjetas pendientes`,
                action: 'Repasar ahora',
                mode: 'review_due' as const,
                priority: 'high',
            };
        }
        if (stats.learningCount > 0) {
            return {
                icon: 'school',
                text: `${stats.learningCount} tarjetas en aprendizaje`,
                action: 'Continuar',
                mode: 'adaptive' as const,
                priority: 'medium',
            };
        }
        return {
            icon: 'add_circle',
            text: 'Todo al día. ¿Aprender más?',
            action: 'Nuevas tarjetas',
            mode: 'learn_new' as const,
            priority: 'low',
        };
    };

    const recommendation = getRecommendation();

    return (
        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-6 text-white shadow-lg">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-2xl">psychology</span>
                    <h3 className="font-bold text-lg">Estudio Adaptativo</h3>
                </div>
                {stats.streakDays > 0 && (
                    <div className="flex items-center gap-1 bg-white/20 px-3 py-1 rounded-full">
                        <span className="material-symbols-outlined text-orange-300">local_fire_department</span>
                        <span className="font-bold">{stats.streakDays}</span>
                    </div>
                )}
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="text-center">
                    <div className="text-3xl font-bold">{stats.dueToday}</div>
                    <div className="text-xs text-white/70">Pendientes</div>
                </div>
                <div className="text-center">
                    <div className={`text-3xl font-bold`}>{stats.avgRetention}%</div>
                    <div className="text-xs text-white/70">Retención</div>
                </div>
                <div className="text-center">
                    <div className="text-3xl font-bold">{stats.masteredCount}</div>
                    <div className="text-xs text-white/70">Dominadas</div>
                </div>
            </div>

            {/* Retention Progress Bar */}
            <div className="mb-6">
                <div className="flex justify-between text-xs mb-1">
                    <span>Retención actual</span>
                    <span>{stats.avgRetention}%</span>
                </div>
                <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                    <div
                        className={`h-full rounded-full transition-all duration-500 ${stats.avgRetention >= 80 ? 'bg-emerald-400' :
                                stats.avgRetention >= 60 ? 'bg-yellow-400' : 'bg-red-400'
                            }`}
                        style={{ width: `${Math.min(100, stats.avgRetention)}%` }}
                    />
                </div>
            </div>

            {/* Recommendation Card */}
            <div className="bg-white/10 backdrop-blur rounded-xl p-4 mb-4">
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${recommendation.priority === 'high' ? 'bg-red-500' :
                            recommendation.priority === 'medium' ? 'bg-yellow-500' : 'bg-emerald-500'
                        }`}>
                        <span className="material-symbols-outlined">{recommendation.icon}</span>
                    </div>
                    <div className="flex-1">
                        <p className="font-medium">{recommendation.text}</p>
                    </div>
                </div>
            </div>

            {/* Action Button */}
            <button
                onClick={() => onStartSession?.(recommendation.mode)}
                className="w-full py-3 bg-white text-indigo-600 font-bold rounded-xl hover:bg-white/90 transition flex items-center justify-center gap-2"
            >
                <span className="material-symbols-outlined">play_arrow</span>
                {recommendation.action}
            </button>
        </div>
    );
};

export default AdaptiveProgressCard;
