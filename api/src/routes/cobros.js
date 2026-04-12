import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { supabaseAdmin } from '../services/supabase.js';

export const cobrosRouter = Router();

cobrosRouter.use(requireAuth);

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
  '10. Aplicación de pago'
];

function normalizeEtapa(raw) {
  const v = String(raw || '').trim();
  if (!v) return ETAPAS_COBRO[0];
  if (ETAPAS_COBRO.includes(v)) return v;
  const low = v.toLowerCase();
  if (low.includes('aplicar debitacion')) return ETAPAS_COBRO[ETAPAS_COBRO.length - 1];
  const m = v.match(/^(\d+)\./);
  if (m) {
    const n = Number(m[1]);
    if (n >= 1 && n <= ETAPAS_COBRO.length) return ETAPAS_COBRO[n - 1];
  }
  return ETAPAS_COBRO[0];
}

function etapaIndex(etapa) {
  const idx = ETAPAS_COBRO.indexOf(normalizeEtapa(etapa));
  return idx >= 0 ? idx + 1 : 1;
}

function normalizeEstado(raw) {
  const v = String(raw || '').trim();
  if (!v) return 'Abierto';
  const low = v.toLowerCase();
  if (low.includes('anulad')) return 'Anulado';
  if (low.includes('observ')) return 'Observado';
  if (low.includes('firma')) return 'En firma';
  if (low.includes('abier')) return 'Abierto';
  if (low.includes('proceso') || low.includes('pend') || low.includes('aprob')) return 'En proceso';
  if (low.includes('rech')) return 'Observado';
  if (low.includes('cerr') || low.includes('debit') || low.includes('liquid')) return 'Cerrado';
  if (low === 'registrado') return 'Abierto';
  return v;
}

function macroEstadoPorEtapaIdx(idx) {
  if (idx <= 1) return 'Abierto';
  if (idx === 2 || idx === 7) return 'En firma';
  if (idx > ETAPAS_COBRO.length) return 'Cerrado';
  return 'En proceso';
}

function areaResponsablePorEtapa(idx) {
  if (idx === 1) return 'Logistica Inversa';
  if (idx === 2) return 'Proveedor (seguimiento Transporte)';
  if (idx === 3) return 'Inventario';
  if (idx === 4) return 'Creditos y Cobros';
  if (idx === 5) return 'Transporte';
  if (idx === 6) return 'Facturacion';
  if (idx === 7) return 'Proveedor (seguimiento Transporte)';
  if (idx === 8) return 'Creditos y Cobros';
  if (idx === 9) return 'Transporte';
  if (idx === 10) return 'Creditos y Cobros';
  return 'Logistica Inversa';
}

function transitionRuleAreas(fromIdx, toIdx) {
  const key = `${fromIdx}>${toIdx}`;
  const map = {
    '1>2': ['logisticainversa'],
    '2>3': ['transporte'],
    '3>4': ['inventario'],
    '4>5': ['creditosycobros'],
    '5>6': ['transporte'],
    '6>7': ['facturacion'],
    '7>8': ['transporte'],
    '8>9': ['creditosycobros'],
    '9>10': ['transporte']
  };
  return map[key] || [];
}

function canMoveTransition(profile, fromIdx, toIdx) {
  if (profile && profile.canForce) return { ok: true };
  const allowed = transitionRuleAreas(fromIdx, toIdx);
  if (!allowed.length) return { ok: false, message: `Transicion no permitida: ${fromIdx} -> ${toIdx}.` };
  if (allowed.includes(profile.areaKey)) return { ok: true };
  return { ok: false, message: `No tiene permisos para mover ${fromIdx} -> ${toIdx}.` };
}

function canEditField(profile, fieldName) {
  if (profile && profile.canForce) return true;
  const key = String(fieldName || '').toLowerCase();
  const editableByArea = {
    transporte: ['boleta_firmada_url', 'firma_boleta_url', 'firma_factura_url', 'ruta_id', 'constancia_pago_url', 'motivo_observacion'],
    inventario: ['inventario_status', 'comentario_inventario', 'motivo_observacion'],
    creditosycobros: ['ov_numero', 'liquidacion_ref', 'facturas_debitar', 'motivo_observacion'],
    facturacion: ['factura_numero', 'factura_url', 'firma_factura_link', 'motivo_observacion'],
    contabilidad: ['motivo_observacion']
  };
  const list = editableByArea[profile.areaKey] || [];
  return list.includes(key);
}

