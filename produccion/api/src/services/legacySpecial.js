import AdmZip from 'adm-zip';
import { supabaseAdmin } from './supabase.js';
import { getGasRuntime } from '../gas/runtime.js';
import {
  LEGACY_ROOT_PREFIX,
  buildAppFileUrl,
  buildProcessFolderInfo,
  buildStorageBrowserUrl,
  collectStoragePathsRecursive,
  deleteStorageObjects,
  decodeStoragePathFromAppUrl,
  downloadStorageObject,
  formatStamp,
  listStoragePrefix,
  sanitizeUploadName,
  uploadStorageObject
} from './legacyFiles.js';
import { buildStyledCobroPdfBuffer } from './pdfBoleta.js';

const LEGACY_FLOW_FIELDS = Object.freeze({
  areaResponsableActual: 'AreaResponsableActual',
  fechaIngresoEtapaActual: 'FechaIngresoEtapaActual',
  fechaLimiteSlaActual: 'FechaLimiteSlaActual',
  fechaLimiteFirmaBoleta: 'FechaLimiteFirmaBoleta',
  firmaBoletaLink: 'FirmaBoletaLink',
  boletaFirmadaUrl: 'BoletaFirmadaUrl',
  firmaBoletaUrl: 'FirmaBoletaUrl',
  inventarioStatus: 'InventarioStatus',
  comentarioInventario: 'ComentarioInventario',
  ovNumero: 'OV_Numero',
  rutaId: 'RutaId',
  facturaNumero: 'FacturaNumero',
  facturaUrl: 'FacturaUrl',
  fechaLimiteFirmaFactura: 'FechaLimiteFirmaFactura',
  firmaFacturaLink: 'FirmaFacturaLink',
  firmaFacturaUrl: 'FirmaFacturaUrl',
  liquidacionRef: 'LiquidacionRef',
  constanciaPagoUrl: 'ConstanciaPagoUrl',
  rmNumero: 'RM_Numero',
  facturasDebitar: 'FacturasDebitar',
  debitoRef: 'DebitoRef',
  etapaAnterior: 'EtapaAnterior',
  motivoObservacion: 'MotivoObservacion'
});

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

function normalizeRoleKey(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '')
    .toLowerCase();
}

