import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import { useUIStore } from '../store/useUIStore';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import { 
  forceSimulation, 
  forceManyBody, 
  forceLink, 
  forceCenter 
} from 'd3-force-3d';
import { 
  Play,
  Pause,
  Crosshair,
  Plus,
  Minus,
  Type,
  Search,
  X,
  Database,
  Filter,
  Cpu
} from 'lucide-react';

import { 
  parseNotesToGraph, 
  extractWikiLinks, 
  extractInlineTags,
} from '../utils/graphParser';

import { 
  GraphTheme, 
  THEME_CONFIG, 
  Graph3DNode, 
  Graph3DLink, 
  NexusNote, 
  ParsedGraphResult 
} from './graph/types';
import { NodeMesh } from './graph/NodeMesh';
import { EdgeLines } from './graph/EdgeLines';
import { CameraController } from './graph/CameraController';
import { InspectorPanel } from './graph/InspectorPanel';
import { useForceWorker } from './graph/useForceWorker';
import { useNexusStore, NodeSpatialCoord } from '../store/useNexusStore';

export type { GraphTheme };

export interface C137GraphViewProps {
  notes?: NexusNote[];
  activeNoteId?: string;
  onNoteSelect?: (noteId: string) => void;
  standalone?: boolean;
  theme?: GraphTheme;
}

// ✅ Función auxiliar pura: Sin Hooks dentro de ella
function buildConstellationBenchmark() {
  const TOTAL = 150;
  const rawNodes: Graph3DNode[] = [];
  const clusterNames = ['ALPHA', 'VEGA', 'ORION', 'SIRIUS', 'CYGNUS', 'PULSAR'];
  const clusterCenters = [
    [0, 0, 0],
    [-15, 8, -8],
    [15, -6, 9],
    [-10, -12, 12],
    [12, 14, -10],
    [0, 16, 14]
  ];

  for (let i = 0; i < TOTAL; i++) {
    const clusterId = i % clusterCenters.length;
    const center = clusterCenters[clusterId];
    const r = 5 + (Math.sin(i * 3 + 1) * 10000 % 1) * 16;
    const theta = (Math.sin(i * 3 + 2) * 10000 % 1) * Math.PI * 2;
    const phi = ((Math.sin(i * 3 + 3) * 10000 % 1) - 0.5) * Math.PI;

    const isRelay = (Math.sin(i * 7 + 5) * 10000 % 1) > 0.65;

    rawNodes.push({
      id: i,
      slug: `benchmark-${i}`,
      name: `C137-${clusterNames[clusterId]}-${i.toString().padStart(3, '0')}`,
      type: isRelay ? 'relay' : 'primary',
      x: center[0] + r * Math.cos(theta) * Math.cos(phi),
      y: center[1] + r * Math.sin(phi),
      z: center[2] + r * Math.sin(theta) * Math.cos(phi),
      baseScale: isRelay ? 0.4 : 0.28,
      cluster: clusterId,
      degree: 0,
      connections: [],
      bandwidth: `${(1.5 + (i * 0.8) % 7).toFixed(1)} Tbps`,
      signalStrength: Math.floor(82 + (i * 3) % 18)
    });
  }

  const rawLinks: Graph3DLink[] = [];
  const counts = new Array(TOTAL).fill(0);

  for (let i = 0; i < TOTAL; i++) {
    for (let j = i + 1; j < TOTAL; j++) {
      if (counts[i] >= 4 || counts[j] >= 4) continue;
      const dx = rawNodes[i].x - rawNodes[j].x;
      const dy = rawNodes[i].y - rawNodes[j].y;
      const dz = rawNodes[i].z - rawNodes[j].z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (dist < 10.5) {
        rawLinks.push({ 
          source: i, 
          target: j, 
          distance: dist,
          weight: 1.0,
          type: 'wikilink'
        });
        rawNodes[i].connections.push(j);
        rawNodes[j].connections.push(i);
        rawNodes[i].degree++;
        rawNodes[j].degree++;
        counts[i]++;
        counts[j]++;
      }
    }
  }

  const simulation = forceSimulation(rawNodes, 3)
    .force('charge', forceManyBody().strength(-80).distanceMax(45))
    .force('link', forceLink(rawLinks).id((d: any) => d.id).distance(7.5).strength(0.45))
    .force('center', forceCenter(0, 0, 0))
    .stop();

  for (let step = 0; step < 180; ++step) {
    simulation.tick();
  }

  rawNodes.forEach((node, i) => {
    if (!Number.isFinite(node.x)) node.x = Math.sin(i * 1.5) * 20;
    if (!Number.isFinite(node.y)) node.y = Math.cos(i * 2.1) * 20;
    if (!Number.isFinite(node.z)) node.z = Math.sin(i * 3.3) * 20;
  });

  return { nodes: rawNodes, links: rawLinks };
}

interface SceneProps {
  nodes: Graph3DNode[];
  links: Graph3DLink[];
  dataModeKey: string;
  autoRotate: boolean;
  bloomBoost: boolean;
  hoveredId: number | null;
  selectedId: number | null;
  activeNeighbors: Set<number>;
  onHover: (id: number | null) => void;
  onSelect: (id: number) => void;
  controlsRef: React.RefObject<any>;
  theme: GraphTheme;
  showLabels?: boolean;
  inspectorOpen?: boolean;
  activeCategory?: string | null;
  matchingNodeIds?: Set<number>;
  onNodeDrag?: (id: number, pos: { x: number; y: number; z: number }) => void;
  onNodePin?: (id: number, pos: { x: number; y: number; z: number }) => void;
  recenterTrigger?: number;
}

