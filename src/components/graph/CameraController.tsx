import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useThree, useFrame } from '@react-three/fiber';
import { Graph3DNode, Graph3DLink } from '../../utils/graphParser';

export interface CameraControllerProps {
  nodes: Graph3DNode[];
  links: Graph3DLink[];
  selectedId: number | null;
  controlsRef: React.RefObject<any>;
  inspectorOpen?: boolean;
  dofRef?: React.RefObject<any>;
}

export function CameraController({
  nodes,
  selectedId,
  controlsRef,
  inspectorOpen = false,
  dofRef
}: CameraControllerProps) {
  const { camera } = useThree();
  const desiredCamPos = useRef(new THREE.Vector3(0, 8, 38));
  const desiredTarget = useRef(new THREE.Vector3(0, 0, 0));

  useEffect(() => {
    if (selectedId !== null && nodes[selectedId]) {
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

      // Zoom adaptativo enfocado en el nodo
      const calcDist = 26;

      desiredTarget.current.set(targetX, targetY, nz);
      desiredCamPos.current.set(targetX, targetY, nz + calcDist);
    }
  }, [selectedId, nodes, inspectorOpen]);

  useFrame(() => {
    if (!controlsRef.current) return;
    const LERP = 0.055; // Factor de suavizado óptimo para 60 FPS

    // Actualizar dinámicamente target si el nodo está en movimiento por simulación física
    if (selectedId !== null && nodes[selectedId]) {
      const node = nodes[selectedId];
      const nx = Number.isFinite(node.x) ? node.x : 0;
      const ny = Number.isFinite(node.y) ? node.y : 0;
      const nz = Number.isFinite(node.z) ? node.z : 0;
      const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
      const targetX = inspectorOpen && !isMobile ? nx + 7 : nx;
      const targetY = inspectorOpen && isMobile ? ny + 5 : ny;
      desiredTarget.current.set(targetX, targetY, nz);
    }

    // Interpolación suave de posición y target
    controlsRef.current.target.lerp(desiredTarget.current, LERP);
    camera.position.lerp(desiredCamPos.current, LERP);
    controlsRef.current.update();

    // 5. DoF dinámico
    if (dofRef?.current && selectedId !== null) {
      const realDist = camera.position.distanceTo(controlsRef.current.target);
      const normalizedFocus = realDist / (camera as THREE.PerspectiveCamera).far;
      try {
        const coc = dofRef.current.circleOfConfusionMaterial;
        if (coc && coc.uniforms && coc.uniforms.focusDistance) {
          coc.uniforms.focusDistance.value = normalizedFocus;
        }
      } catch {
        // Silencioso
      }
    }
  });

  return null;
}
