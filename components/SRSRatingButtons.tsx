/**
 * SRSRatingButtons.tsx
 * 
 * Rating buttons for spaced repetition system
 * 4 options: Again (1), Hard (2), Good (3), Easy (4)
 * Shows predicted next interval for each option
 */

import React from 'react';
import { Rating, formatInterval } from '../services/AdaptiveLearningService';

interface SRSRatingButtonsProps {
    onRate: (rating: Rating) => void;
    disabled?: boolean;
    currentStability?: number;
    showIntervals?: boolean;
}

const RATING_CONFIG = {
    1: {
        label: 'Olvidé',
        icon: 'close',
        color: 'bg-red-500 hover:bg-red-600 active:bg-red-700',
        shortcut: '1',
        intervalMultiplier: 0.2,
    },
    2: {
        label: 'Difícil',
        icon: 'sentiment_dissatisfied',
        color: 'bg-orange-500 hover:bg-orange-600 active:bg-orange-700',
        shortcut: '2',
        intervalMultiplier: 0.8,
    },
    3: {
        label: 'Bien',
        icon: 'check',
        color: 'bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700',
        shortcut: '3',
        intervalMultiplier: 1.0,
    },
    4: {
        label: 'Fácil',
        icon: 'bolt',
        color: 'bg-blue-500 hover:bg-blue-600 active:bg-blue-700',
        shortcut: '4',
        intervalMultiplier: 1.5,
    },
};

const SRSRatingButtons: React.FC<SRSRatingButtonsProps> = ({
    onRate,
    disabled = false,
    currentStability = 1,
    showIntervals = true,
}) => {
    // Handle keyboard shortcuts
    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (disabled) return;

            const key = e.key;
            if (key >= '1' && key <= '4') {
                onRate(parseInt(key) as Rating);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onRate, disabled]);

    const getEstimatedInterval = (rating: Rating): number => {
        const multiplier = RATING_CONFIG[rating].intervalMultiplier;
        return currentStability * multiplier;
    };

    return (
        <div className="grid grid-cols-4 gap-2 sm:gap-3">
            {([1, 2, 3, 4] as Rating[]).map((rating) => {
                const config = RATING_CONFIG[rating];
                const interval = getEstimatedInterval(rating);

                return (
                    <button
                        key={rating}
                        onClick={() => onRate(rating)}
                        disabled={disabled}
                        className={`
                            flex flex-col items-center justify-center
                            py-3 px-2 sm:py-4 sm:px-4
                            rounded-xl text-white font-medium
                            transition-all duration-150
                            ${config.color}
                            ${disabled ? 'opacity-50 cursor-not-allowed' : 'transform hover:scale-105 active:scale-95'}
                            shadow-lg
                        `}
                    >
                        <span
                            className="material-symbols-outlined text-2xl sm:text-3xl mb-1"
                            style={{ fontVariationSettings: "'FILL' 1" }}
                        >
                            {config.icon}
                        </span>
                        <span className="text-xs sm:text-sm">{config.label}</span>
                        {showIntervals && (
                            <span className="text-[10px] sm:text-xs opacity-80 mt-1">
                                {formatInterval(interval)}
                            </span>
                        )}
                        <span className="text-[10px] opacity-60 mt-0.5 hidden sm:block">
                            [{config.shortcut}]
                        </span>
                    </button>
                );
            })}
        </div>
    );
};

export default SRSRatingButtons;
