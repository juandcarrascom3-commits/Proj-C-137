import { Graph3DNode, Graph3DLink, NexusNote, ParsedGraphResult } from '../../utils/graphParser';

export type GraphTheme = 'cyberpunk' | 'emerald' | 'amber';

export interface ThemeConfig {
  bg: string;
  primaryHex: string;
  relayHex: string;
  targetHex: string;
  primaryClass: string;
  relayClass: string;
  borderClass: string;
  textAccentClass: string;
  glowColor: string;
  starsFactor: number;
}

export const THEME_CONFIG: Record<GraphTheme, ThemeConfig> = {
  cyberpunk: {
    bg: '#020617',
    primaryHex: '#00f0ff',
    relayHex: '#7000ff',
    targetHex: '#ffffff',
    primaryClass: 'text-cyan-400 border-cyan-500/40 bg-cyan-500/10',
    relayClass: 'text-violet-400 border-violet-500/40 bg-violet-500/10',
    borderClass: 'border-cyan-500/30',
    textAccentClass: 'text-cyan-400',
    glowColor: 'rgba(0, 240, 255, 0.25)',
    starsFactor: 3.5
  },
  emerald: {
    bg: '#021814',
    primaryHex: '#10b981',
    relayHex: '#06b6d4',
    targetHex: '#ffffff',
    primaryClass: 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10',
    relayClass: 'text-teal-400 border-teal-500/40 bg-teal-500/10',
    borderClass: 'border-emerald-500/30',
    textAccentClass: 'text-emerald-400',
    glowColor: 'rgba(16, 185, 129, 0.25)',
    starsFactor: 3.0
  },
  amber: {
    bg: '#120b02',
    primaryHex: '#f59e0b',
    relayHex: '#f43f5e',
    targetHex: '#ffffff',
    primaryClass: 'text-amber-400 border-amber-500/40 bg-amber-500/10',
    relayClass: 'text-rose-400 border-rose-500/40 bg-rose-500/10',
    borderClass: 'border-amber-500/30',
    textAccentClass: 'text-amber-400',
    glowColor: 'rgba(245, 158, 11, 0.25)',
    starsFactor: 3.2
  }
};

export type { Graph3DNode, Graph3DLink, NexusNote, ParsedGraphResult };
