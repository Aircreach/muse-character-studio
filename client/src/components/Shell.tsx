import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { useTheme, type BrandTheme } from '../hooks/useTheme'
import type { CharacterProfile, View } from '../shared'
import { Icon } from './icons'

export type NoticeItem = { id: number; text: string }
type Connection = 'loading' | 'ready' | 'error'

const THEME_OPTIONS: Array<{ value: BrandTheme; label: string; title: string }> = [
  { value: 'daylight', label: '白昼', title: 'Daylight · 纯白美术馆纸面' },
  { value: 'nocturne', label: '暗房', title: 'Nocturne · 瑞士纯黑暗房' },
  { value: 'blackrock', label: '黑岩', title: 'Aircreach · [Black Rock] 主题' },
]

export function Shell({
  view,
  profiles,
  activeProfileId,
  connection,
  toast,
  notices,
  onNavigate,
  children,
}: {
  view: View
  profiles: CharacterProfile[]
  activeProfileId: string | null
  connection: Connection
  toast: string | null
  notices: NoticeItem[]
  onNavigate: (view: View) => void
  children: ReactNode
}) {
  const { theme, setTheme } = useTheme()
  const [noticesOpen, setNoticesOpen] = useState(false)
  const [commandOpen, setCommandOpen] = useState(false)
  const noticeRef = useRef<HTMLDivElement>(null)
  const listId = useId()

  useEffect(() => {
    if (!noticesOpen) return
    const onPointer = (event: PointerEvent) => {
      if (!noticeRef.current?.contains(event.target as Node)) setNoticesOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setNoticesOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [noticesOpen])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setNoticesOpen(false)
        setCommandOpen((open) => !open)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const go = (next: View) => {
    onNavigate(next)
    setCommandOpen(false)
    setNoticesOpen(false)
  }

  return (
    <div className="muse-shell" data-view={view.kind}>
      <a className="skip-link" href="#main">
        跳到主内容
      </a>

      <header className="hud-topbar">
        <button
          type="button"
          className="hud-brand"
          aria-label="Muse 展厅主页"
          onClick={() => go({ kind: 'home' })}
        >
          <span className="hud-star-mark" aria-hidden>
            <Icon name={theme === 'blackrock' ? 'brsStar' : 'mark'} size={15} />
          </span>
          <span>MUSE</span>
          <span className="hud-brand-tag">
            {theme === 'blackrock' ? 'AIRCREACH // BLACK★ROCK' : 'CHARACTER STUDIO'}
          </span>
        </button>

        <nav className="hud-nav" aria-label="主导航">
          <button
            type="button"
            className="hud-link"
            aria-current={view.kind === 'home' ? 'page' : undefined}
            onClick={() => go({ kind: 'home' })}
          >
            <span className="hud-slash" aria-hidden>//</span>
            展厅
          </button>
          <button
            type="button"
            className="hud-link"
            aria-current={view.kind === 'library' || view.kind === 'workspace' ? 'page' : undefined}
            onClick={() => go({ kind: 'library' })}
          >
            <span className="hud-slash" aria-hidden>//</span>
            档案
          </button>
          <button
            type="button"
            className="hud-link"
            aria-current={view.kind === 'system' ? 'page' : undefined}
            onClick={() => go({ kind: 'system' })}
          >
            <span className="hud-slash" aria-hidden>//</span>
            系统
          </button>
        </nav>

        <div className="hud-tools">
          <div className="theme-switch" role="group" aria-label="切换视觉主题">
            {THEME_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className="theme-opt"
                data-theme-opt={opt.value}
                title={opt.title}
                aria-pressed={theme === opt.value}
                onClick={() => setTheme(opt.value)}
              >
                {opt.value === 'blackrock' ? <Icon name="brsStar" size={10} /> : null}
                <span>{opt.label}</span>
              </button>
            ))}
          </div>

          <button
            type="button"
            className="hud-action-text"
            aria-label="快速索引 (Ctrl K)"
            title="快速索引 (Ctrl K)"
            onClick={() => setCommandOpen(true)}
          >
            <Icon name="search" size={14} />
            <span className="hud-brand-tag">⌘K</span>
          </button>

          <div className="menu-anchor" ref={noticeRef}>
            <button
              type="button"
              className="hud-action-text"
              aria-label="最近操作记录"
              aria-expanded={noticesOpen}
              onClick={() => setNoticesOpen((open) => !open)}
            >
              <Icon name="bell" size={14} />
              {notices.length > 0 ? <span className="dot-count" aria-hidden /> : null}
            </button>
            {noticesOpen ? (
              <div className="popover" role="region" aria-label="最近操作记录">
                <div className="popover-head">
                  <p className="popover-title">
                    LOG // {connection === 'error' ? '后端离线' : connection === 'loading' ? '读取中' : '本地在线'}
                  </p>
                  <span className="mono">{notices.length}</span>
                </div>
                {notices.length === 0 ? (
                  <p className="command-empty">暂无操作记录。</p>
                ) : (
                  <ul className="notice-list">
                    {notices.map((item) => (
                      <li key={item.id}>{item.text}</li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <main id="main" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {children}
      </main>

      {toast ? (
        <div role="status" className="notice-float">
          {toast}
        </div>
      ) : null}

      {commandOpen ? (
        <CommandPalette
          listId={listId}
          profiles={profiles}
          activeProfileId={activeProfileId}
          currentTheme={theme}
          onClose={() => setCommandOpen(false)}
          onRun={go}
          onTheme={(next) => {
            setTheme(next)
            setCommandOpen(false)
          }}
        />
      ) : null}
    </div>
  )
}

function CommandPalette({
  listId,
  profiles,
  activeProfileId,
  currentTheme,
  onClose,
  onRun,
  onTheme,
}: {
  listId: string
  profiles: CharacterProfile[]
  activeProfileId: string | null
  currentTheme: BrandTheme
  onClose: () => void
  onRun: (view: View) => void
  onTheme: (theme: BrandTheme) => void
}) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const previous = useRef<HTMLElement | null>(null)

  const items = useMemo(() => {
    const all = [
      ...profiles.map((profile) => ({
        id: profile.id,
        label: profile.name,
        hint:
          profile.id === activeProfileId
            ? `${profile.subtitle || '角色卡'} · 当前激活`
            : profile.subtitle || '进入画室',
        run: () => onRun({ kind: 'workspace', id: profile.id }),
      })),
      { id: 'home', label: '展厅', hint: '全屏空间展陈', run: () => onRun({ kind: 'home' }) },
      { id: 'library', label: '档案库', hint: '画廊墙与目录索引', run: () => onRun({ kind: 'library' }) },
      { id: 'system', label: '系统', hint: '能力矩阵与解耦边界', run: () => onRun({ kind: 'system' }) },
      ...THEME_OPTIONS.map((t) => ({
        id: `theme-${t.value}`,
        label: `主题：${t.title}`,
        hint: currentTheme === t.value ? '当前启用' : '切换视觉世界',
        run: () => onTheme(t.value),
      })),
    ]
    const q = query.trim().toLowerCase()
    if (!q) return all
    return all.filter((item) => `${item.label} ${item.hint}`.toLowerCase().includes(q))
  }, [activeProfileId, currentTheme, onRun, onTheme, profiles, query])

  useEffect(() => {
    previous.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    inputRef.current?.focus()
    return () => previous.current?.focus()
  }, [])

  useEffect(() => {
    setActive(0)
  }, [query])

  return (
    <>
      <button type="button" className="command-overlay" aria-label="关闭快速索引" onClick={onClose} />
      <div className="command" role="dialog" aria-modal="true" aria-label="快速索引角色、页面或主题">
        <div className="command-head">
          <Icon name="search" size={15} />
          <input
            ref={inputRef}
            className="command-input"
            placeholder="搜索角色、视图或切换主题…"
            aria-controls={listId}
            aria-activedescendant={items[active] ? `${listId}-${items[active].id}` : undefined}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.nativeEvent.isComposing) return
              if (event.key === 'Escape') {
                event.preventDefault()
                onClose()
              } else if (event.key === 'ArrowDown') {
                event.preventDefault()
                setActive((index) => (items.length ? (index + 1) % items.length : 0))
              } else if (event.key === 'ArrowUp') {
                event.preventDefault()
                setActive((index) => (items.length ? (index - 1 + items.length) % items.length : 0))
              } else if (event.key === 'Enter' && items[active]) {
                event.preventDefault()
                items[active].run()
              }
            }}
          />
          <span className="mono">ESC</span>
        </div>
        {items.length === 0 ? (
          <p className="command-empty">没有匹配项。</p>
        ) : (
          <ul className="command-list" id={listId} role="listbox">
            {items.map((item, index) => (
              <li key={item.id}>
                <button
                  type="button"
                  id={`${listId}-${item.id}`}
                  className="command-option"
                  role="option"
                  aria-selected={index === active}
                  onMouseEnter={() => setActive(index)}
                  onClick={item.run}
                >
                  <span>{item.label}</span>
                  <span className="command-hint">{item.hint}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}
