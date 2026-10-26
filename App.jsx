import { useEffect, useState } from 'react'
import { supabase, naira, toKobo } from './supabase'
import { COMIC_SVG } from './comic'
import Play, { Streak } from './Play'
import LegalPage, { LegalLinks } from './Legal'

const CATS = ['Education', 'Housing', 'Utilities', 'Water', 'Healthcare', 'Other']
const LABEL = { submitted: 'Submitted', under_review: 'Under review', more_info: 'More information needed',
  eligible: 'Approved, awaiting support', partially_supported: 'Partially supported', cleared: 'Cleared', declined: 'Declined' }
const MAX_MB = 10, TYPES = ['application/pdf', 'image/jpeg', 'image/png']

const ICONS = {
  bills: 'M3 5h18v10H3z M8 15l-1.5 5 M16 15l1.5 5 M7 9h10 M7 12h6',
  submit: 'M12 5v14 M5 12h14',
  community: 'M9 9m-3 0a3 3 0 106 0 3 3 0 10-6 0 M17 10m-2.5 0a2.5 2.5 0 105 0 2.5 2.5 0 10-5 0 M3 19c0-3.5 3-5.5 6-5.5s6 2 6 5.5 M15 14.5c3 0 6 1.5 6 4.5',
  play: 'M3 7h18v11H3z M8 10v5 M5.5 12.5h5 M16 11.5h.01 M18.5 13.5h.01',
  cleared: 'M12 3a9 9 0 100 18 9 9 0 000-18z M8 12l3 3 5-6',
  review: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z M9 12l2 2 4-4',
  me: 'M12 4m-4 0a4 4 0 108 0 4 4 0 10-8 0 M4 21c0-4.5 3.5-7 8-7s8 2.5 8 7' }
const Icon = ({ k }) => <svg viewBox="0 0 24 24" aria-hidden="true"><path d={ICONS[k]} /></svg>
const effectiveTheme = () => document.documentElement.getAttribute('data-theme') || (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
function ThemeToggle() {
  const [t, setT] = useState(effectiveTheme)
  const flip = () => {
    const n = t === 'light' ? 'dark' : 'light'
    document.documentElement.setAttribute('data-theme', n)
    try { localStorage.setItem('bb-theme', n) } catch (e) {}
    setT(n)
  }
  return <button className="chip theme-btn" onClick={flip} aria-label={t === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}>{t === 'light' ? 'Dark' : 'Light'}</button>
}
const BrandFace = () => (
  <svg className="brand-face" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
    <circle cx="50" cy="50" r="50" fill="currentColor" />
    <circle cx="34" cy="40" r="7" fill="var(--on-accent)" />
    <circle cx="66" cy="40" r="7" fill="var(--on-accent)" />
    <path d="M28 60Q50 82 72 60" fill="none" stroke="var(--on-accent)" strokeWidth="8" strokeLinecap="round" />
  </svg>
)
const Brand = () => <span className="brand" aria-label="BillBored">BILL<span className="brand-accent">B<BrandFace />RED</span></span>

function Welcome({ start }) {
  return (
    <div className="sp"><div className="sp-in">
      <h1 className="logo" aria-label="BillBored">BILL<span className="brand-accent">B<BrandFace />RED</span></h1>
      <p className="sp-headline">Showing up for each other</p>
      <div className="comic-stage" role="img" aria-label="A playful comic: a young man asks a wealthy businessman for two thousand naira">
        <div className="comic-bubble one">“Oga, I fit see 2k for your side?” 😭</div>
        <div className="comic-bubble two">“Enter billbored money yakpa for there”</div>
        <div aria-hidden="true" dangerouslySetInnerHTML={{ __html: COMIC_SVG }} />
      </div>
      <p className="sp-note">That guy wey dey always bill you for WhatsApp? Tell am say <b>BillBored active.</b></p>
      <div className="sp-foot">
        <p>Sometimes you need a little help. Sometimes <b>you can be the help.</b></p>
        <button className="btn" onClick={start}>Get started <span aria-hidden="true">→</span></button>
        <LegalLinks />
      </div>
    </div></div>
  )
}

const MOMENTS = [
  { emoji: '🥹', title: 'Bill moment', line: 'Dayo dey find ₦2k. Who go help am?', body: 'A small need can make a big difference. Browse the checked bills and choose whether to help.', cta: 'See the Billboard', tab: 'bills' },
  { emoji: '🎓', title: 'Student Support', line: 'One student needs help with school expenses.', body: 'Join Student Support, open to students from any school.', cta: 'Open Student Support', tab: 'community' },
  { emoji: '🌟', title: 'Meet people making a difference', line: 'Who’s doing good out there?', body: 'Explore public figures in Bored Billionaires. A profile is not a promise of support.', cta: 'Explore Bored Billionaires', tab: 'community' }]

function Moment({ index, next, close, go }) {
  const m = MOMENTS[index % MOMENTS.length]
  return (
    <div className="moment-backdrop" role="dialog" aria-modal="true" aria-labelledby="moment-title">
      <div className="moment-card">
        <button className="moment-x" aria-label="Close" onClick={close}>×</button>
        <div className="moment-emoji" aria-hidden="true">{m.emoji}</div>
        <span className="eyebrow">{m.title}</span>
        <h2 id="moment-title">{m.line}</h2>
        <p className="mu">{m.body}</p>
        <span className="demo">Illustrative example</span>
        <button className="btn" onClick={() => go(m.tab)}>{m.cta} →</button>
        <button className="btn alt" onClick={next}>See another moment</button>
        <button className="moment-later" onClick={close}>Maybe later</button>
      </div>
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState(undefined)
  const [profile, setProfile] = useState(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileError, setProfileError] = useState('')
  const [unread, setUnread] = useState(0)
  const [tab, setTab] = useState(window.location.hash === '#cleared' ? 'cleared' : 'bills')
  const [welcomed, setWelcomed] = useState(() => { try { return localStorage.getItem('bb_welcome') === '1' } catch (_e) { return false } })
  const [moment, setMoment] = useState(null)
  const [recovering, setRecovering] = useState(false)
  const [skipName, setSkipName] = useState(() => { try { return localStorage.getItem('bb_skip_name') === '1' } catch (_e) { return false } })
  const hashDoc = () => (['#terms', '#privacy'].includes(window.location.hash) ? window.location.hash.slice(1) : null)
  const [legal, setLegal] = useState(hashDoc)
  useEffect(() => { const f = () => setLegal(hashDoc()); window.addEventListener('hashchange', f); return () => window.removeEventListener('hashchange', f) }, [])
  const closeLegal = () => { window.history.replaceState({}, '', window.location.pathname + window.location.search); setLegal(null) }
  const [wallet, setWallet] = useState(null)
  const loadWallet = () => supabase.from('my_wallet').select('*').maybeSingle().then(({ data }) => setWallet(data || { points: 0, streak: 0, best: 0, checked_today: false }))
  useEffect(() => { if (session) loadWallet() }, [session])
  const startApp = () => { try { localStorage.setItem('bb_welcome', '1') } catch (_e) { /* storage unavailable */ } setWelcomed(true) }
  useEffect(() => {
    if (!session) return
    try { if (localStorage.getItem('bb_moment') !== '1') { localStorage.setItem('bb_moment', '1'); setMoment(0) } } catch (_e) { /* skip the pop-up */ }
  }, [session])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((e, s) => { if (e === 'PASSWORD_RECOVERY') setRecovering(true); setSession(s) })
    return () => sub.subscription.unsubscribe()
  }, [])
  const loadProfile = async () => {
    if (!session) { setProfile(null); setProfileError(''); setProfileLoading(false); return }
    setProfileLoading(true); setProfileError('')
    const { data, error } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle()
    setProfileLoading(false)
    if (error || !data) { setProfile(null); setProfileError(error ? 'We could not load your profile. Check your connection and try again.' : 'Your profile is missing. Please sign out and sign in again, or contact support.'); return }
    setProfile(data)
  }
  useEffect(() => { loadProfile() }, [session?.user?.id])

  useEffect(() => {
    if (!session) return
    const count = () => supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('read', false).then(({ count: n }) => setUnread(n || 0))
    count(); const t = setInterval(count, 60000)
    return () => clearInterval(t)
  }, [session])

  if (legal) return <LegalPage doc={legal} back={closeLegal} />
  if (session === undefined) return <div className="wrap"><p className="mu">Loading…</p></div>
  if (session && recovering) return <NewPassword done={() => setRecovering(false)} />
  if (session && (profileLoading || (!profile && !profileError))) return <div className="wrap"><p className="mu" role="status">Loading your profile…</p></div>
  if (session && profileError) return <div className="wrap"><div className="card"><h2>Profile unavailable</h2><p className="err" role="alert">{profileError}</p><button className="btn" onClick={loadProfile}>Try again</button><button className="btn alt" onClick={() => supabase.auth.signOut()}>Sign out</button></div></div>
  if (!session) return welcomed ? <SignIn /> : <Welcome start={startApp} />
  if (profile && profile.handle.startsWith('user_') && !skipName) return <ChooseUsername profile={profile} saved={setProfile} skip={() => { try { localStorage.setItem('bb_skip_name', '1') } catch (_e) { /* ignore */ } setSkipName(true) }} />
  const staff = profile && ['reviewer', 'admin'].includes(profile.role)
  return (
    <>
      <div className="wrap">
        <div className="top"><Brand /><div className="top-r"><ThemeToggle /></div></div>
        {tab === 'bills' && <OpenBills go={setTab} />}
        {tab === 'submit' && <Submit user={session.user} done={() => setTab('me')} />}
        {tab === 'community' && <Community user={session.user} staff={staff} />}
        {(tab === 'play' || tab === 'top') && <Play key={tab} start={tab === 'top' ? 'top' : 'deck'} user={session.user} go={setTab} reload={loadWallet} />}
        {tab === 'cleared' && <ClearedWall />}
        {tab === 'review' && staff && <Review />}
        {tab === 'me' && <><Notifications user={session.user} setUnread={setUnread} /><Me profile={profile} email={session.user.email} setProfile={setProfile}><Streak w={wallet} reload={loadWallet} /></Me><Mine user={session.user} /></>}
      </div>
      {moment !== null && <Moment index={moment} next={() => setMoment(moment + 1)} close={() => setMoment(null)} go={t => { setTab(t); setMoment(null) }} />}
      <nav aria-label="Main"><div>
        {[['bills', 'Billboard'], ['play', 'Arena'], ['submit', 'Submit'], ['community', 'Billionaires'], ...(staff ? [['review', 'Review']] : []), ['me', 'Profile']].map(([k, t]) => (
          <button key={k} className={(tab === k || (k === 'play' && tab === 'top') ? 'on ' : '') + (k === 'submit' ? 'cta' : '')} aria-current={tab === k ? 'page' : undefined} onClick={() => setTab(k)}>
            <Icon k={k} />{t}{k === 'me' && unread > 0 && <span className="dot" aria-label={unread + ' unread'}>{unread}</span>}
          </button>
        ))}
      </div></nav>
    </>
  )
}

