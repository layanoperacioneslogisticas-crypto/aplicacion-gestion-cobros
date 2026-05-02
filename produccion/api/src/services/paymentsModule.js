import { supabaseAdmin } from './supabase.js';
import { getGasRuntime } from '../gas/runtime.js';
import {
  LEGACY_ROOT_PREFIX,
  buildAppFileUrl,
  formatStamp,
  sanitizeUploadName,
  uploadStorageObject
} from './legacyFiles.js';

const PAYMENT_STAGE = '10. Aplicación de pago';
const PAYMENT_STATUS = 'Registrado';
const PAYMENT_AREA = 'Creditos y Cobros';
const PAYMENT_AUDIT_ACTION = 'Pago agrupado asociado';

function createError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function runtimeProfile(actorEmail) {
  const runtime = getGasRuntime();
  const profile = runtime.call('getUserProfile_', [String(actorEmail || '').trim()]);
  if (!profile?.email) {
    throw createError(401, 'Usuario no autorizado.');
  }
  return profile;
}

function slug(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

function parseDataUrl(raw, fallbackMime) {
  const txt = String(raw || '').trim();
  const match = txt.match(/^data:([^;]+);base64,(.+)$/);
  if (match) {
    return {
      mimeType: String(match[1] || '').trim().toLowerCase(),
      buffer: Buffer.from(String(match[2] || ''), 'base64')
    };
  }
  if (txt && /^[A-Za-z0-9+/=\s]+$/.test(txt)) {
    return {
      mimeType: String(fallbackMime || '').trim().toLowerCase(),
      buffer: Buffer.from(txt.replace(/\s+/g, ''), 'base64')
    };
  }
  return null;
}

function paymentId(operationNumber) {
  const stamp = formatStamp(Date.now());
  const suffix = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `PAG-${slug(operationNumber || 'OP') || 'OP'}-${stamp}-${suffix}`;
}

function parseAmount(value) {
  const n = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
}

function round2(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function sameCountry(profile, row) {
  const actorCountry = String(profile?.countryCode || '').trim().toUpperCase();
  if (!actorCountry) return true;
  return String(row?.country_code || '').trim().toUpperCase() === actorCountry;
}

function canManagePayments(profile) {
  return Boolean(
    profile?.canForce ||
    ['transporte', 'creditos_cobros', 'logistica_inversa'].includes(String(profile?.rol || '').trim())
  );
}

function invalidateCobroSheets() {
  const runtime = getGasRuntime();
  if (!runtime.has('invalidateDataStoreCache_')) return;
  try {
    runtime.call('invalidateDataStoreCache_', ['Aprobaciones']);
    runtime.call('invalidateDataStoreCache_', ['Detalle_Cobros']);
  } catch {
    // Best effort only.
  }
}

function parsePaymentAuditDetail(raw) {
  const txt = String(raw || '').trim();
  if (!txt) return null;
  try {
    const parsed = JSON.parse(txt);
    if (parsed && typeof parsed === 'object' && String(parsed.paymentId || '').trim()) {
      return {
        paymentId: String(parsed.paymentId || '').trim(),
        operationNumber: String(parsed.operationNumber || '').trim(),
        paymentDate: String(parsed.paymentDate || '').trim(),
        totalAmount: round2(parsed.totalAmount || 0),
        notes: String(parsed.notes || '').trim(),
        constanciaPagoUrl: String(parsed.constanciaPagoUrl || '').trim(),
        allocatedAmount: round2(parsed.allocatedAmount || 0),
        cobroCount: Number(parsed.cobroCount || 0)
      };
    }
  } catch {
    // Ignore non-JSON legacy entries.
  }
  return null;
}

async function getAllocationsByCobroIds(cobroIds) {
  const ids = Array.isArray(cobroIds) ? cobroIds.map((id) => String(id || '').trim()).filter(Boolean) : [];
  if (!ids.length) return new Map();

  const { data, error } = await supabaseAdmin
    .from('ct_cobros')
    .select('id,monto_pago')
    .in('id', ids);
  if (error) throw createError(500, error.message);

  const map = new Map();
  (data || []).forEach((row) => {
    const cobroId = String(row?.id || '').trim();
    if (!cobroId) return;
    map.set(cobroId, round2(row?.monto_pago || 0));
  });
  return map;
}

async function getCobrosByIds(cobroIds, profile) {
  const ids = Array.isArray(cobroIds) ? cobroIds.map((id) => String(id || '').trim()).filter(Boolean) : [];
  if (!ids.length) return [];

  const { data, error } = await supabaseAdmin
    .from('ct_cobros')
    .select('id,proveedor_nombre,proveedor_codigo,ruta,unidad,total_cobro,estado,etapa,country_code,country_name,constancia_pago_url,debito_ref,monto_pago')
    .in('id', ids);
  if (error) throw createError(500, error.message);

  const rows = (data || []).filter((row) => sameCountry(profile, row));
  if (rows.length !== ids.length) {
    throw createError(403, 'Una o más boletas no están disponibles para este usuario.');
  }
  return rows;
}

async function listPaymentAuditRows(profile) {
  const query = supabaseAdmin
    .from('ct_audit_log')
    .select('cobro_id,detalle,usuario,created_at')
    .eq('accion', PAYMENT_AUDIT_ACTION)
    .order('created_at', { ascending: false })
    .limit(1500);

  const { data, error } = await query;
  if (error) throw createError(500, error.message);

  const rows = Array.isArray(data) ? data : [];
  const cobroIds = Array.from(new Set(rows.map((row) => String(row?.cobro_id || '').trim()).filter(Boolean)));
  if (!cobroIds.length) return [];

  const { data: cobros, error: cobrosErr } = await supabaseAdmin
    .from('ct_cobros')
    .select('id,proveedor_nombre,proveedor_codigo,country_code,country_name')
    .in('id', cobroIds);
  if (cobrosErr) throw createError(500, cobrosErr.message);

  const cobroMap = new Map((cobros || []).map((row) => [String(row?.id || '').trim(), row]));
  return rows
    .map((row) => ({
      ...row,
      ct_cobros: cobroMap.get(String(row?.cobro_id || '').trim()) || null
    }))
    .filter((row) => sameCountry(profile, row?.ct_cobros || {}));
}

export async function listPaymentsModule({ actorEmail, q = '' }) {
  const profile = runtimeProfile(actorEmail);
  if (!canManagePayments(profile)) {
    throw createError(403, 'No tiene permisos para gestionar pagos.');
  }

  const auditRows = await listPaymentAuditRows(profile);
  const grouped = new Map();
  auditRows.forEach((row) => {
    const detail = parsePaymentAuditDetail(row?.detalle);
    if (!detail?.paymentId) return;
    const paymentKey = detail.paymentId;
    const bucket = grouped.get(paymentKey) || {
      id: paymentKey,
      operationNumber: detail.operationNumber,
      paymentDate: detail.paymentDate,
      totalAmount: detail.totalAmount,
      status: PAYMENT_STATUS,
      notes: detail.notes,
      constanciaPagoUrl: detail.constanciaPagoUrl,
      countryCode: String(row?.ct_cobros?.country_code || profile.countryCode || '').trim(),
      countryName: String(row?.ct_cobros?.country_name || profile.countryName || '').trim(),
      createdBy: String(row?.usuario || '').trim(),
      cobroIds: [],
      providerNames: new Set(),
      allocatedAmount: 0,
      createdAt: String(row?.created_at || '').trim()
    };
    const cobroId = String(row?.cobro_id || '').trim();
    if (cobroId && !bucket.cobroIds.includes(cobroId)) {
      bucket.cobroIds.push(cobroId);
    }
    const provider = String(row?.ct_cobros?.proveedor_nombre || '').trim();
    if (provider) bucket.providerNames.add(provider);
    bucket.allocatedAmount = round2(bucket.allocatedAmount + Number(detail.allocatedAmount || 0));
    if (!bucket.paymentDate && detail.paymentDate) bucket.paymentDate = detail.paymentDate;
    if (!bucket.constanciaPagoUrl && detail.constanciaPagoUrl) bucket.constanciaPagoUrl = detail.constanciaPagoUrl;
    if (!bucket.notes && detail.notes) bucket.notes = detail.notes;
    grouped.set(paymentKey, bucket);
  });

  const search = String(q || '').trim().toLowerCase();
  const rows = Array.from(grouped.values())
    .map((row) => ({
      id: row.id,
      operationNumber: row.operationNumber,
      paymentDate: row.paymentDate,
      totalAmount: row.totalAmount,
      status: row.status,
      notes: row.notes,
      constanciaPagoUrl: row.constanciaPagoUrl,
      countryCode: row.countryCode,
      countryName: row.countryName,
      createdBy: row.createdBy,
      cobroCount: row.cobroIds.length,
      allocatedAmount: row.allocatedAmount,
      providerNames: Array.from(row.providerNames),
      cobroIds: row.cobroIds,
      createdAt: row.createdAt
    }))
    .filter((row) => {
      if (!search) return true;
      return [
        row.id,
        row.operationNumber,
        row.paymentDate,
        row.notes,
        row.providerNames.join(' '),
        row.cobroIds.join(' ')
      ].join(' ').toLowerCase().includes(search);
    })
    .sort((a, b) => {
      const aKey = `${a.paymentDate || ''} ${a.createdAt || ''}`.trim();
      const bKey = `${b.paymentDate || ''} ${b.createdAt || ''}`.trim();
      return bKey.localeCompare(aKey);
    });

  return {
    success: true,
    rows
  };
}

export async function listEligiblePaymentCobrosModule({ actorEmail, q = '' }) {
  const profile = runtimeProfile(actorEmail);
  if (!canManagePayments(profile)) {
    throw createError(403, 'No tiene permisos para gestionar pagos.');
  }

  let query = supabaseAdmin
    .from('ct_cobros')
    .select('id,proveedor_nombre,proveedor_codigo,ruta,unidad,total_cobro,estado,etapa,country_code,country_name,monto_pago')
    .in('etapa', ['9. Gestionar pago', '10. Aplicación de pago'])
    .neq('estado', 'Anulado')
    .order('fecha_registro', { ascending: false })
    .limit(250);

  if (profile.countryCode) {
    query = query.eq('country_code', profile.countryCode);
  }

  const { data, error } = await query;
  if (error) throw createError(500, error.message);

  const rows = Array.isArray(data) ? data : [];
  const search = String(q || '').trim().toLowerCase();

  return {
    success: true,
    rows: rows
      .map((row) => {
        const totalCobro = round2(row.total_cobro || 0);
        const allocatedAmount = round2(row.monto_pago || 0);
        const saldoPendiente = round2(Math.max(0, totalCobro - allocatedAmount));
        return {
          id: String(row.id || '').trim(),
          proveedor: String(row.proveedor_nombre || '').trim(),
          proveedorCodigo: String(row.proveedor_codigo || '').trim(),
          ruta: String(row.ruta || '').trim(),
          unidad: String(row.unidad || '').trim(),
          etapa: String(row.etapa || '').trim(),
          estado: String(row.estado || '').trim(),
          totalCobro,
          allocatedAmount,
          saldoPendiente,
          countryCode: String(row.country_code || '').trim(),
          countryName: String(row.country_name || '').trim()
        };
      })
      .filter((row) => row.saldoPendiente > 0)
      .filter((row) => {
        if (!search) return true;
        return [
          row.id,
          row.proveedor,
          row.proveedorCodigo,
          row.ruta,
          row.unidad,
          row.etapa
        ].join(' ').toLowerCase().includes(search);
      })
  };
}

export async function getPaymentDetailModule({ actorEmail, paymentId }) {
  const profile = runtimeProfile(actorEmail);
  if (!canManagePayments(profile)) {
    throw createError(403, 'No tiene permisos para gestionar pagos.');
  }

  const wantedId = String(paymentId || '').trim();
  if (!wantedId) throw createError(400, 'Pago no válido.');

  const auditRows = await listPaymentAuditRows(profile);
  const matching = auditRows.filter((row) => String(parsePaymentAuditDetail(row?.detalle)?.paymentId || '').trim() === wantedId);
  if (!matching.length) throw createError(404, 'Pago no encontrado.');

  const firstDetail = parsePaymentAuditDetail(matching[0]?.detalle);
  const cobroIds = matching.map((row) => String(row?.cobro_id || '').trim()).filter(Boolean);
  const cobros = await getCobrosByIds(cobroIds, profile);
  const cobroMap = new Map(cobros.map((row) => [String(row.id || '').trim(), row]));

  return {
    success: true,
    payment: {
      id: wantedId,
      operationNumber: String(firstDetail?.operationNumber || '').trim(),
      paymentDate: String(firstDetail?.paymentDate || '').trim(),
      totalAmount: round2(firstDetail?.totalAmount || 0),
      status: PAYMENT_STATUS,
      notes: String(firstDetail?.notes || '').trim(),
      constanciaPagoUrl: String(firstDetail?.constanciaPagoUrl || '').trim(),
      countryCode: String(cobros[0]?.country_code || profile.countryCode || '').trim(),
      countryName: String(cobros[0]?.country_name || profile.countryName || '').trim(),
      createdBy: String(matching[0]?.usuario || '').trim()
    },
    cobros: matching.map((row) => {
      const detail = parsePaymentAuditDetail(row?.detalle);
      const cobro = cobroMap.get(String(row?.cobro_id || '').trim()) || {};
      return {
        cobroId: String(row?.cobro_id || '').trim(),
        allocatedAmount: round2(detail?.allocatedAmount || 0),
        proveedor: String(cobro?.proveedor_nombre || '').trim(),
        proveedorCodigo: String(cobro?.proveedor_codigo || '').trim(),
        ruta: String(cobro?.ruta || '').trim(),
        unidad: String(cobro?.unidad || '').trim(),
        estado: String(cobro?.estado || '').trim(),
        etapa: String(cobro?.etapa || '').trim(),
        totalCobro: round2(cobro?.total_cobro || 0)
      };
    })
  };
}

export async function createGroupedPaymentModule({ actorEmail, payment, req }) {
  const profile = runtimeProfile(actorEmail);
  if (!canManagePayments(profile)) {
    throw createError(403, 'No tiene permisos para registrar pagos.');
  }

  const operationNumber = String(payment?.operationNumber || '').trim();
  const paymentDate = String(payment?.paymentDate || '').trim();
  const notes = String(payment?.notes || '').trim();
  const totalAmount = round2(parseAmount(payment?.totalAmount));
  const items = Array.isArray(payment?.items) ? payment.items : [];
  const fileName = String(payment?.fileName || '').trim();
  const mimeType = String(payment?.mimeType || '').trim();
  const dataUrl = String(payment?.dataUrl || '').trim();

  if (!operationNumber) throw createError(400, 'Debe ingresar el número de operación.');
  if (!(totalAmount > 0)) throw createError(400, 'Debe ingresar un monto total válido.');
  if (!paymentDate) throw createError(400, 'Debe ingresar la fecha de pago.');
  if (!items.length) throw createError(400, 'Debe seleccionar al menos una boleta.');

  const parsed = parseDataUrl(dataUrl, mimeType);
  if (!parsed?.buffer?.length) throw createError(400, 'Debe adjuntar la constancia de pago en PDF.');
  if (String(parsed.mimeType || mimeType || '').toLowerCase() !== 'application/pdf') {
    throw createError(400, 'La constancia debe estar en formato PDF.');
  }
  if (parsed.buffer.length > 10 * 1024 * 1024) {
    throw createError(400, 'La constancia supera 10 MB.');
  }

  const normalizedItems = items.map((item) => ({
    cobroId: String(item?.cobroId || '').trim(),
    amount: round2(parseAmount(item?.amount))
  })).filter((item) => item.cobroId);
  if (!normalizedItems.length) throw createError(400, 'No hay boletas válidas seleccionadas.');
  if (normalizedItems.some((item) => !(item.amount > 0))) {
    throw createError(400, 'Cada boleta debe tener un monto mayor a 0.');
  }

  const uniqueCobroIds = Array.from(new Set(normalizedItems.map((item) => item.cobroId)));
  if (uniqueCobroIds.length !== normalizedItems.length) {
    throw createError(400, 'No puede repetir la misma boleta dentro del mismo pago.');
  }

  const cobros = await getCobrosByIds(uniqueCobroIds, profile);
  const allocations = await getAllocationsByCobroIds(uniqueCobroIds);
  const cobroMap = new Map(cobros.map((row) => [String(row.id || '').trim(), row]));

  let allocatedTotal = 0;
  normalizedItems.forEach((item) => {
    const cobro = cobroMap.get(item.cobroId);
    if (!cobro) throw createError(404, `Boleta no encontrada: ${item.cobroId}`);
    const totalCobro = round2(cobro.total_cobro || 0);
    const alreadyAllocated = round2(allocations.get(item.cobroId) || 0);
    const saldoPendiente = round2(Math.max(0, totalCobro - alreadyAllocated));
    if (item.amount - saldoPendiente > 0.009) {
      throw createError(400, `La boleta ${item.cobroId} excede su saldo pendiente.`);
    }
    allocatedTotal = round2(allocatedTotal + item.amount);
  });

  if (Math.abs(allocatedTotal - totalAmount) > 0.009) {
    throw createError(400, 'La suma asignada a las boletas debe coincidir con el monto total del pago.');
  }

  const countryCode = String((cobros[0]?.country_code || profile.countryCode || 'PE')).trim().toUpperCase();
  const newPaymentId = paymentId(operationNumber);
  const folderPrefix = `${LEGACY_ROOT_PREFIX}/Pagos/${countryCode}/${slug(newPaymentId)}`;
  const safeFileName = sanitizeUploadName(fileName, `constancia_${slug(operationNumber) || 'pago'}.pdf`);
  const storagePath = `${folderPrefix}/${safeFileName.toLowerCase().endsWith('.pdf') ? safeFileName : `${safeFileName}.pdf`}`;

  await uploadStorageObject(storagePath, parsed.buffer, 'application/pdf');
  const constanciaPagoUrl = buildAppFileUrl(storagePath, req);

  const nowIso = new Date().toISOString();
  for (const item of normalizedItems) {
    const cobro = cobroMap.get(item.cobroId);
    const updatePayload = {
      debito_ref: operationNumber,
      monto_pago: item.amount,
      constancia_pago_url: constanciaPagoUrl,
      ultima_actualizacion: nowIso
    };
    if (String(cobro?.etapa || '').trim() === '9. Gestionar pago') {
      updatePayload.etapa = PAYMENT_STAGE;
      updatePayload.area_responsable_actual = PAYMENT_AREA;
      updatePayload.fecha_ingreso_etapa_actual = nowIso;
      if (String(cobro?.estado || '').trim() !== 'Observado') {
        updatePayload.estado = 'En proceso';
      }
    }
    const { error: updErr } = await supabaseAdmin.from('ct_cobros').update(updatePayload).eq('id', item.cobroId);
    if (updErr) throw createError(500, updErr.message);

    const auditDetail = JSON.stringify({
      kind: 'grouped_payment',
      paymentId: newPaymentId,
      operationNumber,
      paymentDate,
      totalAmount,
      notes,
      constanciaPagoUrl,
      allocatedAmount: item.amount,
      cobroCount: normalizedItems.length
    });

    await supabaseAdmin.from('ct_audit_log').insert({
      cobro_id: item.cobroId,
      usuario: String(profile.email || 'sistema'),
      etapa: updatePayload.etapa || String(cobro?.etapa || ''),
      accion: PAYMENT_AUDIT_ACTION,
      resultado: 'OK',
      detalle: auditDetail
    });
  }

  invalidateCobroSheets();

  return {
    success: true,
    paymentId: newPaymentId,
    operationNumber,
    constanciaPagoUrl,
    cobroCount: normalizedItems.length
  };
}
