export const NODE_IDS = ['truenas', 'tdarr', 'm4', 'm1', 'plex', 'failed'] as const;
export type NodeId = (typeof NODE_IDS)[number];

export type ZoneId = 'storage' | 'orchestrator' | 'workers' | 'delivery' | 'quarantine';

export interface NodeLayout {
  id: NodeId;
  label: string;
  sublabel?: string;
  iconKey: 'truenas' | 'tdarr' | 'm4' | 'm1' | 'plex' | 'failed';
  zone: ZoneId;
  x: number;
  y: number;
}

export interface ArrowLayout {
  id: string;
  from: NodeId;
  to: NodeId;
  d: string;
}

export interface ZoneLayout {
  id: ZoneId;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  tint: string;
}

export const VIEW_BOX = { w: 1100, h: 520 };

export const NODES: NodeLayout[] = [
  { id: 'truenas', label: 'TrueNAS',     sublabel: 'ZFS storage',    iconKey: 'truenas', zone: 'storage',      x: 110, y: 220 },
  { id: 'tdarr',   label: 'Tdarr',       sublabel: 'orchestrator',   iconKey: 'tdarr',   zone: 'orchestrator', x: 360, y: 220 },
  { id: 'm4',      label: 'Mac Mini M4', sublabel: 'VideoToolbox',   iconKey: 'm4',      zone: 'workers',      x: 620, y: 110 },
  { id: 'm1',      label: 'MBP M1',      sublabel: 'VideoToolbox',   iconKey: 'm1',      zone: 'workers',      x: 620, y: 330 },
  { id: 'plex',    label: 'Plex',        sublabel: 'media server',   iconKey: 'plex',    zone: 'delivery',     x: 920, y: 220 },
  { id: 'failed',  label: 'Quarantine',  sublabel: 'unprocessable',  iconKey: 'failed',  zone: 'quarantine',   x: 360, y: 450 },
];

export const ARROWS: ArrowLayout[] = [
  { id: 'truenas-tdarr', from: 'truenas', to: 'tdarr',  d: 'M195 220 Q 280 200 280 220' },
  { id: 'tdarr-m4',      from: 'tdarr',   to: 'm4',     d: 'M445 198 C 510 175 540 130 540 110' },
  { id: 'tdarr-m1',      from: 'tdarr',   to: 'm1',     d: 'M445 242 C 510 265 540 310 540 330' },
  { id: 'm4-plex',       from: 'm4',      to: 'plex',   d: 'M700 110 C 770 130 800 175 840 198' },
  { id: 'm1-plex',       from: 'm1',      to: 'plex',   d: 'M700 330 C 770 310 800 265 840 242' },
  { id: 'tdarr-failed',  from: 'tdarr',   to: 'failed', d: 'M360 270 C 360 320 360 380 360 420' },
];

export const ZONES: ZoneLayout[] = [
  { id: 'storage',      label: 'Storage',      x:  30, y:  60, w: 200, h: 410, tint: '#e8e3d8' },
  { id: 'orchestrator', label: 'Orchestrator', x: 260, y:  60, w: 200, h: 320, tint: '#e2ecdf' },
  { id: 'workers',      label: 'Workers',      x: 490, y:  60, w: 250, h: 410, tint: '#dde7e2' },
  { id: 'delivery',     label: 'Delivery',     x: 770, y:  60, w: 280, h: 410, tint: '#d8e6df' },
  { id: 'quarantine',   label: 'Quarantine',   x: 260, y: 400, w: 200, h:  90, tint: '#f3dad9' },
];