function validateStageRequirements(targetIdx, row) {
  const pdf = String(row.pdf_url || '').trim();
  const boletaFirmada = String(row.boleta_firmada_url || row.firma_boleta_url || '').trim();
  const inventarioStatus = String(row.inventario_status || '').trim();
  const ovNumero = String(row.ov_numero || '').trim();
  const rutaId = String(row.ruta_id || '').trim();
  const facturaNumero = String(row.factura_numero || '').trim();
  const facturaUrl = String(row.factura_url || '').trim();
  const firmaFactura = String(row.firma_factura_url || '').trim();
  const liquidacionRef = String(row.liquidacion_ref || '').trim();
  const constanciaPagoUrl = String(row.constancia_pago_url || '').trim();

  if (targetIdx === 2 && !pdf) return { ok: false, message: 'No puede avanzar a etapa 2 sin PDF.' };
  if (targetIdx === 3 && !boletaFirmada) return { ok: false, message: 'No puede avanzar a etapa 3 sin BoletaFirmadaUrl (PDF firmado).' };
  if (targetIdx === 4 && !inventarioStatus) return { ok: false, message: 'No puede avanzar a etapa 4 sin InventarioStatus.' };
  if (targetIdx === 5 && !ovNumero) return { ok: false, message: 'No puede avanzar a etapa 5 sin OV_Numero.' };
  if (targetIdx === 6 && !rutaId) return { ok: false, message: 'No puede avanzar a etapa 6 sin RutaId/evidencia.' };
  if (targetIdx === 7 && !facturaUrl && !facturaNumero) return { ok: false, message: 'No puede avanzar a etapa 7 sin FacturaUrl o FacturaNumero.' };
  if (targetIdx === 8 && !firmaFactura) return { ok: false, message: 'No puede avanzar a etapa 8 sin FirmaFacturaUrl.' };
  if (targetIdx === 9 && !liquidacionRef) return { ok: false, message: 'No puede avanzar a etapa 9 sin la referencia de liquidación.' };
  if (targetIdx === 10 && !constanciaPagoUrl) return { ok: false, message: 'No puede avanzar a etapa 10 sin constancia de pago.' };
  return { ok: true };
}

cobrosRouter.get('/', async (req, res) => {
  const limit = Math.min(200, Math.max(1, Number(req.query.limit || 60)));
  const offset = Math.max(0, Number(req.query.offset || 0));
  const estado = String(req.query.estado || '').trim();
  const etapa = String(req.query.etapa || '').trim();
  const q = String(req.query.q || '').trim();
  const desde = String(req.query.desde || '').trim();
  const hasta = String(req.query.hasta || '').trim();
  const profile = req.profile || {};

  let query = supabaseAdmin
    .from('ct_cobros')
    .select(
      [
        'id',
        'fecha_registro',
        'proveedor_nombre',
        'proveedor_codigo',
        'unidad',
        'ruta',
        'c9',
        'factura_ref',
        'total_cobro',
        'estado',
        'responsable',
        'piloto_nombre',
        'etapa',
        'ultima_actualizacion',
        'bodega',
        'licencia',
        'pdf_url',
        'area_responsable_actual',
        'country_code',
        'country_name'
      ].join(','),
      { count: 'exact' }
    )
    .order('fecha_registro', { ascending: false })
    .range(offset, offset + limit - 1);

  if (profile.countryCode) {
    query = query.eq('country_code', profile.countryCode);
  }
  if (estado) query = query.eq('estado', estado);
  if (etapa) query = query.eq('etapa', etapa);
  if (desde) query = query.gte('fecha_registro', `${desde}T00:00:00`);
  if (hasta) query = query.lte('fecha_registro', `${hasta}T23:59:59`);
  if (q) {
    const pattern = `%${q}%`;
    query = query.or(
      [
        `id.ilike.${pattern}`,
        `proveedor_nombre.ilike.${pattern}`,
        `proveedor_codigo.ilike.${pattern}`,
        `ruta.ilike.${pattern}`,
        `unidad.ilike.${pattern}`
      ].join(',')
    );
  }

  const { data, error, count } = await query;
  if (error) return res.status(500).json({ success: false, message: error.message });
  res.json({ success: true, rows: data || [], total: count || 0, limit, offset });
});

cobrosRouter.get('/:id', async (req, res) => {
  const id = String(req.params.id || '').trim();
  if (!id) return res.status(400).json({ success: false, message: 'ID requerido.' });

  const { data: cobro, error } = await supabaseAdmin
    .from('ct_cobros')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) return res.status(500).json({ success: false, message: error.message });
  if (!cobro) return res.status(404).json({ success: false, message: 'Cobro no encontrado.' });

  const profile = req.profile || {};
  if (profile.countryCode && String(cobro.country_code || '').toUpperCase() !== profile.countryCode) {
    return res.status(403).json({ success: false, message: `No tiene acceso a este cobro fuera del entorno ${profile.countryCode}.` });
  }

  const { data: items, error: itemsErr } = await supabaseAdmin
    .from('ct_cobro_items')
    .select('*')
    .eq('cobro_id', id)
    .order('id', { ascending: true });
  if (itemsErr) return res.status(500).json({ success: false, message: itemsErr.message });

  res.json({ success: true, cobro, items: items || [] });
});

