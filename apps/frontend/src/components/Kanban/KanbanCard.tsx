import type { PipelineEvent } from '@tpd/shared';

export function KanbanCard({ ev }: { ev: PipelineEvent }) {
  const pct = ev.progress !== undefined ? Math.round(ev.progress * 100) : null;
  return (
    <div className="border rounded p-2 mb-2 bg-white text-xs">
      <div className="font-semibold truncate">{ev.title}</div>
      <div className="opacity-70 mt-1 flex flex-wrap gap-1">
        {ev.node && <span className="bg-ink/10 px-1 rounded">{ev.node}</span>}
        {ev.sourceCodec && <span>{ev.sourceCodec}</span>}
        {ev.targetCodec && <span>→ {ev.targetCodec}</span>}
      </div>
      {pct !== null && (
        <div className="mt-1">
          <div className="h-1 bg-ink/10 rounded">
            <div className="h-1 bg-accent rounded" style={{ width: `${pct}%` }} />
          </div>
          <div className="text-[10px] opacity-60 mt-0.5">
            {pct}%{ev.etaSeconds ? ` · ETA ${Math.round(ev.etaSeconds / 60)}m` : ''}
          </div>
        </div>
      )}
      {ev.errorMessage && (
        <div className="mt-1 text-danger truncate" title={ev.errorMessage}>
          {ev.errorMessage}
        </div>
      )}
    </div>
  );
}
