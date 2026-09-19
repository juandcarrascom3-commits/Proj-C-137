import React, { useMemo, useRef, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import { EffectComposer, Bloom, DepthOfField } from '@react-three/postprocessing';
import * as THREE from 'three';
import { 
  Activity, 
  Share2, 
  RotateCw, 
  Maximize2, 
  Zap, 
  Radio, 
  Cpu, 
  Layers,
  Sparkles
} from 'lucide-react';

/**
 * =======================================================================
 * PROYECTO "C-137" - GRAFO DE RED 3D ESTILO CONSTELACIÓN CYBERPUNK
 * =======================================================================
 * Tecnologías: React Three Fiber, InstancedMesh (150 nodos @ 60 FPS),
 * Postprocesado con Bloom emisivo y Depth of Field cinemático.
 */

// Tipos del grafo
interface StellarNode {
  id: number;
  name: string;
  type: 'primary' | 'relay'; // Cian (#00f0ff) o Violeta (#7000ff)
  position: [number, number, number];
  scale: number;
  cluster: number;
}

interface StellarConnection {
  source: number;
  target: number;
  distance: number;
}

// -----------------------------------------------------------------------
// 1. GENERACIÓN DE DATOS SINTÉTICOS ESTÁTICOS (150 Nodos y Constelación)
// -----------------------------------------------------------------------
const TOTAL_NODES = 150;
const MAX_CONNECTION_DIST = 8.8;

// Generador determinista pseudo-aleatorio para consistencia visual
function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

// Generación de 150 nodos distribuidos en constelaciones tridimensionales
const SYNTHETIC_NODES: StellarNode[] = (() => {
  const nodes: StellarNode[] = [];
  const clusterCenters = [
    [0, 0, 0],
    [-14, 8, -6],
    [14, -6, 8],
    [-8, -12, 10],
    [10, 12, -8],
    [0, 16, 12]
  ];

  for (let i = 0; i < TOTAL_NODES; i++) {
    const clusterId = i % clusterCenters.length;
    const center = clusterCenters[clusterId];
    
    // Distribución esferoide alrededor de núcleos estelares
    const r = 4 + seededRandom(i * 3 + 1) * 16;
    const theta = seededRandom(i * 3 + 2) * Math.PI * 2;
    const phi = (seededRandom(i * 3 + 3) - 0.5) * Math.PI;

    const x = center[0] + r * Math.cos(theta) * Math.cos(phi);
    const y = center[1] + r * Math.sin(phi);
    const z = center[2] + r * Math.sin(theta) * Math.cos(phi);

    // 65% primarios (cian), 35% relés cuánticos (violeta)
    const isRelay = seededRandom(i * 7 + 5) > 0.65;

    nodes.push({
      id: i,
      name: `NODE-${clusterId + 1}-${i.toString().padStart(3, '0')}`,
      type: isRelay ? 'relay' : 'primary',
      position: [x, y, z],
      scale: isRelay ? 0.38 + seededRandom(i) * 0.25 : 0.28 + seededRandom(i) * 0.2,
      cluster: clusterId
    });
  }
  return nodes;
})();

// Generación de conexiones de red entre nodos cercanos
const SYNTHETIC_CONNECTIONS: StellarConnection[] = (() => {
  const links: StellarConnection[] = [];
  const maxPerNode = 4;
  const connectionCounts = new Array(TOTAL_NODES).fill(0);

  for (let i = 0; i < TOTAL_NODES; i++) {
    for (let j = i + 1; j < TOTAL_NODES; j++) {
      if (connectionCounts[i] >= maxPerNode || connectionCounts[j] >= maxPerNode) continue;
      
      const p1 = SYNTHETIC_NODES[i].position;
      const p2 = SYNTHETIC_NODES[j].position;
      const dx = p1[0] - p2[0];
      const dy = p1[1] - p2[1];
      const dz = p1[2] - p2[2];
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      // Conexión si están dentro de la distancia máxima y cierta probabilidad
      if (dist < MAX_CONNECTION_DIST) {
        links.push({ source: i, target: j, distance: dist });
        connectionCounts[i]++;
        connectionCounts[j]++;
      }
    }
  }
  return links;
})();

// -----------------------------------------------------------------------
// 2. COMPONENTE DE NODOS EN INSTANCEDMESH (Optimizado a 60 FPS)
// -----------------------------------------------------------------------
function InstancedNodes({ bloomBoost }: { bloomBoost: boolean }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const colorCyan = useMemo(() => new THREE.Color('#00f0ff').multiplyScalar(bloomBoost ? 2.8 : 2.0), [bloomBoost]);
  const colorViolet = useMemo(() => new THREE.Color('#9d00ff').multiplyScalar(bloomBoost ? 3.2 : 2.2), [bloomBoost]);

  useEffect(() => {
    if (!meshRef.current) return;
    const mesh = meshRef.current;
    const dummy = new THREE.Object3D();

    SYNTHETIC_NODES.forEach((node, i) => {
      dummy.position.set(...node.position);
      dummy.scale.set(node.scale, node.scale, node.scale);
      dummy.updateMatrix();

      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, node.type === 'primary' ? colorCyan : colorViolet);
    });

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [colorCyan, colorViolet]);

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, TOTAL_NODES]}
      frustumCulled={false}
    >
      {/* Geometría de icosaedro facetada para estética cibernética */}
      <icosahedronGeometry args={[1, 1]} />
      <meshBasicMaterial
        toneMapped={false}
        transparent
        opacity={0.95}
      />
    </instancedMesh>
  );
}

