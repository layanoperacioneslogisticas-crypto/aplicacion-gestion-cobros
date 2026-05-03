/**
 * Migracion legacy Sheets -> Supabase
 *
 * Este archivo es autonomo y puede copiarse al GAS antiguo sin tocar
 * el flujo principal. Usa la hoja activa como fuente y Supabase REST
 * como destino.
 *
 * Flujo sugerido:
 * 1) migracionLegacySupabaseConfigurar('https://TU-PROYECTO.supabase.co', 'SERVICE_ROLE_KEY')
 * 2) migracionLegacySupabasePing()
 * 3) migracionLegacySupabaseDryRun()
 * 4) migracionLegacySupabaseEjecutar()
 *
 * Tambien puedes correr una sola tabla:
 * migracionLegacySupabaseTabla('Aprobaciones')
 */

const LEGACY_SUPABASE_URL_PROP = 'SUPABASE_URL';
const LEGACY_SUPABASE_SERVICE_ROLE_KEY_PROP = 'SUPABASE_SERVICE_ROLE_KEY';
const LEGACY_SUPABASE_SECRET_KEY_PROP = 'SUPABASE_SECRET_KEY';
const LEGACY_SUPABASE_DEFAULT_URL = 'https://apauqolrxddmpqtlbffx.supabase.co';
const LEGACY_SUPABASE_DEFAULT_BATCH_SIZE = 200;
const LEGACY_SUPABASE_OMIT = { omit: true };
const LEGACY_SUPABASE_BOOTSTRAP_CONFIG = {
  url: 'https://apauqolrxddmpqtlbffx.supabase.co',
  serviceRoleKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFwYXVxb2xyeGRkbXBxdGxiZmZ4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTE0MDAyNywiZXhwIjoyMDkwNzE2MDI3fQ.q79Fi_8ssBWNPaaK2PXD5hT61TyOPKuuueLSGwDDu5k'
};

const LEGACY_WF = {
  areaResponsableActual: 'AreaResponsableActual',
  countryCode: 'CountryCode',
  countryName: 'CountryName',
  processFolderId: 'ProcessFolderId',
  processFolderUrl: 'ProcessFolderUrl',
  processFolderName: 'ProcessFolderName',
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
  motivoObservacion: 'MotivoObservacion',
  fechaIngresoEtapaActual: 'FechaIngresoEtapaActual',
  fechaLimiteSlaActual: 'FechaLimiteSlaActual',
  emailProveedor: 'EmailProveedor',
  emailInventarios: 'EmailInventarios',
  emailTransporte: 'EmailTransporte',
  emailCyC: 'EmailCyC',
  emailFacturacion: 'EmailFacturacion',
  emailContabilidad: 'EmailContabilidad',
  slaNotif: 'SLA_Notif'
};

const LEGACY_SUPABASE_ETAPAS_COBRO = [
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

let legacySupabaseMigrationDefsMemo_ = null;
let legacySupabaseOpenApiMemo_ = null;

function migracionLegacySupabaseInstalarCredenciales() {
  legacySupabaseEnsureScriptProperties_();
  const cfg = legacySupabaseConfig_();
  return {
    success: true,
    url: cfg.url,
    serviceRoleConfigured: true,
    keyPreview: legacySupabaseMaskKey_(cfg.key)
  };
}

function migracionLegacySupabaseConfigurar(url, serviceRoleKey) {
  const cleanUrl = String(url || '').trim().replace(/\/+$/, '');
  const cleanKey = String(serviceRoleKey || '').trim();
  if (!cleanUrl) throw new Error('Debe indicar SUPABASE_URL.');
  if (!cleanKey) throw new Error('Debe indicar SUPABASE_SERVICE_ROLE_KEY.');
  PropertiesService.getScriptProperties().setProperties({
    SUPABASE_URL: cleanUrl,
    SUPABASE_SERVICE_ROLE_KEY: cleanKey
  }, false);
  return {
    success: true,
    url: cleanUrl,
    keyStored: true,
    keyPreview: legacySupabaseMaskKey_(cleanKey)
  };
}

function migracionLegacySupabasePing() {
  const cfg = legacySupabaseConfig_();
  const startedAt = new Date().toISOString();
  const result = legacySupabaseRequest_('get', 'ct_settings', {
    select: 'setting_key',
    limit: 1
  });
  const rows = Array.isArray(result) ? result.length : 0;
  const out = {
    success: true,
    startedAt: startedAt,
    finishedAt: new Date().toISOString(),
    url: cfg.url,
    rowsVisible: rows
  };
  legacySupabaseLog_('PING', out);
  return out;
}

function migracionLegacySupabaseValidarConexion() {
  const cfg = legacySupabaseConfig_();
  const startedAt = new Date().toISOString();
  const checks = [];
  let success = true;

  checks.push(legacySupabaseRunCheck_('ct_settings', function () {
    const rows = legacySupabaseRequest_('get', 'ct_settings', {
      select: 'setting_key',
      limit: 1
    });
    return {
      visibleRows: Array.isArray(rows) ? rows.length : 0
    };
  }));

  checks.push(legacySupabaseRunCheck_('ct_cobros', function () {
    const rows = legacySupabaseRequest_('get', 'ct_cobros', {
      select: 'id,etapa,estado',
      limit: 1
    });
    return {
      visibleRows: Array.isArray(rows) ? rows.length : 0
    };
  }));

  checks.push(legacySupabaseRunCheck_('ct_cobro_items', function () {
    const rows = legacySupabaseRequest_('get', 'ct_cobro_items', {
      select: 'id,cobro_id',
      limit: 1
    });
    return {
      visibleRows: Array.isArray(rows) ? rows.length : 0
    };
  }));

  for (let i = 0; i < checks.length; i++) {
    if (!checks[i].ok) success = false;
  }

  const out = {
    success: success,
    connected: success,
    startedAt: startedAt,
    finishedAt: new Date().toISOString(),
    url: cfg.url,
    keyPreview: legacySupabaseMaskKey_(cfg.key),
    checks: checks
  };
  legacySupabaseLog_('VALIDAR_CONEXION', out);
  return out;
}

function migracionLegacySupabaseListarTablas() {
  const defs = legacySupabaseMigrationDefs_();
  return defs.map(function (def) {
    return {
      sheetName: def.sheetName,
      table: def.table,
      writeMode: def.writeMode,
      primaryKey: def.primaryKey ? def.primaryKey.slice() : [],
      dependsOn: def.dependsOn ? def.dependsOn.slice() : [],
      aliases: def.sheetAliases ? def.sheetAliases.slice() : []
    };
  });
}

function migracionLegacySupabaseDryRun(options) {
  const opts = legacySupabaseOptions_(options);
  opts.dryRun = true;
  return migracionLegacySupabaseEjecutar(opts);
}

function migracionLegacySupabaseCompararTabla(sheetOrTable, options) {
  const def = legacySupabaseFindDef_(sheetOrTable);
  if (!def) {
    throw new Error('No se encontro una definicion de migracion para: ' + sheetOrTable);
  }
  const opts = legacySupabaseOptions_(options);
  const ss = legacySupabaseGetSourceSpreadsheet_(opts.spreadsheetId);
  const report = legacySupabaseCompareDef_(ss, def);
  legacySupabaseLog_('COMPARE ' + def.sheetName, report);
  return report;
}

function migracionLegacySupabaseCompararAprobaciones() {
  return migracionLegacySupabaseCompararTabla('Aprobaciones');
}

function migracionLegacySupabaseCompararHistorialBoletas() {
  const ss = legacySupabaseGetSourceSpreadsheet_('');
  const defs = legacySupabaseSelectDefs_(['Aprobaciones', 'Detalle_Cobros', 'Bitacora', 'Notificaciones', 'Aprobaciones_Criticas']);
  const out = {
    success: true,
    startedAt: new Date().toISOString(),
    tables: []
  };
  for (let i = 0; i < defs.length; i++) {
    const report = legacySupabaseCompareDef_(ss, defs[i]);
    if (!report.ok) out.success = false;
    out.tables.push(report);
  }
  out.finishedAt = new Date().toISOString();
  legacySupabaseLog_('COMPARE HISTORIAL_BOLETAS', out);
  return out;
}

function migracionLegacySupabaseDryRunUsuarios() {
  return migracionLegacySupabaseTabla('Usuarios', { dryRun: true });
}

function migracionLegacySupabaseMigrarUsuarios() {
  return migracionLegacySupabaseTabla('Usuarios');
}

function migracionLegacySupabaseDryRunPilotos() {
  return migracionLegacySupabaseTabla('Pilotos', { dryRun: true });
}

function migracionLegacySupabaseMigrarPilotos() {
  return migracionLegacySupabaseTabla('Pilotos');
}

function migracionLegacySupabaseDryRunAprobaciones() {
  return migracionLegacySupabaseTabla('Aprobaciones', { dryRun: true });
}

function migracionLegacySupabaseMigrarAprobaciones() {
  return migracionLegacySupabaseTabla('Aprobaciones');
}

function migracionLegacySupabaseDryRunDetalleCobros() {
  return migracionLegacySupabaseTabla('Detalle_Cobros', { dryRun: true, ignoreDependencies: true });
}

function migracionLegacySupabaseMigrarDetalleCobros() {
  return migracionLegacySupabaseTabla('Detalle_Cobros', { ignoreDependencies: true });
}

function migracionLegacySupabaseDryRunBitacora() {
  return migracionLegacySupabaseTabla('Bitacora', { dryRun: true });
}

function migracionLegacySupabaseMigrarBitacora() {
  return migracionLegacySupabaseTabla('Bitacora');
}

function migracionLegacySupabaseDryRunHistorialBoletas() {
  return migracionLegacySupabaseEjecutar({
    dryRun: true,
    only: ['Aprobaciones', 'Detalle_Cobros', 'Bitacora', 'Notificaciones', 'Aprobaciones_Criticas']
  });
}

function migracionLegacySupabaseMigrarHistorialBoletas() {
  return migracionLegacySupabaseEjecutar({
    only: ['Aprobaciones', 'Detalle_Cobros', 'Bitacora', 'Notificaciones', 'Aprobaciones_Criticas']
  });
}

function migracionLegacySupabaseRecalcularMontosCobros(options) {
  const opts = (options && typeof options === 'object') ? options : {};
  const targetRows = legacySupabaseListAll_('ct_cobros', {
    select: 'id,total_cobro',
    total_cobro: 'eq.0'
  }, 1000);
  const targetSet = {};
  for (let i = 0; i < targetRows.length; i++) {
    const id = String(targetRows[i] && targetRows[i].id || '').trim();
    if (id) targetSet[id] = true;
  }

  const onlyIds = Array.isArray(opts.onlyIds) ? opts.onlyIds : [];
  if (onlyIds.length) {
    const filtered = {};
    for (let j = 0; j < onlyIds.length; j++) {
      const onlyId = String(onlyIds[j] || '').trim();
      if (onlyId && targetSet[onlyId]) filtered[onlyId] = true;
    }
    for (const key in targetSet) {
      if (!filtered[key]) delete targetSet[key];
    }
  }

  const targetIds = Object.keys(targetSet);
  if (!targetIds.length) {
    return {
      success: true,
      scannedCobros: targetRows.length,
      updated: 0,
      dryRun: !!opts.dryRun,
      rows: []
    };
  }

  const itemRows = legacySupabaseListAll_('ct_cobro_items', {
    select: 'cobro_id,subtotal,cantidad,precio'
  }, 1000);
  const subtotalByCobro = {};
  for (let k = 0; k < itemRows.length; k++) {
    const item = itemRows[k] || {};
    const cobroId = String(item.cobro_id || '').trim();
    if (!cobroId || !targetSet[cobroId]) continue;
    const subtotal = Number(item.subtotal != null ? item.subtotal : (Number(item.cantidad || 0) * Number(item.precio || 0)) || 0);
    subtotalByCobro[cobroId] = Number(subtotalByCobro[cobroId] || 0) + subtotal;
  }

  const rows = [];
  for (let m = 0; m < targetIds.length; m++) {
    const id = targetIds[m];
    const total = Number(subtotalByCobro[id] || 0);
    if (!(total > 0)) continue;
    rows.push({
      id: id,
      total_cobro: Math.round(total * 100) / 100
    });
  }

  if (!opts.dryRun && rows.length) {
    const batches = legacySupabaseChunk_(rows, opts.batchSize || LEGACY_SUPABASE_DEFAULT_BATCH_SIZE);
    for (let n = 0; n < batches.length; n++) {
      legacySupabaseUpsertRows_('ct_cobros', batches[n], ['id']);
    }
  }

  const out = {
    success: true,
    scannedCobros: targetRows.length,
    candidates: targetIds.length,
    updated: rows.length,
    dryRun: !!opts.dryRun,
    rows: rows.slice(0, 50)
  };
  legacySupabaseLog_('RECALCULAR_MONTOS_COBROS', out);
  return out;
}

function migracionLegacySupabaseRecalcularEtapasCobros(options) {
  const opts = (options && typeof options === 'object') ? options : {};
  const rows = legacySupabaseListAll_('ct_cobros', {
    select: [
      'id,etapa,estado,area_responsable_actual,boleta_firmada_url,firma_boleta_url,inventario_status,ov_numero,ruta_id,',
      'factura_numero,factura_url,firma_factura_url,liquidacion_ref,constancia_pago_url'
    ].join('')
  }, 1000);
  const updates = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] || {};
    const currentStageIdx = legacySupabaseCobroStageIndex_(row.etapa);
    const info = legacySupabaseInferCobroStage_(row);
    if (!(info.stageIndex > currentStageIdx)) continue;

    const update = {
      id: row.id,
      etapa: info.stage,
      estado: legacySupabaseCobroMacroEstado_(info.stageIndex)
    };
    if (!legacySupabaseIsBlankStored_(info.area)) {
      update.area_responsable_actual = info.area;
    }
    updates.push(update);
  }

  if (!opts.dryRun && updates.length) {
    for (let j = 0; j < updates.length; j++) {
      legacySupabaseRequest_('patch', 'ct_cobros', { id: 'eq.' + updates[j].id }, updates[j], {
        Prefer: 'return=minimal'
      });
    }
  }

  const out = {
    success: true,
    dryRun: !!opts.dryRun,
    scanned: rows.length,
    updated: updates.length,
    rows: updates.slice(0, 50)
  };
  legacySupabaseLog_('RECALCULAR_ETAPAS_COBROS', out);
  return out;
}

