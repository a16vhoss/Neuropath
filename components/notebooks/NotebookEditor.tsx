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
  const [scrolled, setScrolled] = useState(false);

  // Track scroll for sticky toolbar styling
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      setScrolled(container.scrollTop > 20);
    };
    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

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

      const loadingId = `ai-loading-${Date.now()}`;
      // Insert a placeholder with a unique attribute we can find later
      editor.commands.insertContent(`<p data-loading-id="${loadingId}" class="text-slate-400 italic">✨ ZpBot pensando...</p>`);

      try {
        const generatedHtml = await generateUnstructuredNoteContent(
          prompt,
          text,
          studySetName
        );

        // Find the loading node key/pos to delete it?
        // Since we just inserted it, it's at the cursor?
        // Better: Replace the entire "thinking" line.
        // Tiptap way: chain().focus().deleteRange... or deleteNode?
        // Let's try to delete the last node if it matches our ID, or just undo?
        // Undoing is risky if user typed.
        // The safest way without complex node search is to rely on Tiptap's selection if we haven't moved.
        // BUT, generating takes time. User might move.
        // Ideally we search for the node with data-loading-id.
        // For now, let's try a simple "delete last line" heuristic if we assume it's at end,
        // OR, just appending is fine IF we didn't insert the text.
        // User asked to REMOVE it.

        // Refined approach:
        // We will execute a command that finds the node with the attribute and replaces it.
        // Since we can't easily query DOM in commands without extension, let's use a simpler heuristic for now:
        // We will insert the content REPLACE the selection? No.

        // Let's use `editor.commands.deleteNode('paragraph')` if it's the current one?
        // Let's try traversing the JSON content? Too slow.

        // Practical solution:
        // We won't insert a persistent node. We will show a toast? No, user wants inline.
        // We will insert it, then when done, we look for the text "✨ ZpBot pensando..." and delete that range.

        const { doc } = editor.state;
        let pos = -1;
        doc.descendants((node, position) => {
          if (node.isText && node.text === '✨ ZpBot pensando...') {
            pos = position;
            return false; // Stop
          }
        });

        if (pos >= 0) {
          // Delete the paragraph containing this text. The text node is inside a paragraph.
          // pos is the start of text. Parent is pos - 1.
          // We want to delete the whole paragraph block.
          // Check if parent is paragraph?
          // Let's just delete the range of the text + 1 for now, or the block.
          const from = pos;
          const to = pos + '✨ ZpBot pensando...'.length;
          // Delete the parent paragraph if it only contains this text?
          // Let's just delete the text range + parent block padding?
          // Safe bet: Delete the range [pos-1, to+1] to kill the paragraph wrapper if empty?
          // Let's just delete the text content.
          editor.commands.deleteRange({ from: pos - 1, to: to + 1 }); // Delete paragraph wrapper roughly
        }

        editor.commands.insertContent(generatedHtml);

      } catch (err) {
        console.error("AI command failed", err);
        // Clean up loading text on error too
        const { doc } = editor.state;
        let pos = -1;
        doc.descendants((node, position) => {
          if (node.isText && node.text === '✨ ZpBot pensando...') {
            pos = position;
            return false;
          }
        });

        if (pos >= 0) {
          const to = pos + '✨ ZpBot pensando...'.length;
          editor.commands.deleteRange({ from: pos - 1, to: to + 1 });
        }

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
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-auto bg-white/40 custom-scrollbar relative"
      >
        <div className="max-w-5xl mx-auto my-0 bg-transparent min-h-screen relative flex flex-col">

          {/* Toolbar - Docked Sub-header (Fixed Visibility) */
            /* Adjusted top-26 md:top-28 to clear the App Header + Tabs so it docks correctly below them on scroll. */}
          <div className={`sticky top-24 md:top-32 z-30 transition-all duration-300 -mx-4 md:-mx-12 mb-6 border-b border-slate-100 bg-white/95 backdrop-blur-md shadow-sm`}>
            <div className="max-w-3xl mx-auto flex items-center justify-center gap-1 p-2 overflow-x-auto no-scrollbar">

              <ToolbarButton
                onClick={() => editor.chain().focus().toggleBold().run()}
                disabled={!editor.can().chain().focus().toggleBold().run()}
                isActive={editor.isActive('bold')}
                icon="format_bold"
                title="Negrita (Cmd+B)"
              />
              <ToolbarButton
                onClick={() => editor.chain().focus().toggleItalic().run()}
                disabled={!editor.can().chain().focus().toggleItalic().run()}
                isActive={editor.isActive('italic')}
                icon="format_italic"
                title="Cursiva (Cmd+I)"
              />
              <ToolbarButton
                onClick={() => editor.chain().focus().toggleUnderline().run()}
                disabled={!editor.can().chain().focus().toggleUnderline().run()}
                isActive={editor.isActive('underline')}
                icon="format_underlined"
                title="Subrayado (Cmd+U)"
              />
              <div className="w-px h-5 bg-slate-300/50 mx-2 flex-shrink-0" />
              <ToolbarButton
                onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                isActive={editor.isActive('heading', { level: 1 })}
                icon="format_h1"
                title="Título 1"
              />
              <ToolbarButton
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                isActive={editor.isActive('heading', { level: 2 })}
                icon="format_h2"
                title="Título 2"
              />
              <ToolbarButton
                onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                isActive={editor.isActive('heading', { level: 3 })}
                icon="format_h3"
                title="Título 3"
              />
              <div className="w-px h-5 bg-slate-300/50 mx-2 flex-shrink-0" />
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
              <div className="w-px h-5 bg-slate-300/50 mx-2 flex-shrink-0" />
              <ToolbarButton
                onClick={() => editor.chain().focus().toggleHighlight().run()}
                isActive={editor.isActive('highlight')}
                icon="ink_highlighter"
                title="Resaltar"
                className="text-amber-500 hover:bg-amber-50 hover:text-amber-600"
              />

              <div className="w-px h-5 bg-slate-300/50 mx-2 flex-shrink-0" />
              <ToolbarButton
                onClick={() => editor.chain().focus().undo().run()}
                disabled={!editor.can().chain().focus().undo().run()}
                icon="undo"
                title="Deshacer (Cmd+Z)"
              />
              <ToolbarButton
                onClick={() => editor.chain().focus().redo().run()}
                disabled={!editor.can().chain().focus().redo().run()}
                icon="redo"
                title="Rehacer (Cmd+Shift+Z)"
              />
            </div>
          </div>

          {/* Main Paper Container */}
          <div
            className="max-w-5xl mx-auto mt-6 mb-32 bg-transparent min-h-[calc(100vh-10rem)] relative px-4 md:px-12 cursor-text"
            onClick={(e) => {
              // Only focus if clicking the empty background, not the content itself
              if (e.target === e.currentTarget) {
                editor?.commands.focus('end');
              }
            }}
          >

            {/* Document Content Area */}
            <div
              className="prose prose-slate prose-lg max-w-none focus:outline-none 
                prose-headings:font-bold prose-headings:tracking-tight prose-headings:text-slate-900
                prose-h1:text-4xl prose-h2:text-3xl prose-h3:text-2xl 
                prose-p:text-slate-600 prose-p:leading-relaxed
                prose-blockquote:border-l-4 prose-blockquote:border-indigo-500 prose-blockquote:bg-indigo-50/30 prose-blockquote:py-1 prose-blockquote:px-4 prose-blockquote:rounded-r-lg prose-blockquote:not-italic
                prose-li:marker:text-slate-300
                [&_ul[data-type='taskList']]:list-none 
                [&_ul[data-type='taskList']]:pl-0 
                [&_ul[data-type='taskList']_li]:flex 
                [&_ul[data-type='taskList']_li]:items-start 
                [&_ul[data-type='taskList']_li]:gap-2
                [&_input[type='checkbox']]:mt-1.5
                [&_input[type='checkbox']]:appearance-none
                [&_input[type='checkbox']]:w-4
                [&_input[type='checkbox']]:h-4
                [&_input[type='checkbox']]:rounded-md
                [&_input[type='checkbox']]:border-slate-300
                [&_input[type='checkbox']]:text-indigo-600
                [&_input[type='checkbox']]:focus:ring-indigo-500
                "
            >
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

              <EditorContent editor={editor} />
            </div>
            <div className="h-20"></div> {/* Bottom spacer */}
          </div>
        </div>
      </div>

      {/* Floating Dock (Bottom Center) */}
      {canEdit && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 p-1.5 bg-white/90 backdrop-blur-xl rounded-full shadow-2xl border border-white/20 ring-1 ring-slate-900/5 animate-in slide-in-from-bottom-4 duration-500">

          {/* Quick Save (Draft) */}
          <button
            onClick={handleQuickSave}
            disabled={isSaving || !hasUnsavedChanges}
            className={`p-3 rounded-full transition-all duration-300 flex items-center justify-center ${hasUnsavedChanges
              ? 'bg-slate-50 text-slate-600 hover:bg-white hover:shadow-sm hover:text-indigo-600'
              : 'bg-transparent text-slate-300'
              }`}
            title={hasUnsavedChanges ? "Guardar borrador" : "Sin cambios"}
          >
            <span className="material-symbols-outlined text-[20px]">save_as</span>
          </button>

          <div className="w-px h-8 bg-slate-200/80 mx-1" />

          {/* Main Save & Generate Button */}
          <button
            onClick={handleSave}
            disabled={isSaving || isGenerating}
            className={`flex items-center gap-3 pl-5 pr-2 py-2 rounded-full transition-all duration-300 group ${isGenerating ? 'bg-indigo-600 cursor-wait' : 'bg-slate-900 hover:bg-indigo-600 hover:shadow-lg hover:shadow-indigo-500/30'
              } text-white`}
          >
            <div className="flex flex-col items-start">
              <span className="font-bold text-xs tracking-wide">
                {isGenerating ? 'GENERANDO...' : (isSaving ? 'GUARDANDO...' : 'GUARDAR TODO')}
              </span>
              <span className="text-[9px] font-medium opacity-80 uppercase tracking-wider">
                {isGenerating ? 'Creando Flashcards' : '+ Generar Flashcards'}
              </span>
            </div>
            <div className="w-9 h-9 bg-white/10 rounded-full flex items-center justify-center group-hover:scale-110 group-hover:bg-white/20 transition-all">
              {isGenerating || isSaving ? (
                <span className="material-symbols-outlined text-[18px] animate-spin">sync</span>
              ) : (
                <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
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
