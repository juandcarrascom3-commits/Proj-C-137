import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useThree, useFrame } from '@react-three/fiber';
import { Graph3DNode, Graph3DLink } from '../../utils/graphParser';

export interface CameraControllerProps {
  nodes: Graph3DNode[];
  links: Graph3DLink[];
  selectedId: number | null;
  controlsRef: React.RefObject<any>;
  inspectorOpen: boolean;
  dofRef: React.RefObject<any>;
}

export function CameraController({
  nodes,
  selectedId,
  controlsRef,
  inspectorOpen,
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
          targetX = nx + 10;
        } else {
          targetY = ny + 8;
        }
      }

      // 4. Zoom adaptativo basado en densidad/radio del clúster local
      // Aquí simplificamos asumiendo un radio base, o se podría calcular según los vecinos.
      const clusterRadius = 8;
      const calcDist = Math.max(30, clusterRadius * 2.2);

      desiredTarget.current.set(targetX, targetY, nz);
      desiredCamPos.current.set(targetX, targetY, nz + calcDist);
    }
  }, [selectedId, nodes, inspectorOpen]);

  useFrame(() => {
    if (!controlsRef.current) return;
    const LERP = 0.05; // Factor de suavizado constante

    // Interpolación suave de posición y target
    controlsRef.current.target.lerp(desiredTarget.current, LERP);
    camera.position.lerp(desiredCamPos.current, LERP);
    controlsRef.current.update();

    // 5. DoF dinámico
    if (dofRef.current && selectedId !== null) {
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
