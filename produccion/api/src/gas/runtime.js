import fs from 'fs';
import path from 'path';
import vm from 'vm';
import crypto from 'crypto';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import request from 'sync-request';
import AdmZip from 'adm-zip';
import { env } from '../services/config.js';

class GasBlob {
  constructor(bytes, contentType = 'application/octet-stream', name = 'blob.bin') {
    this.bytes = Buffer.isBuffer(bytes) ? Buffer.from(bytes) : Buffer.from(bytes || []);
    this.contentType = contentType || 'application/octet-stream';
    this.name = name || 'blob.bin';
  }

  setName(name) {
    this.name = String(name || this.name);
    return this;
  }

  getName() {
    return this.name;
  }

  getBytes() {
    return Array.from(this.bytes);
  }

  getContentType() {
    return this.contentType;
  }

  getDataAsString() {
    return this.bytes.toString('utf8');
  }

  getAs(contentType) {
    return new GasBlob(this.bytes, contentType || this.contentType, this.name);
  }
}

class GasFetchResponse {
  constructor(statusCode, body, headers = {}) {
    this.statusCode = Number(statusCode || 0);
    this.body = body == null ? '' : body;
    this.headers = headers || {};
  }

  getResponseCode() {
    return this.statusCode;
  }

  getContentText() {
    if (Buffer.isBuffer(this.body)) return this.body.toString('utf8');
    return String(this.body || '');
  }

  getBlob() {
    const contentType = this.headers['content-type'] || this.headers['Content-Type'] || 'application/octet-stream';
    const bytes = Buffer.isBuffer(this.body) ? this.body : Buffer.from(String(this.body || ''), 'utf8');
    return new GasBlob(bytes, contentType, 'response.bin');
  }
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

function formatDateInTimeZone(dateValue, timeZone, pattern) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return '';

  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: timeZone || env.TZ || 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    weekday: 'short'
  });

  const parts = Object.fromEntries(fmt.formatToParts(date).map((part) => [part.type, part.value]));
  const year = parts.year;
  const month = parts.month;
  const day = parts.day;
  const hour = parts.hour;
  const minute = parts.minute;
  const second = parts.second;
  const weekday = (parts.weekday || '').slice(0, 3);

  switch (pattern) {
    case 'yyyyMMdd_HHmmss':
      return `${year}${month}${day}_${hour}${minute}${second}`;
    case 'yyyy-MM-dd':
      return `${year}-${month}-${day}`;
    case 'yyyy-MM-dd HH:mm':
      return `${year}-${month}-${day} ${hour}:${minute}`;
    case 'yyyy-MM-dd HH:mm:ss':
      return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
    case 'yyyyMMdd':
      return `${year}${month}${day}`;
    case 'dd/MM':
      return `${day}/${month}`;
    case 'EEE':
      return weekday;
    default:
      return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
  }
}

function createScriptProperties() {
  const map = new Map();
  const setIfValue = (key, value) => {
    if (value != null && String(value).trim()) map.set(String(key), String(value));
  };

  setIfValue('SUPABASE_URL', env.SUPABASE_URL);
  setIfValue('SUPABASE_SERVICE_ROLE_KEY', env.SUPABASE_SERVICE_ROLE_KEY);
  setIfValue('SUPABASE_SECRET_KEY', env.SUPABASE_SERVICE_ROLE_KEY);
  setIfValue('AWS_REGION', env.AWS_REGION);
  setIfValue('SES_FROM_EMAIL', env.SES_FROM_EMAIL);
  setIfValue('SES_REPLY_TO', env.SES_REPLY_TO);
  setIfValue('PDF_ROOT_ID', 'CobroTransporte_PDF');

  return {
    getProperty(key) {
      return map.has(key) ? map.get(key) : null;
    },
    setProperty(key, value) {
      map.set(String(key), String(value == null ? '' : value));
    },
    setProperties(values = {}) {
      for (const [key, value] of Object.entries(values)) {
        map.set(String(key), String(value == null ? '' : value));
      }
    },
    deleteProperty(key) {
      map.delete(String(key));
    }
  };
}