function migracionLegacySupabaseTabla(sheetOrTable, options) {
  const def = legacySupabaseFindDef_(sheetOrTable);
  if (!def) {
    throw new Error('No se encontro una definicion de migracion para: ' + sheetOrTable);
  }
  const opts = legacySupabaseOptions_(options);
  opts.only = [def.sheetName];
  return migracionLegacySupabaseEjecutar(opts);
}

function migracionLegacySupabaseEjecutar(options) {
  const opts = legacySupabaseOptions_(options);
  const ss = legacySupabaseGetSourceSpreadsheet_(opts.spreadsheetId);
  const defs = legacySupabaseSelectDefs_(opts.only);
  const plannedBySheet = {};
  for (let p = 0; p < defs.length; p++) {
    plannedBySheet[defs[p].sheetName] = true;
  }
  const summary = {
    success: true,
    dryRun: !!opts.dryRun,
    ignoreDependencies: !!opts.ignoreDependencies,
    mode: String(opts.mode || '').trim() || 'replace',
    compareBeforeWrite: !!opts.compareBeforeWrite,
    batchSize: opts.batchSize,
    spreadsheetId: ss.getId(),
    spreadsheetName: ss.getName(),
    startedAt: new Date().toISOString(),
    tables: [],
    totals: {
      tablesPlanned: defs.length,
      tablesProcessed: 0,
      migrated: 0,
      skippedRows: 0,
      skippedTables: 0,
      errors: 0,
      warnings: 0
    }
  };

  const completedBySheet = {};
  for (let i = 0; i < defs.length; i++) {
    const def = defs[i];
    let result;
    try {
      result = legacySupabaseMigrateDef_(ss, def, opts, completedBySheet, plannedBySheet);
    } catch (err) {
      result = {
        success: false,
        skipped: false,
        sheetName: def.sheetName,
        table: def.table,
        mode: String(opts.mode || def.writeMode || 'replace').trim().toLowerCase(),
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        sourceRows: 0,
        migrated: 0,
        skippedRows: 0,
        warnings: [String(err && err.message ? err.message : err)]
      };
    }
    summary.tables.push(result);
    summary.totals.tablesProcessed++;
    summary.totals.migrated += Number(result.migrated || 0);
    summary.totals.skippedRows += Number(result.skippedRows || 0);
    summary.totals.warnings += Number((result.warnings || []).length || 0);
    if (result.skipped) summary.totals.skippedTables++;
    if (!result.success) {
      summary.success = false;
      summary.totals.errors++;
    }
    completedBySheet[def.sheetName] = result;
  }

  summary.finishedAt = new Date().toISOString();
  legacySupabaseLog_('SUMMARY', summary);
  return summary;
}

function legacySupabaseMigrateDef_(ss, def, opts, completedBySheet, plannedBySheet) {
  const mode = String(opts.mode || def.writeMode || 'replace').trim().toLowerCase();
  const started = new Date();
  const depProblem = opts.ignoreDependencies ? '' : legacySupabaseCheckDependencies_(def, completedBySheet || {}, plannedBySheet || {});
  if (depProblem) {
    return {
      success: true,
      skipped: true,
      sheetName: def.sheetName,
      table: def.table,
      mode: mode,
      startedAt: started.toISOString(),
      finishedAt: new Date().toISOString(),
      message: depProblem,
      sourceRows: 0,
      migrated: 0,
      skippedRows: 0,
      warnings: []
    };
  }

  const sheet = legacySupabaseFindSheet_(ss, def);
  if (!sheet) {
    return {
      success: true,
      skipped: true,
      sheetName: def.sheetName,
      table: def.table,
      mode: mode,
      startedAt: started.toISOString(),
      finishedAt: new Date().toISOString(),
      message: 'Hoja origen no encontrada.',
      sourceRows: 0,
      migrated: 0,
      skippedRows: 0,
      warnings: []
    };
  }

  const comparison = opts.compareBeforeWrite ? legacySupabaseCompareDefWithSheet_(sheet, def) : null;
  if (comparison && !comparison.ok) {
    return {
      success: false,
      skipped: false,
      sheetName: def.sheetName,
      sourceSheet: sheet.getName(),
      table: def.table,
      mode: mode,
      startedAt: started.toISOString(),
      finishedAt: new Date().toISOString(),
      sourceRows: Number(comparison.sourceRowCount || 0),
      migrated: 0,
      skippedRows: 0,
      warnings: legacySupabaseComparisonWarnings_(comparison),
      comparison: comparison
    };
  }

  const values = sheet.getDataRange().getValues();
  const headers = values.length ? values[0] : [];
  const rows = values.length > 1 ? values.slice(1) : [];
  const mapped = [];
  const warnings = [];
  let skippedRows = 0;

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    const mappedRow = legacySupabaseBuildRecord_(def, headers, row, r + 2);
    legacySupabasePushWarnings_(warnings, mappedRow.warnings);
    if (mappedRow.empty) continue;
    if (mappedRow.skip) {
      skippedRows++;
      continue;
    }
    mapped.push(mappedRow.record);
  }

  const prepared = legacySupabasePreparePayload_(def, mapped, warnings);
  if (rows.length && !prepared.length) {
    legacySupabasePushWarning_(
      warnings,
      'No se migraron filas de ' + def.sheetName + '. Revise encabezados, posiciones legacy y campos requeridos.'
    );
  }
  if (!opts.dryRun) {
    legacySupabaseWritePayload_(def, prepared, mode, opts.batchSize);
  }

  const out = {
    success: true,
    skipped: false,
    sheetName: def.sheetName,
    sourceSheet: sheet.getName(),
    table: def.table,
    mode: mode,
    startedAt: started.toISOString(),
    finishedAt: new Date().toISOString(),
    sourceRows: rows.length,
    migrated: prepared.length,
    skippedRows: skippedRows,
    warnings: warnings,
    comparison: comparison
  };
  legacySupabaseLog_('TABLE ' + def.sheetName, out);
  return out;
}

