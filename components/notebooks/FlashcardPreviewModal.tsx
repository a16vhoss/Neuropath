import React, { useState } from 'react';
import { FlashcardPreview } from '../../types';
import {
  confirmNotebookSave,
  prepareNotebookSave,
} from '../../services/notebookService';

interface FlashcardPreviewModalProps {
  flashcards: FlashcardPreview[];
  newContentPreview: string;
  notebookId: string;
  studySetId: string;
  studySetName: string;
  currentContent: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const FlashcardPreviewModal: React.FC<FlashcardPreviewModalProps> = ({
  flashcards: initialFlashcards,
  newContentPreview,
  notebookId,
  studySetId,
  studySetName,
  currentContent,
  onConfirm,
  onCancel,
}) => {
  const [flashcards, setFlashcards] = useState<FlashcardPreview[]>(
    initialFlashcards.map((fc, i) => ({ ...fc, tempId: `temp-${i}` }))
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [showNewContent, setShowNewContent] = useState(false);

  // Edit a flashcard
  const handleEditFlashcard = (tempId: string, field: 'question' | 'answer', value: string) => {
    setFlashcards(prev =>
      prev.map(fc =>
        fc.tempId === tempId ? { ...fc, [field]: value } : fc
      )
    );
  };

  // Delete a flashcard from preview
  const handleDeleteFlashcard = (tempId: string) => {
    setFlashcards(prev => prev.filter(fc => fc.tempId !== tempId));
  };

  // Regenerate all flashcards
  const handleRegenerate = async () => {
    setIsRegenerating(true);
    try {
      const result = await prepareNotebookSave(
        notebookId,
        currentContent,
        studySetId,
        studySetName
      );

      if (result.hasNewContent && result.flashcardPreviews.length > 0) {
        setFlashcards(
          result.flashcardPreviews.map((fc, i) => ({ ...fc, tempId: `temp-${i}` }))
        );
      }
    } catch (error) {
      console.error('Error regenerating:', error);
    } finally {
      setIsRegenerating(false);
    }
  };

  // Confirm and save flashcards
  const handleConfirm = async () => {
    if (flashcards.length === 0) {
      onCancel();
      return;
    }

    setIsConfirming(true);
    try {
      await confirmNotebookSave(
        notebookId,
        studySetId,
        currentContent,
        newContentPreview,
        flashcards
      );
      onConfirm();
    } catch (error) {
      console.error('Error confirming save:', error);
      alert('Error al guardar las flashcards');
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                Preview de Flashcards
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                {flashcards.length} flashcard{flashcards.length !== 1 ? 's' : ''} generada{flashcards.length !== 1 ? 's' : ''} del contenido nuevo
              </p>
            </div>
            <button
              onClick={() => setShowNewContent(!showNewContent)}
              className="flex items-center gap-2 text-sm text-primary hover:underline"
            >
              <span className="material-symbols-outlined text-base">
                {showNewContent ? 'visibility_off' : 'visibility'}
              </span>
              {showNewContent ? 'Ocultar' : 'Ver'} contenido nuevo
            </button>
          </div>

          {/* New content preview */}
          {showNewContent && (
            <div className="mt-4 p-4 bg-blue-50 rounded-xl border border-blue-100">
              <p className="text-sm font-medium text-blue-800 mb-2">
                Contenido nuevo detectado:
              </p>
              <p className="text-sm text-blue-700 whitespace-pre-wrap max-h-32 overflow-auto">
                {newContentPreview.slice(0, 500)}
                {newContentPreview.length > 500 && '...'}
              </p>
            </div>
          )}
        </div>

        {/* Flashcard List */}
        <div className="flex-1 overflow-auto p-6">
          {flashcards.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <span className="material-symbols-outlined text-4xl mb-2">
                sentiment_dissatisfied
              </span>
              <p>No hay flashcards para guardar</p>
            </div>
          ) : (
            <div className="space-y-4">
              {flashcards.map((fc, index) => (
                <div
                  key={fc.tempId}
                  className="bg-slate-50 rounded-xl p-4 border border-slate-100"
                >
                  <div className="flex items-start justify-between mb-3">
                    <span className="text-xs font-medium text-slate-400 uppercase">
                      #{index + 1} - {fc.category}
                    </span>
                    <div className="flex items-center gap-1">
                      {editingId === fc.tempId ? (
                        <button
                          onClick={() => setEditingId(null)}
                          className="p-1 text-green-600 hover:bg-green-50 rounded"
                        >
                          <span className="material-symbols-outlined text-lg">check</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => setEditingId(fc.tempId!)}
                          className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded"
                        >
                          <span className="material-symbols-outlined text-lg">edit</span>
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteFlashcard(fc.tempId!)}
                        className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded"
                      >
                        <span className="material-symbols-outlined text-lg">close</span>
                      </button>
                    </div>
                  </div>

                  {editingId === fc.tempId ? (
                    // Edit mode
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-medium text-slate-500 mb-1 block">
                          Pregunta
                        </label>
                        <textarea
                          value={fc.question}
                          onChange={(e) =>
                            handleEditFlashcard(fc.tempId!, 'question', e.target.value)
                          }
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
                          rows={2}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-500 mb-1 block">
                          Respuesta
                        </label>
                        <textarea
                          value={fc.answer}
                          onChange={(e) =>
                            handleEditFlashcard(fc.tempId!, 'answer', e.target.value)
                          }
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
                          rows={3}
                        />
                      </div>
                    </div>
                  ) : (
                    // View mode
                    <div className="space-y-2">
                      <div>
                        <p className="text-xs font-medium text-slate-500">Pregunta:</p>
                        <p className="text-slate-900">{fc.question}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-slate-500">Respuesta:</p>
                        <p className="text-slate-700">{fc.answer}</p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-100 bg-slate-50">
          <div className="flex items-center justify-between">
            <button
              onClick={handleRegenerate}
              disabled={isRegenerating || isConfirming}
              className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-xl transition disabled:opacity-50"
            >
              <span className={`material-symbols-outlined text-lg ${isRegenerating ? 'animate-spin' : ''}`}>
                refresh
              </span>
              {isRegenerating ? 'Regenerando...' : 'Regenerar'}
            </button>

            <div className="flex items-center gap-3">
              <button
                onClick={onCancel}
                disabled={isConfirming}
                className="px-4 py-2 text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-100 transition disabled:opacity-50"
              >
                Guardar sin flashcards
              </button>
              <button
                onClick={handleConfirm}
                disabled={isConfirming || flashcards.length === 0}
                className="flex items-center gap-2 px-6 py-2 bg-primary text-white rounded-xl hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isConfirming ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-lg">sync</span>
                    Guardando...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-lg">check</span>
                    Confirmar {flashcards.length} flashcard{flashcards.length !== 1 ? 's' : ''}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FlashcardPreviewModal;
