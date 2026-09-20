import React, { useRef, useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Graph3DNode, Graph3DLink, GraphTheme } from './types';
import { useUIStore } from '../../store/useUIStore';
import { 
  AESTHETIC_THEMES, 
  DEFAULT_THEME_KEY, 
  AestheticTheme, 
  getCategoryColorThree 
} from '../../utils/visualStyles';

export interface EdgeLinesProps {
  nodes: Graph3DNode[];
  links: Graph3DLink[];
  hoveredId: number | null;
  selectedId: number | null;
  theme?: GraphTheme | AestheticTheme;
  activeCategory?: string | null;
  matchingNodeIds?: Set<number>;
}

/**
 * GLSL SHADER MULTI-MODO DE TRANSFERENCIA DE INFORMACIÓN Y TOPOLOGÍA
 * Renderiza efectos de láser, sinapsis bi-direccional, filamentos galácticos e hilos minimalistas.
 */
const AdvancedNetworkShader = {
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
    uniform float uPulseFrequency;
    uniform float uEdgeMode; // 0.0: Laser, 1.0: Synapse, 2.0: Galaxy, 3.0: Minimal
    uniform float uBaseOpacity;
    uniform float uGlowIntensity;

    varying float vProgress;
    varying float vIsActive;
    varying float vFiltered;
    varying vec3 vColor;

    void main() {
      // Filtrado por búsqueda o categoría
      if (vFiltered > 0.5) {
        gl_FragColor = vec4(vColor * 0.08, 0.02);
        return;
      }

      vec3 finalColor = vColor;
      float finalAlpha = uBaseOpacity;

      if (uEdgeMode < 0.5) {
        // ====================================================================
        // MODO 0: CYBER LASER (Haces de luz direccionales de alta velocidad)
        // ====================================================================
        if (vIsActive > 0.5) {
          float speed = uPulseSpeed * 1.6;
          float phase1 = fract(vProgress * uPulseFrequency - uTime * speed);
          float pulse1 = smoothstep(0.75, 1.0, phase1) * 1.1;
          
          float phase2 = fract(vProgress * (uPulseFrequency * 1.3) - uTime * (speed * 0.7) + 0.35);
          float pulse2 = smoothstep(0.8, 1.0, phase2) * 0.6;
          
          float totalPulse = clamp(pulse1 + pulse2, 0.0, 1.4);
          vec3 neonPulse = mix(vec3(0.0, 0.95, 1.0), uActivePulseColor, 0.6);
          
          finalColor = mix(vColor, neonPulse * uGlowIntensity, clamp(totalPulse * 0.85, 0.0, 1.0));
          finalAlpha = clamp(uBaseOpacity + totalPulse * 0.45, 0.0, 0.98);
        } else {
          float phase = fract(vProgress * 0.8 - uTime * 0.4);
          float ambientPulse = smoothstep(0.88, 1.0, phase) * 0.35;
          finalColor = vColor * (0.6 + ambientPulse * 0.4);
          finalAlpha = clamp(uBaseOpacity * 0.75 + ambientPulse * 0.25, 0.0, 0.65);
        }
      } else if (uEdgeMode < 1.5) {
        // ====================================================================
        // MODO 1: NEURAL SYNAPSE (Ondas bi-direccionales de potencial de acción)
        // ====================================================================
        float speed = uPulseSpeed * 1.2;
        float waveFwd = smoothstep(0.7, 1.0, fract(vProgress * uPulseFrequency - uTime * speed));
        float waveBwd = smoothstep(0.7, 1.0, fract((1.0 - vProgress) * uPulseFrequency - uTime * (speed * 0.85)));
        float synapseGlow = clamp(waveFwd + waveBwd, 0.0, 1.3);

        if (vIsActive > 0.5) {
          finalColor = mix(vColor, uActivePulseColor * uGlowIntensity, synapseGlow * 0.85);
          finalAlpha = clamp(uBaseOpacity + synapseGlow * 0.5, 0.0, 0.98);
        } else {
          finalColor = mix(vColor, uActivePulseColor, synapseGlow * 0.35);
          finalAlpha = clamp(uBaseOpacity + synapseGlow * 0.22, 0.0, 0.7);
        }
      } else if (uEdgeMode < 2.5) {
        // ====================================================================
        // MODO 2: GALAXY FILAMENT (Materia oscura, plasma y centelleos cósmicos)
        // ====================================================================
        float slowTime = uTime * (uPulseSpeed * 0.45);
        float shimmer1 = sin(vProgress * 14.0 + slowTime * 2.2) * 0.5 + 0.5;
        float shimmer2 = cos(vProgress * 28.0 - slowTime * 3.4) * 0.5 + 0.5;
        float cosmicThread = smoothstep(0.2, 0.9, shimmer1 * shimmer2);
        
        vec3 stardust = mix(vColor, vec3(1.0, 0.85, 1.0), cosmicThread * 0.45);
        
        if (vIsActive > 0.5) {
          float pulse = smoothstep(0.6, 1.0, fract(vProgress * 2.0 - slowTime * 2.8));
          finalColor = mix(stardust, uActivePulseColor * uGlowIntensity, pulse);
          finalAlpha = clamp(uBaseOpacity * 1.2 + cosmicThread * 0.25 + pulse * 0.4, 0.0, 0.95);
        } else {
          finalColor = stardust * (0.75 + cosmicThread * 0.45);
          finalAlpha = clamp(uBaseOpacity * 0.85 + cosmicThread * 0.25, 0.0, 0.6);
        }
      } else {
        // ====================================================================
        // MODO 3: MINIMAL THREAD (Líneas sobrias de titanio sin saturación)
        // ====================================================================
        if (vIsActive > 0.5) {
          finalColor = mix(vColor, uActivePulseColor, 0.75);
          finalAlpha = clamp(uBaseOpacity + 0.38, 0.0, 0.88);
        } else {
          finalColor = vColor;
          finalAlpha = uBaseOpacity;
        }
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

  // Obtener estado global de la aplicación
  const visualStyle = useUIStore((state) => state.visualStyle);
  const showEdges = useUIStore((state) => state.showEdges);
  const aestheticTheme = useUIStore((state) => state.aestheticTheme) as AestheticTheme;
  const glowIntensity = useUIStore((state) => state.glowIntensity);

  // Determinar tema activo
  const activeThemeKey: AestheticTheme = (aestheticTheme || theme || DEFAULT_THEME_KEY) as AestheticTheme;
  const currentTheme = AESTHETIC_THEMES[activeThemeKey] || AESTHETIC_THEMES[DEFAULT_THEME_KEY];

  // Map modes to numeric float values for GLSL
  const edgeModeNumeric = useMemo(() => {
    switch (currentTheme.edgeMode) {
      case 'laser': return 0.0;
      case 'synapse': return 1.0;
      case 'galaxy': return 2.0;
      case 'minimal': return 3.0;
      default: return 0.0;
    }
  }, [currentTheme.edgeMode]);

  // ShaderMaterial instance
  const shaderMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uActivePulseColor: { value: new THREE.Color(currentTheme.edgeColor) },
        uPulseSpeed: { value: currentTheme.pulseSpeed },
        uPulseFrequency: { value: currentTheme.pulseFrequency },
        uEdgeMode: { value: edgeModeNumeric },
        uBaseOpacity: { value: currentTheme.edgeOpacity },
        uGlowIntensity: { value: currentTheme.glowBoost }
      },
      vertexShader: AdvancedNetworkShader.vertexShader,
      fragmentShader: AdvancedNetworkShader.fragmentShader,
      transparent: true,
      blending: currentTheme.edgeBlending === 'additive' ? THREE.AdditiveBlending : THREE.NormalBlending,
      depthWrite: false,
      vertexColors: true
    });
  }, [currentTheme, edgeModeNumeric]);

  // Actualizar uniforms en cada frame
  useFrame((state) => {
    if (matRef.current) {
      matRef.current.uniforms.uTime.value = state.clock.getElapsedTime();
      matRef.current.uniforms.uEdgeMode.value = edgeModeNumeric;
      matRef.current.uniforms.uBaseOpacity.value = currentTheme.edgeOpacity * Math.min(1.3, glowIntensity);
      matRef.current.uniforms.uGlowIntensity.value = currentTheme.glowBoost * glowIntensity;
      matRef.current.uniforms.uPulseSpeed.value = currentTheme.pulseSpeed;
      matRef.current.uniforms.uPulseFrequency.value = currentTheme.pulseFrequency;
      matRef.current.uniforms.uActivePulseColor.value.set(currentTheme.edgeColor);
    }
  });

  // Re-calcular arrays de geometría cuando cambian las dependencias de datos
  const { positions, baseColors, progressArr, activeArr, filteredArr } = useMemo(() => {
    const count = links.length;
    const pos = new Float32Array(count * 6);
    const col = new Float32Array(count * 6);
    const prog = new Float32Array(count * 2);
    const act = new Float32Array(count * 2);
    const filt = new Float32Array(count * 2);

    const baseEdgeColor = new THREE.Color(currentTheme.edgeColor);
    const hubColor = new THREE.Color(currentTheme.hubNodeColor);
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

      // Determinación cromática de extremos según VisualStyle Mode
      let col1: THREE.Color;
      let col2: THREE.Color;

      if (visualStyle === 'category') {
        const srcCat = srcNode?.category || (srcNode?.type === 'primary' ? 'General' : 'Tag Hub');
        const tgtCat = tgtNode?.category || (tgtNode?.type === 'primary' ? 'General' : 'Tag Hub');
        col1 = getCategoryColorThree(srcCat, activeThemeKey);
        col2 = getCategoryColorThree(tgtCat, activeThemeKey);
      } else if (visualStyle === 'minimal') {
        col1 = baseEdgeColor;
        col2 = baseEdgeColor;
      } else {
        // Modo 'neon'
        col1 = srcNode && srcNode.type === 'relay' ? hubColor : baseEdgeColor;
        col2 = tgtNode && tgtNode.type === 'relay' ? hubColor : baseEdgeColor;
      }

      col[pOffset + 0] = Math.max(0, Math.min(1.0, col1.r));
      col[pOffset + 1] = Math.max(0, Math.min(1.0, col1.g));
      col[pOffset + 2] = Math.max(0, Math.min(1.0, col1.b));

      col[pOffset + 3] = Math.max(0, Math.min(1.0, col2.r));
      col[pOffset + 4] = Math.max(0, Math.min(1.0, col2.g));
      col[pOffset + 5] = Math.max(0, Math.min(1.0, col2.b));

      // Progreso 0.0 -> 1.0
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
  }, [nodes, links, hoveredId, selectedId, currentTheme, activeCategory, matchingNodeIds, visualStyle, activeThemeKey]);

  // Sincronización dinámico de atributos en Three.js BufferGeometry
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

  // Liberación de recursos en memoria WebGL
  useEffect(() => {
    return () => {
      if (geomRef.current) {
        geomRef.current.dispose();
      }
      shaderMaterial.dispose();
    };
  }, [shaderMaterial]);

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