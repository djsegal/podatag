import React, { useState, useCallback, useEffect, useMemo } from 'react'
import { useAuth, useProfile, useAvailability } from './hooks'

// ─── Config ──────────────────────────────────────────────────
const FORMATS = ['Draft', 'Cube', 'Commander', 'Modern', 'Standard']
const CITIES = [
  { id: 'berlin', name: 'Berlin', flag: '🇩🇪', lang: 'de' },
  { id: 'atlanta', name: 'Atlanta', flag: '🇺🇸', lang: 'en' },
]
const WEEK_LABELS = {
  de: ['diese Woche', 'nächste Woche', 'übernächste Woche'],
  en: ['this week', 'next week', 'week after next'],
}
const QUORUM = 8

function getHoursForDow(dow) {
  if (dow >= 5) {
    const h = []
    for (let hr = 13; hr <= 20; hr++) { h.push(`${hr}:00`); if (hr < 20) h.push(`${hr}:30`) }
    return h
  }
  return ['17:30', '18:00', '18:30', '19:00', '19:30', '20:00']
}

// ─── Date helpers ────────────────────────────────────────────
function getMondayOfWeek(date) {
  const d = new Date(date); const day = d.getDay()
  d.setDate(d.getDate() + ((day === 0 ? -6 : 1) - day))
  d.setHours(0, 0, 0, 0); return d
}
function addDays(date, n) { const d = new Date(date); d.setDate(d.getDate() + n); return d }
function fmtDate(date) { return date.toISOString().slice(0, 10) }
function fmtShortDate(date) {
  const m = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${m[date.getMonth()]} ${date.getDate()}`
}
function fmtDayLabel(date) { return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][date.getDay()] }
function getDow(date) { return (date.getDay() + 6) % 7 }
function isTodayDate(date) { return fmtDate(date) === fmtDate(new Date()) }

function buildThreeWeeks() {
  const mon = getMondayOfWeek(new Date())
  return [0, 1, 2].map(w => {
    const weekStart = addDays(mon, w * 7)
    const days = Array.from({ length: 7 }, (_, d) => {
      const date = addDays(weekStart, d)
      return {
        date, key: fmtDate(date), label: fmtDayLabel(date),
        shortDate: fmtShortDate(date), dow: getDow(date),
        isToday: isTodayDate(date),
        isPast: date < new Date(new Date().setHours(0,0,0,0)),
      }
    })
    return { start: weekStart, days }
  })
}

// ─── Themes ──────────────────────────────────────────────────
const TH = {
  dark: {
    bg: '#0A0B0F', surface: '#111318', surfaceHover: '#181B22',
    border: '#1F222C', borderActive: '#3D4258',
    text: '#E2E0DB', textMuted: '#828492', textDim: '#4E5064',
    accent: '#A78BFA', accentDim: '#6D28D9', accentGlow: 'rgba(167,139,250,0.13)',
    green: '#34D399', greenDim: 'rgba(52,211,153,0.10)',
    amber: '#FCD34D', amberDim: 'rgba(252,211,77,0.10)',
    inputBg: '#111318', btnText: '#0A0B0F',
  },
  light: {
    bg: '#F4F2EC', surface: '#FFFFFF', surfaceHover: '#EEEBE3',
    border: '#DDD9CE', borderActive: '#B8B2A4',
    text: '#1A1A1A', textMuted: '#6B6860', textDim: '#9E9A90',
    accent: '#7C3AED', accentDim: '#5B21B6', accentGlow: 'rgba(124,58,237,0.10)',
    green: '#059669', greenDim: 'rgba(5,150,105,0.08)',
    amber: '#B45309', amberDim: 'rgba(180,83,9,0.08)',
    inputBg: '#FFFFFF', btnText: '#FFFFFF',
  },
}
const hf = "'Anybody', sans-serif"
const bf = "'Overpass', sans-serif"
const mf = "'Overpass Mono', monospace"

// ─── Micro-components ────────────────────────────────────────
const Badge = ({ children, color, t }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', padding: '2px 7px',
    borderRadius: 5, fontSize: 10, fontWeight: 700, letterSpacing: '0.04em',
    color: color || t.accent, background: `${color || t.accent}18`, fontFamily: mf,
  }}>{children}</span>
)

const Pill = ({ active, onClick, children, t }) => (
  <button onClick={onClick} style={{
    background: active ? t.surfaceHover : 'transparent',
    border: `1px solid ${active ? t.borderActive : 'transparent'}`,
    color: active ? t.text : t.textMuted,
    fontSize: 12, fontWeight: 600, padding: '0 11px', borderRadius: 6,
    cursor: 'pointer', fontFamily: bf, whiteSpace: 'nowrap', height: 28,
    display: 'inline-flex', alignItems: 'center',
  }}>{children}</button>
)

// ─── Auth Panel (Supabase magic link) ────────────────────────
function AuthPanel({ session, profile, onSignIn, onSetName, onSignOut, t }) {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [step, setStep] = useState('closed') // closed | email | check_email | set_name
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)

  // If logged in but no profile, prompt for name
  useEffect(() => {
    if (session && !profile) setStep('set_name')
    else if (session && profile) setStep('closed')
  }, [session, profile])

  if (session && profile) {
    return (
      <>
        <div style={{
          width: 28, height: 28, borderRadius: 7, flexShrink: 0,
          background: `linear-gradient(135deg, ${t.accentDim}, ${t.accent})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 700, color: '#fff',
        }}>{profile.display_name[0].toUpperCase()}</div>
        <span style={{ fontSize: 13, color: t.text, fontWeight: 500, fontFamily: bf }}>
          {profile.display_name}
        </span>
        <button onClick={onSignOut} style={{
          background: 'none', border: `1px solid ${t.border}`, color: t.textMuted,
          fontSize: 11, padding: '0 9px', borderRadius: 6, cursor: 'pointer',
          fontFamily: bf, height: 24, display: 'inline-flex', alignItems: 'center',
        }}>out</button>
      </>
    )
  }

  if (step === 'set_name') {
    return (
      <>
        <input autoFocus value={name} onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && name.trim()) onSetName(name.trim()) }}
          placeholder="pick a display name"
          style={{
            background: t.inputBg, border: `1px solid ${t.border}`, color: t.text,
            fontSize: 13, padding: '0 10px', borderRadius: 7, outline: 'none',
            width: 160, fontFamily: bf, height: 32,
          }} />
        <button onClick={() => { if (name.trim()) onSetName(name.trim()) }}
          disabled={!name.trim()} style={{
            background: name.trim() ? t.accent : t.border, border: 'none',
            color: name.trim() ? t.btnText : t.textDim,
            fontSize: 12, fontWeight: 600, padding: '0 10px', borderRadius: 7,
            cursor: name.trim() ? 'pointer' : 'default',
            fontFamily: bf, height: 32, display: 'inline-flex', alignItems: 'center',
          }}>save</button>
      </>
    )
  }

  if (step === 'check_email') {
    return (
      <span style={{ fontSize: 12, color: t.accent, fontFamily: bf }}>
        Check your email for the login link!
      </span>
    )
  }

  if (step === 'email') {
    return (
      <>
        <input autoFocus value={email} onChange={e => setEmail(e.target.value)}
          onKeyDown={async e => {
            if (e.key === 'Enter' && email.includes('@')) {
              setSending(true)
              const { error } = await onSignIn(email)
              setSending(false)
              if (error) setError(error.message)
              else setStep('check_email')
            }
          }}
          placeholder="your email"
          style={{
            background: t.inputBg, border: `1px solid ${t.border}`, color: t.text,
            fontSize: 13, padding: '0 10px', borderRadius: 7, outline: 'none',
            width: 180, fontFamily: bf, height: 32,
          }} />
        <button onClick={async () => {
            if (!email.includes('@')) return
            setSending(true)
            const { error } = await onSignIn(email)
            setSending(false)
            if (error) setError(error.message)
            else setStep('check_email')
          }}
          disabled={!email.includes('@') || sending} style={{
            background: email.includes('@') && !sending ? t.accent : t.border, border: 'none',
            color: email.includes('@') && !sending ? t.btnText : t.textDim,
            fontSize: 12, fontWeight: 600, padding: '0 10px', borderRadius: 7,
            cursor: email.includes('@') && !sending ? 'pointer' : 'default',
            fontFamily: bf, height: 32, display: 'inline-flex', alignItems: 'center',
          }}>{sending ? '...' : 'send link'}</button>
        <button onClick={() => { setStep('closed'); setEmail(''); setError(null) }} style={{
          background: 'none', border: 'none', color: t.textMuted, fontSize: 18,
          cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', height: 32,
        }}>×</button>
        {error && <span style={{ fontSize: 11, color: '#F87171' }}>{error}</span>}
      </>
    )
  }

  // step === 'closed'
  return (
    <button onClick={() => setStep('email')} style={{
      background: t.accent, border: 'none', color: t.btnText,
      fontSize: 13, fontWeight: 600, padding: '0 16px', borderRadius: 8,
      cursor: 'pointer', fontFamily: bf, height: 34,
      display: 'inline-flex', alignItems: 'center',
    }}>Sign In</button>
  )
}

