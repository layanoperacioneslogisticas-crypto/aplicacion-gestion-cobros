import { Resend } from 'resend';
import { env, requireEnv } from './config.js';

const apiKey = requireEnv('RESEND_API_KEY');
const resend = new Resend(apiKey);

export async function sendMail({ to, subject, html, text, cc, replyTo }) {
  const from = requireEnv('RESEND_FROM');
  const reply = replyTo || env.RESEND_REPLY_TO || undefined;
  const payload = {
    from,
    to,
    subject,
    html,
    text
  };
  if (cc) payload.cc = cc;
  if (reply) payload.reply_to = reply;
  return resend.emails.send(payload);
}
