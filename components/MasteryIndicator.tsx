/**
 * MasteryIndicator.tsx
 * 
 * Visual indicator showing card mastery level (0-5 stars)
 * Based on FSRS algorithm metrics
 */

import React from 'react';

interface MasteryIndicatorProps {
    level: number; // 0-5
    size?: 'sm' | 'md' | 'lg';
    showLabel?: boolean;
}

const MASTERY_LABELS = [
    'Nuevo',
    'Aprendiendo',
    'Familiar',
    'Conocido',
    'Dominado',
    'Maestría'
];

const MASTERY_COLORS = [
    'text-slate-400',    // 0: New
    'text-red-400',      // 1: Learning
    'text-orange-400',   // 2: Familiar
    'text-yellow-400',   // 3: Known
    'text-emerald-400',  // 4: Mastered
    'text-blue-400',     // 5: Expert
];

const MasteryIndicator: React.FC<MasteryIndicatorProps> = ({
    level,
    size = 'md',
    showLabel = false
}) => {
    const clampedLevel = Math.max(0, Math.min(5, level));

    const sizeClasses = {
        sm: 'text-xs gap-0.5',
        md: 'text-sm gap-1',
        lg: 'text-lg gap-1.5',
    };

    const iconSizes = {
        sm: '12px',
        md: '16px',
        lg: '20px',
    };

    return (
        <div className={`flex items-center ${sizeClasses[size]}`}>
            <div className="flex">
                {[0, 1, 2, 3, 4].map((i) => (
                    <span
                        key={i}
                        className={`material-symbols-outlined transition-all ${i < clampedLevel
                                ? MASTERY_COLORS[clampedLevel]
                                : 'text-slate-200'
                            }`}
                        style={{
                            fontSize: iconSizes[size],
                            fontVariationSettings: i < clampedLevel
                                ? "'FILL' 1"
                                : "'FILL' 0"
                        }}
                    >
                        star
                    </span>
                ))}
            </div>
            {showLabel && (
                <span className={`font-medium ${MASTERY_COLORS[clampedLevel]}`}>
                    {MASTERY_LABELS[clampedLevel]}
                </span>
            )}
        </div>
    );
};

export default MasteryIndicator;
