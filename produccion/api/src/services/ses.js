import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import { env, requireEnv } from './config.js';

let sesClient = null;

function getSesClient() {
  if (!sesClient) {
    sesClient = new SESv2Client({
      region: requireEnv('AWS_REGION')
    });
  }
  return sesClient;
}

function toAddressList(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry || '').trim()).filter(Boolean);
  }
  const normalized = String(value || '').trim();
  return normalized ? [normalized] : [];
}

function buildBody({ html, text }) {
  const body = {};
  const normalizedHtml = String(html || '').trim();
  const normalizedText = String(text || '').trim();

  if (normalizedHtml) {
    body.Html = {
      Charset: 'UTF-8',
      Data: normalizedHtml
    };
  }

  if (normalizedText || !normalizedHtml) {
    body.Text = {
      Charset: 'UTF-8',
      Data: normalizedText
    };
  }

  return body;
}

export async function sendMail({ to, subject, html, text, cc, replyTo }) {
  const destination = {
    ToAddresses: toAddressList(to)
  };

  const ccAddresses = toAddressList(cc);
  if (ccAddresses.length) {
    destination.CcAddresses = ccAddresses;
  }

  const input = {
    FromEmailAddress: requireEnv('SES_FROM_EMAIL'),
    Destination: destination,
    Content: {
      Simple: {
        Subject: {
          Charset: 'UTF-8',
          Data: String(subject || '')
        },
        Body: buildBody({ html, text })
      }
    }
  };

  const replyToAddresses = toAddressList(replyTo || env.SES_REPLY_TO);
  if (replyToAddresses.length) {
    input.ReplyToAddresses = replyToAddresses;
  }

  return getSesClient().send(new SendEmailCommand(input));
}
