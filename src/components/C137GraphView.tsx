import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Stars, Html } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import ReactMarkdown from 'react-markdown';
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
  FileText,
  Tag,
  Link2,
  ArrowRight,
  Database,
  Filter
} from 'lucide-react';

import { 
  parseNotesToGraph, 
  extractWikiLinks, 
  extractInlineTags, 
  Graph3DNode, 
  Graph3DLink, 
  NexusNote,
  ParsedGraphResult
} from '../utils/graphParser';
import { MOCK_NEXUS_NOTES } from '../data/mockNotes';

import { NodeMesh } from './graph/NodeMesh';
import { EdgeLines } from './graph/EdgeLines';
import { CameraController } from './graph/CameraController';
import { InspectorPanel } from './graph/InspectorPanel';

export type GraphTheme = 'cyberpunk' | 'emerald' | 'amber';

export interface C137GraphViewProps {
  notes?: NexusNote[];
  activeNoteId?: string;
  onNoteSelect?: (noteId: string) => void;
  standalone?: boolean;
  theme?: GraphTheme;
}

const THEME_CONFIG: Record<GraphTheme, {
  bg: string;
  primaryHex: string;
  relayHex: string;
  targetHex: string;
  glowColor: string;
  starsFactor: number;
}> = {
  cyberpunk: {
    bg: '#020617',
    primaryHex: '#00f0ff',
    relayHex: '#7000ff',
    targetHex: '#ffffff',
    glowColor: 'rgba(0, 240, 255, 0.25)',
    starsFactor: 3.5
  },
  emerald: {
    bg: '#021814',
    primaryHex: '#10b981',
    relayHex: '#06b6d4',
    targetHex: '#ffffff',
    glowColor: 'rgba(16, 185, 129, 0.25)',
    starsFactor: 3.0
  },
  amber: {
    bg: '#120b02',
    primaryHex: '#f59e0b',
    relayHex: '#f43f5e',
    targetHex: '#ffffff',
    glowColor: 'rgba(245, 158, 11, 0.25)',
    starsFactor: 3.2
  }
};

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

// -----------------------------------------------------------------------
// 1. NODOS INSTANCIADOS CON RENDERIZADO FLUIDO Y COMPATIBILIDAD
// Components extracted

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
  activeCategory
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
          count={1200} 
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
        />
        <EdgeLines
          nodes={nodes}
          links={links}
          hoveredId={hoveredId}
          selectedId={selectedId}
          theme={theme}
          activeCategory={activeCategory}
        />
      </group>

      <CameraController
        nodes={nodes}
        links={links}
        selectedId={selectedId}
        controlsRef={controlsRef}
        inspectorOpen={inspectorOpen}
        dofRef={{ current: null }}
      />

      <OrbitControls
        ref={controlsRef}
        enableDamping
        dampingFactor={0.06}
        minDistance={10}
        maxDistance={2000}
        rotateSpeed={0.7}
        panSpeed={0.5}
      />

      {showLabels && (hoveredId !== null || selectedId !== null) && (() => {
        const activeId = hoveredId !== null ? hoveredId : selectedId;
        if (activeId === null) return null;
        const node = nodes[activeId];
        if (!node) return null;
        
        const isHover = activeId === hoveredId;
        
        return (
          <Html
            position={[node.x, node.y + (node.baseScale || 0.3) + 0.6, node.z]}
            center
            distanceFactor={35}
            pointerEvents="none"
            zIndexRange={[100, 0]}
          >
            <div className={`px-2.5 py-1 rounded-md bg-gray-950/85 backdrop-blur-md border ${
              isHover 
                ? 'border-cyan-400 shadow-[0_0_10px_rgba(0,240,255,0.5)] text-cyan-300' 
                : 'border-white/20 text-slate-100'
            } text-xs font-sans shadow-xl whitespace-nowrap select-none transition-all`}>
              {node.name}
            </div>
          </Html>
        );
      })()}

      <EffectComposer multisampling={0}>
        <Bloom
          luminanceThreshold={0.15}
          luminanceSmoothing={0.85}
          intensity={bloomBoost ? 2.2 : 1.5}
          mipmapBlur
        />
      </EffectComposer>
    </>
  );
}

// -----------------------------------------------------------------------
// 5. HELPER DE DEEP LINKING Y NAVEGACIÓN
// -----------------------------------------------------------------------
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
    // Fail-safe silencioso
  }
}

