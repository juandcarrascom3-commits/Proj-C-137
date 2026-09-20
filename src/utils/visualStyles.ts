import * as THREE from 'three';

// ============================================================================
// 1. TIPOS Y DEFINICIONES DE ESTILO INTEGRADOS
// ============================================================================

export type VisualStyleMode = 'neon' | 'category' | 'minimal';

export type FunctionalMode = 
  | 'category'     // Color según categoría asignada
  | 'centrality'   // Color y escala según volumen de conexiones (Hubs vs Hojas)
  | 'neighborhood' // Enfoque en subredes activas (aislamiento de contexto)
  | 'monochrome';  // Estilo minimalista neutro de alto contraste

export type EdgeShaderMode = 'laser' | 'synapse' | 'galaxy' | 'minimal';

export type AestheticTheme =
  | 'neural_synapse'     // Bicromático: Cían Neón + Violeta Sináptico (Potencial de Acción)
  | 'cosmic_galaxy'      // Filamentos Galácticos: Magma Cósmico + Polvo Estelar
  | 'cyberpunk'          // Neón Cyberpunk: Cían + Magenta + Dorado
  | 'synthwave'          // Retro 80s: Rosa Sunset + Naranja Neón
  | 'emerald_matrix'     // Monocromático: Verde Terminal + Esmeralda Matrix
  | 'solar_flare'        // Monocromático: Ámbar Incandescente + Fuego Solar
  | 'electric_violet'    // Púrpura Radiante + Magenta
  | 'ocean_abyss'        // Turquesa Neón + Azul Cobalto Abisal
  | 'quantum_prism'      // Multicolor Categórico con Red Neutra
  | 'monochrome_cyber'   // Monocromático: Blanco Titanio + Gris Pizarra Exec
  | 'nordic_frost'       // Glacial: Azul Hielo + Menta Crystalline
  | 'crimson_protocol'   // Alerta Carmesí + Amarillo Código
  | 'oled_high_contrast';// OLED Pure Black + Neones Puros

export interface ThemeConfig {
  name: string;
  description: string;
  type: 'neural' | 'bichromatic' | 'monochromatic' | 'multicolor' | 'minimal';
  background: string;
  starsOpacity: number;
  bloomIntensity: number;
  bloomThreshold: number;
  glowBoost: number; // Multiplicador de brillo para la GPU

  // Configuración de Nodos
  defaultNodeColor: string;
  hubNodeColor: string;
  leafNodeColor: string;

  // Configuración Avanzada de Red / Aristas y Shader
  edgeColor: string;
  edgeOpacity: number;
  edgeBlending: 'additive' | 'normal';
  edgeMode: EdgeShaderMode;
  pulseSpeed: number;
  pulseFrequency: number;

  // Mapeo Categórico
  palette: Record<string, string>;
}

// ============================================================================
// 2. REGISTRO DE TEMAS ESTÉTICOS CIENTÍFICO-ARTÍSTICOS
// ============================================================================

