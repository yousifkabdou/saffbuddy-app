import 'react-native-url-polyfill/auto'

import { createClient } from '@supabase/supabase-js'

import 'expo-sqlite/localStorage/install'

// Expo only fills these in when they're written out exactly like this (process.env.EXPO_PUBLIC_...).
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_KEY

// Fail with a clear message instead of Supabase's vague "supabaseUrl is required".
// The usual cause: a cloud (EAS) build, which can't see the gitignored .env.local.
if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_KEY. ' +
    'Set them in .env.local, or in the EAS environment for cloud builds.',
  )
}

// How long any one request may take before we give up on it.
export const REQUEST_TIMEOUT_MS = 15_000

// React Native's fetch has no timeout of its own (on Android it can wait forever on a connection
// that stopped passing data), so a stalled request would leave spinners spinning for good.
// This aborts it after REQUEST_TIMEOUT_MS; the caller gets an "AbortError", which isNetworkError
// (src/lib/errors.ts) treats as "no connection". It still honours a signal the caller passed in.
export function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  const callerSignal = init.signal
  if (callerSignal) {
    if (callerSignal.aborted) controller.abort()
    else callerSignal.addEventListener('abort', () => controller.abort(), { once: true })
  }
  return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer))
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    storage: localStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  global: { fetch: fetchWithTimeout },
})
