import React from 'react';
import { ClassTopic, Assignment } from '../services/ClassroomService';
import AssignmentCard from './AssignmentCard';

interface TopicSectionProps {
    topic: ClassTopic;
    assignments: Assignment[];
    isTeacher?: boolean;
    onAssignmentClick?: (assignment: Assignment) => void;
    onEditAssignment?: (assignment: Assignment) => void;
    onDeleteAssignment?: (assignment: Assignment) => void;
    onEditTopic?: () => void;
    onDeleteTopic?: () => void;
    onAddInfo?: () => void;
    onAddTask?: () => void;
    onAddExam?: () => void;
    onAddMaterial?: () => void;
    collapsed?: boolean;
    onToggleCollapse?: () => void;
}

const TopicSection: React.FC<TopicSectionProps> = ({
    topic,
    assignments,
    isTeacher = false,
    onAssignmentClick,
    onEditAssignment,
    onDeleteAssignment,
    onEditTopic,
    onDeleteTopic,
    onAddInfo,
    onAddTask,
    onAddExam,
    onAddMaterial,
    collapsed = false,
    onToggleCollapse
}) => {
    const [showAddMenu, setShowAddMenu] = React.useState(false);
    const menuRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setShowAddMenu(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    return (
        <div className="mb-6">
            {/* Topic Header */}
            <div className="flex items-center gap-3 mb-3 group relative">
                <button
                    onClick={onToggleCollapse}
                    className="flex items-center gap-2 flex-1 text-left"
                >
                    <span className={`material-symbols-outlined text-slate-400 transition-transform ${collapsed ? '' : 'rotate-90'}`}>
                        chevron_right
                    </span>
                    <h3 className="font-bold text-slate-800 text-lg">{topic.name}</h3>
                    <span className="text-sm text-slate-400">({assignments.length})</span>
                </button>

                {isTeacher && (
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition items-center">
                        {/* New Add Button with Dropdown */}
                        <div className="relative" ref={menuRef}>
                            <button
                                onClick={() => setShowAddMenu(!showAddMenu)}
                                className={`p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition ${showAddMenu ? 'bg-emerald-50 text-emerald-600' : ''}`}
                                title="Añadir contenido"
                            >
                                <span className="material-symbols-outlined text-lg">add</span>
                            </button>

                            {/* Dropdown Menu */}
                            {showAddMenu && (
                                <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-100 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                    <div className="p-1">
                                        <button
                                            onClick={() => { onAddInfo?.(); setShowAddMenu(false); }}
                                            className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-primary rounded-lg flex items-center gap-2 transition"
                                        >
                                            <span className="material-symbols-outlined text-lg">info</span>
                                            Información
                                        </button>
                                        <button
                                            onClick={() => { onAddTask?.(); setShowAddMenu(false); }}
                                            className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-primary rounded-lg flex items-center gap-2 transition"
                                        >
                                            <span className="material-symbols-outlined text-lg">assignment</span>
                                            Tarea / Actividad
                                        </button>
                                        {onAddExam && (
                                            <button
                                                onClick={() => { onAddExam?.(); setShowAddMenu(false); }}
                                                className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-primary rounded-lg flex items-center gap-2 transition"
                                            >
                                                <span className="material-symbols-outlined text-lg">quiz</span>
                                                Examen
                                            </button>
                                        )}
                                        <button
                                            onClick={() => { onAddMaterial?.(); setShowAddMenu(false); }}
                                            className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-primary rounded-lg flex items-center gap-2 transition"
                                        >
                                            <span className="material-symbols-outlined text-lg">folder_open</span>
                                            Material de Estudio
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {onEditTopic && (
                            <button
                                onClick={onEditTopic}
                                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                                title="Editar tema"
                            >
                                <span className="material-symbols-outlined text-lg">edit</span>
                            </button>
                        )}
                        {onDeleteTopic && (
                            <button
                                onClick={onDeleteTopic}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                                title="Eliminar tema"
                            >
                                <span className="material-symbols-outlined text-lg">delete</span>
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Assignments */}
            {!collapsed && (
                <div className="space-y-2 pl-6 border-l-2 border-slate-100">
                    {assignments.length === 0 ? (
                        <div className="text-sm text-slate-400 py-4 text-center">
                            No hay contenido en este módulo
                        </div>
                    ) : (
                        assignments.map((assignment) => (
                            <AssignmentCard
                                key={assignment.id}
                                assignment={assignment}
                                isTeacher={isTeacher}
                                onClick={() => onAssignmentClick?.(assignment)}
                                onEdit={() => onEditAssignment?.(assignment)}
                                onDelete={() => onDeleteAssignment?.(assignment)}
                            />
                        ))
                    )}
                </div>
            )}
        </div>
    );
};

export default TopicSection;