export const AESTHETIC_THEMES: Record<AestheticTheme, ThemeConfig> = {
  // 1. RED NEURONAL SINÁPTICA
  neural_synapse: {
    name: 'Red Sináptica 3D',
    description: 'Bicromático neón diseñado para simular redes neuronales con transferencia de acción bi-direccional.',
    type: 'neural',
    background: '#030712',
    starsOpacity: 0.2,
    bloomIntensity: 1.6,
    bloomThreshold: 0.25,
    glowBoost: 1.4,
    defaultNodeColor: '#00f0ff',
    hubNodeColor: '#a855f7',
    leafNodeColor: '#0284c7',
    edgeColor: '#3b82f6',
    edgeOpacity: 0.38,
    edgeBlending: 'additive',
    edgeMode: 'synapse',
    pulseSpeed: 2.2,
    pulseFrequency: 3.0,
    palette: {
      Arquitectura: '#00f0ff',
      Física: '#38bdf8',
      Protocolo: '#818cf8',
      Datos: '#c084fc',
      Red: '#60a5fa',
      Memoria: '#a855f7',
      IA: '#a855f7',
      Cuántico: '#00f0ff',
      General: '#1e3a8a',
      'Tag Hub': '#a855f7',
    },
  },

  // 2. FILAMENTOS GALÁCTICOS (Cosmología 3D)
  cosmic_galaxy: {
    name: 'Cúmulo Galáctico',
    description: 'Filamentos estelares con micro-ondulaciones de plasma y centelleos de materia oscura.',
    type: 'bichromatic',
    background: '#020208',
    starsOpacity: 0.5,
    bloomIntensity: 1.7,
    bloomThreshold: 0.2,
    glowBoost: 1.5,
    defaultNodeColor: '#ec4899',
    hubNodeColor: '#f59e0b',
    leafNodeColor: '#8b5cf6',
    edgeColor: '#a855f7',
    edgeOpacity: 0.32,
    edgeBlending: 'additive',
    edgeMode: 'galaxy',
    pulseSpeed: 1.2,
    pulseFrequency: 2.0,
    palette: {
      Arquitectura: '#ec4899',
      Física: '#f59e0b',
      Protocolo: '#8b5cf6',
      Datos: '#38bdf8',
      Red: '#f43f5e',
      Memoria: '#d946ef',
      IA: '#fbbf24',
      Cuántico: '#67e8f9',
      General: '#4c1d95',
      'Tag Hub': '#f59e0b',
    },
  },

  // 3. CYBERPUNK NEÓN
  cyberpunk: {
    name: 'Cyberpunk Neón',
    description: 'Estilo neón vibrante con pulsos láser de alta frecuencia e iluminación holográfica.',
    type: 'multicolor',
    background: '#020617',
    starsOpacity: 0.25,
    bloomIntensity: 1.5,
    bloomThreshold: 0.3,
    glowBoost: 1.35,
    defaultNodeColor: '#06b6d4',
    hubNodeColor: '#facc15',
    leafNodeColor: '#a855f7',
    edgeColor: '#0284c7',
    edgeOpacity: 0.42,
    edgeBlending: 'additive',
    edgeMode: 'laser',
    pulseSpeed: 2.5,
    pulseFrequency: 2.5,
    palette: {
      Arquitectura: '#06b6d4',
      Física: '#a855f7',
      Protocolo: '#f97316',
      Datos: '#ec4899',
      Red: '#10b981',
      Memoria: '#3b82f6',
      IA: '#facc15',
      Cuántico: '#00f0ff',
      General: '#475569',
      'Tag Hub': '#facc15',
    },
  },

  // 4. SYNTHWAVE 80s
  synthwave: {
    name: 'Synthwave Sunset',
    description: 'Gama retro-futurista de púrpuras, magenta y amarillo cálido con flujo armónico.',
    type: 'bichromatic',
    background: '#0d0221',
    starsOpacity: 0.4,
    bloomIntensity: 1.8,
    bloomThreshold: 0.2,
    glowBoost: 1.5,
    defaultNodeColor: '#f72585',
    hubNodeColor: '#ffb703',
    leafNodeColor: '#7209b7',
    edgeColor: '#b5179e',
    edgeOpacity: 0.4,
    edgeBlending: 'additive',
    edgeMode: 'synapse',
    pulseSpeed: 1.8,
    pulseFrequency: 2.2,
    palette: {
      Arquitectura: '#f72585',
      Física: '#b5179e',
      Protocolo: '#ffb703',
      Datos: '#7209b7',
      Red: '#4cc9f0',
      Memoria: '#560bad',
      IA: '#f77f00',
      Cuántico: '#f72585',
      General: '#3f37c9',
      'Tag Hub': '#ffb703',
    },
  },

  // 5. EMERALD MATRIX
  emerald_matrix: {
    name: 'Emerald Matrix',
    description: 'Consola cibernética monocromática con transferencia de datos en verde esmeralda terminal.',
    type: 'monochromatic',
    background: '#02110b',
    starsOpacity: 0.15,
    bloomIntensity: 1.3,
    bloomThreshold: 0.35,
    glowBoost: 1.25,
    defaultNodeColor: '#22c55e',
    hubNodeColor: '#86efac',
    leafNodeColor: '#15803d',
    edgeColor: '#059669',
    edgeOpacity: 0.32,
    edgeBlending: 'additive',
    edgeMode: 'laser',
    pulseSpeed: 2.0,
    pulseFrequency: 3.5,
    palette: {
      Arquitectura: '#22c55e',
      Física: '#4ade80',
      Protocolo: '#16a34a',
      Datos: '#a3e635',
      Red: '#0d9488',
      Memoria: '#15803d',
      IA: '#86efac',
      Cuántico: '#34d399',
      General: '#14532d',
      'Tag Hub': '#86efac',
    },
  },

  // 6. ÁMBAR SOLAR
  solar_flare: {
    name: 'Ámbar Solar',
    description: 'Monocromático cálido inspirado en energía de plasma incandescente y bronce.',
    type: 'monochromatic',
    background: '#120702',
    starsOpacity: 0.2,
    bloomIntensity: 1.5,
    bloomThreshold: 0.28,
    glowBoost: 1.35,
    defaultNodeColor: '#f97316',
    hubNodeColor: '#fef08a',
    leafNodeColor: '#b91c1c',
    edgeColor: '#d97706',
    edgeOpacity: 0.38,
    edgeBlending: 'additive',
    edgeMode: 'galaxy',
    pulseSpeed: 1.5,
    pulseFrequency: 2.0,
    palette: {
      Arquitectura: '#f97316',
      Física: '#fb923c',
      Protocolo: '#f59e0b',
      Datos: '#ef4444',
      Red: '#facc15',
      Memoria: '#c2410c',
      IA: '#fef08a',
      Cuántico: '#ea580c',
      General: '#78350f',
      'Tag Hub': '#fef08a',
    },
  },

  // 7. ELECTRIC VIOLET
  electric_violet: {
    name: 'Electric Violet',
    description: 'Púrpuras y magentas de alta energía para redes neuronales profundas.',
    type: 'bichromatic',
    background: '#090314',
    starsOpacity: 0.3,
    bloomIntensity: 1.7,
    bloomThreshold: 0.22,
    glowBoost: 1.45,
    defaultNodeColor: '#c084fc',
    hubNodeColor: '#f0abfc',
    leafNodeColor: '#6b21a8',
    edgeColor: '#7e22ce',
    edgeOpacity: 0.4,
    edgeBlending: 'additive',
    edgeMode: 'synapse',
    pulseSpeed: 2.0,
    pulseFrequency: 2.8,
    palette: {
      Arquitectura: '#a855f7',
      Física: '#c084fc',
      Protocolo: '#e879f9',
      Datos: '#f0abfc',
      Red: '#818cf8',
      Memoria: '#6b21a8',
      IA: '#f43f5e',
      Cuántico: '#d8b4fe',
      General: '#3b0764',
      'Tag Hub': '#f0abfc',
    },
  },

  // 8. ABISMO BIOCIAN
  ocean_abyss: {
    name: 'Abismo Biocian',
    description: 'Tonos turquesa y azul abisal con contrastes bioluminiscentes de profundidad.',
    type: 'bichromatic',
    background: '#011627',
    starsOpacity: 0.2,
    bloomIntensity: 1.3,
    bloomThreshold: 0.32,
    glowBoost: 1.2,
    defaultNodeColor: '#2ec4b6',
    hubNodeColor: '#ff9f1c',
    leafNodeColor: '#0077b6',
    edgeColor: '#0284c7',
    edgeOpacity: 0.35,
    edgeBlending: 'additive',
    edgeMode: 'galaxy',
    pulseSpeed: 1.0,
    pulseFrequency: 1.8,
    palette: {
      Arquitectura: '#2ec4b6',
      Física: '#20a4f3',
      Protocolo: '#ff9f1c',
      Datos: '#e71d36',
      Red: '#00b4d8',
      Memoria: '#0077b6',
      IA: '#90e0ef',
      Cuántico: '#caf0f8',
      General: '#0f172a',
      'Tag Hub': '#ff9f1c',
    },
  },

  // 9. PRISMA CUÁNTICO
  quantum_prism: {
    name: 'Prisma Cuántico',
    description: 'Máxima separación cromática categórica con red neutra no invasiva.',
    type: 'multicolor',
    background: '#050814',
    starsOpacity: 0.25,
    bloomIntensity: 1.4,
    bloomThreshold: 0.3,
    glowBoost: 1.25,
    defaultNodeColor: '#38bdf8',
    hubNodeColor: '#f43f5e',
    leafNodeColor: '#64748b',
    edgeColor: '#1e1b4b',
    edgeOpacity: 0.45,
    edgeBlending: 'normal',
    edgeMode: 'minimal',
    pulseSpeed: 1.0,
    pulseFrequency: 1.0,
    palette: {
      Arquitectura: '#38bdf8',
      Física: '#f43f5e',
      Protocolo: '#10b981',
      Datos: '#fbbf24',
      Red: '#a855f7',
      Memoria: '#ec4899',
      IA: '#f43f5e',
      Cuántico: '#06b6d4',
      General: '#334155',
      'Tag Hub': '#f43f5e',
    },
  },

  // 10. TITANIUM MINIMAL
  monochrome_cyber: {
    name: 'Titanium Minimal',
    description: 'Estilo ejecutivo plano y limpio, optimizado para lectura y análisis sin fatiga visual.',
    type: 'minimal',
    background: '#09090b',
    starsOpacity: 0.05,
    bloomIntensity: 0.8,
    bloomThreshold: 0.6,
    glowBoost: 0.85,
    defaultNodeColor: '#cbd5e1',
    hubNodeColor: '#ffffff',
    leafNodeColor: '#64748b',
    edgeColor: '#334155',
    edgeOpacity: 0.25,
    edgeBlending: 'normal',
    edgeMode: 'minimal',
    pulseSpeed: 0.5,
    pulseFrequency: 1.0,
    palette: {
      Arquitectura: '#f8fafc',
      Física: '#e2e8f0',
      Protocolo: '#cbd5e1',
      Datos: '#94a3b8',
      Red: '#64748b',
      Memoria: '#475569',
      IA: '#ffffff',
      Cuántico: '#f1f5f9',
      General: '#27272a',
      'Tag Hub': '#ffffff',
    },
  },

  // 11. NORDIC FROST
  nordic_frost: {
    name: 'Nordic Frost',
    description: 'Paleta glacial con tonos menta, cristal y cían pastel tenue.',
    type: 'bichromatic',
    background: '#06131e',
    starsOpacity: 0.15,
    bloomIntensity: 1.2,
    bloomThreshold: 0.35,
    glowBoost: 1.15,
    defaultNodeColor: '#a7f3d0',
    hubNodeColor: '#38bdf8',
    leafNodeColor: '#059669',
    edgeColor: '#0891b2',
    edgeOpacity: 0.32,
    edgeBlending: 'additive',
    edgeMode: 'synapse',
    pulseSpeed: 1.4,
    pulseFrequency: 2.2,
    palette: {
      Arquitectura: '#a7f3d0',
      Física: '#67e8f9',
      Protocolo: '#38bdf8',
      Datos: '#34d399',
      Red: '#0284c7',
      Memoria: '#059669',
      IA: '#38bdf8',
      Cuántico: '#e0f2fe',
      General: '#164e63',
      'Tag Hub': '#38bdf8',
    },
  },

  // 12. CRIMSON PROTOCOL
  crimson_protocol: {
    name: 'Crimson Protocol',
    description: 'Cibernética de alto impacto visual en carmesí y amarillo de advertencia.',
    type: 'bichromatic',
    background: '#0f0203',
    starsOpacity: 0.2,
    bloomIntensity: 1.6,
    bloomThreshold: 0.25,
    glowBoost: 1.4,
    defaultNodeColor: '#f43f5e',
    hubNodeColor: '#fde047',
    leafNodeColor: '#881337',
    edgeColor: '#e11d48',
    edgeOpacity: 0.4,
    edgeBlending: 'additive',
    edgeMode: 'laser',
    pulseSpeed: 2.6,
    pulseFrequency: 3.0,
    palette: {
      Arquitectura: '#f43f5e',
      Física: '#fb7185',
      Protocolo: '#e11d48',
      Datos: '#be123c',
      Red: '#f59e0b',
      Memoria: '#881337',
      IA: '#fde047',
      Cuántico: '#fda4af',
      General: '#4c0519',
      'Tag Hub': '#fde047',
    },
  },

  // 13. OLED PURE BLACK
  oled_high_contrast: {
    name: 'OLED Pure Black',
    description: 'Fondo negro absoluto (#000000) con neones de máximo contraste para pantallas OLED.',
    type: 'minimal',
    background: '#000000',
    starsOpacity: 0.0,
    bloomIntensity: 2.0,
    bloomThreshold: 0.15,
    glowBoost: 1.65,
    defaultNodeColor: '#00f0ff',
    hubNodeColor: '#ffffff',
    leafNodeColor: '#a855f7',
    edgeColor: '#00f0ff',
    edgeOpacity: 0.45,
    edgeBlending: 'additive',
    edgeMode: 'laser',
    pulseSpeed: 2.2,
    pulseFrequency: 3.2,
    palette: {
      Arquitectura: '#00f0ff',
      Física: '#a855f7',
      Protocolo: '#ff0055',
      Datos: '#00ff66',
      Red: '#ffcc00',
      Memoria: '#3366ff',
      IA: '#ffffff',
      Cuántico: '#ff00ff',
      General: '#333333',
      'Tag Hub': '#ffffff',
    },
  },
};

