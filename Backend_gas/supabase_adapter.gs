const SUPABASE_URL_PROP = 'SUPABASE_URL'
const SUPABASE_SERVICE_ROLE_KEY_PROP = 'SUPABASE_SERVICE_ROLE_KEY'
const SUPABASE_SECRET_KEY_PROP = 'SUPABASE_SECRET_KEY'
const SUPABASE_DEFAULT_URL = 'https://apauqolrxddmpqtlbffx.supabase.co'
const SUPABASE_PAGE_LIMIT = 1000
const SUPABASE_BOOTSTRAP_CONFIG = {
    url: 'https://apauqolrxddmpqtlbffx.supabase.co',
    serviceRoleKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFwYXVxb2xyeGRkbXBxdGxiZmZ4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTE0MDAyNywiZXhwIjoyMDkwNzE2MDI3fQ.q79Fi_8ssBWNPaaK2PXD5hT61TyOPKuuueLSGwDDu5k'
}

let supabaseSpreadsheetMemo_ = null
let supabaseSheetDefsMemo_ = null

function getDataStore_() {
    if (!supabaseSpreadsheetMemo_) supabaseSpreadsheetMemo_ = new SupabaseSpreadsheet_()
    return supabaseSpreadsheetMemo_
}

function invalidateDataStoreCache_(sheetName) {
    if (!supabaseSpreadsheetMemo_) return
    supabaseSpreadsheetMemo_.invalidateSheet_(sheetName)
}

function getSupabaseSheetDefs_() {
    if (!supabaseSheetDefsMemo_) supabaseSheetDefsMemo_ = buildSupabaseSheetDefs_()
    return supabaseSheetDefsMemo_
}

function makeSimpleSheetDef_(cfg) {
    const def = {
        name: cfg.name,
        table: cfg.table,
        primaryKey: (cfg.primaryKey || []).slice(),
        order: String(cfg.order || '').trim(),
        touch: String(cfg.touch || '').trim(),
        columns: (cfg.columns || []).slice()
    }
    def.headers = def.columns.map(col => String(col.header || ''))
    def.toRow = function (record) {
        const row = []
        for (let i = 0; i < def.columns.length; i++) {
            row.push(readSheetColumn_(def.columns[i], record || {}))
        }
        return row
    }
    def.fromRow = function (row, current) {
        const out = current ? shallowClone_(current) : {}
        const arr = Array.isArray(row) ? row : []
        for (let i = 0; i < def.columns.length; i++) {
            if (i >= arr.length && current) continue
            writeSheetColumn_(out, def.columns[i], i < arr.length ? arr[i] : '')
        }
        if (def.touch) out[def.touch] = new Date().toISOString()
        return out
    }
    return def
}

function readSheetColumn_(col, record) {
    if (!col) return ''
    if (typeof col.read === 'function') return col.read(record || {})
    if (!col.field) return col.defaultValue != null ? col.defaultValue : ''
    return convertSheetOut_(record ? record[col.field] : null, col.type, col.defaultValue)
}

function writeSheetColumn_(target, col, value) {
    if (!col || !target) return
    if (typeof col.write === 'function') {
        col.write(target, value)
        return
    }
    if (!col.field) return
    target[col.field] = convertSheetIn_(value, col.type)
}

function convertSheetOut_(value, type, fallback) {
    if (value == null) {
        if (fallback != null) return fallback
        if (type === 'bool') return false
        if (type === 'number' || type === 'int') return 0
        if (type === 'json_text_array') return '[]'
        if (type === 'json_text_object') return '{}'
        return ''
    }
    if (type === 'bool') return value === true || String(value).toLowerCase() === 'true' || String(value) === '1'
    if (type === 'number') return Number(value || 0)
    if (type === 'int') return Math.round(Number(value || 0))
    if (type === 'date') return formatDateOnly_(value)
    if (type === 'timestamp') return formatTimestampValue_(value)
    if (type === 'json_text_array' || type === 'json_text_object') return stringifyJsonSafe_(value)
    return String(value)
}

function convertSheetIn_(value, type) {
    if (type === 'bool') return parseSheetBool_(value, false)
    if (type === 'number') {
        const n = Number(value || 0)
        return isNaN(n) ? 0 : n
    }
    if (type === 'int') {
        const n = Number(value || 0)
        return isNaN(n) ? 0 : Math.round(n)
    }
    if (type === 'date') return toDateOnlyValue_(value)
    if (type === 'timestamp') return toTimestampValue_(value)
    if (type === 'json_text_array') return parseJsonField_(value, [])
    if (type === 'json_text_object') return parseJsonField_(value, {})
    return String(value == null ? '' : value).trim()
}

function parseSheetBool_(value, fallback) {
    if (value === true || value === false) return value
    const txt = String(value == null ? '' : value).trim().toLowerCase()
    if (!txt) return !!fallback
    if (txt === '1' || txt === 'true' || txt === 'si' || txt === 'yes' || txt === 'on') return true
    if (txt === '0' || txt === 'false' || txt === 'no' || txt === 'off') return false
    return !!fallback
}

