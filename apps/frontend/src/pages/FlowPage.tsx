import { FlowView } from '../components/Flow/FlowView.js';

export function FlowPage({ onNodeClick }: { onNodeClick?: (id: string) => void }) {
  return (
    <div>
      <h2 className="text-lg font-semibold mb-2">Live Flow</h2>
      <FlowView {...(onNodeClick ? { onNodeClick } : {})} />
    </div>
  );
}
