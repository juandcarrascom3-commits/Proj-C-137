import * as THREE from 'three';

export interface CategoryColorEntry {
  hex: string;
  color: THREE.Color;
}

/** Paleta neón canónica alineada con los centroides estelares del worker. */
export const CATEGORY_COLORS: Record<string, CategoryColorEntry> = {
  Arquitectura: { hex: '#06b6d4', color: new THREE.Color('#06b6d4') },
  Física: { hex: '#a855f7', color: new THREE.Color('#a855f7') },
  Protocolo: { hex: '#f97316', color: new THREE.Color('#f97316') },
  Datos: { hex: '#ec4899', color: new THREE.Color('#ec4899') },
  Red: { hex: '#10b981', color: new THREE.Color('#10b981') },
  Memoria: { hex: '#3b82f6', color: new THREE.Color('#3b82f6') },
  IA: { hex: '#facc15', color: new THREE.Color('#facc15') },
  Cuántico: { hex: '#00f0ff', color: new THREE.Color('#00f0ff') },
};

export const DEFAULT_NODE_HEX = '#06b6d4';

/** Compatibilidad: mapa { hex, rgb } para consumidores previos. */
export const CATEGORY_PALETTE: Record<string, string> = Object.fromEntries(
  Object.entries(CATEGORY_COLORS).map(([key, value]) => [key, value.hex])
);

export function getNodeColor(category?: string): THREE.Color {
  if (category && CATEGORY_COLORS[category]) {
    return CATEGORY_COLORS[category].color.clone();
  }
  return new THREE.Color(DEFAULT_NODE_HEX);
}

export function getCategoryColorHex(category?: string): string {
  if (category && CATEGORY_COLORS[category]) {
    return CATEGORY_COLORS[category].hex;
  }
  return DEFAULT_NODE_HEX;
}

export function getCategoryColorThree(category?: string): THREE.Color {
  return getNodeColor(category);
}
