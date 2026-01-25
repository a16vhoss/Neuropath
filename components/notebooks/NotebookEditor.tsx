import React, { useState, useEffect, useCallback } from 'react';
import { useEditor, EditorContent, BubbleMenu } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Highlight from '@tiptap/extension-highlight';
import Underline from '@tiptap/extension-underline';
import BubbleMenuExtension from '@tiptap/extension-bubble-menu';
import SlashCommand from './extensions/SlashCommand';
import { suggestion } from './extensions/suggestion';
import { Notebook, FlashcardPreview, NotebookSaveResult } from '../../types';
import {
  updateNotebook,
  prepareNotebookSave,
  saveNotebookContentOnly,
} from '../../services/notebookService';
import { generateUnstructuredNoteContent } from '../../services/geminiService';
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
        placeholder: 'Empieza a escribir tus notas aquí... Usa "/" para comandos rápidos.',
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      Highlight.configure({
        multiline: true,
      }),
      Underline,
      SlashCommand.configure({
        suggestion,
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

  // Handle AI Commands from Slash Menu
  useEffect(() => {
    const handleAICommand = async (e: any) => {
      if (!editor) return;
      const action = e.detail?.action;

      const selection = editor.state.selection;
      const text = editor.state.doc.textBetween(Math.max(0, selection.from - 2000), selection.to, '\n');

      let prompt = '';
      if (action === 'expand') {
        prompt = "Expande la siguiente idea con más detalle y profundidad académica:";
      } else if (action === 'summarize') {
        prompt = "Resume el siguiente texto en puntos clave:";
      }

      if (!prompt) return;

      const loadingId = `loading-${Date.now()}`;
      editor.commands.insertContent(`<p class="text-slate-400 italic">✨ ZpBot pensando...</p>`);

      try {
        const generatedHtml = await generateUnstructuredNoteContent(
          prompt,
          text,
          studySetName
        );

        // Remove the "Thinking..." text by deleting the last line or undoing? 
        // Simplest: The generated content is appended. 
        // User can delete the "Thinking...". 
        // Better: Select the "Thinking..." node and replace. 
        // For MVP, just append.

        editor.commands.insertContent(generatedHtml);

      } catch (err) {
        console.error("AI command failed", err);
        editor.commands.insertContent('<p class="text-red-400">Error al generar.</p>');
      }
    };

    window.addEventListener('notebook-ai-command', handleAICommand);
    return () => window.removeEventListener('notebook-ai-command', handleAICommand);
  }, [editor, studySetName]);

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
    className?: string;
  }> = ({ onClick, isActive, icon, title, disabled, className }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-2 rounded-lg transition ${isActive
        ? 'bg-primary/10 text-primary'
        : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className || ''}`}
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
      <div className="flex-1 bg-white rounded-2xl border border-slate-100 overflow-hidden flex flex-col relative group">
        {/* Toolbar */}
        {canEdit && editor && (
          <div className="flex items-center gap-1 p-2 border-b border-slate-100 bg-slate-50 flex-wrap sticky top-0 z-10">
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
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              isActive={editor.isActive('underline')}
              icon="format_underlined"
              title="Subrayado (Ctrl+U)"
            />
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleStrike().run()}
              isActive={editor.isActive('strike')}
              icon="strikethrough_s"
              title="Tachado"
            />
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleHighlight().run()}
              isActive={editor.isActive('highlight')}
              icon="ink_highlighter"
              title="Resaltar"
              className={editor.isActive('highlight') ? 'text-amber-500 bg-amber-50' : ''}
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
              title="Lista con viñetas"
            />
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              isActive={editor.isActive('orderedList')}
              icon="format_list_numbered"
              title="Lista numerada"
            />
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleTaskList().run()}
              isActive={editor.isActive('taskList')}
              icon="check_box"
              title="Lista de tareas"
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
              title="Bloque de código"
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

        {/* Editor Content with Bubble Menu */}
        <div className="flex-1 overflow-auto p-6 relative">
          {editor && (
            <BubbleMenu editor={editor} tippyOptions={{ duration: 100 }} className="flex bg-slate-900 text-white rounded-lg shadow-xl overflow-hidden p-1 gap-1">
              <button
                onClick={() => editor.chain().focus().toggleBold().run()}
                className={`p-1.5 rounded hover:bg-slate-700 transition ${editor.isActive('bold') ? 'bg-primary text-white' : 'text-slate-300'}`}
              >
                <span className="material-symbols-outlined text-lg">format_bold</span>
              </button>
              <button
                onClick={() => editor.chain().focus().toggleItalic().run()}
                className={`p-1.5 rounded hover:bg-slate-700 transition ${editor.isActive('italic') ? 'bg-primary text-white' : 'text-slate-300'}`}
              >
                <span className="material-symbols-outlined text-lg">format_italic</span>
              </button>
              <button
                onClick={() => editor.chain().focus().toggleUnderline().run()}
                className={`p-1.5 rounded hover:bg-slate-700 transition ${editor.isActive('underline') ? 'bg-primary text-white' : 'text-slate-300'}`}
              >
                <span className="material-symbols-outlined text-lg">format_underlined</span>
              </button>
              <button
                onClick={() => editor.chain().focus().toggleHighlight().run()}
                className={`p-1.5 rounded hover:bg-slate-700 transition ${editor.isActive('highlight') ? 'bg-amber-500 text-white' : 'text-slate-300'}`}
              >
                <span className="material-symbols-outlined text-lg">ink_highlighter</span>
              </button>
            </BubbleMenu>
          )}

          <EditorContent
            editor={editor}
            className="prose prose-slate max-w-none min-h-[400px] focus:outline-none
              [&_.ProseMirror]:min-h-[400px]
              [&_.ProseMirror]:focus:outline-none
              [&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]
              [&_.ProseMirror_p.is-editor-empty:first-child::before]:text-slate-400
              [&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left
              [&_.ProseMirror_p.is-editor-empty:first-child::before]:h-0
              [&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none
              /* Task List Styles */
              [&_ul[data-type='taskList']]:list-none
              [&_ul[data-type='taskList']]:p-0
              [&_li[data-type='taskItem']]:flex
              [&_li[data-type='taskItem']]:items-start
              [&_li[data-type='taskItem']]:gap-2
              [&_li[data-type='taskItem']]:my-1
              [&_input[type='checkbox']]:mt-1.5
              [&_input[type='checkbox']]:cursor-pointer
              [&_input[type='checkbox']]:accent-primary
              "
          />
        </div>
      </div>

      {/* Bottom Action Bar */}
      {canEdit && (
        <div className="flex items-center justify-between mt-4 p-4 bg-white rounded-xl border border-slate-100">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <span className="material-symbols-outlined text-base">info</span>
            Al guardar se generarán flashcards del contenido nuevo
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
