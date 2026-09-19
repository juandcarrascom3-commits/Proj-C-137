import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import { EffectComposer, Bloom, DepthOfField } from '@react-three/postprocessing';
import * as THREE from 'three';
import ReactMarkdown from 'react-markdown';
import { 
  forceSimulation, 
  forceManyBody, 
  forceLink, 
  forceCenter 
} from 'd3-force-3d';
import { 
  Activity, 
  Share2, 
  RotateCw, 
  Cpu, 
  Layers, 
  Sparkles, 
  X, 
  Target, 
  ArrowRight, 
  FileText, 
  Tag, 
  Link2, 
  Compass, 
  Zap, 
  Database, 
  Globe,
  Palette
} from 'lucide-react';

import { parseNotesToGraph, Graph3DNode, Graph3DLink, NexusNote } from '../utils/graphParser';
import { MOCK_NEXUS_NOTES } from '../data/mockNotes';

/**
 * =======================================================================
 * C-137 GRAPH VIEW - COMPONENTE 3D EXPORTABLE Y DESACOPLADO
 * =======================================================================
 */

export type GraphTheme = 'cyberpunk' | 'emerald' | 'amber';

export interface C137GraphViewProps {
  notes?: NexusNote[];
  activeNoteId?: string;
  onNoteSelect?: (noteId: string) => void;
  standalone?: boolean; // Habilita/deshabilita el HUD flotante y paneles de control
  theme?: GraphTheme;
}

// Configuración de Paletas de Color por Tema
const THEME_CONFIG: Record<GraphTheme, {
  bg: string;
  primaryHex: string;
  relayHex: string;
  targetHex: string;
  primaryClass: string;
  relayClass: string;
  borderClass: string;
  textAccentClass: string;
  glowColor: string;
  starsFactor: number;
}> = {
  cyberpunk: {
    bg: '#020617',
    primaryHex: '#00f0ff',
    relayHex: '#7000ff',
    targetHex: '#ffffff',
    primaryClass: 'text-cyan-400 border-cyan-500/40 bg-cyan-500/10',
    relayClass: 'text-violet-400 border-violet-500/40 bg-violet-500/10',
    borderClass: 'border-cyan-500/30',
    textAccentClass: 'text-cyan-400',
    glowColor: 'rgba(0, 240, 255, 0.25)',
    starsFactor: 3.5
  },
  emerald: {
    bg: '#021814',
    primaryHex: '#10b981',
    relayHex: '#06b6d4',
    targetHex: '#ffffff',
    primaryClass: 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10',
    relayClass: 'text-teal-400 border-teal-500/40 bg-teal-500/10',
    borderClass: 'border-emerald-500/30',
    textAccentClass: 'text-emerald-400',
    glowColor: 'rgba(16, 185, 129, 0.25)',
    starsFactor: 3.0
  },
  amber: {
    bg: '#120b02',
    primaryHex: '#f59e0b',
    relayHex: '#f43f5e',
    targetHex: '#ffffff',
    primaryClass: 'text-amber-400 border-amber-500/40 bg-amber-500/10',
    relayClass: 'text-rose-400 border-rose-500/40 bg-rose-500/10',
    borderClass: 'border-amber-500/30',
    textAccentClass: 'text-amber-400',
    glowColor: 'rgba(245, 158, 11, 0.25)',
    starsFactor: 3.2
  }
};

// Generador de Benchmark de 150 Nodos
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

  // Sanitizar coordenadas de benchmark
  rawNodes.forEach((node, i) => {
    if (isNaN(node.x) || node.x === null || node.x === undefined) node.x = Math.sin(i * 1.5) * 20;
    if (isNaN(node.y) || node.y === null || node.y === undefined) node.y = Math.cos(i * 2.1) * 20;
    if (isNaN(node.z) || node.z === null || node.z === undefined) node.z = Math.sin(i * 3.3) * 20;
  });

  return { nodes: rawNodes, links: rawLinks };
}

// -----------------------------------------------------------------------
// 1. COMPONENTE DE NODOS INSTANCIADOS CON LIMPIEZA WEBGL
// -----------------------------------------------------------------------
interface InstancedNodesProps {
  nodes: Graph3DNode[];
  hoveredId: number | null;
  selectedId: number | null;
  activeNeighbors: Set<number>;
  onHover: (id: number | null) => void;
  onSelect: (id: number) => void;
  bloomBoost: boolean;
  theme: GraphTheme;
}