function createCacheService() {
  const store = new Map();

  const api = {
    get(key) {
      const hit = store.get(String(key));
      if (!hit) return null;
      if (hit.expiresAt && hit.expiresAt < Date.now()) {
        store.delete(String(key));
        return null;
      }
      return hit.value;
    },
    put(key, value, ttlSeconds = 60) {
      const expiresAt = ttlSeconds ? Date.now() + Number(ttlSeconds) * 1000 : 0;
      store.set(String(key), { value: String(value == null ? '' : value), expiresAt });
    },
    remove(key) {
      store.delete(String(key));
    },
    removeByPrefix(prefix) {
      const wanted = String(prefix || '');
      if (!wanted) return 0;
      let removed = 0;
      for (const key of Array.from(store.keys())) {
        if (!String(key).startsWith(wanted)) continue;
        store.delete(key);
        removed += 1;
      }
      return removed;
    },
    clearAll() {
      const total = store.size;
      store.clear();
      return total;
    }
  };

  return {
    getScriptCache() {
      return api;
    }
  };
}

function createUtilities() {
  return {
    DigestAlgorithm: {
      SHA_256: 'SHA_256'
    },
    Charset: {
      UTF_8: 'UTF_8'
    },
    formatDate(dateValue, timeZone, pattern) {
      return formatDateInTimeZone(dateValue, timeZone, pattern);
    },
    computeDigest(_algorithm, value) {
      const hash = crypto.createHash('sha256').update(String(value || ''), 'utf8').digest();
      return Array.from(hash);
    },
    getUuid() {
      return crypto.randomUUID();
    },
    base64Decode(value) {
      return Buffer.from(String(value || ''), 'base64');
    },
    newBlob(bytes, mimeType, name) {
      return new GasBlob(bytes, mimeType, name);
    },
    zip(blobs, name = 'archive.zip') {
      const zip = new AdmZip();
      for (const blob of Array.isArray(blobs) ? blobs : []) {
        if (!blob) continue;
        const fileName = typeof blob.getName === 'function' ? blob.getName() : 'file.bin';
        const bytes = typeof blob.getBytes === 'function' ? Buffer.from(blob.getBytes()) : Buffer.from(blob.bytes || []);
        zip.addFile(fileName, bytes);
      }
      return new GasBlob(zip.toBuffer(), 'application/zip', name);
    }
  };
}

function createUrlFetchApp() {
  return {
    fetch(url, options = {}) {
      const method = String(options.method || 'get').toUpperCase();
      const headers = { ...(options.headers || {}) };
      const hasContentType = Object.keys(headers).some((key) => String(key || '').toLowerCase() === 'content-type');
      if (options.contentType && !hasContentType) {
        headers['Content-Type'] = String(options.contentType);
      }
      let body = options.payload;

      if (body != null && !Buffer.isBuffer(body) && typeof body !== 'string') {
        const contentType = String(headers['Content-Type'] || headers['content-type'] || '').toLowerCase();
        if (contentType.includes('application/json')) {
          body = JSON.stringify(body);
        } else {
          body = String(body);
        }
      }

      try {
        const response = request(method, String(url), {
          headers,
          body,
          timeout: 30000,
          gzip: true,
          followRedirects: true
        });
        return new GasFetchResponse(response.statusCode, response.getBody(), response.headers);
      } catch (error) {
        const match = String(error?.message || '').match(/status code (\d+)/i);
        const statusCode = match ? Number(match[1]) : Number(error?.statusCode || 500);
        return new GasFetchResponse(statusCode, String(error?.message || error), {});
      }
    }
  };
}

function splitMailList(value) {
  const list = [];
  const seen = new Set();
  const push = (entry) => {
    const mail = String(entry || '').trim();
    if (!mail) return;
    const key = mail.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    list.push(mail);
  };

  if (Array.isArray(value)) {
    value.forEach(push);
    return list;
  }

  String(value == null ? '' : value)
    .split(/[;,]+/)
    .forEach(push);

  return list;
}

