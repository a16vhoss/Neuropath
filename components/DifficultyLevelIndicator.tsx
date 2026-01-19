import React from 'react';

interface DifficultyLevelIndicatorProps {
    level: number; // 1-4
    masteryPercent?: number;
    showLabel?: boolean;
    size?: 'sm' | 'md' | 'lg';
    showProgress?: boolean;
}

const levelInfo = {
    1: { name: 'Básico', color: '#10b981', bgColor: '#d1fae5' },
    2: { name: 'Intermedio', color: '#3b82f6', bgColor: '#dbeafe' },
    3: { name: 'Avanzado', color: '#8b5cf6', bgColor: '#ede9fe' },
    4: { name: 'Experto', color: '#f59e0b', bgColor: '#fef3c7' }
};

const DifficultyLevelIndicator: React.FC<DifficultyLevelIndicatorProps> = ({
    level = 1,
    masteryPercent = 0,
    showLabel = true,
    size = 'md',
    showProgress = false
}) => {
    const info = levelInfo[level as keyof typeof levelInfo] || levelInfo[1];

    const starSizes = {
        sm: 'text-sm',
        md: 'text-base',
        lg: 'text-lg'
    };

    const renderStars = () => {
        const stars = [];
        for (let i = 1; i <= 4; i++) {
            stars.push(
                <span
                    key={i}
                    className={`${starSizes[size]} transition-all duration-300`}
                    style={{
                        opacity: i <= level ? 1 : 0.2,
                        filter: i <= level ? 'none' : 'grayscale(100%)'
                    }}
                >
                    ⭐
                </span>
            );
        }
        return stars;
    };

    return (
        <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
                <div className="flex gap-0.5">
                    {renderStars()}
                </div>
                {showLabel && (
                    <span
                        className="text-xs font-medium px-2 py-0.5 rounded-full"
                        style={{
                            color: info.color,
                            backgroundColor: info.bgColor
                        }}
                    >
                        {info.name}
                    </span>
                )}
            </div>

            {showProgress && (
                <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                                width: `${masteryPercent}%`,
                                backgroundColor: info.color
                            }}
                        />
                    </div>
                    <span className="text-xs font-medium text-slate-500">
                        {masteryPercent}%
                    </span>
                </div>
            )}
        </div>
    );
};

// Level Up Animation Component
export const LevelUpNotification: React.FC<{
    previousLevel: number;
    newLevel: number;
    onClose: () => void;
}> = ({ previousLevel, newLevel, onClose }) => {
    const newInfo = levelInfo[newLevel as keyof typeof levelInfo];

    React.useEffect(() => {
        const timer = setTimeout(onClose, 3000);
        return () => clearTimeout(timer);
    }, [onClose]);

    return (
        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
            <div
                className="bg-white rounded-2xl shadow-2xl p-8 animate-bounce pointer-events-auto"
                style={{ borderColor: newInfo.color, borderWidth: 3 }}
            >
                <div className="text-center">
                    <div className="text-4xl mb-2">🎉</div>
                    <h3 className="text-xl font-bold text-slate-900 mb-2">
                        ¡Subiste de Nivel!
                    </h3>
                    <div className="flex items-center justify-center gap-2 text-2xl">
                        {Array.from({ length: previousLevel }, (_, i) => (
                            <span key={`old-${i}`} className="opacity-50">⭐</span>
                        ))}
                        <span className="text-slate-400 mx-2">→</span>
                        {Array.from({ length: newLevel }, (_, i) => (
                            <span key={`new-${i}`}>⭐</span>
                        ))}
                    </div>
                    <p
                        className="text-sm font-medium mt-2"
                        style={{ color: newInfo.color }}
                    >
                        Ahora eres nivel {newInfo.name}
                    </p>
                </div>
            </div>
        </div>
    );
};

// Mastery Progress Card for Study Set Overview
export const MasteryProgressCard: React.FC<{
    levelCounts: { level1: number; level2: number; level3: number; level4: number };
    totalCards: number;
    avgMastery: number;
}> = ({ levelCounts, totalCards, avgMastery }) => {
    return (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-violet-500">trending_up</span>
                Progreso de Dominio
            </h3>

            <div className="mb-4">
                <div className="flex justify-between items-center mb-1">
                    <span className="text-sm text-slate-600">Dominio General</span>
                    <span className="font-bold text-slate-900">{avgMastery}%</span>
                </div>
                <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-full transition-all duration-500"
                        style={{ width: `${avgMastery}%` }}
                    />
                </div>
            </div>

            <div className="grid grid-cols-4 gap-2 text-center">
                <div className="bg-emerald-50 rounded-lg p-2">
                    <div className="text-lg">⭐</div>
                    <div className="text-lg font-bold text-emerald-600">{levelCounts.level1}</div>
                    <div className="text-xs text-emerald-500">Básico</div>
                </div>
                <div className="bg-blue-50 rounded-lg p-2">
                    <div className="text-lg">⭐⭐</div>
                    <div className="text-lg font-bold text-blue-600">{levelCounts.level2}</div>
                    <div className="text-xs text-blue-500">Intermedio</div>
                </div>
                <div className="bg-violet-50 rounded-lg p-2">
                    <div className="text-lg">⭐⭐⭐</div>
                    <div className="text-lg font-bold text-violet-600">{levelCounts.level3}</div>
                    <div className="text-xs text-violet-500">Avanzado</div>
                </div>
                <div className="bg-amber-50 rounded-lg p-2">
                    <div className="text-lg">⭐⭐⭐⭐</div>
                    <div className="text-lg font-bold text-amber-600">{levelCounts.level4}</div>
                    <div className="text-xs text-amber-500">Experto</div>
                </div>
            </div>

            {totalCards > 0 && (
                <p className="text-xs text-slate-400 mt-3 text-center">
                    {totalCards} tarjetas en total
                </p>
            )}
        </div>
    );
};

export default DifficultyLevelIndicator;
