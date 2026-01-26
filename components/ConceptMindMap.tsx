/**
 * Concept Mind Map Component
 * Generates and displays an AI-powered mind map from materials and notebooks
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
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

import { generateMindMapFromContent, MindMapData, MindMapNode as MindMapNodeType } from '../services/geminiService';

interface Material {
  name: string;
  content_text?: string;
  summary?: string;
}

interface Notebook {
  title: string;
  content?: string;
}

interface ConceptMindMapProps {
  materials: Material[];
  notebooks: Notebook[];
  studySetName: string;
  onClose?: () => void;
}

// Color scheme for different node types
const NODE_COLORS = {
  root: {
    bg: 'bg-gradient-to-r from-indigo-500 to-purple-600',
    text: 'text-white',
    border: 'border-white/30'
  },
  concept: {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200'
  },
  subconcept: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200'
  },
  detail: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200'
  }
};

// Custom node component
interface CustomNodeData {
  label: string;
  nodeType: 'root' | 'concept' | 'subconcept' | 'detail';
}

const CustomMindMapNode = ({ data }: { data: CustomNodeData }) => {
  const colors = NODE_COLORS[data.nodeType] || NODE_COLORS.concept;

  return (
    <div
      className={`
        px-4 py-3 rounded-xl shadow-lg border-2 transition-transform hover:scale-105 cursor-pointer
        ${colors.bg} ${colors.text} ${colors.border}
        ${data.nodeType === 'root' ? 'min-w-[160px]' : 'min-w-[120px] max-w-[180px]'}
      `}
    >
      <Handle type="target" position={Position.Top} className="!bg-slate-400 !w-2 !h-2" />

      <div className="flex items-center gap-2">
        <span className={`material-symbols-outlined ${data.nodeType === 'root' ? 'text-2xl' : 'text-lg'}`}>
          {data.nodeType === 'root' ? 'hub' :
           data.nodeType === 'concept' ? 'lightbulb' :
           data.nodeType === 'subconcept' ? 'arrow_right' : 'circle'}
        </span>
        <span className={`${data.nodeType === 'root' ? 'font-bold text-sm' : 'font-medium text-xs'} leading-tight`}>
          {data.label}
        </span>
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-slate-400 !w-2 !h-2" />
    </div>
  );
};

const nodeTypes = {
  customNode: CustomMindMapNode
};

const ConceptMindMap: React.FC<ConceptMindMapProps> = ({
  materials,
  notebooks,
  studySetName,
  onClose
}) => {
  const [mindMapData, setMindMapData] = useState<MindMapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Generate mind map on mount
  useEffect(() => {
    const generateMap = async () => {
      setLoading(true);
      setError(null);

      try {
        // Prepare materials data
        const materialData = materials
          .filter(m => m.content_text || m.summary)
          .map(m => ({
            name: m.name,
            content: m.content_text || m.summary || ''
          }));

        // Prepare notebooks data
        const notebookData = notebooks
          .filter(n => n.content)
          .map(n => ({
            title: n.title,
            content: n.content || ''
          }));

        if (materialData.length === 0 && notebookData.length === 0) {
          setError('No hay suficiente contenido en materiales o cuadernos para generar el mapa mental.');
          setLoading(false);
          return;
        }

        const data = await generateMindMapFromContent(materialData, notebookData, studySetName);

        if (!data.nodes || data.nodes.length === 0) {
          setError('No se pudieron extraer conceptos del contenido.');
        } else {
          setMindMapData(data);
        }
      } catch (err: any) {
        console.error('Error generating mind map:', err);
        setError('Error al generar el mapa mental. Intenta de nuevo.');
      } finally {
        setLoading(false);
      }
    };

    generateMap();
  }, [materials, notebooks, studySetName]);

  // Convert mind map data to React Flow nodes and edges
  const { flowNodes, flowEdges } = useMemo(() => {
    if (!mindMapData || mindMapData.nodes.length === 0) {
      return { flowNodes: [], flowEdges: [] };
    }

    const nodes: Node<CustomNodeData>[] = [];
    const edges: Edge[] = [];

    // Layout algorithm - hierarchical positioning
    const levelMap = new Map<string, number>();
    const childrenMap = new Map<string, string[]>();

    // Build parent-child relationships
    mindMapData.edges.forEach(edge => {
      const children = childrenMap.get(edge.source) || [];
      children.push(edge.target);
      childrenMap.set(edge.source, children);
    });

    // Calculate levels (BFS from root)
    const rootNode = mindMapData.nodes.find(n => n.type === 'root');
    if (rootNode) {
      levelMap.set(rootNode.id, 0);
      const queue = [rootNode.id];

      while (queue.length > 0) {
        const current = queue.shift()!;
        const currentLevel = levelMap.get(current) || 0;
        const children = childrenMap.get(current) || [];

        children.forEach(childId => {
          if (!levelMap.has(childId)) {
            levelMap.set(childId, currentLevel + 1);
            queue.push(childId);
          }
        });
      }
    }

    // Group nodes by level
    const levelGroups = new Map<number, MindMapNodeType[]>();
    mindMapData.nodes.forEach(node => {
      const level = levelMap.get(node.id) || 0;
      const group = levelGroups.get(level) || [];
      group.push(node);
      levelGroups.set(level, group);
    });

    // Position nodes
    const centerX = 400;
    const levelHeight = 120;
    const nodeWidth = 160;

    levelGroups.forEach((groupNodes, level) => {
      const totalWidth = groupNodes.length * nodeWidth;
      const startX = centerX - totalWidth / 2;

      groupNodes.forEach((node, index) => {
        nodes.push({
          id: node.id,
          type: 'customNode',
          data: {
            label: node.label,
            nodeType: node.type
          },
          position: {
            x: startX + index * nodeWidth,
            y: level * levelHeight + 50
          }
        });
      });
    });

    // Create edges
    mindMapData.edges.forEach((edge, index) => {
      edges.push({
        id: `edge-${index}`,
        source: edge.source,
        target: edge.target,
        type: 'smoothstep',
        style: { stroke: '#94a3b8', strokeWidth: 2 },
        animated: false
      });
    });

    return { flowNodes: nodes, flowEdges: edges };
  }, [mindMapData]);

  const [nodes, setNodes, onNodesChange] = useNodesState(flowNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(flowEdges);

  // Update nodes when flowNodes changes
  useEffect(() => {
    setNodes(flowNodes);
    setEdges(flowEdges);
  }, [flowNodes, flowEdges, setNodes, setEdges]);

  // Regenerate map
  const handleRegenerate = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const materialData = materials
        .filter(m => m.content_text || m.summary)
        .map(m => ({
          name: m.name,
          content: m.content_text || m.summary || ''
        }));

      const notebookData = notebooks
        .filter(n => n.content)
        .map(n => ({
          title: n.title,
          content: n.content || ''
        }));

      const data = await generateMindMapFromContent(materialData, notebookData, studySetName);

      if (!data.nodes || data.nodes.length === 0) {
        setError('No se pudieron extraer conceptos del contenido.');
      } else {
        setMindMapData(data);
      }
    } catch (err) {
      setError('Error al regenerar el mapa mental.');
    } finally {
      setLoading(false);
    }
  }, [materials, notebooks, studySetName]);

  if (loading) {
    return (
      <div className="h-[500px] bg-slate-50 rounded-2xl border border-slate-200 flex flex-col items-center justify-center gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-500 border-t-transparent" />
        <p className="text-slate-600 font-medium">Analizando contenido y generando mapa mental...</p>
        <p className="text-slate-400 text-sm">Esto puede tomar unos segundos</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-[500px] bg-slate-50 rounded-2xl border border-slate-200 flex flex-col items-center justify-center gap-4 p-6">
        <span className="material-symbols-outlined text-5xl text-slate-400">error_outline</span>
        <p className="text-slate-600 text-center">{error}</p>
        <div className="flex gap-3">
          <button
            onClick={handleRegenerate}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-lg">refresh</span>
            Reintentar
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors"
            >
              Cerrar
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-indigo-600">hub</span>
          <h3 className="font-bold text-slate-800">Mapa Mental de Conceptos</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRegenerate}
            className="p-2 text-slate-600 hover:bg-white/50 rounded-lg transition-colors"
            title="Regenerar mapa"
          >
            <span className="material-symbols-outlined">refresh</span>
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 text-slate-600 hover:bg-white/50 rounded-lg transition-colors"
              title="Cerrar"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          )}
        </div>
      </div>

      {/* Mind Map */}
      <div className="h-[450px] bg-slate-50">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.3}
          maxZoom={1.5}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#e2e8f0" gap={20} />
          <Controls
            showInteractive={false}
            className="!bg-white !border-slate-200 !shadow-md"
          />
        </ReactFlow>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 px-4 py-3 bg-slate-50 border-t border-slate-200">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-gradient-to-r from-indigo-500 to-purple-600" />
          <span className="text-xs text-slate-600">Tema Central</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-blue-200" />
          <span className="text-xs text-slate-600">Concepto</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-emerald-200" />
          <span className="text-xs text-slate-600">Subconcepto</span>
        </div>
      </div>
    </div>
  );
};

export default ConceptMindMap;
