import React, { useRef, useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Graph3DNode, Graph3DLink, GraphTheme, THEME_CONFIG } from './types';
import { useUIStore } from '../../store/useUIStore';
import { getCategoryColorThree } from '../../utils/visualStyles';

export interface EdgeLinesProps {
  nodes: Graph3DNode[];
  links: Graph3DLink[];
  hoveredId: number | null;
  selectedId: number | null;
  theme: GraphTheme;
  activeCategory?: string | null;
  matchingNodeIds?: Set<number>;
}

/**
 * GLSL SHADER DE PULSO CIBERNÉTICO EN CONEXIONES
 * Proporciona haces de luz láser y pulsos neón que viajan por las conexiones
 * activas hacia los nodos en hover, seleccionados o buscados.
 */
const CyberPulseShader = {
  vertexShader: `
    attribute float aProgress;
    attribute float aIsActive;
    attribute float aFiltered;
    
    varying float vProgress;
    varying float vIsActive;
    varying float vFiltered;
    varying vec3 vColor;
    
    void main() {
      vProgress = aProgress;
      vIsActive = aIsActive;
      vFiltered = aFiltered;
      vColor = color;
      
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  fragmentShader: `
    uniform float uTime;
    uniform vec3 uActivePulseColor;
    uniform float uPulseSpeed;
    
    varying float vProgress;
    varying float vIsActive;
    varying float vFiltered;
    varying vec3 vColor;
    
    void main() {
      // Si la conexión está filtrada por categoría o búsqueda
      if (vFiltered > 0.5) {
        gl_FragColor = vec4(vColor * 0.1, 0.05);
        return;
      }
      
      vec3 finalColor = vColor;
      float finalAlpha = 0.35;
      
      if (vIsActive > 0.5) {
        // ENLACE ACTIVO (HOVER / SELECCIÓN / BÚSQUEDA)
        float speed = uPulseSpeed * 1.4;
        
        // Pulso 1: Haz luminoso primario
        float phase1 = fract(vProgress * 1.5 - uTime * speed);
        float pulse1 = smoothstep(0.7, 1.0, phase1) * 0.9;
        
        // Pulso 2: Estela armónica en contra-flujo
        float phase2 = fract(vProgress * 2.0 - uTime * (speed * 0.6) + 0.3);
        float pulse2 = smoothstep(0.75, 1.0, phase2) * 0.6;
        
        float totalPulse = clamp(pulse1 + pulse2, 0.0, 1.2);
        
        // Mezcla neón equilibrada
        vec3 neonPulse = mix(vec3(0.0, 0.94, 1.0), uActivePulseColor, 0.5);
        finalColor = mix(vColor * 1.0, neonPulse * 1.2, clamp(totalPulse * 0.8, 0.0, 1.0));
        finalAlpha = clamp(0.55 + totalPulse * 0.35, 0.0, 0.95);
      } else {
        // ENLACE AMBIENTAL DE FONDO
        float phase = fract(vProgress * 0.6 - uTime * 0.4);
        float ambientPulse = smoothstep(0.85, 1.0, phase) * 0.5;
        
        finalColor = vColor * (0.45 + ambientPulse * 0.3);
        finalAlpha = clamp(0.18 + ambientPulse * 0.2, 0.0, 0.5);
      }
      
      gl_FragColor = vec4(finalColor, finalAlpha);
    }
  `
};

export function EdgeLines({
  nodes,
  links,
  hoveredId,
  selectedId,
  theme,
  activeCategory = null,
  matchingNodeIds
}: EdgeLinesProps) {
  const geomRef = useRef<THREE.BufferGeometry>(null);
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const themeCfg = THEME_CONFIG[theme];

  // Consumir el estilo visual activo y el conmutador de visibilidad desde Zustand
  const visualStyle = useUIStore((state) => state.visualStyle);
  const showEdges = useUIStore((state) => state.showEdges);

  const pulseColorHex = useMemo(() => {
    return theme === 'cyberpunk' ? '#00f0ff' : theme === 'emerald' ? '#6ee7b7' : '#c084fc';
  }, [theme]);

  // Creación del ShaderMaterial con blending aditivo para Bloom neón
  const shaderMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uActivePulseColor: { value: new THREE.Color(pulseColorHex) },
        uPulseSpeed: { value: 1.8 }
      },
      vertexShader: CyberPulseShader.vertexShader,
      fragmentShader: CyberPulseShader.fragmentShader,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      vertexColors: true
    });
  }, [pulseColorHex]);

  // Actualización del uniforme uTime en cada frame de render
  useFrame((state) => {
    if (matRef.current) {
      matRef.current.uniforms.uTime.value = state.clock.getElapsedTime();
    }
  });

  const { positions, baseColors, progressArr, activeArr, filteredArr } = useMemo(() => {
    const count = links.length;
    const pos = new Float32Array(count * 6);
    const col = new Float32Array(count * 6);
    const prog = new Float32Array(count * 2);
    const act = new Float32Array(count * 2);
    const filt = new Float32Array(count * 2);

    const cPrimary = new THREE.Color(themeCfg.primaryHex);
    const cRelay = new THREE.Color(themeCfg.relayHex);
    const cMinimal = new THREE.Color('#334155');

    const hasSearch = Boolean(matchingNodeIds && matchingNodeIds.size > 0);

    links.forEach((link, idx) => {
      const srcId = typeof link.source === 'object' ? (link.source as any).id : link.source;
      const tgtId = typeof link.target === 'object' ? (link.target as any).id : link.target;
      const srcNode = nodes[srcId];
      const tgtNode = nodes[tgtId];

      const pOffset = idx * 6;
      const aOffset = idx * 2;

      const sx = srcNode && Number.isFinite(srcNode.x) ? srcNode.x : 0;
      const sy = srcNode && Number.isFinite(srcNode.y) ? srcNode.y : 0;
      const sz = srcNode && Number.isFinite(srcNode.z) ? srcNode.z : 0;

      const tx = tgtNode && Number.isFinite(tgtNode.x) ? tgtNode.x : 0;
      const ty = tgtNode && Number.isFinite(tgtNode.y) ? tgtNode.y : 0;
      const tz = tgtNode && Number.isFinite(tgtNode.z) ? tgtNode.z : 0;

      pos[pOffset + 0] = sx;
      pos[pOffset + 1] = sy;
      pos[pOffset + 2] = sz;

      pos[pOffset + 3] = tx;
      pos[pOffset + 4] = ty;
      pos[pOffset + 5] = tz;

      // --- CÁLCULO DE COLORES DE CONEXIÓN SEGÚN VISUALSTYLE ---
      let col1: THREE.Color;
      let col2: THREE.Color;

      if (visualStyle === 'category') {
        const srcCat = srcNode?.category || (srcNode?.type === 'primary' ? 'General' : 'Tag Hub');
        const tgtCat = tgtNode?.category || (tgtNode?.type === 'primary' ? 'General' : 'Tag Hub');
        col1 = getCategoryColorThree(srcCat, srcNode?.cluster ?? srcId);
        col2 = getCategoryColorThree(tgtCat, tgtNode?.cluster ?? tgtId);
      } else if (visualStyle === 'minimal') {
        col1 = cMinimal;
        col2 = cMinimal;
      } else {
        // Modo 'neon'
        col1 = srcNode && srcNode.type === 'primary' ? cPrimary : cRelay;
        col2 = tgtNode && tgtNode.type === 'primary' ? cPrimary : cRelay;
      }

      col[pOffset + 0] = Math.max(0, Math.min(1.0, col1.r));
      col[pOffset + 1] = Math.max(0, Math.min(1.0, col1.g));
      col[pOffset + 2] = Math.max(0, Math.min(1.0, col1.b));

      col[pOffset + 3] = Math.max(0, Math.min(1.0, col2.r));
      col[pOffset + 4] = Math.max(0, Math.min(1.0, col2.g));
      col[pOffset + 5] = Math.max(0, Math.min(1.0, col2.b));

      // Progreso de 0.0 (inicio) a 1.0 (destino) para animar el pulso
      prog[aOffset + 0] = 0.0;
      prog[aOffset + 1] = 1.0;

      const isHovered = hoveredId !== null && (srcId === hoveredId || tgtId === hoveredId);
      const isSelected = selectedId !== null && (srcId === selectedId || tgtId === selectedId);
      const isSearchActive = hasSearch && Boolean(matchingNodeIds?.has(srcId) || matchingNodeIds?.has(tgtId));

      const isActive = isHovered || isSelected || isSearchActive;
      act[aOffset + 0] = isActive ? 1.0 : 0.0;
      act[aOffset + 1] = isActive ? 1.0 : 0.0;

      let isFiltered = false;
      if (activeCategory) {
        const srcCat = srcNode?.category || (srcNode?.type === 'primary' ? 'Notas' : 'Hubs');
        const tgtCat = tgtNode?.category || (tgtNode?.type === 'primary' ? 'Notas' : 'Hubs');
        if (srcCat !== activeCategory && tgtCat !== activeCategory) {
          isFiltered = true;
        }
      }
      if (hasSearch && matchingNodeIds && !matchingNodeIds.has(srcId) && !matchingNodeIds.has(tgtId)) {
        isFiltered = true;
      }

      filt[aOffset + 0] = isFiltered ? 1.0 : 0.0;
      filt[aOffset + 1] = isFiltered ? 1.0 : 0.0;
    });

    return {
      positions: pos,
      baseColors: col,
      progressArr: prog,
      activeArr: act,
      filteredArr: filt
    };
  }, [nodes, links, hoveredId, selectedId, themeCfg, activeCategory, matchingNodeIds, visualStyle]);

  // Sincronizar buffers dinámicos con la geometría Three.js
  useEffect(() => {
    if (!geomRef.current || !showEdges) return;
    const geom = geomRef.current;

    const posAttr = geom.getAttribute('position') as THREE.BufferAttribute;
    if (posAttr) {
      posAttr.set(positions);
      posAttr.needsUpdate = true;
      geom.computeBoundingSphere();
    }

    const colAttr = geom.getAttribute('color') as THREE.BufferAttribute;
    if (colAttr) {
      colAttr.set(baseColors);
      colAttr.needsUpdate = true;
    }

    const progAttr = geom.getAttribute('aProgress') as THREE.BufferAttribute;
    if (progAttr) {
      progAttr.set(progressArr);
      progAttr.needsUpdate = true;
    }

    const actAttr = geom.getAttribute('aIsActive') as THREE.BufferAttribute;
    if (actAttr) {
      actAttr.set(activeArr);
      actAttr.needsUpdate = true;
    }

    const filtAttr = geom.getAttribute('aFiltered') as THREE.BufferAttribute;
    if (filtAttr) {
      filtAttr.set(filteredArr);
      filtAttr.needsUpdate = true;
    }
  }, [positions, baseColors, progressArr, activeArr, filteredArr, showEdges]);

  // Limpieza de memoria WebGL al desmontar
  useEffect(() => {
    return () => {
      if (geomRef.current) {
        geomRef.current.dispose();
      }
      shaderMaterial.dispose();
    };
  }, [shaderMaterial]);

  // Si las conexiones están desactivadas en Zustand, no se renderizan
  if (!showEdges) return null;

  return (
    <lineSegments>
      <bufferGeometry ref={geomRef}>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[baseColors, 3]} />
        <bufferAttribute attach="attributes-aProgress" args={[progressArr, 1]} />
        <bufferAttribute attach="attributes-aIsActive" args={[activeArr, 1]} />
        <bufferAttribute attach="attributes-aFiltered" args={[filteredArr, 1]} />
      </bufferGeometry>
      <primitive object={shaderMaterial} ref={matRef} attach="material" />
    </lineSegments>
  );
}
