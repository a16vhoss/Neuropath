import React from 'react';

// Enhanced Interface to support 'Detailed Sections' with Citations
interface InfographicData {
    title: string;
    centralIdea: string;
    keyConcepts: { name: string; description: string; icon: string }[];
    processSteps: { step: number; description: string }[];
    detailedSections?: {
        title: string;
        content: string;
        icon: string;
        citations?: { sourceType: 'Notebook' | 'Material'; title: string }[];
    }[];
    conclusion: string;
}

interface Props {
    content: string; // JSON string or Markdown (fallback)
}

export default function InfographicRenderer({ content }: Props) {
    let data: InfographicData | null = null;
    let isJson = false;

    try {
        // Try parsing as JSON first
        if (content.trim().startsWith('{')) {
            data = JSON.parse(content);
            isJson = true;
        }
    } catch (e) {
        console.warn("Infographic content is not JSON, falling back to Markdown display", e);
    }

    // Fallback for old Markdown content
    if (!isJson || !data) {
        return (
            <div className="prose prose-lg max-w-none prose-indigo bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
                <pre className="whitespace-pre-wrap font-sans">{content}</pre>
            </div>
        );
    }

    return (
        <div className="bg-slate-50 p-6 md:p-10 rounded-3xl border border-slate-200 shadow-sm max-w-5xl mx-auto selection:bg-indigo-100 selection:text-indigo-900">
            {/* Header */}
            <div className="text-center mb-16 relative">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-32 bg-indigo-500/20 blur-[100px] rounded-full pointer-events-none"></div>
                <h1 className="text-4xl md:text-6xl font-black text-slate-800 tracking-tight mb-6 relative z-10">
                    {data.title}
                </h1>
                <div className="inline-block bg-white/80 backdrop-blur-md px-8 py-4 rounded-full shadow-lg border border-indigo-50 transform hover:-translate-y-1 transition-transform relative z-10">
                    <p className="text-xl text-indigo-800 font-medium flex items-center gap-3">
                        <span className="material-symbols-outlined filled">lightbulb</span>
                        {data.centralIdea}
                    </p>
                </div>
            </div>

            {/* NEW: Detailed Sections "Deep Dive" */}
            {data.detailedSections && data.detailedSections.length > 0 && (
                <div className="mb-20 space-y-12">
                    <div className="flex items-center gap-6 mb-12">
                        <div className="h-px bg-slate-200 flex-1"></div>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] bg-slate-50 px-4">Análisis Profundo</span>
                        <div className="h-px bg-slate-200 flex-1"></div>
                    </div>

                    <div className="grid grid-cols-1 gap-10">
                        {data.detailedSections.map((section, idx) => (
                            <div key={idx} className="bg-white p-8 md:p-10 rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/50 hover:shadow-2xl transition-all relative overflow-hidden group">
                                <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-bl-full -mr-24 -mt-24 z-0 opacity-50 transition-opacity group-hover:opacity-100"></div>
                                <div className="relative z-10">
                                    <div className="flex items-start md:items-center gap-6 mb-8 flex-col md:flex-row">
                                        <div className="w-16 h-16 flex items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-200 shrink-0">
                                            <span className="material-symbols-outlined text-3xl">
                                                {section.icon || 'article'}
                                            </span>
                                        </div>
                                        <h2 className="text-3xl font-bold text-slate-800">{section.title}</h2>
                                    </div>
                                    <div className="prose prose-lg text-slate-600 leading-relaxed max-w-none mb-8">
                                        {section.content.split('\n').map((line, i) => (
                                            <p key={i} className="mb-4 text-lg">{line}</p>
                                        ))}
                                    </div>

                                    {/* Citations for this section */}
                                    {section.citations && section.citations.length > 0 && (
                                        <div className="mt-8 pt-6 border-t border-slate-50 flex flex-wrap gap-3">
                                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider py-1">Fuentes:</span>
                                            {section.citations.map((cite, i) => (
                                                <div key={i} className="flex items-center gap-2 px-3 py-1 bg-slate-50 rounded-lg text-xs font-bold text-slate-500 border border-slate-100 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-100 transition-colors cursor-default">
                                                    <span className="material-symbols-outlined text-sm">
                                                        {cite.sourceType === 'Notebook' ? 'book' : 'description'}
                                                    </span>
                                                    <span>{cite.title}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Key Concepts Grid */}
            <div className="mb-20">
                <h3 className="text-2xl font-bold text-slate-800 mb-8 flex items-center gap-3">
                    <div className="w-2 h-8 bg-indigo-500 rounded-full"></div>
                    Conceptos Clave
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {data.keyConcepts?.map((concept, idx) => (
                        <div key={idx} className="bg-white p-8 rounded-3xl border border-slate-100 shadow-lg shadow-slate-100 hover:-translate-y-1 hover:shadow-xl transition-all relative overflow-hidden group">
                            <div className="absolute inset-0 bg-gradient-to-br from-white to-slate-50 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            <div className="flex flex-col gap-6 relative z-10 h-full">
                                <div className="w-14 h-14 rounded-2xl bg-indigo-50 group-hover:bg-indigo-500 transition-colors flex items-center justify-center shrink-0 text-indigo-600 group-hover:text-white">
                                    <span className="material-symbols-outlined text-3xl">
                                        {concept.icon || 'lightbulb'}
                                    </span>
                                </div>
                                <div>
                                    <h3 className="font-bold text-xl text-slate-800 mb-3">{concept.name}</h3>
                                    <p className="text-slate-600 text-base leading-relaxed">{concept.description}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Process Flow */}
            {data.processSteps && data.processSteps.length > 0 && (
                <div className="mb-20">
                    <h3 className="text-2xl font-bold text-slate-800 mb-8 flex items-center gap-3">
                        <div className="w-2 h-8 bg-amber-500 rounded-full"></div>
                        Proceso / Flujo
                    </h3>
                    <div className="space-y-6 relative">
                        {/* Connecting Line (Desktop) */}
                        <div className="absolute left-8 top-8 bottom-8 w-1 bg-gradient-to-b from-amber-100 via-amber-200 to-amber-100 hidden md:block rounded-full"></div>

                        {data.processSteps.map((step, idx) => (
                            <div key={idx} className="flex items-start md:items-center gap-8 relative z-10 group">
                                <div className="w-16 h-16 rounded-2xl bg-white border-2 border-amber-100 text-amber-600 text-2xl font-black flex items-center justify-center shrink-0 shadow-lg group-hover:scale-110 group-hover:border-amber-400 transition-all">
                                    {step.step}
                                </div>
                                <div className="flex-1 bg-white p-6 rounded-2xl border border-slate-100 shadow-md group-hover:shadow-lg transition-all">
                                    <p className="text-slate-700 font-medium text-lg">{step.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Conclusion */}
            <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-black text-white p-12 rounded-[2.5rem] shadow-2xl relative overflow-hidden text-center isolate">
                <div className="relative z-10">
                    <span className="material-symbols-outlined text-6xl mb-6 text-indigo-400 block mx-auto drop-shadow-[0_0_15px_rgba(129,140,248,0.5)]">auto_awesome</span>
                    <h3 className="text-3xl font-bold mb-6 text-white tracking-tight">Conclusión</h3>
                    <div className="h-1 w-24 bg-gradient-to-r from-indigo-500 to-purple-500 mx-auto mb-8 rounded-full"></div>
                    <p className="text-xl md:text-3xl font-light italic leading-relaxed text-indigo-100 max-w-4xl mx-auto">
                        "{data.conclusion}"
                    </p>
                </div>

                {/* Background Effects */}
                <div className="absolute top-0 right-0 -mr-32 -mt-32 w-96 h-96 bg-indigo-500/30 rounded-full blur-[100px] mix-blend-screen"></div>
                <div className="absolute bottom-0 left-0 -ml-32 -mb-32 w-96 h-96 bg-purple-500/30 rounded-full blur-[100px] mix-blend-screen"></div>
            </div>
        </div>
    );
}
