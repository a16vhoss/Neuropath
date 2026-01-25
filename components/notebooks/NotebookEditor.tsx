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

const ToolbarButton = ({ onClick, isActive, icon, title, disabled, className }: any) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`p-1.5 rounded-lg transition-all text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed ${isActive ? 'bg-indigo-100 text-indigo-700 shadow-sm ring-1 ring-indigo-200' : ''
      } ${className}`}
    title={title}
  >
    <span className="material-symbols-outlined text-[20px]">{icon}</span>
  </button>
);

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
      Highlight,
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
    <div className="flex flex-col h-full bg-slate-50/50">
      {/* Header Minimalista */}
      <div className="flex items-center justify-between px-6 py-4 bg-white/80 backdrop-blur-md sticky top-0 z-20 border-b border-slate-100 transition-all">
        <div className="flex items-center gap-3">
          <button
            onClick={handleBack}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-all"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div className="flex flex-col">
            {/* Breadcrumb-like context */}
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-0.5">
              {studySetName}
            </span>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-indigo-500">book_2</span>
              <h2 className="font-bold text-slate-800 text-lg tracking-tight">{notebook.title}</h2>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Status Indicators */}
          <div className="flex items-center gap-3 mr-4">
            {hasUnsavedChanges && (
              <span className="text-xs font-medium text-amber-500 bg-amber-50 px-2 py-1 rounded-full flex items-center gap-1 animate-in fade-in">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                Editando
              </span>
            )}
            {saveMessage && (
              <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full animate-in fade-in slide-in-from-top-1">
                {saveMessage}
              </span>
            )}
          </div>

          <button
            onClick={() => setShowHistoryPanel(true)}
            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-all"
            title="Historial de versiones"
          >
            <span className="material-symbols-outlined">history</span>
          </button>
        </div>
      </div>

      {/* Main Scrollable Canvas */}
      <div className="flex-1 overflow-auto bg-white/40 custom-scrollbar">
        <div className="max-w-4xl mx-auto my-8 bg-white min-h-[85vh] shadow-sm rounded-xl border border-slate-100/50 relative flex flex-col transition-shadow hover:shadow-md duration-500">

          {/* Floating/Sticky Toolbar inside the page */}
          {canEdit && editor && (
            <div className="sticky top-0 z-10 px-4 py-3 bg-white/95 backdrop-blur-sm border-b border-slate-100 flex items-center gap-1 flex-wrap justify-center rounded-t-xl transition-all">
              <div className="flex items-center bg-slate-100/50 p-1 rounded-lg gap-0.5">
                <ToolbarButton
                  onClick={() => editor.chain().focus().toggleBold().run()}
                  isActive={editor.isActive('bold')}
                  icon="format_bold"
                  title="Negrita"
                />
                <ToolbarButton
                  onClick={() => editor.chain().focus().toggleItalic().run()}
                  isActive={editor.isActive('italic')}
                  icon="format_italic"
                  title="Cursiva"
                />
                <ToolbarButton
                  onClick={() => editor.chain().focus().toggleUnderline().run()}
                  isActive={editor.isActive('underline')}
                  icon="format_underlined"
                  title="Subrayado"
                />
                <ToolbarButton
                  onClick={() => editor.chain().focus().toggleHighlight().run()}
                  isActive={editor.isActive('highlight')}
                  icon="ink_highlighter"
                  title="Resaltar"
                  className={editor.isActive('highlight') ? 'text-amber-500 bg-amber-100' : ''}
                />
              </div>

              <div className="w-px h-5 bg-slate-200 mx-2" />

              <div className="flex items-center bg-slate-100/50 p-1 rounded-lg gap-0.5">
                <ToolbarButton
                  onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                  isActive={editor.isActive('heading', { level: 1 })}
                  icon="format_h1"
                  title="Título Grande"
                />
                <ToolbarButton
                  onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                  isActive={editor.isActive('heading', { level: 2 })}
                  icon="format_h2"
                  title="Subtítulo"
                />
                <ToolbarButton
                  onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                  isActive={editor.isActive('heading', { level: 3 })}
                  icon="format_h3"
                  title="Título Pequeño"
                />
              </div>

              <div className="w-px h-5 bg-slate-200 mx-2" />

              <div className="flex items-center bg-slate-100/50 p-1 rounded-lg gap-0.5">
                <ToolbarButton
                  onClick={() => editor.chain().focus().toggleBulletList().run()}
                  isActive={editor.isActive('bulletList')}
                  icon="format_list_bulleted"
                  title="Viñetas"
                />
                <ToolbarButton
                  onClick={() => editor.chain().focus().toggleOrderedList().run()}
                  isActive={editor.isActive('orderedList')}
                  icon="format_list_numbered"
                  title="Numeración"
                />
                <ToolbarButton
                  onClick={() => editor.chain().focus().toggleTaskList().run()}
                  isActive={editor.isActive('taskList')}
                  icon="check_box"
                  title="Checklist"
                />
              </div>

              <div className="w-px h-5 bg-slate-200 mx-2" />

              <div className="flex items-center bg-slate-100/50 p-1 rounded-lg gap-0.5">
                <ToolbarButton
                  onClick={() => editor.chain().focus().undo().run()}
                  disabled={!editor.can().undo()}
                  icon="undo"
                  title="Deshacer"
                />
                <ToolbarButton
                  onClick={() => editor.chain().focus().redo().run()}
                  disabled={!editor.can().redo()}
                  icon="redo"
                  title="Rehacer"
                />
              </div>
            </div>
          )}

          {/* Document Content Area */}
          <div className="flex-1 px-12 py-8 md:px-16 md:py-12 cursor-text" onClick={() => editor?.commands.focus()}>
            {editor && (
              <BubbleMenu editor={editor} tippyOptions={{ duration: 100, maxWidth: 400 }} className="flex items-center bg-slate-800 text-white rounded-full shadow-2xl py-1 px-2 gap-1 animate-in zoom-in-95 duration-100">
                <button onClick={() => editor.chain().focus().toggleBold().run()} className={`p-1.5 rounded-full hover:bg-white/20 transition ${editor.isActive('bold') ? 'text-indigo-300' : 'text-slate-300'}`}><span className="material-symbols-outlined text-[18px]">format_bold</span></button>
                <button onClick={() => editor.chain().focus().toggleItalic().run()} className={`p-1.5 rounded-full hover:bg-white/20 transition ${editor.isActive('italic') ? 'text-indigo-300' : 'text-slate-300'}`}><span className="material-symbols-outlined text-[18px]">format_italic</span></button>
                <button onClick={() => editor.chain().focus().toggleHighlight().run()} className={`p-1.5 rounded-full hover:bg-white/20 transition ${editor.isActive('highlight') ? 'text-amber-400' : 'text-slate-300'}`}><span className="material-symbols-outlined text-[18px]">ink_highlighter</span></button>
                <div className="w-px h-4 bg-white/20 mx-1"></div>
                <button onClick={() => { window.dispatchEvent(new CustomEvent('notebook-ai-command', { detail: { action: 'expand' } })) }} className="flex items-center gap-1 pl-1 pr-2 py-0.5 rounded-full hover:bg-indigo-600 transition text-xs font-medium bg-indigo-500/50 text-indigo-100">
                  <span className="material-symbols-outlined text-[14px]">auto_awesome</span> Expandir
                </button>
              </BubbleMenu>
            )}

            <EditorContent
              editor={editor}
              className="prose prose-lg prose-slate max-w-none focus:outline-none
                prose-headings:font-bold prose-headings:tracking-tight prose-headings:text-slate-800
                prose-p:text-slate-600 prose-p:leading-relaxed
                prose-a:text-indigo-600 prose-a:no-underline hover:prose-a:underline
                prose-blockquote:border-l-4 prose-blockquote:border-indigo-400 prose-blockquote:bg-slate-50 prose-blockquote:py-2 prose-blockquote:px-4 prose-blockquote:not-italic prose-blockquote:rounded-r-lg
                prose-li:marker:text-slate-400
                [&_.ProseMirror]:min-h-[500px]
                [&_.ProseMirror]:focus:outline-none
                [&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]
                [&_.ProseMirror_p.is-editor-empty:first-child::before]:text-slate-300
                [&_.ProseMirror_p.is-editor-empty:first-child::before]:font-light
                [&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left
                [&_.ProseMirror_p.is-editor-empty:first-child::before]:h-0
                [&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none
                /* Task List Styles */
                [&_ul[data-type='taskList']]:list-none
                [&_ul[data-type='taskList']]:p-0
                [&_li[data-type='taskItem']]:flex
                [&_li[data-type='taskItem']]:items-start
                [&_li[data-type='taskItem']]:gap-3
                [&_li[data-type='taskItem']]:my-2
                [&_input[type='checkbox']]:mt-1.5
                [&_input[type='checkbox']]:w-4
                [&_input[type='checkbox']]:h-4
                [&_input[type='checkbox']]:rounded-md
                [&_input[type='checkbox']]:border-slate-300
                [&_input[type='checkbox']]:text-indigo-600
                [&_input[type='checkbox']]:focus:ring-indigo-500
                "
            />
          </div>
        </div>
        <div className="h-20"></div> {/* Bottom spacer */}
      </div>

      {/* Floating Action Bar (Bottom Right) */}
      {canEdit && (
        <div className="fixed bottom-8 right-8 flex flex-col gap-3 z-30">
          {/* Quick Draft Button */}
          <button
            onClick={handleQuickSave}
            disabled={isSaving || !hasUnsavedChanges}
            className={`p-4 rounded-full shadow-lg transition-all duration-300 flex items-center justify-center group ${hasUnsavedChanges ? 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200' : 'bg-white/0 text-transparent shadow-none pointer-events-none'
              }`}
            title="Guardar borrador"
          >
            <span className="material-symbols-outlined group-hover:scale-110 transition-transform">save_as</span>
          </button>


          {/* Main Save Button */}
          <button
            onClick={handleSave}
            disabled={isSaving || isGenerating}
            className={`group flex items-center gap-3 pl-5 pr-2 py-2 rounded-full shadow-xl transition-all duration-300 ${isGenerating ? 'bg-indigo-600 cursor-wait' : 'bg-indigo-600 hover:bg-indigo-700 hover:scale-105 hover:shadow-2xl'
              } text-white`}
          >
            <div className="flex flex-col items-start min-w-[100px]">
              <span className="font-bold text-sm">
                {isGenerating ? 'Generando...' : (isSaving ? 'Guardando...' : 'Guardar Todo')}
              </span>
              <span className="text-[10px] opacity-80 font-medium">
                {isGenerating ? 'Creando Flashcards' : '+ Generar Flashcards'}
              </span>
            </div>
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center group-hover:rotate-12 transition-transform">
              {isGenerating || isSaving ? (
                <span className="material-symbols-outlined animate-spin">sync</span>
              ) : (
                <span className="material-symbols-outlined">auto_awesome</span>
              )}
            </div>
          </button>
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
