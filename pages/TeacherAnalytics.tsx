
import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { StudentProgress } from '../types';

const mockDataTrend = [
  { name: 'Sem 1', progress: 10, target: 15 },
  { name: 'Sem 2', progress: 25, target: 30 },
  { name: 'Sem 3', progress: 45, target: 45 },
  { name: 'Sem 4', progress: 55, target: 60 },
  { name: 'Sem 5', progress: 78, target: 75 },
];

const mockStudents: StudentProgress[] = [
  { id: '1', name: 'Alice Freeman', avatar: 'https://picsum.photos/seed/1/40', totalAvg: 92, isAtRisk: false, scores: { 'mod1': 95, 'mod2': 88, 'mod3': 98 } },
  { id: '2', name: 'Bob Smith', avatar: 'https://picsum.photos/seed/2/40', totalAvg: 68, isAtRisk: false, scores: { 'mod1': 70, 'mod2': 65, 'mod3': 75 } },
  { id: '3', name: 'Charlie Davis', avatar: 'https://picsum.photos/seed/3/40', totalAvg: 38, isAtRisk: true, scores: { 'mod1': 42, 'mod2': 35, 'mod3': 40 } },
  { id: '4', name: 'Diana Evans', avatar: 'https://picsum.photos/seed/4/40', totalAvg: 85, isAtRisk: false, scores: { 'mod1': 82, 'mod2': 85, 'mod3': 88 } },
];

const TeacherAnalytics: React.FC = () => {
  const { classId } = useParams();
  const navigate = useNavigate();

  const getHeatmapColor = (score: number) => {
    if (score >= 80) return 'bg-emerald-100 text-emerald-700';
    if (score >= 50) return 'bg-amber-100 text-amber-700';
    return 'bg-rose-100 text-rose-700';
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex">
      <main className="flex-1 p-8 space-y-8">
        <header className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/teacher')}
            className="w-10 h-10 rounded-full hover:bg-slate-100 flex items-center justify-center"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div>
            <h1 className="text-3xl font-black tracking-tight">Análisis: Neurobiología 101</h1>
            <p className="text-slate-500">Monitoreo detallado y predicción de riesgo estudiantil.</p>
          </div>
        </header>

        <div className="grid lg:grid-cols-12 gap-8">
          {/* Trend Chart */}
          <div className="lg:col-span-8 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
            <h3 className="font-bold text-lg">Progreso Promedio vs Meta</h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={mockDataTrend}>
                  <defs>
                    <linearGradient id="colorProg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563EB" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#2563EB" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Area type="monotone" dataKey="progress" stroke="#2563EB" fillOpacity={1} fill="url(#colorProg)" strokeWidth={3} />
                  <Line type="monotone" dataKey="target" stroke="#CBD5E1" strokeDasharray="5 5" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Quick Stats Sidebar */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-blue-100 text-primary rounded-full flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-3xl font-bold">trending_up</span>
              </div>
              <p className="text-slate-500 text-sm font-medium">Promedio Grupal</p>
              <h2 className="text-4xl font-black text-slate-900">72.4%</h2>
              <p className="text-emerald-500 text-sm font-bold mt-1">↑ 4% vs sem anterior</p>
            </div>
            
            <div className="bg-rose-50 p-6 rounded-2xl border border-rose-100">
              <h3 className="font-bold text-rose-900 mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-lg">warning</span> Estudiantes en Riesgo
              </h3>
              <div className="space-y-4">
                {mockStudents.filter(s => s.isAtRisk).map(s => (
                  <div key={s.id} className="flex items-center justify-between bg-white p-3 rounded-xl border border-rose-200">
                    <div className="flex items-center gap-3">
                      <img src={s.avatar} className="w-8 h-8 rounded-full" alt={s.name} />
                      <span className="text-sm font-bold text-slate-900">{s.name}</span>
                    </div>
                    <span className="text-rose-600 font-bold text-sm">{s.totalAvg}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Heatmap Section */}
          <div className="lg:col-span-12 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <h3 className="font-bold text-lg">Heatmap de Dominio de Temas</h3>
              <div className="flex gap-4 text-xs font-bold text-slate-500">
                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-emerald-100 rounded-sm"></span> 80%+</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-amber-100 rounded-sm"></span> 50-79%</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-rose-100 rounded-sm"></span> &lt;50%</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">
                    <th className="p-4 bg-slate-50 sticky left-0 z-10 w-64">Estudiante</th>
                    <th className="p-4 text-center">Mod 1: Neuronas</th>
                    <th className="p-4 text-center">Mod 2: Sinapsis</th>
                    <th className="p-4 text-center">Mod 3: Cerebro</th>
                    <th className="p-4 text-center">Promedio</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {mockStudents.map(student => (
                    <tr key={student.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4 bg-white sticky left-0 z-10">
                        <div className="flex items-center gap-3">
                          <img src={student.avatar} className="w-8 h-8 rounded-full" alt={student.name} />
                          <span className="text-sm font-bold text-slate-900">{student.name}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className={`mx-auto w-16 py-1.5 rounded-lg text-center text-xs font-bold ${getHeatmapColor(student.scores.mod1)}`}>
                          {student.scores.mod1}%
                        </div>
                      </td>
                      <td className="p-4">
                        <div className={`mx-auto w-16 py-1.5 rounded-lg text-center text-xs font-bold ${getHeatmapColor(student.scores.mod2)}`}>
                          {student.scores.mod2}%
                        </div>
                      </td>
                      <td className="p-4">
                        <div className={`mx-auto w-16 py-1.5 rounded-lg text-center text-xs font-bold ${getHeatmapColor(student.scores.mod3)}`}>
                          {student.scores.mod3}%
                        </div>
                      </td>
                      <td className="p-4 text-center text-sm font-black text-slate-900">
                        {student.totalAvg}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default TeacherAnalytics;
