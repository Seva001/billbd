// Paystack calls this after a payment. Deploy with --no-verify-jwt (Paystack has no Supabase login).
// Nothing is trusted until the signature checks out AND Paystack's verify API confirms the amount.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const enc = new TextEncoder()
const ok = () => new Response('ok', { status: 200 })

Deno.serve(async (req) => {
  const secret = Deno.env.get('PAYSTACK_SECRET_KEY')!
  const raw = await req.text()

  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-512' }, false, ['sign'])
  const mac = await crypto.subtle.sign('HMAC', key, enc.encode(raw))
  const hex = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('')
  if (hex !== (req.headers.get('x-paystack-signature') ?? '')) return new Response('bad signature', { status: 401 })

  const evt = JSON.parse(raw)
  if (evt.event !== 'charge.success') return ok()

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const ref: string = evt.data.reference
  const { data: p } = await admin.from('payments').select('*').eq('reference', ref).maybeSingle()
  if (!p || p.status === 'success') return ok()          // unknown or already counted

  const v = await (await fetch(`https://api.paystack.co/transaction/verify/${ref}`, { headers: { Authorization: `Bearer ${secret}` } })).json()
  if (!v.status || v.data.status !== 'success' || v.data.amount !== p.amount_kobo || v.data.currency !== 'NGN') {
    await admin.from('payments').update({ status: 'failed' }).eq('reference', ref)
    return ok()
  }

  // provider_ref is unique, so a repeated webhook cannot double-count.
  const { error } = await admin.from('ledger_entries').insert({
    bill_id: p.bill_id, kind: 'received', amount_kobo: p.amount_kobo,
    supporter_id: p.supporter_id, anonymous: p.anonymous, provider_ref: ref })
  if (error && error.code !== '23505') return new Response('ledger error', { status: 500 })  // 500 makes Paystack retry

  await admin.from('payments').update({ status: 'success' }).eq('reference', ref)
  await admin.from('bills').update({ status: 'partially_supported' }).eq('id', p.bill_id).eq('status', 'eligible')
  return ok()
})
