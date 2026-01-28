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
    citations?: { sourceType: 'Notebook' | 'Material', title: string }[];
}

interface PresentationData {
    visualTheme: VisualTheme;
    slides: Slide[];
}

interface Props {
    content: string; // JSON string or Markdown
}

// --- Enhanced Theme Configurations with Gradients and Patterns ---
const themes: Record<VisualTheme, {
    bg: string,
    text: string,
    accent: string,
    secondary: string,
    card: string,
    pattern: string
}> = {
    modern_dark: {
        bg: "bg-slate-950 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black",
        text: "text-slate-50",
        accent: "bg-indigo-500 text-indigo-50 shadow-indigo-500/50",
        secondary: "text-slate-400",
        card: "bg-white/5 backdrop-blur-xl border-white/10",
        pattern: "opacity-20"
    },
    clean_light: {
        bg: "bg-white bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-indigo-50 via-white to-sky-50",
        text: "text-slate-800",
        accent: "bg-indigo-600 text-white shadow-indigo-600/30",
        secondary: "text-slate-500",
        card: "bg-white/60 backdrop-blur-md border-slate-200 shadow-sm",
        pattern: "opacity-5"
    },
    professional_blue: {
        bg: "bg-slate-900 bg-[conic-gradient(at_top_right,_var(--tw-gradient-stops))] from-blue-900 via-slate-900 to-slate-900",
        text: "text-white",
        accent: "bg-blue-500 text-blue-50 shadow-blue-500/50",
        secondary: "text-blue-200/80",
        card: "bg-blue-950/40 backdrop-blur-md border-blue-800/50",
        pattern: "opacity-10"
    },
    warm_paper: {
        bg: "bg-stone-50 bg-[linear-gradient(to_bottom_right,#fff,#f5f5f4)]",
        text: "text-stone-800",
        accent: "bg-orange-500 text-white shadow-orange-500/30",
        secondary: "text-stone-600",
        card: "bg-white/80 backdrop-blur-sm border-stone-200 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.05)]",
        pattern: "opacity-5"
    },
    default: {
        bg: "bg-slate-900",
        text: "text-white",
        accent: "bg-indigo-500",
        secondary: "text-slate-400",
        card: "bg-slate-800",
        pattern: "opacity-10"
    }
};

