/**
 * DailyMissionsService.ts
 *
 * Service for managing daily missions - gamified daily tasks
 * that reward students with XP for completing various activities.
 */

import { supabase } from './supabaseClient';
import { GamificationService } from './GamificationService';

// ============================================
// TYPES
// ============================================

export interface MissionDefinition {
  id: string;
  type: string;
  title_template: string;
  description_template: string;
  icon: string;
  xp_reward_min: number;
  xp_reward_max: number;
  requirement_min: number;
  requirement_max: number;
  is_active: boolean;
}

export interface DailyMission {
  id: string;
  user_id: string;
  mission_definition_id: string;
  mission_date: string;
  title: string;
  description: string;
  icon: string;
  requirement_type: string;
  requirement_target: number;
  current_progress: number;
  xp_reward: number;
  is_completed: boolean;
  is_claimed: boolean;
  completed_at: string | null;
  claimed_at: string | null;
}

export interface DailyMissionBonus {
  id: string;
  user_id: string;
  bonus_date: string;
  missions_required: number;
  missions_completed: number;
  bonus_xp: number;
  is_claimed: boolean;
  claimed_at: string | null;
}

export interface UserDailyMissionsState {
  missions: DailyMission[];
  bonus: DailyMissionBonus | null;
  totalCompleted: number;
  totalMissions: number;
  allClaimed: boolean;
  bonusAvailable: boolean;
}

export interface MissionUpdateResult {
  updated: boolean;
  missionId?: string;
  newProgress?: number;
  justCompleted?: boolean;
  mission?: DailyMission;
}

// ============================================
// CONSTANTS
// ============================================

const MISSIONS_PER_DAY = 4;
const DAILY_BONUS_XP = 100;

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get today's date in YYYY-MM-DD format (user's local timezone)
 */
function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Generate a random integer between min and max (inclusive)
 */
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Shuffle array using Fisher-Yates algorithm
 */
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// ============================================
// MAIN SERVICE
// ============================================

