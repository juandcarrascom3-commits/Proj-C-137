import { create } from 'zustand';
import { NexusNote } from '../utils/graphParser';
import { useUIStore } from './useUIStore';

export interface NodeSpatialCoord {
  x: number;
  y: number;
  z: number;
  vx?: number;
  vy?: number;
  vz?: number;
}

export interface NexusDataState {
  notes: NexusNote[];
  savedPositions: Record<string, NodeSpatialCoord>;

  // Métodos de Posiciones 3D
  saveNodePositions: (positions: Record<string, NodeSpatialCoord>) => void;
  getNodePosition: (slug: string) => NodeSpatialCoord | undefined;
  getNoteById: (id: string) => NexusNote | undefined;

  // CRUD de Notas (Topología)
  addNote: (note: Omit<NexusNote, 'id' | 'updatedAt'>) => string;
  updateNote: (id: string, updates: Partial<NexusNote>) => void;
  deleteNote: (id: string) => void;

  // Pruebas de Carga
  injectTestNodes: (count: number) => void;
  clearTestNodes: () => void;
}

// Generador procedural intacto (Mantiene exactamente el padding de ceros)
const CLUSTERS = ['Alpha', 'Vega', 'Orion', 'Sirius', 'Cygnus', 'Pulsar'];
const CATEGORIES = ['Arquitectura', 'Física', 'Protocolo', 'Datos', 'Red', 'Memoria'];

function generateTestNotes(count: number): NexusNote[] {
  const notes: NexusNote[] = [];

  for (let i = 0; i < count; i++) {
    const cluster = CLUSTERS[i % CLUSTERS.length];
    const category = CATEGORIES[i % CATEGORIES.length];
    const clusterSize = Math.ceil(count / CLUSTERS.length);
    const peerStart = Math.floor(i / clusterSize) * clusterSize;
    const peerEnd = Math.min(peerStart + clusterSize, count);

    const links: string[] = [];
    for (let j = 1; j <= 3; j++) {
      const peerId = peerStart + ((i - peerStart + j) % (peerEnd - peerStart));
      if (peerId !== i) {
        links.push(`[[stress-${peerId.toString().padStart(4, '0')}]]`);
      }
    }

    notes.push({
      id: `stress-${i.toString().padStart(4, '0')}`,
      title: `${cluster}-Node-${i.toString().padStart(3, '0')}`,
      category,
      tags: [cluster.toLowerCase(), category.toLowerCase(), 'stress-test'],
      updatedAt: new Date().toISOString().split('T')[0],
      content: `# ${cluster}-Node-${i}\n\nNodo de prueba de carga en cluster ${cluster}.\n\nConexiones: ${links.join(', ')}\n\nCategoría: **${category}**`,
    });
  }

  return notes;
}

export const useNexusStore = create<NexusDataState>((set, get) => ({
  notes: [],
  savedPositions: {},

  saveNodePositions: (positions) => {
    set((state) => ({
      savedPositions: {
        ...state.savedPositions,
        ...positions,
      },
    }));
  },

  getNodePosition: (slug) => get().savedPositions[slug],

  getNoteById: (id) => get().notes.find((n) => n.id === id),

  addNote: (newNoteData) => {
    const id = `note-${Date.now().toString().slice(-6)}`;
    const newNote: NexusNote = {
      ...newNoteData,
      id,
      updatedAt: new Date().toISOString().split('T')[0],
    };
    set((state) => ({
      notes: [newNote, ...state.notes],
    }));
    
    // Activa automáticamente la nueva nota en el store de UI
    useUIStore.getState().setActiveNoteId(id);
    return id;
  },

  updateNote: (id, updates) => {
    set((state) => ({
      notes: state.notes.map((n) =>
        n.id === id
          ? { ...n, ...updates, updatedAt: new Date().toISOString().split('T')[0] }
          : n
      ),
    }));
  },

  deleteNote: (id) => {
    set((state) => {
      const remaining = state.notes.filter((n) => n.id !== id);
      const remainingPositions = { ...state.savedPositions };
      delete remainingPositions[id];

      // Sincroniza la selección de UI si se borró la nota que estaba activa
      const currentActiveId = useUIStore.getState().activeNoteId;
      if (currentActiveId === id) {
        const nextActiveId = remaining.length > 0 ? remaining[0].id : '';
        useUIStore.getState().setActiveNoteId(nextActiveId);
      }

      return {
        notes: remaining,
        savedPositions: remainingPositions,
      };
    });
  },

  injectTestNodes: (count: number) => {
    const safeCount = Math.max(10, Math.min(count, 500));
    const testNotes = generateTestNotes(safeCount);
    set((state) => {
      const realNotes = state.notes.filter((n) => !n.id.startsWith('stress-'));
      
      const currentActiveId = useUIStore.getState().activeNoteId;
      if (!currentActiveId && testNotes.length > 0) {
        useUIStore.getState().setActiveNoteId(testNotes[0].id);
      }

      return {
        notes: [...realNotes, ...testNotes],
      };
    });
  },

  clearTestNodes: () => {
    set((state) => ({
      notes: state.notes.filter((n) => !n.id.startsWith('stress-')),
    }));
  },
}));