function legacySupabasePreparePayload_(def, records, warnings) {
  if (!def.primaryKey || !def.primaryKey.length) return records.slice();
  const map = {};
  const order = [];
  let duplicateCount = 0;
  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    if (!legacySupabaseHasPrimaryKey_(record, def.primaryKey)) continue;
    const key = legacySupabasePrimaryKeyString_(record, def.primaryKey);
    if (!Object.prototype.hasOwnProperty.call(map, key)) {
      order.push(key);
    } else {
      duplicateCount++;
    }
    map[key] = record;
  }
  if (duplicateCount) {
    legacySupabasePushWarning_(warnings, 'Se detectaron ' + duplicateCount + ' duplicados en ' + def.sheetName + '; se conservo la ultima fila por PK.');
  }
  const out = [];
  for (let j = 0; j < order.length; j++) {
    out.push(map[order[j]]);
  }
  return out;
}

function legacySupabaseWritePayload_(def, records, mode, batchSize) {
  const normalizedRecords = legacySupabaseNormalizeRecordsForWrite_(def, records);
  const batches = legacySupabaseChunk_(normalizedRecords, batchSize || LEGACY_SUPABASE_DEFAULT_BATCH_SIZE);
  if (mode === 'replace') {
    legacySupabaseDeleteAll_(def);
    for (let i = 0; i < batches.length; i++) {
      legacySupabaseInsertRows_(def.table, batches[i]);
    }
    return;
  }

  if (mode === 'upsert') {
    if (!def.primaryKey || !def.primaryKey.length) {
      throw new Error('La tabla ' + def.table + ' no soporta upsert sin PK definida en el script.');
    }
    for (let j = 0; j < batches.length; j++) {
      legacySupabaseUpsertRows_(def.table, batches[j], def.primaryKey);
    }
    return;
  }

  throw new Error('Modo de escritura no soportado: ' + mode);
}

function legacySupabaseNormalizeRecordsForWrite_(def, records) {
  const list = Array.isArray(records) ? records : [];
  if (!list.length) return [];

  const allowedFields = [];
  const seen = {};
  const cols = (def && Array.isArray(def.columns)) ? def.columns : [];
  for (let i = 0; i < cols.length; i++) {
    const field = String(cols[i] && cols[i].field || '').trim();
    if (!field || seen[field]) continue;
    seen[field] = true;
    allowedFields.push(field);
  }

  if (!allowedFields.length) {
    const fallbackKeys = {};
    for (let j = 0; j < list.length; j++) {
      const keys = Object.keys(list[j] || {});
      for (let k = 0; k < keys.length; k++) fallbackKeys[keys[k]] = true;
    }
    return list.map(function (record) {
      return legacySupabaseNormalizeRecordShape_(record, Object.keys(fallbackKeys));
    });
  }

  return list.map(function (record) {
    return legacySupabaseNormalizeRecordShape_(record, allowedFields);
  });
}

function legacySupabaseNormalizeRecordShape_(record, orderedFields) {
  const src = record || {};
  const out = {};
  for (let i = 0; i < orderedFields.length; i++) {
    const field = orderedFields[i];
    if (Object.prototype.hasOwnProperty.call(src, field)) out[field] = src[field] === undefined ? null : src[field];
    else out[field] = null;
  }
  return out;
}

function legacySupabaseDeleteAll_(def) {
  const filter = def.deleteFilter || legacySupabaseDefaultDeleteFilter_(def);
  const query = {};
  query[filter.field] = filter.op;
  legacySupabaseRequest_('delete', def.table, query, null, {
    Prefer: 'return=minimal'
  });
}

function legacySupabaseDefaultDeleteFilter_(def) {
  if (def.primaryKey && def.primaryKey.length) {
    return {
      field: def.primaryKey[0],
      op: 'not.is.null'
    };
  }
  throw new Error('No se pudo determinar deleteFilter para ' + def.table);
}

function legacySupabaseInsertRows_(table, rows) {
  if (!rows || !rows.length) return null;
  return legacySupabaseRequest_('post', table, {}, rows, {
    Prefer: 'return=minimal'
  });
}

function legacySupabaseUpsertRows_(table, rows, primaryKey) {
  if (!rows || !rows.length) return null;
  return legacySupabaseRequest_('post', table, {
    on_conflict: primaryKey.join(',')
  }, rows, {
    Prefer: 'resolution=merge-duplicates,return=minimal'
  });
}

function legacySupabaseBuildRecord_(def, headers, row, rowNum) {
  const headerMap = legacySupabaseBuildHeaderMap_(headers || []);
  const record = {};
  const warnings = [];

  for (let i = 0; i < def.columns.length; i++) {
    const col = def.columns[i];
    const cell = legacySupabaseReadColumn_(row, headerMap, col);
    const converted = legacySupabaseConvertValue_(cell, col, warnings, rowNum, def.sheetName);
    if (converted === LEGACY_SUPABASE_OMIT) continue;
    record[col.field] = converted;
  }

  legacySupabaseApplyRecordDefaults_(def, record);

  if (!legacySupabaseRecordHasData_(record)) {
    return {
      empty: true,
      skip: false,
      record: null,
      warnings: warnings
    };
  }

  const missing = legacySupabaseMissingRequired_(def, record);
  if (missing.length) {
    legacySupabasePushWarning_(warnings, 'Fila ' + rowNum + ' omitida en ' + def.sheetName + ' por campos requeridos faltantes: ' + missing.join(', '));
    return {
      empty: false,
      skip: true,
      record: null,
      warnings: warnings
    };
  }

  if (def.primaryKey && def.primaryKey.length && !legacySupabaseHasPrimaryKey_(record, def.primaryKey)) {
    legacySupabasePushWarning_(warnings, 'Fila ' + rowNum + ' omitida en ' + def.sheetName + ' por PK incompleta.');
    return {
      empty: false,
      skip: true,
      record: null,
      warnings: warnings
    };
  }

  return {
    empty: false,
    skip: false,
    record: record,
    warnings: warnings
  };
}

function legacySupabaseApplyRecordDefaults_(def, record) {
  if (!def || !record) return record;

  if (String(def.table || '') === 'ct_cobros') {
    if (legacySupabaseIsBlankStored_(record.ultima_actualizacion)) {
      record.ultima_actualizacion = record.fecha_registro || new Date().toISOString();
    }
    if (legacySupabaseIsBlankStored_(record.country_code)) {
      record.country_code = 'PE';
    }
    if (legacySupabaseIsBlankStored_(record.country_name)) {
      record.country_name = 'Peru';
    }
    if (legacySupabaseIsBlankStored_(record.pdf_url)) {
      record.pdf_url = String(record.boleta_firmada_url || record.firma_boleta_url || '').trim();
    }
    legacySupabaseApplyCobroStageDefaults_(record);
  }

  return record;
}

function legacySupabaseApplyCobroStageDefaults_(record) {
  const info = legacySupabaseInferCobroStage_(record);
  const currentIdx = legacySupabaseCobroStageIndex_(record.etapa);
  if ((!currentIdx || currentIdx === 1) && info.stageIndex > currentIdx) {
    record.etapa = info.stage;
  } else if (currentIdx > 0) {
    record.etapa = legacySupabaseCobroStageName_(currentIdx);
  }

  if (legacySupabaseIsBlankStored_(record.area_responsable_actual) && info.area) {
    record.area_responsable_actual = info.area;
  }

  if (legacySupabaseIsBlankStored_(record.estado)) {
    record.estado = legacySupabaseCobroMacroEstado_(legacySupabaseCobroStageIndex_(record.etapa));
  } else {
    const estado = String(record.estado || '').trim().toLowerCase();
    if ((estado === 'abierto' || estado === 'open') && legacySupabaseCobroStageIndex_(record.etapa) > 1) {
      record.estado = legacySupabaseCobroMacroEstado_(legacySupabaseCobroStageIndex_(record.etapa));
    }
  }

  return record;
}

function legacySupabaseInferCobroStage_(record) {
  const row = record || {};
  const boletaFirmada = String(row.boleta_firmada_url || row.firma_boleta_url || '').trim();
  const inventarioStatus = String(row.inventario_status || '').trim();
  const ovNumero = String(row.ov_numero || '').trim();
  const rutaId = String(row.ruta_id || '').trim();
  const facturaNumero = String(row.factura_numero || '').trim();
  const facturaUrl = String(row.factura_url || '').trim();
  const firmaFactura = String(row.firma_factura_url || '').trim();
  const liquidacionRef = String(row.liquidacion_ref || '').trim();
  const constanciaPagoUrl = String(row.constancia_pago_url || '').trim();
  const areaKey = legacySupabaseNormalizeKey_(row.area_responsable_actual || '');
  const inventarioOk = inventarioStatus && /^(ok|ajuste|no hay)/i.test(inventarioStatus);
  let stageIndex = 1;

  if (constanciaPagoUrl) stageIndex = 10;
  else if (liquidacionRef) stageIndex = 9;
  else if (firmaFactura) stageIndex = 8;
  else if (facturaNumero || facturaUrl) stageIndex = 7;
  else if (rutaId) stageIndex = 6;
  else if (ovNumero) stageIndex = 5;
  else if (inventarioOk) stageIndex = 4;
  else if (boletaFirmada) stageIndex = 3;

  if (areaKey === legacySupabaseNormalizeKey_('Proveedor (seguimiento Transporte)')) {
    stageIndex = (facturaNumero || facturaUrl || firmaFactura || liquidacionRef || constanciaPagoUrl) ? 7 : 2;
  } else if (areaKey === legacySupabaseNormalizeKey_('Inventario')) {
    stageIndex = 3;
  } else if (areaKey === legacySupabaseNormalizeKey_('Facturacion')) {
    stageIndex = 6;
  } else if (areaKey === legacySupabaseNormalizeKey_('Transporte')) {
    stageIndex = (liquidacionRef && !constanciaPagoUrl) ? 9 : 5;
  } else if (areaKey === legacySupabaseNormalizeKey_('Creditos y Cobros')) {
    if (constanciaPagoUrl) stageIndex = 10;
    else if (firmaFactura || liquidacionRef) stageIndex = 8;
    else stageIndex = 4;
  }

  return {
    stageIndex: stageIndex,
    stage: legacySupabaseCobroStageName_(stageIndex),
    area: legacySupabaseCobroAreaByStage_(stageIndex)
  };
}