// -----------------------------------------------------------------------
// 3. LÍNEAS DE CONEXIÓN DE LA CONSTELACIÓN (LineSegments con Vertex Colors)
// -----------------------------------------------------------------------
function ConstellationLines() {
  const { linePositions, lineColors } = useMemo(() => {
    const pos = new Float32Array(SYNTHETIC_CONNECTIONS.length * 6);
    const col = new Float32Array(SYNTHETIC_CONNECTIONS.length * 6);

    const cCyan = new THREE.Color('#00f0ff');
    const cViolet = new THREE.Color('#7000ff');

    SYNTHETIC_CONNECTIONS.forEach((link, idx) => {
      const src = SYNTHETIC_NODES[link.source];
      const tgt = SYNTHETIC_NODES[link.target];
      const offset = idx * 6;

      // Coordenadas inicio y fin
      pos[offset + 0] = src.position[0];
      pos[offset + 1] = src.position[1];
      pos[offset + 2] = src.position[2];

      pos[offset + 3] = tgt.position[0];
      pos[offset + 4] = tgt.position[1];
      pos[offset + 5] = tgt.position[2];

      // Colores de gradiente entre nodos
      const col1 = src.type === 'primary' ? cCyan : cViolet;
      const col2 = tgt.type === 'primary' ? cCyan : cViolet;

      col[offset + 0] = col1.r * 1.5;
      col[offset + 1] = col1.g * 1.5;
      col[offset + 2] = col1.b * 1.5;

      col[offset + 3] = col2.r * 1.5;
      col[offset + 4] = col2.g * 1.5;
      col[offset + 5] = col2.b * 1.5;
    });

    return { linePositions: pos, lineColors: col };
  }, []);

  return (
    <lineSegments>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[linePositions, 3]}
        />
        <bufferAttribute
          attach="attributes-color"
          args={[lineColors, 3]}
        />
      </bufferGeometry>
      <lineBasicMaterial
        vertexColors
        transparent
        opacity={0.4}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
        linewidth={1}
      />
    </lineSegments>
  );
}

// -----------------------------------------------------------------------
// 4. GRUPO PRINCIPAL CON ROTACIÓN SUAVE Y PARTÍCULAS CÓSMICAS
// -----------------------------------------------------------------------
function ConstellationGroup({ autoRotate, bloomBoost }: { autoRotate: boolean; bloomBoost: boolean }) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (groupRef.current && autoRotate) {
      groupRef.current.rotation.y += delta * 0.04;
      groupRef.current.rotation.x += delta * 0.01;
    }
  });

  return (
    <group ref={groupRef}>
      <InstancedNodes bloomBoost={bloomBoost} />
      <ConstellationLines />
    </group>
  );
}

