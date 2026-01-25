import React, { useState } from 'react';
import { Notebook } from '../../types';

interface NotebookListProps {
  notebooks: Notebook[];
  loading: boolean;
  canEdit: boolean;
  onCreateNotebook: (title: string, description: string) => Promise<void>;
  onSelectNotebook: (notebook: Notebook) => void;
  onDeleteNotebook: (notebookId: string) => Promise<void>;
}

const NotebookList: React.FC<NotebookListProps> = ({
  notebooks,
  loading,
  canEdit,
  onCreateNotebook,
  onSelectNotebook,
  onDeleteNotebook,
}) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!newTitle.trim()) return;

    setCreating(true);
    try {
      await onCreateNotebook(newTitle.trim(), newDescription.trim());
      setShowCreateModal(false);
      setNewTitle('');
      setNewDescription('');
    } catch (error) {
      console.error('Error creating notebook:', error);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, notebookId: string) => {
    e.stopPropagation();
    if (!confirm('¿Eliminar este cuaderno? Las flashcards generadas se mantendran.')) return;

    setDeletingId(notebookId);
    try {
      await onDeleteNotebook(notebookId);
    } catch (error) {
      console.error('Error deleting notebook:', error);
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="py-12 text-center text-slate-400">
        <span className="material-symbols-outlined animate-spin text-2xl mb-2">sync</span>
        <p>Cargando cuadernos...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h3 className="font-bold text-slate-900 text-lg">Cuadernos de Notas</h3>
        {canEdit && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 bg-primary text-white font-medium px-4 py-2 rounded-xl hover:bg-blue-700 transition"
          >
            <span className="material-symbols-outlined text-xl">add</span>
            Nuevo Cuaderno
          </button>
        )}
      </div>

      {/* Empty State */}
      {notebooks.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-100">
          <span className="material-symbols-outlined text-6xl text-slate-200">
            menu_book
          </span>
          <p className="mt-4 text-slate-600 font-medium">No hay cuadernos aun</p>
          <p className="text-sm text-slate-400 mt-1">
            Crea un cuaderno para tomar apuntes y generar flashcards automaticamente
          </p>
          {canEdit && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-6 bg-primary text-white px-6 py-2 rounded-xl hover:bg-blue-700 transition"
            >
              Crear mi primer cuaderno
            </button>
          )}
        </div>
      ) : (
        /* Notebook Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {notebooks.map((notebook) => (
            <div
              key={notebook.id}
              onClick={() => onSelectNotebook(notebook)}
              className="bg-white rounded-xl p-5 border border-slate-100 hover:border-primary/30 hover:shadow-md transition cursor-pointer group"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                    <span className="material-symbols-outlined text-primary">description</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-slate-900 truncate">{notebook.title}</h4>
                    {notebook.description && (
                      <p className="text-sm text-slate-500 truncate">{notebook.description}</p>
                    )}
                  </div>
                </div>

                {canEdit && (
                  <button
                    onClick={(e) => handleDelete(e, notebook.id)}
                    disabled={deletingId === notebook.id}
                    className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                  >
                    <span className="material-symbols-outlined text-xl">
                      {deletingId === notebook.id ? 'sync' : 'delete'}
                    </span>
                  </button>
                )}
              </div>

              {/* Stats */}
              <div className="mt-4 flex items-center gap-4 text-sm text-slate-500">
                <div className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-base">style</span>
                  <span>{notebook.flashcards_generated} flashcards</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-base">schedule</span>
                  <span>{formatDate(notebook.updated_at)}</span>
                </div>
              </div>

              {/* Last saved indicator */}
              {notebook.last_saved_at && (
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <p className="text-xs text-slate-400">
                    Ultimo guardado: {formatDate(notebook.last_saved_at)}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-xl font-bold text-slate-900 mb-4">Nuevo Cuaderno</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Titulo *
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Ej: Apuntes Clase 1"
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Descripcion (opcional)
                </label>
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Breve descripcion del contenido..."
                  rows={2}
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 px-4 py-2 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreate}
                disabled={!newTitle.trim() || creating}
                className="flex-1 px-4 py-2 bg-primary text-white rounded-xl hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating ? 'Creando...' : 'Crear Cuaderno'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotebookList;
