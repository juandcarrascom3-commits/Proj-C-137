import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Stars, Html } from '@react-three/drei';
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
  Sparkles
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
  activeCategory: string | null;
}

function InstancedNodes({
  nodes,
  hoveredId,
  selectedId,
  activeNeighbors,
  onHover,
  onSelect,
  bloomBoost,
  theme,
  activeCategory
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

    const hoveredNode = hoveredId !== null ? nodes[hoveredId] : null;
    const selectedNode = selectedId !== null ? nodes[selectedId] : null;

    nodes.forEach((node, i) => {
      const nx = Number.isFinite(node.x) ? node.x : 0;
      const ny = Number.isFinite(node.y) ? node.y : 0;
      const nz = Number.isFinite(node.z) ? node.z : 0;
      dummy.position.set(nx, ny, nz);

      const isHoveredTarget = i === hoveredId;
      const isHoveredNeighbor = hoveredId !== null && hoveredNode?.connections.includes(i);
      
      const isSelectedTarget = i === selectedId;
      const isSelectedNeighbor = selectedId !== null && selectedNode?.connections.includes(i);

      let scaleMult = 1.0;
      let chosenColor: THREE.Color;

      if (hoveredId !== null) {
        if (isHoveredTarget) {
          scaleMult = 1.5;
          // Resplandor sutil (halo cian)
          chosenColor = new THREE.Color('#00ffff').multiplyScalar(2.0);
        } else if (isHoveredNeighbor) {
          scaleMult = 1.2;
          chosenColor = new THREE.Color('#00ffff').multiplyScalar(1.2);
        } else {
          scaleMult = 0.5;
          chosenColor = node.type === 'primary' ? colors.primaryDimmed : colors.relayDimmed;
        }
      } else if (selectedId !== null) {
        if (isSelectedTarget) {
          scaleMult = 1.65;
          chosenColor = colors.targetGold;
        } else if (isSelectedNeighbor) {
          scaleMult = 1.3;
          chosenColor = node.type === 'primary' ? colors.primaryBright : colors.relayBright;
        } else {
          scaleMult = 0.5;
          chosenColor = node.type === 'primary' ? colors.primaryDimmed : colors.relayDimmed;
        }
      } else {
        chosenColor = node.type === 'primary' ? colors.primaryNormal : colors.relayNormal;
      }

      // Aislamiento por categoría
      if (activeCategory) {
        const nodeCat = node.category || (node.type === 'primary' ? 'Notas' : 'Hubs');
        if (nodeCat !== activeCategory) {
          scaleMult *= 0.3;
          chosenColor = chosenColor.clone().multiplyScalar(0.15);
        }
      }

      const finalScale = node.baseScale * scaleMult;
      dummy.scale.set(finalScale, finalScale, finalScale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, chosenColor);
    });

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [nodes, hoveredId, selectedId, activeNeighbors, colors, activeCategory]);

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
  activeCategory: string | null;
}