function SignIn() {
  const [email, setEmail] = useState(''), [pw, setPw] = useState(''), [reset, setReset] = useState(false)
  const [err, setErr] = useState(''), [note, setNote] = useState(''), [busy, setBusy] = useState(false)
  const limited = e => e.status === 429 || /rate limit|once every/i.test(e.message || '')
  async function submit(e) {
    e.preventDefault(); setErr(''); setNote('')
    const creds = { email: email.trim(), password: pw }
    if (reset) {
      setBusy(true)
      const { error } = await supabase.auth.resetPasswordForEmail(creds.email, { redirectTo: window.location.origin + '/' })
      setBusy(false)
      if (error) return setErr(limited(error) ? 'Too many attempts. Wait a minute and try again.' : 'We couldn’t send the link. Check the email and try again.')
      return setNote('If that email has an account, we’ve sent a link to reset your password. Check your spam folder too.')
    }
    if (pw.length < 8) return setErr('Use a password with at least 8 characters.')
    setBusy(true)
    const made = await supabase.auth.signUp(creds)
    if (made.error && limited(made.error)) { setBusy(false); return setErr('Too many attempts. Wait a minute and try again.') }
    if (!made.error && made.data.session) return setBusy(false)
    const { error } = await supabase.auth.signInWithPassword(creds)
    setBusy(false)
    if (error) setErr(made.error ? 'That email already has an account, but the password is wrong. Try again or reset it.' : 'Check your email to confirm your account, then tap Continue again.')
  }
  return (
    <div className="wrap">
      <div className="top"><Brand /><ThemeToggle /></div>
      <h1>{reset ? 'Reset your password' : 'Welcome'}</h1>
      <p className="mu">{reset ? 'Enter your email and we’ll send you a link to choose a new password.' : 'Enter your email and a password. New here? We’ll create your account.'}</p>
      <form onSubmit={submit}>
        <label htmlFor="em">Email</label>
        <input id="em" type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} />
        {!reset && <>
          <label htmlFor="pw">Password</label>
          <input id="pw" type="password" required autoComplete="current-password" value={pw} onChange={e => setPw(e.target.value)} />
        </>}
        {err && <p className="err" role="alert">{err}</p>}
        {note && <p className="mu" role="status">{note}</p>}
        <button className="btn" disabled={busy}>{busy ? 'Please wait…' : reset ? 'Send reset link' : 'Continue'}</button>
        <button type="button" className="link-btn" style={{ marginTop: 10 }} onClick={() => { setReset(!reset); setErr(''); setNote('') }}>{reset ? 'Back' : 'Forgot your password?'}</button>
      </form>
      <p className="mu">By continuing you agree to our <a href="#terms">Terms</a> and <a href="#privacy">Privacy Policy</a>.</p>
    </div>
  )
}

function UsernameForm({ profile, onSaved, onCancel }) {
  const [v, setV] = useState(profile.handle.startsWith('user_') ? '' : profile.handle), [err, setErr] = useState(''), [busy, setBusy] = useState(false)
  async function save(e) {
    e.preventDefault(); setErr('')
    const h = v.trim().toLowerCase()
    if (!/^[a-z0-9_]{3,20}$/.test(h)) return setErr('Use 3 to 20 letters, numbers or underscores. No spaces.')
    if (h.startsWith('user_')) return setErr('Choose a different username.')
    if (/billbored|official/.test(h.replace(/[^a-z]/g, ''))) return setErr('That username is reserved. Choose a different one.')
    if (h === profile.handle) return onSaved(profile)
    setBusy(true)
    const { data, error } = await supabase.from('profiles').update({ handle: h, display_name: h }).eq('id', profile.id).select().single()
    setBusy(false)
    if (error) return setErr(error.code === '23505' ? 'That username is taken. Try another.' : /reserved/i.test(error.message || '') ? 'That username is reserved. Choose a different one.' : 'We couldn’t save it. Try again.')
    onSaved(data)
  }
  return (
    <form onSubmit={save}>
      <label htmlFor="un">Username</label>
      <input id="un" required autoCapitalize="none" autoCorrect="off" spellCheck="false" maxLength={20} value={v} onChange={e => setV(e.target.value)} />
      <p className="mu">3 to 20 letters, numbers or underscores. Other people see this name.</p>
      {err && <p className="err" role="alert">{err}</p>}
      <button className="btn" disabled={busy}>{busy ? 'Saving…' : 'Save username'}</button>
      {onCancel && <button type="button" className="btn alt" onClick={onCancel}>Cancel</button>}
    </form>
  )
}