function legacySupabaseCobroStageName_(stageIndex) {
  const idx = Math.max(1, Math.min(LEGACY_SUPABASE_ETAPAS_COBRO.length, Number(stageIndex || 1)));
  return LEGACY_SUPABASE_ETAPAS_COBRO[idx - 1];
}

function legacySupabaseCobroStageIndex_(stageValue) {
  const text = String(stageValue || '').trim();
  if (!text) return 0;
  const normalized = legacySupabaseNormalizeKey_(text);
  for (let i = 0; i < LEGACY_SUPABASE_ETAPAS_COBRO.length; i++) {
    if (legacySupabaseNormalizeKey_(LEGACY_SUPABASE_ETAPAS_COBRO[i]) === normalized) return i + 1;
  }
  const match = text.match(/^(\d+)\./);
  if (match) {
    const num = Number(match[1]);
    if (num >= 1 && num <= LEGACY_SUPABASE_ETAPAS_COBRO.length) return num;
  }
  return 0;
}

function legacySupabaseCobroAreaByStage_(stageIndex) {
  const idx = Number(stageIndex || 0);
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
  return '';
}

function legacySupabaseCobroMacroEstado_(stageIndex) {
  const idx = Number(stageIndex || 0);
  if (idx <= 1) return 'Abierto';
  if (idx === 2 || idx === 7) return 'En firma';
  if (idx >= 3 && idx <= LEGACY_SUPABASE_ETAPAS_COBRO.length) return 'En proceso';
  return 'Abierto';
}

function legacySupabaseCompareDef_(ss, def) {
  const sheet = legacySupabaseFindSheet_(ss, def);
  return legacySupabaseCompareDefWithSheet_(sheet, def);
}

function legacySupabaseCompareDefWithSheet_(sheet, def) {
  const out = {
    ok: true,
    sheetName: def.sheetName,
    sourceSheetFound: !!sheet,
    sourceSheet: sheet ? sheet.getName() : '',
    sourceRowCount: sheet ? Math.max(0, sheet.getLastRow() - 1) : 0,
    sourceHeaders: [],
    table: def.table,
    targetColumns: [],
    mappedFields: [],
    requiredSourceMissing: [],
    optionalSourceMissing: [],
    targetMissingColumns: [],
    targetExtraColumns: [],
    errors: []
  };

  if (!sheet) {
    out.ok = false;
    out.errors.push('Hoja origen no encontrada.');
    return out;
  }

  const lastCol = Math.max(1, sheet.getLastColumn());
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0] || [];
  const headerMap = legacySupabaseBuildHeaderMap_(headers);
  out.sourceHeaders = headers.slice();

  try {
    out.targetColumns = legacySupabaseGetTableColumns_(def.table);
  } catch (err) {
    out.ok = false;
    out.errors.push(String(err && err.message ? err.message : err));
    return out;
  }

  const targetSet = {};
  for (let i = 0; i < out.targetColumns.length; i++) {
    targetSet[out.targetColumns[i]] = true;
  }

  const fieldSet = {};
  for (let j = 0; j < def.columns.length; j++) {
    const col = def.columns[j];
    const sourceInfo = legacySupabaseDescribeSourceMatch_(headers, headerMap, col);
    const targetExists = !!targetSet[col.field];
    fieldSet[col.field] = true;
    out.mappedFields.push({
      field: col.field,
      required: !!col.required,
      targetExists: targetExists,
      source: sourceInfo
    });
    if (!targetExists) out.targetMissingColumns.push(col.field);
    if (!sourceInfo.usable) {
      const miss = {
        field: col.field,
        required: !!col.required,
        expectedHeaders: sourceInfo.expectedHeaders,
        fallbackColumns: sourceInfo.fallbackColumns
      };
      if (col.required) out.requiredSourceMissing.push(miss);
      else out.optionalSourceMissing.push(miss);
    }
  }

  for (let k = 0; k < out.targetColumns.length; k++) {
    const targetCol = out.targetColumns[k];
    if (!fieldSet[targetCol]) out.targetExtraColumns.push(targetCol);
  }

  if (out.targetMissingColumns.length || out.requiredSourceMissing.length || out.errors.length) {
    out.ok = false;
  }
  return out;
}

function legacySupabaseReadColumn_(row, headerMap, col) {
  const aliases = (col.aliases && col.aliases.length) ? col.aliases : [col.header];
  for (let i = 0; i < aliases.length; i++) {
    const idx = headerMap[legacySupabaseNormalizeKey_(aliases[i])];
    if (idx != null) {
      return {
        found: true,
        value: idx < row.length ? row[idx] : ''
      };
    }
  }

  const fallbackIndexes = [];
  if (col.fallbackIndex != null) fallbackIndexes.push(col.fallbackIndex);
  if (Array.isArray(col.fallbackIndexes) && col.fallbackIndexes.length) {
    for (let j = 0; j < col.fallbackIndexes.length; j++) {
      fallbackIndexes.push(col.fallbackIndexes[j]);
    }
  }
  for (let k = 0; k < fallbackIndexes.length; k++) {
    const rawIdx = Number(fallbackIndexes[k]);
    if (isNaN(rawIdx) || rawIdx < 0) continue;
    return {
      found: true,
      value: rawIdx < row.length ? row[rawIdx] : ''
    };
  }

  return {
    found: false,
    value: ''
  };
}

function legacySupabaseDescribeSourceMatch_(headers, headerMap, col) {
  const aliases = (col.aliases && col.aliases.length) ? col.aliases.slice() : [col.header];
  for (let i = 0; i < aliases.length; i++) {
    const idx = headerMap[legacySupabaseNormalizeKey_(aliases[i])];
    if (idx != null) {
      return {
        usable: true,
        kind: 'header',
        matchedHeader: String(headers[idx] || aliases[i]),
        columnIndex: idx,
        columnNumber: idx + 1,
        columnLabel: legacySupabaseColumnLabel_(idx + 1),
        expectedHeaders: aliases,
        fallbackColumns: legacySupabaseFallbackColumnLabels_(col)
      };
    }
  }

  const fallbackIndexes = legacySupabaseFallbackIndexes_(col);
  for (let j = 0; j < fallbackIndexes.length; j++) {
    const idx2 = fallbackIndexes[j];
    if (idx2 >= 0 && idx2 < headers.length) {
      return {
        usable: true,
        kind: 'position',
        matchedHeader: String(headers[idx2] || ''),
        columnIndex: idx2,
        columnNumber: idx2 + 1,
        columnLabel: legacySupabaseColumnLabel_(idx2 + 1),
        expectedHeaders: aliases,
        fallbackColumns: legacySupabaseFallbackColumnLabels_(col)
      };
    }
  }

  if (Object.prototype.hasOwnProperty.call(col, 'defaultValue')) {
    return {
      usable: true,
      kind: 'default',
      matchedHeader: '',
      columnIndex: -1,
      columnNumber: 0,
      columnLabel: '',
      expectedHeaders: aliases,
      fallbackColumns: legacySupabaseFallbackColumnLabels_(col)
    };
  }

  if (col.omitIfBlank) {
    return {
      usable: true,
      kind: 'omit_if_blank',
      matchedHeader: '',
      columnIndex: -1,
      columnNumber: 0,
      columnLabel: '',
      expectedHeaders: aliases,
      fallbackColumns: legacySupabaseFallbackColumnLabels_(col)
    };
  }

  return {
    usable: false,
    kind: 'missing',
    matchedHeader: '',
    columnIndex: -1,
    columnNumber: 0,
    columnLabel: '',
    expectedHeaders: aliases,
    fallbackColumns: legacySupabaseFallbackColumnLabels_(col)
  };
}

function legacySupabaseConvertValue_(cell, col, warnings, rowNum, sheetName) {
  const found = !!cell.found;
  let value = cell.value;
  if (!found) {
    if (Object.prototype.hasOwnProperty.call(col, 'defaultValue')) {
      value = legacySupabaseClone_(col.defaultValue);
    } else {
      return LEGACY_SUPABASE_OMIT;
    }
  }

  if (legacySupabaseIsBlankInput_(value)) {
    if (Object.prototype.hasOwnProperty.call(col, 'defaultValue')) {
      value = legacySupabaseClone_(col.defaultValue);
    } else if (col.omitIfBlank) {
      return LEGACY_SUPABASE_OMIT;
    }
  }

  const type = String(col.type || 'text').toLowerCase();
  if (type === 'text') return String(value == null ? '' : value).trim();
  if (type === 'bool') return legacySupabaseParseBool_(value, !!col.defaultValue);
  if (type === 'number') return legacySupabaseParseNumber_(value, Number(col.defaultValue || 0));
  if (type === 'int') return Math.round(legacySupabaseParseNumber_(value, Number(col.defaultValue || 0)));
  if (type === 'timestamp') return legacySupabaseFormatTimestamp_(value, col, warnings, rowNum, sheetName);
  if (type === 'date') return legacySupabaseFormatDateOnly_(value, col, warnings, rowNum, sheetName);
  if (type === 'json_array') return legacySupabaseParseJsonArray_(value);
  if (type === 'json_object') return legacySupabaseParseJsonObject_(value);
  return String(value == null ? '' : value).trim();
}

function legacySupabaseFormatTimestamp_(value, col, warnings, rowNum, sheetName) {
  if (legacySupabaseIsBlankInput_(value)) {
    if (col.omitIfBlank) return LEGACY_SUPABASE_OMIT;
    return null;
  }
  const dateObj = legacySupabaseParseDateObject_(value);
  if (!dateObj) {
    legacySupabasePushWarning_(warnings, 'Fila ' + rowNum + ' en ' + sheetName + ': fecha/hora invalida "' + value + '" para ' + col.field + '.');
    return col.omitIfBlank ? LEGACY_SUPABASE_OMIT : null;
  }
  return dateObj.toISOString();
}

function legacySupabaseFormatDateOnly_(value, col, warnings, rowNum, sheetName) {
  if (legacySupabaseIsBlankInput_(value)) {
    if (col.omitIfBlank) return LEGACY_SUPABASE_OMIT;
    return null;
  }
  const dateObj = legacySupabaseParseDateObject_(value);
  if (!dateObj) {
    legacySupabasePushWarning_(warnings, 'Fila ' + rowNum + ' en ' + sheetName + ': fecha invalida "' + value + '" para ' + col.field + '.');
    return col.omitIfBlank ? LEGACY_SUPABASE_OMIT : null;
  }
  return legacySupabaseYmd_(dateObj);
}

