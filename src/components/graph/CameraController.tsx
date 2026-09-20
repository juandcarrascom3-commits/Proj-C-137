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

  const isAnimatingRef = useRef(false);
  const animStartTimeRef = useRef(0);
  const lastSelectedIdRef = useRef<number | null>(null);
  const lastRecenterTriggerRef = useRef(recenterTrigger);

  // 1. Activar animación al seleccionar un nodo manteniendo la perspectiva actual
  useEffect(() => {
    if (selectedId !== null && nodes[selectedId] && controlsRef.current) {
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
          targetX = nx + 6;
        } else {
          targetY = ny + 4;
        }
      }

      // FIX BUG 4 & 5: Obtener la dirección actual de la cámara para no girar 180° bruscos
      const currentOffset = camera.position.clone().sub(controlsRef.current.target);
      if (currentOffset.length() < 1) currentOffset.set(0, 6, 24);
      else currentOffset.normalize().multiplyScalar(24); // Mantener distancia constante de 24 unidades

      desiredTarget.current.set(targetX, targetY, nz);
      desiredCamPos.current.copy(desiredTarget.current).add(currentOffset);

      isAnimatingRef.current = true;
      animStartTimeRef.current = performance.now();
    } else {
      lastSelectedIdRef.current = null;
    }
  }, [selectedId, nodes, inspectorOpen, camera, controlsRef]);

  // 2. Activar animación al pulsar "Centrar Vista"
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

    if (isAnimatingRef.current) {
      const elapsed = performance.now() - animStartTimeRef.current;
      const LERP = 0.085;

      // PIVOTE REAL (BUG 5): Lerpear el target de OrbitControls al centro del nodo
      controlsRef.current.target.lerp(desiredTarget.current, LERP);
      camera.position.lerp(desiredCamPos.current, LERP);
      controlsRef.current.update();

      const distTarget = controlsRef.current.target.distanceTo(desiredTarget.current);
      const distCam = camera.position.distanceTo(desiredCamPos.current);

      if ((distTarget < 0.1 && distCam < 0.2) || elapsed > 1200) {
        controlsRef.current.target.copy(desiredTarget.current);
        controlsRef.current.update();
        isAnimatingRef.current = false; // Liberar OrbitControls para rotación manual
      }
    }

    // DoF seguro
    if (dofRef?.current && selectedId !== null) {
      try {
        const realDist = camera.position.distanceTo(controlsRef.current.target);
        const safeDist = Math.max(0.1, Number.isFinite(realDist) ? realDist : 25);
        const farPlane = Math.max(1, (camera as THREE.PerspectiveCamera).far || 1000);
        const rawFocus = safeDist / farPlane;
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

export default CameraController;