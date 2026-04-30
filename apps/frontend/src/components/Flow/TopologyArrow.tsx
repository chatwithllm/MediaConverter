import type { ArrowLayout } from './flow-layout.js';

interface Props {
  layout: ArrowLayout;
  active: boolean;
  failed?: boolean;
}

export function TopologyArrow({ layout, active, failed = false }: Props) {
  const baseStroke = failed ? '#a31518' : active ? '#1a8a5a' : '#c5c2bb';
  const glowStroke = failed ? '#fca5a5' : '#86efac';
  const pathId = `path-${layout.id}`;

  return (
    <g>
      <path id={pathId} d={layout.d} fill="none" stroke="transparent" strokeWidth={10} />
      {active && (
        <path
          d={layout.d}
          fill="none"
          stroke={glowStroke}
          strokeWidth={10}
          strokeLinecap="round"
          opacity={0.35}
        />
      )}
      <path
        d={layout.d}
        fill="none"
        stroke={baseStroke}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeDasharray={active ? '8 6' : '4 4'}
        className={active ? 'flow-arrow-active' : ''}
        opacity={active ? 1 : 0.55}
      />
      {active && (
        <>
          <circle r={4} fill={baseStroke}>
            <animateMotion dur="2.4s" repeatCount="indefinite" rotate="auto">
              <mpath href={`#${pathId}`} />
            </animateMotion>
          </circle>
          <circle r={3} fill={baseStroke} opacity={0.6}>
            <animateMotion dur="2.4s" begin="0.8s" repeatCount="indefinite" rotate="auto">
              <mpath href={`#${pathId}`} />
            </animateMotion>
          </circle>
          <circle r={2.5} fill={baseStroke} opacity={0.4}>
            <animateMotion dur="2.4s" begin="1.6s" repeatCount="indefinite" rotate="auto">
              <mpath href={`#${pathId}`} />
            </animateMotion>
          </circle>
        </>
      )}
    </g>
  );
}