function ChooseUsername({ profile, saved, skip }) {
  return (
    <div className="wrap">
      <div className="top"><Brand /><ThemeToggle /></div>
      <h1>Choose a username</h1>
      <p className="mu">This is the name other people see on BillBored. Don’t use your real name or your email.</p>
      <UsernameForm profile={profile} onSaved={saved} />
      <button type="button" className="link-btn" style={{ marginTop: 10 }} onClick={skip}>Skip for now</button>
    </div>
  )
}

function NewPassword({ done }) {
  const [pw, setPw] = useState(''), [show, setShow] = useState(false), [err, setErr] = useState(''), [busy, setBusy] = useState(false)
  async function save(e) {
    e.preventDefault(); setErr('')
    if (pw.length < 8) return setErr('Use a password with at least 8 characters.')
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password: pw })
    setBusy(false)
    if (error) return setErr('We couldn’t save your new password. The link may have expired. Ask for a new one.')
    done()
  }
  return (
    <div className="wrap">
      <div className="top"><Brand /><ThemeToggle /></div>
      <h1>Choose a new password</h1>
      <p className="mu">Use at least 8 characters. You’ll stay signed in after saving.</p>
      <form onSubmit={save}>
        <label htmlFor="np">New password</label>
        <input id="np" type={show ? 'text' : 'password'} required minLength={8} autoComplete="new-password" value={pw} onChange={e => setPw(e.target.value)} />
        <label style={{ display: 'flex', gap: 8, fontWeight: 400 }}><input type="checkbox" style={{ width: 20 }} checked={show} onChange={e => setShow(e.target.checked)} />Show password</label>
        {err && <p className="err" role="alert">{err}</p>}
        <button className="btn" disabled={busy}>{busy ? 'Saving…' : 'Save new password'}</button>
      </form>
    </div>
  )
}

const pct = (n, d) => (d > 0 ? Math.min(100, Math.round(n / d * 100)) : 0)
function BillCard({ b, open, setOpen, star }) {
  const rec = pct(b.received_kobo, b.target_kobo), pl = pct(b.received_kobo + b.pledged_kobo, b.target_kobo)
  const canBack = ['eligible', 'partially_supported'].includes(b.status)
  return (
    <article className={'card bill' + (star ? ' star' : '')}>
      <div className="bill-head"><span className="cat">{b.category}</span><span className="verified"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>Verified</span></div>
      <h3 className="bill-title">{b.title}</h3>
      <p className="bill-st">{star ? 'Closest to its goal · ' : ''}{LABEL[b.status]}</p>
      <div className="bill-amt"><span className="big">{naira(Math.max(b.target_kobo - b.received_kobo, 0))}</span><span className="bill-left">still needed</span></div>
      <div className="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={rec} aria-label="Funded"><i className="pl" style={{ width: pl + '%' }} /><i style={{ width: rec + '%' }} /></div>
      <div className="row bill-meta"><span>{naira(b.received_kobo)} of {naira(b.target_kobo)}</span><span>{rec}% funded</span></div>
      {canBack && (open === b.id ? <Back bill={b} close={() => setOpen(null)} /> : <button className="btn" onClick={() => setOpen(b.id)}>Contribute</button>)}
    </article>
  )
}

function OpenBills({ go }) {
  const [rows, setRows] = useState(null), [open, setOpen] = useState(null), [cat, setCat] = useState('All')
  const [paid] = useState(() => new URLSearchParams(window.location.search).get('paid') === '1')
  const [loadError, setLoadError] = useState('')
  const load = async () => { setRows(null); setLoadError(''); const { data, error } = await supabase.from('public_bills').select('*'); if (error) { setRows([]); setLoadError('We could not load bills. Check your connection and try again.'); return } setRows(data || []) }
  useEffect(() => { load(); if (paid) window.history.replaceState({}, '', window.location.pathname) }, [])
  if (!rows) return <p className="mu">Loading…</p>
  const backable = rows.filter(b => ['eligible', 'partially_supported'].includes(b.status) && b.received_kobo < b.target_kobo)
  const left = backable.reduce((s, b) => s + (b.target_kobo - b.received_kobo), 0)
  const star = cat === 'All' && backable.length > 1 ? [...backable].sort((x, y) => pct(y.received_kobo, y.target_kobo) - pct(x.received_kobo, x.target_kobo))[0] : null
  const shown = rows.filter(b => (cat === 'All' || b.category === cat) && b !== star)
  const cats = CATS.filter(c => rows.some(b => b.category === c))
  return (
    <>
      <header className="home-head">
        <h1>Open bills</h1>
        <p className="home-sub">{backable.length ? <><b>{naira(left)}</b> needed across {backable.length} verified {backable.length === 1 ? 'bill' : 'bills'}. We pay the biller directly.</> : 'No open bills right now. Check back soon.'}</p>
        <div className="home-links"><button className="link-btn" onClick={() => go('top')}>Top supporters</button><button className="link-btn" onClick={() => go('cleared')}>Cleared bills</button></div>
      </header>
      {paid && <div className="card notice"><b>Thank you.</b><p className="mu">We’re confirming your payment with Paystack. It shows on the bill within a minute.</p></div>}
      {cats.length > 1 && (
        <div className="filters" role="tablist" aria-label="Filter by category">
          {['All', ...cats].map(c => <button key={c} role="tab" aria-selected={cat === c} className={'filter' + (cat === c ? ' on' : '')} onClick={() => setCat(c)}>{c}</button>)}
        </div>
      )}
      {loadError && <div className="card"><b>Couldn’t load bills</b><p className="mu" role="alert">{loadError}</p><button className="btn" onClick={load}>Try again</button></div>}
      {!loadError && !rows.length && <div className="card"><b>No open bills yet</b><p className="mu">Approved bills show up here.</p></div>}
      {rows.length > 0 && !shown.length && !star && <div className="card"><b>Nothing in {cat} right now</b><p className="mu">Try another category.</p></div>}
      {star && <BillCard b={star} open={open} setOpen={setOpen} star />}
      {shown.map(b => <BillCard key={b.id} b={b} open={open} setOpen={setOpen} />)}
    </>
  )
}

