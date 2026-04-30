import { HardDrive, Workflow, Cpu, Laptop, PlayCircle, AlertTriangle } from 'lucide-react';
import type { NodeLayout } from './flow-layout.js';

const MAP = {
  truenas: HardDrive,
  tdarr: Workflow,
  m4: Cpu,
  m1: Laptop,
  plex: PlayCircle,
  failed: AlertTriangle,
} as const;

export function NodeIcon({
  iconKey,
  size = 28,
  className = '',
}: {
  iconKey: NodeLayout['iconKey'];
  size?: number;
  className?: string;
}) {
  const Cmp = MAP[iconKey];
  return <Cmp size={size} strokeWidth={1.75} className={className} />;
}
