import React, { useRef, useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { useThree, useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { Graph3DNode, GraphTheme, THEME_CONFIG } from './types';
import { getCategoryColorThree, AESTHETIC_THEMES } from '../../utils/visualStyles';
import { useUIStore } from '../../store/useUIStore';

export interface NodeMeshProps {
  nodes: Graph3DNode[];
  hoveredId: number | null;
  selectedId: number | null;
  activeNeighbors: Set<number>;
  onHover: (id: number | null) => void;
  onSelect: (id: number) => void;
  bloomBoost: boolean;
  theme: GraphTheme;
  activeCategory?: string | null;
  showLabels?: boolean;
  matchingNodeIds?: Set<number>;
  controlsRef?: React.RefObject<any>;
  onNodeDrag?: (id: number, pos: { x: number; y: number; z: number }) => void;
  onNodePin?: (id: number, pos: { x: number; y: number; z: number }) => void;
}

interface FloatingNodeLabelProps {
  node: Graph3DNode;
  isHovered: boolean;
  isSelected: boolean;
  isSearchMatch: boolean;
  isHub: boolean;
  theme: GraphTheme;
}

function FloatingNodeLabel({
  node,
  isHovered,
  isSelected,
  isSearchMatch,
  isHub,
}: FloatingNodeLabelProps) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(({ camera }) => {
    if (!groupRef.current) return;
    if (isHovered || isSelected || isSearchMatch) {
      groupRef.current.visible = true;
      return;
    }
    if (isHub) {
      const dist = camera.position.distanceTo(
        new THREE.Vector3(node.x, node.y, node.z)
      );
      groupRef.current.visible = dist < 42;
    } else {
      groupRef.current.visible = false;
    }
  });

  const posY = (Number.isFinite(node.y) ? node.y : 0) + (node.baseScale || 0.35) + 0.15;
  const posX = Number.isFinite(node.x) ? node.x : 0;
  const posZ = Number.isFinite(node.z) ? node.z : 0;

  const labelColorClass = isHovered
    ? 'text-cyan-300'
    : isSelected
    ? 'text-purple-400'
    : isSearchMatch
    ? 'text-cyan-400'
    : 'text-slate-200';

  const borderColorClass = isHovered
    ? 'border-cyan-400/50 shadow-[0_0_12px_rgba(0,240,255,0.4)]'
    : isSelected
    ? 'border-purple-500/50 shadow-[0_0_12px_rgba(192,132,252,0.4)]'
    : isSearchMatch
    ? 'border-cyan-400/40 shadow-[0_0_10px_rgba(0,240,255,0.3)]'
    : 'border-white/10';

  const scale = (isHovered || isSelected || isSearchMatch) ? 1.0 : 0.85;

  return (
    <group ref={groupRef} position={[posX, posY, posZ]}>
      <Html
        center
        zIndexRange={[100, 0]}
        distanceFactor={15}
        style={{
          transition: 'all 0.2s',
          opacity: groupRef.current?.visible ? 1 : 0,
          transform: `scale(${scale})`
        }}
        className={`pointer-events-none px-2 py-1 rounded-md bg-gray-950/60 backdrop-blur-md border ${borderColorClass} ${labelColorClass} font-mono text-[10px] whitespace-nowrap`}
      >
        {node.name}
      </Html>
    </group>
  );
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
  activeCategory = null,
  showLabels = true,
  matchingNodeIds,
  controlsRef,
  onNodeDrag,
  onNodePin
}: NodeMeshProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const { camera } = useThree();

  // Escuchamos AMBOS estados desde Zustand
  const visualStyle = useUIStore((state) => state.visualStyle);
  const aestheticTheme = useUIStore((state) => state.aestheticTheme);

  // Estados de arrastre 3D
  const isDraggingRef = useRef(false);
  const dragIdRef = useRef<number | null>(null);
  const dragPlaneRef = useRef(new THREE.Plane());
  const dragPlaneIntersectRef = useRef(new THREE.Vector3());
  const dragStartPosRef = useRef(new THREE.Vector3());
  const hasMovedSignificantlyRef = useRef(false);

  // Listener de pointerup global
  useEffect(() => {
    const onGlobalUp = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        dragIdRef.current = null;
        if (controlsRef?.current) {
          controlsRef.current.enabled = true;
        }
      }
    };
    window.addEventListener('pointerup', onGlobalUp);
    return () => window.removeEventListener('pointerup', onGlobalUp);
  }, [controlsRef]);

  // Se re-ejecuta automáticamente cuando cambia 'aestheticTheme' o 'visualStyle'
  useEffect(() => {
    if (!meshRef.current) return;
    const mesh = meshRef.current;
    const dummy = new THREE.Object3D();

    const hoveredNode = hoveredId !== null ? nodes[hoveredId] : null;
    const selectedNode = selectedId !== null ? nodes[selectedId] : null;
    const hasSearchFilter = Boolean(matchingNodeIds && matchingNodeIds.size > 0);

    // Obtener paleta del tema estético activo
    const currentThemeConfig = AESTHETIC_THEMES[aestheticTheme] || AESTHETIC_THEMES.cyberpunk;

    nodes.forEach((node, i) => {
      const nx = Number.isFinite(node.x) ? node.x : 0;
      const ny = Number.isFinite(node.y) ? node.y : 0;
      const nz = Number.isFinite(node.z) ? node.z : 0;
      dummy.position.set(nx, ny, nz);

      const isHoveredTarget = i === hoveredId;
      const isHoveredNeighbor = hoveredId !== null && Boolean(hoveredNode?.connections?.includes(i));
      const isSelectedTarget = i === selectedId;
      const isSelectedNeighbor = selectedId !== null && Boolean(selectedNode?.connections?.includes(i));
      const isSearchMatch = hasSearchFilter && Boolean(matchingNodeIds?.has(i));
      const currentThemeConfig = AESTHETIC_THEMES[aestheticTheme] || AESTHETIC_THEMES.neural_synapse;
    
      // --- COLOR DINÁMICO POR TEMA ESTÉTICO Y MODO ---
      let baseColor: THREE.Color;

      if (visualStyle === 'minimal') {
        const hex = currentThemeConfig.palette['General'] || '#64748b';
        baseColor = new THREE.Color(hex);
      } else {
        const catName = node.category || (node.type === 'primary' ? 'Arquitectura' : 'Tag Hub');
        baseColor = getCategoryColorThree(catName, aestheticTheme);
      }

      let scaleMult = 1.0;
      let chosenColor = baseColor.clone();

      if (hasSearchFilter) {
        if (isSearchMatch) {
          scaleMult = 1.25;
          chosenColor = new THREE.Color(currentThemeConfig.defaultNodeColor);
        } else {
          scaleMult = 0.5;
          chosenColor = chosenColor.multiplyScalar(0.2);
        }
      } else if (hoveredId !== null) {
        if (isHoveredTarget) {
          scaleMult = 1.25;
          chosenColor = new THREE.Color('#ffffff');
        } else if (isHoveredNeighbor) {
          scaleMult = 1.15;
          chosenColor = new THREE.Color(currentThemeConfig.hubNodeColor);
        } else {
          scaleMult = 0.65;
          chosenColor = chosenColor.multiplyScalar(0.25);
        }
      } else if (selectedId !== null) {
        if (isSelectedTarget) {
          scaleMult = 1.25;
          chosenColor = new THREE.Color('#ffffff');
        } else if (isSelectedNeighbor) {
          scaleMult = 1.15;
          chosenColor = new THREE.Color(currentThemeConfig.hubNodeColor);
        } else {
          scaleMult = 0.65;
          chosenColor = chosenColor.multiplyScalar(0.25);
        }
      } else {
        chosenColor.multiplyScalar(bloomBoost ? currentThemeConfig.glowBoost * 1.3 : currentThemeConfig.glowBoost);
      }

      if (activeCategory) {
        const nodeCat = node.category || (node.type === 'primary' ? 'Notas' : 'Hubs');
        if (nodeCat !== activeCategory) {
          scaleMult *= 0.35;
          chosenColor = chosenColor.multiplyScalar(0.15);
        }
      }

      const finalScale = (node.baseScale || 0.35) * scaleMult;
      dummy.scale.set(finalScale, finalScale, finalScale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, chosenColor);
    });

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
  }, [
    nodes, 
    hoveredId, 
    selectedId, 
    activeNeighbors, 
    activeCategory, 
    matchingNodeIds, 
    bloomBoost, 
    visualStyle, 
    aestheticTheme
  ]);

  // Limpieza de memoria WebGL
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

  const candidateLabelNodes = useMemo(() => {
    if (!showLabels) return [];
    return nodes.filter((node, idx) => {
      const isHovered = idx === hoveredId;
      const isSelected = idx === selectedId;
      const isSearchMatch = matchingNodeIds ? matchingNodeIds.has(idx) : false;
      const isHub = (node.connections && node.connections.length > 5) || (node.degree && node.degree > 5);
      return isHovered || isSelected || isSearchMatch || isHub;
    });
  }, [nodes, hoveredId, selectedId, matchingNodeIds, showLabels]);

  return (
    <group>
      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, nodes.length]}
        frustumCulled={false}
        onPointerOver={(e) => {
          e.stopPropagation();
          if (!isDraggingRef.current && e.instanceId !== undefined && e.instanceId < nodes.length) {
            onHover(e.instanceId);
            document.body.style.cursor = 'grab';
          }
        }}
        onPointerOut={() => {
          if (!isDraggingRef.current) {
            onHover(null);
            document.body.style.cursor = 'default';
          }
        }}
        onPointerDown={(e) => {
          if (e.instanceId === undefined || e.instanceId >= nodes.length) return;
          e.stopPropagation();
          const id = e.instanceId;
          const node = nodes[id];
          if (!node) return;

          isDraggingRef.current = true;
          dragIdRef.current = id;
          hasMovedSignificantlyRef.current = false;
          dragStartPosRef.current.set(node.x, node.y, node.z);
          document.body.style.cursor = 'grabbing';

          if (controlsRef?.current) {
            controlsRef.current.enabled = false;
          }

          const cameraDir = camera.getWorldDirection(new THREE.Vector3());
          dragPlaneRef.current.setFromNormalAndCoplanarPoint(
            cameraDir.negate(),
            new THREE.Vector3(node.x, node.y, node.z)
          );

          (e.target as HTMLElement)?.setPointerCapture?.(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!isDraggingRef.current || dragIdRef.current === null) return;
          e.stopPropagation();

          const id = dragIdRef.current;
          const node = nodes[id];
          if (!node) return;

          if (e.ray.intersectPlane(dragPlaneRef.current, dragPlaneIntersectRef.current)) {
            const pt = dragPlaneIntersectRef.current;
            if (dragStartPosRef.current.distanceTo(pt) > 0.15) {
              hasMovedSignificantlyRef.current = true;
            }

            node.x = pt.x;
            node.y = pt.y;
            node.z = pt.z;

            const dummy = new THREE.Object3D();
            dummy.position.copy(pt);
            const scale = (node.baseScale || 0.35) * 1.25;
            dummy.scale.set(scale, scale, scale);
            dummy.updateMatrix();

            if (meshRef.current) {
              meshRef.current.setMatrixAt(id, dummy.matrix);
              meshRef.current.instanceMatrix.needsUpdate = true;
            }

            if (onNodeDrag) {
              onNodeDrag(id, { x: pt.x, y: pt.y, z: pt.z });
            }
          }
        }}
        onPointerUp={(e) => {
          if (!isDraggingRef.current) return;
          e.stopPropagation();

          const id = dragIdRef.current;
          isDraggingRef.current = false;
          dragIdRef.current = null;
          document.body.style.cursor = 'pointer';

          if (controlsRef?.current) {
            controlsRef.current.enabled = true;
          }

          (e.target as HTMLElement)?.releasePointerCapture?.(e.pointerId);

          if (id !== null && nodes[id]) {
            const node = nodes[id];
            if (hasMovedSignificantlyRef.current) {
              if (onNodePin) {
                onNodePin(id, { x: node.x, y: node.y, z: node.z });
              }
            } else {
              onSelect(id);
            }
          }
        }}
      >
        <icosahedronGeometry args={[1, 1]} />
        <meshBasicMaterial toneMapped={false} transparent opacity={0.95} />
      </instancedMesh>

      {candidateLabelNodes.map((node) => {
        const isHovered = node.id === hoveredId;
        const isSelected = node.id === selectedId;
        const isSearchMatch = matchingNodeIds ? matchingNodeIds.has(node.id) : false;
        const isHub = Boolean((node.connections && node.connections.length > 5) || (node.degree && node.degree > 5));

        return (
          <FloatingNodeLabel
            key={`label-${node.id}-${node.slug}`}
            node={node}
            isHovered={isHovered}
            isSelected={isSelected}
            isSearchMatch={isSearchMatch}
            isHub={isHub}
            theme={theme}
          />
        );
      })}
    </group>
  );
}