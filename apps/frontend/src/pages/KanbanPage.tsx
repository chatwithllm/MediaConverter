import { KanbanView } from '../components/Kanban/KanbanView.js';
import type { KanbanColumnId } from '../components/Kanban/kanban-state.js';

export function KanbanPage({ filterColumn }: { filterColumn?: KanbanColumnId }) {
  return (
    <div>
      <h2 className="text-lg font-semibold mb-2">
        Lifecycle{filterColumn ? ` — ${filterColumn}` : ''}
      </h2>
      <KanbanView {...(filterColumn ? { filterColumn } : {})} />
    </div>
  );
}
