/**
 * Re-skin design system — icon set.
 *
 * Lucide-style 24×24 stroke icons, drawn at 16px / strokeWidth 1.6 by
 * default. Ported from the design prototype; this is the single icon
 * source for re-skinned components.
 */

import type { CSSProperties, ReactNode } from 'react';

export type IconName =
  | 'search' | 'plus' | 'chevronDown' | 'chevronRight' | 'chevronLeft'
  | 'chevronUpDown' | 'more' | 'moreV' | 'filter' | 'sort' | 'group'
  | 'eye' | 'eyeOff' | 'share' | 'table' | 'grid' | 'kanban' | 'calendar'
  | 'layers' | 'database' | 'users' | 'layout' | 'monitor' | 'smartphone'
  | 'tablet' | 'command' | 'settings' | 'bell' | 'inbox' | 'history'
  | 'user' | 'shield' | 'link' | 'copy' | 'trash' | 'edit' | 'expand'
  | 'external' | 'check' | 'x' | 'text' | 'hash' | 'email' | 'attach'
  | 'toggle' | 'type' | 'formula' | 'ai' | 'branch' | 'pin' | 'drag'
  | 'play' | 'publish' | 'globe' | 'zap' | 'star' | 'bookOpen' | 'filter2'
  | 'refresh' | 'arrow' | 'arrowRight' | 'arrowUp' | 'arrowDown' | 'warn'
  | 'lock' | 'key' | 'folder' | 'download' | 'upload' | 'image' | 'square'
  | 'divider' | 'list' | 'columns' | 'tabs' | 'formField' | 'chart'
  | 'pieChart' | 'stats' | 'buttonIcon' | 'inputIcon' | 'dropdownIcon'
  | 'toggleIcon' | 'tagIcon';