function Back({ bill, close }) {
  const [amt, setAmt] = useState(''), [anon, setAnon] = useState(false), [err, setErr] = useState(''), [busy, setBusy] = useState(false)
  const left = bill.target_kobo - bill.received_kobo
  const chips = [500, 1000, 2000, 5000].filter(n => n * 100 <= left)
  async function pay() {
    setErr('')
    const kobo = toKobo(amt)
    if (!(kobo >= 10000)) return setErr('The minimum is ₦100.')
    if (kobo > left) return setErr(`Only ${naira(left)} is still needed.`)
    setBusy(true)
    const { data, error } = await supabase.functions.invoke('paystack-init', { body: { bill_id: bill.id, amount_kobo: kobo, anonymous: anon } })
    setBusy(false)
    if (error || !data?.authorization_url) return setErr(data?.error || 'Could not start the payment. Try again.')
    window.location.href = data.authorization_url
  }
  return (
    <div style={{ marginTop: 12 }}>
      <div>{chips.map(n => <button key={n} type="button" className={'chip ' + (toKobo(amt) === n * 100 ? 'on' : '')} onClick={() => setAmt(String(n))}>₦{n.toLocaleString('en-NG')}</button>)}</div>
      <label htmlFor={'amt' + bill.id}>Amount (₦)</label>
      <input id={'amt' + bill.id} inputMode="decimal" value={amt} onChange={e => setAmt(e.target.value)} />
      <label style={{ display: 'flex', gap: 8, fontWeight: 400 }}><input type="checkbox" style={{ width: 20 }} checked={anon} onChange={e => setAnon(e.target.checked)} />Give quietly (hide my name)</label>
      <p className="mu">You pay by card or bank transfer through Paystack. Funds go to the biller, never to the person.</p>
      {err && <p className="err">{err}</p>}
      <button className="btn" disabled={busy} onClick={pay}>{busy ? 'Opening Paystack…' : 'Continue to payment'}</button>
      <button className="btn alt" onClick={close}>Cancel</button>
    </div>
  )
}

function Submit({ user, done }) {
  const [f, setF] = useState({ category: '', amount: '', description: '', biller_name: '', biller_account_ref: '', due_date: '' })
  const [files, setFiles] = useState([]), [err, setErr] = useState(''), [busy, setBusy] = useState(false), [ok, setOk] = useState(false)
  const set = k => e => setF({ ...f, [k]: e.target.value })

  function pick(e) {
    const list = [...e.target.files]
    const bad = list.find(x => !TYPES.includes(x.type) || x.size > MAX_MB * 1024 * 1024)
    if (bad) { setErr(`“${bad.name}” isn’t allowed. Use PDF, JPG or PNG under ${MAX_MB} MB.`); return }
    setErr(''); setFiles(list.slice(0, 5))
  }
  async function submit(e) {
    e.preventDefault(); setErr('')
    const kobo = toKobo(f.amount)
    if (!f.category) return setErr('Choose a category.')
    if (!(kobo > 0)) return setErr('Enter an amount greater than zero.')
    if (f.description.trim().length < 10) return setErr('Describe the bill in at least 10 characters.')
    if (!ok) return setErr('Please confirm the details are true.')
    if (!files.length) return setErr('Upload at least one document (invoice, statement or letter).')
    setBusy(true)
    const id = crypto.randomUUID()
    const { error } = await supabase.from('bills').insert({
      id, requester_id: user.id, category: f.category, amount_kobo: kobo, description: f.description.trim(),
      biller_name: f.biller_name.trim(), biller_account_ref: f.biller_account_ref.trim(), due_date: f.due_date || null })
    if (error) { setBusy(false); return setErr(error.message) }
    for (const file of files) {
      const path = `${user.id}/${id}/${Date.now()}-${file.name.replace(/[^\w.\-]/g, '_')}`
      const up = await supabase.storage.from('bill-evidence').upload(path, file, { contentType: file.type })
      if (up.error) { setBusy(false); return setErr('Upload failed: ' + up.error.message) }
      await supabase.from('bill_documents').insert({ bill_id: id, storage_path: path, uploaded_by: user.id })
    }
    setBusy(false); done()
  }
  return (
    <form onSubmit={submit}>
      <h1>Submit a bill</h1>
      <p className="mu">A person reviews every request. Submitting doesn’t guarantee payment. Your documents stay private.</p>
      <label htmlFor="c">Category</label>
      <select id="c" value={f.category} onChange={set('category')}><option value="">Choose…</option>{CATS.map(c => <option key={c}>{c}</option>)}</select>
      <label htmlFor="a">Amount (₦)</label>
      <input id="a" inputMode="decimal" value={f.amount} onChange={set('amount')} />
      <label htmlFor="d">What is the bill for?</label>
      <textarea id="d" value={f.description} onChange={set('description')} />
      <label htmlFor="bn">Who gets paid? (school, electricity company, hospital)</label>
      <input id="bn" required value={f.biller_name} onChange={set('biller_name')} />
      <label htmlFor="br">Their account, meter or reference number</label>
      <input id="br" required value={f.biller_account_ref} onChange={set('biller_account_ref')} />
      <label htmlFor="dd">Due date (optional)</label>
      <input id="dd" type="date" value={f.due_date} onChange={set('due_date')} />
      <label htmlFor="fl">Documents (PDF, JPG or PNG, up to 5)</label>
      <input id="fl" type="file" multiple accept=".pdf,.jpg,.jpeg,.png" onChange={pick} />
      {files.map(x => <p className="mu" key={x.name}>{x.name}</p>)}
      <label style={{ display: 'flex', gap: 8, fontWeight: 400 }}><input type="checkbox" style={{ width: 20 }} checked={ok} onChange={e => setOk(e.target.checked)} />I confirm these details and documents are true.</label>
      {err && <p className="err">{err}</p>}
      <button className="btn" disabled={busy}>{busy ? 'Submitting…' : 'Submit bill'}</button>
    </form>
  )
}

function Mine({ user }) {
  const [rows, setRows] = useState(null), [ty, setTy] = useState({}), [msg, setMsg] = useState({}), [err, setErr] = useState('')
  async function load() {
    const { data } = await supabase.from('bills').select('*').eq('requester_id', user.id).order('created_at', { ascending: false })
    setRows(data || [])
    const cleared = (data || []).filter(b => b.status === 'cleared')
    if (cleared.length) {
      const { data: t } = await supabase.from('thank_yous').select('*').in('bill_id', cleared.map(b => b.id))
      setTy(Object.fromEntries((t || []).map(x => [x.bill_id, x.message])))
    }
  }
  useEffect(() => { load() }, [user.id])
  async function thank(id) {
    const m = (msg[id] || '').trim()
    if (m.length < 3) return setErr('Write at least 3 characters.')
    const { error } = await supabase.rpc('add_thank_you', { p_bill: id, p_msg: m })
    if (error) return setErr(error.message)
    setErr(''); setTy({ ...ty, [id]: m })
  }
  if (!rows) return <p className="mu">Loading…</p>
  return (
    <>
      <h1>My bills</h1>
      {err && <p className="err">{err}</p>}
      {!rows.length && <div className="card"><b>Nothing submitted yet</b><p className="mu">Use Submit to send your first bill.</p></div>}
      {rows.map(b => (
        <div className="card" key={b.id}>
          <div className="row"><b>{b.category} · {naira(b.amount_kobo)}</b><span className="pill">{LABEL[b.status]}</span></div>
          <p className="mu">{b.description}</p>
          <p className="mu">Submitted {new Date(b.created_at).toLocaleDateString()}</p>
          {b.status === 'cleared' && (ty[b.id]
            ? <p><b>Your thank-you:</b> {ty[b.id]}</p>
            : <>
                <label htmlFor={'ty' + b.id}>Your bill was cleared. Say thanks to the people who helped (shown without your name).</label>
                <textarea id={'ty' + b.id} maxLength={280} value={msg[b.id] || ''} onChange={e => setMsg({ ...msg, [b.id]: e.target.value })} />
                <button className="btn" onClick={() => thank(b.id)}>Send thank-you</button>
              </>)}
        </div>
      ))}
    </>
  )
}

