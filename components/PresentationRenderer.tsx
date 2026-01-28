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

// --- Enhanced Theme Configurations (V3: No Visual Placeholders) ---
const themes: Record<VisualTheme, {
    bg: string,
    text: string,
    accent: string,
    secondary: string,
    card: string,
    pattern: string,
    accentColor: string
}> = {
    modern_dark: {
        bg: "bg-[#0A0C10] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-950/40 via-[#0A0C10] to-black",
        text: "text-white",
        accent: "bg-indigo-500",
        accentColor: "#6366f1",
        secondary: "text-[#8E97A4]",
        card: "bg-white/5 backdrop-blur-3xl border border-white/10 shadow-2xl",
        pattern: "opacity-20"
    },
    clean_light: {
        bg: "bg-[#FAFAFB] bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-blue-50/50 via-[#FAFAFB] to-white",
        text: "text-slate-900",
        accent: "bg-indigo-600",
        accentColor: "#4f46e5",
        secondary: "text-slate-500",
        card: "bg-white/80 backdrop-blur-xl border border-slate-200/60 shadow-xl shadow-indigo-100/20",
        pattern: "opacity-10"
    },
    professional_blue: {
        bg: "bg-[#020617] bg-[conic-gradient(at_top_right,_var(--tw-gradient-stops))] from-sky-950 via-[#020617] to-black",
        text: "text-white",
        accent: "bg-sky-400",
        accentColor: "#38bdf8",
        secondary: "text-sky-200/60",
        card: "bg-sky-500/5 backdrop-blur-2xl border border-sky-500/20 shadow-2xl shadow-sky-950",
        pattern: "opacity-20"
    },
    warm_paper: {
        bg: "bg-[#FDFBF7]",
        text: "text-stone-900",
        accent: "bg-orange-600",
        accentColor: "#ea580c",
        secondary: "text-stone-500",
        card: "bg-white border border-stone-200 shadow-sm",
        pattern: "opacity-5"
    },
    default: {
        bg: "bg-slate-900",
        text: "text-white",
        accent: "bg-indigo-500",
        accentColor: "#6366f1",
        secondary: "text-slate-400",
        card: "bg-slate-800",
        pattern: "opacity-10"
    }
};