function parseJsonField_(value, fallback) {
    if (value == null || value === '') return shallowClone_(fallback)
    if (typeof value === 'object') return value
    try {
        return JSON.parse(String(value))
    } catch (e) {
        return shallowClone_(fallback)
    }
}

function stringifyJsonSafe_(value) {
    if (value == null || value === '') return '{}'
    if (typeof value === 'string') {
        const txt = String(value || '').trim()
        if (!txt) return '{}'
        try {
            const parsed = JSON.parse(txt)
            return JSON.stringify(parsed)
        } catch (e) {
            return txt
        }
    }
    try {
        return JSON.stringify(value)
    } catch (e) {
        return '{}'
    }
}

function toTimestampValue_(value) {
    if (value == null || value === '') return null
    const d = (value instanceof Date) ? value : new Date(value)
    return isNaN(d.getTime()) ? null : d.toISOString()
}

function toDateOnlyValue_(value) {
    if (value == null || value === '') return null
    const d = (value instanceof Date) ? value : new Date(value)
    if (isNaN(d.getTime())) return null
    const y = d.getFullYear()
    const m = ('0' + (d.getMonth() + 1)).slice(-2)
    const day = ('0' + d.getDate()).slice(-2)
    return y + '-' + m + '-' + day
}

function formatTimestampValue_(value) {
    if (!value) return ''
    const d = new Date(value)
    return isNaN(d.getTime()) ? String(value || '') : d.toISOString()
}

function formatDateOnly_(value) {
    if (!value) return ''
    const d = new Date(value)
    if (isNaN(d.getTime())) return String(value || '')
    const y = d.getFullYear()
    const m = ('0' + (d.getMonth() + 1)).slice(-2)
    const day = ('0' + d.getDate()).slice(-2)
    return y + '-' + m + '-' + day
}

function shallowClone_(value) {
    if (Array.isArray(value)) return value.slice()
    if (value && typeof value === 'object') return Object.assign({}, value)
    return value
}

