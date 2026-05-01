import { env, requireEnv } from './config.js';
import { supabaseAdmin } from './supabase.js';

export function getStorageBucket() {
  return env.SUPABASE_STORAGE_BUCKET || 'cobros_pdf';
}

export async function uploadPdf({ path, buffer, contentType }) {
  const bucket = getStorageBucket();
  const { data, error } = await supabaseAdmin.storage
    .from(bucket)
    .upload(path, buffer, {
      contentType: contentType || 'application/pdf',
      upsert: true
    });
  if (error) throw error;
  return data;
}

export async function getSignedPdfUrl(path, expiresInSec = 60 * 60) {
  const bucket = getStorageBucket();
  const { data, error } = await supabaseAdmin.storage
    .from(bucket)
    .createSignedUrl(path, expiresInSec);
  if (error) throw error;
  return data?.signedUrl || '';
}