function resolveSesFrom(mailOptions = {}) {
  const configuredFrom = String(env.SES_FROM_EMAIL || '').trim();
  if (!configuredFrom) return '';
  if (configuredFrom.includes('<')) return configuredFrom;

  const displayName = String(mailOptions.name || '').trim();
  if (!displayName) return configuredFrom;
  return `${displayName} <${configuredFrom}>`;
}

function buildMailAppPayload(args = []) {
  if (args.length === 1 && args[0] && typeof args[0] === 'object' && !Array.isArray(args[0])) {
    return { ...args[0] };
  }

  const [to, subject, body, options] = args;
  const extra = (options && typeof options === 'object' && !Array.isArray(options)) ? options : {};
  return {
    to,
    subject,
    body,
    ...extra
  };
}

function sendMailAppThroughLegacyBridge(args = []) {
  return sendMailAppThroughSes(args);
}

function sendMailAppThroughSes(args = []) {
  const region = String(env.AWS_REGION || '').trim();
  const from = resolveSesFrom(buildMailAppPayload(args));
  if (!region || !from) {
    throw new Error('MailApp no esta disponible en Railway. Configure AWS_REGION y SES_FROM_EMAIL.');
  }

  const payload = buildMailAppPayload(args);
  const to = splitMailList(payload.to);
  if (!to.length) {
    throw new Error('MailApp.sendEmail requiere al menos un destinatario.');
  }

  const mailPayload = {
    region,
    from,
    to,
    subject: String(payload.subject || ''),
    text: String(payload.body || '')
  };

  const htmlBody = String(payload.htmlBody || '').trim();
  if (htmlBody) mailPayload.html = htmlBody;

  const cc = splitMailList(payload.cc);
  if (cc.length) mailPayload.cc = cc;

  const replyTo = splitMailList(payload.replyTo || env.SES_REPLY_TO || '');
  if (replyTo.length) mailPayload.replyTo = replyTo;

  const response = spawnSync(process.execPath, ['-e', [
    "const { SESv2Client, SendEmailCommand } = require('@aws-sdk/client-sesv2');",
    "const payload = JSON.parse(process.env.SES_MAIL_PAYLOAD || '{}');",
    "const client = new SESv2Client({ region: payload.region });",
    "const body = {};",
    "if (payload.html) body.Html = { Charset: 'UTF-8', Data: String(payload.html) };",
    "if (payload.text || !payload.html) body.Text = { Charset: 'UTF-8', Data: String(payload.text || '') };",
    "const input = {",
    "FromEmailAddress: payload.from,",
    "Destination: { ToAddresses: payload.to || [], CcAddresses: payload.cc || [] },",
    "Content: { Simple: { Subject: { Charset: 'UTF-8', Data: String(payload.subject || '') }, Body: body } }",
    "};",
    "if (payload.replyTo && payload.replyTo.length) input.ReplyToAddresses = payload.replyTo;",
    "client.send(new SendEmailCommand(input)).then(() => process.exit(0)).catch((error) => { console.error(error?.message || String(error)); process.exit(1); });"
  ].join(' ')], {
    env: {
      ...process.env,
      SES_MAIL_PAYLOAD: JSON.stringify(mailPayload)
    },
    encoding: 'utf8',
    timeout: 30000
  });

  if (response.error) {
    throw response.error;
  }

  const statusCode = Number(response.status ?? 1);
  if (statusCode !== 0) {
    throw new Error(String(response.stderr || response.stdout || '').trim() || `SES MailApp bridge fallo con codigo ${statusCode}.`);
  }

  return true;
}

function createScriptApp() {
  const triggers = [];

  return {
    getProjectTriggers() {
      return triggers.slice();
    },
    newTrigger(handlerFunction) {
      const draft = {
        handlerFunction: String(handlerFunction || ''),
        everyHoursValue: null,
        everyDaysValue: null,
        atHourValue: null
      };

      return {
        timeBased() {
          return this;
        },
        everyHours(value) {
          draft.everyHoursValue = Number(value || 0);
          return this;
        },
        everyDays(value) {
          draft.everyDaysValue = Number(value || 0);
          return this;
        },
        atHour(value) {
          draft.atHourValue = Number(value || 0);
          return this;
        },
        create() {
          const trigger = {
            getHandlerFunction() {
              return draft.handlerFunction;
            }
          };
          triggers.push(trigger);
          return trigger;
        }
      };
    }
  };
}