function InstancedNodes({
  nodes,
  hoveredId,
  selectedId,
  activeNeighbors,
  onHover,
  onSelect,
  bloomBoost,
  theme
}: InstancedNodesProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const themeCfg = THEME_CONFIG[theme];

  const colors = useMemo(() => {
    const boost = bloomBoost ? 1.4 : 1.0;
    const cPrimary = new THREE.Color(themeCfg.primaryHex);
    const cRelay = new THREE.Color(themeCfg.relayHex);
    const cTarget = new THREE.Color(themeCfg.targetHex);

    return {
      primaryBright: cPrimary.clone().multiplyScalar(3.4 * boost),
      primaryNormal: cPrimary.clone().multiplyScalar(1.9 * boost),
      primaryDimmed: cPrimary.clone().multiplyScalar(0.25),

      relayBright: cRelay.clone().multiplyScalar(3.8 * boost),
      relayNormal: cRelay.clone().multiplyScalar(2.1 * boost),
      relayDimmed: cRelay.clone().multiplyScalar(0.25),

      targetGold: cTarget.clone().multiplyScalar(4.2 * boost)
    };
  }, [bloomBoost, themeCfg]);

  // Transformaciones y colores por instancia
  useEffect(() => {
    if (!meshRef.current) return;
    const mesh = meshRef.current;
    const dummy = new THREE.Object3D();

    const hasFocus = hoveredId !== null || selectedId !== null;
    const activeNodeId = hoveredId !== null ? hoveredId : selectedId;

    nodes.forEach((node, i) => {
      const nx = Number.isFinite(node.x) ? node.x : 0;
      const ny = Number.isFinite(node.y) ? node.y : 0;
      const nz = Number.isFinite(node.z) ? node.z : 0;
      dummy.position.set(nx, ny, nz);

      const isTarget = i === activeNodeId;
      const isNeighbor = activeNeighbors.has(i);

      let scaleMult = 1.0;
      if (hasFocus) {
        if (isTarget) scaleMult = 1.65;
        else if (isNeighbor) scaleMult = 1.3;
        else scaleMult = 0.5;
      }
      
      const finalScale = node.baseScale * scaleMult;
      dummy.scale.set(finalScale, finalScale, finalScale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      let chosenColor: THREE.Color;
      if (!hasFocus) {
        chosenColor = node.type === 'primary' ? colors.primaryNormal : colors.relayNormal;
      } else if (isTarget) {
        chosenColor = colors.targetGold;
      } else if (isNeighbor) {
        chosenColor = node.type === 'primary' ? colors.primaryBright : colors.relayBright;
      } else {
        chosenColor = node.type === 'primary' ? colors.primaryDimmed : colors.relayDimmed;
      }

      mesh.setColorAt(i, chosenColor);
    });

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [nodes, hoveredId, selectedId, activeNeighbors, colors]);

  // Limpieza de recursos WebGL al desmontar
  useEffect(() => {
    const currentMesh = meshRef.current;
    return () => {
      if (currentMesh) {
        currentMesh.geometry.dispose();
        if (Array.isArray(currentMesh.material)) {
          currentMesh.material.forEach(m => m.dispose());
        } else {
          currentMesh.material.dispose();
        }
      }
    };
  }, []);

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, nodes.length]}
      frustumCulled={false}
      onPointerOver={(e) => {
        e.stopPropagation();
        if (e.instanceId !== undefined && e.instanceId < nodes.length) {
          onHover(e.instanceId);
          document.body.style.cursor = 'pointer';
        }
      }}
      onPointerOut={() => {
        onHover(null);
        document.body.style.cursor = 'default';
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (e.instanceId !== undefined && e.instanceId < nodes.length) {
          onSelect(e.instanceId);
        }
      }}
    >
      <icosahedronGeometry args={[1, 1]} />
      <meshBasicMaterial toneMapped={false} transparent opacity={0.95} />
    </instancedMesh>
  );
}

// -----------------------------------------------------------------------
// 2. LÍNEAS DE CONEXIÓN CON LIMPIEZA WEBGL
// -----------------------------------------------------------------------
interface ConstellationLinesProps {
  nodes: Graph3DNode[];
  links: Graph3DLink[];
  hoveredId: number | null;
  selectedId: number | null;
  theme: GraphTheme;
}