// -----------------------------------------------------------------------
// 5. ESCENA Y POSTPROCESAMIENTO (Bloom & Depth of Field)
// -----------------------------------------------------------------------
function Scene({ autoRotate, bloomBoost }: { autoRotate: boolean; bloomBoost: boolean }) {
  return (
    <>
      <color attach="background" args={['#020617']} />
      
      {/* Luz ambiente tenue y estrellas cósmicas de fondo */}
      <ambientLight intensity={0.2} />
      <Stars 
        radius={70} 
        depth={50} 
        count={1200} 
        factor={3} 
        saturation={0.5} 
        fade 
        speed={0.8} 
      />

      {/* Red y constelación */}
      <ConstellationGroup autoRotate={autoRotate} bloomBoost={bloomBoost} />

      {/* Control de cámara interactivo */}
      <OrbitControls
        enableDamping
        dampingFactor={0.05}
        minDistance={12}
        maxDistance={70}
        rotateSpeed={0.7}
      />

      {/* Cadena de Postprocesamiento Cyberpunk */}
      <EffectComposer multisampling={0}>
        <DepthOfField
          focusDistance={0.02}
          focalLength={0.18}
          bokehScale={2.4}
          height={480}
        />
        <Bloom
          luminanceThreshold={0.12}
          luminanceSmoothing={0.85}
          intensity={bloomBoost ? 2.2 : 1.6}
          mipmapBlur
        />
      </EffectComposer>
    </>
  );
}