function createBaseContext() {
  const scriptProperties = createScriptProperties();
  const cacheService = createCacheService();
  const utilities = createUtilities();
  const scriptApp = createScriptApp();

  const context = {
    console,
    JSON,
    Math,
    Number,
    String,
    Boolean,
    Array,
    Object,
    Date,
    RegExp,
    Buffer,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    Utilities: utilities,
    UrlFetchApp: createUrlFetchApp(),
    Session: {
      getScriptTimeZone() {
        return process.env.TZ || 'America/Lima';
      }
    },
    Logger: {
      log(...args) {
        console.log(...args);
      }
    },
    PropertiesService: {
      getScriptProperties() {
        return scriptProperties;
      }
    },
    CacheService: cacheService,
    ScriptApp: scriptApp,
    MimeType: {
      PDF: 'application/pdf'
    },
    HtmlService: {
      XFrameOptionsMode: {
        ALLOWALL: 'ALLOWALL'
      },
      createTemplateFromFile() {
        return {
          evaluate() {
            return {
              setTitle() {
                return this;
              },
              setXFrameOptionsMode() {
                return this;
              }
            };
          }
        };
      },
      createHtmlOutputFromFile() {
        return {
          getContent() {
            return '';
          }
        };
      },
      createHtmlOutput(html) {
        return {
          getBlob() {
            return new GasBlob(Buffer.from(String(html || ''), 'utf8'), 'text/html', 'output.html');
          }
        };
      }
    },
    MailApp: {
      sendEmail(...args) {
        return sendMailAppThroughSes(args);
      },
      getRemainingDailyQuota() {
        return env.AWS_REGION && env.SES_FROM_EMAIL ? 1000000 : 0;
      }
    },
    DriveApp: {
      Access: {
        DOMAIN_WITH_LINK: 'DOMAIN_WITH_LINK',
        ANYONE_WITH_LINK: 'ANYONE_WITH_LINK'
      },
      Permission: {
        VIEW: 'VIEW'
      },
      getFolderById() {
        throw new Error('DriveApp no disponible en Railway. Use Storage.');
      },
      createFolder() {
        throw new Error('DriveApp no disponible en Railway. Use Storage.');
      },
      getFileById() {
        throw new Error('DriveApp no disponible en Railway. Use Storage.');
      }
    }
  };

  context.global = context;
  context.globalThis = context;
  context.self = context;
  return context;
}

function loadLegacySource() {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const backendDir = path.resolve(__dirname, '../../../Backend_gas');
  const preferredOrder = ['supabase_adapter.gs', 'pdf_boleta_template.gs', 'code.gs'];
  const discovered = fs.readdirSync(backendDir)
    .filter((fileName) => fileName.endsWith('.gs'));

  const ordered = [
    ...preferredOrder.filter((fileName) => discovered.includes(fileName)),
    ...discovered.filter((fileName) => !preferredOrder.includes(fileName)).sort()
  ];

  return ordered
    .map((fileName) => fs.readFileSync(path.join(backendDir, fileName), 'utf8'))
    .join('\n\n');
}

