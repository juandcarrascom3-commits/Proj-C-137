import { 
  forceSimulation, 
  forceManyBody, 
  forceLink, 
  forceCenter,
  forceX,
  forceY,
  forceZ
} from 'd3-force-3d';

export interface WorkerNode {
  id: number;
  slug: string;
  type?: 'primary' | 'relay';
  category?: string;
  x: number;
  y: number;
  z: number;
  vx?: number;
  vy?: number;
  vz?: number;
  fx?: number | null;
  fy?: number | null;
  fz?: number | null;
  degree?: number;
}

export interface WorkerLink {
  source: number;
  target: number;
  distance: number;
  weight?: number;
  type?: 'wikilink' | 'tag';
}

export interface WorkerInitPayload {
  type: 'INIT' | 'UPDATE';
  nodes: WorkerNode[];
  links: WorkerLink[];
  options?: {
    alpha?: number;
    alphaMin?: number;
    alphaDecay?: number;
    warmupTicks?: number;
    chargeStrength?: number;
    centerStrength?: number;
    layout?: TopologyLayout;
  };
}

export interface WorkerReheatPayload {
  type: 'REHEAT';
  alpha: number;
}

export interface WorkerStopPayload {
  type: 'STOP';
}

export interface WorkerPinPayload {
  type: 'PIN_NODE';
  id: number;
  fx: number;
  fy: number;
  fz: number;
}

export interface WorkerUnpinPayload {
  type: 'UNPIN_NODE';
  id: number;
}

export interface WorkerRecyclePayload {
  type: 'RECYCLE_BUFFER';
  buffer: Float32Array;
}

export type TopologyLayout = 'clusters' | 'spherical' | 'radial' | 'organic';

export interface WorkerTopologyPayload {
  type: 'SET_TOPOLOGY';
  layout: TopologyLayout;
}

export type WorkerInMessage = 
  | WorkerInitPayload 
  | WorkerReheatPayload 
  | WorkerStopPayload 
  | WorkerPinPayload 
  | WorkerUnpinPayload
  | WorkerRecyclePayload
  | WorkerTopologyPayload;

const ctx: any = self;

let simulation: any = null;
let currentNodes: WorkerNode[] = [];
let isRunning = false;
let tickTimer: any = null;

let recycledBuffers: Float32Array[] = [];
let currentLayout: TopologyLayout = 'clusters';
let currentLinks: Array<{ source: number; target: number; distance: number; weight?: number; type?: string }> = [];

/** Centroides 3D estelares por categoría (islas de constelación). */
const CATEGORY_CENTERS: Record<string, [number, number, number]> = {
  Arquitectura: [140, 70, -40],   // Cian Neón #06b6d4
  Física: [-140, 110, 60],        // Violeta Cuántico #a855f7
  Protocolo: [130, -100, -70],    // Fuego Ámbar #f97316
  Datos: [-120, -130, 90],        // Rosa Neón #ec4899
  Red: [0, 160, -110],            // Verde Esmeralda #10b981
  Memoria: [0, -160, 100],        // Azul Cobalto #3b82f6
  IA: [150, 30, 130],             // Amarillo Eléctrico #facc15
  Cuántico: [-150, -30, -130],    // Cian Puro #00f0ff
};

const VALID_LAYOUTS: TopologyLayout[] = ['clusters', 'spherical', 'radial', 'organic'];

function normalizeLayout(layout: unknown): TopologyLayout {
  if (layout === 'clustered') return 'clusters';
  if (typeof layout === 'string' && VALID_LAYOUTS.includes(layout as TopologyLayout)) {
    return layout as TopologyLayout;
  }
  return currentLayout;
}

function nodeDegree(d: WorkerNode): number {
  return d.degree ?? 0;
}

function isHubNode(d: WorkerNode): boolean {
  return nodeDegree(d) > 5 || d.type === 'relay';
}

function categoryCenter(d: WorkerNode): [number, number, number] {
  return CATEGORY_CENTERS[d.category || ''] ?? [0, 0, 0];
}

/** Fuerza hacia una cáscara esférica; radio proporcional al grado. */
function forceSphericalShell() {
  let nodes: WorkerNode[] = [];
  const force = (alpha: number) => {
    for (let i = 0; i < nodes.length; i++) {
      const d = nodes[i];
      const targetR = 72 + Math.min(nodeDegree(d), 28) * 5.5;
      let { x, y, z } = d;
      let r = Math.hypot(x, y, z);
      if (r < 1e-6) {
        x = (Math.random() - 0.5) * 2;
        y = (Math.random() - 0.5) * 2;
        z = (Math.random() - 0.5) * 2;
        r = Math.hypot(x, y, z) || 1;
        d.x = x;
        d.y = y;
        d.z = z;
      }
      const k = ((targetR - r) / r) * 0.48 * alpha;
      d.vx = (d.vx || 0) + x * k;
      d.vy = (d.vy || 0) + y * k;
      d.vz = (d.vz || 0) + z * k;
    }
  };
  (force as any).initialize = (n: WorkerNode[]) => {
    nodes = n;
  };
  return force;
}