function canonicalUploadField(fieldName) {
  const key = normalizeRoleKey(fieldName);
  if (key === normalizeRoleKey('FirmaBoletaUrl') || key === normalizeRoleKey('BoletaFirmadaUrl')) return 'boleta_firmada_url';
  if (key === normalizeRoleKey('FacturaUrl')) return 'factura_url';
  if (key === normalizeRoleKey('FirmaFacturaUrl')) return 'firma_factura_url';
  if (key === normalizeRoleKey('ConstanciaPagoUrl')) return 'constancia_pago_url';
  return '';
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

async function insertAudit(payload) {
  const { error } = await supabaseAdmin.from('ct_audit_log').insert(payload);
  if (error) throw error;
}

async function getCobroById(id) {
  const { data, error } = await supabaseAdmin.from('ct_cobros').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data || null;
}

function actorCanAccessRow(profile, row) {
  const actorCountry = String(profile?.countryCode || '').trim().toUpperCase();
  if (!actorCountry) return true;
  return String(row?.country_code || '').trim().toUpperCase() === actorCountry;
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeCountryCode(value) {
  return String(value || '').trim().toUpperCase();
}

function mapCountryRecord(row) {
  const countryCode = normalizeCountryCode(row?.country_code);
  return {
    countryCode,
    name: String(row?.nombre || countryCode).trim(),
    currency: String(row?.moneda || '').trim().toUpperCase(),
    timezone: String(row?.timezone || '').trim(),
    locale: String(row?.locale || '').trim(),
    active: Boolean(row?.activo)
  };
}

function mapProviderRecord(row) {
  return {
    codigo: String(row?.codigo || '').trim(),
    nombre: String(row?.nombre || '').trim(),
    email: String(row?.correo || '').trim(),
    activo: row?.activo == null ? true : Boolean(row?.activo),
    countryCode: normalizeCountryCode(row?.country_code)
  };
}

function mapPilotRecord(row) {
  return {
    dni: String(row?.dni || '').trim(),
    nombre: String(row?.nombre_completo || '').trim(),
    countryCode: normalizeCountryCode(row?.country_code)
  };
}

function mapMasterItemRecord(row) {
  const precioConIgv = Number(row?.precio_con_igv || 0);
  const precioSinIgv = Number(row?.precio_sin_igv || 0);
  return {
    codigo: String(row?.codigo || '').trim(),
    descripcion: String(row?.descripcion || '').trim(),
    uxc: Number(row?.uxc || 0),
    precioConIgv,
    precioSinIgv,
    precio: precioSinIgv || precioConIgv || 0,
    ean: String(row?.ean || '').trim(),
    activo: Boolean(row?.activo),
    countryCode: normalizeCountryCode(row?.country_code)
  };
}

async function getCatalogActorProfile(actorEmail) {
  const email = normalizeEmail(actorEmail);
  if (!email) return null;

  const { data, error } = await supabaseAdmin
    .from('ct_users')
    .select('email,nombre,rol,activo,area,country_code')
    .eq('email', email)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  return {
    email,
    nombre: String(data.nombre || '').trim(),
    rol: String(data.rol || '').trim(),
    activo: Boolean(data.activo),
    area: String(data.area || '').trim(),
    countryCode: normalizeCountryCode(data.country_code)
  };
}

async function listFrontendCountries() {
  const { data, error } = await supabaseAdmin
    .from('ct_cfg_countries')
    .select('country_code,nombre,moneda,timezone,locale,activo')
    .eq('activo', true)
    .order('country_code', { ascending: true });
  if (error) throw error;
  return (data || []).map(mapCountryRecord);
}

async function listFrontendProviders(actorCountry) {
  let query = supabaseAdmin
    .from('ct_providers')
    .select('codigo,nombre,correo,activo,country_code')
    .order('codigo', { ascending: true });
  if (actorCountry) query = query.eq('country_code', actorCountry);
  query = query.eq('activo', true);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(mapProviderRecord);
}

async function listFrontendPilots(actorCountry) {
  let query = supabaseAdmin
    .from('ct_pilots')
    .select('dni,nombre_completo,country_code')
    .order('nombre_completo', { ascending: true });
  if (actorCountry) query = query.eq('country_code', actorCountry);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(mapPilotRecord);
}

async function listFrontendMasterItems(actorCountry) {
  let query = supabaseAdmin
    .from('ct_master_items')
    .select('codigo,descripcion,uxc,precio_con_igv,precio_sin_igv,ean,activo,country_code')
    .order('codigo', { ascending: true });
  if (actorCountry) query = query.eq('country_code', actorCountry);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(mapMasterItemRecord);
}

async function listFrontendResponsables(countriesByCode) {
  const { data, error } = await supabaseAdmin
    .from('ct_users')
    .select('email,nombre,rol,area,country_code,activo')
    .eq('activo', true)
    .order('nombre', { ascending: true });
  if (error) throw error;

  return (data || [])
    .map((row) => {
      const email = normalizeEmail(row?.email);
      const nombre = String(row?.nombre || '').trim();
      const countryCode = normalizeCountryCode(row?.country_code);
      if (!email || !nombre || !countryCode) return null;
      const countryName = String(countriesByCode.get(countryCode)?.name || countryCode).trim();
      return {
        email,
        nombre,
        rol: String(row?.rol || '').trim(),
        area: String(row?.area || '').trim(),
        countryCode,
        countryName,
        activo: true
      };
    })
    .filter(Boolean);
}

async function getDataForFrontendSpecial(args) {
  const actorEmail = args?.[0];
  const profile = await getCatalogActorProfile(actorEmail);
  if (!profile?.email) {
    return {
      proveedores: [],
      pilotos: [],
      responsables: [],
      countries: [],
      items: [],
      warnings: ['No se pudo validar la sesion del usuario.']
    };
  }

  const actorCountry = profile.countryCode;
  const countries = await listFrontendCountries();
  const countriesByCode = new Map(countries.map((country) => [country.countryCode, country]));
  const [proveedores, pilotos, responsables, allItems] = await Promise.all([
    listFrontendProviders(actorCountry),
    listFrontendPilots(actorCountry),
    listFrontendResponsables(countriesByCode),
    listFrontendMasterItems(actorCountry)
  ]);

  const items = allItems.filter((item) =>
    Boolean(item?.activo) &&
    (String(item?.codigo || '').trim() || String(item?.descripcion || '').trim() || String(item?.ean || '').trim())
  );

  const warnings = [];
  if (!proveedores.length) warnings.push("La hoja 'Proveedores' no tiene registros.");
  if (!pilotos.length) warnings.push("La hoja 'Pilotos' no tiene registros.");
  if (!allItems.length) warnings.push("La hoja 'maestro' no tiene registros.");
  if (!responsables.length) warnings.push('No hay usuarios activos con pais asignado para Responsable.');

  return {
    proveedores,
    pilotos,
    responsables,
    countries,
    items,
    warnings
  };
}

async function adminGetMaestroItemsSpecial(args) {
  const actorEmail = args?.[0];
  const profile = await getCatalogActorProfile(actorEmail);
  if (!profile?.email) return [];
  return listFrontendMasterItems(profile.countryCode);
}

async function adminGetMaestroItemsJsonSpecial(args) {
  const items = await adminGetMaestroItemsSpecial(args);
  return JSON.stringify(items || []);
}

async function buildItemsWithMasterData(items, countryCode) {
  const cleanItems = Array.isArray(items) ? items : [];
  const { data, error } = await supabaseAdmin
    .from('ct_master_items')
    .select('codigo,uxc,country_code')
    .eq('country_code', countryCode);
  if (error) throw error;

  const byCode = new Map((data || []).map((row) => [String(row.codigo || '').trim(), Number(row.uxc || 0)]));
  return cleanItems.map((item) => {
    const qty = Number(item.cantidad || 0);
    const uxc = Number(byCode.get(String(item.codigo || '').trim()) || 0);
    const cajas = uxc > 1 ? Math.floor(qty / uxc) : 0;
    const unidadesSueltas = uxc > 1 ? qty - cajas * uxc : qty;
    return {
      codigo: String(item.codigo || '').trim(),
      descripcion: String(item.descripcion || '').trim(),
      cantidad: qty,
      precio: Number(item.precio || 0),
      subtotal: Number(item.subtotal || 0),
      incidencia: String(item.incidencia || '').trim() || 'Conforme',
      uxc,
      cajas,
      unidadesSueltas
    };
  });
}

function invalidateLegacySheetCache(runtime, sheetNames) {
  const list = Array.isArray(sheetNames) ? sheetNames : [sheetNames];
  list.forEach((sheetName) => {
    const normalized = String(sheetName || '').trim();
    if (!normalized) return;
    try {
      runtime.call('invalidateDataStoreCache_', [normalized]);
    } catch {
      // If the adapter cache is not initialized yet, there is nothing to invalidate.
    }
  });
}

function uniqueStrings(values) {
  const out = [];
  const seen = new Set();
  for (const value of Array.isArray(values) ? values : []) {
    const normalized = String(value || '').trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

function extractStoragePrefixFromCobro(cobro) {
  const storedId = String(cobro?.process_folder_id || '').trim();
  if (storedId && !/^https?:\/\//i.test(storedId)) return storedId.replace(/^\/+|\/+$/g, '');

  const storedUrl = String(cobro?.process_folder_url || '').trim();
  if (storedUrl) {
    try {
      const url = new URL(storedUrl);
      const prefix = String(url.searchParams.get('prefix') || '').trim();
      if (prefix) return prefix.replace(/^\/+|\/+$/g, '');
    } catch {
      const match = storedUrl.match(/[?&]prefix=([^&#]+)/i);
      if (match?.[1]) {
        try {
          return decodeURIComponent(match[1]).replace(/^\/+|\/+$/g, '');
        } catch {
          return String(match[1] || '').replace(/^\/+|\/+$/g, '');
        }
      }
    }
  }

  if (!cobro?.id) return '';
  return buildProcessFolderInfo({
    processId: cobro.id,
    createdAt: cobro.fecha_registro,
    countryCode: cobro.country_code,
    countryName: cobro.country_name,
    providerName: cobro.proveedor_nombre,
    providerCode: cobro.proveedor_codigo
  }).folderPrefix;
}

function collectCobroStoragePaths(cobro) {
  return uniqueStrings([
    decodeStoragePathFromAppUrl(cobro?.pdf_url),
    decodeStoragePathFromAppUrl(cobro?.boleta_firmada_url),
    decodeStoragePathFromAppUrl(cobro?.firma_boleta_url),
    decodeStoragePathFromAppUrl(cobro?.factura_url),
    decodeStoragePathFromAppUrl(cobro?.firma_factura_url),
    decodeStoragePathFromAppUrl(cobro?.constancia_pago_url)
  ]);
}

async function deleteCobroStorageArtifacts(cobro) {
  const directPaths = collectCobroStoragePaths(cobro);
  const prefix = extractStoragePrefixFromCobro(cobro);
  const folderPaths = prefix ? await collectStoragePathsRecursive(prefix) : [];
  const allPaths = uniqueStrings([...directPaths, ...folderPaths]);
  if (!allPaths.length) {
    return { deleted: 0, paths: [] };
  }
  await deleteStorageObjects(allPaths);
  return {
    deleted: allPaths.length,
    paths: allPaths
  };
}

async function deleteRowsByField(table, field, value) {
  const { data, error } = await supabaseAdmin
    .from(table)
    .delete()
    .eq(field, value)
    .select(field);
  if (error) throw error;
  return Array.isArray(data) ? data.length : 0;
}

async function deleteCobroCascade(cobro) {
  const storage = await deleteCobroStorageArtifacts(cobro);
  const [itemsDeleted, criticalDeleted, auditDeleted, notificationsDeleted] = await Promise.all([
    deleteRowsByField('ct_cobro_items', 'cobro_id', cobro.id),
    deleteRowsByField('ct_critical_approvals', 'cobro_id', cobro.id),
    deleteRowsByField('ct_audit_log', 'cobro_id', cobro.id),
    deleteRowsByField('ct_notifications', 'cobro_id', cobro.id)
  ]);

  const { data: deletedCobros, error: cobroDeleteError } = await supabaseAdmin
    .from('ct_cobros')
    .delete()
    .eq('id', cobro.id)
    .select('id');
  if (cobroDeleteError) throw cobroDeleteError;

  return {
    ok: Array.isArray(deletedCobros) ? deletedCobros.length : 0,
    detailDeleted: itemsDeleted,
    criticalDeleted,
    auditDeleted,
    notificationsDeleted,
    storageDeleted: storage.deleted,
    storagePaths: storage.paths
  };
}

function clearRuntimeDeleteCaches(runtime) {
  invalidateLegacySheetCache(runtime, ['Aprobaciones', 'Detalle_Cobros', 'Bitacora', 'Aprobaciones_Criticas', 'Notificaciones']);
  const cache = runtime?.context?.CacheService?.getScriptCache?.();
  if (!cache || typeof cache.removeByPrefix !== 'function') return;
  ['dash:', 'hist:', 'report-basic:', 'report-sla:'].forEach((prefix) => {
    try {
      cache.removeByPrefix(prefix);
    } catch {
      // Best effort only.
    }
  });
}

async function getCobroFlowDataSpecial(args) {
  const runtime = getGasRuntime();
  const [idRaw, actorEmail] = args || [];
  const id = String(idRaw || '').trim();
  if (!id) return { success: false, message: 'ID requerido.' };

  const profile = runtime.call('getUserProfile_', [actorEmail]);
  if (!profile?.email) return { success: false, message: 'Usuario no autorizado.' };

  const cobro = await getCobroById(id);
  if (!cobro) return { success: false, message: 'ID no encontrado.' };
  if (!actorCanAccessRow(profile, cobro)) {
    return { success: false, message: `No tiene acceso a este cobro fuera del entorno ${profile.countryCode || ''}.` };
  }

  const ss = runtime.context.getDataStore_();
  const sh = ss && typeof ss.getSheetByName === 'function' ? ss.getSheetByName('Aprobaciones') : null;
  if (!sh || !sh.def_ || typeof sh.def_.toRow !== 'function') {
    return { success: false, message: 'No existe hoja Aprobaciones.' };
  }

  const schema = runtime.call('ensureAprobacionesSchema_', [sh]);
  const headers = Array.isArray(sh.def_.headers) ? sh.def_.headers.slice() : [];
  const map = schema?.map || runtime.call('buildHeaderMap_', [headers]);
  const row = sh.def_.toRow(cobro);
  const WF = LEGACY_FLOW_FIELDS;
  const colEtapa = Math.max(0, Number(runtime.context.COL_ETAPA || 18) - 1);
  const colEstado = Math.max(0, Number(runtime.context.COL_ESTADO || 14) - 1);
  const rowText = (names) => runtime.call('rowText_', [row, map, Array.isArray(names) ? names : [names]]);
  const rowVal = (names) => runtime.call('rowVal_', [row, map, Array.isArray(names) ? names : [names]]);
  const formatDateTime = (value) => runtime.call('formatDateTimeSafe_', [value]);

  const etapaActual = runtime.call('normalizeEtapa_', [row[colEtapa]]);
  const idxActual = runtime.call('etapaIndex_', [etapaActual]);
  const estadoActual = runtime.call('normalizeEstado_', [row[colEstado]]);
  const storedEtapaAnterior = rowText([WF.etapaAnterior]);
  const areaStored = rowText([WF.areaResponsableActual]);
  const etapaObservada = runtime.call('resolveObservedSourceEtapa_', [storedEtapaAnterior, etapaActual]);
  const etapaRetornoObservado = runtime.call('resolveObservedReturnEtapa_', [storedEtapaAnterior, etapaActual]);
  const areaActual = runtime.call('resolveObservedResponsibleArea_', [estadoActual, etapaActual, storedEtapaAnterior, areaStored]);
  const areaObservacion = (estadoActual === 'Observado' && etapaObservada)
    ? runtime.call('areaResponsablePorEtapa_', [runtime.call('etapaIndex_', [etapaObservada])])
    : '';
  const canByArea = profile.canForce || (profile.areaKey && profile.areaKey === runtime.call('areaKey_', [areaActual]));

  const editableFields = [
    WF.firmaBoletaUrl,
    WF.inventarioStatus,
    WF.comentarioInventario,
    WF.ovNumero,
    WF.rutaId,
    WF.facturaNumero,
    WF.facturaUrl,
    WF.firmaFacturaUrl,
    WF.liquidacionRef,
    WF.constanciaPagoUrl,
    WF.facturasDebitar,
    WF.motivoObservacion
  ].filter(Boolean).filter((field) => runtime.call('canEditField_', [profile, field]));

  if (estadoActual === 'Observado' && !profile.canForce) {
    const idxMotivo = editableFields.indexOf(WF.motivoObservacion);
    if (idxMotivo >= 0) editableFields.splice(idxMotivo, 1);
  }

  return {
    success: true,
    id: String(cobro.id || ''),
    estado: estadoActual,
    etapa: etapaActual,
    stageCatalog: runtime.call('buildFlowStageCatalog_', []),
    sla: runtime.call('slaStatusText_', [row, map, idxActual]),
    areaResponsableActual: areaActual,
    fechaIngresoEtapaActual: formatDateTime(rowVal([WF.fechaIngresoEtapaActual])),
    fechaLimiteSlaActual: formatDateTime(runtime.call('resolveStageSlaLimit_', [row, map, idxActual])),
    fechaLimiteFirmaBoleta: formatDateTime(rowVal([WF.fechaLimiteFirmaBoleta])),
    firmaBoletaLink: rowText([WF.firmaBoletaLink]),
    boletaFirmadaUrl: rowText([WF.boletaFirmadaUrl, WF.firmaBoletaUrl]),
    firmaBoletaUrl: rowText([WF.boletaFirmadaUrl, WF.firmaBoletaUrl]),
    inventarioStatus: rowText([WF.inventarioStatus]),
    comentarioInventario: rowText([WF.comentarioInventario]),
    ovNumero: rowText([WF.ovNumero]),
    rutaId: rowText([WF.rutaId]),
    facturaNumero: rowText([WF.facturaNumero]),
    facturaUrl: rowText([WF.facturaUrl]),
    fechaLimiteFirmaFactura: formatDateTime(rowVal([WF.fechaLimiteFirmaFactura])),
    firmaFacturaLink: rowText([WF.firmaFacturaLink]),
    firmaFacturaUrl: rowText([WF.firmaFacturaUrl]),
    liquidacionRef: rowText([WF.liquidacionRef]),
    constanciaPagoUrl: rowText([WF.constanciaPagoUrl]),
    rmNumero: rowText([WF.rmNumero]),
    facturasDebitar: rowText([WF.facturasDebitar]),
    debitoRef: rowText([WF.debitoRef]),
    etapaAnterior: estadoActual === 'Observado' ? etapaObservada : '',
    etapaRetornoObservado: estadoActual === 'Observado' ? etapaRetornoObservado : '',
    areaObservacion,
    areaRetornoObservado: estadoActual === 'Observado' ? areaActual : '',
    motivoObservacion: rowText([WF.motivoObservacion]),
    permissions: {
      canForce: profile.canForce,
      editableFields,
      canMarkObservado: Boolean(canByArea && idxActual > 1 && !['Observado', 'Anulado', 'Cerrado'].includes(estadoActual)),
      canRevertObservado: Boolean(canByArea && estadoActual === 'Observado' && etapaRetornoObservado && etapaRetornoObservado !== etapaActual),
      canAnular: profile.canForce
    }
  };
}

async function deleteGestionCobrosSpecial(args) {
  const runtime = getGasRuntime();
  const [ids, authKey, motivo, actorEmail] = args || [];
  const profile = runtime.call('getUserProfile_', [actorEmail]);
  if (!profile?.email) return { success: false, message: 'Usuario no autorizado.' };

  const wanted = uniqueStrings(Array.isArray(ids) ? ids : [ids]);
  if (!wanted.length) return { success: false, message: 'Debe indicar al menos un ID.' };

  const reason = String(motivo || '').trim();
  if (!reason) return { success: false, message: 'Debe indicar el motivo de eliminacion.' };

  const scope = runtime.call('resolveDeleteAuthScope_', [wanted.length]);
  const keyCheck = runtime.call('validateAuthorizationKey_', [authKey, scope]);
  if (!keyCheck?.ok) {
    return { success: false, message: keyCheck?.message || 'No se pudo validar la clave de autorizacion.' };
  }

  const { data, error } = await supabaseAdmin
    .from('ct_cobros')
    .select('*')
    .in('id', wanted);
  if (error) return { success: false, message: error.message };

  const rowsById = new Map((data || []).map((row) => [String(row.id || '').trim(), row]));
  const failed = [];
  const eligible = [];

  for (const id of wanted) {
    const row = rowsById.get(id);
    if (!row) {
      failed.push({ id, message: 'ID no encontrado.' });
      continue;
    }
    if (!actorCanAccessRow(profile, row)) {
      failed.push({ id, message: `No tiene acceso a este cobro fuera del entorno ${profile.countryCode || ''}.` });
      continue;
    }
    eligible.push(row);
  }

  if (!eligible.length) {
    return {
      success: false,
      message: failed.length ? failed[0].message : 'No se encontraron registros para eliminar.',
      ok: 0,
      fail: failed.length,
      failed
    };
  }

  const deletedIds = [];
  let detailDeleted = 0;
  let criticalDeleted = 0;
  let auditDeleted = 0;
  let notificationsDeleted = 0;
  let storageDeleted = 0;

  for (const cobro of eligible) {
    try {
      const result = await deleteCobroCascade(cobro);
      if (!result.ok) {
        failed.push({ id: String(cobro.id || ''), message: 'No se pudo eliminar el cobro principal.' });
        continue;
      }
      deletedIds.push(String(cobro.id || ''));
      detailDeleted += result.detailDeleted;
      criticalDeleted += result.criticalDeleted;
      auditDeleted += result.auditDeleted;
      notificationsDeleted += result.notificationsDeleted;
      storageDeleted += result.storageDeleted;
    } catch (deleteError) {
      failed.push({
        id: String(cobro.id || ''),
        message: String(deleteError?.message || deleteError || 'No se pudo eliminar el cobro.')
      });
    }
  }

  clearRuntimeDeleteCaches(runtime);

  if (!deletedIds.length) {
    return {
      success: false,
      message: failed.length ? failed[0].message : 'No se pudo eliminar ningun registro.',
      ok: 0,
      fail: failed.length,
      failed,
      keyId: keyCheck.keyId
    };
  }

  return {
    success: true,
    ok: deletedIds.length,
    fail: failed.length,
    deletedIds,
    failed,
    keyId: keyCheck.keyId,
    detailDeleted,
    criticalDeleted,
    auditDeleted,
    notificationsDeleted,
    filesTrashed: storageDeleted,
    message: deletedIds.length === 1
      ? 'Registro eliminado completamente.'
      : `Registros eliminados completamente: ${deletedIds.length}`
  };
}

export async function executeLegacySpecial(method, args, { req }) {
  switch (method) {
    case 'getPdfRootMeta':
      return {
        id: LEGACY_ROOT_PREFIX,
        name: 'CobroTransporte_PDF',
        url: buildStorageBrowserUrl(LEGACY_ROOT_PREFIX, req)
      };
    case 'getPdfRootUrl':
      return buildStorageBrowserUrl(LEGACY_ROOT_PREFIX, req);
    case 'getDataForFrontend':
      return getDataForFrontendSpecial(args);
    case 'adminGetMaestroItems':
      return adminGetMaestroItemsSpecial(args);
    case 'adminGetMaestroItemsJson':
      return adminGetMaestroItemsJsonSpecial(args);
    case 'getCobroFlowData':
      return getCobroFlowDataSpecial(args);
    case 'procesarCobro':
      return procesarCobroSpecial(args, req);
    case 'subirPdfFlujo':
      return subirPdfFlujoSpecial(args, req);
    case 'subirBoletaFirmada':
      return subirPdfFlujoSpecial([args[0], 'FirmaBoletaUrl', args[1], args[2], args[3], args[4], args[5]], req);
    case 'generarZipPdfsGestion':
      return generarZipPdfsGestionSpecial(args, req);
    case 'deleteGestionCobros':
      return deleteGestionCobrosSpecial(args);
    case 'updateCobroEtapa':
      return updateCobroEtapaSpecial(args);
    case 'updateCobroCampos':
      return updateCobroCamposSpecial(args);
    default:
      throw new Error(`Método especial no soportado: ${method}`);
  }
}

function updateCobroEtapaSpecial(args) {
  const runtime = getGasRuntime();
  return runtime.call('updateCobroEtapa', Array.isArray(args) ? args : [], {
    deferStageSideEffects: true
  });
}

function updateCobroCamposSpecial(args) {
  const runtime = getGasRuntime();
  return runtime.call('updateCobroCampos', Array.isArray(args) ? args : [], {
    deferStageSideEffects: true
  });
}

async function procesarCobroSpecial(args, req) {
  const runtime = getGasRuntime();
  const formObject = { ...(args?.[0] || {}) };

  const auth = runtime.call('validarUsuario', [formObject.userEmail, formObject.passwordConfirmation]);
  if (!auth?.success) {
    return { status: 'error', message: 'Contraseña incorrecta. No se puede registrar.' };
  }

  const responsableCtx = runtime.call('resolveResponsableContext_', [formObject]);
  if (!responsableCtx?.success) {
    return { status: 'error', message: responsableCtx?.message || 'No se pudo resolver el responsable.' };
  }

  formObject.responsable = responsableCtx.nombre;
  formObject.responsableEmail = responsableCtx.email;
  formObject.countryCode = responsableCtx.countryCode;
  formObject.countryName = responsableCtx.countryName;

  let items = [];
  try {
    items = JSON.parse(formObject.items || '[]');
  } catch {
    return { status: 'error', message: 'Formato de items inválido.' };
  }

  const processedItems = await buildItemsWithMasterData(items, formObject.countryCode);
  const idCobro = `COB-${Date.now()}`;
  const createdAt = new Date();
  const folderInfo = buildProcessFolderInfo({
    processId: idCobro,
    createdAt,
    countryCode: formObject.countryCode,
    countryName: formObject.countryName,
    providerName: formObject.proveedorNombre,
    providerCode: formObject.proveedorCodigo
  }, req);

  const pdfBuffer = await buildStyledCobroPdfBuffer({
    id: idCobro,
    formObject,
    items: processedItems
  });
  const pdfPath = `${folderInfo.folderPrefix}/Cobro_${idCobro}.pdf`;
  await uploadStorageObject(pdfPath, pdfBuffer, 'application/pdf');
  const pdfUrl = buildAppFileUrl(pdfPath, req);

  const stageSlaInit = runtime.call('buildStageSlaEntryFields_', [1, createdAt]);
  const boletaEmitidaConFirmas = !!String(formObject.firmaPiloto || '').trim() && !!String(formObject.firmaVista || '').trim();

  const cobroPayload = {
    id: idCobro,
    fecha_registro: createdAt.toISOString(),
    proveedor_nombre: String(formObject.proveedorNombre || '').trim(),
    proveedor_codigo: String(formObject.proveedorCodigo || '').trim(),
    unidad: String(formObject.unidad || '').trim(),
    ruta: String(formObject.ruta || '').trim(),
    c9: String(formObject.c9 || '').trim(),
    factura_ref: String(formObject.factura || '').trim(),
    observaciones: String(formObject.observaciones || '').trim(),
    total_cobro: Number(formObject.totalCobro || 0),
    estado: 'Abierto',
    responsable: String(formObject.responsable || '').trim(),
    piloto_nombre: String(formObject.pilotoNombre || '').trim(),
    items_json: processedItems,
    etapa: ETAPAS_COBRO[0],
    ultima_actualizacion: createdAt.toISOString(),
    bodega: String(formObject.bodega || '').trim(),
    licencia: String(formObject.licencia || '').trim(),
    pdf_url: pdfUrl,
    area_responsable_actual: 'Logistica Inversa',
    country_code: String(folderInfo.countryCode || '').trim(),
    country_name: String(folderInfo.countryName || '').trim(),
    process_folder_id: folderInfo.folderId,
    process_folder_url: folderInfo.folderUrl,
    process_folder_name: folderInfo.folderName,
    fecha_ingreso_etapa_actual: createdAt.toISOString(),
    fecha_limite_sla_actual: stageSlaInit?.FechaLimiteSlaActual ? new Date(stageSlaInit.FechaLimiteSlaActual).toISOString() : null,
    fecha_limite_firma_boleta: stageSlaInit?.FechaLimiteFirmaBoleta ? new Date(stageSlaInit.FechaLimiteFirmaBoleta).toISOString() : null,
    fecha_limite_firma_factura: stageSlaInit?.FechaLimiteFirmaFactura ? new Date(stageSlaInit.FechaLimiteFirmaFactura).toISOString() : null
  };

  if (boletaEmitidaConFirmas) {
    cobroPayload.boleta_firmada_url = pdfUrl;
    cobroPayload.firma_boleta_url = pdfUrl;
  }

  const { error: cobroError } = await supabaseAdmin.from('ct_cobros').insert(cobroPayload);
  if (cobroError) {
    return { status: 'error', message: cobroError.message };
  }

  if (processedItems.length) {
    const { error: itemsError } = await supabaseAdmin.from('ct_cobro_items').insert(
      processedItems.map((item) => ({
        cobro_id: idCobro,
        codigo: item.codigo,
        descripcion: item.descripcion,
        cantidad: item.cantidad,
        precio: item.precio,
        subtotal: item.subtotal,
        incidencia: item.incidencia
      }))
    );
    if (itemsError) {
      return { status: 'error', message: itemsError.message };
    }
  }

  invalidateLegacySheetCache(runtime, ['Aprobaciones', 'Detalle_Cobros']);

  try {
    runtime.call('appendBitacora_', [{
      id: idCobro,
      usuario: String(formObject.userEmail || 'sistema'),
      etapa: ETAPAS_COBRO[0],
      accion: 'Registro inicial',
      resultado: 'OK',
      detalle: boletaEmitidaConFirmas
        ? 'Cobro creado con firmas (piloto/vista). Se intentara auto-avance a etapa 3.'
        : 'Cobro creado en etapa 1.'
    }]);
  } catch {
    // La inserción principal ya quedó hecha.
  }

  try {
    runtime.call('sendRegistroBoletaMail_', [{
      id: idCobro,
      etapa: ETAPAS_COBRO[0],
      proveedor: String(formObject.proveedorNombre || ''),
      proveedorCodigo: String(formObject.proveedorCodigo || ''),
      ruta: String(formObject.ruta || ''),
      monto: Number(formObject.totalCobro || 0),
      pdfUrl,
      actorEmail: String(formObject.userEmail || '')
    }]);
  } catch {
    // Correo opcional.
  }

  if (boletaEmitidaConFirmas) {
    try {
      runtime.call('applyAutoEtapaRules_', [idCobro, String(formObject.userEmail || ''), {
        actorCtx: { origen: 'registro_inicial', source: 'boleta_emitida_con_firmas' }
      }]);
    } catch {
      // Auto-avance opcional.
    }
  }

  return {
    url: pdfUrl,
    status: 'success',
    id: idCobro
  };
}

async function subirPdfFlujoSpecial(args, req) {
  const runtime = getGasRuntime();
  const [id, fieldName, fileName, mimeType, dataUrl, actorEmail, actorCtx] = args || [];
  const profile = runtime.call('getUserProfile_', [actorEmail]);
  if (!profile?.email) {
    return { success: false, message: 'Usuario no autorizado.' };
  }

  const canonicalField = canonicalUploadField(fieldName);
  if (!canonicalField) {
    return { success: false, message: 'Campo de archivo no permitido.' };
  }

  const allowed = runtime.call('uploadFieldAllowed_', [profile, fieldName]);
  if (!allowed) {
    return { success: false, message: 'No tiene permiso para subir este documento.' };
  }

  const parsed = parseDataUrl(dataUrl, mimeType);
  if (!parsed?.buffer?.length) {
    return { success: false, message: 'Archivo inválido.' };
  }
  if (String(parsed.mimeType || mimeType || '').toLowerCase() !== 'application/pdf') {
    return { success: false, message: 'Formato no permitido. Solo PDF.' };
  }
  if (parsed.buffer.length > 10 * 1024 * 1024) {
    return { success: false, message: 'El archivo supera 10 MB.' };
  }

  const cobro = await getCobroById(String(id || '').trim());
  if (!cobro) return { success: false, message: 'ID no encontrado.' };
  if (!actorCanAccessRow(profile, cobro)) {
    return { success: false, message: `No tiene acceso a este cobro fuera del entorno ${profile.countryCode || ''}.` };
  }

  const folderInfo = buildProcessFolderInfo({
    processId: cobro.id,
    createdAt: cobro.fecha_registro,
    countryCode: cobro.country_code || profile.countryCode || 'PE',
    countryName: cobro.country_name || profile.countryName || '',
    providerName: cobro.proveedor_nombre,
    providerCode: cobro.proveedor_codigo
  }, req);
  const ext = '.pdf';
  const label = canonicalField.replace(/_url$/i, '');
  const safeName = sanitizeUploadName(fileName, `${label}_${cobro.id}_${Date.now()}${ext}`);
  const path = `${folderInfo.folderPrefix}/${safeName.endsWith(ext) ? safeName : `${safeName}${ext}`}`;

  await uploadStorageObject(path, parsed.buffer, 'application/pdf');
  const fileUrl = buildAppFileUrl(path, req);

  const patch = {
    [canonicalField]: fileUrl,
    process_folder_id: folderInfo.folderId,
    process_folder_url: folderInfo.folderUrl,
    process_folder_name: folderInfo.folderName,
    country_code: folderInfo.countryCode,
    country_name: folderInfo.countryName,
    ultima_actualizacion: new Date().toISOString()
  };
  if (canonicalField === 'boleta_firmada_url') {
    patch.firma_boleta_url = fileUrl;
  }

  const { error } = await supabaseAdmin.from('ct_cobros').update(patch).eq('id', cobro.id);
  if (error) {
    return { success: false, message: error.message };
  }

  invalidateLegacySheetCache(runtime, ['Aprobaciones']);

  await insertAudit({
    cobro_id: cobro.id,
    usuario: String(actorEmail || 'sistema'),
    etapa: String(cobro.etapa || ''),
    accion: `Carga PDF (${String(fieldName || '').trim()})`,
    resultado: 'OK',
    detalle: JSON.stringify({
      origen: actorCtx?.origen || 'api',
      field: canonicalField,
      url: fileUrl
    })
  });

  let autoMove = { moved: false };
  try {
    autoMove = runtime.call('applyAutoEtapaRules_', [cobro.id, actorEmail, {
      actorCtx: actorCtx || { origen: 'api' },
      source: 'upload_pdf'
    }]);
  } catch {
    autoMove = { moved: false };
  }

  return {
    success: true,
    url: fileUrl,
    fileId: fileUrl.match(/\/files\/([^/?#]+)/)?.[1] || '',
    name: safeName,
    autoMove
  };
}

async function generarZipPdfsGestionSpecial(args, req) {
  const runtime = getGasRuntime();
  const [ids, actorEmail, actorCtx] = args || [];
  const profile = runtime.call('getUserProfile_', [actorEmail]);
  if (!profile?.email) return { success: false, message: 'Usuario no autorizado.' };

  const wanted = Array.isArray(ids) ? ids.map((id) => String(id || '').trim()).filter(Boolean) : [];
  if (!wanted.length) return { success: false, message: 'Seleccione al menos un ID.' };

  const { data, error } = await supabaseAdmin
    .from('ct_cobros')
    .select('id,pdf_url,country_code')
    .in('id', wanted);
  if (error) return { success: false, message: error.message };

  const zip = new AdmZip();
  const notFound = [];
  let total = 0;

  for (const id of wanted) {
    const row = (data || []).find((item) => String(item.id || '') === id);
    if (!row) {
      notFound.push(`${id} (ID no encontrado)`);
      continue;
    }
    if (!actorCanAccessRow(profile, row)) {
      notFound.push(`${id} (sin acceso al entorno)`);
      continue;
    }
    const storagePath = decodeStoragePathFromAppUrl(row.pdf_url);
    if (!storagePath) {
      notFound.push(`${id} (PDF legacy fuera de Storage)`);
      continue;
    }
    try {
      const file = await downloadStorageObject(storagePath);
      zip.addFile(`${id}.pdf`, file.buffer);
      total += 1;
    } catch {
      notFound.push(`${id} (PDF inaccesible)`);
    }
  }

  if (!total) {
    return { success: false, message: 'No se encontraron PDFs para comprimir.', notFound };
  }

  const stamp = formatStamp(new Date());
  const zipName = `Pdfs_Gestion_${stamp}.zip`;
  const zipPath = `${LEGACY_ROOT_PREFIX}/exports/${zipName}`;
  await uploadStorageObject(zipPath, zip.toBuffer(), 'application/zip');

  await insertAudit({
    cobro_id: 'BULK',
    usuario: String(actorEmail || 'sistema'),
    etapa: '-',
    accion: 'ZIP de PDFs',
    resultado: 'OK',
    detalle: JSON.stringify({
      origen: actorCtx?.origen || 'api',
      total,
      notFound
    })
  });

  return {
    success: true,
    url: buildAppFileUrl(zipPath, req),
    fileId: buildAppFileUrl(zipPath, req).match(/\/files\/([^/?#]+)/)?.[1] || '',
    fileName: zipName,
    total,
    notFound
  };
}

export async function renderStorageBrowser(req, res) {
  const prefix = String(req.query.prefix || LEGACY_ROOT_PREFIX).replace(/^\/+|\/+$/g, '');
  const items = await listStoragePrefix(prefix);
  const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Storage Browser</title>
  <style>
    body { font-family: system-ui, sans-serif; padding: 24px; background: #f6f4ef; color: #1f2937; }
    h1 { margin: 0 0 8px; }
    .muted { color: #6b7280; margin-bottom: 16px; }
    ul { padding: 0; list-style: none; display: grid; gap: 10px; }
    li { background: white; border: 1px solid #e5e7eb; border-radius: 12px; padding: 12px 14px; }
    a { color: #0f766e; text-decoration: none; }
    small { color: #6b7280; display: block; margin-top: 4px; }
  </style>
</head>
<body>
  <h1>Storage Browser</h1>
  <div class="muted">Prefijo: ${prefix || '/'}</div>
  <ul>
    ${items.map((item) => {
      const name = String(item.name || '');
      const nextPrefix = prefix ? `${prefix}/${name}` : name;
      const isFolder = !item.metadata;
      if (isFolder) {
        return `<li><a href="/storage-browser?prefix=${encodeURIComponent(nextPrefix)}">${name}/</a><small>Carpeta</small></li>`;
      }
      return `<li><a href="/files/${Buffer.from(nextPrefix, 'utf8').toString('base64url')}" target="_blank">${name}</a><small>${item.metadata?.mimetype || 'archivo'} · ${item.metadata?.size || 0} bytes</small></li>`;
    }).join('')}
  </ul>
</body>
</html>`;

  res.type('html').send(html);
}
