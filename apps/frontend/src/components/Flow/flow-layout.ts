export const NODE_IDS = ['truenas', 'tdarr', 'm4', 'm1', 'plex', 'failed'] as const;
export type NodeId = (typeof NODE_IDS)[number];

export interface NodeLayout {
  id: NodeId;
  label: string;
  icon: string;
  x: number;
  y: number;
}

export interface ArrowLayout {
  id: string;
  from: NodeId;
  to: NodeId;
  d: string;
}

export const NODES: NodeLayout[] = [
  { id: 'truenas', label: 'TrueNAS',     icon: '📦', x:  60, y: 160 },
  { id: 'tdarr',   label: 'Tdarr',       icon: '🎛️', x: 240, y: 160 },
  { id: 'm4',      label: 'Mac Mini M4', icon: '🍎', x: 440, y:  80 },
  { id: 'm1',      label: 'MBP M1',      icon: '💻', x: 440, y: 240 },
  { id: 'plex',    label: 'Plex',        icon: '▶︎',  x: 640, y: 160 },
  { id: 'failed',  label: 'Failed',      icon: '🚨', x: 240, y: 320 },
];

export const ARROWS: ArrowLayout[] = [
  { id: 'truenas-tdarr', from: 'truenas', to: 'tdarr', d: 'M150 175 L240 175' },
  { id: 'tdarr-m4',      from: 'tdarr',   to: 'm4',    d: 'M330 165 L440 95'  },
  { id: 'tdarr-m1',      from: 'tdarr',   to: 'm1',    d: 'M330 185 L440 255' },
  { id: 'm4-plex',       from: 'm4',      to: 'plex',  d: 'M530 95  L640 165' },
  { id: 'm1-plex',       from: 'm1',      to: 'plex',  d: 'M530 255 L640 185' },
  { id: 'tdarr-failed',  from: 'tdarr',   to: 'failed',d: 'M285 195 L240 320' },
];
