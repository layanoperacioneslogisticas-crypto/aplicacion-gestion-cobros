import dotenv from 'dotenv';
import { readLegacySupabaseBootstrap } from './legacyBootstrap.js';

dotenv.config();

const legacySupabase = readLegacySupabaseBootstrap();

export const env = {
  PORT: process.env.PORT,
  CORS_ORIGIN: process.env.CORS_ORIGIN,
  APP_BASE_URL: process.env.APP_BASE_URL,
  SUPABASE_URL: process.env.SUPABASE_URL || legacySupabase.url,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || legacySupabase.serviceRoleKey,
  SUPABASE_JWT_SECRET: process.env.SUPABASE_JWT_SECRET,
  SUPABASE_STORAGE_BUCKET: process.env.SUPABASE_STORAGE_BUCKET,
  AWS_REGION: process.env.AWS_REGION,
  SES_FROM_EMAIL: process.env.SES_FROM_EMAIL,
  SES_REPLY_TO: process.env.SES_REPLY_TO
};

export function requireEnv(key) {
  const value = env[key];
  if (!value) {
    throw new Error(`Missing env: ${key}`);
  }
  return value;
}