function ConstellationLines({ nodes, links, hoveredId, selectedId, theme }: ConstellationLinesProps) {
  const geomRef = useRef<THREE.BufferGeometry>(null);
  const matRef = useRef<THREE.LineBasicMaterial>(null);
  const themeCfg = THEME_CONFIG[theme];

  const activeFocusId = hoveredId !== null ? hoveredId : selectedId;
  const hasFocus = activeFocusId !== null;

  const { positions, baseColors } = useMemo(() => {
    const pos = new Float32Array(links.length * 6);
    const col = new Float32Array(links.length * 6);

    const cPrimary = new THREE.Color(themeCfg.primaryHex);
    const cRelay = new THREE.Color(themeCfg.relayHex);

    links.forEach((link, idx) => {
      // Si d3-force-3d ya expandió link.source / link.target a objetos de nodo
      const srcNode: Graph3DNode | undefined = typeof link.source === 'object' 
        ? (link.source as any) 
        : nodes[link.source];
      const tgtNode: Graph3DNode | undefined = typeof link.target === 'object' 
        ? (link.target as any) 
        : nodes[link.target];

      const offset = idx * 6;

      const sx = srcNode && Number.isFinite(srcNode.x) ? srcNode.x : 0;
      const sy = srcNode && Number.isFinite(srcNode.y) ? srcNode.y : 0;
      const sz = srcNode && Number.isFinite(srcNode.z) ? srcNode.z : 0;

      const tx = tgtNode && Number.isFinite(tgtNode.x) ? tgtNode.x : 0;
      const ty = tgtNode && Number.isFinite(tgtNode.y) ? tgtNode.y : 0;
      const tz = tgtNode && Number.isFinite(tgtNode.z) ? tgtNode.z : 0;

      pos[offset + 0] = sx;
      pos[offset + 1] = sy;
      pos[offset + 2] = sz;

      pos[offset + 3] = tx;
      pos[offset + 4] = ty;
      pos[offset + 5] = tz;

      const col1 = srcNode && srcNode.type === 'primary' ? cPrimary : cRelay;
      const col2 = tgtNode && tgtNode.type === 'primary' ? cPrimary : cRelay;

      col[offset + 0] = col1.r * 1.5;
      col[offset + 1] = col1.g * 1.5;
      col[offset + 2] = col1.b * 1.5;

      col[offset + 3] = col2.r * 1.5;
      col[offset + 4] = col2.g * 1.5;
      col[offset + 5] = col2.b * 1.5;
    });

    return { positions: pos, baseColors: col };
  }, [nodes, links, themeCfg]);

  useEffect(() => {
    if (!geomRef.current) return;
    const colorAttr = geomRef.current.getAttribute('color') as THREE.BufferAttribute;
    if (!colorAttr) return;

    const arr = colorAttr.array as Float32Array;

    links.forEach((link, idx) => {
      const srcId = typeof link.source === 'object' ? (link.source as any).id : link.source;
      const tgtId = typeof link.target === 'object' ? (link.target as any).id : link.target;
      const offset = idx * 6;

      const isConnectedToFocus = hasFocus && (srcId === activeFocusId || tgtId === activeFocusId);

      if (!hasFocus) {
        arr[offset + 0] = baseColors[offset + 0];
        arr[offset + 1] = baseColors[offset + 1];
        arr[offset + 2] = baseColors[offset + 2];
        arr[offset + 3] = baseColors[offset + 3];
        arr[offset + 4] = baseColors[offset + 4];
        arr[offset + 5] = baseColors[offset + 5];
      } else if (isConnectedToFocus) {
        arr[offset + 0] = 1.0;
        arr[offset + 1] = 0.95;
        arr[offset + 2] = 0.4;
        arr[offset + 3] = 0.0;
        arr[offset + 4] = 1.0;
        arr[offset + 5] = 1.0;
      } else {
        arr[offset + 0] = baseColors[offset + 0] * 0.07;
        arr[offset + 1] = baseColors[offset + 1] * 0.07;
        arr[offset + 2] = baseColors[offset + 2] * 0.07;
        arr[offset + 3] = baseColors[offset + 3] * 0.07;
        arr[offset + 4] = baseColors[offset + 4] * 0.07;
        arr[offset + 5] = baseColors[offset + 5] * 0.07;
      }
    });

    colorAttr.needsUpdate = true;
  }, [hasFocus, activeFocusId, baseColors, links]);

  // Recalcular el radio de la esfera delimitadora tras asignar posiciones válidas
  useEffect(() => {
    if (geomRef.current && geomRef.current.attributes.position) {
      geomRef.current.computeBoundingSphere();
    }
  }, [positions]);

  // Limpieza WebGL al desmontar
  useEffect(() => {
    return () => {
      if (geomRef.current) {
        geomRef.current.dispose();
      }
      if (matRef.current) {
        matRef.current.dispose();
      }
    };
  }, []);

  return (
    <lineSegments>
      <bufferGeometry ref={geomRef}>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[baseColors, 3]} />
      </bufferGeometry>
      <lineBasicMaterial
        ref={matRef}
        vertexColors
        transparent
        opacity={hasFocus ? 0.8 : 0.45}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </lineSegments>
  );
}

