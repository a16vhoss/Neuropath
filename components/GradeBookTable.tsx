import React, { useState } from 'react';
import { AssignmentSubmission, gradeSubmission, returnSubmission } from '../services/ClassroomService';

interface GradeBookTableProps {
    assignments: { id: string; title: string; points: number }[];
    students: { id: string; full_name: string; email: string; avatar_url?: string }[];
    submissions: Map<string, Map<string, AssignmentSubmission>>; // student_id -> assignment_id -> submission
    onRefresh?: () => void;
}

const GradeBookTable: React.FC<GradeBookTableProps> = ({
    assignments,
    students,
    submissions,
    onRefresh
}) => {
    const [editingCell, setEditingCell] = useState<{ studentId: string; assignmentId: string } | null>(null);
    const [gradeValue, setGradeValue] = useState('');
    const [saving, setSaving] = useState(false);

    const getSubmission = (studentId: string, assignmentId: string): AssignmentSubmission | undefined => {
        return submissions.get(studentId)?.get(assignmentId);
    };

    const getStatusColor = (status?: string) => {
        switch (status) {
            case 'turned_in': return 'bg-blue-100 text-blue-700';
            case 'graded': return 'bg-emerald-100 text-emerald-700';
            case 'returned': return 'bg-violet-100 text-violet-700';
            case 'missing': return 'bg-rose-100 text-rose-700';
            case 'in_progress': return 'bg-amber-100 text-amber-700';
            default: return 'bg-slate-100 text-slate-600';
        }
    };

    const getStatusLabel = (status?: string) => {
        switch (status) {
            case 'turned_in': return 'Entregado';
            case 'graded': return 'Calificado';
            case 'returned': return 'Devuelto';
            case 'missing': return 'Faltante';
            case 'in_progress': return 'En progreso';
            case 'assigned': return 'Asignado';
            default: return '-';
        }
    };

    const handleSaveGrade = async () => {
        if (!editingCell) return;
        const sub = getSubmission(editingCell.studentId, editingCell.assignmentId);
        if (!sub) return;

        const grade = parseInt(gradeValue);
        if (isNaN(grade)) return;

        setSaving(true);
        try {
            await gradeSubmission(sub.id, grade);
            setEditingCell(null);
            onRefresh?.();
        } catch (error) {
            console.error('Error saving grade:', error);
        } finally {
            setSaving(false);
        }
    };

    const calculateStudentAverage = (studentId: string): number => {
        let totalEarned = 0;
        let totalPossible = 0;

        assignments.forEach(assignment => {
            const sub = getSubmission(studentId, assignment.id);
            if (sub?.grade !== undefined && sub.grade !== null) {
                totalEarned += sub.grade;
                totalPossible += assignment.points;
            }
        });

        return totalPossible > 0 ? Math.round((totalEarned / totalPossible) * 100) : 0;
    };

    const calculateAssignmentAverage = (assignmentId: string): number => {
        const assignment = assignments.find(a => a.id === assignmentId);
        if (!assignment) return 0;

        let totalGrades = 0;
        let count = 0;

        students.forEach(student => {
            const sub = getSubmission(student.id, assignmentId);
            if (sub?.grade !== undefined && sub.grade !== null) {
                totalGrades += (sub.grade / assignment.points) * 100;
                count++;
            }
        });

        return count > 0 ? Math.round(totalGrades / count) : 0;
    };

    return (
        <div className="overflow-x-auto">
            <table className="w-full border-collapse">
                <thead>
                    <tr className="bg-slate-50">
                        <th className="sticky left-0 bg-slate-50 border border-slate-200 px-4 py-3 text-left text-sm font-semibold text-slate-700 min-w-[200px]">
                            Estudiante
                        </th>
                        {assignments.map(assignment => (
                            <th key={assignment.id} className="border border-slate-200 px-3 py-3 text-center text-sm font-semibold text-slate-700 min-w-[120px]">
                                <div className="truncate max-w-[120px]" title={assignment.title}>
                                    {assignment.title}
                                </div>
                                <div className="text-xs font-normal text-slate-500">{assignment.points} pts</div>
                            </th>
                        ))}
                        <th className="border border-slate-200 px-4 py-3 text-center text-sm font-semibold text-slate-700 min-w-[80px] bg-violet-50">
                            Promedio
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {students.map((student, idx) => (
                        <tr key={student.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                            {/* Student Name */}
                            <td className="sticky left-0 bg-inherit border border-slate-200 px-4 py-2">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center text-violet-600 text-xs font-bold flex-shrink-0">
                                        {student.full_name?.charAt(0) || '?'}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="font-medium text-slate-800 text-sm truncate">{student.full_name}</div>
                                        <div className="text-xs text-slate-400 truncate">{student.email}</div>
                                    </div>
                                </div>
                            </td>

                            {/* Assignment Grades */}
                            {assignments.map(assignment => {
                                const sub = getSubmission(student.id, assignment.id);
                                const isEditing = editingCell?.studentId === student.id && editingCell?.assignmentId === assignment.id;

                                return (
                                    <td key={assignment.id} className="border border-slate-200 px-2 py-2 text-center">
                                        {isEditing ? (
                                            <div className="flex items-center gap-1">
                                                <input
                                                    type="number"
                                                    value={gradeValue}
                                                    onChange={(e) => setGradeValue(e.target.value)}
                                                    className="w-16 px-2 py-1 border rounded text-center text-sm"
                                                    max={assignment.points}
                                                    min={0}
                                                    autoFocus
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') handleSaveGrade();
                                                        if (e.key === 'Escape') setEditingCell(null);
                                                    }}
                                                />
                                                <button
                                                    onClick={handleSaveGrade}
                                                    disabled={saving}
                                                    className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                                                >
                                                    <span className="material-symbols-outlined text-sm">check</span>
                                                </button>
                                                <button
                                                    onClick={() => setEditingCell(null)}
                                                    className="p-1 text-slate-400 hover:bg-slate-100 rounded"
                                                >
                                                    <span className="material-symbols-outlined text-sm">close</span>
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => {
                                                    if (sub) {
                                                        setEditingCell({ studentId: student.id, assignmentId: assignment.id });
                                                        setGradeValue(sub.grade?.toString() || '');
                                                    }
                                                }}
                                                className={`w-full py-1 px-2 rounded text-sm font-medium transition hover:ring-2 hover:ring-violet-300 ${getStatusColor(sub?.status)}`}
                                                disabled={!sub || sub.status === 'assigned'}
                                            >
                                                {sub?.grade !== undefined && sub.grade !== null ? (
                                                    <span>{sub.grade}/{assignment.points}</span>
                                                ) : (
                                                    <span className="text-xs">{getStatusLabel(sub?.status)}</span>
                                                )}
                                            </button>
                                        )}
                                    </td>
                                );
                            })}

                            {/* Student Average */}
                            <td className="border border-slate-200 px-4 py-2 text-center bg-violet-50">
                                <span className={`font-bold text-lg ${calculateStudentAverage(student.id) >= 70 ? 'text-emerald-600' : calculateStudentAverage(student.id) >= 50 ? 'text-amber-600' : 'text-rose-600'}`}>
                                    {calculateStudentAverage(student.id)}%
                                </span>
                            </td>
                        </tr>
                    ))}

                    {/* Average Row */}
                    <tr className="bg-slate-100 font-semibold">
                        <td className="sticky left-0 bg-slate-100 border border-slate-200 px-4 py-3 text-sm text-slate-700">
                            Promedio de clase
                        </td>
                        {assignments.map(assignment => (
                            <td key={assignment.id} className="border border-slate-200 px-3 py-3 text-center text-sm">
                                <span className={`font-bold ${calculateAssignmentAverage(assignment.id) >= 70 ? 'text-emerald-600' : calculateAssignmentAverage(assignment.id) >= 50 ? 'text-amber-600' : 'text-rose-600'}`}>
                                    {calculateAssignmentAverage(assignment.id)}%
                                </span>
                            </td>
                        ))}
                        <td className="border border-slate-200 bg-violet-100"></td>
                    </tr>
                </tbody>
            </table>

            {students.length === 0 && (
                <div className="text-center py-12 text-slate-400">
                    <span className="material-symbols-outlined text-5xl mb-2">group_off</span>
                    <p>No hay estudiantes inscritos</p>
                </div>
            )}
        </div>
    );
};

export default GradeBookTable;