/** Hubs en el núcleo; notas en abanicos concéntricos según categoría. */
function forceRadialFans() {
  let nodes: WorkerNode[] = [];
  const force = (alpha: number) => {
    for (let i = 0; i < nodes.length; i++) {
      const d = nodes[i];
      if (isHubNode(d)) {
        const k = 0.55 * alpha;
        d.vx = (d.vx || 0) - d.x * k;
        d.vy = (d.vy || 0) - d.y * k;
        d.vz = (d.vz || 0) - d.z * k;
        continue;
      }

      const [cx, cy, cz] = categoryCenter(d);
      const mag = Math.hypot(cx, cy, cz) || 1;
      const fan = ((d.id * 17) % 100) / 100;
      const ring = 88 + (5 - Math.min(nodeDegree(d), 5)) * 16;
      const swirl = fan * 0.55;
      const tx = (cx / mag) * ring + cy * swirl * 0.12;
      const ty = (cy / mag) * ring + cz * swirl * 0.12;
      const tz = (cz / mag) * ring + cx * swirl * 0.12;
      const pull = 0.32 * alpha;
      d.vx = (d.vx || 0) + (tx - d.x) * pull;
      d.vy = (d.vy || 0) + (ty - d.y) * pull;
      d.vz = (d.vz || 0) + (tz - d.z) * pull;
    }
  };
  (force as any).initialize = (n: WorkerNode[]) => {
    nodes = n;
  };
  return force;
}

function clearLayoutForces() {
  if (!simulation) return;
  simulation
    .force('clusterX', null)
    .force('clusterY', null)
    .force('clusterZ', null)
    .force('shell', null)
    .force('radialFans', null);
}

function applyTopology(layout: TopologyLayout, reheat = true) {
  if (!simulation) return;
  currentLayout = layout;

  const charge = simulation.force('charge');
  const link = simulation.force('link');
  clearLayoutForces();

  if (layout === 'clusters') {
    if (charge) {
      charge
        .strength((d: WorkerNode) => (d.type === 'relay' ? -110 : -70))
        .distanceMax(140);
    }
    if (link) {
      link.distance((l: any) => l.distance || 40).strength(0.45);
    }
    simulation
      .force('center', forceCenter(0, 0, 0).strength(0.04))
      .force('clusterX', forceX((d: WorkerNode) => categoryCenter(d)[0]).strength(0.35))
      .force('clusterY', forceY((d: WorkerNode) => categoryCenter(d)[1]).strength(0.35))
      .force('clusterZ', forceZ((d: WorkerNode) => categoryCenter(d)[2]).strength(0.35));
  } else if (layout === 'spherical') {
    if (charge) {
      charge.strength(-90).distanceMax(160);
    }
    if (link) {
      link.distance((l: any) => l.distance || 28).strength(0.22);
    }
    simulation
      .force('center', forceCenter(0, 0, 0).strength(0.12))
      .force('shell', forceSphericalShell());
  } else if (layout === 'radial') {
    if (charge) {
      charge
        .strength((d: WorkerNode) => (isHubNode(d) ? -40 : -85))
        .distanceMax(150);
    }
    if (link) {
      link.distance((l: any) => (l.type === 'tag' ? 48 : 36)).strength(0.38);
    }
    simulation
      .force('center', forceCenter(0, 0, 0).strength(0.08))
      .force('radialFans', forceRadialFans());
  } else {
    if (charge) {
      charge.strength(-180).distanceMax(220);
    }
    if (link) {
      link.distance(60).strength(0.22);
    }
    simulation.force('center', forceCenter(0, 0, 0).strength(0.015));
  }

  if (reheat) {
    simulation.alpha(0.65).restart();
  }
}

function stopCurrentSimulation() {
  isRunning = false;
  if (tickTimer) {
    clearTimeout(tickTimer);
    tickTimer = null;
  }
  if (simulation) {
    simulation.stop();
  }
}

function packPositions(): Float32Array {
  const count = currentNodes.length;
  const requiredLength = count * 3;
  let buffer: Float32Array;

  if (recycledBuffers.length > 0 && recycledBuffers[0].length === requiredLength) {
    buffer = recycledBuffers.pop()!;
  } else {
    buffer = new Float32Array(requiredLength);
  }

  for (let i = 0; i < count; i++) {
    const node = currentNodes[i];
    const offset = i * 3;
    buffer[offset + 0] = Number.isFinite(node.x) ? node.x : 0;
    buffer[offset + 1] = Number.isFinite(node.y) ? node.y : 0;
    buffer[offset + 2] = Number.isFinite(node.z) ? node.z : 0;
  }

  return buffer;
}

function stepSimulation() {
  if (!isRunning || !simulation) return;

  simulation.tick();
  simulation.tick();

  const alpha = simulation.alpha();
  const buffer = packPositions();

  if (alpha < 0.015) {
    isRunning = false;
    ctx.postMessage(
      {
        type: 'SIMULATION_END',
        positions: buffer,
        alpha
      },
      [buffer.buffer]
    );
  } else {
    ctx.postMessage(
      {
        type: 'TICK',
        positions: buffer,
        alpha
      },
      [buffer.buffer]
    );

    tickTimer = setTimeout(stepSimulation, 16);
  }
}

