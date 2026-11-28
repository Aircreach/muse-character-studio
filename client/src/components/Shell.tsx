import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import type { CharacterProfile, View } from '../shared'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { Icon } from './icons'

export type NoticeItem = { id: number; text: string }
type Connection = 'loading' | 'ready' | 'error'
type Menu = 'notices' | 'session' | null

const SIDEBAR_KEY = 'mcs-ui-sidebar'

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
  const narrow = useMediaQuery('(max-width: 800px)')
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_KEY) === 'collapsed'
    } catch {
      return false
    }
  })
  const [navOpen, setNavOpen] = useState(false)
  const [menu, setMenu] = useState<Menu>(null)
  const [commandOpen, setCommandOpen] = useState(false)
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))
  const menuRef = useRef<HTMLDivElement>(null)
  const listId = useId()

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_KEY, collapsed ? 'collapsed' : 'expanded')
    } catch {
      /* ignore quota / private mode */
    }
  }, [collapsed])

  useEffect(() => {
    if (!menu) return
    const onPointer = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenu(null)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenu(null)
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [menu])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setMenu(null)
        setCommandOpen((open) => !open)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const go = (next: View) => {
    onNavigate(next)
    setNavOpen(false)
    setCommandOpen(false)
    setMenu(null)
  }

  const toggleTheme = () => {
    const next = document.documentElement.classList.toggle('dark')
    setDark(next)
    try {
      localStorage.setItem('mcs-ui-theme', next ? 'dark' : 'light')
    } catch {
      /* ignore */
    }
  }

  const current = profiles.find((profile) => view.kind === 'workspace' && profile.id === view.id)
  const active = profiles.find((profile) => profile.id === activeProfileId)
  const sidebarMode = narrow ? 'overlay' : collapsed ? 'collapsed' : 'expanded'
  const connectionLabel = connection === 'error' ? '未连接后端' : connection === 'loading' ? '正在读取' : '已连接'

  return (
    <div className="shell" data-sidebar={sidebarMode} data-nav={navOpen ? 'open' : 'closed'}>
      <a className="skip-link" href="#main">跳到主内容</a>
      {narrow && navOpen ? (
        <button type="button" className="nav-scrim" aria-label="关闭导航" onClick={() => setNavOpen(false)} />
      ) : null}
      <aside className="shell-side" aria-label="全局导航">
        <button type="button" className="side-brand" aria-label="Muse Character Studio" onClick={() => go({ kind: 'library' })}>
          <span className="side-logo" aria-hidden>
            <Icon name="mark" size={16} />
          </span>
          <span>
            <span className="side-mark">Muse</span>
            <span className="side-product">Character Studio</span>
          </span>
        </button>
        <nav className="side-nav" aria-label="主导航">
          <button
            type="button"
            className="side-link"
            aria-current={view.kind === 'library' ? 'page' : undefined}
            title={collapsed ? '角色库' : undefined}
            onClick={() => go({ kind: 'library' })}
          >
            <Icon name="library" />
            <span className="side-label">角色库</span>
          </button>
          <button
            type="button"
            className="side-link"
            aria-current={view.kind === 'system' ? 'page' : undefined}
            title={collapsed ? '系统' : undefined}
            onClick={() => go({ kind: 'system' })}
          >
            <Icon name="settings" />
            <span className="side-label">系统</span>
          </button>
        </nav>
        <div className="side-foot">
          <button
            type="button"
            className="icon-btn side-collapse"
            aria-pressed={collapsed}
            aria-label={collapsed ? '展开侧栏' : '折叠侧栏'}
            onClick={() => setCollapsed((value) => !value)}
          >
            <Icon name="sidebar" />
            <span className="side-label">{collapsed ? '展开侧栏' : '折叠侧栏'}</span>
          </button>
        </div>
      </aside>

      <div className="shell-column">
        <header className="shell-header">
          <button
            type="button"
            className="icon-btn nav-toggle"
            aria-label={navOpen ? '关闭导航' : '打开导航'}
            aria-expanded={navOpen}
            onClick={() => setNavOpen((open) => !open)}
          >
            <Icon name="sidebar" />
          </button>
          <nav className="crumbs" aria-label="面包屑">
            {view.kind === 'workspace' ? (
              <>
                <button type="button" className="crumb" onClick={() => go({ kind: 'library' })}>角色库</button>
                <span aria-hidden>/</span>
                <span className="crumb-current">{current?.name ?? '角色'}</span>
              </>
            ) : (
              <span className="crumb-current">{view.kind === 'system' ? '系统' : '角色库'}</span>
            )}
          </nav>
          <button type="button" className="header-search" aria-label="搜索角色或跳转" onClick={() => setCommandOpen(true)}>
            <Icon name="search" size={15} />
            <span>搜索角色或跳转</span>
            <kbd>Ctrl K</kbd>
          </button>
          <div className="header-tools" ref={menuRef}>
            <div className="menu-anchor">
              <button
                type="button"
                className="icon-btn"
                aria-label="最近反馈"
                aria-expanded={menu === 'notices'}
                onClick={() => setMenu((currentMenu) => (currentMenu === 'notices' ? null : 'notices'))}
              >
                <Icon name="bell" />
                {notices.length ? <span className="dot-count" aria-hidden /> : null}
              </button>
              {menu === 'notices' ? (
                <div className="popover" role="region" aria-label="最近反馈">
                  <p className="popover-title">最近反馈</p>
                  {notices.length === 0 ? (
                    <p className="command-empty">还没有操作反馈。</p>
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
            <div className="menu-anchor">
              <button
                type="button"
                className="icon-btn"
                aria-label="本地会话"
                aria-expanded={menu === 'session'}
                onClick={() => setMenu((currentMenu) => (currentMenu === 'session' ? null : 'session'))}
              >
                <Icon name={dark ? 'moon' : 'sun'} />
              </button>
              {menu === 'session' ? (
                <div className="popover" role="menu" aria-label="本地会话">
                  <p className="popover-title">本地会话</p>
                  <div className="menu-list">
                    <button type="button" className="menu-item" role="menuitem" onClick={toggleTheme}>
                      <Icon name={dark ? 'sun' : 'moon'} size={15} />
                      {dark ? '使用浅色房间' : '使用黑房间'}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <div className="shell-body" id="main">
          {children}
        </div>

        <footer className="shell-status">
          <span className="status-item">
            <span className={`status-dot ${connection === 'error' ? 'dot-bad' : connection === 'loading' ? 'dot-warn' : 'dot-good'}`} aria-hidden />
            <span aria-live="polite">{connectionLabel}</span>
          </span>
          {connection === 'ready' ? (
            <span className="status-item num">{profiles.length} 张角色卡</span>
          ) : null}
          <span className="status-item status-quiet">
            激活
            <span className="num">{active?.name ?? '无'}</span>
          </span>
          <span className="status-item status-quiet">shared_base</span>
        </footer>
      </div>

      {toast ? <div role="status" className="notice notice-float">{toast}</div> : null}
      {commandOpen ? (
        <CommandPalette
          listId={listId}
          profiles={profiles}
          onClose={() => setCommandOpen(false)}
          onRun={go}
        />
      ) : null}
    </div>
  )
}

function CommandPalette({
  listId,
  profiles,
  onClose,
  onRun,
}: {
  listId: string
  profiles: CharacterProfile[]
  onClose: () => void
  onRun: (view: View) => void
}) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const previous = useRef<HTMLElement | null>(null)

  const items = useMemo(() => {
    const all = [
      { id: 'library', label: '角色库', hint: '页面', run: () => onRun({ kind: 'library' }) },
      { id: 'system', label: '系统', hint: '页面', run: () => onRun({ kind: 'system' }) },
      ...profiles.map((profile) => ({
        id: profile.id,
        label: profile.name,
        hint: profile.subtitle || '打开角色',
        run: () => onRun({ kind: 'workspace', id: profile.id }),
      })),
    ]
    const q = query.trim().toLowerCase()
    if (!q) return all
    return all.filter((item) => `${item.label} ${item.hint}`.toLowerCase().includes(q))
  }, [onRun, profiles, query])

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
      <button type="button" className="command-overlay" aria-label="关闭搜索" onClick={onClose} />
      <div className="command" role="dialog" aria-modal="true" aria-label="搜索角色或跳转">
        <input
          ref={inputRef}
          className="command-input"
          placeholder="搜索角色、角色库或系统"
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
