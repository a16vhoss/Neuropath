import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
    createAssignment,
    createTopic,
    getClassTopics,
    ClassTopic,
    Assignment
} from '../services/ClassroomService';
import { supabase, getClassMaterials } from '../services/supabaseClient';

const CreateAssignment: React.FC = () => {
    const navigate = useNavigate();
    const { classId } = useParams();
    const { user } = useAuth();

    // Form state
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [instructions, setInstructions] = useState('');
    const [points, setPoints] = useState(100);
    const [dueDate, setDueDate] = useState('');
    const [dueTime, setDueTime] = useState('23:59');
    const [type, setType] = useState<Assignment['type']>('assignment');
    const [allowLate, setAllowLate] = useState(true);
    const [latePenalty, setLatePenalty] = useState(0);
    const [topicId, setTopicId] = useState<string | null>(null);
    const [schedulePublish, setSchedulePublish] = useState(false);
    const [scheduledDate, setScheduledDate] = useState('');
    const [scheduledTime, setScheduledTime] = useState('08:00');

    // Data
    const [topics, setTopics] = useState<ClassTopic[]>([]);
    const [materials, setMaterials] = useState<any[]>([]);
    const [selectedMaterials, setSelectedMaterials] = useState<string[]>([]);
    const [showNewTopic, setShowNewTopic] = useState(false);
    const [newTopicName, setNewTopicName] = useState('');

    // UI state
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [className, setClassName] = useState('');

    useEffect(() => {
        if (!classId) return;

        const loadData = async () => {
            // Load class info
            const { data: cls } = await supabase
                .from('classes')
                .select('name')
                .eq('id', classId)
                .single();
            if (cls) setClassName(cls.name);

            // Load topics
            const topicsData = await getClassTopics(classId);
            setTopics(topicsData);

            // Load materials
            const mats = await getClassMaterials(classId);
            if (mats) setMaterials(mats);
        };

        loadData();
    }, [classId]);

    const handleCreateTopic = async () => {
        if (!newTopicName.trim() || !classId) return;
        try {
            const newTopic = await createTopic(classId, newTopicName.trim());
            setTopics([...topics, newTopic]);
            setTopicId(newTopic.id);
            setNewTopicName('');
            setShowNewTopic(false);
        } catch (err) {
            console.error('Error creating topic:', err);
        }
    };

    const handleSubmit = async (publish: boolean) => {
        if (!title.trim() || !classId) {
            setError('El título es requerido');
            return;
        }

        setLoading(true);
        setError('');

        try {
            let dueDatetime: string | undefined;
            if (dueDate) {
                dueDatetime = `${dueDate}T${dueTime}:00`;
            }

            let scheduledPublishDatetime: string | undefined;
            if (schedulePublish && scheduledDate) {
                scheduledPublishDatetime = `${scheduledDate}T${scheduledTime}:00`;
            }

            await createAssignment({
                class_id: classId,
                title: title.trim(),
                description: description.trim() || undefined,
                instructions: instructions.trim() || undefined,
                points,
                due_date: dueDatetime,
                type,
                allow_late_submissions: allowLate,
                late_penalty_percent: latePenalty,
                topic_id: topicId || undefined,
                scheduled_publish: scheduledPublishDatetime,
                attached_materials: selectedMaterials,
                published: publish && !schedulePublish
            });

            navigate(`/teacher/class/${classId}`);
        } catch (err: any) {
            console.error('Error creating assignment:', err);
            setError(err.message || 'Error al crear la tarea');
        } finally {
            setLoading(false);
        }
    };

    const typeOptions = [
        { value: 'assignment', label: 'Tarea', icon: 'assignment', color: 'violet' },
        { value: 'quiz_assignment', label: 'Quiz', icon: 'quiz', color: 'amber' },
        { value: 'material', label: 'Material', icon: 'menu_book', color: 'blue' },
        { value: 'discussion', label: 'Discusión', icon: 'forum', color: 'emerald' }
    ];

    return (
        <div className="min-h-screen bg-[#F9FAFB]">
            {/* Header */}
            <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
                <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate(-1)}
                            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition"
                        >
                            <span className="material-symbols-outlined">close</span>
                        </button>
                        <div>
                            <h1 className="font-bold text-slate-900">Nueva Tarea</h1>
                            <p className="text-sm text-slate-500">{className}</p>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={() => handleSubmit(false)}
                            disabled={loading || !title.trim()}
                            className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition disabled:opacity-50"
                        >
                            Guardar borrador
                        </button>
                        <button
                            onClick={() => handleSubmit(true)}
                            disabled={loading || !title.trim()}
                            className="px-6 py-2 bg-primary text-white font-bold rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-2"
                        >
                            {schedulePublish ? (
                                <>
                                    <span className="material-symbols-outlined text-lg">schedule</span>
                                    Programar
                                </>
                            ) : (
                                <>
                                    <span className="material-symbols-outlined text-lg">send</span>
                                    Publicar
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </header>

            {/* Content */}
            <main className="max-w-4xl mx-auto px-6 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Main Form */}
                    <div className="lg:col-span-2 space-y-6">
                        {error && (
                            <div className="bg-rose-50 text-rose-700 px-4 py-3 rounded-xl flex items-center gap-2">
                                <span className="material-symbols-outlined">error</span>
                                {error}
                            </div>
                        )}

                        {/* Title */}
                        <div className="bg-white rounded-2xl border border-slate-200 p-6">
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="Título de la tarea"
                                className="w-full text-2xl font-bold text-slate-900 outline-none placeholder:text-slate-300"
                            />
                        </div>

                        {/* Description */}
                        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
                            <label className="block text-sm font-bold text-slate-700">Descripción (opcional)</label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Describe brevemente la tarea..."
                                rows={3}
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-primary resize-none"
                            />
                        </div>

                        {/* Instructions */}
                        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
                            <label className="block text-sm font-bold text-slate-700">Instrucciones</label>
                            <textarea
                                value={instructions}
                                onChange={(e) => setInstructions(e.target.value)}
                                placeholder="Instrucciones detalladas para los estudiantes..."
                                rows={6}
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-primary resize-none"
                            />
                        </div>

                        {/* Attachments */}
                        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
                            <label className="block text-sm font-bold text-slate-700">Materiales adjuntos</label>
                            {materials.length > 0 ? (
                                <div className="space-y-2">
                                    {materials.map((mat) => (
                                        <label
                                            key={mat.id}
                                            className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition ${selectedMaterials.includes(mat.id)
                                                    ? 'border-primary bg-primary/5'
                                                    : 'border-slate-200 hover:bg-slate-50'
                                                }`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={selectedMaterials.includes(mat.id)}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setSelectedMaterials([...selectedMaterials, mat.id]);
                                                    } else {
                                                        setSelectedMaterials(selectedMaterials.filter(id => id !== mat.id));
                                                    }
                                                }}
                                                className="w-4 h-4 text-primary"
                                            />
                                            <span className="material-symbols-outlined text-slate-400">
                                                {mat.type === 'pdf' ? 'picture_as_pdf' : mat.type === 'video' ? 'videocam' : 'description'}
                                            </span>
                                            <span className="flex-1 text-slate-700">{mat.name}</span>
                                        </label>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-slate-400 text-sm">No hay materiales disponibles. Sube materiales primero.</p>
                            )}
                        </div>
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-6">
                        {/* Type */}
                        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
                            <label className="block text-sm font-bold text-slate-700">Tipo</label>
                            <div className="grid grid-cols-2 gap-2">
                                {typeOptions.map((opt) => (
                                    <button
                                        key={opt.value}
                                        onClick={() => setType(opt.value as Assignment['type'])}
                                        className={`p-3 rounded-xl border text-left flex items-center gap-2 transition ${type === opt.value
                                                ? `border-${opt.color}-500 bg-${opt.color}-50 text-${opt.color}-700`
                                                : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                                            }`}
                                    >
                                        <span className="material-symbols-outlined">{opt.icon}</span>
                                        <span className="font-medium text-sm">{opt.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Points */}
                        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
                            <label className="block text-sm font-bold text-slate-700">Puntos</label>
                            <input
                                type="number"
                                value={points}
                                onChange={(e) => setPoints(parseInt(e.target.value) || 0)}
                                min={0}
                                max={1000}
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-primary"
                            />
                        </div>

                        {/* Due Date */}
                        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
                            <label className="block text-sm font-bold text-slate-700">Fecha de entrega</label>
                            <input
                                type="date"
                                value={dueDate}
                                onChange={(e) => setDueDate(e.target.value)}
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-primary"
                            />
                            <input
                                type="time"
                                value={dueTime}
                                onChange={(e) => setDueTime(e.target.value)}
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-primary"
                            />
                        </div>

                        {/* Topic */}
                        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
                            <label className="block text-sm font-bold text-slate-700">Tema</label>
                            <select
                                value={topicId || ''}
                                onChange={(e) => setTopicId(e.target.value || null)}
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-primary"
                            >
                                <option value="">Sin tema</option>
                                {topics.map((topic) => (
                                    <option key={topic.id} value={topic.id}>{topic.name}</option>
                                ))}
                            </select>
                            {showNewTopic ? (
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={newTopicName}
                                        onChange={(e) => setNewTopicName(e.target.value)}
                                        placeholder="Nombre del tema"
                                        className="flex-1 p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-primary"
                                        autoFocus
                                    />
                                    <button
                                        onClick={handleCreateTopic}
                                        className="px-3 py-2 bg-primary text-white rounded-lg text-sm font-medium"
                                    >
                                        Crear
                                    </button>
                                    <button
                                        onClick={() => { setShowNewTopic(false); setNewTopicName(''); }}
                                        className="px-3 py-2 text-slate-500 hover:bg-slate-100 rounded-lg text-sm"
                                    >
                                        ✕
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={() => setShowNewTopic(true)}
                                    className="w-full p-2 text-primary text-sm font-medium hover:bg-primary/5 rounded-lg transition flex items-center justify-center gap-1"
                                >
                                    <span className="material-symbols-outlined text-lg">add</span>
                                    Crear nuevo tema
                                </button>
                            )}
                        </div>

                        {/* Late Submissions */}
                        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-bold text-slate-700">Permitir entregas tardías</label>
                                <button
                                    onClick={() => setAllowLate(!allowLate)}
                                    className={`w-12 h-6 rounded-full transition ${allowLate ? 'bg-primary' : 'bg-slate-300'}`}
                                >
                                    <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${allowLate ? 'translate-x-6' : 'translate-x-0.5'}`} />
                                </button>
                            </div>
                            {allowLate && (
                                <div>
                                    <label className="block text-xs text-slate-500 mb-1">Penalización (%)</label>
                                    <input
                                        type="number"
                                        value={latePenalty}
                                        onChange={(e) => setLatePenalty(parseInt(e.target.value) || 0)}
                                        min={0}
                                        max={100}
                                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-primary"
                                    />
                                </div>
                            )}
                        </div>

                        {/* Schedule */}
                        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-bold text-slate-700">Programar publicación</label>
                                <button
                                    onClick={() => setSchedulePublish(!schedulePublish)}
                                    className={`w-12 h-6 rounded-full transition ${schedulePublish ? 'bg-primary' : 'bg-slate-300'}`}
                                >
                                    <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${schedulePublish ? 'translate-x-6' : 'translate-x-0.5'}`} />
                                </button>
                            </div>
                            {schedulePublish && (
                                <div className="space-y-2">
                                    <input
                                        type="date"
                                        value={scheduledDate}
                                        onChange={(e) => setScheduledDate(e.target.value)}
                                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-primary"
                                    />
                                    <input
                                        type="time"
                                        value={scheduledTime}
                                        onChange={(e) => setScheduledTime(e.target.value)}
                                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-primary"
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default CreateAssignment;
