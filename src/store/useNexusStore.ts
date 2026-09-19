import { create } from 'zustand';
import { NexusNote } from '../utils/graphParser';

/**
 * =======================================================================
 * STORE GLOBAL REACTIVO NEXUS (Zustand)
 * =======================================================================
 * Gestiona el estado centralizado de notas Obsidian/Markdown, el nodo
 * activo para la cámara 3D C-137 y filtros de búsqueda.
 *
 * ⚠️ DATOS REALES ÚNICAMENTE: El store ya NO incluye datos sintéticos.
 * Si el sistema arranca sin notas, el grafo muestra un estado vacío limpio.
 * Para pruebas de carga usa la acción `injectTestNodes(count)`.
 * =======================================================================
 */

export interface NodeSpatialCoord {
  x: number;
  y: number;
  z: number;
  vx?: number;
  vy?: number;
  vz?: number;
}

export interface NexusState {
  notes: NexusNote[];
  activeNoteId: string;
  selectedTag: string | null;
  searchQuery: string;
  savedPositions: Record<string, NodeSpatialCoord>;

  // Acciones CRUD
  setActiveNoteId: (id: string) => void;
  setSelectedTag: (tag: string | null) => void;
  setSearchQuery: (query: string) => void;
  addNote: (note: Omit<NexusNote, 'id' | 'updatedAt'>) => string;
  updateNote: (id: string, updates: Partial<NexusNote>) => void;
  deleteNote: (id: string) => void;
  saveNodePositions: (positions: Record<string, NodeSpatialCoord>) => void;
  getActiveNote: () => NexusNote | undefined;
  getNodePosition: (slug: string) => NodeSpatialCoord | undefined;

  /**
   * Escalador de carga visual: inyecta `count` notas procedurales conectadas
   * al estado para poner a prueba el rendimiento del grafo sin colapsar el
   * hilo principal. Opciones: 100 | 300 | 500.
   */
  injectTestNodes: (count: number) => void;

  /** Elimina todas las notas de prueba inyectadas (prefijo 'stress-') */
  clearTestNodes: () => void;
}

// ---------------------------------------------------------------------------
// Generador procedural de notas de estrés
// ---------------------------------------------------------------------------
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

    // Cada nodo enlaza con ~3 vecinos dentro de su clúster
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

// ---------------------------------------------------------------------------
// Estado inicial limpio (sin mocks)
// ---------------------------------------------------------------------------
export const useNexusStore = create<NexusState>((set, get) => ({
  // Estado inicial real: vacío. C137GraphView comprueba notas.length y muestra
  // el grafo si hay datos, o un placeholder si no los hay.
  notes: [],
  activeNoteId: '',
  selectedTag: null,
  searchQuery: '',
  savedPositions: {},

  setActiveNoteId: (id: string) => set({ activeNoteId: id }),
  setSelectedTag: (tag: string | null) => set({ selectedTag: tag }),
  setSearchQuery: (query: string) => set({ searchQuery: query }),

  saveNodePositions: (positions) => {
    set((state) => ({
      savedPositions: {
        ...state.savedPositions,
        ...positions,
      },
    }));
  },

  getNodePosition: (slug) => {
    return get().savedPositions[slug];
  },

  addNote: (newNoteData) => {
    const id = `note-${Date.now().toString().slice(-6)}`;
    const newNote: NexusNote = {
      ...newNoteData,
      id,
      updatedAt: new Date().toISOString().split('T')[0],
    };
    set((state) => ({
      notes: [newNote, ...state.notes],
      activeNoteId: id,
    }));
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
      return {
        notes: remaining,
        savedPositions: remainingPositions,
        activeNoteId:
          state.activeNoteId === id && remaining.length > 0
            ? remaining[0].id
            : state.activeNoteId,
      };
    });
  },

  getActiveNote: () => {
    const { notes, activeNoteId } = get();
    return notes.find((n) => n.id === activeNoteId);
  },

  injectTestNodes: (count: number) => {
    const safeCount = Math.max(10, Math.min(count, 500));
    const testNotes = generateTestNotes(safeCount);
    set((state) => {
      // Elimina notas de estrés previas antes de inyectar las nuevas
      const realNotes = state.notes.filter((n) => !n.id.startsWith('stress-'));
      return {
        notes: [...realNotes, ...testNotes],
        activeNoteId: state.activeNoteId || (testNotes[0]?.id ?? ''),
      };
    });
  },

  clearTestNodes: () => {
    set((state) => ({
      notes: state.notes.filter((n) => !n.id.startsWith('stress-')),
    }));
  },
}));
