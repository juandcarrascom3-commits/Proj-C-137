import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { VisualStyleMode } from '../utils/visualStyles';

export type TopologyLayoutMode = 'organic' | 'spherical' | 'clustered';

export interface UIState {
  activeNoteId: string;
  selectedTag: string | null;
  searchQuery: string;
  visualStyle: VisualStyleMode;       // 'neon' | 'category' | 'minimal'
  showEdges: boolean;                 // Visibilidad de las conexiones
  topologyLayout: TopologyLayoutMode; // 'organic' | 'spherical' | 'clustered'

  setActiveNoteId: (id: string) => void;
  setSelectedTag: (tag: string | null) => void;
  setSearchQuery: (query: string) => void;
  setVisualStyle: (style: VisualStyleMode) => void;
  cycleVisualStyle: () => void;
  toggleShowEdges: () => void;
  setTopologyLayout: (layout: TopologyLayoutMode) => void;
  cycleTopologyLayout: () => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      activeNoteId: '',
      selectedTag: null,
      searchQuery: '',
      visualStyle: 'neon',
      showEdges: true,
      topologyLayout: 'organic',

      setActiveNoteId: (id) => set({ activeNoteId: id }),
      setSelectedTag: (tag) => set({ selectedTag: tag }),
      setSearchQuery: (query) => set({ searchQuery: query }),
      setVisualStyle: (style) => set({ visualStyle: style }),
      
      cycleVisualStyle: () => set((state) => {
        const modes: VisualStyleMode[] = ['neon', 'category', 'minimal'];
        const nextIndex = (modes.indexOf(state.visualStyle) + 1) % modes.length;
        return { visualStyle: modes[nextIndex] };
      }),

      toggleShowEdges: () => set((state) => ({ showEdges: !state.showEdges })),

      setTopologyLayout: (layout) => set({ topologyLayout: layout }),

      cycleTopologyLayout: () => set((state) => {
        const layouts: TopologyLayoutMode[] = ['organic', 'spherical', 'clustered'];
        const nextIndex = (layouts.indexOf(state.topologyLayout) + 1) % layouts.length;
        return { topologyLayout: layouts[nextIndex] };
      }),
    }),
    {
      name: 'nexus-ui-preferences', // Clave única en LocalStorage
      partialize: (state) => ({ 
        visualStyle: state.visualStyle, 
        showEdges: state.showEdges,
        topologyLayout: state.topologyLayout
      }), // Solo guardamos preferencias del usuario, no búsquedas o selecciones temporales
    }
  )
);

export default useUIStore;