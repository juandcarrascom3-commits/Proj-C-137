import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { 
  VisualStyleMode, 
  AestheticTheme, 
  AESTHETIC_THEMES 
} from '../utils/visualStyles';

export type TopologyLayoutMode = 'organic' | 'spherical' | 'clustered';

export interface UIState {
  activeNoteId: string;
  selectedTag: string | null;
  searchQuery: string;
  visualStyle: VisualStyleMode;       // 'neon' | 'category' | 'minimal'
  aestheticTheme: AestheticTheme;     // Rotación de los 10 temas
  showEdges: boolean;                 // Visibilidad de las conexiones
  topologyLayout: TopologyLayoutMode; // 'organic' | 'spherical' | 'clustered'
  glowIntensity: number;              // Intensidad del glow (0.1–2.5)

  setActiveNoteId: (id: string) => void;
  setSelectedTag: (tag: string | null) => void;
  setSearchQuery: (query: string) => void;
  setVisualStyle: (style: VisualStyleMode) => void;
  cycleVisualStyle: () => void;
  setAestheticTheme: (theme: AestheticTheme) => void;
  cycleAestheticTheme: () => void;    // Cicla entre los 10 temas de visualStyles.ts
  toggleShowEdges: () => void;
  setTopologyLayout: (layout: TopologyLayoutMode) => void;
  cycleTopologyLayout: () => void;
  setGlowIntensity: (value: number) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      activeNoteId: '',
      selectedTag: null,
      searchQuery: '',
      visualStyle: 'neon',
      aestheticTheme: 'cyberpunk',
      showEdges: true,
      topologyLayout: 'organic',
      glowIntensity: 1,

      setActiveNoteId: (id) => set({ activeNoteId: id }),
      setSelectedTag: (tag) => set({ selectedTag: tag }),
      setSearchQuery: (query) => set({ searchQuery: query }),
      setVisualStyle: (style) => set({ visualStyle: style }),
      
      cycleVisualStyle: () => set((state) => {
        const modes: VisualStyleMode[] = ['neon', 'category', 'minimal'];
        const nextIndex = (modes.indexOf(state.visualStyle) + 1) % modes.length;
        return { visualStyle: modes[nextIndex] };
      }),

      setAestheticTheme: (theme) => set({ aestheticTheme: theme }),

      cycleAestheticTheme: () => set((state) => {
        const themes = Object.keys(AESTHETIC_THEMES) as AestheticTheme[];
        const nextIndex = (themes.indexOf(state.aestheticTheme) + 1) % themes.length;
        return { aestheticTheme: themes[nextIndex] };
      }),

      toggleShowEdges: () => set((state) => ({ showEdges: !state.showEdges })),

      setTopologyLayout: (layout) => set({ topologyLayout: layout }),

      cycleTopologyLayout: () => set((state) => {
        const layouts: TopologyLayoutMode[] = ['organic', 'spherical', 'clustered'];
        const nextIndex = (layouts.indexOf(state.topologyLayout) + 1) % layouts.length;
        return { topologyLayout: layouts[nextIndex] };
      }),

      setGlowIntensity: (value) =>
        set({ glowIntensity: Math.min(2.5, Math.max(0.1, value)) }),
    }),
    {
      name: 'nexus-ui-preferences', // Clave única en LocalStorage
      partialize: (state) => ({ 
        visualStyle: state.visualStyle,
        aestheticTheme: state.aestheticTheme,
        showEdges: state.showEdges,
        topologyLayout: state.topologyLayout,
        glowIntensity: state.glowIntensity,
      }), // Persiste las preferencias visuales del usuario sin afectar búsquedas o selecciones
    }
  )
);

export default useUIStore;