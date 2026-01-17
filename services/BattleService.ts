import { supabase } from './supabaseClient';

export interface Battle {
    id: string;
    class_id: string;
    challenger_id: string;
    opponent_id: string;
    status: 'pending' | 'active' | 'completed' | 'expired';
    challenger_score: number;
    opponent_score: number;
    winner_id: string | null;
    mode: 'realtime' | 'async';
    question_count: number;
    created_at: string;
    expires_at: string;
    completed_at: string | null;
    // Joined data
    challenger?: { full_name: string; avatar_url: string };
    opponent?: { full_name: string; avatar_url: string };
}

export interface BattleQuestion {
    id: string;
    battle_id: string;
    flashcard_id: string;
    question_order: number;
    flashcard?: {
        question: string;
        answer: string;
    };
}

export const BattleService = {
    /**
     * Get all battles for the current user
     */
    async getBattles(userId: string): Promise<Battle[]> {
        const { data, error } = await supabase
            .from('battles')
            .select(`
                *,
                challenger:profiles!battles_challenger_id_fkey(full_name, avatar_url),
                opponent:profiles!battles_opponent_id_fkey(full_name, avatar_url)
            `)
            .or(`challenger_id.eq.${userId},opponent_id.eq.${userId}`)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data as Battle[];
    },

    /**
     * Get pending battles (challenges waiting for user)
     */
    async getPendingBattles(userId: string): Promise<Battle[]> {
        const { data, error } = await supabase
            .from('battles')
            .select(`
                *,
                challenger:profiles!battles_challenger_id_fkey(full_name, avatar_url)
            `)
            .eq('opponent_id', userId)
            .eq('status', 'pending')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data as Battle[];
    },

    /**
     * Create a new battle challenge
     */
    async createBattle(challengerId: string, opponentId: string, classId: string, questionCount = 5): Promise<Battle> {
        // 1. Create the battle
        const { data: battle, error: battleError } = await supabase
            .from('battles')
            .insert({
                challenger_id: challengerId,
                opponent_id: opponentId,
                class_id: classId,
                question_count: questionCount,
                status: 'pending'
            })
            .select()
            .single();

        if (battleError) throw battleError;

        // 2. Select random flashcards from the class
        const { data: flashcards, error: flashcardsError } = await supabase
            .from('flashcards')
            .select('id')
            .eq('class_id', classId)
            .limit(questionCount * 3); // Get more than needed for randomization

        if (flashcardsError) throw flashcardsError;

        // Shuffle and take the needed count
        const shuffled = flashcards?.sort(() => Math.random() - 0.5).slice(0, questionCount) || [];

        // 3. Create battle questions
        if (shuffled.length > 0) {
            const battleQuestions = shuffled.map((fc, index) => ({
                battle_id: battle.id,
                flashcard_id: fc.id,
                question_order: index + 1
            }));

            const { error: questionsError } = await supabase
                .from('battle_questions')
                .insert(battleQuestions);

            if (questionsError) throw questionsError;
        }

        return battle as Battle;
    },

    /**
     * Accept a battle challenge
     */
    async acceptBattle(battleId: string): Promise<void> {
        const { error } = await supabase
            .from('battles')
            .update({ status: 'active' })
            .eq('id', battleId);

        if (error) throw error;
    },

    /**
     * Get battle questions with flashcard content
     */
    async getBattleQuestions(battleId: string): Promise<BattleQuestion[]> {
        const { data, error } = await supabase
            .from('battle_questions')
            .select(`
                *,
                flashcard:flashcards(question, answer)
            `)
            .eq('battle_id', battleId)
            .order('question_order', { ascending: true });

        if (error) throw error;
        return data as BattleQuestion[];
    },

    /**
     * Submit an answer to a battle question
     */
    async submitAnswer(
        battleId: string,
        questionId: string,
        playerId: string,
        answer: string,
        isCorrect: boolean,
        answerTimeMs: number
    ): Promise<void> {
        const { error } = await supabase
            .from('battle_answers')
            .insert({
                battle_id: battleId,
                question_id: questionId,
                player_id: playerId,
                answer,
                is_correct: isCorrect,
                answer_time_ms: answerTimeMs
            });

        if (error) throw error;

        // Update player's score in the battle
        const { data: battle } = await supabase
            .from('battles')
            .select('challenger_id, opponent_id, challenger_score, opponent_score')
            .eq('id', battleId)
            .single();

        if (battle && isCorrect) {
            const isChallenger = battle.challenger_id === playerId;
            const scoreField = isChallenger ? 'challenger_score' : 'opponent_score';
            const currentScore = isChallenger ? battle.challenger_score : battle.opponent_score;

            await supabase
                .from('battles')
                .update({ [scoreField]: currentScore + 1 })
                .eq('id', battleId);
        }
    },

    /**
     * Check if battle is complete and determine winner
     */
    async checkBattleComplete(battleId: string): Promise<{ completed: boolean; winner_id?: string }> {
        const { data: battle } = await supabase
            .from('battles')
            .select('*')
            .eq('id', battleId)
            .single();

        if (!battle) return { completed: false };

        // Count answers from both players
        const { count: totalAnswers } = await supabase
            .from('battle_answers')
            .select('*', { count: 'exact', head: true })
            .eq('battle_id', battleId);

        const expectedAnswers = battle.question_count * 2; // Both players answer all questions

        if (totalAnswers === expectedAnswers) {
            // Battle is complete, determine winner
            let winnerId = null;
            if (battle.challenger_score > battle.opponent_score) {
                winnerId = battle.challenger_id;
            } else if (battle.opponent_score > battle.challenger_score) {
                winnerId = battle.opponent_id;
            }
            // Tie = no winner

            await supabase
                .from('battles')
                .update({
                    status: 'completed',
                    winner_id: winnerId,
                    completed_at: new Date().toISOString()
                })
                .eq('id', battleId);

            return { completed: true, winner_id: winnerId };
        }

        return { completed: false };
    },

    /**
     * Get weekly leaderboard for a class
     */
    async getWeeklyLeaderboard(classId: string): Promise<{ player_id: string; full_name: string; wins: number; battles: number }[]> {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        const { data: battles, error } = await supabase
            .from('battles')
            .select('challenger_id, opponent_id, winner_id')
            .eq('class_id', classId)
            .eq('status', 'completed')
            .gte('completed_at', oneWeekAgo.toISOString());

        if (error) throw error;

        // Count wins and battles per player
        const stats: Record<string, { wins: number; battles: number }> = {};

        battles?.forEach(battle => {
            // Track challenger
            if (!stats[battle.challenger_id]) stats[battle.challenger_id] = { wins: 0, battles: 0 };
            stats[battle.challenger_id].battles++;
            if (battle.winner_id === battle.challenger_id) stats[battle.challenger_id].wins++;

            // Track opponent
            if (!stats[battle.opponent_id]) stats[battle.opponent_id] = { wins: 0, battles: 0 };
            stats[battle.opponent_id].battles++;
            if (battle.winner_id === battle.opponent_id) stats[battle.opponent_id].wins++;
        });

        // Get player names
        const playerIds = Object.keys(stats);
        if (playerIds.length === 0) return [];

        const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', playerIds);

        const result = playerIds.map(id => ({
            player_id: id,
            full_name: profiles?.find(p => p.id === id)?.full_name || 'Unknown',
            wins: stats[id].wins,
            battles: stats[id].battles
        }));

        // Sort by wins
        result.sort((a, b) => b.wins - a.wins);

        return result;
    },

    /**
     * Get classmates to challenge
     */
    async getClassmates(userId: string, classId: string): Promise<{ id: string; full_name: string; avatar_url: string }[]> {
        const { data, error } = await supabase
            .from('enrollments')
            .select('profiles!enrollments_student_id_fkey(id, full_name, avatar_url)')
            .eq('class_id', classId)
            .neq('student_id', userId);

        if (error) throw error;

        return data?.map(d => d.profiles).filter(Boolean) as any[] || [];
    }
};
