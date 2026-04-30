import type { ArrowLayout } from './flow-layout.js';

interface Props {
  arrow: ArrowLayout;
  title: string;
}

const T = 0.35;

export function TransferBadge({ arrow, title }: Props) {
  const match = /M\s*([\d.]+)\s*([\d.]+)\s*L\s*([\d.]+)\s*([\d.]+)/.exec(arrow.d);
  if (!match) return null;
  const x1 = Number(match[1]);
  const y1 = Number(match[2]);
  const x2 = Number(match[3]);
  const y2 = Number(match[4]);
  const mx = x1 + (x2 - x1) * T;
  const my = y1 + (y2 - y1) * T;
  const W = 110;
  const H = 22;
  return (
    <foreignObject x={mx - W / 2} y={my - H / 2} width={W} height={H}>
      <div className="text-[10px] bg-accent text-white rounded-full px-2 py-0.5 truncate shadow-md text-center">
        {title}
      </div>
    </foreignObject>
  );
}
