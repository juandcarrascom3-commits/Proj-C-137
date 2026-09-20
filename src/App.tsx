import React, { useState, useEffect, Suspense } from 'react';
import { NexusGraphTab } from '@/components/NexusGraphTab';
import { useNexusStore } from '@/store/useNexusStore';
import { useUIStore } from '@/store/useUIStore';
import { 
  Network, 
  Search, 
  Plus, 
  Sparkles, 
  Code2, 
  PanelLeftClose, 
  PanelLeftOpen, 
  Copy, 
  Check, 
  Edit2, 
  Trash2 
} from 'lucide-react';

const C137GraphView = React.lazy(() => import('@/components/C137GraphView'));

/**
 * =======================================================================
 * NEXUS WORKSPACE DEMO CON PESTAÑA <NexusGraphTab />
 * =======================================================================
 * Integración desacoplada entre datos (useNexusStore + Dexie DB) y estado de UI (useUIStore).
 * =======================================================================
 */
export default function App() {
  const [viewMode, setViewMode] = useState<'nexus_tab' | 'standalone_demo'>('nexus_tab');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // 1. Datos del Grafo, Hidratación e IndexedDB CRUD (Store de Datos)
  const { 
    notes, 
    addNote, 
    updateNote, 
    deleteNote, 
    getNoteById,
    loadNotesFromDB,
    isDbLoaded
  } = useNexusStore();

  // 2. Estado de Interfaz, Búsqueda y Filtros (Store de UI desacoplado)
  const { 
    activeNoteId, 
    setActiveNoteId, 
    selectedTag, 
    setSelectedTag,
    searchQuery,
    setSearchQuery
  } = useUIStore();

  // Carga inicial de datos desde IndexedDB
  useEffect(() => {
    loadNotesFromDB();
  }, [loadNotesFromDB]);

  // Nota activa seleccionada
  const activeNote = activeNoteId ? getNoteById(activeNoteId) : undefined;

  // Filtrado de notas para el panel lateral
  const filteredNotes = notes.filter((note) => {
    const matchesSearch = searchQuery === '' || 
      note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.content.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesTag = !selectedTag || note.tags.includes(selectedTag);
    return matchesSearch && matchesTag;
  });

  // Extraer etiquetas únicas
  const allTags = Array.from(
    new Set(notes.flatMap((n) => n.tags))
  );

  const handleCreateQuickNote = async () => {
    const titlePrompt = prompt('Título de la nueva nota en NEXUS:');
    if (!titlePrompt || !titlePrompt.trim()) return;

    const randomTag = allTags[Math.floor(Math.random() * allTags.length)] || 'neural';
    const newId = await addNote({
      title: titlePrompt.trim(),
      content: `Nota creada dinámicamente en el espacio neural de NEXUS.\nConectada a [[${notes[0]?.title || 'Protocolo C-137'}]] y catalogada bajo #${randomTag}.`,
      tags: [randomTag, 'fase4'],
      category: 'Expansión'
    });
    setActiveNoteId(newId);
  };

  const sampleSnippet = `import React, { Suspense } from 'react';
import { useNexusStore } from '@/store/useNexusStore';
import { useUIStore } from '@/store/useUIStore';

const C137GraphView = React.lazy(() => import('@/components/C137GraphView'));

export const NexusGraphTab = () => {
  const { notes } = useNexusStore();
  const { activeNoteId, setActiveNoteId } = useUIStore();

  return (
    <div className="w-full h-full relative overflow-hidden">
      <Suspense fallback={<div className="flex h-full items-center justify-center text-cyan-400">Cargando Constelación 3D...</div>}>
        <C137GraphView
          notes={notes}
          activeNoteId={activeNoteId}
          onNoteSelect={(id) => setActiveNoteId(id)}
          theme="cyberpunk"
          standalone={false}
        />
      </Suspense>
    </div>
  );
};`;

  const handleCopySnippet = () => {
    navigator.clipboard.writeText(sampleSnippet);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Pantalla de carga mientras se inicializa IndexedDB
  if (!isDbLoaded) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-950 text-cyan-400 font-mono text-sm gap-3">
        <div className="w-3 h-3 rounded-full bg-cyan-400 animate-ping" />
        <span>Cargando Memoria Neural IndexedDB...</span>
      </div>
    );
  }

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 text-slate-100 flex flex-col font-sans select-none">
      
      {/* BARRA SUPERIOR DE APLICACIÓN */}
      <header className="h-14 bg-slate-950/90 border-b border-slate-800/80 px-4 flex items-center justify-between z-30 shrink-0 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(prev => !prev)}
            className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-cyan-400 hover:border-cyan-500/40 transition-colors"
            title={sidebarOpen ? 'Ocultar explorador de notas' : 'Mostrar explorador de notas'}
          >
            {sidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
          </button>

          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_10px_#00f0ff] animate-pulse" />
            <span className="font-mono font-bold text-sm tracking-widest text-white">NEXUS</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
              CORE v4.0
            </span>
          </div>

          <div className="h-4 w-px bg-slate-800 mx-1 hidden sm:block" />

          {/* Selector de Modo de Visualización */}
          <div className="flex items-center bg-slate-900/80 p-0.5 rounded-lg border border-slate-800 text-xs">
            <button
              onClick={() => setViewMode('nexus_tab')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-medium transition-all ${
                viewMode === 'nexus_tab'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Network className="w-3.5 h-3.5" />
              <span>NexusGraphTab (Pestaña)</span>
            </button>
            <button
              onClick={() => setViewMode('standalone_demo')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-medium transition-all ${
                viewMode === 'standalone_demo'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>C137GraphView (Standalone HUD)</span>
            </button>
          </div>
        </div>

        {/* Acciones Rápidas */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCodeModal(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 hover:border-cyan-500/40 text-xs font-mono text-cyan-400 hover:text-cyan-300 transition-colors"
            title="Ver código de integración"
          >
            <Code2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Ver Snippet</span>
          </button>

          <button
            onClick={handleCreateQuickNote}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs font-mono transition-colors shadow-[0_0_15px_rgba(0,240,255,0.3)]"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Nueva Nota</span>
          </button>
        </div>
      </header>

      {/* CUERPO PRINCIPAL */}
      <div className="flex-1 relative flex overflow-hidden">
        
        {/* PANEL LATERAL: EXPLORADOR DE NOTAS */}
        {sidebarOpen && (
          <aside className="w-80 md:w-88 bg-slate-950/95 border-r border-slate-800/80 flex flex-col z-20 shrink-0 backdrop-blur-xl transition-all duration-300">
            
            {/* Buscador y Filtro */}
            <div className="p-3 border-b border-slate-800/80 space-y-2.5">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="Buscar notas o ideas..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-sans"
                />
              </div>

              {/* Tags de Filtrado Rápido */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-[10px] font-mono">
                <button
                  onClick={() => setSelectedTag(null)}
                  className={`px-2 py-0.5 rounded border transition-colors whitespace-nowrap ${
                    !selectedTag 
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' 
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  TODOS ({notes.length})
                </button>
                {allTags.slice(0, 6).map((tag) => (
                  <button
                    key={tag}
                    onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                    className={`px-2 py-0.5 rounded border transition-colors whitespace-nowrap ${
                      selectedTag === tag 
                        ? 'bg-violet-500/20 text-violet-300 border-violet-500/40' 
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            </div>

            {/* Lista de Notas */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-800/50">
              {filteredNotes.map((note) => {
                const isActive = note.id === activeNoteId;
                return (
                  <div
                    key={note.id}
                    onClick={() => setActiveNoteId(note.id)}
                    className={`p-3 cursor-pointer transition-all ${
                      isActive
                        ? 'bg-cyan-500/10 border-l-2 border-cyan-400 pl-2.5'
                        : 'hover:bg-slate-900/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1.5">
                      <h4 className={`text-xs font-semibold leading-snug line-clamp-1 ${
                        isActive ? 'text-cyan-300' : 'text-slate-200'
                      }`}>
                        {note.title}
                      </h4>
                      <span className="text-[9px] font-mono text-slate-500 shrink-0">
                        {note.id}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-400 line-clamp-2 mt-1 font-sans">
                      {note.content.replace(/\[\[(.*?)\]\]/g, '$1').replace(/#(.*?)\b/g, '$1')}
                    </p>

                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-900 border border-slate-800 text-slate-400 font-mono">
                        {note.category || 'General'}
                      </span>
                      {note.tags.slice(0, 2).map((t) => (
                        <span key={t} className="text-[9px] font-mono text-cyan-400/80">
                          #{t}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}

              {filteredNotes.length === 0 && (
                <div className="p-8 text-center text-slate-500 text-xs">
                  No se encontraron notas con los criterios actuales.
                </div>
              )}
            </div>

            {/* Panel de Detalle de Nota Activa */}
            {activeNote && (
              <div className="p-3.5 border-t border-slate-800 bg-slate-950/80 shrink-0 space-y-2">
                <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                  <span>NOTA ACTIVA EN STORE</span>
                  <span className="text-cyan-400 font-bold">{activeNote.id}</span>
                </div>
                <h3 className="text-xs font-bold text-white line-clamp-1">{activeNote.title}</h3>
                
                <div className="flex items-center gap-1.5 pt-1">
                  <button
                    onClick={async () => {
                      const newTitle = prompt('Editar título de la nota:', activeNote.title);
                      if (newTitle && newTitle.trim()) {
                        await updateNote(activeNote.id, { title: newTitle.trim() });
                      }
                    }}
                    className="flex-1 flex items-center justify-center gap-1 py-1 px-2 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[10px] font-mono text-slate-300 hover:text-white transition-colors"
                    title="Editar título"
                  >
                    <Edit2 className="w-3 h-3 text-cyan-400" />
                    <span>Editar</span>
                  </button>

                  <button
                    onClick={async () => {
                      if (confirm(`¿Eliminar "${activeNote.title}" del grafo neural?`)) {
                        await deleteNote(activeNote.id);
                      }
                    }}
                    className="flex items-center justify-center gap-1 py-1 px-2 rounded bg-red-950/40 hover:bg-red-900/60 border border-red-800/60 text-[10px] font-mono text-red-400 hover:text-red-300 transition-colors"
                    title="Eliminar nota"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}
          </aside>
        )}

        {/* ÁREA CENTRAL: VISTA DE RED DE GRAFO */}
        <main className="flex-1 relative h-full w-full overflow-hidden bg-slate-950">
          {viewMode === 'nexus_tab' ? (
            <NexusGraphTab />
          ) : (
            <div className="w-full h-full relative overflow-hidden">
              <Suspense
                fallback={
                  <div className="flex h-full items-center justify-center text-cyan-400 font-mono text-sm gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
                    <span>Inicializando Visor Standalone...</span>
                  </div>
                }
              >
                <C137GraphView
                  notes={notes}
                  activeNoteId={activeNoteId}
                  onNoteSelect={(id) => setActiveNoteId(id)}
                  theme="cyberpunk"
                  standalone={true}
                />
              </Suspense>
            </div>
          )}
        </main>
      </div>

      {/* MODAL DE CÓDIGO */}
      {showCodeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-2xl bg-slate-900 border border-cyan-500/40 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center gap-2">
                <Code2 className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-mono font-bold text-white">INTEGRACIÓN EN PESTAÑA DE RED (NEXUS)</span>
              </div>
              <button
                onClick={() => setShowCodeModal(false)}
                className="text-slate-400 hover:text-white text-xs font-mono px-2 py-1 rounded bg-slate-800"
              >
                Cerrar (Esc)
              </button>
            </div>

            <div className="p-5 bg-slate-950 font-mono text-xs overflow-x-auto text-cyan-200 border-b border-slate-800">
              <pre>{sampleSnippet}</pre>
            </div>

            <div className="p-4 bg-slate-900 flex items-center justify-between">
              <div className="text-[11px] text-slate-400">
                Archivo de referencia: <code className="text-cyan-300">src/components/NexusGraphTab.tsx</code>
              </div>
              <button
                onClick={handleCopySnippet}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs font-mono transition-all shadow-md"
              >
                {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedCode ? '¡Copiado!' : 'Copiar Código'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}