function ConstellationLines({ nodes, links, hoveredId, selectedId, theme, activeCategory }: ConstellationLinesProps) {
  const geomRef = useRef<THREE.BufferGeometry>(null);
  const matRef = useRef<THREE.LineBasicMaterial>(null);
  const themeCfg = THEME_CONFIG[theme];

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

    const hoveredNode = hoveredId !== null ? nodes[hoveredId] : null;
    const selectedNode = selectedId !== null ? nodes[selectedId] : null;

    links.forEach((link, idx) => {
      const srcId = typeof link.source === 'object' ? (link.source as any).id : link.source;
      const tgtId = typeof link.target === 'object' ? (link.target as any).id : link.target;
      const srcNode = nodes[srcId];
      const tgtNode = nodes[tgtId];
      const offset = idx * 6;

      const isHoveredConnection = hoveredId !== null && (srcId === hoveredId || tgtId === hoveredId);
      const isSelectedConnection = selectedId !== null && (srcId === selectedId || tgtId === selectedId);

      // Aislamiento por categoría: si NINGUNO de los extremos pertenece a la categoría activa, atenuamos
      let isFilteredOut = false;
      if (activeCategory) {
        const srcCat = srcNode?.category || (srcNode?.type === 'primary' ? 'Notas' : 'Hubs');
        const tgtCat = tgtNode?.category || (tgtNode?.type === 'primary' ? 'Notas' : 'Hubs');
        if (srcCat !== activeCategory && tgtCat !== activeCategory) {
          isFilteredOut = true;
        }
      }

      if (isFilteredOut) {
        arr[offset + 0] = baseColors[offset + 0] * 0.15;
        arr[offset + 1] = baseColors[offset + 1] * 0.15;
        arr[offset + 2] = baseColors[offset + 2] * 0.15;
        arr[offset + 3] = baseColors[offset + 3] * 0.15;
        arr[offset + 4] = baseColors[offset + 4] * 0.15;
        arr[offset + 5] = baseColors[offset + 5] * 0.15;
      } else {
        if (hoveredId !== null) {
          if (isHoveredConnection) {
            arr[offset + 0] = 0.0; arr[offset + 1] = 1.0; arr[offset + 2] = 1.0;
            arr[offset + 3] = 0.0; arr[offset + 4] = 1.0; arr[offset + 5] = 1.0;
          } else {
            arr[offset + 0] = baseColors[offset + 0] * 0.07;
            arr[offset + 1] = baseColors[offset + 1] * 0.07;
            arr[offset + 2] = baseColors[offset + 2] * 0.07;
            arr[offset + 3] = baseColors[offset + 3] * 0.07;
            arr[offset + 4] = baseColors[offset + 4] * 0.07;
            arr[offset + 5] = baseColors[offset + 5] * 0.07;
          }
        } else if (selectedId !== null) {
          if (isSelectedConnection) {
            arr[offset + 0] = 1.0; arr[offset + 1] = 0.95; arr[offset + 2] = 0.4;
            arr[offset + 3] = 0.0; arr[offset + 4] = 1.0; arr[offset + 5] = 1.0;
          } else {
            arr[offset + 0] = baseColors[offset + 0] * 0.07;
            arr[offset + 1] = baseColors[offset + 1] * 0.07;
            arr[offset + 2] = baseColors[offset + 2] * 0.07;
            arr[offset + 3] = baseColors[offset + 3] * 0.07;
            arr[offset + 4] = baseColors[offset + 4] * 0.07;
            arr[offset + 5] = baseColors[offset + 5] * 0.07;
          }
        } else {
          arr[offset + 0] = baseColors[offset + 0];
          arr[offset + 1] = baseColors[offset + 1];
          arr[offset + 2] = baseColors[offset + 2];
          arr[offset + 3] = baseColors[offset + 3];
          arr[offset + 4] = baseColors[offset + 4];
          arr[offset + 5] = baseColors[offset + 5];
        }
      }
    });

    colorAttr.needsUpdate = true;
  }, [hoveredId, selectedId, baseColors, links, nodes, activeCategory]);

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
        opacity={0.45}
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
  links: Graph3DLink[];
  selectedId: number | null;
  controlsRef: React.RefObject<any>;
  inspectorOpen: boolean;
  dofRef: React.RefObject<any>;
}

