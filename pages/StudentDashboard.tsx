
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getStudentClasses, joinClass, getStudentAchievements, getStudentStudySets, createStudySet, supabase, deleteStudySet } from '../services/supabaseClient';
import { generateFlashcardsFromText, extractTextFromPDF } from '../services/pdfProcessingService';

import StudySetManager from '../components/StudySetManager';
import MagicImportModal from '../components/MagicImportModal';

interface ClassData {
  id: string;
  name: string;
  code: string;
  description?: string;
  progress: number;
  teacher_name?: string;
  topics?: string[];
}

interface StudySet {
  id: string;
  name: string;
  description?: string;
  topics: string[];
  icon: string;
  color: string;
  flashcard_count?: number;
  created_at: string;
}

type ActiveTab = 'classes' | 'personal';

const StudentDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();

  // Tab state
  const [activeTab, setActiveTab] = useState<ActiveTab>('classes');

  // Join class modal
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinSuccess, setJoinSuccess] = useState(false);
  const [joinError, setJoinError] = useState('');
  const [joiningClass, setJoiningClass] = useState(false);

  // Magic Import Modal
  const [showMagicModal, setShowMagicModal] = useState(false);

  // Create study set modal
  const [showCreateSetModal, setShowCreateSetModal] = useState(false);
  const [newSetName, setNewSetName] = useState('');
  const [newSetDescription, setNewSetDescription] = useState('');
  const [newSetTopics, setNewSetTopics] = useState('');
  const [creatingSet, setCreatingSet] = useState(false);
  const [createStep, setCreateStep] = useState(1); // 1: basic info, 2: upload content, 3: done
  const [editingStudySet, setEditingStudySet] = useState<StudySet | null>(null);

  // PDF upload for study set
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [pdfProgress, setPdfProgress] = useState(0);
  const [createdSetId, setCreatedSetId] = useState<string | null>(null);

  // Data
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [studySets, setStudySets] = useState<StudySet[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingSets, setLoadingSets] = useState(true);
  const [badges, setBadges] = useState<number>(0);

  // Load student's classes
  useEffect(() => {
    const loadClasses = async () => {
      if (!user) return;
      try {
        setLoadingClasses(true);
        const enrollments = await getStudentClasses(user.id);
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

        const achievements = await getStudentAchievements(user.id);
        setBadges(achievements?.length || 0);
      } catch (error) {
        console.error('Error loading classes:', error);
      } finally {
        setLoadingClasses(false);
      }
    };
    loadClasses();
  }, [user]);

  const loadStudySets = async () => {
    if (!user) return;
    try {
      setLoadingSets(true);
      const sets = await getStudentStudySets(user.id);

      // Get flashcard counts for each set
      const setsWithCounts = await Promise.all((sets || []).map(async (set: any) => {
        const { count } = await supabase
          .from('flashcards')
          .select('*', { count: 'exact', head: true })
          .eq('study_set_id', set.id);
        return {
          ...set,
          flashcard_count: count || 0
        };
      }));

      setStudySets(setsWithCounts);
    } catch (error) {
      console.error('Error loading study sets:', error);
    } finally {
      setLoadingSets(false);
    }
  };

  useEffect(() => {
    loadStudySets();
  }, [user]);

  // Join class handler
  const handleJoinClass = async () => {
    if (joinCode.length !== 6 || !user) return;
    setJoiningClass(true);
    setJoinError('');

    try {
      await joinClass(user.id, joinCode.toUpperCase());
      setJoinSuccess(true);
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

  // Create study set handler
  const handleCreateStudySet = async () => {
    if (!newSetName.trim() || !user) return;
    setCreatingSet(true);

    try {
      const topics = newSetTopics.split(',').map(t => t.trim()).filter(t => t);
      const newSet = await createStudySet(user.id, {
        name: newSetName,
        description: newSetDescription,
        topics,
        icon: 'menu_book',
        color: ['blue', 'violet', 'emerald', 'amber', 'rose'][Math.floor(Math.random() * 5)]
      });

      setCreatedSetId(newSet.id);
      setCreateStep(2);
    } catch (error) {
      console.error('Error creating study set:', error);
    } finally {
      setCreatingSet(false);
    }
  };

  // Handle PDF upload for study set
  const handleStudySetPdfUpload = async (files: FileList | null) => {
    if (!files || files.length === 0 || !createdSetId) return;
    const file = files[0];
    setUploadingPdf(true);
    setPdfProgress(20);

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = (e.target?.result as string)?.split(',')[1];
        if (!base64) return;

        setPdfProgress(40);
        const extractedText = await extractTextFromPDF(base64);
        setPdfProgress(60);

        if (extractedText) {
          const flashcards = await generateFlashcardsFromText(
            extractedText,
            newSetTopics || newSetName,
            15
          );
          setPdfProgress(80);

          if (flashcards) {
            for (const card of flashcards) {
              await supabase.from('flashcards').insert({
                study_set_id: createdSetId,
                question: card.question,
                answer: card.answer,
                category: card.category
              });
            }
          }
        }

        setPdfProgress(100);
        setCreateStep(3);

        // Refresh study sets
        const sets = await getStudentStudySets(user!.id);
        const setsWithCounts = await Promise.all((sets || []).map(async (set: any) => {
          const { count } = await supabase
            .from('flashcards')
            .select('*', { count: 'exact', head: true })
            .eq('study_set_id', set.id);
          return { ...set, flashcard_count: count || 0 };
        }));
        setStudySets(setsWithCounts);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error processing PDF:', error);
    } finally {
      setTimeout(() => {
        setUploadingPdf(false);
        setPdfProgress(0);
      }, 1000);
    }
  };

  const closeCreateModal = () => {
    setShowCreateSetModal(false);
    setCreateStep(1);
    setNewSetName('');
    setNewSetDescription('');
    setNewSetTopics('');
    setCreatedSetId(null);
  };

  // Display values
  const displayName = profile?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'Estudiante';
  const xp = profile?.xp || 0;
  const level = profile?.level || 1;
  const streakDays = profile?.streak_days || 0;
  const xpForNextLevel = level * 500;
  const xpProgress = Math.min((xp / xpForNextLevel) * 100, 100);
  const xpRemaining = xpForNextLevel - xp;

  const courseColors = ['blue', 'violet', 'emerald', 'amber', 'rose'];
  const courseIcons = ['neurology', 'smart_toy', 'science', 'calculate', 'history_edu'];

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col">
      {/* Mobile Bottom Nav */}
      <nav className="fixed bottom-0 left-0 w-full bg-white border-t border-slate-200 py-3 px-6 flex justify-around md:hidden z-50">
        <button className="flex flex-col items-center text-primary font-bold">
          <span className="material-symbols-outlined">dashboard</span>
          <span className="text-[10px]">Inicio</span>
        </button>
        <button onClick={() => setActiveTab(activeTab === 'classes' ? 'personal' : 'classes')} className="flex flex-col items-center text-slate-400">
          <span className="material-symbols-outlined">{activeTab === 'classes' ? 'auto_stories' : 'school'}</span>
          <span className="text-[10px]">{activeTab === 'classes' ? 'Personal' : 'Clases'}</span>
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
        {/* Header */}
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

        {/* Mode Toggle Tabs */}
        <div className="bg-white rounded-2xl border border-slate-100 p-1.5 inline-flex shadow-sm">
          <button
            onClick={() => setActiveTab('classes')}
            className={`px-6 py-3 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${activeTab === 'classes'
              ? 'bg-primary text-white shadow-md'
              : 'text-slate-500 hover:text-slate-700'
              }`}
          >
            <span className="material-symbols-outlined text-lg">school</span>
            Mis Clases
          </button>
          <button
            onClick={() => setActiveTab('personal')}
            className={`px-6 py-3 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${activeTab === 'personal'
              ? 'bg-primary text-white shadow-md'
              : 'text-slate-500 hover:text-slate-700'
              }`}
          >
            <span className="material-symbols-outlined text-lg">auto_stories</span>
            Estudio Personal
          </button>
        </div>

        <div className="grid lg:grid-cols-12 gap-8">
          {/* Main Content Area */}
          <div className="lg:col-span-8 space-y-8">

            {/* CLASSES TAB */}
            {activeTab === 'classes' && (
              <>
                {/* Today's Session */}
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
                      Únete a tu primera clase con el código de tu profesor, o crea tu propio set de estudio personal.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                      <button
                        onClick={() => setShowJoinModal(true)}
                        className="bg-primary text-white font-bold px-6 py-3 rounded-xl shadow-lg hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
                      >
                        <span className="material-symbols-outlined">add</span> Unirse a Clase
                      </button>
                      <button
                        onClick={() => { setActiveTab('personal'); setShowCreateSetModal(true); }}
                        className="bg-violet-600 text-white font-bold px-6 py-3 rounded-xl shadow-lg hover:bg-violet-700 transition-all flex items-center justify-center gap-2"
                      >
                        <span className="material-symbols-outlined">auto_stories</span> Crear Set Personal
                      </button>
                    </div>
                  </div>
                )}

                {/* Classes Grid */}
                <section>
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                      <span className="w-1.5 h-6 bg-primary rounded-full"></span> Mis Clases
                    </h2>
                    <button onClick={() => setShowJoinModal(true)} className="text-sm font-bold text-primary flex items-center gap-1 hover:underline">
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
                              <div className="bg-primary h-full rounded-full transition-all" style={{ width: `${course.progress}%` }}></div>
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
              </>
            )}

            {/* PERSONAL STUDY TAB */}
            {activeTab === 'personal' && (
              <>
                {/* Create Set CTA */}
                <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-violet-600 to-purple-600 p-8 text-white shadow-xl">
                  <div className="absolute top-0 right-0 p-8 opacity-10">
                    <span className="material-symbols-outlined text-[120px]">auto_stories</span>
                  </div>
                  <div className="relative z-10">
                    <h2 className="text-2xl font-black mb-2">📚 Estudio Personal</h2>
                    <p className="text-violet-100 mb-6 max-w-lg">
                      Crea tus propios sets de estudio. Sube un PDF y la IA generará flashcards automáticamente para ti.
                    </p>
                    <button
                      onClick={() => setShowCreateSetModal(true)}
                      className="bg-white text-violet-600 font-bold px-6 py-3 rounded-xl shadow-lg hover:bg-violet-50 transition-all flex items-center gap-2"
                    >
                      <span className="material-symbols-outlined">add</span> Crear Nuevo Set
                    </button>
                    <button
                      onClick={() => setShowMagicModal(true)}
                      className="mt-3 bg-white/20 backdrop-blur-md border border-white/40 text-white font-bold px-6 py-3 rounded-xl shadow-lg hover:bg-white/30 transition-all flex items-center gap-2 text-sm"
                    >
                      <span className="material-symbols-outlined">auto_awesome</span> Importar Mágico (IA)
                    </button>
                  </div>
                </div>

                {/* Study Sets Grid */}
                <section>
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                      <span className="w-1.5 h-6 bg-violet-500 rounded-full"></span> Mis Sets de Estudio
                    </h2>
                  </div>

                  {loadingSets ? (
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
                        </div>
                      ))}
                    </div>
                  ) : studySets.length > 0 ? (
                    <div className="grid md:grid-cols-2 gap-6">
                      {studySets.map((set) => (
                        <div
                          key={set.id}
                          onClick={() => navigate(`/student/study-set/${set.id}`)}
                          className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
                        >
                          <div className="flex items-center gap-4 mb-4">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${set.color === 'blue' ? 'text-blue-600 bg-blue-50' :
                              set.color === 'violet' ? 'text-violet-600 bg-violet-50' :
                                set.color === 'emerald' ? 'text-emerald-600 bg-emerald-50' :
                                  set.color === 'amber' ? 'text-amber-600 bg-amber-50' :
                                    'text-rose-600 bg-rose-50'
                              }`}>
                              <span className="material-symbols-outlined text-2xl">{set.icon}</span>
                            </div>
                            <div className="flex-1">
                              <h3 className="font-bold text-lg group-hover:text-primary transition-colors">{set.name}</h3>
                              <p className="text-xs text-slate-500">{set.flashcard_count || 0} flashcards</p>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingStudySet(set);
                              }}
                              className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors mr-2"
                              title="Editar"
                            >
                              <span className="material-symbols-outlined text-lg">edit</span>
                            </button>
                            <span className="material-symbols-outlined text-slate-300 group-hover:text-primary transition-colors">arrow_forward</span>
                          </div>
                          {set.topics && set.topics.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {set.topics.slice(0, 3).map((topic, i) => (
                                <span key={i} className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full">{topic}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-white p-12 rounded-2xl border border-slate-100 text-center">
                      <div className="w-16 h-16 bg-violet-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <span className="material-symbols-outlined text-3xl text-violet-600">library_books</span>
                      </div>
                      <h3 className="font-bold text-lg text-slate-900 mb-2">No tienes sets de estudio aún</h3>
                      <p className="text-slate-500 mb-6">Crea tu primer set y comienza a estudiar por tu cuenta</p>
                      <button
                        onClick={() => setShowCreateSetModal(true)}
                        className="bg-violet-600 text-white font-bold px-6 py-2 rounded-xl hover:bg-violet-700"
                      >
                        Crear Primer Set
                      </button>
                    </div>
                  )}
                </section>
              </>
            )}
          </div>

          {/* Sidebar */}
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
                  onClick={() => (classes.length > 0 || studySets.length > 0) && navigate(
                    classes.length > 0 ? `/student/study/${classes[0]?.id}?mode=flashcards` : `/student/study-set/${studySets[0]?.id}`
                  )}
                  disabled={classes.length === 0 && studySets.length === 0}
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
                  onClick={() => setShowCreateSetModal(true)}
                  className="p-4 rounded-xl bg-amber-50 text-amber-600 flex flex-col items-center gap-2 hover:bg-amber-100 transition-colors"
                >
                  <span className="material-symbols-outlined">add_circle</span>
                  <span className="text-xs font-bold">Nuevo Set</span>
                </button>
                <button
                  onClick={() => navigate('/student/achievements')}
                  className="p-4 rounded-xl bg-emerald-50 text-emerald-600 flex flex-col items-center gap-2 hover:bg-emerald-100 transition-colors"
                >
                  <span className="material-symbols-outlined">emoji_events</span>
                  <span className="text-xs font-bold">Logros ({badges})</span>
                </button>

                <button
                  onClick={() => setShowMagicModal(true)}
                  className="p-4 rounded-xl bg-indigo-50 text-indigo-600 flex flex-col items-center gap-2 hover:bg-indigo-100 transition-colors"
                >
                  <span className="material-symbols-outlined">auto_awesome</span>
                  <span className="text-xs font-bold">Magic Import</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Join Class Modal */}
      {
        showJoinModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden">
              <div className="p-8">
                {joinSuccess ? (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <span className="material-symbols-outlined text-3xl text-emerald-600">check_circle</span>
                    </div>
                    <h3 className="text-xl font-bold text-slate-900">¡Te has unido exitosamente!</h3>
                  </div>
                ) : (
                  <>
                    <h2 className="text-2xl font-black text-slate-900 mb-2">Unirse a una Clase</h2>
                    <p className="text-slate-500 mb-6">Ingresa el código de 6 dígitos proporcionado por tu profesor</p>
                    <input
                      type="text"
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 6))}
                      placeholder="CÓDIGO"
                      className="w-full text-center text-3xl font-mono font-bold tracking-[0.5em] py-4 border-2 border-slate-200 rounded-2xl focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none uppercase"
                      maxLength={6}
                    />
                    {joinError && (
                      <p className="text-rose-500 text-sm mt-3 text-center">{joinError}</p>
                    )}
                    <button
                      onClick={handleJoinClass}
                      disabled={joinCode.length !== 6 || joiningClass}
                      className="w-full mt-6 bg-primary text-white font-bold py-4 rounded-2xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {joiningClass ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Uniéndose...
                        </>
                      ) : (
                        'Unirse a la Clase'
                      )}
                    </button>
                  </>
                )}
              </div>
              {!joinSuccess && (
                <div className="bg-slate-50 p-4 flex justify-end">
                  <button onClick={() => { setShowJoinModal(false); setJoinCode(''); setJoinError(''); }} className="text-slate-600 font-medium hover:text-slate-800">
                    Cancelar
                  </button>
                </div>
              )}
            </div>
          </div>
        )
      }

      {/* Create Study Set Modal */}
      {
        showCreateSetModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden">
              <div className="p-8">
                {/* Step indicator */}
                <div className="flex items-center gap-2 mb-6">
                  {[1, 2, 3].map((step) => (
                    <div key={step} className={`flex-1 h-1 rounded-full ${createStep >= step ? 'bg-violet-500' : 'bg-slate-200'}`}></div>
                  ))}
                </div>

                {createStep === 1 && (
                  <>
                    <h2 className="text-2xl font-black text-slate-900 mb-2">Crear Set de Estudio</h2>
                    <p className="text-slate-500 mb-6">Dale un nombre y describe lo que vas a estudiar</p>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Nombre del Set *</label>
                        <input
                          type="text"
                          value={newSetName}
                          onChange={(e) => setNewSetName(e.target.value)}
                          placeholder="Ej: Anatomía - Sistema Nervioso"
                          className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-200 focus:border-violet-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Descripción</label>
                        <textarea
                          value={newSetDescription}
                          onChange={(e) => setNewSetDescription(e.target.value)}
                          placeholder="¿De qué trata este set de estudio?"
                          className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-200 focus:border-violet-500 outline-none resize-none h-20"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Temas (separados por comas)</label>
                        <input
                          type="text"
                          value={newSetTopics}
                          onChange={(e) => setNewSetTopics(e.target.value)}
                          placeholder="Ej: Neurociencia, Cerebro, Sinapsis"
                          className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-200 focus:border-violet-500 outline-none"
                        />
                      </div>
                    </div>

                    <button
                      onClick={handleCreateStudySet}
                      disabled={!newSetName.trim() || creatingSet}
                      className="w-full mt-6 bg-violet-600 text-white font-bold py-4 rounded-2xl hover:bg-violet-700 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {creatingSet ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Creando...
                        </>
                      ) : (
                        <>
                          Continuar <span className="material-symbols-outlined">arrow_forward</span>
                        </>
                      )}
                    </button>
                  </>
                )}

                {createStep === 2 && (
                  <>
                    <h2 className="text-2xl font-black text-slate-900 mb-2">Agregar Contenido</h2>
                    <p className="text-slate-500 mb-6">Sube un PDF para generar flashcards automáticamente con IA</p>

                    {!uploadingPdf ? (
                      <>
                        <label className="block border-2 border-dashed border-violet-200 rounded-2xl p-12 text-center cursor-pointer hover:border-violet-400 hover:bg-violet-50 transition-all">
                          <span className="material-symbols-outlined text-4xl text-violet-400 mb-4">cloud_upload</span>
                          <p className="font-bold text-slate-700">Arrastra un PDF o haz clic</p>
                          <p className="text-sm text-slate-500 mt-2">La IA generará flashcards automáticamente</p>
                          <input
                            type="file"
                            className="hidden"
                            accept=".pdf"
                            onChange={(e) => handleStudySetPdfUpload(e.target.files)}
                          />
                        </label>

                        <div className="text-center mt-6">
                          <button
                            onClick={() => setCreateStep(3)}
                            className="text-violet-600 font-medium hover:underline"
                          >
                            Omitir y crear set vacío
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-8">
                        <div className="w-16 h-16 mx-auto mb-4">
                          <div className="w-full h-full border-4 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                        <p className="font-bold text-slate-900 mb-2">🤖 IA procesando PDF...</p>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mb-2">
                          <div className="bg-violet-500 h-full rounded-full transition-all" style={{ width: `${pdfProgress}%` }}></div>
                        </div>
                        <p className="text-sm text-slate-500">Generando flashcards automáticamente</p>
                      </div>
                    )}
                  </>
                )}

                {createStep === 3 && (
                  <div className="text-center py-8">
                    <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <span className="material-symbols-outlined text-4xl text-emerald-600">check_circle</span>
                    </div>
                    <h3 className="text-2xl font-bold text-slate-900 mb-2">¡Set Creado!</h3>
                    <p className="text-slate-500 mb-6">Tu set de estudio "{newSetName}" está listo</p>
                    <button
                      onClick={() => {
                        closeCreateModal();
                        if (createdSetId) navigate(`/student/study-set/${createdSetId}`);
                      }}
                      className="bg-violet-600 text-white font-bold px-8 py-3 rounded-xl hover:bg-violet-700"
                    >
                      Comenzar a Estudiar
                    </button>
                  </div>
                )}
              </div>

              {createStep < 3 && (
                <div className="bg-slate-50 p-4 flex justify-between">
                  <button onClick={() => createStep > 1 ? setCreateStep(createStep - 1) : closeCreateModal()} className="text-slate-600 font-medium hover:text-slate-800">
                    {createStep > 1 ? 'Atrás' : 'Cancelar'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )
      }

      {
        editingStudySet && (
          <StudySetManager
            studySet={editingStudySet}
            onClose={() => setEditingStudySet(null)}
            onUpdate={() => {
              loadStudySets();
              setEditingStudySet(null);
            }}
          />
        )
      }

      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-lg z-50 pb-safe">
        <div className="max-w-lg mx-auto px-4">
          <div className="flex justify-around items-center py-2">
            <button
              onClick={() => setActiveTab('classes')}
              className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-colors ${activeTab === 'classes' ? 'text-primary bg-primary/10' : 'text-slate-500 hover:text-primary'}`}
            >
              <span className="material-symbols-outlined text-2xl">home</span>
              <span className="text-xs font-medium">Inicio</span>
            </button>
            <button
              onClick={() => setActiveTab('personal')}
              className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-colors ${activeTab === 'personal' ? 'text-primary bg-primary/10' : 'text-slate-500 hover:text-primary'}`}
            >
              <span className="material-symbols-outlined text-2xl">auto_stories</span>
              <span className="text-xs font-medium">Mis Sets</span>
            </button>
            <button
              onClick={() => navigate('/student/achievements')}
              className="flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-colors text-slate-500 hover:text-primary"
            >
              <span className="material-symbols-outlined text-2xl">emoji_events</span>
              <span className="text-xs font-medium">Logros</span>
            </button>
            <button
              onClick={() => signOut()}
              className="flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-colors text-slate-500 hover:text-rose-500"
            >
              <span className="material-symbols-outlined text-2xl">logout</span>
              <span className="text-xs font-medium">Salir</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Bottom padding to account for navbar */}
      <div className="h-20"></div>
      {/* Magic Import Modal */}
      {
        showMagicModal && (
          <MagicImportModal
            onClose={() => setShowMagicModal(false)}
            onSuccess={(newSet) => {
              setShowMagicModal(false);
              loadStudySets(); // Refresh list
              // Optionally navigate to the new set
              // navigate(`/student/study-set/${newSet.id}`);
            }}
          />
        )
      }
    </div >
  );
};

export default StudentDashboard;
