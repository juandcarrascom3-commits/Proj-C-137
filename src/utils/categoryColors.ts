import * as THREE from 'three';
import { AESTHETIC_THEMES, AestheticTheme } from './visualStyles';

// Exportación puente para mantener compatibilidad con componentes que usan CATEGORY_PALETTE
export const CATEGORY_PALETTE: Record<string, string> = AESTHETIC_THEMES.cyberpunk.palette;

// Mapea la paleta del tema activo a un formato { hex, rgb }
export function getCategoryColorsMap(theme: AestheticTheme = 'cyberpunk') {
  const palette = AESTHETIC_THEMES[theme]?.palette || AESTHETIC_THEMES.cyberpunk.palette;
  const result: Record<string, { hex: string; rgb: THREE.Color }> = {};

  Object.entries(palette).forEach(([cat, hex]) => {
    result[cat] = { hex, rgb: new THREE.Color(hex) };
  });

  return result;
}

export const CATEGORY_COLORS = getCategoryColorsMap('cyberpunk');

export const DEFAULT_COLOR = {
  hex: AESTHETIC_THEMES.cyberpunk.defaultNodeColor,
  rgb: new THREE.Color(AESTHETIC_THEMES.cyberpunk.defaultNodeColor),
};

// Función de compatibilidad que devuelve directamente un THREE.Color del tema actual
export function getNodeColor(category?: string, theme: AestheticTheme = 'cyberpunk'): THREE.Color {
  const palette = AESTHETIC_THEMES[theme]?.palette || AESTHETIC_THEMES.cyberpunk.palette;
  const defaultHex = AESTHETIC_THEMES[theme]?.defaultNodeColor || '#06b6d4';

  if (!category || !palette[category]) {
    return new THREE.Color(defaultHex);
  }

  return new THREE.Color(palette[category]);
}

export function getCategoryColorHex(category?: string, theme: AestheticTheme = 'cyberpunk'): string {
  const palette = AESTHETIC_THEMES[theme]?.palette || AESTHETIC_THEMES.cyberpunk.palette;
  return (category && palette[category]) ? palette[category] : AESTHETIC_THEMES[theme].defaultNodeColor;
}

export function getCategoryColorThree(category?: string, theme: AestheticTheme = 'cyberpunk'): THREE.Color {
  return getNodeColor(category, theme);
}