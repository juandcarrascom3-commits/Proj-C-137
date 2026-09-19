import { useEffect, useRef, useState, useCallback } from 'react';
import { Graph3DNode, Graph3DLink } from './types';

export interface ForceWorkerState {
  isSimulating: boolean;
  alpha: number;
  workerSupported: boolean;
}

export interface UseForceWorkerProps {
  onPositionsUpdate: (positions: Float32Array) => void;
  onSimulationEnd?: (positions: Float32Array) => void;
}

/**
 * Hook modular para gestionar el ciclo de vida del Web Worker de físicas 3D (d3-force-3d).
 * Asegura comunicación bidireccional mediante Transferable Float32Array y
 * sincronización con requestAnimationFrame para 60 FPS estables sin saturar el reconciliador de React.
 */
export function useForceWorker({ onPositionsUpdate, onSimulationEnd }: UseForceWorkerProps) {
  const workerRef = useRef<Worker | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const pendingBufferRef = useRef<Float32Array | null>(null);
  const lastProcessedBufferRef = useRef<Float32Array | null>(null);

  const [state, setState] = useState<ForceWorkerState>({
    isSimulating: false,
    alpha: 0,
    workerSupported: typeof Worker !== 'undefined'
  });

  const callbacksRef = useRef({ onPositionsUpdate, onSimulationEnd });
  useEffect(() => {
    callbacksRef.current = { onPositionsUpdate, onSimulationEnd };
  }, [onPositionsUpdate, onSimulationEnd]);

  // Inicializar Worker al montar el componente
  useEffect(() => {
    if (typeof Worker === 'undefined') return;

    try {
      const worker = new Worker(
        new URL('../../workers/force.worker.ts', import.meta.url),
        { type: 'module' }
      );

      worker.onmessage = (event: MessageEvent) => {
        const { type, positions, alpha } = event.data;
        if (!positions) return;

        // Guardar la última posición recibida del Worker
        pendingBufferRef.current = positions;

        if (type === 'WARMUP_DONE') {
          // Aplicación inmediata del warmup para que el primer render sea instantáneo
          callbacksRef.current.onPositionsUpdate(positions);
          // Return buffer to worker
          if (workerRef.current && positions.buffer.byteLength > 0) {
            workerRef.current.postMessage(
              { type: 'RECYCLE_BUFFER', buffer: positions },
              [positions.buffer]
            );
          }
          setState(prev => ({ ...prev, isSimulating: true, alpha }));
        } else if (type === 'TICK') {
          // Sincronizar actualización con el refresco de pantalla vía RAF
          if (rafIdRef.current === null) {
            rafIdRef.current = requestAnimationFrame(() => {
              rafIdRef.current = null;
              if (pendingBufferRef.current) {
                callbacksRef.current.onPositionsUpdate(pendingBufferRef.current);
                
                // Return the PREVIOUS buffer to worker to avoid GC, keeping the current one alive for React's async update
                if (workerRef.current && lastProcessedBufferRef.current && lastProcessedBufferRef.current.buffer.byteLength > 0) {
                  workerRef.current.postMessage(
                    { type: 'RECYCLE_BUFFER', buffer: lastProcessedBufferRef.current },
                    [lastProcessedBufferRef.current.buffer]
                  );
                }
                lastProcessedBufferRef.current = pendingBufferRef.current;
              }
            });
          }
          setState(prev => ({ ...prev, isSimulating: true, alpha }));
        } else if (type === 'SIMULATION_END') {
          if (rafIdRef.current !== null) {
            cancelAnimationFrame(rafIdRef.current);
            rafIdRef.current = null;
          }
          callbacksRef.current.onPositionsUpdate(positions);
          // Return buffer one last time
          if (workerRef.current && positions.buffer.byteLength > 0) {
            workerRef.current.postMessage(
              { type: 'RECYCLE_BUFFER', buffer: positions },
              [positions.buffer]
            );
          }
          if (callbacksRef.current.onSimulationEnd) {
            callbacksRef.current.onSimulationEnd(positions);
          }
          setState(prev => ({ ...prev, isSimulating: false, alpha: 0 }));
        }
      };

      worker.onerror = (err) => {
        console.error('[C137 Force Worker] Error en Web Worker:', err);
        setState(prev => ({ ...prev, isSimulating: false }));
      };

      workerRef.current = worker;
    } catch (err) {
      console.warn('[C137 Force Worker] No se pudo inicializar el Worker nativo:', err);
      setState(prev => ({ ...prev, workerSupported: false }));
    }

    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, []);

  /**
   * Envía la topología al Worker.
   * isUpdate=true utiliza un alpha suave (0.35) y menor warmup para conservar la constelación.
   */
  const dispatchSimulation = useCallback((
    nodes: Graph3DNode[],
    links: Graph3DLink[],
    isUpdate = false
  ) => {
    if (!workerRef.current) return false;

    // Normalizar links: si source/target son objetos, extraer su id numérico
    const normalizedLinks = links.map(l => ({
      source: typeof l.source === 'object' ? (l.source as any).id : l.source,
      target: typeof l.target === 'object' ? (l.target as any).id : l.target,
      distance: l.distance,
      weight: l.weight,
      type: l.type
    }));

    workerRef.current.postMessage({
      type: isUpdate ? 'UPDATE' : 'INIT',
      nodes: nodes.map(n => ({
        id: n.id,
        slug: n.slug,
        type: n.type,
        x: n.x,
        y: n.y,
        z: n.z,
        vx: n.vx,
        vy: n.vy,
        vz: n.vz
      })),
      links: normalizedLinks,
      options: {
        alpha: isUpdate ? 0.35 : 1.0,
        warmupTicks: isUpdate ? 15 : 45
      }
    });

    setState(prev => ({ ...prev, isSimulating: true }));
    return true;
  }, []);

  const reheat = useCallback((alpha = 0.3) => {
    if (workerRef.current) {
      workerRef.current.postMessage({ type: 'REHEAT', alpha });
      setState(prev => ({ ...prev, isSimulating: true }));
    }
  }, []);

  const stop = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.postMessage({ type: 'STOP' });
      setState(prev => ({ ...prev, isSimulating: false, alpha: 0 }));
    }
  }, []);

  const pinNode = useCallback((id: number, coords: { x: number; y: number; z: number }) => {
    if (workerRef.current) {
      workerRef.current.postMessage({
        type: 'PIN_NODE',
        id,
        fx: coords.x,
        fy: coords.y,
        fz: coords.z
      });
      setState(prev => ({ ...prev, isSimulating: true }));
    }
  }, []);

  const unpinNode = useCallback((id: number) => {
    if (workerRef.current) {
      workerRef.current.postMessage({
        type: 'UNPIN_NODE',
        id
      });
      setState(prev => ({ ...prev, isSimulating: true }));
    }
  }, []);

  return {
    dispatchSimulation,
    reheat,
    stop,
    pinNode,
    unpinNode,
    isSimulating: state.isSimulating,
    alpha: state.alpha,
    workerSupported: state.workerSupported
  };
}