function buildSupabaseSheetDefs_() {
    const defs = {}

    defs['Config'] = makeSimpleSheetDef_({
        name: 'Config',
        table: 'ct_settings',
        primaryKey: ['setting_key'],
        order: 'setting_key.asc',
        touch: 'updated_at',
        columns: [
            { header: 'Key', field: 'setting_key', type: 'text' },
            { header: 'Value', field: 'setting_value', type: 'text' },
            { header: 'Description', field: 'description', type: 'text' },
            { header: 'UpdatedAt', field: 'updated_at', type: 'timestamp' }
        ]
    })

    defs['Usuarios'] = makeSimpleSheetDef_({
        name: 'Usuarios',
        table: 'ct_users',
        primaryKey: ['email'],
        order: 'created_at.asc,email.asc',
        touch: 'updated_at',
        columns: [
            { header: 'Email', field: 'email', type: 'text' },
            { header: 'Nombre', field: 'nombre', type: 'text' },
            { header: 'Rol', field: 'rol', type: 'text' },
            { header: 'Password', field: 'password_hash', type: 'text' },
            { header: 'Activo', field: 'activo', type: 'bool' },
            { header: 'Area', field: 'area', type: 'text' },
            { header: 'CountryCode', field: 'country_code', type: 'text' }
        ]
    })

    defs['Proveedores'] = makeSimpleSheetDef_({
        name: 'Proveedores',
        table: 'ct_providers',
        primaryKey: ['codigo'],
        order: 'created_at.asc,codigo.asc',
        touch: 'updated_at',
        columns: [
            { header: 'Codigo', field: 'codigo', type: 'text' },
            { header: 'Nombre', field: 'nombre', type: 'text' },
            { header: 'Correo', field: 'correo', type: 'text' },
            { header: 'CountryCode', field: 'country_code', type: 'text' }
        ]
    })

    defs['Pilotos'] = makeSimpleSheetDef_({
        name: 'Pilotos',
        table: 'ct_pilots',
        primaryKey: ['dni'],
        order: 'created_at.asc,dni.asc',
        touch: 'updated_at',
        columns: [
            { header: 'DNI', field: 'dni', type: 'text' },
            { header: 'NOMBRE COMPLETO', field: 'nombre_completo', type: 'text' },
            { header: 'CountryCode', field: 'country_code', type: 'text' }
        ]
    })

    defs['maestro'] = makeSimpleSheetDef_({
        name: 'maestro',
        table: 'ct_master_items',
        primaryKey: ['codigo'],
        order: 'created_at.asc,codigo.asc',
        touch: 'updated_at',
        columns: [
            { header: 'Codigo', field: 'codigo', type: 'text' },
            { header: 'Descripcion', field: 'descripcion', type: 'text' },
            { header: 'uxc', field: 'uxc', type: 'int' },
            { header: 'Precio con IGV', field: 'precio_con_igv', type: 'number' },
            { header: 'Precio sin IGV', field: 'precio_sin_igv', type: 'number' },
            { header: 'EAN', field: 'ean', type: 'text' },
            { header: 'Activo', field: 'activo', type: 'bool' },
            { header: 'CountryCode', field: 'country_code', type: 'text' }
        ]
    })

    defs['Detalle_Cobros'] = makeSimpleSheetDef_({
        name: 'Detalle_Cobros',
        table: 'ct_cobro_items',
        primaryKey: ['id'],
        order: 'id.asc',
        touch: 'updated_at',
        columns: [
            { header: 'IDCobro', field: 'cobro_id', type: 'text' },
            { header: 'Codigo', field: 'codigo', type: 'text' },
            { header: 'Descripcion', field: 'descripcion', type: 'text' },
            { header: 'Cantidad', field: 'cantidad', type: 'number' },
            { header: 'Precio', field: 'precio', type: 'number' },
            { header: 'Subtotal', field: 'subtotal', type: 'number' },
            { header: 'Incidencia', field: 'incidencia', type: 'text' }
        ]
    })

    defs['Aprobaciones'] = makeSimpleSheetDef_({
        name: 'Aprobaciones',
        table: 'ct_cobros',
        primaryKey: ['id'],
        order: 'fecha_registro.asc,id.asc',
        touch: 'updated_at',
        columns: [
            { header: 'ID', field: 'id', type: 'text' },
            { header: 'Fecha', field: 'fecha_registro', type: 'timestamp' },
            { header: 'Proveedor', field: 'proveedor_nombre', type: 'text' },
            { header: 'ProveedorCodigo', field: 'proveedor_codigo', type: 'text' },
            { header: 'Unidad', field: 'unidad', type: 'text' },
            { header: 'Ruta', field: 'ruta', type: 'text' },
            { header: 'Adjunto', defaultValue: '' },
            { header: 'C9', field: 'c9', type: 'text' },
            { header: 'Factura', field: 'factura_ref', type: 'text' },
            { header: 'ExtraFirma1', defaultValue: '' },
            { header: 'ExtraFirma2', defaultValue: '' },
            { header: 'Observaciones', field: 'observaciones', type: 'text' },
            { header: 'TotalCobro', field: 'total_cobro', type: 'number' },
            { header: 'Estado', field: 'estado', type: 'text' },
            { header: 'Responsable', field: 'responsable', type: 'text' },
            { header: 'Piloto', field: 'piloto_nombre', type: 'text' },
            { header: 'Items', field: 'items_json', type: 'json_text_array' },
            { header: 'Etapa', field: 'etapa', type: 'text' },
            { header: 'EtapaLegacy', defaultValue: '' },
            { header: 'UltAct', field: 'ultima_actualizacion', type: 'timestamp' },
            { header: 'Extra1', defaultValue: '' },
            { header: 'Extra2', defaultValue: '' },
            { header: 'Bodega', field: 'bodega', type: 'text' },
            { header: 'Licencia', field: 'licencia', type: 'text' },
            { header: 'PdfUrl', field: 'pdf_url', type: 'text' },
            { header: WF.areaResponsableActual, field: 'area_responsable_actual', type: 'text' },
            { header: WF.countryCode, field: 'country_code', type: 'text' },
            { header: WF.countryName, field: 'country_name', type: 'text' },
            { header: WF.processFolderId, field: 'process_folder_id', type: 'text' },
            { header: WF.processFolderUrl, field: 'process_folder_url', type: 'text' },
            { header: WF.processFolderName, field: 'process_folder_name', type: 'text' },
            { header: WF.fechaLimiteFirmaBoleta, field: 'fecha_limite_firma_boleta', type: 'timestamp' },
            { header: WF.firmaBoletaLink, field: 'firma_boleta_link', type: 'text' },
            { header: WF.boletaFirmadaUrl, field: 'boleta_firmada_url', type: 'text' },
            { header: WF.firmaBoletaUrl, field: 'firma_boleta_url', type: 'text' },
            { header: WF.inventarioStatus, field: 'inventario_status', type: 'text' },
            { header: WF.comentarioInventario, field: 'comentario_inventario', type: 'text' },
            { header: WF.ovNumero, field: 'ov_numero', type: 'text' },
            { header: WF.rutaId, field: 'ruta_id', type: 'text' },
            { header: WF.facturaNumero, field: 'factura_numero', type: 'text' },
            { header: WF.facturaUrl, field: 'factura_url', type: 'text' },
            { header: WF.fechaLimiteFirmaFactura, field: 'fecha_limite_firma_factura', type: 'timestamp' },
            { header: WF.firmaFacturaLink, field: 'firma_factura_link', type: 'text' },
            { header: WF.firmaFacturaUrl, field: 'firma_factura_url', type: 'text' },
            { header: WF.liquidacionRef, field: 'liquidacion_ref', type: 'text' },
            { header: WF.constanciaPagoUrl, field: 'constancia_pago_url', type: 'text' },
            { header: WF.rmNumero, field: 'rm_numero', type: 'text' },
            { header: WF.facturasDebitar, field: 'facturas_debitar', type: 'text' },
            { header: WF.debitoRef, field: 'debito_ref', type: 'text' },
            { header: WF.etapaAnterior, field: 'etapa_anterior', type: 'text' },
            { header: WF.motivoObservacion, field: 'motivo_observacion', type: 'text' },
            { header: WF.fechaIngresoEtapaActual, field: 'fecha_ingreso_etapa_actual', type: 'timestamp' },
            { header: WF.fechaLimiteSlaActual, field: 'fecha_limite_sla_actual', type: 'timestamp' },
            { header: WF.emailProveedor, field: 'email_proveedor', type: 'text' },
            { header: WF.emailInventarios, field: 'email_inventarios', type: 'text' },
            { header: WF.emailTransporte, field: 'email_transporte', type: 'text' },
            { header: WF.emailCyC, field: 'email_cyc', type: 'text' },
            { header: WF.emailFacturacion, field: 'email_facturacion', type: 'text' },
            { header: WF.emailContabilidad, field: 'email_contabilidad', type: 'text' },
            { header: WF.slaNotif, field: 'sla_notif', type: 'json_text_object' }
        ]
    })

    defs[SHEET_PLANTILLAS] = makeSimpleSheetDef_({
        name: SHEET_PLANTILLAS,
        table: 'ct_notification_templates',
        primaryKey: ['codigo'],
        order: 'codigo.asc',
        touch: 'updated_at',
        columns: [
            { header: 'Codigo', field: 'codigo', type: 'text' },
            { header: 'Asunto', field: 'asunto', type: 'text' },
            { header: 'Cuerpo', field: 'cuerpo', type: 'text' },
            { header: 'Activo', field: 'activo', type: 'bool' },
            { header: 'Notas', field: 'notas', type: 'text' }
        ]
    })

    defs[SHEET_CORREOS] = makeSimpleSheetDef_({
        name: SHEET_CORREOS,
        table: 'ct_area_emails',
        primaryKey: ['area'],
        order: 'area.asc',
        touch: 'updated_at',
        columns: [
            { header: 'Area', field: 'area', type: 'text' },
            { header: 'EmailTo', field: 'email_to', type: 'text' },
            { header: 'EmailCc', field: 'email_cc', type: 'text' },
            { header: 'Activo', field: 'activo', type: 'bool' },
            { header: 'Notas', field: 'notas', type: 'text' }
        ]
    })

    defs[SHEET_APROBACIONES_CRITICAS] = makeSimpleSheetDef_({
        name: SHEET_APROBACIONES_CRITICAS,
        table: 'ct_critical_approvals',
        primaryKey: ['solicitud_id'],
        order: 'fecha_solicitud.asc,solicitud_id.asc',
        touch: 'updated_at',
        columns: [
            { header: 'SolicitudId', field: 'solicitud_id', type: 'text' },
            { header: 'FechaSolicitud', field: 'fecha_solicitud', type: 'timestamp' },
            { header: 'Tipo', field: 'tipo', type: 'text' },
            { header: 'IDCobro', field: 'cobro_id', type: 'text' },
            { header: 'SolicitadoPor', field: 'solicitado_por', type: 'text' },
            { header: 'Motivo', field: 'motivo', type: 'text' },
            { header: 'Payload', field: 'payload', type: 'json_text_object' },
            { header: 'Estado', field: 'estado', type: 'text' },
            { header: 'AprobadoPor', field: 'aprobado_por', type: 'text' },
            { header: 'FechaResolucion', field: 'fecha_resolucion', type: 'timestamp' },
            { header: 'Comentario', field: 'comentario', type: 'json_text_object' },
            { header: 'Usado', field: 'usado', type: 'bool' }
        ]
    })

    defs[SHEET_BITACORA] = makeSimpleSheetDef_({
        name: SHEET_BITACORA,
        table: 'ct_audit_log',
        primaryKey: ['id'],
        order: 'fecha.asc,id.asc',
        columns: [
            { header: 'Fecha', field: 'fecha', type: 'timestamp' },
            { header: 'ID', field: 'cobro_id', type: 'text' },
            { header: 'Usuario', field: 'usuario', type: 'text' },
            { header: 'Etapa', field: 'etapa', type: 'text' },
            { header: 'Accion', field: 'accion', type: 'text' },
            { header: 'Resultado', field: 'resultado', type: 'text' },
            { header: 'Destinatario', field: 'destinatario', type: 'text' },
            { header: 'Detalle', field: 'detalle', type: 'text' }
        ]
    })

    defs['Notificaciones'] = makeSimpleSheetDef_({
        name: 'Notificaciones',
        table: 'ct_notifications',
        primaryKey: ['id'],
        order: 'created_at.desc,id.desc',
        columns: [
            { header: 'Id', field: 'id', type: 'text' },
            { header: 'CreatedAt', field: 'created_at', type: 'timestamp' },
            { header: 'UserEmail', field: 'user_email', type: 'text' },
            { header: 'CobroId', field: 'cobro_id', type: 'text' },
            { header: 'Etapa', field: 'etapa', type: 'text' },
            { header: 'Accion', field: 'accion', type: 'text' },
            { header: 'Mensaje', field: 'message', type: 'text' },
            { header: 'ReadAt', field: 'read_at', type: 'timestamp' }
        ]
    })

    defs['CFG_COUNTRY'] = makeSimpleSheetDef_({
        name: 'CFG_COUNTRY',
        table: 'ct_cfg_countries',
        primaryKey: ['country_code'],
        order: 'country_code.asc',
        touch: 'updated_at',
        columns: [
            { header: 'CountryCode', field: 'country_code', type: 'text' },
            { header: 'Nombre', field: 'nombre', type: 'text' },
            { header: 'Moneda', field: 'moneda', type: 'text' },
            { header: 'Timezone', field: 'timezone', type: 'text' },
            { header: 'Locale', field: 'locale', type: 'text' },
            { header: 'Activo', field: 'activo', type: 'bool' },
            { header: 'UpdatedAt', field: 'updated_at', type: 'timestamp' }
        ]
    })

    defs['CFG_ROLE'] = makeSimpleSheetDef_({
        name: 'CFG_ROLE',
        table: 'ct_cfg_roles',
        primaryKey: ['role_id'],
        order: 'role_key.asc',
        touch: 'updated_at',
        columns: [
            { header: 'RoleId', field: 'role_id', type: 'text' },
            { header: 'RoleKey', field: 'role_key', type: 'text' },
            { header: 'RoleName', field: 'role_name', type: 'text' },
            { header: 'Activo', field: 'activo', type: 'bool' },
            { header: 'UpdatedAt', field: 'updated_at', type: 'timestamp' }
        ]
    })

    defs['CFG_USER_ROLE_SCOPE'] = makeSimpleSheetDef_({
        name: 'CFG_USER_ROLE_SCOPE',
        table: 'ct_cfg_user_role_scopes',
        primaryKey: ['scope_id'],
        order: 'updated_at.asc,scope_id.asc',
        touch: 'updated_at',
        columns: [
            { header: 'ScopeId', field: 'scope_id', type: 'text' },
            { header: 'UserEmail', field: 'user_email', type: 'text' },
            { header: 'RoleKey', field: 'role_key', type: 'text' },
            { header: 'CountryCode', field: 'country_code', type: 'text' },
            { header: 'BusinessUnit', field: 'business_unit', type: 'text' },
            { header: 'Activo', field: 'activo', type: 'bool' },
            { header: 'UpdatedAt', field: 'updated_at', type: 'timestamp' }
        ]
    })

    defs['CFG_FLOW_STAGE'] = makeSimpleSheetDef_({
        name: 'CFG_FLOW_STAGE',
        table: 'ct_cfg_flow_stages',
        primaryKey: ['process_key', 'stage_order'],
        order: 'process_key.asc,stage_order.asc',
        touch: 'updated_at',
        columns: [
            { header: 'ProcessKey', field: 'process_key', type: 'text' },
            { header: 'StageOrder', field: 'stage_order', type: 'int' },
            { header: 'StageCode', field: 'stage_code', type: 'text' },
            { header: 'StageName', field: 'stage_name', type: 'text' },
            { header: 'RequiredFieldsJson', field: 'required_fields', type: 'json_text_array' },
            { header: 'RequiredDocsJson', field: 'required_docs', type: 'json_text_array' },
            { header: 'Active', field: 'activo', type: 'bool' }
        ]
    })

    defs['CFG_STAGE_SLA'] = makeSimpleSheetDef_({
        name: 'CFG_STAGE_SLA',
        table: 'ct_cfg_stage_sla',
        primaryKey: ['process_key', 'stage_order'],
        order: 'process_key.asc,stage_order.asc',
        touch: 'updated_at',
        columns: [
            { header: 'ProcessKey', field: 'process_key', type: 'text' },
            { header: 'StageOrder', field: 'stage_order', type: 'int' },
            { header: 'StageName', field: 'stage_name', type: 'text' },
            { header: 'SlaHours', field: 'sla_hours', type: 'int' },
            { header: 'Activo', field: 'activo', type: 'bool' },
            { header: 'Notas', field: 'notas', type: 'text' },
            { header: 'UpdatedAt', field: 'updated_at', type: 'timestamp' }
        ]
    })

    defs['CFG_STAGE_NOTIFY'] = makeSimpleSheetDef_({
        name: 'CFG_STAGE_NOTIFY',
        table: 'ct_cfg_stage_notify',
        primaryKey: ['process_key', 'stage_order'],
        order: 'process_key.asc,stage_order.asc',
        touch: 'updated_at',
        columns: [
            { header: 'ProcessKey', field: 'process_key', type: 'text' },
            { header: 'StageOrder', field: 'stage_order', type: 'int' },
            { header: 'StageName', field: 'stage_name', type: 'text' },
            { header: 'AreaTo', field: 'area_to', type: 'text' },
            { header: 'CcAreas', field: 'cc_areas', type: 'text' },
            { header: 'Activo', field: 'activo', type: 'bool' },
            { header: 'Notas', field: 'notas', type: 'text' },
            { header: 'UpdatedAt', field: 'updated_at', type: 'timestamp' }
        ]
    })

    defs['CFG_RULE'] = makeSimpleSheetDef_({
        name: 'CFG_RULE',
        table: 'ct_cfg_rules',
        primaryKey: ['rule_id'],
        order: 'prioridad.asc,updated_at.asc,rule_id.asc',
        touch: 'updated_at',
        columns: [
            { header: 'RuleId', field: 'rule_id', type: 'text' },
            { header: 'Nombre', field: 'nombre', type: 'text' },
            { header: 'ProcessKey', field: 'process_key', type: 'text' },
            { header: 'Prioridad', field: 'prioridad', type: 'int' },
            { header: 'CountryScope', field: 'country_scope', type: 'text' },
            { header: 'StageFrom', field: 'stage_from', type: 'int' },
            { header: 'StageTo', field: 'stage_to', type: 'int' },
            { header: 'TriggerEvent', field: 'trigger_event', type: 'text' },
            { header: 'ConditionJson', field: 'condition_json', type: 'json_text_object' },
            { header: 'ActionJson', field: 'action_json', type: 'json_text_object' },
            { header: 'StopOnMatch', field: 'stop_on_match', type: 'bool' },
            { header: 'Activo', field: 'activo', type: 'bool' },
            { header: 'ValidFrom', field: 'valid_from', type: 'date' },
            { header: 'ValidTo', field: 'valid_to', type: 'date' },
            { header: 'UpdatedAt', field: 'updated_at', type: 'timestamp' }
        ]
    })

    defs['CFG_TEMPLATE'] = makeSimpleSheetDef_({
        name: 'CFG_TEMPLATE',
        table: 'ct_cfg_templates',
        primaryKey: ['template_id'],
        order: 'event_key.asc,country_code.asc,language.asc,channel.asc',
        touch: 'updated_at',
        columns: [
            { header: 'TemplateId', field: 'template_id', type: 'text' },
            { header: 'EventKey', field: 'event_key', type: 'text' },
            { header: 'CountryCode', field: 'country_code', type: 'text' },
            { header: 'Language', field: 'language', type: 'text' },
            { header: 'Channel', field: 'channel', type: 'text' },
            { header: 'Subject', field: 'subject', type: 'text' },
            { header: 'Body', field: 'body', type: 'text' },
            { header: 'Activo', field: 'activo', type: 'bool' },
            { header: 'UpdatedAt', field: 'updated_at', type: 'timestamp' }
        ]
    })

    defs['CFG_AUTH_KEY'] = makeSimpleSheetDef_({
        name: 'CFG_AUTH_KEY',
        table: 'ct_cfg_auth_keys',
        primaryKey: ['key_id'],
        order: 'updated_at.asc,key_id.asc',
        touch: 'updated_at',
        columns: [
            { header: 'KeyId', field: 'key_id', type: 'text' },
            { header: 'Nombre', field: 'nombre', type: 'text' },
            { header: 'ClaveHash', field: 'clave_hash', type: 'text' },
            { header: 'Scope', field: 'scope', type: 'text' },
            { header: 'Activo', field: 'activo', type: 'bool' },
            { header: 'MaxUsos', field: 'max_usos', type: 'int' },
            { header: 'UsosActuales', field: 'usos_actuales', type: 'int' },
            { header: 'UltimoUsoAt', field: 'ultimo_uso_at', type: 'timestamp' },
            { header: 'Notas', field: 'notas', type: 'text' },
            { header: 'UpdatedAt', field: 'updated_at', type: 'timestamp' }
        ]
    })

    return defs
}

