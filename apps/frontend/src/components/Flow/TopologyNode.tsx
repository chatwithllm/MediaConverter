import type { NodeLayout } from './flow-layout.js';

interface Props {
  layout: NodeLayout;
  active: boolean;
  count: number;
  onClick?: () => void;
}

export function TopologyNode({ layout, active, count, onClick }: Props) {
  const { x, y, label, icon } = layout;
  return (
    <foreignObject x={x - 60} y={y - 30} width={120} height={60}>
      <div
        onClick={onClick}
        className={
          'flex items-center gap-2 px-3 py-2 rounded-lg border bg-white/90 cursor-pointer ' +
          (active ? 'flow-node-active' : 'border-ink/20 opacity-80')
        }
      >
        <span className="text-xl" aria-hidden>{icon}</span>
        <div className="flex flex-col">
          <span className="text-xs font-semibold leading-tight">{label}</span>
          <span className="text-[10px] opacity-70 leading-tight">{count} active</span>
        </div>
      </div>
    </foreignObject>
  );
}
