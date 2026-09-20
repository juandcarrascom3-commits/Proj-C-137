import Dexie, { type Table } from 'dexie';
import { NexusNote } from '../utils/graphParser';

export class NexusDatabase extends Dexie {
  notes!: Table<NexusNote>;

  constructor() {
    super('NexusDatabaseC137');
    
    // Esquema e índices para consultas rápidas
    this.version(1).stores({
      notes: 'id, title, category, *tags, updatedAt'
    });
  }
}

export const db = new NexusDatabase();