function ClearedWall() {
  const [rows, setRows] = useState(null), [err, setErr] = useState('')
  useEffect(() => { supabase.from('cleared_wall').select('*').then(({ data }) => setRows(data || [])) }, [])
  async function receipt(id) {
    const { data: p } = await supabase.from('payouts').select('receipt_path').eq('bill_id', id).order('created_at', { ascending: false }).limit(1)
    if (!p?.length) return setErr('Receipts are visible to people who helped with that bill.')
    const { data } = await supabase.storage.from('receipts').createSignedUrl(p[0].receipt_path, 300)
    data ? window.open(data.signedUrl, '_blank') : setErr('Could not open the receipt.')
  }
  function share(b) {
    const text = `A ${naira(b.target_kobo)} ${b.category.toLowerCase()} bill just got cleared on BillBored ${window.location.origin}/#cleared`
    window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank')
  }
  if (!rows) return <p className="mu">Loading…</p>
  return (
    <>
      <h1>Cleared wall</h1>
      <p className="mu">Bills that were paid in full. Receipts are checked by a reviewer.</p>
      {err && <p className="err">{err}</p>}
      {!rows.length && <div className="card"><b>Nothing cleared yet</b><p className="mu">The first cleared bill will show up here.</p></div>}
      {rows.map(b => (
        <div className="card" key={b.id}>
          <div className="row"><b>{b.category} · {naira(b.target_kobo)}</b><span className="pill">Cleared</span></div>
          <p>{b.title}</p>
          {b.message && <p className="mu">“{b.message}”</p>}
          <p className="mu">{b.supporters} {b.supporters === 1 ? 'person' : 'people'} helped · {new Date(b.cleared_at).toLocaleDateString()}</p>
          <div className="btns"><button className="btn" onClick={() => share(b)}>Share on WhatsApp</button><button className="btn alt" onClick={() => receipt(b.id)}>View receipt</button></div>
        </div>
      ))}
    </>
  )
}

function Review() {
  const [rows, setRows] = useState(null), [docs, setDocs] = useState({}), [err, setErr] = useState('')
  const load = () => supabase.from('bills').select('*').in('status', ['submitted', 'under_review', 'more_info']).order('created_at').then(({ data }) => setRows(data || []))
  useEffect(() => { load() }, [])
  async function showDocs(id) {
    const { data: d } = await supabase.from('bill_documents').select('storage_path').eq('bill_id', id)
    const { data: urls } = await supabase.storage.from('bill-evidence').createSignedUrls((d || []).map(x => x.storage_path), 300)
    setDocs({ ...docs, [id]: urls || [] })
  }
  async function act(b, status) {
    setErr('')
    let title = null, note = null
    if (status === 'eligible') {
      title = prompt('Public title (no names, no account numbers):'); if (!title || title.trim().length < 10) return setErr('Add a public title of at least 10 characters.')
    } else { note = prompt('Note for the audit log:') || null }
    const { error } = await supabase.rpc('review_bill', { p_bill: b.id, p_status: status, p_title: title, p_note: note })
    error ? setErr(error.message) : load()
  }
  if (!rows) return <p className="mu">Loading…</p>
  return (
    <>
      <Payouts /><Claims /><Moderation /><h1>Review queue</h1>
      {err && <p className="err">{err}</p>}
      {!rows.length && <div className="card"><b>Queue is clear</b></div>}
      {rows.map(b => (
        <div className="card" key={b.id}>
          <div className="row"><b>{b.category} · {naira(b.amount_kobo)}</b><span className="pill">{LABEL[b.status]}</span></div>
          <p>{b.description}</p>
          <p className="mu">Pay: {b.biller_name} · {b.biller_account_ref}{b.due_date ? ' · due ' + b.due_date : ''}</p>
          {docs[b.id] ? docs[b.id].map((u, i) => <p key={i}><a href={u.signedUrl} target="_blank" rel="noreferrer">Document {i + 1}</a></p>)
            : <button className="btn alt" onClick={() => showDocs(b.id)}>View documents</button>}
          <div className="btns">
            <button className="btn" onClick={() => act(b, 'eligible')}>Approve</button>
            <button className="btn alt" onClick={() => act(b, 'more_info')}>Need info</button>
            <button className="btn alt" onClick={() => act(b, 'declined')}>Decline</button>
          </div>
        </div>
      ))}
    </>
  )
}

function Payouts() {
  const [rows, setRows] = useState(null), [info, setInfo] = useState({}), [f, setF] = useState({}), [err, setErr] = useState(''), [busy, setBusy] = useState('')
  async function load() {
    const { data } = await supabase.from('public_bills').select('*').in('status', ['eligible', 'partially_supported'])
    const due = (data || []).filter(b => b.received_kobo > b.verified_paid_kobo)
    setRows(due)
    if (due.length) {
      const { data: bs } = await supabase.from('bills').select('id,biller_name,biller_account_ref').in('id', due.map(b => b.id))
      setInfo(Object.fromEntries((bs || []).map(x => [x.id, x])))
    }
  }
  useEffect(() => { load() }, [])
  const set = (id, k, v) => setF({ ...f, [id]: { ...f[id], [k]: v } })
  async function pay(b) {
    const x = f[b.id] || {}, avail = b.received_kobo - b.verified_paid_kobo, kobo = x.amount ? toKobo(x.amount) : avail
    if (!x.ref || x.ref.trim().length < 4) return setErr('Enter the payment reference.')
    if (!x.file) return setErr('Upload the receipt (PDF, JPG or PNG).')
    if (!TYPES.includes(x.file.type) || x.file.size > MAX_MB * 1024 * 1024) return setErr(`Receipt must be PDF, JPG or PNG under ${MAX_MB} MB.`)
    if (!(kobo > 0 && kobo <= avail)) return setErr(`Amount must be up to ${naira(avail)}.`)
    setBusy(b.id); setErr('')
    const path = `${b.id}/${Date.now()}-${x.file.name.replace(/[^\w.\-]/g, '_')}`
    const up = await supabase.storage.from('receipts').upload(path, x.file, { contentType: x.file.type })
    if (up.error) { setBusy(''); return setErr('Upload failed: ' + up.error.message) }
    const { error } = await supabase.rpc('record_payout', { p_bill: b.id, p_amount: kobo, p_reference: x.ref.trim(), p_receipt: path })
    setBusy(''); error ? setErr(error.message) : load()
  }
  if (!rows || !rows.length) return null
  return (
    <>
      <h1>Ready to pay out</h1>
      <p className="mu">Pay the biller directly, never the requester. Then record the reference and upload the receipt. A bill clears when payouts reach its target.</p>
      {err && <p className="err">{err}</p>}
      {rows.map(b => {
        const avail = b.received_kobo - b.verified_paid_kobo, i = info[b.id] || {}
        return (
          <div className="card" key={b.id}>
            <div className="row"><b>{b.category}</b><span className="pill">{naira(avail)} available</span></div>
            <p className="mu">Pay: {i.biller_name} · {i.biller_account_ref}</p>
            <label htmlFor={'pa' + b.id}>Amount paid (₦, leave blank for {naira(avail)})</label>
            <input id={'pa' + b.id} inputMode="decimal" onChange={e => set(b.id, 'amount', e.target.value)} />
            <label htmlFor={'pr' + b.id}>Payment reference</label>
            <input id={'pr' + b.id} onChange={e => set(b.id, 'ref', e.target.value)} />
            <label htmlFor={'pf' + b.id}>Receipt</label>
            <input id={'pf' + b.id} type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => set(b.id, 'file', e.target.files[0])} />
            <button className="btn" disabled={busy === b.id} onClick={() => pay(b)}>{busy === b.id ? 'Recording…' : 'Record payout'}</button>
          </div>
        )
      })}
    </>
  )
}

