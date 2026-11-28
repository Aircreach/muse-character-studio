import type { ReactNode } from 'react'

/**
 * Muse & Aircreach [Black Rock] icon system — 1.5px sharp architectural stroke
 * plus the signature elongated 5-point Black★Rock star emblem (`brsStar`).
 */
export type IconName =
  | 'library'
  | 'settings'
  | 'plus'
  | 'search'
  | 'star'
  | 'starFill'
  | 'brsStar'
  | 'arrowLeft'
  | 'arrowRight'
  | 'image'
  | 'spark'
  | 'upload'
  | 'layers'
  | 'sliders'
  | 'archive'
  | 'trash'
  | 'close'
  | 'check'
  | 'compare'
  | 'mark'
  | 'bell'
  | 'sun'
  | 'moon'
  | 'play'
  | 'edit'
  | 'copy'
  | 'expand'
  | 'film'
  | 'power'
  | 'chevronRight'
  | 'restore'
  | 'grid'
  | 'list'

const PATHS: Record<IconName, ReactNode> = {
  library: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" />
      <rect x="13.5" y="3.5" width="7" height="7" />
      <rect x="3.5" y="13.5" width="7" height="7" />
      <rect x="13.5" y="13.5" width="7" height="7" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M5.8 5.8l1.6 1.6M16.6 16.6l1.6 1.6M18.2 5.8l-1.6 1.6M7.4 16.6l-1.6 1.6" />
    </>
  ),
  plus: <path d="M12 4.5v15M4.5 12h15" />,
  search: (
    <>
      <circle cx="10.75" cy="10.75" r="6.25" />
      <path d="m15.5 15.5 4.5 4.5" />
    </>
  ),
  star: <path d="m12 3.6 2.2 4.7 5.2.6-3.8 3.5 1 5.1L12 15.2 7.4 17.5l1-5.1L4.6 8.9l5.2-.6L12 3.6z" />,
  starFill: (
    <path
      d="m12 3.2 2.4 5.1 5.6.7-4.1 3.8 1.1 5.5L12 15.6 7 18.3l1.1-5.5L4 9l5.6-.7L12 3.2z"
      fill="currentColor"
      stroke="none"
    />
  ),
  /** Signature elongated asymmetric 5-pointed star echoing original Black★Rock Shooter coat & title motif */
  brsStar: (
    <path
      d="M12 1.2 L14.1 8.8 L22.4 9.2 L15.6 13.7 L18.4 22.2 L12 16.9 L5.6 22.2 L8.4 13.7 L1.6 9.2 L9.9 8.8 Z"
      fill="currentColor"
      stroke="none"
    />
  ),
  arrowLeft: (
    <>
      <path d="M11 6 5 12l6 6" />
      <path d="M5.5 12H19" />
    </>
  ),
  arrowRight: (
    <>
      <path d="m13 6 6 6-6 6" />
      <path d="M5 12h13.5" />
    </>
  ),
  image: (
    <>
      <rect x="3.5" y="5" width="17" height="14" />
      <circle cx="8.5" cy="10" r="1.4" />
      <path d="m6 16.5 3.4-3.2 2.3 2.1 2.2-2.4L18 16.5" />
    </>
  ),
  spark: (
    <>
      <path d="M12 3 13.4 9.4 19.5 10.8 13.4 12.2 12 18.5 10.6 12.2 4.5 10.8 10.6 9.4 12 3z" />
      <path d="M18.2 15.5 18.8 17.4 20.7 18 18.8 18.6 18.2 20.5 17.6 18.6 15.7 18 17.6 17.4 18.2 15.5z" />
    </>
  ),
  upload: (
    <>
      <path d="M12 16V5.5" />
      <path d="m8 9.2 4-4 4 4" />
      <path d="M5 18.5h14" />
    </>
  ),
  layers: (
    <>
      <path d="m12 4 8 4-8 4-8-4 8-4z" />
      <path d="m4 12 8 4 8-4" />
      <path d="m4 16 8 4 8-4" />
    </>
  ),
  sliders: (
    <>
      <path d="M4 8h16M4 16h16" />
      <circle cx="9" cy="8" r="2.2" />
      <circle cx="15" cy="16" r="2.2" />
    </>
  ),
  archive: (
    <>
      <path d="M4 8h16v11.5H4V8z" />
      <path d="M3 4.5h18V8H3z" />
      <path d="M10 12.5h4" />
    </>
  ),
  trash: (
    <>
      <path d="M5 7.5h14" />
      <path d="M9.5 7.5V5.5h5v2" />
      <path d="M7 7.5 7.8 19h8.4l.8-11.5" />
    </>
  ),
  close: <path d="m6.5 6.5 11 11M17.5 6.5l-11 11" />,
  check: <path d="m5 12.5 4.2 4.2L19 7.5" />,
  compare: (
    <>
      <rect x="3.5" y="5" width="7.2" height="14" />
      <rect x="13.3" y="5" width="7.2" height="14" />
    </>
  ),
  mark: (
    <>
      <path d="M12 2.4 19.6 12 12 21.6 4.4 12 12 2.4z" />
      <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
    </>
  ),
  bell: (
    <>
      <path d="M6 16.5h12l-1.2-2V11a4.8 4.8 0 0 0-9.6 0v3.5L6 16.5z" />
      <path d="M10 16.5a2 2 0 0 0 4 0" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="3.4" />
      <path d="M12 4.2v1.9M12 17.9v1.9M4.2 12h1.9M17.9 12h1.9M6.6 6.6l1.3 1.3M16.1 16.1l1.3 1.3M17.4 6.6l-1.3 1.3M7.9 16.1l-1.3 1.3" />
    </>
  ),
  moon: <path d="M15.6 4.8A7 7 0 1 0 19.2 14.3 5.4 5.4 0 0 1 15.6 4.8z" />,
  play: <path d="M8.5 5.8v12.4L18.8 12 8.5 5.8z" fill="currentColor" stroke="none" />,
  edit: (
    <>
      <path d="M14.8 5.2 18.8 9.2 9.2 18.8H5.2v-4l9.6-9.6z" />
      <path d="m12.8 7.2 4 4" />
    </>
  ),
  copy: (
    <>
      <rect x="9" y="9" width="11" height="11" />
      <path d="M15 9V5H5v10h4" />
    </>
  ),
  expand: <path d="M14.5 5H19v4.5M9.5 19H5v-4.5M19 5l-5.2 5.2M5 19l5.2-5.2" />,
  film: (
    <>
      <rect x="3.5" y="5" width="17" height="14" />
      <path d="M7.5 5v14M16.5 5v14M3.5 9.5h4M16.5 9.5h4M3.5 14.5h4M16.5 14.5h4" />
    </>
  ),
  power: (
    <>
      <path d="M12 4.5v7" />
      <path d="M7.6 7.4a6.5 6.5 0 1 0 8.8 0" />
    </>
  ),
  chevronRight: <path d="m9.5 6.5 5.5 5.5-5.5 5.5" />,
  restore: (
    <>
      <path d="M5 10.5A7 7 0 1 1 7.2 17" />
      <path d="M5 5.5v5h5" />
    </>
  ),
  grid: (
    <>
      <rect x="3.5" y="3.5" width="6.5" height="6.5" />
      <rect x="14" y="3.5" width="6.5" height="6.5" />
      <rect x="3.5" y="14" width="6.5" height="6.5" />
      <rect x="14" y="14" width="6.5" height="6.5" />
    </>
  ),
  list: (
    <>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </>
  ),
}

export function Icon({ name, size = 16, className = '' }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      className={`icon ${className}`.trim()}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden
    >
      {PATHS[name]}
    </svg>
  )
}
