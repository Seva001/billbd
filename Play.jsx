import { useEffect, useRef, useState } from 'react'
import { supabase, naira } from './supabase'

export const level = pts => Math.floor((pts || 0) / 30) + 1

// Streak + level card (shown on Profile, as in v2).
export function Streak({ w, reload }) {
  const [busy, setBusy] = useState(false), [note, setNote] = useState('')
  if (!w) return null
  const on = w.streak % 7 || (w.streak ? 7 : 0)
  async function check() {
    setBusy(true)
    const { data, error } = await supabase.rpc('claim_daily')
    setBusy(false)
    setNote(error ? 'Could not check in. Try again.' : data.awarded ? `Day ${data.streak} · +${data.awarded} points` : '')
    reload()
  }
  return (
    <>
      <div className="card streak">
        <div className="row"><div><b className="sk-n">{w.streak}</b><span className="mu">day streak{w.best ? ' · best ' + w.best : ''}</span></div><span className="demo">Virtual points</span></div>
        <div className="wk" aria-hidden="true">{[...'MTWTFSS'].map((d, i) => <span key={i} className={i < on ? 'on' : ''}>{d}</span>)}</div>
        <button className="btn" disabled={busy || w.checked_today} onClick={check}>{w.checked_today ? 'Checked in today' : 'Check in today · +10 points'}</button>
        {note && <p className="mu" role="status">{note}</p>}
        <p className="mu">Streaks and points aren’t cash and never affect bill review.</p>
      </div>
      <div className="card">
        <div className="row"><h3>Level {level(w.points)}</h3><b>{w.points} virtual points</b></div>
        <div className="bar"><i style={{ width: (w.points % 30) / 30 * 100 + '%' }} /></div>
        <p className="mu">{30 - (w.points % 30)} points to level {level(w.points) + 1}.</p>
      </div>
    </>
  )
}

export default function Play({ user, go, start = 'deck', reload }) {
  const [sec, setSec] = useState(start)
  return (
    <>
      <h1>Arena</h1>
      <div role="tablist" aria-label="Arena sections">
        {[['deck', 'Swipe deck'], ['arena', 'Quiz'], ['top', 'Top 10']].map(([k, t]) => <button key={k} role="tab" aria-selected={sec === k} className={'chip ' + (sec === k ? 'on' : '')} onClick={() => setSec(k)}>{t}</button>)}
      </div>
      {sec === 'deck' && <Deck user={user} go={go} />}
      {sec === 'arena' && <Quiz reload={reload} go={go} />}
      {sec === 'top' && <Top go={go} />}
    </>
  )
}

// Drag a card: right past 95px = yes, left = next (same thresholds as v2).
function Swipe({ onYes, onNo, children }) {
  const [dx, setDx] = useState(0), x0 = useRef(null)
  const end = () => { if (x0.current === null) return; x0.current = null; const d = dx; setDx(0); if (d > 95) onYes(); else if (d < -95) onNo() }
  return (
    <div className="card swipe" style={{ transform: `translateX(${dx}px) rotate(${dx / 28}deg)`, opacity: Math.max(.65, 1 - Math.abs(dx) / 650), transition: x0.current === null ? 'transform .2s,opacity .2s' : 'none' }}
      onPointerDown={e => { if (e.target.closest('button')) return; x0.current = e.clientX; e.currentTarget.setPointerCapture(e.pointerId) }}
      onPointerMove={e => { if (x0.current !== null) setDx(e.clientX - x0.current) }} onPointerUp={end} onPointerCancel={() => { x0.current = null; setDx(0) }}>{children}</div>
  )
}

