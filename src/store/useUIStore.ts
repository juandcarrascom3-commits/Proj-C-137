import { create } from 'zustand';

/**
 * =======================================================================
 * STORE DE INTERFAZ Y FILTROS (useUIStore)
 * =======================================================================
 * Gestiona únicamente el estado de la UI y los filtros temporales.
 * Separar esto evita que el Canvas 3D o el Worker de Físicas se
 * re-ejecuten inútilmente al teclear en el buscador o filtrar tags.
 * =======================================================================
 */

export interface UIState {
  activeNoteId: string;
  selectedTag: string | null;
  searchQuery: string;
  setActiveNoteId: (id: string) => void;
  setSelectedTag: (tag: string | null) => void;
  setSearchQuery: (query: string) => void;
}

export const useUIStore = create<UIState>((set) => ({
  activeNoteId: '',
  selectedTag: null,
  searchQuery: '',
  setActiveNoteId: (id) => set({ activeNoteId: id }),
  setSelectedTag: (tag) => set({ selectedTag: tag }),
  setSearchQuery: (query) => set({ searchQuery: query }),
}));