function getSupabaseConfig_() {
    ensureSupabaseScriptProperties_()
    const props = PropertiesService.getScriptProperties()
    const url = String(props.getProperty(SUPABASE_URL_PROP) || SUPABASE_DEFAULT_URL).trim().replace(/\/+$/, '')
    const key = String(
        props.getProperty(SUPABASE_SERVICE_ROLE_KEY_PROP)
        || props.getProperty(SUPABASE_SECRET_KEY_PROP)
        || ''
    ).trim()
    if (!url) throw new Error('Falta configurar SUPABASE_URL.')
    if (!key) throw new Error('Falta configurar SUPABASE_SERVICE_ROLE_KEY o SUPABASE_SECRET_KEY.')
    return {
        url: url,
        restUrl: url + '/rest/v1',
        key: key
    }
}

function ensureSupabaseScriptProperties_() {
    const props = PropertiesService.getScriptProperties()
    const updates = {}
    const currentUrl = String(props.getProperty(SUPABASE_URL_PROP) || '').trim()
    const currentServiceKey = String(
        props.getProperty(SUPABASE_SERVICE_ROLE_KEY_PROP)
        || props.getProperty(SUPABASE_SECRET_KEY_PROP)
        || ''
    ).trim()

    if (!currentUrl && SUPABASE_BOOTSTRAP_CONFIG.url) {
        updates[SUPABASE_URL_PROP] = String(SUPABASE_BOOTSTRAP_CONFIG.url).trim()
    }
    if (!currentServiceKey && SUPABASE_BOOTSTRAP_CONFIG.serviceRoleKey) {
        updates[SUPABASE_SERVICE_ROLE_KEY_PROP] = String(SUPABASE_BOOTSTRAP_CONFIG.serviceRoleKey).trim()
    }

    if (Object.keys(updates).length) {
        props.setProperties(updates, false)
    }
}

