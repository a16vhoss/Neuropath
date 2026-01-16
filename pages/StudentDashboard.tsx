
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getStudentClasses, joinClass, getAchievements, getStudentAchievements } from '../services/supabaseClient';

interface ClassData {
  id: string;
  name: string;
  code: string;
  description?: string;
  progress: number;
  teacher_name?: string;
  topics?: string[];
}

interface ExamData {
  id: string;
  name: string;
  class_name: string;
  date: Date;
  preparation: number;
}

const StudentDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile, signOut, loading: authLoading } = useAuth();

  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinSuccess, setJoinSuccess] = useState(false);
  const [joinError, setJoinError] = useState('');
  const [joiningClass, setJoiningClass] = useState(false);

  const [classes, setClasses] = useState<ClassData[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [badges, setBadges] = useState<number>(0);

  // Load student's classes
  useEffect(() => {
    const loadData = async () => {
      if (!user) return;

      try {
        setLoadingClasses(true);
        const enrollments = await getStudentClasses(user.id);

        // Transform enrollment data to class data
        const classData: ClassData[] = enrollments?.map((e: any) => ({
          id: e.classes.id,
          name: e.classes.name,
          code: e.classes.code,
          description: e.classes.description,
          progress: e.progress || 0,
          teacher_name: e.classes.teacher_name || 'Profesor',
          topics: e.classes.topics || []
        })) || [];

        setClasses(classData);

        // Load achievements count
        const achievements = await getStudentAchievements(user.id);
        setBadges(achievements?.length || 0);
      } catch (error) {
        console.error('Error loading classes:', error);
      } finally {
        setLoadingClasses(false);
      }
    };

    loadData();
  }, [user]);

  // Join class handler
  const handleJoinClass = async () => {
    if (joinCode.length !== 6 || !user) return;

    setJoiningClass(true);
    setJoinError('');

    try {
      await joinClass(user.id, joinCode.toUpperCase());
      setJoinSuccess(true);

      // Reload classes
      const enrollments = await getStudentClasses(user.id);
      const classData: ClassData[] = enrollments?.map((e: any) => ({
        id: e.classes.id,
        name: e.classes.name,
        code: e.classes.code,
        progress: e.progress || 0,
        teacher_name: e.classes.teacher_name || 'Profesor',
      })) || [];
      setClasses(classData);

      setTimeout(() => {
        setShowJoinModal(false);
        setJoinSuccess(false);
        setJoinCode('');
      }, 2000);
    } catch (error: any) {
      setJoinError(error.message || 'Código de clase inválido');
    } finally {
      setJoiningClass(false);
    }
  };

  // Mock upcoming exams (would come from quizzes table)
  const upcomingExams: ExamData[] = classes.length > 0 ? [
    { id: '1', name: `Quiz - ${classes[0]?.name || 'Clase'}`, class_name: classes[0]?.name || 'Clase', date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), preparation: 67 },
  ] : [];

  const getDaysRemaining = (date: Date) => {
    const diff = date.getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  // Get display name
  const displayName = profile?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'Estudiante';
  const xp = profile?.xp || 0;
  const level = profile?.level || 1;
  const streakDays = profile?.streak_days || 0;

  // Calculate XP for next level (simple formula: level * 500)
  const xpForNextLevel = level * 500;
  const xpProgress = Math.min((xp / xpForNextLevel) * 100, 100);
  const xpRemaining = xpForNextLevel - xp;

  // Course colors
  const courseColors = ['blue', 'violet', 'emerald', 'amber', 'rose'];
  const courseIcons = ['neurology', 'smart_toy', 'science', 'calculate', 'history_edu'];

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col">
      {/* Mobile-first Bottom Nav */}
      <nav className="fixed bottom-0 left-0 w-full bg-white border-t border-slate-200 py-3 px-6 flex justify-around md:hidden z-50">
        <button className="flex flex-col items-center text-primary font-bold">
          <span className="material-symbols-outlined">dashboard</span>
          <span className="text-[10px]">Inicio</span>
        </button>
        <button className="flex flex-col items-center text-slate-400">
          <span className="material-symbols-outlined">school</span>
          <span className="text-[10px]">Cursos</span>
        </button>
        <button onClick={() => navigate('/student/achievements')} className="flex flex-col items-center text-slate-400">
          <span className="material-symbols-outlined">emoji_events</span>
          <span className="text-[10px]">Logros</span>
        </button>
        <button onClick={signOut} className="flex flex-col items-center text-slate-400">
          <span className="material-symbols-outlined">logout</span>
          <span className="text-[10px]">Salir</span>
        </button>
      </nav>

      <main className="flex-1 p-6 md:p-12 max-w-7xl mx-auto w-full space-y-8 pb-24 md:pb-12">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">¡Hola, {displayName}! 👋</h1>
            <p className="text-slate-500 font-medium">¿Listo para expandir tus rutas neuronales hoy?</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="bg-amber-50 px-4 py-2 rounded-2xl flex items-center gap-2 border border-amber-100">
              <span className="text-amber-500 material-symbols-outlined fill-1">local_fire_department</span>
              <span className="text-amber-700 font-black text-xl">{streakDays} Días</span>
            </div>
            <div className="bg-violet-50 px-4 py-2 rounded-2xl flex items-center gap-2 border border-violet-100">
              <span className="text-violet-500 material-symbols-outlined">military_tech</span>
              <span className="text-violet-700 font-black text-xl">Lvl {level}</span>
            </div>
          </div>
        </header>

        <div className="grid lg:grid-cols-12 gap-8">
          {/* Main Action Area */}
          <div className="lg:col-span-8 space-y-8">
            {/* Session Suggestion */}
            {classes.length > 0 ? (
              <div className="relative overflow-hidden rounded-3xl bg-white border border-slate-100 shadow-xl group">
                <div className="absolute top-0 right-0 p-8 opacity-5">
                  <span className="material-symbols-outlined text-[120px]">psychology</span>
                </div>
                <div className="flex flex-col md:flex-row">
                  <div className="md:w-2/5 h-48 md:h-auto overflow-hidden">
                    <img src="https://picsum.photos/seed/bio/600/600" className="w-full h-full object-cover group-hover:scale-105 transition-transform" alt="Study" />
                  </div>
                  <div className="p-8 flex-1">
                    <span className="bg-blue-100 text-blue-600 text-xs font-bold px-3 py-1 rounded-full uppercase mb-4 inline-block">Recomendado</span>
                    <h2 className="text-2xl font-black text-slate-900 mb-2">Tu sesión de hoy</h2>
                    <p className="text-slate-500 mb-6 leading-relaxed">
                      Continúa estudiando <strong>{classes[0]?.name}</strong>. ¡Llevas {classes[0]?.progress || 0}% de progreso!
                    </p>
                    <button
                      onClick={() => navigate(`/student/study/${classes[0]?.id}`)}
                      className="w-full md:w-auto bg-primary text-white font-bold px-8 py-3 rounded-xl shadow-lg hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
                    >
                      Comenzar Ahora <span className="material-symbols-outlined text-sm">arrow_forward</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="relative overflow-hidden rounded-3xl bg-white border border-slate-100 shadow-xl p-12 text-center">
                <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto mb-6">
                  <span className="material-symbols-outlined text-4xl text-primary">school</span>
                </div>
                <h2 className="text-2xl font-black text-slate-900 mb-2">¡Bienvenido a NEUROPATH!</h2>
                <p className="text-slate-500 mb-6 max-w-md mx-auto">
                  Únete a tu primera clase con el código proporcionado por tu profesor para comenzar a estudiar.
                </p>
                <button
                  onClick={() => setShowJoinModal(true)}
                  className="bg-primary text-white font-bold px-8 py-3 rounded-xl shadow-lg hover:bg-blue-700 transition-all flex items-center justify-center gap-2 mx-auto"
                >
                  <span className="material-symbols-outlined">add</span> Unirse a una Clase
                </button>
              </div>
            )}

            {/* Upcoming Exams */}
            {upcomingExams.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                    <span className="w-1.5 h-6 bg-rose-500 rounded-full"></span> Próximos Exámenes
                  </h2>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  {upcomingExams.map((exam) => {
                    const daysLeft = getDaysRemaining(exam.date);
                    const isUrgent = daysLeft <= 3;
                    return (
                      <div key={exam.id} className={`p-6 rounded-2xl border ${isUrgent ? 'border-rose-200 bg-rose-50' : 'border-slate-100 bg-white'} shadow-sm`}>
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <h3 className="font-bold text-slate-900">{exam.name}</h3>
                            <p className="text-sm text-slate-500">{exam.class_name}</p>
                          </div>
                          <div className={`px-3 py-1 rounded-full text-xs font-bold ${isUrgent ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-600'}`}>
                            {daysLeft} días
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-500">Tu preparación</span>
                            <span className={`font-bold ${exam.preparation >= 70 ? 'text-emerald-600' : exam.preparation >= 50 ? 'text-amber-600' : 'text-rose-600'}`}>
                              {exam.preparation}%
                            </span>
                          </div>
                          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${exam.preparation >= 70 ? 'bg-emerald-500' : exam.preparation >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`}
                              style={{ width: `${exam.preparation}%` }}
                            ></div>
                          </div>
                        </div>
                        <button
                          onClick={() => navigate(`/student/study/${exam.id}?mode=cramming`)}
                          className={`mt-4 w-full py-2 rounded-xl font-bold text-sm transition-all ${isUrgent ? 'bg-rose-500 text-white hover:bg-rose-600' : 'bg-primary text-white hover:bg-blue-700'}`}
                        >
                          {isUrgent ? '🔥 Modo Cramming' : 'Estudiar Ahora'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Courses Grid */}
            <section>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <span className="w-1.5 h-6 bg-primary rounded-full"></span> Mis Cursos
                </h2>
                <button
                  onClick={() => setShowJoinModal(true)}
                  className="text-sm font-bold text-primary flex items-center gap-1 hover:underline"
                >
                  <span className="material-symbols-outlined text-lg">add</span> Unirse a Clase
                </button>
              </div>

              {loadingClasses ? (
                <div className="grid md:grid-cols-2 gap-6">
                  {[1, 2].map((i) => (
                    <div key={i} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm animate-pulse">
                      <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 rounded-xl bg-slate-200"></div>
                        <div className="flex-1">
                          <div className="h-5 bg-slate-200 rounded w-3/4 mb-2"></div>
                          <div className="h-3 bg-slate-100 rounded w-1/2"></div>
                        </div>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full"></div>
                    </div>
                  ))}
                </div>
              ) : classes.length > 0 ? (
                <div className="grid md:grid-cols-2 gap-6">
                  {classes.map((course, i) => {
                    const color = courseColors[i % courseColors.length];
                    const icon = courseIcons[i % courseIcons.length];
                    return (
                      <div
                        key={course.id}
                        onClick={() => navigate(`/student/study/${course.id}`)}
                        className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                      >
                        <div className="flex items-center gap-4 mb-4">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color === 'blue' ? 'text-blue-600 bg-blue-50' :
                              color === 'violet' ? 'text-violet-600 bg-violet-50' :
                                color === 'emerald' ? 'text-emerald-600 bg-emerald-50' :
                                  color === 'amber' ? 'text-amber-600 bg-amber-50' :
                                    'text-rose-600 bg-rose-50'
                            }`}>
                            <span className="material-symbols-outlined text-2xl">{icon}</span>
                          </div>
                          <div>
                            <h3 className="font-bold text-lg">{course.name}</h3>
                            <p className="text-xs text-slate-500">Código: {course.code}</p>
                          </div>
                        </div>
                        <div className="flex justify-between items-center text-xs font-bold text-slate-400 mb-2">
                          <span>Progreso</span>
                          <span className="text-primary">{course.progress}%</span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className={`bg-primary h-full rounded-full transition-all`} style={{ width: `${course.progress}%` }}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="bg-white p-8 rounded-2xl border border-slate-100 text-center">
                  <span className="material-symbols-outlined text-4xl text-slate-300 mb-4">folder_open</span>
                  <p className="text-slate-500">No estás inscrito en ninguna clase aún</p>
                </div>
              )}
            </section>
          </div>

          {/* Gamification Sidebar */}
          <div className="lg:col-span-4 space-y-6">
            {/* XP Widget */}
            <div className="bg-gradient-to-br from-violet-600 to-primary p-6 rounded-3xl text-white shadow-xl relative overflow-hidden">
              <div className="relative z-10 flex flex-col items-center text-center">
                <div className="w-20 h-20 rounded-full border-4 border-white/20 flex items-center justify-center bg-white/10 backdrop-blur-sm mb-4">
                  <span className="material-symbols-outlined text-4xl fill-1">rocket_launch</span>
                </div>
                <h3 className="font-bold text-xl mb-1">Nivel {level}</h3>
                <p className="text-blue-100 text-sm mb-6">Faltan {xpRemaining} XP para el nivel {level + 1}</p>
                <div className="w-full bg-white/20 rounded-full h-2 mb-2">
                  <div className="bg-white h-full rounded-full transition-all" style={{ width: `${xpProgress}%` }}></div>
                </div>
                <div className="flex justify-between w-full text-[10px] font-bold uppercase tracking-wider text-blue-100">
                  <span>{xp.toLocaleString()} XP</span>
                  <span>{xpForNextLevel.toLocaleString()} XP</span>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
              <h3 className="font-bold text-slate-900 mb-4">Acciones Rápidas</h3>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => classes.length > 0 && navigate(`/student/study/${classes[0]?.id}?mode=flashcards`)}
                  disabled={classes.length === 0}
                  className="p-4 rounded-xl bg-blue-50 text-blue-600 flex flex-col items-center gap-2 hover:bg-blue-100 transition-colors disabled:opacity-50"
                >
                  <span className="material-symbols-outlined">style</span>
                  <span className="text-xs font-bold">Flashcards</span>
                </button>
                <button
                  onClick={() => classes.length > 0 && navigate(`/student/study/${classes[0]?.id}?mode=quiz`)}
                  disabled={classes.length === 0}
                  className="p-4 rounded-xl bg-violet-50 text-violet-600 flex flex-col items-center gap-2 hover:bg-violet-100 transition-colors disabled:opacity-50"
                >
                  <span className="material-symbols-outlined">quiz</span>
                  <span className="text-xs font-bold">Quiz</span>
                </button>
                <button
                  onClick={() => classes.length > 0 && navigate(`/student/study/${classes[0]?.id}?mode=exam`)}
                  disabled={classes.length === 0}
                  className="p-4 rounded-xl bg-amber-50 text-amber-600 flex flex-col items-center gap-2 hover:bg-amber-100 transition-colors disabled:opacity-50"
                >
                  <span className="material-symbols-outlined">assignment</span>
                  <span className="text-xs font-bold">Examen</span>
                </button>
                <button
                  onClick={() => navigate('/student/achievements')}
                  className="p-4 rounded-xl bg-emerald-50 text-emerald-600 flex flex-col items-center gap-2 hover:bg-emerald-100 transition-colors"
                >
                  <span className="material-symbols-outlined">emoji_events</span>
                  <span className="text-xs font-bold">Logros ({badges})</span>
                </button>
              </div>
            </div>

            {/* Daily Goals */}
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
              <h3 className="font-bold text-slate-900 mb-4">Metas Diarias</h3>
              <div className="space-y-4">
                {[
                  { label: 'Completa 1 sesión de estudio', done: false },
                  { label: 'Mantén tu racha activa', done: streakDays > 0 },
                  { label: 'Repasa 15 flashcards', done: false },
                  { label: `Únete a ${classes.length > 0 ? 'otra' : 'una'} clase`, done: classes.length > 0 }
                ].map((goal, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${goal.done ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-200 text-transparent'
                      }`}>
                      <span className="material-symbols-outlined text-xs">check</span>
                    </div>
                    <span className={`text-sm font-medium ${goal.done ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                      {goal.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Join Class Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-fade-in">
            {!joinSuccess ? (
              <>
                <div className="p-8 text-center">
                  <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <span className="material-symbols-outlined text-3xl text-primary">group_add</span>
                  </div>
                  <h2 className="text-2xl font-black text-slate-900 mb-2">Unirse a una Clase</h2>
                  <p className="text-slate-500 mb-8">Ingresa el código de 6 dígitos proporcionado por tu profesor</p>

                  <div className="flex justify-center gap-2 mb-4">
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <input
                        key={i}
                        type="text"
                        maxLength={1}
                        value={joinCode[i] || ''}
                        onChange={(e) => {
                          const newCode = joinCode.split('');
                          newCode[i] = e.target.value.toUpperCase();
                          setJoinCode(newCode.join(''));
                          setJoinError('');
                          if (e.target.value && e.target.nextElementSibling) {
                            (e.target.nextElementSibling as HTMLInputElement).focus();
                          }
                        }}
                        className="w-12 h-14 text-center text-2xl font-bold border-2 border-slate-200 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                      />
                    ))}
                  </div>

                  {joinError && (
                    <div className="mb-4 text-rose-600 text-sm flex items-center justify-center gap-1">
                      <span className="material-symbols-outlined text-sm">error</span>
                      {joinError}
                    </div>
                  )}

                  <button
                    onClick={handleJoinClass}
                    disabled={joinCode.length !== 6 || joiningClass}
                    className="w-full bg-primary text-white font-bold py-4 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
                  >
                    {joiningClass ? (
                      <>
                        <span className="animate-spin material-symbols-outlined">progress_activity</span>
                        Verificando...
                      </>
                    ) : (
                      'Unirme a la Clase'
                    )}
                  </button>
                </div>
                <div className="bg-slate-50 p-4 flex justify-center">
                  <button onClick={() => { setShowJoinModal(false); setJoinError(''); setJoinCode(''); }} className="text-slate-500 font-medium hover:text-slate-700">
                    Cancelar
                  </button>
                </div>
              </>
            ) : (
              <div className="p-12 text-center">
                <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce">
                  <span className="material-symbols-outlined text-4xl text-emerald-600">check_circle</span>
                </div>
                <h2 className="text-2xl font-black text-slate-900 mb-2">¡Bienvenido!</h2>
                <p className="text-slate-500">Te has unido exitosamente a la clase</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentDashboard;
