import { supabase } from './supabaseClient';

export interface Achievement {
    id: string;
    name: string;
    description: string;
    icon: string;
    xp_reward: number;
    requirement_type: string;
    requirement_value: number;
}

export interface StudentAchievement {
    achievement_id: string;
    earned_at: string;
}

export interface UserStats {
    xp: number;
    streak_days: number;
    level: number;
    full_name: string;
    avatar_url: string;
}

export const GamificationService = {
    async getUserStats(userId: string) {
        const { data, error } = await supabase
            .from('profiles')
            .select('xp, streak_days, level, full_name, avatar_url')
            .eq('id', userId)
            .single();

        if (error) throw error;
        return data as UserStats;
    },

    async getAchievements() {
        const { data, error } = await supabase
            .from('achievements')
            .select('*')
            .order('xp_reward', { ascending: true });

        if (error) throw error;
        return data as Achievement[];
    },

    async getStudentAchievements(userId: string) {
        const { data, error } = await supabase
            .from('student_achievements')
            .select('achievement_id, earned_at')
            .eq('student_id', userId);

        if (error) throw error;
        return data as StudentAchievement[];
    },

    async getLeaderboard(limit = 10) {
        const { data, error } = await supabase
            .from('profiles')
            .select('id, full_name, avatar_url, xp, streak_days')
            .order('xp', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return data;
    },

    async getStudyStats(userId: string) {
        // Fetch sessions from the last 7 days
        const { data, error } = await supabase
            .from('study_sessions')
            .select('duration_seconds, cards_reviewed, completed_at')
            .eq('student_id', userId)
            .gte('completed_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

        if (error) throw error;
        return data;
    },

    async awardXP(userId: string, xpAmount: number): Promise<number> {
        // Get current XP
        const { data: profile, error: fetchError } = await supabase
            .from('profiles')
            .select('xp, level')
            .eq('id', userId)
            .single();

        if (fetchError) throw fetchError;

        const newXP = (profile?.xp || 0) + xpAmount;
        // Level up every 500 XP
        const newLevel = Math.floor(newXP / 500) + 1;

        const { error: updateError } = await supabase
            .from('profiles')
            .update({ xp: newXP, level: newLevel })
            .eq('id', userId);

        if (updateError) throw updateError;
        return newXP;
    },

    async updateStreak(userId: string): Promise<number> {
        const today = new Date().toISOString().split('T')[0];

        const { data: profile, error: fetchError } = await supabase
            .from('profiles')
            .select('streak_days, last_study_date')
            .eq('id', userId)
            .single();

        if (fetchError) throw fetchError;

        let newStreak = 1;
        const lastStudy = profile?.last_study_date;

        if (lastStudy) {
            const lastDate = new Date(lastStudy);
            const todayDate = new Date(today);
            const diffDays = Math.floor((todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

            if (diffDays === 0) {
                // Same day, streak unchanged
                newStreak = profile.streak_days || 1;
            } else if (diffDays === 1) {
                // Consecutive day, increment streak
                newStreak = (profile.streak_days || 0) + 1;
            }
            // if diffDays > 1, streak resets to 1
        }

        const { error: updateError } = await supabase
            .from('profiles')
            .update({ streak_days: newStreak, last_study_date: today })
            .eq('id', userId);

        if (updateError) throw updateError;
        return newStreak;
    }
};
