import { supabase } from './supabaseClient';
import { DailyMissionsService } from './DailyMissionsService';

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
        // Obtener fecha actual normalizada a medianoche local
        const now = new Date();
        const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const todayString = todayMidnight.toISOString().split('T')[0];

        const { data: profile, error: fetchError } = await supabase
            .from('profiles')
            .select('streak_days, last_study_date')
            .eq('id', userId)
            .single();

        if (fetchError) throw fetchError;

        let newStreak = 1;
        const lastStudy = profile?.last_study_date;

        if (lastStudy) {
            // Normalizar la última fecha de estudio a medianoche
            const lastStudyDate = new Date(lastStudy);
            const lastMidnight = new Date(lastStudyDate.getFullYear(), lastStudyDate.getMonth(), lastStudyDate.getDate());

            // Calcular diferencia en días calendario
            const diffDays = Math.floor((todayMidnight.getTime() - lastMidnight.getTime()) / (1000 * 60 * 60 * 24));

            if (diffDays === 0) {
                // Mismo día, mantener racha
                newStreak = profile.streak_days || 1;
            } else if (diffDays === 1) {
                // Día consecutivo, incrementar racha
                newStreak = (profile.streak_days || 0) + 1;
            } else {
                // Si pasó más de 1 día sin práctica, resetear racha a 0
                newStreak = 0;
            }
        }

        const { error: updateError } = await supabase
            .from('profiles')
            .update({ streak_days: newStreak, last_study_date: todayString })
            .eq('id', userId);

        if (updateError) throw updateError;

        // Update daily mission progress for streak maintenance
        try {
            await DailyMissionsService.updateProgress(userId, 'streak_maintain', 1);
        } catch (e) {
            console.error('Error updating streak_maintain mission:', e);
        }

        return newStreak;
    },

    async getDetailedUserStats(userId: string) {
        // 1. Get basic stats
        const { data: profile } = await supabase
            .from('profiles')
            .select('streak_days, xp, level')
            .eq('id', userId)
            .single();

        // 2. Count total sessions
        const { count: sessionsCount } = await supabase
            .from('study_sessions')
            .select('*', { count: 'exact', head: true })
            .eq('student_id', userId);

        // 3. Count perfect quizzes
        const { count: perfectQuizzes } = await supabase
            .from('quiz_attempts')
            .select('*', { count: 'exact', head: true })
            .eq('student_id', userId)
            .eq('score', 100); // Assuming 100 is max score, need to verify logic

        // 4. Calculate today's minutes
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const { data: todaySessions } = await supabase
            .from('study_sessions')
            .select('duration_seconds')
            .eq('student_id', userId)
            .gte('completed_at', startOfDay.toISOString());

        const todayMinutes = (todaySessions || []).reduce((sum, s) => sum + (s.duration_seconds || 0), 0) / 60;

        // 5. Count mastered topics (dummy logic for now, using unique categories from flashcards could be complex)
        // For simplicity, we'll count unique completed classes with >80% progress
        const { count: masteredTopics } = await supabase
            .from('enrollments')
            .select('*', { count: 'exact', head: true })
            .eq('student_id', userId)
            .gte('progress', 80);

        return {
            streak_days: profile?.streak_days || 0,
            sessions_count: sessionsCount || 0,
            perfect_quiz: perfectQuizzes || 0,
            daily_minutes: Math.round(todayMinutes),
            topics_mastered: masteredTopics || 0,
            help_count: 0 // Placeholder as community features are not fully implemented
        };
    },

    async checkAndUnlockAchievements(userId: string) {
        // 1. Get current stats
        const stats = await this.getDetailedUserStats(userId);

        // 2. Get unearned achievements
        const { data: allAchievements } = await supabase.from('achievements').select('*');
        const { data: earnedAchievements } = await supabase
            .from('student_achievements')
            .select('achievement_id')
            .eq('student_id', userId);

        const earnedIds = new Set((earnedAchievements || []).map(a => a.achievement_id));
        const unearned = (allAchievements || []).filter(a => !earnedIds.has(a.id));

        const unlocked: Achievement[] = [];

        // 3. Check criteria
        for (const achievement of unearned) {
            let thresholdMet = false;

            switch (achievement.requirement_type) {
                case 'streak_days':
                    if (stats.streak_days >= achievement.requirement_value) thresholdMet = true;
                    break;
                case 'sessions_count':
                    if (stats.sessions_count >= achievement.requirement_value) thresholdMet = true;
                    break;
                case 'daily_minutes':
                    if (stats.daily_minutes >= achievement.requirement_value) thresholdMet = true;
                    break;
                case 'perfect_quiz':
                    if (stats.perfect_quiz >= achievement.requirement_value) thresholdMet = true;
                    break;
                case 'topics_mastered':
                    if (stats.topics_mastered >= achievement.requirement_value) thresholdMet = true;
                    break;
                // Add more cases as needed
            }

            if (thresholdMet) {
                // Award achievement
                await supabase.from('student_achievements').insert({
                    student_id: userId,
                    achievement_id: achievement.id
                });

                // Award XP
                await this.awardXP(userId, achievement.xp_reward);

                unlocked.push(achievement);
            }
        }

        return unlocked;
    }
};
