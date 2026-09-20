import { 
  forceSimulation, 
  forceManyBody, 
  forceLink, 
  forceCenter,
  forceRadial,
  forceX,
  forceY,
  forceZ
} from 'd3-force-3d';

/**
 * =======================================================================
 * WEB WORKER DE FÍSICAS 3D (d3-force-3d Offloading + Topologías)
 * =======================================================================
 * Ejecuta la simulación de fuerzas espaciales fuera del hilo principal de UI.
 * Envía exclusivamente buffers Float32Array transferibles ([x, y, z] por nodo)
 * para garantizar 60 FPS estables sin bloqueos incluso con >300 nodos.
 */

export interface WorkerNode {
  id: number;
  slug: string;
  type?: 'primary' | 'relay';
  cluster?: number;
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

export type TopologyLayoutMode = 'organic' | 'spherical' | 'clustered';

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
    layout?: TopologyLayoutMode;
  };
}

export interface WorkerSetLayoutPayload {
  type: 'SET_LAYOUT';
  layout: TopologyLayoutMode;
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
  | WorkerSetLayoutPayload
  | WorkerReheatPayload 
  | WorkerStopPayload 
  | WorkerPinPayload 
  | WorkerUnpinPayload
  | WorkerRecyclePayload;

// Declaración de contexto de Worker para tipado flexible en Web Worker
const ctx: any = self;

let simulation: any = null;
let currentNodes: WorkerNode[] = [];
let currentWorkerLinks: WorkerLink[] = [];
let currentLayout: TopologyLayoutMode = 'organic';
let isRunning = false;
let tickTimer: any = null;

let recycledBuffers: Float32Array[] = [];

// Centroides precalculados para la Topología de Cúmulos (Galaxias 3D)
const CLUSTER_CENTERS = [
  [0, 0, 0],
  [-22, 14, -12],
  [22, -12, 14],
  [-14, -18, 16],
  [16, 20, -14],
  [0, 22, 18]
];

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

/**
 * Aplica las fuerzas espaciales correspondientes según la topología activa
 */
function applyLayoutForces(layout: TopologyLayoutMode) {
  if (!simulation) return;

  if (layout === 'spherical') {
    // TOPOLOGÍA ESFÉRICA: Atractor hacia un cascarón esférico uniforme
    simulation
      .force(
        'charge',
        forceManyBody().strength(-35).distanceMax(60)
      )
      .force(
        'link',
        forceLink(currentWorkerLinks)
          .id((d: any) => d.id)
          .distance(6.5)
          .strength(0.35)
      )
      .force('center', null)
      .force('r', forceRadial(18, 0, 0, 0).strength(0.85))
      .force('clusterX', null)
      .force('clusterY', null)
      .force('clusterZ', null);
  } else if (layout === 'clustered') {
    // TOPOLOGÍA DE CÚMULOS: Fuerza de atracción espacial por cluster/categoría
    simulation
      .force(
        'charge',
        forceManyBody().strength(-55).distanceMax(55)
      )
      .force(
        'link',
        forceLink(currentWorkerLinks)
          .id((d: any) => d.id)
          .distance(7.5)
          .strength(0.42)
      )
      .force('center', null)
      .force('r', null)
      .force(
        'clusterX',
        forceX((d: any) => {
          const cIdx = typeof d.cluster === 'number' ? Math.abs(d.cluster) % CLUSTER_CENTERS.length : 0;
          return CLUSTER_CENTERS[cIdx][0];
        }).strength(0.65)
      )
      .force(
        'clusterY',
        forceY((d: any) => {
          const cIdx = typeof d.cluster === 'number' ? Math.abs(d.cluster) % CLUSTER_CENTERS.length : 0;
          return CLUSTER_CENTERS[cIdx][1];
        }).strength(0.65)
      )
      .force(
        'clusterZ',
        forceZ((d: any) => {
          const cIdx = typeof d.cluster === 'number' ? Math.abs(d.cluster) % CLUSTER_CENTERS.length : 0;
          return CLUSTER_CENTERS[cIdx][2];
        }).strength(0.65)
      );
  } else {
    // TOPOLOGÍA ORGÁNICA: Fuerza libre clásica
    simulation
      .force(
        'charge',
        forceManyBody()
          .strength((d: any) => (d.type === 'relay' ? -120 : -75))
          .distanceMax(55)
      )
      .force(
        'link',
        forceLink(currentWorkerLinks)
          .id((d: any) => d.id)
          .distance((l: any) => l.distance || 7.5)
          .strength(0.48)
      )
      .force('center', forceCenter(0, 0, 0))
      .force('r', null)
      .force('clusterX', null)
      .force('clusterY', null)
      .force('clusterZ', null);
  }
}

/**
 * Extrae y empaqueta las posiciones actuales [x0, y0, z0, x1, y1, z1, ...]
 * en un Float32Array optimizado para transferencia de memoria de copia cero.
 */
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

/**
 * Bucle asíncrono desacoplado del hilo principal.
 * Emite ticks vía postMessage con Transferable ArrayBuffer.
 */
function stepSimulation() {
  if (!isRunning || !simulation) return;

  // Ejecutamos 2 micro-ticks por ciclo para acelerar convergencia física
  simulation.tick();
  simulation.tick();

  const alpha = simulation.alpha();
  const buffer = packPositions();

  if (alpha < 0.015) {
    // Simulación convergida y estabilizada
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
    // Enviar tick intermedio con transferencia de búfer
    ctx.postMessage(
      {
        type: 'TICK',
        positions: buffer,
        alpha
      },
      [buffer.buffer]
    );

    // Próximo paso a ~60 Hz (16ms)
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
      currentLayout = options?.layout || 'organic';

      currentNodes = nodes.map(n => ({
        id: n.id,
        slug: n.slug,
        type: n.type || 'primary',
        cluster: n.cluster,
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

      // Copia de links limpia para la simulación
      currentWorkerLinks = links.map(l => ({
        source: l.source,
        target: l.target,
        distance: l.distance || 7.5,
        weight: l.weight || 1.0,
        type: l.type
      }));

      // Inicialización de simulación 3D nativa
      simulation = forceSimulation(currentNodes, 3).stop();

      // Aplicar las fuerzas de acuerdo con la topología seleccionada
      applyLayoutForces(currentLayout);

      // Configuración de alpha y decaimiento
      const startAlpha = options?.alpha !== undefined ? options.alpha : (data.type === 'UPDATE' ? 0.35 : 1.0);
      simulation.alpha(startAlpha);

      // Warmup interno en el worker (cálculo síncrono instantáneo fuera del hilo UI)
      const warmup = options?.warmupTicks !== undefined ? options.warmupTicks : (data.type === 'UPDATE' ? 15 : 45);
      for (let w = 0; w < warmup; ++w) {
        simulation.tick();
      }

      // Enviar de inmediato el estado post-warmup
      const initialBuffer = packPositions();
      ctx.postMessage(
        {
          type: 'WARMUP_DONE',
          positions: initialBuffer,
          alpha: simulation.alpha()
        },
        [initialBuffer.buffer]
      );

      // Iniciar bucle dinámico si aún requiere relajación
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

    case 'SET_LAYOUT': {
      currentLayout = data.layout || 'organic';
      if (simulation) {
        applyLayoutForces(currentLayout);
        simulation.alpha(0.55).restart();
        if (!isRunning) {
          isRunning = true;
          stepSimulation();
        }
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
      // Agregar buffer reciclado para evitar GC
      if (data.buffer && recycledBuffers.length < 5) {
        recycledBuffers.push(data.buffer);
      }
      break;
    }
  }
};