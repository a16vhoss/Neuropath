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
    studySets: StudySet[];
    studySetId?: string; // Optional: to focus on a single set
}

const VisualProgressionMap: React.FC<VisualProgressionMapProps> = ({ studySets, studySetId }) => {
    const [data, setData] = useState<ProgressionData[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchMasteryLevels = async () => {
            setLoading(true);
            try {
                if (studySetId) {
                    // SINGLE SET MODE: Breakdown by Category (Topic)
                    // Fetch all flashcards for this set with their mastery
                    const { data: cards, error } = await supabase
                        .from('flashcards')
                        .select('id, category, srs:flashcard_srs(mastery_level)')
                        .eq('study_set_id', studySetId);

                    if (error) throw error;

                    if (!cards || cards.length === 0) {
                        setData([]);
                        return;
                    }

                    // Group by category
                    const categoryMap = new Map<string, { total: number; count: number }>();
                    let hasCategories = false;

                    cards.forEach((card: any) => {
                        const cat = card.category || 'General';
                        if (card.category) hasCategories = true;

                        const mastery = (card.srs && card.srs.length > 0) ? card.srs[0].mastery_level : 0;

                        const existing = categoryMap.get(cat) || { total: 0, count: 0 };
                        existing.total += mastery;
                        existing.count++;
                        categoryMap.set(cat, existing);
                    });

                    // If NO cards have categories (all are 'General'), maybe we can't show a radar chart?
                    // We will show it anyway, it will just have 1 axis "General" which looks weird.
                    // If so, we might need a fallback or just show it.

                    const results: ProgressionData[] = Array.from(categoryMap.entries()).map(([cat, stats]) => ({
                        subject: cat.length > 15 ? cat.substring(0, 15) + '...' : cat,
                        mastery: parseFloat((stats.total / stats.count).toFixed(2)),
                        fullMark: 4
                    }));

                    setData(results);

                } else {
                    // DASHBOARD MODE: Breakdown by Study Set
                    if (!studySets.length) {
                        setLoading(false);
                        return;
                    }

                    const promises = studySets.map(async (set) => {
                        // Fetch flashcards mastery for this set
                        const { data: cards, error } = await supabase
                            .from('flashcards')
                            .select('id, srs:flashcard_srs(mastery_level)')
                            .eq('study_set_id', set.id);

                        if (error) throw error;

                        if (!cards || cards.length === 0) {
                            return {
                                subject: set.name.length > 15 ? set.name.substring(0, 15) + '...' : set.name,
                                mastery: 0,
                                fullMark: 4
                            };
                        }

                        // Calculate average mastery (0-4)
                        let totalMastery = 0;
                        cards.forEach((card: any) => {
                            if (card.srs && card.srs.length > 0) {
                                totalMastery += card.srs[0].mastery_level;
                            }
                        });

                        const avgMastery = (totalMastery / cards.length);

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
    }, [studySets, studySetId]);

    if (loading) {
        return <div className="h-64 flex items-center justify-center text-slate-400">Cargando mapa...</div>;
    }

    if (data.length < 3) {
        // Defines a minimum data points for radar chart to look good
        // If less than 3, we can pad it or show a message.
        // Let's pad with placeholders if needed, or just show it (it will look like a line or dot)
    }

    return (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 h-full flex flex-col">
            <div className="flex items-center gap-2 mb-6">
                <span className="material-symbols-outlined text-violet-600">radar</span>
                <h3 className="font-bold text-slate-800 text-lg">
                    {studySetId ? 'Dominio por Temas' : 'Mapa de Dominio'}
                </h3>
            </div>

            <div className="flex-1 min-h-[300px] -ml-4">
                {data.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
                            <PolarGrid stroke="#e2e8f0" />
                            <PolarAngleAxis
                                dataKey="subject"
                                tick={{ fill: '#64748b', fontSize: 12 }}
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