cobrosRouter.post('/:id/etapa', async (req, res) => {
  const id = String(req.params.id || '').trim();
  const targetEtapa = normalizeEtapa(req.body && req.body.etapa);
  if (!id) return res.status(400).json({ success: false, message: 'ID requerido.' });
  if (!targetEtapa) return res.status(400).json({ success: false, message: 'Etapa requerida.' });

  const { data: cobro, error } = await supabaseAdmin
    .from('ct_cobros')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) return res.status(500).json({ success: false, message: error.message });
  if (!cobro) return res.status(404).json({ success: false, message: 'Cobro no encontrado.' });

  const profile = req.profile || {};
  if (profile.countryCode && String(cobro.country_code || '').toUpperCase() !== profile.countryCode) {
    return res.status(403).json({ success: false, message: `No tiene acceso a este cobro fuera del entorno ${profile.countryCode}.` });
  }

  const fromEtapa = normalizeEtapa(cobro.etapa);
  const fromIdx = etapaIndex(fromEtapa);
  const toIdx = etapaIndex(targetEtapa);
  if (toIdx === fromIdx) {
    return res.json({ success: true, cobro, message: 'La etapa ya estaba asignada.' });
  }

  const transitionCheck = canMoveTransition(profile, fromIdx, toIdx);
  if (!transitionCheck.ok) {
    return res.status(403).json({ success: false, message: transitionCheck.message });
  }

  const reqCheck = validateStageRequirements(toIdx, cobro);
  if (!reqCheck.ok) {
    return res.status(400).json({ success: false, message: reqCheck.message });
  }

  const nextEstado = normalizeEstado(cobro.estado);
  const estado = nextEstado === 'Observado' || nextEstado === 'Anulado'
    ? nextEstado
    : macroEstadoPorEtapaIdx(toIdx);

  const updatePayload = {
    etapa: targetEtapa,
    etapa_anterior: fromEtapa,
    estado: estado,
    ultima_actualizacion: new Date().toISOString(),
    area_responsable_actual: areaResponsablePorEtapa(toIdx),
    fecha_ingreso_etapa_actual: new Date().toISOString()
  };

  const { data: updated, error: updErr } = await supabaseAdmin
    .from('ct_cobros')
    .update(updatePayload)
    .eq('id', id)
    .select('*')
    .maybeSingle();
  if (updErr) return res.status(500).json({ success: false, message: updErr.message });

  await supabaseAdmin.from('ct_audit_log').insert({
    cobro_id: id,
    usuario: profile.email || req.user?.email || 'sistema',
    etapa: targetEtapa,
    accion: `Cambio de etapa ${fromIdx} -> ${toIdx}`,
    resultado: 'OK',
    detalle: `Etapa actualizada por ${profile.email || req.user?.email || 'sistema'}`
  });

  res.json({ success: true, cobro: updated });
});

cobrosRouter.patch('/:id/campos', async (req, res) => {
  const id = String(req.params.id || '').trim();
  if (!id) return res.status(400).json({ success: false, message: 'ID requerido.' });

  const { data: cobro, error } = await supabaseAdmin
    .from('ct_cobros')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) return res.status(500).json({ success: false, message: error.message });
  if (!cobro) return res.status(404).json({ success: false, message: 'Cobro no encontrado.' });

  const profile = req.profile || {};
  if (profile.countryCode && String(cobro.country_code || '').toUpperCase() !== profile.countryCode) {
    return res.status(403).json({ success: false, message: `No tiene acceso a este cobro fuera del entorno ${profile.countryCode}.` });
  }

  const allowedFields = [
    'boleta_firmada_url',
    'firma_boleta_url',
    'inventario_status',
    'comentario_inventario',
    'ov_numero',
    'ruta_id',
    'factura_numero',
    'factura_url',
    'firma_factura_url',
    'liquidacion_ref',
    'constancia_pago_url',
    'facturas_debitar',
    'debito_ref',
    'rm_numero',
    'motivo_observacion',
    'observaciones',
    'pdf_url'
  ];

  const payload = {};
  for (const key of allowedFields) {
    if (req.body && Object.prototype.hasOwnProperty.call(req.body, key)) {
      if (!canEditField(profile, key)) {
        return res.status(403).json({ success: false, message: `No tiene permisos para editar ${key}.` });
      }
      payload[key] = req.body[key];
    }
  }

  if (!Object.keys(payload).length) {
    return res.status(400).json({ success: false, message: 'No hay campos válidos para actualizar.' });
  }

  payload.ultima_actualizacion = new Date().toISOString();

  const { data: updated, error: updErr } = await supabaseAdmin
    .from('ct_cobros')
    .update(payload)
    .eq('id', id)
    .select('*')
    .maybeSingle();
  if (updErr) return res.status(500).json({ success: false, message: updErr.message });

  await supabaseAdmin.from('ct_audit_log').insert({
    cobro_id: id,
    usuario: profile.email || req.user?.email || 'sistema',
    etapa: updated ? updated.etapa : cobro.etapa,
    accion: 'Actualizacion de campos',
    resultado: 'OK',
    detalle: `Campos actualizados: ${Object.keys(payload).join(', ')}`
  });

  res.json({ success: true, cobro: updated });
});