// Configuración predeterminada de fallback
export const DEFAULT_THEME_KEY: AestheticTheme = 'neural_synapse';

// ============================================================================
// 3. FUNCIONES DE UTILIDAD Y RESOLUCIÓN DE COLOR
// ============================================================================

export function getCategoryColorHex(category?: string, themeKey: AestheticTheme = DEFAULT_THEME_KEY): string {
  const theme = AESTHETIC_THEMES[themeKey] || AESTHETIC_THEMES[DEFAULT_THEME_KEY];
  if (!category) return theme.defaultNodeColor;
  return theme.palette[category] || theme.defaultNodeColor;
}

export function getCategoryColorThree(category?: string, themeKey: AestheticTheme = DEFAULT_THEME_KEY): THREE.Color {
  return new THREE.Color(getCategoryColorHex(category, themeKey));
}

export interface NodeStyleResult {
  color: THREE.Color;
  hex: string;
  scaleMultiplier: number;
  opacity: number;
}

export function calculateNodeStyle(
  category: string | undefined,
  linkCount: number,
  isSelected: boolean,
  isNeighbor: boolean,
  hasActiveSelection: boolean,
  themeKey: AestheticTheme = DEFAULT_THEME_KEY,
  functionalMode: FunctionalMode = 'category'
): NodeStyleResult {
  const theme = AESTHETIC_THEMES[themeKey] || AESTHETIC_THEMES[DEFAULT_THEME_KEY];
  let hexColor = theme.defaultNodeColor;
  let scaleMultiplier = 1.0;
  let opacity = 1.0;

  if (functionalMode === 'category') {
    hexColor = getCategoryColorHex(category, themeKey);
  } else if (functionalMode === 'centrality') {
    if (linkCount >= 6) {
      hexColor = theme.hubNodeColor;
      scaleMultiplier = 1.6;
    } else if (linkCount >= 3) {
      hexColor = theme.defaultNodeColor;
      scaleMultiplier = 1.2;
    } else {
      hexColor = theme.leafNodeColor;
      scaleMultiplier = 0.85;
    }
  } else if (functionalMode === 'neighborhood') {
    if (isSelected) {
      hexColor = '#ffffff';
      scaleMultiplier = 1.8;
      opacity = 1.0;
    } else if (isNeighbor) {
      hexColor = theme.defaultNodeColor;
      scaleMultiplier = 1.3;
      opacity = 0.9;
    } else {
      hexColor = theme.palette['General'] || '#475569';
      scaleMultiplier = 0.7;
      opacity = hasActiveSelection ? 0.15 : 0.6;
    }
  } else if (functionalMode === 'monochrome') {
    hexColor = isSelected ? '#ffffff' : (isNeighbor ? theme.defaultNodeColor : '#475569');
    scaleMultiplier = isSelected ? 1.5 : 0.9;
    opacity = hasActiveSelection && !isSelected && !isNeighbor ? 0.2 : 0.75;
  }

  if (hasActiveSelection && functionalMode !== 'neighborhood' && functionalMode !== 'monochrome') {
    if (isSelected) {
      hexColor = '#ffffff';
      scaleMultiplier *= 1.4;
      opacity = 1.0;
    } else if (isNeighbor) {
      scaleMultiplier *= 1.15;
      opacity = 0.95;
    } else {
      opacity = 0.15;
    }
  }

  return {
    color: new THREE.Color(hexColor),
    hex: hexColor,
    scaleMultiplier,
    opacity,
  };
}

export function getThemeEdgeStyle(themeKey: AestheticTheme = DEFAULT_THEME_KEY) {
  const theme = AESTHETIC_THEMES[themeKey] || AESTHETIC_THEMES[DEFAULT_THEME_KEY];
  return {
    color: new THREE.Color(theme.edgeColor),
    hex: theme.edgeColor,
    opacity: theme.edgeOpacity,
    blending: theme.edgeBlending === 'additive' ? THREE.AdditiveBlending : THREE.NormalBlending,
    mode: theme.edgeMode,
    speed: theme.pulseSpeed,
    frequency: theme.pulseFrequency,
    glowBoost: theme.glowBoost
  };
}