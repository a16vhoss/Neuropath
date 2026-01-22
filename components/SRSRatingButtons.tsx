/**
 * SRSRatingButtons.tsx
 * 
 * Rating buttons for spaced repetition system
 * 4 options: Again (1), Hard (2), Good (3), Easy (4)
 * Shows predicted next interval for each option
 */

import React from 'react';
import { Rating } from '../services/AdaptiveLearningService';

interface SRSRatingButtonsProps {
    onRate: (rating: Rating) => void;
    disabled?: boolean;
    currentStability?: number;
    cardState?: 'new' | 'learning' | 'relearning' | 'review';
    showIntervals?: boolean;
}

// Fixed intervals for new/learning cards (in minutes)
const LEARNING_INTERVALS = {
    1: 10,      // Again: 10 minutes
    2: 60,      // Hard: 1 hour
    3: 1440,    // Good: 1 day
    4: 4320,    // Easy: 3 days
};

const RATING_CONFIG = {
    1: {
        label: 'Olvidé',
        icon: 'close',
        color: 'bg-red-500 hover:bg-red-600 active:bg-red-700',
        shortcut: '1',
    },
    2: {
        label: 'Difícil',
        icon: 'sentiment_dissatisfied',
        color: 'bg-orange-500 hover:bg-orange-600 active:bg-orange-700',
        shortcut: '2',
    },
    3: {
        label: 'Bien',
        icon: 'check',
        color: 'bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700',
        shortcut: '3',
    },
    4: {
        label: 'Fácil',
        icon: 'bolt',
        color: 'bg-blue-500 hover:bg-blue-600 active:bg-blue-700',
        shortcut: '4',
    },
};

// Format interval for display
const formatIntervalLabel = (minutes: number): string => {
    if (minutes < 60) {
        return `${minutes} min`;
    } else if (minutes < 1440) {
        const hours = Math.round(minutes / 60);
        return `${hours} hora${hours !== 1 ? 's' : ''}`;
    } else {
        const days = Math.round(minutes / 1440);
        return `${days} día${days !== 1 ? 's' : ''}`;
    }
};

const SRSRatingButtons: React.FC<SRSRatingButtonsProps> = ({
    onRate,
    disabled = false,
    currentStability = 1,
    cardState = 'new',
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

    const getEstimatedIntervalMinutes = (rating: Rating): number => {
        // For new/learning/relearning cards, use fixed intervals
        if (cardState === 'new' || cardState === 'learning' || cardState === 'relearning') {
            return LEARNING_INTERVALS[rating];
        }

        // For review cards, calculate based on stability
        const stabilityDays = currentStability;
        let intervalDays: number;

        switch (rating) {
            case 1: // Again - reduce significantly
                intervalDays = Math.max(0.007, stabilityDays * 0.3); // ~10 min minimum
                break;
            case 2: // Hard - slight reduction
                intervalDays = Math.max(0.04, stabilityDays * 0.7); // ~1 hour minimum
                break;
            case 3: // Good - maintain/increase
                intervalDays = Math.max(1, stabilityDays * 1.2);
                break;
            case 4: // Easy - significant increase
                intervalDays = Math.max(3, stabilityDays * 1.5);
                break;
            default:
                intervalDays = stabilityDays;
        }

        // Clamp to max 60 days and convert to minutes
        return Math.min(60, intervalDays) * 1440;
    };

    return (
        <div className="grid grid-cols-4 gap-2 sm:gap-3">
            {([1, 2, 3, 4] as Rating[]).map((rating) => {
                const config = RATING_CONFIG[rating];
                const intervalMinutes = getEstimatedIntervalMinutes(rating);

                return (
                    <button
                        key={rating}
                        onClick={() => onRate(rating)}
                        disabled={disabled}
                        className={`
                            flex flex-col items-center justify-center
                            py-2 px-1 sm:py-4 sm:px-4
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
                                {formatIntervalLabel(intervalMinutes)}
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