function buildSupabaseQueryString_(query) {
    const keys = Object.keys(query || {})
    if (!keys.length) return ''
    const parts = []
    for (let i = 0; i < keys.length; i++) {
        const key = keys[i]
        const val = query[key]
        if (val == null || val === '') continue
        parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(String(val)))
    }
    return parts.length ? ('?' + parts.join('&')) : ''
}

function supabaseRequest_(method, path, query, payload, extraHeaders) {
    const cfg = getSupabaseConfig_()
    const q = buildSupabaseQueryString_(query || {})
    const url = cfg.restUrl + '/' + String(path || '').replace(/^\/+/, '') + q
    const headers = {
        apikey: cfg.key,
        Authorization: 'Bearer ' + cfg.key,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'Accept-Profile': 'public',
        'Content-Profile': 'public'
    }
    const extra = extraHeaders || {}
    Object.keys(extra).forEach(k => headers[k] = extra[k])

    const options = {
        method: String(method || 'get').toLowerCase(),
        headers: headers,
        muteHttpExceptions: true
    }
    if (payload !== undefined && payload !== null) {
        options.payload = JSON.stringify(payload)
    }

    const resp = UrlFetchApp.fetch(url, options)
    const code = Number(resp.getResponseCode() || 0)
    const raw = String(resp.getContentText() || '')
    if (code >= 200 && code < 300) {
        if (!raw) return null
        try { return JSON.parse(raw) } catch (e) { return raw }
    }
    throw new Error('Supabase ' + method + ' ' + path + ' => ' + code + ' | ' + raw)
}

