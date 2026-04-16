import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

const SUPABASE_URL = 'https://tvngxonqljparqoanuho.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable__zbBQmMF9VIke4A7y1V45Q_m8feK7Do';

/*
 * Lazy singleton — the Supabase client is only created when first
 * accessed at runtime.  This avoids the `window is not defined`
 * crash that occurs during Expo Router's static-rendering phase
 * (Node.js / SSR), where AsyncStorage's web shim needs `window`.
 */
let _client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (!_client) {
    _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: Platform.OS === 'web',
      },
    });
  }
  return _client;
}

/**
 * Centralized Sync URL Generator (v1.5.2 "Gold Master")
 * Single source of truth for all auth/sync redirects.
 */
export function generateSyncUrl(userId: string | null, refreshToken: string | null): string {
  if (Platform.OS === 'web') {
    return `https://cfa-study-app-self.vercel.app/?sync=${userId || ''}${refreshToken ? `&rt=${refreshToken}` : ''}`;
  }
  // Mobile: Use Expo Linking to generate the correct app scheme URL
  return Linking.createURL('/', {
    queryParams: {
      sync: userId || '',
      rt: refreshToken || ''
    }
  });
}

/**
 * Re-export a proxy-like getter so every consumer can simply
 * write `import { supabase } from './supabaseClient'` and use
 * it as usual — the real client is created on first access.
 */
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop: string) {
    return (getClient() as any)[prop];
  },
});

/**
 * Ensure the device has an anonymous Supabase session.
 * Returns the `user.id` (UUID) used as a foreign key everywhere.
 */
export async function ensureAuth(): Promise<string> {
  const client = getClient();

  // 1. Try to reuse the persisted session
  const { data: { session } } = await client.auth.getSession();
  if (session?.user?.id) return session.user.id;

  // 2. Otherwise create a new anonymous session
  const { data, error } = await client.auth.signInAnonymously();
  if (error) throw error;
  if (!data.session) throw new Error('Anonymous auth returned no session');
  return data.session.user.id;
}

