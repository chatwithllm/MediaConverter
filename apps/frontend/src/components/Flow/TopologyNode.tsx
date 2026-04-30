import type { NodeLayout } from './flow-layout.js';

interface Props {
  layout: NodeLayout;
  active: boolean;
  count: number;
  onClick?: () => void;
}

export function TopologyNode({ layout, active, count, onClick }: Props) {
  const { x, y, label, icon } = layout;
  const W = 150;
  const H = 64;
  return (
    <foreignObject x={x - W / 2} y={y - H / 2} width={W} height={H}>
      <div
        onClick={onClick}
        className={
          'flex items-center gap-2 px-3 py-2 rounded-lg border bg-white/95 cursor-pointer h-full ' +
          (active ? 'flow-node-active border-accent-dim' : 'border-ink/20 opacity-80')
        }
      >
        <span className="text-2xl shrink-0" aria-hidden>
          {icon}
        </span>
        <div className="flex flex-col min-w-0">
          <span className="text-xs font-semibold leading-tight truncate">{label}</span>
          <span
            className={
              'text-[10px] leading-tight ' +
              (count > 0 ? 'text-accent-dim font-medium' : 'opacity-50')
            }
          >
            {count > 0 ? `${count} active` : 'idle'}
          </span>
        </div>
      </div>
    </foreignObject>
  );
}
