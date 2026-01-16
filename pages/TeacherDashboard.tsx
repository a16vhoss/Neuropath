
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface ClassInfo {
  id: string;
  name: string;
  code: string;
  students: number;
  progress: number;
  materials: number;
  atRisk: number;
}

const mockClasses: ClassInfo[] = [
  { id: '1', name: 'Neurobiología 101', code: 'NB-101', students: 32, progress: 65, materials: 12, atRisk: 3 },
  { id: '2', name: 'IA Aplicada', code: 'IA-201', students: 28, progress: 72, materials: 8, atRisk: 1 },
  { id: '3', name: 'Psicología Cognitiva', code: 'PC-301', students: 45, progress: 58, materials: 15, atRisk: 5 }
];

const TeacherDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [newClass, setNewClass] = useState({ name: '', code: '', description: '', topics: [] as string[], examDate: '' });

  const handleCreateClass = () => {
    // Simulate class creation
    setShowCreateModal(false);
    setWizardStep(1);
    setNewClass({ name: '', code: '', description: '', topics: [], examDate: '' });
  };

  const suggestedTopics = ['Neuronas', 'Sinapsis', 'Sistema Limbico', 'Neurotransmisores', 'Memoria', 'Plasticidad', 'Corteza'];

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-6 flex items-center gap-2 border-b border-slate-100">
          <span className="material-symbols-outlined text-primary text-3xl font-bold">neurology</span>
          <span className="font-extrabold text-xl tracking-tighter text-slate-900">NEUROPATH</span>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <div className="bg-primary/5 text-primary p-3 rounded-lg flex items-center gap-3 font-bold">
            <span className="material-symbols-outlined">dashboard</span> Panel
          </div>
          <div className="text-slate-600 p-3 rounded-lg flex items-center gap-3 font-medium hover:bg-slate-50 cursor-pointer">
            <span className="material-symbols-outlined">school</span> Mis Clases
          </div>
          <div className="text-slate-600 p-3 rounded-lg flex items-center gap-3 font-medium hover:bg-slate-50 cursor-pointer">
            <span className="material-symbols-outlined">analytics</span> Analíticas
          </div>
          <div className="text-slate-600 p-3 rounded-lg flex items-center gap-3 font-medium hover:bg-slate-50 cursor-pointer">
            <span className="material-symbols-outlined">folder</span> Materiales
          </div>
          <div className="text-slate-600 p-3 rounded-lg flex items-center gap-3 font-medium hover:bg-slate-50 cursor-pointer">
            <span className="material-symbols-outlined">settings</span> Configuración
          </div>
        </nav>
        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 cursor-pointer" onClick={() => navigate('/')}>
            <img src="https://picsum.photos/seed/teacher/40" className="w-10 h-10 rounded-full" alt="Profile" />
            <div>
              <p className="font-bold text-slate-900 text-sm">Dra. Sarah Miller</p>
              <p className="text-xs text-slate-500">Profesor</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 md:p-10 space-y-8 overflow-y-auto">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">¡Buenos días, Dra. Miller! 👋</h1>
            <p className="text-slate-500 font-medium">Aquí está el resumen de tus clases</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-primary text-white font-bold px-6 py-3 rounded-xl shadow-lg hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-lg">add</span> Crear Clase
          </button>
        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Clases Activas', value: '3', icon: 'school', color: 'blue', trend: '+1 este mes' },
            { label: 'Total Estudiantes', value: '105', icon: 'groups', color: 'violet', trend: '+12 este mes' },
            { label: 'Materiales Generados', value: '35', icon: 'auto_awesome', color: 'emerald', trend: '580 flashcards' },
            { label: 'Estudiantes en Riesgo', value: '9', icon: 'warning', color: 'rose', trend: 'Requieren atención' }
          ].map((stat, i) => (
            <div key={i} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${stat.color === 'blue' ? 'bg-blue-100 text-blue-600' :
                    stat.color === 'violet' ? 'bg-violet-100 text-violet-600' :
                      stat.color === 'emerald' ? 'bg-emerald-100 text-emerald-600' :
                        'bg-rose-100 text-rose-600'
                  }`}>
                  <span className="material-symbols-outlined">{stat.icon}</span>
                </div>
                <span className="text-xs text-slate-500">{stat.label}</span>
              </div>
              <p className="text-3xl font-black text-slate-900">{stat.value}</p>
              <p className="text-xs text-slate-400 mt-1">{stat.trend}</p>
            </div>
          ))}
        </div>

        {/* Alerts */}
        <div className="bg-rose-50 border border-rose-100 p-4 rounded-2xl flex items-start gap-4">
          <div className="w-10 h-10 bg-rose-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined text-rose-600">warning</span>
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-rose-700 mb-1">9 estudiantes en riesgo</h3>
            <p className="text-sm text-rose-600">Hay estudiantes con progreso menor al 40%. Haz clic para ver el detalle y tomar acciones.</p>
          </div>
          <button className="text-rose-600 font-bold text-sm hover:underline">Ver todos →</button>
        </div>

        {/* Classes Grid */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <span className="w-1.5 h-6 bg-primary rounded-full"></span> Mis Clases
            </h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {mockClasses.map((cls) => (
              <div key={cls.id} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-lg transition-all group">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-lg text-slate-900">{cls.name}</h3>
                    <p className="text-xs text-slate-500 font-mono">{cls.code}</p>
                  </div>
                  <span className="bg-blue-100 text-blue-600 text-xs font-bold px-2 py-1 rounded-full">{cls.students} estudiantes</span>
                </div>

                <div className="space-y-3 mb-6">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-500">Progreso grupal</span>
                      <span className={`font-bold ${cls.progress >= 70 ? 'text-emerald-600' : cls.progress >= 50 ? 'text-amber-600' : 'text-rose-600'}`}>{cls.progress}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${cls.progress >= 70 ? 'bg-emerald-500' : cls.progress >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`}
                        style={{ width: `${cls.progress}%` }}
                      ></div>
                    </div>
                  </div>
                  <div className="flex gap-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">folder</span> {cls.materials} materiales
                    </span>
                    {cls.atRisk > 0 && (
                      <span className="flex items-center gap-1 text-rose-500">
                        <span className="material-symbols-outlined text-sm">warning</span> {cls.atRisk} en riesgo
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => navigate(`/teacher/class/${cls.id}`)}
                    className="flex-1 bg-primary text-white font-bold py-2 rounded-xl hover:bg-blue-700 transition-all text-sm"
                  >
                    Ver Clase
                  </button>
                  <button
                    onClick={() => navigate(`/teacher/analytics/${cls.id}`)}
                    className="px-3 py-2 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-all"
                  >
                    <span className="material-symbols-outlined text-lg">analytics</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Activity Timeline */}
        <section>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2 mb-6">
            <span className="w-1.5 h-6 bg-violet-500 rounded-full"></span> Actividad Reciente
          </h2>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <div className="space-y-6">
              {[
                { icon: 'upload_file', text: 'Subiste "Cap 3 - Sistema Limbico.pdf" a Neurobiología 101', time: 'Hace 2 horas', color: 'violet' },
                { icon: 'person_add', text: '3 nuevos estudiantes se unieron a IA Aplicada', time: 'Hace 5 horas', color: 'blue' },
                { icon: 'warning', text: 'Carlos López cayó por debajo del 40% en Neurobiología', time: 'Hace 1 día', color: 'rose' },
                { icon: 'auto_awesome', text: 'IA generó 45 flashcards de "Video Sinapsis"', time: 'Hace 2 días', color: 'emerald' },
                { icon: 'assignment_turned_in', text: 'Quiz semanal completado por 28/32 estudiantes', time: 'Hace 3 días', color: 'blue' }
              ].map((activity, i) => (
                <div key={i} className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${activity.color === 'violet' ? 'bg-violet-100 text-violet-600' :
                      activity.color === 'blue' ? 'bg-blue-100 text-blue-600' :
                        activity.color === 'rose' ? 'bg-rose-100 text-rose-600' :
                          'bg-emerald-100 text-emerald-600'
                    }`}>
                    <span className="material-symbols-outlined">{activity.icon}</span>
                  </div>
                  <div className="flex-1 pt-2">
                    <p className="text-sm text-slate-700">{activity.text}</p>
                    <p className="text-xs text-slate-400 mt-1">{activity.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Create Class Wizard Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden">
            {/* Progress Steps */}
            <div className="p-6 bg-slate-50 border-b border-slate-100">
              <div className="flex items-center justify-between mb-4">
                {[1, 2, 3, 4].map((step) => (
                  <div key={step} className="flex items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${wizardStep >= step ? 'bg-primary text-white' : 'bg-slate-200 text-slate-500'
                      }`}>
                      {wizardStep > step ? <span className="material-symbols-outlined text-sm">check</span> : step}
                    </div>
                    {step < 4 && (
                      <div className={`w-12 md:w-20 h-1 mx-1 rounded ${wizardStep > step ? 'bg-primary' : 'bg-slate-200'}`}></div>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-sm text-slate-500 text-center">
                {wizardStep === 1 ? 'Información Básica' : wizardStep === 2 ? 'Temas y Contenido' : wizardStep === 3 ? 'Configuración' : 'Confirmar'}
              </p>
            </div>

            <div className="p-8">
              {/* Step 1: Basic Info */}
              {wizardStep === 1 && (
                <div className="space-y-6">
                  <h2 className="text-2xl font-black text-slate-900">Crear Nueva Clase</h2>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Nombre de la Clase *</label>
                    <input
                      type="text"
                      value={newClass.name}
                      onChange={(e) => setNewClass({ ...newClass, name: e.target.value })}
                      placeholder="Ej: Neurobiología 101"
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Código de Clase</label>
                    <input
                      type="text"
                      value={newClass.code}
                      onChange={(e) => setNewClass({ ...newClass, code: e.target.value.toUpperCase() })}
                      placeholder="Ej: NB-101"
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none font-mono"
                    />
                    <p className="text-xs text-slate-500 mt-1">Los estudiantes usarán este código para unirse</p>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Descripción</label>
                    <textarea
                      value={newClass.description}
                      onChange={(e) => setNewClass({ ...newClass, description: e.target.value })}
                      placeholder="Breve descripción del curso..."
                      rows={3}
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none"
                    />
                  </div>
                </div>
              )}

              {/* Step 2: Topics */}
              {wizardStep === 2 && (
                <div className="space-y-6">
                  <h2 className="text-2xl font-black text-slate-900">Temas del Curso</h2>
                  <p className="text-slate-500">Selecciona los temas que cubrirá el curso. La IA usará esta información para generar contenido relevante.</p>
                  <div className="flex flex-wrap gap-2">
                    {suggestedTopics.map((topic) => (
                      <button
                        key={topic}
                        onClick={() => {
                          if (newClass.topics.includes(topic)) {
                            setNewClass({ ...newClass, topics: newClass.topics.filter(t => t !== topic) });
                          } else {
                            setNewClass({ ...newClass, topics: [...newClass.topics, topic] });
                          }
                        }}
                        className={`px-4 py-2 rounded-full font-medium text-sm transition-all ${newClass.topics.includes(topic)
                            ? 'bg-primary text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                      >
                        {topic}
                      </button>
                    ))}
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Añadir tema personalizado</label>
                    <input
                      type="text"
                      placeholder="Escribe y presiona Enter"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.target as HTMLInputElement).value) {
                          setNewClass({ ...newClass, topics: [...newClass.topics, (e.target as HTMLInputElement).value] });
                          (e.target as HTMLInputElement).value = '';
                        }
                      }}
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Step 3: Configuration */}
              {wizardStep === 3 && (
                <div className="space-y-6">
                  <h2 className="text-2xl font-black text-slate-900">Configuración</h2>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Fecha del Primer Examen</label>
                    <input
                      type="date"
                      value={newClass.examDate}
                      onChange={(e) => setNewClass({ ...newClass, examDate: e.target.value })}
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                    />
                    <p className="text-xs text-slate-500 mt-1">La IA activará modo cramming 7 días antes</p>
                  </div>
                  <div className="space-y-4">
                    <label className="block text-sm font-bold text-slate-700">Opciones adicionales</label>
                    {[
                      { id: 'gamification', label: 'Habilitar gamificación (rachas, XP, badges)', checked: true },
                      { id: 'leaderboard', label: 'Mostrar leaderboard a estudiantes', checked: true },
                      { id: 'aiTutor', label: 'Habilitar tutor IA socrático', checked: true }
                    ].map((option) => (
                      <label key={option.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl cursor-pointer hover:bg-slate-100">
                        <input type="checkbox" defaultChecked={option.checked} className="w-4 h-4 rounded" />
                        <span className="text-sm text-slate-700">{option.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 4: Confirm */}
              {wizardStep === 4 && (
                <div className="space-y-6">
                  <h2 className="text-2xl font-black text-slate-900">Confirmar Clase</h2>
                  <div className="bg-slate-50 p-6 rounded-2xl space-y-4">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Nombre:</span>
                      <span className="font-bold text-slate-900">{newClass.name || 'Sin nombre'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Código:</span>
                      <span className="font-mono font-bold text-slate-900">{newClass.code || 'Auto-generado'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Temas:</span>
                      <span className="font-bold text-slate-900">{newClass.topics.length} seleccionados</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Primer examen:</span>
                      <span className="font-bold text-slate-900">{newClass.examDate || 'No definido'}</span>
                    </div>
                  </div>
                  <div className="bg-emerald-50 p-4 rounded-xl text-sm text-emerald-700">
                    <strong>¡Listo!</strong> Una vez creada, los estudiantes podrán unirse con el código y la IA comenzará a preparar contenido personalizado.
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-between">
              <button
                onClick={() => {
                  if (wizardStep === 1) setShowCreateModal(false);
                  else setWizardStep(wizardStep - 1);
                }}
                className="px-6 py-3 text-slate-600 font-medium hover:text-slate-800"
              >
                {wizardStep === 1 ? 'Cancelar' : 'Atrás'}
              </button>
              <button
                onClick={() => {
                  if (wizardStep < 4) setWizardStep(wizardStep + 1);
                  else handleCreateClass();
                }}
                className="bg-primary text-white font-bold px-8 py-3 rounded-xl hover:bg-blue-700 transition-all"
              >
                {wizardStep === 4 ? 'Crear Clase' : 'Siguiente'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherDashboard;