function legacySupabaseParseDateObject_(value) {
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }

  const text = String(value == null ? '' : value).trim();
  if (!text) return null;

  const direct = new Date(text);
  if (!isNaN(direct.getTime())) return direct;

  let match = text.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (match) {
    return new Date(
      Number(match[3]),
      Number(match[2]) - 1,
      Number(match[1]),
      Number(match[4] || 0),
      Number(match[5] || 0),
      Number(match[6] || 0)
    );
  }

  match = text.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (match) {
    return new Date(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
      Number(match[4] || 0),
      Number(match[5] || 0),
      Number(match[6] || 0)
    );
  }

  return null;
}

function legacySupabaseParseJsonArray_(value) {
  if (legacySupabaseIsBlankInput_(value)) return [];
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') return [value];
  const text = String(value || '').trim();
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === 'object') return [parsed];
    return [{ raw: parsed }];
  } catch (e) {
    return [{ raw: text }];
  }
}

function legacySupabaseParseJsonObject_(value) {
  if (legacySupabaseIsBlankInput_(value)) return {};
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  if (Array.isArray(value)) return { items: value };
  const text = String(value || '').trim();
  if (!text) return {};
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return { items: parsed };
    if (parsed && typeof parsed === 'object') return parsed;
    return { raw: parsed };
  } catch (e) {
    return { raw: text };
  }
}

function legacySupabaseParseBool_(value, fallback) {
  if (value === true || value === false) return value;
  const text = String(value == null ? '' : value).trim().toLowerCase();
  if (!text) return !!fallback;
  if (text === '1' || text === 'true' || text === 'si' || text === 'yes' || text === 'on' || text === 'activo') return true;
  if (text === '0' || text === 'false' || text === 'no' || text === 'off' || text === 'inactivo') return false;
  return !!fallback;
}

function legacySupabaseParseNumber_(value, fallback) {
  if (typeof value === 'number') return isNaN(value) ? fallback : value;
  const text = String(value == null ? '' : value).trim();
  if (!text) return fallback;
  const normalized = text.replace(/\s/g, '').replace(/,/g, '');
  const num = Number(normalized);
  return isNaN(num) ? fallback : num;
}

function legacySupabaseMissingRequired_(def, record) {
  const out = [];
  for (let i = 0; i < def.columns.length; i++) {
    const col = def.columns[i];
    if (!col.required) continue;
    if (legacySupabaseIsBlankStored_(record[col.field])) out.push(col.field);
  }
  return out;
}

function legacySupabaseRecordHasData_(record) {
  const keys = Object.keys(record || {});
  for (let i = 0; i < keys.length; i++) {
    if (!legacySupabaseIsBlankStored_(record[keys[i]])) return true;
  }
  return false;
}

function legacySupabaseHasPrimaryKey_(record, primaryKey) {
  for (let i = 0; i < primaryKey.length; i++) {
    if (legacySupabaseIsBlankStored_(record[primaryKey[i]])) return false;
  }
  return true;
}

function legacySupabasePrimaryKeyString_(record, primaryKey) {
  return primaryKey.map(function (field) {
    return String(record[field] == null ? '' : record[field]);
  }).join('||');
}

function legacySupabaseBuildHeaderMap_(headers) {
  const out = {};
  for (let i = 0; i < headers.length; i++) {
    out[legacySupabaseNormalizeKey_(headers[i])] = i;
  }
  return out;
}

function legacySupabaseFindSheet_(ss, def) {
  const names = [def.sheetName].concat(def.sheetAliases || []);
  for (let i = 0; i < names.length; i++) {
    const exact = ss.getSheetByName(names[i]);
    if (exact) return exact;
  }

  const wanted = {};
  for (let j = 0; j < names.length; j++) {
    wanted[legacySupabaseNormalizeKey_(names[j])] = true;
  }
  const sheets = ss.getSheets();
  for (let k = 0; k < sheets.length; k++) {
    const sh = sheets[k];
    if (wanted[legacySupabaseNormalizeKey_(sh.getName())]) return sh;
  }
  return null;
}

function legacySupabaseGetSourceSpreadsheet_(spreadsheetId) {
  const sid = String(spreadsheetId || '').trim();
  if (sid) return SpreadsheetApp.openById(sid);
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (!active) throw new Error('No hay una hoja activa. Indica spreadsheetId en options.');
  return active;
}

function legacySupabaseConfig_() {
  legacySupabaseEnsureScriptProperties_();
  const props = PropertiesService.getScriptProperties();
  const url = String(props.getProperty(LEGACY_SUPABASE_URL_PROP) || LEGACY_SUPABASE_DEFAULT_URL).trim().replace(/\/+$/, '');
  const key = String(
    props.getProperty(LEGACY_SUPABASE_SERVICE_ROLE_KEY_PROP) ||
    props.getProperty(LEGACY_SUPABASE_SECRET_KEY_PROP) ||
    ''
  ).trim();
  if (!url) throw new Error('Falta SUPABASE_URL en Script Properties.');
  if (!key) throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY en Script Properties.');
  return {
    url: url,
    key: key,
    restUrl: url + '/rest/v1'
  };
}

function legacySupabaseOpenApiDoc_() {
  if (legacySupabaseOpenApiMemo_) return legacySupabaseOpenApiMemo_;
  const cfg = legacySupabaseConfig_();
  const response = UrlFetchApp.fetch(cfg.restUrl + '/', {
    method: 'get',
    muteHttpExceptions: true,
    headers: {
      apikey: cfg.key,
      Authorization: 'Bearer ' + cfg.key,
      Accept: 'application/openapi+json, application/json'
    }
  });
  const code = Number(response.getResponseCode() || 0);
  const raw = String(response.getContentText() || '');
  if (code < 200 || code >= 300) {
    throw new Error('No se pudo leer OpenAPI de Supabase: ' + code + ' | ' + raw.slice(0, 800));
  }
  legacySupabaseOpenApiMemo_ = JSON.parse(raw);
  return legacySupabaseOpenApiMemo_;
}

function legacySupabaseGetTableColumns_(table) {
  const doc = legacySupabaseOpenApiDoc_();
  const params = doc && doc.parameters ? doc.parameters : {};
  const prefix = 'rowFilter.' + String(table || '') + '.';
  const out = [];
  const seen = {};
  const keys = Object.keys(params);
  for (let i = 0; i < keys.length; i++) {
    if (keys[i].indexOf(prefix) !== 0) continue;
    const col = keys[i].slice(prefix.length);
    if (!col || seen[col]) continue;
    seen[col] = true;
    out.push(col);
  }
  if (!out.length) {
    throw new Error('No se encontraron columnas publicadas en Supabase para la tabla ' + table + '.');
  }
  return out;
}

function legacySupabaseEnsureScriptProperties_() {
  const props = PropertiesService.getScriptProperties();
  const currentUrl = String(props.getProperty(LEGACY_SUPABASE_URL_PROP) || '').trim();
  const currentServiceKey = String(
    props.getProperty(LEGACY_SUPABASE_SERVICE_ROLE_KEY_PROP) ||
    props.getProperty(LEGACY_SUPABASE_SECRET_KEY_PROP) ||
    ''
  ).trim();
  const updates = {};

  if (!currentUrl && LEGACY_SUPABASE_BOOTSTRAP_CONFIG.url) {
    updates[LEGACY_SUPABASE_URL_PROP] = String(LEGACY_SUPABASE_BOOTSTRAP_CONFIG.url).trim();
  }
  if (!currentServiceKey && LEGACY_SUPABASE_BOOTSTRAP_CONFIG.serviceRoleKey) {
    updates[LEGACY_SUPABASE_SERVICE_ROLE_KEY_PROP] = String(LEGACY_SUPABASE_BOOTSTRAP_CONFIG.serviceRoleKey).trim();
  }

  if (Object.keys(updates).length) {
    props.setProperties(updates, false);
  }
}

function legacySupabaseRequest_(method, path, query, payload, extraHeaders) {
  const cfg = legacySupabaseConfig_();
  let url = cfg.restUrl + '/' + String(path || '').replace(/^\/+/, '');
  const qs = legacySupabaseQueryString_(query || {});
  if (qs) url += qs;

  const headers = {
    apikey: cfg.key,
    Authorization: 'Bearer ' + cfg.key,
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'Accept-Profile': 'public',
    'Content-Profile': 'public'
  };
  const extra = extraHeaders || {};
  const extraKeys = Object.keys(extra);
  for (let i = 0; i < extraKeys.length; i++) {
    headers[extraKeys[i]] = extra[extraKeys[i]];
  }

  const options = {
    method: String(method || 'get').toLowerCase(),
    muteHttpExceptions: true,
    headers: headers
  };
  if (payload !== undefined && payload !== null) {
    options.payload = JSON.stringify(payload);
  }

  const response = UrlFetchApp.fetch(url, options);
  const code = Number(response.getResponseCode() || 0);
  const raw = String(response.getContentText() || '');
  if (code >= 200 && code < 300) {
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (e) {
      return raw;
    }
  }
  throw new Error('Supabase ' + method + ' ' + path + ' => ' + code + ' | ' + raw.slice(0, 1200));
}

function legacySupabaseQueryString_(query) {
  const keys = Object.keys(query || {});
  const parts = [];
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const value = query[key];
    if (value == null || value === '') continue;
    parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(String(value)));
  }
  return parts.length ? ('?' + parts.join('&')) : '';
}

function legacySupabaseSelectDefs_(only) {
  const defs = legacySupabaseMigrationDefs_();
  if (!only || !only.length) return defs.slice();
  const wanted = {};
  for (let i = 0; i < only.length; i++) {
    wanted[legacySupabaseNormalizeKey_(only[i])] = true;
  }
  return defs.filter(function (def) {
    return wanted[legacySupabaseNormalizeKey_(def.sheetName)] || wanted[legacySupabaseNormalizeKey_(def.table)];
  });
}

