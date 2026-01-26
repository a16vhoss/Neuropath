/**
 * DailyMissionsCard.tsx
 *
 * Compact widget for the dashboard sidebar showing daily missions
 * with progress tracking, claim buttons, and daily bonus section.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  DailyMissionsService,
  DailyMission,
  UserDailyMissionsState,
} from '../services/DailyMissionsService';

interface DailyMissionsCardProps {
  onXPEarned?: (amount: number) => void;
}

const DailyMissionsCard: React.FC<DailyMissionsCardProps> = ({ onXPEarned }) => {
  const { user } = useAuth();
  const [state, setState] = useState<UserDailyMissionsState | null>(null);
  const [loading, setLoading] = useState(true);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [claimingBonus, setClaimingBonus] = useState(false);
  const [showCelebration, setShowCelebration] = useState<string | null>(null);

  const loadMissions = useCallback(async () => {
    if (!user?.id) return;

    try {
      const missionsState = await DailyMissionsService.getOrGenerateDailyMissions(user.id);
      setState(missionsState);
    } catch (error) {
      console.error('Error loading daily missions:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadMissions();

    // Refresh missions every 30 seconds to catch progress updates
    const interval = setInterval(loadMissions, 30000);
    return () => clearInterval(interval);
  }, [loadMissions]);

  const handleClaimMission = async (mission: DailyMission) => {
    if (!user?.id || claimingId) return;

    setClaimingId(mission.id);
    try {
      const xpEarned = await DailyMissionsService.claimMissionReward(user.id, mission.id);
      if (xpEarned > 0) {
        setShowCelebration(mission.id);
        setTimeout(() => setShowCelebration(null), 1500);
        onXPEarned?.(xpEarned);
        await loadMissions();
      }
    } catch (error) {
      console.error('Error claiming mission:', error);
    } finally {
      setClaimingId(null);
    }
  };

  const handleClaimBonus = async () => {
    if (!user?.id || claimingBonus) return;

    setClaimingBonus(true);
    try {
      const xpEarned = await DailyMissionsService.claimDailyBonus(user.id);
      if (xpEarned > 0) {
        setShowCelebration('bonus');
        setTimeout(() => setShowCelebration(null), 2000);
        onXPEarned?.(xpEarned);
        await loadMissions();
      }
    } catch (error) {
      console.error('Error claiming bonus:', error);
    } finally {
      setClaimingBonus(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 animate-pulse">
        <div className="h-5 bg-slate-200 rounded w-2/3 mb-4" />
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-8 h-8 bg-slate-200 rounded-lg" />
              <div className="flex-1">
                <div className="h-3 bg-slate-200 rounded w-3/4 mb-2" />
                <div className="h-2 bg-slate-100 rounded w-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!state || state.missions.length === 0) {
    return null;
  }

  const progressPercentage = (state.totalCompleted / state.totalMissions) * 100;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-4 text-white">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-xl">target</span>
            <h3 className="font-bold">Misiones Diarias</h3>
          </div>
          <span className="text-sm font-semibold bg-white/20 px-2 py-0.5 rounded-full">
            {state.totalCompleted}/{state.totalMissions}
          </span>
        </div>

        {/* Overall Progress Bar */}
        <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden">
          <div
            className="h-full bg-white rounded-full transition-all duration-500"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      </div>

      {/* Missions List */}
      <div className="p-4 space-y-3">
        {state.missions.map((mission) => (
          <MissionItem
            key={mission.id}
            mission={mission}
            isClaiming={claimingId === mission.id}
            showCelebration={showCelebration === mission.id}
            onClaim={() => handleClaimMission(mission)}
          />
        ))}
      </div>

      {/* Daily Bonus Section */}
      <div className="border-t border-slate-100 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                state.bonusAvailable
                  ? 'bg-gradient-to-br from-yellow-400 to-amber-500 animate-pulse'
                  : state.bonus?.is_claimed
                  ? 'bg-emerald-100'
                  : 'bg-slate-100'
              }`}
            >
              <span
                className={`material-symbols-outlined ${
                  state.bonusAvailable
                    ? 'text-white'
                    : state.bonus?.is_claimed
                    ? 'text-emerald-600'
                    : 'text-slate-400'
                }`}
              >
                {state.bonus?.is_claimed ? 'verified' : 'card_giftcard'}
              </span>
            </div>
            <div>
              <p className="font-semibold text-sm text-slate-900">Bonus Diario</p>
              <p className="text-xs text-slate-500">
                {state.bonus?.is_claimed
                  ? 'Reclamado'
                  : `Completa las ${state.totalMissions} misiones`}
              </p>
            </div>
          </div>

          {state.bonusAvailable ? (
            <button
              onClick={handleClaimBonus}
              disabled={claimingBonus}
              className={`px-4 py-2 rounded-xl font-bold text-sm transition-all ${
                showCelebration === 'bonus'
                  ? 'bg-emerald-500 text-white scale-110'
                  : 'bg-gradient-to-r from-yellow-400 to-amber-500 text-white hover:shadow-lg hover:scale-105'
              }`}
            >
              {claimingBonus ? (
                <span className="flex items-center gap-1">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                </span>
              ) : showCelebration === 'bonus' ? (
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">celebration</span>
                  +{state.bonus?.bonus_xp} XP
                </span>
              ) : (
                <span>+{state.bonus?.bonus_xp} XP</span>
              )}
            </button>
          ) : state.bonus?.is_claimed ? (
            <span className="text-emerald-600 font-bold text-sm flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">check_circle</span>
              +{state.bonus?.bonus_xp} XP
            </span>
          ) : (
            <span className="text-slate-400 text-sm font-medium">
              {state.totalCompleted}/{state.totalMissions}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================
// Mission Item Component
// ============================================

interface MissionItemProps {
  mission: DailyMission;
  isClaiming: boolean;
  showCelebration: boolean;
  onClaim: () => void;
}

const MissionItem: React.FC<MissionItemProps> = ({
  mission,
  isClaiming,
  showCelebration,
  onClaim,
}) => {
  const progressPercent = Math.min(
    (mission.current_progress / mission.requirement_target) * 100,
    100
  );

  const isCompleted = mission.is_completed;
  const isClaimed = mission.is_claimed;

  return (
    <div
      className={`flex items-center gap-3 p-2 rounded-xl transition-all ${
        showCelebration
          ? 'bg-emerald-50 scale-[1.02]'
          : isCompleted && !isClaimed
          ? 'bg-amber-50'
          : isClaimed
          ? 'bg-slate-50 opacity-60'
          : 'hover:bg-slate-50'
      }`}
    >
      {/* Icon */}
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
          isClaimed
            ? 'bg-emerald-100 text-emerald-600'
            : isCompleted
            ? 'bg-amber-100 text-amber-600'
            : 'bg-slate-100 text-slate-500'
        }`}
      >
        <span className="material-symbols-outlined text-xl">
          {isClaimed ? 'check_circle' : mission.icon}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <p
            className={`font-medium text-sm truncate ${
              isClaimed ? 'text-slate-400 line-through' : 'text-slate-900'
            }`}
          >
            {mission.title}
          </p>
          <span
            className={`text-xs font-bold ml-2 ${
              isCompleted ? 'text-emerald-600' : 'text-slate-400'
            }`}
          >
            {mission.current_progress}/{mission.requirement_target}
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              isClaimed
                ? 'bg-emerald-400'
                : isCompleted
                ? 'bg-amber-400'
                : 'bg-blue-400'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Claim Button / Status */}
      <div className="flex-shrink-0 ml-2">
        {isClaimed ? (
          <span className="text-emerald-600 text-xs font-bold">
            +{mission.xp_reward}
          </span>
        ) : isCompleted ? (
          <button
            onClick={onClaim}
            disabled={isClaiming}
            className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all ${
              showCelebration
                ? 'bg-emerald-500 text-white scale-110'
                : 'bg-amber-500 text-white hover:bg-amber-600 hover:scale-105'
            }`}
          >
            {isClaiming ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : showCelebration ? (
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-xs">celebration</span>
              </span>
            ) : (
              `+${mission.xp_reward}`
            )}
          </button>
        ) : (
          <span className="text-slate-300 text-xs font-medium">
            +{mission.xp_reward}
          </span>
        )}
      </div>
    </div>
  );
};

export default DailyMissionsCard;
