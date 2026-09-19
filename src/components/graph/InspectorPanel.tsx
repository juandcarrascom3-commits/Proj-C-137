import React from 'react';
import { FileText, Tag, Link2, ArrowRight, Crosshair, X, ExternalLink, CheckCircle2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Graph3DNode } from './types';
import { useNexusStore } from '../../store/useNexusStore';

export interface InspectorPanelProps {
  selectedNode: Graph3DNode | null;
  displayNode: Graph3DNode | null;
  nodes: Graph3DNode[];
  themeCfg: any;
  handleCloseInspector: () => void;
  handleSelectNode: (id: number) => void;
  setHoveredId: (id: number | null) => void;
  controlsRef: React.RefObject<any>;
  onOpenNote?: (id: string) => void;
}

export function InspectorPanel({
  selectedNode,
  displayNode,
  nodes,
  themeCfg,
  handleCloseInspector,
  handleSelectNode,
  setHoveredId,
  controlsRef,
  onOpenNote
}: InspectorPanelProps) {
  const { activeNoteId, setActiveNoteId } = useNexusStore();

  const handleOpenInNexus = (slug: string) => {
    setActiveNoteId(slug);
    if (onOpenNote) {
      onOpenNote(slug);
    }
  };

  const isCurrentActiveInStore = displayNode && displayNode.slug === activeNoteId;

  return (
    <div 
      id="c137-node-inspector"
      className={`fixed z-30 flex flex-col backdrop-blur-md bg-gray-950/80 shadow-2xl transition-transform duration-300 ease-out pointer-events-auto
                 bottom-0 left-0 right-0 w-full max-h-[60vh] rounded-t-2xl border-t border-white/10
                 md:right-4 md:top-16 md:bottom-auto md:left-auto md:w-[380px] md:h-[calc(100vh-80px)] md:max-h-none md:rounded-2xl md:border md:border-white/10
                 ${selectedNode 
                   ? 'translate-y-0 md:translate-x-0' 
                   : 'translate-y-full md:translate-y-0 md:translate-x-full pointer-events-none'}`}
    >
      {displayNode && (
        <div className="flex flex-col h-full p-5 overflow-hidden">
          {/* Cabecera */}
          <div className="flex items-start justify-between pb-3 border-b border-white/10 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className={`p-1.5 rounded-lg border shrink-0 ${
                displayNode.type === 'primary' 
                  ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-400' 
                  : 'border-violet-500/40 bg-violet-500/10 text-violet-400'
              }`}>
                {displayNode.type === 'primary' ? (
                  <FileText className="w-4 h-4" />
                ) : (
                  <Tag className="w-4 h-4" />
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">
                    {displayNode.category || (displayNode.type === 'primary' ? 'Nota' : 'Hub')} #{displayNode.id}
                  </span>
                  {isCurrentActiveInStore && (
                    <span className="flex items-center gap-1 px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[9px] font-mono">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                      Activa
                    </span>
                  )}
                </div>
                <h2 className="text-sm font-semibold text-white tracking-tight truncate">
                  {displayNode.name}
                </h2>
              </div>
            </div>

            {/* Botón Cerrar (X) que limpia la selección */}
            <button
              onClick={handleCloseInspector}
              className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors shrink-0 ml-2"
              title="Cerrar (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Contenido Scrolleable */}
          <div className="flex-1 overflow-y-auto mt-4 pr-1 space-y-4">
            {/* Botón de Enlace Bi-direccional con el layout de React */}
            {displayNode.type === 'primary' && displayNode.slug && (
              <button
                onClick={() => handleOpenInNexus(displayNode.slug)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-mono font-medium transition-all ${
                  isCurrentActiveInStore
                    ? 'bg-cyan-500/20 border border-cyan-500/50 text-cyan-200'
                    : 'bg-slate-900/90 border border-slate-700/60 text-slate-300 hover:text-cyan-300 hover:border-cyan-500/40 hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  {isCurrentActiveInStore ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  ) : (
                    <ExternalLink className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  )}
                  <span className="truncate">
                    {isCurrentActiveInStore ? 'Nota Activa en Editor NEXUS' : 'Abrir Nota en Layout NEXUS'}
                  </span>
                </div>
                <span className="text-[10px] text-cyan-400 font-bold shrink-0 ml-2">
                  {displayNode.slug}
                </span>
              </button>
            )}

            {/* Vínculos (Outlinks/Backlinks) */}
            {displayNode.connections && displayNode.connections.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Link2 className="w-3.5 h-3.5 text-cyan-400" />
                    Conexiones ({displayNode.connections.length})
                  </span>
                  <span className="text-[10px] text-slate-500 font-normal">Click para enfocar</span>
                </h3>
                <div className="flex flex-col gap-1.5">
                  {displayNode.connections.slice(0, 8).map(connId => {
                    const connNode = nodes[connId];
                    if (!connNode) return null;
                    return (
                      <button
                        key={connId}
                        onClick={() => {
                          handleSelectNode(connId);
                          if (connNode.slug && connNode.type === 'primary') {
                            setActiveNoteId(connNode.slug);
                          }
                        }}
                        onMouseEnter={() => setHoveredId(connId)}
                        onMouseLeave={() => setHoveredId(null)}
                        className="flex items-center justify-between p-2 rounded-lg bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 hover:border-white/15 transition-all group text-left"
                      >
                        <div className="flex items-center gap-2 truncate pr-2">
                          <span 
                            className="w-1.5 h-1.5 rounded-full shrink-0" 
                            style={{ 
                              backgroundColor: connNode.type === 'primary' 
                                ? (themeCfg?.primaryHex || '#00f0ff') 
                                : (themeCfg?.relayHex || '#7000ff') 
                            }} 
                          />
                          <span className="text-xs text-slate-300 group-hover:text-cyan-300 truncate">
                            {connNode.name}
                          </span>
                        </div>
                        <ArrowRight className="w-3 h-3 text-slate-500 group-hover:text-cyan-400 shrink-0 group-hover:translate-x-0.5 transition-all" />
                      </button>
                    );
                  })}
                  {displayNode.connections.length > 8 && (
                    <div className="text-[10px] text-slate-500 text-center pt-1 font-mono">
                      +{displayNode.connections.length - 8} conexiones más...
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Metadatos / Tags */}
            {displayNode.tags && displayNode.tags.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Keywords / Tags
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {displayNode.tags.map(tag => (
                    <span key={tag} className="px-2 py-0.5 text-[10px] font-mono rounded-full bg-slate-800/80 text-slate-400 border border-slate-700">
                      #{tag.replace(/^#/, '')}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Contenido Principal (Markdown) */}
            {(displayNode.content || displayNode.val) && (
              <div>
                <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Fragmento de Memoria
                </h3>
                <div className="prose prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-p:text-slate-400 prose-a:text-cyan-400 prose-a:no-underline hover:prose-a:underline prose-headings:text-slate-200 bg-white/[0.02] p-3 rounded-xl border border-white/5 text-xs">
                  <ReactMarkdown>
                    {typeof (displayNode.content || displayNode.val) === 'string' 
                      ? (displayNode.content || displayNode.val) 
                      : `*Contenido heurístico de valor: ${displayNode.val}*`}
                  </ReactMarkdown>
                </div>
              </div>
            )}
          </div>

          {/* Footer de Acciones Rápidas */}
          <div className="pt-3 mt-auto border-t border-white/10 shrink-0 flex items-center justify-between">
            <button 
              onClick={() => {
                if (controlsRef.current) {
                  controlsRef.current.target.set(displayNode.x || 0, displayNode.y || 0, displayNode.z || 0);
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-slate-300 hover:text-white transition-colors"
            >
              <Crosshair className="w-3.5 h-3.5 text-cyan-400" />
              <span>Centrar Vista</span>
            </button>
            <div className="text-[10px] font-mono text-slate-400">
              [XYZ: {displayNode.x?.toFixed(1)}, {displayNode.y?.toFixed(1)}, {displayNode.z?.toFixed(1)}]
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
