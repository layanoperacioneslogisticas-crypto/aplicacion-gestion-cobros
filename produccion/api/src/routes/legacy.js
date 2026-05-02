import fs from 'fs';
import path from 'path';
import { Router } from 'express';
import { fileURLToPath } from 'url';
import { base64UrlDecode, downloadStorageObject } from '../services/legacyFiles.js';
import { renderStorageBrowser } from '../services/legacySpecial.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendPath = path.resolve(__dirname, '../../../Frontend_gas/Index.html');

function loadLegacyFrontendHtml() {
  return fs.readFileSync(frontendPath, 'utf8');
}

function fileNameFromStoragePath(pathValue) {
  const clean = String(pathValue || '').trim().split('/').pop() || 'archivo.pdf';
  return clean.replace(/[^a-zA-Z0-9._-]+/g, '_');
}

export const legacyRouter = Router();

legacyRouter.get('/', (_req, res) => {
  res.type('html').send(loadLegacyFrontendHtml());
});

legacyRouter.get('/files/:id', async (req, res) => {
  const id = String(req.params.id || '').trim();
  if (!id) {
    return res.status(400).send('Archivo invalido.');
  }

  try {
    const pathValue = base64UrlDecode(id);
    const file = await downloadStorageObject(pathValue);
    res.setHeader('Content-Type', file.contentType || 'application/octet-stream');
    if (String(file.contentType || '').toLowerCase() === 'application/pdf') {
      res.setHeader('Content-Disposition', `inline; filename="${fileNameFromStoragePath(pathValue)}"`);
    }
    res.send(file.buffer);
  } catch {
    res.status(404).send('Archivo no encontrado.');
  }
});

legacyRouter.get('/storage-browser', async (req, res, next) => {
  try {
    await renderStorageBrowser(req, res);
  } catch (error) {
    next(error);
  }
});
