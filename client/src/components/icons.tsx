import type { ReactNode } from 'react'

/**
 * One stroke weight, one grid. Callers pass a name; color comes from currentColor.
 */
export type IconName =
  | 'library'
  | 'settings'
  | 'plus'
  | 'search'
  | 'star'
  | 'starFill'
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
  | 'sidebar'
  | 'bell'
  | 'sun'
  | 'moon'
  | 'play'

const PATHS: Record<IconName, ReactNode> = {
  library: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.6" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.6" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.6" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.6" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M5.8 5.8l1.6 1.6M16.6 16.6l1.6 1.6M18.2 5.8l-1.6 1.6M7.4 16.6l-1.6 1.6" />
    </>
  ),
  plus: (
    <>
      <path d="M12 5v14M5 12h14" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16.5 20 20.5" />
    </>
  ),
  star: <path d="m12 3.6 2.2 4.7 5.2.6-3.8 3.5 1 5.1L12 15.2 7.4 17.5l1-5.1L4.6 8.9l5.2-.6L12 3.6z" />,
  starFill: <path d="m12 3.2 2.4 5.1 5.6.7-4.1 3.8 1.1 5.5L12 15.6 7 18.3l1.1-5.5L4 9l5.6-.7L12 3.2z" fill="currentColor" stroke="none" />,
  arrowLeft: (
    <>
      <path d="M15 5.5 8.5 12 15 18.5" />
      <path d="M9 12h10" />
    </>
  ),
  arrowRight: (
    <>
      <path d="m9 5.5 6.5 6.5L9 18.5" />
      <path d="M5 12h10" />
    </>
  ),
  image: (
    <>
      <rect x="3.5" y="5" width="17" height="14" rx="2" />
      <circle cx="8.5" cy="10" r="1.4" />
      <path d="m6 16.5 3.4-3.2 2.3 2.1 2.2-2.4L18 16.5" />
    </>
  ),
  spark: (
    <>
      <path d="M12 3.5 13.4 9 19 10.5 13.4 12 12 17.5 10.6 12 5 10.5 10.6 9 12 3.5z" />
      <path d="M18 15.5 18.6 17.4 20.5 18 18.6 18.6 18 20.5 17.4 18.6 15.5 18 17.4 17.4 18 15.5z" />
    </>
  ),
  upload: (
    <>
      <path d="M12 16.5V6" />
      <path d="m8 9.5 4-4 4 4" />
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
      <path d="M4 7.5h16v11a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5v-11z" />
      <path d="M3.5 4.5h17v3h-17z" />
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
  close: (
    <>
      <path d="m7 7 10 10M17 7 7 17" />
    </>
  ),
  check: <path d="m5 12.5 4.2 4.2L19 7.5" />,
  compare: (
    <>
      <rect x="3.5" y="5" width="7.5" height="14" rx="1.5" />
      <rect x="13" y="5" width="7.5" height="14" rx="1.5" />
    </>
  ),
  mark: (
    <>
      <circle cx="12" cy="12" r="7.5" />
      <circle cx="12" cy="12" r="2.2" />
      <path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21" />
    </>
  ),
  sidebar: (
    <>
      <rect x="3.5" y="4" width="17" height="16" rx="1.5" />
      <path d="M9 4v16" />
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
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 4.5v1.8M12 17.7v1.8M4.5 12h1.8M17.7 12h1.8M6.7 6.7l1.3 1.3M16 16l1.3 1.3M17.3 6.7 16 8M8 16l-1.3 1.3" />
    </>
  ),
  moon: <path d="M15.5 4.8A7 7 0 1 0 19 14.2 5.4 5.4 0 0 1 15.5 4.8z" />,
  play: <path d="M8 5.5v13l11-6.5-11-6.5z" fill="currentColor" stroke="none" />,
}

export function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {PATHS[name]}
    </svg>
  )
}
