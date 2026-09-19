import React from 'react';
import { FileText, Tag, Link2, ArrowRight, Crosshair, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Graph3DNode } from '../../utils/graphParser';

export interface InspectorPanelProps {
  selectedNode: Graph3DNode | null;
  displayNode: Graph3DNode | null;
  nodes: Graph3DNode[];
  themeCfg: any;
  handleCloseInspector: () => void;
  handleSelectNode: (id: number) => void;
  setHoveredId: (id: number | null) => void;
  controlsRef: React.RefObject<any>;
}

export function InspectorPanel({
  selectedNode,
  displayNode,
  nodes,
  themeCfg,
  handleCloseInspector,
  handleSelectNode,
  setHoveredId,
  controlsRef
}: InspectorPanelProps) {
  return (
    <div 
      id="c137-node-inspector"
      className={`fixed z-30 flex flex-col backdrop-blur-md bg-gray-950/75 shadow-2xl transition-transform duration-300 ease-out pointer-events-auto
                 bottom-0 left-0 right-0 w-full max-h-[55vh] rounded-t-2xl border-t border-white/10
                 md:right-4 md:top-16 md:bottom-auto md:left-auto md:w-[380px] md:h-[calc(100vh-80px)] md:rounded-2xl md:border md:border-white/10
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
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">
                  {displayNode.category || (displayNode.type === 'primary' ? 'Nota' : 'Hub')} #{displayNode.id}
                </span>
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
          <div className="flex-1 overflow-y-auto mt-4 pr-2 space-y-5 custom-scrollbar">
            {/* Vínculos (Outlinks/Backlinks) */}
            {displayNode.connections && displayNode.connections.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <Link2 className="w-3.5 h-3.5 text-slate-500" />
                  Conexiones Neurales
                </h3>
                <div className="flex flex-col gap-1.5">
                  {displayNode.connections.slice(0, 8).map(connId => {
                    const connNode = nodes[connId];
                    if (!connNode) return null;
                    return (
                      <button
                        key={connId}
                        onClick={() => handleSelectNode(connId)}
                        onMouseEnter={() => setHoveredId(connId)}
                        onMouseLeave={() => setHoveredId(null)}
                        className="flex items-center justify-between p-2 rounded-md bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 transition-all group text-left"
                      >
                        <span className="text-xs text-slate-300 group-hover:text-cyan-300 truncate pr-2">
                          {connNode.name}
                        </span>
                        <ArrowRight className="w-3 h-3 text-slate-500 group-hover:text-cyan-400 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
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
                  Keywords
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {displayNode.tags.map(tag => (
                    <span key={tag} className="px-2 py-0.5 text-[10px] font-mono rounded-full bg-slate-800/80 text-slate-400 border border-slate-700">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Contenido Principal (Markdown) */}
            {displayNode.val && (
              <div>
                <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Fragmento de Memoria
                </h3>
                <div className="prose prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-p:text-slate-400 prose-a:text-cyan-400 prose-a:no-underline hover:prose-a:underline prose-headings:text-slate-200">
                  <ReactMarkdown>
                    {typeof displayNode.val === 'string' 
                      ? displayNode.val 
                      : `*Contenido heurístico de valor: ${displayNode.val}*`}
                  </ReactMarkdown>
                </div>
              </div>
            )}
          </div>

          {/* Footer de Acciones Rápidas */}
          <div className="pt-4 mt-4 border-t border-white/10 shrink-0 flex items-center justify-between">
            <button 
              onClick={() => {
                if (controlsRef.current) {
                  controlsRef.current.target.set(displayNode.x || 0, displayNode.y || 0, displayNode.z || 0);
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white/5 hover:bg-white/10 text-xs text-slate-300 transition-colors"
            >
              <Crosshair className="w-3.5 h-3.5" />
              Re-centrar
            </button>
            <div className="text-[10px] font-mono text-slate-500">
              [XYZ: {displayNode.x?.toFixed(1)}, {displayNode.y?.toFixed(1)}, {displayNode.z?.toFixed(1)}]
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