function supabaseSelectAll_(table, order) {
    const out = []
    let offset = 0
    while (true) {
        const query = {
            select: '*',
            limit: SUPABASE_PAGE_LIMIT,
            offset: offset
        }
        if (order) query.order = order
        const chunk = supabaseRequest_('get', table, query) || []
        const arr = Array.isArray(chunk) ? chunk : []
        for (let i = 0; i < arr.length; i++) out.push(arr[i])
        if (arr.length < SUPABASE_PAGE_LIMIT) break
        offset += arr.length
    }
    return out
}

function supabaseInsertRows_(table, rows) {
    const payload = Array.isArray(rows) ? rows : [rows]
    return supabaseRequest_('post', table, {}, payload, {
        Prefer: 'return=representation'
    }) || []
}

function supabaseUpsertRows_(table, rows, primaryKey) {
    const payload = Array.isArray(rows) ? rows : [rows]
    const query = {}
    if (primaryKey && primaryKey.length) query.on_conflict = primaryKey.join(',')
    return supabaseRequest_('post', table, query, payload, {
        Prefer: 'resolution=merge-duplicates,return=representation'
    }) || []
}

function supabaseDeleteByPk_(table, primaryKey, record) {
    const query = {}
    for (let i = 0; i < primaryKey.length; i++) {
        const field = primaryKey[i]
        const value = record ? record[field] : null
        if (value == null || value === '') throw new Error('No se pudo eliminar en ' + table + ': PK incompleta (' + field + ').')
        query[field] = 'eq.' + String(value)
    }
    return supabaseRequest_('delete', table, query, null, {
        Prefer: 'return=representation'
    })
}

