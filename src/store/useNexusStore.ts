import { create } from 'zustand';
import { NexusNote } from '../utils/graphParser';
import { MOCK_NEXUS_NOTES } from '../data/mockNotes';

/**
 * =======================================================================
 * STORE GLOBAL REACTIVO NEXUS (Zustand)
 * =======================================================================
 * Gestiona el estado centralizado de notas Obsidian/Markdown, el nodo
 * activo para la cámara 3D C-137 y filtros de búsqueda.
 */

export interface NexusState {
  notes: NexusNote[];
  activeNoteId: string;
  selectedTag: string | null;
  searchQuery: string;
  
  // Acciones
  setActiveNoteId: (id: string) => void;
  setSelectedTag: (tag: string | null) => void;
  setSearchQuery: (query: string) => void;
  addNote: (note: Omit<NexusNote, 'id' | 'updatedAt'>) => string;
  updateNote: (id: string, updates: Partial<NexusNote>) => void;
  deleteNote: (id: string) => void;
  getActiveNote: () => NexusNote | undefined;
}

export const useNexusStore = create<NexusState>((set, get) => ({
  notes: MOCK_NEXUS_NOTES,
  activeNoteId: 'note-001',
  selectedTag: null,
  searchQuery: '',

  setActiveNoteId: (id: string) => set({ activeNoteId: id }),
  setSelectedTag: (tag: string | null) => set({ selectedTag: tag }),
  setSearchQuery: (query: string) => set({ searchQuery: query }),

  addNote: (newNoteData) => {
    const id = `note-${Date.now().toString().slice(-4)}`;
    const newNote: NexusNote = {
      ...newNoteData,
      id,
      updatedAt: new Date().toISOString().split('T')[0]
    };
    set((state) => ({
      notes: [newNote, ...state.notes],
      activeNoteId: id
    }));
    return id;
  },

  updateNote: (id, updates) => {
    set((state) => ({
      notes: state.notes.map((n) =>
        n.id === id ? { ...n, ...updates, updatedAt: new Date().toISOString().split('T')[0] } : n
      )
    }));
  },

  deleteNote: (id) => {
    set((state) => {
      const remaining = state.notes.filter((n) => n.id !== id);
      return {
        notes: remaining,
        activeNoteId: state.activeNoteId === id && remaining.length > 0 ? remaining[0].id : state.activeNoteId
      };
    });
  },

  getActiveNote: () => {
    const { notes, activeNoteId } = get();
    return notes.find((n) => n.id === activeNoteId);
  }
}));
