import { useMemo } from 'react';
import { useEventStream } from '../../hooks/useEventStream.js';
import { NODES, ARROWS, ZONES, VIEW_BOX } from './flow-layout.js';
import { deriveIndicators } from './flow-state.js';
import { TopologyNode } from './TopologyNode.js';
import { TopologyArrow } from './TopologyArrow.js';
import { TransferBadge } from './TransferBadge.js';

export function FlowView({ onNodeClick }: { onNodeClick?: (id: string) => void }) {
  const { snapshot, status } = useEventStream();
  const indicators = useMemo(() => deriveIndicators(snapshot), [snapshot]);

  const totals = {
    queued: indicators.countsByNode.tdarr,
    encoding: indicators.countsByNode.m4 + indicators.countsByNode.m1,
    inPlex: indicators.countsByNode.plex,
    failed: indicators.failedCount,
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Kpi label="queued"    value={totals.queued}   tone="ink" />
        <Kpi label="encoding"  value={totals.encoding} tone="accent" />
        <Kpi label="in plex"   value={totals.inPlex}   tone="accent-bright" />
        <Kpi label="failed"    value={totals.failed}   tone="danger" />
        <div className="ml-auto flex items-center gap-2 text-xs">
          <span className="opacity-60">stream</span>
          <span
            className={
              'px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide ' +
              (status === 'open'
                ? 'bg-accent text-white'
                : status === 'connecting'
                  ? 'bg-ink/15'
                  : 'bg-danger text-white')
            }
          >
            ● {status}
          </span>
        </div>
      </div>

      <div className="rounded-2xl border border-ink/10 overflow-hidden shadow-sm">
        <svg
          viewBox={`0 0 ${VIEW_BOX.w} ${VIEW_BOX.h}`}
          className="w-full flow-canvas"
        >
          <defs>
            <filter id="soft-blur" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="6" />
            </filter>
          </defs>

          {ZONES.map((z) => (
            <g key={z.id}>
              <rect
                x={z.x}
                y={z.y}
                width={z.w}
                height={z.h}
                rx={20}
                fill={z.tint}
                opacity={0.55}
                stroke={z.tint}
                strokeWidth={1}
              />
              <text x={z.x + 16} y={z.y + 24} className="flow-zone-label">
                {z.label}
              </text>
            </g>
          ))}

          {ARROWS.map((a) => (
            <TopologyArrow
              key={a.id}
              layout={a}
              active={indicators.activeArrows.has(a.id)}
              failed={a.id === 'tdarr-failed' && indicators.failedCount > 0}
            />
          ))}

          {NODES.map((n) => (
            <TopologyNode
              key={n.id}
              layout={n}
              active={indicators.activeNodes.has(n.id)}
              count={indicators.countsByNode[n.id]}
              failed={n.id === 'failed' && indicators.failedCount > 0}
              {...(onNodeClick ? { onClick: () => onNodeClick(n.id) } : {})}
            />
          ))}

          {indicators.transfers.map((t) => {
            const arrow = ARROWS.find((a) => a.id === t.arrowId);
            if (!arrow) return null;
            return <TransferBadge key={t.eventId} arrow={arrow} title={t.title} />;
          })}
        </svg>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'ink' | 'accent' | 'accent-bright' | 'danger';
}) {
  const dot =
    tone === 'accent'
      ? 'bg-accent'
      : tone === 'accent-bright'
        ? 'bg-accent-bright'
        : tone === 'danger'
          ? 'bg-danger'
          : 'bg-ink/40';
  const txt =
    tone === 'danger'
      ? 'text-danger'
      : tone === 'accent' || tone === 'accent-bright'
        ? 'text-accent'
        : 'text-ink';
  return (
    <div className="kpi-card rounded-xl border border-ink/10 px-3 py-2 flex items-center gap-2 min-w-28">
      <span className={`inline-block w-2 h-2 rounded-full ${dot}`} />
      <span className="text-[10px] uppercase tracking-wider opacity-60">{label}</span>
      <span className={`ml-auto text-lg font-bold ${txt}`}>{value}</span>
    </div>
  );
}