const VisualPlaceholder = ({ cue, theme }: { cue: string, theme: any }) => (
    <div className={`w-full h-full min-h-[200px] rounded-xl overflow-hidden relative group ${theme.card} border-0`}>
        <div className={`absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-purple-500/10`}></div>
        {/* Abstract Shapes */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-current opacity-5 rounded-full blur-2xl transform translate-x-10 -translate-y-10"></div>
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-current opacity-10 rounded-full blur-xl transform -translate-x-5 translate-y-5"></div>

        <div className="relative z-10 w-full h-full flex flex-col items-center justify-center p-6 text-center">
            <span className="material-symbols-outlined text-5xl mb-3 opacity-50">image</span>
            <p className={`text-xs uppercase tracking-widest font-bold opacity-40 mb-2`}>Visual Sugerido</p>
            <p className={`text-sm font-medium opacity-80 italic max-w-xs leading-relaxed`}>
                "{cue}"
            </p>
        </div>
    </div>
);

const Citations = ({ citations, theme }: { citations?: { sourceType: string, title: string }[], theme: any }) => {
    if (!citations || citations.length === 0) return null;
    return (
        <div className="absolute bottom-0 left-0 p-4 flex flex-wrap gap-2 pointer-events-none opacity-0 group-hover:opacity-60 transition-opacity z-20">
            {citations.map((cite, i) => (
                <div key={i} className={`flex items-center gap-2 px-2 py-1 rounded-md text-[10px] uppercase tracking-wide font-bold border ${theme.card} ${theme.secondary}`}>
                    <span className="material-symbols-outlined text-sm">
                        {cite.sourceType === 'Notebook' ? 'book' : 'description'}
                    </span>
                    <span>{cite.title}</span>
                </div>
            ))}
        </div>
    );
};

export default function PresentationRenderer({ content }: Props) {
    let data: PresentationData | null = null;
    let isJson = false;

    try {
        if (content.trim().startsWith('{')) {
            data = JSON.parse(content);
            isJson = true;
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

    const renderLayout = () => {
        const layout = slide.layout || 'content_list';

        switch (layout) {
            case 'title_slide':
                return (
                    <div className="h-full flex flex-col justify-center items-center text-center p-16 relative overflow-hidden">
                        <div className={`absolute top-0 left-0 w-full h-2 ${theme.accent.split(' ')[0]}`}></div>
                        <div className="relative z-10 max-w-4xl">
                            <span className={`inline-block px-4 py-1 rounded-full text-xs font-bold tracking-[0.2em] mb-8 uppercase ${theme.card} ${theme.text} border`}>
                                Presentación
                            </span>
                            <h1 className={`text-6xl md:text-7xl font-black mb-8 leading-tight tracking-tight ${theme.text}`}>
                                {slide.title}
                            </h1>
                            {slide.subtitle && (
                                <p className={`text-2xl md:text-3xl font-light ${theme.secondary} max-w-2xl mx-auto leading-relaxed`}>
                                    {slide.subtitle}
                                </p>
                            )}
                        </div>
                    </div>
                );

            case 'section_header':
                return (
                    <div className="h-full flex flex-row items-center p-16 gap-16">
                        <div className={`w-2 h-full ${theme.accent.split(' ')[0]} rounded-full opacity-50`}></div>
                        <div className="flex-1">
                            <span className={`uppercase tracking-[0.3em] text-sm font-bold mb-6 block ${theme.secondary}`}>
                                Nueva Sección
                            </span>
                            <h1 className={`text-6xl font-black ${theme.text} mb-6`}>{slide.title}</h1>
                            {slide.visualCue && (
                                <div className="mt-8 max-w-md">
                                    <VisualPlaceholder cue={slide.visualCue} theme={theme} />
                                </div>
                            )}
                        </div>
                    </div>
                );

            case 'two_column':
                return (
                    <div className="h-full grid grid-cols-2 gap-12 p-12 items-center">
                        <div className="flex flex-col justify-center h-full">
                            <h2 className={`text-4xl font-bold mb-8 ${theme.text}`}>{slide.title}</h2>
                            <ul className="space-y-6">
                                {slide.content.map((p, i) => (
                                    <li key={i} className={`text-xl leading-relaxed flex items-start gap-4 ${theme.text}`}>
                                        <span className={`mt-2 w-2 h-2 rounded-full ${theme.accent.split(' ')[0]} shrink-0 shadow-lg`} />
                                        <span>{p}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div className="h-full flex flex-col gap-6">
                            {slide.subtitle && (
                                <div className={`${theme.card} p-6 rounded-xl border`}>
                                    <p className={`text-lg italic ${theme.secondary}`}>{slide.subtitle}</p>
                                </div>
                            )}
                            <div className="flex-1">
                                <VisualPlaceholder cue={slide.visualCue} theme={theme} />
                            </div>
                        </div>
                    </div>
                );

            case 'quote_visual':
                return (
                    <div className="h-full flex flex-col justify-center items-center p-20 text-center relative overflow-hidden">
                        <span className={`absolute top-20 left-20 text-9xl opacity-10 font-serif ${theme.text}`}>"</span>
                        <div className="relative z-10 max-w-5xl">
                            <blockquote className={`text-5xl font-serif italic leading-tight mb-10 ${theme.text}`}>
                                {slide.content[0] || slide.title}
                            </blockquote>
                            <div className="flex items-center justify-center gap-4">
                                <div className={`h-px w-12 ${theme.secondary} opacity-50`}></div>
                                <cite className={`text-xl font-bold not-italic tracking-wide ${theme.secondary}`}>
                                    {slide.subtitle || "Concepto Clave"}
                                </cite>
                                <div className={`h-px w-12 ${theme.secondary} opacity-50`}></div>
                            </div>
                        </div>
                    </div>
                );

            case 'data_highlight':
                return (
                    <div className="h-full flex flex-col p-12">
                        <h2 className={`text-3xl font-bold mb-12 text-center ${theme.text}`}>{slide.title}</h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 flex-1 content-center">
                            {slide.content.map((item, idx) => (
                                <div key={idx} className={`${theme.card} border p-8 rounded-2xl flex flex-col items-center text-center justify-center hover:scale-105 transition-transform duration-300 shadow-xl`}>
                                    <div className={`w-16 h-16 rounded-full ${theme.accent.split(' ')[0]} flex items-center justify-center mb-6 text-2xl font-bold`}>
                                        {idx + 1}
                                    </div>
                                    <span className={`text-xl font-medium leading-relaxed ${theme.text}`}>{item}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                );

            case 'content_list':
            default:
                return (
                    <div className="h-full grid grid-cols-12 gap-8 p-12">
                        <div className="col-span-7 flex flex-col justify-center">
                            <div className="mb-10 pl-6 border-l-4 border-white/20">
                                <h2 className={`text-5xl font-bold ${theme.text}`}>{slide.title}</h2>
                            </div>
                            <ul className="space-y-6">
                                {slide.content.map((point, idx) => (
                                    <li key={idx} className={`flex items-start gap-4 text-xl leading-relaxed ${theme.text} bg-white/5 p-4 rounded-xl backdrop-blur-sm border border-white/5`}>
                                        <span className={`mt-2 w-2 h-2 rounded-full ${theme.accent.split(' ')[0]} shrink-0 shadow-[0_0_10px_currentColor]`}></span>
                                        <span>{point}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div className="col-span-5 flex flex-col gap-6">
                            {slide.subtitle && (
                                <div className={`${theme.card} p-6 rounded-2xl border`}>
                                    <h3 className={`text-sm font-bold uppercase tracking-wider mb-2 opacity-50 ${theme.text}`}>Resumen</h3>
                                    <p className={`text-lg ${theme.text}`}>{slide.subtitle}</p>
                                </div>
                            )}
                            <div className="flex-1 min-h-[200px]">
                                <VisualPlaceholder cue={slide.visualCue} theme={theme} />
                            </div>
                        </div>
                    </div>
                );
        }
    };

    return (
        <div className="max-w-6xl mx-auto space-y-8 select-none">
            {/* Viewport Frame */}
            <div className={`aspect-video ${theme.bg} rounded-3xl shadow-2xl overflow-hidden relative group transition-all duration-700 ring-1 ring-slate-900/5`}>

                {/* Background Pattern */}
                <div className={`absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] ${theme.pattern} mix-blend-overlay pointer-events-none`}></div>

                {/* Render Layout */}
                <div className="absolute inset-0 z-10">
                    {renderLayout()}
                </div>

                {/* Footer / Meta */}
                <div className="absolute bottom-6 right-8 z-20 font-mono text-sm opacity-40">
                    <span className={theme.text}>{currentSlide + 1} <span className="mx-2">/</span> {data.slides.length}</span>
                </div>

                {/* Citations Overlay (New) */}
                <Citations citations={slide.citations} theme={theme} />

                {/* Navigation Overlay */}
                <div className="absolute inset-0 z-30 pointer-events-none flex justify-between px-4 items-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <button
                        onClick={() => setCurrentSlide(Math.max(0, currentSlide - 1))}
                        disabled={currentSlide === 0}
                        className="pointer-events-auto w-14 h-14 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center hover:bg-white/20 disabled:opacity-0 transition transform hover:scale-110"
                    >
                        <span className={`material-symbols-outlined text-3xl ${theme.text}`}>arrow_back</span>
                    </button>
                    <button
                        onClick={() => setCurrentSlide(Math.min(data.slides.length - 1, currentSlide + 1))}
                        disabled={currentSlide === data.slides.length - 1}
                        className="pointer-events-auto w-14 h-14 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center hover:bg-white/20 disabled:opacity-0 transition transform hover:scale-110"
                    >
                        <span className={`material-symbols-outlined text-3xl ${theme.text}`}>arrow_forward</span>
                    </button>
                </div>
            </div>

            {/* Speaker Notes Console */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 bg-gradient-to-br from-amber-50 to-orange-50 p-8 rounded-3xl border border-amber-100 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5">
                        <span className="material-symbols-outlined text-8xl text-amber-900">mic</span>
                    </div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-4 text-amber-800 font-bold text-xs uppercase tracking-[0.2em]">
                            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                            Guion del Presentador
                        </div>
                        <p className="text-amber-900/80 leading-8 font-serif text-xl">
                            {slide.speakerNotes || "Sin notas para esta diapositiva."}
                        </p>
                    </div>
                </div>

                {/* Controls */}
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col gap-6">
                    <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-2xl ${theme.bg} shadow-md flex items-center justify-center`}>
                            <span className="text-white font-bold text-lg">{currentSlide + 1}</span>
                        </div>
                        <div>
                            <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Diapositiva Actual</div>
                            <div className="text-sm font-medium text-slate-700 truncate max-w-[150px]">{slide.title}</div>
                        </div>
                    </div>

                    <div className="h-px bg-slate-100 w-full"></div>

                    <div className="flex flex-col gap-2">
                        <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">Tema Visual</div>
                        <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-xl border border-slate-100">
                            <span className={`w-3 h-3 rounded-full ${theme.accent.split(' ')[0]}`}></span>
                            <span className="text-sm font-medium text-slate-600 capitalize">{data.visualTheme.replace('_', ' ')}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