function Deck({ user, go }) {
  const [mode, setMode] = useState('bills'), [bills, setBills] = useState(null), [people, setPeople] = useState(null), [saved, setSaved] = useState([])
  const [i, setI] = useState(0), [note, setNote] = useState(''), [loadError, setLoadError] = useState('')
  useEffect(() => {
    supabase.from('public_bills').select('*').in('status', ['eligible', 'partially_supported']).then(({ data, error }) => { if (error) { setLoadError('Could not load the swipe deck. Try again.'); setBills([]) } else setBills(data || []) })
    supabase.from('bill_saves').select('bill_id').then(({ data, error }) => { if (!error) setSaved((data || []).map(x => x.bill_id)) })
    Promise.all([supabase.from('figures').select('id,name,tagline,category').order('name'), supabase.from('follows').select('figure_id').eq('user_id', user.id)]).then(([f, fo]) => {
      let sk = []; try { sk = JSON.parse(localStorage.getItem('bb_skip') || '[]') } catch (_e) { /* ignore */ }
      const done = new Set([...(fo.data || []).map(x => x.figure_id), ...sk])
      setPeople((f.data || []).filter(x => !done.has(x.id)))
    })
  }, [])
  async function save(b) {
    const has = saved.includes(b.id)
    const { error } = has ? await supabase.from('bill_saves').delete().eq('bill_id', b.id).eq('user_id', user.id) : await supabase.from('bill_saves').insert({ user_id: user.id, bill_id: b.id })
    if (error) return setNote('Could not update your watchlist.')
    setSaved(has ? saved.filter(x => x !== b.id) : [...saved, b.id]); setNote(has ? 'Removed from your watchlist.' : 'Added to your watchlist.')
  }
  async function person(follow) {
    const c = people[0]; if (!c) return
    if (follow) { const { error } = await supabase.from('follows').insert({ user_id: user.id, figure_id: c.id }); if (error) return setNote('Could not follow. Try again.') }
    else { try { localStorage.setItem('bb_skip', JSON.stringify([...JSON.parse(localStorage.getItem('bb_skip') || '[]'), c.id])) } catch (_e) { /* ignore */ } }
    setNote(''); setPeople(people.slice(1))
  }
  const modes = <div>{[['bills', 'Bills'], ['people', 'People']].map(([k, t]) => <button key={k} className={'chip ' + (mode === k ? 'on' : '')} aria-pressed={mode === k} onClick={() => { setMode(k); setNote('') }}>{t}</button>)}</div>
  if (mode === 'people') {
    if (!people) return <p className="mu">Loading…</p>
    const c = people[0]
    return <>{modes}{!c ? <div className="card"><b>You’ve seen everyone</b><p className="mu">Open Billionaires to visit the profiles you followed.</p><button className="btn" onClick={() => go('community')}>Open Billionaires</button></div> : <>
      <p className="mu">Swipe right to follow, left to skip.</p>
      <Swipe onYes={() => person(true)} onNo={() => person(false)}><span className="pill">{c.category}</span><h2>{c.name}</h2><p className="mu">{c.tagline}</p><span className="demo">Public profile · Not affiliated</span><p className="mu">A profile is not a promise of support.</p></Swipe>
      <div className="btns"><button className="btn alt" onClick={() => person(false)}>Skip</button><button className="btn" onClick={() => person(true)}>Follow</button></div></>}{note && <p className="err" role="status">{note}</p>}</>
  }
  if (!bills) return <p className="mu">Loading…</p>
  if (loadError) return <>{modes}<div className="card"><p className="err" role="alert">{loadError}</p><button className="btn" onClick={() => { setLoadError(''); setBills(null); supabase.from('public_bills').select('*').in('status', ['eligible', 'partially_supported']).then(({ data, error }) => error ? (setLoadError('Could not load the swipe deck. Try again.'), setBills([])) : setBills(data || [])) }}>Try again</button></div></>
  if (!bills.length) return <>{modes}<div className="card"><b>No open bills yet</b><p className="mu">Approved bills show up here.</p></div></>
  const b = bills[i % bills.length], rec = b.target_kobo > 0 ? Math.min(100, Math.max(0, Math.round(b.received_kobo / b.target_kobo * 100))) : 0, isSaved = saved.includes(b.id)
  const watch = bills.filter(x => saved.includes(x.id))
  return (
    <>
      {modes}
      <p className="mu">Swipe right to save a bill to your watchlist, left for the next one.</p>
      <Swipe onYes={() => save(b)} onNo={() => { setI(i + 1); setNote('') }}>
        <div className="row"><b>{b.category}</b><span className="pill">{naira(b.target_kobo)}</span></div>
        <h2>{b.title}</h2>
        <div className="bar"><i style={{ width: rec + '%' }} /></div>
        <p className="mu">{naira(b.received_kobo)} of {naira(b.target_kobo)} · {rec}% funded</p>
      </Swipe>
      <div className="btns"><button className="btn alt" onClick={() => { setI(i + 1); setNote('') }}>Next</button><button className="btn alt" aria-pressed={isSaved} onClick={() => save(b)}>{isSaved ? 'Saved' : 'Save'}</button><button className="btn" onClick={() => go('bills')}>Back it</button></div>
      <p className="mu" role="status">{note || `${(i % bills.length) + 1} of ${bills.length}`}</p>
      {watch.length > 0 && <><h2>Your watchlist</h2>{watch.map(x => <div className="card row" key={x.id}><span>{x.category} · {x.title}</span><span className="pill">{x.target_kobo > 0 ? Math.min(100, Math.max(0, Math.round(x.received_kobo / x.target_kobo * 100))) : 0}%</span></div>)}</>}
    </>
  )
}