function CameraRig({ nodes, links, selectedId, controlsRef, inspectorOpen, dofRef }: CameraRigProps) {
  const { camera } = useThree();

  // Refs persistentes para la interpolación suave — no causan re-renders
  const desiredTarget  = useRef(new THREE.Vector3(0, 0, 0));
  const desiredCamPos  = useRef(new THREE.Vector3(0, 8, 38));
  const isTransitioning = useRef(false);

  // ── Recalcular destino al cambiar nodo seleccionado ──────────────────
  useEffect(() => {
    if (selectedId === null || !nodes[selectedId]) {
      // Sin selección: volver al origen
      desiredTarget.current.set(0, 0, 0);
      desiredCamPos.current.set(0, 8, 38);
      isTransitioning.current = true;
      return;
    }

    const node = nodes[selectedId];
    const nx = Number.isFinite(node.x) ? node.x : 0;
    const ny = Number.isFinite(node.y) ? node.y : 0;
    const nz = Number.isFinite(node.z) ? node.z : 0;
    const nodeVec = new THREE.Vector3(nx, ny, nz);

    // 1. Radio del cluster: distancia máxima a vecinos directos
    let clusterRadius = 0;
    if (node.connections && node.connections.length > 0) {
      node.connections.forEach((neighborId) => {
        const neighbor = nodes[neighborId];
        if (!neighbor) return;
        const dx = (Number.isFinite(neighbor.x) ? neighbor.x : 0) - nx;
        const dy = (Number.isFinite(neighbor.y) ? neighbor.y : 0) - ny;
        const dz = (Number.isFinite(neighbor.z) ? neighbor.z : 0) - nz;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist > clusterRadius) clusterRadius = dist;
      });
    }

    // 2. Distancia de cámara proporcional al cluster
    //    Nodo aislado → 35 u (nodo < 10% pantalla); conectado → D = max(30, radio×2.2)
    const camDistance = clusterRadius < 0.5
      ? 35
      : Math.max(30, clusterRadius * 2.2);

    // 3. Offset X por panel Inspector (35% derecho del canvas)
    //    Desplazamos el punto focal +10 u en X para que el nodo quede
    //    centrado en el 65% izquierdo libre cuando el panel está abierto.
    const INSPECTOR_OFFSET_X = inspectorOpen ? 10 : 0;
    const adjustedTarget = nodeVec.clone().add(new THREE.Vector3(INSPECTOR_OFFSET_X, 0, 0));

    // 4. Dirección cámara → nodo (o fallback frontal)
    const camDir = camera.position.clone().sub(adjustedTarget).normalize();
    if (camDir.lengthSq() < 0.01) camDir.set(0, 0.4, 1).normalize();

    desiredTarget.current.copy(adjustedTarget);
    desiredCamPos.current.copy(adjustedTarget).addScaledVector(camDir, camDistance).add(new THREE.Vector3(0, camDistance * 0.05, 0));
    isTransitioning.current = true;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, nodes, inspectorOpen]);

  // ── Bucle de animación ────────────────────────────────────────────────
  useFrame(() => {
    if (!controlsRef.current) return;

    const LERP = 0.05; // Factor de suavizado constante

    // Interpolación suave de posición y target (OrbitControls queda libre)
    controlsRef.current.target.lerp(desiredTarget.current, LERP);
    camera.position.lerp(desiredCamPos.current, LERP);
    controlsRef.current.update();

    // 5. DoF dinámico: la distancia real cámara→target define el foco
    if (dofRef.current && selectedId !== null) {
      const realDist = camera.position.distanceTo(controlsRef.current.target);
      // focusDistance en postprocessing es [0..1] relativo al far plane (camera.far).
      // Usamos la distancia en unidades mundo normalizada por el far plane.
      const normalizedFocus = realDist / (camera as THREE.PerspectiveCamera).far;
      try {
        // API de postprocessing v6: accedemos al uniform directamente
        const coc = dofRef.current.circleOfConfusionMaterial;
        if (coc && coc.uniforms && coc.uniforms.focusDistance) {
          coc.uniforms.focusDistance.value = normalizedFocus;
        }
      } catch {
        // Silencioso: la API interna puede variar entre versiones
      }
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
  showLabels?: boolean;
  inspectorOpen: boolean;
  activeCategory: string | null;
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
  activeCategory
}: SceneProps) {
  const groupRef = useRef<THREE.Group>(null);
  const starsRef = useRef<THREE.Group>(null);
  const dofRef   = useRef<any>(null);          // ref al efecto DepthOfField
  const themeCfg = THEME_CONFIG[theme];

  // Atenuación del fondo estelar al 20%
  useEffect(() => {
    if (starsRef.current) {
      starsRef.current.traverse((child: any) => {
        if (child.isPoints && child.material) {
          child.material.transparent = true;
          child.material.opacity = 0.2;
        }
      });
    }
  }, []);

  useFrame(({ camera, raycaster }, delta) => {
    // 1. Raycasting Adaptativo
    if (controlsRef.current) {
      const dist = camera.position.distanceTo(controlsRef.current.target);
      // Umbral más amplio de lejos, más estrecho de cerca
      const adaptiveThreshold = Math.max(0.1, dist * 0.025);
      
      if (raycaster.params.Points) raycaster.params.Points.threshold = adaptiveThreshold;
      if (raycaster.params.Line) raycaster.params.Line.threshold = adaptiveThreshold;
      (raycaster.params as any).Mesh = { threshold: adaptiveThreshold }; // Fallback para meshes
    }

    // Auto-rotación
    if (groupRef.current && autoRotate) {
      const speed = selectedId !== null ? 0.008 : 0.035;
      groupRef.current.rotation.y += delta * speed;
    }
  });

  return (
    <>
      <color attach="background" args={[themeCfg.bg]} />
      <ambientLight intensity={0.25} />

      <group ref={starsRef}>
        <Stars 
          radius={80} 
          depth={60} 
          count={1500} 
          factor={themeCfg.starsFactor * 0.2} 
          saturation={0.5} 
          fade 
          speed={0.7} 
        />
      </group>

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
          activeCategory={activeCategory}
        />
        <ConstellationLines
          nodes={nodes}
          links={links}
          hoveredId={hoveredId}
          selectedId={selectedId}
          theme={theme}
          activeCategory={activeCategory}
        />
      </group>

      <CameraRig
        nodes={nodes}
        links={links}
        selectedId={selectedId}
        controlsRef={controlsRef}
        inspectorOpen={inspectorOpen}
        dofRef={dofRef}
      />

      <OrbitControls
        ref={controlsRef}
        enableDamping
        dampingFactor={0.06}
        minDistance={10}
        maxDistance={3000}
        rotateSpeed={0.7}
        panSpeed={0.5}
      />

      {/* Floating 3D label on hover/select when showLabels is enabled */}
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
            <div className={`px-2 py-0.5 rounded-md bg-gray-950/80 backdrop-blur-md border ${
              isHover 
                ? 'border-cyan-400 shadow-[0_0_8px_rgba(0,240,255,0.6)] text-cyan-300' 
                : 'border-white/20 text-slate-100'
            } text-[11px] font-sans shadow-xl whitespace-nowrap select-none transition-all`}>
              {node.name}
            </div>
          </Html>
        );
      })()}

      <EffectComposer multisampling={0}>
        <DepthOfField
          ref={dofRef}
          focusDistance={0.01}
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
// 5. UTILIDADES DE SINCRONIZACIÓN Y REACTIVIDAD INCREMENTAL (FASE 5)
// -----------------------------------------------------------------------

