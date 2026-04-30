import type { NodeLayout } from './flow-layout.js';
import { NodeIcon } from './NodeIcon.js';

interface Props {
  layout: NodeLayout;
  active: boolean;
  count: number;
  failed?: boolean;
  onClick?: () => void;
}

export function TopologyNode({ layout, active, count, failed = false, onClick }: Props) {
  const { x, y, label, sublabel, iconKey } = layout;
  const W = 168;
  const H = 84;

  const accentClass = failed
    ? 'border-danger/70 bg-gradient-to-br from-white to-red-50'
    : active
      ? 'border-accent-dim bg-gradient-to-br from-white to-emerald-50 flow-node-active'
      : 'border-ink/15 bg-white/85';
  const iconBg = failed
    ? 'bg-danger/10 text-danger'
    : active
      ? 'bg-accent/10 text-accent'
      : 'bg-ink/10 text-ink/60';

  return (
    <foreignObject x={x - W / 2} y={y - H / 2} width={W} height={H}>
      <div
        onClick={onClick}
        className={
          'relative h-full px-3 py-2 rounded-xl border-2 flex items-center gap-3 ' +
          'shadow-sm hover:shadow-md transition-shadow cursor-pointer ' +
          accentClass
        }
      >
        <div className={'shrink-0 rounded-lg p-2 ' + iconBg}>
          <NodeIcon iconKey={iconKey} size={28} />
        </div>
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-sm font-bold leading-tight truncate">{label}</span>
          {sublabel && <span className="text-[10px] opacity-60 leading-tight">{sublabel}</span>}
          <span
            className={
              'text-[10px] leading-tight mt-1 ' +
              (count > 0 ? 'text-accent-dim font-semibold' : 'opacity-50')
            }
          >
            {count > 0 ? `${count} active` : 'idle'}
          </span>
        </div>
        {count > 0 && (
          <span className="absolute -top-2 -right-2 bg-accent text-white text-[10px] font-bold rounded-full min-w-5 h-5 px-1 flex items-center justify-center shadow">
            {count}
          </span>
        )}
      </div>
    </foreignObject>
  );
}
