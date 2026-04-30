import { useMemo } from 'react';
import { useEventStream } from '../../hooks/useEventStream.js';
import { NODES, ARROWS } from './flow-layout.js';
import { deriveIndicators } from './flow-state.js';
import { TopologyNode } from './TopologyNode.js';
import { TopologyArrow } from './TopologyArrow.js';
import { TransferBadge } from './TransferBadge.js';

export function FlowView({ onNodeClick }: { onNodeClick?: (id: string) => void }) {
  const { snapshot, status } = useEventStream();
  const indicators = useMemo(() => deriveIndicators(snapshot), [snapshot]);

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs opacity-60">Stream:</span>
        <span
          className={
            'text-xs px-2 py-0.5 rounded ' +
            (status === 'open'
              ? 'bg-accent text-white'
              : status === 'connecting'
                ? 'bg-ink/10'
                : 'bg-danger text-white')
          }
        >
          {status}
        </span>
        <span className="text-xs opacity-60 ml-auto">
          {indicators.failedCount > 0 && `${indicators.failedCount} failed`}
        </span>
      </div>
      <svg viewBox="0 0 800 400" className="w-full max-w-4xl border rounded bg-canvas">
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
  );
}
