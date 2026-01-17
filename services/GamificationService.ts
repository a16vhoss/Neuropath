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
    }
};
