
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { StudentProgress } from '../types';
import { getClassHeatmapData, getClassProgressTrend, getClassAnalytics, ClassTopic } from '../services/ClassroomService';

const TeacherAnalytics: React.FC = () => {
  const { classId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [trendData, setTrendData] = useState<any[]>([]);
  const [students, setStudents] = useState<StudentProgress[]>([]);
  const [topics, setTopics] = useState<ClassTopic[]>([]);
  const [stats, setStats] = useState({
    averageGrade: 0,
    studentCount: 0,
    atRiskCount: 0
  });

  useEffect(() => {
    if (!classId) return;

    const loadData = async () => {
      try {
        setLoading(true);
        const [analyticsData, heatmapData, trendDataRes] = await Promise.all([
          getClassAnalytics(classId),
          getClassHeatmapData(classId),
          getClassProgressTrend(classId)
        ]);

        setStats({
          averageGrade: analyticsData.averageGrade,
          studentCount: analyticsData.studentCount,
          atRiskCount: heatmapData.students.filter((s: any) => s.isAtRisk).length
        });

        setStudents(heatmapData.students);
        setTopics(heatmapData.topics);
        setTrendData(trendDataRes);

      } catch (err) {
        console.error("Error loading analytics:", err);
        setError("No se pudieron cargar los datos analíticos.");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [classId]);

  const getHeatmapColor = (score: number) => {
    if (score >= 80) return 'bg-emerald-100 text-emerald-700';
    if (score >= 60) return 'bg-amber-100 text-amber-700';
    return 'bg-rose-100 text-rose-700';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center flex-col gap-4">
        <p className="text-red-500 font-bold">{error}</p>
        <button onClick={() => navigate(-1)} className="text-primary hover:underline">Volver</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex">
      <main className="flex-1 p-8 space-y-8">
        <header className="flex items-center gap-4">
          <button
            onClick={() => navigate(`/teacher/class/${classId}`)}
            className="w-10 h-10 rounded-full hover:bg-slate-100 flex items-center justify-center transition-colors"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div>
            <h1 className="text-3xl font-black tracking-tight">Análisis de Clase</h1>
            <p className="text-slate-500">Monitoreo detallado y predicción de riesgo estudiantil.</p>
          </div>
        </header>

        <div className="grid lg:grid-cols-12 gap-8">
          {/* Trend Chart */}
          <div className="lg:col-span-8 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
            <h3 className="font-bold text-lg">Progreso Promedio vs Meta</h3>
            <div className="h-64 w-full">
              {trendData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData}>
                    <defs>
                      <linearGradient id="colorProg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563EB" stopOpacity={0.1} />
                        <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip />
                    <Area type="monotone" dataKey="progress" stroke="#2563EB" fillOpacity={1} fill="url(#colorProg)" strokeWidth={3} name="Progreso" />
                    <Line type="monotone" dataKey="target" stroke="#CBD5E1" strokeDasharray="5 5" name="Meta (80%)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400">
                  Sin datos de tareas suficientes para mostrar tendencia.
                </div>
              )}
            </div>
          </div>

          {/* Quick Stats Sidebar */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-blue-100 text-primary rounded-full flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-3xl font-bold">trending_up</span>
              </div>
              <p className="text-slate-500 text-sm font-medium">Promedio Grupal</p>
              <h2 className="text-4xl font-black text-slate-900">{stats.averageGrade}%</h2>
              {/* <p className="text-emerald-500 text-sm font-bold mt-1">↑ 4% vs sem anterior</p> */} {/* Placeholder removed until we have historical comparisons */}
            </div>

            <div className="bg-rose-50 p-6 rounded-2xl border border-rose-100">
              <h3 className="font-bold text-rose-900 mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-lg">warning</span> Estudiantes en Riesgo ({stats.atRiskCount})
              </h3>
              <div className="space-y-4 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                {students.filter(s => s.isAtRisk).length === 0 ? (
                  <p className="text-sm text-rose-700 italic">No hay estudiantes en riesgo detectados.</p>
                ) : (
                  students.filter(s => s.isAtRisk).map(s => (
                    <div key={s.id} className="flex items-center justify-between bg-white p-3 rounded-xl border border-rose-200">
                      <div className="flex items-center gap-3">
                        <img
                          src={s.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(s.name)}&background=random`}
                          className="w-8 h-8 rounded-full object-cover"
                          alt={s.name}
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(s.name)}&background=random`;
                          }}
                        />
                        <span className="text-sm font-bold text-slate-900 truncate max-w-[120px]" title={s.name}>{s.name}</span>
                      </div>
                      <span className="text-rose-600 font-bold text-sm">{s.totalAvg}%</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Heatmap Section */}
          <div className="lg:col-span-12 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <h3 className="font-bold text-lg">Heatmap de Dominio de Temas</h3>
              <div className="flex gap-4 text-xs font-bold text-slate-500 flex-wrap">
                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-emerald-100 rounded-sm"></span> 80%+</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-amber-100 rounded-sm"></span> 60-79%</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-rose-100 rounded-sm"></span> &lt;60%</span>
              </div>
            </div>

            {students.length === 0 ? (
              <div className="p-12 text-center text-slate-500">
                No hay estudiantes inscritos en esta clase.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">
                      <th className="p-4 bg-slate-50 sticky left-0 z-10 w-64 min-w-[200px]">Estudiante</th>
                      {topics.map(topic => (
                        <th key={topic.id} className="p-4 text-center whitespace-nowrap min-w-[100px]">{topic.name}</th>
                      ))}
                      {topics.length === 0 && <th className="p-4 text-center text-slate-400 italic">Sin temas definidos</th>}
                      <th className="p-4 text-center w-24">Promedio</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {students.map(student => (
                      <tr key={student.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-4 bg-white sticky left-0 z-10 border-r border-slate-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                          <div className="flex items-center gap-3">
                            <img
                              src={student.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(student.name)}&background=random`}
                              className="w-8 h-8 rounded-full object-cover"
                              alt={student.name}
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(student.name)}&background=random`;
                              }}
                            />
                            <span className="text-sm font-bold text-slate-900">{student.name}</span>
                          </div>
                        </td>

                        {topics.map(topic => {
                          const score = student.scores[topic.id] || 0;
                          return (
                            <td key={topic.id} className="p-4 text-center">
                              <div className={`mx-auto w-16 py-1.5 rounded-lg text-center text-xs font-bold ${getHeatmapColor(score)}`}>
                                {score}%
                              </div>
                            </td>
                          );
                        })}
                        {topics.length === 0 && <td className="p-4 text-center">-</td>}

                        <td className="p-4 text-center">
                          <span className={`text-sm font-black ${student.totalAvg < 60 ? 'text-rose-600' : 'text-slate-900'}`}>
                            {student.totalAvg}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default TeacherAnalytics;
