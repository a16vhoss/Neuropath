
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserRole } from '../types';

interface LandingProps {
  onLogin: (role: UserRole) => void;
}

const Landing: React.FC<LandingProps> = ({ onLogin }) => {
  const navigate = useNavigate();
  const [activeFeatureTab, setActiveFeatureTab] = useState<'profesores' | 'ia' | 'estudiantes'>('estudiantes');
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const handleDemo = (role: UserRole) => {
    // onLogin(role); // Disabled demo login
    navigate('/auth');
  };

  return (
    <div className="min-h-screen">
      {/* ... existing code ... */}
      {/* Navigation */}
      <nav className="fixed w-full z-50 glass border-b border-gray-200 py-4">
        <div className="max-w-7xl mx-auto px-6 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-3xl font-bold">neurology</span>
            <span className="font-extrabold text-2xl tracking-tighter text-slate-900">MHS</span>
          </div>
          <div className="hidden md:flex items-center gap-8 font-medium text-slate-600">
            <a href="#features" className="hover:text-primary transition-colors">Producto</a>
            <a href="#pricing" className="hover:text-primary transition-colors">Precios</a>
            <a href="#institutions" className="hover:text-primary transition-colors">Instituciones</a>
            <a href="#faq" className="hover:text-primary transition-colors">FAQ</a>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/auth')}
              className="px-6 py-2.5 rounded-lg font-semibold hover:bg-slate-100 transition-all text-slate-600"
            >
              Iniciar Sesión
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 gradient-hero text-white relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 flex flex-col lg:flex-row items-center gap-12 relative z-10">
          <div className="lg:w-3/5 text-center lg:text-left">
            <div className="inline-block bg-white/20 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest mb-6">
              NUEVO: RUTAS GAMIFICADAS V2.0
            </div>
            <h1 className="text-5xl lg:text-7xl font-black leading-tight mb-6">
              Estudia Inteligente, <br />
              <span className="text-blue-200">No Más Duro.</span>
            </h1>
            <p className="text-lg lg:text-xl text-blue-50 mb-10 max-w-2xl font-medium">
              La inteligencia artificial que transforma tus PDFs, videos y notas en rutas personalizadas de aprendizaje activo.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <button
                onClick={() => navigate('/auth')}
                className="bg-white text-blue-600 text-lg font-bold px-10 py-4 rounded-xl shadow-2xl hover:scale-105 hover:bg-blue-50 transition-all"
              >
                Crear Cuenta
              </button>
            </div>
            <div className="mt-8 flex items-center justify-center lg:justify-start gap-4">
              <div className="flex -space-x-2">
                {[1, 2, 3, 4].map(i => (
                  <img key={i} src={`https://picsum.photos/seed/${i}/40`} className="w-10 h-10 rounded-full border-2 border-primary shadow-lg" alt="User" />
                ))}
              </div>
              <p className="text-sm font-semibold text-blue-100">Únete a +10,000 estudiantes</p>
            </div>
          </div>
          <div className="lg:w-2/5 animate-fade-in hidden lg:block">
            <div className="bg-slate-900/40 p-2 rounded-2xl backdrop-blur-md border border-white/20 shadow-2xl rotate-3">
              <img src="https://picsum.photos/seed/neuropath-ui/600/800" className="rounded-xl shadow-inner w-full h-[500px] object-cover" alt="MHS UI" />
            </div>
          </div>
        </div>
        {/* Background blobs */}
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-white/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl"></div>
      </section>

      {/* Problem/Solution Section */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-primary font-bold uppercase tracking-widest text-sm mb-2">El Problema</p>
            <h2 className="text-4xl font-black text-slate-900">La educación tradicional ya no funciona</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8 mb-16">
            {[
              { icon: 'schedule', title: 'Tiempo Perdido', desc: 'Los profesores pasan horas creando materiales de estudio que no se adaptan a cada estudiante.', color: 'rose' },
              { icon: 'psychology_alt', title: 'Estudio a Ciegas', desc: 'Los estudiantes no saben qué estudiar ni cuánto les falta para dominar un tema.', color: 'amber' },
              { icon: 'trending_down', title: 'Resultados Pobres', desc: 'Sin retroalimentación personalizada, muchos alumnos reprueban o abandonan.', color: 'rose' }
            ].map((problem, i) => (
              <div key={i} className={`p-8 rounded-2xl border-2 border-${problem.color}-100 bg-${problem.color}-50/50`}>
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center bg-${problem.color}-100 text-${problem.color}-600 mb-6`}>
                  <span className="material-symbols-outlined text-2xl">{problem.icon}</span>
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">{problem.title}</h3>
                <p className="text-slate-600 leading-relaxed">{problem.desc}</p>
              </div>
            ))}
          </div>

          {/* Solution Arrow */}
          <div className="flex justify-center mb-16">
            <div className="flex flex-col items-center">
              <span className="material-symbols-outlined text-4xl text-primary animate-bounce">arrow_downward</span>
              <span className="text-primary font-bold uppercase tracking-widest text-sm mt-2">La Solución</span>
            </div>
          </div>

          {/* Solution Card */}
          <div className="bg-gradient-to-br from-primary to-secondary p-8 md:p-12 rounded-3xl text-white text-center max-w-4xl mx-auto shadow-2xl">
            <div className="w-20 h-20 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <span className="material-symbols-outlined text-4xl">auto_awesome</span>
            </div>
            <h3 className="text-3xl font-black mb-4">MHS: IA que Transforma la Educación</h3>
            <p className="text-blue-100 text-lg max-w-2xl mx-auto">
              Sube tu material una vez. La IA crea rutas de estudio personalizadas automáticamente.
              Los profesores ven el progreso en tiempo real. Los estudiantes aprenden 3x más rápido.
            </p>
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-primary font-bold uppercase tracking-widest text-sm mb-2">Proceso</p>
            <h2 className="text-4xl font-black text-slate-900">Tu camino al éxito en 3 pasos</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-12">
            {[
              { icon: 'cloud_upload', title: '1. Sube Materiales', desc: 'Sube tus PDFs, notas o links de videos. Nuestra IA los procesa en segundos.', color: 'blue' },
              { icon: 'auto_awesome', title: '2. IA Genera', desc: 'Creamos resúmenes, flashcards y exámenes de práctica adaptados a ti.', color: 'violet' },
              { icon: 'school', title: '3. Domina el Tema', desc: 'Sigue tu ruta personalizada y observa cómo tus notas mejoran un 15% en promedio.', color: 'emerald' }
            ].map((step, i) => (
              <div key={i} className="text-center p-8 rounded-2xl bg-white shadow-lg hover:shadow-xl transition-shadow group">
                <div className={`w-16 h-16 mx-auto mb-6 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform ${step.color === 'blue' ? 'bg-blue-100 text-blue-600' : step.color === 'violet' ? 'bg-violet-100 text-violet-600' : 'bg-emerald-100 text-emerald-600'
                  }`}>
                  <span className="material-symbols-outlined text-3xl font-bold">{step.icon}</span>
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-4">{step.title}</h3>
                <p className="text-slate-600 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Demo Interactivo */}
      <section id="demo" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <p className="text-primary font-bold uppercase tracking-widest text-sm mb-2">Demo</p>
            <h2 className="text-4xl font-black text-slate-900">Mira MHS en acción</h2>
            <p className="text-slate-500 mt-4 max-w-2xl mx-auto">Descubre cómo la IA transforma materiales en rutas de aprendizaje personalizadas.</p>
          </div>

          <div className="max-w-4xl mx-auto">
            {/* Video Container */}
            <div className="relative aspect-video bg-gradient-to-br from-slate-900 to-primary rounded-3xl overflow-hidden shadow-2xl group cursor-pointer">
              <img
                src="https://picsum.photos/seed/demo-video/1200/675"
                className="w-full h-full object-cover opacity-60 group-hover:opacity-40 transition-opacity"
                alt="Demo Video Thumbnail"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined text-primary text-5xl ml-1">play_arrow</span>
                </div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-slate-900/80 to-transparent">
                <p className="text-white font-bold text-lg">Ver Tour Completo (3 min)</p>
                <p className="text-slate-300 text-sm">Mira cómo un profesor sube material y los estudiantes lo estudian</p>
              </div>
            </div>

            {/* Quick Demo Cards */}
            <div className="grid md:grid-cols-3 gap-6 mt-8">
              {[
                { icon: 'person', label: 'Demo Profesor', desc: 'Sube material y ve analíticas', action: () => handleDemo(UserRole.TEACHER) },
                { icon: 'school', label: 'Demo Estudiante', desc: 'Prueba flashcards y quizzes', action: () => handleDemo(UserRole.STUDENT) },
                { icon: 'smart_toy', label: 'Tutor IA', desc: 'Pregunta y aprende', action: () => handleDemo(UserRole.STUDENT) }
              ].map((demo, i) => (
                <button
                  key={i}
                  onClick={demo.action}
                  className="p-6 bg-slate-50 rounded-2xl text-left hover:bg-primary/5 hover:border-primary border-2 border-transparent transition-all group"
                >
                  <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4 group-hover:bg-primary group-hover:text-white transition-colors">
                    <span className="material-symbols-outlined text-primary group-hover:text-white">{demo.icon}</span>
                  </div>
                  <h4 className="font-bold text-slate-900 mb-1">{demo.label}</h4>
                  <p className="text-sm text-slate-500">{demo.desc}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features Tabs */}
      <section id="features" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <p className="text-primary font-bold uppercase tracking-widest text-sm mb-2">Funcionalidades</p>
            <h2 className="text-4xl font-black text-slate-900">Todo lo que necesitas para aprender mejor</h2>
          </div>

          {/* Tab Buttons */}
          <div className="flex justify-center mb-12">
            <div className="inline-flex bg-slate-100 p-1.5 rounded-xl">
              {[
                { id: 'profesores', label: 'Para Profesores', icon: 'person' },
                { id: 'ia', label: 'Inteligencia Artificial', icon: 'smart_toy' },
                { id: 'estudiantes', label: 'Para Estudiantes', icon: 'school' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveFeatureTab(tab.id as any)}
                  className={`flex items-center gap-2 px-6 py-3 rounded-lg font-bold transition-all ${activeFeatureTab === tab.id
                    ? 'bg-white text-primary shadow-md'
                    : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                  <span className="material-symbols-outlined text-lg">{tab.icon}</span>
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content */}
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              {activeFeatureTab === 'profesores' && (
                <>
                  {[
                    { icon: 'upload_file', title: 'Sube una vez, genera todo', desc: 'Convierte tus materiales en flashcards, quizzes y guías automáticamente.' },
                    { icon: 'analytics', title: 'Analítica en tiempo real', desc: 'Ve exactamente qué temas dominan y cuáles necesitan refuerzo.' },
                    { icon: 'warning', title: 'Alertas de riesgo', desc: 'Identifica alumnos en riesgo de reprobar antes del examen.' },
                    { icon: 'schedule', title: 'Ahorra 10+ horas/semana', desc: 'Deja que la IA haga el trabajo pesado mientras tú te enfocas en enseñar.' }
                  ].map((feature, i) => (
                    <div key={i} className="flex gap-4 p-4 rounded-xl hover:bg-slate-50 transition-colors">
                      <div className="w-12 h-12 bg-blue-100 text-primary rounded-xl flex items-center justify-center flex-shrink-0">
                        <span className="material-symbols-outlined">{feature.icon}</span>
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 mb-1">{feature.title}</h4>
                        <p className="text-slate-600 text-sm">{feature.desc}</p>
                      </div>
                    </div>
                  ))}
                </>
              )}
              {activeFeatureTab === 'ia' && (
                <>
                  {[
                    { icon: 'psychology', title: 'RAG Avanzado', desc: 'Tecnología de retrieval que genera contenido basado únicamente en tu material.' },
                    { icon: 'repeat', title: 'Repetición Espaciada', desc: 'Algoritmo SM-2 que optimiza el momento exacto para repasar cada concepto.' },
                    { icon: 'route', title: 'Rutas Adaptativas', desc: 'La IA ajusta la dificultad y el orden según tu desempeño en tiempo real.' },
                    { icon: 'chat', title: 'Tutor Socrático', desc: 'No te da la respuesta, te guía con preguntas para que la descubras.' }
                  ].map((feature, i) => (
                    <div key={i} className="flex gap-4 p-4 rounded-xl hover:bg-slate-50 transition-colors">
                      <div className="w-12 h-12 bg-violet-100 text-violet-600 rounded-xl flex items-center justify-center flex-shrink-0">
                        <span className="material-symbols-outlined">{feature.icon}</span>
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 mb-1">{feature.title}</h4>
                        <p className="text-slate-600 text-sm">{feature.desc}</p>
                      </div>
                    </div>
                  ))}
                </>
              )}
              {activeFeatureTab === 'estudiantes' && (
                <>
                  {[
                    { icon: 'style', title: 'Flashcards Inteligentes', desc: 'Generadas de tu material, con flip animado y retroalimentación instantánea.' },
                    { icon: 'quiz', title: 'Quizzes Adaptativos', desc: 'Preguntas que se ajustan a tu nivel, enfocándose en tus puntos débiles.' },
                    { icon: 'local_fire_department', title: 'Gamificación', desc: 'Rachas, XP, niveles y badges que mantienen tu motivación alta.' },
                    { icon: 'timer', title: 'Modo Cramming', desc: '7 días antes del examen, la IA intensifica el estudio donde más lo necesitas.' }
                  ].map((feature, i) => (
                    <div key={i} className="flex gap-4 p-4 rounded-xl hover:bg-slate-50 transition-colors">
                      <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center flex-shrink-0">
                        <span className="material-symbols-outlined">{feature.icon}</span>
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 mb-1">{feature.title}</h4>
                        <p className="text-slate-600 text-sm">{feature.desc}</p>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
            <div className="bg-slate-100 rounded-2xl p-4 h-[400px] flex items-center justify-center">
              <img
                src={`https://picsum.photos/seed/${activeFeatureTab}/500/400`}
                className="rounded-xl shadow-lg max-h-full object-cover"
                alt={`Feature ${activeFeatureTab}`}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Differentiators - Comparison Table */}
      <section className="py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <p className="text-primary font-bold uppercase tracking-widest text-sm mb-2">Comparación</p>
            <h2 className="text-4xl font-black text-slate-900">¿Por qué MHS?</h2>
            <p className="text-slate-500 mt-4 max-w-2xl mx-auto">La única plataforma que integra gestión para profesores, IA adaptativa y gamificación para estudiantes.</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full bg-white rounded-2xl shadow-xl overflow-hidden">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="p-6 text-left font-bold text-slate-900">Característica</th>
                  <th className="p-6 text-center">
                    <div className="flex flex-col items-center">
                      <span className="material-symbols-outlined text-primary text-2xl">neurology</span>
                      <span className="font-bold text-primary">MHS</span>
                    </div>
                  </th>
                  <th className="p-6 text-center text-slate-400 font-medium">Classroom</th>
                  <th className="p-6 text-center text-slate-400 font-medium">Duolingo</th>
                  <th className="p-6 text-center text-slate-400 font-medium">Quizlet</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {[
                  { feature: 'Generación automática IA', neuropath: true, classroom: false, duolingo: false, quizlet: false },
                  { feature: 'Dashboard para profesores', neuropath: true, classroom: true, duolingo: false, quizlet: false },
                  { feature: 'Rutas personalizadas', neuropath: true, classroom: false, duolingo: true, quizlet: false },
                  { feature: 'Gamificación completa', neuropath: true, classroom: false, duolingo: true, quizlet: false },
                  { feature: 'Análisis de riesgo predictivo', neuropath: true, classroom: false, duolingo: false, quizlet: false },
                  { feature: 'Tutor IA Socrático', neuropath: true, classroom: false, duolingo: false, quizlet: false },
                  { feature: 'Sube tu propio material', neuropath: true, classroom: true, duolingo: false, quizlet: true }
                ].map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="p-5 font-medium text-slate-700">{row.feature}</td>
                    <td className="p-5 text-center">
                      {row.neuropath ? (
                        <span className="inline-flex items-center justify-center w-8 h-8 bg-emerald-100 text-emerald-600 rounded-full">
                          <span className="material-symbols-outlined text-lg">check</span>
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="p-5 text-center">
                      {row.classroom ? <span className="text-emerald-500 material-symbols-outlined text-lg">check</span> : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="p-5 text-center">
                      {row.duolingo ? <span className="text-emerald-500 material-symbols-outlined text-lg">check</span> : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="p-5 text-center">
                      {row.quizlet ? <span className="text-emerald-500 material-symbols-outlined text-lg">check</span> : <span className="text-slate-300">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-primary font-bold uppercase tracking-widest text-sm mb-2">Testimonios</p>
            <h2 className="text-4xl font-black text-slate-900">Lo que dicen nuestros usuarios</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                name: 'Dra. María González',
                role: 'Profesora de Biología, Prepa UNAM',
                avatar: 'teacher1',
                quote: 'Antes pasaba horas creando materiales. Ahora subo mi PDF y MHS genera todo. Mis alumnos mejoraron 18% en promedio.',
                rating: 5
              },
              {
                name: 'Carlos Mendoza',
                role: 'Estudiante, 6to Semestre',
                avatar: 'student1',
                quote: 'Las rachas me mantienen motivado. El tutor IA me ayuda cuando no entiendo sin darme la respuesta directa. ¡Subí de 7 a 9!',
                rating: 5
              },
              {
                name: 'Lic. Roberto Sánchez',
                role: 'Director Académico, Colegio Moderno',
                avatar: 'director1',
                quote: 'Implementamos MHS en toda la escuela. Los índices de reprobación bajaron 25%. La inversión se pagó sola.',
                rating: 5
              }
            ].map((testimonial, i) => (
              <div key={i} className="bg-slate-50 p-8 rounded-2xl relative">
                <div className="absolute -top-4 left-8 text-6xl text-primary/20 font-serif">"</div>
                <div className="flex items-center gap-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, j) => (
                    <span key={j} className="material-symbols-outlined text-amber-400 text-lg fill-1">star</span>
                  ))}
                </div>
                <p className="text-slate-700 mb-6 leading-relaxed relative z-10">"{testimonial.quote}"</p>
                <div className="flex items-center gap-4">
                  <img src={`https://picsum.photos/seed/${testimonial.avatar}/60`} className="w-12 h-12 rounded-full" alt={testimonial.name} />
                  <div>
                    <p className="font-bold text-slate-900">{testimonial.name}</p>
                    <p className="text-sm text-slate-500">{testimonial.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-black text-slate-900">Planes para todos</h2>
            <p className="text-slate-500 mt-4">Comienza gratis y escala cuando estés listo.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { name: 'Gratis Estudiante', price: '$0', period: '', features: ['Materiales ilimitados', 'Rutas personalizadas', 'Flashcards IA', 'Gamificación básica'], cta: 'Comenzar Gratis', premium: false },
              { name: 'Premium Estudiante', price: '$99', period: 'MXN/mes', features: ['Todo lo anterior', 'Tutor Socrático IA', 'Análisis avanzado', 'Modo Cramming', 'Sin anuncios'], cta: 'Prueba 7 Días', premium: true },
              { name: 'Premium Profesor', price: '$299', period: 'MXN/mes', features: ['Dashboard completo', 'Analíticas de clase', 'Alertas de riesgo', 'Procesamiento prioritario', 'Soporte preferente'], cta: 'Empezar Ahora', premium: false },
              { name: 'Institucional', price: 'Personalizado', period: '', features: ['Todo lo anterior', 'Volumen ilimitado', 'Soporte dedicado 24/7', 'Integración LMS', 'Capacitación incluida'], cta: 'Contactar Ventas', premium: false }
            ].map((plan, i) => (
              <div key={i} className={`p-8 rounded-2xl border ${plan.premium ? 'border-primary ring-2 ring-primary/20 bg-white scale-105 z-10' : 'border-slate-200 bg-white'} shadow-xl`}>
                {plan.premium && (
                  <div className="bg-primary text-white text-xs font-bold px-3 py-1 rounded-full inline-block mb-4">
                    MÁS POPULAR
                  </div>
                )}
                <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
                <div className="mb-6">
                  <span className="text-4xl font-black">{plan.price}</span>
                  {plan.period && <span className="text-slate-500 text-sm">/{plan.period}</span>}
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((f, j) => (
                    <li key={j} className="flex items-center gap-2 text-slate-600 text-sm">
                      <span className="material-symbols-outlined text-emerald-500 text-sm">check_circle</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => navigate('/auth')}
                  className={`w-full py-3 rounded-xl font-bold transition-all ${plan.premium ? 'bg-primary text-white shadow-lg shadow-blue-200 hover:bg-blue-700' : 'bg-slate-100 text-slate-900 hover:bg-slate-200'
                    }`}>
                  {plan.cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Institutions Section */}
      <section id="institutions" className="py-24 bg-gradient-to-br from-slate-900 to-slate-800 text-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <p className="text-blue-400 font-bold uppercase tracking-widest text-sm mb-4">Para Instituciones</p>
              <h2 className="text-4xl font-black mb-6">Transforma tu escuela con IA adaptativa</h2>
              <p className="text-slate-300 text-lg mb-8">
                Resultados medibles, implementación simple y escalabilidad garantizada.
                Únete a las instituciones que ya están revolucionando la educación.
              </p>
              <div className="space-y-4 mb-8">
                {[
                  { icon: 'trending_up', text: '+15% mejora promedio en calificaciones' },
                  { icon: 'groups', text: 'Adopción sin capacitación extensiva' },
                  { icon: 'savings', text: 'ROI positivo en el primer semestre' }
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-blue-400">{item.icon}</span>
                    <span className="text-slate-200">{item.text}</span>
                  </div>
                ))}
              </div>
              <button className="bg-primary text-white font-bold px-8 py-4 rounded-xl shadow-lg hover:bg-blue-600 transition-all">
                Solicitar Demo Institucional
              </button>
            </div>
            <div className="bg-white/5 p-8 rounded-2xl border border-white/10 backdrop-blur">
              <h3 className="font-bold text-xl mb-6">Contáctanos</h3>
              <form className="space-y-4">
                <input
                  type="text"
                  placeholder="Nombre de la institución"
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <input
                  type="email"
                  placeholder="Email corporativo"
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <input
                  type="tel"
                  placeholder="Teléfono"
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <select className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary">
                  <option value="">Número de estudiantes</option>
                  <option value="100-500">100 - 500</option>
                  <option value="500-1000">500 - 1,000</option>
                  <option value="1000+">1,000+</option>
                </select>
                <button type="submit" className="w-full bg-primary text-white font-bold py-4 rounded-xl hover:bg-blue-600 transition-all">
                  Enviar Solicitud
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-24 bg-white">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-primary font-bold uppercase tracking-widest text-sm mb-2">FAQ</p>
            <h2 className="text-4xl font-black text-slate-900">Preguntas Frecuentes</h2>
          </div>
          <div className="space-y-4">
            {[
              { q: '¿Es realmente gratis para estudiantes?', a: 'Sí, el plan gratuito incluye materiales ilimitados, rutas personalizadas y flashcards IA sin costo. Solo cobramos por funciones premium como el Tutor Socrático y análisis avanzado.' },
              { q: '¿Cómo funciona la generación de contenido IA?', a: 'Usamos tecnología RAG (Retrieval-Augmented Generation) que analiza tu material y genera contenido educativo basado únicamente en lo que subiste, sin inventar información.' },
              { q: '¿Puedo usar MHS para cualquier materia?', a: 'Sí, funciona con cualquier materia de preparatoria y universidad. El sistema se adapta al contenido que subes, ya sea matemáticas, historia, biología o cualquier otra área.' },
              { q: '¿Mis datos están seguros?', a: 'Absolutamente. Usamos encriptación de nivel bancario, cumplimos con LFPDPPP (México) y nunca compartimos tu información con terceros.' },
              { q: '¿Puedo cancelar en cualquier momento?', a: 'Sí, no hay contratos de permanencia. Puedes cancelar tu suscripción premium cuando quieras y seguir usando el plan gratuito.' },
              { q: '¿Ofrecen soporte técnico?', a: 'Usuarios gratuitos tienen acceso a nuestra base de conocimientos. Usuarios premium tienen chat en vivo. Instituciones cuentan con soporte dedicado 24/7.' }
            ].map((faq, i) => (
              <div
                key={i}
                className="border border-slate-200 rounded-xl overflow-hidden"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full p-6 text-left flex justify-between items-center hover:bg-slate-50 transition-colors"
                >
                  <span className="font-bold text-slate-900">{faq.q}</span>
                  <span className={`material-symbols-outlined text-primary transition-transform ${openFaq === i ? 'rotate-180' : ''}`}>
                    expand_more
                  </span>
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-6 text-slate-600 leading-relaxed animate-fade-in">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 bg-slate-900 text-white text-center">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="text-4xl font-black mb-6">¿Listo para transformar tu aprendizaje?</h2>
          <p className="text-slate-400 mb-10 text-lg">Únete a miles de mentes brillantes hoy mismo.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button onClick={() => navigate('/auth')} className="bg-primary px-10 py-4 rounded-xl font-bold text-lg hover:bg-blue-600 shadow-xl shadow-blue-900">
              Crear Cuenta Gratis
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-500 py-12 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-5 gap-8 mb-12">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <span className="material-symbols-outlined text-primary text-2xl font-bold">neurology</span>
                <span className="font-extrabold text-xl tracking-tighter text-white">MHS</span>
              </div>
              <p className="text-sm leading-relaxed max-w-xs">
                Transformando la educación con inteligencia artificial adaptativa. Estudia inteligente, no más duro.
              </p>
            </div>
            <div>
              <h4 className="font-bold text-white mb-4">Producto</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#features" className="hover:text-white transition-colors">Características</a></li>
                <li><a href="#pricing" className="hover:text-white transition-colors">Precios</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Integraciones</a></li>
                <li><a href="#" className="hover:text-white transition-colors">API</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-white mb-4">Recursos</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Tutoriales</a></li>
                <li><a href="#faq" className="hover:text-white transition-colors">FAQ</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Webinars</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-white mb-4">Legal</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white transition-colors">Términos</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Privacidad</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Cookies</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Soporte</a></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm">© 2026 MHS Inc. Todos los derechos reservados.</p>
            <div className="flex gap-4">
              <a href="#" className="hover:text-white transition-colors"><span className="material-symbols-outlined">mail</span></a>
              <a href="#" className="hover:text-white transition-colors">𝕏</a>
              <a href="#" className="hover:text-white transition-colors">in</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
