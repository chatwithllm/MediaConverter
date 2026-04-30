import type { ArrowLayout } from './flow-layout.js';

interface Props {
  arrow: ArrowLayout;
  title: string;
}

export function TransferBadge({ arrow, title }: Props) {
  const match = /M\s*([\d.]+)\s*([\d.]+)\s*L\s*([\d.]+)\s*([\d.]+)/.exec(arrow.d);
  if (!match) return null;
  const x1 = Number(match[1]);
  const y1 = Number(match[2]);
  const x2 = Number(match[3]);
  const y2 = Number(match[4]);
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  return (
    <foreignObject x={mx - 60} y={my - 12} width={120} height={24}>
      <div className="text-[10px] bg-accent text-white rounded px-2 py-0.5 truncate">
        {title}
      </div>
    </foreignObject>
  );
}
