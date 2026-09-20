import * as THREE from 'three';

// Paleta central coherente para el panel de categorías y el canvas 3D
export const CATEGORY_PALETTE: Record<string, string> = {
  'Arquitectura': '#a855f7', // Púrpura
  'Física': '#f59e0b',       // Naranja
  'Protocolo': '#10b981',    // Verde
  'Datos': '#ec4899',        // Rosa
  'Red': '#38bdf8',          // Azul Claro
  'Memoria': '#fb923c',      // Naranja Claro
  'Tag Hub': '#00f0ff',      // Cian Neón
  'General': '#64748b',      // Gris Neutro
};

const FALLBACK_PALETTE = [
  '#00f0ff', '#a855f7', '#f59e0b', '#10b981',
  '#ec4899', '#38bdf8', '#fb923c', '#8b5cf6'
];

export function getCategoryColorHex(category?: string, index = 0): string {
  if (!category) return FALLBACK_PALETTE[index % FALLBACK_PALETTE.length];
  if (CATEGORY_PALETTE[category]) return CATEGORY_PALETTE[category];

  // Hash estable para categorías personalizadas creadas por el usuario
  let hash = 0;
  for (let i = 0; i < category.length; i++) {
    hash = category.charCodeAt(i) + ((hash << 5) - hash);
  }
  return FALLBACK_PALETTE[Math.abs(hash) % FALLBACK_PALETTE.length];
}

export function getCategoryColorThree(category?: string, index = 0): THREE.Color {
  return new THREE.Color(getCategoryColorHex(category, index));
}