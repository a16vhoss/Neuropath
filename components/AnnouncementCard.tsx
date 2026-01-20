import React, { useState } from 'react';
import { Announcement, AnnouncementComment, getAnnouncementComments, addComment, deleteComment, deleteAnnouncement, updateAnnouncement } from '../services/ClassroomService';
import { useAuth } from '../contexts/AuthContext';

interface AnnouncementCardProps {
    announcement: Announcement;
    onUpdate?: () => void;
    isTeacher?: boolean;
}

const AnnouncementCard: React.FC<AnnouncementCardProps> = ({ announcement, onUpdate, isTeacher = false }) => {
    const { user } = useAuth();
    const [showComments, setShowComments] = useState(false);
    const [comments, setComments] = useState<AnnouncementComment[]>([]);
    const [loadingComments, setLoadingComments] = useState(false);
    const [newComment, setNewComment] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [showOptions, setShowOptions] = useState(false);
    const [editing, setEditing] = useState(false);
    const [editContent, setEditContent] = useState(announcement.content);

    const loadComments = async () => {
        if (comments.length > 0) return;
        setLoadingComments(true);
        try {
            const data = await getAnnouncementComments(announcement.id);
            setComments(data);
        } catch (error) {
            console.error('Error loading comments:', error);
        } finally {
            setLoadingComments(false);
        }
    };

    const handleToggleComments = () => {
        if (!showComments) {
            loadComments();
        }
        setShowComments(!showComments);
    };

    const handleAddComment = async () => {
        if (!newComment.trim() || !user) return;
        setSubmitting(true);
        try {
            const comment = await addComment(announcement.id, user.id, newComment.trim());
            setComments([...comments, comment]);
            setNewComment('');
        } catch (error) {
            console.error('Error adding comment:', error);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteComment = async (commentId: string) => {
        try {
            await deleteComment(commentId);
            setComments(comments.filter(c => c.id !== commentId));
        } catch (error) {
            console.error('Error deleting comment:', error);
        }
    };

    const handlePin = async () => {
        try {
            await updateAnnouncement(announcement.id, { pinned: !announcement.pinned });
            onUpdate?.();
        } catch (error) {
            console.error('Error updating announcement:', error);
        }
        setShowOptions(false);
    };

    const handleDelete = async () => {
        if (!confirm('¿Estás seguro de eliminar este anuncio?')) return;
        try {
            await deleteAnnouncement(announcement.id);
            onUpdate?.();
        } catch (error) {
            console.error('Error deleting announcement:', error);
        }
    };

    const handleSaveEdit = async () => {
        try {
            await updateAnnouncement(announcement.id, { content: editContent });
            setEditing(false);
            onUpdate?.();
        } catch (error) {
            console.error('Error updating announcement:', error);
        }
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const days = Math.floor(hours / 24);

        if (hours < 1) return 'Hace unos minutos';
        if (hours < 24) return `Hace ${hours}h`;
        if (days < 7) return `Hace ${days} día${days > 1 ? 's' : ''}`;
        return date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
    };

    return (
        <div className={`bg-white rounded-2xl border ${announcement.pinned ? 'border-violet-300 ring-2 ring-violet-100' : 'border-slate-200'} overflow-hidden transition hover:shadow-md`}>
            {/* Header */}
            <div className="p-4 flex items-start gap-3">
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                    {announcement.teacher?.full_name?.charAt(0) || 'P'}
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-slate-900">
                            {announcement.teacher?.full_name || 'Profesor'}
                        </span>
                        {announcement.pinned && (
                            <span className="bg-violet-100 text-violet-700 text-xs font-medium px-2 py-0.5 rounded-full flex items-center gap-1">
                                <span className="material-symbols-outlined text-xs">push_pin</span>
                                Fijado
                            </span>
                        )}
                        <span className="text-sm text-slate-400">
                            {formatDate(announcement.created_at)}
                        </span>
                    </div>

                    {/* Title if exists */}
                    {announcement.title && (
                        <h3 className="font-bold text-slate-800 mt-1">{announcement.title}</h3>
                    )}

                    {/* Content */}
                    {editing ? (
                        <div className="mt-2">
                            <textarea
                                value={editContent}
                                onChange={(e) => setEditContent(e.target.value)}
                                className="w-full p-3 border border-slate-200 rounded-xl resize-none focus:outline-none focus:border-violet-500"
                                rows={3}
                            />
                            <div className="flex gap-2 mt-2">
                                <button
                                    onClick={handleSaveEdit}
                                    className="px-4 py-1.5 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700"
                                >
                                    Guardar
                                </button>
                                <button
                                    onClick={() => { setEditing(false); setEditContent(announcement.content); }}
                                    className="px-4 py-1.5 text-slate-600 text-sm font-medium hover:bg-slate-100 rounded-lg"
                                >
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    ) : (
                        <p className="text-slate-600 mt-1 whitespace-pre-wrap">{announcement.content}</p>
                    )}

                    {/* Attachments */}
                    {announcement.attachments && announcement.attachments.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-3">
                            {announcement.attachments.map((att: any, i: number) => (
                                <a
                                    key={i}
                                    href={att.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-lg text-sm text-slate-700 transition"
                                >
                                    <span className="material-symbols-outlined text-lg text-slate-500">
                                        {att.type === 'pdf' ? 'picture_as_pdf' : att.type === 'link' ? 'link' : 'attachment'}
                                    </span>
                                    {att.name || 'Archivo'}
                                </a>
                            ))}
                        </div>
                    )}
                </div>

                {/* Options Menu (Teacher only) */}
                {isTeacher && (
                    <div className="relative">
                        <button
                            onClick={() => setShowOptions(!showOptions)}
                            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition"
                        >
                            <span className="material-symbols-outlined">more_vert</span>
                        </button>

                        {showOptions && (
                            <div className="absolute right-0 top-10 bg-white border border-slate-200 rounded-xl shadow-lg py-1 min-w-[160px] z-10">
                                <button
                                    onClick={handlePin}
                                    className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                                >
                                    <span className="material-symbols-outlined text-lg">push_pin</span>
                                    {announcement.pinned ? 'Desfijar' : 'Fijar arriba'}
                                </button>
                                <button
                                    onClick={() => { setEditing(true); setShowOptions(false); }}
                                    className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                                >
                                    <span className="material-symbols-outlined text-lg">edit</span>
                                    Editar
                                </button>
                                <button
                                    onClick={handleDelete}
                                    className="w-full px-4 py-2 text-left text-sm text-rose-600 hover:bg-rose-50 flex items-center gap-2"
                                >
                                    <span className="material-symbols-outlined text-lg">delete</span>
                                    Eliminar
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Comments Section */}
            {announcement.allow_comments && (
                <div className="border-t border-slate-100">
                    <button
                        onClick={handleToggleComments}
                        className="w-full px-4 py-3 flex items-center gap-2 text-sm text-slate-600 hover:bg-slate-50 transition"
                    >
                        <span className="material-symbols-outlined text-lg">chat_bubble_outline</span>
                        {announcement.comments_count || 0} comentario{(announcement.comments_count || 0) !== 1 ? 's' : ''}
                        <span className="material-symbols-outlined text-lg ml-auto">
                            {showComments ? 'expand_less' : 'expand_more'}
                        </span>
                    </button>

                    {showComments && (
                        <div className="px-4 pb-4 space-y-3">
                            {loadingComments ? (
                                <div className="text-center py-4 text-slate-400">Cargando...</div>
                            ) : (
                                <>
                                    {comments.map((comment) => (
                                        <div key={comment.id} className="flex gap-2">
                                            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 text-xs font-bold flex-shrink-0">
                                                {comment.author?.full_name?.charAt(0) || '?'}
                                            </div>
                                            <div className="flex-1 bg-slate-50 rounded-xl px-3 py-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium text-sm text-slate-800">
                                                        {comment.author?.full_name || 'Usuario'}
                                                    </span>
                                                    <span className="text-xs text-slate-400">
                                                        {formatDate(comment.created_at)}
                                                    </span>
                                                    {(isTeacher || comment.author_id === user?.id) && (
                                                        <button
                                                            onClick={() => handleDeleteComment(comment.id)}
                                                            className="ml-auto text-slate-400 hover:text-rose-500"
                                                        >
                                                            <span className="material-symbols-outlined text-sm">close</span>
                                                        </button>
                                                    )}
                                                </div>
                                                <p className="text-sm text-slate-600">{comment.content}</p>
                                            </div>
                                        </div>
                                    ))}

                                    {/* Add Comment */}
                                    <div className="flex gap-2 pt-2">
                                        <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center text-violet-600 text-xs font-bold flex-shrink-0">
                                            {user?.email?.charAt(0).toUpperCase() || '?'}
                                        </div>
                                        <div className="flex-1 flex gap-2">
                                            <input
                                                type="text"
                                                value={newComment}
                                                onChange={(e) => setNewComment(e.target.value)}
                                                placeholder="Añadir comentario..."
                                                className="flex-1 px-3 py-2 bg-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                                                onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                                            />
                                            <button
                                                onClick={handleAddComment}
                                                disabled={!newComment.trim() || submitting}
                                                className="px-4 py-2 bg-violet-600 text-white rounded-xl text-sm font-medium hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {submitting ? '...' : 'Enviar'}
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default AnnouncementCard;
