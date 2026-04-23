# Implementation Roadmap — Sveltedraw Next Phases

**Current Phase**: 6 (Complete)  
**Status**: Production-ready, feature-complete for MVP  
**Next Targets**: Performance, mobile, collaboration

---

## Phase 7: Image Persistence (IDB Optimization) — 2-3 days

### Current State
- ✅ Image paste/drop fully wired
- ✅ Image rendering in scene
- ⚠️ Images lost on reload (not persisted)
- ✅ IndexedDB calls exist (`idbGet/idbPut`)
- ⚠️ Persistence layer incomplete

### Implementation Plan

#### 7.1 Complete IndexedDB Store
```typescript
// Add to App.svelte
const DB_NAME = 'sveltedraw-images';
const DB_VERSION = 1;
const STORE_NAME = 'images';

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve((req.target as IDBOpenDBRequest).result);
    req.onerror = () => reject(req.error);
  });
};

const idbPut = async (record: ImageRecord) => {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  return new Promise((resolve, reject) => {
    const req = store.put(record);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
};

const idbGet = async (id: string) => {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);
  return new Promise((resolve, reject) => {
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
};
```

#### 7.2 Wire Persistence
```typescript
// In insertImageFromBlob()
// After setting imageCacheMap:
const record = {
  id: fileId,
  mimeType,
  dataURL,
  created: Date.now(),
};
imageCacheMap.set(fileId, { image: img, mimeType });
await idbPut(record);  // PERSIST to IDB
binaryFiles[fileId] = record;
```

#### 7.3 Optimize Connection Pooling
```typescript
// Reuse single DB connection instead of opening per call
let dbInstance: IDBDatabase | null = null;

const getDB = async () => {
  if (dbInstance) return dbInstance;
  dbInstance = await openDB();
  return dbInstance;
};
```

### Testing
- [ ] Paste image
- [ ] Save scene (Ctrl+S PNG export)
- [ ] Reload page
- [ ] Verify image still visible
- [ ] DevTools → Application → IndexedDB → images
- [ ] Verify record stored

