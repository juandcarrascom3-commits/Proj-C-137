import React, { useRef, useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { Graph3DNode } from '../../utils/graphParser';
import { GraphTheme, THEME_CONFIG } from '../C137GraphView';

export interface NodeMeshProps {
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

export function NodeMesh({
  nodes,
  hoveredId,
  selectedId,
  activeNeighbors,
  onHover,
  onSelect,
  bloomBoost,
  theme,
  activeCategory
}: NodeMeshProps) {
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
