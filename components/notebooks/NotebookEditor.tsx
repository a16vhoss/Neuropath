import React, { useState, useEffect, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Notebook, FlashcardPreview, NotebookSaveResult } from '../../types';
import {
  updateNotebook,
  prepareNotebookSave,
  saveNotebookContentOnly,
} from '../../services/notebookService';
import FlashcardPreviewModal from './FlashcardPreviewModal';
import NotebookHistory from './NotebookHistory';

interface NotebookEditorProps {
  notebook: Notebook;
  studySetId: string;
  studySetName: string;
  canEdit: boolean;
  onBack: () => void;
  onSaveComplete: () => void;
}

const NotebookEditor: React.FC<NotebookEditorProps> = ({
  notebook,
  studySetId,
  studySetName,
  canEdit,
  onBack,
  onSaveComplete,
}) => {
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const [saveResult, setSaveResult] = useState<NotebookSaveResult | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [currentContent, setCurrentContent] = useState(notebook.content || '');

  // TipTap Editor
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Placeholder.configure({
        placeholder: 'Empieza a escribir tus notas aqui...',
      }),
    ],
    content: notebook.content || '',
    editable: canEdit,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      setCurrentContent(html);
      setHasUnsavedChanges(html !== notebook.content);
    },
  });

  // Update editor content when notebook changes
  useEffect(() => {
    if (editor && notebook.content !== editor.getHTML()) {
      editor.commands.setContent(notebook.content || '');
      setCurrentContent(notebook.content || '');
      setHasUnsavedChanges(false);
    }
  }, [notebook.id]);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Handle save (with flashcard generation)
  const handleSave = async () => {
    if (!editor) return;

    const content = editor.getHTML();

    // First, save the content
    setIsSaving(true);
    try {
      await saveNotebookContentOnly(notebook.id, content);
    } catch (error) {
      console.error('Error saving content:', error);
      setSaveMessage('Error al guardar');
      setIsSaving(false);
      return;
    }

    // Then, check for new content and generate flashcards
    setIsGenerating(true);
    try {
      const result = await prepareNotebookSave(
        notebook.id,
        content,
        studySetId,
        studySetName
      );

      if (result.hasNewContent && result.flashcardPreviews.length > 0) {
        setSaveResult({ ...result, newContentDiff: result.newContentDiff });
        setShowPreviewModal(true);
      } else {
        // No new content - just show success
        setSaveMessage('Guardado (sin contenido nuevo para flashcards)');
        setHasUnsavedChanges(false);
        onSaveComplete();
      }
    } catch (error) {
      console.error('Error preparing save:', error);
      setSaveMessage('Guardado, pero error al generar flashcards');
      setHasUnsavedChanges(false);
    } finally {
      setIsSaving(false);
      setIsGenerating(false);
    }
  };

  // Handle quick save (just content, no flashcards)
  const handleQuickSave = async () => {
    if (!editor) return;

    setIsSaving(true);
    try {
      await saveNotebookContentOnly(notebook.id, editor.getHTML());
      setSaveMessage('Borrador guardado');
      setHasUnsavedChanges(false);
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      console.error('Error quick saving:', error);
      setSaveMessage('Error al guardar');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle flashcard generation complete
  const handleFlashcardsConfirmed = () => {
    setShowPreviewModal(false);
    setSaveResult(null);
    setHasUnsavedChanges(false);
    setSaveMessage('Guardado con flashcards generadas');
    onSaveComplete();
    setTimeout(() => setSaveMessage(null), 3000);
  };

  // Handle back with unsaved changes check
  const handleBack = () => {
    if (hasUnsavedChanges) {
      if (!confirm('Tienes cambios sin guardar. ¿Salir de todos modos?')) {
        return;
      }
    }
    onBack();
  };

  // Toolbar button component
  const ToolbarButton: React.FC<{
    onClick: () => void;
    isActive?: boolean;
    icon: string;
    title: string;
    disabled?: boolean;
  }> = ({ onClick, isActive, icon, title, disabled }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-2 rounded-lg transition ${
        isActive
          ? 'bg-primary/10 text-primary'
          : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <span className="material-symbols-outlined text-xl">{icon}</span>
    </button>
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={handleBack}
            className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div>
            <h2 className="font-bold text-slate-900 text-lg">{notebook.title}</h2>
            {notebook.description && (
              <p className="text-sm text-slate-500">{notebook.description}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Unsaved changes indicator */}
          {hasUnsavedChanges && (
            <span className="text-sm text-amber-600 flex items-center gap-1">
              <span className="material-symbols-outlined text-base">edit</span>
              Sin guardar
            </span>
          )}

          {/* Save message */}
          {saveMessage && (
            <span className="text-sm text-green-600 flex items-center gap-1">
              <span className="material-symbols-outlined text-base">check_circle</span>
              {saveMessage}
            </span>
          )}

          {/* History button */}
          <button
            onClick={() => setShowHistoryPanel(true)}
            className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition"
            title="Ver historial"
          >
            <span className="material-symbols-outlined">history</span>
          </button>
        </div>
      </div>

      {/* Editor Container */}
      <div className="flex-1 bg-white rounded-2xl border border-slate-100 overflow-hidden flex flex-col">
        {/* Toolbar */}
        {canEdit && editor && (
          <div className="flex items-center gap-1 p-2 border-b border-slate-100 bg-slate-50 flex-wrap">
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleBold().run()}
              isActive={editor.isActive('bold')}
              icon="format_bold"
              title="Negrita (Ctrl+B)"
            />
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleItalic().run()}
              isActive={editor.isActive('italic')}
              icon="format_italic"
              title="Cursiva (Ctrl+I)"
            />
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleStrike().run()}
              isActive={editor.isActive('strike')}
              icon="strikethrough_s"
              title="Tachado"
            />

            <div className="w-px h-6 bg-slate-200 mx-1" />

            <ToolbarButton
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              isActive={editor.isActive('heading', { level: 1 })}
              icon="format_h1"
              title="Titulo 1"
            />
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              isActive={editor.isActive('heading', { level: 2 })}
              icon="format_h2"
              title="Titulo 2"
            />
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
              isActive={editor.isActive('heading', { level: 3 })}
              icon="format_h3"
              title="Titulo 3"
            />

            <div className="w-px h-6 bg-slate-200 mx-1" />

            <ToolbarButton
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              isActive={editor.isActive('bulletList')}
              icon="format_list_bulleted"
              title="Lista con vinetas"
            />
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              isActive={editor.isActive('orderedList')}
              icon="format_list_numbered"
              title="Lista numerada"
            />
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
              isActive={editor.isActive('blockquote')}
              icon="format_quote"
              title="Cita"
            />
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleCodeBlock().run()}
              isActive={editor.isActive('codeBlock')}
              icon="code"
              title="Bloque de codigo"
            />

            <div className="w-px h-6 bg-slate-200 mx-1" />

            <ToolbarButton
              onClick={() => editor.chain().focus().undo().run()}
              disabled={!editor.can().undo()}
              icon="undo"
              title="Deshacer (Ctrl+Z)"
            />
            <ToolbarButton
              onClick={() => editor.chain().focus().redo().run()}
              disabled={!editor.can().redo()}
              icon="redo"
              title="Rehacer (Ctrl+Y)"
            />
          </div>
        )}

        {/* Editor Content */}
        <div className="flex-1 overflow-auto p-6">
          <EditorContent
            editor={editor}
            className="prose prose-slate max-w-none min-h-[400px] focus:outline-none
              [&_.ProseMirror]:min-h-[400px]
              [&_.ProseMirror]:focus:outline-none
              [&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]
              [&_.ProseMirror_p.is-editor-empty:first-child::before]:text-slate-400
              [&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left
              [&_.ProseMirror_p.is-editor-empty:first-child::before]:h-0
              [&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none"
          />
        </div>
      </div>

      {/* Bottom Action Bar */}
      {canEdit && (
        <div className="flex items-center justify-between mt-4 p-4 bg-white rounded-xl border border-slate-100">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <span className="material-symbols-outlined text-base">info</span>
            Al guardar se generaran flashcards del contenido nuevo
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleQuickSave}
              disabled={isSaving || !hasUnsavedChanges}
              className="px-4 py-2 text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Guardar borrador
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || isGenerating}
              className="flex items-center gap-2 px-6 py-2 bg-primary text-white rounded-xl hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-xl">sync</span>
                  Generando...
                </>
              ) : isSaving ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-xl">sync</span>
                  Guardando...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-xl">save</span>
                  Guardar y Generar Flashcards
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Flashcard Preview Modal */}
      {showPreviewModal && saveResult && (
        <FlashcardPreviewModal
          flashcards={saveResult.flashcardPreviews}
          newContentPreview={saveResult.newContentDiff}
          notebookId={notebook.id}
          studySetId={studySetId}
          studySetName={studySetName}
          currentContent={currentContent}
          onConfirm={handleFlashcardsConfirmed}
          onCancel={() => {
            setShowPreviewModal(false);
            setSaveResult(null);
            setHasUnsavedChanges(false);
            setSaveMessage('Guardado sin flashcards');
            onSaveComplete();
          }}
        />
      )}

      {/* History Panel */}
      {showHistoryPanel && (
        <NotebookHistory
          notebookId={notebook.id}
          studySetId={studySetId}
          studySetName={studySetName}
          onClose={() => setShowHistoryPanel(false)}
        />
      )}
    </div>
  );
};

export default NotebookEditor;