// ─── Week Grid ───────────────────────────────────────────────
function WeekGrid({ weekDays, mySlots, allSlots, editing, onToggle, t, userName }) {
  const [isDragging, setIsDragging] = useState(false)
  const [dragMode, setDragMode] = useState(null)

  const handleCell = useCallback((dateKey, hour, eventType) => {
    if (!editing) return
    const slotKey = `${dateKey}|${hour}`
    if (eventType === 'down') {
      const mode = mySlots[slotKey] ? 'remove' : 'add'
      setIsDragging(true); setDragMode(mode)
      onToggle(slotKey, mode === 'add')
    } else if (eventType === 'enter' && isDragging) {
      onToggle(slotKey, dragMode === 'add')
    }
  }, [editing, isDragging, dragMode, mySlots, onToggle])

  useEffect(() => {
    const up = () => { setIsDragging(false); setDragMode(null) }
    window.addEventListener('mouseup', up)
    window.addEventListener('touchend', up)
    return () => { window.removeEventListener('mouseup', up); window.removeEventListener('touchend', up) }
  }, [])

  const allHoursSet = new Set()
  weekDays.forEach(d => getHoursForDow(d.dow).forEach(h => allHoursSet.add(h)))
  const allHours = [...allHoursSet].sort((a, b) => {
    const [ah, am] = a.split(':').map(Number)
    const [bh, bm] = b.split(':').map(Number)
    return ah * 60 + am - (bh * 60 + bm)
  })

  function countSlot(dateKey, hour) {
    const sk = `${dateKey}|${hour}`
    let c = 0
    Object.entries(allSlots).forEach(([n, slots]) => { if (n !== userName && slots[sk]) c++ })
    if (mySlots[sk]) c++
    return c
  }
  function heatColor(n) {
    if (n >= QUORUM) return t.green; if (n >= 5) return t.amber
    if (n >= 3) return t.accent; if (n > 0) return t.textDim; return 'transparent'
  }
  function heatBg(n) {
    if (n >= QUORUM) return t.greenDim; if (n >= 5) return t.amberDim
    if (n >= 3) return t.accentGlow; if (n > 0) return `${t.textDim}10`; return 'transparent'
  }

  return (
    <div style={{ userSelect: 'none', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <div style={{
        display: 'grid', gridTemplateColumns: `46px repeat(${weekDays.length}, 1fr)`,
        gap: 2, minWidth: 520,
      }}>
        <div />
        {weekDays.map(d => (
          <div key={d.key} style={{
            textAlign: 'center', padding: '5px 2px 7px',
            borderBottom: d.isToday ? `2px solid ${t.accent}` : `1px solid ${t.border}`,
            opacity: d.isPast ? 0.4 : 1,
          }}>
            <div style={{
              fontSize: 10, fontWeight: 700,
              color: d.isToday ? t.accent : d.dow >= 5 ? t.accent : t.textMuted,
              fontFamily: mf, letterSpacing: '0.06em',
            }}>{d.label}</div>
            <div style={{
              fontSize: 11, fontWeight: d.isToday ? 700 : 500,
              color: d.isToday ? t.text : t.textMuted, fontFamily: bf, marginTop: 2,
            }}>{d.shortDate}</div>
          </div>
        ))}
        {allHours.map(hour => (
          <React.Fragment key={hour}>
            <div style={{
              fontSize: 10, color: t.textDim, fontFamily: mf,
              display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
              paddingRight: 6, height: 34,
            }}>{hour}</div>
            {weekDays.map(d => {
              const dayHours = getHoursForDow(d.dow)
              if (!dayHours.includes(hour)) return <div key={d.key} style={{ height: 34 }} />
              const slotKey = `${d.key}|${hour}`
              const isMine = mySlots[slotKey]
              const count = countSlot(d.key, hour)
              const isHot = count >= QUORUM
              return (
                <div key={d.key}
                  onMouseDown={() => handleCell(d.key, hour, 'down')}
                  onMouseEnter={() => handleCell(d.key, hour, 'enter')}
                  onTouchStart={() => handleCell(d.key, hour, 'down')}
                  style={{
                    height: 34, borderRadius: 5,
                    border: isMine ? `2px solid ${t.accent}` : `1px solid ${t.border}`,
                    background: isMine ? t.accentGlow : heatBg(count),
                    cursor: editing && !d.isPast ? 'pointer' : 'default',
                    opacity: d.isPast ? 0.28 : 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'background 0.08s, border-color 0.08s', position: 'relative',
                  }}>
                  {count > 0 && <span style={{ fontSize: 10, fontWeight: 700, color: heatColor(count), fontFamily: mf }}>{count}</span>}
                  {isHot && <span style={{ position: 'absolute', top: -3, right: 0, fontSize: 7, lineHeight: 1 }}>✦</span>}
                </div>
              )
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  )
}

// ─── Upcoming Pods ───────────────────────────────────────────
function UpcomingPods({ weeks, allSlots, mySlots, t, userName }) {
  const pods = []
  weeks.forEach(week => {
    week.days.forEach(d => {
      if (d.isPast) return
      const hours = getHoursForDow(d.dow)
      let bestHour = null, bestCount = 0
      hours.forEach(h => {
        const sk = `${d.key}|${h}`
        let c = 0
        Object.entries(allSlots).forEach(([n, slots]) => { if (n !== userName && slots[sk]) c++ })
        if (mySlots[sk]) c++
        if (c > bestCount) { bestCount = c; bestHour = h }
      })
      if (bestCount >= 2) pods.push({ ...d, hour: bestHour, count: bestCount })
    })
  })

  if (!pods.length) return (
    <div style={{ textAlign: 'center', padding: '32px 16px', color: t.textMuted, fontSize: 13, fontFamily: bf, lineHeight: 1.6 }}>
      No pods forming yet.<br />Sign in and mark your times to get things started.
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {pods.slice(0, 12).map(p => (
        <div key={p.key + p.hour} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '9px 12px', borderRadius: 8,
          border: `1px solid ${p.count >= QUORUM ? t.green + '40' : t.border}`,
          background: p.count >= QUORUM ? t.greenDim : t.surface,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: mf, fontSize: 11, fontWeight: 700, color: t.text, minWidth: 28 }}>{p.label}</span>
            <span style={{ fontFamily: bf, fontSize: 12, color: t.textMuted }}>{p.shortDate}</span>
            <span style={{ fontFamily: mf, fontSize: 11, color: t.textDim }}>{p.hour}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Badge color={p.count >= QUORUM ? t.green : p.count >= 5 ? t.amber : t.accent} t={t}>{p.count}/{QUORUM}</Badge>
            {p.count >= QUORUM && <span style={{ fontSize: 10, color: t.green, fontWeight: 700, fontFamily: mf }}>FIRE</span>}
          </div>
        </div>
      ))}
    </div>
  )
}

function Legend({ editing, t }) {
  return (
    <div style={{ display: 'flex', gap: 14, marginTop: 10, padding: '8px 0', borderTop: `1px solid ${t.border}`, flexWrap: 'wrap', alignItems: 'center' }}>
      {[[t.textDim,'1-2'],[t.accent,'3-4'],[t.amber,'5-7'],[t.green,`${QUORUM}+ fire`]].map(([c,l]) => (
        <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 9, height: 9, borderRadius: 3, background: `${c}28`, border: `2px solid ${c}` }} />
          <span style={{ fontSize: 10, color: t.textMuted, fontFamily: mf }}>{l}</span>
        </div>
      ))}
      {editing && <span style={{ fontSize: 11, color: t.textMuted, fontStyle: 'italic', fontFamily: bf }}>click + drag to select</span>}
    </div>
  )
}

// ─── Main App ────────────────────────────────────────────────
export default function App() {
  const [dark, setDark] = useState(true)
  const [city, setCity] = useState('berlin')
  const [format, setFormat] = useState('Draft')
  const [weekIdx, setWeekIdx] = useState(0)
  const [showPanel, setShowPanel] = useState('schedule')
  const [editing, setEditing] = useState(false)
  const [mySlots, setMySlots] = useState({})
  const [pendingSlots, setPendingSlots] = useState({})

  const t = dark ? TH.dark : TH.light
  const weeks = useMemo(() => buildThreeWeeks(), [])
  const cityObj = CITIES.find(c => c.id === city)
  const weekLabels = WEEK_LABELS[cityObj.lang] || WEEK_LABELS.en

  // Supabase hooks
  const { session, loading: authLoading, signInWithEmail, signOut } = useAuth()
  const userId = session?.user?.id
  const { profile, upsertProfile } = useProfile(userId)
  const { allSlots, allUsers, loading: dataLoading, submitSlots } = useAvailability(city, format)

  const userName = profile?.display_name

  // Load my slots from allSlots when profile is ready
  useEffect(() => {
    if (userName && allSlots[userName]) {
      setMySlots(allSlots[userName])
    } else {
      setMySlots({})
    }
  }, [userName, allSlots])

  const activeSlots = editing ? pendingSlots : mySlots
  const handleToggle = useCallback((slotKey, add) => {
    if (!editing) return
    setPendingSlots(prev => {
      const next = { ...prev }; if (add) next[slotKey] = true; else delete next[slotKey]; return next
    })
  }, [editing])

  const startEditing = () => { setPendingSlots({ ...mySlots }); setEditing(true) }
  const cancelEditing = () => { setPendingSlots({}); setEditing(false) }
  const handleSubmit = async () => {
    const slots = { ...pendingSlots }
    setMySlots(slots); setEditing(false)
    await submitSlots(userId, Object.keys(slots))
  }

  const handleSetName = async (name) => {
    await upsertProfile(name)
  }

  const loading = authLoading || dataLoading
  const slotCount = Object.keys(activeSlots).length
  const totalPlayers = allUsers.length

  return (
    <div style={{ fontFamily: bf, background: t.bg, color: t.text, minHeight: '100vh', transition: 'background 0.25s, color 0.25s' }}>
      <link href="https://fonts.googleapis.com/css2?family=Anybody:wght@400;600;700;800&family=Overpass:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Overpass+Mono:wght@400;600;700&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{
        padding: '0 18px', height: 56, borderBottom: `1px solid ${t.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8, flexShrink: 0,
            background: `linear-gradient(135deg, ${t.accentDim}, ${t.accent})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, color: '#fff', fontWeight: 800, fontFamily: hf,
          }}>P</div>
          <div style={{ lineHeight: 1.2 }}>
            <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-0.03em', fontFamily: hf, color: t.text }}>podatag</div>
            <div style={{ fontSize: 10, color: t.textMuted, fontFamily: mf }}>{cityObj.flag} {cityObj.name} · {format.toLowerCase()}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 56, flexShrink: 0 }}>
          <button onClick={() => setDark(!dark)} style={{
            background: t.surface, border: `1px solid ${t.border}`, borderRadius: 8,
            width: 34, height: 34, padding: 0, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', fontSize: 14,
          }}>{dark ? '☀️' : '🌙'}</button>
          <AuthPanel session={session} profile={profile}
            onSignIn={signInWithEmail} onSetName={handleSetName} onSignOut={signOut} t={t} />
        </div>
      </div>

      {/* Toolbar */}
      <div style={{
        padding: '0 18px', height: 44, borderBottom: `1px solid ${t.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, overflowX: 'auto',
      }}>
        <div style={{ display: 'flex', gap: 3, alignItems: 'center', flexShrink: 0 }}>
          {weekLabels.map((label, i) => (
            <Pill key={i} t={t} active={weekIdx === i && showPanel === 'schedule'}
              onClick={() => { setWeekIdx(i); setShowPanel('schedule') }}>{label}</Pill>
          ))}
          <div style={{ width: 1, height: 16, background: t.border, margin: '0 2px', flexShrink: 0 }} />
          <Pill t={t} active={showPanel === 'pods'} onClick={() => setShowPanel('pods')}>pods</Pill>
        </div>
        <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexShrink: 0 }}>
          <select value={city} onChange={e => setCity(e.target.value)} style={{
            background: t.inputBg, border: `1px solid ${t.border}`, color: t.text,
            fontSize: 12, padding: '0 8px', borderRadius: 6, fontFamily: bf,
            cursor: 'pointer', outline: 'none', height: 28,
          }}>
            {CITIES.map(c => <option key={c.id} value={c.id}>{c.flag} {c.name}</option>)}
          </select>
          <select value={format} onChange={e => setFormat(e.target.value)} style={{
            background: t.inputBg, border: `1px solid ${t.border}`, color: t.text,
            fontSize: 12, padding: '0 8px', borderRadius: 6, fontFamily: bf,
            cursor: 'pointer', outline: 'none', height: 28,
          }}>
            {FORMATS.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
      </div>

      {/* Main */}
      <div style={{ padding: '16px 18px', maxWidth: 840, margin: '0 auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: t.textMuted, fontSize: 13 }}>Loading...</div>
        ) : showPanel === 'pods' ? (
          <div>
            <h2 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 12px', color: t.text, fontFamily: hf }}>Upcoming Pods</h2>
            <UpcomingPods weeks={weeks} allSlots={allSlots} mySlots={activeSlots} t={t} userName={userName} />
            <div style={{ marginTop: 18, padding: 14, borderRadius: 10, border: `1px solid ${t.border}`, background: t.surface }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: t.textDim, marginBottom: 5, fontFamily: mf, letterSpacing: '0.06em' }}>HOW IT WORKS</div>
              <div style={{ fontSize: 13, color: t.textMuted, lineHeight: 1.7 }}>
                When {QUORUM} players mark overlapping times on the same day, a pod fires.
                Weekdays run 17:30 to 20:00. Weekends open at 13:00.
                One pod per day, per city.
              </div>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 15, fontWeight: 700, fontFamily: hf, color: t.text }}>{weekLabels[weekIdx]}</span>
              <span style={{ fontSize: 12, color: t.textDim, fontFamily: mf }}>
                {fmtShortDate(weeks[weekIdx].start)} – {fmtShortDate(addDays(weeks[weekIdx].start, 6))}
              </span>
            </div>
            <WeekGrid weekDays={weeks[weekIdx].days} mySlots={activeSlots} allSlots={allSlots}
              editing={editing} onToggle={handleToggle} t={t} userName={userName} />
            <Legend editing={editing} t={t} />

            {session && profile && (
              <div style={{ marginTop: 14, display: 'flex', gap: 7, alignItems: 'center', flexWrap: 'wrap' }}>
                {!editing ? (
                  <button onClick={startEditing} style={{
                    background: t.accent, border: 'none', color: t.btnText,
                    fontSize: 13, fontWeight: 600, padding: '0 18px', borderRadius: 8,
                    cursor: 'pointer', fontFamily: bf, height: 38,
                    display: 'inline-flex', alignItems: 'center',
                  }}>Edit Availability</button>
                ) : (
                  <>
                    <button onClick={handleSubmit} style={{
                      background: t.green, border: 'none', color: TH.dark.bg,
                      fontSize: 13, fontWeight: 600, padding: '0 18px', borderRadius: 8,
                      cursor: 'pointer', fontFamily: bf, height: 38,
                      display: 'inline-flex', alignItems: 'center',
                    }}>Submit</button>
                    <button onClick={cancelEditing} style={{
                      background: 'none', border: `1px solid ${t.border}`, color: t.textMuted,
                      fontSize: 13, padding: '0 14px', borderRadius: 8, cursor: 'pointer',
                      fontFamily: bf, height: 36, display: 'inline-flex', alignItems: 'center',
                    }}>Cancel</button>
                    <Badge t={t}>{slotCount} slots</Badge>
                  </>
                )}
              </div>
            )}

            {!session && (
              <div style={{
                marginTop: 14, padding: '12px 14px', borderRadius: 8,
                border: `1px dashed ${t.border}`, color: t.textMuted,
                fontSize: 13, textAlign: 'center', fontFamily: bf,
              }}>Sign in to mark your availability</div>
            )}
          </div>
        )}

        {/* Community */}
        <div style={{
          marginTop: 22, padding: '12px 14px', borderRadius: 10,
          border: `1px solid ${t.border}`, background: t.surface,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 8,
        }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 10, color: t.textDim, fontFamily: mf, marginBottom: 4, letterSpacing: '0.06em' }}>
              COMMUNITY · {cityObj.name.toUpperCase()}
            </div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {allUsers.filter(u => u !== userName).map(u => (
                <span key={u} style={{
                  display: 'inline-flex', alignItems: 'center', padding: '2px 7px',
                  borderRadius: 5, background: t.surfaceHover, fontSize: 11, color: t.textMuted, fontFamily: bf,
                }}>{u}</span>
              ))}
              {userName && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', padding: '2px 7px',
                  borderRadius: 5, background: t.accentGlow, fontSize: 11,
                  color: t.accent, fontWeight: 600, fontFamily: bf,
                }}>★ {userName}</span>
              )}
              {totalPlayers === 0 && <span style={{ fontSize: 11, color: t.textDim }}>Be the first to join.</span>}
            </div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: t.text, fontFamily: hf }}>{totalPlayers}</div>
            <div style={{ fontSize: 9, color: t.textDim, fontFamily: mf }}>PLAYERS</div>
          </div>
        </div>
      </div>
    </div>
  )
}
