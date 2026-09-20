import { create } from 'zustand';
import { NexusNote } from '../utils/graphParser';
import { useUIStore } from './useUIStore';
import { db } from '../db/nexusDatabase';

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
  isDbLoaded: boolean;

  // Carga e Hidratación desde IndexedDB
  loadNotesFromDB: () => Promise<void>;

  // Métodos de Posiciones 3D
  saveNodePositions: (positions: Record<string, NodeSpatialCoord>) => void;
  getNodePosition: (slug: string) => NodeSpatialCoord | undefined;
  getNoteById: (id: string) => NexusNote | undefined;

  // CRUD de Notas (Topología + Persistencia Dexie)
  addNote: (note: Omit<NexusNote, 'id' | 'updatedAt'>) => Promise<string>;
  updateNote: (id: string, updates: Partial<NexusNote>) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;

  // Pruebas de Carga (Persistentes)
  injectTestNodes: (count: number) => Promise<void>;
  clearTestNodes: () => Promise<void>;
}

const CLUSTERS = ['Alpha', 'Vega', 'Orion', 'Sirius', 'Cygnus', 'Pulsar', 'Andromeda', 'Centauri'];
const CATEGORIES = ['Arquitectura', 'Física', 'Protocolo', 'Datos', 'Red', 'Memoria'];

function generateTestNotes(count: number): NexusNote[] {
  const notes: NexusNote[] = [];

  for (let i = 0; i < count; i++) {
    const cluster = CLUSTERS[i % CLUSTERS.length];
    const category = CATEGORIES[i % CATEGORIES.length];
    
    // Conexiones asimétricas y orgánicas
    const clusterSize = Math.ceil(count / CLUSTERS.length);
    const peerStart = Math.floor(i / clusterSize) * clusterSize;
    const peerEnd = Math.min(peerStart + clusterSize, count);

    const links: string[] = [];
    const linkCount = Math.floor(Math.random() * 4) + 1;

    for (let j = 1; j <= linkCount; j++) {
      // 70% conexiones dentro del mismo cluster, 30% puentes inter-cluster
      let peerId: number;
      if (Math.random() < 0.7 && peerEnd > peerStart) {
        peerId = peerStart + Math.floor(Math.random() * (peerEnd - peerStart));
      } else {
        peerId = Math.floor(Math.random() * count);
      }

      if (peerId !== i) {
        const linkTag = `[[stress-${peerId.toString().padStart(4, '0')}]]`;
        if (!links.includes(linkTag)) {
          links.push(linkTag);
        }
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
  isDbLoaded: false,

  loadNotesFromDB: async () => {
    try {
      const allNotes = await db.notes.toArray();
      set({ notes: allNotes, isDbLoaded: true });
    } catch (err) {
      console.error('[Dexie IndexedDB] Error al cargar notas:', err);
      set({ isDbLoaded: true });
    }
  },

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

  addNote: async (newNoteData) => {
    const id = `note-${Date.now().toString().slice(-6)}`;
    const newNote: NexusNote = {
      ...newNoteData,
      id,
      updatedAt: new Date().toISOString().split('T')[0],
    };

    await db.notes.add(newNote);

    set((state) => ({
      notes: [newNote, ...state.notes],
    }));

    useUIStore.getState().setActiveNoteId(id);
    return id;
  },

  updateNote: async (id, updates) => {
    const updatedFields = {
      ...updates,
      updatedAt: new Date().toISOString().split('T')[0],
    };

    await db.notes.update(id, updatedFields);

    set((state) => ({
      notes: state.notes.map((n) =>
        n.id === id ? { ...n, ...updatedFields } : n
      ),
    }));
  },

  deleteNote: async (id) => {
    await db.notes.delete(id);

    set((state) => {
      const remaining = state.notes.filter((n) => n.id !== id);
      const remainingPositions = { ...state.savedPositions };
      delete remainingPositions[id];

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

  injectTestNodes: async (count: number) => {
  // Cambia el limite maximo de 500 a 1500
  const safeCount = Math.max(10, Math.min(count, 1500));
  const testNotes = generateTestNotes(safeCount);

  const existingStressKeys = (await db.notes.toArray())
    .filter((n) => n.id.startsWith('stress-'))
    .map((n) => n.id);

  if (existingStressKeys.length > 0) {
    await db.notes.bulkDelete(existingStressKeys);
  }

  await db.notes.bulkPut(testNotes);
  const allNotes = await db.notes.toArray();

  set({ notes: allNotes });
},

  clearTestNodes: async () => {
    const stressKeys = (await db.notes.toArray())
      .filter((n) => n.id.startsWith('stress-'))
      .map((n) => n.id);

    if (stressKeys.length > 0) {
      await db.notes.bulkDelete(stressKeys);
    }

    set((state) => ({
      notes: state.notes.filter((n) => !n.id.startsWith('stress-')),
    }));
  },
}));