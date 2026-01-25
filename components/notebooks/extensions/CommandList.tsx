import React, { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';

export interface CommandItemProps {
    title: string;
    description: string;
    icon: React.ReactNode;
    command: (editor: any) => void;
}

interface CommandListProps {
    items: CommandItemProps[];
    command: (item: CommandItemProps) => void;
    editor: any;
}

export const CommandList = forwardRef((props: CommandListProps, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    const selectItem = useCallback(
        (index: number) => {
            const item = props.items[index];
            if (item) {
                props.command(item);
            }
        },
        [props]
    );

    useEffect(() => {
        setSelectedIndex(0);
    }, [props.items]);

    useImperativeHandle(ref, () => ({
        onKeyDown: ({ event }: { event: KeyboardEvent }) => {
            if (event.key === 'ArrowUp') {
                setSelectedIndex((selectedIndex + props.items.length - 1) % props.items.length);
                return true;
            }
            if (event.key === 'ArrowDown') {
                setSelectedIndex((selectedIndex + 1) % props.items.length);
                return true;
            }
            if (event.key === 'Enter') {
                selectItem(selectedIndex);
                return true;
            }
            return false;
        },
    }));

    return (
        <div className="bg-white rounded-lg shadow-xl border border-slate-200 overflow-hidden min-w-[300px] p-1 animate-in fade-in zoom-in duration-200">
            {props.items.length > 0 ? (
                props.items.map((item, index) => (
                    <button
                        key={index}
                        className={`flex items-center gap-3 w-full p-2 rounded-md text-left transition-colors ${index === selectedIndex ? 'bg-indigo-50 text-indigo-900 shadow-sm' : 'hover:bg-slate-50 text-slate-700'
                            }`}
                        onClick={() => selectItem(index)}
                    >
                        <div className={`flex items-center justify-center w-10 h-10 rounded-lg border ${index === selectedIndex ? 'bg-white border-indigo-100 text-indigo-600' : 'bg-white border-slate-200 text-slate-500'
                            }`}>
                            {item.icon}
                        </div>
                        <div>
                            <p className="font-medium text-sm">{item.title}</p>
                            <p className="text-xs text-slate-400">{item.description}</p>
                        </div>
                    </button>
                ))
            ) : (
                <div className="p-3 text-sm text-slate-400 text-center">
                    No results found
                </div>
            )}
        </div>
    );
});

CommandList.displayName = 'CommandList';
