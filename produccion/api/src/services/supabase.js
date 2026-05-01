import { createClient } from '@supabase/supabase-js';
import { env, requireEnv } from './config.js';

const url = requireEnv('SUPABASE_URL');
const key = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

export const supabaseAdmin = createClient(url, key, {
  auth: { persistSession: false }
});

export function supabaseUser(token) {
  if (!token) return null;
  return createClient(url, token, { auth: { persistSession: false } });
}

export async function getUserFromJwt(token) {
  if (!token) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error) return null;
  return data.user || null;
}

export async function getUserProfileByEmail(email) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) return null;
  const { data, error } = await supabaseAdmin
    .from('ct_users')
    .select('email,nombre,rol,activo,area,country_code')
    .eq('email', normalized)
    .maybeSingle();
  if (error) return null;
  return data || null;
}