function SupabaseSpreadsheet_() {
    this.sheetMemo_ = {}
}

SupabaseSpreadsheet_.prototype.getSheetByName = function (name) {
    const defs = getSupabaseSheetDefs_()
    const key = String(name || '').trim()
    const def = defs[key]
    if (!def) return null
    if (!this.sheetMemo_[key]) this.sheetMemo_[key] = new SupabaseSheet_(def, this)
    return this.sheetMemo_[key]
}

SupabaseSpreadsheet_.prototype.insertSheet = function (name) {
    return this.getSheetByName(name)
}

SupabaseSpreadsheet_.prototype.getSheets = function () {
    const defs = getSupabaseSheetDefs_()
    const names = Object.keys(defs)
    const out = []
    for (let i = 0; i < names.length; i++) out.push(this.getSheetByName(names[i]))
    return out
}

SupabaseSpreadsheet_.prototype.getId = function () {
    return getSupabaseConfig_().url
}

SupabaseSpreadsheet_.prototype.getName = function () {
    return 'Supabase'
}

SupabaseSpreadsheet_.prototype.invalidateSheet_ = function (name) {
    const sh = this.sheetMemo_[String(name || '').trim()]
    if (sh) sh.invalidate_()
}

function SupabaseSheet_(def, owner) {
    this.def_ = def
    this.owner_ = owner
    this.headers_ = def.headers.slice()
    this.rowsCache_ = null
}

SupabaseSheet_.prototype.getName = function () {
    return this.def_.name
}