function legacySupabaseFindDef_(sheetOrTable) {
  const wanted = legacySupabaseNormalizeKey_(sheetOrTable);
  const defs = legacySupabaseMigrationDefs_();
  for (let i = 0; i < defs.length; i++) {
    const def = defs[i];
    if (legacySupabaseNormalizeKey_(def.sheetName) === wanted) return def;
    if (legacySupabaseNormalizeKey_(def.table) === wanted) return def;
  }
  return null;
}

function legacySupabaseCheckDependencies_(def, completedBySheet, plannedBySheet) {
  const deps = def.dependsOn || [];
  for (let i = 0; i < deps.length; i++) {
    const depName = deps[i];
    if (!plannedBySheet || !plannedBySheet[depName]) continue;
    const depResult = completedBySheet[depName];
    if (!depResult) return 'Dependencia no ejecutada: ' + depName;
    if (depResult.skipped) return 'Dependencia omitida: ' + depName;
    if (!depResult.success) return 'Dependencia con error: ' + depName;
  }
  return '';
}

function legacySupabaseOptions_(options) {
  const raw = (options && typeof options === 'object') ? options : {};
  const only = Array.isArray(raw.only) ? raw.only.slice() : [];
  return {
    spreadsheetId: String(raw.spreadsheetId || '').trim(),
    dryRun: !!raw.dryRun,
    ignoreDependencies: !!raw.ignoreDependencies,
    only: only,
    compareBeforeWrite: raw.compareBeforeWrite !== false,
    mode: String(raw.mode || '').trim() || 'replace',
    batchSize: Math.max(1, Math.min(1000, Number(raw.batchSize || LEGACY_SUPABASE_DEFAULT_BATCH_SIZE)))
  };
}