export const DailyMissionsService = {
  /**
   * Get or generate daily missions for a user
   * If missions don't exist for today, generate new ones
   */
  async getOrGenerateDailyMissions(userId: string): Promise<UserDailyMissionsState> {
    const today = getTodayDate();

    // 1. Check if missions already exist for today
    const { data: existingMissions, error: fetchError } = await supabase
      .from('daily_missions')
      .select('*')
      .eq('user_id', userId)
      .eq('mission_date', today);

    if (fetchError) {
      console.error('Error fetching daily missions:', fetchError);
      return {
        missions: [],
        bonus: null,
        totalCompleted: 0,
        totalMissions: MISSIONS_PER_DAY,
        allClaimed: false,
        bonusAvailable: false,
      };
    }

    let missions: DailyMission[] = existingMissions || [];

    // 2. If no missions exist, generate new ones
    if (missions.length === 0) {
      missions = await this.generateDailyMissions(userId, today);
    }

    // 3. Get or create bonus tracker
    let bonus = await this.getOrCreateBonusTracker(userId, today);

    // 4. Calculate state
    const totalCompleted = missions.filter(m => m.is_completed).length;
    const allClaimed = missions.every(m => m.is_claimed);
    const bonusAvailable = totalCompleted >= MISSIONS_PER_DAY && !bonus?.is_claimed;

    return {
      missions,
      bonus,
      totalCompleted,
      totalMissions: MISSIONS_PER_DAY,
      allClaimed,
      bonusAvailable,
    };
  },

  /**
   * Generate new daily missions for a user
   */
  async generateDailyMissions(userId: string, date: string): Promise<DailyMission[]> {
    // 1. Fetch active mission definitions
    const { data: definitions, error: defError } = await supabase
      .from('mission_definitions')
      .select('*')
      .eq('is_active', true);

    if (defError || !definitions || definitions.length === 0) {
      console.error('Error fetching mission definitions:', defError);
      return [];
    }

    // 2. Randomly select MISSIONS_PER_DAY missions
    const shuffled = shuffleArray(definitions);
    const selected = shuffled.slice(0, Math.min(MISSIONS_PER_DAY, shuffled.length));

    // 3. Generate missions with randomized requirements
    const missionsToInsert = selected.map((def: MissionDefinition) => {
      const requirement = randomInt(def.requirement_min, def.requirement_max);
      const xpReward = randomInt(def.xp_reward_min, def.xp_reward_max);

      // Replace {n} in templates
      const title = def.title_template.replace('{n}', requirement.toString());
      const description = def.description_template.replace('{n}', requirement.toString());

      return {
        user_id: userId,
        mission_definition_id: def.id,
        mission_date: date,
        title,
        description,
        icon: def.icon,
        requirement_type: def.type,
        requirement_target: requirement,
        current_progress: 0,
        xp_reward: xpReward,
        is_completed: false,
        is_claimed: false,
      };
    });

    // 4. Insert missions
    const { data: insertedMissions, error: insertError } = await supabase
      .from('daily_missions')
      .insert(missionsToInsert)
      .select();

    if (insertError) {
      console.error('Error inserting daily missions:', insertError);
      return [];
    }

    // 5. Create bonus tracker
    await this.getOrCreateBonusTracker(userId, date);

    return insertedMissions || [];
  },

  /**
   * Get or create the daily bonus tracker
   */
  async getOrCreateBonusTracker(userId: string, date: string): Promise<DailyMissionBonus | null> {
    // Check if exists
    const { data: existing } = await supabase
      .from('daily_mission_bonuses')
      .select('*')
      .eq('user_id', userId)
      .eq('bonus_date', date)
      .single();

    if (existing) return existing;

    // Create new
    const { data: newBonus, error } = await supabase
      .from('daily_mission_bonuses')
      .insert({
        user_id: userId,
        bonus_date: date,
        missions_required: MISSIONS_PER_DAY,
        missions_completed: 0,
        bonus_xp: DAILY_BONUS_XP,
        is_claimed: false,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating bonus tracker:', error);
      return null;
    }

    return newBonus;
  },

  /**
   * Update progress for missions matching a requirement type
   * Called by other services when relevant activities occur
   */
  async updateProgress(
    userId: string,
    requirementType: string,
    amount: number = 1,
    metadata?: { score?: number }
  ): Promise<MissionUpdateResult[]> {
    const today = getTodayDate();

    // 1. Get today's missions that match the requirement type and aren't completed
    const { data: missions, error } = await supabase
      .from('daily_missions')
      .select('*')
      .eq('user_id', userId)
      .eq('mission_date', today)
      .eq('requirement_type', requirementType)
      .eq('is_completed', false);

    if (error || !missions || missions.length === 0) {
      return [];
    }

    const results: MissionUpdateResult[] = [];

    for (const mission of missions) {
      // Special handling for quiz_score_threshold
      if (requirementType === 'quiz_score_threshold') {
        if (!metadata?.score || metadata.score < 80) {
          continue; // Skip if score doesn't meet threshold
        }
      }

      const newProgress = Math.min(mission.current_progress + amount, mission.requirement_target);
      const justCompleted = newProgress >= mission.requirement_target && !mission.is_completed;

      // Update mission
      const updateData: any = {
        current_progress: newProgress,
      };

      if (justCompleted) {
        updateData.is_completed = true;
        updateData.completed_at = new Date().toISOString();
      }

      const { data: updatedMission, error: updateError } = await supabase
        .from('daily_missions')
        .update(updateData)
        .eq('id', mission.id)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating mission progress:', updateError);
        continue;
      }

      // If just completed, update bonus tracker
      if (justCompleted) {
        await this.incrementBonusProgress(userId, today);
      }

      results.push({
        updated: true,
        missionId: mission.id,
        newProgress,
        justCompleted,
        mission: updatedMission,
      });
    }

    return results;
  },

  /**
   * Increment the missions_completed count in the bonus tracker
   */
  async incrementBonusProgress(userId: string, date: string): Promise<void> {
    const { data: bonus } = await supabase
      .from('daily_mission_bonuses')
      .select('*')
      .eq('user_id', userId)
      .eq('bonus_date', date)
      .single();

    if (bonus) {
      await supabase
        .from('daily_mission_bonuses')
        .update({
          missions_completed: bonus.missions_completed + 1,
        })
        .eq('id', bonus.id);
    }
  },

  /**
   * Claim reward for a completed mission
   */
  async claimMissionReward(userId: string, missionId: string): Promise<number> {
    // 1. Get the mission
    const { data: mission, error } = await supabase
      .from('daily_missions')
      .select('*')
      .eq('id', missionId)
      .eq('user_id', userId)
      .single();

    if (error || !mission) {
      console.error('Mission not found:', error);
      return 0;
    }

    // 2. Verify it's completed and not already claimed
    if (!mission.is_completed) {
      console.error('Mission not completed yet');
      return 0;
    }

    if (mission.is_claimed) {
      console.error('Mission already claimed');
      return 0;
    }

    // 3. Mark as claimed
    const { error: updateError } = await supabase
      .from('daily_missions')
      .update({
        is_claimed: true,
        claimed_at: new Date().toISOString(),
      })
      .eq('id', missionId);

    if (updateError) {
      console.error('Error claiming mission:', updateError);
      return 0;
    }

    // 4. Award XP
    await GamificationService.awardXP(userId, mission.xp_reward);

    return mission.xp_reward;
  },

  /**
   * Claim the daily bonus for completing all missions
   */
  async claimDailyBonus(userId: string): Promise<number> {
    const today = getTodayDate();

    // 1. Get the bonus tracker
    const { data: bonus, error } = await supabase
      .from('daily_mission_bonuses')
      .select('*')
      .eq('user_id', userId)
      .eq('bonus_date', today)
      .single();

    if (error || !bonus) {
      console.error('Bonus tracker not found:', error);
      return 0;
    }

    // 2. Verify all missions completed
    if (bonus.missions_completed < bonus.missions_required) {
      console.error('Not all missions completed');
      return 0;
    }

    // 3. Check not already claimed
    if (bonus.is_claimed) {
      console.error('Bonus already claimed');
      return 0;
    }

    // 4. Mark as claimed
    const { error: updateError } = await supabase
      .from('daily_mission_bonuses')
      .update({
        is_claimed: true,
        claimed_at: new Date().toISOString(),
      })
      .eq('id', bonus.id);

    if (updateError) {
      console.error('Error claiming bonus:', updateError);
      return 0;
    }

    // 5. Award bonus XP
    await GamificationService.awardXP(userId, bonus.bonus_xp);

    return bonus.bonus_xp;
  },

  /**
   * Get mission progress summary for display
   */
  async getMissionsSummary(userId: string): Promise<{
    completed: number;
    total: number;
    xpEarned: number;
    xpPending: number;
  }> {
    const today = getTodayDate();

    const { data: missions } = await supabase
      .from('daily_missions')
      .select('*')
      .eq('user_id', userId)
      .eq('mission_date', today);

    if (!missions) {
      return { completed: 0, total: MISSIONS_PER_DAY, xpEarned: 0, xpPending: 0 };
    }

    const completed = missions.filter(m => m.is_completed).length;
    const xpEarned = missions.filter(m => m.is_claimed).reduce((sum, m) => sum + m.xp_reward, 0);
    const xpPending = missions.filter(m => m.is_completed && !m.is_claimed).reduce((sum, m) => sum + m.xp_reward, 0);

    return {
      completed,
      total: missions.length,
      xpEarned,
      xpPending,
    };
  },
};
