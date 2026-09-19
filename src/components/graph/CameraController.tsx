import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useThree, useFrame } from '@react-three/fiber';
import { Graph3DNode, Graph3DLink } from './types';

export interface CameraControllerProps {
  nodes: Graph3DNode[];
  links?: Graph3DLink[];
  selectedId: number | null;
  controlsRef: React.RefObject<any>;
  inspectorOpen?: boolean;
  dofRef?: React.RefObject<any>;
  recenterTrigger?: number;
}

export function CameraController({
  nodes,
  selectedId,
  controlsRef,
  inspectorOpen = false,
  dofRef,
  recenterTrigger = 0
}: CameraControllerProps) {
  const { camera } = useThree();
  const desiredCamPos = useRef(new THREE.Vector3(0, 8, 38));
  const desiredTarget = useRef(new THREE.Vector3(0, 0, 0));

  // Bandera de animación y control de tiempo para animar ÚNICAMENTE UNA VEZ
  const isAnimatingRef = useRef(false);
  const animStartTimeRef = useRef(0);
  const lastSelectedIdRef = useRef<number | null>(null);
  const lastRecenterTriggerRef = useRef(recenterTrigger);

  // 1. Activar animación UNA VEZ al cambiar selectedId
  useEffect(() => {
    if (selectedId !== null && nodes[selectedId]) {
      // Solo iniciar si realmente cambió el id seleccionado o se abrió/cerró el inspector
      if (selectedId !== lastSelectedIdRef.current) {
        lastSelectedIdRef.current = selectedId;
      }

      const node = nodes[selectedId];
      const nx = Number.isFinite(node.x) ? node.x : 0;
      const ny = Number.isFinite(node.y) ? node.y : 0;
      const nz = Number.isFinite(node.z) ? node.z : 0;

      const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
      let targetX = nx;
      let targetY = ny;

      if (inspectorOpen) {
        if (!isMobile) {
          targetX = nx + 7;
        } else {
          targetY = ny + 5;
        }
      }

      const calcDist = 26;
      desiredTarget.current.set(targetX, targetY, nz);
      desiredCamPos.current.set(targetX, targetY, nz + calcDist);

      isAnimatingRef.current = true;
      animStartTimeRef.current = performance.now();
    } else {
      lastSelectedIdRef.current = null;
    }
  }, [selectedId, nodes, inspectorOpen]);

  // 2. Activar animación UNA VEZ al pulsar "Centrar Vista"
  useEffect(() => {
    if (recenterTrigger > 0 && recenterTrigger !== lastRecenterTriggerRef.current) {
      lastRecenterTriggerRef.current = recenterTrigger;
      desiredTarget.current.set(0, 0, 0);
      desiredCamPos.current.set(0, 8, 38);
      isAnimatingRef.current = true;
      animStartTimeRef.current = performance.now();
    }
  }, [recenterTrigger]);

  useFrame(() => {
    if (!controlsRef.current) return;

    // Si la animación está activa: transición suave (.lerp)
    if (isAnimatingRef.current) {
      const elapsed = performance.now() - animStartTimeRef.current;
      const LERP = 0.075;

      controlsRef.current.target.lerp(desiredTarget.current, LERP);
      camera.position.lerp(desiredCamPos.current, LERP);
      controlsRef.current.update();

      const distTarget = controlsRef.current.target.distanceTo(desiredTarget.current);
      const distCam = camera.position.distanceTo(desiredCamPos.current);

      // Una vez alcanzado el objetivo o expirado el tiempo máximo (1.2s), DETENER animación
      if ((distTarget < 0.15 && distCam < 0.25) || elapsed > 1200) {
        controlsRef.current.target.copy(desiredTarget.current);
        controlsRef.current.update();
        isAnimatingRef.current = false; // LIBERA OrbitControls completamente
      }
    }
    // NOTA: Cuando isAnimatingRef.current es false, NO actualizamos controls.target ni camera.position.
    // Esto permite que el usuario orbite, rote, desplace y haga zoom out libremente.

    // 3. DoF dinámico con límites numéricos seguros contra NaN / Infinity
    if (dofRef?.current && selectedId !== null) {
      try {
        const realDist = camera.position.distanceTo(controlsRef.current.target);
        const safeDist = Math.max(0.1, Number.isFinite(realDist) ? realDist : 25);
        const farPlane = Math.max(1, (camera as THREE.PerspectiveCamera).far || 1000);
        const rawFocus = safeDist / farPlane;
        // Limitar dentro de un rango seguro (mínimo 0.1)
        const safeFocusDistance = Math.max(0.1, Number.isFinite(rawFocus) ? Math.min(1.0, rawFocus) : 0.1);

        const coc = dofRef.current.circleOfConfusionMaterial;
        if (coc && coc.uniforms && coc.uniforms.focusDistance) {
          coc.uniforms.focusDistance.value = safeFocusDistance;
        }
      } catch {
        // Fallback silencioso
      }
    }
  });

  return null;
}

