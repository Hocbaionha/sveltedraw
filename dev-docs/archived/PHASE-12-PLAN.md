# Phase 12: Enhancement Pack — Implementation Plan

**Status**: Ready to implement  
**Estimated Duration**: 2 weeks  
**Effort**: 14-18 hours  
**Priority**: HIGH  
**Start Date**: Ready now

---

## Phase 12 Overview

Transform Sveltedraw from a functional MVP into a polished, user-friendly application with:
- Professional UI polish
- Template system for quick start
- Library management
- Settings & customization
- Built-in help & guidance

---

## Features to Implement

### Feature 1: Shape Library UI Panel (3-4 hours)

**Current State**:
- Library exists but no UI to browse it
- Shapes stored in localStorage
- Context menu only

**Goal**:
- Visual library panel in right sidebar
- Browse & search shapes
- Insert shapes easily
- Save custom shapes

**Implementation**:

1. Create `LibraryPanel.svelte` component
```svelte
<script>
  let searchQuery = $state('');
  let selectedCategory = $state('all');
  let libraryShapes = $state([]);
  
  function handleInsert(shape) {
    // Add shape to canvas
  }
  
  function handleSave(shape) {
    // Save custom shape to library
  }
</script>

<div class="library-panel">
  <input 
    type="text" 
    placeholder="Search shapes..."
    bind:value={searchQuery}
  />
  
  <div class="categories">
    <button 
      class:active={selectedCategory === 'all'}
      onclick={() => selectedCategory = 'all'}
    >
      All
    </button>
    <!-- More category buttons -->
  </div>
  
  <div class="shapes-grid">
    {#each filteredShapes as shape}
      <div class="shape-card">
        <img src={shape.thumbnail} />
        <p>{shape.name}</p>
        <button onclick={() => handleInsert(shape)}>
          Insert
        </button>
      </div>
    {/each}
  </div>
</div>

<style>
  .library-panel {
    width: 250px;
    padding: 12px;
    border-left: 1px solid var(--border-color);
  }
  
  .shapes-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
    margin-top: 12px;
  }
  
  .shape-card {
    cursor: pointer;
    padding: 8px;
    border-radius: 4px;
    hover: background-color var(--hover-color);
  }
</style>
```

2. Wire to App.svelte
```
- Add library panel to sidebar
- Implement insert logic
- Add save shape dialog
```

3. Add thumbnail generation
```
- Generate PNG for each shape
- Store in IndexedDB
- Display in library UI
```

**Keyboard Shortcut**: `Ctrl+L` to toggle library

---

### Feature 2: Template System (4-5 hours)

**Current State**:
- No templates available
- Start with blank canvas

**Goal**:
- Pre-made templates for common scenarios
- Quick start with template
- Easy access from main menu

**Templates to Include**:

1. **Flowchart Template**
```
Includes: Arrow shapes, decision diamonds, process boxes
Arrangement: Vertical flow with connections
```

2. **Wireframe Template**
```
Includes: UI elements, rectangles, text areas
Arrangement: Mobile/desktop wireframe layout
```

3. **Org Chart Template**
```
Includes: Boxes for roles, connectors
Arrangement: Hierarchical tree
```

4. **Mind Map Template**
```
Includes: Central node with branches
Arrangement: Radial pattern
```

5. **Kanban Board Template**
```
Includes: Three columns (TODO, IN PROGRESS, DONE)
Arrangement: Card layout
```

**Implementation**:

1. Create template files
```json
// templates/flowchart.json
{
  "name": "Flowchart",
  "description": "Process flow diagram",
  "thumbnail": "flowchart.png",
  "elements": [
    {
      "type": "rectangle",
      "x": 100,
      "y": 100,
      "width": 120,
      "height": 60,
      "text": "Start"
    },
    // More elements...
  ]
}
```

2. Create TemplateSelector component
```svelte
<script>
  import { templates } from './templates';
  
  function selectTemplate(template) {
    // Load template into canvas
    scene.replaceAllElements(template.elements);
  }
</script>

<div class="template-selector">
  <h2>Choose a Template</h2>
  <div class="templates-grid">
    {#each templates as template}
      <div class="template-card">
        <img src={template.thumbnail} />
        <h3>{template.name}</h3>
        <p>{template.description}</p>
        <button onclick={() => selectTemplate(template)}>
          Use Template
        </button>
      </div>
    {/each}
  </div>
</div>
```

3. Wire to new file flow
- Show on app load if no drawing
- Add to File → New menu
- Show modal on startup (optional)

**Keyboard Shortcut**: `Ctrl+N` for new with template

---

### Feature 3: Recent Files List (2-3 hours)

**Current State**:
- No recent files tracking
- Start fresh each time

