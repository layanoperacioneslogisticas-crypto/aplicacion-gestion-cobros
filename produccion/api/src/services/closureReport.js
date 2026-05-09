import path from 'path';
import PDFDocument from 'pdfkit';
import { getGasRuntime } from '../gas/runtime.js';
import { executeLegacySpecial } from './legacySpecial.js';
import {
  buildAppFileUrl,
  decodeStoragePathFromAppUrl,
  formatStamp,
  LEGACY_ROOT_PREFIX,
  slug,
  uploadStorageObject
} from './legacyFiles.js';
import { supabaseAdmin, getUserProfileByEmail } from './supabase.js';

const ETAPAS_COBRO = [
  '1. Boleta generada',
  '2. Firma boleta pendiente',
  '3. Inventario pendiente',
  '4. OV / Pedido pendiente',
  '5. Ruta generada',
  '6. Ruta facturada (Factura emitida)',
  '7. Firma factura pendiente',
  '8. Ruta liquidada',
  '9. Gestionar pago',
  '10. Aplicacion de pago'
];

const PROCESS_KEY = 'cobro_transporte';

function createError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function text(value, fallback = '-') {
  const normalized = String(value ?? '').replace(/\s+/g, ' ').trim();
  return normalized || fallback;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function normalizeEstado(raw) {
  const value = normalizeText(raw);
  if (!value) return 'Abierto';
  if (value.includes('cerr') || value.includes('liquid') || value.includes('aplic')) return 'Cerrado';
  if (value.includes('anulad')) return 'Anulado';
  if (value.includes('observ')) return 'Observado';
  if (value.includes('firma')) return 'En firma';
  if (value.includes('proceso') || value.includes('pend')) return 'En proceso';
  return text(raw, 'Abierto');
}

function normalizeEtapa(value) {
  const raw = text(value, '');
  if (!raw) return '';
  const normalized = normalizeText(raw);
  const found = ETAPAS_COBRO.find((etapa) => normalizeText(etapa) === normalized);
  if (found) return found;
  const match = raw.match(/^(\d+)\./);
  if (match) {
    const idx = Number(match[1]);
    if (idx >= 1 && idx <= ETAPAS_COBRO.length) return ETAPAS_COBRO[idx - 1];
  }
  return raw;
}

function parseStageOrder(value) {
  const normalized = normalizeEtapa(value);
  const match = normalized.match(/^(\d+)\./);
  if (!match) return 0;
  return Number(match[1]) || 0;
}

function canGenerateClosureReport(cobro, flowData) {
  const estado = normalizeEstado(cobro?.estado);
  if (estado === 'Cerrado') return true;
  const etapa = normalizeEtapa(flowData?.etapa || cobro?.etapa || '');
  const facturasDebitar = String(flowData?.facturasDebitar || '').trim();
  return etapa === ETAPAS_COBRO[9] && !!facturasDebitar;
}

function formatDateTime(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleString('es-PE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

function parseDateSafe(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const raw = String(value).trim();
  if (!raw) return null;
  const parsed = new Date(raw.includes('T') ? raw : raw.replace(' ', 'T'));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function money(value) {
  return Number(value || 0).toLocaleString('es-PE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatDurationHours(hours) {
  if (!Number.isFinite(hours) || hours <= 0) return '-';
  const roundedMinutes = Math.round(hours * 60);
  const days = Math.floor(roundedMinutes / (60 * 24));
  const hoursPart = Math.floor((roundedMinutes % (60 * 24)) / 60);
  const minutesPart = roundedMinutes % 60;
  const chunks = [];
  if (days > 0) chunks.push(`${days} d`);
  if (hoursPart > 0) chunks.push(`${hoursPart} h`);
  if (minutesPart > 0 && days === 0) chunks.push(`${minutesPart} min`);
  return chunks.join(' ') || '0 min';
}

function formatPercent(value) {
  return `${Number(value || 0).toLocaleString('es-PE', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1
  })}%`;
}

function formatHoursValue(value) {
  return `${Number(value || 0).toLocaleString('es-PE', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1
  })} h`;
}

function clipText(value, max = 96) {
  const txt = text(value, '');
  if (!txt) return '-';
  return txt.length > max ? `${txt.slice(0, Math.max(0, max - 3))}...` : txt;
}

function parseJsonObject(raw) {
  const txt = String(raw || '').trim();
  if (!txt) return null;
  try {
    const parsed = JSON.parse(txt);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function summarizeAuditDetail(detail, action) {
  const parsed = parseJsonObject(detail);
  if (!parsed) return text(detail);

  const normalizedAction = normalizeText(action);
  if (parsed.kind === 'grouped_payment' || parsed.paymentId) {
    const parts = [];
    if (parsed.paymentId) parts.push(`Pago ${parsed.paymentId}`);
    if (parsed.operationNumber) parts.push(`Operacion ${parsed.operationNumber}`);
    if (Number(parsed.allocatedAmount || 0) > 0) parts.push(`Aplicado S/ ${money(parsed.allocatedAmount)}`);
    if (Number(parsed.cobroCount || 0) > 0) parts.push(`${parsed.cobroCount} cobros asociados`);
    if (parsed.paymentDate) parts.push(`Fecha ${parsed.paymentDate}`);
    return parts.join(' | ') || 'Pago agrupado asociado';
  }

  if (parsed.field || normalizedAction.includes('carga pdf')) {
    const fieldMap = {
      boleta_firmada_url: 'Boleta firmada',
      factura_url: 'Factura',
      firma_factura_url: 'Firma factura',
      constancia_pago_url: 'Constancia de pago'
    };
    const label = fieldMap[String(parsed.field || '').trim()] || 'Documento';
    const origin = parsed.origen ? `Origen ${parsed.origen}` : '';
    return [label, 'archivo actualizado', origin].filter(Boolean).join(' | ');
  }

  if (parsed.pdfUrl || parsed.excelUrl) {
    const parts = ['Entregables generados'];
    if (parsed.generatedAt) parts.push(`Fecha ${formatDateTime(parsed.generatedAt)}`);
    if (parsed.pdfUrl) parts.push('PDF listo');
    if (parsed.excelUrl) parts.push('Excel listo');
    return parts.join(' | ');
  }

  if (Array.isArray(parsed.notFound) || Number.isFinite(parsed.total)) {
    const parts = [];
    if (Number.isFinite(parsed.total)) parts.push(`${parsed.total} archivos procesados`);
    if (Array.isArray(parsed.notFound) && parsed.notFound.length) parts.push(`${parsed.notFound.length} incidencias`);
    return parts.join(' | ') || 'Proceso masivo ejecutado';
  }

  const parts = [];
  Object.entries(parsed).forEach(([key, value]) => {
    if (value == null || value === '' || typeof value === 'object') return;
    if (String(key).toLowerCase().includes('url')) return;
    parts.push(`${key}: ${value}`);
  });
  return parts.length ? parts.join(' | ') : text(detail);
}

function buildEvidenceRows(cobro, flowData) {
  const grouped = flowData?.groupedPayment || null;
  return [
    { label: 'PDF principal', url: cobro?.pdf_url || '' },
    { label: 'Boleta firmada', url: cobro?.boleta_firmada_url || cobro?.firma_boleta_url || '' },
    { label: 'Factura', url: cobro?.factura_url || '' },
    { label: 'Firma factura', url: cobro?.firma_factura_url || '' },
    { label: 'Constancia de pago', url: cobro?.constancia_pago_url || grouped?.constanciaPagoUrl || '' },
    { label: 'Pago agrupado', url: grouped?.constanciaPagoUrl || '' }
  ].filter((row, index, list) => row.url && list.findIndex((candidate) => candidate.url === row.url) === index);
}

function buildAuditRows(auditRows) {
  return (Array.isArray(auditRows) ? auditRows : []).map((row) => ({
    fecha: formatDateTime(row.created_at),
    etapa: text(row.etapa),
    usuario: text(row.usuario),
    accion: text(row.accion),
    resultado: text(row.resultado),
    detalle: summarizeAuditDetail(row.detalle, row.accion)
  }));
}

function buildTimelineRows(timelineRows) {
  return (Array.isArray(timelineRows) ? timelineRows : []).map((row) => ({
    fecha: text(row.fecha, ''),
    fechaAt: parseDateSafe(row.fecha),
    etapa: normalizeEtapa(row.etapa),
    usuario: text(row.usuario),
    accion: text(row.accion),
    resultado: text(row.resultado),
    detalle: summarizeAuditDetail(row.detalle, row.accion)
  }));
}

function buildStageMetrics(stageTimelineRows, cobro, stageSlaMap) {
  const rows = [];
  const stageMap = new Map(ETAPAS_COBRO.map((etapa, index) => [etapa, {
    etapa,
    stageOrder: index + 1,
    ingresoAt: null,
    salidaAt: null,
    ultimaAccionAt: null,
    responsables: new Set(),
    acciones: 0,
    durationHours: 0
  }]));

  for (let i = 0; i < stageTimelineRows.length; i += 1) {
    const row = stageTimelineRows[i];
    const etapa = normalizeEtapa(row.etapa);
    const metric = stageMap.get(etapa);
    if (!metric) continue;
    if (row.fechaAt && !metric.ingresoAt) metric.ingresoAt = row.fechaAt;
    if (row.fechaAt) metric.ultimaAccionAt = row.fechaAt;
    metric.acciones += 1;
    if (row.usuario && row.usuario !== '-') metric.responsables.add(row.usuario);

    const nextRow = stageTimelineRows[i + 1] || null;
    const endAt = nextRow?.fechaAt || parseDateSafe(cobro?.ultima_actualizacion) || parseDateSafe(cobro?.fecha_registro);
    if (row.fechaAt && endAt && endAt.getTime() >= row.fechaAt.getTime()) {
      metric.durationHours += (endAt.getTime() - row.fechaAt.getTime()) / 3600000;
      metric.salidaAt = endAt;
    }
  }

  ETAPAS_COBRO.forEach((etapa, index) => {
    const metric = stageMap.get(etapa);
    const slaCfg = stageSlaMap.get(index + 1) || null;
    const hasSla = Boolean(slaCfg?.active && Number(slaCfg?.slaHours || 0) > 0);
    let slaEstado = 'Sin SLA';
    if (metric?.acciones > 0 && hasSla) {
      slaEstado = metric.durationHours > Number(slaCfg.slaHours || 0) ? 'Excedido' : 'Cumplido';
    } else if (metric?.acciones > 0) {
      slaEstado = 'Sin configuracion';
    }
    rows.push({
      etapa,
      stageOrder: index + 1,
      ingresoAt: metric?.ingresoAt || null,
      salidaAt: metric?.salidaAt || null,
      ultimaAccionAt: metric?.ultimaAccionAt || null,
      responsables: Array.from(metric?.responsables || []).join(', '),
      acciones: Number(metric?.acciones || 0),
      durationHours: Number(metric?.durationHours || 0),
      durationLabel: formatDurationHours(metric?.durationHours || 0),
      slaHours: hasSla ? Number(slaCfg.slaHours || 0) : 0,
      slaLabel: hasSla ? formatHoursValue(slaCfg.slaHours || 0) : '-',
      slaEstado
    });
  });

  return rows;
}

function buildDashboardMetrics(dashboardStats) {
  const dash = dashboardStats?.dashboard || {};
  return {
    avancePromedio: Number(dash.avancePromedio || 0),
    avanceCierre: Number(dash.avanceCierre || 0),
    slaVencidos: Number(dash.slaVencidos || 0),
    tiempoCierrePromedioHoras: Number(dash.tiempoCierrePromedioHoras || 0),
    registros: Number(dash.registros || dashboardStats?.registros || 0),
    montoHoy: Number(dash.montoHoy || dashboardStats?.montoHoy || 0),
    proveedores: Number(dash.proveedores || dashboardStats?.proveedores || 0),
    unidadesTotales: Number(dash.unidadesTotales || dashboardStats?.unidades || 0),
    usuarioActividadTop: dash.usuarioActividadTop || {},
    usuarioSlaTop: dash.usuarioSlaTop || {},
    productoMayorValor: dash.productoMayorValor || {},
    proveedorTopSemana: dash.proveedorTopSemana || {}
  };
}

function buildSummaryMetrics({ cobro, flowData, stageRows, dashboardMetrics, timelineRows, stageSlaMap }) {
  const visitedStages = stageRows.filter((row) => row.acciones > 0);
  const completedStages = visitedStages.filter((row) => row.durationHours > 0);
  const totalStageHours = completedStages.reduce((acc, row) => acc + Number(row.durationHours || 0), 0);
  const slaConfigured = visitedStages.filter((row) => row.slaHours > 0);
  const slaCompliant = slaConfigured.filter((row) => row.slaEstado === 'Cumplido');
  const registeredAt = parseDateSafe(cobro.fecha_registro);
  const closedAt = parseDateSafe(cobro.ultima_actualizacion);
  const cycleHours = registeredAt && closedAt && closedAt.getTime() >= registeredAt.getTime()
    ? (closedAt.getTime() - registeredAt.getTime()) / 3600000
    : totalStageHours;
  const currentStageOrder = parseStageOrder(flowData?.etapa || cobro?.etapa || '');
  const currentStageRow = stageRows.find((row) => Number(row?.stageOrder || 0) === currentStageOrder) || null;
  const rawCurrentSlaLabel = text(flowData?.sla || '-', '-');
  const currentSlaLabel = rawCurrentSlaLabel !== '-'
    ? rawCurrentSlaLabel
    : text(currentStageRow?.slaLabel || '-', '-');
  const currentStageLimit = text(flowData?.fechaLimiteSlaActual || '-', '-');
  const stage10Sla = stageSlaMap.get(10);

  return {
    totalStageHours,
    cycleHours,
    visitedStages: visitedStages.length,
    completedStages: completedStages.length,
    slaCompliancePct: slaConfigured.length ? (slaCompliant.length * 100) / slaConfigured.length : 0,
    totalActions: timelineRows.length,
    currentSlaLabel,
    currentStageLimit,
    stage10SlaLabel: stage10Sla?.active && Number(stage10Sla?.slaHours || 0) > 0 ? formatHoursValue(stage10Sla.slaHours) : '-',
    dashboardMetrics
  };
}

function inferReportFolder(cobro) {
  const pdfPath = decodeStoragePathFromAppUrl(cobro?.pdf_url || cobro?.boleta_firmada_url || cobro?.firma_boleta_url || '');
  if (pdfPath) {
    const currentDir = path.posix.dirname(pdfPath);
    if (currentDir && currentDir !== '.') return `${currentDir}/reportes_cierre`;
  }
  const country = String(cobro?.country_code || 'PE').trim().toUpperCase();
  const provider = slug(cobro?.proveedor_nombre || cobro?.proveedor_codigo || 'sin_proveedor') || 'sin_proveedor';
  const id = slug(cobro?.id || 'sin_id') || 'sin_id';
  return `${LEGACY_ROOT_PREFIX}/reportes_cierre/${country}/${provider}/${id}`;
}

function buildStageSlaBadge(status) {
  const normalized = normalizeText(status);
  if (normalized.includes('exced')) return 'badge danger';
  if (normalized.includes('cumpl')) return 'badge success';
  return 'badge neutral';
}

function buildHtmlTable(headers, rows, { compact = false } = {}) {
  return `
    <table class="report-table${compact ? ' compact' : ''}">
      <thead>
        <tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr>
      </thead>
      <tbody>
        ${rows.length
          ? rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`).join('')
          : `<tr><td colspan="${headers.length}" class="empty-cell">Sin datos disponibles</td></tr>`}
      </tbody>
    </table>
  `;
}

function buildReportHtml(report) {
  const {
    cobro,
    items,
    flowData,
    timelineRows,
    auditFriendlyRows,
    stageRows,
    evidenceRows,
    summaryMetrics,
    dashboardMetrics,
    generatedAt
  } = report;
  const grouped = flowData?.groupedPayment || null;

  const summaryCards = [
    ['Monto total', `S/ ${money(cobro.total_cobro)}`],
    ['Tiempo total del caso', formatDurationHours(summaryMetrics.cycleHours)],
    ['Cumplimiento SLA', formatPercent(summaryMetrics.slaCompliancePct)],
    ['Etapas recorridas', String(summaryMetrics.visitedStages)],
    ['SLA vencidos en dashboard', String(dashboardMetrics.slaVencidos || 0)],
    ['Cierre promedio general', formatHoursValue(dashboardMetrics.tiempoCierrePromedioHoras || 0)]
  ];

  const executiveRows = [
    ['Cobro ID', escapeHtml(text(cobro.id))],
    ['Estado', `<span class="badge neutral">${escapeHtml(normalizeEstado(cobro.estado))}</span>`],
    ['Etapa final', escapeHtml(normalizeEtapa(cobro.etapa))],
    ['Proveedor', escapeHtml(text(cobro.proveedor_nombre))],
    ['Codigo proveedor', escapeHtml(text(cobro.proveedor_codigo))],
    ['Responsable final', escapeHtml(text(flowData?.areaResponsableActual || cobro.area_responsable_actual || cobro.responsable))],
    ['Pais', escapeHtml(`${text(cobro.country_code, '')} ${text(cobro.country_name, '')}`.trim() || '-')],
    ['Ruta', escapeHtml(text(cobro.ruta))],
    ['Unidad', escapeHtml(text(cobro.unidad))],
    ['Bodega', escapeHtml(text(cobro.bodega))],
    ['Fecha de registro', escapeHtml(formatDateTime(cobro.fecha_registro))],
    ['Ultima actualizacion', escapeHtml(formatDateTime(cobro.ultima_actualizacion))],
    ['Operacion de pago', escapeHtml(text(flowData?.debitoRef || grouped?.operationNumber))],
    ['Monto de pago', escapeHtml(flowData?.montoPago ? `S/ ${money(flowData.montoPago)}` : '-')],
    ['Aplicacion de pago', escapeHtml(text(flowData?.facturasDebitar || grouped?.applicationReference))],
    ['SLA etapa actual', escapeHtml(summaryMetrics.currentSlaLabel)],
    ['Limite SLA actual', escapeHtml(summaryMetrics.currentStageLimit)]
  ];

  const stageTableRows = stageRows.map((row) => [
    escapeHtml(row.etapa),
    escapeHtml(formatDateTime(row.ingresoAt)),
    escapeHtml(formatDateTime(row.salidaAt)),
    escapeHtml(row.durationLabel),
    escapeHtml(row.slaLabel),
    `<span class="${buildStageSlaBadge(row.slaEstado)}">${escapeHtml(row.slaEstado)}</span>`,
    escapeHtml(text(row.responsables)),
    escapeHtml(String(row.acciones || 0))
  ]);

  const itemsRows = (items || []).map((item) => [
    escapeHtml(text(item.codigo)),
    escapeHtml(text(item.descripcion)),
    escapeHtml(String(Number(item.cantidad || item.cajas || 0))),
    escapeHtml(`S/ ${money(item.precio || 0)}`),
    escapeHtml(`S/ ${money(item.subtotal || 0)}`),
    escapeHtml(text(item.incidencia || 'Conforme'))
  ]);

  const evidenceRowsHtml = evidenceRows.map((row) => [
    escapeHtml(row.label),
    `<a href="${escapeHtml(row.url)}" target="_blank" rel="noopener">${escapeHtml(clipText(row.url, 90))}</a>`
  ]);

  const timelineRowsHtml = timelineRows.map((row) => [
    escapeHtml(text(row.fecha)),
    escapeHtml(text(row.etapa)),
    escapeHtml(text(row.usuario)),
    escapeHtml(text(row.accion)),
    escapeHtml(text(row.resultado)),
    escapeHtml(clipText(row.detalle, 120))
  ]);

  const auditRowsHtml = auditFriendlyRows.map((row) => [
    escapeHtml(row.fecha),
    escapeHtml(row.etapa),
    escapeHtml(row.usuario),
    escapeHtml(row.accion),
    escapeHtml(row.resultado),
    escapeHtml(clipText(row.detalle, 120))
  ]);

  const html = `<!DOCTYPE html>
  <html lang="es">
  <head>
    <meta charset="utf-8">
    <style>
      :root {
        --bg: #f4efe6;
        --card: #ffffff;
        --ink: #1e293b;
        --muted: #64748b;
        --line: #d9e2ec;
        --brand: #0f4c5c;
        --brand-soft: #e4f2f6;
        --accent: #c97f35;
        --success: #0f766e;
        --danger: #b42318;
        --neutral: #475569;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        padding: 28px;
        font-family: "Segoe UI", Arial, sans-serif;
        background: linear-gradient(180deg, #f8f5ef 0%, #efe6d9 100%);
        color: var(--ink);
      }
      .page {
        max-width: 1180px;
        margin: 0 auto;
      }
      .hero {
        background: linear-gradient(135deg, #123d52 0%, #0f766e 100%);
        color: #fff;
        border-radius: 22px;
        padding: 28px 30px;
        box-shadow: 0 18px 44px rgba(15, 76, 92, 0.18);
      }
      .hero h1 {
        margin: 0 0 8px;
        font-size: 30px;
        letter-spacing: 0.2px;
      }
      .hero p {
        margin: 0;
        color: rgba(255,255,255,0.86);
        font-size: 13px;
      }
      .hero-grid {
        display: grid;
        grid-template-columns: 1.3fr 1fr;
        gap: 18px;
        margin-top: 18px;
      }
      .hero-box {
        background: rgba(255,255,255,0.1);
        border: 1px solid rgba(255,255,255,0.16);
        border-radius: 18px;
        padding: 16px 18px;
      }
      .hero-box strong {
        display: block;
        font-size: 12px;
        color: rgba(255,255,255,0.72);
        margin-bottom: 8px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }
      .hero-box span {
        display: block;
        font-size: 19px;
        font-weight: 700;
      }
      .section {
        margin-top: 22px;
        background: var(--card);
        border: 1px solid rgba(15, 76, 92, 0.08);
        border-radius: 22px;
        padding: 24px;
        box-shadow: 0 16px 36px rgba(15, 23, 42, 0.06);
      }
      .section h2 {
        margin: 0 0 14px;
        font-size: 20px;
        color: var(--brand);
      }
      .section p.lead {
        margin: 0 0 18px;
        color: var(--muted);
        font-size: 13px;
      }
      .kpi-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 14px;
      }
      .kpi-card {
        background: linear-gradient(180deg, #fff 0%, #f6fafb 100%);
        border: 1px solid var(--line);
        border-radius: 18px;
        padding: 16px;
      }
      .kpi-card small {
        display: block;
        color: var(--muted);
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-size: 10px;
        margin-bottom: 8px;
      }
      .kpi-card strong {
        display: block;
        font-size: 25px;
        color: var(--brand);
        line-height: 1.1;
      }
      .kpi-card span {
        display: block;
        margin-top: 8px;
        color: var(--muted);
        font-size: 12px;
      }
      .split {
        display: grid;
        grid-template-columns: 1.2fr 0.8fr;
        gap: 18px;
      }
      .spotlight {
        display: grid;
        gap: 12px;
      }
      .spot-card {
        border: 1px solid var(--line);
        border-radius: 18px;
        padding: 16px;
        background: #fbfdff;
      }
      .spot-card strong {
        display: block;
        color: var(--brand);
        margin-bottom: 6px;
      }
      .spot-card p {
        margin: 0;
        color: var(--muted);
        font-size: 13px;
      }
      .report-table {
        width: 100%;
        border-collapse: collapse;
        overflow: hidden;
        border-radius: 18px;
        font-size: 12px;
      }
      .report-table thead th {
        background: #edf7fa;
        color: var(--brand);
        text-align: left;
        padding: 12px 12px;
        border-bottom: 1px solid var(--line);
      }
      .report-table tbody td {
        padding: 11px 12px;
        border-bottom: 1px solid #eef2f7;
        vertical-align: top;
      }
      .report-table tbody tr:nth-child(even) td {
        background: #fbfdff;
      }
      .report-table.compact tbody td,
      .report-table.compact thead th {
        padding-top: 9px;
        padding-bottom: 9px;
      }
      .report-table a {
        color: var(--brand);
        text-decoration: none;
      }
      .badge {
        display: inline-block;
        padding: 4px 9px;
        border-radius: 999px;
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }
      .badge.success { background: #d8f3ea; color: var(--success); }
      .badge.danger { background: #fee4e2; color: var(--danger); }
      .badge.neutral { background: #e7eef5; color: var(--neutral); }
      .empty-cell {
        text-align: center;
        color: var(--muted);
        font-style: italic;
      }
      .foot {
        margin-top: 18px;
        color: var(--muted);
        font-size: 11px;
        text-align: right;
      }
    </style>
  </head>
  <body>
    <div class="page">
      <section class="hero">
        <h1>Reporte ejecutivo de cierre</h1>
        <p>Generado el ${escapeHtml(generatedAt)} para el cobro ${escapeHtml(text(cobro.id))}</p>
        <div class="hero-grid">
          <div class="hero-box">
            <strong>Resumen del caso</strong>
            <span>${escapeHtml(normalizeEstado(cobro.estado))}</span>
            <p>${escapeHtml(normalizeEtapa(cobro.etapa))}</p>
          </div>
          <div class="hero-box">
            <strong>Tiempo total del proceso</strong>
            <span>${escapeHtml(formatDurationHours(summaryMetrics.cycleHours))}</span>
            <p>${escapeHtml(`${summaryMetrics.totalActions} eventos registrados en bitacora`)}</p>
          </div>
        </div>
      </section>

      <section class="section">
        <h2>Dashboard y metricas</h2>
        <p class="lead">Vista resumida del comportamiento del proceso, SLA y referencia operativa general.</p>
        <div class="kpi-grid">
          ${summaryCards.map(([label, value]) => `
            <div class="kpi-card">
              <small>${escapeHtml(label)}</small>
              <strong>${escapeHtml(value)}</strong>
            </div>
          `).join('')}
        </div>
      </section>

      <section class="section split">
        <div>
          <h2>Resumen ejecutivo del cobro</h2>
          ${buildHtmlTable(['Campo', 'Valor'], executiveRows.map(([label, value]) => [escapeHtml(label), value]), { compact: true })}
        </div>
        <div class="spotlight">
          <div class="spot-card">
            <strong>Usuario con mayor actividad</strong>
            <p>${escapeHtml(text(dashboardMetrics.usuarioActividadTop?.usuario))}</p>
            <p>${escapeHtml(`${text(dashboardMetrics.usuarioActividadTop?.area)} | ${Number(dashboardMetrics.usuarioActividadTop?.acciones7d || 0)} acciones en 7 dias`)}</p>
          </div>
          <div class="spot-card">
            <strong>Mayor tension por SLA</strong>
            <p>${escapeHtml(text(dashboardMetrics.usuarioSlaTop?.usuario))}</p>
            <p>${escapeHtml(`${Number(dashboardMetrics.usuarioSlaTop?.casos || 0)} casos vencidos | Area ${text(dashboardMetrics.usuarioSlaTop?.area)}`)}</p>
          </div>
          <div class="spot-card">
            <strong>Proveedor top de la semana</strong>
            <p>${escapeHtml(text(dashboardMetrics.proveedorTopSemana?.proveedor))}</p>
            <p>${escapeHtml(`Monto referencial S/ ${money(dashboardMetrics.proveedorTopSemana?.monto || 0)}`)}</p>
          </div>
          <div class="spot-card">
            <strong>Producto de mayor valor</strong>
            <p>${escapeHtml(text(dashboardMetrics.productoMayorValor?.descripcion))}</p>
            <p>${escapeHtml(`Monto S/ ${money(dashboardMetrics.productoMayorValor?.monto || 0)}`)}</p>
          </div>
        </div>
      </section>

      <section class="section">
        <h2>SLA y tiempo por etapa</h2>
        <p class="lead">Cada etapa muestra ingreso, salida estimada por secuencia de eventos, duracion acumulada y comparacion contra el SLA configurado.</p>
        ${buildHtmlTable(
          ['Etapa', 'Ingreso', 'Salida', 'Tiempo real', 'SLA', 'Cumplimiento', 'Responsables', 'Acciones'],
          stageTableRows
        )}
      </section>

      <section class="section">
        <h2>Detalle economico e items</h2>
        ${buildHtmlTable(
          ['Codigo', 'Descripcion', 'Cantidad', 'Precio', 'Subtotal', 'Incidencia'],
          itemsRows
        )}
      </section>

      <section class="section">
        <h2>Evidencias del expediente</h2>
        ${buildHtmlTable(['Documento', 'Referencia'], evidenceRowsHtml, { compact: true })}
      </section>

      <section class="section">
        <h2>Bitacora del caso</h2>
        ${buildHtmlTable(['Fecha', 'Etapa', 'Usuario', 'Accion', 'Resultado', 'Detalle'], timelineRowsHtml, { compact: true })}
      </section>

      <section class="section">
        <h2>Auditoria tecnica legible</h2>
        <p class="lead">Se ocultan estructuras JSON y se presenta una descripcion legible de cada movimiento tecnico.</p>
        ${buildHtmlTable(['Fecha', 'Etapa', 'Usuario', 'Accion', 'Resultado', 'Detalle'], auditRowsHtml, { compact: true })}
      </section>

      <div class="foot">Documento generado automaticamente por el modulo de cierre.</div>
    </div>
  </body>
  </html>`;

  return html;
}

function ensurePageSpace(doc, neededHeight) {
  if (doc.y + neededHeight <= doc.page.height - doc.page.margins.bottom) return;
  doc.addPage();
}

function drawSectionTitle(doc, title, subtitle = '') {
  ensurePageSpace(doc, 42);
  doc.moveDown(0.5);
  doc.font('Helvetica-Bold').fontSize(14).fillColor('#0f4c5c').text(title);
  if (subtitle) {
    doc.moveDown(0.1);
    doc.font('Helvetica').fontSize(8.5).fillColor('#64748b').text(subtitle);
  }
  doc.moveDown(0.35);
}

function drawHeaderBand(doc, report) {
  const { cobro, generatedAt, summaryMetrics } = report;
  const x = doc.page.margins.left;
  const y = doc.y;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const height = 82;

  doc.save();
  doc.roundedRect(x, y, width, height, 16).fill('#0f4c5c');
  doc.roundedRect(x + 360, y + 14, width - 376, 54, 14).fillOpacity(0.14).fill('#ffffff').fillOpacity(1);
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(20).text('Reporte ejecutivo de cierre', x + 20, y + 16);
  doc.font('Helvetica').fontSize(9).fillColor('#dbeafe')
    .text(`Cobro ${text(cobro.id)} | ${normalizeEstado(cobro.estado)} | ${normalizeEtapa(cobro.etapa)}`, x + 20, y + 42)
    .text(`Generado: ${generatedAt}`, x + 20, y + 56);
  doc.font('Helvetica-Bold').fontSize(12).fillColor('#ffffff').text(formatDurationHours(summaryMetrics.cycleHours), x + 382, y + 24, {
    width: 180,
    align: 'center'
  });
  doc.font('Helvetica').fontSize(8.5).fillColor('#dbeafe').text('Tiempo total estimado del caso', x + 382, y + 44, {
    width: 180,
    align: 'center'
  });
  doc.restore();
  doc.y = y + height + 12;
}

function drawKpiCards(doc, cards) {
  const items = Array.isArray(cards) ? cards.filter(Boolean) : [];
  if (!items.length) return;
  const startX = doc.page.margins.left;
  const gap = 12;
  const columns = 3;
  const totalWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const cardWidth = (totalWidth - gap * (columns - 1)) / columns;
  const cardHeight = 62;
  ensurePageSpace(doc, Math.ceil(items.length / columns) * (cardHeight + gap) + 4);
  const startY = doc.y;

  items.forEach((card, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = startX + column * (cardWidth + gap);
    const y = startY + row * (cardHeight + gap);

    doc.save();
    doc.roundedRect(x, y, cardWidth, cardHeight, 14).fill('#f8fafc');
    doc.roundedRect(x, y, cardWidth, cardHeight, 14).strokeColor('#d9e2ec').lineWidth(1).stroke();
    doc.font('Helvetica').fontSize(8).fillColor('#64748b').text(card.label, x + 12, y + 10, { width: cardWidth - 24 });
    doc.font('Helvetica-Bold').fontSize(16).fillColor('#0f4c5c').text(card.value, x + 12, y + 26, { width: cardWidth - 24 });
    if (card.note) {
      doc.font('Helvetica').fontSize(7.6).fillColor('#64748b').text(card.note, x + 12, y + 46, { width: cardWidth - 24 });
    }
    doc.restore();
  });

  doc.y = startY + Math.ceil(items.length / columns) * (cardHeight + gap) + 4;
}

function drawMetricBars(doc, bars) {
  const items = Array.isArray(bars) ? bars.filter(Boolean) : [];
  if (!items.length) return;
  const startX = doc.page.margins.left;
  const totalWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const leftWidth = 220;
  const barWidth = totalWidth - leftWidth - 70;
  const rowHeight = 28;

  drawSectionTitle(doc, 'Charts y semaforos', 'Visual de cumplimiento, avance y referencia operativa del proceso.');
  ensurePageSpace(doc, items.length * rowHeight + 8);
  const startY = doc.y;
  items.forEach((bar, index) => {
    const y = startY + index * rowHeight;
    const pct = Math.max(0, Math.min(100, Number(bar.percent || 0)));
    const fillWidth = Math.max(8, (barWidth * pct) / 100);

    doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#334155').text(bar.label, startX, y + 3, { width: leftWidth - 10 });
    doc.roundedRect(startX + leftWidth, y + 2, barWidth, 14, 7).fill('#e5edf5');
    doc.roundedRect(startX + leftWidth, y + 2, fillWidth, 14, 7).fill(bar.color || '#0f766e');
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#0f172a').text(bar.value, startX + leftWidth + barWidth + 10, y + 2, {
      width: 56,
      align: 'right'
    });
    if (bar.note) {
      doc.font('Helvetica').fontSize(7.4).fillColor('#64748b').text(bar.note, startX, y + 18, { width: totalWidth });
    }
  });
  doc.y = startY + items.length * rowHeight + 6;
}

function drawKeyValueGrid(doc, rows) {
  const items = Array.isArray(rows) ? rows.filter((row) => Array.isArray(row) && row.length >= 2) : [];
  if (!items.length) return;
  const startX = doc.page.margins.left;
  const totalWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const cols = 2;
  const gap = 14;
  const cardWidth = (totalWidth - gap) / cols;
  const rowHeight = 20;
  ensurePageSpace(doc, Math.ceil(items.length / cols) * rowHeight + 8);
  const startY = doc.y;

  items.forEach((row, index) => {
    const col = index % cols;
    const line = Math.floor(index / cols);
    const x = startX + col * (cardWidth + gap);
    const y = startY + line * rowHeight;
    doc.font('Helvetica-Bold').fontSize(8.4).fillColor('#334155').text(`${row[0]}:`, x, y, { width: 120 });
    doc.font('Helvetica').fontSize(8.4).fillColor('#0f172a').text(text(row[1]), x + 122, y, { width: cardWidth - 122 });
  });

  doc.y = startY + Math.ceil(items.length / cols) * rowHeight + 8;
}

function measureTableRowHeight(doc, row, widths, fontSize, minHeight) {
  let maxHeight = minHeight;
  row.forEach((cell, idx) => {
    const content = text(cell);
    const measured = doc.heightOfString(content, {
      width: Math.max(18, widths[idx] - 12),
      align: 'left'
    }) + 12;
    if (measured > maxHeight) maxHeight = measured;
  });
  return Math.max(minHeight, maxHeight);
}

function drawTable(doc, { headers, rows, widths, rowHeight = 22, headerHeight = 24, fontSize = 8, title = '' }) {
  if (title) drawSectionTitle(doc, title);
  const startX = doc.page.margins.left;
  const totalWidth = widths.reduce((acc, value) => acc + value, 0);
  const bodyRows = rows.length ? rows : [new Array(headers.length).fill('Sin datos')];

  ensurePageSpace(doc, headerHeight + rowHeight * Math.min(6, bodyRows.length + 1));

  const drawHeader = () => {
    const topY = doc.y;
    let x = startX;
    doc.save();
    headers.forEach((header, idx) => {
      doc.rect(x, topY, widths[idx], headerHeight).fill('#e8f3f6');
      doc.rect(x, topY, widths[idx], headerHeight).strokeColor('#cbd5e1').lineWidth(0.6).stroke();
      doc.font('Helvetica-Bold').fontSize(fontSize).fillColor('#0f4c5c').text(header, x + 6, topY + 7, {
        width: widths[idx] - 12
      });
      x += widths[idx];
    });
    doc.restore();
    doc.y = topY + headerHeight;
  };

  drawHeader();

  bodyRows.forEach((row, index) => {
    const dynamicHeight = measureTableRowHeight(doc, row, widths, fontSize, rowHeight);
    if (doc.y + dynamicHeight > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      drawHeader();
    }
    const topY = doc.y;
    let x = startX;
    row.forEach((cell, idx) => {
      const bg = index % 2 === 0 ? '#ffffff' : '#f8fafc';
      doc.save();
      doc.rect(x, topY, widths[idx], dynamicHeight).fill(bg);
      doc.rect(x, topY, widths[idx], dynamicHeight).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
      doc.font('Helvetica').fontSize(fontSize).fillColor('#1e293b').text(text(cell), x + 6, topY + 6, {
        width: widths[idx] - 12,
        height: dynamicHeight - 8
      });
      doc.restore();
      x += widths[idx];
    });
    doc.y = topY + dynamicHeight;
  });

  doc.y += 8;
  doc.x = startX;
  if (totalWidth > 0) {
    doc.moveTo(startX, doc.y).lineTo(startX + totalWidth, doc.y).strokeColor('#ffffff').stroke();
  }
}

function hasRows(rows) {
  return Array.isArray(rows) && rows.length > 0;
}

async function buildClosurePdfBuffer(report) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 28 });
    const buffers = [];
    doc.on('data', (chunk) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    const {
      cobro,
      flowData,
      items,
      timelineRows,
      auditFriendlyRows,
      stageRows,
      evidenceRows,
      summaryMetrics,
      dashboardMetrics
    } = report;
    const grouped = flowData?.groupedPayment || null;

    drawHeaderBand(doc, report);
    drawSectionTitle(doc, 'Metricas principales', 'Indicadores del caso y referencia operativa del dashboard.');
    drawKpiCards(doc, [
      { label: 'Monto total', value: `S/ ${money(cobro.total_cobro)}` },
      { label: 'Tiempo total', value: formatDurationHours(summaryMetrics.cycleHours) },
      { label: 'Cumplimiento SLA', value: formatPercent(summaryMetrics.slaCompliancePct) },
      { label: 'SLA vencidos', value: String(dashboardMetrics.slaVencidos || 0), note: 'Referencia global del dashboard' },
      { label: 'Cierre promedio', value: formatHoursValue(dashboardMetrics.tiempoCierrePromedioHoras || 0) },
      { label: 'Etapas recorridas', value: String(summaryMetrics.visitedStages || 0) }
    ]);
    drawMetricBars(doc, [
      {
        label: 'Cumplimiento SLA del caso',
        percent: summaryMetrics.slaCompliancePct,
        value: formatPercent(summaryMetrics.slaCompliancePct),
        color: '#0f766e',
        note: `${summaryMetrics.visitedStages || 0} etapas recorridas en el caso`
      },
      {
        label: 'Avance promedio del dashboard',
        percent: dashboardMetrics.avancePromedio || 0,
        value: formatPercent(dashboardMetrics.avancePromedio || 0),
        color: '#0f4c5c',
        note: 'Referencia general del proceso en el dashboard'
      },
      {
        label: 'Avance a cierre del dashboard',
        percent: dashboardMetrics.avanceCierre || 0,
        value: formatPercent(dashboardMetrics.avanceCierre || 0),
        color: '#c97f35',
        note: `Cierre promedio global ${formatHoursValue(dashboardMetrics.tiempoCierrePromedioHoras || 0)}`
      }
    ]);

    drawSectionTitle(doc, 'Resumen ejecutivo');
    drawKeyValueGrid(doc, [
      ['Proveedor', cobro.proveedor_nombre],
      ['Codigo proveedor', cobro.proveedor_codigo],
      ['Responsable final', flowData?.areaResponsableActual || cobro.area_responsable_actual || cobro.responsable],
      ['Pais', `${text(cobro.country_code, '')} ${text(cobro.country_name, '')}`.trim()],
      ['Ruta', cobro.ruta],
      ['Unidad', cobro.unidad],
      ['Bodega', cobro.bodega],
      ['Operacion de pago', flowData?.debitoRef || grouped?.operationNumber || ''],
      ['Monto de pago', flowData?.montoPago ? `S/ ${money(flowData.montoPago)}` : '-'],
      ['Aplicacion de pago', flowData?.facturasDebitar || grouped?.applicationReference || '-'],
      ['SLA actual', summaryMetrics.currentSlaLabel],
      ['Limite SLA actual', summaryMetrics.currentStageLimit]
    ]);

    const stageTableData = stageRows.map((row) => [
      row.etapa,
      formatDateTime(row.ingresoAt),
      formatDateTime(row.salidaAt),
      row.durationLabel,
      row.slaLabel,
      row.slaEstado,
      String(row.acciones || 0)
    ]);
    if (hasRows(stageTableData)) {
      drawTable(doc, {
        title: 'SLA y tiempo por etapa',
        headers: ['Etapa', 'Ingreso', 'Salida', 'Tiempo real', 'SLA', 'Cumplimiento', 'Acc.'],
        widths: [168, 95, 95, 84, 62, 88, 40],
        rowHeight: 24,
        fontSize: 7.6,
        rows: stageTableData
      });
    }

    const itemTableData = (items || []).map((item) => [
      text(item.codigo),
      clipText(item.descripcion, 58),
      String(Number(item.cantidad || item.cajas || 0)),
      `S/ ${money(item.precio || 0)}`,
      `S/ ${money(item.subtotal || 0)}`,
      text(item.incidencia || 'Conforme')
    ]);
    if (hasRows(itemTableData)) {
      drawTable(doc, {
        title: 'Items del cobro',
        headers: ['Codigo', 'Descripcion', 'Cant.', 'Precio', 'Subtotal', 'Incidencia'],
        widths: [80, 280, 48, 78, 86, 150],
        rowHeight: 24,
        fontSize: 7.8,
        rows: itemTableData
      });
    }

    const evidenceTableData = evidenceRows.map((row) => [row.label, clipText(row.url, 110)]);
    if (hasRows(evidenceTableData)) {
      drawTable(doc, {
        title: 'Evidencias',
        headers: ['Documento', 'Referencia'],
        widths: [150, 572],
        rowHeight: 24,
        fontSize: 7.6,
        rows: evidenceTableData
      });
    }

    const timelineTableData = timelineRows.map((row) => [
      row.fecha,
      row.etapa,
      row.usuario,
      clipText(row.accion, 28),
      row.resultado,
      clipText(row.detalle, 62)
    ]);
    if (hasRows(timelineTableData)) {
      drawTable(doc, {
        title: 'Bitacora del caso',
        headers: ['Fecha', 'Etapa', 'Usuario', 'Accion', 'Resultado', 'Detalle'],
        widths: [92, 116, 104, 134, 74, 202],
        rowHeight: 26,
        fontSize: 7.1,
        rows: timelineTableData
      });
    }

    const auditTableData = auditFriendlyRows.map((row) => [
      row.fecha,
      row.etapa,
      row.usuario,
      clipText(row.accion, 28),
      row.resultado,
      clipText(row.detalle, 62)
    ]);
    if (hasRows(auditTableData)) {
      drawTable(doc, {
        title: 'Auditoria tecnica legible',
        headers: ['Fecha', 'Etapa', 'Usuario', 'Accion', 'Resultado', 'Detalle'],
        widths: [92, 116, 104, 134, 74, 202],
        rowHeight: 26,
        fontSize: 7.1,
        rows: auditTableData
      });
    }

    doc.end();
  });
}

async function loadStageSlaMap() {
  const map = new Map();
  const runtime = getGasRuntime();

  try {
    const legacyRows = runtime.call('getCfgStageSla_', []);
    if (Array.isArray(legacyRows) && legacyRows.length) {
      legacyRows.forEach((row) => {
        const stageOrder = Number(row?.stageOrder || 0);
        if (!stageOrder) return;
        map.set(stageOrder, {
          stageOrder,
          stageName: text(row?.stageName, ETAPAS_COBRO[stageOrder - 1] || ''),
          slaHours: Math.max(0, Number(row?.slaHours || 0)),
          active: Boolean(row?.active)
        });
      });
      return map;
    }
  } catch {
    // Fallback a Supabase para entornos donde aun no exista la config legacy.
  }

  const { data, error } = await supabaseAdmin
    .from('ct_cfg_stage_sla')
    .select('process_key,stage_order,stage_name,sla_hours,activo')
    .order('stage_order', { ascending: true });
  if (error) throw createError(500, error.message);

  (data || []).forEach((row) => {
    const stageOrder = Number(row.stage_order || 0);
    if (!stageOrder) return;
    const processKey = String(row.process_key || PROCESS_KEY).trim().toLowerCase();
    if (processKey && processKey !== PROCESS_KEY) return;
    map.set(stageOrder, {
      stageOrder,
      stageName: text(row.stage_name, ETAPAS_COBRO[stageOrder - 1] || ''),
      slaHours: Math.max(0, Number(row.sla_hours || 0)),
      active: Boolean(row.activo)
    });
  });
  return map;
}

async function loadReportContext({ cobroId, actorEmail, req }) {
  const actor = await getUserProfileByEmail(actorEmail);
  if (!actor) throw createError(401, 'Usuario no autorizado.');

  const { data: cobro, error: cobroErr } = await supabaseAdmin
    .from('ct_cobros')
    .select('*')
    .eq('id', cobroId)
    .maybeSingle();
  if (cobroErr) throw createError(500, cobroErr.message);
  if (!cobro) throw createError(404, 'Cobro no encontrado.');

  const actorCountry = String(actor.country_code || '').trim().toUpperCase();
  const cobroCountry = String(cobro.country_code || '').trim().toUpperCase();
  if (actorCountry && cobroCountry && actorCountry !== cobroCountry) {
    throw createError(403, `No tiene acceso a este cobro fuera del entorno ${actorCountry}.`);
  }

  const { data: items, error: itemsErr } = await supabaseAdmin
    .from('ct_cobro_items')
    .select('*')
    .eq('cobro_id', cobroId)
    .order('id', { ascending: true });
  if (itemsErr) throw createError(500, itemsErr.message);

  const flowData = await executeLegacySpecial('getCobroFlowData', [cobroId, actorEmail], { req });
  if (!flowData || flowData.success === false) {
    throw createError(400, flowData?.message || 'No se pudo cargar el flujo del cobro.');
  }
  if (!canGenerateClosureReport(cobro, flowData)) {
    throw createError(400, 'El reporte de cierre solo esta disponible cuando el cobro esta cerrado o ya tiene aplicacion de pago registrada.');
  }

  const runtime = getGasRuntime();
  const [timelineDesc, dashboardStats, stageSlaMap, auditResult] = await Promise.all([
    Promise.resolve(runtime.call('getCobroTimeline', [cobroId, 500, actorEmail]) || []),
    executeLegacySpecial('getDashboardStats', [actorEmail], { req }),
    loadStageSlaMap(),
    supabaseAdmin
      .from('ct_audit_log')
      .select('created_at,usuario,etapa,accion,resultado,detalle')
      .eq('cobro_id', cobroId)
      .order('created_at', { ascending: true })
  ]);
  if (auditResult.error) throw createError(500, auditResult.error.message);

  const generatedAt = formatDateTime(new Date().toISOString());
  const timelineRows = buildTimelineRows(Array.isArray(timelineDesc) ? timelineDesc.slice().reverse() : []);
  const auditFriendlyRows = buildAuditRows(auditResult.data || []);
  const stageRows = buildStageMetrics(timelineRows, cobro, stageSlaMap);
  const dashboardMetrics = buildDashboardMetrics(dashboardStats || {});
  const evidenceRows = buildEvidenceRows(cobro, flowData);
  const summaryMetrics = buildSummaryMetrics({
    cobro,
    flowData,
    stageRows,
    dashboardMetrics,
    timelineRows,
    stageSlaMap
  });

  return {
    actorEmail,
    cobro,
    items: items || [],
    flowData,
    timelineRows,
    auditFriendlyRows,
    stageRows,
    stageSlaMap,
    dashboardMetrics,
    dashboardStats,
    evidenceRows,
    summaryMetrics,
    generatedAt
  };
}

export async function generateClosureReportModule({ cobroId, actorEmail, req }) {
  const id = String(cobroId || '').trim();
  const email = String(actorEmail || '').trim().toLowerCase();
  if (!id) throw createError(400, 'ID requerido.');
  if (!email) throw createError(400, 'Correo requerido.');

  const report = await loadReportContext({ cobroId: id, actorEmail: email, req });
  const folderPrefix = inferReportFolder(report.cobro);
  const stamp = formatStamp(Date.now());
  const baseName = `Reporte_Cierre_${slug(report.cobro.id || id) || 'cobro'}_${stamp}`;
  const pdfPath = `${folderPrefix}/${baseName}.pdf`;
  const excelPath = `${folderPrefix}/${baseName}.xls`;

  const [pdfBuffer, excelHtml] = await Promise.all([
    buildClosurePdfBuffer(report),
    Promise.resolve(buildReportHtml(report))
  ]);
  const excelBuffer = Buffer.from(`\ufeff${excelHtml}`, 'utf8');

  await uploadStorageObject(pdfPath, pdfBuffer, 'application/pdf');
  await uploadStorageObject(excelPath, excelBuffer, 'application/vnd.ms-excel');

  await supabaseAdmin.from('ct_audit_log').insert({
    cobro_id: id,
    usuario: email,
    etapa: report.flowData?.etapa || report.cobro.etapa || '',
    accion: 'Reporte de cierre generado',
    resultado: 'OK',
    detalle: JSON.stringify({
      pdfUrl: buildAppFileUrl(pdfPath, req),
      excelUrl: buildAppFileUrl(excelPath, req),
      generatedAt: new Date().toISOString()
    })
  });

  return {
    success: true,
    cobroId: id,
    generatedAt: report.generatedAt,
    stageSlaCount: report.stageSlaMap instanceof Map ? report.stageSlaMap.size : 0,
    currentSlaLabel: report.summaryMetrics?.currentSlaLabel || '-',
    pdfUrl: buildAppFileUrl(pdfPath, req),
    excelUrl: buildAppFileUrl(excelPath, req),
    pdfFileName: `${baseName}.pdf`,
    excelFileName: `${baseName}.xls`
  };
}