const ICONS: Record<IconName, ReactNode> = {
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  chevronDown: <path d="m6 9 6 6 6-6" />,
  chevronRight: <path d="m9 6 6 6-6 6" />,
  chevronLeft: <path d="m15 6-6 6 6 6" />,
  chevronUpDown: <><path d="m8 9 4-4 4 4" /><path d="m16 15-4 4-4-4" /></>,
  more: <><circle cx="5" cy="12" r="1.2" /><circle cx="12" cy="12" r="1.2" /><circle cx="19" cy="12" r="1.2" /></>,
  moreV: <><circle cx="12" cy="5" r="1.2" /><circle cx="12" cy="12" r="1.2" /><circle cx="12" cy="19" r="1.2" /></>,
  filter: <path d="M4 5h16l-6 8v6l-4-2v-4z" />,
  sort: <><path d="M3 7h13M3 12h8M3 17h4" /><path d="m18 7 3 3-3 3" /><path d="M21 10h-6" /></>,
  group: <><rect x="3" y="4" width="7" height="7" rx="1.5" /><rect x="14" y="4" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
  eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="2.5" /></>,
  eyeOff: <path d="M9.9 4.24A10 10 0 0 1 12 4c6.5 0 10 7 10 7a17 17 0 0 1-2.46 3.51M14.12 14.12A3 3 0 1 1 9.88 9.88M2 2l20 20M6.61 6.61A14 14 0 0 0 2 11s3.5 7 10 7c1.6 0 3.07-.34 4.4-.9" />,
  share: <><circle cx="18" cy="5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="19" r="2.5" /><path d="m8.2 10.8 7.6-4.6M8.2 13.2l7.6 4.6" /></>,
  table: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 10h18M9 4v16" /></>,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
  kanban: <><rect x="4" y="3" width="5" height="18" rx="1.5" /><rect x="11" y="3" width="5" height="11" rx="1.5" /><rect x="18" y="3" width="3" height="7" rx="1.5" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  layers: <><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 13 9 5 9-5M3 18l9 5 9-5" /></>,
  database: <><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v6c0 1.66 3.58 3 8 3s8-1.34 8-3V5" /><path d="M4 11v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6" /></>,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><circle cx="17" cy="9" r="2.5" /><path d="M16 20a5 5 0 0 1 5.5-4.97" /></>,
  layout: <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" /></>,
  monitor: <><rect x="2" y="4" width="20" height="13" rx="2" /><path d="M8 21h8M12 17v4" /></>,
  smartphone: <><rect x="6" y="2" width="12" height="20" rx="2.5" /><path d="M11 18h2" /></>,
  tablet: <><rect x="4" y="2" width="16" height="20" rx="2" /><path d="M11 18h2" /></>,
  command: <path d="M9 6H6.5a2.5 2.5 0 1 0 0 5H9V6Zm0 0h6v5H9V6Zm0 5h6v5H9v-5Zm6 5v2.5a2.5 2.5 0 1 0 2.5-2.5H15Zm0-10V3.5A2.5 2.5 0 1 1 17.5 6H15Zm-6 10H6.5a2.5 2.5 0 1 0 2.5 2.5V16Z" />,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.36.15.68.4.9.72.21.31.34.68.36 1.07v.41a1.65 1.65 0 0 0 1 1.51l.09.03" /></>,
  bell: <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a2 2 0 0 0 3.4 0" /></>,
  inbox: <><path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z" /></>,
  history: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /><path d="M12 7v5l3 2" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />,
  link: <><path d="M10 14a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.71 1.71" /><path d="M14 10a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></>,
  copy: <><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></>,
  trash: <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />,
  edit: <><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z" /></>,
  expand: <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />,
  external: <><path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" /></>,
  check: <path d="M5 12.5 10 17.5 19.5 8" />,
  x: <path d="M6 6l12 12M6 18 18 6" />,
  text: <path d="M4 6h16M7 12h10M10 18h4" />,
  hash: <path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18" />,
  email: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
  attach: <path d="m21 12-9.5 9.5a4 4 0 0 1-5.66-5.66l9.19-9.19a3 3 0 1 1 4.24 4.24L11.16 19.07a1.5 1.5 0 0 1-2.12-2.12l8-8" />,
  toggle: <><rect x="2" y="6" width="20" height="12" rx="6" /><circle cx="8" cy="12" r="3" /></>,
  type: <path d="M4 7V4h16v3M9 20h6M12 4v16" />,
  formula: <><path d="M15 5H9.5a2 2 0 0 0-2 2v2H5" /><path d="M19 11h-4M11 11H5" /><path d="m14 16-4 5M10 16l4 5" /></>,
  ai: <><path d="M12 2v4M12 18v4M5 5l2.5 2.5M16.5 16.5 19 19M2 12h4M18 12h4M5 19l2.5-2.5M16.5 7.5 19 5" /><circle cx="12" cy="12" r="4" /></>,
  branch: <><circle cx="6" cy="6" r="2.5" /><circle cx="6" cy="18" r="2.5" /><circle cx="18" cy="8" r="2.5" /><path d="M6 8.5v7M18 10.5c0 6-6 4-6 8" /></>,
  pin: <path d="M12 2 9 9l-5 1 4 4-2 8 6-4 6 4-2-8 4-4-5-1Z" />,
  drag: <><circle cx="9" cy="6" r="1" /><circle cx="9" cy="12" r="1" /><circle cx="9" cy="18" r="1" /><circle cx="15" cy="6" r="1" /><circle cx="15" cy="12" r="1" /><circle cx="15" cy="18" r="1" /></>,
  play: <path d="m8 5 12 7-12 7Z" />,
  publish: <><path d="M12 19V5" /><path d="m5 12 7-7 7 7" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></>,
  zap: <path d="m13 2-10 13h7l-1 7 10-13h-7l1-7Z" />,
  star: <path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2Z" />,
  bookOpen: <><path d="M2 4h7a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H2Z" /><path d="M22 4h-7a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h8Z" /></>,
  filter2: <path d="M3 6h18M6 12h12M10 18h4" />,
  refresh: <><path d="M21 12a9 9 0 1 1-2.64-6.36L21 8" /><path d="M21 3v5h-5" /></>,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  arrowRight: <path d="M5 12h14M13 6l6 6-6 6" />,
  arrowUp: <path d="M12 19V5M5 12l7-7 7 7" />,
  arrowDown: <path d="M12 5v14M5 12l7 7 7-7" />,
  warn: <><path d="M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" /><path d="M12 9v4M12 17h.01" /></>,
  lock: <><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>,
  key: <><circle cx="7.5" cy="15.5" r="4.5" /><path d="m10.7 12.3 9.3-9.3M16 6l3 3" /></>,
  folder: <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />,
  download: <><path d="M12 3v12M5 12l7 7 7-7" /><path d="M3 21h18" /></>,
  upload: <><path d="M12 21V9M5 12l7-7 7 7" /><path d="M3 3h18" /></>,
  image: <><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" /></>,
  square: <rect x="4" y="4" width="16" height="16" rx="2" />,
  divider: <path d="M3 12h18" />,
  list: <><path d="M3 6h14M3 12h14M3 18h14" /><circle cx="20.5" cy="6" r="0.6" /><circle cx="20.5" cy="12" r="0.6" /><circle cx="20.5" cy="18" r="0.6" /></>,
  columns: <><rect x="3" y="3" width="7" height="18" rx="1.5" /><rect x="14" y="3" width="7" height="18" rx="1.5" /></>,
  tabs: <><path d="M3 9V6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v1" /><rect x="3" y="9" width="18" height="11" rx="2" /></>,
  formField: <><rect x="3" y="6" width="18" height="5" rx="1.5" /><rect x="3" y="14" width="13" height="5" rx="1.5" /></>,
  chart: <><path d="M4 4v16h16" /><path d="m8 14 3-4 3 3 5-7" /></>,
  pieChart: <><path d="M21 12a9 9 0 1 1-9-9v9Z" /><path d="M21 12a9 9 0 0 0-9-9v9Z" /></>,
  stats: <path d="M4 20V8M10 20v-7M16 20v-4M22 20H2" />,
  buttonIcon: <><rect x="3" y="9" width="18" height="6" rx="3" /><path d="M8 12h8" /></>,
  inputIcon: <rect x="3" y="9" width="18" height="6" rx="1.5" />,
  dropdownIcon: <><rect x="3" y="9" width="18" height="6" rx="1.5" /><path d="m17 11.5 1.5 1.5 1.5-1.5" /></>,
  toggleIcon: <><rect x="3" y="8" width="14" height="8" rx="4" /><circle cx="13" cy="12" r="2" /></>,
  tagIcon: <><path d="M3 5a2 2 0 0 1 2-2h6l9 9-8 8-9-9Z" /><circle cx="8" cy="8" r="1.5" /></>,
};

export interface IconProps {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  color?: string;
  style?: CSSProperties;
  className?: string;
}

export function Icon({
  name,
  size = 16,
  strokeWidth = 1.6,
  color = 'currentColor',
  style,
  className,
}: IconProps) {
  const paths = ICONS[name];
  if (!paths) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      className={className}
      aria-hidden="true"
    >
      {paths}
    </svg>
  );
}