// -----------------------------------------------------------------------
// 3. CÁMARA CINEMÁTICA LERP BIDIRECCIONAL
// -----------------------------------------------------------------------
interface CameraRigProps {
  nodes: Graph3DNode[];
  selectedId: number | null;
  controlsRef: React.RefObject<any>;
}

function CameraRig({ nodes, selectedId, controlsRef }: CameraRigProps) {
  const { camera } = useThree();
  const currentTarget = useRef(new THREE.Vector3(0, 0, 0));
  const desiredCamPos = useRef(new THREE.Vector3(0, 8, 38));

  useEffect(() => {
    if (selectedId !== null && nodes[selectedId]) {
      const node = nodes[selectedId];
      const nx = Number.isFinite(node.x) ? node.x : 0;
      const ny = Number.isFinite(node.y) ? node.y : 0;
      const nz = Number.isFinite(node.z) ? node.z : 0;
      currentTarget.current.set(nx, ny, nz);

      const nodeVec = new THREE.Vector3(nx, ny, nz);
      const camDir = nodeVec.clone().normalize();
      if (camDir.lengthSq() < 0.01) camDir.set(0, 0.4, 1);

      desiredCamPos.current.copy(nodeVec).add(camDir.multiplyScalar(15)).add(new THREE.Vector3(0, 2, 0));
    }
  }, [selectedId, nodes]);

  useFrame(() => {
    if (selectedId !== null && controlsRef.current) {
      controlsRef.current.target.lerp(currentTarget.current, 0.07);
      camera.position.lerp(desiredCamPos.current, 0.05);
      controlsRef.current.update();
    }
  });

  return null;
}

// -----------------------------------------------------------------------
// 4. ESCENA 3D PRINCIPAL
// -----------------------------------------------------------------------
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
  theme
}: SceneProps) {
  const groupRef = useRef<THREE.Group>(null);
  const themeCfg = THEME_CONFIG[theme];

  useFrame((_, delta) => {
    if (groupRef.current && autoRotate) {
      const speed = selectedId !== null ? 0.008 : 0.035;
      groupRef.current.rotation.y += delta * speed;
    }
  });

  return (
    <>
      <color attach="background" args={[themeCfg.bg]} />
      <ambientLight intensity={0.25} />

      <Stars 
        radius={80} 
        depth={60} 
        count={1500} 
        factor={themeCfg.starsFactor} 
        saturation={0.5} 
        fade 
        speed={0.7} 
      />

      <group ref={groupRef} key={`${dataModeKey}-${theme}`}>
        <InstancedNodes
          nodes={nodes}
          hoveredId={hoveredId}
          selectedId={selectedId}
          activeNeighbors={activeNeighbors}
          onHover={onHover}
          onSelect={onSelect}
          bloomBoost={bloomBoost}
          theme={theme}
        />
        <ConstellationLines
          nodes={nodes}
          links={links}
          hoveredId={hoveredId}
          selectedId={selectedId}
          theme={theme}
        />
      </group>

      <CameraRig nodes={nodes} selectedId={selectedId} controlsRef={controlsRef} />

      <OrbitControls
        ref={controlsRef}
        enableDamping
        dampingFactor={0.06}
        minDistance={6}
        maxDistance={80}
        rotateSpeed={0.75}
      />

      <EffectComposer multisampling={0}>
        <DepthOfField
          focusDistance={0.022}
          focalLength={0.16}
          bokehScale={2.2}
          height={480}
        />
        <Bloom
          luminanceThreshold={0.12}
          luminanceSmoothing={0.88}
          intensity={bloomBoost ? 2.4 : 1.7}
          mipmapBlur
        />
      </EffectComposer>
    </>
  );
}

