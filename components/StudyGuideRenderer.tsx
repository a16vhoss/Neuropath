import React from 'react';

interface StudyGuideRendererProps {
    content: string;
}

const StudyGuideRenderer: React.FC<StudyGuideRendererProps> = ({ content }) => {
    if (!content) return null;

    // Parse the content into sections based on headers
    const parseContent = (text: string) => {
        const lines = text.split('\n');
        const sections: { title: string; type: string; level: number; content: string[] }[] = [];
        let currentSection: { title: string; type: string; level: number; content: string[] } | null = null;

        lines.forEach(line => {
            const headerMatch = line.match(/^(#{1,4})\s+(.*)/);
            if (headerMatch) {
                if (currentSection) sections.push(currentSection);

                const level = headerMatch[1].length;
                const title = headerMatch[2].trim();
                let type = 'general';

                // Determine section type for icon/styling
                if (title.includes('PANORAMA GENERAL') || title.includes('SECCIÓN 1')) type = 'overview';
                else if (title.includes('DESARROLLO CONCEPTUAL') || title.includes('SECCIÓN 2')) type = 'concept';
                else if (title.includes('INTEGRACIÓN') || title.includes('SECCIÓN 3')) type = 'integration';
                else if (title.includes('HERRAMIENTAS') || title.includes('SECCIÓN 4')) type = 'tools';
                else if (title.includes('PRÁCTICA') || title.includes('SECCIÓN 5')) type = 'practice';
                else if (title.includes('AUTOEVALUACIÓN') || title.includes('SECCIÓN 6')) type = 'exam';
                else if (title.includes('PUNTOS CRÍTICOS') || title.includes('SECCIÓN 7')) type = 'warning';
                else if (title.includes('INFOGRAFÍA') || title.includes('TÍTULO IMPACTANTE')) type = 'infographic';
                else if (title.includes('SLIDE') || title.includes('DIAPOSITIVA')) type = 'presentation';

                currentSection = { title, type, level, content: [] };
            } else if (currentSection) {
                if (line.trim() || currentSection.content.length > 0) {
                    currentSection.content.push(line);
                }
            } else if (line.trim()) {
                // Intro text before any header
                currentSection = { title: '', type: 'intro', level: 0, content: [line] };
            }
        });

        if (currentSection) sections.push(currentSection);
        return sections;
    };

    const sections = parseContent(content);

    const getIcon = (type: string) => {
        switch (type) {
            case 'overview': return 'info';
            case 'concept': return 'menu_book';
            case 'integration': return 'hub';
            case 'tools': return 'construction';
            case 'practice': return 'edit_note';
            case 'exam': return 'quiz';
            case 'warning': return 'warning';
            case 'intro': return 'auto_awesome';
            case 'infographic': return 'leaderboard';
            case 'presentation': return 'slideshow';
            default: return 'label';
        }
    };

    const getColorClass = (type: string) => {
        switch (type) {
            case 'overview': return 'bg-blue-50 text-blue-700 border-blue-100';
            case 'concept': return 'bg-indigo-50 text-indigo-700 border-indigo-100';
            case 'integration': return 'bg-purple-50 text-purple-700 border-purple-100';
            case 'tools': return 'bg-emerald-50 text-emerald-700 border-emerald-100';
            case 'practice': return 'bg-orange-50 text-orange-700 border-orange-100';
            case 'exam': return 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-100';
            case 'warning': return 'bg-rose-50 text-rose-700 border-rose-100';
            case 'intro': return 'bg-slate-50 text-slate-700 border-slate-100';
            case 'infographic': return 'bg-amber-50 text-amber-700 border-amber-100';
            case 'presentation': return 'bg-cyan-50 text-cyan-700 border-cyan-100';
            default: return 'bg-slate-50 text-slate-700 border-slate-100';
        }
    };

    const formatText = (text: string) => {
        // Handle bold
        let formattedText: any = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        // Handle italic
        formattedText = formattedText.replace(/\*(.*?)\*/g, '<em>$1</em>');
        // Handle code
        formattedText = formattedText.replace(/`(.*?)`/g, '<code class="bg-slate-100 px-1 rounded text-slate-800 font-mono">$1</code>');

        return <span dangerouslySetInnerHTML={{ __html: formattedText }} />;
    };

    return (
        <div className="space-y-8 animate-fade-in">
            {sections.map((section, idx) => {
                if (section.type === 'intro') {
                    return (
                        <div key={idx} className="bg-gradient-to-r from-violet-50 to-indigo-50 p-6 rounded-2xl border border-violet-100 italic text-slate-700 leading-relaxed shadow-sm">
                            {section.content.map((line, lIdx) => (
                                <p key={lIdx} className="mb-2 last:mb-0">{formatText(line)}</p>
                            ))}
                        </div>
                    );
                }

                if (section.level === 2) {
                    return (
                        <div key={idx} className={`rounded-3xl border shadow-sm overflow-hidden transition-all hover:shadow-md ${getColorClass(section.type)}`}>
                            <div className="px-6 py-4 flex items-center gap-3 border-b border-inherit">
                                <span className="material-symbols-outlined text-2xl">
                                    {getIcon(section.type)}
                                </span>
                                <h2 className="text-lg font-extrabold uppercase tracking-wider">{section.title}</h2>
                            </div>
                            <div className="p-6 bg-white space-y-4">
                                {section.content.map((line, lIdx) => {
                                    const trimmedLine = line.trim();
                                    if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('• ')) {
                                        return <li key={lIdx} className="ml-4 text-slate-600 list-none flex gap-2">
                                            <span className="text-primary mt-1">•</span>
                                            <span className="flex-1">{formatText(trimmedLine.substring(2))}</span>
                                        </li>;
                                    }
                                    const numberedMatch = trimmedLine.match(/^(\d+)\.\s+(.*)/);
                                    if (numberedMatch) {
                                        return <li key={lIdx} className="ml-4 text-slate-600 list-none flex gap-2">
                                            <span className="font-bold text-primary mt-0.5">{numberedMatch[1]}.</span>
                                            <span className="flex-1">{formatText(numberedMatch[2])}</span>
                                        </li>;
                                    }
                                    if (!trimmedLine) return <div key={lIdx} className="h-1"></div>;
                                    return <p key={lIdx} className="text-slate-600 leading-relaxed text-[15px]">{formatText(line)}</p>;
                                })}
                            </div>
                        </div>
                    );
                }

                if (section.level === 3) {
                    return (
                        <div key={idx} className="mt-6 mb-4">
                            <h3 className="text-md font-bold text-slate-800 flex items-center gap-2 mb-3">
                                <div className="w-1.5 h-6 bg-primary rounded-full"></div>
                                {section.title}
                            </h3>
                            <div className="pl-4 space-y-2">
                                {section.content.map((line, lIdx) => (
                                    <p key={lIdx} className="text-slate-600 leading-relaxed">{formatText(line)}</p>
                                ))}
                            </div>
                        </div>
                    );
                }

                if (section.level === 4) {
                    return (
                        <div key={idx} className="mt-4 mb-2 bg-slate-50 p-4 rounded-xl border border-slate-100">
                            <h4 className="text-sm font-bold text-slate-700 mb-2">{section.title}</h4>
                            <div className="space-y-1">
                                {section.content.map((line, lIdx) => (
                                    <p key={lIdx} className="text-sm text-slate-500">{formatText(line)}</p>
                                ))}
                            </div>
                        </div>
                    );
                }

                return null;
            })}
        </div>
    );
};

export default StudyGuideRenderer;