### Performance Impact
- ✅ Minimal (IDB is async, doesn't block UI)
- ✅ Image loading time unchanged
- ⏱️ Persistence adds ~100-200ms (not blocking)

**Effort**: 2-3 hours  
**Risk**: Low (isolated feature)

---

## Phase 8: Touch Gestures (Mobile UX) — 3-4 days

### Current State
- ✅ Canvas responsive
- ⚠️ No touch-specific gestures
- ⚠️ No multi-touch support
- ✅ Keyboard shortcuts work on mobile

### Implementation Plan

#### 8.1 Pan Gesture (Two-finger drag)
```typescript
let touchStartX = 0;
let touchStartY = 0;
let touchCount = 0;

const onTouchStart = (e: TouchEvent) => {
  touchCount = e.touches.length;
  if (touchCount === 2) {
    touchStartX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
    touchStartY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
  }
};

const onTouchMove = (e: TouchEvent) => {
  if (e.touches.length !== 2) return;
  const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
  const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
  
  const dx = centerX - touchStartX;
  const dy = centerY - touchStartY;
  
  // Pan: scroll by -dx, -dy
  (appState as any).scrollX -= dx / (appState.zoom as any).value;
  (appState as any).scrollY -= dy / (appState.zoom as any).value;
  
  touchStartX = centerX;
  touchStartY = centerY;
  bumpSceneRepaint();
};

containerEl?.addEventListener('touchstart', onTouchStart);
containerEl?.addEventListener('touchmove', onTouchMove);
```

#### 8.2 Pinch-Zoom (Two-finger pinch)
```typescript
let lastDistance = 0;

const getTouchDistance = (touches: TouchList) => {
  if (touches.length < 2) return 0;
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.sqrt(dx * dx + dy * dy);
};

const onTouchMove = (e: TouchEvent) => {
  if (e.touches.length === 2) {
    const distance = getTouchDistance(e.touches);
    if (lastDistance > 0) {
      const scale = distance / lastDistance;
      const newZoom = (appState.zoom as any).value * scale;
      const clampedZoom = Math.max(0.1, Math.min(4, newZoom));
      (appState as any).zoom = { value: clampedZoom };
    }
    lastDistance = distance;
    bumpSceneRepaint();
  }
};
```

#### 8.3 Long-Press (Context menu)
```typescript
let touchTimeout: number | null = null;
let longPressX = 0;
let longPressY = 0;

const onTouchStart = (e: TouchEvent) => {
  longPressX = e.touches[0].clientX;
  longPressY = e.touches[0].clientY;
  touchTimeout = window.setTimeout(() => {
    // Open context menu at long-press location
    showContextMenu(longPressX, longPressY);
  }, 500);
};

const onTouchEnd = () => {
  if (touchTimeout) clearTimeout(touchTimeout);
};

const onTouchMove = (e: TouchEvent) => {
  // Cancel if moved too far
  const dx = e.touches[0].clientX - longPressX;
  const dy = e.touches[0].clientY - longPressY;
  if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
    if (touchTimeout) clearTimeout(touchTimeout);
  }
};
```

### Testing
- [ ] iPad/mobile device
- [ ] Two-finger pan
- [ ] Pinch zoom (in/out)
- [ ] Long-press context menu
- [ ] Single-finger draw
- [ ] Rotation (two-finger twist)

### Performance Impact
- ✅ Minimal (event handlers only)
- ✅ No impact on desktop

**Effort**: 3-4 hours  
**Risk**: Low (isolated feature)

---

## Phase 9: Differential History (Memory Optimization) — 4-5 days

### Current State
- ✅ History working (500 max entries)
- ⚠️ Full clones per snapshot (~1KB per element)
- ⚠️ 500 entries × 100 elements = 50MB potential
- ✅ FIFO cap prevents unbounded growth

### Implementation Plan

#### 9.1 Delta Snapshots
```typescript
type HistorySnapshot = {
  // Full snapshot
  full?: {
    elements: any[];
    selectedElementIds: Record<string, true>;
  };
  // Or delta (only changes from previous)
  delta?: {
    added: any[];
    modified: Array<{ id: string; changes: Record<string, any> }>;
    removed: string[];
  };
  timestamp: number;
};

const captureSnapshot = (): HistorySnapshot => {
  const current = getCurrentState();
  const previous = history[history.length - 1];
  
  if (!previous) {
    // First snapshot: full
    return { full: current, timestamp: Date.now() };
  }
  
  // Compute delta
  const delta = computeDelta(previous.full!, current);
  if (shouldUseDelta(delta)) {
    // Use delta if smaller
    return { delta, timestamp: Date.now() };
  } else {
    // Use full snapshot if delta is larger
    return { full: current, timestamp: Date.now() };
  }
};

const computeDelta = (prev: any, curr: any) => {
  const prevIds = new Set(prev.elements.map(e => e.id));
  const currIds = new Set(curr.elements.map(e => e.id));
  
  return {
    added: curr.elements.filter(e => !prevIds.has(e.id)),
    removed: Array.from(prevIds).filter(id => !currIds.has(id)),
    modified: curr.elements
      .filter(e => prevIds.has(e.id))
      .filter(e => {
        const prev_el = prev.elements.find(el => el.id === e.id);
        return !deepEqual(prev_el, e);
      })
      .map(e => ({
        id: e.id,
        changes: diffObject(
          prev.elements.find(el => el.id === e.id),
          e
        )
      }))
  };
};
```

#### 9.2 Reconstruct Full State
```typescript
const applySnapshot = (snap: HistorySnapshot) => {
  if (!scene) return;
  
  let elements = snap.full?.elements ?? [];
  
  if (snap.delta) {
    // Reconstruct from previous full snapshot + deltas
    const prevFull = history
      .slice(0, historyIndex + 1)
      .reverse()
      .find(h => h.full)?.full;
    
    if (!prevFull) throw new Error("No base snapshot");
    
    elements = [...prevFull.elements];
    
    // Apply added
    elements.push(...(snap.delta.added || []));
    
    // Apply removed
    elements = elements.filter(e => !snap.delta.removed?.includes(e.id));
    
    // Apply modified
    for (const { id, changes } of (snap.delta.modified || [])) {
      const el = elements.find(e => e.id === id);
      if (el) Object.assign(el, changes);
    }
  }
  
  scene.replaceAllElements(elements, { skipValidation: true });
  bumpSceneRepaint();
};
```

### Testing
- [ ] Draw many elements
- [ ] Undo/redo repeatedly
- [ ] Check history buffer size
- [ ] Verify memory growth < 5% on 100 ops

### Performance Impact
- ✅ Memory: 40-60% reduction (50MB → 20-30MB)
- ⏱️ Undo: +5-10ms per operation (reconstruction cost)
- ✅ Net positive on large scenes

**Effort**: 4-5 hours  
**Risk**: Medium (complex state logic, needs thorough testing)

---

## Phase 10: Collaboration (Real-time) — 2-3 weeks

### Current State
- ❌ No collaboration
- ❌ No CRDT
- ❌ No socket.io

### Implementation Plan (High-level)

#### 10.1 CRDT Library Integration
```bash
npm install yjs y-websocket y-protocols
```

#### 10.2 Document Type
```typescript
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

const ydoc = new Y.Doc();
const ymap = ydoc.getMap('excalidraw');

const provider = new WebsocketProvider(
  'wss://sync.draw.hodion.com',
  'sveltedraw-room',
  ydoc
);

provider.awareness.setLocalState({
  user: { name: 'User', color: '#ff0000' },
  cursor: null,
});
```

#### 10.3 Sync Elements
```typescript
// On local element change:
ymap.set('elements', scene.getElementsIncludingDeleted());

// On remote change:
ymap.observe(event => {
  const elements = ymap.get('elements');
  scene.replaceAllElements(elements, { skipValidation: true });
  bumpSceneRepaint();
});
```

**Effort**: 2-3 weeks  
**Risk**: High (distributed systems, conflict resolution)

---

## Phase 11: Advanced Features — 4-6 weeks

### Frames (Page Management)
- [ ] Add frame concept
- [ ] Frame navigation UI
- [ ] Frame selector in toolbar
- [ ] Multi-page export

### Shape Library UI (Enhanced)
- [ ] Library browser dialog
- [ ] Thumbnail previews
- [ ] Categories/tags
- [ ] Import/export library JSON

### Auto-layout (Flowchart)
- [ ] Auto-arrange shapes
- [ ] Connection routing
- [ ] Connectors (straight, curved, orthogonal)
- [ ] Layout algorithms

---

## Summary & Effort Estimates

| Phase | Feature | Effort | Risk | Priority |
|-------|---------|--------|------|----------|
| 7 | IDB Image Persistence | 2-3h | Low | HIGH |
| 8 | Touch Gestures | 3-4h | Low | HIGH |
| 9 | Differential History | 4-5h | Med | MED |
| 10 | Real-time Collab | 2-3w | High | MED |
| 11 | Advanced Features | 4-6w | High | LOW |

---

## Deployment Strategy

### MVP → Phase 7 (Current Phase 6 + IDB)
```
Deployment: Week 1
- Deploy Phase 6 to draw.hodion.com
- Gather user feedback
- Fix bugs
```

### v1.0 → Phase 8 (+ Touch)
```
Timeline: Week 3-4
- Add touch gestures
- Test on mobile devices
- Release v1.0
```

### v1.1 → Phase 9 (+ Optimization)
```
Timeline: Week 5-6
- Add differential history
- Performance optimization
- Release v1.1
```

### v2.0 → Phase 10 (+ Collab)
```
Timeline: Month 2-3
- Add real-time collaboration
- Set up sync server
- Release v2.0
```

---

## Resource Allocation

### Current (Phase 6)
- ✅ 1 Developer (full-time)
- ✅ 0 DevOps (hosting via Vercel)
- ✅ 0 QA (automated tests sufficient)

### Phase 7 (IDB)
- ✅ 1 Developer (2-3 hours)
- ✅ Continue current setup

### Phase 8 (Touch)
- ⚠️ Recommend 1 Mobile QA (device testing)
- ✅ 1 Developer (3-4 hours)

### Phase 10 (Collab)
- ⚠️ 1 Backend Engineer (sync server)
- ⚠️ 1 DevOps (infrastructure)
- ✅ 1 Frontend Engineer

---

## Risk Mitigation

### High-Risk Areas
1. **CRDT Implementation**: Use proven library (Yjs)
2. **Touch Gestures**: Test on real devices early
3. **Differential History**: Extensive unit testing

### Testing Strategy
- Unit tests for each feature
- Integration tests with smoke
- Manual testing on target devices
- User acceptance testing before release

---

## Success Criteria

### Phase 7 (IDB)
- ✅ Images persist after reload
- ✅ No performance regression
- ✅ No database errors

### Phase 8 (Touch)
- ✅ Pan/zoom works on iPad
- ✅ Draw works with stylus
- ✅ Desktop unaffected

### Phase 9 (Optimization)
- ✅ Memory usage -40% on large scenes
- ✅ Undo latency < 100ms
- ✅ History buffer grows < 5% per 100 ops

---

**Status**: ✅ Ready to begin Phase 7  
**Next Step**: Implement IDB image persistence  
**Estimated Timeline**: 2-3 hours  

Choose your next phase! 🚀
