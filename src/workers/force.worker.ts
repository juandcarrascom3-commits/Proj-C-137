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

export type WorkerInMessage = 
  | WorkerInitPayload 
  | WorkerReheatPayload 
  | WorkerStopPayload 
  | WorkerPinPayload 
  | WorkerUnpinPayload
  | WorkerRecyclePayload;

const ctx: any = self;

let simulation: any = null;
let currentNodes: WorkerNode[] = [];
let isRunning = false;
let tickTimer: any = null;

let recycledBuffers: Float32Array[] = [];

// Centroides espaciales para dividir las categorías en islas / clústeres
const CATEGORY_CENTERS: Record<string, [number, number, number]> = {
  Arquitectura: [100, 70, 0],
  Física: [-100, 90, 50],
  Protocolo: [120, -80, -40],
  Datos: [-90, -100, 70],
  Red: [0, 140, -90],
  Memoria: [0, -130, 80],
};

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
        fz: n.fz !== undefined ? n.fz : undefined
      }));

      const workerLinks = links.map(l => ({
        source: l.source,
        target: l.target,
        distance: l.distance || 8.0,
        weight: l.weight || 1.0,
        type: l.type
      }));

      // Simulación 3D con fuerzas de agrupación por Clústeres (Rompe los diamantes)
      simulation = forceSimulation(currentNodes, 3)
        .force(
          'charge',
          forceManyBody()
            .strength((d: any) => (d.type === 'relay' ? -100 : -60))
            .distanceMax(65)
        )
        .force(
          'link',
          forceLink(workerLinks)
            .id((d: any) => d.id)
            .distance((l: any) => l.distance || 8.0)
            .strength(0.45)
        )
        .force('center', forceCenter(0, 0, 0))
        .force('clusterX', forceX((d: any) => (CATEGORY_CENTERS[d.category]?.[0] ?? 0)).strength(0.28))
        .force('clusterY', forceY((d: any) => (CATEGORY_CENTERS[d.category]?.[1] ?? 0)).strength(0.28))
        .force('clusterZ', forceZ((d: any) => (CATEGORY_CENTERS[d.category]?.[2] ?? 0)).strength(0.28))
        .stop();

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