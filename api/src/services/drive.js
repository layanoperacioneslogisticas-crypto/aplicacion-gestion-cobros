import { google } from 'googleapis';
import { env, requireEnv } from './config.js';

export function getDriveClient() {
  const clientEmail = requireEnv('DRIVE_CLIENT_EMAIL');
  const privateKey = requireEnv('DRIVE_PRIVATE_KEY').replace(/\\n/g, '\n');
  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/drive']
  });
  return google.drive({ version: 'v3', auth });
}

export function getDriveRootId() {
  return env.DRIVE_ROOT_ID || '';
}
