import React, { Suspense } from 'react';
import { useNexusStore } from '@/store/useNexusStore';

const C137GraphView = React.lazy(() => import('@/components/C137GraphView'));

export const NexusGraphTab = () => {
  const { notes, activeNoteId, setActiveNoteId } = useNexusStore();

  return (
    <div className="w-full h-full relative overflow-hidden">
      <Suspense
        fallback={
          <div className="flex h-full items-center justify-center text-cyan-400 font-mono text-sm gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
            <span>Cargando Constelación 3D...</span>
          </div>
        }
      >
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
};

export default NexusGraphTab;
