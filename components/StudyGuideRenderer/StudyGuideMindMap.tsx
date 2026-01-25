/**
 * Mind Map visualization for Study Guide
 * Uses React Flow to display sections as an interactive mind map
 */

import React, { useMemo, useCallback } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  Node,
  Edge,
  Handle,
  Position,
  useNodesState,
  useEdgesState
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import type { StudyGuideMindMapProps, SectionType } from './types';
import { SECTION_COLORS, SECTION_ICONS } from './types';

// Custom node component for mind map
interface MindMapNodeData {
  label: string;
  sectionType?: SectionType;
  isRoot?: boolean;
  sectionId?: string;
}

const MindMapNode = ({ data }: { data: MindMapNodeData }) => {
  const colors = data.isRoot
    ? { bg: 'bg-gradient-to-r from-indigo-500 to-purple-600', text: 'text-white' }
    : SECTION_COLORS[data.sectionType || 'general'];

  const icon = data.isRoot ? 'school' : SECTION_ICONS[data.sectionType || 'general'];

  return (
    <div
      className={`
        px-4 py-3 rounded-xl shadow-lg border-2 transition-transform hover:scale-105
        ${data.isRoot ? colors.bg + ' ' + colors.text + ' border-white/30' : colors.bg + ' ' + colors.text + ' ' + colors.border}
        ${data.isRoot ? 'min-w-[180px]' : 'min-w-[140px] max-w-[200px]'}
      `}
    >
      <Handle type="target" position={Position.Top} className="!bg-slate-400 !w-2 !h-2" />

      <div className="flex items-center gap-2">
        <span className={`material-symbols-outlined ${data.isRoot ? 'text-2xl' : 'text-lg'}`}>
          {icon}
        </span>
        <span className={`${data.isRoot ? 'font-bold text-sm' : 'font-medium text-xs'} leading-tight`}>
          {data.label}
        </span>
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-slate-400 !w-2 !h-2" />
    </div>
  );
};

const nodeTypes = {
  mindMapNode: MindMapNode
};

const StudyGuideMindMap: React.FC<StudyGuideMindMapProps> = ({
  sections,
  studySetName,
  onNodeClick
}) => {
  // Generate nodes and edges from sections
  const { initialNodes, initialEdges } = useMemo(() => {
    const nodes: Node<MindMapNodeData>[] = [];
    const edges: Edge[] = [];

    // Root node (center)
    const centerX = 400;
    const centerY = 50;

    nodes.push({
      id: 'root',
      type: 'mindMapNode',
      data: { label: studySetName, isRoot: true },
      position: { x: centerX - 90, y: centerY }
    });

    // H2 sections as primary branches (radial layout)
    const h2Sections = sections.filter(s => s.level === 2);
    const numSections = h2Sections.length;

    if (numSections === 0) return { initialNodes: nodes, initialEdges: edges };

    // Calculate positions in a semi-circle below the root
    const radius = 200;
    const startAngle = Math.PI * 0.2;  // Start slightly from left
    const endAngle = Math.PI * 0.8;    // End slightly to right
    const angleStep = numSections > 1 ? (endAngle - startAngle) / (numSections - 1) : 0;

    h2Sections.forEach((section, i) => {
      const angle = numSections === 1 ? Math.PI / 2 : startAngle + angleStep * i;
      const x = centerX + radius * Math.cos(angle) - 70;
      const y = centerY + radius * Math.sin(angle) + 50;

      // Clean title for display
      const displayTitle = section.title
        .replace(/^SECCIÓN\s*\d+[:\-]\s*/i, '')
        .substring(0, 25)
        + (section.title.length > 25 ? '...' : '');

      nodes.push({
        id: section.id,
        type: 'mindMapNode',
        data: {
          label: displayTitle,
          sectionType: section.type as SectionType,
          sectionId: section.id
        },
        position: { x, y }
      });

      edges.push({
        id: `root-${section.id}`,
        source: 'root',
        target: section.id,
        type: 'smoothstep',
        style: { stroke: '#94a3b8', strokeWidth: 2 },
        animated: false
      });
    });

    return { initialNodes: nodes, initialEdges: edges };
  }, [sections, studySetName]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const handleNodeClick = useCallback((event: React.MouseEvent, node: Node<MindMapNodeData>) => {
    if (node.data.sectionId && onNodeClick) {
      onNodeClick(node.data.sectionId);
    }
  }, [onNodeClick]);

  if (sections.filter(s => s.level === 2).length === 0) {
    return (
      <div className="h-[400px] flex items-center justify-center bg-slate-50 rounded-2xl border border-slate-200">
        <p className="text-slate-400">No hay secciones para mostrar en el mapa</p>
      </div>
    );
  }

  return (
    <div className="h-[400px] bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.5}
        maxZoom={1.5}
        defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#e2e8f0" gap={20} />
        <Controls
          showInteractive={false}
          className="!bg-white !border-slate-200 !shadow-md"
        />
      </ReactFlow>
    </div>
  );
};

export default StudyGuideMindMap;