**Goal**:
- Track last 10 files opened
- Quick access list
- Thumbnails for each

**Implementation**:

1. Create recent files tracker
```typescript
interface RecentFile {
  id: string;
  name: string;
  timestamp: number;
  thumbnail: string;
  elements: any[];
}

const recentFiles = $state<RecentFile[]>([]);

function addToRecent(drawing: any) {
  const recent = {
    id: randomId(),
    name: drawing.name || 'Untitled',
    timestamp: Date.now(),
    thumbnail: generateThumbnail(drawing),
    elements: drawing.elements
  };
  
  recentFiles.unshift(recent);
  if (recentFiles.length > 10) {
    recentFiles.pop();
  }
  
  saveRecent();
}
```

2. Create RecentFilesList component
```svelte
<div class="recent-files">
  <h2>Recent Files</h2>
  {#if recentFiles.length === 0}
    <p>No recent files</p>
  {:else}
    <ul>
      {#each recentFiles as file}
        <li>
          <img src={file.thumbnail} />
          <div class="info">
            <p>{file.name}</p>
            <small>{formatTime(file.timestamp)}</small>
          </div>
          <button onclick={() => loadFile(file)}>Open</button>
          <button onclick={() => deleteFile(file)}>Delete</button>
        </li>
      {/each}
    </ul>
  {/if}
</div>
```

3. Save/load from localStorage
```typescript
function saveRecent() {
  localStorage.setItem('sveltedraw-recent', JSON.stringify(recentFiles));
}

function loadRecent() {
  const stored = localStorage.getItem('sveltedraw-recent');
  if (stored) {
    recentFiles = JSON.parse(stored);
  }
}
```

**Keyboard Shortcut**: `Ctrl+R` to show recent

---

### Feature 4: Settings Panel (2-3 hours)

**Current State**:
- Dark mode only setting
- Language via dropdown

**Goal**:
- Comprehensive settings panel
- Customization options
- Persistent preferences

**Settings to Add**:

```
Display:
  - Theme: Light, Dark, Auto
  - Grid size: 10-50px
  - Grid visible: On/Off
  - Snap to grid: On/Off

Editor:
  - Auto-save interval: 5-60 seconds
  - Undo history size: 100-1000
  - Default brush size: 1-10
  - Default color

Interface:
  - Language
  - Toolbar position: Top/Bottom
  - Show tips on startup: On/Off
  - Keyboard layout: QWERTY/...

Collaboration:
  - Auto-sync: On/Off
  - Collab server URL
  - User name
```

**Implementation**:

1. Create SettingsPanel component
```svelte
<script>
  let settings = $state({
    theme: 'light',
    gridSize: 20,
    gridVisible: true,
    autoSave: 30,
    language: 'en',
    // ... more settings
  });
  
  function saveSetting(key, value) {
    settings[key] = value;
    localStorage.setItem('sveltedraw-settings', JSON.stringify(settings));
    applySettings();
  }
</script>

<div class="settings-panel">
  <h2>Settings</h2>
  
  <h3>Display</h3>
  <label>
    Theme:
    <select bind:value={settings.theme} onchange>
      <option>Light</option>
      <option>Dark</option>
      <option>Auto</option>
    </select>
  </label>
  
  <!-- More settings... -->
</div>
```

2. Apply settings to app
```typescript
function applySettings() {
  if (settings.theme === 'dark') {
    document.body.classList.add('dark-mode');
  } else {
    document.body.classList.remove('dark-mode');
  }
  
  if (!settings.gridVisible) {
    gridEnabled = false;
  }
  
  // ... apply other settings
}
```

3. Keyboard shortcut and menu
- **Ctrl+,** to open settings
- Settings menu in toolbar
- Tab-based layout

---

### Feature 5: Help & Documentation (2-3 hours)

**Current State**:
- No in-app help
- Users must know shortcuts

**Goal**:
- Interactive help system
- Keyboard shortcut reference
- Feature highlights
- Contextual tooltips

**Implementation**:

1. Create HelpPanel component
```svelte
<script>
  let activeTab = $state('getting-started');
  
  const helpSections = {
    'getting-started': [
      { title: 'Drawing Basics', content: '...' },
      { title: 'Shapes & Tools', content: '...' },
      { title: 'Styling', content: '...' }
    ],
    'shortcuts': [
      { key: 'Ctrl+Z', action: 'Undo' },
      { key: 'Ctrl+Y', action: 'Redo' },
      // ... all 40+ shortcuts
    ],
    'features': [
      { name: 'Grouping', description: '...', shortcut: 'Ctrl+G' },
      // ... all features
    ]
  };
</script>

<div class="help-panel">
  <div class="tabs">
    <button 
      class:active={activeTab === 'getting-started'}
      onclick={() => activeTab = 'getting-started'}
    >
      Getting Started
    </button>
    <button 
      class:active={activeTab === 'shortcuts'}
      onclick={() => activeTab = 'shortcuts'}
    >
      Shortcuts
    </button>
    <button 
      class:active={activeTab === 'features'}
      onclick={() => activeTab = 'features'}
    >
      Features
    </button>
  </div>
  
  <div class="content">
    {#each helpSections[activeTab] as item}
      <div class="item">
        <h3>{item.title || item.key || item.name}</h3>
        <p>{item.content || item.action || item.description}</p>
      </div>
    {/each}
  </div>
</div>
```

