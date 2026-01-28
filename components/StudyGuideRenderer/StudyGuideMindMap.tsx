/**
 * Mind Map visualization for Study Guide
 * Enhanced with auto-layout, organic connections, and interactive nodes
 */

import React, { useMemo, useCallback, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  Node,
  Edge,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  MarkerType,
  ConnectionLineType,
  useReactFlow,
  ReactFlowProvider
} from '@xyflow/react';
import dagre from 'dagre';
import '@xyflow/react/dist/style.css';

import type { StudyGuideMindMapProps, SectionType } from './types';
import { SECTION_COLORS, SECTION_ICONS } from './types';

// Custom node component for mind map
interface MindMapNodeData {
  label: string;
  sectionType?: SectionType;
  isRoot?: boolean;
  sectionId?: string;
  isExpanded?: boolean;
  hasChildren?: boolean;
  onExpand?: (id: string, expanded: boolean) => void;
  level?: number;
}

const MindMapNode = ({ data, id }: { data: MindMapNodeData; id: string }) => {
  const colors = data.isRoot
    ? { bg: 'bg-gradient-to-br from-indigo-500 via-purple-500 to-indigo-600', text: 'text-white border-none', shadow: 'shadow-indigo-500/50' }
    : SECTION_COLORS[data.sectionType || 'general'];

  // Glassmorphism effect for non-root nodes
  const glassClasses = data.isRoot
    ? ''
    : 'backdrop-blur-md bg-white/80 border-white/50 hover:bg-white/95';

  const icon = data.isRoot ? 'school' : SECTION_ICONS[data.sectionType || 'general'];

  // Pulse animation for root or special nodes
  const pulseClass = data.isRoot ? 'animate-pulse-slow' : '';

  return (
    <div className="relative group">
      {/* Glow effect */}
      {data.isRoot && (
        <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl blur opacity-30 group-hover:opacity-60 transition duration-500"></div>
      )}

      <div
        className={`
          relative px-4 py-3 rounded-xl shadow-lg border transition-all duration-300 transform hover:-translate-y-1 hover:shadow-xl
          ${data.isRoot ? colors.bg + ' ' + colors.text : colors.bg + ' ' + colors.text + ' ' + colors.border}
          ${glassClasses}
          ${pulseClass}
          ${data.isRoot ? 'min-w-[200px]' : 'min-w-[150px] max-w-[250px]'}
        `}
      >
        <Handle type="target" position={Position.Top} className="!bg-slate-400 !w-2 !h-2 opacity-0 group-hover:opacity-100 transition-opacity" />

        <div className="flex items-center gap-3">
          <div className={`
            flex items-center justify-center rounded-lg 
            ${data.isRoot ? 'p-2 bg-white/20' : 'p-1.5 ' + colors.bg.replace('bg-', 'bg-opacity-20 bg-')}
          `}>
            <span className={`material-symbols-outlined ${data.isRoot ? 'text-2xl' : 'text-lg'}`}>
              {icon}
            </span>
          </div>
          <div className="flex-1">
            <span className={`block ${data.isRoot ? 'font-bold text-sm' : 'font-medium text-xs'} leading-tight`}>
              {data.label}
            </span>
            {/* Optional subtitle/summary tooltip could go here */}
          </div>
        </div>

        {/* Expand/Collapse Button */}
        {data.hasChildren && !data.isRoot && (
          <button
            className="absolute -bottom-3 left-1/2 transform -translate-x-1/2 w-6 h-6 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center hover:bg-slate-50 transition-colors z-10"
            onClick={(e) => {
              e.stopPropagation();
              if (data.onExpand) data.onExpand(id, !data.isExpanded);
            }}
          >
            <span className="material-symbols-outlined text-[14px] text-slate-500">
              {data.isExpanded ? 'remove' : 'add'}
            </span>
          </button>
        )}

        <Handle type="source" position={Position.Bottom} className="!bg-slate-400 !w-2 !h-2 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </div>
  );
};

const nodeTypes = {
  mindMapNode: MindMapNode
};

// Layout with Dagre
const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'TB') => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  const isHorizontal = direction === 'LR';
  dagreGraph.setGraph({ rankdir: direction, nodesep: 150, ranksep: 100 });

  nodes.forEach((node) => {
    // Approx dimensions
    dagreGraph.setNode(node.id, { width: 200, height: 60 });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      targetPosition: isHorizontal ? Position.Left : Position.Top,
      sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
      // We are shifting the dagre node position (anchor=center center) to the top left
      // so it matches React Flow's anchor point (top left).
      position: {
        x: nodeWithPosition.x - 100, // half width
        y: nodeWithPosition.y - 30, // half height
      },
      style: { opacity: 1 } // Fade in
    };
  });

  return { nodes: layoutedNodes, edges };
};