SupabaseSheet_.prototype.invalidate_ = function () {
    this.rowsCache_ = null
}

SupabaseSheet_.prototype.getLastColumn = function () {
    return this.headers_.length
}

SupabaseSheet_.prototype.getLastRow = function () {
    return this._loadRows_().length + 1
}

SupabaseSheet_.prototype.getDataRange = function () {
    return new SupabaseRange_(this, 1, 1, Math.max(1, this.getLastRow()), this.getLastColumn())
}

SupabaseSheet_.prototype.getRange = function (row, col, numRows, numCols) {
    return new SupabaseRange_(
        this,
        Number(row || 1),
        Number(col || 1),
        Number(numRows == null ? 1 : numRows),
        Number(numCols == null ? 1 : numCols)
    )
}

SupabaseSheet_.prototype.appendRow = function (row) {
    const rec = this.def_.fromRow(Array.isArray(row) ? row : [], null)
    supabaseInsertRows_(this.def_.table, [rec])
    this.invalidate_()
}

SupabaseSheet_.prototype.deleteRow = function (rowNum) {
    const idx = Number(rowNum || 0) - 2
    if (idx < 0) throw new Error('No se puede eliminar la fila de encabezado en ' + this.getName() + '.')
    const rows = this._loadRows_()
    if (idx >= rows.length) throw new Error('Fila invalida en ' + this.getName() + '.')
    supabaseDeleteByPk_(this.def_.table, this.def_.primaryKey, rows[idx])
    this.invalidate_()
}

SupabaseSheet_.prototype.getAllValues_ = function () {
    const out = [this.headers_.slice()]
    const rows = this._loadRows_()
    for (let i = 0; i < rows.length; i++) out.push(this.def_.toRow(rows[i]))
    return out
}

SupabaseSheet_.prototype._loadRows_ = function () {
    if (!this.rowsCache_) this.rowsCache_ = supabaseSelectAll_(this.def_.table, this.def_.order)
    return this.rowsCache_
}

SupabaseSheet_.prototype._upsertRowsByIndex_ = function (items) {
    if (!items || !items.length) return
    const payload = []
    for (let i = 0; i < items.length; i++) {
        const item = items[i]
        payload.push(this.def_.fromRow(item.row, item.current || null))
    }
    supabaseUpsertRows_(this.def_.table, payload, this.def_.primaryKey)
    this.invalidate_()
}

function SupabaseRange_(sheet, row, col, numRows, numCols) {
    this.sheet_ = sheet
    this.row_ = row
    this.col_ = col
    this.numRows_ = numRows
    this.numCols_ = numCols
}

SupabaseRange_.prototype.getValues = function () {
    if (this.numRows_ <= 0 || this.numCols_ <= 0) return []
    const all = this.sheet_.getAllValues_()
    const out = []
    for (let r = 0; r < this.numRows_; r++) {
        const srcRow = all[this.row_ - 1 + r] || []
        const row = []
        for (let c = 0; c < this.numCols_; c++) {
            row.push(srcRow[this.col_ - 1 + c] != null ? srcRow[this.col_ - 1 + c] : '')
        }
        out.push(row)
    }
    return out
}

SupabaseRange_.prototype.getDisplayValues = function () {
    const values = this.getValues()
    return values.map(row => row.map(v => {
        if (v == null) return ''
        if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE'
        return String(v)
    }))
}

SupabaseRange_.prototype.getValue = function () {
    const values = this.getValues()
    return (values[0] && values[0][0] != null) ? values[0][0] : ''
}

SupabaseRange_.prototype.setValue = function (value) {
    this.setValues([[value]])
}

SupabaseRange_.prototype.setValues = function (matrix) {
    const rows = Array.isArray(matrix) ? matrix : []
    if (!rows.length) return

    const updates = []
    const currentRows = this.sheet_._loadRows_()

    for (let r = 0; r < rows.length; r++) {
        const targetRowNum = this.row_ + r
        const rowValues = Array.isArray(rows[r]) ? rows[r] : []

        if (targetRowNum === 1) {
            for (let c = 0; c < rowValues.length; c++) {
                const headerIdx = this.col_ - 1 + c
                if (headerIdx < 0) continue
                while (this.sheet_.headers_.length <= headerIdx) this.sheet_.headers_.push('')
                this.sheet_.headers_[headerIdx] = String(rowValues[c] == null ? '' : rowValues[c])
            }
            continue
        }

        const dataIdx = targetRowNum - 2
        if (dataIdx < 0 || dataIdx >= currentRows.length) throw new Error('Fila invalida en ' + this.sheet_.getName() + '.')

        const baseRow = this.sheet_.def_.toRow(currentRows[dataIdx])
        for (let c = 0; c < rowValues.length; c++) {
            const targetCol = this.col_ - 1 + c
            if (targetCol < 0) continue
            while (baseRow.length <= targetCol) baseRow.push('')
            baseRow[targetCol] = rowValues[c]
        }
        updates.push({
            current: currentRows[dataIdx],
            row: baseRow
        })
    }

    this.sheet_._upsertRowsByIndex_(updates)
}
