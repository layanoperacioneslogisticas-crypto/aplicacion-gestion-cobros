import PDFDocument from 'pdfkit';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const PDF_LAYOUT = Object.freeze({
  pageMargin: 16,
  headerHeight: 60,
  headerBottomGap: 8,
  logoSize: 36,
  metaCols: 4,
  metaGap: 4,
  metaCardHeight: 40,
  metaBottomGap: 8,
  tableHeaderHeight: 22,
  tableHeaderGap: 4,
  rowMinHeight: 18,
  rowPaddingY: 4,
  closingReserve: 140,
  summaryGap: 6,
  summaryCardHeight: 54,
  summaryBottomGap: 8,
  signatureGap: 10,
  signatureHeight: 78,
  footerInset: 14
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localLogoPath = path.resolve(__dirname, '../../../icon/images.png');
let cachedLocalLogoBufferPromise = null;

function text(value, fallback = '') {
  const normalized = String(value ?? '').replace(/\s+/g, ' ').trim();
  return normalized || fallback;
}

function money(value) {
  return Number(value || 0).toFixed(2);
}

function incidenciaTone(incidencia) {
  const value = text(incidencia, 'Conforme').toLowerCase();
  if (value === 'conforme') {
    return { fill: '#DCFCE7', stroke: '#BBF7D0', text: '#166534' };
  }
  if (value === 'faltante' || value === 'cruzado') {
    return { fill: '#FEF3C7', stroke: '#FDE68A', text: '#92400E' };
  }
  return { fill: '#FEE2E2', stroke: '#FECACA', text: '#991B1B' };
}

async function loadImageBuffer(rawValue) {
  const value = String(rawValue || '').trim();
  if (!value) return null;

  const dataMatch = value.match(/^data:image\/[a-zA-Z0-9.+-]+;base64,(.+)$/);
  if (dataMatch && dataMatch[1]) {
    try {
      return Buffer.from(dataMatch[1], 'base64');
    } catch {
      return null;
    }
  }

  if (!/^https?:\/\//i.test(value)) return null;

  try {
    const response = await fetch(value);
    if (!response.ok) return null;
    const bytes = await response.arrayBuffer();
    return Buffer.from(bytes);
  } catch {
    return null;
  }
}

async function loadBundledLogoBuffer() {
  if (!cachedLocalLogoBufferPromise) {
    cachedLocalLogoBufferPromise = fs.readFile(localLogoPath).catch(() => null);
  }
  return cachedLocalLogoBufferPromise;
}

function drawRoundedCard(doc, x, y, w, h, fillColor = '#FFFFFF', strokeColor = '#DBE4F3', radius = 12) {
  doc.save();
  doc.lineWidth(1);
  doc.fillColor(fillColor);
  doc.strokeColor(strokeColor);
  doc.roundedRect(x, y, w, h, radius).fillAndStroke();
  doc.restore();
}

function drawFieldCard(doc, x, y, w, h, label, value) {
  drawRoundedCard(doc, x, y, w, h, '#FBFDFF', '#DBE4F3', 12);
  doc.font('Helvetica-Bold')
    .fontSize(6.5)
    .fillColor('#6B7A95')
    .text(text(label).toUpperCase(), x + 9, y + 6, { width: w - 18 });
  doc.font('Helvetica-Bold')
    .fontSize(9)
    .fillColor('#0B2A6B')
    .text(text(value, '-'), x + 9, y + 17, { width: w - 18, height: h - 18, ellipsis: true });
}

function addPage(doc) {
  doc.addPage({ size: 'A4', layout: 'landscape', margin: PDF_LAYOUT.pageMargin });
  return {
    x: doc.page.margins.left,
    y: doc.page.margins.top,
    width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
    bottom: doc.page.height - doc.page.margins.bottom
  };
}

function drawHeader(doc, layout, view, logoBuffer) {
  const headerH = PDF_LAYOUT.headerHeight;
  const gradient = doc.linearGradient(layout.x, layout.y, layout.x + layout.width, layout.y);
  gradient.stop(0, '#163B82');
  gradient.stop(0.58, '#2094D4');
  gradient.stop(1, '#35C8A9');
  doc.save();
  doc.roundedRect(layout.x, layout.y, layout.width, headerH, 14).fill(gradient);
  doc.restore();

  const logoX = layout.x + 14;
  const logoY = layout.y + 12;
  if (logoBuffer) {
    doc.save();
    doc.roundedRect(logoX, logoY, PDF_LAYOUT.logoSize, PDF_LAYOUT.logoSize, 10).clip();
    doc.image(logoBuffer, logoX, logoY, {
      fit: [PDF_LAYOUT.logoSize, PDF_LAYOUT.logoSize],
      align: 'center',
      valign: 'center'
    });
    doc.restore();
  } else {
    doc.save();
    doc.roundedRect(logoX, logoY, PDF_LAYOUT.logoSize, PDF_LAYOUT.logoSize, 12).fill('#304A88');
    doc.restore();
    doc.font('Helvetica-Bold').fontSize(12).fillColor('#FFFFFF').text('PDC', logoX, logoY + 12, {
      width: PDF_LAYOUT.logoSize,
      align: 'center'
    });
  }

  doc.font('Helvetica-Bold').fontSize(15).fillColor('#FFFFFF').text('Cobro a Transporte', logoX + 46, logoY + 4);
  doc.font('Helvetica').fontSize(8.5).fillColor('#D7E8FF').text('Boleta interna - Preimpreso digital', logoX + 46, logoY + 24);

  const rightW = 175;
  const rightX = layout.x + layout.width - rightW - 14;
  doc.font('Helvetica-Bold').fontSize(15).fillColor('#FFFFFF').text(`#${view.id}`, rightX, logoY + 2, { width: rightW, align: 'right' });
  doc.font('Helvetica').fontSize(8.5).fillColor('#D7E8FF').text(`${view.fechaStr} - ${view.horaStr}`, rightX, logoY + 20, { width: rightW, align: 'right' });
  doc.save();
  doc.roundedRect(rightX + 77, logoY + 35, 98, 18, 9).fill('#46CFA8');
  doc.restore();
  doc.font('Helvetica-Bold').fontSize(7).fillColor('#FFFFFF').text('DOCUMENTO INTERNO', rightX + 77, logoY + 41, { width: 98, align: 'center' });

  return layout.y + headerH + PDF_LAYOUT.headerBottomGap;
}

function drawMetaGrid(doc, layout, startY, view) {
  const fields = [
    ['Responsable', view.responsable],
    ['Pais', view.countryName],
    ['Bodega', view.bodega],
    ['C9 / Centro', view.c9],
    ['Licencia', view.licencia],
    ['Proveedor', `${view.proveedorNombre}${view.proveedorCodigo ? ` (${view.proveedorCodigo})` : ''}`],
    ['Piloto', view.pilotoNombre],
    ['Unidad / Placa', view.unidad],
    ['Ruta Fisica', view.ruta]
  ];

  const cols = PDF_LAYOUT.metaCols;
  const gap = PDF_LAYOUT.metaGap;
  const cardH = PDF_LAYOUT.metaCardHeight;
  const cardW = (layout.width - gap * (cols - 1)) / cols;

  fields.forEach((field, index) => {
    const row = Math.floor(index / cols);
    const col = index % cols;
    const x = layout.x + col * (cardW + gap);
    const y = startY + row * (cardH + gap);
    drawFieldCard(doc, x, y, cardW, cardH, field[0], field[1]);
  });

  return startY + Math.ceil(fields.length / cols) * (cardH + gap) - gap + PDF_LAYOUT.metaBottomGap;
}

function drawTableHeader(doc, layout, y) {
  const columns = [
    { key: 'codigo', label: 'Codigo', width: 0.12, align: 'left' },
    { key: 'descripcion', label: 'Descripcion', width: 0.34, align: 'left' },
    { key: 'cajas', label: 'Cajas', width: 0.08, align: 'center' },
    { key: 'unds', label: 'Unds', width: 0.08, align: 'center' },
    { key: 'precio', label: 'Precio', width: 0.10, align: 'right' },
    { key: 'subtotal', label: 'Subtotal', width: 0.12, align: 'right' },
    { key: 'incidencia', label: 'Incidencia', width: 0.16, align: 'center' }
  ];

  const widths = columns.map((column) => Math.floor(layout.width * column.width));
  widths[widths.length - 1] += layout.width - widths.reduce((sum, width) => sum + width, 0);

  doc.save();
  doc.roundedRect(layout.x, y, layout.width, PDF_LAYOUT.tableHeaderHeight, 10).fill('#EEF4FF');
  doc.restore();

  let offsetX = layout.x;
  columns.forEach((column, index) => {
    const cellW = widths[index];
    doc.font('Helvetica-Bold')
      .fontSize(7)
      .fillColor('#0B2A6B')
      .text(column.label.toUpperCase(), offsetX + 7, y + 6, { width: cellW - 14, align: column.align });
    offsetX += cellW;
  });

  return { columns, widths, nextY: y + PDF_LAYOUT.tableHeaderHeight + PDF_LAYOUT.tableHeaderGap };
}

function drawItemsTable(doc, layout, startY, rows, view) {
  let y = startY;
  let header = drawTableHeader(doc, layout, y);
  y = header.nextY;
  let pageIndex = 1;

  const reserve = PDF_LAYOUT.closingReserve;

  for (const row of rows) {
    doc.font('Helvetica').fontSize(8.2);
    const descW = header.widths[1] - 16;
    const descH = doc.heightOfString(text(row.descripcion, '-'), {
      width: descW,
      align: 'left',
      lineGap: 1
    });
    const rowH = Math.max(PDF_LAYOUT.rowMinHeight, descH + PDF_LAYOUT.rowPaddingY * 2);

    if (y + rowH + reserve > layout.bottom) {
      layout = addPage(doc);
      pageIndex += 1;
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#0B2A6B').text(`Cobro ${view.id} - Continuacion ${pageIndex}`, layout.x, layout.y);
      header = drawTableHeader(doc, layout, layout.y + 12);
      y = header.nextY;
    }

    doc.save();
    doc.roundedRect(layout.x, y, layout.width, rowH, 8).fill('#FFFFFF');
    doc.restore();
    doc.moveTo(layout.x, y + rowH).lineTo(layout.x + layout.width, y + rowH).strokeColor('#EDF2FB').lineWidth(1).stroke();

    let offsetX = layout.x;
    const values = [
      text(row.codigo, '-'),
      text(row.descripcion, '-'),
      String(row.cajas ?? 0),
      String(row.unidadesSueltas ?? 0),
      money(row.precio),
      money(row.subtotal),
      text(row.incidencia, 'Conforme')
    ];

    header.columns.forEach((column, index) => {
      const cellW = header.widths[index];
      const cellX = offsetX + 7;
      const cellY = y + 5;

      if (column.key === 'incidencia') {
        const palette = incidenciaTone(values[index]);
        doc.font('Helvetica-Bold')
          .fontSize(8.2)
          .fillColor(palette.text)
          .text(values[index], cellX, cellY, {
            width: cellW - 14,
            align: 'center',
            ellipsis: true
          });
      } else {
        doc.font(index === 0 || index === 2 || index === 5 ? 'Helvetica-Bold' : 'Helvetica')
          .fontSize(index === 0 ? 8.2 : 8.2)
          .fillColor(index === 0 ? '#0F172A' : '#1F2937')
          .text(values[index], cellX, cellY, {
            width: cellW - 14,
            align: column.align,
            lineGap: 1
          });
      }

      offsetX += cellW;
    });

    y += rowH;
  }

  return { layout, y };
}

function drawSummary(doc, layout, startY, view) {
  const gap = PDF_LAYOUT.summaryGap;
  const widths = [layout.width * 0.36, layout.width * 0.18, layout.width * 0.18, layout.width * 0.22];
  const used = widths.reduce((sum, width) => sum + width, 0);
  widths[widths.length - 1] += layout.width - used - gap * 3;
  const cardH = PDF_LAYOUT.summaryCardHeight;
  let x = layout.x;

  const cards = [
    { title: 'Observaciones / Referencia', body: `Obs: ${view.observaciones || 'Sin observaciones.'}\nFactura Ref: ${view.factura || '-'}`, fill: '#FFFFFF', stroke: '#DBE4F3', tone: '#334155', size: 10.2 },
    { title: 'Total Cajas', body: String(view.totalCajas), sub: `Lineas: ${view.totalLineas}`, fill: '#FFFFFF', stroke: '#DBE4F3', tone: '#0B2A6B', big: true },
    { title: 'Total Unidades', body: String(view.totalUnidadesSueltas), sub: 'Calculo por UxC', fill: '#FFFFFF', stroke: '#DBE4F3', tone: '#0B2A6B', big: true },
    { title: 'Monto Total (S/)', body: money(view.totalMonto), sub: 'Validacion previa obligatoria', fill: '#FFF7ED', stroke: '#FED7AA', tone: '#9A3412', big: true }
  ];

  cards.forEach((card, index) => {
    const w = widths[index];
    drawRoundedCard(doc, x, startY, w, cardH, card.fill, card.stroke, 12);
    doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#6B7A95').text(card.title.toUpperCase(), x + 10, startY + 7, { width: w - 20 });
    if (card.big) {
      doc.font('Helvetica-Bold').fontSize(14).fillColor(card.tone).text(card.body, x + 10, startY + 19, { width: w - 20 });
      doc.font('Helvetica').fontSize(7.5).fillColor('#64748B').text(card.sub || '', x + 10, startY + 39, { width: w - 20 });
    } else {
      doc.font('Helvetica').fontSize(8.2).fillColor(card.tone).text(card.body, x + 10, startY + 18, { width: w - 20, height: cardH - 22 });
    }
    x += w + gap;
  });

  return startY + cardH + PDF_LAYOUT.summaryBottomGap;
}

function drawSignatureCard(doc, x, y, w, h, title, caption, imageBuffer) {
  drawRoundedCard(doc, x, y, w, h, '#FBFDFF', '#C7D5EE', 12);
  doc.font('Helvetica').fontSize(8).fillColor('#1F2937').text(title, x + 10, y + 8, { width: w - 20, align: 'center' });

  const boxX = x + 14;
  const boxY = y + 24;
  const boxW = w - 28;
  const boxH = h - 40;

  doc.save();
  doc.roundedRect(boxX, boxY, boxW, boxH, 10).fill('#FFFFFF');
  doc.restore();

  if (imageBuffer) {
    try {
      doc.image(imageBuffer, boxX + 6, boxY + 6, { fit: [boxW - 12, boxH - 12], align: 'center', valign: 'center' });
    } catch {
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#94A3B8').text('SIN FIRMA', boxX, boxY + boxH / 2 - 4, { width: boxW, align: 'center' });
    }
  } else {
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#94A3B8').text('SIN FIRMA', boxX, boxY + boxH / 2 - 4, { width: boxW, align: 'center' });
  }

  doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#64748B').text(caption.toUpperCase(), x + 10, y + h - 14, { width: w - 20, align: 'center' });
}

function drawFooter(doc, layout, y, view) {
  doc.moveTo(layout.x, y).lineTo(layout.x + layout.width, y).strokeColor('#E6EDF9').lineWidth(1).stroke();
  doc.font('Helvetica').fontSize(6.5).fillColor('#64748B')
    .text('Generado automaticamente por el sistema de Cobros a Transporte - Grupo PDC.', layout.x, y + 8, {
      width: layout.width / 2
    });
  doc.text(`Documento interno - ${view.fechaStr} ${view.horaStr}`, layout.x + layout.width / 2, y + 8, {
    width: layout.width / 2,
    align: 'right'
  });
}

export async function buildStyledCobroPdfBuffer({ id, formObject, items = [] }) {
  const signVista = await loadImageBuffer(formObject?.firmaVista);
  const signPiloto = await loadImageBuffer(formObject?.firmaPiloto);
  const appLogo = await loadBundledLogoBuffer();

  const totalCajas = items.reduce((sum, item) => sum + Number(item?.cajas || 0), 0);
  const totalUnidadesSueltas = items.reduce((sum, item) => sum + Number(item?.unidadesSueltas || 0), 0);
  const view = {
    id: text(id),
    fechaStr: new Date().toLocaleDateString('es-PE'),
    horaStr: new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }),
    responsable: text(formObject?.responsable, '-'),
    countryName: text(formObject?.countryName, '-'),
    bodega: text(formObject?.bodega, '-'),
    c9: text(formObject?.c9, '-'),
    licencia: text(formObject?.licencia, '-'),
    proveedorNombre: text(formObject?.proveedorNombre, '-'),
    proveedorCodigo: text(formObject?.proveedorCodigo, ''),
    pilotoNombre: text(formObject?.pilotoNombre, '-'),
    unidad: text(formObject?.unidad, '-'),
    ruta: text(formObject?.ruta, '-'),
    observaciones: text(formObject?.observaciones, 'Sin observaciones.'),
    factura: text(formObject?.factura, '-'),
    totalCajas,
    totalUnidadesSueltas,
    totalLineas: Array.isArray(items) ? items.length : 0,
    totalMonto: Number(formObject?.totalCobro || 0)
  };

  return await new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        layout: 'landscape',
        margin: PDF_LAYOUT.pageMargin,
        info: {
          Title: `Cobro Transporte - ${view.id}`,
          Author: 'Grupo PDC',
          Subject: 'Boleta de cobro a transporte'
        }
      });

      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      let layout = {
        x: doc.page.margins.left,
        y: doc.page.margins.top,
        width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
        bottom: doc.page.height - doc.page.margins.bottom
      };

      let y = drawHeader(doc, layout, view, appLogo);
      y = drawMetaGrid(doc, layout, y, view);
      const tableResult = drawItemsTable(doc, layout, y, Array.isArray(items) ? items : [], view);
      layout = tableResult.layout;
      y = tableResult.y + 8;

      const neededForClosing = PDF_LAYOUT.summaryCardHeight + PDF_LAYOUT.summaryBottomGap + PDF_LAYOUT.signatureHeight + PDF_LAYOUT.footerInset + 12;
      if (y + neededForClosing > layout.bottom) {
        layout = addPage(doc);
        y = layout.y;
      }

      y = drawSummary(doc, layout, y, view);

      const sigGap = PDF_LAYOUT.signatureGap;
      const sigW = (layout.width - sigGap) / 2;
      const sigH = PDF_LAYOUT.signatureHeight;
      drawSignatureCard(doc, layout.x, y, sigW, sigH, 'Firma / Conformidad', 'Vista PDC', signVista);
      drawSignatureCard(doc, layout.x + sigW + sigGap, y, sigW, sigH, 'Firma / Conformidad', 'Transportista', signPiloto);
      y += sigH + 10;

      drawFooter(doc, layout, Math.min(y, layout.bottom - PDF_LAYOUT.footerInset), view);
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
