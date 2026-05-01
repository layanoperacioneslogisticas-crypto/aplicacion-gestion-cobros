import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

let memo = null;

export function readLegacySupabaseBootstrap() {
  if (memo) return memo;

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const sourcePath = path.resolve(__dirname, '../../../Backend_gas/supabase_adapter.gs');
  const out = {
    url: '',
    serviceRoleKey: ''
  };

  try {
    const source = fs.readFileSync(sourcePath, 'utf8');
    const match = source.match(
      /const SUPABASE_BOOTSTRAP_CONFIG = \{\s*url:\s*'([^']+)'\s*,\s*serviceRoleKey:\s*'([^']+)'/m
    );
    if (match) {
      out.url = String(match[1] || '').trim();
      out.serviceRoleKey = String(match[2] || '').trim();
    }
  } catch {
    // Sin bootstrap legacy disponible.
  }

  memo = out;
  return out;
}
