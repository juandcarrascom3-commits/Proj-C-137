import { create } from 'zustand';
import { VisualStyleMode } from '../utils/visualStyles';

export interface UIState {
  activeNoteId: string;
  selectedTag: string | null;
  searchQuery: string;
  visualStyle: VisualStyleMode; // 'neon' | 'category' | 'minimal'
  showEdges: boolean;           // Visibilidad de las conexiones/aristas

  setActiveNoteId: (id: string) => void;
  setSelectedTag: (tag: string | null) => void;
  setSearchQuery: (query: string) => void;
  setVisualStyle: (style: VisualStyleMode) => void;
  cycleVisualStyle: () => void;
  toggleShowEdges: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  activeNoteId: '',
  selectedTag: null,
  searchQuery: '',
  visualStyle: 'neon',
  showEdges: true,

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
}));

export default useUIStore;