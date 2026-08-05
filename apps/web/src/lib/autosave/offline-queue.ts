import type { WhiteboardDocument } from '@whiteboard/shared';

/**
 * One pending document snapshot waiting to be flushed to the server. A board
 * keeps at most a single draft (the latest), so rapid edits while offline only
 * ever re-serialize the newest state (ADR-0005 "offline mutation queue").
 */
export interface AutosaveDraft {
  boardId: string;
  document: WhiteboardDocument;
  /** Server revision the draft is based on; `null` when unknown yet. */
  baseRevision: number | null;
  updatedAt: number;
}

const DB_NAME = 'whiteboard-autosave';
const DB_VERSION = 1;
const STORE_NAME = 'autosave-drafts';

interface QueueBackend {
  set(draft: AutosaveDraft): Promise<void>;
  get(boardId: string): Promise<AutosaveDraft | null>;
  delete(boardId: string): Promise<void>;
  keys(): Promise<string[]>;
}

// ---------------------------------------------------------------------------
// In-memory fallback (SSR, tests, private-browsing IDB failures)
// ---------------------------------------------------------------------------

class MemoryBackend implements QueueBackend {
  private readonly drafts = new Map<string, AutosaveDraft>();

  async set(draft: AutosaveDraft): Promise<void> {
    this.drafts.set(draft.boardId, draft);
  }

  async get(boardId: string): Promise<AutosaveDraft | null> {
    return this.drafts.get(boardId) ?? null;
  }

  async delete(boardId: string): Promise<void> {
    this.drafts.delete(boardId);
  }

  async keys(): Promise<string[]> {
    return [...this.drafts.keys()];
  }
}

// ---------------------------------------------------------------------------
// IndexedDB backend
// ---------------------------------------------------------------------------

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'boardId' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function idbRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

class IndexedDbBackend implements QueueBackend {
  private readonly ready: Promise<IDBDatabase> | null;

  constructor(open: Promise<IDBDatabase> | null) {
    this.ready = open;
  }

  async set(draft: AutosaveDraft): Promise<void> {
    const db = await this.requireDb();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(draft);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async get(boardId: string): Promise<AutosaveDraft | null> {
    const db = await this.requireDb();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const result = await idbRequest(store.get(boardId));
    return (result as AutosaveDraft | undefined) ?? null;
  }

  async delete(boardId: string): Promise<void> {
    const db = await this.requireDb();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(boardId);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async keys(): Promise<string[]> {
    const db = await this.requireDb();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const all = await idbRequest(store.getAllKeys());
    return all.map((key) => String(key));
  }

  private async requireDb(): Promise<IDBDatabase> {
    if (this.ready === null) {
      throw new Error('IndexedDB is unavailable');
    }
    return this.ready;
  }
}

function resolveBackend(): QueueBackend {
  if (typeof indexedDB === 'undefined') {
    return new MemoryBackend();
  }
  try {
    return new IndexedDbBackend(openDatabase());
  } catch {
    return new MemoryBackend();
  }
}

let backend: QueueBackend | null = null;

function getBackend(): QueueBackend {
  if (backend === null) {
    backend = resolveBackend();
  }
  return backend;
}

/** True when drafts survive a page reload (IndexedDB, not the memory shim). */
export function isQueuePersistent(): boolean {
  return getBackend() instanceof IndexedDbBackend;
}

export const offlineQueue = {
  /** Stores the latest draft for a board, replacing any older one. */
  async set(
    boardId: string,
    draft: Omit<AutosaveDraft, 'boardId'>,
  ): Promise<void> {
    await getBackend().set({ boardId, ...draft });
  },

  async get(boardId: string): Promise<AutosaveDraft | null> {
    return getBackend().get(boardId);
  },

  async clear(boardId: string): Promise<void> {
    await getBackend().delete(boardId);
  },

  /** All boards with at least one pending draft (used to flush on reconnect). */
  async list(): Promise<string[]> {
    return getBackend().keys();
  },
};