function legacySupabaseMigrationDefs_() {
  if (legacySupabaseMigrationDefsMemo_) return legacySupabaseMigrationDefsMemo_;

  const c = legacySupabaseCol_;
  legacySupabaseMigrationDefsMemo_ = [
    {
      sheetName: 'Config',
      sheetAliases: ['Configuracion'],
      table: 'ct_settings',
      writeMode: 'replace',
      primaryKey: ['setting_key'],
      columns: [
        c('Key', 'setting_key', 'text', { aliases: ['Key', 'Clave'], required: true }),
        c('Value', 'setting_value', 'text', { aliases: ['Value', 'Valor'], defaultValue: '' }),
        c('Description', 'description', 'text', { aliases: ['Description', 'Descripcion', 'Notas', 'Detalle'] }),
        c('UpdatedAt', 'updated_at', 'timestamp', { aliases: ['UpdatedAt', 'Actualizado', 'FechaActualizacion'], omitIfBlank: true })
      ]
    },
    {
      sheetName: 'Usuarios',
      table: 'ct_users',
      writeMode: 'replace',
      primaryKey: ['email'],
      columns: [
        c('Email', 'email', 'text', { aliases: ['Email', 'Correo', 'Mail'], required: true }),
        c('Nombre', 'nombre', 'text', { required: true }),
        c('Rol', 'rol', 'text', { aliases: ['Rol', 'Role'], required: true }),
        c('Password', 'password_hash', 'text', { aliases: ['Password', 'Clave', 'PasswordHash'], required: true }),
        c('Activo', 'activo', 'bool', { defaultValue: true }),
        c('Area', 'area', 'text', { aliases: ['Area', 'Departamento'] }),
        c('CountryCode', 'country_code', 'text', { aliases: ['CountryCode', 'Pais'], defaultValue: 'PE' })
      ]
    },
    {
      sheetName: 'Proveedores',
      sheetAliases: ['Proveedor'],
      table: 'ct_providers',
      writeMode: 'replace',
      primaryKey: ['codigo'],
      columns: [
        c('Codigo', 'codigo', 'text', { required: true }),
        c('Nombre', 'nombre', 'text', { required: true }),
        c('Correo', 'correo', 'text', { aliases: ['Correo', 'Email', 'Mail'] }),
        c('CountryCode', 'country_code', 'text', { aliases: ['CountryCode', 'Pais'], defaultValue: 'PE' })
      ]
    },
    {
      sheetName: 'Pilotos',
      sheetAliases: ['Piloto'],
      table: 'ct_pilots',
      writeMode: 'replace',
      primaryKey: ['dni'],
      columns: [
        c('DNI', 'dni', 'text', { required: true }),
        c('NOMBRE COMPLETO', 'nombre_completo', 'text', { aliases: ['NOMBRE COMPLETO', 'Nombre Completo', 'Nombre'], required: true }),
        c('CountryCode', 'country_code', 'text', { aliases: ['CountryCode', 'Pais'], defaultValue: 'PE' })
      ]
    },
    {
      sheetName: 'maestro',
      sheetAliases: ['tabla maestro', 'tabla_maestro', 'tablamaestro'],
      table: 'ct_master_items',
      writeMode: 'replace',
      primaryKey: ['codigo'],
      columns: [
        c('Codigo', 'codigo', 'text', { required: true }),
        c('Descripcion', 'descripcion', 'text', { aliases: ['Descripcion', 'Description'], required: true }),
        c('uxc', 'uxc', 'int', { aliases: ['uxc', 'UxC'], defaultValue: 0 }),
        c('Precio con IGV', 'precio_con_igv', 'number', { aliases: ['Precio con IGV', 'PrecioConIGV'], defaultValue: 0 }),
        c('Precio sin IGV', 'precio_sin_igv', 'number', { aliases: ['Precio sin IGV', 'PrecioSinIGV'], defaultValue: 0 }),
        c('EAN', 'ean', 'text'),
        c('Activo', 'activo', 'bool', { defaultValue: true }),
        c('CountryCode', 'country_code', 'text', { aliases: ['CountryCode', 'Pais'], defaultValue: 'PE' })
      ]
    },
    {
      sheetName: 'Plantillas',
      table: 'ct_notification_templates',
      writeMode: 'replace',
      primaryKey: ['codigo'],
      columns: [
        c('Codigo', 'codigo', 'text', { required: true }),
        c('Asunto', 'asunto', 'text', { aliases: ['Asunto', 'Subject'], required: true }),
        c('Cuerpo', 'cuerpo', 'text', { aliases: ['Cuerpo', 'Body'], required: true }),
        c('Activo', 'activo', 'bool', { defaultValue: true }),
        c('Notas', 'notas', 'text')
      ]
    },
    {
      sheetName: 'Correos',
      table: 'ct_area_emails',
      writeMode: 'replace',
      primaryKey: ['area'],
      columns: [
        c('Area', 'area', 'text', { required: true }),
        c('EmailTo', 'email_to', 'text', { aliases: ['EmailTo', 'MailTo', 'CorreoTo', 'To'] }),
        c('EmailCc', 'email_cc', 'text', { aliases: ['EmailCc', 'EmailCC', 'MailCc', 'CorreoCc', 'Cc'] }),
        c('Activo', 'activo', 'bool', { defaultValue: true }),
        c('Notas', 'notas', 'text')
      ]
    },
    {
      sheetName: 'CFG_COUNTRY',
      table: 'ct_cfg_countries',
      writeMode: 'replace',
      primaryKey: ['country_code'],
      columns: [
        c('CountryCode', 'country_code', 'text', { required: true }),
        c('Nombre', 'nombre', 'text', { required: true }),
        c('Moneda', 'moneda', 'text', { defaultValue: 'PEN' }),
        c('Timezone', 'timezone', 'text', { defaultValue: 'America/Lima' }),
        c('Locale', 'locale', 'text', { defaultValue: 'es-PE' }),
        c('Activo', 'activo', 'bool', { defaultValue: true }),
        c('UpdatedAt', 'updated_at', 'timestamp', { omitIfBlank: true })
      ]
    },
    {
      sheetName: 'CFG_ROLE',
      table: 'ct_cfg_roles',
      writeMode: 'replace',
      primaryKey: ['role_id'],
      columns: [
        c('RoleId', 'role_id', 'text', { required: true }),
        c('RoleKey', 'role_key', 'text', { required: true }),
        c('RoleName', 'role_name', 'text', { required: true }),
        c('Activo', 'activo', 'bool', { defaultValue: true }),
        c('UpdatedAt', 'updated_at', 'timestamp', { omitIfBlank: true })
      ]
    },
    {
      sheetName: 'CFG_USER_ROLE_SCOPE',
      table: 'ct_cfg_user_role_scopes',
      writeMode: 'replace',
      primaryKey: ['scope_id'],
      columns: [
        c('ScopeId', 'scope_id', 'text', { required: true }),
        c('UserEmail', 'user_email', 'text', { required: true }),
        c('RoleKey', 'role_key', 'text', { required: true }),
        c('CountryCode', 'country_code', 'text'),
        c('BusinessUnit', 'business_unit', 'text'),
        c('Activo', 'activo', 'bool', { defaultValue: true }),
        c('UpdatedAt', 'updated_at', 'timestamp', { omitIfBlank: true })
      ]
    },
    {
      sheetName: 'CFG_FLOW_STAGE',
      table: 'ct_cfg_flow_stages',
      writeMode: 'replace',
      primaryKey: ['process_key', 'stage_order'],
      columns: [
        c('ProcessKey', 'process_key', 'text', { required: true }),
        c('StageOrder', 'stage_order', 'int', { required: true }),
        c('StageCode', 'stage_code', 'text'),
        c('StageName', 'stage_name', 'text', { required: true }),
        c('RequiredFieldsJson', 'required_fields', 'json_array', { defaultValue: [] }),
        c('RequiredDocsJson', 'required_docs', 'json_array', { defaultValue: [] }),
        c('Active', 'activo', 'bool', { aliases: ['Active', 'Activo'], defaultValue: true })
      ]
    },
    {
      sheetName: 'CFG_STAGE_SLA',
      table: 'ct_cfg_stage_sla',
      writeMode: 'replace',
      primaryKey: ['process_key', 'stage_order'],
      columns: [
        c('ProcessKey', 'process_key', 'text', { required: true }),
        c('StageOrder', 'stage_order', 'int', { required: true }),
        c('StageName', 'stage_name', 'text', { required: true }),
        c('SlaHours', 'sla_hours', 'int', { defaultValue: 0 }),
        c('Activo', 'activo', 'bool', { defaultValue: false }),
        c('Notas', 'notas', 'text'),
        c('UpdatedAt', 'updated_at', 'timestamp', { omitIfBlank: true })
      ]
    },
    {
      sheetName: 'CFG_STAGE_NOTIFY',
      table: 'ct_cfg_stage_notify',
      writeMode: 'replace',
      primaryKey: ['process_key', 'stage_order'],
      columns: [
        c('ProcessKey', 'process_key', 'text', { required: true }),
        c('StageOrder', 'stage_order', 'int', { required: true }),
        c('StageName', 'stage_name', 'text', { required: true }),
        c('AreaTo', 'area_to', 'text'),
        c('CcAreas', 'cc_areas', 'text'),
        c('Activo', 'activo', 'bool', { defaultValue: true }),
        c('Notas', 'notas', 'text'),
        c('UpdatedAt', 'updated_at', 'timestamp', { omitIfBlank: true })
      ]
    },
    {
      sheetName: 'CFG_RULE',
      table: 'ct_cfg_rules',
      writeMode: 'replace',
      primaryKey: ['rule_id'],
      columns: [
        c('RuleId', 'rule_id', 'text', { required: true }),
        c('Nombre', 'nombre', 'text', { required: true }),
        c('ProcessKey', 'process_key', 'text', { defaultValue: 'cobro_transporte' }),
        c('Prioridad', 'prioridad', 'int', { defaultValue: 100 }),
        c('CountryScope', 'country_scope', 'text', { defaultValue: '*' }),
        c('StageFrom', 'stage_from', 'int', { defaultValue: 1 }),
        c('StageTo', 'stage_to', 'int', { defaultValue: 10 }),
        c('TriggerEvent', 'trigger_event', 'text', { defaultValue: 'STAGE_ENTER' }),
        c('ConditionJson', 'condition_json', 'json_object', { defaultValue: {} }),
        c('ActionJson', 'action_json', 'json_object', { defaultValue: {} }),
        c('StopOnMatch', 'stop_on_match', 'bool', { defaultValue: true }),
        c('Activo', 'activo', 'bool', { defaultValue: true }),
        c('ValidFrom', 'valid_from', 'date', { omitIfBlank: true }),
        c('ValidTo', 'valid_to', 'date', { omitIfBlank: true }),
        c('UpdatedAt', 'updated_at', 'timestamp', { omitIfBlank: true })
      ]
    },
    {
      sheetName: 'CFG_TEMPLATE',
      table: 'ct_cfg_templates',
      writeMode: 'replace',
      primaryKey: ['template_id'],
      columns: [
        c('TemplateId', 'template_id', 'text', { required: true }),
        c('EventKey', 'event_key', 'text', { required: true }),
        c('CountryCode', 'country_code', 'text', { defaultValue: '*' }),
        c('Language', 'language', 'text', { defaultValue: 'es' }),
        c('Channel', 'channel', 'text', { defaultValue: 'email' }),
        c('Subject', 'subject', 'text', { required: true }),
        c('Body', 'body', 'text', { required: true }),
        c('Activo', 'activo', 'bool', { defaultValue: true }),
        c('UpdatedAt', 'updated_at', 'timestamp', { omitIfBlank: true })
      ]
    },
    {
      sheetName: 'CFG_AUTH_KEY',
      table: 'ct_cfg_auth_keys',
      writeMode: 'replace',
      primaryKey: ['key_id'],
      columns: [
        c('KeyId', 'key_id', 'text', { required: true }),
        c('Nombre', 'nombre', 'text', { required: true }),
        c('ClaveHash', 'clave_hash', 'text', { required: true }),
        c('Scope', 'scope', 'text', { defaultValue: 'GESTION_DELETE_ANY' }),
        c('Activo', 'activo', 'bool', { defaultValue: true }),
        c('MaxUsos', 'max_usos', 'int', { defaultValue: 0 }),
        c('UsosActuales', 'usos_actuales', 'int', { defaultValue: 0 }),
        c('UltimoUsoAt', 'ultimo_uso_at', 'timestamp', { omitIfBlank: true }),
        c('Notas', 'notas', 'text'),
        c('UpdatedAt', 'updated_at', 'timestamp', { omitIfBlank: true })
      ]
    },
    {
      sheetName: 'Aprobaciones',
      table: 'ct_cobros',
      writeMode: 'replace',
      primaryKey: ['id'],
      columns: [
        c('ID', 'id', 'text', { aliases: ['ID', 'Id'], required: true, fallbackIndex: 0 }),
        c('Fecha', 'fecha_registro', 'timestamp', { aliases: ['Fecha', 'FechaRegistro', 'Fecha Creacion', 'FechaCreacion'], required: true, fallbackIndex: 1 }),
        c('Proveedor', 'proveedor_nombre', 'text', { aliases: ['Proveedor', 'ProveedorNombre', 'NombreProveedor'], required: true, fallbackIndex: 2 }),
        c('ProveedorCodigo', 'proveedor_codigo', 'text', { aliases: ['ProveedorCodigo', 'CodigoProveedor', 'Proveedor_Codigo', 'CodProveedor'], fallbackIndex: 3 }),
        c('Unidad', 'unidad', 'text', { fallbackIndex: 4 }),
        c('Ruta', 'ruta', 'text', { fallbackIndex: 5 }),
        c('C9', 'c9', 'text', { aliases: ['C9', 'Incidencia'], fallbackIndex: 7 }),
        c('Factura', 'factura_ref', 'text', { aliases: ['Factura', 'FacturaRef'], fallbackIndex: 8 }),
        c('Observaciones', 'observaciones', 'text', { aliases: ['Observaciones', 'Observacion', 'Detalle', 'Motivo'], fallbackIndex: 19, fallbackIndexes: [11, 18] }),
        c('TotalCobro', 'total_cobro', 'number', { aliases: ['TotalCobro', 'Monto', 'Total', 'Monto_Cobro'], defaultValue: 0, fallbackIndex: 20, fallbackIndexes: [12] }),
        c('Estado', 'estado', 'text', { aliases: ['Estado', 'Status'], defaultValue: 'Abierto', fallbackIndex: 13 }),
        c('Responsable', 'responsable', 'text', { fallbackIndex: 14 }),
        c('Piloto', 'piloto_nombre', 'text', { aliases: ['Piloto', 'PilotoNombre', 'Chofer', 'Conductor'], fallbackIndex: 15 }),
        c('Items', 'items_json', 'json_array', { aliases: ['Items', 'ItemsJson'], defaultValue: [], fallbackIndex: 16 }),
        c('Etapa', 'etapa', 'text', { aliases: ['Etapa', 'Stage'], defaultValue: '1. Boleta generada', fallbackIndex: 17 }),
        c('UltAct', 'ultima_actualizacion', 'timestamp', { aliases: ['UltAct', 'UltimaActualizacion', 'Ult Act', 'Fecha_Ult_Act', 'FechaUltAct'], omitIfBlank: true, fallbackIndex: 27, fallbackIndexes: [19] }),
        c('Bodega', 'bodega', 'text', { fallbackIndex: 22 }),
        c('Licencia', 'licencia', 'text', { fallbackIndex: 23 }),
        c('PdfUrl', 'pdf_url', 'text', { aliases: ['PdfUrl', 'PDF', 'Pdf', 'PdfURL', 'Boleta_PDF', 'BoletaURL', 'Boleta_URL'], fallbackIndex: 29, fallbackIndexes: [33, 24] }),
        c(LEGACY_WF.areaResponsableActual, 'area_responsable_actual', 'text'),
        c(LEGACY_WF.countryCode, 'country_code', 'text', { aliases: [LEGACY_WF.countryCode, 'Pais', 'PaisCodigo'], defaultValue: 'PE' }),
        c(LEGACY_WF.countryName, 'country_name', 'text', { aliases: [LEGACY_WF.countryName, 'PaisNombre', 'CountryName'], defaultValue: 'Peru' }),
        c(LEGACY_WF.processFolderId, 'process_folder_id', 'text'),
        c(LEGACY_WF.processFolderUrl, 'process_folder_url', 'text'),
        c(LEGACY_WF.processFolderName, 'process_folder_name', 'text'),
        c(LEGACY_WF.fechaLimiteFirmaBoleta, 'fecha_limite_firma_boleta', 'timestamp', { omitIfBlank: true }),
        c(LEGACY_WF.firmaBoletaLink, 'firma_boleta_link', 'text'),
        c(LEGACY_WF.boletaFirmadaUrl, 'boleta_firmada_url', 'text'),
        c(LEGACY_WF.firmaBoletaUrl, 'firma_boleta_url', 'text'),
        c(LEGACY_WF.inventarioStatus, 'inventario_status', 'text'),
        c(LEGACY_WF.comentarioInventario, 'comentario_inventario', 'text'),
        c(LEGACY_WF.ovNumero, 'ov_numero', 'text'),
        c(LEGACY_WF.rutaId, 'ruta_id', 'text'),
        c(LEGACY_WF.facturaNumero, 'factura_numero', 'text'),
        c(LEGACY_WF.facturaUrl, 'factura_url', 'text'),
        c(LEGACY_WF.fechaLimiteFirmaFactura, 'fecha_limite_firma_factura', 'timestamp', { omitIfBlank: true }),
        c(LEGACY_WF.firmaFacturaLink, 'firma_factura_link', 'text'),
        c(LEGACY_WF.firmaFacturaUrl, 'firma_factura_url', 'text'),
        c(LEGACY_WF.liquidacionRef, 'liquidacion_ref', 'text'),
        c(LEGACY_WF.constanciaPagoUrl, 'constancia_pago_url', 'text'),
        c(LEGACY_WF.rmNumero, 'rm_numero', 'text'),
        c(LEGACY_WF.facturasDebitar, 'facturas_debitar', 'text'),
        c(LEGACY_WF.debitoRef, 'debito_ref', 'text'),
        c(LEGACY_WF.etapaAnterior, 'etapa_anterior', 'text'),
        c(LEGACY_WF.motivoObservacion, 'motivo_observacion', 'text'),
        c(LEGACY_WF.fechaIngresoEtapaActual, 'fecha_ingreso_etapa_actual', 'timestamp', { omitIfBlank: true }),
        c(LEGACY_WF.fechaLimiteSlaActual, 'fecha_limite_sla_actual', 'timestamp', { omitIfBlank: true }),
        c(LEGACY_WF.emailProveedor, 'email_proveedor', 'text'),
        c(LEGACY_WF.emailInventarios, 'email_inventarios', 'text'),
        c(LEGACY_WF.emailTransporte, 'email_transporte', 'text'),
        c(LEGACY_WF.emailCyC, 'email_cyc', 'text'),
        c(LEGACY_WF.emailFacturacion, 'email_facturacion', 'text'),
        c(LEGACY_WF.emailContabilidad, 'email_contabilidad', 'text'),
        c(LEGACY_WF.slaNotif, 'sla_notif', 'json_object', { defaultValue: {} })
      ]
    },
    {
      sheetName: 'Detalle_Cobros',
      table: 'ct_cobro_items',
      writeMode: 'replace',
      primaryKey: [],
      dependsOn: ['Aprobaciones'],
      deleteFilter: { field: 'id', op: 'gt.0' },
      columns: [
        c('IDCobro', 'cobro_id', 'text', { aliases: ['IDCobro', 'ID_Cobro', 'CobroId'], required: true, fallbackIndex: 0 }),
        c('Codigo', 'codigo', 'text', { aliases: ['Codigo', 'Codigo_Item', 'CodigoItem'], required: true, fallbackIndex: 1 }),
        c('Descripcion', 'descripcion', 'text', { aliases: ['Descripcion', 'Descripción', 'Detalle'], required: true, fallbackIndex: 2 }),
        c('Cantidad', 'cantidad', 'number', { aliases: ['Cantidad'], defaultValue: 0, fallbackIndex: 3 }),
        c('Precio', 'precio', 'number', { aliases: ['Precio', 'Precio_Unitario', 'PrecioUnitario'], defaultValue: 0, fallbackIndex: 4 }),
        c('Subtotal', 'subtotal', 'number', { aliases: ['Subtotal', 'Total', 'Importe'], defaultValue: 0, fallbackIndex: 5 }),
        c('Incidencia', 'incidencia', 'text', { aliases: ['Incidencia', 'Observacion', 'Observación', 'Motivo'], fallbackIndex: 6 })
      ]
    },
    {
      sheetName: 'Aprobaciones_Criticas',
      table: 'ct_critical_approvals',
      writeMode: 'replace',
      primaryKey: ['solicitud_id'],
      columns: [
        c('SolicitudId', 'solicitud_id', 'text', { required: true }),
        c('FechaSolicitud', 'fecha_solicitud', 'timestamp', { omitIfBlank: true }),
        c('Tipo', 'tipo', 'text', { required: true }),
        c('IDCobro', 'cobro_id', 'text'),
        c('SolicitadoPor', 'solicitado_por', 'text'),
        c('Motivo', 'motivo', 'text', { required: true }),
        c('Payload', 'payload', 'json_object', { defaultValue: {} }),
        c('Estado', 'estado', 'text', { defaultValue: 'Pendiente' }),
        c('AprobadoPor', 'aprobado_por', 'text'),
        c('FechaResolucion', 'fecha_resolucion', 'timestamp', { omitIfBlank: true }),
        c('Comentario', 'comentario', 'json_object', { defaultValue: {} }),
        c('Usado', 'usado', 'bool', { defaultValue: false })
      ]
    },
    {
      sheetName: 'Bitacora',
      table: 'ct_audit_log',
      writeMode: 'replace',
      primaryKey: [],
      deleteFilter: { field: 'id', op: 'gt.0' },
      columns: [
        c('Fecha', 'fecha', 'timestamp', { omitIfBlank: true }),
        c('ID', 'cobro_id', 'text'),
        c('Usuario', 'usuario', 'text'),
        c('Etapa', 'etapa', 'text'),
        c('Accion', 'accion', 'text'),
        c('Resultado', 'resultado', 'text'),
        c('Destinatario', 'destinatario', 'text'),
        c('Detalle', 'detalle', 'text')
      ]
    },
    {
      sheetName: 'Notificaciones',
      table: 'ct_notifications',
      writeMode: 'replace',
      primaryKey: ['id'],
      columns: [
        c('Id', 'id', 'text', { aliases: ['Id', 'ID'], required: true }),
        c('CreatedAt', 'created_at', 'timestamp', { aliases: ['CreatedAt', 'Fecha', 'FechaRegistro'], omitIfBlank: true }),
        c('UserEmail', 'user_email', 'text', { aliases: ['UserEmail', 'Email'], required: true }),
        c('CobroId', 'cobro_id', 'text', { aliases: ['CobroId', 'IDCobro'] }),
        c('Etapa', 'etapa', 'text'),
        c('Accion', 'accion', 'text'),
        c('Mensaje', 'message', 'text', { aliases: ['Mensaje', 'Message'] }),
        c('ReadAt', 'read_at', 'timestamp', { aliases: ['ReadAt', 'FechaLectura'], omitIfBlank: true })
      ]
    }
  ];

  return legacySupabaseMigrationDefsMemo_;
}