function Community({ user, staff }) {
  const [list, setList] = useState(null), [mine, setMine] = useState([]), [open, setOpen] = useState(null), [prof, setProf] = useState(null), [err, setErr] = useState('')
  async function load() {
    const [c, st, m] = await Promise.all([
      supabase.from('communities').select('*, figures(name, tagline, authorized)').order('kind', { ascending: false }).order('name'),
      supabase.from('community_stats').select('*'),
      supabase.from('community_members').select('community_id').eq('user_id', user.id)])
    const counts = Object.fromEntries((st.data || []).map(x => [x.community_id, x.members]))
    setList((c.data || []).map(x => ({ ...x, members: counts[x.id] || 0 })))
    setMine((m.data || []).map(x => x.community_id))
  }
  useEffect(() => { load() }, [])
  async function toggle(id) {
    setErr('')
    const q = mine.includes(id)
      ? supabase.from('community_members').delete().eq('community_id', id).eq('user_id', user.id)
      : supabase.from('community_members').insert({ community_id: id, user_id: user.id })
    const { error } = await q
    error ? setErr(error.message) : load()
  }
  if (!list) return <p className="mu">Loading…</p>
  const room = open && list.find(x => x.id === open)
  const pc = prof && list.find(x => x.id === prof)
  if (pc) return <FigurePage c={pc} user={user} back={() => { setProf(null); load() }} openRoom={() => { setProf(null); setOpen(pc.id) }} />
  if (room) return <Room c={room} user={user} staff={staff} joined={mine.includes(room.id)} toggle={() => toggle(room.id)} back={() => { setOpen(null); load() }} />
  return (
    <>
      <h1>Bored Billionaires</h1>
      <p className="mu">Join a space, post, and cheer each other on. Be kind. No scams, no links, no begging for money in posts.</p>
      {err && <p className="err">{err}</p>}
      {list.map(c => (
        <div className="card" key={c.id}>
          <div className="row"><b>{c.name}</b><span className="pill">{c.members} {c.members === 1 ? 'member' : 'members'}</span></div>
          <p className="mu">{c.kind === 'student' ? c.description : c.figures?.tagline}</p>
          <div className="btns">
            <button className="btn" onClick={() => setOpen(c.id)}>Open</button>
            {c.figure_id && <button className="btn alt" onClick={() => setProf(c.id)}>Profile</button>}
            <button className="btn alt" onClick={() => toggle(c.id)}>{mine.includes(c.id) ? 'Leave' : 'Join'}</button>
          </div>
        </div>
      ))}
    </>
  )
}

function FigurePage({ c, user, back, openRoom }) {
  const [f, setF] = useState(null), [st, setSt] = useState({}), [imp, setImp] = useState({}), [tab, setTab] = useState('About')
  const [official, setOfficial] = useState([]), [bills, setBills] = useState([]), [claim, setClaim] = useState(null), [following, setFollowing] = useState(false)
  const [form, setForm] = useState({ role: '', proof: '', file: null }), [bio, setBio] = useState(''), [err, setErr] = useState(''), [note, setNote] = useState('')
  const [busy, setBusy] = useState(false), [showClaim, setShowClaim] = useState(false)
  async function load() {
    const id = c.figure_id
    const [a, s, i, o, b, cl, fo] = await Promise.all([
      supabase.from('figures').select('*').eq('id', id).single(),
      supabase.from('figure_stats').select('followers').eq('figure_id', id).maybeSingle(),
      supabase.from('figure_impact').select('*').eq('figure_id', id).maybeSingle(),
      supabase.from('community_feed').select('*').eq('community_id', c.id).eq('official', true).order('created_at', { ascending: false }).limit(20),
      supabase.from('figure_backed_bills').select('*').eq('figure_id', id),
      supabase.from('figure_claims').select('*').eq('figure_id', id).eq('claimant_id', user.id).order('created_at', { ascending: false }).limit(1),
      supabase.from('follows').select('figure_id').eq('user_id', user.id).eq('figure_id', id)])
    setF(a.data); setBio(a.data?.bio || ''); setSt(s.data || {}); setImp(i.data || {}); setOfficial(o.data || [])
    setBills(b.data || []); setClaim(cl.data?.[0] || null); setFollowing(!!fo.data?.length)
  }
  useEffect(() => { load() }, [c.id])
  async function follow() {
    const q = following
      ? supabase.from('follows').delete().eq('user_id', user.id).eq('figure_id', c.figure_id)
      : supabase.from('follows').insert({ user_id: user.id, figure_id: c.figure_id })
    const { error } = await q
    error ? setErr(error.message) : load()
  }
  async function submitClaim(e) {
    e.preventDefault(); setErr(''); setNote('')
    if (form.role.trim().length < 2) return setErr('Say what your role is.')
    if (form.proof.trim().length < 20) return setErr('Explain how you can show you’re them or their team (at least 20 characters).')
    if (form.file && (!TYPES.includes(form.file.type) || form.file.size > MAX_MB * 1024 * 1024)) return setErr(`Proof must be PDF, JPG or PNG under ${MAX_MB} MB.`)
    setBusy(true)
    let path = null
    if (form.file) {
      path = `${user.id}/${f.id}/${Date.now()}-${form.file.name.replace(/[^\w.\-]/g, '_')}`
      const up = await supabase.storage.from('claim-proof').upload(path, form.file, { contentType: form.file.type })
      if (up.error) { setBusy(false); return setErr('Upload failed: ' + up.error.message) }
    }
    const { error } = await supabase.from('figure_claims').insert({ figure_id: f.id, claimant_id: user.id, role_title: form.role.trim(), proof_note: form.proof.trim(), proof_path: path })
    setBusy(false)
    if (error) return setErr(error.code === '23505' ? 'You already have a request waiting.' : 'Could not send the request. Try again.')
    setShowClaim(false); setNote('Request sent. A reviewer will check it and you’ll get a notification.'); load()
  }
  async function saveBio() {
    setErr(''); setNote('')
    const { error } = await supabase.rpc('update_figure_bio', { p_figure: f.id, p_bio: bio })
    error ? setErr(error.message) : (setNote('Saved.'), load())
  }
  if (!f) return <p className="mu">Loading…</p>
  const owner = f.authorized && f.claimed_by === user.id
  return (
    <>
      <button className="chip" onClick={back}>Back</button>
      <h1>{f.name}</h1>
      <p className="mu">{f.tagline}</p>
      <span className="pill">{f.authorized ? 'Official profile' : 'Unofficial profile · not affiliated'}</span>
      <div className="btns">
        <button className="btn" onClick={follow}>{following ? 'Following' : 'Follow'}</button>
        <button className="btn alt" onClick={openRoom}>Open community</button>
      </div>
      <div className="row" style={{ marginTop: 14, textAlign: 'center' }}>
        {[['Followers', Number(st.followers || 0)], ['Bills backed', Number(imp.bills_backed || 0)], ['Given', naira(Number(imp.total_kobo || 0))]].map(x =>
          <div key={x[0]} style={{ flex: 1 }}><p className="mu" style={{ margin: 0 }}>{x[0]}</p><b style={{ fontSize: 20 }}>{x[1]}</b></div>)}
      </div>
      <div style={{ marginTop: 14 }}>{['About', 'Activity', 'Backed bills'].map(t => <button key={t} className={'chip ' + (tab === t ? 'on' : '')} aria-pressed={tab === t} onClick={() => setTab(t)}>{t}</button>)}</div>
      {err && <p className="err">{err}</p>}
      {note && <p className="mu">{note}</p>}
      {tab === 'About' && <>
        <h2>About</h2>
        {f.bio ? <p style={{ whiteSpace: 'pre-wrap' }}>{f.bio}</p> : <p className="mu">No biography yet. It’s added only by the person’s approved team.</p>}
        {owner && <>
          <label htmlFor="bio">Edit your About text (up to 600 characters)</label>
          <textarea id="bio" maxLength={600} value={bio} onChange={e => setBio(e.target.value)} />
          <button className="btn" onClick={saveBio}>Save About</button>
        </>}
        {!f.authorized && !f.claimed_by && (
          claim?.status === 'pending' ? <div className="card"><b>Request waiting</b><p className="mu">A reviewer is checking your request.</p></div>
          : showClaim
            ? <form onSubmit={submitClaim} className="card">
                <b>Request access to this profile</b>
                <p className="mu">Only for {f.name} or their team. We check every request. Approved teams can post Official updates and edit About.</p>
                <label htmlFor="cr">Your role</label>
                <input id="cr" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} />
                <label htmlFor="cp">How can you show this? (official email, contract, a link we can check)</label>
                <textarea id="cp" value={form.proof} onChange={e => setForm({ ...form, proof: e.target.value })} />
                <label htmlFor="cf">Proof document (optional, PDF, JPG or PNG)</label>
                <input id="cf" type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => setForm({ ...form, file: e.target.files[0] })} />
                <button className="btn" disabled={busy}>{busy ? 'Sending…' : 'Send request'}</button>
                <button type="button" className="btn alt" onClick={() => setShowClaim(false)}>Cancel</button>
              </form>
            : <button className="btn alt" onClick={() => setShowClaim(true)}>Is this you or your team? Request access</button>)}
        {claim?.status === 'rejected' && !f.authorized && <p className="mu">Your last request wasn’t approved.</p>}
      </>}
      {tab === 'Activity' && <>
        <h2>Official updates</h2>
        {!official.length
          ? <div className="card"><b>No official updates yet</b><p className="mu">Posts marked Official from {f.name}’s team show up here.</p></div>
          : official.map(p => <div className="card" key={p.id}><div className="row"><b>@{p.author_handle}</b><span className="pill">Official</span></div><p style={{ whiteSpace: 'pre-wrap' }}>{p.body}</p><p className="mu" style={{ margin: 0 }}>{new Date(p.created_at).toLocaleString()}</p></div>)}
      </>}
      {tab === 'Backed bills' && <>
        <h2>Bills backed publicly</h2>
        {!bills.length
          ? <div className="card"><b>No bills backed yet</b><p className="mu">Only gifts made openly from {f.name}’s approved account appear here.</p></div>
          : bills.map(b => <div className="card" key={b.bill_id}><div className="row"><b>{b.category}</b><span className="pill">{LABEL[b.status]}</span></div><p>{b.title}</p><p className="mu" style={{ margin: 0 }}>{naira(b.received_kobo)} of {naira(b.target_kobo)}</p></div>)}
      </>}
    </>
  )
}

