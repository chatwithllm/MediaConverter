import type { ArrowLayout } from './flow-layout.js';

interface Props {
  layout: ArrowLayout;
  active: boolean;
  failed?: boolean;
}

export function TopologyArrow({ layout, active, failed = false }: Props) {
  const stroke = failed ? '#a31518' : active ? '#1a8a5a' : '#9ca3af';
  return (
    <g>
      <path
        d={layout.d}
        fill="none"
        stroke={stroke}
        strokeWidth={2}
        strokeDasharray="8 8"
        className={active ? 'flow-arrow-active' : ''}
      />
      <path
        d={layout.d}
        fill="none"
        stroke={stroke}
        strokeWidth={6}
        opacity={active ? 0.15 : 0.05}
      />
    </g>
  );
}
