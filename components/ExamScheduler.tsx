import React, { useState, useEffect } from 'react';
import { scheduleExam, getClassTopics, ClassTopic, ScheduledExam } from '../services/ClassroomService';
import { supabase } from '../services/supabaseClient';

interface ExamSchedulerProps {
    classId: string;
    initialTopicId?: string;
    onClose: () => void;
    onCreated: (exam: ScheduledExam) => void;
}

interface Quiz {
    id: string;
    name: string;
    question_count: number;
}

const ExamScheduler: React.FC<ExamSchedulerProps> = ({ classId, initialTopicId, onClose, onCreated }) => {
    const [quizzes, setQuizzes] = useState<Quiz[]>([]);
    const [topics, setTopics] = useState<ClassTopic[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    // Form state
    const [selectedQuizId, setSelectedQuizId] = useState('');
    const [title, setTitle] = useState('');
    const [instructions, setInstructions] = useState('');
    const [startDate, setStartDate] = useState('');
    const [startTime, setStartTime] = useState('09:00');
    const [endDate, setEndDate] = useState('');
    const [endTime, setEndTime] = useState('23:59');
    const [durationMinutes, setDurationMinutes] = useState(60);
    const [topicId, setTopicId] = useState(initialTopicId || '');
    const [allowRetakes, setAllowRetakes] = useState(false);
    const [maxAttempts, setMaxAttempts] = useState(1);
    const [shuffleQuestions, setShuffleQuestions] = useState(true);
    const [shuffleOptions, setShuffleOptions] = useState(true);
    const [showResultsImmediately, setShowResultsImmediately] = useState(true);
    const [showCorrectAnswers, setShowCorrectAnswers] = useState(false);
    const [passcode, setPasscode] = useState('');
    const [publishNow, setPublishNow] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            try {
                // Load quizzes
                const { data: quizData } = await supabase
                    .from('quizzes')
                    .select('id, name:title')
                    .eq('class_id', classId);

                if (quizData) {
                    const quizzesWithCount = await Promise.all(quizData.map(async (q) => {
                        const { count } = await supabase
                            .from('quiz_questions')
                            .select('*', { count: 'exact', head: true })
                            .eq('quiz_id', q.id);
                        return { ...q, question_count: count || 0 };
                    }));
                    setQuizzes(quizzesWithCount);
                }

                // Load topics
                const topicsData = await getClassTopics(classId);
                setTopics(topicsData);
            } catch (err) {
                console.error('Error loading data:', err);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [classId]);

    const handleSubmit = async () => {
        if (!selectedQuizId || !title.trim() || !startDate || !endDate) {
            setError('Por favor completa todos los campos requeridos');
            return;
        }

        const startDateTime = `${startDate}T${startTime}:00`;
        const endDateTime = `${endDate}T${endTime}:00`;

        if (new Date(endDateTime) <= new Date(startDateTime)) {
            setError('La fecha de cierre debe ser posterior a la de apertura');
            return;
        }

        setSaving(true);
        setError('');

        try {
            const exam = await scheduleExam({
                class_id: classId,
                quiz_id: selectedQuizId,
                title: title.trim(),
                instructions: instructions.trim() || undefined,
                start_time: startDateTime,
                end_time: endDateTime,
                duration_minutes: durationMinutes,
                topic_id: topicId || undefined,
                allow_retakes: allowRetakes,
                max_attempts: allowRetakes ? maxAttempts : 1,
                shuffle_questions: shuffleQuestions,
                shuffle_options: shuffleOptions,
                show_results_immediately: showResultsImmediately,
                show_correct_answers: showCorrectAnswers,
                passcode: passcode || undefined,
                published: publishNow
            });

            onCreated(exam);
        } catch (err: any) {
            console.error('Error scheduling exam:', err);
            setError(err.message || 'Error al programar el examen');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="p-6 border-b border-slate-100">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold text-slate-900">📝 Programar Examen</h2>
                        <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)] space-y-6">
                    {error && (
                        <div className="bg-rose-50 text-rose-700 px-4 py-3 rounded-xl flex items-center gap-2">
                            <span className="material-symbols-outlined">error</span>
                            {error}
                        </div>
                    )}

                    {loading ? (
                        <div className="text-center py-12">
                            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                            <p className="text-slate-500">Cargando...</p>
                        </div>
                    ) : (
                        <>
                            {/* Quiz Selection */}
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Seleccionar Quiz *</label>
                                {quizzes.length > 0 ? (
                                    <select
                                        value={selectedQuizId}
                                        onChange={(e) => {
                                            setSelectedQuizId(e.target.value);
                                            const q = quizzes.find(quiz => quiz.id === e.target.value);
                                            if (q && !title) setTitle(q.name);
                                        }}
                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-primary"
                                    >
                                        <option value="">Selecciona un quiz...</option>
                                        {quizzes.map((quiz) => (
                                            <option key={quiz.id} value={quiz.id}>
                                                {quiz.name} ({quiz.question_count} preguntas)
                                            </option>
                                        ))}
                                    </select>
                                ) : (
                                    <p className="text-amber-600 bg-amber-50 px-4 py-3 rounded-xl">
                                        No hay quizzes disponibles. Sube material para generar quizzes automáticamente.
                                    </p>
                                )}
                            </div>

                            {/* Title */}
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Título del examen *</label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="Ej: Examen Parcial 1"
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-primary"
                                />
                            </div>

                            {/* Instructions */}
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Instrucciones (opcional)</label>
                                <textarea
                                    value={instructions}
                                    onChange={(e) => setInstructions(e.target.value)}
                                    placeholder="Instrucciones para los estudiantes..."
                                    rows={3}
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-primary resize-none"
                                />
                            </div>

                            {/* Time Window */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Fecha de apertura *</label>
                                    <input
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-primary"
                                    />
                                    <input
                                        type="time"
                                        value={startTime}
                                        onChange={(e) => setStartTime(e.target.value)}
                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-primary mt-2"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Fecha de cierre *</label>
                                    <input
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-primary"
                                    />
                                    <input
                                        type="time"
                                        value={endTime}
                                        onChange={(e) => setEndTime(e.target.value)}
                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-primary mt-2"
                                    />
                                </div>
                            </div>

                            {/* Duration */}
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Duración máxima (minutos)</label>
                                <input
                                    type="number"
                                    value={durationMinutes}
                                    onChange={(e) => setDurationMinutes(parseInt(e.target.value) || 60)}
                                    min={5}
                                    max={480}
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-primary"
                                />
                                <p className="text-xs text-slate-500 mt-1">0 = sin límite de tiempo</p>
                            </div>

                            {/* Topic */}
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Tema (opcional)</label>
                                <select
                                    value={topicId}
                                    onChange={(e) => setTopicId(e.target.value)}
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-primary"
                                >
                                    <option value="">Sin tema</option>
                                    {topics.map((topic) => (
                                        <option key={topic.id} value={topic.id}>{topic.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Options */}
                            <div className="bg-slate-50 rounded-xl p-4 space-y-4">
                                <h4 className="font-bold text-slate-700">Opciones del examen</h4>

                                <div className="grid grid-cols-2 gap-4">
                                    {/* Shuffle Questions */}
                                    <label className="flex items-center gap-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={shuffleQuestions}
                                            onChange={(e) => setShuffleQuestions(e.target.checked)}
                                            className="w-5 h-5 text-primary rounded"
                                        />
                                        <span className="text-sm text-slate-700">Mezclar preguntas</span>
                                    </label>

                                    {/* Shuffle Options */}
                                    <label className="flex items-center gap-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={shuffleOptions}
                                            onChange={(e) => setShuffleOptions(e.target.checked)}
                                            className="w-5 h-5 text-primary rounded"
                                        />
                                        <span className="text-sm text-slate-700">Mezclar opciones</span>
                                    </label>

                                    {/* Show Results */}
                                    <label className="flex items-center gap-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={showResultsImmediately}
                                            onChange={(e) => setShowResultsImmediately(e.target.checked)}
                                            className="w-5 h-5 text-primary rounded"
                                        />
                                        <span className="text-sm text-slate-700">Mostrar resultados al terminar</span>
                                    </label>

                                    {/* Show Correct Answers */}
                                    <label className="flex items-center gap-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={showCorrectAnswers}
                                            onChange={(e) => setShowCorrectAnswers(e.target.checked)}
                                            className="w-5 h-5 text-primary rounded"
                                        />
                                        <span className="text-sm text-slate-700">Mostrar respuestas correctas</span>
                                    </label>
                                </div>

                                {/* Allow Retakes */}
                                <div className="border-t border-slate-200 pt-4">
                                    <label className="flex items-center gap-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={allowRetakes}
                                            onChange={(e) => setAllowRetakes(e.target.checked)}
                                            className="w-5 h-5 text-primary rounded"
                                        />
                                        <span className="text-sm text-slate-700">Permitir reintentos</span>
                                    </label>
                                    {allowRetakes && (
                                        <div className="mt-2 ml-8">
                                            <label className="text-xs text-slate-500">Máximo de intentos:</label>
                                            <input
                                                type="number"
                                                value={maxAttempts}
                                                onChange={(e) => setMaxAttempts(parseInt(e.target.value) || 1)}
                                                min={1}
                                                max={10}
                                                className="w-20 p-2 ml-2 bg-white border border-slate-200 rounded-lg text-sm"
                                            />
                                        </div>
                                    )}
                                </div>

                                {/* Passcode */}
                                <div className="border-t border-slate-200 pt-4">
                                    <label className="block text-sm text-slate-700 mb-2">Código de acceso (opcional)</label>
                                    <input
                                        type="text"
                                        value={passcode}
                                        onChange={(e) => setPasscode(e.target.value)}
                                        placeholder="Dejar vacío para no requerir código"
                                        className="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm"
                                    />
                                </div>
                            </div>

                            {/* Publish Option */}
                            <label className="flex items-center gap-3 cursor-pointer bg-violet-50 p-4 rounded-xl">
                                <input
                                    type="checkbox"
                                    checked={publishNow}
                                    onChange={(e) => setPublishNow(e.target.checked)}
                                    className="w-5 h-5 text-primary rounded"
                                />
                                <div>
                                    <span className="font-medium text-violet-700">Publicar inmediatamente</span>
                                    <p className="text-xs text-violet-600">Los estudiantes podrán ver el examen programado</p>
                                </div>
                            </label>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-200 rounded-xl transition"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={saving || !selectedQuizId || !title.trim() || !startDate || !endDate}
                        className="px-6 py-2 bg-primary text-white font-bold rounded-xl hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-2"
                    >
                        {saving ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                Guardando...
                            </>
                        ) : (
                            <>
                                <span className="material-symbols-outlined text-lg">event</span>
                                Programar Examen
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ExamScheduler;
