import React, { useState } from 'react';

interface Slide {
    title: string;
    content: string[];
    speakerNotes: string;
    designSuggestion?: string;
}

interface PresentationData {
    slides: Slide[];
}

interface Props {
    content: string; // JSON string or Markdown
}

export default function PresentationRenderer({ content }: Props) {
    let data: PresentationData | null = null;
    let isJson = false;

    try {
        if (content.trim().startsWith('{')) {
            data = JSON.parse(content);
            isJson = true;
        }
    } catch (e) {
        console.warn("Presentation content not JSON", e);
    }

    const [currentSlide, setCurrentSlide] = useState(0);

    if (!isJson || !data || !data.slides) {
        return (
            <div className="prose prose-lg max-w-none bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
                <pre className="whitespace-pre-wrap font-sans">{content}</pre>
            </div>
        );
    }

    const slide = data.slides[currentSlide];

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Slide View */}
            <div className="aspect-video bg-white rounded-2xl shadow-lg border border-slate-200 flex flex-col overflow-hidden relative group">

                {/* Slide Header */}
                <div className="bg-slate-900 text-white p-8 pb-4">
                    <h2 className="text-3xl font-bold">{slide.title}</h2>
                    <div className="w-16 h-1 bg-indigo-500 mt-4 rounded-full"></div>
                </div>

                {/* Slide Content */}
                <div className="flex-1 p-8 bg-gradient-to-br from-white to-slate-50">
                    <ul className="space-y-4">
                        {slide.content.map((point, idx) => (
                            <li key={idx} className="flex items-start gap-4 text-xl text-slate-700 leading-relaxed">
                                <span className="mt-2 w-2 h-2 rounded-full bg-indigo-500 shrink-0"></span>
                                <span>{point}</span>
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Slide Footer / Number */}
                <div className="absolute bottom-4 right-4 text-slate-300 font-mono text-sm">
                    {currentSlide + 1} / {data.slides.length}
                </div>

                {/* Navigation Overlays (Hover) */}
                <button
                    onClick={() => setCurrentSlide(Math.max(0, currentSlide - 1))}
                    disabled={currentSlide === 0}
                    className="absolute left-0 top-0 bottom-0 w-16 flex items-center justify-center hover:bg-black/5 disabled:opacity-0 transition"
                >
                    <span className="material-symbols-outlined text-4xl text-slate-400">chevron_left</span>
                </button>

                <button
                    onClick={() => setCurrentSlide(Math.min(data.slides.length - 1, currentSlide + 1))}
                    disabled={currentSlide === data.slides.length - 1}
                    className="absolute right-0 top-0 bottom-0 w-16 flex items-center justify-center hover:bg-black/5 disabled:opacity-0 transition"
                >
                    <span className="material-symbols-outlined text-4xl text-slate-400">chevron_right</span>
                </button>
            </div>

            {/* Controls & Speaker Notes */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 bg-yellow-50 p-6 rounded-2xl border border-yellow-100">
                    <div className="flex items-center gap-2 mb-2 text-yellow-800 font-bold text-sm uppercase tracking-wide">
                        <span className="material-symbols-outlined text-lg">mic</span>
                        Notas del Orador
                    </div>
                    <p className="text-yellow-900/80 leading-relaxed italic">
                        {slide.speakerNotes}
                    </p>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-100 flex flex-col justify-center items-center gap-4">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setCurrentSlide(Math.max(0, currentSlide - 1))}
                            disabled={currentSlide === 0}
                            className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 disabled:opacity-50 transition"
                        >
                            <span className="material-symbols-outlined">chevron_left</span>
                        </button>
                        <span className="font-mono font-medium text-slate-500">
                            {currentSlide + 1} / {data.slides.length}
                        </span>
                        <button
                            onClick={() => setCurrentSlide(Math.min(data.slides.length - 1, currentSlide + 1))}
                            disabled={currentSlide === data.slides.length - 1}
                            className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 disabled:opacity-50 transition"
                        >
                            <span className="material-symbols-outlined">chevron_right</span>
                        </button>
                    </div>
                    <div className="text-xs text-slate-400 text-center">
                        Usa las flechas para navegar
                    </div>
                </div>
            </div>
        </div>
    );
}
