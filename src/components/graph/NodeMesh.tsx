import React, { useRef, useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { useThree, useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { Graph3DNode, GraphTheme, THEME_CONFIG } from './types';
import { getCategoryColorThree } from '../../utils/visualStyles';
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

/**
 * Sub-componente de Etiqueta Flotante con Level of Detail (LOD).
 * Sigue la orientación de la cámara mediante Billboard.
 * Para hubs (>5 conexiones), usa useFrame para ocultar/mostrar según proximidad de cámara (distancia < 42),
 * evitando ciclos de re-render en React.
 */
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
  theme
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
        distanceFactor={15} // Escala el HTML con la distancia
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
  const themeCfg = THEME_CONFIG[theme];
  const { camera } = useThree();

  // Consumir el modo de estilo visual activo desde Zustand ('neon' | 'category' | 'minimal')
  const visualStyle = useUIStore((state) => state.visualStyle);

  // Estados de arrastre en espacio 3D
  const isDraggingRef = useRef(false);
  const dragIdRef = useRef<number | null>(null);
  const dragPlaneRef = useRef(new THREE.Plane());
  const dragPlaneIntersectRef = useRef(new THREE.Vector3());
  const dragStartPosRef = useRef(new THREE.Vector3());
  const hasMovedSignificantlyRef = useRef(false);

  const colors = useMemo(() => {
    // Paleta calibrada neón limpia con intensidad emisiva máxima de 1.2
    const cCyan = new THREE.Color('#00f0ff');
    const cViolet = new THREE.Color('#c084fc');
    const cPrimary = new THREE.Color(themeCfg.primaryHex);
    const cRelay = new THREE.Color(themeCfg.relayHex);

    const cMinimalPrimary = new THREE.Color('#94a3b8');
    const cMinimalRelay = new THREE.Color('#475569');

    return {
      neonCyan: cCyan.clone().multiplyScalar(1.2),
      neonViolet: cViolet.clone().multiplyScalar(1.15),

      primaryNormal: cPrimary.clone().multiplyScalar(1.0),
      primaryDimmed: cPrimary.clone().multiplyScalar(0.3),

      relayNormal: cRelay.clone().multiplyScalar(1.0),
      relayDimmed: cRelay.clone().multiplyScalar(0.3),

      minimalPrimary: cMinimalPrimary,
      minimalRelay: cMinimalRelay
    };
  }, [themeCfg]);

  // Listener global de pointerup para evitar bloqueos si el usuario suelta fuera del canvas
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

  // Actualización de matrices de transformación y colores por instancia
  useEffect(() => {
    if (!meshRef.current) return;
    const mesh = meshRef.current;
    const dummy = new THREE.Object3D();

    const hoveredNode = hoveredId !== null ? nodes[hoveredId] : null;
    const selectedNode = selectedId !== null ? nodes[selectedId] : null;
    const hasSearchFilter = Boolean(matchingNodeIds && matchingNodeIds.size > 0);

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

      // --- ASIGNACIÓN DE COLOR BASE SEGÚN EL MODO VISUAL ACTIVO ---
      let baseColor: THREE.Color;

      if (visualStyle === 'category') {
        const catName = node.category || (node.type === 'primary' ? 'General' : 'Tag Hub');
        baseColor = getCategoryColorThree(catName, node.cluster ?? i);
      } else if (visualStyle === 'minimal') {
        baseColor = (node.type === 'primary' ? colors.minimalPrimary : colors.minimalRelay).clone();
      } else {
        // Modo 'neon' (Cyberpunk predeterminado)
        baseColor = (node.type === 'primary' ? colors.primaryNormal : colors.relayNormal).clone();
      }

      let scaleMult = 1.0;
      let chosenColor = baseColor.clone();

      if (hasSearchFilter) {
        // MODO BÚSQUEDA: Escala limitada a 1.25x con color neón cian limpio
        if (isSearchMatch) {
          scaleMult = 1.25;
          chosenColor = colors.neonCyan;
        } else {
          scaleMult = 0.5;
          chosenColor = chosenColor.multiplyScalar(0.2);
        }
      } else if (hoveredId !== null) {
        if (isHoveredTarget) {
          scaleMult = 1.25;
          chosenColor = colors.neonCyan;
        } else if (isHoveredNeighbor) {
          scaleMult = 1.15;
          chosenColor = colors.neonViolet;
        } else {
          scaleMult = 0.65;
          chosenColor = chosenColor.multiplyScalar(0.25);
        }
      } else if (selectedId !== null) {
        if (isSelectedTarget) {
          scaleMult = 1.25;
          chosenColor = colors.neonCyan;
        } else if (isSelectedNeighbor) {
          scaleMult = 1.15;
          chosenColor = colors.neonViolet;
        } else {
          scaleMult = 0.65;
          chosenColor = chosenColor.multiplyScalar(0.25);
        }
      } else {
        // Estado de reposo
        if (visualStyle === 'neon') {
          chosenColor.multiplyScalar(bloomBoost ? 1.4 : 1.1);
        } else if (visualStyle === 'category') {
          chosenColor.multiplyScalar(bloomBoost ? 1.3 : 1.0);
        } else {
          chosenColor.multiplyScalar(0.8);
        }
      }

      // Aislamiento por categoría si aplica
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
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [nodes, hoveredId, selectedId, activeNeighbors, colors, activeCategory, matchingNodeIds, bloomBoost, visualStyle]);

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

  // Filtrado selectivo de etiquetas candidatas para LOD
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

          // Deshabilitar rotación de OrbitControls durante el arrastre
          if (controlsRef?.current) {
            controlsRef.current.enabled = false;
          }

          // Plano perpendicular a la cámara que pasa por la posición del nodo
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

            // Actualizar coordenadas del nodo en memoria
            node.x = pt.x;
            node.y = pt.y;
            node.z = pt.z;

            // Actualizar matriz de la instancia para visualización inmediata
            const dummy = new THREE.Object3D();
            dummy.position.copy(pt);
            const scale = (node.baseScale || 0.35) * 1.25;
            dummy.scale.set(scale, scale, scale);
            dummy.updateMatrix();

            if (meshRef.current) {
              meshRef.current.setMatrixAt(id, dummy.matrix);
              meshRef.current.instanceMatrix.needsUpdate = true;
            }

            // Notificar a conexiones para actualización en tiempo real
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

          // Reactivar OrbitControls
          if (controlsRef?.current) {
            controlsRef.current.enabled = true;
          }

          (e.target as HTMLElement)?.releasePointerCapture?.(e.pointerId);

          if (id !== null && nodes[id]) {
            const node = nodes[id];
            if (hasMovedSignificantlyRef.current) {
              // 3D PINNING: Fijar coordenadas en Web Worker y guardar en Zustand
              if (onNodePin) {
                onNodePin(id, { x: node.x, y: node.y, z: node.z });
              }
            } else {
              // Clic simple: seleccionar nodo
              onSelect(id);
            }
          }
        }}
      >
        <icosahedronGeometry args={[1, 1]} />
        <meshBasicMaterial toneMapped={false} transparent opacity={0.95} />
      </instancedMesh>

      {/* Renderizado de Etiquetas 3D con LOD */}
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