const StudyGuideMindMapInner: React.FC<StudyGuideMindMapProps> = ({
  sections,
  studySetName,
  onNodeClick
}) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [expandedNodes, setExpandedNodes] = React.useState<Set<string>>(new Set(['root']));
  const { fitView } = useReactFlow();

  // Helper to build the tree data
  const buildTree = useCallback(() => {
    const rawNodes: Node<MindMapNodeData>[] = [];
    const rawEdges: Edge[] = [];

    // 1. Create Root
    rawNodes.push({
      id: 'root',
      type: 'mindMapNode',
      data: {
        label: studySetName || "Mapa Mental",
        isRoot: true,
        hasChildren: true,
        isExpanded: true,
      },
      position: { x: 0, y: 0 }
    });

    // 2. Helper to traverse sections
    // const mainSections = sections.filter(s => s.level === 1 || s.level === 2);
    // For a deeper map, we use the already parsed structure with children or flatten it but keep parent linkage

    // Let's iterate linearly but map IDs to parents.
    // However, the input `sections` is a flat list but has `children` property populated in `index.tsx` parser?
    // Wait, the parser in `index.tsx` returns a flat list AND populates `children` on objects. 
    // BUT `sections` prop passed here is the result of `parseContent`.

    // Let's assume `sections` contains all nodes.
    // The previous implementation filtered `s.level === 1 || s.level === 2`.
    // We want deep structure.

    // We need to know who is whose parent. The flat list might be in order. 
    // But `children` property is best.

    // Let's filter only top level sections first
    const topLevelSections = sections.filter(s => s.level === 1 || s.level === 1);
    // Actually, usually H1 is title, then H2 are main sections.
    // If parseContent produces H1 as level 1, H2 as level 2.

    // Let's look at `index.tsx` logic again (memory):
    // It returns `sections` which is a FLAT array, but it ALSO pushes to `children`.
    // So the top level items in the returned array are H1/H2 if they are not children?
    // No, `parseContent` returns `sections` which contains EVERYTHING including children.
    // But `children` are also linked.

    // We should iterate only over roots.
    // In `parseContent`: `sections.push(currentIntro); sections.push(currentH2);`
    // It pushes H2s. H3s are inside H2s. 
    // SO `sections` prop contains only TOP LEVEL sections (H1/H2).
    // wait, `sections` array in `index.tsx` accumulates `currentH2`... yes.
    // Subsections (H3) are NOT in the top level `sections` array, they are in `currentH2.children`.

    const processNode = (item: any, parentId: string, level: number) => {
      const isExpanded = expandedNodes.has(item.id);
      const hasChildren = item.children && item.children.length > 0;

      // Clean title
      const displayTitle = item.title
        .replace(/^SECCIÓN\s*\d+[:\-]\s*/i, '')
        .substring(0, 40) + (item.title.length > 40 ? '...' : '');

      rawNodes.push({
        id: item.id,
        type: 'mindMapNode',
        data: {
          label: displayTitle,
          sectionType: item.type,
          sectionId: item.id,
          hasChildren,
          isExpanded,
          level,
          onExpand: (id, expanded) => {
            setExpandedNodes(prev => {
              const next = new Set(prev);
              if (expanded) next.add(id);
              else next.delete(id);
              return next;
            });
          }
        },
        position: { x: 0, y: 0 } // Computed by dagre later
      });

      rawEdges.push({
        id: `${parentId}-${item.id}`,
        source: parentId,
        target: item.id,
        type: 'default', // 'smoothstep' or 'bezier' (default)
        style: { stroke: '#cbd5e1', strokeWidth: 2 },
        animated: true,
      });

      if (isExpanded && hasChildren) {
        item.children.forEach((child: any) => processNode(child, item.id, level + 1));
      }
    };

    sections.forEach(section => {
      // Only process sections that are technically roots in the `sections` array (level 1 or 2)
      // Note: The parser logic pushes H2s to `sections`. H3s are children of H2s.
      processNode(section, 'root', 1);
    });

    return { rawNodes, rawEdges };

  }, [sections, studySetName, expandedNodes]);

  useEffect(() => {
    const { rawNodes, rawEdges } = buildTree();
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(rawNodes, rawEdges);

    setNodes(layoutedNodes);
    setEdges(layoutedEdges);

    window.requestAnimationFrame(() => {
      fitView({ duration: 800, padding: 0.2 });
    });

  }, [buildTree, fitView, setNodes, setEdges]);


  const handleNodeClick = useCallback((event: React.MouseEvent, node: Node<MindMapNodeData>) => {
    if (node.data.sectionId && onNodeClick) {
      onNodeClick(node.data.sectionId);
    }
  }, [onNodeClick]);

  if (sections.length === 0) return null;

  return (
    <div className="h-[500px] bg-slate-50/50 rounded-2xl border border-slate-200 overflow-hidden backdrop-blur-sm">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        nodeTypes={nodeTypes}
        connectionLineType={ConnectionLineType.SmoothStep}
        fitView
        className="bg-slate-50"
      >
        <Background gap={20} color="#e2e8f0" variant={undefined} />
        <Controls className="!bg-white !border-slate-200 !shadow-sm !rounded-lg" />
      </ReactFlow>
    </div>
  );
};

// Wrapper for ReactFlowProvider
const StudyGuideMindMap: React.FC<StudyGuideMindMapProps> = (props) => (
  <ReactFlowProvider>
    <StudyGuideMindMapInner {...props} />
  </ReactFlowProvider>
);

export default StudyGuideMindMap;