// -----------------------------------------------------------------------
// 6. COMPONENTE PRINCIPAL C-137 (Layout Fullscreen con Vidrio Esmerilado)
// -----------------------------------------------------------------------
export default function App() {
  const [autoRotate, setAutoRotate] = useState(true);
  const [bloomBoost, setBloomBoost] = useState(false);

  // Estadísticas calculadas
  const totalPrimary = useMemo(() => SYNTHETIC_NODES.filter(n => n.type === 'primary').length, []);
  const totalRelay = useMemo(() => SYNTHETIC_NODES.filter(n => n.type === 'relay').length, []);
  const density = (SYNTHETIC_CONNECTIONS.length / TOTAL_NODES).toFixed(2);

  return (
    <div id="c137-container" className="relative w-screen h-screen bg-[#020617] overflow-hidden select-none font-sans text-slate-100">
      
      {/* CANVAS WEBGL 3D */}
      <div className="absolute inset-0 z-0">
        <Canvas
          camera={{ position: [0, 8, 38], fov: 45 }}
          gl={{
            antialias: false,
            powerPreference: 'high-performance',
            alpha: false,
          }}
        >
          <Scene autoRotate={autoRotate} bloomBoost={bloomBoost} />
        </Canvas>
      </div>

      {/* HUD SUPERIOR DERECHO - TELEMETRÍA Y STATUS */}
      <div className="absolute top-6 right-6 z-10 pointer-events-none hidden md:flex flex-col items-end gap-1 font-mono text-xs text-cyan-400/80">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-slate-950/70 border border-cyan-500/20 backdrop-blur-md">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
          </span>
          <span className="tracking-widest font-bold text-cyan-300">SYSTEM: ONLINE</span>
          <span className="text-slate-600">|</span>
          <span className="text-slate-400">FPS: 60 (INSTANCED)</span>
        </div>
        <span className="text-[10px] text-slate-500 tracking-wider">LOC: SECTOR RHO-C137 // PROTOCOL: NEURAL-MESH</span>
      </div>

      {/* PANEL FLOTANTE VIDRIO ESMERILADO (FROSTED GLASS PANEL) */}
      <div 
        id="c137-hud-panel"
        className="absolute top-6 left-6 z-10 w-80 md:w-96 rounded-2xl p-5 md:p-6 
                   backdrop-blur-xl bg-slate-950/70 border border-cyan-500/30
                   shadow-[0_0_40px_rgba(0,240,255,0.12),inset_0_0_20px_rgba(0,240,255,0.03)]
                   transition-all duration-300 pointer-events-auto"
      >
        {/* Cabecera del Panel */}
        <div className="flex items-start justify-between pb-4 border-b border-cyan-500/20">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 text-[10px] font-mono font-bold tracking-widest uppercase bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 rounded">
                EXPERIMENT C-137
              </span>
              <span className="flex h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
            </div>
            <h1 className="mt-1 text-xl font-bold tracking-tight text-white flex items-center gap-2">
              Constellation Graph
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Grafo topológico 3D renderizado por WebGL
            </p>
          </div>
          <div className="p-2 rounded-lg bg-cyan-950/40 border border-cyan-500/30 text-cyan-400">
            <Share2 className="w-5 h-5" />
          </div>
        </div>

        {/* Métricas Principales en Grid */}
        <div className="grid grid-cols-2 gap-3 my-4">
          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-cyan-500/40 transition-colors">
            <div className="flex items-center gap-1.5 text-slate-400 text-xs font-mono">
              <Cpu className="w-3.5 h-3.5 text-cyan-400" />
              <span>TOTAL NODOS</span>
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-cyan-300">{TOTAL_NODES}</span>
              <span className="text-[10px] font-mono text-cyan-500/80">INSTANCES</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-violet-500/40 transition-colors">
            <div className="flex items-center gap-1.5 text-slate-400 text-xs font-mono">
              <Activity className="w-3.5 h-3.5 text-violet-400" />
              <span>CONEXIONES</span>
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-violet-300">{SYNTHETIC_CONNECTIONS.length}</span>
              <span className="text-[10px] font-mono text-violet-400/80">SYNAPSES</span>
            </div>
          </div>
        </div>

        {/* Detalles y Leyenda de Nodos */}
        <div className="space-y-2 py-3 border-t border-slate-800/80 text-xs">
          <div className="flex items-center justify-between text-slate-300">
            <span className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#00f0ff] shadow-[0_0_8px_#00f0ff]"></span>
              Nodos Primarios (Cian)
            </span>
            <span className="font-mono font-semibold text-cyan-400">{totalPrimary}</span>
          </div>

          <div className="flex items-center justify-between text-slate-300">
            <span className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#7000ff] shadow-[0_0_8px_#7000ff]"></span>
              Relés Cuánticos (Violeta)
            </span>
            <span className="font-mono font-semibold text-violet-400">{totalRelay}</span>
          </div>

          <div className="flex items-center justify-between text-slate-300">
            <span className="flex items-center gap-2 text-slate-400">
              <Layers className="w-3 h-3 text-slate-400" />
              Densidad de Enlace
            </span>
            <span className="font-mono text-slate-300">{density} enlaces/nodo</span>
          </div>
        </div>

        {/* Barra de Controles Rápidos */}
        <div className="mt-4 pt-3 border-t border-cyan-500/20 flex items-center justify-between gap-2">
          <button
            id="btn-toggle-rotate"
            onClick={() => setAutoRotate(prev => !prev)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium transition-all ${
              autoRotate 
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-[0_0_15px_rgba(0,240,255,0.15)]' 
                : 'bg-slate-900/80 text-slate-400 border border-slate-800 hover:text-white'
            }`}
          >
            <RotateCw className={`w-3.5 h-3.5 ${autoRotate ? 'animate-spin' : ''}`} style={{ animationDuration: '6s' }} />
            <span>{autoRotate ? 'Rotando' : 'Pausado'}</span>
          </button>

          <button
            id="btn-toggle-bloom"
            onClick={() => setBloomBoost(prev => !prev)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium transition-all ${
              bloomBoost 
                ? 'bg-violet-500/25 text-violet-300 border border-violet-500/50 shadow-[0_0_15px_rgba(112,0,255,0.25)]' 
                : 'bg-slate-900/80 text-slate-400 border border-slate-800 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-violet-400" />
            <span>Bloom {bloomBoost ? 'Ultra' : 'Normal'}</span>
          </button>
        </div>
      </div>

      {/* GUÍA DE INTERACCIÓN INFERIOR */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
        <div className="flex items-center gap-4 px-4 py-2 rounded-full bg-slate-950/60 border border-slate-800/80 backdrop-blur-md text-[11px] font-mono text-slate-400 shadow-lg">
          <span className="flex items-center gap-1.5">
            <span className="text-cyan-400">CLICK IZQ:</span> Rotar Cámara
          </span>
          <span className="text-slate-700">|</span>
          <span className="flex items-center gap-1.5">
            <span className="text-cyan-400">RUEDA:</span> Zoom
          </span>
          <span className="text-slate-700">|</span>
          <span className="flex items-center gap-1.5">
            <span className="text-cyan-400">CLICK DER:</span> Desplazar
          </span>
        </div>
      </div>

      {/* DETALLE CIBERNÉTICO: BORDES HUD DECORATIVOS */}
      <div className="absolute top-4 left-4 w-4 h-4 border-t-2 border-l-2 border-cyan-500/30 pointer-events-none" />
      <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-cyan-500/30 pointer-events-none" />
      <div className="absolute bottom-4 left-4 w-4 h-4 border-b-2 border-l-2 border-cyan-500/30 pointer-events-none" />
      <div className="absolute bottom-4 right-4 w-4 h-4 border-b-2 border-r-2 border-cyan-500/30 pointer-events-none" />
    </div>
  );
}
