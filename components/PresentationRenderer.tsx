import React, { useState } from 'react';

// --- Types matching the new Schema ---
type VisualTheme = "modern_dark" | "clean_light" | "professional_blue" | "warm_paper" | "default";
type SlideLayout = "title_slide" | "content_list" | "two_column" | "quote_visual" | "data_highlight" | "section_header";

interface Slide {
    layout: SlideLayout;
    title: string;
    subtitle?: string;
    content: string[];
    visualCue: string;
    speakerNotes: string;
}

interface PresentationData {
    visualTheme: VisualTheme;
    slides: Slide[];
}

interface Props {
    content: string; // JSON string or Markdown
}

// --- Theme Configurations ---
const themes: Record<VisualTheme, { bg: string, text: string, accent: string, secondary: string, card: string }> = {
    modern_dark: {
        bg: "bg-slate-900",
        text: "text-white",
        accent: "bg-indigo-500 text-indigo-100",
        secondary: "text-slate-400",
        card: "bg-slate-800 border-slate-700"
    },
    clean_light: {
        bg: "bg-white",
        text: "text-slate-900",
        accent: "bg-emerald-500 text-emerald-50",
        secondary: "text-slate-500",
        card: "bg-slate-50 border-slate-200"
    },
    professional_blue: {
        bg: "bg-blue-900",
        text: "text-white",
        accent: "bg-blue-400 text-blue-50",
        secondary: "text-blue-200",
        card: "bg-blue-800/50 border-blue-700"
    },
    warm_paper: {
        bg: "bg-orange-50",
        text: "text-stone-800",
        accent: "bg-orange-400 text-orange-50",
        secondary: "text-stone-500",
        card: "bg-white border-orange-100"
    },
    default: {
        bg: "bg-slate-900",
        text: "text-white",
        accent: "bg-indigo-500",
        secondary: "text-slate-400",
        card: "bg-slate-800"
    }
};

