import { createClient } from '@supabase/supabase-js'
export const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)
export const naira = (kobo) => '₦' + Math.round(kobo / 100).toLocaleString('en-NG')
export const toKobo = (v) => Math.round(parseFloat(String(v).replace(/,/g, '')) * 100)