function decodeStoragePathFromAppUrl(url) {
  const raw = String(url || '');
  const match = raw.match(/\/files\/([^/?#]+)/);
  if (!match || !match[1]) return '';
  try {
    return Buffer.from(match[1], 'base64url').toString('utf8');
  } catch {
    return '';
  }
}

function syncDeleteStoragePaths(paths) {
  const bucket = String(env.SUPABASE_STORAGE_BUCKET || 'cobros_pdf').trim();
  const baseUrl = String(env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const key = String(env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const uniquePaths = Array.from(
    new Set((Array.isArray(paths) ? paths : []).map((value) => String(value || '').trim()).filter(Boolean))
  );

  if (!bucket || !baseUrl || !key || !uniquePaths.length) return 0;

  try {
    const payload = JSON.stringify({
      url: `${baseUrl}/storage/v1/object/${bucket}`,
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: {
        prefixes: uniquePaths
      }
    });

    const result = spawnSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        "const payload = JSON.parse(process.env.STORAGE_DELETE_PAYLOAD || '{}'); const res = await fetch(payload.url, { method: 'DELETE', headers: payload.headers, body: JSON.stringify(payload.body) }); if (!res.ok) { const txt = await res.text(); console.error(txt || ('HTTP ' + res.status)); process.exit(1); }"
      ],
      {
        env: {
          ...process.env,
          STORAGE_DELETE_PAYLOAD: payload
        },
        encoding: 'utf8',
        timeout: 30000
      }
    );

    if (result.status !== 0) return 0;
    return uniquePaths.length;
  } catch {
    return 0;
  }
}

function patchRuntimeContext(context) {
  const originalOnEtapaChanged = typeof context.onEtapaChanged_ === 'function'
    ? context.onEtapaChanged_.bind(context)
    : null;

  context.__deferStageSideEffects = false;

  context.ensurePdfRoot_ = function ensurePdfRootOverride() {
    return 'CobroTransporte_PDF';
  };

  context.applyDriveSharePolicy_ = function applyDriveSharePolicyOverride() {
    return true;
  };

  context.extractDriveFileId_ = function extractDriveFileIdOverride(url) {
    const raw = String(url || '');
    const match = raw.match(/\/files\/([^/?#]+)/);
    if (match && match[1]) return match[1];
    let legacy = raw.match(/\/d\/([a-zA-Z0-9_-]{20,})/);
    if (legacy && legacy[1]) return legacy[1];
    legacy = raw.match(/[?&]id=([a-zA-Z0-9_-]{20,})/);
    return legacy && legacy[1] ? legacy[1] : '';
  };

  context.trashDriveFilesByUrls_ = function trashDriveFilesOverride(urls) {
    const storagePaths = (Array.isArray(urls) ? urls : [])
      .map((url) => decodeStoragePathFromAppUrl(url))
      .filter(Boolean);
    return syncDeleteStoragePaths(storagePaths);
  };

  if (originalOnEtapaChanged) {
    context.onEtapaChanged_ = function onEtapaChangedDeferredProxy(ctx) {
      if (!context.__deferStageSideEffects) {
        return originalOnEtapaChanged(ctx);
      }

      const clonedCtx = {
        ...(ctx || {}),
        rowData: Array.isArray(ctx?.rowData) ? ctx.rowData.slice() : ctx?.rowData,
        headers: Array.isArray(ctx?.headers) ? ctx.headers.slice() : ctx?.headers
      };

      setTimeout(() => {
        try {
          originalOnEtapaChanged(clonedCtx);
        } catch (error) {
          console.error('Deferred stage side effects failed:', error);
        }
      }, 0);

      return [];
    };
  }
}

class GasRuntime {
  constructor() {
    this.context = createBaseContext();
    vm.createContext(this.context);
    const script = new vm.Script(loadLegacySource(), {
      filename: 'gas-runtime.bundle.js'
    });
    script.runInContext(this.context, { timeout: 30000 });
    patchRuntimeContext(this.context);
  }

  has(name) {
    return typeof this.context[name] === 'function';
  }

  call(name, args = [], options = {}) {
    const fn = this.context[name];
    if (typeof fn !== 'function') {
      throw new Error(`Función GAS no encontrada: ${name}`);
    }
    const prevDeferStageSideEffects = this.context.__deferStageSideEffects;
    if (Object.prototype.hasOwnProperty.call(options || {}, 'deferStageSideEffects')) {
      this.context.__deferStageSideEffects = Boolean(options.deferStageSideEffects);
    }

    try {
      return fn.apply(this.context, Array.isArray(args) ? args : []);
    } finally {
      this.context.__deferStageSideEffects = prevDeferStageSideEffects;
    }
  }
}

let runtimeMemo = null;

export function getGasRuntime() {
  if (!runtimeMemo) {
    runtimeMemo = new GasRuntime();
  }
  return runtimeMemo;
}
