import { ReactRenderer } from '@tiptap/react';
import tippy from 'tippy.js';
import { CommandList } from './CommandList';
import { searchInternet } from '../../../services/geminiService'; // We might use this later for "Research" command

export const suggestion = {
    items: ({ query }: { query: string }) => {
        return [
            {
                title: 'Texto',
                aliases: ['p', 'paragraph', 'texto'],
                description: 'Empieza a escribir texto plano.',
                icon: <span className="material-symbols-outlined">text_fields</span>,
                command: ({ editor, range }) => {
                    editor.chain().focus().deleteRange(range).toggleNode('paragraph', 'paragraph').run();
                },
            },
            {
                title: 'Título 1',
                aliases: ['h1', '1', 'titulo 1', 'header 1'],
                description: 'Encabezado de sección grande.',
                icon: <span className="material-symbols-outlined">format_h1</span>,
                command: ({ editor, range }) => {
                    editor.chain().focus().deleteRange(range).setNode('heading', { level: 1 }).run();
                },
            },
            {
                title: 'Título 2',
                aliases: ['h2', '2', 'titulo 2', 'header 2'],
                description: 'Encabezado de subsección.',
                icon: <span className="material-symbols-outlined">format_h2</span>,
                command: ({ editor, range }) => {
                    editor.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run();
                },
            },
            {
                title: 'Título 3',
                aliases: ['h3', '3', 'titulo 3', 'header 3'],
                description: 'Encabezado pequeño.',
                icon: <span className="material-symbols-outlined">format_h3</span>,
                command: ({ editor, range }) => {
                    editor.chain().focus().deleteRange(range).setNode('heading', { level: 3 }).run();
                },
            },
            {
                title: 'Lista',
                aliases: ['ul', 'list', 'bullet'],
                description: 'Crear una lista simple.',
                icon: <span className="material-symbols-outlined">format_list_bulleted</span>,
                command: ({ editor, range }) => {
                    editor.chain().focus().deleteRange(range).toggleBulletList().run();
                },
            },
            {
                title: 'Lista Numerada',
                aliases: ['ol', 'ordered', 'numbered', '1.'],
                description: 'Crear una lista con números.',
                icon: <span className="material-symbols-outlined">format_list_numbered</span>,
                command: ({ editor, range }) => {
                    editor.chain().focus().deleteRange(range).toggleOrderedList().run();
                },
            },
            {
                title: 'Lista de Tareas',
                aliases: ['todo', 'task', 'check', '[]'],
                description: 'Lista con casillas de verificación.',
                icon: <span className="material-symbols-outlined">check_box</span>,
                command: ({ editor, range }) => {
                    editor.chain().focus().deleteRange(range).toggleTaskList().run();
                },
            },
            {
                title: 'Cita',
                aliases: ['quote', 'cita', '>'],
                description: 'Capturar una cita o énfasis.',
                icon: <span className="material-symbols-outlined">format_quote</span>,
                command: ({ editor, range }) => {
                    editor.chain().focus().deleteRange(range).toggleBlockquote().run();
                },
            },
            {
                title: '✨ AI: Expandir Idea',
                aliases: ['ai', 'expand', 'expandir', 'mas'],
                description: 'Deja que ZpBot desarrolle este punto.',
                icon: <span className="material-symbols-outlined text-indigo-500">auto_awesome</span>,
                command: ({ editor, range }) => {
                    // Just delete the Slash Command trigger text. NotebookEditor handles the rest.
                    editor.chain().focus().deleteRange(range).run();
                    window.dispatchEvent(new CustomEvent('notebook-ai-command', { detail: { action: 'expand' } }));
                },
            },
            {
                title: '📝 AI: Resumir',
                aliases: ['ai', 'summarize', 'resumir', 'resume'],
                description: 'Resumir lo escrito arriba.',
                icon: <span className="material-symbols-outlined text-indigo-500">summarize</span>,
                command: ({ editor, range }) => {
                    // Just delete the Slash Command trigger text. NotebookEditor handles the rest.
                    editor.chain().focus().deleteRange(range).run();
                    window.dispatchEvent(new CustomEvent('notebook-ai-command', { detail: { action: 'summarize' } }));
                },
            },
        ].filter((item) => {
            const q = query.toLowerCase();
            return item.title.toLowerCase().startsWith(q) ||
                (item.aliases && item.aliases.some(alias => alias.startsWith(q)));
        });
    },

    render: () => {
        let component: ReactRenderer;
        let popup: any;

        return {
            onStart: (props: any) => {
                component = new ReactRenderer(CommandList, {
                    props,
                    editor: props.editor,
                });

                if (!props.clientRect) {
                    return;
                }

                popup = tippy('body', {
                    getReferenceClientRect: props.clientRect,
                    appendTo: () => document.body,
                    content: component.element,
                    showOnCreate: true,
                    interactive: true,
                    trigger: 'manual',
                    placement: 'bottom-start',
                });
            },

            onUpdate(props: any) {
                component.updateProps(props);

                if (!props.clientRect) {
                    return;
                }

                popup[0].setProps({
                    getReferenceClientRect: props.clientRect,
                });
            },

            onKeyDown(props: any) {
                if (props.event.key === 'Escape') {
                    popup[0].hide();
                    return true;
                }

                return component.ref?.onKeyDown(props);
            },

            onExit() {
                popup[0].destroy();
                component.destroy();
            },
        };
    },
};