function legacySupabaseCol_(header, field, type, extras) {
  const out = extras ? legacySupabaseClone_(extras) : {};
  out.header = header;
  out.field = field;
  out.type = type || 'text';
  return out;
}

function legacySupabaseFallbackIndexes_(col) {
  const out = [];
  if (col.fallbackIndex != null) out.push(Number(col.fallbackIndex));
  if (Array.isArray(col.fallbackIndexes) && col.fallbackIndexes.length) {
    for (let i = 0; i < col.fallbackIndexes.length; i++) {
      out.push(Number(col.fallbackIndexes[i]));
    }
  }
  return out.filter(function (value) {
    return !isNaN(value) && value >= 0;
  });
}

function legacySupabaseFallbackColumnLabels_(col) {
  const indexes = legacySupabaseFallbackIndexes_(col);
  return indexes.map(function (idx) {
    const num = idx + 1;
    return legacySupabaseColumnLabel_(num) + ' (' + num + ')';
  });
}

function legacySupabaseColumnLabel_(columnNumber) {
  let n = Number(columnNumber || 0);
  let out = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out || '?';
}

function legacySupabaseComparisonWarnings_(comparison) {
  const warnings = [];
  if (!comparison) return warnings;
  if (comparison.errors && comparison.errors.length) {
    for (let i = 0; i < comparison.errors.length; i++) {
      legacySupabasePushWarning_(warnings, comparison.errors[i]);
    }
  }
  if (comparison.targetMissingColumns && comparison.targetMissingColumns.length) {
    legacySupabasePushWarning_(
      warnings,
      'Faltan columnas en Supabase para ' + comparison.table + ': ' + comparison.targetMissingColumns.join(', ')
    );
  }
  if (comparison.requiredSourceMissing && comparison.requiredSourceMissing.length) {
    const parts = comparison.requiredSourceMissing.map(function (item) {
      const hints = [];
      if (item.expectedHeaders && item.expectedHeaders.length) hints.push('headers: ' + item.expectedHeaders.join(' / '));
      if (item.fallbackColumns && item.fallbackColumns.length) hints.push('posiciones: ' + item.fallbackColumns.join(', '));
      return item.field + ' [' + hints.join(' | ') + ']';
    });
    legacySupabasePushWarning_(
      warnings,
      'Faltan columnas requeridas en la hoja ' + comparison.sourceSheet + ': ' + parts.join('; ')
    );
  }
  return warnings;
}

function legacySupabaseChunk_(rows, size) {
  const out = [];
  for (let i = 0; i < rows.length; i += size) {
    out.push(rows.slice(i, i + size));
  }
  return out;
}

function legacySupabaseListAll_(table, query, pageSize) {
  const limit = Math.max(1, Math.min(5000, Number(pageSize || 1000)));
  const baseQuery = legacySupabaseClone_(query || {});
  const out = [];
  let offset = 0;

  while (true) {
    const pageQuery = legacySupabaseClone_(baseQuery);
    pageQuery.limit = limit;
    pageQuery.offset = offset;
    const rows = legacySupabaseRequest_('get', table, pageQuery) || [];
    if (!Array.isArray(rows) || !rows.length) break;
    for (let i = 0; i < rows.length; i++) out.push(rows[i]);
    if (rows.length < limit) break;
    offset += rows.length;
  }

  return out;
}

function legacySupabaseNormalizeKey_(value) {
  return String(value == null ? '' : value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function legacySupabaseClone_(value) {
  if (Array.isArray(value)) return value.slice();
  if (value && typeof value === 'object') return JSON.parse(JSON.stringify(value));
  return value;
}

function legacySupabaseIsBlankInput_(value) {
  if (value == null) return true;
  if (typeof value === 'string') return String(value).trim() === '';
  return false;
}

function legacySupabaseIsBlankStored_(value) {
  if (value == null) return true;
  if (typeof value === 'string') return String(value).trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (value && typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

function legacySupabaseYmd_(dateObj) {
  const y = dateObj.getFullYear();
  const m = ('0' + (dateObj.getMonth() + 1)).slice(-2);
  const d = ('0' + dateObj.getDate()).slice(-2);
  return y + '-' + m + '-' + d;
}

function legacySupabasePushWarnings_(target, list) {
  if (!list || !list.length) return;
  for (let i = 0; i < list.length; i++) {
    legacySupabasePushWarning_(target, list[i]);
  }
}

function legacySupabasePushWarning_(target, message) {
  if (!message) return;
  if (target.length >= 50) return;
  target.push(String(message));
}

function legacySupabaseRunCheck_(name, fn) {
  try {
    const detail = fn();
    return {
      name: String(name || ''),
      ok: true,
      detail: detail || {}
    };
  } catch (err) {
    return {
      name: String(name || ''),
      ok: false,
      error: String(err && err.message ? err.message : err)
    };
  }
}

function legacySupabaseMaskKey_(key) {
  const value = String(key || '').trim();
  if (!value) return '';
  if (value.length <= 10) return value;
  return value.slice(0, 6) + '...' + value.slice(-4);
}

function legacySupabaseLog_(label, payload) {
  const text = '[LegacyMigration][' + String(label || 'LOG') + '] ' + JSON.stringify(payload || {});
  try { Logger.log(text); } catch (e) {}
  try { console.log(text); } catch (e2) {}
}
