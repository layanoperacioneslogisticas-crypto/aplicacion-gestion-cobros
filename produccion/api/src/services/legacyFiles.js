import { getStorageBucket } from './storage.js';
import { env } from './config.js';
import { supabaseAdmin } from './supabase.js';

export const LEGACY_ROOT_PREFIX = 'CobroTransporte_PDF';

function base64UrlEncode(value) {
  return Buffer.from(String(value || ''), 'utf8').toString('base64url');
}

export function base64UrlDecode(value) {
  return Buffer.from(String(value || ''), 'base64url').toString('utf8');
}

export function slug(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

export function buildBaseUrl(req) {
  const configured = String(env.APP_BASE_URL || '').trim().replace(/\/+$/, '');
  if (configured) return configured;
  if (!req) return '';

  const proto = String(req.headers['x-forwarded-proto'] || req.protocol || 'http').split(',')[0].trim();
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  if (!host) return '';
  return `${proto}://${host}`;
}

export function buildAppFileUrl(storagePath, req) {
  const base = buildBaseUrl(req);
  const encoded = base64UrlEncode(storagePath);
  return `${base}/files/${encoded}`;
}

export function buildStorageBrowserUrl(prefix = LEGACY_ROOT_PREFIX, req) {
  const base = buildBaseUrl(req);
  const encoded = encodeURIComponent(prefix);
  return `${base}/storage-browser?prefix=${encoded}`;
}

export function decodeStoragePathFromAppUrl(url) {
  const raw = String(url || '').trim();
  const match = raw.match(/\/files\/([^/?#]+)/);
  if (!match || !match[1]) return '';
  try {
    return base64UrlDecode(match[1]);
  } catch {
    return '';
  }
}

export function sanitizeUploadName(fileName, fallbackName) {
  const fallback = String(fallbackName || 'archivo.pdf').trim() || 'archivo.pdf';
  const clean = String(fileName || '')
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]+/g, '_')
    .replace(/\s+/g, '_');
  return clean || fallback;
}

export function formatStamp(dateValue) {
  const date = new Date(dateValue || Date.now());
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  const second = String(date.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}_${hour}${minute}${second}`;
}

export function buildProcessFolderName(processId, createdAt) {
  return `${slug(processId) || `proc_${formatStamp(createdAt)}`}_${formatStamp(createdAt)}`;
}

export function buildProcessFolderInfo({
  processId,
  createdAt,
  countryCode,
  countryName,
  providerName,
  providerCode
}, req) {
  const safeCountry = `${String(countryCode || 'PE').toUpperCase()}_${slug(countryName || countryCode || 'pais') || 'pais'}`;
  const safeProvider = `${providerCode ? `${providerCode}_` : ''}${slug(providerName || 'sin_proveedor') || 'sin_proveedor'}`;
  const folderName = buildProcessFolderName(processId, createdAt);
  const prefix = `${LEGACY_ROOT_PREFIX}/${safeCountry}/${safeProvider}/${folderName}`;

  return {
    folderId: prefix,
    folderName,
    folderPrefix: prefix,
    folderUrl: buildStorageBrowserUrl(prefix, req),
    countryCode: String(countryCode || 'PE').toUpperCase(),
    countryName: String(countryName || '').trim()
  };
}

export async function uploadStorageObject(path, buffer, contentType = 'application/octet-stream') {
  const bucket = getStorageBucket();
  const { data, error } = await supabaseAdmin.storage.from(bucket).upload(path, buffer, {
    upsert: true,
    contentType
  });
  if (error) throw error;
  return data;
}

export async function downloadStorageObject(path) {
  const bucket = getStorageBucket();
  const { data, error } = await supabaseAdmin.storage.from(bucket).download(path);
  if (error) throw error;
  const bytes = Buffer.from(await data.arrayBuffer());
  return {
    buffer: bytes,
    contentType: data.type || 'application/octet-stream'
  };
}

export async function deleteStorageObject(path) {
  const bucket = getStorageBucket();
  const { error } = await supabaseAdmin.storage.from(bucket).remove([path]);
  if (error) throw error;
}

export async function deleteStorageObjects(paths) {
  const bucket = getStorageBucket();
  const wanted = Array.isArray(paths)
    ? paths.map((path) => String(path || '').trim()).filter(Boolean)
    : [];
  if (!wanted.length) return [];

  const removed = [];
  for (let i = 0; i < wanted.length; i += 100) {
    const chunk = wanted.slice(i, i + 100);
    const { data, error } = await supabaseAdmin.storage.from(bucket).remove(chunk);
    if (error) throw error;
    if (Array.isArray(data)) removed.push(...data);
  }
  return removed;
}

export async function listStoragePrefix(prefix) {
  const bucket = getStorageBucket();
  const cleanPrefix = String(prefix || '').replace(/^\/+|\/+$/g, '');
  const { data, error } = await supabaseAdmin.storage.from(bucket).list(cleanPrefix, {
    limit: 200,
    sortBy: { column: 'name', order: 'asc' }
  });
  if (error) throw error;
  return data || [];
}

export async function collectStoragePathsRecursive(prefix) {
  const cleanPrefix = String(prefix || '').replace(/^\/+|\/+$/g, '');
  if (!cleanPrefix) return [];

  const items = await listStoragePrefix(cleanPrefix);
  const out = [];
  for (const item of items) {
    const name = String(item?.name || '').trim();
    if (!name) continue;
    const nextPath = `${cleanPrefix}/${name}`;
    if (item?.metadata) {
      out.push(nextPath);
      continue;
    }
    const nested = await collectStoragePathsRecursive(nextPath);
    out.push(...nested);
  }
  return out;
}

export function pdfLinesFromCobro(id, formObject, items = []) {
  const lines = [
    `Cobro Transporte - ${id}`,
    '',
    `Fecha: ${new Date().toLocaleString('es-PE')}`,
    `Proveedor: ${formObject.proveedorNombre || ''} (${formObject.proveedorCodigo || ''})`,
    `Responsable: ${formObject.responsable || ''}`,
    `Unidad: ${formObject.unidad || ''}`,
    `Ruta: ${formObject.ruta || ''}`,
    `Piloto: ${formObject.pilotoNombre || ''}`,
    `Bodega: ${formObject.bodega || ''}`,
    `Licencia: ${formObject.licencia || ''}`,
    `Factura Ref: ${formObject.factura || ''}`,
    `C9: ${formObject.c9 || ''}`,
    `Observaciones: ${formObject.observaciones || ''}`,
    `Monto total: ${Number(formObject.totalCobro || 0).toFixed(2)}`,
    '',
    'Detalle:'
  ];

  for (const item of items) {
    lines.push(
      `- ${item.codigo || ''} | ${item.descripcion || ''} | cant=${Number(item.cantidad || 0)} | precio=${Number(item.precio || 0).toFixed(2)} | subtotal=${Number(item.subtotal || 0).toFixed(2)} | incidencia=${item.incidencia || ''}`
    );
  }

  return lines;
}

function escapePdfText(text) {
  return String(text || '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

export function buildSimplePdfBuffer(lines, title = 'Documento') {
  const pageWidth = 612;
  const pageHeight = 792;
  const startX = 40;
  const startY = 760;
  const lineHeight = 14;
  const maxLinesPerPage = 48;
  const allLines = Array.isArray(lines) ? lines : [];
  const pages = [];

  for (let i = 0; i < allLines.length; i += maxLinesPerPage) {
    pages.push(allLines.slice(i, i + maxLinesPerPage));
  }
  if (!pages.length) pages.push([title]);

  const objects = [];
  const addObject = (content) => {
    objects.push(content);
    return objects.length;
  };

  const catalogId = addObject('<< /Type /Catalog /Pages 2 0 R >>');
  const pagesId = addObject('<< /Type /Pages /Count 0 /Kids [] >>');
  const fontId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const pageIds = [];

  for (const pageLines of pages) {
    const commands = ['BT', '/F1 11 Tf'];
    pageLines.forEach((line, index) => {
      const y = startY - index * lineHeight;
      commands.push(`1 0 0 1 ${startX} ${y} Tm (${escapePdfText(line)}) Tj`);
    });
    commands.push('ET');
    const stream = commands.join('\n');
    const contentId = addObject(`<< /Length ${Buffer.byteLength(stream, 'utf8')} >>\nstream\n${stream}\nendstream`);
    const pageId = addObject(
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`
    );
    pageIds.push(pageId);
  }

  objects[pagesId - 1] = `<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] >>`;

  let output = '%PDF-1.4\n';
  const offsets = [0];

  for (let i = 0; i < objects.length; i += 1) {
    offsets.push(Buffer.byteLength(output, 'utf8'));
    output += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }

  const xrefOffset = Buffer.byteLength(output, 'utf8');
  output += `xref\n0 ${objects.length + 1}\n`;
  output += '0000000000 65535 f \n';
  for (let i = 1; i < offsets.length; i += 1) {
    output += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  output += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(output, 'utf8');
}