const Citations = ({ citations, theme }: { citations?: { sourceType: string, title: string }[], theme: any }) => {
    if (!citations || citations.length === 0) return null;
    return (
        <div className="absolute bottom-10 left-12 flex flex-wrap gap-2 z-20 max-w-[80%]">
            {citations.map((cite, i) => (
                <div key={i} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] uppercase tracking-[0.2em] font-black border ${theme.card} ${theme.secondary}`}>
                    <span className="material-symbols-outlined text-xs">
                        {cite.sourceType === 'Notebook' ? 'book' : 'description'}
                    </span>
                    <span className="truncate max-w-[200px]">{cite.title}</span>
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
            <div className="prose prose-lg max-w-none bg-white p-12 rounded-[2rem] shadow-sm border border-slate-100">
                <pre className="whitespace-pre-wrap font-sans text-slate-600 leading-relaxed">{content}</pre>
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
                    <div className="h-full flex flex-col justify-center items-center text-center p-24 text-white relative">
                        {/* Background Accent */}
                        <div className="absolute inset-0 z-0">
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full blur-[140px] opacity-20" style={{ backgroundColor: theme.accentColor }}></div>
                        </div>

                        <div className="relative z-10 space-y-12">
                            <div className="flex justify-center mb-16">
                                <div className="px-6 py-2 rounded-full bg-white/10 border border-white/20 text-[10px] font-black tracking-[0.4em] uppercase">
                                    Adaptive Education
                                </div>
                            </div>
                            <h1 className={`text-7xl md:text-9xl font-black mb-12 leading-[0.9] tracking-tighter ${theme.text} drop-shadow-2xl`}>
                                {slide.title}
                            </h1>
                            {slide.subtitle && (
                                <p className={`text-2xl md:text-4xl font-serif italic ${theme.secondary} max-w-4xl mx-auto leading-tight`}>
                                    {slide.subtitle}
                                </p>
                            )}
                        </div>
                    </div>
                );

            case 'section_header':
                return (
                    <div className="h-full flex flex-col justify-center p-32">
                        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-white/5 backdrop-blur-3xl border-l border-white/10 hidden md:block"></div>
                        <div className="relative z-10 max-w-4xl">
                            <div className="w-24 h-2 rounded-full mb-12" style={{ backgroundColor: theme.accentColor }}></div>
                            <span className={`uppercase tracking-[0.5em] text-xs font-black mb-8 block opacity-40 ${theme.text}`}>Sección</span>
                            <h1 className={`text-7xl md:text-8xl font-black ${theme.text} mb-12 leading-none tracking-tight`}>{slide.title}</h1>
                            {slide.subtitle && (
                                <p className={`text-3xl font-light leading-relaxed max-w-2xl ${theme.secondary}`}>{slide.subtitle}</p>
                            )}
                        </div>
                    </div>
                );

            case 'two_column':
            case 'content_list':
            default:
                // Redesigned to be content-rich without placeholders
                return (
                    <div className="h-full flex flex-col p-20">
                        <header className="mb-20">
                            <div className="flex items-center gap-6 mb-8">
                                <div className="w-12 h-1.5 rounded-full" style={{ backgroundColor: theme.accentColor }}></div>
                                <h2 className={`text-2xl font-black uppercase tracking-[0.3em] ${theme.text}`}>{slide.title}</h2>
                            </div>
                            {slide.subtitle && (
                                <p className={`text-3xl font-medium leading-tight ${theme.secondary} max-w-5xl`}>
                                    {slide.subtitle}
                                </p>
                            )}
                        </header>

                        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 overflow-y-auto pr-6 scrollbar-hide pb-20">
                            {slide.content.map((point, idx) => (
                                <div key={idx} className={`p-10 rounded-[2.5rem] flex flex-col justify-between transition-all duration-500 hover:-translate-y-2 border border-white/5 ${theme.card} group`}>
                                    <div>
                                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-white/5 mb-8 group-hover:bg-white/10 transition-colors">
                                            <span className="text-xl font-black opacity-30">{idx + 1}</span>
                                        </div>
                                        <p className={`text-2xl font-bold leading-snug tracking-tight ${theme.text}`}>{point}</p>
                                    </div>
                                    <div className="mt-8 flex justify-end">
                                        <div className="w-8 h-8 rounded-full opacity-20 group-hover:opacity-100 transition-opacity flex items-center justify-center" style={{ backgroundColor: theme.accentColor }}>
                                            <span className="material-symbols-outlined text-white text-sm">trending_flat</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                );

            case 'quote_visual':
                return (
                    <div className="h-full flex flex-col justify-center items-center p-32 text-center relative overflow-hidden">
                        {/* Huge Decorative Quote Marks */}
                        <div className="absolute top-0 left-0 text-[30rem] font-serif leading-none opacity-[0.03] select-none -translate-x-1/4 -translate-y-1/4" style={{ color: theme.accentColor }}>“</div>

                        <div className="relative z-10 max-w-6xl">
                            <blockquote className={`text-6xl md:text-8xl font-serif italic font-light leading-[1.1] mb-20 ${theme.text} drop-shadow-2xl`}>
                                "{slide.content[0] || slide.title}"
                            </blockquote>
                            <div className="flex flex-col items-center gap-6">
                                <div className="w-20 h-1 rounded-full mb-4" style={{ backgroundColor: theme.accentColor }}></div>
                                <cite className={`text-lg font-black not-italic tracking-[0.4em] uppercase ${theme.secondary}`}>
                                    {slide.subtitle || "Resumen del Set"}
                                </cite>
                            </div>
                        </div>
                    </div>
                );

            case 'data_highlight':
                return (
                    <div className="h-full flex flex-col p-24">
                        <div className="text-center mb-24">
                            <h2 className={`text-5xl font-black mb-8 ${theme.text} tracking-tight`}>{slide.title}</h2>
                            <div className="w-32 h-1.5 mx-auto rounded-full" style={{ backgroundColor: theme.accentColor }}></div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 flex-1 content-center">
                            {slide.content.map((item, idx) => (
                                <div key={idx} className={`${theme.card} p-12 rounded-[3rem] flex flex-col items-center text-center justify-center hover:scale-105 transition-all duration-500 relative group`}>
                                    <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-[3rem]"></div>
                                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-10 text-3xl font-black shadow-2xl z-10`} style={{ backgroundColor: theme.accentColor }}>
                                        {idx + 1}
                                    </div>
                                    <span className={`text-2xl font-bold leading-tight tracking-tight z-10 ${theme.text}`}>{item}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                );
        }
    };

    return (
        <div className="max-w-7xl mx-auto space-y-12 select-none mb-24">
            {/* Viewport Frame - Full 16:9 Aspect Ratio Experience */}
            <div className={`aspect-video ${theme.bg} rounded-[3rem] shadow-2xl overflow-hidden relative group transition-all duration-1000 ring-1 ring-white/10`}>

                {/* Background Pattern */}
                <div className={`absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] ${theme.pattern} mix-blend-overlay pointer-events-none`}></div>

                {/* Dynamic Floating Elements */}
                <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full blur-[140px] opacity-10 animate-pulse pointer-events-none" style={{ backgroundColor: theme.accentColor }}></div>
                <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-blue-500/10 rounded-full blur-[140px] pointer-events-none"></div>

                {/* Render Layout */}
                <div className="absolute inset-0 z-10">
                    {renderLayout()}
                </div>

                {/* Citations Overlay */}
                <Citations citations={slide.citations} theme={theme} />

                {/* Navigation Controls (Visible on Hover) */}
                <div className="absolute inset-x-0 bottom-12 z-30 flex justify-center items-center gap-12 opacity-0 group-hover:opacity-100 transition-all duration-500 transform translate-y-4 group-hover:translate-y-0">
                    <button
                        onClick={() => setCurrentSlide(Math.max(0, currentSlide - 1))}
                        disabled={currentSlide === 0}
                        className="w-16 h-16 rounded-3xl bg-white/5 backdrop-blur-2xl border border-white/10 flex items-center justify-center hover:bg-white/10 disabled:opacity-20 transition-all active:scale-95 shadow-2xl"
                    >
                        <span className={`material-symbols-outlined text-3xl ${theme.text}`}>west</span>
                    </button>

                    <div className="px-8 py-3 rounded-full bg-white/5 backdrop-blur-3xl border border-white/10 text-xs font-black tracking-[0.4em]">
                        <span className={theme.text}>{currentSlide + 1}</span>
                        <span className="mx-4 opacity-30">/</span>
                        <span className="opacity-30">{data.slides.length}</span>
                    </div>

                    <button
                        onClick={() => setCurrentSlide(Math.min(data.slides.length - 1, currentSlide + 1))}
                        disabled={currentSlide === data.slides.length - 1}
                        className="w-16 h-16 rounded-3xl bg-white/5 backdrop-blur-2xl border border-white/10 flex items-center justify-center hover:bg-white/10 disabled:opacity-20 transition-all active:scale-95 shadow-2xl"
                    >
                        <span className={`material-symbols-outlined text-3xl ${theme.text}`}>east</span>
                    </button>
                </div>
            </div>

            {/* Speaker Notes Console - High Contrast & Premium */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                <div className="md:col-span-3 bg-white p-12 rounded-[3.5rem] border border-slate-100 shadow-xl shadow-slate-100/50 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-12 opacity-[0.02] transform rotate-12 scale-150 group-hover:opacity-[0.05] transition-opacity">
                        <span className="material-symbols-outlined text-[10rem] icon-filled">record_voice_over</span>
                    </div>

                    <div className="relative z-10">
                        <div className="flex items-center gap-4 mb-8">
                            <div className="w-10 h-10 rounded-2xl flex items-center justify-center bg-indigo-50 text-indigo-500">
                                <span className="material-symbols-outlined text-lg">mic</span>
                            </div>
                            <span className="text-xs font-black uppercase tracking-[0.3em] text-slate-400">Guion del Presentador</span>
                        </div>
                        <p className="text-slate-700 leading-relaxed font-serif text-2xl lg:text-3xl max-w-5xl">
                            {slide.speakerNotes || "Explica los conceptos clave basándote en la información resaltada en la diapositiva."}
                        </p>
                    </div>
                </div>

                <div className="flex flex-col gap-8">
                    <div className="bg-slate-900 p-10 rounded-[3rem] text-white flex-1 flex flex-col justify-center text-center relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-transparent"></div>
                        <span className="text-[10px] font-black uppercase tracking-[0.4em] opacity-40 mb-4 block">Capítulo</span>
                        <div className="text-4xl font-black mb-2">{currentSlide + 1}</div>
                        <div className="text-xs font-bold opacity-30 uppercase tracking-widest">de {data.slides.length}</div>
                    </div>

                    <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm text-center">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mb-4 block">Tema Aplicado</span>
                        <div className="flex justify-center items-center gap-3">
                            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: theme.accentColor }}></div>
                            <span className="text-sm font-bold text-slate-700 capitalize">{data.visualTheme.replace('_', ' ')}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
