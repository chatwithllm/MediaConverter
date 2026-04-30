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

export const VIEW_BOX = { w: 1000, h: 440 };

export const NODES: NodeLayout[] = [
  { id: 'truenas', label: 'TrueNAS',     icon: '📦', x: 100, y: 180 },
  { id: 'tdarr',   label: 'Tdarr',       icon: '🎛️', x: 320, y: 180 },
  { id: 'm4',      label: 'Mac Mini M4', icon: '🍎', x: 560, y:  90 },
  { id: 'm1',      label: 'MBP M1',      icon: '💻', x: 560, y: 270 },
  { id: 'plex',    label: 'Plex',        icon: '▶︎',  x: 820, y: 180 },
  { id: 'failed',  label: 'Failed',      icon: '🚨', x: 320, y: 380 },
];

export const ARROWS: ArrowLayout[] = [
  { id: 'truenas-tdarr', from: 'truenas', to: 'tdarr', d: 'M175 180 L245 180' },
  { id: 'tdarr-m4',      from: 'tdarr',   to: 'm4',    d: 'M395 165 L485 105' },
  { id: 'tdarr-m1',      from: 'tdarr',   to: 'm1',    d: 'M395 195 L485 255' },
  { id: 'm4-plex',       from: 'm4',      to: 'plex',  d: 'M635 105 L745 165' },
  { id: 'm1-plex',       from: 'm1',      to: 'plex',  d: 'M635 255 L745 195' },
  { id: 'tdarr-failed',  from: 'tdarr',   to: 'failed',d: 'M320 215 L320 348' },
];