function Claims() {
  const [rows, setRows] = useState(null), [err, setErr] = useState('')
  const load = () => supabase.from('figure_claims').select('*, figures(name), profiles!claimant_id(handle)').eq('status', 'pending').order('created_at').then(({ data }) => setRows(data || []))
  useEffect(() => { load() }, [])
  async function proof(path) {
    const { data } = await supabase.storage.from('claim-proof').createSignedUrl(path, 300)
    data ? window.open(data.signedUrl, '_blank') : setErr('Could not open the document.')
  }
  async function decide(id, ok) {
    setErr('')
    const n = ok ? null : prompt('Short note for the person (optional):')
    const { error } = await supabase.rpc('review_claim', { p_claim: id, p_approve: ok, p_note: n || null })
    error ? setErr(error.message) : load()
  }
  if (!rows || !rows.length) return null
  return (
    <>
      <h1>Profile access requests</h1>
      <p className="mu">Approve only when you’ve confirmed the person really is the figure or their team, for example through a call or official email. Approving gives them Official posting.</p>
      {err && <p className="err">{err}</p>}
      {rows.map(r => (
        <div className="card" key={r.id}>
          <div className="row"><b>{r.figures?.name}</b><span className="pill">@{r.profiles?.handle}</span></div>
          <p className="mu">Role: {r.role_title}</p>
          <p style={{ whiteSpace: 'pre-wrap' }}>{r.proof_note}</p>
          {r.proof_path && <button className="btn alt" onClick={() => proof(r.proof_path)}>View document</button>}
          <div className="btns"><button className="btn" onClick={() => decide(r.id, true)}>Approve</button><button className="btn alt" onClick={() => decide(r.id, false)}>Decline</button></div>
        </div>
      ))}
    </>
  )
}