function Quiz({ reload, go }) {
  const [qs, setQs] = useState(null), [i, setI] = useState(0), [sc, setSc] = useState(0), [res, setRes] = useState(null), [err, setErr] = useState(''), [busy, setBusy] = useState(false), [pts, setPts] = useState(0)
  useEffect(() => { supabase.from('quiz_public').select('*').then(({ data, error }) => { if (error) setErr('Could not load the quiz. Please try again later.'); setQs(data || []) }) }, [])
  async function pick(q, k) {
    if (res || busy) return
    setBusy(true); setErr('')
    const { data, error } = await supabase.rpc('answer_quiz', { p_q: q.id, p_choice: k })
    setBusy(false)
    if (error) return setErr('Could not check that answer. Try again.')
    setRes({ ...data, k }); if (data.correct) setSc(sc + 1); if (data.awarded) setPts(pts + data.awarded); reload()
  }
  async function next() {
    const n = i + 1; setRes(null); setI(n)
    if (n >= qs.length) { const { error } = await supabase.rpc('claim_daily'); if (error) setErr('Quiz complete, but daily check-in could not be confirmed. You can try checking in from your profile.'); reload() }
  }
  const again = () => { setI(0); setSc(0); setPts(0); setRes(null) }
  if (!qs) return <p className="mu">Loading…</p>
  if (!qs.length) return <div className="card"><b>No questions yet</b></div>
  if (i >= qs.length) return (
    <>
      <div className="card streak" style={{ textAlign: 'center' }}><h2>{sc} of {qs.length} correct</h2>
        <p className="mu">{sc >= 7 ? 'Boardroom ready.' : sc >= 4 ? 'Solid. A replay will sharpen it.' : 'Good start. Replay to learn the facts.'}</p>
        <p className="mu">{pts ? `+${pts} points this round. ` : 'Points are paid once per question. '}Check your profile for today’s check-in status.</p></div>
      {err && <p className="err" role="status">{err}</p>}
      <button className="btn" onClick={again}>Play again</button><button className="btn alt" onClick={() => go('bills')}>Back to the Billboard</button>
      <p className="mu" style={{ fontSize: 12 }}>Facts are general public knowledge about well-known businesses. Points are virtual, never cash.</p>
    </>)
  const q = qs[i]
  return (
    <>
      <span className="eyebrow">Business quiz</span>
      <div className="row"><span className="mu">Question {i + 1} of {qs.length}</span><b>{sc} correct</b></div>
      <div className="bar"><i style={{ width: i / qs.length * 100 + '%' }} /></div>
      <h2 style={{ margin: '16px 0 8px', fontSize: 22 }}>{q.question}</h2>
      {q.options.map((t, k) => <button key={k} className={'qo ' + (res ? (k === res.answer ? 'ok' : k === res.k ? 'no' : '') : '')} disabled={!!res || busy} onClick={() => pick(q, k)}>{t}</button>)}
      {err && <p className="err">{err}</p>}
      {res && <><div className="card"><b>{res.correct ? (res.awarded ? 'Correct, +5 points' : 'Correct') : 'Not quite'}</b><p className="mu">{res.why}</p></div><button className="btn" onClick={next}>{i + 1 >= qs.length ? 'See my score' : 'Continue'}</button></>}
    </>
  )
}

function Top({ go }) {
  const [rows, setRows] = useState(null)
  useEffect(() => { supabase.from('top_clearers').select('*').then(({ data }) => setRows(data || [])) }, [])
  if (!rows) return <p className="mu">Loading…</p>
  return (
    <>
      <span className="eyebrow">This week</span><h2 style={{ marginTop: 6 }}>Top bill clearers</h2>
      <p className="mu">The 10 supporters who helped the most this week (Monday to Sunday). Only confirmed payments count.</p>
      {!rows.length ? <div className="card"><b>No one yet this week</b><p className="mu">Back a bill to take the first spot.</p></div>
        : <div className="card" style={{ padding: '4px 14px' }}>{rows.map((r, i) => <div className="lb" key={i}><span className="lb-r">{i + 1}</span><span className="lb-n"><b>{r.name}{r.is_me && <span className="you">You</span>}</b><small>{r.bills_helped} {r.bills_helped === 1 ? 'bill' : 'bills'} helped</small></span><span className="lb-a">{naira(r.given_kobo)}</span></div>)}</div>}
      <div className="card"><h3>Give quietly</h3><p className="mu">Anonymous supporters still count toward the ranking but show as Anonymous supporter. Choose this on the support screen.</p></div>
      <button className="btn" onClick={() => go('bills')}>Support a bill</button>
    </>
  )
}