// -----------------------------------------------------------------------
// 5. COMPONENTE EXPORTABLE <C137GraphView />
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
  const [bloomBoost, setBloomBoost] = useState(false);
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const controlsRef = useRef<any>(null);

  // Sincronizar tema con prop externa
  useEffect(() => {
    if (theme) setCurrentTheme(theme);
  }, [theme]);

  // Cache de grafos
  const sourceNotes = useMemo(() => notes || MOCK_NEXUS_NOTES, [notes]);
  const nexusGraph = useMemo(() => parseNotesToGraph(sourceNotes), [sourceNotes]);
  const constellationGraph = useMemo(() => buildConstellationBenchmark(), []);

  const currentGraph = dataMode === 'nexus' ? nexusGraph : constellationGraph;

  // Sincronización bidireccional de activeNoteId externo
  useEffect(() => {
    if (!activeNoteId) return;

    if (dataMode === 'nexus') {
      const foundIdx = currentGraph.nodes.findIndex(
        n => n.slug === activeNoteId || n.name.toLowerCase() === activeNoteId.toLowerCase()
      );
      if (foundIdx !== -1) {
        setSelectedId(foundIdx);
      }
    }
  }, [activeNoteId, currentGraph, dataMode]);

  const activeFocusId = hoveredId !== null ? hoveredId : selectedId;
  const activeNeighbors = useMemo(() => {
    if (activeFocusId === null) return new Set<number>();
    const node = currentGraph.nodes[activeFocusId];
    return new Set<number>(node ? node.connections : []);
  }, [activeFocusId, currentGraph]);

  // Callback de selección con invocación externa
  const handleSelectNode = useCallback((id: number) => {
    setSelectedId(id);
    const node = currentGraph.nodes[id];
    if (node && onNoteSelect) {
      onNoteSelect(node.slug || node.name);
    }
  }, [currentGraph, onNoteSelect]);

  const handleModeChange = (newMode: 'nexus' | 'constellation') => {
    setDataMode(newMode);
    setSelectedId(null);
    setHoveredId(null);
    if (controlsRef.current) {
      controlsRef.current.target.set(0, 0, 0);
    }
  };

  const selectedNode = selectedId !== null ? currentGraph.nodes[selectedId] : null;

  const totalPrimary = useMemo(() => currentGraph.nodes.filter(n => n.type === 'primary').length, [currentGraph]);
  const totalRelay = useMemo(() => currentGraph.nodes.filter(n => n.type === 'relay').length, [currentGraph]);
  const density = (currentGraph.links.length / (currentGraph.nodes.length || 1)).toFixed(2);
  const themeCfg = THEME_CONFIG[currentTheme];

  return (
    <div id="c137-view" className="relative w-full h-full overflow-hidden select-none font-sans text-slate-100" style={{ backgroundColor: themeCfg.bg }}>
      
      {/* CANVAS WEBGL 3D */}
      <div 
        className="absolute inset-0 z-0"
        onPointerDown={(e) => {
          if (e.target === e.currentTarget && selectedId !== null) {
            setSelectedId(null);
          }
        }}
      >
        <Canvas
          camera={{ position: [0, 8, 38], fov: 45 }}
          gl={{
            antialias: false,
            powerPreference: 'high-performance',
            alpha: false,
          }}
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
          />
        </Canvas>
      </div>

      {/* RENDERIZADO CONDICIONAL DE HUD (STANDALONE = TRUE) */}
      {standalone && (
        <>
          {/* SELECTOR FLOTANTE CENTRAL DE MODO Y TEMA */}
          <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 pointer-events-auto">
            <div className={`flex items-center p-1 rounded-xl bg-slate-950/80 border ${themeCfg.borderClass} backdrop-blur-xl shadow-lg`}>
              <button
                id="btn-mode-nexus"
                onClick={() => handleModeChange('nexus')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all ${
                  dataMode === 'nexus'
                    ? `${themeCfg.primaryClass} border shadow-md`
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                <Database className="w-3.5 h-3.5" />
                <span>BBDD NEXUS ({sourceNotes.length})</span>
              </button>

              <button
                id="btn-mode-constellation"
                onClick={() => handleModeChange('constellation')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all ${
                  dataMode === 'constellation'
                    ? `${themeCfg.relayClass} border shadow-md`
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>150 Nodos</span>
              </button>
            </div>

            {/* Selector Rápido de Temas */}
            <div className={`flex items-center gap-1 p-1 rounded-xl bg-slate-950/80 border ${themeCfg.borderClass} backdrop-blur-xl shadow-lg`}>
              {(['cyberpunk', 'emerald', 'amber'] as GraphTheme[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setCurrentTheme(t)}
                  title={`Tema ${t.toUpperCase()}`}
                  className={`px-2 py-1.5 rounded-lg text-[10px] font-mono uppercase font-bold transition-all ${
                    currentTheme === t
                      ? 'bg-white/10 text-white border border-white/20'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {t[0]}
                </button>
              ))}
            </div>
          </div>

          {/* TELEMETRÍA SUPERIOR DERECHA */}
          <div className="absolute top-6 right-6 z-10 hidden lg:flex flex-col items-end gap-1 font-mono text-xs text-cyan-400/80 pointer-events-none">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-md bg-slate-950/70 border ${themeCfg.borderClass} backdrop-blur-md`}>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: themeCfg.primaryHex }}></span>
                <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: themeCfg.primaryHex }}></span>
              </span>
              <span className="tracking-widest font-bold text-white">
                THEME: {currentTheme.toUpperCase()}
              </span>
              <span className="text-slate-600">|</span>
              <span className="text-slate-400">60 FPS</span>
            </div>
          </div>

          {/* PANEL HUD IZQUIERDO FLOTANTE */}
          <div 
            id="c137-left-hud"
            className={`absolute top-6 left-6 z-10 w-76 md:w-84 rounded-2xl p-5 
                       backdrop-blur-xl bg-slate-950/75 border ${themeCfg.borderClass}
                       shadow-[0_0_40px_${themeCfg.glowColor}] transition-all duration-300 pointer-events-auto`}
          >
            <div className="flex items-start justify-between pb-3 border-b border-white/10">
              <div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 text-[10px] font-mono font-bold tracking-widest uppercase rounded border ${themeCfg.primaryClass}`}>
                    &lt;C137GraphView /&gt;
                  </span>
                </div>
                <h1 className="mt-1 text-base font-bold tracking-tight text-white flex items-center gap-2">
                  {dataMode === 'nexus' ? 'BBDD Nexus Graph' : 'Constellation Graph'}
                </h1>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {dataMode === 'nexus' ? 'Notas Markdown conectadas' : 'Simulación d3-force-3d'}
                </p>
              </div>
              <div className={`p-2 rounded-lg bg-slate-900 border ${themeCfg.borderClass} ${themeCfg.textAccentClass}`}>
                {dataMode === 'nexus' ? <Database className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
              </div>
            </div>

            {/* Métricas */}
            <div className="grid grid-cols-2 gap-2.5 my-3">
              <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80">
                <div className="flex items-center gap-1.5 text-slate-400 text-xs font-mono">
                  <Cpu className="w-3.5 h-3.5" style={{ color: themeCfg.primaryHex }} />
                  <span>ENTIDADES</span>
                </div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-xl font-bold font-mono text-white">{currentGraph.nodes.length}</span>
                  <span className="text-[10px] font-mono text-slate-400">NODOS</span>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80">
                <div className="flex items-center gap-1.5 text-slate-400 text-xs font-mono">
                  <Activity className="w-3.5 h-3.5" style={{ color: themeCfg.relayHex }} />
                  <span>VÍNCULOS</span>
                </div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-xl font-bold font-mono text-white">{currentGraph.links.length}</span>
                  <span className="text-[10px] font-mono text-slate-400">ENLACES</span>
                </div>
              </div>
            </div>

            {/* Leyenda */}
            <div className="space-y-1.5 py-2 border-t border-slate-800 text-xs">
              <div className="flex items-center justify-between text-slate-300">
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: themeCfg.primaryHex, boxShadow: `0 0 8px ${themeCfg.primaryHex}` }}></span>
                  {dataMode === 'nexus' ? 'Notas Markdown' : 'Primarios'}
                </span>
                <span className="font-mono font-semibold text-white">{totalPrimary}</span>
              </div>

              <div className="flex items-center justify-between text-slate-300">
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: themeCfg.relayHex, boxShadow: `0 0 8px ${themeCfg.relayHex}` }}></span>
                  {dataMode === 'nexus' ? 'Hubs de Etiquetas' : 'Relés Cuánticos'}
                </span>
                <span className="font-mono font-semibold text-white">{totalRelay}</span>
              </div>
            </div>

            {/* Controles */}
            <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between gap-2">
              <button
                onClick={() => setAutoRotate(prev => !prev)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-medium transition-all ${
                  autoRotate 
                    ? `${themeCfg.primaryClass} border shadow-sm` 
                    : 'bg-slate-900/80 text-slate-400 border border-slate-800 hover:text-white'
                }`}
              >
                <RotateCw className={`w-3 h-3 ${autoRotate ? 'animate-spin' : ''}`} style={{ animationDuration: '6s' }} />
                <span>{autoRotate ? 'Órbita' : 'Pausa'}</span>
              </button>

              <button
                onClick={() => setBloomBoost(prev => !prev)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-medium transition-all ${
                  bloomBoost 
                    ? `${themeCfg.relayClass} border shadow-sm` 
                    : 'bg-slate-900/80 text-slate-400 border border-slate-800 hover:text-white'
                }`}
              >
                <Sparkles className="w-3 h-3" />
                <span>Bloom {bloomBoost ? 'Ultra' : 'Normal'}</span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* PANEL LATERAL DERECHO DE INSPECCIÓN DE NODO */}
      {selectedNode && (
        <div 
          id="c137-node-inspector"
          className={`absolute top-6 right-6 z-20 w-84 md:w-96 max-h-[calc(100vh-3rem)] flex flex-col rounded-2xl p-5 md:p-6
                     backdrop-blur-xl bg-slate-950/85 border ${themeCfg.borderClass}
                     shadow-[0_0_50px_${themeCfg.glowColor}]
                     animate-in fade-in slide-in-from-right-4 duration-300 pointer-events-auto overflow-hidden`}
        >
          {/* Cabecera */}
          <div className="flex items-start justify-between pb-3 border-b border-white/10 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className={`p-2 rounded-lg border ${
                selectedNode.type === 'primary' ? themeCfg.primaryClass : themeCfg.relayClass
              }`}>
                {selectedNode.type === 'primary' ? (
                  <FileText className="w-5 h-5 animate-pulse" />
                ) : (
                  <Tag className="w-5 h-5 animate-pulse" />
                )}
              </div>
              <div>
                <span className="text-[10px] font-mono tracking-widest uppercase" style={{ color: themeCfg.primaryHex }}>
                  {selectedNode.type === 'primary' ? 'NOTA' : 'HUB TAG'} #{selectedNode.id}
                </span>
                <h2 className="text-sm font-bold text-white tracking-wide leading-tight">
                  {selectedNode.name}
                </h2>
              </div>
            </div>

            <button
              onClick={() => setSelectedId(null)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
              title="Cerrar Inspector"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Categoría y Badges */}
          <div className="flex items-center gap-2 my-3 shrink-0 flex-wrap">
            <span className={`px-2.5 py-1 rounded-full text-xs font-mono font-medium border flex items-center gap-1.5 ${
              selectedNode.type === 'primary' ? themeCfg.primaryClass : themeCfg.relayClass
            }`}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: selectedNode.type === 'primary' ? themeCfg.primaryHex : themeCfg.relayHex }}></span>
              {selectedNode.type === 'primary' ? (selectedNode.category || 'Nota') : 'Hub Relé'}
            </span>

            <span className="px-2.5 py-1 rounded-full text-xs font-mono bg-slate-900 border border-slate-800 text-slate-300 flex items-center gap-1">
              <Link2 className="w-3 h-3" style={{ color: themeCfg.primaryHex }} />
              {selectedNode.connections.length} Vínculos
            </span>

            {selectedNode.tags && selectedNode.tags.map((t, idx) => (
              <span key={idx} className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-900/90 border border-white/10 text-slate-300">
                #{t.replace(/^#/, '')}
              </span>
            ))}
          </div>

          {/* CUERPO DEL INSPECTOR */}
          <div className="flex-1 overflow-y-auto pr-1 space-y-3.5 custom-scrollbar">
            {selectedNode.content ? (
              <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800/90 text-xs">
                <div className="flex items-center justify-between text-[11px] font-mono mb-2 pb-1.5 border-b border-slate-800" style={{ color: themeCfg.primaryHex }}>
                  <span className="flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" />
                    CONTENIDO MARKDOWN
                  </span>
                  <span className="text-slate-500">ID: {selectedNode.slug}</span>
                </div>
                
                <div className="prose prose-invert prose-xs max-w-none text-slate-300 leading-relaxed font-sans space-y-2">
                  <ReactMarkdown
                    components={{
                      h1: ({ children }) => <h1 className="text-sm font-bold text-white mt-2 mb-1">{children}</h1>,
                      h2: ({ children }) => <h2 className="text-xs font-bold text-white mt-2 mb-1">{children}</h2>,
                      h3: ({ children }) => <h3 className="text-xs font-semibold text-slate-200 mt-2 mb-1">{children}</h3>,
                      p: ({ children }) => <p className="text-xs text-slate-300 mb-2">{children}</p>,
                      ul: ({ children }) => <ul className="list-disc pl-4 space-y-1 mb-2 text-slate-300">{children}</ul>,
                      li: ({ children }) => <li className="text-xs">{children}</li>,
                      code: ({ children }) => <code className="bg-slate-950 px-1.5 py-0.5 rounded text-[10px] font-mono border border-slate-800 text-cyan-200">{children}</code>,
                      pre: ({ children }) => <pre className="bg-slate-950/90 p-2.5 rounded-lg border border-slate-800 text-[11px] font-mono overflow-x-auto my-2 text-cyan-200">{children}</pre>,
                    }}
                  >
                    {selectedNode.content}
                  </ReactMarkdown>
                </div>
              </div>
            ) : (
              <div className="space-y-2 p-3 rounded-xl bg-slate-900/60 border border-slate-800/90 text-xs font-mono">
                <div className="flex justify-between text-slate-400">
                  <span className="flex items-center gap-1">
                    <Compass className="w-3.5 h-3.5" style={{ color: themeCfg.primaryHex }} />
                    Posición 3D:
                  </span>
                  <span className="font-semibold text-white">
                    X:{selectedNode.x.toFixed(1)} Y:{selectedNode.y.toFixed(1)} Z:{selectedNode.z.toFixed(1)}
                  </span>
                </div>

                <div className="flex justify-between text-slate-400">
                  <span className="flex items-center gap-1">
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    Ancho de Banda:
                  </span>
                  <span className="text-white">{selectedNode.bandwidth}</span>
                </div>
              </div>
            )}

            {/* Lista Interactiva de Conexiones */}
            <div>
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="font-mono text-slate-400 flex items-center gap-1.5">
                  <Share2 className="w-3.5 h-3.5" style={{ color: themeCfg.primaryHex }} />
                  Nodos Conectados ({selectedNode.connections.length})
                </span>
                <span className="text-[10px] text-slate-500 font-mono">Click para enfocar</span>
              </div>

              <div className="space-y-1.5">
                {selectedNode.connections.map(neighborId => {
                  const neighbor = currentGraph.nodes[neighborId];
                  if (!neighbor) return null;
                  const isPrimary = neighbor.type === 'primary';

                  return (
                    <button
                      key={neighborId}
                      onClick={() => handleSelectNode(neighborId)}
                      onMouseEnter={() => setHoveredId(neighborId)}
                      onMouseLeave={() => setHoveredId(null)}
                      className="w-full flex items-center justify-between p-2 rounded-lg bg-slate-900/50 hover:bg-slate-800/60 border border-slate-800 hover:border-white/20 transition-all text-left text-xs group"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: isPrimary ? themeCfg.primaryHex : themeCfg.relayHex }} />
                        <div>
                          <div className="font-mono text-slate-200 group-hover:text-white transition-colors">
                            {neighbor.name}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            {isPrimary ? (neighbor.category || 'Nota') : 'Hub Tag'} // #{neighbor.id}
                          </div>
                        </div>
                      </div>

                      <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Botón de Recentrado */}
          <div className="mt-3 pt-2.5 border-t border-slate-800 shrink-0">
            <button
              onClick={() => {
                if (controlsRef.current) {
                  controlsRef.current.target.set(selectedNode.x, selectedNode.y, selectedNode.z);
                }
              }}
              className={`w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border text-xs font-mono font-semibold transition-all ${themeCfg.primaryClass}`}
            >
              <Target className="w-3.5 h-3.5" />
              Re-Centrar Cámara en Nodo
            </button>
          </div>
        </div>
      )}

      {/* GUÍA DE INTERACCIÓN INFERIOR */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
        <div className={`flex items-center gap-3 md:gap-4 px-4 py-2 rounded-full bg-slate-950/70 border ${themeCfg.borderClass} backdrop-blur-md text-[11px] font-mono text-slate-300 shadow-xl`}>
          <span className="flex items-center gap-1.5">
            <span className="font-bold" style={{ color: themeCfg.primaryHex }}>HOVER:</span> Resaltar Vecinos
          </span>
          <span className="text-slate-700">|</span>
          <span className="flex items-center gap-1.5">
            <span className="font-bold" style={{ color: themeCfg.primaryHex }}>CLICK:</span> Enfocar & Leer
          </span>
          <span className="text-slate-700">|</span>
          <span className="flex items-center gap-1.5">
            <span className="font-bold" style={{ color: themeCfg.primaryHex }}>FONDO:</span> Deseleccionar
          </span>
        </div>
      </div>

      {/* BORDES CIBERNÉTICOS */}
      <div className="absolute top-4 left-4 w-4 h-4 border-t-2 border-l-2 border-white/20 pointer-events-none" />
      <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-white/20 pointer-events-none" />
      <div className="absolute bottom-4 left-4 w-4 h-4 border-b-2 border-l-2 border-white/20 pointer-events-none" />
      <div className="absolute bottom-4 right-4 w-4 h-4 border-b-2 border-r-2 border-white/20 pointer-events-none" />
    </div>
  );
}

export default C137GraphView;