function Room({ c, user, staff, joined, toggle, back }) {
  const [rows, setRows] = useState(null), [liked, setLiked] = useState([]), [body, setBody] = useState(''), [err, setErr] = useState(''), [note, setNote] = useState('')
  const [busy, setBusy] = useState(false), [following, setFollowing] = useState(false), [followers, setFollowers] = useState(0)
  const [replyTo, setReplyTo] = useState(null), [rbody, setRbody] = useState('')
  async function load() {
    const [f, l] = await Promise.all([
      supabase.from('community_feed').select('*').eq('community_id', c.id).order('created_at', { ascending: false }).limit(200),
      supabase.from('post_likes').select('post_id').eq('user_id', user.id)])
    setRows(f.data || []); setLiked((l.data || []).map(x => x.post_id))
  }
  async function loadFollow() {
    if (!c.figure_id) return
    const [f, n] = await Promise.all([
      supabase.from('follows').select('figure_id').eq('user_id', user.id).eq('figure_id', c.figure_id),
      supabase.from('figure_stats').select('followers').eq('figure_id', c.figure_id).maybeSingle()])
    setFollowing(!!(f.data && f.data.length)); setFollowers(Number(n.data?.followers || 0))
  }
  useEffect(() => { load(); loadFollow() }, [c.id])
  async function follow() {
    const q = following
      ? supabase.from('follows').delete().eq('user_id', user.id).eq('figure_id', c.figure_id)
      : supabase.from('follows').insert({ user_id: user.id, figure_id: c.figure_id })
    const { error } = await q
    error ? setErr(error.message) : loadFollow()
  }
  async function send(text, parent) {
    setNote('')
    const t = text.trim()
    if (!t) return false
    if (/(https?:\/\/|www\.)/i.test(t)) { setErr('Links aren’t allowed yet.'); return false }
    setBusy(true)
    const { error } = await supabase.from('posts').insert({ community_id: c.id, author_id: user.id, body: t, parent_id: parent || null })
    setBusy(false)
    if (error) {
      setErr(error.message.includes('rate limit') ? 'You’re posting too fast. Try again in a while.'
        : error.message.includes('muted') ? 'Posting is paused on your account for now.' : 'Could not post. Try again.')
      return false
    }
    setErr(''); await load(); return true
  }
  async function like(id) {
    const q = liked.includes(id)
      ? supabase.from('post_likes').delete().eq('post_id', id).eq('user_id', user.id)
      : supabase.from('post_likes').insert({ post_id: id, user_id: user.id })
    const { error } = await q
    error ? setErr('Could not update your like.') : load()
  }
  async function report(id) {
    const { error } = await supabase.from('post_reports').insert({ post_id: id, reporter_id: user.id })
    setErr(''); setNote(error ? (error.code === '23505' ? 'You already reported that post.' : 'Could not send the report.') : 'Thanks. Posts with several reports are hidden for review.')
  }
  async function remove(id) { await supabase.from('posts').delete().eq('id', id); load() }
  const top = (rows || []).filter(p => !p.parent_id)
  const kids = id => (rows || []).filter(p => p.parent_id === id).reverse()
  const unofficial = c.kind === 'figure' && !c.figures?.authorized
  const Item = ({ p, reply }) => (
    <div className="card" style={reply ? { marginLeft: 18 } : undefined}>
      <div className="row"><b>@{p.author_handle}</b>{p.official && <span className="pill">Official</span>}</div>
      <p style={{ margin: '6px 0', whiteSpace: 'pre-wrap' }}>{p.body}</p>
      <div className="row"><span className="mu" style={{ margin: 0 }}>{new Date(p.created_at).toLocaleString()}</span></div>
      <div style={{ marginTop: 8 }}>
        <button className={'chip ' + (liked.includes(p.id) ? 'on' : '')} aria-pressed={liked.includes(p.id)} onClick={() => like(p.id)}>{liked.includes(p.id) ? 'Liked' : 'Like'} {p.like_count}</button>
        {!reply && joined && <button className="chip" onClick={() => { setReplyTo(replyTo === p.id ? null : p.id); setRbody('') }}>Reply{p.reply_count > 0 ? ` (${p.reply_count})` : ''}</button>}
        {p.author_id !== user.id && <button className="chip" onClick={() => report(p.id)}>Report</button>}
        {(p.author_id === user.id || staff) && <button className="chip" onClick={() => remove(p.id)}>Delete</button>}
      </div>
    </div>
  )
  return (
    <>
      <button className="chip" onClick={back}>Back</button>
      <h1>{c.name}</h1>
      <p className="mu">{c.kind === 'student' ? c.description : c.figures?.tagline}</p>
      {unofficial && <p className="mu">Fan community. {c.figures?.name} doesn’t run this space. Only posts marked Official come from them or their team.</p>}
      <div className="btns">
        <button className="btn" onClick={toggle}>{joined ? 'Joined · Leave' : 'Join community'}</button>
        {c.figure_id && <button className="btn alt" onClick={follow}>{following ? 'Following' : 'Follow'} · {followers}</button>}
      </div>
      {joined
        ? <form onSubmit={async e => { e.preventDefault(); if (await send(body)) setBody('') }}>
            <label htmlFor="pb">Say something</label>
            <textarea id="pb" maxLength={500} value={body} onChange={e => setBody(e.target.value)} />
            <button className="btn" disabled={busy}>{busy ? 'Posting…' : 'Post'}</button>
          </form>
        : <p className="mu" style={{ marginTop: 14 }}>Join to post, reply and like. You can read without joining.</p>}
      {err && <p className="err">{err}</p>}
      {note && <p className="mu">{note}</p>}
      {!rows ? <p className="mu">Loading…</p> : !top.length
        ? <div className="card"><b>No posts yet</b><p className="mu">Be the first to say something.</p></div>
        : top.map(p => (
          <div key={p.id}>
            <Item p={p} />
            {kids(p.id).map(r => <Item key={r.id} p={r} reply />)}
            {replyTo === p.id && (
              <form style={{ marginLeft: 18 }} onSubmit={async e => { e.preventDefault(); if (await send(rbody, p.id)) { setRbody(''); setReplyTo(null) } }}>
                <label htmlFor={'rb' + p.id}>Your reply</label>
                <textarea id={'rb' + p.id} maxLength={500} value={rbody} onChange={e => setRbody(e.target.value)} />
                <button className="btn" disabled={busy}>Send reply</button>
              </form>
            )}
          </div>))}
    </>
  )
}

function Notifications({ user, setUnread }) {
  const [rows, setRows] = useState(null)
  const load = () => supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(30).then(({ data }) => setRows(data || []))
  useEffect(() => { load() }, [])
  async function markAll() {
    await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false)
    setUnread(0); load()
  }
  if (!rows || !rows.length) return null
  const n = rows.filter(r => !r.read).length
  return (
    <>
      <div className="row"><h2>Notifications</h2>{n > 0 && <button className="chip" onClick={markAll}>Mark all read</button>}</div>
      {rows.map(x => (
        <div className="card" key={x.id} style={{ opacity: x.read ? 0.6 : 1 }}>
          {x.body}
          <p className="mu" style={{ margin: 0 }}>{new Date(x.created_at).toLocaleString()}</p>
        </div>
      ))}
    </>
  )
}

function Moderation() {
  const [rows, setRows] = useState(null), [err, setErr] = useState('')
  const load = () => supabase.rpc('moderation_queue').then(({ data }) => setRows(data || []))
  useEffect(() => { load() }, [])
  async function act(id, action) {
    setErr('')
    const { error } = await supabase.rpc('moderate_post', { p_post: id, p_action: action })
    error ? setErr(error.message) : load()
  }
  if (!rows || !rows.length) return null
  return (
    <>
      <h1>Reported posts</h1>
      <p className="mu">Posts with 3 or more reports are already hidden from the feed. Remove them, or dismiss the reports to bring a post back.</p>
      {err && <p className="err">{err}</p>}
      {rows.map(r => (
        <div className="card" key={r.post_id}>
          <div className="row"><b>@{r.author_handle} in {r.community_name}</b><span className="pill">{r.reports} {Number(r.reports) === 1 ? 'report' : 'reports'}</span></div>
          <p style={{ whiteSpace: 'pre-wrap' }}>{r.body}</p>
          <div className="btns">
            <button className="btn" onClick={() => act(r.post_id, 'remove')}>Remove</button>
            <button className="btn alt" onClick={() => act(r.post_id, 'remove_mute')}>Remove + mute 7 days</button>
            <button className="btn alt" onClick={() => act(r.post_id, 'dismiss')}>Dismiss</button>
          </div>
        </div>
      ))}
    </>
  )
}

function Me({ profile, email, setProfile, children }) {
  const [editing, setEditing] = useState(false)
  return (
    <>
      <h1>Profile</h1>
      <div className="card"><b>{profile?.display_name}</b><p className="mu">@{profile?.handle} · {email}</p><p className="mu">Role: {profile?.role}</p>{profile && (editing ? <UsernameForm profile={profile} onSaved={p => { setProfile(p); setEditing(false) }} onCancel={() => setEditing(false)} /> : <button className="btn alt" onClick={() => setEditing(true)}>{profile.handle.startsWith('user_') ? 'Choose a username' : 'Change username'}</button>)}</div>
      {children}
      <button className="btn alt" onClick={() => supabase.auth.signOut()}>Sign out</button>
      <LegalLinks />
    </>
  )
}
