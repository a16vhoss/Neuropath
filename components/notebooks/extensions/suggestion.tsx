import { ReactRenderer } from '@tiptap/react';
import tippy from 'tippy.js';
import { CommandList } from './CommandList';
import { searchInternet } from '../../../services/geminiService'; // We might use this later for "Research" command

export const suggestion = {
    items: ({ query }: { query: string }) => {
        return [
            {
                title: 'Texto',
                description: 'Empieza a escribir texto plano.',
                icon: <span className="material-symbols-outlined">text_fields</span>,
                command: ({ editor, range }) => {
                    editor.chain().focus().deleteRange(range).toggleNode('paragraph', 'paragraph').run();
                },
            },
            {
                title: 'Título 1',
                description: 'Encabezado de sección grande.',
                icon: <span className="material-symbols-outlined">format_h1</span>,
                command: ({ editor, range }) => {
                    editor.chain().focus().deleteRange(range).setNode('heading', { level: 1 }).run();
                },
            },
            {
                title: 'Título 2',
                description: 'Encabezado de subsección.',
                icon: <span className="material-symbols-outlined">format_h2</span>,
                command: ({ editor, range }) => {
                    editor.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run();
                },
            },
            {
                title: 'Título 3',
                description: 'Encabezado pequeño.',
                icon: <span className="material-symbols-outlined">format_h3</span>,
                command: ({ editor, range }) => {
                    editor.chain().focus().deleteRange(range).setNode('heading', { level: 3 }).run();
                },
            },
            {
                title: 'Lista',
                description: 'Crear una lista simple.',
                icon: <span className="material-symbols-outlined">format_list_bulleted</span>,
                command: ({ editor, range }) => {
                    editor.chain().focus().deleteRange(range).toggleBulletList().run();
                },
            },
            {
                title: 'Lista Numerada',
                description: 'Crear una lista con números.',
                icon: <span className="material-symbols-outlined">format_list_numbered</span>,
                command: ({ editor, range }) => {
                    editor.chain().focus().deleteRange(range).toggleOrderedList().run();
                },
            },
            {
                title: 'Lista de Tareas',
                description: 'Lista con casillas de verificación.',
                icon: <span className="material-symbols-outlined">check_box</span>,
                command: ({ editor, range }) => {
                    editor.chain().focus().deleteRange(range).toggleTaskList().run();
                },
            },
            {
                title: 'Cita',
                description: 'Capturar una cita o énfasis.',
                icon: <span className="material-symbols-outlined">format_quote</span>,
                command: ({ editor, range }) => {
                    editor.chain().focus().deleteRange(range).toggleBlockquote().run();
                },
            },
            {
                title: '✨ AI: Expandir Idea',
                description: 'Deja que ZpBot desarrolle este punto.',
                icon: <span className="material-symbols-outlined text-indigo-500">auto_awesome</span>,
                command: ({ editor, range }) => {
                    // Placeholder for AI expansion logic - to be connected to geminiService
                    editor.chain().focus().deleteRange(range).insertContent('✨ Generando expansión...').run();
                    // In real implementation, trigger an event or callback
                    window.dispatchEvent(new CustomEvent('notebook-ai-command', { detail: { action: 'expand' } }));
                },
            },
            {
                title: '📝 AI: Resumir',
                description: 'Resumir lo escrito arriba.',
                icon: <span className="material-symbols-outlined text-indigo-500">summarize</span>,
                command: ({ editor, range }) => {
                    editor.chain().focus().deleteRange(range).insertContent('📝 Generando resumen...').run();
                    window.dispatchEvent(new CustomEvent('notebook-ai-command', { detail: { action: 'summarize' } }));
                },
            },
        ].filter((item) => item.title.toLowerCase().startsWith(query.toLowerCase()));
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
