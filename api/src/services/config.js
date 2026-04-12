import dotenv from 'dotenv';

dotenv.config();

export const env = {
  PORT: process.env.PORT,
  CORS_ORIGIN: process.env.CORS_ORIGIN,
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_JWT_SECRET: process.env.SUPABASE_JWT_SECRET,
  SUPABASE_STORAGE_BUCKET: process.env.SUPABASE_STORAGE_BUCKET,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  RESEND_FROM: process.env.RESEND_FROM,
  RESEND_REPLY_TO: process.env.RESEND_REPLY_TO
};

export function requireEnv(key) {
  const value = env[key];
  if (!value) {
    throw new Error(`Missing env: ${key}`);
  }
  return value;
}
