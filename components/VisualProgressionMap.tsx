import React, { useEffect, useState } from 'react';
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Tooltip } from 'recharts';
import { supabase } from '../services/supabaseClient';

interface StudySet {
    id: string;
    name: string;
}

interface ProgressionData {
    subject: string;
    mastery: number; // 0-100 score or 0-4 level
    fullMark: number;
}

interface VisualProgressionMapProps {
    studySets?: StudySet[];
    studySetId?: string; // Optional: to focus on a single set
    refreshTrigger?: number;
}

const VisualProgressionMap: React.FC<VisualProgressionMapProps> = ({ studySets, studySetId, refreshTrigger = 0 }) => {
    const [data, setData] = useState<ProgressionData[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchMasteryLevels = async () => {
            setLoading(true);
            try {
                if (studySetId) {
                    // SINGLE SET MODE: Breakdown by Category (Topic)
                    // Fetch all flashcards for this set
                    const { data: cards, error: cardError } = await supabase
                        .from('flashcards')
                        .select('id, category')
                        .eq('study_set_id', studySetId);

                    if (cardError) throw cardError;

                    if (!cards || cards.length === 0) {
                        setData([]);
                        return;
                    }

                    // Fetch progress to join manually
                    const flashcardIds = cards.map(c => c.id);
                    const { data: progress, error: progressError } = await supabase
                        .from('flashcard_progress')
                        .select('flashcard_id, difficulty_level')
                        .in('flashcard_id', flashcardIds);

                    if (progressError) console.error("Error fetching progress:", progressError);

                    // Create progress map
                    const progressMap = new Map();
                    progress?.forEach((p: any) => {
                        progressMap.set(p.flashcard_id, p.difficulty_level || 0);
                    });

                    // Group by category
                    const categoryMap = new Map<string, { total: number; count: number }>();
                    let hasCategories = false;

                    cards.forEach((card: any) => {
                        const cat = card.category || 'General';
                        if (card.category) hasCategories = true;

                        const mastery = progressMap.get(card.id) || 0; // Default to 0 if no progress

                        const existing = categoryMap.get(cat) || { total: 0, count: 0 };
                        existing.total += mastery;
                        existing.count++;
                        categoryMap.set(cat, existing);
                    });

                    let results: ProgressionData[] = Array.from(categoryMap.entries()).map(([cat, stats]) => ({
                        subject: cat.length > 12 ? cat.substring(0, 10) + '...' : cat,
                        mastery: parseFloat((stats.total / stats.count).toFixed(2)),
                        fullMark: 4
                    }));

                    // Pad with placeholders if less than 3 data points to make the Radar Chart look good
                    if (results.length > 0 && results.length < 3) {
                        // Add placeholder "empty" axes to make it a polygon
                        const needed = 3 - results.length;
                        for (let i = 0; i < needed; i++) {
                            results.push({
                                subject: ` `, // Empty label
                                mastery: 0,
                                fullMark: 4
                            });
                        }
                    }

                    setData(results);

                } else {
                    // DASHBOARD MODE: Breakdown by Study Set
                    if (!studySets || !studySets.length) {
                        setLoading(false);
                        return;
                    }

                    const promises = studySets.map(async (set) => {
                        // Fetch flashcard count and total mastery
                        const { data: cards } = await supabase
                            .from('flashcards')
                            .select('id')
                            .eq('study_set_id', set.id);

                        if (!cards || cards.length === 0) {
                            return { subject: set.name, mastery: 0, fullMark: 4 };
                        }

                        const cardIds = cards.map(c => c.id);
                        const { data: progress } = await supabase
                            .from('flashcard_progress')
                            .select('difficulty_level')
                            .in('flashcard_id', cardIds);

                        let totalMastery = 0;
                        progress?.forEach((p: any) => totalMastery += (p.difficulty_level || 0));

                        const avgMastery = progress && progress.length > 0 ? (totalMastery / cards.length) : 0; // Avg over ALL cards, not just studied ones? Usually mastery is over total curriculum.

                        return {
                            subject: set.name.length > 15 ? set.name.substring(0, 15) + '...' : set.name,
                            mastery: parseFloat(avgMastery.toFixed(2)),
                            fullMark: 4
                        };
                    });

                    const results = await Promise.all(promises);
                    setData(results);
                }
            } catch (error) {
                console.error('Error fetching visual progression data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchMasteryLevels();
    }, [studySets, studySetId, refreshTrigger]);

    if (loading) {
        return <div className="h-64 flex items-center justify-center text-slate-400">Cargando mapa...</div>;
    }

    return (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 h-full flex flex-col">
            <div className="flex items-center gap-2 mb-6">
                <span className="material-symbols-outlined text-violet-600">radar</span>
                <h3 className="font-bold text-slate-800 text-lg">
                    {studySetId ? 'Dominio por Temas' : 'Mapa de Dominio'}
                </h3>
            </div>

            <div className="flex-1 min-h-[500px]">
                {data.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <RadarChart cx="50%" cy="50%" outerRadius="65%" data={data}>
                            <PolarGrid stroke="#e2e8f0" />
                            <PolarAngleAxis
                                dataKey="subject"
                                tick={{ fill: '#475569', fontSize: 11, fontWeight: 500 }}
                            />
                            <PolarRadiusAxis
                                angle={30}
                                domain={[0, 4]}
                                tick={{ fill: '#94a3b8', fontSize: 10 }}
                                tickCount={5}
                            />
                            <Radar
                                name="Nivel de Maestría"
                                dataKey="mastery"
                                stroke="#8b5cf6"
                                strokeWidth={3}
                                fill="#8b5cf6"
                                fillOpacity={0.3}
                            />
                            <Tooltip
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                itemStyle={{ color: '#7c3aed', fontWeight: 'bold' }}
                                cursor={{ stroke: '#8b5cf6', strokeWidth: 1 }}
                            />
                        </RadarChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="h-full flex items-center justify-center text-slate-400 flex-col gap-2">
                        <span className="material-symbols-outlined text-4xl opacity-50">data_loss_prevention</span>
                        <span className="text-sm">Sin datos suficientes</span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default VisualProgressionMap;
