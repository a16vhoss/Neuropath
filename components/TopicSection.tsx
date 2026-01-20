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
    onAddAssignment?: () => void;
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
    onAddAssignment,
    collapsed = false,
    onToggleCollapse
}) => {
    return (
        <div className="mb-6">
            {/* Topic Header */}
            <div className="flex items-center gap-3 mb-3 group">
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
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                        {onAddAssignment && (
                            <button
                                onClick={onAddAssignment}
                                className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                                title="Añadir tarea"
                            >
                                <span className="material-symbols-outlined text-lg">add</span>
                            </button>
                        )}
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
                            No hay tareas en este tema
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
