import type { PipelineEvent } from '@tpd/shared';
import { KanbanCard } from './KanbanCard.js';

export function KanbanColumn({
  label,
  events,
}: {
  label: string;
  events: PipelineEvent[];
}) {
  return (
    <div className="flex flex-col w-56 shrink-0 bg-ink/5 rounded p-2">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold">{label}</h3>
        <span className="text-xs opacity-60">{events.length}</span>
      </div>
      <div className="overflow-y-auto">
        {events.map((e) => (
          <KanbanCard key={e.fileId} ev={e} />
        ))}
        {events.length === 0 && <div className="text-[10px] opacity-50">empty</div>}
      </div>
    </div>
  );
}