ctx.onmessage = (event: MessageEvent<WorkerInMessage>) => {
  const data = event.data;
  if (!data || !data.type) return;

  switch (data.type) {
    case 'INIT':
    case 'UPDATE': {
      stopCurrentSimulation();

      const { nodes, links, options } = data;
      currentNodes = nodes.map(n => ({
        id: n.id,
        slug: n.slug,
        type: n.type || 'primary',
        category: n.category || 'Arquitectura',
        x: Number.isFinite(n.x) ? n.x : 0,
        y: Number.isFinite(n.y) ? n.y : 0,
        z: Number.isFinite(n.z) ? n.z : 0,
        vx: n.vx,
        vy: n.vy,
        vz: n.vz,
        fx: n.fx !== undefined ? n.fx : undefined,
        fy: n.fy !== undefined ? n.fy : undefined,
        fz: n.fz !== undefined ? n.fz : undefined,
        degree: n.degree
      }));

      currentLinks = links.map(l => ({
        source: l.source,
        target: l.target,
        distance: l.distance || 8.0,
        weight: l.weight || 1.0,
        type: l.type
      }));

      const degreeMap = new Map<number, number>();
      for (let i = 0; i < currentLinks.length; i++) {
        const l = currentLinks[i];
        degreeMap.set(l.source, (degreeMap.get(l.source) || 0) + 1);
        degreeMap.set(l.target, (degreeMap.get(l.target) || 0) + 1);
      }
      for (let i = 0; i < currentNodes.length; i++) {
        const n = currentNodes[i];
        if (n.degree === undefined) {
          n.degree = degreeMap.get(n.id) || 0;
        }
      }

      simulation = forceSimulation(currentNodes, 3)
        .force(
          'charge',
          forceManyBody()
            .strength((d: WorkerNode) => (d.type === 'relay' ? -100 : -60))
            .distanceMax(65)
        )
        .force(
          'link',
          forceLink(currentLinks)
            .id((d: any) => d.id)
            .distance((l: any) => l.distance || 8.0)
            .strength(0.45)
        )
        .force('center', forceCenter(0, 0, 0))
        .stop();

      applyTopology(normalizeLayout(options?.layout), false);

      const startAlpha = options?.alpha !== undefined ? options.alpha : (data.type === 'UPDATE' ? 0.35 : 1.0);
      simulation.alpha(startAlpha);

      const warmup = options?.warmupTicks !== undefined ? options.warmupTicks : (data.type === 'UPDATE' ? 15 : 45);
      for (let w = 0; w < warmup; ++w) {
        simulation.tick();
      }

      const initialBuffer = packPositions();
      ctx.postMessage(
        {
          type: 'WARMUP_DONE',
          positions: initialBuffer,
          alpha: simulation.alpha()
        },
        [initialBuffer.buffer]
      );

      if (simulation.alpha() >= 0.015) {
        isRunning = true;
        stepSimulation();
      } else {
        const finalBuffer = packPositions();
        ctx.postMessage(
          {
            type: 'SIMULATION_END',
            positions: finalBuffer,
            alpha: simulation.alpha()
          },
          [finalBuffer.buffer]
        );
      }
      break;
    }

    case 'SET_TOPOLOGY': {
      applyTopology(normalizeLayout(data.layout), true);
      if (simulation && !isRunning) {
        isRunning = true;
        stepSimulation();
      }
      break;
    }

    case 'REHEAT': {
      if (simulation) {
        simulation.alpha(data.alpha || 0.3).restart();
        if (!isRunning) {
          isRunning = true;
          stepSimulation();
        }
      }
      break;
    }

    case 'PIN_NODE': {
      const { id, fx, fy, fz } = data;
      const target = currentNodes.find(n => n.id === id);
      if (target) {
        target.fx = fx;
        target.fy = fy;
        target.fz = fz;
        target.x = fx;
        target.y = fy;
        target.z = fz;
        target.vx = 0;
        target.vy = 0;
        target.vz = 0;
      }
      if (simulation) {
        simulation.alpha(0.25).restart();
        if (!isRunning) {
          isRunning = true;
          stepSimulation();
        }
      }
      break;
    }

    case 'UNPIN_NODE': {
      const { id } = data;
      const target = currentNodes.find(n => n.id === id);
      if (target) {
        target.fx = null;
        target.fy = null;
        target.fz = null;
      }
      if (simulation) {
        simulation.alpha(0.2).restart();
        if (!isRunning) {
          isRunning = true;
          stepSimulation();
        }
      }
      break;
    }

    case 'STOP': {
      stopCurrentSimulation();
      break;
    }

    case 'RECYCLE_BUFFER': {
      if (data.buffer && recycledBuffers.length < 5) {
        recycledBuffers.push(data.buffer);
      }
      break;
    }
  }
};