/**
 * Sincronización Deep Linking: Actualiza el parámetro ?note= en la URL
 * utilizando History API sin provocar recarga de página.
 */
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
    // Fallback silencioso en entornos restringidos
  }
}

/**
 * Construye o actualiza el grafo Nexus de forma incremental.
 * Mantiene intactas las coordenadas tridimensionales (x, y, z) y los vectores de velocidad (vx, vy, vz)
 * de los nodos preexistentes para eliminar saltos bruscos al recibir nuevas notas en vivo.
 */
function buildIncrementalNexusGraph(
  notes: NexusNote[],
  prevNodes?: Graph3DNode[]
): { nodes: Graph3DNode[]; links: Graph3DLink[] } {
  const nodes: Graph3DNode[] = [];
  const links: Graph3DLink[] = [];

  // Mapear nodos preexistentes por su slug/identificador único
  const prevMap = new Map<string, Graph3DNode>();
  if (prevNodes && prevNodes.length > 0) {
    prevNodes.forEach((n) => {
      prevMap.set(n.slug, n);
    });
  }

  const titleToNodeIndex = new Map<string, number>();
  const tagToNodeIndex = new Map<string, number>();

  // 1. Procesar notas principales (type: 'primary')
  notes.forEach((note, idx) => {
    const slug = note.id;
    const prev = prevMap.get(slug);

    let x: number, y: number, z: number;
    let vx: number | undefined, vy: number | undefined, vz: number | undefined;

    if (prev && Number.isFinite(prev.x)) {
      // Preservar posición y vector cinético anterior
      x = prev.x;
      y = prev.y;
      z = prev.z;
      vx = prev.vx;
      vy = prev.vy;
      vz = prev.vz;
    } else {
      // Posicionamiento armónico inicial para nodos nuevos
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
      x,
      y,
      z,
      vx,
      vy,
      vz,
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

  // 2. Extraer tags únicos (de propiedades y menciones inline)
  const uniqueTags = new Set<string>();
  notes.forEach((note) => {
    note.tags.forEach((t) => uniqueTags.add(t.toLowerCase().replace(/^#/, '')));
    const inline = extractInlineTags(note.content);
    inline.forEach((t) => uniqueTags.add(t));
  });

  // 3. Crear nodos para hubs de tags (type: 'relay')
  let currentIdx = nodes.length;
  uniqueTags.forEach((tag) => {
    const tagSlug = `tag-${tag}`;
    const prev = prevMap.get(tagSlug);

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
      x = (Math.random() - 0.5) * 22;
      y = (Math.random() - 0.5) * 22;
      z = (Math.random() - 0.5) * 22;
    }

    const tagNode: Graph3DNode = {
      id: currentIdx,
      slug: tagSlug,
      name: `#${tag.toUpperCase()}`,
      type: 'relay',
      x,
      y,
      z,
      vx,
      vy,
      vz,
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

  // 4. Enlaces WikiLinks y Tags
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
    // A. Conexiones WikiLink
    const wikiLinks = extractWikiLinks(note.content);
    wikiLinks.forEach((targetTitle) => {
      const targetIdx = titleToNodeIndex.get(targetTitle.trim().toLowerCase());
      if (targetIdx !== undefined) {
        addLink(noteIdx, targetIdx, 'wikilink', 1.2);
      }
    });

    // B. Conexiones a Tags
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

  // 5. Escala proporcional según grado de conectividad
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
// 6. COMPONENTE EXPORTABLE <C137GraphView />
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
  const [showLabels, setShowLabels] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const controlsRef = useRef<any>(null);
  const simulationRef = useRef<any>(null);
  const blurTimeoutRef = useRef<any>(null);
  const initialDeepLinkCheckedRef = useRef(false);

  // Sincronizar tema con prop externa
  useEffect(() => {
    if (theme) setCurrentTheme(theme);
  }, [theme]);

  // Fuente de notas y estado reactivo incremental del grafo
  const sourceNotes = useMemo(() => notes || MOCK_NEXUS_NOTES, [notes]);
  const [nexusGraph, setNexusGraph] = useState<ParsedGraphResult>(() => parseNotesToGraph(sourceNotes));
  const constellationGraph = useMemo(() => buildConstellationBenchmark(), []);

  // Grafo activo según el modo seleccionado
  const currentGraph = dataMode === 'nexus' ? nexusGraph : constellationGraph;

  // -----------------------------------------------------------------------
  // FASE 5: REACTIVIDAD DINÁMICA (HOT-RELOAD) DE LA SIMULACIÓN
  // -----------------------------------------------------------------------
  useEffect(() => {
    const prevNodes = nexusGraph.nodes;
    const { nodes: newNodes, links: newLinks } = buildIncrementalNexusGraph(sourceNotes, prevNodes);

    if (!simulationRef.current) {
      // Inicialización de la simulación 3D
      const sim = forceSimulation(newNodes, 3)
        .force('charge', forceManyBody().strength((d: any) => (d.type === 'relay' ? -120 : -75)).distanceMax(50))
        .force('link', forceLink(newLinks).id((d: any) => d.id).distance((l: any) => l.distance).strength(0.5))
        .force('center', forceCenter(0, 0, 0))
        .stop();

      // Relajación sincrónica previa para convergencia inicial estable
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
      // Hot-reload reactivo: integrar nuevos nodos sin salto visual
      const sim = simulationRef.current;
      sim.nodes(newNodes);

      const linkForce = sim.force('link');
      if (linkForce) {
        linkForce.links(newLinks);
      }

      // Recalentar la simulación d3-force-3d suavemente
      sim.alpha(0.3).restart();

      sim.on('tick', () => {
        newNodes.forEach((node) => {
          if (!Number.isFinite(node.x)) node.x = 0;
          if (!Number.isFinite(node.y)) node.y = 0;
          if (!Number.isFinite(node.z)) node.z = 0;
        });

        // Actualizar el estado para que WebGL dibuje la transición orgánica
        setNexusGraph({ nodes: [...newNodes], links: [...newLinks] });

        // Auto-estabilización: detener simulación al converger para ahorrar CPU
        if (sim.alpha() < 0.02) {
          sim.stop();
          sim.on('tick', null);
        }
      });
    }
  }, [sourceNotes]);

  // -----------------------------------------------------------------------
  // FASE 5: AUDITORÍA DE DESMONTAJE (PREVENCIÓN DE MEMORY LEAKS)
  // -----------------------------------------------------------------------
  useEffect(() => {
    return () => {
      if (simulationRef.current) {
        simulationRef.current.on('tick', null);
        simulationRef.current.stop();
        simulationRef.current = null;
      }
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
      }
    };
  }, []);

  // -----------------------------------------------------------------------
  // FASE 5: DEEP LINKING (INICIALIZACIÓN DESDE ?note= EN URL)
  // -----------------------------------------------------------------------
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
          if (onNoteSelect) {
            onNoteSelect(foundNode.slug || foundNode.name);
          }
        }
      }
    } catch {
      // Fallback seguro
    }
  }, [currentGraph.nodes, activeNoteId, onNoteSelect]);

  // Sincronización bidireccional si la prop externa activeNoteId muta
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

  // Historial del navegador: soportar botones Atrás / Adelante con popstate
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
        // Fallback seguro
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [currentGraph.nodes, onNoteSelect]);

  const activeFocusId = hoveredId !== null ? hoveredId : selectedId;
  const activeNeighbors = useMemo(() => {
    if (activeFocusId === null) return new Set<number>();
    const node = currentGraph.nodes[activeFocusId];
    return new Set<number>(node ? node.connections : []);
  }, [activeFocusId, currentGraph]);

  // Callback de selección con actualización de Deep Link e invocación externa
  const handleSelectNode = useCallback((id: number) => {
    setSelectedId(id);
    const node = currentGraph.nodes[id];
    if (node) {
      updateUrlNote(node.slug || node.name);
      if (onNoteSelect) {
        onNoteSelect(node.slug || node.name);
      }
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
    if (onNoteSelect) {
      onNoteSelect('');
    }
    if (controlsRef.current) {
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.object.position.set(0, 8, 38);
      controlsRef.current.update();
    }
  };

  const handleCloseInspector = () => {
    setSelectedId(null);
    updateUrlNote(null);
    if (onNoteSelect) {
      onNoteSelect('');
    }
  };

  // Atajo de teclado Esc para limpiar selección y URL
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedId(null);
        setSearchTerm('');
        updateUrlNote(null);
        if (onNoteSelect) {
          onNoteSelect('');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onNoteSelect]);

  const selectedNode = selectedId !== null ? currentGraph.nodes[selectedId] : null;

  // Retener el nodo para animación fluida de salida en el Inspector
  const lastSelectedNodeRef = useRef<Graph3DNode | null>(null);
  if (selectedNode) {
    lastSelectedNodeRef.current = selectedNode;
  }
  const displayNode = selectedNode || lastSelectedNodeRef.current;

  // Categorías y conteos dinámicos
  const categories = useMemo(() => {
    const map = new Map<string, { count: number; color: string }>();
    const PALETTE = [
      '#00f0ff', // Cian
      '#a855f7', // Violeta
      '#f59e0b', // Ámbar
      '#10b981', // Esmeralda
      '#ec4899', // Rosa
      '#38bdf8', // Celeste
      '#fb923c', // Naranja
    ];
    let colorIdx = 0;

    currentGraph.nodes.forEach((n) => {
      let cat = n.category;
      if (!cat) {
        cat = n.type === 'primary' ? 'Notas' : 'Hubs';
      }
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
    }
  };

  // Resultados de búsqueda
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

  const totalPrimary = useMemo(() => currentGraph.nodes.filter((n) => n.type === 'primary').length, [currentGraph]);
  const totalRelay = useMemo(() => currentGraph.nodes.filter((n) => n.type === 'relay').length, [currentGraph]);
  const density = (currentGraph.links.length / (currentGraph.nodes.length || 1)).toFixed(2);
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
            showLabels={showLabels}
            inspectorOpen={selectedNode !== null}
          />
        </Canvas>
      </div>

      {/* 1. LEYENDA SUPERIOR IZQUIERDA (EL FILTRO VISUAL) */}
      <div className="absolute top-5 left-5 z-20 flex flex-col gap-2 pointer-events-auto max-w-[240px]">
        {/* Título minimalista "Nexus Graph" */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-950/60 backdrop-blur-md border border-white/10 shadow-lg w-fit">
          <div className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#00f0ff] animate-pulse" />
          <span className="text-xs font-semibold text-white tracking-wide font-sans">
            Nexus Graph
          </span>
          <span className="text-[10px] font-mono text-slate-400">
            {currentGraph.nodes.length}
          </span>
        </div>

        {/* Tarjeta minimalista de Categorías */}
        <div className="p-3 rounded-2xl bg-gray-950/60 backdrop-blur-md border border-white/10 shadow-xl space-y-1.5">
          <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 px-1">
            Categorías
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
                      ? 'bg-white/10 text-white font-medium' 
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
                    <span className="truncate font-sans text-[11px]">{cat.name}</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 ml-2">
                    {cat.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 2. BUSCADOR SUTIL (SUPERIOR DERECHA) */}
      <div className="absolute top-5 right-5 z-20 flex items-center gap-2 pointer-events-auto">
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
            className="w-44 sm:w-56 pl-9 pr-8 py-1.5 text-xs font-sans text-slate-200 placeholder:text-slate-500
                       bg-gray-950/40 hover:bg-gray-950/60 focus:bg-gray-950/80
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

          {/* Resultados flotantes de búsqueda */}
          {isSearchFocused && searchResults.length > 0 && (
            <div className="absolute top-full right-0 mt-2 w-64 max-h-60 overflow-y-auto rounded-xl bg-gray-950/85 backdrop-blur-md border border-white/10 shadow-2xl p-1 space-y-0.5 z-30">
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
                  <span className="truncate font-sans">{node.name}</span>
                  <span className="text-[10px] font-mono text-slate-400 shrink-0 ml-2">
                    {node.category || (node.type === 'primary' ? 'Nota' : 'Hub')}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 3. BARRA DE HERRAMIENTAS INFERIOR (DOCK ESTILO OBSIDIAN / GRAPHIFY) */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 pointer-events-auto">
        <div className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-gray-950/60 backdrop-blur-md border border-white/10 shadow-2xl text-slate-300">
          {/* Fluir / Congelar (Físicas / Órbita) */}
          <button
            onClick={() => setAutoRotate(prev => !prev)}
            title={autoRotate ? "Congelar movimiento" : "Fluir constelación"}
            className={`p-2 rounded-full transition-all ${
              autoRotate 
                ? 'text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
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

          {/* Zoom In (+) */}
          <button
            onClick={() => handleZoom(0.75)}
            title="Acercar (+)"
            className="p-2 rounded-full text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-all"
          >
            <Plus className="w-4 h-4" />
          </button>

          {/* Zoom Out (-) */}
          <button
            onClick={() => handleZoom(1.33)}
            title="Alejar (-)"
            className="p-2 rounded-full text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-all"
          >
            <Minus className="w-4 h-4" />
          </button>

          <div className="w-px h-4 bg-white/10 mx-1" />

          {/* Alternar Etiquetas */}
          <button
            onClick={() => setShowLabels(prev => !prev)}
            title={showLabels ? "Ocultar etiquetas" : "Mostrar etiquetas"}
            className={`p-2 rounded-full transition-all ${
              showLabels 
                ? 'text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            <Type className="w-4 h-4" />
          </button>

          <div className="w-px h-4 bg-white/10 mx-1" />

          {/* Selector sutil de Base de Datos / Benchmark */}
          <button
            onClick={() => handleModeChange(dataMode === 'nexus' ? 'constellation' : 'nexus')}
            title={dataMode === 'nexus' ? "Cambiar a Benchmark 150 Nodos" : "Cambiar a BBDD Nexus"}
            className="px-2.5 py-1 rounded-full text-[11px] font-mono font-medium text-slate-400 hover:text-cyan-300 hover:bg-white/5 transition-all flex items-center gap-1.5"
          >
            <Database className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{dataMode === 'nexus' ? 'Nexus' : '150N'}</span>
          </button>
        </div>
      </div>

      {/* 4. PANEL LATERAL RETRÁCTIL / BOTTOM SHEET (INSPECTOR) */}
      <div 
        id="c137-node-inspector"
        className={`fixed z-30 flex flex-col backdrop-blur-md bg-gray-950/75 shadow-2xl transition-transform duration-300 ease-out pointer-events-auto
                   bottom-0 left-0 right-0 w-full max-h-[55vh] rounded-t-2xl border-t border-white/10
                   md:right-4 md:top-16 md:bottom-auto md:left-auto md:w-[380px] md:h-[calc(100vh-80px)] md:rounded-2xl md:border md:border-white/10
                   ${selectedNode 
                     ? 'translate-y-0 md:translate-x-0' 
                     : 'translate-y-full md:translate-y-0 md:translate-x-full pointer-events-none'}`}
      >
        {displayNode && (
          <div className="flex flex-col h-full p-5 overflow-hidden">
            {/* Cabecera */}
            <div className="flex items-start justify-between pb-3 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={`p-1.5 rounded-lg border shrink-0 ${
                  displayNode.type === 'primary' 
                    ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-400' 
                    : 'border-violet-500/40 bg-violet-500/10 text-violet-400'
                }`}>
                  {displayNode.type === 'primary' ? (
                    <FileText className="w-4 h-4" />
                  ) : (
                    <Tag className="w-4 h-4" />
                  )}
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

              {/* Botón Cerrar (X) que limpia la selección */}
              <button
                onClick={handleCloseInspector}
                className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors shrink-0 ml-2"
                title="Cerrar (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Badges de Tags y Conexiones */}
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

            {/* Contenido Markdown / Inspector */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-4 custom-scrollbar">
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

              {/* Nodos Conectados */}
              <div>
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-2">
                  <span>Conexiones ({displayNode.connections.length})</span>
                  <span className="text-[10px] text-slate-500">Click para enfocar</span>
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
                          <span className="truncate font-sans text-slate-300 group-hover:text-white transition-colors">
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

            {/* Botón de Recentrado en este nodo */}
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
