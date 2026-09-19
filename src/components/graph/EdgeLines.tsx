import React, { useRef, useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { Graph3DNode, Graph3DLink } from '../../utils/graphParser';
import { GraphTheme, THEME_CONFIG } from '../C137GraphView';

export interface EdgeLinesProps {
  nodes: Graph3DNode[];
  links: Graph3DLink[];
  hoveredId: number | null;
  selectedId: number | null;
  theme: GraphTheme;
  activeCategory: string | null;
}

export function EdgeLines({ nodes, links, hoveredId, selectedId, theme, activeCategory }: EdgeLinesProps) {
  const geomRef = useRef<THREE.BufferGeometry>(null);
  const matRef = useRef<THREE.LineBasicMaterial>(null);
  const themeCfg = THEME_CONFIG[theme];

  const { positions, baseColors } = useMemo(() => {
    const pos = new Float32Array(links.length * 6);
    const col = new Float32Array(links.length * 6);

    const cPrimary = new THREE.Color(themeCfg.primaryHex);
    const cRelay = new THREE.Color(themeCfg.relayHex);

    links.forEach((link, idx) => {
      // Si d3-force-3d ya expandió link.source / link.target a objetos de nodo
      const srcNode: Graph3DNode | undefined = typeof link.source === 'object' 
        ? (link.source as any) 
        : nodes[link.source];
      const tgtNode: Graph3DNode | undefined = typeof link.target === 'object' 
        ? (link.target as any) 
        : nodes[link.target];

      const offset = idx * 6;

      const sx = srcNode && Number.isFinite(srcNode.x) ? srcNode.x : 0;
      const sy = srcNode && Number.isFinite(srcNode.y) ? srcNode.y : 0;
      const sz = srcNode && Number.isFinite(srcNode.z) ? srcNode.z : 0;

      const tx = tgtNode && Number.isFinite(tgtNode.x) ? tgtNode.x : 0;
      const ty = tgtNode && Number.isFinite(tgtNode.y) ? tgtNode.y : 0;
      const tz = tgtNode && Number.isFinite(tgtNode.z) ? tgtNode.z : 0;

      pos[offset + 0] = sx;
      pos[offset + 1] = sy;
      pos[offset + 2] = sz;

      pos[offset + 3] = tx;
      pos[offset + 4] = ty;
      pos[offset + 5] = tz;

      const col1 = srcNode && srcNode.type === 'primary' ? cPrimary : cRelay;
      const col2 = tgtNode && tgtNode.type === 'primary' ? cPrimary : cRelay;

      col[offset + 0] = col1.r * 1.5;
      col[offset + 1] = col1.g * 1.5;
      col[offset + 2] = col1.b * 1.5;

      col[offset + 3] = col2.r * 1.5;
      col[offset + 4] = col2.g * 1.5;
      col[offset + 5] = col2.b * 1.5;
    });

    return { positions: pos, baseColors: col };
  }, [nodes, links, themeCfg]);

  useEffect(() => {
    if (!geomRef.current) return;
    const colorAttr = geomRef.current.getAttribute('color') as THREE.BufferAttribute;
    if (!colorAttr) return;

    const arr = colorAttr.array as Float32Array;

    links.forEach((link, idx) => {
      const srcId = typeof link.source === 'object' ? (link.source as any).id : link.source;
      const tgtId = typeof link.target === 'object' ? (link.target as any).id : link.target;
      const srcNode = nodes[srcId];
      const tgtNode = nodes[tgtId];
      const offset = idx * 6;

      const isHoveredConnection = hoveredId !== null && (srcId === hoveredId || tgtId === hoveredId);
      const isSelectedConnection = selectedId !== null && (srcId === selectedId || tgtId === selectedId);

      // Aislamiento por categoría: si NINGUNO de los extremos pertenece a la categoría activa, atenuamos
      let isFilteredOut = false;
      if (activeCategory) {
        const srcCat = srcNode?.category || (srcNode?.type === 'primary' ? 'Notas' : 'Hubs');
        const tgtCat = tgtNode?.category || (tgtNode?.type === 'primary' ? 'Notas' : 'Hubs');
        if (srcCat !== activeCategory && tgtCat !== activeCategory) {
          isFilteredOut = true;
        }
      }

      if (isFilteredOut) {
        arr[offset + 0] = baseColors[offset + 0] * 0.15;
        arr[offset + 1] = baseColors[offset + 1] * 0.15;
        arr[offset + 2] = baseColors[offset + 2] * 0.15;
        arr[offset + 3] = baseColors[offset + 3] * 0.15;
        arr[offset + 4] = baseColors[offset + 4] * 0.15;
        arr[offset + 5] = baseColors[offset + 5] * 0.15;
      } else {
        if (hoveredId !== null) {
          if (isHoveredConnection) {
            arr[offset + 0] = 0.0; arr[offset + 1] = 1.0; arr[offset + 2] = 1.0;
            arr[offset + 3] = 0.0; arr[offset + 4] = 1.0; arr[offset + 5] = 1.0;
          } else {
            arr[offset + 0] = baseColors[offset + 0] * 0.07;
            arr[offset + 1] = baseColors[offset + 1] * 0.07;
            arr[offset + 2] = baseColors[offset + 2] * 0.07;
            arr[offset + 3] = baseColors[offset + 3] * 0.07;
            arr[offset + 4] = baseColors[offset + 4] * 0.07;
            arr[offset + 5] = baseColors[offset + 5] * 0.07;
          }
        } else if (selectedId !== null) {
          if (isSelectedConnection) {
            arr[offset + 0] = 1.0; arr[offset + 1] = 0.95; arr[offset + 2] = 0.4;
            arr[offset + 3] = 0.0; arr[offset + 4] = 1.0; arr[offset + 5] = 1.0;
          } else {
            arr[offset + 0] = baseColors[offset + 0] * 0.07;
            arr[offset + 1] = baseColors[offset + 1] * 0.07;
            arr[offset + 2] = baseColors[offset + 2] * 0.07;
            arr[offset + 3] = baseColors[offset + 3] * 0.07;
            arr[offset + 4] = baseColors[offset + 4] * 0.07;
            arr[offset + 5] = baseColors[offset + 5] * 0.07;
          }
        } else {
          arr[offset + 0] = baseColors[offset + 0];
          arr[offset + 1] = baseColors[offset + 1];
          arr[offset + 2] = baseColors[offset + 2];
          arr[offset + 3] = baseColors[offset + 3];
          arr[offset + 4] = baseColors[offset + 4];
          arr[offset + 5] = baseColors[offset + 5];
        }
      }
    });

    colorAttr.needsUpdate = true;
  }, [hoveredId, selectedId, baseColors, links, nodes, activeCategory]);

  // Recalcular el radio de la esfera delimitadora tras asignar posiciones válidas
  useEffect(() => {
    if (geomRef.current && geomRef.current.attributes.position) {
      geomRef.current.computeBoundingSphere();
    }
  }, [positions]);

  // Limpieza WebGL al desmontar
  useEffect(() => {
    return () => {
      if (geomRef.current) {
        geomRef.current.dispose();
      }
      if (matRef.current) {
        matRef.current.dispose();
      }
    };
  }, []);

  return (
    <lineSegments>
      <bufferGeometry ref={geomRef}>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[baseColors, 3]} />
      </bufferGeometry>
      <lineBasicMaterial
        ref={matRef}
        vertexColors
        transparent
        opacity={0.45}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </lineSegments>
  );
}
