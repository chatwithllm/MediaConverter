import { useMemo } from 'react';
import { useEventStream } from '../../hooks/useEventStream.js';
import {
  KANBAN_COLUMNS,
  COLUMN_LABELS,
  groupBySnapshot,
  type KanbanColumnId,
} from './kanban-state.js';
import { KanbanColumn } from './KanbanColumn.js';

export function KanbanView({ filterColumn }: { filterColumn?: KanbanColumnId }) {
  const { snapshot } = useEventStream();
  const grouped = useMemo(
    () => groupBySnapshot(snapshot, filterColumn ? { column: filterColumn } : undefined),
    [snapshot, filterColumn],
  );
  return (
    <div className="flex gap-3 overflow-x-auto pb-3">
      {KANBAN_COLUMNS.map((c) => (
        <KanbanColumn key={c} label={COLUMN_LABELS[c]} events={grouped[c]} />
      ))}
    </div>
  );
}