function buildIncrementalNexusGraph(
  notes: NexusNote[],
  prevNodes?: Graph3DNode[]
): { nodes: Graph3DNode[]; links: Graph3DLink[] } {
  const nodes: Graph3DNode[] = [];
  const links: Graph3DLink[] = [];

  const prevMap = new Map<string, Graph3DNode>();
  if (prevNodes && prevNodes.length > 0) {
    prevNodes.forEach((n) => prevMap.set(n.slug, n));
  }

  const titleToNodeIndex = new Map<string, number>();
  const tagToNodeIndex = new Map<string, number>();

  notes.forEach((note, idx) => {
    const slug = note.id;
    const prev = prevMap.get(slug);

    let x: number, y: number, z: number;
    let vx: number | undefined, vy: number | undefined, vz: number | undefined;

    if (prev && Number.isFinite(prev.x)) {
      x = prev.x; y = prev.y; z = prev.z;
      vx = prev.vx; vy = prev.vy; vz = prev.vz;
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

// -----------------------------------------------------------------------
// 6. COMPONENTE PRINCIPAL
// -----------------------------------------------------------------------
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

  const controlsRef = useRef<any>(null);
  const simulationRef = useRef<any>(null);
  const blurTimeoutRef = useRef<any>(null);
  const initialDeepLinkCheckedRef = useRef(false);

  useEffect(() => {
    if (theme) setCurrentTheme(theme);
  }, [theme]);

  const sourceNotes = useMemo(() => notes || MOCK_NEXUS_NOTES, [notes]);
  const [nexusGraph, setNexusGraph] = useState<ParsedGraphResult>(() => parseNotesToGraph(sourceNotes));
  const constellationGraph = useMemo(() => buildConstellationBenchmark(), []);

  const currentGraph = dataMode === 'nexus' ? nexusGraph : constellationGraph;

  useEffect(() => {
    const prevNodes = nexusGraph.nodes;
    const { nodes: newNodes, links: newLinks } = buildIncrementalNexusGraph(sourceNotes, prevNodes);

    if (!simulationRef.current) {
      const sim = forceSimulation(newNodes, 3)
        .force('charge', forceManyBody().strength((d: any) => (d.type === 'relay' ? -120 : -75)).distanceMax(50))
        .force('link', forceLink(newLinks).id((d: any) => d.id).distance((l: any) => l.distance).strength(0.5))
        .force('center', forceCenter(0, 0, 0))
        .stop();

      for (let i = 0; i < 180; ++i) {
        sim.tick();
      }

      newNodes.forEach((node, i) => {
        if (!Number.isFinite(node.x)) node.x = Math.sin(i * 1.7) * 15;
        if (!Number.isFinite(node.y)) node.y = Math.cos(i * 2.3) * 15;
        if (!Number.isFinite(node.z)) node.z = Math.sin(i * 3.1) * 15;
      });

      simulationRef.current = sim;
      setNexusGraph({ nodes: newNodes, links: newLinks });
    } else {
      const sim = simulationRef.current;
      sim.nodes(newNodes);

      const linkForce = sim.force('link');
      if (linkForce) linkForce.links(newLinks);

      sim.alpha(0.3).restart();

      sim.on('tick', () => {
        newNodes.forEach((node) => {
          if (!Number.isFinite(node.x)) node.x = 0;
          if (!Number.isFinite(node.y)) node.y = 0;
          if (!Number.isFinite(node.z)) node.z = 0;
        });

        setNexusGraph({ nodes: [...newNodes], links: [...newLinks] });

        if (sim.alpha() < 0.02) {
          sim.stop();
          sim.on('tick', null);
        }
      });
    }
  }, [sourceNotes]);

  useEffect(() => {
    return () => {
      if (simulationRef.current) {
        simulationRef.current.on('tick', null);
        simulationRef.current.stop();
        simulationRef.current = null;
      }
      if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
    };
  }, []);

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
    }
  }, [currentGraph.nodes, onNoteSelect]);

  const handleModeChange = (newMode: 'nexus' | 'constellation') => {
    if (newMode === 'constellation' && simulationRef.current) {
      simulationRef.current.on('tick', null);
      simulationRef.current.stop();
    }
    setDataMode(newMode);
    setSelectedId(null);
    setHoveredId(null);
    setActiveCategory(null);
    setSearchTerm('');
    updateUrlNote(null);
    if (controlsRef.current) {
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.object.position.set(0, 8, 38);
      controlsRef.current.update();
    }
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
    if (onNoteSelect) onNoteSelect('');
    if (controlsRef.current) {
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.object.position.set(0, 8, 38);
      controlsRef.current.update();
    }
  };

  const handleCloseInspector = () => {
    setSelectedId(null);
    updateUrlNote(null);
    if (onNoteSelect) onNoteSelect('');
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedId(null);
        setSearchTerm('');
        updateUrlNote(null);
        if (onNoteSelect) onNoteSelect('');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onNoteSelect]);

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
      // Enfocar automáticamente el primer nodo de la categoría para mejor UX
      const firstInCat = currentGraph.nodes.find(
        (n) => (n.category === catName) || (!n.category && (catName === 'Notas' || catName === 'Hubs'))
      );
      if (firstInCat) {
        handleSelectNode(firstInCat.id);
      }
    }
  };

  const searchResults = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const q = searchTerm.toLowerCase();
    return currentGraph.nodes
      .filter((n) =>
        n.name.toLowerCase().includes(q) ||
        (n.category && n.category.toLowerCase().includes(q)) ||
        (n.tags && n.tags.some((t) => t.toLowerCase().includes(q)))
      )
      .slice(0, 8);
  }, [searchTerm, currentGraph]);

  const themeCfg = THEME_CONFIG[currentTheme];

  return (
    <div id="c137-view" className="relative w-full h-screen overflow-hidden select-none font-sans text-slate-100" style={{ backgroundColor: themeCfg.bg }}>
      
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
        >
          <Scene
            nodes={currentGraph.nodes}
            links={currentGraph.links}
            dataModeKey={dataMode}
            autoRotate={autoRotate}
            bloomBoost={bloomBoost}
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
          />
        </Canvas>
      </div>

      {/* 1. LEYENDA SUPERIOR IZQUIERDA (FILTRO POR CATEGORÍAS) */}
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

      {/* 2. BUSCADOR EN LA PARTE SUPERIOR DERECHA */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2 pointer-events-auto">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => {
              if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
              blurTimeoutRef.current = setTimeout(() => setIsSearchFocused(false), 200);
            }}
            placeholder="Buscar notas..."
            className="w-48 sm:w-60 pl-9 pr-8 py-1.5 text-xs text-slate-200 placeholder:text-slate-500
                       bg-gray-950/60 hover:bg-gray-950/80 focus:bg-gray-950
                       border border-white/10 focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/30
                       rounded-full backdrop-blur-md outline-none transition-all shadow-lg"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5 rounded-full"
            >
              <X className="w-3 h-3" />
            </button>
          )}

          {isSearchFocused && searchResults.length > 0 && (
            <div className="absolute top-full right-0 mt-2 w-64 max-h-60 overflow-y-auto rounded-xl bg-gray-950/90 backdrop-blur-md border border-white/10 shadow-2xl p-1 space-y-0.5 z-30">
              {searchResults.map((node) => (
                <button
                  key={node.id}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelectNode(node.id);
                    setSearchTerm('');
                    setIsSearchFocused(false);
                  }}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-xs text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <span className="truncate">{node.name}</span>
                  <span className="text-[10px] font-mono text-slate-400 shrink-0 ml-2">
                    {node.category || (node.type === 'primary' ? 'Nota' : 'Hub')}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 3. BARRA DE HERRAMIENTAS INFERIOR (DOCK) */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 pointer-events-auto">
        <div className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-gray-950/70 backdrop-blur-md border border-white/10 shadow-2xl text-slate-300">
          <button
            onClick={() => setAutoRotate(prev => !prev)}
            title={autoRotate ? "Congelar movimiento" : "Fluir constelación"}
            className={`p-2 rounded-full transition-all ${
              autoRotate ? 'text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            {autoRotate ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>

          <button
            onClick={handleResetCamera}
            title="Centrar Cámara"
            className="p-2 rounded-full text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-all"
          >
            <Crosshair className="w-4 h-4" />
          </button>

          <div className="w-px h-4 bg-white/10 mx-1" />

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

          <button
            onClick={() => handleModeChange(dataMode === 'nexus' ? 'constellation' : 'nexus')}
            title={dataMode === 'nexus' ? "Cambiar a Benchmark 150 Nodos" : "Cambiar a BBDD Nexus"}
            className="px-2.5 py-1 rounded-full text-[11px] font-mono text-slate-400 hover:text-cyan-300 hover:bg-white/5 transition-all flex items-center gap-1.5"
          >
            <Database className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{dataMode === 'nexus' ? 'Nexus' : '150N'}</span>
          </button>
        </div>
      </div>

      {/* 4. PANEL INSPECTOR DE NOTAS (RESPONSIVE: BOTTOM SHEET EN MÓVIL, LATERAL EN ESCRITORIO) */}
      <div 
        id="c137-node-inspector"
        className={`fixed z-30 flex flex-col backdrop-blur-md bg-gray-950/80 shadow-2xl transition-transform duration-300 ease-out pointer-events-auto
                   bottom-0 left-0 right-0 w-full max-h-[60vh] rounded-t-2xl border-t border-white/10
                   md:right-4 md:top-16 md:bottom-auto md:left-auto md:w-[380px] md:h-[calc(100vh-80px)] md:max-h-none md:rounded-2xl md:border md:border-white/10
                   ${selectedNode 
                     ? 'translate-y-0 md:translate-x-0' 
                     : 'translate-y-full md:translate-y-0 md:translate-x-full pointer-events-none'}`}
      >
        {displayNode && (
          <div className="flex flex-col h-full p-5 overflow-hidden">
            <div className="flex items-start justify-between pb-3 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={`p-1.5 rounded-lg border shrink-0 ${
                  displayNode.type === 'primary' 
                    ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-400' 
                    : 'border-violet-500/40 bg-violet-500/10 text-violet-400'
                }`}>
                  {displayNode.type === 'primary' ? <FileText className="w-4 h-4" /> : <Tag className="w-4 h-4" />}
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">
                    {displayNode.category || (displayNode.type === 'primary' ? 'Nota' : 'Hub')} #{displayNode.id}
                  </span>
                  <h2 className="text-sm font-semibold text-white tracking-tight truncate">
                    {displayNode.name}
                  </h2>
                </div>
              </div>

              <button
                onClick={handleCloseInspector}
                className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors shrink-0 ml-2"
                title="Cerrar (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-2 my-3 shrink-0 flex-wrap">
              <span className="px-2 py-0.5 rounded-full text-[11px] font-mono bg-white/5 border border-white/10 text-slate-300 flex items-center gap-1">
                <Link2 className="w-3 h-3 text-cyan-400" />
                {displayNode.connections.length} Vínculos
              </span>

              {displayNode.tags && displayNode.tags.map((t, idx) => (
                <span key={idx} className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-white/5 border border-white/10 text-slate-400">
                  #{t.replace(/^#/, '')}
                </span>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto pr-1 space-y-4">
              {displayNode.content ? (
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 text-xs text-slate-300 leading-relaxed font-sans">
                  <ReactMarkdown
                    components={{
                      h1: ({ children }) => <h1 className="text-sm font-semibold text-white mt-1 mb-2">{children}</h1>,
                      h2: ({ children }) => <h2 className="text-xs font-semibold text-slate-100 mt-2 mb-1">{children}</h2>,
                      h3: ({ children }) => <h3 className="text-xs font-medium text-slate-200 mt-1 mb-1">{children}</h3>,
                      p: ({ children }) => <p className="text-xs text-slate-300 mb-2 leading-relaxed">{children}</p>,
                      ul: ({ children }) => <ul className="list-disc pl-4 space-y-1 mb-2 text-slate-300">{children}</ul>,
                      li: ({ children }) => <li className="text-xs">{children}</li>,
                      code: ({ children }) => <code className="bg-black/50 px-1.5 py-0.5 rounded text-[11px] font-mono text-cyan-300 border border-white/10">{children}</code>,
                      pre: ({ children }) => <pre className="bg-black/60 p-2.5 rounded-lg border border-white/10 text-[11px] font-mono overflow-x-auto my-2 text-cyan-200">{children}</pre>,
                    }}
                  >
                    {displayNode.content}
                  </ReactMarkdown>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 text-xs font-mono space-y-2 text-slate-400">
                  <div className="flex justify-between">
                    <span>Posición 3D:</span>
                    <span className="text-white">X:{displayNode.x.toFixed(1)} Y:{displayNode.y.toFixed(1)} Z:{displayNode.z.toFixed(1)}</span>
                  </div>
                  {displayNode.bandwidth && (
                    <div className="flex justify-between">
                      <span>Ancho de Banda:</span>
                      <span className="text-white">{displayNode.bandwidth}</span>
                    </div>
                  )}
                </div>
              )}

              <div>
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-2">
                  <span>Conexiones ({displayNode.connections.length})</span>
                  <span className="text-[10px] text-slate-500">Haz clic para enfocar</span>
                </div>
                <div className="space-y-1">
                  {displayNode.connections.map(neighborId => {
                    const neighbor = currentGraph.nodes[neighborId];
                    if (!neighbor) return null;
                    return (
                      <button
                        key={neighborId}
                        onClick={() => handleSelectNode(neighborId)}
                        onMouseEnter={() => setHoveredId(neighborId)}
                        onMouseLeave={() => setHoveredId(null)}
                        className="w-full flex items-center justify-between p-2 rounded-lg bg-white/[0.02] hover:bg-white/[0.06] border border-white/5 hover:border-white/10 transition-all text-left text-xs group"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span 
                            className="w-1.5 h-1.5 rounded-full shrink-0" 
                            style={{ backgroundColor: neighbor.type === 'primary' ? themeCfg.primaryHex : themeCfg.relayHex }} 
                          />
                          <span className="truncate text-slate-300 group-hover:text-white transition-colors">
                            {neighbor.name}
                          </span>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-300 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="pt-3 mt-auto border-t border-white/10 shrink-0">
              <button
                onClick={() => {
                  if (controlsRef.current) {
                    controlsRef.current.target.set(displayNode.x, displayNode.y, displayNode.z);
                  }
                }}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-sans text-slate-200 hover:text-white transition-all"
              >
                <Crosshair className="w-3.5 h-3.5 text-cyan-400" />
                <span>Centrar Vista en este Nodo</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default C137GraphView;