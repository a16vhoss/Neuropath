import React, { useState, useEffect } from 'react';
import { NotebookSave, FlashcardPreview } from '../../types';
import {
  getNotebookSaves,
  regenerateFlashcardsFromSave,
  confirmRegeneratedFlashcards,
} from '../../services/notebookService';

interface NotebookHistoryProps {
  notebookId: string;
  studySetId: string;
  studySetName: string;
  onClose: () => void;
}

const NotebookHistory: React.FC<NotebookHistoryProps> = ({
  notebookId,
  studySetId,
  studySetName,
  onClose,
}) => {
  const [saves, setSaves] = useState<NotebookSave[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSaveId, setExpandedSaveId] = useState<string | null>(null);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [regeneratedFlashcards, setRegeneratedFlashcards] = useState<FlashcardPreview[] | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  // Load saves on mount
  useEffect(() => {
    loadSaves();
  }, [notebookId]);

  const loadSaves = async () => {
    setLoading(true);
    try {
      const data = await getNotebookSaves(notebookId);
      setSaves(data);
    } catch (error) {
      console.error('Error loading saves:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleRegenerate = async (saveId: string) => {
    setRegeneratingId(saveId);
    setRegeneratedFlashcards(null);
    try {
      const flashcards = await regenerateFlashcardsFromSave(
        saveId,
        studySetId,
        studySetName
      );
      setRegeneratedFlashcards(flashcards);
    } catch (error) {
      console.error('Error regenerating:', error);
      alert('Error al regenerar flashcards');
    } finally {
      setRegeneratingId(null);
    }
  };

  const handleConfirmRegeneration = async (saveId: string) => {
    if (!regeneratedFlashcards) return;

    setConfirmingId(saveId);
    try {
      await confirmRegeneratedFlashcards(saveId, studySetId, regeneratedFlashcards);
      setRegeneratedFlashcards(null);
      loadSaves(); // Refresh saves
    } catch (error) {
      console.error('Error confirming regeneration:', error);
      alert('Error al confirmar flashcards');
    } finally {
      setConfirmingId(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Historial de Guardados</h2>
            <p className="text-sm text-slate-500 mt-1">
              {saves.length} guardado{saves.length !== 1 ? 's' : ''} con flashcards
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="py-12 text-center text-slate-400">
              <span className="material-symbols-outlined animate-spin text-2xl mb-2">sync</span>
              <p>Cargando historial...</p>
            </div>
          ) : saves.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <span className="material-symbols-outlined text-4xl mb-2">history</span>
              <p>No hay guardados aun</p>
              <p className="text-sm mt-1">
                Los guardados aparecen aqui cuando generas flashcards
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {saves.map((save) => (
                <div
                  key={save.id}
                  className="bg-slate-50 rounded-xl border border-slate-100 overflow-hidden"
                >
                  {/* Save Header */}
                  <div
                    className="p-4 cursor-pointer hover:bg-slate-100 transition"
                    onClick={() =>
                      setExpandedSaveId(expandedSaveId === save.id ? null : save.id)
                    }
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                          <span className="material-symbols-outlined text-primary">
                            save
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">
                            {formatDate(save.saved_at)}
                          </p>
                          <p className="text-sm text-slate-500">
                            {save.flashcards_generated} flashcard{save.flashcards_generated !== 1 ? 's' : ''} generada{save.flashcards_generated !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`material-symbols-outlined text-slate-400 transition-transform ${
                          expandedSaveId === save.id ? 'rotate-180' : ''
                        }`}
                      >
                        expand_more
                      </span>
                    </div>
                  </div>

                  {/* Expanded Content */}
                  {expandedSaveId === save.id && (
                    <div className="border-t border-slate-100 p-4 bg-white">
                      {/* New content diff */}
                      {save.new_content_diff && (
                        <div className="mb-4">
                          <p className="text-sm font-medium text-slate-600 mb-2">
                            Contenido que genero las flashcards:
                          </p>
                          <div className="bg-slate-50 rounded-lg p-3 max-h-40 overflow-auto">
                            <p className="text-sm text-slate-700 whitespace-pre-wrap">
                              {save.new_content_diff.slice(0, 800)}
                              {save.new_content_diff.length > 800 && '...'}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Regenerated flashcards preview */}
                      {regeneratedFlashcards && regeneratingId === null && expandedSaveId === save.id && (
                        <div className="mb-4 p-4 bg-green-50 rounded-lg border border-green-100">
                          <p className="text-sm font-medium text-green-800 mb-3">
                            Nuevas flashcards generadas ({regeneratedFlashcards.length}):
                          </p>
                          <div className="space-y-2 max-h-48 overflow-auto">
                            {regeneratedFlashcards.map((fc, i) => (
                              <div key={i} className="bg-white rounded p-2 text-sm">
                                <p className="font-medium text-slate-800">{fc.question}</p>
                                <p className="text-slate-600 mt-1">{fc.answer}</p>
                              </div>
                            ))}
                          </div>
                          <div className="flex gap-2 mt-3">
                            <button
                              onClick={() => setRegeneratedFlashcards(null)}
                              className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition"
                            >
                              Cancelar
                            </button>
                            <button
                              onClick={() => handleConfirmRegeneration(save.id)}
                              disabled={confirmingId === save.id}
                              className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50"
                            >
                              {confirmingId === save.id ? 'Guardando...' : 'Confirmar'}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleRegenerate(save.id)}
                          disabled={regeneratingId === save.id || !save.new_content_diff}
                          className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <span className={`material-symbols-outlined text-lg ${regeneratingId === save.id ? 'animate-spin' : ''}`}>
                            refresh
                          </span>
                          {regeneratingId === save.id ? 'Regenerando...' : 'Regenerar flashcards'}
                        </button>
                      </div>

                      {!save.new_content_diff && (
                        <p className="text-xs text-slate-400 mt-2">
                          Este guardado no tiene contenido nuevo registrado para regenerar
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NotebookHistory;