2. Add help button & keyboard shortcut
```
- F1 or ? key to show help
- Help icon in toolbar
- Modal overlay
```

3. Feature highlights
```typescript
const highlights = [
  {
    title: 'New Feature',
    description: 'Check out the library panel!',
    icon: '📚',
    dismissible: true
  }
];
```

---

## Implementation Timeline

### Week 1 (Days 1-5): Core Features
- Day 1-2: Library Panel UI + thumbnail generation
- Day 3: Template System with 5 templates
- Day 4: Recent Files tracking & UI
- Day 5: Testing & integration

### Week 2 (Days 6-10): Settings & Polish
- Day 6-7: Settings Panel (display, editor, interface)
- Day 8-9: Help & Documentation system
- Day 10: Testing, polish, keyboard shortcuts

---

## Testing Checklist

### Feature 1: Library Panel
- [ ] Library opens/closes
- [ ] Search works
- [ ] Categories filter correctly
- [ ] Can insert shape from library
- [ ] Can save custom shape
- [ ] Thumbnails display correctly
- [ ] Keyboard shortcut works

### Feature 2: Templates
- [ ] All 5 templates load correctly
- [ ] Elements position properly
- [ ] Connections draw correctly
- [ ] Template selector UI works
- [ ] Can create new from template
- [ ] Keyboard shortcut works

### Feature 3: Recent Files
- [ ] Files are tracked on save
- [ ] List shows last 10
- [ ] Thumbnails generate
- [ ] Can open from list
- [ ] Can delete from list
- [ ] Data persists on reload
- [ ] Keyboard shortcut works

### Feature 4: Settings
- [ ] Settings panel opens
- [ ] All settings save/load
- [ ] Dark mode applies
- [ ] Grid settings work
- [ ] Auto-save interval updates
- [ ] Language changes dynamically
- [ ] Data persists on reload

### Feature 5: Help
- [ ] Help opens on F1
- [ ] All tabs work
- [ ] Shortcuts listed correctly
- [ ] Feature descriptions clear
- [ ] Highlights appear
- [ ] Can dismiss highlights

---

## Success Metrics

✅ **Phase 12 is successful when**:
- [x] All 5 features implemented
- [x] All tests passing
- [x] User can discover features
- [x] Settings persist
- [x] Performance not degraded
- [x] Mobile responsive
- [x] Keyboard accessible

---

## Files to Create/Modify

### New Components
- `LibraryPanel.svelte` — Library UI
- `TemplateSelector.svelte` — Template picker
- `RecentFilesList.svelte` — Recent files
- `SettingsPanel.svelte` — Settings UI
- `HelpPanel.svelte` — Help system

### Modified Files
- `App.svelte` — Wire components, add state
- `styles.css` — Add new styles
- `package.json` — Add template files

### Template Files
- `templates/flowchart.json`
- `templates/wireframe.json`
- `templates/orgchart.json`
- `templates/mindmap.json`
- `templates/kanban.json`

---

## Dependencies

**No new npm packages needed** — all features use existing dependencies.

---

## Performance Considerations

- Library panel: Lazy load thumbnails
- Templates: Load on demand
- Recent files: Limit to 10 to save memory
- Settings: Cache in memory
- Help: Lazy load content

---

## Keyboard Shortcuts (Phase 12)

```
Ctrl+L  = Toggle library panel
Ctrl+N  = New file from template
Ctrl+R  = Show recent files
Ctrl+,  = Open settings
F1      = Open help
?       = Open help (alternative)
```

---

## Next Steps After Phase 12

Once complete:
1. Deploy to production
2. Gather user feedback
3. Plan Phase 13 (Advanced Drawing)
4. Begin Phase 13 implementation

---

## Conclusion

Phase 12 transforms Sveltedraw from MVP to a polished, user-friendly application. Features are well-scoped, implementation is straightforward, and 2 weeks is realistic.

**Ready to start anytime!**

---

**Phase Status**: ✅ Ready to implement  
**Effort Estimate**: 14-18 hours  
**Timeline**: 2 weeks  
**Next Phase**: 13 (Advanced Drawing)