function Scene({
  nodes,
  links,
  dataModeKey,
  autoRotate,
  bloomBoost,
  hoveredId,
  selectedId,
  activeNeighbors,
  onHover,
  onSelect,
  controlsRef,
  theme,
  showLabels = true,
  inspectorOpen,
  activeCategory,
  matchingNodeIds,
  onNodeDrag,
  onNodePin,
  recenterTrigger = 0
}: SceneProps) {
  const groupRef = useRef<THREE.Group>(null);
  const starsRef = useRef<THREE.Group>(null);
  const themeCfg = THEME_CONFIG[theme];

  useEffect(() => {
    if (starsRef.current) {
      starsRef.current.traverse((child: any) => {
        if (child.isPoints && child.material) {
          child.material.transparent = true;
          child.material.opacity = 0.25;
        }
      });
    }
  }, []);

  useFrame((_, delta) => {
    if (groupRef.current && autoRotate) {
      const speed = selectedId !== null ? 0.008 : 0.035;
      groupRef.current.rotation.y += delta * speed;
    }
  });

  return (
    <>
      <color attach="background" args={[themeCfg.bg]} />
      <ambientLight intensity={0.3} />

      <group ref={starsRef}>
        <Stars 
          radius={80} 
          depth={60} 
          count={400} 
          factor={themeCfg.starsFactor * 0.2} 
          saturation={0.5} 
          fade 
          speed={0.7} 
        />
      </group>

      <group ref={groupRef} key={`${dataModeKey}-${theme}`}>
        <NodeMesh
          nodes={nodes}
          hoveredId={hoveredId}
          selectedId={selectedId}
          activeNeighbors={activeNeighbors}
          onHover={onHover}
          onSelect={onSelect}
          bloomBoost={bloomBoost}
          theme={theme}
          activeCategory={activeCategory}
          showLabels={showLabels}
          matchingNodeIds={matchingNodeIds}
          controlsRef={controlsRef}
          onNodeDrag={onNodeDrag}
          onNodePin={onNodePin}
        />
        <EdgeLines
          nodes={nodes}
          links={links}
          hoveredId={hoveredId}
          selectedId={selectedId}
          theme={theme}
          activeCategory={activeCategory}
          matchingNodeIds={matchingNodeIds}
        />
      </group>

      <CameraController
        nodes={nodes}
        links={links}
        selectedId={selectedId}
        controlsRef={controlsRef}
        inspectorOpen={inspectorOpen}
        dofRef={{ current: null }}
        recenterTrigger={recenterTrigger}
      />

      <OrbitControls
        ref={controlsRef}
        enableDamping
        dampingFactor={0.06}
        minDistance={5}
        maxDistance={400}
        rotateSpeed={0.7}
        panSpeed={0.6}
        touches={{
          ONE: THREE.TOUCH.ROTATE,
          TWO: THREE.TOUCH.DOLLY_PAN
        }}
      />

      <EffectComposer multisampling={0}>
        <Bloom
          luminanceThreshold={0.6}
          luminanceSmoothing={0.75}
          intensity={0.4}
          mipmapBlur
        />
      </EffectComposer>
    </>
  );
}

function updateUrlNote(slugOrName: string | null) {
  if (typeof window === 'undefined') return;
  try {
    const url = new URL(window.location.href);
    if (slugOrName && slugOrName.trim().length > 0) {
      url.searchParams.set('note', slugOrName.trim());
    } else {
      url.searchParams.delete('note');
    }
    window.history.replaceState(null, '', url.pathname + (url.search ? url.search : ''));
  } catch {
    // Fail-safe
  }
}