export default function PresentationRenderer({ content }: Props) {
    let data: PresentationData | null = null;
    let isJson = false;

    try {
        if (content.trim().startsWith('{')) {
            data = JSON.parse(content);
            isJson = true;
            // Validate minimal structure
            if (!data?.slides) isJson = false;
        }
    } catch (e) {
        console.warn("Presentation content not JSON", e);
    }

    const [currentSlide, setCurrentSlide] = useState(0);

    if (!isJson || !data) {
        return (
            <div className="prose prose-lg max-w-none bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
                <pre className="whitespace-pre-wrap font-sans text-sm text-slate-600">{content}</pre>
            </div>
        );
    }

    const theme = themes[data.visualTheme || "modern_dark"] || themes.default;
    const slide = data.slides[currentSlide];

    // --- Layout Components ---

    const renderLayout = () => {
        const layout = slide.layout || 'content_list';

        switch (layout) {
            case 'title_slide':
                return (
                    <div className="h-full flex flex-col justify-center items-center text-center p-12">
                        <div className={`w-24 h-2 mb-8 ${theme.accent.split(' ')[0]} rounded-full`}></div>
                        <h1 className={`text-6xl font-bold mb-6 tracking-tight ${theme.text}`}>{slide.title}</h1>
                        {slide.subtitle && <p className={`text-3xl font-light ${theme.secondary}`}>{slide.subtitle}</p>}
                    </div>
                );

            case 'section_header':
                return (
                    <div className="h-full flex flex-row items-center p-12 gap-12">
                        <div className={`w-4 h-full ${theme.accent.split(' ')[0]} rounded-full`}></div>
                        <div>
                            <span className={`uppercase tracking-widest text-sm font-bold mb-4 block ${theme.secondary}`}>Nueva Sección</span>
                            <h1 className={`text-5xl font-bold ${theme.text}`}>{slide.title}</h1>
                        </div>
                    </div>
                );

            case 'two_column':
                return (
                    <div className="h-full grid grid-cols-2 gap-12 p-12 items-center">
                        <div>
                            <h2 className={`text-4xl font-bold mb-8 ${theme.text}`}>{slide.title}</h2>
                            <ul className="space-y-4">
                                {slide.content.slice(0, Math.ceil(slide.content.length / 2)).map((p, i) => (
                                    <li key={i} className={`text-lg leading-relaxed flex items-start gap-3 ${theme.text}`}>
                                        <span className={`mt-2 w-2 h-2 rounded-full ${theme.accent.split(' ')[0]} shrink-0`} />
                                        {p}
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div className={`${theme.card} p-8 rounded-2xl h-full flex flex-col justify-center border`}>
                            <ul className="space-y-4">
                                {slide.content.slice(Math.ceil(slide.content.length / 2)).map((p, i) => (
                                    <li key={i} className={`text-lg leading-relaxed flex items-start gap-3 ${theme.text}`}>
                                        <span className={`mt-2 w-2 h-2 rounded-full ${theme.accent.split(' ')[0]} shrink-0`} />
                                        {p}
                                    </li>
                                ))}
                            </ul>
                            <div className={`mt-8 text-xs italic opacity-60 ${theme.text}`}>
                                Visual: {slide.visualCue}
                            </div>
                        </div>
                    </div>
                );

            case 'quote_visual':
                return (
                    <div className="h-full flex flex-col justify-center items-center p-16 text-center relative overflow-hidden">
                        <span className={`absolute top-10 left-10 text-9xl opacity-10 font-serif ${theme.text}`}>"</span>
                        <blockquote className={`text-4xl font-light italic leading-relaxed mb-8 relative z-10 ${theme.text}`}>
                            {slide.content[0] || slide.title}
                        </blockquote>
                        <cite className={`text-xl font-bold not-italic ${theme.secondary}`}>— {slide.subtitle || "Concepto Clave"}</cite>
                    </div>
                );

            case 'data_highlight':
                return (
                    <div className="h-full flex flex-col justify-center p-12">
                        <h2 className={`text-3xl font-bold mb-12 text-center ${theme.text}`}>{slide.title}</h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {slide.content.map((item, idx) => (
                                <div key={idx} className={`${theme.card} border p-6 rounded-xl flex flex-col items-center text-center justify-center aspect-square`}>
                                    <span className={`text-5xl font-black mb-4 ${theme.accent.split(' ')[0].replace('bg-', 'text-')}`}>
                                        {idx + 1}
                                    </span>
                                    <span className={`text-lg font-medium ${theme.text}`}>{item}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                );

            case 'content_list':
            default:
                return (
                    <div className="h-full flex flex-col p-12">
                        <div className="mb-8 border-b border-white/10 pb-4">
                            <h2 className={`text-4xl font-bold ${theme.text}`}>{slide.title}</h2>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            <ul className="space-y-6">
                                {slide.content.map((point, idx) => (
                                    <li key={idx} className={`flex items-start gap-4 text-xl leading-relaxed ${theme.text}`}>
                                        <span className={`mt-2.5 w-2 h-2 rounded-full ${theme.accent.split(' ')[0]} shrink-0`}></span>
                                        <span>{point}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div className={`mt-auto pt-4 text-xs opacity-40 ${theme.secondary}`}>
                            {slide.visualCue}
                        </div>
                    </div>
                );
        }
    };

    // --- Main Render ---
    return (
        <div className="max-w-5xl mx-auto space-y-6">
            {/* Viewport Frame */}
            <div className={`aspect-video ${theme.bg} rounded-2xl shadow-2xl overflow-hidden relative group transition-colors duration-500`}>

                {/* Render Layout */}
                <div className="absolute inset-0 z-10">
                    {renderLayout()}
                </div>

                {/* Footer / Meta */}
                <div className="absolute bottom-4 right-6 z-20 font-mono text-sm opacity-50">
                    <span className={theme.text}>{currentSlide + 1} / {data.slides.length}</span>
                </div>

                {/* Nav Buttons */}
                <button
                    onClick={() => setCurrentSlide(Math.max(0, currentSlide - 1))}
                    disabled={currentSlide === 0}
                    className="absolute left-0 top-0 bottom-0 w-20 z-30 flex items-center justify-center hover:bg-white/5 disabled:opacity-0 transition"
                >
                    <span className={`material-symbols-outlined text-4xl ${theme.secondary}`}>chevron_left</span>
                </button>
                <button
                    onClick={() => setCurrentSlide(Math.min(data.slides.length - 1, currentSlide + 1))}
                    disabled={currentSlide === data.slides.length - 1}
                    className="absolute right-0 top-0 bottom-0 w-20 z-30 flex items-center justify-center hover:bg-white/5 disabled:opacity-0 transition"
                >
                    <span className={`material-symbols-outlined text-4xl ${theme.secondary}`}>chevron_right</span>
                </button>
            </div>

            {/* Speaker Notes Console */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 bg-amber-50 p-6 rounded-2xl border border-amber-100 shadow-sm">
                    <div className="flex items-center gap-2 mb-3 text-amber-800 font-bold text-xs uppercase tracking-widest">
                        <span className="material-symbols-outlined text-sm">mic</span>
                        Guion del Presentador
                    </div>
                    <p className="text-amber-900/90 leading-7 font-serif text-lg">
                        {slide.speakerNotes || "Sin notas para esta diapositiva."}
                    </p>
                </div>

                {/* Controls */}
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-4">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Control</div>

                    <div className="flex justify-between items-center bg-slate-50 p-2 rounded-xl">
                        <button
                            onClick={() => setCurrentSlide(Math.max(0, currentSlide - 1))}
                            disabled={currentSlide === 0}
                            className="w-10 h-10 rounded-lg bg-white shadow-sm flex items-center justify-center hover:bg-slate-100 disabled:opacity-50 transition"
                        >
                            <span className="material-symbols-outlined text-slate-600">chevron_left</span>
                        </button>
                        <span className="font-mono font-bold text-slate-700">
                            {currentSlide + 1}
                        </span>
                        <button
                            onClick={() => setCurrentSlide(Math.min(data.slides.length - 1, currentSlide + 1))}
                            disabled={currentSlide === data.slides.length - 1}
                            className="w-10 h-10 rounded-lg bg-white shadow-sm flex items-center justify-center hover:bg-slate-100 disabled:opacity-50 transition"
                        >
                            <span className="material-symbols-outlined text-slate-600">chevron_right</span>
                        </button>
                    </div>

                    <div className="mt-2 pt-4 border-t border-slate-100">
                        <div className="text-xs text-slate-400 mb-1">Tema Visual</div>
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-100 rounded-full text-xs font-medium text-slate-600">
                            <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                            {data.visualTheme}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