function buildIncrementalNexusGraph(
  notes: NexusNote[],
  prevNodes?: Graph3DNode[],
  savedPositions?: Record<string, NodeSpatialCoord>
): { nodes: Graph3DNode[]; links: Graph3DLink[] } {
  const nodes: Graph3DNode[] = [];
  const links: Graph3DLink[] = [];

  const prevMap = new Map<string, { x: number; y: number; z: number; vx?: number; vy?: number; vz?: number }>();

  if (savedPositions) {
    Object.entries(savedPositions).forEach(([slug, pos]) => {
      if (Number.isFinite(pos.x) && Number.isFinite(pos.y) && Number.isFinite(pos.z)) {
        prevMap.set(slug, pos);
      }
    });
  }

  if (prevNodes && prevNodes.length > 0) {
    prevNodes.forEach((n) => {
      if (Number.isFinite(n.x) && Number.isFinite(n.y) && Number.isFinite(n.z)) {
        prevMap.set(n.slug, { x: n.x, y: n.y, z: n.z, vx: n.vx, vy: n.vy, vz: n.vz });
      }
    });
  }

  const titleToNodeIndex = new Map<string, number>();
  const tagToNodeIndex = new Map<string, number>();

  notes.forEach((note, idx) => {
    const slug = note.id;
    const prev = prevMap.get(slug);

    let x: number, y: number, z: number;
    let vx: number | undefined, vy: number | undefined, vz: number | undefined;

    if (prev && Number.isFinite(prev.x)) {
      x = prev.x;
      y = prev.y;
      z = prev.z;
      vx = prev.vx;
      vy = prev.vy;
      vz = prev.vz;
    } else {
      const angle = (idx / Math.max(notes.length, 1)) * Math.PI * 2;
      const rad = 7 + (idx % 5) * 2.2;
      x = Math.cos(angle) * rad + (Math.random() - 0.5) * 2.5;
      y = Math.sin(angle) * rad + (Math.random() - 0.5) * 2.5;
      z = (Math.random() - 0.5) * 6;
    }

    const node: Graph3DNode = {
      id: idx,
      slug: note.id,
      name: note.title,
      type: 'primary',
      x, y, z, vx, vy, vz,
      baseScale: 0.35,
      cluster: idx % 5,
      degree: 0,
      connections: [],
      content: note.content,
      tags: [...note.tags],
      category: note.category || 'General',
      bandwidth: `${(2.4 + (idx * 0.7) % 6).toFixed(1)} Tbps`,
      signalStrength: 85 + (idx * 7) % 15
    };

    nodes.push(node);
    titleToNodeIndex.set(note.title.trim().toLowerCase(), idx);
  });

  const uniqueTags = new Set<string>();
  notes.forEach((note) => {
    note.tags.forEach((t) => uniqueTags.add(t.toLowerCase().replace(/^#/, '')));
    const inline = extractInlineTags(note.content);
    inline.forEach((t) => uniqueTags.add(t));
  });

  let currentIdx = nodes.length;
  uniqueTags.forEach((tag) => {
    const tagSlug = `tag-${tag}`;
    const prev = prevMap.get(tagSlug);

    let x: number, y: number, z: number;
    let vx: number | undefined, vy: number | undefined, vz: number | undefined;

    if (prev && Number.isFinite(prev.x)) {
      x = prev.x; y = prev.y; z = prev.z;
      vx = prev.vx; vy = prev.vy; vz = prev.vz;
    } else {
      x = (Math.random() - 0.5) * 22;
      y = (Math.random() - 0.5) * 22;
      z = (Math.random() - 0.5) * 22;
    }

    const tagNode: Graph3DNode = {
      id: currentIdx,
      slug: tagSlug,
      name: `#${tag.toUpperCase()}`,
      type: 'relay',
      x, y, z, vx, vy, vz,
      baseScale: 0.45,
      cluster: (currentIdx % 4) + 1,
      degree: 0,
      connections: [],
      category: 'Tag Hub',
      bandwidth: '10.0 Tbps (Hub)',
      signalStrength: 98
    };

    nodes.push(tagNode);
    tagToNodeIndex.set(tag, currentIdx);
    currentIdx++;
  });

  const existingLinks = new Set<string>();
  function addLink(sourceIdx: number, targetIdx: number, type: 'wikilink' | 'tag', weight = 1.0) {
    if (sourceIdx === targetIdx) return;
    const linkKey = sourceIdx < targetIdx ? `${sourceIdx}-${targetIdx}` : `${targetIdx}-${sourceIdx}`;
    if (existingLinks.has(linkKey)) return;
    existingLinks.add(linkKey);

    links.push({
      source: sourceIdx,
      target: targetIdx,
      distance: type === 'tag' ? 6.5 : 8.5,
      weight,
      type
    });

    nodes[sourceIdx].connections.push(targetIdx);
    nodes[targetIdx].connections.push(sourceIdx);
    nodes[sourceIdx].degree++;
    nodes[targetIdx].degree++;
  }

  notes.forEach((note, noteIdx) => {
    const wikiLinks = extractWikiLinks(note.content);
    wikiLinks.forEach((targetTitle) => {
      const targetIdx = titleToNodeIndex.get(targetTitle.trim().toLowerCase());
      if (targetIdx !== undefined) {
        addLink(noteIdx, targetIdx, 'wikilink', 1.2);
      }
    });

    const noteAllTags = new Set([
      ...note.tags.map((t) => t.toLowerCase().replace(/^#/, '')),
      ...extractInlineTags(note.content)
    ]);

    noteAllTags.forEach((tag) => {
      const tagIdx = tagToNodeIndex.get(tag);
      if (tagIdx !== undefined) {
        addLink(noteIdx, tagIdx, 'tag', 0.8);
      }
    });
  });

  nodes.forEach((node) => {
    if (node.type === 'relay') {
      node.baseScale = Math.min(0.7, 0.35 + node.degree * 0.04);
    } else {
      node.baseScale = Math.min(0.55, 0.26 + node.degree * 0.035);
    }
  });

  return { nodes, links };
}

export function C137GraphView({
  notes,
  activeNoteId,
  onNoteSelect,
  standalone = true,
  theme = 'cyberpunk'
}: C137GraphViewProps) {
  const [dataMode, setDataMode] = useState<'nexus' | 'constellation'>('nexus');
  const [currentTheme, setCurrentTheme] = useState<GraphTheme>(theme);
  const [autoRotate, setAutoRotate] = useState(true);
  const [bloomBoost] = useState(false);
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showLabels, setShowLabels] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [recenterTrigger, setRecenterTrigger] = useState(0);

  const controlsRef = useRef<any>(null);
  const blurTimeoutRef = useRef<any>(null);
  const initialDeepLinkCheckedRef = useRef(false);
  const isFirstSimulationRef = useRef(true);

  // ─────────────────────────────────────────────────────────────────────────
  // 1. ZONA DE LÓGICA (Hooks declarados al inicio del componente)
  // ─────────────────────────────────────────────────────────────────────────
  const visualStyle = useUIStore((state) => state.visualStyle);
  const cycleVisualStyle = useUIStore((state) => state.cycleVisualStyle);
  const aestheticTheme = useUIStore((state) => state.aestheticTheme);
  const cycleAestheticTheme = useUIStore((state) => state.cycleAestheticTheme);
  const showEdges = useUIStore((state) => state.showEdges);
  const toggleShowEdges = useUIStore((state) => state.toggleShowEdges);
  const topologyLayout = useUIStore((state) => state.topologyLayout);
  const cycleTopologyLayout = useUIStore((state) => state.cycleTopologyLayout);
  const glowIntensity = useUIStore((state) => state.glowIntensity);
  const setGlowIntensity = useUIStore((state) => state.setGlowIntensity);

  const { savedPositions, saveNodePositions, setActiveNoteId, notes: storeNotes, injectTestNodes } = useNexusStore();

  useEffect(() => {
    if (theme) setCurrentTheme(theme);
  }, [theme]);

  const sourceNotes = useMemo(() => notes || storeNotes, [notes, storeNotes]);
  const [nexusGraph, setNexusGraph] = useState<ParsedGraphResult>(() => parseNotesToGraph(sourceNotes));
  const constellationGraph = useMemo(() => buildConstellationBenchmark(), []);

  const currentGraph = dataMode === 'nexus' ? nexusGraph : constellationGraph;

  const handleWorkerPositionsUpdate = useCallback((positions: Float32Array) => {
    setNexusGraph((prev) => {
      const updatedNodes = [...prev.nodes];
      const count = Math.min(updatedNodes.length, Math.floor(positions.length / 3));
      let hasChanges = false;

      for (let i = 0; i < count; i++) {
        const offset = i * 3;
        const nx = positions[offset + 0];
        const ny = positions[offset + 1];
        const nz = positions[offset + 2];

        if (Number.isFinite(nx) && Number.isFinite(ny) && Number.isFinite(nz)) {
          updatedNodes[i] = {
            ...updatedNodes[i],
            x: nx,
            y: ny,
            z: nz
          };
          hasChanges = true;
        }
      }

      return hasChanges ? { ...prev, nodes: updatedNodes } : prev;
    });
  }, []);

  const handleWorkerSimulationEnd = useCallback((positions: Float32Array) => {
    const posMap: Record<string, { x: number; y: number; z: number }> = {};
    setNexusGraph((prev) => {
      const count = Math.min(prev.nodes.length, Math.floor(positions.length / 3));
      for (let i = 0; i < count; i++) {
        const offset = i * 3;
        const node = prev.nodes[i];
        if (node && node.slug) {
          posMap[node.slug] = {
            x: positions[offset + 0],
            y: positions[offset + 1],
            z: positions[offset + 2]
          };
        }
      }
      return prev;
    });
    saveNodePositions(posMap);
  }, [saveNodePositions]);

  const {
    dispatchSimulation,
    reheat,
    stop: stopWorkerSimulation,
    pinNode,
    isSimulating
  } = useForceWorker({
    onPositionsUpdate: handleWorkerPositionsUpdate,
    onSimulationEnd: handleWorkerSimulationEnd
  });

  const handleNodeDrag = useCallback((id: number, pos: { x: number; y: number; z: number }) => {
    setNexusGraph((prev) => {
      const nodes = [...prev.nodes];
      if (nodes[id]) {
        nodes[id] = { ...nodes[id], x: pos.x, y: pos.y, z: pos.z };
        return { ...prev, nodes };
      }
      return prev;
    });
  }, []);

  const handleNodePin = useCallback((id: number, pos: { x: number; y: number; z: number }) => {
    pinNode(id, pos);

    const node = currentGraph.nodes[id];
    if (node && node.slug) {
      saveNodePositions({
        [node.slug]: { x: pos.x, y: pos.y, z: pos.z }
      });
    }

    setNexusGraph((prev) => {
      const nodes = [...prev.nodes];
      if (nodes[id]) {
        nodes[id] = { ...nodes[id], x: pos.x, y: pos.y, z: pos.z };
        return { ...prev, nodes };
      }
      return prev;
    });
  }, [pinNode, currentGraph.nodes, saveNodePositions]);

  useEffect(() => {
    if (dataMode !== 'nexus') return;

    const prevNodes = nexusGraph.nodes;
    const { nodes: newNodes, links: newLinks } = buildIncrementalNexusGraph(
      sourceNotes,
      prevNodes,
      savedPositions
    );

    setNexusGraph({ nodes: newNodes, links: newLinks });

    const isUpdate = !isFirstSimulationRef.current;
    isFirstSimulationRef.current = false;

    dispatchSimulation(newNodes, newLinks, isUpdate);
  }, [sourceNotes, dataMode, dispatchSimulation]);

  useEffect(() => {
    return () => {
      stopWorkerSimulation();
      if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
    };
  }, [stopWorkerSimulation]);

  useEffect(() => {
    if (initialDeepLinkCheckedRef.current) return;
    if (currentGraph.nodes.length === 0) return;
    initialDeepLinkCheckedRef.current = true;

    if (typeof window === 'undefined') return;
    try {
      const params = new URLSearchParams(window.location.search);
      const noteParam = params.get('note');
      const targetId = noteParam || activeNoteId;

      if (targetId) {
        const foundIdx = currentGraph.nodes.findIndex(
          (n) => n.slug === targetId ||
                 n.name.toLowerCase() === targetId.toLowerCase() ||
                 String(n.id) === targetId
        );
        if (foundIdx !== -1) {
          setSelectedId(foundIdx);
          const foundNode = currentGraph.nodes[foundIdx];
          updateUrlNote(foundNode.slug || foundNode.name);
          if (onNoteSelect) onNoteSelect(foundNode.slug || foundNode.name);
        }
      }
    } catch {
      // Fail-safe
    }
  }, [currentGraph.nodes, activeNoteId, onNoteSelect]);

  useEffect(() => {
    if (!activeNoteId) return;

    if (dataMode === 'nexus') {
      const foundIdx = currentGraph.nodes.findIndex(
        (n) => n.slug === activeNoteId || n.name.toLowerCase() === activeNoteId.toLowerCase()
      );
      if (foundIdx !== -1) {
        setSelectedId(foundIdx);
        updateUrlNote(activeNoteId);
      }
    }
  }, [activeNoteId, currentGraph.nodes, dataMode]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handlePopState = () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const noteParam = params.get('note');
        if (noteParam) {
          const foundIdx = currentGraph.nodes.findIndex(
            (n) => n.slug === noteParam ||
                   n.name.toLowerCase() === noteParam.toLowerCase() ||
                   String(n.id) === noteParam
          );
          if (foundIdx !== -1) {
            setSelectedId(foundIdx);
            const node = currentGraph.nodes[foundIdx];
            if (onNoteSelect) onNoteSelect(node.slug || node.name);
          }
        } else {
          setSelectedId(null);
        }
      } catch {
        // Fail-safe
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [currentGraph.nodes, onNoteSelect]);

  const activeFocusId = hoveredId !== null ? hoveredId : selectedId;
  const activeNeighbors = useMemo(() => {
    if (activeFocusId === null) return new Set<number>();
    const node = currentGraph.nodes[activeFocusId];
    return new Set<number>(node ? node.connections : []);
  }, [activeFocusId, currentGraph]);

  const handleSelectNode = useCallback((id: number) => {
    setSelectedId(id);
    const node = currentGraph.nodes[id];
    if (node) {
      updateUrlNote(node.slug || node.name);
      if (onNoteSelect) onNoteSelect(node.slug || node.name);
      if (node.type === 'primary' && node.slug) {
        setActiveNoteId(node.slug);
      }
    }
  }, [currentGraph.nodes, onNoteSelect, setActiveNoteId]);

  const handleModeChange = (newMode: 'nexus' | 'constellation') => {
    if (newMode === 'constellation') {
      stopWorkerSimulation();
    }
    setDataMode(newMode);
    setSelectedId(null);
    setHoveredId(null);
    setActiveCategory(null);
    setSearchTerm('');
    updateUrlNote(null);
    setRecenterTrigger(prev => prev + 1);
  };

  const handleZoom = (factor: number) => {
    if (controlsRef.current) {
      const cam = controlsRef.current.object;
      const target = controlsRef.current.target;
      const offset = cam.position.clone().sub(target);
      offset.multiplyScalar(factor);
      cam.position.copy(target).add(offset);
      controlsRef.current.update();
    }
  };

  const handleResetCamera = () => {
    setSelectedId(null);
    setHoveredId(null);
    setActiveCategory(null);
    updateUrlNote(null);
    setActiveNoteId('');
    if (onNoteSelect) onNoteSelect('');
    setRecenterTrigger(prev => prev + 1);
  };

  const handleCloseInspector = () => {
    setSelectedId(null);
    updateUrlNote(null);
    setActiveNoteId('');
    if (onNoteSelect) onNoteSelect('');
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedId(null);
        setSearchTerm('');
        updateUrlNote(null);
        setActiveNoteId('');
        if (onNoteSelect) onNoteSelect('');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onNoteSelect, setActiveNoteId]);

  const selectedNode = selectedId !== null ? currentGraph.nodes[selectedId] : null;

  const lastSelectedNodeRef = useRef<Graph3DNode | null>(null);
  if (selectedNode) {
    lastSelectedNodeRef.current = selectedNode;
  }
  const displayNode = selectedNode || lastSelectedNodeRef.current;

  const categories = useMemo(() => {
    const map = new Map<string, { count: number; color: string }>();
    const PALETTE = ['#00f0ff', '#a855f7', '#f59e0b', '#10b981', '#ec4899', '#38bdf8', '#fb923c'];
    let colorIdx = 0;

    currentGraph.nodes.forEach((n) => {
      let cat = n.category || (n.type === 'primary' ? 'Notas' : 'Hubs');
      const existing = map.get(cat);
      if (existing) {
        existing.count += 1;
      } else {
        const color = PALETTE[colorIdx % PALETTE.length];
        colorIdx++;
        map.set(cat, { count: 1, color });
      }
    });

    return Array.from(map.entries()).map(([name, val]) => ({
      name,
      count: val.count,
      color: val.color,
    }));
  }, [currentGraph]);

  const handleFilterCategory = (catName: string) => {
    if (activeCategory === catName) {
      setActiveCategory(null);
    } else {
      setActiveCategory(catName);
      const firstInCat = currentGraph.nodes.find(
        (n) => (n.category === catName) || (!n.category && (catName === 'Notas' || catName === 'Hubs'))
      );
      if (firstInCat) {
        handleSelectNode(firstInCat.id);
      }
    }
  };

  const searchInputRef = useRef<HTMLInputElement>(null);

  const matchingNodeIds = useMemo(() => {
    if (!searchTerm.trim()) return new Set<number>();
    const q = searchTerm.toLowerCase();
    const set = new Set<number>();
    
    const contentMap = new Map<string, string>();
    storeNotes.forEach(note => {
      if (note.content) contentMap.set(note.id, note.content.toLowerCase());
    });

    currentGraph.nodes.forEach((n, idx) => {
      const content = n.slug ? contentMap.get(n.slug) : undefined;
      if (
        n.name.toLowerCase().includes(q) ||
        (n.category && n.category.toLowerCase().includes(q)) ||
        (n.tags && n.tags.some((t) => t.toLowerCase().includes(q))) ||
        (content && content.includes(q))
      ) {
        set.add(idx);
      }
    });
    return set;
  }, [searchTerm, currentGraph.nodes, storeNotes]);

  const searchResults = useMemo(() => {
    if (!searchTerm.trim() || matchingNodeIds.size === 0) return [];
    const results: Graph3DNode[] = [];
    for (const idx of matchingNodeIds) {
      const node = currentGraph.nodes[idx];
      if (node) {
        results.push(node);
        if (results.length >= 8) break;
      }
    }
    return results;
  }, [searchTerm, matchingNodeIds, currentGraph.nodes]);

  useEffect(() => {
    const handleSlashKey = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleSlashKey);
    return () => window.removeEventListener('keydown', handleSlashKey);
  }, []);

  const themeCfg = THEME_CONFIG[currentTheme];

  return (
    <div id="c137-view" className="relative w-full h-full overflow-hidden select-none font-sans text-slate-100" style={{ backgroundColor: themeCfg.bg }}>
      
      {/* CANVAS WEBGL 3D */}
      <div 
        className="absolute inset-0 z-0"
        onPointerDown={(e) => {
          if (e.target === e.currentTarget && selectedId !== null) {
            handleCloseInspector();
          }
        }}
      >
        <Canvas
          dpr={[1, Math.min(typeof window !== 'undefined' ? window.devicePixelRatio : 1, 1.5)]}
          camera={{ position: [0, 8, 38], fov: 45 }}
          gl={{ antialias: false, powerPreference: 'high-performance', alpha: false }}
          raycaster={{
            params: {
              Mesh: { threshold: 0.4 },
              Line: { threshold: 0.3 }
            }
          }}
        >
          <Scene
            nodes={currentGraph.nodes}
            links={currentGraph.links}
            dataModeKey={dataMode}
            autoRotate={autoRotate}
            bloomBoost={bloomBoost || matchingNodeIds.size > 0}
            hoveredId={hoveredId}
            selectedId={selectedId}
            activeNeighbors={activeNeighbors}
            onHover={setHoveredId}
            onSelect={handleSelectNode}
            controlsRef={controlsRef}
            theme={currentTheme}
            showLabels={showLabels}
            inspectorOpen={selectedNode !== null}
            activeCategory={activeCategory}
            matchingNodeIds={matchingNodeIds}
            onNodeDrag={handleNodeDrag}
            onNodePin={handleNodePin}
            recenterTrigger={recenterTrigger}
          />
        </Canvas>
      </div> 

      {/* 1. LEYENDA SUPERIOR IZQUIERDA */}
      <div className="absolute top-4 left-4 z-20 flex flex-col gap-2 pointer-events-auto max-w-[240px]">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-950/70 backdrop-blur-md border border-white/10 shadow-lg w-fit">
          <div className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#00f0ff] animate-pulse" />
          <span className="text-xs font-semibold text-white tracking-wide">Nexus Graph</span>
          <span className="text-[10px] font-mono text-slate-400">{currentGraph.nodes.length}</span>
        </div>

        <div className="p-3 rounded-2xl bg-gray-950/70 backdrop-blur-md border border-white/10 shadow-xl space-y-1.5">
          <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-slate-400 px-1">
            <span>Categorías</span>
            <Filter className="w-3 h-3 text-slate-500" />
          </div>
          <div className="space-y-0.5">
            {categories.map((cat) => {
              const isSelected = activeCategory === cat.name;
              return (
                <button
                  key={cat.name}
                  onClick={() => handleFilterCategory(cat.name)}
                  className={`w-full flex items-center justify-between px-2 py-1 rounded-lg text-xs transition-all ${
                    isSelected 
                      ? 'bg-white/15 text-white font-medium ring-1 ring-white/20' 
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{
                        backgroundColor: cat.color,
                        boxShadow: `0 0 6px ${cat.color}`
                      }}
                    />
                    <span className="truncate text-[11px]">{cat.name}</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 ml-2">{cat.count}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 2. BUSCADOR RÁPIDO FLOTANTE */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 pointer-events-auto w-full max-w-sm px-4">
        <div className="relative">
          <div className="relative flex items-center">
            <Search className={`w-4 h-4 absolute left-3.5 transition-colors ${
              matchingNodeIds.size > 0 ? 'text-cyan-400 animate-pulse' : 'text-slate-400'
            }`} />
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => {
                if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
                blurTimeoutRef.current = setTimeout(() => setIsSearchFocused(false), 220);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && searchResults.length > 0) {
                  handleSelectNode(searchResults[0].id);
                  setIsSearchFocused(false);
                  searchInputRef.current?.blur();
                } else if (e.key === 'Escape') {
                  setSearchTerm('');
                  setIsSearchFocused(false);
                  searchInputRef.current?.blur();
                }
              }}
              placeholder="Buscar en el grafo 3D... (Presiona /)"
              className="w-full pl-10 pr-24 py-2 text-xs text-slate-100 placeholder:text-slate-500
                         bg-gray-950/80 hover:bg-gray-950/90 focus:bg-gray-950
                         border border-white/15 focus:border-cyan-400/80 focus:ring-2 focus:ring-cyan-400/20
                         rounded-full backdrop-blur-xl outline-none transition-all shadow-2xl"
            />
            
            <div className="absolute right-3 flex items-center gap-1.5 pointer-events-auto">
              {searchTerm ? (
                <>
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${
                    matchingNodeIds.size > 0 
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 shadow-[0_0_8px_rgba(0,240,255,0.3)]' 
                      : 'bg-amber-500/20 text-amber-300 border border-amber-400/40'
                  }`}>
                    {matchingNodeIds.size > 0 ? `${matchingNodeIds.size}` : '0'}
                  </span>
                  <button
                    onClick={() => {
                      setSearchTerm('');
                      searchInputRef.current?.focus();
                    }}
                    className="text-slate-400 hover:text-white p-0.5 rounded-full transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </>
              ) : (
                <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-white/5 border border-white/10 rounded">
                  /
                </kbd>
              )}
            </div>
          </div>

          {isSearchFocused && searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 max-h-64 overflow-y-auto rounded-2xl bg-gray-950/95 backdrop-blur-xl border border-white/15 shadow-2xl p-1.5 space-y-1 z-30">
              <div className="flex items-center justify-between px-2 py-1 text-[10px] font-mono text-slate-400 border-b border-white/5">
                <span>Coincidencias en constelación</span>
                <span className="text-cyan-400">Enter para enfocar</span>
              </div>
              {searchResults.map((node) => (
                <button
                  key={node.id}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelectNode(node.id);
                    setSearchTerm('');
                    setIsSearchFocused(false);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs text-slate-200 hover:text-white hover:bg-cyan-500/15 transition-all group"
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_6px_#00f0ff] shrink-0" />
                    <span className="truncate font-medium group-hover:text-cyan-200">{node.name}</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 shrink-0 ml-2 bg-white/5 px-2 py-0.5 rounded-md">
                    {node.category || (node.type === 'primary' ? 'Nota' : 'Hub')}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 3. BARRA FLOTANTE INFERIOR (Dock de controles) */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 pointer-events-auto max-w-[95vw] overflow-x-auto scrollbar-none">
        <div className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-gray-950/80 backdrop-blur-md border border-white/10 shadow-2xl text-slate-300">
          
          {/* Pausa / Activar Rotación */}
          <button
            onClick={() => setAutoRotate(prev => !prev)}
            title={autoRotate ? "Congelar movimiento" : "Fluir constelación"}
            className={`p-2 rounded-full transition-all ${
              autoRotate ? 'text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            {autoRotate ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>

          {/* Centrar Cámara */}
          <button
            onClick={handleResetCamera}
            title="Centrar Cámara"
            className="p-2 rounded-full text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-all"
          >
            <Crosshair className="w-4 h-4" />
          </button>

          <div className="w-px h-4 bg-white/10 mx-1" />

          {/* ROTADOR DE TEMAS ESTÉTICOS */}
          <button
            onClick={cycleAestheticTheme}
            title="Cambiar Tema Estético (10 Temas)"
            className="px-2.5 py-1 rounded-full text-[11px] font-mono text-slate-300 hover:text-cyan-300 hover:bg-white/5 transition-all flex items-center gap-1.5 border border-white/10"
          >
            🎨 <span className="capitalize font-bold text-white">{aestheticTheme}</span>
          </button>

          {/* BOTÓN DE VISIBILIDAD DE RED / CONEXIONES */}
          <button
            onClick={toggleShowEdges}
            title={showEdges ? "Ocultar Conexiones" : "Mostrar Conexiones"}
            className={`px-2.5 py-1 rounded-full text-[11px] font-mono transition-all flex items-center gap-1.5 border ${
              showEdges 
                ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30' 
                : 'bg-white/5 text-slate-400 border-white/10 hover:text-slate-200'
            }`}
          >
            <span>{showEdges ? '🌐' : '🚫'}</span>
            <span className="hidden sm:inline">{showEdges ? 'Red Visible' : 'Red Oculta'}</span>
          </button>

          {/* CONMUTADOR DE TOPOLOGÍA / LAYOUT */}
          <button
            onClick={() => {
              cycleTopologyLayout();
              reheat(0.5);
            }}
            title="Cambiar Disposición Topológica de la Red (Orgánica -> Esférica -> Cúmulos)"
            className="px-2.5 py-1 rounded-full text-[11px] font-mono bg-white/5 hover:bg-white/10 text-slate-300 transition-all flex items-center gap-1.5 border border-white/10"
          >
            <span>🧩</span>
            <span className="capitalize hidden sm:inline">
              {topologyLayout === 'organic' && 'Orgánica'}
              {topologyLayout === 'spherical' && 'Esférica'}
              {topologyLayout === 'clustered' && 'Cúmulos'}
            </span>
          </button>

          {/* INTENSIDAD DE GLOW */}
          <label
            title="Intensidad del glow"
            className="px-2.5 py-1 rounded-full text-[11px] font-mono text-slate-300 flex items-center gap-1.5 border border-white/10 cursor-pointer"
          >
            <span className="hidden sm:inline">Glow</span>
            <input
              type="range"
              min="0.1"
              max="2.5"
              step="0.05"
              value={glowIntensity}
              onChange={(e) => setGlowIntensity(Number(e.target.value))}
              className="w-20 h-1 accent-cyan-400 cursor-pointer"
            />
            <span className="text-cyan-300 tabular-nums min-w-[2.75rem] text-right">
              {Math.round(glowIntensity * 100)}%
            </span>
          </label>

          <div className="w-px h-4 bg-white/10 mx-1" />

          {/* Zoom In / Zoom Out */}
          <button
            onClick={() => handleZoom(0.75)}
            title="Acercar (+)"
            className="p-2 rounded-full text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-all"
          >
            <Plus className="w-4 h-4" />
          </button>

          <button
            onClick={() => handleZoom(1.33)}
            title="Alejar (-)"
            className="p-2 rounded-full text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-all"
          >
            <Minus className="w-4 h-4" />
          </button>

          <div className="w-px h-4 bg-white/10 mx-1" />

          {/* Conmutador de Etiquetas */}
          <button
            onClick={() => setShowLabels(prev => !prev)}
            title={showLabels ? "Ocultar etiquetas" : "Mostrar etiquetas"}
            className={`p-2 rounded-full transition-all ${
              showLabels ? 'text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            <Type className="w-4 h-4" />
          </button>

          <div className="w-px h-4 bg-white/10 mx-1" />

          {/* Web Worker de Físicas */}
          <button
            onClick={() => reheat(0.35)}
            title="Re-ejecutar física en Web Worker (60 FPS)"
            className={`px-2.5 py-1 rounded-full text-[11px] font-mono transition-all flex items-center gap-1.5 ${
              isSimulating
                ? 'text-cyan-400 bg-cyan-500/10 border border-cyan-500/30'
                : 'text-slate-400 hover:text-cyan-300 hover:bg-white/5'
            }`}
          >
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">{isSimulating ? 'Worker 60 FPS' : 'Worker Físicas'}</span>
            <span className={`w-1.5 h-1.5 rounded-full ${isSimulating ? 'bg-cyan-400 animate-ping' : 'bg-emerald-400'}`} />
          </button>

          <div className="w-px h-4 bg-white/10 mx-1" />

          {/* Cambiar Fuente de Datos (Nexus / Benchmark) */}
          <button
            onClick={() => handleModeChange(dataMode === 'nexus' ? 'constellation' : 'nexus')}
            title={dataMode === 'nexus' ? "Cambiar a Benchmark 150 Nodos" : "Cambiar a BBDD Nexus"}
            className="px-2.5 py-1 rounded-full text-[11px] font-mono text-slate-400 hover:text-cyan-300 hover:bg-white/5 transition-all flex items-center gap-1.5"
          >
            <Database className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{dataMode === 'nexus' ? 'Nexus' : '150N'}</span>
          </button>

          <div className="w-px h-4 bg-white/10 mx-1" />

          {/* Prueba de Carga / Estrés de Nodos */}
          <button
            onClick={() => {
              const currentCount = currentGraph.nodes.length;
              const nextAmount =
                currentCount >= 1500
                  ? 500
                  : currentCount >= 1000
                  ? 1500
                  : currentCount >= 500
                  ? 1000
                  : 500;

              injectTestNodes(nextAmount);
            }}
            title="Prueba de Carga / Estrés de Nodos (Hasta 1500)"
            className="px-2.5 py-1 rounded-full text-[11px] font-mono text-slate-400 hover:text-emerald-300 hover:bg-white/5 transition-all flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Estrés ({currentGraph.nodes.length})</span>
          </button>

        </div>
      </div>

      {/* 4. PANEL INSPECTOR DE NOTAS */}
      <InspectorPanel
        selectedNode={selectedNode}
        displayNode={displayNode}
        nodes={currentGraph.nodes}
        themeCfg={themeCfg}
        handleCloseInspector={handleCloseInspector}
        handleSelectNode={handleSelectNode}
        setHoveredId={setHoveredId}
        controlsRef={controlsRef}
        onOpenNote={(slug) => {
          if (onNoteSelect) onNoteSelect(slug);
        }}
      />
    </div>
  );
}

export default C137GraphView;