/**
 * ============================================================================
 * BACKEND COMPLETO - GESTIÃ“N DE COBROS v2.0 + PATCH GESTIÃ“N
 * ============================================================================
 * INCLUYE:
 * 1) Core: ValidaciÃ³n, Procesamiento y PDF Estilo Preimpreso (Pro).
 * 2) Panel: KPIs y GrÃ¡ficos.
 * 3) Historial: Consulta de registros.
 * 4) âœ… MÃ³dulo de Reportes (Filtro por fechas).
 * 5) âœ… GestiÃ³n de Usuarios y Roles (Admin).
 * 6) âœ… NUEVO: MÃ³dulo GESTIÃ“N (Tabla + filtros + Etapas + Progreso + PDF)
 */

const PDF_ROOT_KEY = 'PDF_ROOT_ID';
// Ajusta si tu hoja 'Aprobaciones' tiene la columna PDF en otra posiciÃ³n
const COL_PDF_URL = 25; // 25 = Ãºltima columna del appendRow actual

// âœ… PATCH GESTIÃ“N: columnas de Etapa y Ãšlt. Act (segÃºn tu appendRow actual)
const COL_ETAPA = 18; // Columna 18 = Etapa
const COL_ULT_ACT = 20; // Columna 20 = Ãšlt. Act (fecha)
const COL_ESTADO = 14; // Columna 14 = Estado (macro)

const SHEET_BITACORA = 'Bitacora';
const SHEET_CORREOS = 'Correos';
const SHEET_APROBACIONES_CRITICAS = 'Aprobaciones_Criticas';
const SHEET_PLANTILLAS = 'Plantillas';
const PASSWORD_HASH_PREFIX = 'sha256$';
const EMAIL_INVENTARIOS_KEY = 'EMAIL_INVENTARIOS';
const EMAIL_TRANSPORTE_KEY = 'EMAIL_TRANSPORTE';
const EMAIL_SUPERVISOR_KEY = 'EMAIL_SUPERVISOR';
const EMAIL_ADMIN_KEY = 'EMAIL_ADMIN';
const EMAIL_CYC_KEY = 'EMAIL_CYC';
const EMAIL_FACTURACION_KEY = 'EMAIL_FACTURACION';
const EMAIL_CONTABILIDAD_KEY = 'EMAIL_CONTABILIDAD';
const RESEND_API_KEY_PROP = 'RESEND_API_KEY';
const RESEND_FROM_PROP = 'RESEND_FROM';
const RESEND_REPLY_TO_PROP = 'RESEND_REPLY_TO';
const RESEND_USER_AGENT = 'CobroTransporteAppsScript/1.0';
const PROCESS_KEY_DEFAULT = 'cobro_transporte';
const SLA_DAILY_DIGEST_PREFIX = 'SLA_DAILY_DIGEST_';
let cfgStageSlaRowsMemo_ = null;
let cfgStageSlaSettingsMemo_ = null;
let cfgStageNotifyRowsMemo_ = null;
let cfgStageNotifySettingsMemo_ = null;
let supportedCountryCatalogMemo_ = null;

const CFG_SHEET_DEFS = {
    CFG_COUNTRY: ['CountryCode', 'Nombre', 'Moneda', 'Timezone', 'Locale', 'Activo', 'UpdatedAt'],
    CFG_ROLE: ['RoleId', 'RoleKey', 'RoleName', 'Activo', 'UpdatedAt'],
    CFG_USER_ROLE_SCOPE: ['ScopeId', 'UserEmail', 'RoleKey', 'CountryCode', 'BusinessUnit', 'Activo', 'UpdatedAt'],
    CFG_FLOW_STAGE: ['ProcessKey', 'StageOrder', 'StageCode', 'StageName', 'RequiredFieldsJson', 'RequiredDocsJson', 'Active'],
    CFG_STAGE_SLA: ['ProcessKey', 'StageOrder', 'StageName', 'SlaHours', 'Activo', 'Notas', 'UpdatedAt'],
    CFG_STAGE_NOTIFY: ['ProcessKey', 'StageOrder', 'StageName', 'AreaTo', 'CcAreas', 'Activo', 'Notas', 'UpdatedAt'],
    CFG_RULE: ['RuleId', 'Nombre', 'ProcessKey', 'Prioridad', 'CountryScope', 'StageFrom', 'StageTo', 'TriggerEvent', 'ConditionJson', 'ActionJson', 'StopOnMatch', 'Activo', 'ValidFrom', 'ValidTo', 'UpdatedAt'],
    CFG_TEMPLATE: ['TemplateId', 'EventKey', 'CountryCode', 'Language', 'Channel', 'Subject', 'Body', 'Activo', 'UpdatedAt'],
    CFG_AUTH_KEY: ['KeyId', 'Nombre', 'ClaveHash', 'Scope', 'Activo', 'MaxUsos', 'UsosActuales', 'UltimoUsoAt', 'Notas', 'UpdatedAt']
};

const AUTH_KEY_SCOPE = {
    DELETE_SINGLE: 'GESTION_DELETE_SINGLE',
    DELETE_BULK: 'GESTION_DELETE_BULK',
    DELETE_ANY: 'GESTION_DELETE_ANY'
};

// âœ… ETAPAS (SEGÃšN IMAGEN)
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

const WF = {
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

const WF_REQUIRED_HEADERS = Object.keys(WF).map(k => WF[k]);

const AREA = {
    LI: 'Logistica Inversa',
    TRANSPORTE: 'Transporte',
    INVENTARIO: 'Inventario',
    CYC: 'Creditos y Cobros',
    FACTURACION: 'Facturacion',
    CONTABILIDAD: 'Contabilidad',
    PROVEEDOR_SEG: 'Proveedor (seguimiento Transporte)'
};

const PROVEEDOR_HEADERS = ['Codigo', 'Nombre', 'Correo', 'CountryCode'];
const PILOTO_HEADERS = ['DNI', 'NOMBRE COMPLETO', 'CountryCode'];
const MAESTRO_HEADERS = ['Codigo', 'Descripcion', 'uxc', 'Precio con IGV', 'Precio sin IGV', 'EAN', 'Activo', 'CountryCode'];
const USER_SHEET_HEADERS = ['Email', 'Nombre', 'Rol', 'Password', 'Activo', 'Area', 'CountryCode'];
const DEFAULT_COUNTRY_CODE = 'PE';
const SUPPORTED_COUNTRY_ORDER = ['SV', 'PE', 'GT'];
const SUPPORTED_COUNTRY_CATALOG = {
    SV: {
        countryCode: 'SV',
        name: 'El Salvador',
        currency: 'USD',
        timezone: 'America/El_Salvador',
        locale: 'es-SV',
        active: true
    },
    PE: {
        countryCode: 'PE',
        name: 'Peru',
        currency: 'PEN',
        timezone: 'America/Lima',
        locale: 'es-PE',
        active: true
    },
    GT: {
        countryCode: 'GT',
        name: 'Guatemala',
        currency: 'GTQ',
        timezone: 'America/Guatemala',
        locale: 'es-GT',
        active: true
    }
};

// --- 1. CONFIGURACIÃ“N DRIVE ---

function ensurePdfRoot_() {
    const props = PropertiesService.getScriptProperties();
    let id = props.getProperty(PDF_ROOT_KEY);
    if (id) { try { DriveApp.getFolderById(id); return id; } catch (e) { } }
    const root = DriveApp.createFolder('CobroTransporte_PDF');
    props.setProperty(PDF_ROOT_KEY, root.getId());
    return root.getId();
}

function slug_(s) {
    return String(s || '')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9-_]+/g, '_')
        .replace(/_+/g, '_').replace(/^_|_$/g, '');
}

function normalizeCountryCode_(raw) {
    const code = String(raw || '').trim().toUpperCase();
    return SUPPORTED_COUNTRY_CATALOG[code] ? code : '';
}

function getSupportedCountryCatalog_() {
    if (supportedCountryCatalogMemo_) return supportedCountryCatalogMemo_;
    const configured = {};
    try {
        const rows = getCfgCountries_();
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i] || {};
            const code = normalizeCountryCode_(row.countryCode);
            if (!code) continue;
            configured[code] = row;
        }
    } catch (e) { }

    supportedCountryCatalogMemo_ = SUPPORTED_COUNTRY_ORDER.map(code => {
        const base = SUPPORTED_COUNTRY_CATALOG[code] || {};
        const custom = configured[code] || {};
        return {
            countryCode: code,
            name: String(custom.name || base.name || code).trim(),
            currency: String(custom.currency || base.currency || '').trim().toUpperCase(),
            timezone: String(custom.timezone || base.timezone || Session.getScriptTimeZone()).trim(),
            locale: String(custom.locale || base.locale || 'es-PE').trim(),
            active: true
        };
    });
    return supportedCountryCatalogMemo_;
}

function resolveCountryMeta_(countryCode) {
    const catalog = getSupportedCountryCatalog_();
    const wanted = normalizeCountryCode_(countryCode) || DEFAULT_COUNTRY_CODE;
    for (let i = 0; i < catalog.length; i++) {
        const row = catalog[i] || {};
        if (String(row.countryCode || '').toUpperCase() === wanted) return row;
    }
    return SUPPORTED_COUNTRY_CATALOG[DEFAULT_COUNTRY_CODE];
}

function getFolderByIdSafe_(folderId) {
    try {
        return folderId ? DriveApp.getFolderById(String(folderId)) : null;
    } catch (e) {
        return null;
    }
}

function getOrCreateChildFolder_(parentFolder, folderName) {
    const iter = parentFolder.getFoldersByName(folderName);
    return iter.hasNext() ? iter.next() : parentFolder.createFolder(folderName);
}

function getOrCreateCountryFolder_(countryCode, countryName) {
    const rootId = ensurePdfRoot_();
    const root = DriveApp.getFolderById(rootId);
    const country = resolveCountryMeta_(countryCode);
    const safeName = String(country.countryCode || DEFAULT_COUNTRY_CODE) + '_' + (slug_(countryName || country.name) || 'pais');
    return getOrCreateChildFolder_(root, safeName);
}

function getOrCreateProviderFolder_(providerName, providerCode, countryCode, countryName) {
    const parent = normalizeCountryCode_(countryCode)
        ? getOrCreateCountryFolder_(countryCode, countryName)
        : DriveApp.getFolderById(ensurePdfRoot_());
    const safeName = (providerCode ? providerCode + '_' : '') + (slug_(providerName) || 'sin_proveedor');
    return getOrCreateChildFolder_(parent, safeName);
}

function buildProcessFolderName_(processId, createdAt, countryCode) {
    const country = resolveCountryMeta_(countryCode);
    const when = createdAt ? new Date(createdAt) : new Date();
    const safeDate = isNaN(when.getTime()) ? new Date() : when;
    const stamp = Utilities.formatDate(safeDate, country.timezone || Session.getScriptTimeZone(), 'yyyyMMdd_HHmmss');
    const safeId = slug_(processId) || ('proc_' + stamp);
    return safeId + '_' + stamp;
}

function ensureProcessFolderForCobro_(opts) {
    const data = opts || {};
    const existing = getFolderByIdSafe_(data.processFolderId);
    const country = resolveCountryMeta_(data.countryCode);
    if (existing) {
        return {
            folder: existing,
            folderId: existing.getId(),
            folderUrl: existing.getUrl(),
            folderName: existing.getName(),
            countryCode: country.countryCode,
            countryName: String(data.countryName || country.name || '').trim()
        };
    }

    const providerFolder = getOrCreateProviderFolder_(
        data.providerName,
        data.providerCode,
        country.countryCode,
        data.countryName || country.name
    );
    const folderName = buildProcessFolderName_(data.processId, data.createdAt, country.countryCode);
    const folder = getOrCreateChildFolder_(providerFolder, folderName);
    return {
        folder: folder,
        folderId: folder.getId(),
        folderUrl: folder.getUrl(),
        folderName: folder.getName(),
        countryCode: country.countryCode,
        countryName: String(data.countryName || country.name || '').trim()
    };
}

function applyDriveSharePolicy_(fileObj) {
    const f = fileObj;
    if (!f) return;
    const domainOnly = boolConfig_('pdfDomainOnly', false);
    try {
        if (domainOnly) {
            f.setSharing(DriveApp.Access.DOMAIN_WITH_LINK, DriveApp.Permission.VIEW);
        } else {
            f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        }
    } catch (e) {
        try { f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (ex) { }
    }
}

// --- 2. CÃLCULOS ---

function calcCajasUnidades_(uxc, cantidad) {
    const u = Number(uxc || 0);
    const q = Number(cantidad || 0);
    if (!q) return { cajas: 0, unidades: 0 };
    if (!u || u <= 1) return { cajas: 0, unidades: q };
    const cajas = Math.floor(q / u);
    const unidades = q - (cajas * u);
    return { cajas, unidades };
}

// --- 3. SERVICIO WEB ---

function doGet() {
    try { ensureSupabaseScriptProperties_(); } catch (e) { }
    try { initSistemaCobros(); } catch (e) { }
    return HtmlService.createTemplateFromFile('Index').evaluate()
        .setTitle('Gestión de Cobros Transporte')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
        .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0');
}

function include(filename) {
    return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// --- 4. AUTENTICACIÃ“N Y DATOS ---

function normalizeKey_(s) {
    return String(s || '')
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '');
}

function areaKey_(v) {
    return normalizeKey_(v);
}

function normalizeRole_(rolRaw) {
    const r = normalizeKey_(rolRaw);
    if (!r) return '';
    if (r === 'admin' || r === 'administrador') return 'admin';
    if (r === 'supervisor') return 'supervisor';
    if (r === 'cobrador' || r === 'logisticainversa') return 'logistica_inversa';
    if (r === 'transporte') return 'transporte';
    if (r === 'inventario') return 'inventario';
    if (r === 'creditosycobros' || r === 'cyc' || r === 'creditoscobros') return 'creditos_cobros';
    if (r === 'facturacion') return 'facturacion';
    if (r === 'contabilidad' || r === 'conta') return 'contabilidad';
    return String(rolRaw || '').toLowerCase().trim();
}

function inferAreaFromRole_(roleNorm) {
    if (roleNorm === 'logistica_inversa' || roleNorm === 'cobrador') return AREA.LI;
    if (roleNorm === 'transporte') return AREA.TRANSPORTE;
    if (roleNorm === 'inventario') return AREA.INVENTARIO;
    if (roleNorm === 'creditos_cobros' || roleNorm === 'cyc') return AREA.CYC;
    if (roleNorm === 'facturacion') return AREA.FACTURACION;
    if (roleNorm === 'contabilidad' || roleNorm === 'conta') return AREA.CONTABILIDAD;
    if (roleNorm === 'supervisor') return 'Supervisor';
    if (roleNorm === 'admin') return 'Administrador';
    return '';
}

function normalizeAuthKeyScope_(scopeRaw) {
    const raw = String(scopeRaw || '').trim().toUpperCase();
    if (!raw) return AUTH_KEY_SCOPE.DELETE_ANY;
    if (raw === AUTH_KEY_SCOPE.DELETE_SINGLE || raw === 'DELETE_SINGLE' || raw === 'SINGLE') return AUTH_KEY_SCOPE.DELETE_SINGLE;
    if (raw === AUTH_KEY_SCOPE.DELETE_BULK || raw === 'DELETE_BULK' || raw === 'BULK') return AUTH_KEY_SCOPE.DELETE_BULK;
    if (raw === AUTH_KEY_SCOPE.DELETE_ANY || raw === 'DELETE_ANY' || raw === 'ANY' || raw === '*' || raw === 'ALL') return AUTH_KEY_SCOPE.DELETE_ANY;
    return AUTH_KEY_SCOPE.DELETE_ANY;
}

function authKeyScopeLabel_(scopeRaw) {
    const scope = normalizeAuthKeyScope_(scopeRaw);
    if (scope === AUTH_KEY_SCOPE.DELETE_SINGLE) return 'Eliminacion individual';
    if (scope === AUTH_KEY_SCOPE.DELETE_BULK) return 'Eliminacion multiple';
    return 'Eliminacion individual y multiple';
}

function splitEmails_(raw) {
    const txt = String(raw || '').trim();
    if (!txt) return [];
    const arr = txt.split(/[;,]+/).map(x => String(x || '').trim()).filter(Boolean);
    const out = [];
    const seen = {};
    for (let i = 0; i < arr.length; i++) {
        const mail = arr[i];
        const k = mail.toLowerCase();
        if (!k || seen[k]) continue;
        seen[k] = true;
        out.push(mail);
    }
    return out;
}

function csvEmails_(raw) {
    return splitEmails_(raw).join(',');
}

function mergeEmails_() {
    const merged = [];
    const seen = {};
    for (let i = 0; i < arguments.length; i++) {
        const list = splitEmails_(arguments[i]);
        for (let j = 0; j < list.length; j++) {
            const mail = list[j];
            const key = mail.toLowerCase();
            if (seen[key]) continue;
            seen[key] = true;
            merged.push(mail);
        }
    }
    return merged.join(',');
}

function removeEmails_(list, exclude) {
    const ex = {};
    const exArr = splitEmails_(exclude);
    for (let i = 0; i < exArr.length; i++) {
        ex[exArr[i].toLowerCase()] = true;
    }
    const filtered = splitEmails_(list).filter(e => !ex[e.toLowerCase()]);
    return filtered.join(',');
}

function sha256Hex_(raw) {
    const bytes = Utilities.computeDigest(
        Utilities.DigestAlgorithm.SHA_256,
        String(raw || ''),
        Utilities.Charset.UTF_8
    );
    return bytes.map(b => {
        const v = (b < 0) ? b + 256 : b;
        const h = v.toString(16);
        return h.length === 1 ? ('0' + h) : h;
    }).join('');
}

function randomSalt_() {
    return Utilities.getUuid().replace(/-/g, '').slice(0, 16);
}

function hashPassword_(plain, salt) {
    const s = String(salt || randomSalt_());
    return PASSWORD_HASH_PREFIX + s + '$' + sha256Hex_(s + '|' + String(plain || ''));
}

function isHashedPassword_(stored) {
    return /^sha256\$[a-zA-Z0-9]{8,}\$[a-f0-9]{64}$/.test(String(stored || ''));
}

function verifyPassword_(plain, stored) {
    const saved = String(stored || '');
    if (!saved) return false;

    // Compatibilidad con usuarios legacy en texto plano.
    if (!isHashedPassword_(saved)) return String(plain || '') === saved;

    const parts = saved.split('$');
    const salt = parts[1] || '';
    const expected = parts[2] || '';
    return sha256Hex_(salt + '|' + String(plain || '')) === expected;
}

function ensureUsersSheet_() {
    return ensureSheetSchema_('Usuarios', USER_SHEET_HEADERS);
}

function buildUserHeaderMeta_(headers) {
    const map = buildHeaderMap_(headers || []);
    return {
        map: map,
        email: headerIdx_(map, ['Email', 'Correo', 'Mail']),
        nombre: headerIdx_(map, ['Nombre', 'Nombre Completo', 'FullName']),
        rol: headerIdx_(map, ['Rol', 'Role']),
        password: headerIdx_(map, ['Password', 'Clave', 'PasswordHash']),
        activo: headerIdx_(map, ['Activo', 'Enabled', 'Habilitado']),
        area: headerIdx_(map, ['Area', 'Departamento', 'AreaResponsable', 'AreaUsuario']),
        countryCode: headerIdx_(map, ['CountryCode', 'Pais', 'PaisCode', 'Country'])
    };
}

function userCell_(row, meta, key, fallbackIdx) {
    const idx = meta && typeof meta[key] === 'number' ? meta[key] : -1;
    if (idx >= 0 && idx < row.length) return row[idx];
    return row[fallbackIdx];
}

function applyUserValuesToRow_(row, meta, values) {
    const out = Array.isArray(row) ? row.slice() : [];
    const totalCols = Math.max(out.length, USER_SHEET_HEADERS.length);
    while (out.length < totalCols) out.push('');

    const setVal = function (key, fallbackIdx, value) {
        const idx = meta && typeof meta[key] === 'number' && meta[key] >= 0 ? meta[key] : fallbackIdx;
        out[idx] = value;
    };

    setVal('email', 0, values.email);
    setVal('nombre', 1, values.nombre);
    setVal('rol', 2, values.rol);
    setVal('password', 3, values.password);
    setVal('activo', 4, values.activo);
    setVal('area', 5, values.area);
    setVal('countryCode', 6, values.countryCode);
    return out;
}

function mapUserRow_(row, rowNum, meta) {
    const email = String(userCell_(row, meta, 'email', 0) || '').trim().toLowerCase();
    const rawRole = String(userCell_(row, meta, 'rol', 2) || '').trim();
    const rol = normalizeRole_(rawRole || '');
    const area = String(userCell_(row, meta, 'area', 5) || '').trim() || inferAreaFromRole_(rol);
    const countryCode = normalizeCountryCode_(userCell_(row, meta, 'countryCode', 6));
    const country = countryCode ? resolveCountryMeta_(countryCode) : null;
    return {
        row: Number(rowNum || 0),
        email: email,
        nombre: String(userCell_(row, meta, 'nombre', 1) || '').trim(),
        rol: rol || rawRole,
        password: String(userCell_(row, meta, 'password', 3) || ''),
        activo: parseBoolLoose_(userCell_(row, meta, 'activo', 4), true),
        area: area,
        countryCode: country ? country.countryCode : '',
        countryName: country ? country.name : ''
    };
}

function getUsersGridMeta_() {
    const sh = ensureUsersSheet_();
    const values = sh.getDataRange().getValues();
    const headers = values[0] || USER_SHEET_HEADERS;
    return {
        sh: sh,
        values: values,
        headers: headers,
        meta: buildUserHeaderMeta_(headers)
    };
}

function findUserRecordByEmail_(email) {
    const target = String(email || '').trim().toLowerCase();
    if (!target) return null;
    const grid = getUsersGridMeta_();
    const values = grid.values || [];
    for (let i = 1; i < values.length; i++) {
        const user = mapUserRow_(values[i] || [], i + 1, grid.meta);
        if (user.email === target) return user;
    }
    return null;
}

function findUserRecordByName_(name) {
    const target = String(name || '').trim().toLowerCase();
    if (!target) return null;
    const grid = getUsersGridMeta_();
    const values = grid.values || [];
    let fallback = null;
    for (let i = 1; i < values.length; i++) {
        const user = mapUserRow_(values[i] || [], i + 1, grid.meta);
        if (String(user.nombre || '').trim().toLowerCase() !== target) continue;
        if (user.activo) return user;
        if (!fallback) fallback = user;
    }
    return fallback;
}

function getResponsablesCatalog_() {
    const cacheKey = 'responsables:all';
    const cached = cacheGetJson_(cacheKey);
    if (Array.isArray(cached)) return cached;

    const grid = getUsersGridMeta_();
    const values = grid.values || [];
    const out = [];
    for (let i = 1; i < values.length; i++) {
        const user = mapUserRow_(values[i] || [], i + 1, grid.meta);
        if (!user.activo || !user.email || !user.nombre || !user.countryCode) continue;
        out.push({
            row: user.row,
            email: user.email,
            nombre: user.nombre,
            rol: user.rol,
            area: user.area,
            countryCode: user.countryCode,
            countryName: user.countryName,
            activo: true
        });
    }
    out.sort((a, b) => String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es', { sensitivity: 'base' }));
    cachePutJson_(cacheKey, out, 120);
    return out;
}

function getResponsablesCatalog() {
    return getResponsablesCatalog_();
}

function resolveResponsableContext_(formObject) {
    const payload = formObject || {};
    const explicitEmail = String(payload.responsableEmail || '').trim().toLowerCase();
    const explicitName = String(payload.responsable || '').trim();
    const explicitCountry = normalizeCountryCode_(payload.countryCode);
    const user = explicitEmail
        ? findUserRecordByEmail_(explicitEmail)
        : findUserRecordByName_(explicitName);
    if (user && !user.activo) {
        return { success: false, message: 'El responsable seleccionado no esta activo.' };
    }
    const responsableNombre = String((user && user.nombre) || explicitName || '').trim();
    const responsableEmail = String((user && user.email) || explicitEmail || '').trim().toLowerCase();
    const countryCode = normalizeCountryCode_((user && user.countryCode) || explicitCountry);
    if (!responsableNombre) {
        return { success: false, message: 'Debe seleccionar un responsable valido.' };
    }
    if (!countryCode) {
        return { success: false, message: 'El usuario seleccionado no tiene un pais valido asignado.' };
    }
    const country = resolveCountryMeta_(countryCode);
    return {
        success: true,
        nombre: responsableNombre,
        email: responsableEmail,
        countryCode: country.countryCode,
        countryName: country.name
    };
}

function inferCountryCodeFromResponsable_(responsable) {
    const user = findUserRecordByName_(responsable);
    return user && user.countryCode ? String(user.countryCode) : '';
}

function getUsuarioActivoByEmail_(email) {
    const target = String(email || '').trim().toLowerCase();
    if (!target) return { ok: false, message: 'Correo requerido.' };

    const user = findUserRecordByEmail_(target);
    if (!user) return { ok: false, message: 'Usuario no encontrado.' };
    if (!user.activo) return { ok: false, message: 'Usuario no activo.' };

    return {
        ok: true,
        row: user.row,
        nombre: user.nombre,
        email: user.email,
        rol: user.rol,
        password: user.password,
        area: user.area,
        countryCode: user.countryCode,
        countryName: user.countryName
    };
}

function validarUsuario(email, password) {
    const user = getUsuarioActivoByEmail_(email);
    if (!user.ok) return { success: false, message: "Credenciales incorrectas o usuario no activo." };
    if (!verifyPassword_(password, user.password)) {
        return { success: false, message: "Credenciales incorrectas o usuario no activo." };
    }
    return {
        success: true,
        nombre: user.nombre,
        email: user.email,
        rol: user.rol,
        countryCode: user.countryCode || '',
        countryName: user.countryName || ''
    };
}

function restaurarSesionUsuario(email) {
    const user = getUsuarioActivoByEmail_(email);
    if (!user.ok) return { success: false, message: "Sesion no valida o usuario no activo." };
    return {
        success: true,
        nombre: user.nombre,
        email: user.email,
        rol: user.rol,
        countryCode: user.countryCode || '',
        countryName: user.countryName || ''
    };
}

function findSheetByNormalizedName_(ss, wantedNames) {
    const names = Array.isArray(wantedNames) ? wantedNames : [wantedNames];
    const wanted = {};
    const wantedList = [];
    for (let i = 0; i < names.length; i++) {
        const key = normalizeKey_(names[i]);
        if (key) {
            wanted[key] = true;
            wantedList.push(key);
        }
    }
    const sheets = ss ? ss.getSheets() : [];
    for (let i = 0; i < sheets.length; i++) {
        const sh = sheets[i];
        if (wanted[normalizeKey_(sh.getName())]) return sh;
    }
    for (let i = 0; i < sheets.length; i++) {
        const sh = sheets[i];
        const normalizedName = normalizeKey_(sh.getName());
        for (let j = 0; j < wantedList.length; j++) {
            const wantedKey = wantedList[j];
            if (!wantedKey) continue;
            if (normalizedName.indexOf(wantedKey) >= 0 || wantedKey.indexOf(normalizedName) >= 0) return sh;
        }
    }
    return null;
}

function buildMaestroHeaderMeta_(headers) {
    const map = buildHeaderMap_(headers || []);
    return {
        map: map,
        codigo: headerIdx_(map, ['Codigo', 'CÃ³digo', 'CodigoItem', 'Codigo_Item', 'SKU', 'Item']),
        descripcion: headerIdx_(map, ['Descripcion', 'DescripciÃ³n', 'Producto', 'DescripcionProducto', 'Nombre']),
        uxc: headerIdx_(map, ['uxc', 'UXC', 'UnidadXCaja', 'UnidadesXCaja', 'UnidXCaja']),
        precioConIgv: headerIdx_(map, ['Precio con IGV', 'PrecioConIGV', 'PrecioIGV', 'PrecioVenta', 'PVP']),
        precioSinIgv: headerIdx_(map, ['Precio sin IGV', 'PrecioSinIGV', 'PrecioBase', 'Costo', 'Valor']),
        ean: headerIdx_(map, ['EAN', 'Barcode', 'CodigoBarra', 'Codigo_Barra', 'CÃ³digo de Barra']),
        activo: headerIdx_(map, ['Activo', 'Estado', 'Habilitado', 'Enabled']),
        countryCode: headerIdx_(map, ['CountryCode', 'Pais', 'PaisCode', 'Country'])
    };
}

function buildProveedorHeaderMeta_(headers) {
    const map = buildHeaderMap_(headers || []);
    return {
        map: map,
        codigo: headerIdx_(map, ['Codigo', 'CÃ³digo', 'ProveedorCodigo', 'Proveedor_Codigo', 'CodProveedor']),
        nombre: headerIdx_(map, ['Nombre', 'Proveedor', 'RazonSocial', 'RazÃ³n Social', 'NombreProveedor']),
        email: headerIdx_(map, ['Correo', 'Email', 'Mail', 'CorreoElectronico', 'Correo ElectrÃ³nico']),
        countryCode: headerIdx_(map, ['CountryCode', 'Pais', 'PaisCode', 'Country'])
    };
}

function buildPilotoHeaderMeta_(headers) {
    const map = buildHeaderMap_(headers || []);
    return {
        map: map,
        dni: headerIdx_(map, ['DNI', 'Documento', 'DocumentoIdentidad', 'DocIdentidad', 'Cedula', 'CÃ©dula']),
        nombre: headerIdx_(map, ['NOMBRE COMPLETO', 'Nombre Completo', 'Nombre', 'Piloto', 'Chofer', 'Conductor']),
        countryCode: headerIdx_(map, ['CountryCode', 'Pais', 'PaisCode', 'Country'])
    };
}

function resolveCatalogCountryCode_(raw) {
    return normalizeCountryCode_(raw) || DEFAULT_COUNTRY_CODE;
}

function actorCanAccessCatalogCountry_(profile, countryCode) {
    if (!actorCountryFilterEnabled_(profile)) return true;
    return resolveCatalogCountryCode_(countryCode) === normalizeCountryCode_(profile.countryCode);
}

function resolveCatalogActorContext_(actorEmail) {
    const profile = getUserProfile_(actorEmail);
    if (!profile || !profile.email) {
        return { ok: false, message: 'Sesion invalida o expirada.' };
    }
    const actorCountry = normalizeCountryCode_(profile.countryCode);
    if (!actorCountry) {
        return { ok: false, message: 'El usuario no tiene un pais asignado.' };
    }
    return { ok: true, profile: profile, countryCode: actorCountry };
}

function proveedorCell_(row, meta, key, fallbackIdx) {
    const idx = meta && typeof meta[key] === 'number' ? meta[key] : -1;
    if (idx >= 0 && idx < row.length) return row[idx];
    return row[fallbackIdx];
}

function pilotoCell_(row, meta, key, fallbackIdx) {
    const idx = meta && typeof meta[key] === 'number' ? meta[key] : -1;
    if (idx >= 0 && idx < row.length) return row[idx];
    return row[fallbackIdx];
}

function maestroCell_(row, meta, key, fallbackIdx) {
    const idx = meta && typeof meta[key] === 'number' ? meta[key] : -1;
    if (idx >= 0 && idx < row.length) return row[idx];
    return row[fallbackIdx];
}

function applyProveedorValuesToRow_(row, meta, values) {
    const out = Array.isArray(row) ? row.slice() : [];
    const lastCol = Math.max(out.length, PROVEEDOR_HEADERS.length);
    while (out.length < lastCol) out.push('');

    const setVal = function (key, fallbackIdx, value) {
        const idx = meta && typeof meta[key] === 'number' && meta[key] >= 0 ? meta[key] : fallbackIdx;
        out[idx] = value;
    };

    setVal('codigo', 0, values.codigo);
    setVal('nombre', 1, values.nombre);
    setVal('email', 2, values.email);
    setVal('countryCode', 3, resolveCatalogCountryCode_(values.countryCode));
    return out;
}

function applyPilotoValuesToRow_(row, meta, values) {
    const out = Array.isArray(row) ? row.slice() : [];
    const lastCol = Math.max(out.length, PILOTO_HEADERS.length);
    while (out.length < lastCol) out.push('');

    const setVal = function (key, fallbackIdx, value) {
        const idx = meta && typeof meta[key] === 'number' && meta[key] >= 0 ? meta[key] : fallbackIdx;
        out[idx] = value;
    };

    setVal('dni', 0, values.dni);
    setVal('nombre', 1, values.nombre);
    setVal('countryCode', 2, resolveCatalogCountryCode_(values.countryCode));
    return out;
}

function applyMaestroValuesToRow_(row, meta, values) {
    const out = Array.isArray(row) ? row.slice() : [];
    const lastCol = Math.max(out.length, MAESTRO_HEADERS.length);
    while (out.length < lastCol) out.push('');

    const setVal = function (key, fallbackIdx, value) {
        const idx = meta && typeof meta[key] === 'number' && meta[key] >= 0 ? meta[key] : fallbackIdx;
        out[idx] = value;
    };

    setVal('codigo', 0, values.codigo);
    setVal('descripcion', 1, values.descripcion);
    setVal('uxc', 2, values.uxc);
    setVal('precioConIgv', 3, values.precioConIgv);
    setVal('precioSinIgv', 4, values.precioSinIgv);
    setVal('ean', 5, values.ean);
    setVal('activo', 6, values.activo);
    setVal('countryCode', 7, resolveCatalogCountryCode_(values.countryCode));
    return out;
}

function mapProveedorRow_(row, rowNum, providerMeta) {
    const meta = providerMeta || buildProveedorHeaderMeta_(PROVEEDOR_HEADERS);
    return {
        row: Number(rowNum || 0),
        codigo: String(proveedorCell_(row, meta, 'codigo', 0) || '').trim(),
        nombre: String(proveedorCell_(row, meta, 'nombre', 1) || '').trim(),
        email: String(proveedorCell_(row, meta, 'email', 2) || '').trim(),
        countryCode: resolveCatalogCountryCode_(proveedorCell_(row, meta, 'countryCode', 3))
    };
}

function mapPilotoRow_(row, rowNum, pilotoMeta) {
    const meta = pilotoMeta || buildPilotoHeaderMeta_(PILOTO_HEADERS);
    return {
        row: Number(rowNum || 0),
        dni: String(pilotoCell_(row, meta, 'dni', 0) || '').trim(),
        nombre: String(pilotoCell_(row, meta, 'nombre', 1) || '').trim(),
        countryCode: resolveCatalogCountryCode_(pilotoCell_(row, meta, 'countryCode', 2))
    };
}

function mapMaestroRawRow_(row, rowNum, maestroMeta) {
    const raw = Array.isArray(row) ? row : [];
    const precioConIgv = Number(raw[3] || 0);
    const precioSinIgv = Number(raw[4] || 0);
    return {
        row: Number(rowNum || 0),
        codigo: String(raw[0] || '').trim(),
        descripcion: String(raw[1] || '').trim(),
        uxc: Number(raw[2] || 0),
        precioConIgv: precioConIgv,
        precioSinIgv: precioSinIgv,
        precio: precioSinIgv || precioConIgv || 0,
        ean: String(raw[5] || '').trim(),
        activo: parseBoolLoose_(raw[6], true),
        countryCode: resolveCatalogCountryCode_(maestroCell_(raw, maestroMeta || buildMaestroHeaderMeta_(MAESTRO_HEADERS), 'countryCode', 7))
    };
}

function collectMaestroItemsFromGrid_(grid, maestroMeta) {
    const rows = Array.isArray(grid) ? grid : [];
    const meta = maestroMeta || buildMaestroHeaderMeta_(rows[0] || MAESTRO_HEADERS);
    const mapped = [];
    const raw = [];
    for (let i = 1; i < rows.length; i++) {
        const rowNum = i + 1;
        const row = rows[i] || [];
        const mappedItem = mapMaestroRow_(row, rowNum, meta);
        if (mappedItem.codigo || mappedItem.descripcion || mappedItem.ean) mapped.push(mappedItem);
        const rawItem = mapMaestroRawRow_(row, rowNum, meta);
        if (rawItem.codigo || rawItem.descripcion || rawItem.ean) raw.push(rawItem);
    }
    return {
        mapped: mapped,
        raw: raw,
        items: mapped.length ? mapped : raw
    };
}

function ensureMaestroSheet_() {
    const ss = getDataStore_();
    let sh = ss.getSheetByName('maestro') || findSheetByNormalizedName_(ss, ['maestro', 'tabla maestro', 'tabla_maestro', 'tablamaestro']);
    if (!sh) {
        sh = ss.insertSheet('maestro');
        sh.getRange(1, 1, 1, MAESTRO_HEADERS.length).setValues([MAESTRO_HEADERS]);
        return sh;
    }

    if (sh.getLastRow() < 1) {
        sh.getRange(1, 1, 1, MAESTRO_HEADERS.length).setValues([MAESTRO_HEADERS]);
        return sh;
    }

    let lastCol = Math.max(sh.getLastColumn(), MAESTRO_HEADERS.length);
    const headerRange = sh.getRange(1, 1, 1, lastCol);
    const headers = headerRange.getValues()[0] || [];
    const map = buildHeaderMap_(headers);
    for (let i = 0; i < MAESTRO_HEADERS.length; i++) {
        const header = MAESTRO_HEADERS[i];
        if (headerIdx_(map, [header]) >= 0) continue;
        if (!String(headers[i] || '').trim()) {
            sh.getRange(1, i + 1).setValue(header);
            headers[i] = header;
            map[normalizeKey_(header)] = i;
            continue;
        }
        lastCol += 1;
        sh.getRange(1, lastCol).setValue(header);
        headers[lastCol - 1] = header;
        map[normalizeKey_(header)] = lastCol - 1;
    }

    const maestroMeta = buildMaestroHeaderMeta_(headers);
    if (sh.getLastRow() > 1 && maestroMeta.activo >= 0) {
        const activeCol = maestroMeta.activo + 1;
        const activeValues = sh.getRange(2, activeCol, sh.getLastRow() - 1, 1).getValues();
        let needsFill = false;
        for (let i = 0; i < activeValues.length; i++) {
            if (String(activeValues[i][0] || '').trim()) continue;
            activeValues[i][0] = true;
            needsFill = true;
        }
        if (needsFill) sh.getRange(2, activeCol, activeValues.length, 1).setValues(activeValues);
    }

    if (sh.getLastRow() > 1 && maestroMeta.countryCode >= 0) {
        const countryCol = maestroMeta.countryCode + 1;
        const countryValues = sh.getRange(2, countryCol, sh.getLastRow() - 1, 1).getValues();
        let needsCountryFill = false;
        for (let i = 0; i < countryValues.length; i++) {
            if (normalizeCountryCode_(countryValues[i][0])) continue;
            countryValues[i][0] = DEFAULT_COUNTRY_CODE;
            needsCountryFill = true;
        }
        if (needsCountryFill) sh.getRange(2, countryCol, countryValues.length, 1).setValues(countryValues);
    }

    return sh;
}

function mapMaestroRow_(row, rowNum, maestroMeta) {
    const meta = maestroMeta || buildMaestroHeaderMeta_(MAESTRO_HEADERS);
    const precioConIgv = Number(maestroCell_(row, meta, 'precioConIgv', 3) || 0);
    const precioSinIgv = Number(maestroCell_(row, meta, 'precioSinIgv', 4) || 0);
    return {
        row: Number(rowNum || 0),
        codigo: String(maestroCell_(row, meta, 'codigo', 0) || '').trim(),
        descripcion: String(maestroCell_(row, meta, 'descripcion', 1) || '').trim(),
        uxc: Number(maestroCell_(row, meta, 'uxc', 2) || 0),
        precioConIgv: precioConIgv,
        precioSinIgv: precioSinIgv,
        precio: precioSinIgv || precioConIgv || 0,
        ean: String(maestroCell_(row, meta, 'ean', 5) || '').trim(),
        activo: parseBoolLoose_(maestroCell_(row, meta, 'activo', 6), true),
        countryCode: resolveCatalogCountryCode_(maestroCell_(row, meta, 'countryCode', 7))
    };
}

function getDataForFrontend(actorEmail) {
    const shProv = ensureProveedoresSheet_();
    const shPil = ensurePilotosSheet_();
    const shM = ensureMaestroSheet_();

    const profile = getUserProfile_(actorEmail);
    if (!profile || !profile.email) {
        return {
            proveedores: [],
            pilotos: [],
            responsables: [],
            countries: getSupportedCountryCatalog_(),
            items: [],
            warnings: ['No se pudo validar la sesion del usuario.']
        };
    }

    const proveedores = adminGetProveedores(actorEmail);
    const pilotos = adminGetPilotos(actorEmail);
    const responsables = getResponsablesCatalog_();
    const countries = getSupportedCountryCatalog_();
    const items = (adminGetMaestroItems(actorEmail) || []).filter(x =>
        parseBoolLoose_(x && x.activo, true) &&
        (String(x && x.codigo || '').trim() || String(x && x.descripcion || '').trim() || String(x && x.ean || '').trim())
    );

    const warnings = [];
    if (!shProv || shProv.getLastRow() < 2) warnings.push("La hoja 'Proveedores' no tiene registros.");
    if (!shPil || shPil.getLastRow() < 2) warnings.push("La hoja 'Pilotos' no tiene registros.");
    if (!shM || shM.getLastRow() < 2) warnings.push("La hoja 'maestro' no tiene registros.");
    if (!responsables.length) warnings.push("No hay usuarios activos con pais asignado para Responsable.");

    return {
        proveedores: proveedores,
        pilotos: pilotos,
        responsables: responsables,
        countries: countries,
        items: items,
        warnings: warnings
    };
}

// --- 5. PROCESAMIENTO (CON VALIDACIÃ“N) ---

function procesarCobro(formObject) {
    // 1) VALIDACIÃ“N DE SEGURIDAD (PASSWORD DE CONFIRMACIÃ“N)
    const auth = validarUsuario(formObject.userEmail, formObject.passwordConfirmation);
    if (!auth.success) {
        return { status: 'error', message: 'Contraseña incorrecta. No se puede registrar.' };
    }

    const responsableCtx = resolveResponsableContext_(formObject);
    if (!responsableCtx.success) {
        return { status: 'error', message: responsableCtx.message };
    }
    formObject.responsable = responsableCtx.nombre;
    formObject.responsableEmail = responsableCtx.email;
    formObject.countryCode = responsableCtx.countryCode;
    formObject.countryName = responsableCtx.countryName;

    const ss = getDataStore_();
    const sheetAprob = ss.getSheetByName('Aprobaciones');
    const sheetDetalle = ss.getSheetByName('Detalle_Cobros');

    if (!sheetAprob) return { status: 'error', message: "No existe la hoja 'Aprobaciones'." };
    if (!sheetDetalle) return { status: 'error', message: "No existe la hoja 'Detalle_Cobros'." };
    const schema = ensureAprobacionesSchema_(sheetAprob);

    const idCobro = "COB-" + new Date().getTime();
    const fecha = new Date();
    const tieneFirmaPiloto = !!String(formObject.firmaPiloto || '').trim();
    const tieneFirmaVista = !!String(formObject.firmaVista || '').trim();
    const boletaEmitidaConFirmas = tieneFirmaPiloto && tieneFirmaVista;

    // âœ… PATCH: valores por defecto alineados a GestiÃ³n
    const etapaDefault = ETAPAS_COBRO[0]; // 1. Boleta generada
    const estadoDefault = 'Abierto';

    // 2) Guardar Cabecera
    sheetAprob.appendRow([
        idCobro, fecha, formObject.proveedorNombre, formObject.proveedorCodigo,
        formObject.unidad, formObject.ruta, "", formObject.c9, formObject.factura,
        "", "", formObject.observaciones, formObject.totalCobro, estadoDefault,
        formObject.responsable, formObject.pilotoNombre, formObject.items,
        etapaDefault, "", fecha, "", "", formObject.bodega, formObject.licencia, ""
    ]);

    const lastRow = sheetAprob.getLastRow();

    // 3) Procesar items y Guardar Detalle
    let itemsForm = [];
    try {
        itemsForm = JSON.parse(formObject.items || '[]');
    } catch (e) {
        return { status: 'error', message: 'Formato de items inválido.' };
    }

    const shM = ensureMaestroSheet_();
    const masterData = shM ? shM.getDataRange().getValues() : [];
    const maestroMeta = buildMaestroHeaderMeta_(masterData[0] || MAESTRO_HEADERS);
    const mapUxC = {};
    const wantedCountry = resolveCatalogCountryCode_(formObject.countryCode);
    if (masterData.length > 1) {
        masterData.slice(1).forEach(r => {
            const item = mapMaestroRow_(r, 0, maestroMeta);
            if (!item.codigo) return;
            if (resolveCatalogCountryCode_(item.countryCode) !== wantedCountry) return;
            mapUxC[String(item.codigo)] = Number(item.uxc || 0);
        });
    }

    const itemsProcesados = itemsForm.map(item => {
        const uxcReal = mapUxC[String(item.codigo)] || 0;
        const calc = calcCajasUnidades_(uxcReal, item.cantidad);

        sheetDetalle.appendRow([
            idCobro,
            item.codigo,
            item.descripcion,
            item.cantidad,
            item.precio,
            item.subtotal,
            item.incidencia
        ]);

        return { ...item, uxc: uxcReal, cajas: calc.cajas, unidadesSueltas: calc.unidades };
    });

    const processFolderCtx = ensureProcessFolderForCobro_({
        processId: idCobro,
        createdAt: fecha,
        countryCode: formObject.countryCode,
        countryName: formObject.countryName,
        providerName: formObject.proveedorNombre,
        providerCode: formObject.proveedorCodigo
    });

    // 4) Generar PDF (ESTILO PRO)
    const pdfRes = generarPDFEstiloNuevo(idCobro, formObject, itemsProcesados, processFolderCtx.folder);

    // Guardar URL PDF en 'Aprobaciones'
    if (pdfRes && pdfRes.status === 'success' && pdfRes.url) {
        try {
            sheetAprob.getRange(lastRow, COL_PDF_URL).setValue(pdfRes.url);
        } catch (e) { }
    }

    try {
        const initFields = {};
        initFields[WF.areaResponsableActual] = areaResponsablePorEtapa_(1);
        initFields[WF.countryCode] = processFolderCtx.countryCode;
        initFields[WF.countryName] = processFolderCtx.countryName;
        initFields[WF.processFolderId] = processFolderCtx.folderId;
        initFields[WF.processFolderUrl] = processFolderCtx.folderUrl;
        initFields[WF.processFolderName] = processFolderCtx.folderName;
        const stageSlaInit = buildStageSlaEntryFields_(1, fecha);
        Object.keys(stageSlaInit).forEach(k => initFields[k] = stageSlaInit[k]);

        // Si la boleta ya sale firmada por piloto y vista, usamos el mismo PDF emitido
        // como evidencia de boleta firmada para auto-avanzar a etapa 3.
        if (boletaEmitidaConFirmas && pdfRes && pdfRes.status === 'success' && pdfRes.url) {
            initFields[WF.boletaFirmadaUrl] = pdfRes.url;
            initFields[WF.firmaBoletaUrl] = pdfRes.url; // compatibilidad legacy
        }

        writeRowFields_(sheetAprob, lastRow, schema.map, initFields);
    } catch (e) { }

    // Registro inicial:
    // - NO dispara correos en etapa 1 (solo bitÃ¡cora).
    // - Si ya viene firmada por piloto y vista: intenta auto-avance a etapa 3 (Inventario).
    try {
        const actor = String(formObject.userEmail || 'sistema');

        appendBitacora_({
            id: idCobro,
            usuario: actor,
            etapa: etapaDefault,
            accion: 'Registro inicial',
            resultado: 'OK',
            detalle: boletaEmitidaConFirmas
                ? 'Cobro creado con firmas (piloto/vista). Se intentara auto-avance a etapa 3.'
                : 'Cobro creado en etapa 1.'
        });

        try {
            sendRegistroBoletaMail_({
                id: idCobro,
                etapa: etapaDefault,
                proveedor: String(formObject.proveedorNombre || ''),
                proveedorCodigo: String(formObject.proveedorCodigo || ''),
                ruta: String(formObject.ruta || ''),
                monto: Number(formObject.totalCobro || 0),
                pdfUrl: (pdfRes && pdfRes.status === 'success') ? String(pdfRes.url || '') : '',
                actorEmail: actor
            });
        } catch (mailErr) {
            appendBitacora_({
                id: idCobro,
                usuario: actor,
                etapa: etapaDefault,
                accion: 'Boleta generada',
                resultado: 'Error',
                detalle: 'Error enviando notificacion inicial: ' + String(mailErr && mailErr.message ? mailErr.message : mailErr)
            });
        }

        if (boletaEmitidaConFirmas && pdfRes && pdfRes.status === 'success' && pdfRes.url) {
            const autoRes = applyAutoEtapaRules_(idCobro, actor, {
                actorCtx: { origen: 'registro_inicial', source: 'boleta_emitida_con_firmas' }
            });
            if (!autoRes || !autoRes.moved) {
                appendBitacora_({
                    id: idCobro,
                    usuario: actor,
                    etapa: etapaDefault,
                    accion: 'Auto-avance inicial',
                    resultado: 'Sin cambio',
                    detalle: (autoRes && autoRes.message) ? String(autoRes.message) : 'No se pudo auto-avanzar a etapa 3.'
                });
            }
        }
    } catch (e) { }

    return pdfRes;
}

// --- 6. HELPERS PDF ---

function escapeHtml_(v) {
    return String(v ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// --- 7. GENERADOR PDF (ESTILO PREIMPRESO PRO) ---

function generarPDFEstiloNuevo(id, datos, items, targetFolder) {
    const folder = targetFolder || getOrCreateProviderFolder_(
        datos.proveedorNombre,
        datos.proveedorCodigo,
        datos.countryCode,
        datos.countryName
    );

    let totalCajas = 0;
    let totalUnidadesSueltas = 0;
    let totalMonto = Number(datos.totalCobro || 0);
    let totalLineas = items.length;

    items.forEach(i => {
        totalCajas += Number(i.cajas || 0);
        totalUnidadesSueltas += Number(i.unidadesSueltas || 0);
    });

    const now = new Date();
    const fechaStr = now.toLocaleDateString('es-PE');
    const horaStr = now.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });

    const imgStyle = 'max-height:64px; max-width:220px; display:block; margin:0 auto;';
    const signPiloto = datos.firmaPiloto
        ? `<img src="${datos.firmaPiloto}" style="${imgStyle}">`
        : `<div class="sig-empty">Sin firma</div>`;
    const signVista = datos.firmaVista
        ? `<img src="${datos.firmaVista}" style="${imgStyle}">`
        : `<div class="sig-empty">Sin firma</div>`;

    const responsable = escapeHtml_(datos.responsable);
    const countryName = escapeHtml_((datos.countryName || resolveCountryMeta_(datos.countryCode).name || '').trim());
    const bodega = escapeHtml_(datos.bodega);
    const c9 = escapeHtml_(datos.c9);
    const licencia = escapeHtml_(datos.licencia);
    const proveedorNombre = escapeHtml_(datos.proveedorNombre);
    const proveedorCodigo = escapeHtml_(datos.proveedorCodigo);
    const pilotoNombre = escapeHtml_(datos.pilotoNombre);
    const unidad = escapeHtml_(datos.unidad);
    const ruta = escapeHtml_(datos.ruta);
    const observaciones = escapeHtml_(datos.observaciones || 'Sin observaciones.');
    const factura = escapeHtml_(datos.factura || '-');

    let rows = '';
    items.forEach(item => {
        const incidencia = String(item.incidencia || 'Conforme');
        let badgeClass = 'badge-ok';
        if (incidencia === 'Dañado' || incidencia === 'DaÃ±ado') badgeClass = 'badge-danger';
        if (incidencia === 'Faltante' || incidencia === 'Cruzado') badgeClass = 'badge-warn';

        const cod = escapeHtml_(item.codigo);
        const desc = escapeHtml_(item.descripcion);
        const cajas = Number(item.cajas || 0);
        const unds = Number(item.unidadesSueltas || 0);
        const precio = Number(item.precio || 0);
        const subtotal = Number(item.subtotal || (precio * Number(item.cantidad || 0)) || 0);

        rows += `
      <tr>
        <td class="mono">${cod}</td>
        <td class="desc">${desc}</td>
        <td class="text-center fw">${cajas}</td>
        <td class="text-center">${unds}</td>
        <td class="text-end">${precio.toFixed(2)}</td>
        <td class="text-end fw">${subtotal.toFixed(2)}</td>
        <td class="text-center"><span class="badge ${badgeClass}">${escapeHtml_(incidencia)}</span></td>
      </tr>`;
    });

    const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Cobro a Transporte</title>
  <style>
    @page { size: A4 landscape; margin: 10mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Inter, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
      color: #0b1220;
      background: #ffffff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .text-end { text-align: right; }
    .text-center { text-align: center; }
    .fw { font-weight: 800; }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; font-weight: 700; font-size: 11px; }
    .muted { color: #64748b; }
    .sheet { border: 1px solid #d7e0f2; border-radius: 14px; overflow: hidden; }
    .header { padding: 14px 16px; color: #fff; background: linear-gradient(135deg, #0b2a6b 0%, #0ea5e9 55%, #22c55e 120%); }
    .header-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
    .brand { display: flex; align-items: center; gap: 12px; }
    .logo { width: 46px; height: 46px; border-radius: 14px; background: rgba(255,255,255,.16); border: 1px solid rgba(255,255,255,.25); display: flex; align-items: center; justify-content: center; font-weight: 900; letter-spacing: .8px; }
    .brand-title { font-weight: 950; font-size: 18px; letter-spacing: .6px; text-transform: uppercase; }
    .brand-sub { font-size: 11px; opacity: .9; margin-top: 2px; }
    .docbox { text-align: right; }
    .doc-id { font-weight: 950; font-size: 18px; letter-spacing: .4px; }
    .doc-meta { font-size: 11px; opacity: .95; margin-top: 2px; }
    .pill { display: inline-block; margin-top: 8px; padding: 5px 10px; border-radius: 999px; background: rgba(255,255,255,.18); border: 1px solid rgba(255,255,255,.25); font-size: 10px; font-weight: 800; letter-spacing: .4px; text-transform: uppercase; }
    .content { padding: 14px 16px 16px 16px; }
    .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-top: 10px; }
    .field { background: #fbfdff; border: 1px solid #dbe4f3; border-radius: 12px; padding: 10px 12px; min-height: 52px; }
    .k { font-size: 9px; font-weight: 800; letter-spacing: .6px; text-transform: uppercase; color: #6b7a95; margin-bottom: 4px; }
    .v { font-size: 12px; font-weight: 800; color: #0b2a6b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; border: 1px solid #e4ebf8; border-radius: 12px; overflow: hidden; }
    thead th { background: linear-gradient(180deg, #eef4ff, #f6f9ff); color: #0b2a6b; font-size: 10px; font-weight: 950; letter-spacing: .6px; text-transform: uppercase; padding: 10px 10px; border-bottom: 2px solid #d7e0f2; }
    tbody td { padding: 9px 10px; font-size: 11px; border-bottom: 1px solid #edf2fb; color: #0f172a; vertical-align: top; }
    tbody tr:nth-child(even) td { background: #fafcff; }
    td.desc { max-width: 420px; }
    .badge { display: inline-block; padding: 4px 8px; border-radius: 999px; font-size: 10px; font-weight: 900; letter-spacing: .4px; text-transform: uppercase; border: 1px solid transparent; white-space: nowrap; }
    .badge-ok { background: #dcfce7; color: #166534; border-color: #bbf7d0; }
    .badge-warn { background: #fef9c3; color: #854d0e; border-color: #fde047; }
    .badge-danger { background: #fee2e2; color: #991b1b; border-color: #fecaca; }
    .summary { display: grid; grid-template-columns: 1.1fr 1fr 1fr 1fr; gap: 10px; margin-top: 12px; align-items: stretch; }
    .card { border: 1px solid #dbe4f3; background: #ffffff; border-radius: 12px; padding: 10px 12px; }
    .card .lbl { font-size: 9px; font-weight: 900; letter-spacing: .6px; text-transform: uppercase; color: #6b7a95; margin-bottom: 6px; }
    .card .val { font-size: 16px; font-weight: 950; color: #0b2a6b; line-height: 1.1; }
    .money { background: #fff7ed; border-color: #fed7aa; }
    .money .val { color: #9a3412; }
    .obs .txt { font-size: 11px; color: #334155; line-height: 1.25; word-break: break-word; }
    .signs { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 12px; }
    .sig { border: 1px dashed #c7d5ee; border-radius: 12px; padding: 10px 12px; background: #fbfdff; text-align: center; }
    .sig .box { height: 82px; display: flex; align-items: flex-end; justify-content: center; padding-bottom: 4px; }
    .sig .cap { margin-top: 6px; font-size: 10px; font-weight: 900; letter-spacing: .6px; text-transform: uppercase; color: #64748b; }
    .sig-empty { font-size: 10px; color: #94a3b8; font-weight: 800; text-transform: uppercase; letter-spacing: .5px; padding-bottom: 10px; }
    .footer { margin-top: 10px; padding-top: 8px; border-top: 1px solid #e6edf9; display: flex; justify-content: space-between; gap: 12px; font-size: 9px; color: #64748b; }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="header">
      <div class="header-row">
        <div class="brand">
          <div class="logo">PDC</div>
          <div>
            <div class="brand-title">Cobro a Transporte</div>
            <div class="brand-sub">Boleta interna â€” Preimpreso digital</div>
          </div>
        </div>
        <div class="docbox">
          <div class="doc-id">#${escapeHtml_(id)}</div>
          <div class="doc-meta">${fechaStr} Â· ${horaStr}</div>
          <div class="pill">Documento interno</div>
        </div>
      </div>
    </div>
    <div class="content">
      <div class="grid">
        <div class="field"><div class="k">Responsable</div><div class="v">${responsable}</div></div>
        <div class="field"><div class="k">Pais</div><div class="v">${countryName || '-'}</div></div>
        <div class="field"><div class="k">Bodega</div><div class="v">${bodega}</div></div>
        <div class="field"><div class="k">C9 / Centro</div><div class="v">${c9}</div></div>
        <div class="field"><div class="k">Licencia</div><div class="v">${licencia}</div></div>
        <div class="field">
          <div class="k">Proveedor</div>
          <div class="v">${proveedorNombre}</div>
          <div class="muted" style="font-size:10px;margin-top:2px;">Código: ${proveedorCodigo || '-'}</div>
        </div>
        <div class="field"><div class="k">Piloto</div><div class="v">${pilotoNombre}</div></div>
        <div class="field"><div class="k">Unidad / Placa</div><div class="v">${unidad}</div></div>
        <div class="field"><div class="k">Ruta Física</div><div class="v">${ruta}</div></div>
      </div>
      <table>
        <thead>
          <tr>
            <th style="width:10%;">Código</th>
            <th style="width:34%;">Descripción</th>
            <th style="width:9%;"  class="text-center">Cajas</th>
            <th style="width:9%;"  class="text-center">Unds</th>
            <th style="width:10%;" class="text-end">Precio</th>
            <th style="width:12%;" class="text-end">Subtotal</th>
            <th style="width:16%;" class="text-center">Incidencia</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
      <div class="summary">
        <div class="card obs">
          <div class="lbl">Observaciones / Referencia</div>
          <div class="txt"><strong>Obs:</strong> ${observaciones}</div>
          <div class="txt muted" style="margin-top:6px;"><strong>Factura Ref:</strong> ${factura}</div>
        </div>
        <div class="card">
          <div class="lbl">Total Cajas</div>
          <div class="val">${totalCajas}</div>
          <div class="muted" style="font-size:10px;margin-top:6px;">Líneas: ${totalLineas}</div>
        </div>
        <div class="card">
          <div class="lbl">Total Unidades</div>
          <div class="val">${totalUnidadesSueltas}</div>
          <div class="muted" style="font-size:10px;margin-top:6px;">Cálculo por UxC</div>
        </div>
        <div class="card money">
          <div class="lbl">Monto Total (S/)</div>
          <div class="val">${Number(totalMonto).toFixed(2)}</div>
          <div class="muted" style="font-size:10px;margin-top:6px;">Validación previa obligatoria</div>
        </div>
      </div>
      <div class="signs">
        <div class="sig">
          <div class="lbl">Firma / Conformidad</div>
          <div class="box">${signVista}</div>
          <div class="cap">Vista PDC</div>
        </div>
        <div class="sig">
          <div class="lbl">Firma / Conformidad</div>
          <div class="box">${signPiloto}</div>
          <div class="cap">Transportista</div>
        </div>
      </div>
      <div class="footer">
        <div>Generado automáticamente por el sistema de Cobros a Transporte - Grupo PDC.</div>
        <div>Documento interno · ${fechaStr} ${horaStr}</div>
      </div>
    </div>
  </div>
</body>
</html>`;

    const pdfBlob = HtmlService.createHtmlOutput(html)
        .getBlob()
        .setName(`Cobro_${id}.pdf`)
        .getAs(MimeType.PDF);

    const pdfFile = folder.createFile(pdfBlob);
    applyDriveSharePolicy_(pdfFile);

    return { url: pdfFile.getUrl(), status: 'success', id: id };
}

/**
 * ============================================================================
 * âœ… ENDPOINTS PARA EL PANEL (MÃ“DULOS)
 * ============================================================================
 */

function getPdfRootMeta_() {
    const rootId = ensurePdfRoot_();
    const folder = DriveApp.getFolderById(rootId);
    return {
        id: rootId,
        name: folder.getName(),
        url: folder.getUrl()
    };
}

function getPdfRootMeta() {
    return getPdfRootMeta_();
}

function getPdfRootUrl() {
    return getPdfRootMeta_().url;
}

function buildModuleErrorMessage_(moduleLabel, err) {
    const raw = String(err && err.message ? err.message : (err || '')).replace(/\s+/g, ' ').trim();
    const prefix = moduleLabel ? ('No se pudo cargar ' + moduleLabel + '. ') : '';
    if (!raw) return prefix + 'Error inesperado.';

    if (/SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SECRET_KEY/i.test(raw)) {
        return prefix + 'Faltan las credenciales de Supabase en las propiedades del script.';
    }
    if (/UrlFetchApp|external_request|Authorization is required|permiso para llamar a UrlFetchApp/i.test(raw)) {
        return prefix + 'Falta autorizar el acceso a Supabase. Vuelve a desplegar y autorizar el proyecto.';
    }
    if (/PGRST205|Could not find the table|schema cache/i.test(raw)) {
        return prefix + 'La base de datos no tiene el esquema actualizado. Ejecuta el SQL de `sql_supabase/20260409_cobro_transporte_schema.sql`.';
    }
    if (/timed out|timeout|429|ECONNRESET|Failed to fetch|network/i.test(raw)) {
        return prefix + 'La conexión con Supabase falló o tardó demasiado. Intenta nuevamente.';
    }
    if (/No enum constant|Cannot read properties|Unexpected token/i.test(raw)) {
        return prefix + 'Hay datos inválidos o configuración incompleta en el backend.';
    }
    return prefix + (raw.length > 260 ? raw.slice(0, 257) + '...' : raw);
}

function logModuleError_(moduleLabel, err) {
    const msg = buildModuleErrorMessage_(moduleLabel, err);
    const raw = err && err.stack ? err.stack : String(err && err.message ? err.message : err || '');
    try { Logger.log('[' + moduleLabel + '] ' + raw); } catch (e) { }
    return msg;
}

function buildEmptyDashboardStats_() {
    return {
        boletasHoy: 0,
        registros: 0,
        unidades: 0,
        proveedores: 0,
        montoHoy: 0,
        error: true,
        message: '',
        dashboard: {
            boletasHoy: 0,
            registros: 0,
            montoHoy: 0,
            unidadesTotales: 0,
            unidadesHoy: 0,
            proveedores: 0,
            proveedoresConCobro: 0,
            usuariosTotal: 0,
            usuariosActivos: 0,
            slaVencidos: 0,
            avancePromedio: 0,
            avanceCierre: 0,
            tiempoCierrePromedioHoras: 0,
            productoMayorValor: { codigo: '-', descripcion: 'Sin datos', cantidad: 0, monto: 0 },
            proveedorTopSemana: {
                proveedor: 'Sin datos',
                monto: 0,
                boletaMaxProveedor: '',
                boletaMaxMonto: 0,
                boletaMaxId: '',
                boletaMaxFecha: ''
            },
            usuarioActividadTop: { usuario: 'Sin datos', area: '-', acciones: 0, acciones7d: 0, ultimoMovimiento: '' },
            usuarioSlaTop: { usuario: 'Sin datos', area: '-', casos: 0, monto: 0 },
            resumenEstados: [],
            avanceEtapas: [],
            ultimos7Dias: [],
            comparativoUnidadesMonto: [],
            montosPorProveedor: [],
            motivosRechazo: [],
            incidenciasDetalle: [],
            topCobrosTimeline: [],
            tiemposProceso: [],
            slaVencidosDetalle: [],
            usuariosActividad: []
        }
    };
}

function buildEmptyGestionResult_() {
    return {
        rows: [],
        summary: {
            total: 0,
            observados: 0,
            slaVencidos: 0,
            pendientesArea: 0
        },
        error: true,
        message: ''
    };
}

function buildDashboardStats_(actorEmail) {
    const ss = getDataStore_();
    const shA = ss.getSheetByName('Aprobaciones');
    const shP = ss.getSheetByName('Proveedores') || findSheetByNormalizedName_(ss, ['Proveedores', 'Proveedor']);
    const shU = ss.getSheetByName('Usuarios');
    const shD = ss.getSheetByName('Detalle_Cobros');
    const shB = ss.getSheetByName(SHEET_BITACORA);
    const profile = getUserProfile_(actorEmail);
    if (!profile.email) return buildEmptyDashboardStats_();

    const tz = Session.getScriptTimeZone();
    const now = new Date();
    const todayStr = Utilities.formatDate(now, tz, 'yyyy-MM-dd');
    const start7d = new Date(now.getTime() - (6 * 24 * 60 * 60 * 1000));
    start7d.setHours(0, 0, 0, 0);

    let boletasHoy = 0;
    let registros = 0;
    let montoHoy = 0;
    let totalProgreso = 0;
    let slaVencidos = 0;
    const unidadesMap = {};
    const unidadesHoyMap = {};
    const montoPorProveedor = {};
    const montoPorProveedor7d = {};
    const motivosRechazoMap = {};
    const slaUsuarioAreaMap = {};
    const estadoMap = { 'Abierto': 0, 'En firma': 0, 'En proceso': 0, 'Observado': 0, 'Cerrado': 0 };
    const etapaMap = {};
    const timelineTop = [];
    const reachedById = {};
    const cobroMetaById = {};
    const visibleCobroIds = {};
    const dailyMap = {};
    const dailyUnitsMap = {};
    const dailyOrder = [];

    ETAPAS_COBRO.forEach(e => etapaMap[e] = 0);
    for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getTime() - (i * 24 * 60 * 60 * 1000));
        const key = Utilities.formatDate(d, tz, 'yyyy-MM-dd');
        dailyMap[key] = {
            fecha: key,
            dia: Utilities.formatDate(d, tz, 'EEE'),
            registros: 0,
            monto: 0
        };
        dailyUnitsMap[key] = {};
        dailyOrder.push(key);
    }

    const userMetaByEmail = {};
    const userAreaByName = {};
    let usuariosTotal = 0;
    let usuariosActivos = 0;
    if (shU && shU.getLastRow() > 1) {
        const users = shU.getDataRange().getValues();
        usuariosTotal = Math.max(users.length - 1, 0);
        const uHeaders = users[0] || [];
        const uMap = buildHeaderMap_(uHeaders);
        const idxArea = headerIdx_(uMap, ['Area', 'Departamento', 'AreaResponsable', 'AreaUsuario']);

        for (let i = 1; i < users.length; i++) {
            const row = users[i];
            const email = String(row[0] || '').trim().toLowerCase();
            const nombre = String(row[1] || '').trim();
            const rol = normalizeRole_(row[2] || '');
            const activo = (row[4] === true) || String(row[4]).toLowerCase() === 'true';
            if (activo) usuariosActivos++;
            const areaSheet = idxArea >= 0 ? String(row[idxArea] || '').trim() : '';
            const area = areaSheet || inferAreaFromRole_(rol) || 'Sin area';
            if (email) {
                userMetaByEmail[email] = {
                    nombre: nombre || email,
                    area: area,
                    activo: activo
                };
            }
            if (nombre) userAreaByName[normalizeKey_(nombre)] = area;
        }
    }

    let proveedorTopTicket7d = {
        proveedor: 'Sin datos',
        monto: 0,
        id: '',
        fecha: ''
    };

    if (shA && shA.getLastRow() > 1) {
        const schema = ensureAprobacionesSchema_(shA);
        const lastCol = shA.getLastColumn();
        const headers = shA.getRange(1, 1, 1, lastCol).getValues()[0];
        const map = schema.map || buildHeaderMap_(headers);
        const rows = shA.getRange(2, 1, shA.getLastRow() - 1, lastCol).getValues();

        for (let i = 0; i < rows.length; i++) {
            const r = rows[i];
            if (!actorCanAccessAprobacionRow_(profile, r, map)) continue;
            const id = String(r[0] || '').trim();
            const fechaCre = toDateDash_(r[1]);
            const fechaKey = fechaCre ? Utilities.formatDate(fechaCre, tz, 'yyyy-MM-dd') : '';
            const monto = Number(r[12] || 0);
            const proveedor = String(r[2] || 'Sin proveedor').trim() || 'Sin proveedor';
            const unidad = String(r[4] || '').trim();
            const etapa = normalizeEtapa_(r[COL_ETAPA - 1]);
            const etapaIdx = etapaIndex_(etapa);
            const estadoBase = normalizeEstado_(r[COL_ESTADO - 1]);
            const estado = estadoBase || macroEstadoPorEtapaIdx_(etapaIdx);
            const responsable = String(r[14] || '').trim() || 'Sin responsable';
            const areaActual = rowText_(r, map, [WF.areaResponsableActual]) || areaResponsablePorEtapa_(etapaIdx);
            const ultAct = toDateDash_(r[COL_ULT_ACT - 1]) || fechaCre;

            registros++;
            totalProgreso += progresoEtapa_(etapa);

            if (unidad) unidadesMap[unidad] = true;
            if (fechaKey === todayStr) {
                boletasHoy++;
                montoHoy += monto;
                if (unidad) unidadesHoyMap[unidad] = true;
            }

            if (fechaKey && dailyMap[fechaKey]) {
                dailyMap[fechaKey].registros++;
                dailyMap[fechaKey].monto += monto;
                if (unidad) dailyUnitsMap[fechaKey][unidad] = true;
            }

            montoPorProveedor[proveedor] = Number(montoPorProveedor[proveedor] || 0) + monto;
            if (fechaCre && fechaCre.getTime() >= start7d.getTime()) {
                montoPorProveedor7d[proveedor] = Number(montoPorProveedor7d[proveedor] || 0) + monto;
                if (monto >= proveedorTopTicket7d.monto) {
                    proveedorTopTicket7d = {
                        proveedor: proveedor,
                        monto: monto,
                        id: id,
                        fecha: fechaCre ? Utilities.formatDate(fechaCre, tz, 'yyyy-MM-dd') : ''
                    };
                }
            }

            if (estadoMap[estado] == null) estadoMap[estado] = 0;
            estadoMap[estado]++;
            if (etapaMap[etapa] == null) etapaMap[etapa] = 0;
            etapaMap[etapa]++;

            const sla = slaStatusText_(r, map, etapaIdx);
            if (sla === 'Vencido') {
                slaVencidos++;
                const slaKey = responsable + '||' + areaActual;
                if (!slaUsuarioAreaMap[slaKey]) {
                    slaUsuarioAreaMap[slaKey] = {
                        usuario: responsable,
                        area: areaActual,
                        casos: 0,
                        monto: 0
                    };
                }
                slaUsuarioAreaMap[slaKey].casos++;
                slaUsuarioAreaMap[slaKey].monto += monto;
            }

            let motivo = normalizeMotivoDash_(rowText_(r, map, [WF.motivoObservacion]));
            if (!motivo && estado === 'Observado') motivo = 'Sin detalle';
            if (motivo) {
                motivosRechazoMap[motivo] = Number(motivosRechazoMap[motivo] || 0) + 1;
            }

            timelineTop.push({
                id: id || '-',
                fecha: fechaCre ? Utilities.formatDate(fechaCre, tz, 'yyyy-MM-dd HH:mm') : '',
                proveedor: proveedor,
                monto: round2Dash_(monto),
                estado: estado,
                etapa: etapa,
                ts: fechaCre ? fechaCre.getTime() : 0
            });

            if (id) {
                visibleCobroIds[id] = true;
                if (!reachedById[id]) reachedById[id] = {};
                if (fechaCre) {
                    const oldStart = reachedById[id][1];
                    if (!oldStart || fechaCre.getTime() < oldStart.getTime()) reachedById[id][1] = fechaCre;
                }
                if (etapaIdx > 0 && ultAct) {
                    const oldStep = reachedById[id][etapaIdx];
                    if (!oldStep || ultAct.getTime() < oldStep.getTime()) reachedById[id][etapaIdx] = ultAct;
                }
                cobroMetaById[id] = {
                    fechaCre: fechaCre,
                    etapaIdx: etapaIdx,
                    ultAct: ultAct
                };
            }
        }
    }

    const productoMap = {};
    const incidenciaMap = {};
    if (shD && shD.getLastRow() > 1) {
        const dLastCol = Math.max(7, shD.getLastColumn());
        const dRows = shD.getRange(2, 1, shD.getLastRow() - 1, dLastCol).getValues();
        for (let i = 0; i < dRows.length; i++) {
            const dr = dRows[i];
            const detailCobroId = String(dr[0] || '').trim();
            if (actorCountryFilterEnabled_(profile) && (!detailCobroId || !visibleCobroIds[detailCobroId])) continue;
            const codigo = String(dr[1] || '').trim();
            const descripcion = String(dr[2] || '').trim() || 'Producto sin nombre';
            const cantidad = Number(dr[3] || 0);
            const precio = Number(dr[4] || 0);
            const subtotal = Number(dr[5] || (cantidad * precio) || 0);
            const incidencia = String(dr[6] || 'Conforme').trim() || 'Conforme';
            const pKey = (codigo || '-') + '||' + descripcion;

            if (!productoMap[pKey]) {
                productoMap[pKey] = {
                    codigo: codigo || '-',
                    descripcion: descripcion,
                    cantidad: 0,
                    monto: 0
                };
            }
            productoMap[pKey].cantidad += cantidad;
            productoMap[pKey].monto += subtotal;

            if (normalizeKey_(incidencia) !== 'conforme') {
                incidenciaMap[incidencia] = Number(incidenciaMap[incidencia] || 0) + 1;
            }
        }
    }

    const actividadUsuariosMap = {};
    if (shB && shB.getLastRow() > 1) {
        const bRows = shB.getDataRange().getValues();
        for (let i = 1; i < bRows.length; i++) {
            const br = bRows[i];
            const fechaEvt = toDateDash_(br[0]);
            const idEvt = String(br[1] || '').trim();
            if (actorCountryFilterEnabled_(profile) && (!idEvt || !visibleCobroIds[idEvt])) continue;
            const usuarioRaw = String(br[2] || '').trim() || 'sistema';
            const etapaEvt = String(br[3] || '').trim();
            const userKey = usuarioRaw.toLowerCase();

            if (!actividadUsuariosMap[userKey]) {
                const userMeta = resolveDashboardUserMeta_(usuarioRaw, userMetaByEmail, userAreaByName);
                actividadUsuariosMap[userKey] = {
                    usuario: userMeta.nombre || usuarioRaw,
                    area: userMeta.area || 'Sin area',
                    acciones: 0,
                    acciones7d: 0,
                    lastTs: 0
                };
            }

            actividadUsuariosMap[userKey].acciones++;
            if (fechaEvt && fechaEvt.getTime() >= start7d.getTime()) {
                actividadUsuariosMap[userKey].acciones7d++;
            }
            if (fechaEvt && fechaEvt.getTime() > actividadUsuariosMap[userKey].lastTs) {
                actividadUsuariosMap[userKey].lastTs = fechaEvt.getTime();
            }

            if (idEvt && fechaEvt) {
                if (!reachedById[idEvt]) reachedById[idEvt] = {};
                const idxEvt = etapaEvt ? etapaIndex_(etapaEvt) : 0;
                if (idxEvt > 0) {
                    const oldEvt = reachedById[idEvt][idxEvt];
                    if (!oldEvt || fechaEvt.getTime() < oldEvt.getTime()) reachedById[idEvt][idxEvt] = fechaEvt;
                }
            }
        }
    }

    const tiemposAgg = {};
    Object.keys(reachedById).forEach(id => {
        const stageTimes = reachedById[id] || {};
        for (let idx = 1; idx < ETAPAS_COBRO.length; idx++) {
            const start = stageTimes[idx];
            const end = stageTimes[idx + 1];
            if (!start || !end) continue;
            const hours = (end.getTime() - start.getTime()) / (60 * 60 * 1000);
            if (!(hours >= 0) || hours > (24 * 180)) continue;
            const key = idx + '>' + (idx + 1);
            if (!tiemposAgg[key]) {
                tiemposAgg[key] = {
                    from: ETAPAS_COBRO[idx - 1],
                    to: ETAPAS_COBRO[idx],
                    total: 0,
                    count: 0
                };
            }
            tiemposAgg[key].total += hours;
            tiemposAgg[key].count++;
        }
    });

    let cierreHoursTotal = 0;
    let cierreCount = 0;
    Object.keys(cobroMetaById).forEach(id => {
        const meta = cobroMetaById[id];
        if (!meta || !meta.fechaCre) return;
        if (meta.etapaIdx < ETAPAS_COBRO.length) return;
        const end = (reachedById[id] && reachedById[id][ETAPAS_COBRO.length]) || meta.ultAct;
        if (!end) return;
        const h = (end.getTime() - meta.fechaCre.getTime()) / (60 * 60 * 1000);
        if (!(h >= 0) || h > (24 * 365)) return;
        cierreHoursTotal += h;
        cierreCount++;
    });

    const totalProveedores = shP ? Math.max(shP.getLastRow() - 1, 0) : 0;
    const totalUnidades = Object.keys(unidadesMap).length;
    const totalUnidadesHoy = Object.keys(unidadesHoyMap).length;

    const montosPorProveedor = Object.keys(montoPorProveedor).map(k => ({
        proveedor: k,
        monto: round2Dash_(montoPorProveedor[k])
    })).sort((a, b) => b.monto - a.monto).slice(0, 10);

    const proveedorTopSemana = Object.keys(montoPorProveedor7d).map(k => ({
        proveedor: k,
        monto: round2Dash_(montoPorProveedor7d[k])
    })).sort((a, b) => b.monto - a.monto)[0] || { proveedor: 'Sin datos', monto: 0 };

    const productosOrdenados = Object.keys(productoMap).map(k => ({
        codigo: productoMap[k].codigo,
        descripcion: productoMap[k].descripcion,
        cantidad: round2Dash_(productoMap[k].cantidad),
        monto: round2Dash_(productoMap[k].monto)
    })).sort((a, b) => b.monto - a.monto);
    const productoMayorValor = productosOrdenados[0] || {
        codigo: '-',
        descripcion: 'Sin datos',
        cantidad: 0,
        monto: 0
    };

    const motivosRechazo = Object.keys(motivosRechazoMap).map(k => ({
        motivo: k,
        casos: Number(motivosRechazoMap[k] || 0)
    })).sort((a, b) => b.casos - a.casos).slice(0, 8);

    const incidenciasDetalle = Object.keys(incidenciaMap).map(k => ({
        motivo: k,
        casos: Number(incidenciaMap[k] || 0)
    })).sort((a, b) => b.casos - a.casos).slice(0, 8);

    const slaVencidosDetalle = Object.keys(slaUsuarioAreaMap).map(k => ({
        usuario: slaUsuarioAreaMap[k].usuario,
        area: slaUsuarioAreaMap[k].area,
        casos: Number(slaUsuarioAreaMap[k].casos || 0),
        monto: round2Dash_(slaUsuarioAreaMap[k].monto || 0)
    })).sort((a, b) => {
        if (b.casos !== a.casos) return b.casos - a.casos;
        return b.monto - a.monto;
    }).slice(0, 10);

    const usuariosActividad = Object.keys(actividadUsuariosMap).map(k => {
        const u = actividadUsuariosMap[k];
        return {
            usuario: u.usuario,
            area: u.area,
            acciones: Number(u.acciones || 0),
            acciones7d: Number(u.acciones7d || 0),
            ultimoMovimiento: u.lastTs ? Utilities.formatDate(new Date(u.lastTs), tz, 'yyyy-MM-dd HH:mm:ss') : ''
        };
    }).sort((a, b) => {
        if (b.acciones7d !== a.acciones7d) return b.acciones7d - a.acciones7d;
        return b.acciones - a.acciones;
    }).slice(0, 12);

    const usuariosActividadNoSistema = usuariosActividad.filter(u => normalizeKey_(u.usuario) !== 'sistema');
    const usuarioActividadTop = usuariosActividadNoSistema[0] || usuariosActividad[0] || {
        usuario: 'Sin datos',
        area: 'Sin area',
        acciones: 0,
        acciones7d: 0,
        ultimoMovimiento: ''
    };

    const topSlaUsuario = slaVencidosDetalle[0] || {
        usuario: 'Sin datos',
        area: 'Sin area',
        casos: 0,
        monto: 0
    };

    const timelineCobrosAltos = timelineTop.sort((a, b) => {
        if (b.monto !== a.monto) return b.monto - a.monto;
        return b.ts - a.ts;
    }).slice(0, 10).map(x => ({
        id: x.id,
        fecha: x.fecha,
        proveedor: x.proveedor,
        monto: x.monto,
        estado: x.estado,
        etapa: x.etapa
    }));

    const tiemposProceso = Object.keys(tiemposAgg).map(k => {
        const t = tiemposAgg[k];
        return {
            proceso: shortEtapaName_(t.from) + ' -> ' + shortEtapaName_(t.to),
            horasPromedio: round2Dash_(t.total / Math.max(1, t.count)),
            muestras: t.count
        };
    }).sort((a, b) => b.horasPromedio - a.horasPromedio).slice(0, 10);

    const resumenEstados = ['Abierto', 'En firma', 'En proceso', 'Observado', 'Cerrado'].map(estado => ({
        estado: estado,
        cantidad: Number(estadoMap[estado] || 0),
        porcentaje: registros ? round2Dash_((Number(estadoMap[estado] || 0) * 100) / registros) : 0
    }));

    const avanceEtapas = ETAPAS_COBRO.map(et => ({
        etapa: et,
        cantidad: Number(etapaMap[et] || 0),
        porcentaje: registros ? round2Dash_((Number(etapaMap[et] || 0) * 100) / registros) : 0
    }));

    const ultimos7Dias = dailyOrder.map(key => ({
        fecha: dailyMap[key].fecha,
        dia: dailyMap[key].dia,
        registros: dailyMap[key].registros,
        monto: round2Dash_(dailyMap[key].monto),
        unidades: Object.keys(dailyUnitsMap[key] || {}).length
    }));

    const motivosConFallback = motivosRechazo.length ? motivosRechazo : incidenciasDetalle;
    const avancePromedio = registros ? round2Dash_(totalProgreso / registros) : 0;
    const cerrados = Number(estadoMap['Cerrado'] || 0);
    const avanceCierre = registros ? round2Dash_((cerrados * 100) / registros) : 0;

    return {
        boletasHoy: boletasHoy,
        registros: registros,
        unidades: totalUnidades,
        proveedores: totalProveedores,
        montoHoy: round2Dash_(montoHoy),
        dashboard: {
            boletasHoy: boletasHoy,
            registros: registros,
            montoHoy: round2Dash_(montoHoy),
            unidadesTotales: totalUnidades,
            unidadesHoy: totalUnidadesHoy,
            proveedores: totalProveedores,
            proveedoresConCobro: Object.keys(montoPorProveedor).length,
            usuariosTotal: usuariosTotal,
            usuariosActivos: usuariosActivos,
            slaVencidos: slaVencidos,
            avancePromedio: avancePromedio,
            avanceCierre: avanceCierre,
            tiempoCierrePromedioHoras: cierreCount ? round2Dash_(cierreHoursTotal / cierreCount) : 0,
            productoMayorValor: productoMayorValor,
            proveedorTopSemana: {
                proveedor: proveedorTopSemana.proveedor,
                monto: round2Dash_(proveedorTopSemana.monto),
                boletaMaxProveedor: proveedorTopTicket7d.proveedor,
                boletaMaxMonto: round2Dash_(proveedorTopTicket7d.monto),
                boletaMaxId: proveedorTopTicket7d.id,
                boletaMaxFecha: proveedorTopTicket7d.fecha
            },
            usuarioActividadTop: usuarioActividadTop,
            usuarioSlaTop: topSlaUsuario,
            resumenEstados: resumenEstados,
            avanceEtapas: avanceEtapas,
            ultimos7Dias: ultimos7Dias,
            comparativoUnidadesMonto: ultimos7Dias.map(d => ({
                fecha: d.fecha,
                dia: d.dia,
                unidades: d.unidades,
                monto: d.monto
            })),
            montosPorProveedor: montosPorProveedor,
            motivosRechazo: motivosConFallback,
            incidenciasDetalle: incidenciasDetalle,
            topCobrosTimeline: timelineCobrosAltos,
            tiemposProceso: tiemposProceso,
            slaVencidosDetalle: slaVencidosDetalle,
            usuariosActividad: usuariosActividad
        }
    };
}

function getDashboardStats(actorEmail) {
    try {
        const emailKey = String(actorEmail || '').trim().toLowerCase() || 'anon';
        const cacheKey = 'dash:' + emailKey;
        const cached = cacheGetJson_(cacheKey);
        if (cached) return cached;
        const result = buildDashboardStats_(actorEmail);
        cachePutJson_(cacheKey, result, 60);
        return result;
    } catch (err) {
        const fallback = buildEmptyDashboardStats_();
        fallback.message = logModuleError_('las métricas del dashboard', err);
        return fallback;
    }
}

function toDateDash_(value) {
    if (!value) return null;
    if (Object.prototype.toString.call(value) === '[object Date]') {
        return isNaN(value.getTime()) ? null : new Date(value.getTime());
    }
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
}

function round2Dash_(value) {
    const n = Number(value || 0);
    if (isNaN(n)) return 0;
    return Math.round(n * 100) / 100;
}

function cacheGetJson_(key) {
    try {
        const cache = CacheService.getScriptCache();
        const raw = cache.get(key);
        if (!raw) return null;
        return JSON.parse(raw);
    } catch (e) {
        return null;
    }
}

function cachePutJson_(key, payload, ttlSeconds) {
    try {
        const cache = CacheService.getScriptCache();
        const raw = JSON.stringify(payload || {});
        // CacheService limita ~100KB por entrada
        if (raw.length > 95000) return false;
        cache.put(key, raw, Math.max(10, Number(ttlSeconds || 60)));
        return true;
    } catch (e) {
        return false;
    }
}

function cacheDelete_(key) {
    try {
        const cache = CacheService.getScriptCache();
        cache.remove(String(key));
        return true;
    } catch (e) {
        return false;
    }
}

function clearCatalogCaches_() {
    clearUserCaches_();
    clearProviderCaches_();
    clearPilotCaches_();
    clearMaestroCaches_();
}

function clearUserCaches_() {
    cacheDelete_('users:all');
    cacheDelete_('responsables:all');
}

function clearProviderCaches_() {
    cacheDelete_('providers:all');
}

function clearPilotCaches_() {
    cacheDelete_('pilots:all');
}

function clearMaestroCaches_() {
    cacheDelete_('maestro:all');
}

function normalizeMotivoDash_(raw) {
    let txt = String(raw || '').trim();
    if (!txt) return '';
    txt = txt.split(/\r?\n/)[0].trim();
    txt = txt.replace(/\s+/g, ' ');
    if (txt.length > 90) txt = txt.slice(0, 87) + '...';
    return txt;
}

function shortEtapaName_(etapa) {
    const txt = String(etapa || '').trim();
    if (!txt) return '';
    const m = txt.match(/^\d+\.\s*(.+)$/);
    return (m && m[1]) ? m[1] : txt;
}

function resolveDashboardUserMeta_(usuarioRaw, byEmail, byName) {
    const raw = String(usuarioRaw || '').trim();
    const keyEmail = raw.toLowerCase();
    if (byEmail && byEmail[keyEmail]) {
        return {
            nombre: byEmail[keyEmail].nombre || raw,
            area: byEmail[keyEmail].area || 'Sin area'
        };
    }

    const keyName = normalizeKey_(raw);
    if (byName && byName[keyName]) {
        return { nombre: raw, area: byName[keyName] || 'Sin area' };
    }

    return { nombre: raw || 'sistema', area: 'Sin area' };
}

function getHistorialCobros(limit, actorEmail) {
    const ss = getDataStore_();
    const shA = ss.getSheetByName('Aprobaciones');
    if (!shA || shA.getLastRow() < 2) return [];

    const lim = Math.max(1, Number(limit || 60));
    const emailKey = String(actorEmail || '').trim().toLowerCase() || 'anon';
    const cacheKey = 'hist:' + emailKey + ':' + lim;
    const cached = cacheGetJson_(cacheKey);
    if (cached) return cached;

    const lastRow = shA.getLastRow();
    const lastCol = shA.getLastColumn();
    const profile = getUserProfile_(actorEmail);
    if (!profile.email) return [];
    const schema = ensureAprobacionesSchema_(shA);
    const headers = shA.getRange(1, 1, 1, lastCol).getValues()[0] || [];
    const map = schema.map || buildHeaderMap_(headers);
    const tz = Session.getScriptTimeZone();
    const out = [];

    // Columnas: 0 id, 1 fecha, 2 provNombre, 3 provCod, 4 unidad, 5 ruta, 7 c9, 8 factura, 12 total, 13 estado, 23 licencia, 25 pdfUrl
    const chunkSize = Math.max(120, Math.min(400, lim * 4));
    let endRow = lastRow;
    while (endRow > 1 && out.length < lim) {
        const startRow = Math.max(2, endRow - chunkSize + 1);
        const data = shA.getRange(startRow, 1, endRow - startRow + 1, lastCol).getValues();
        for (let i = data.length - 1; i >= 0 && out.length < lim; i--) {
            const r = data[i];
            if (!actorCanAccessAprobacionRow_(profile, r, map)) continue;
            const fecha = r[1] ? Utilities.formatDate(new Date(r[1]), tz, 'yyyy-MM-dd HH:mm') : '';
            out.push({
                id: r[0] || '',
                fecha,
                proveedor: r[2] || '',
                proveedorCodigo: r[3] || '',
                unidad: r[4] || '',
                ruta: r[5] || '',
                c9: r[7] || '',
                factura: r[8] || '',
                total: Number(r[12] || 0),
                estado: normalizeEstado_(r[COL_ESTADO - 1]),
                licencia: r[23] || '',
                pdfUrl: r[COL_PDF_URL - 1] || ''
            });
        }
        endRow = startRow - 1;
    }
    cachePutJson_(cacheKey, out, 60);
    return out;
}

/**
 * ============================================================================
 * âœ… MÃ“DULO: REPORTES AVANZADOS
 * ============================================================================
 */

function getReportData(inicioStr, finStr, actorEmail) {
    const iniRaw = String(inicioStr || '').trim();
    const finRaw = String(finStr || '').trim();
    if (!iniRaw || !finRaw) return { error: 'Debe enviar fecha de inicio y fecha fin.' };

    const fInicio = new Date(iniRaw + 'T00:00:00');
    const fFin = new Date(finRaw + 'T23:59:59');
    if (isNaN(fInicio.getTime()) || isNaN(fFin.getTime())) {
        return { error: 'Formato de fecha inválido. Use YYYY-MM-DD.' };
    }
    if (fFin.getTime() < fInicio.getTime()) {
        return { error: 'La fecha fin no puede ser menor que la fecha inicio.' };
    }

    const ss = getDataStore_();
    const sh = ss.getSheetByName('Aprobaciones');
    if (!sh || sh.getLastRow() < 2) return [];
    const profile = getUserProfile_(actorEmail);
    if (!profile.email) return { error: 'Usuario no autorizado.' };

    const cacheKey = `report-basic:${String(profile.email || '').toLowerCase()}:${iniRaw}:${finRaw}`;
    const cached = cacheGetJson_(cacheKey);
    if (cached) return cached;

    const schema = ensureAprobacionesSchema_(sh);
    const lastCol = sh.getLastColumn();
    const map = schema.map || buildHeaderMap_(sh.getRange(1, 1, 1, lastCol).getValues()[0] || []);

    const out = [];
    const lastRow = sh.getLastRow();
    const chunkSize = 450;
    for (let startRow = 2; startRow <= lastRow; startRow += chunkSize) {
        const numRows = Math.min(chunkSize, lastRow - startRow + 1);
        const block = sh.getRange(startRow, 1, numRows, lastCol).getValues();
        for (let i = 0; i < block.length; i++) {
            const r = block[i];
            const fechaRow = new Date(r[1]);
            if (fechaRow < fInicio || fechaRow > fFin) continue;
            if (!actorCanAccessAprobacionRow_(profile, r, map)) continue;
            out.push({
                id: r[0],
                fecha: Utilities.formatDate(new Date(r[1]), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm'),
                proveedor: r[2],
                unidad: r[4],
                ruta: r[5],
                factura: r[8],
                total: r[12],
                estado: normalizeEstado_(r[COL_ESTADO - 1]),
                responsable: r[14],
                piloto: r[15],
                licencia: r[23]
            });
        }
    }

    cachePutJson_(cacheKey, out, 60);
    return out;
}

function computeSlaOverdueMetrics_(limit, refDate) {
    const due = limit ? new Date(limit) : null;
    const ref = refDate ? new Date(refDate) : new Date();
    if (!due || isNaN(due.getTime()) || isNaN(ref.getTime())) {
        return {
            isOverdue: false,
            overdueHours: 0,
            overdueDays: 0,
            remainingHours: 0
        };
    }

    const diffMs = ref.getTime() - due.getTime();
    const overdueHours = diffMs > 0 ? round2Dash_(diffMs / (60 * 60 * 1000)) : 0;
    const overdueDays = overdueHours > 0 ? round2Dash_(overdueHours / 24) : 0;
    const remainingHours = diffMs < 0 ? round2Dash_(Math.abs(diffMs) / (60 * 60 * 1000)) : 0;
    return {
        isOverdue: diffMs > 0,
        overdueHours: overdueHours,
        overdueDays: overdueDays,
        remainingHours: remainingHours
    };
}

function slaOverdueBucketLabel_(overdueHours) {
    const hours = Number(overdueHours || 0);
    if (hours <= 24) return '0-24h';
    if (hours <= 48) return '24-48h';
    if (hours <= 120) return '2-5d';
    return '>5d';
}

function stripReportRowMeta_(row) {
    const out = Object.assign({}, row || {});
    delete out.fechaTs;
    delete out.ultActTs;
    return out;
}

function buildSlaOverdueSnapshot_(inicioStr, finStr, actorEmail) {
    const iniRaw = String(inicioStr || '').trim();
    const finRaw = String(finStr || '').trim();
    let fInicio = null;
    let fFin = null;

    if (iniRaw) {
        fInicio = new Date(iniRaw + 'T00:00:00');
        if (isNaN(fInicio.getTime())) return { error: 'Formato de fecha inicio invalido. Use YYYY-MM-DD.' };
    }
    if (finRaw) {
        fFin = new Date(finRaw + 'T23:59:59');
        if (isNaN(fFin.getTime())) return { error: 'Formato de fecha fin invalido. Use YYYY-MM-DD.' };
    }
    if (fInicio && fFin && fFin.getTime() < fInicio.getTime()) {
        return { error: 'La fecha fin no puede ser menor que la fecha inicio.' };
    }

    const ss = getDataStore_();
    const sh = ss.getSheetByName('Aprobaciones');
    const empty = {
        success: true,
        rows: [],
        overdueCases: [],
        summary: {
            totalRegistros: 0,
            montoTotal: 0,
            abiertos: 0,
            enFirma: 0,
            enProceso: 0,
            observados: 0,
            cerrados: 0,
            anulados: 0,
            pendientes: 0,
            slaConfigurado: 0,
            slaVencidos: 0,
            horasVencidas: 0,
            diasVencidos: 0,
            promedioHorasVencidas: 0,
            promedioDiasVencidos: 0,
            maxHorasVencidas: 0,
            maxDiasVencidos: 0
        },
        overdueByArea: [],
        overdueByStage: [],
        stateSummary: [],
        agingBuckets: [],
        topOverdueCases: []
    };
    const profile = getUserProfile_(actorEmail);
    if (!profile.email) return Object.assign({}, empty, { success: false, error: 'Usuario no autorizado.' });
    if (!sh || sh.getLastRow() < 2) return empty;

    const cacheKey = `report-sla:${String(profile.email || '').toLowerCase()}:${iniRaw || '-'}:${finRaw || '-'}`;
    const cached = cacheGetJson_(cacheKey);
    if (cached) return cached;

    const schema = ensureAprobacionesSchema_(sh);
    const lastCol = sh.getLastColumn();
    const headers = sh.getRange(1, 1, 1, lastCol).getValues()[0] || [];
    const map = schema.map || buildHeaderMap_(headers);
    const tz = Session.getScriptTimeZone();
    const now = new Date();

    const detailRows = [];
    const overdueCases = [];
    const overdueByAreaMap = {};
    const overdueByStageMap = {};
    const stateMap = {};
    const agingMap = {
        '0-24h': { bucket: '0-24h', casos: 0, horasVencidas: 0, diasVencidos: 0 },
        '24-48h': { bucket: '24-48h', casos: 0, horasVencidas: 0, diasVencidos: 0 },
        '2-5d': { bucket: '2-5d', casos: 0, horasVencidas: 0, diasVencidos: 0 },
        '>5d': { bucket: '>5d', casos: 0, horasVencidas: 0, diasVencidos: 0 }
    };
    const summary = Object.assign({}, empty.summary);

    const lastRow = sh.getLastRow();
    const chunkSize = 450;
    for (let startRow = 2; startRow <= lastRow; startRow += chunkSize) {
        const numRows = Math.min(chunkSize, lastRow - startRow + 1);
        const rows = sh.getRange(startRow, 1, numRows, lastCol).getValues();
        for (let i = 0; i < rows.length; i++) {
            const r = rows[i];
            const fechaCre = toDateDash_(r[1]);
            if (fInicio && (!fechaCre || fechaCre.getTime() < fInicio.getTime())) continue;
            if (fFin && (!fechaCre || fechaCre.getTime() > fFin.getTime())) continue;
            if (!actorCanAccessAprobacionRow_(profile, r, map)) continue;

            const etapa = normalizeEtapa_(r[COL_ETAPA - 1]);
            const etapaIdx = etapaIndex_(etapa);
            const estado = normalizeEstado_(r[COL_ESTADO - 1]);
            const areaResponsable = rowText_(r, map, [WF.areaResponsableActual]) || areaResponsablePorEtapa_(etapaIdx);
            const limit = resolveStageSlaLimit_(r, map, etapaIdx);
            const slaTxt = slaStatusText_(r, map, etapaIdx);
            const overdue = computeSlaOverdueMetrics_(limit, now);
            const monto = Number(r[12] || 0);
            const stageCfg = getStageSlaSetting_(etapaIdx);
            const hasSla = !!stageCfg && !!stageCfg.active && Number(stageCfg.slaHours || 0) > 0;
            const fechaFmt = fechaCre ? Utilities.formatDate(fechaCre, tz, 'yyyy-MM-dd HH:mm') : '';
            const ultAct = toDateDash_(r[COL_ULT_ACT - 1]) || fechaCre;
            const detail = {
                id: String(r[0] || '').trim(),
                fecha: fechaFmt,
                fechaTs: fechaCre ? fechaCre.getTime() : 0,
                proveedor: String(r[2] || '').trim(),
                proveedorCodigo: String(r[3] || '').trim(),
                unidad: String(r[4] || '').trim(),
                ruta: String(r[5] || '').trim(),
                factura: String(r[8] || '').trim(),
                total: round2Dash_(monto),
                estado: estado,
                responsable: String(r[14] || '').trim(),
                piloto: String(r[15] || '').trim(),
                licencia: String(r[23] || '').trim(),
                etapa: etapa,
                areaResponsable: areaResponsable,
                sla: slaTxt,
                fechaLimiteSlaActual: formatDateTimeSafe_(limit),
                horasVencidas: overdue.overdueHours,
                diasVencidos: overdue.overdueDays,
                pdfUrl: String(r[COL_PDF_URL - 1] || '').trim(),
                ultAct: formatDateTimeSafe_(ultAct),
                ultActTs: ultAct ? ultAct.getTime() : 0
            };
            detailRows.push(detail);

            summary.totalRegistros++;
            summary.montoTotal += monto;
            if (hasSla) summary.slaConfigurado++;
            if (estado === 'Abierto') summary.abiertos++;
            else if (estado === 'En firma') summary.enFirma++;
            else if (estado === 'En proceso') summary.enProceso++;
            else if (estado === 'Observado') summary.observados++;
            else if (estado === 'Cerrado') summary.cerrados++;
            else if (estado === 'Anulado') summary.anulados++;

            if (!stateMap[estado]) {
                stateMap[estado] = { estado: estado, cantidad: 0, montoTotal: 0 };
            }
            stateMap[estado].cantidad++;
            stateMap[estado].montoTotal += monto;

            if (!overdue.isOverdue) continue;
            if (estado === 'Cerrado' || estado === 'Anulado') continue;

            overdueCases.push(detail);
            summary.slaVencidos++;
            summary.horasVencidas += overdue.overdueHours;
            summary.diasVencidos += overdue.overdueDays;
            summary.maxHorasVencidas = Math.max(summary.maxHorasVencidas, overdue.overdueHours);
            summary.maxDiasVencidos = Math.max(summary.maxDiasVencidos, overdue.overdueDays);

            if (!overdueByAreaMap[areaResponsable]) {
                overdueByAreaMap[areaResponsable] = {
                    area: areaResponsable,
                    casos: 0,
                    montoTotal: 0,
                    horasVencidas: 0,
                    diasVencidos: 0,
                    maxHorasVencidas: 0,
                    maxDiasVencidos: 0
                };
            }
            overdueByAreaMap[areaResponsable].casos++;
            overdueByAreaMap[areaResponsable].montoTotal += monto;
            overdueByAreaMap[areaResponsable].horasVencidas += overdue.overdueHours;
            overdueByAreaMap[areaResponsable].diasVencidos += overdue.overdueDays;
            overdueByAreaMap[areaResponsable].maxHorasVencidas = Math.max(overdueByAreaMap[areaResponsable].maxHorasVencidas, overdue.overdueHours);
            overdueByAreaMap[areaResponsable].maxDiasVencidos = Math.max(overdueByAreaMap[areaResponsable].maxDiasVencidos, overdue.overdueDays);

            if (!overdueByStageMap[etapa]) {
                overdueByStageMap[etapa] = {
                    etapa: etapa,
                    area: areaResponsable,
                    casos: 0,
                    montoTotal: 0,
                    horasVencidas: 0,
                    diasVencidos: 0,
                    maxHorasVencidas: 0,
                    maxDiasVencidos: 0
                };
            }
            overdueByStageMap[etapa].casos++;
            overdueByStageMap[etapa].montoTotal += monto;
            overdueByStageMap[etapa].horasVencidas += overdue.overdueHours;
            overdueByStageMap[etapa].diasVencidos += overdue.overdueDays;
            overdueByStageMap[etapa].maxHorasVencidas = Math.max(overdueByStageMap[etapa].maxHorasVencidas, overdue.overdueHours);
            overdueByStageMap[etapa].maxDiasVencidos = Math.max(overdueByStageMap[etapa].maxDiasVencidos, overdue.overdueDays);

            const bucket = slaOverdueBucketLabel_(overdue.overdueHours);
            agingMap[bucket].casos++;
            agingMap[bucket].horasVencidas += overdue.overdueHours;
            agingMap[bucket].diasVencidos += overdue.overdueDays;
        }
    }

    detailRows.sort((a, b) => {
        if (b.fechaTs !== a.fechaTs) return b.fechaTs - a.fechaTs;
        return b.ultActTs - a.ultActTs;
    });
    overdueCases.sort((a, b) => {
        if (b.horasVencidas !== a.horasVencidas) return b.horasVencidas - a.horasVencidas;
        return b.fechaTs - a.fechaTs;
    });

    summary.montoTotal = round2Dash_(summary.montoTotal);
    summary.horasVencidas = round2Dash_(summary.horasVencidas);
    summary.diasVencidos = round2Dash_(summary.diasVencidos);
    summary.promedioHorasVencidas = summary.slaVencidos ? round2Dash_(summary.horasVencidas / summary.slaVencidos) : 0;
    summary.promedioDiasVencidos = summary.slaVencidos ? round2Dash_(summary.diasVencidos / summary.slaVencidos) : 0;
    summary.maxHorasVencidas = round2Dash_(summary.maxHorasVencidas);
    summary.maxDiasVencidos = round2Dash_(summary.maxDiasVencidos);
    summary.pendientes = Math.max(0, summary.totalRegistros - summary.cerrados - summary.anulados);

    const overdueByArea = Object.keys(overdueByAreaMap).map(k => {
        const item = overdueByAreaMap[k];
        item.montoTotal = round2Dash_(item.montoTotal);
        item.horasVencidas = round2Dash_(item.horasVencidas);
        item.diasVencidos = round2Dash_(item.diasVencidos);
        item.promedioHorasVencidas = item.casos ? round2Dash_(item.horasVencidas / item.casos) : 0;
        item.promedioDiasVencidos = item.casos ? round2Dash_(item.diasVencidos / item.casos) : 0;
        item.maxHorasVencidas = round2Dash_(item.maxHorasVencidas);
        item.maxDiasVencidos = round2Dash_(item.maxDiasVencidos);
        return item;
    }).sort((a, b) => {
        if (b.casos !== a.casos) return b.casos - a.casos;
        return b.horasVencidas - a.horasVencidas;
    });

    const overdueByStage = Object.keys(overdueByStageMap).map(k => {
        const item = overdueByStageMap[k];
        item.montoTotal = round2Dash_(item.montoTotal);
        item.horasVencidas = round2Dash_(item.horasVencidas);
        item.diasVencidos = round2Dash_(item.diasVencidos);
        item.promedioHorasVencidas = item.casos ? round2Dash_(item.horasVencidas / item.casos) : 0;
        item.promedioDiasVencidos = item.casos ? round2Dash_(item.diasVencidos / item.casos) : 0;
        item.maxHorasVencidas = round2Dash_(item.maxHorasVencidas);
        item.maxDiasVencidos = round2Dash_(item.maxDiasVencidos);
        return item;
    }).sort((a, b) => {
        if (b.casos !== a.casos) return b.casos - a.casos;
        return b.horasVencidas - a.horasVencidas;
    });

    const stateOrder = ['Abierto', 'En firma', 'En proceso', 'Observado', 'Cerrado', 'Anulado'];
    const stateSummary = stateOrder
        .filter(k => !!stateMap[k])
        .map(k => ({
            estado: k,
            cantidad: Number(stateMap[k].cantidad || 0),
            montoTotal: round2Dash_(stateMap[k].montoTotal || 0)
        }));

    Object.keys(stateMap).forEach(k => {
        if (stateOrder.indexOf(k) >= 0) return;
        stateSummary.push({
            estado: k,
            cantidad: Number(stateMap[k].cantidad || 0),
            montoTotal: round2Dash_(stateMap[k].montoTotal || 0)
        });
    });

    const agingBuckets = ['0-24h', '24-48h', '2-5d', '>5d'].map(k => ({
        bucket: k,
        casos: Number(agingMap[k].casos || 0),
        horasVencidas: round2Dash_(agingMap[k].horasVencidas || 0),
        diasVencidos: round2Dash_(agingMap[k].diasVencidos || 0)
    }));

    const result = {
        success: true,
        rows: detailRows.map(stripReportRowMeta_),
        overdueCases: overdueCases.map(stripReportRowMeta_),
        summary: summary,
        overdueByArea: overdueByArea,
        overdueByStage: overdueByStage,
        stateSummary: stateSummary,
        agingBuckets: agingBuckets,
        topOverdueCases: overdueCases.slice(0, 25).map(stripReportRowMeta_)
    };
    cachePutJson_(cacheKey, result, 60);
    return result;
}

function getAdvancedReportData(inicioStr, finStr, actorEmail) {
    return buildSlaOverdueSnapshot_(inicioStr, finStr, actorEmail);
}

/**
 * ============================================================================
 * âœ… MÃ“DULO: GESTIÃ“N DE USUARIOS (SOLO ADMIN)
 * ============================================================================
 */

function adminGetUsers() {
    const cacheKey = 'users:all';
    const cached = cacheGetJson_(cacheKey);
    if (Array.isArray(cached)) return cached;

    const grid = getUsersGridMeta_();
    const values = grid.values || [];
    const out = [];
    for (let i = 1; i < values.length; i++) {
        const user = mapUserRow_(values[i] || [], i + 1, grid.meta);
        user.password = '';
        out.push(user);
    }
    cachePutJson_(cacheKey, out, 120);
    return out;
}

function adminSaveUser(userObj) {
    const grid = getUsersGridMeta_();
    const sh = grid.sh;
    const meta = grid.meta;
    const rowNum = Number(userObj.row || 0);
    const email = String(userObj.email || '').trim().toLowerCase();
    const nombre = String(userObj.nombre || '').trim();
    const rol = normalizeRole_(userObj.rol || '');
    const activo = userObj.activo === 'true' || userObj.activo === true;
    const incomingPassword = String(userObj.password || '').trim();
    const countryCode = normalizeCountryCode_(userObj.countryCode);
    const area = String(userObj.area || '').trim() || inferAreaFromRole_(rol);

    if (!email || !nombre || !rol) {
        return { success: false, message: 'Email, nombre y rol son obligatorios.' };
    }
    if (!countryCode) {
        return { success: false, message: 'Debe asignar un pais valido (SV, PE o GT).' };
    }

    const users = adminGetUsers();
    const duplicate = users.find(u =>
        String(u.email || '').toLowerCase() === email &&
        Number(u.row || 0) !== rowNum
    );
    if (duplicate) {
        return { success: false, message: 'El correo ya existe.' };
    }

    if (rowNum > 0) {
        if (rowNum < 2 || rowNum > sh.getLastRow()) {
            return { success: false, message: 'Fila de usuario invalida.' };
        }
        const currentRow = sh.getRange(rowNum, 1, 1, sh.getLastColumn()).getValues()[0];
        const currentPassword = String(userCell_(currentRow, meta, 'password', 3) || '');
        const nextPassword = incomingPassword
            ? (isHashedPassword_(incomingPassword) ? incomingPassword : hashPassword_(incomingPassword))
            : currentPassword;
        const rowValues = applyUserValuesToRow_(currentRow, meta, {
            email: email,
            nombre: nombre,
            rol: rol,
            password: nextPassword,
            activo: activo,
            area: area,
            countryCode: countryCode
        });
        sh.getRange(rowNum, 1, 1, rowValues.length).setValues([rowValues]);
    } else {
        if (!incomingPassword) return { success: false, message: 'La contraseña es obligatoria para crear usuario.' };
        const rowValues = applyUserValuesToRow_(new Array(Math.max(sh.getLastColumn(), USER_SHEET_HEADERS.length)).fill(''), meta, {
            email: email,
            nombre: nombre,
            rol: rol,
            password: hashPassword_(incomingPassword),
            activo: activo,
            area: area,
            countryCode: countryCode
        });
        sh.appendRow(rowValues);
    }
    clearUserCaches_();
    return { success: true };
}

function adminDeleteUser(row) {
    const ss = getDataStore_();
    const sh = ss.getSheetByName('Usuarios');
    if (sh) {
        sh.deleteRow(row);
        clearUserCaches_();
        return { success: true };
    }
    return { success: false, message: "Hoja no encontrada" };
}

/**
 * ============================================================================
 * âœ… MODULO: GESTION DE PILOTOS (SOLO ADMIN)
 * ============================================================================
 */

function adminGetPilotos(actorEmail) {
    const sh = ensurePilotosSheet_();
    if (!sh || sh.getLastRow() < 2) return [];

    const profile = getUserProfile_(actorEmail);
    if (!profile || !profile.email) return [];
    const actorCountry = normalizeCountryCode_(profile.countryCode);
    const shouldFilter = actorCountryFilterEnabled_(profile);

    const cacheKey = 'pilots:all';
    let all = cacheGetJson_(cacheKey);
    if (!Array.isArray(all)) {
        const lastRow = sh.getLastRow();
        const lastCol = Math.max(sh.getLastColumn(), PILOTO_HEADERS.length);
        const data = sh.getRange(1, 1, lastRow, lastCol).getValues();
        const pilotoMeta = buildPilotoHeaderMeta_(data[0] || PILOTO_HEADERS);
        all = data.slice(1)
            .map((r, i) => mapPilotoRow_(r, i + 2, pilotoMeta))
            .filter(p => p.dni || p.nombre);
        cachePutJson_(cacheKey, all, 120);
    }

    return all.filter(p => !shouldFilter || resolveCatalogCountryCode_(p.countryCode) === actorCountry);
}

function adminSavePilot(pilotObj, actorEmail) {
    const actorCtx = resolveCatalogActorContext_(actorEmail);
    if (!actorCtx.ok) return { success: false, message: actorCtx.message };

    const sh = ensurePilotosSheet_();

    const rowNum = Number(pilotObj && pilotObj.row ? pilotObj.row : 0);
    const dni = String(pilotObj && pilotObj.dni ? pilotObj.dni : '').trim();
    const nombre = String(pilotObj && pilotObj.nombre ? pilotObj.nombre : '').trim();
    const requestedCountry = normalizeCountryCode_(pilotObj && pilotObj.countryCode);
    const countryCode = requestedCountry || actorCtx.countryCode;

    if (!dni || !nombre) {
        return { success: false, message: 'DNI y nombre son obligatorios.' };
    }
    if (requestedCountry && requestedCountry !== actorCtx.countryCode) {
        return { success: false, message: 'No tiene acceso a registrar pilotos fuera de su entorno.' };
    }

    const all = sh.getDataRange().getValues();
    const pilotoMeta = buildPilotoHeaderMeta_(all[0] || PILOTO_HEADERS);
    for (let i = 1; i < all.length; i++) {
        const existingDni = String(pilotoCell_(all[i], pilotoMeta, 'dni', 0) || '').trim();
        const currentRow = i + 2;
        if (existingDni && existingDni === dni && currentRow !== rowNum) {
            return { success: false, message: 'El DNI ya existe en la lista de pilotos.' };
        }
    }

    if (rowNum > 0) {
        if (rowNum < 2 || rowNum > sh.getLastRow()) {
            return { success: false, message: 'Fila de piloto invalida.' };
        }
        const lastCol = Math.max(sh.getLastColumn(), PILOTO_HEADERS.length);
        const currentRowValues = sh.getRange(rowNum, 1, 1, lastCol).getValues()[0] || [];
        const existingCountry = resolveCatalogCountryCode_(pilotoCell_(currentRowValues, pilotoMeta, 'countryCode', 2));
        if (!actorCanAccessCatalogCountry_(actorCtx.profile, existingCountry)) {
            return { success: false, message: 'No tiene acceso a este piloto fuera de su entorno.' };
        }
        const rowValues = applyPilotoValuesToRow_(currentRowValues, pilotoMeta, {
            dni: dni,
            nombre: nombre,
            countryCode: requestedCountry || existingCountry || actorCtx.countryCode
        });
        sh.getRange(rowNum, 1, 1, rowValues.length).setValues([rowValues]);
    } else {
        const rowValues = applyPilotoValuesToRow_(new Array(Math.max(sh.getLastColumn(), PILOTO_HEADERS.length)).fill(''), pilotoMeta, {
            dni: dni,
            nombre: nombre,
            countryCode: countryCode
        });
        sh.appendRow(rowValues);
    }

    clearPilotCaches_();
    return { success: true };
}

function adminDeletePilot(row, actorEmail) {
    const actorCtx = resolveCatalogActorContext_(actorEmail);
    if (!actorCtx.ok) return { success: false, message: actorCtx.message };

    const sh = ensurePilotosSheet_();
    const rowNum = Number(row || 0);

    if (!sh) return { success: false, message: "Hoja 'Pilotos' no encontrada." };
    if (rowNum < 2 || rowNum > sh.getLastRow()) {
        return { success: false, message: 'Fila de piloto invalida.' };
    }

    const headers = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), PILOTO_HEADERS.length)).getValues()[0] || [];
    const meta = buildPilotoHeaderMeta_(headers);
    const rowValues = sh.getRange(rowNum, 1, 1, headers.length).getValues()[0] || [];
    const existingCountry = resolveCatalogCountryCode_(pilotoCell_(rowValues, meta, 'countryCode', 2));
    if (!actorCanAccessCatalogCountry_(actorCtx.profile, existingCountry)) {
        return { success: false, message: 'No tiene acceso a este piloto fuera de su entorno.' };
    }

    sh.deleteRow(rowNum);
    clearPilotCaches_();
    return { success: true };
}

function ensurePilotosSheet_() {
    const ss = getDataStore_();
    let sh = ss.getSheetByName('Pilotos') || findSheetByNormalizedName_(ss, ['Pilotos', 'Piloto']);
    const headers = PILOTO_HEADERS;

    if (!sh) {
        sh = ss.insertSheet('Pilotos');
        sh.getRange(1, 1, 1, headers.length).setValues([headers]);
        return sh;
    }

    if (sh.getLastRow() < 1) {
        sh.getRange(1, 1, 1, headers.length).setValues([headers]);
        return sh;
    }

    const lastCol = Math.max(sh.getLastColumn(), headers.length);
    const current = sh.getRange(1, 1, 1, lastCol).getValues()[0] || [];
    for (let i = 0; i < headers.length; i++) {
        if (!String(current[i] || '').trim()) {
            sh.getRange(1, i + 1).setValue(headers[i]);
        }
    }

    const meta = buildPilotoHeaderMeta_(current);
    if (meta.countryCode >= 0 && sh.getLastRow() > 1) {
        const col = meta.countryCode + 1;
        const values = sh.getRange(2, col, sh.getLastRow() - 1, 1).getValues();
        let needsFill = false;
        for (let i = 0; i < values.length; i++) {
            if (normalizeCountryCode_(values[i][0])) continue;
            values[i][0] = DEFAULT_COUNTRY_CODE;
            needsFill = true;
        }
        if (needsFill) sh.getRange(2, col, values.length, 1).setValues(values);
    }

    return sh;
}

/**
 * ============================================================================
 * âœ… MODULO: GESTION DE PROVEEDORES (SOLO ADMIN)
 * ============================================================================
 */

function ensureProveedoresSheet_() {
    const ss = getDataStore_();
    let sh = ss.getSheetByName('Proveedores') || findSheetByNormalizedName_(ss, ['Proveedores', 'Proveedor']);
    if (!sh) {
        sh = ss.insertSheet('Proveedores');
        sh.getRange(1, 1, 1, PROVEEDOR_HEADERS.length).setValues([PROVEEDOR_HEADERS]);
        return sh;
    }

    if (sh.getLastRow() < 1) {
        sh.getRange(1, 1, 1, PROVEEDOR_HEADERS.length).setValues([PROVEEDOR_HEADERS]);
        return sh;
    }

    const lastCol = Math.max(sh.getLastColumn(), PROVEEDOR_HEADERS.length);
    const current = sh.getRange(1, 1, 1, lastCol).getValues()[0] || [];
    for (let i = 0; i < PROVEEDOR_HEADERS.length; i++) {
        if (!String(current[i] || '').trim()) {
            sh.getRange(1, i + 1).setValue(PROVEEDOR_HEADERS[i]);
        }
    }

    const meta = buildProveedorHeaderMeta_(current);
    if (meta.countryCode >= 0 && sh.getLastRow() > 1) {
        const col = meta.countryCode + 1;
        const values = sh.getRange(2, col, sh.getLastRow() - 1, 1).getValues();
        let needsFill = false;
        for (let i = 0; i < values.length; i++) {
            if (normalizeCountryCode_(values[i][0])) continue;
            values[i][0] = DEFAULT_COUNTRY_CODE;
            needsFill = true;
        }
        if (needsFill) sh.getRange(2, col, values.length, 1).setValues(values);
    }
    return sh;
}

function adminGetProveedores(actorEmail) {
    const sh = ensureProveedoresSheet_();
    if (!sh || sh.getLastRow() < 2) return [];

    const profile = getUserProfile_(actorEmail);
    if (!profile || !profile.email) return [];
    const actorCountry = normalizeCountryCode_(profile.countryCode);
    const shouldFilter = actorCountryFilterEnabled_(profile);

    const cacheKey = 'providers:all';
    let all = cacheGetJson_(cacheKey);
    if (!Array.isArray(all)) {
        const lastRow = sh.getLastRow();
        const lastCol = Math.max(sh.getLastColumn(), PROVEEDOR_HEADERS.length);
        const data = sh.getRange(1, 1, lastRow, lastCol).getValues();
        const providerMeta = buildProveedorHeaderMeta_(data[0] || PROVEEDOR_HEADERS);
        all = data.slice(1)
            .map((r, i) => mapProveedorRow_(r, i + 2, providerMeta))
            .filter(p => p.codigo || p.nombre || p.email);
        cachePutJson_(cacheKey, all, 120);
    }

    return all.filter(p => !shouldFilter || resolveCatalogCountryCode_(p.countryCode) === actorCountry);
}

function adminSaveProvider(providerObj, actorEmail) {
    const actorCtx = resolveCatalogActorContext_(actorEmail);
    if (!actorCtx.ok) return { success: false, message: actorCtx.message };

    const sh = ensureProveedoresSheet_();
    const rowNum = Number(providerObj && providerObj.row ? providerObj.row : 0);
    const codigo = String(providerObj && providerObj.codigo ? providerObj.codigo : '').trim();
    const nombre = String(providerObj && providerObj.nombre ? providerObj.nombre : '').trim();
    const email = String(providerObj && providerObj.email ? providerObj.email : '').trim();
    const requestedCountry = normalizeCountryCode_(providerObj && providerObj.countryCode);
    const countryCode = requestedCountry || actorCtx.countryCode;

    if (!codigo || !nombre) {
        return { success: false, message: 'Codigo y nombre son obligatorios.' };
    }
    if (requestedCountry && requestedCountry !== actorCtx.countryCode) {
        return { success: false, message: 'No tiene acceso a registrar proveedores fuera de su entorno.' };
    }

    const all = sh.getDataRange().getValues();
    const providerMeta = buildProveedorHeaderMeta_(all[0] || PROVEEDOR_HEADERS);
    for (let i = 1; i < all.length; i++) {
        const existingCode = String(proveedorCell_(all[i], providerMeta, 'codigo', 0) || '').trim().toLowerCase();
        const currentRow = i + 2;
        if (existingCode && existingCode === codigo.toLowerCase() && currentRow !== rowNum) {
            return { success: false, message: 'El codigo de proveedor ya existe.' };
        }
    }

    if (rowNum > 0) {
        if (rowNum < 2 || rowNum > sh.getLastRow()) {
            return { success: false, message: 'Fila de proveedor invalida.' };
        }
        const lastCol = Math.max(sh.getLastColumn(), PROVEEDOR_HEADERS.length);
        const currentRowValues = sh.getRange(rowNum, 1, 1, lastCol).getValues()[0] || [];
        const existingCountry = resolveCatalogCountryCode_(proveedorCell_(currentRowValues, providerMeta, 'countryCode', 3));
        if (!actorCanAccessCatalogCountry_(actorCtx.profile, existingCountry)) {
            return { success: false, message: 'No tiene acceso a este proveedor fuera de su entorno.' };
        }
        const rowValues = applyProveedorValuesToRow_(currentRowValues, providerMeta, {
            codigo: codigo,
            nombre: nombre,
            email: email,
            countryCode: requestedCountry || existingCountry || actorCtx.countryCode
        });
        sh.getRange(rowNum, 1, 1, rowValues.length).setValues([rowValues]);
    } else {
        const rowValues = applyProveedorValuesToRow_(new Array(Math.max(sh.getLastColumn(), PROVEEDOR_HEADERS.length)).fill(''), providerMeta, {
            codigo: codigo,
            nombre: nombre,
            email: email,
            countryCode: countryCode
        });
        sh.appendRow(rowValues);
    }

    clearProviderCaches_();
    return { success: true };
}

function adminDeleteProvider(row, actorEmail) {
    const actorCtx = resolveCatalogActorContext_(actorEmail);
    if (!actorCtx.ok) return { success: false, message: actorCtx.message };

    const sh = ensureProveedoresSheet_();
    const rowNum = Number(row || 0);
    if (!sh) return { success: false, message: "Hoja 'Proveedores' no encontrada." };
    if (rowNum < 2 || rowNum > sh.getLastRow()) {
        return { success: false, message: 'Fila de proveedor invalida.' };
    }

    const headers = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), PROVEEDOR_HEADERS.length)).getValues()[0] || [];
    const meta = buildProveedorHeaderMeta_(headers);
    const rowValues = sh.getRange(rowNum, 1, 1, headers.length).getValues()[0] || [];
    const existingCountry = resolveCatalogCountryCode_(proveedorCell_(rowValues, meta, 'countryCode', 3));
    if (!actorCanAccessCatalogCountry_(actorCtx.profile, existingCountry)) {
        return { success: false, message: 'No tiene acceso a este proveedor fuera de su entorno.' };
    }
    sh.deleteRow(rowNum);
    clearProviderCaches_();
    return { success: true };
}

/**
 * ============================================================================
 * âœ… MODULO: GESTION DE MAESTRO (SOLO ADMIN)
 * ============================================================================
 */

function adminGetMaestroItems(actorEmail) {
    const sh = ensureMaestroSheet_();
    if (!sh || sh.getLastRow() < 2) return [];

    const profile = getUserProfile_(actorEmail);
    if (!profile || !profile.email) return [];
    const actorCountry = normalizeCountryCode_(profile.countryCode);
    const shouldFilter = actorCountryFilterEnabled_(profile);

    const cacheKey = 'maestro:all';
    let all = cacheGetJson_(cacheKey);
    if (!Array.isArray(all)) {
        const lastRow = sh.getLastRow();
        const lastCol = Math.max(sh.getLastColumn(), MAESTRO_HEADERS.length);
        const data = sh.getRange(1, 1, lastRow, lastCol).getValues();
        const maestroMeta = buildMaestroHeaderMeta_(data[0] || MAESTRO_HEADERS);
        all = collectMaestroItemsFromGrid_(data, maestroMeta).items;
        cachePutJson_(cacheKey, all, 120);
    }

    return all.filter(item => !shouldFilter || resolveCatalogCountryCode_(item.countryCode) === actorCountry);
}

function adminGetMaestroItemsJson(actorEmail) {
    return JSON.stringify(adminGetMaestroItems(actorEmail) || []);
}

function adminDebugMaestroState() {
    const ss = getDataStore_();
    const sh = ensureMaestroSheet_();
    if (!ss || !sh) {
        return {
            ok: false,
            spreadsheetId: ss ? ss.getId() : '',
            spreadsheetName: ss ? ss.getName() : '',
            message: "No se encontro la hoja 'maestro'."
        };
    }

    const grid = sh.getDataRange().getDisplayValues();
    const maestroMeta = buildMaestroHeaderMeta_(grid[0] || MAESTRO_HEADERS);
    const result = collectMaestroItemsFromGrid_(grid, maestroMeta);
    return {
        ok: true,
        spreadsheetId: ss.getId(),
        spreadsheetName: ss.getName(),
        sheetName: sh.getName(),
        lastRow: sh.getLastRow(),
        lastColumn: sh.getLastColumn(),
        headers: (grid[0] || []).slice(0, 12),
        mappedCount: result.mapped.length,
        rawCount: result.raw.length,
        sampleMapped: result.mapped.slice(0, 3),
        sampleRaw: result.raw.slice(0, 3)
    };
}

function parseLooseNumberImport_(raw, fallback) {
    if (typeof raw === 'number') return isFinite(raw) ? raw : Number(fallback || 0);
    const txt = String(raw == null ? '' : raw).trim();
    if (!txt) return Number(fallback || 0);

    const compact = txt.replace(/\s+/g, '');
    const lastComma = compact.lastIndexOf(',');
    const lastDot = compact.lastIndexOf('.');
    let normalized = compact;

    if (lastComma >= 0 && lastDot >= 0) {
        normalized = lastComma > lastDot
            ? compact.replace(/\./g, '').replace(',', '.')
            : compact.replace(/,/g, '');
    } else if (lastComma >= 0) {
        normalized = compact.replace(/\./g, '').replace(',', '.');
    } else {
        normalized = compact.replace(/,/g, '');
    }

    const parsed = Number(normalized);
    return isFinite(parsed) ? parsed : Number(fallback || 0);
}

function objectFieldByAliases_(obj, aliases) {
    if (!obj || typeof obj !== 'object') return '';
    const keys = Object.keys(obj);
    const map = {};

    for (let i = 0; i < keys.length; i++) {
        const rawKey = String(keys[i] || '');
        const normKey = normalizeKey_(rawKey);
        if (!normKey || map[normKey] != null) continue;
        map[normKey] = obj[rawKey];
    }

    const arr = Array.isArray(aliases) ? aliases : [];
    for (let i = 0; i < arr.length; i++) {
        const wanted = normalizeKey_(arr[i]);
        if (wanted && map[wanted] != null) return map[wanted];
    }
    return '';
}

function sanitizeMaestroImportItem_(itemObj, fallbackRowNumber) {
    const genericPrice = objectFieldByAliases_(itemObj, ['Precio', 'PrecioUnitario', 'Monto']);
    return {
        _sourceRow: Number(objectFieldByAliases_(itemObj, ['_sourceRow', 'sourceRow', 'rowNumber']) || fallbackRowNumber || 0),
        codigo: String(objectFieldByAliases_(itemObj, ['Codigo', 'Código', 'SKU', 'Item']) || '').trim(),
        descripcion: String(objectFieldByAliases_(itemObj, ['Descripcion', 'Descripción', 'Producto', 'Nombre']) || '').trim(),
        uxc: parseLooseNumberImport_(objectFieldByAliases_(itemObj, ['uxc', 'UXC', 'UnidadXCaja', 'UnidadesXCaja', 'UnidXCaja']), 0),
        precioConIgv: parseLooseNumberImport_(objectFieldByAliases_(itemObj, ['Precio con IGV', 'PrecioConIGV', 'PrecioIGV', 'PrecioVenta', 'PVP']) || genericPrice, 0),
        precioSinIgv: parseLooseNumberImport_(objectFieldByAliases_(itemObj, ['Precio sin IGV', 'PrecioSinIGV', 'PrecioBase', 'Costo', 'Valor']) || genericPrice, 0),
        ean: String(objectFieldByAliases_(itemObj, ['EAN', 'Barcode', 'CodigoBarra', 'Codigo_Barra', 'Código de Barra']) || '').trim(),
        activo: parseBoolLoose_(objectFieldByAliases_(itemObj, ['Activo', 'Estado', 'Habilitado', 'Enabled']), true),
        countryCode: normalizeCountryCode_(objectFieldByAliases_(itemObj, ['CountryCode', 'Pais', 'PaisCode', 'Country']))
    };
}

function adminSaveMaestroItem(itemObj, actorEmail) {
    const actorCtx = resolveCatalogActorContext_(actorEmail);
    if (!actorCtx.ok) return { success: false, message: actorCtx.message };

    const sh = ensureMaestroSheet_();
    const rowNum = Number(itemObj && itemObj.row ? itemObj.row : 0);
    const codigo = String(itemObj && itemObj.codigo ? itemObj.codigo : '').trim();
    const descripcion = String(itemObj && itemObj.descripcion ? itemObj.descripcion : '').trim();
    const ean = String(itemObj && itemObj.ean ? itemObj.ean : '').trim();
    const uxc = Number(itemObj && itemObj.uxc != null ? itemObj.uxc : 0);
    const precioConIgv = Number(itemObj && itemObj.precioConIgv != null ? itemObj.precioConIgv : 0);
    const precioSinIgv = Number(itemObj && itemObj.precioSinIgv != null ? itemObj.precioSinIgv : 0);
    const activo = parseBoolLoose_(itemObj && itemObj.activo, true);
    const requestedCountry = normalizeCountryCode_(itemObj && itemObj.countryCode);
    const countryCode = requestedCountry || actorCtx.countryCode;

    if (!codigo || !descripcion) {
        return { success: false, message: 'Codigo y descripcion son obligatorios.' };
    }
    if (!isFinite(uxc) || uxc < 0) {
        return { success: false, message: 'uxc debe ser un numero valido.' };
    }
    if (!isFinite(precioConIgv) || precioConIgv < 0) {
        return { success: false, message: 'Precio con IGV debe ser un numero valido.' };
    }
    if (!isFinite(precioSinIgv) || precioSinIgv < 0) {
        return { success: false, message: 'Precio sin IGV debe ser un numero valido.' };
    }
    if (requestedCountry && requestedCountry !== actorCtx.countryCode) {
        return { success: false, message: 'No tiene acceso a registrar items fuera de su entorno.' };
    }

    const all = sh.getDataRange().getValues();
    const maestroMeta = buildMaestroHeaderMeta_(all[0] || MAESTRO_HEADERS);
    for (let i = 1; i < all.length; i++) {
        const existingCode = String(maestroCell_(all[i], maestroMeta, 'codigo', 0) || '').trim().toLowerCase();
        const currentRow = i + 2;
        if (existingCode && existingCode === codigo.toLowerCase() && currentRow !== rowNum) {
            return { success: false, message: 'El codigo ya existe en la tabla maestro.' };
        }
    }

    const valuesObj = {
        codigo: codigo,
        descripcion: descripcion,
        uxc: uxc,
        precioConIgv: precioConIgv,
        precioSinIgv: precioSinIgv,
        ean: ean,
        activo: activo,
        countryCode: countryCode
    };
    if (rowNum > 0) {
        if (rowNum < 2 || rowNum > sh.getLastRow()) {
            return { success: false, message: 'Fila de maestro invalida.' };
        }
        const currentRowValues = sh.getRange(rowNum, 1, 1, sh.getLastColumn()).getValues()[0];
        const existingCountry = resolveCatalogCountryCode_(maestroCell_(currentRowValues, maestroMeta, 'countryCode', 7));
        if (!actorCanAccessCatalogCountry_(actorCtx.profile, existingCountry)) {
            return { success: false, message: 'No tiene acceso a este item fuera de su entorno.' };
        }
        if (requestedCountry && requestedCountry !== actorCtx.countryCode) {
            return { success: false, message: 'No tiene acceso a registrar items fuera de su entorno.' };
        }
        valuesObj.countryCode = requestedCountry || existingCountry || actorCtx.countryCode;
        const rowValues = applyMaestroValuesToRow_(currentRowValues, maestroMeta, valuesObj);
        sh.getRange(rowNum, 1, 1, rowValues.length).setValues([rowValues]);
    } else {
        const rowValues = applyMaestroValuesToRow_(new Array(sh.getLastColumn()).fill(''), maestroMeta, valuesObj);
        sh.appendRow(rowValues);
    }

    clearMaestroCaches_();
    return { success: true };
}

function adminImportMaestroItems(items, options, actorEmail) {
    const actorCtx = resolveCatalogActorContext_(actorEmail);
    if (!actorCtx.ok) return { success: false, message: actorCtx.message };

    let sourceItems = items;
    if (typeof sourceItems === 'string') {
        try {
            sourceItems = JSON.parse(sourceItems);
        } catch (e) {
            return { success: false, message: 'No se pudo leer el lote de importacion.' };
        }
    }

    const batch = Array.isArray(sourceItems) ? sourceItems : [];
    if (!batch.length) {
        return { success: false, message: 'No se encontraron filas para importar.' };
    }

    const cfg = options || {};
    const mode = String(cfg.mode || 'upsert').trim().toLowerCase() === 'insert_only' ? 'insert_only' : 'upsert';
    const sh = ensureMaestroSheet_();
    const grid = sh.getDataRange().getValues();
    const maestroMeta = buildMaestroHeaderMeta_(grid[0] || MAESTRO_HEADERS);
    const existingMap = {};
    const adapterRecords = (sh && typeof sh._loadRows_ === 'function') ? sh._loadRows_() : null;
    const canBatchSupabase = !!(sh && sh.def_ && typeof sh.invalidate_ === 'function' && typeof supabaseUpsertRows_ === 'function' && typeof supabaseInsertRows_ === 'function');

    for (let i = 1; i < grid.length; i++) {
        const code = String(maestroCell_(grid[i], maestroMeta, 'codigo', 0) || '').trim().toLowerCase();
        if (!code) continue;
        existingMap[code] = {
            rowNum: i + 1,
            rowValues: grid[i],
            record: adapterRecords && adapterRecords[i - 1] ? adapterRecords[i - 1] : null,
            countryCode: resolveCatalogCountryCode_(maestroCell_(grid[i], maestroMeta, 'countryCode', 7))
        };
    }

    const stagedMap = {};
    const stagedOrder = [];
    const errors = [];
    const duplicateCodes = [];
    const duplicateSeen = {};

    for (let i = 0; i < batch.length; i++) {
        const item = sanitizeMaestroImportItem_(batch[i], i + 2);
        const sourceRow = Number(item._sourceRow || i + 2);
        const codeKey = String(item.codigo || '').trim().toLowerCase();
        const requestedCountry = normalizeCountryCode_(item.countryCode);
        const countryCode = requestedCountry || actorCtx.countryCode;

        const isEmptyRow = !item.codigo && !item.descripcion && !item.ean
            && Number(item.uxc || 0) === 0
            && Number(item.precioConIgv || 0) === 0
            && Number(item.precioSinIgv || 0) === 0;
        if (isEmptyRow) continue;

        if (!item.codigo) {
            errors.push({ row: sourceRow, message: 'Codigo obligatorio.' });
            continue;
        }
        if (!item.descripcion) {
            errors.push({ row: sourceRow, message: 'Descripcion obligatoria para ' + item.codigo + '.' });
            continue;
        }
        if (!isFinite(item.uxc) || item.uxc < 0) {
            errors.push({ row: sourceRow, code: item.codigo, message: 'uxc invalido.' });
            continue;
        }
        if (!isFinite(item.precioConIgv) || item.precioConIgv < 0) {
            errors.push({ row: sourceRow, code: item.codigo, message: 'Precio con IGV invalido.' });
            continue;
        }
        if (!isFinite(item.precioSinIgv) || item.precioSinIgv < 0) {
            errors.push({ row: sourceRow, code: item.codigo, message: 'Precio sin IGV invalido.' });
            continue;
        }
        if (requestedCountry && requestedCountry !== actorCtx.countryCode) {
            errors.push({ row: sourceRow, code: item.codigo, message: 'Pais fuera de su entorno.' });
            continue;
        }

        item.countryCode = countryCode;

        if (!stagedMap[codeKey]) {
            stagedOrder.push(codeKey);
        } else if (!duplicateSeen[codeKey]) {
            duplicateSeen[codeKey] = true;
            duplicateCodes.push(item.codigo);
        }
        stagedMap[codeKey] = item;
    }

    const updatePayload = [];
    const appendPayload = [];
    const fallbackUpdates = [];
    const fallbackAppends = [];
    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    let skippedExisting = 0;

    for (let i = 0; i < stagedOrder.length; i++) {
        const codeKey = stagedOrder[i];
        const item = stagedMap[codeKey];
        const existing = existingMap[codeKey] || null;
        if (existing && !actorCanAccessCatalogCountry_(actorCtx.profile, existing.countryCode)) {
            errors.push({ row: item._sourceRow || '-', code: item.codigo, message: 'Sin acceso a este item en otro pais.' });
            continue;
        }
        const rowTemplate = applyMaestroValuesToRow_(
            existing ? existing.rowValues : new Array(Math.max(sh.getLastColumn(), MAESTRO_HEADERS.length)).fill(''),
            maestroMeta,
            item
        );

        if (existing) {
            if (mode === 'insert_only') {
                skipped++;
                skippedExisting++;
                continue;
            }
            updated++;
            if (canBatchSupabase) {
                updatePayload.push(sh.def_.fromRow(rowTemplate, existing.record || null));
            } else {
                fallbackUpdates.push({ rowNum: existing.rowNum, rowValues: rowTemplate });
            }
            continue;
        }

        inserted++;
        if (canBatchSupabase) {
            appendPayload.push(sh.def_.fromRow(rowTemplate, null));
        } else {
            fallbackAppends.push(rowTemplate);
        }
    }

    if (canBatchSupabase) {
        if (updatePayload.length) supabaseUpsertRows_(sh.def_.table, updatePayload, sh.def_.primaryKey);
        if (appendPayload.length) supabaseInsertRows_(sh.def_.table, appendPayload);
        sh.invalidate_();
    } else {
        for (let i = 0; i < fallbackUpdates.length; i++) {
            const item = fallbackUpdates[i];
            sh.getRange(item.rowNum, 1, 1, item.rowValues.length).setValues([item.rowValues]);
        }
        for (let i = 0; i < fallbackAppends.length; i++) {
            sh.appendRow(fallbackAppends[i]);
        }
    }

    skipped += errors.length;
    clearMaestroCaches_();

    return {
        success: true,
        mode: mode,
        totalReceived: batch.length,
        totalPrepared: stagedOrder.length,
        inserted: inserted,
        updated: updated,
        skipped: skipped,
        skippedExisting: skippedExisting,
        duplicateCount: duplicateCodes.length,
        duplicateCodes: duplicateCodes.slice(0, 10),
        errorCount: errors.length,
        errors: errors.slice(0, 20),
        message: 'Importacion completada.'
    };
}

function adminDeleteMaestroItem(row, actorEmail) {
    const actorCtx = resolveCatalogActorContext_(actorEmail);
    if (!actorCtx.ok) return { success: false, message: actorCtx.message };

    const sh = ensureMaestroSheet_();
    const rowNum = Number(row || 0);
    if (!sh) return { success: false, message: "Hoja 'maestro' no encontrada." };
    if (rowNum < 2 || rowNum > sh.getLastRow()) {
        return { success: false, message: 'Fila de maestro invalida.' };
    }

    const headers = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), MAESTRO_HEADERS.length)).getValues()[0] || [];
    const meta = buildMaestroHeaderMeta_(headers);
    const rowValues = sh.getRange(rowNum, 1, 1, headers.length).getValues()[0] || [];
    const existingCountry = resolveCatalogCountryCode_(maestroCell_(rowValues, meta, 'countryCode', 7));
    if (!actorCanAccessCatalogCountry_(actorCtx.profile, existingCountry)) {
        return { success: false, message: 'No tiene acceso a este item fuera de su entorno.' };
    }
    sh.deleteRow(rowNum);
    clearMaestroCaches_();
    return { success: true };
}

function adminToggleMaestroActivo(row, active, actorEmail) {
    const actorCtx = resolveCatalogActorContext_(actorEmail);
    if (!actorCtx.ok) return { success: false, message: actorCtx.message };

    const sh = ensureMaestroSheet_();
    const rowNum = Number(row || 0);
    if (!sh) return { success: false, message: "Hoja 'maestro' no encontrada." };
    if (rowNum < 2 || rowNum > sh.getLastRow()) {
        return { success: false, message: 'Fila de maestro invalida.' };
    }
    const activo = parseBoolLoose_(active, true);
    const headers = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), MAESTRO_HEADERS.length)).getValues()[0] || [];
    const maestroMeta = buildMaestroHeaderMeta_(headers);
    const rowValues = sh.getRange(rowNum, 1, 1, headers.length).getValues()[0] || [];
    const existingCountry = resolveCatalogCountryCode_(maestroCell_(rowValues, maestroMeta, 'countryCode', 7));
    if (!actorCanAccessCatalogCountry_(actorCtx.profile, existingCountry)) {
        return { success: false, message: 'No tiene acceso a este item fuera de su entorno.' };
    }
    const activeCol = maestroMeta.activo >= 0 ? (maestroMeta.activo + 1) : 7;
    sh.getRange(rowNum, activeCol).setValue(activo);
    clearMaestroCaches_();
    return { success: true, active: activo };
}

/**
 * ============================================================================
 * âœ… MODULO: CONFIGURACION POR REGLAS (SOLO ADMIN)
 * ============================================================================
 */

function getSheetHeadersSafe_(sh) {
    if (!sh) return [];
    // Supabase-backed sheets already expose headers; reading row 1 would fetch the whole table.
    if (Array.isArray(sh.headers_)) return sh.headers_.slice();
    const lastCol = Number(sh.getLastColumn ? sh.getLastColumn() : 0);
    if (lastCol < 1) return [];
    const values = sh.getRange(1, 1, 1, lastCol).getValues();
    return (values && values[0]) ? values[0] : [];
}

function ensureSheetSchema_(sheetName, headers) {
    const ss = getDataStore_();
    let sh = ss.getSheetByName(sheetName);
    if (!sh) sh = ss.insertSheet(sheetName);

    const wanted = headers || [];
    const lastCol = sh.getLastColumn();
    if (lastCol < 1) {
        if (wanted.length) sh.getRange(1, 1, 1, wanted.length).setValues([wanted]);
        return sh;
    }

    const existing = getSheetHeadersSafe_(sh);
    const map = buildHeaderMap_(existing);
    let col = existing.length;
    for (let i = 0; i < wanted.length; i++) {
        const h = wanted[i];
        if (map[normalizeKey_(h)] != null) continue;
        col += 1;
        sh.getRange(1, col).setValue(h);
    }
    return sh;
}

function ensureRuleEngineSheets_() {
    const out = {};
    const names = Object.keys(CFG_SHEET_DEFS);
    for (let i = 0; i < names.length; i++) {
        const name = names[i];
        const sh = ensureSheetSchema_(name, CFG_SHEET_DEFS[name]);
        out[name] = sh.getName();
    }
    return out;
}

function parseBoolLoose_(raw, fallback) {
    if (raw === true || raw === false) return raw;
    const txt = String(raw || '').trim().toLowerCase();
    if (!txt) return !!fallback;
    if (txt === '1' || txt === 'true' || txt === 'si' || txt === 'yes' || txt === 'on' || txt === 'activo' || txt === 'habilitado') return true;
    if (txt === '0' || txt === 'false' || txt === 'no' || txt === 'off' || txt === 'inactivo' || txt === 'deshabilitado') return false;
    return !!fallback;
}

function formatDateYmdSafe_(v) {
    if (!v) return '';
    const d = new Date(v);
    if (isNaN(d.getTime())) return '';
    return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function parseDateInputSafe_(raw) {
    const txt = String(raw || '').trim();
    if (!txt) return '';
    const d = new Date(txt);
    return isNaN(d.getTime()) ? '' : d;
}

function requireAdminForConfig_(actorEmail) {
    const profile = getUserProfile_(actorEmail);
    if (!profile.email) {
        return { success: false, message: 'Usuario no autenticado.' };
    }
    if (!profile.isAdmin) {
        return { success: false, message: 'Solo administradores pueden gestionar esta configuración.' };
    }
    return { success: true, profile: profile };
}

function getCfgCountries_() {
    const sh = ensureSheetSchema_('CFG_COUNTRY', CFG_SHEET_DEFS.CFG_COUNTRY);
    const values = sh.getDataRange().getValues();
    if (values.length < 2) return [];
    return values.slice(1).map((r, i) => ({
        row: i + 2,
        countryCode: String(r[0] || '').trim().toUpperCase(),
        name: String(r[1] || '').trim(),
        currency: String(r[2] || '').trim(),
        timezone: String(r[3] || '').trim(),
        locale: String(r[4] || '').trim(),
        active: parseBoolLoose_(r[5], true),
        updatedAt: formatDateTimeSafe_(r[6])
    })).filter(x => x.countryCode || x.name || x.currency || x.timezone || x.locale);
}

function getCfgRoles_() {
    const sh = ensureSheetSchema_('CFG_ROLE', CFG_SHEET_DEFS.CFG_ROLE);
    const values = sh.getDataRange().getValues();
    if (values.length < 2) return [];
    return values.slice(1).map((r, i) => ({
        row: i + 2,
        roleId: String(r[0] || '').trim(),
        roleKey: String(r[1] || '').trim(),
        roleName: String(r[2] || '').trim(),
        active: parseBoolLoose_(r[3], true),
        updatedAt: formatDateTimeSafe_(r[4])
    })).filter(x => x.roleId || x.roleKey || x.roleName);
}

function getCfgRules_() {
    const sh = ensureSheetSchema_('CFG_RULE', CFG_SHEET_DEFS.CFG_RULE);
    const values = sh.getDataRange().getValues();
    if (values.length < 2) return [];
    const out = values.slice(1).map((r, i) => ({
        row: i + 2,
        ruleId: String(r[0] || '').trim(),
        name: String(r[1] || '').trim(),
        processKey: String(r[2] || PROCESS_KEY_DEFAULT).trim() || PROCESS_KEY_DEFAULT,
        priority: Number(r[3] || 100),
        countryScope: String(r[4] || '*').trim() || '*',
        stageFrom: Number(r[5] || 1),
        stageTo: Number(r[6] || 11),
        triggerEvent: String(r[7] || 'STAGE_ENTER').trim() || 'STAGE_ENTER',
        conditionJson: String(r[8] || '').trim(),
        actionJson: String(r[9] || '').trim(),
        stopOnMatch: parseBoolLoose_(r[10], true),
        active: parseBoolLoose_(r[11], true),
        validFrom: formatDateYmdSafe_(r[12]),
        validTo: formatDateYmdSafe_(r[13]),
        updatedAt: formatDateTimeSafe_(r[14])
    })).filter(x => x.ruleId || x.name);
    out.sort((a, b) => Number(a.priority || 9999) - Number(b.priority || 9999));
    return out;
}

function getCfgAuthKeys_() {
    const sh = ensureSheetSchema_('CFG_AUTH_KEY', CFG_SHEET_DEFS.CFG_AUTH_KEY);
    const values = sh.getDataRange().getValues();
    if (values.length < 2) return [];
    return values.slice(1).map((r, i) => {
        const scope = normalizeAuthKeyScope_(r[3]);
        const maxUsos = Number(r[5] || 0);
        const usosActuales = Number(r[6] || 0);
        return {
            row: i + 2,
            keyId: String(r[0] || '').trim(),
            name: String(r[1] || '').trim(),
            scope: scope,
            scopeLabel: authKeyScopeLabel_(scope),
            active: parseBoolLoose_(r[4], true),
            maxUsos: maxUsos > 0 ? maxUsos : 0,
            usosActuales: usosActuales > 0 ? usosActuales : 0,
            ultimoUsoAt: formatDateTimeSafe_(r[7]),
            notas: String(r[8] || '').trim(),
            updatedAt: formatDateTimeSafe_(r[9]),
            hasSecret: !!String(r[2] || '').trim()
        };
    }).filter(x => x.keyId || x.name);
}

function maskSecretPreview_(raw) {
    const txt = String(raw || '').trim();
    if (!txt) return '';
    if (txt.length <= 8) return txt.slice(0, 2) + '***';
    return txt.slice(0, 4) + '...' + txt.slice(-4);
}

function getCfgMailTransport_() {
    const props = PropertiesService.getScriptProperties();
    const apiKey = String(props.getProperty(RESEND_API_KEY_PROP) || '').trim();
    const from = String(getConfigValue_('resendFrom') || props.getProperty(RESEND_FROM_PROP) || '').trim();
    const replyTo = String(getConfigValue_('resendReplyTo') || props.getProperty(RESEND_REPLY_TO_PROP) || '').trim();
    const endpoint = String(getConfigValue_('resendApiUrl') || 'https://api.resend.com/emails').trim();
    const enabledFlag = boolConfig_('resendEnabled', false);
    const fallbackToMailApp = boolConfig_('resendFallbackMailApp', true);
    const autoEnabled = Boolean(apiKey && from);
    const effective = getResendMailConfig_();
    return {
        resendEnabled: enabledFlag || autoEnabled,
        resendEnabledManual: enabledFlag,
        resendFallbackMailApp: fallbackToMailApp,
        resendApiUrl: endpoint,
        resendFrom: from,
        resendReplyTo: replyTo,
        apiKeyConfigured: Boolean(apiKey),
        apiKeyPreview: maskSecretPreview_(apiKey),
        autoEnabled: autoEnabled,
        effectiveEnabled: Boolean(effective.enabled),
        effectiveProvider: effective.enabled ? 'resend' : 'mailapp'
    };
}

function getCfgCorreos_() {
    const sh = ensureCorreosSheet_();
    if (!sh) return [];
    const lastRow = sh.getLastRow();
    if (lastRow < 2) return [];
    const lastCol = Math.max(5, sh.getLastColumn());
    const values = sh.getRange(1, 1, lastRow, lastCol).getValues();
    const headers = values[0] || [];
    const map = buildHeaderMap_(headers);
    const idxArea = headerIdx_(map, ['Area', 'AreaResponsable', 'Departamento']);
    let idxTo = headerIdx_(map, ['EmailTo', 'EmailTO', 'EmailIo', 'MailTo', 'To', 'CorreoTo', 'Correos', 'Emails', 'Correo']);
    let idxCc = headerIdx_(map, ['EmailCc', 'EmailCC', 'Cc', 'CorreoCc', 'ConCopia']);
    const idxActivo = headerIdx_(map, ['Activo', 'Enabled', 'Habilitado']);
    const idxNotas = headerIdx_(map, ['Notas', 'Observaciones', 'Nota']);
    if (idxTo < 0 && headers.length >= 2) idxTo = 1;
    if (idxCc < 0 && headers.length >= 3) idxCc = 2;
    const idxActivoFallback = (idxActivo < 0 && headers.length >= 4) ? 3 : idxActivo;
    const idxNotasFallback = (idxNotas < 0 && headers.length >= 5) ? 4 : idxNotas;

    const out = [];
    for (let i = 1; i < values.length; i++) {
        const r = values[i];
        const area = String(idxArea >= 0 ? r[idxArea] : r[0] || '').trim();
        const emailTo = idxTo >= 0 ? csvEmails_(r[idxTo]) : '';
        const emailCc = idxCc >= 0 ? csvEmails_(r[idxCc]) : '';
        const active = idxActivoFallback >= 0 ? parseBoolLoose_(r[idxActivoFallback], true) : true;
        const notas = String(idxNotasFallback >= 0 ? r[idxNotasFallback] : '').trim();
        if (!area && !emailTo && !emailCc && !notas) continue;
        out.push({
            row: i + 1,
            area: area,
            emailTo: emailTo,
            emailCc: emailCc,
            active: active,
            notas: notas
        });
    }
    out.sort((a, b) => String(a.area || '').localeCompare(String(b.area || '')));
    return out;
}

function defaultCfgStageSlaRow_(stageOrder) {
    const idx = Math.max(1, Number(stageOrder || 1));
    const stageName = ETAPAS_COBRO[idx - 1] || ('Etapa ' + idx);
    const legacyHours = (idx === 2 || idx === 7) ? 48 : 0;
    return {
        processKey: PROCESS_KEY_DEFAULT,
        stageOrder: idx,
        stageName: stageName,
        slaHours: legacyHours,
        active: legacyHours > 0,
        notas: legacyHours > 0 ? 'Default heredado del flujo actual.' : ''
    };
}

function invalidateStageSlaCache_() {
    cfgStageSlaRowsMemo_ = null;
    cfgStageSlaSettingsMemo_ = null;
}

function cloneStageSlaRows_(rows) {
    return (rows || []).map(r => Object.assign({}, r || {}));
}

function cloneStageSlaSettingsMap_(map) {
    const out = {};
    const src = map || {};
    Object.keys(src).forEach(k => out[k] = Object.assign({}, src[k] || {}));
    return out;
}

function ensureCfgStageSlaDefaults_() {
    const sh = ensureSheetSchema_('CFG_STAGE_SLA', CFG_SHEET_DEFS.CFG_STAGE_SLA);
    const values = sh.getDataRange().getValues();
    const byStage = {};
    for (let i = 1; i < values.length; i++) {
        const row = values[i];
        const stageOrder = Number(row[1] || 0);
        if (stageOrder < 1 || byStage[stageOrder]) continue;
        byStage[stageOrder] = {
            rowNum: i + 1,
            processKey: String(row[0] || '').trim() || PROCESS_KEY_DEFAULT,
            stageName: String(row[2] || '').trim()
        };
    }

    for (let idx = 1; idx <= ETAPAS_COBRO.length; idx++) {
        const def = defaultCfgStageSlaRow_(idx);
        const existing = byStage[idx];
        if (!existing) {
            sh.appendRow([
                def.processKey,
                def.stageOrder,
                def.stageName,
                def.slaHours,
                def.active,
                def.notas,
                new Date()
            ]);
        }
    }
    return sh;
}

function getCfgStageSla_() {
    if (cfgStageSlaRowsMemo_ && cfgStageSlaRowsMemo_.length) {
        return cloneStageSlaRows_(cfgStageSlaRowsMemo_);
    }
    const sh = ensureCfgStageSlaDefaults_();
    const values = sh.getDataRange().getValues();
    if (values.length < 2) return [];

    const byStage = {};
    for (let i = 1; i < values.length; i++) {
        const r = values[i];
        const stageOrder = Number(r[1] || 0);
        if (!stageOrder) continue;
        const def = defaultCfgStageSlaRow_(stageOrder);
        const hours = Number(r[3] || 0);
        byStage[stageOrder] = {
            row: i + 1,
            processKey: String(r[0] || def.processKey).trim() || def.processKey,
            stageOrder: stageOrder,
            stageName: def.stageName,
            areaResponsable: areaResponsablePorEtapa_(stageOrder),
            slaHours: (!isNaN(hours) && hours > 0) ? Math.round(hours) : 0,
            active: parseBoolLoose_(r[4], def.active),
            notas: String(r[5] || '').trim(),
            updatedAt: formatDateTimeSafe_(r[6])
        };
    }

    const out = Object.keys(byStage)
        .map(k => byStage[k])
        .sort((a, b) => Number(a.stageOrder || 0) - Number(b.stageOrder || 0));
    cfgStageSlaRowsMemo_ = cloneStageSlaRows_(out);
    return cloneStageSlaRows_(out);
}

function getStageSlaSettingsMap_() {
    if (cfgStageSlaSettingsMemo_) {
        return cloneStageSlaSettingsMap_(cfgStageSlaSettingsMemo_);
    }
    const defaults = {};
    for (let idx = 1; idx <= ETAPAS_COBRO.length; idx++) {
        defaults[idx] = defaultCfgStageSlaRow_(idx);
    }

    const rows = getCfgStageSla_();
    for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const idx = Number(r.stageOrder || 0);
        if (idx < 1 || idx > ETAPAS_COBRO.length) continue;
        defaults[idx] = {
            processKey: r.processKey || PROCESS_KEY_DEFAULT,
            stageOrder: idx,
            stageName: r.stageName || ETAPAS_COBRO[idx - 1],
            slaHours: Math.max(0, Number(r.slaHours || 0)),
            active: !!r.active,
            notas: r.notas || ''
        };
    }
    cfgStageSlaSettingsMemo_ = cloneStageSlaSettingsMap_(defaults);
    return cloneStageSlaSettingsMap_(defaults);
}

function getStageSlaSetting_(stageIdx) {
    const idx = Math.max(1, Number(stageIdx || 1));
    const map = getStageSlaSettingsMap_();
    return Object.assign({}, map[idx] || defaultCfgStageSlaRow_(idx));
}

function defaultCfgStageNotifyRow_(stageOrder) {
    const idx = Math.max(1, Number(stageOrder || 1));
    const stageName = ETAPAS_COBRO[idx - 1] || ('Etapa ' + idx);
    const row = {
        processKey: PROCESS_KEY_DEFAULT,
        stageOrder: idx,
        stageName: stageName,
        areaTo: '',
        ccAreas: '',
        active: idx > 1,
        notas: idx > 1 ? 'Default heredado del flujo actual.' : 'Sin notificación por defecto.'
    };

    if (idx === 2) {
        row.areaTo = AREA.PROVEEDOR_SEG;
        row.ccAreas = AREA.TRANSPORTE;
    } else if (idx === 3) {
        row.areaTo = AREA.INVENTARIO;
        row.ccAreas = AREA.TRANSPORTE;
    } else if (idx === 4) {
        row.areaTo = AREA.CYC;
        row.ccAreas = 'Supervisor';
    } else if (idx === 5) {
        row.areaTo = AREA.TRANSPORTE;
        row.ccAreas = 'Supervisor';
    } else if (idx === 6) {
        row.areaTo = AREA.FACTURACION;
        row.ccAreas = [AREA.TRANSPORTE, 'Supervisor'].join(', ');
    } else if (idx === 7) {
        row.areaTo = AREA.PROVEEDOR_SEG;
        row.ccAreas = [AREA.TRANSPORTE, AREA.FACTURACION].join(', ');
    } else if (idx === 8) {
        row.areaTo = AREA.CYC;
        row.ccAreas = 'Supervisor';
    } else if (idx === 9) {
        row.areaTo = AREA.TRANSPORTE;
        row.ccAreas = [AREA.CYC, 'Supervisor'].join(', ');
    } else if (idx === 10) {
        row.areaTo = AREA.CYC;
        row.ccAreas = [AREA.TRANSPORTE, 'Supervisor'].join(', ');
    }

    return row;
}

function invalidateStageNotifyCache_() {
    cfgStageNotifyRowsMemo_ = null;
    cfgStageNotifySettingsMemo_ = null;
}

function cloneStageNotifyRows_(rows) {
    return (rows || []).map(r => Object.assign({}, r || {}));
}

function cloneStageNotifySettingsMap_(map) {
    const out = {};
    const src = map || {};
    Object.keys(src).forEach(k => out[k] = Object.assign({}, src[k] || {}));
    return out;
}

function ensureCfgStageNotifyDefaults_() {
    const sh = ensureSheetSchema_('CFG_STAGE_NOTIFY', CFG_SHEET_DEFS.CFG_STAGE_NOTIFY);
    const values = sh.getDataRange().getValues();
    const byStage = {};
    for (let i = 1; i < values.length; i++) {
        const row = values[i];
        const stageOrder = Number(row[1] || 0);
        if (stageOrder < 1 || byStage[stageOrder]) continue;
        byStage[stageOrder] = {
            rowNum: i + 1,
            processKey: String(row[0] || '').trim() || PROCESS_KEY_DEFAULT,
            stageName: String(row[2] || '').trim()
        };
    }

    for (let idx = 1; idx <= ETAPAS_COBRO.length; idx++) {
        const def = defaultCfgStageNotifyRow_(idx);
        const existing = byStage[idx];
        if (!existing) {
            sh.appendRow([
                def.processKey,
                def.stageOrder,
                def.stageName,
                def.areaTo,
                def.ccAreas,
                def.active,
                def.notas,
                new Date()
            ]);
        }
    }
    return sh;
}

function getCfgStageNotify_() {
    if (cfgStageNotifyRowsMemo_ && cfgStageNotifyRowsMemo_.length) {
        return cloneStageNotifyRows_(cfgStageNotifyRowsMemo_);
    }
    const sh = ensureCfgStageNotifyDefaults_();
    const values = sh.getDataRange().getValues();
    if (values.length < 2) return [];

    const byStage = {};
    for (let i = 1; i < values.length; i++) {
        const r = values[i];
        const stageOrder = Number(r[1] || 0);
        if (!stageOrder) continue;
        const def = defaultCfgStageNotifyRow_(stageOrder);
        byStage[stageOrder] = {
            row: i + 1,
            processKey: String(r[0] || def.processKey).trim() || def.processKey,
            stageOrder: stageOrder,
            stageName: def.stageName,
            areaTo: String(r[3] != null ? r[3] : def.areaTo).trim(),
            ccAreas: String(r[4] != null ? r[4] : def.ccAreas).trim(),
            active: parseBoolLoose_(r[5], def.active),
            notas: String(r[6] || '').trim(),
            updatedAt: formatDateTimeSafe_(r[7])
        };
    }

    const out = Object.keys(byStage)
        .map(k => byStage[k])
        .sort((a, b) => Number(a.stageOrder || 0) - Number(b.stageOrder || 0));
    cfgStageNotifyRowsMemo_ = cloneStageNotifyRows_(out);
    return cloneStageNotifyRows_(out);
}

function getStageNotifySettingsMap_() {
    if (cfgStageNotifySettingsMemo_) {
        return cloneStageNotifySettingsMap_(cfgStageNotifySettingsMemo_);
    }
    const defaults = {};
    for (let idx = 1; idx <= ETAPAS_COBRO.length; idx++) {
        defaults[idx] = defaultCfgStageNotifyRow_(idx);
    }

    const rows = getCfgStageNotify_();
    for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const idx = Number(r.stageOrder || 0);
        if (idx < 1 || idx > ETAPAS_COBRO.length) continue;
        defaults[idx] = {
            processKey: r.processKey || PROCESS_KEY_DEFAULT,
            stageOrder: idx,
            stageName: r.stageName || ETAPAS_COBRO[idx - 1],
            areaTo: r.areaTo || '',
            ccAreas: r.ccAreas || '',
            active: !!r.active,
            notas: r.notas || ''
        };
    }

    cfgStageNotifySettingsMemo_ = cloneStageNotifySettingsMap_(defaults);
    return cloneStageNotifySettingsMap_(defaults);
}

function getStageNotifySetting_(stageIdx) {
    const idx = Math.max(1, Number(stageIdx || 1));
    const map = getStageNotifySettingsMap_();
    return Object.assign({}, map[idx] || defaultCfgStageNotifyRow_(idx));
}

function buildFlowStageCatalog_() {
    const out = [];
    for (let idx = 1; idx <= ETAPAS_COBRO.length; idx++) {
        const cfg = getStageSlaSetting_(idx);
        out.push({
            stageOrder: idx,
            stageName: ETAPAS_COBRO[idx - 1] || cfg.stageName || ('Etapa ' + idx),
            areaResponsable: areaResponsablePorEtapa_(idx),
            slaHours: Math.max(0, Number(cfg.slaHours || 0)),
            active: !!cfg.active,
            notas: String(cfg.notas || '').trim()
        });
    }
    return out;
}

function getRuleConfigData(actorEmail) {
    try {
        const guard = requireAdminForConfig_(actorEmail);
        if (!guard.success) return guard;

        ensureRuleEngineSheets_();
        return {
            success: true,
            countries: getCfgCountries_(),
            roles: getCfgRoles_(),
            stageSla: getCfgStageSla_(),
            stageNotify: getCfgStageNotify_(),
            rules: getCfgRules_(),
            authKeys: getCfgAuthKeys_(),
            correos: getCfgCorreos_(),
            mailTransport: getCfgMailTransport_(),
            etapas: ETAPAS_COBRO.slice()
        };
    } catch (err) {
        return {
            success: false,
            message: logModuleError_('la configuración de reglas', err),
            countries: [],
            roles: [],
            stageSla: [],
            stageNotify: [],
            rules: [],
            authKeys: [],
            correos: [],
            mailTransport: null,
            etapas: ETAPAS_COBRO.slice()
        };
    }
}

function saveCfgCountry(countryObj, actorEmail) {
    const guard = requireAdminForConfig_(actorEmail);
    if (!guard.success) return guard;

    const sh = ensureSheetSchema_('CFG_COUNTRY', CFG_SHEET_DEFS.CFG_COUNTRY);
    const rowNum = Number(countryObj && countryObj.row ? countryObj.row : 0);
    const countryCode = String(countryObj && countryObj.countryCode ? countryObj.countryCode : '').trim().toUpperCase();
    const name = String(countryObj && countryObj.name ? countryObj.name : '').trim();
    const currency = String(countryObj && countryObj.currency ? countryObj.currency : '').trim().toUpperCase();
    const timezone = String(countryObj && countryObj.timezone ? countryObj.timezone : '').trim();
    const locale = String(countryObj && countryObj.locale ? countryObj.locale : '').trim();
    const active = parseBoolLoose_(countryObj && countryObj.active, true);

    if (!countryCode || !name) {
        return { success: false, message: 'CountryCode y nombre son obligatorios.' };
    }
    if (countryCode.length > 10) {
        return { success: false, message: 'CountryCode excede el maximo permitido.' };
    }
    if (!normalizeCountryCode_(countryCode)) {
        return { success: false, message: 'Solo se permiten los paises SV, PE y GT.' };
    }

    const rows = sh.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
        const code = String(rows[i][0] || '').trim().toUpperCase();
        const r = i + 1;
        if (code && code === countryCode && r !== rowNum) {
            return { success: false, message: 'El country code ya existe.' };
        }
    }

    const payload = [countryCode, name, currency || 'PEN', timezone || 'America/Lima', locale || 'es-PE', active, new Date()];
    if (rowNum > 1 && rowNum <= sh.getLastRow()) {
        sh.getRange(rowNum, 1, 1, payload.length).setValues([payload]);
    } else {
        sh.appendRow(payload);
    }
    supportedCountryCatalogMemo_ = null;
    return { success: true };
}

function deleteCfgCountry(row, actorEmail) {
    const guard = requireAdminForConfig_(actorEmail);
    if (!guard.success) return guard;
    const sh = ensureSheetSchema_('CFG_COUNTRY', CFG_SHEET_DEFS.CFG_COUNTRY);
    const rowNum = Number(row || 0);
    if (rowNum < 2 || rowNum > sh.getLastRow()) return { success: false, message: 'Fila invalida.' };
    sh.deleteRow(rowNum);
    supportedCountryCatalogMemo_ = null;
    return { success: true };
}

function saveCfgRole(roleObj, actorEmail) {
    const guard = requireAdminForConfig_(actorEmail);
    if (!guard.success) return guard;

    const sh = ensureSheetSchema_('CFG_ROLE', CFG_SHEET_DEFS.CFG_ROLE);
    const rowNum = Number(roleObj && roleObj.row ? roleObj.row : 0);
    const roleName = String(roleObj && roleObj.roleName ? roleObj.roleName : '').trim();
    let roleKey = String(roleObj && roleObj.roleKey ? roleObj.roleKey : '').trim().toLowerCase();
    roleKey = roleKey.replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    const active = parseBoolLoose_(roleObj && roleObj.active, true);

    if (!roleKey || !roleName) {
        return { success: false, message: 'RoleKey y RoleName son obligatorios.' };
    }

    const rows = sh.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
        const key = String(rows[i][1] || '').trim().toLowerCase();
        const r = i + 1;
        if (key && key === roleKey && r !== rowNum) {
            return { success: false, message: 'El role key ya existe.' };
        }
    }

    let roleId = String(roleObj && roleObj.roleId ? roleObj.roleId : '').trim();
    if (!roleId) {
        roleId = 'ROL-' + Utilities.getUuid().split('-')[0].toUpperCase();
    }

    const payload = [roleId, roleKey, roleName, active, new Date()];
    if (rowNum > 1 && rowNum <= sh.getLastRow()) {
        sh.getRange(rowNum, 1, 1, payload.length).setValues([payload]);
    } else {
        sh.appendRow(payload);
    }
    return { success: true };
}

function deleteCfgRole(row, actorEmail) {
    const guard = requireAdminForConfig_(actorEmail);
    if (!guard.success) return guard;
    const sh = ensureSheetSchema_('CFG_ROLE', CFG_SHEET_DEFS.CFG_ROLE);
    const rowNum = Number(row || 0);
    if (rowNum < 2 || rowNum > sh.getLastRow()) return { success: false, message: 'Fila invalida.' };
    sh.deleteRow(rowNum);
    return { success: true };
}

function saveCfgStageSla(stageSlaObj, actorEmail) {
    const guard = requireAdminForConfig_(actorEmail);
    if (!guard.success) return guard;

    const sh = ensureCfgStageSlaDefaults_();
    const rowNum = Number(stageSlaObj && stageSlaObj.row ? stageSlaObj.row : 0);
    const stageOrder = Number(stageSlaObj && stageSlaObj.stageOrder ? stageSlaObj.stageOrder : 0);
    const def = defaultCfgStageSlaRow_(stageOrder);
    const stageName = ETAPAS_COBRO[stageOrder - 1] || def.stageName;
    let slaHours = Number(stageSlaObj && stageSlaObj.slaHours != null ? stageSlaObj.slaHours : 0);
    if (isNaN(slaHours) || slaHours < 0) slaHours = 0;
    slaHours = Math.round(slaHours);
    const active = parseBoolLoose_(stageSlaObj && stageSlaObj.active, slaHours > 0);
    const notas = String(stageSlaObj && stageSlaObj.notas ? stageSlaObj.notas : '').trim();

    if (!stageOrder || stageOrder < 1 || stageOrder > ETAPAS_COBRO.length) {
        return { success: false, message: 'Etapa invalida.' };
    }
    if (active && slaHours <= 0) {
        return { success: false, message: 'Ingrese SLA en horas mayor a 0 o desactive la etapa.' };
    }

    const values = sh.getDataRange().getValues();
    const sameStageRows = [];
    let targetRow = rowNum;
    for (let i = 1; i < values.length; i++) {
        const existingStage = Number(values[i][1] || 0);
        const existingRow = i + 1;
        if (existingStage === stageOrder) {
            sameStageRows.push(existingRow);
        }
    }
    if (sameStageRows.length) targetRow = sameStageRows[0];

    const payload = [
        PROCESS_KEY_DEFAULT,
        stageOrder,
        stageName,
        slaHours > 0 ? slaHours : 0,
        active,
        notas,
        new Date()
    ];

    if (targetRow > 1 && targetRow <= sh.getLastRow()) {
        sh.getRange(targetRow, 1, 1, payload.length).setValues([payload]);
    } else {
        sh.appendRow(payload);
        targetRow = sh.getLastRow();
    }

    if (sameStageRows.length > 1) {
        deleteRowsDescending_(sh, sameStageRows.filter(r => r !== targetRow));
    }
    invalidateStageSlaCache_();
    return { success: true };
}

function saveCfgStageNotify(stageNotifyObj, actorEmail) {
    const guard = requireAdminForConfig_(actorEmail);
    if (!guard.success) return guard;

    const sh = ensureCfgStageNotifyDefaults_();
    const rowNum = Number(stageNotifyObj && stageNotifyObj.row ? stageNotifyObj.row : 0);
    const stageOrder = Number(stageNotifyObj && stageNotifyObj.stageOrder ? stageNotifyObj.stageOrder : 0);
    const def = defaultCfgStageNotifyRow_(stageOrder);
    const stageName = ETAPAS_COBRO[stageOrder - 1] || def.stageName;
    const areaToRaw = String(stageNotifyObj && stageNotifyObj.areaTo != null ? stageNotifyObj.areaTo : '').trim();
    const ccAreasRaw = String(stageNotifyObj && stageNotifyObj.ccAreas != null ? stageNotifyObj.ccAreas : '').trim();
    const active = parseBoolLoose_(stageNotifyObj && stageNotifyObj.active, def.active);
    const notas = String(stageNotifyObj && stageNotifyObj.notas ? stageNotifyObj.notas : '').trim();

    if (!stageOrder || stageOrder < 1 || stageOrder > ETAPAS_COBRO.length) {
        return { success: false, message: 'Etapa invalida.' };
    }

    const areaTo = normalizeAreaList_(areaToRaw);
    const ccAreas = normalizeAreaList_(ccAreasRaw);

    const values = sh.getDataRange().getValues();
    const sameStageRows = [];
    let targetRow = rowNum;
    for (let i = 1; i < values.length; i++) {
        const existingStage = Number(values[i][1] || 0);
        const existingRow = i + 1;
        if (existingStage === stageOrder) {
            sameStageRows.push(existingRow);
        }
    }
    if (sameStageRows.length) targetRow = sameStageRows[0];

    const payload = [
        PROCESS_KEY_DEFAULT,
        stageOrder,
        stageName,
        areaTo,
        ccAreas,
        active,
        notas,
        new Date()
    ];

    if (targetRow > 1 && targetRow <= sh.getLastRow()) {
        sh.getRange(targetRow, 1, 1, payload.length).setValues([payload]);
    } else {
        sh.appendRow(payload);
        targetRow = sh.getLastRow();
    }

    if (sameStageRows.length > 1) {
        deleteRowsDescending_(sh, sameStageRows.filter(r => r !== targetRow));
    }
    invalidateStageNotifyCache_();
    return { success: true };
}

function saveCfgRule(ruleObj, actorEmail) {
    const guard = requireAdminForConfig_(actorEmail);
    if (!guard.success) return guard;

    const sh = ensureSheetSchema_('CFG_RULE', CFG_SHEET_DEFS.CFG_RULE);
    const rowNum = Number(ruleObj && ruleObj.row ? ruleObj.row : 0);
    const name = String(ruleObj && ruleObj.name ? ruleObj.name : '').trim();
    const processKey = String(ruleObj && ruleObj.processKey ? ruleObj.processKey : PROCESS_KEY_DEFAULT).trim() || PROCESS_KEY_DEFAULT;
    const priority = Number(ruleObj && ruleObj.priority != null ? ruleObj.priority : 100);
    const countryScope = String(ruleObj && ruleObj.countryScope ? ruleObj.countryScope : '*').trim() || '*';
    let stageFrom = Number(ruleObj && ruleObj.stageFrom != null ? ruleObj.stageFrom : 1);
    let stageTo = Number(ruleObj && ruleObj.stageTo != null ? ruleObj.stageTo : ETAPAS_COBRO.length);
    const triggerEvent = String(ruleObj && ruleObj.triggerEvent ? ruleObj.triggerEvent : 'STAGE_ENTER').trim() || 'STAGE_ENTER';
    const conditionJson = String(ruleObj && ruleObj.conditionJson ? ruleObj.conditionJson : '').trim();
    const actionJson = String(ruleObj && ruleObj.actionJson ? ruleObj.actionJson : '').trim();
    const stopOnMatch = parseBoolLoose_(ruleObj && ruleObj.stopOnMatch, true);
    const active = parseBoolLoose_(ruleObj && ruleObj.active, true);
    const validFrom = parseDateInputSafe_(ruleObj && ruleObj.validFrom);
    const validTo = parseDateInputSafe_(ruleObj && ruleObj.validTo);

    if (!name) return { success: false, message: 'El nombre de la regla es obligatorio.' };
    if (isNaN(priority)) return { success: false, message: 'Prioridad invalida.' };
    if (isNaN(stageFrom) || stageFrom < 1) stageFrom = 1;
    if (isNaN(stageTo) || stageTo < 1) stageTo = ETAPAS_COBRO.length;
    if (stageTo < stageFrom) return { success: false, message: 'StageTo no puede ser menor que StageFrom.' };

    if (conditionJson) {
        try { JSON.parse(conditionJson); } catch (e) { return { success: false, message: 'ConditionJson no es JSON valido.' }; }
    }
    if (actionJson) {
        try { JSON.parse(actionJson); } catch (e) { return { success: false, message: 'ActionJson no es JSON valido.' }; }
    }

    let ruleId = String(ruleObj && ruleObj.ruleId ? ruleObj.ruleId : '').trim();
    if (!ruleId) {
        ruleId = 'RULE-' + Utilities.getUuid().split('-')[0].toUpperCase();
    }

    const payload = [
        ruleId,
        name,
        processKey,
        priority,
        countryScope.toUpperCase(),
        stageFrom,
        stageTo,
        triggerEvent,
        conditionJson || '{}',
        actionJson || '{}',
        stopOnMatch,
        active,
        validFrom || '',
        validTo || '',
        new Date()
    ];

    if (rowNum > 1 && rowNum <= sh.getLastRow()) {
        sh.getRange(rowNum, 1, 1, payload.length).setValues([payload]);
    } else {
        sh.appendRow(payload);
    }
    return { success: true };
}

function deleteCfgRule(row, actorEmail) {
    const guard = requireAdminForConfig_(actorEmail);
    if (!guard.success) return guard;
    const sh = ensureSheetSchema_('CFG_RULE', CFG_SHEET_DEFS.CFG_RULE);
    const rowNum = Number(row || 0);
    if (rowNum < 2 || rowNum > sh.getLastRow()) return { success: false, message: 'Fila invalida.' };
    sh.deleteRow(rowNum);
    return { success: true };
}

function saveCfgAuthKey(authKeyObj, actorEmail) {
    const guard = requireAdminForConfig_(actorEmail);
    if (!guard.success) return guard;

    const sh = ensureSheetSchema_('CFG_AUTH_KEY', CFG_SHEET_DEFS.CFG_AUTH_KEY);
    const rowNum = Number(authKeyObj && authKeyObj.row ? authKeyObj.row : 0);
    const name = String(authKeyObj && authKeyObj.name ? authKeyObj.name : '').trim();
    const scope = normalizeAuthKeyScope_(authKeyObj && authKeyObj.scope);
    const active = parseBoolLoose_(authKeyObj && authKeyObj.active, true);
    const secret = String(authKeyObj && authKeyObj.secret ? authKeyObj.secret : '').trim();
    const notas = String(authKeyObj && authKeyObj.notas ? authKeyObj.notas : '').trim();
    let maxUsos = Number(authKeyObj && authKeyObj.maxUsos != null ? authKeyObj.maxUsos : 0);
    if (isNaN(maxUsos) || maxUsos < 0) maxUsos = 0;

    if (!name) return { success: false, message: 'El nombre de la clave es obligatorio.' };

    let keyId = String(authKeyObj && authKeyObj.keyId ? authKeyObj.keyId : '').trim().toUpperCase();
    if (!keyId) keyId = 'AUTH-' + Utilities.getUuid().split('-')[0].toUpperCase();

    const values = sh.getDataRange().getValues();
    let currentHash = '';
    let usosActuales = 0;
    let ultimoUsoAt = '';
    for (let i = 1; i < values.length; i++) {
        const r = values[i];
        const existingId = String(r[0] || '').trim().toUpperCase();
        const existingRow = i + 1;
        if (existingId && existingId === keyId && existingRow !== rowNum) {
            return { success: false, message: 'El Key ID ya existe.' };
        }
        if (existingRow === rowNum) {
            currentHash = String(r[2] || '').trim();
            usosActuales = Number(r[6] || 0);
            ultimoUsoAt = r[7] || '';
        }
    }

    if (!secret && !currentHash) {
        return { success: false, message: 'Debe ingresar una clave para crear el registro.' };
    }
    if (secret && secret.length < 4) {
        return { success: false, message: 'La clave debe tener al menos 4 caracteres.' };
    }

    const payload = [
        keyId,
        name,
        secret ? hashPassword_(secret) : currentHash,
        scope,
        active,
        maxUsos > 0 ? maxUsos : 0,
        usosActuales > 0 ? usosActuales : 0,
        ultimoUsoAt || '',
        notas,
        new Date()
    ];

    if (rowNum > 1 && rowNum <= sh.getLastRow()) {
        sh.getRange(rowNum, 1, 1, payload.length).setValues([payload]);
    } else {
        sh.appendRow(payload);
    }
    return { success: true, keyId: keyId };
}

function deleteCfgAuthKey(row, actorEmail) {
    const guard = requireAdminForConfig_(actorEmail);
    if (!guard.success) return guard;
    const sh = ensureSheetSchema_('CFG_AUTH_KEY', CFG_SHEET_DEFS.CFG_AUTH_KEY);
    const rowNum = Number(row || 0);
    if (rowNum < 2 || rowNum > sh.getLastRow()) return { success: false, message: 'Fila invalida.' };
    sh.deleteRow(rowNum);
    return { success: true };
}

function isProtectedCorreoArea_(areaName) {
    const key = normalizeKey_(normalizeAreaName_(areaName));
    if (!key) return false;
    const base = [
        AREA.LI,
        AREA.TRANSPORTE,
        AREA.INVENTARIO,
        AREA.CYC,
        AREA.FACTURACION,
        AREA.CONTABILIDAD,
        AREA.PROVEEDOR_SEG,
        'Supervisor',
        'Administrador'
    ];
    for (let i = 0; i < base.length; i++) {
        const bKey = normalizeKey_(normalizeAreaName_(base[i]));
        if (bKey && bKey === key) return true;
    }
    return false;
}

function saveCfgCorreo(correoObj, actorEmail) {
    const guard = requireAdminForConfig_(actorEmail);
    if (!guard.success) return guard;

    const sh = ensureCorreosSheet_();
    if (!sh) return { success: false, message: 'No se encontró la hoja Correos.' };

    const rowNum = Number(correoObj && correoObj.row ? correoObj.row : 0);
    const areaRaw = String(correoObj && correoObj.area ? correoObj.area : '').trim();
    const area = normalizeAreaName_(areaRaw) || areaRaw;
    const emailToRaw = String(correoObj && correoObj.emailTo ? correoObj.emailTo : '').trim();
    const emailCcRaw = String(correoObj && correoObj.emailCc ? correoObj.emailCc : '').trim();
    const emailTo = csvEmails_(emailToRaw);
    const emailCc = csvEmails_(emailCcRaw);
    const active = parseBoolLoose_(correoObj && correoObj.active, true);
    const notas = String(correoObj && correoObj.notas ? correoObj.notas : '').trim();

    if (!area) return { success: false, message: 'El área es obligatoria.' };

    if (emailTo && splitEmails_(emailTo).some(function (mail) { return mail.indexOf('@') < 0; })) {
        return { success: false, message: 'EmailTo contiene un correo inválido.' };
    }
    if (emailCc && splitEmails_(emailCc).some(function (mail) { return mail.indexOf('@') < 0; })) {
        return { success: false, message: 'EmailCc contiene un correo inválido.' };
    }

    const lastRow = sh.getLastRow();
    const lastCol = Math.max(5, sh.getLastColumn());
    const values = lastRow > 0 ? sh.getRange(1, 1, lastRow, lastCol).getValues() : [];
    const headers = values[0] || [];
    const map = buildHeaderMap_(headers);
    const idxArea = headerIdx_(map, ['Area', 'AreaResponsable', 'Departamento']);
    let idxTo = headerIdx_(map, ['EmailTo', 'EmailTO', 'EmailIo', 'MailTo', 'To', 'CorreoTo', 'Correos', 'Emails', 'Correo']);
    let idxCc = headerIdx_(map, ['EmailCc', 'EmailCC', 'Cc', 'CorreoCc', 'ConCopia']);
    const idxActivo = headerIdx_(map, ['Activo', 'Enabled', 'Habilitado']);
    const idxNotas = headerIdx_(map, ['Notas', 'Observaciones', 'Nota']);
    if (idxTo < 0 && headers.length >= 2) idxTo = 1;
    if (idxCc < 0 && headers.length >= 3) idxCc = 2;
    const idxActivoFallback = (idxActivo < 0 && headers.length >= 4) ? 3 : idxActivo;
    const idxNotasFallback = (idxNotas < 0 && headers.length >= 5) ? 4 : idxNotas;

    let targetRow = (rowNum >= 2 && rowNum <= lastRow) ? rowNum : 0;
    if (!targetRow) {
        const areaKey = normalizeKey_(normalizeAreaName_(area));
        for (let i = 1; i < values.length; i++) {
            const r = values[i];
            const areaRow = normalizeKey_(normalizeAreaName_(idxArea >= 0 ? r[idxArea] : r[0]));
            if (areaKey && areaRow === areaKey) {
                targetRow = i + 1;
                break;
            }
        }
    }

    const rowPayload = new Array(lastCol).fill('');
    const areaCol = idxArea >= 0 ? idxArea : 0;
    const toCol = idxTo >= 0 ? idxTo : 1;
    const ccCol = idxCc >= 0 ? idxCc : 2;
    const activeCol = idxActivoFallback >= 0 ? idxActivoFallback : 3;
    const notasCol = idxNotasFallback >= 0 ? idxNotasFallback : 4;

    rowPayload[areaCol] = area;
    rowPayload[toCol] = emailTo;
    rowPayload[ccCol] = emailCc;
    rowPayload[activeCol] = active;
    rowPayload[notasCol] = notas;

    if (targetRow >= 2 && targetRow <= lastRow) {
        const existing = values[targetRow - 1] || new Array(lastCol).fill('');
        existing[areaCol] = rowPayload[areaCol];
        existing[toCol] = rowPayload[toCol];
        existing[ccCol] = rowPayload[ccCol];
        existing[activeCol] = rowPayload[activeCol];
        existing[notasCol] = rowPayload[notasCol];
        sh.getRange(targetRow, 1, 1, lastCol).setValues([existing]);
    } else {
        sh.getRange(lastRow + 1, 1, 1, lastCol).setValues([rowPayload]);
    }
    return { success: true, correos: getCfgCorreos_() };
}

function deleteCfgCorreo(row, actorEmail) {
    const guard = requireAdminForConfig_(actorEmail);
    if (!guard.success) return guard;
    const sh = ensureCorreosSheet_();
    if (!sh) return { success: false, message: 'No se encontró la hoja Correos.' };
    const rowNum = Number(row || 0);
    if (rowNum < 2 || rowNum > sh.getLastRow()) return { success: false, message: 'Fila invalida.' };
    const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0] || [];
    const map = buildHeaderMap_(headers);
    const idxArea = headerIdx_(map, ['Area', 'AreaResponsable', 'Departamento']);
    const area = String(sh.getRange(rowNum, (idxArea >= 0 ? idxArea + 1 : 1)).getValue() || '').trim();
    if (isProtectedCorreoArea_(area)) {
        return { success: false, message: 'No se puede eliminar un área base del sistema.' };
    }
    sh.deleteRow(rowNum);
    return { success: true, correos: getCfgCorreos_() };
}

function saveMailTransportConfig(mailObj, actorEmail) {
    const guard = requireAdminForConfig_(actorEmail);
    if (!guard.success) return guard;

    const props = PropertiesService.getScriptProperties();
    const enabled = parseBoolLoose_(mailObj && mailObj.resendEnabled, false);
    const fallbackToMailApp = parseBoolLoose_(mailObj && mailObj.resendFallbackMailApp, true);
    const from = String(mailObj && mailObj.resendFrom ? mailObj.resendFrom : '').trim();
    const replyTo = csvEmails_(mailObj && mailObj.resendReplyTo ? mailObj.resendReplyTo : '');
    const endpoint = String(mailObj && mailObj.resendApiUrl ? mailObj.resendApiUrl : 'https://api.resend.com/emails').trim() || 'https://api.resend.com/emails';
    const apiKey = String(mailObj && mailObj.apiKey ? mailObj.apiKey : '').trim();
    const clearApiKey = parseBoolLoose_(mailObj && mailObj.clearApiKey, false);

    if (from && from.indexOf('@') < 0) {
        return { success: false, message: 'El remitente (From) debe contener un correo válido.' };
    }
    if (replyTo && splitEmails_(replyTo).some(function (mail) { return mail.indexOf('@') < 0; })) {
        return { success: false, message: 'Reply-To contiene un correo inválido.' };
    }
    if (!/^https:\/\/api\.resend\.com\/.+/i.test(endpoint)) {
        return { success: false, message: 'El endpoint debe iniciar con https://api.resend.com/.' };
    }

    setConfigValue_('resendEnabled', enabled ? 'true' : 'false');
    setConfigValue_('resendFallbackMailApp', fallbackToMailApp ? 'true' : 'false');
    if (from) {
        setConfigValue_('resendFrom', from);
        props.setProperty(RESEND_FROM_PROP, from);
    } else {
        deleteConfigValue_('resendFrom');
        props.deleteProperty(RESEND_FROM_PROP);
    }
    if (replyTo) {
        setConfigValue_('resendReplyTo', replyTo);
        props.setProperty(RESEND_REPLY_TO_PROP, replyTo);
    } else {
        deleteConfigValue_('resendReplyTo');
        props.deleteProperty(RESEND_REPLY_TO_PROP);
    }
    if (endpoint) setConfigValue_('resendApiUrl', endpoint);
    else deleteConfigValue_('resendApiUrl');

    if (apiKey) {
        props.setProperty(RESEND_API_KEY_PROP, apiKey);
    } else if (clearApiKey) {
        props.deleteProperty(RESEND_API_KEY_PROP);
    }
    // Seguridad: si dejaron una API key legacy en la hoja Config, se elimina.
    deleteConfigValue_('resendApiKey');

    return {
        success: true,
        mailTransport: getCfgMailTransport_(),
        message: 'Configuración de Resend actualizada.'
    };
}

function validarMailTransportConfig(actorEmail) {
    const guard = requireAdminForConfig_(actorEmail);
    if (!guard.success) return guard;
    const res = validarConexionResend();
    res.mailTransport = getCfgMailTransport_();
    return res;
}

function testMailTransportConfig(destino, actorEmail) {
    const guard = requireAdminForConfig_(actorEmail);
    if (!guard.success) return guard;
    const res = testResendSend(destino);
    res.mailTransport = getCfgMailTransport_();
    return res;
}

/**
 * ============================================================================
 * âœ… PATCH GESTIÃ“N: HELPERS
 * ============================================================================
 */

function getEtapasCobro() {
    return ETAPAS_COBRO;
}

function normalizeEtapa_(raw) {
    const v = String(raw || '').trim();
    if (!v) return ETAPAS_COBRO[0];
    if (v.toLowerCase() === 'solicitud') return ETAPAS_COBRO[0];

    // Si ya coincide exacto
    if (ETAPAS_COBRO.indexOf(v) >= 0) return v;
    const low = v.toLowerCase();
    if (low.includes('aplicar debitacion')) return ETAPAS_COBRO[ETAPAS_COBRO.length - 1];

    // Intentar por nÃºmero al inicio "3." etc.
    const m = v.match(/^(\d+)\./);
    if (m) {
        const n = Number(m[1]);
        if (n === 11) return ETAPAS_COBRO[ETAPAS_COBRO.length - 1];
        if (n >= 1 && n <= ETAPAS_COBRO.length) return ETAPAS_COBRO[n - 1];
    }
    return ETAPAS_COBRO[0];
}

function etapaIndex_(etapa) {
    const e = normalizeEtapa_(etapa);
    const idx = ETAPAS_COBRO.indexOf(e);
    return (idx >= 0) ? (idx + 1) : 1;
}

function previousEtapaCobro_(etapa) {
    const idx = etapaIndex_(etapa);
    if (idx <= 1) return '';
    return ETAPAS_COBRO[idx - 2] || '';
}

function resolveObservedSourceEtapa_(storedEtapa, etapaActual) {
    const current = normalizeEtapa_(etapaActual);
    const storedTxt = String(storedEtapa || '').trim();
    if (!storedTxt) return current;

    const stored = normalizeEtapa_(storedTxt);
    const prevOfCurrent = previousEtapaCobro_(current);
    const prevOfStored = previousEtapaCobro_(stored);

    if (prevOfStored && prevOfStored === current) return stored;
    if (stored === prevOfCurrent) return current;
    if (stored === current) return current;
    return stored;
}

function resolveObservedReturnEtapa_(storedEtapa, etapaActual) {
    const current = normalizeEtapa_(etapaActual);
    const storedTxt = String(storedEtapa || '').trim();
    if (!storedTxt) return current;

    const stored = normalizeEtapa_(storedTxt);
    const prevOfCurrent = previousEtapaCobro_(current);
    const prevOfStored = previousEtapaCobro_(stored);

    if (prevOfStored && prevOfStored === current) return current;
    if (stored === prevOfCurrent) return stored;
    if (stored === current) return prevOfCurrent || current;
    return prevOfCurrent || current;
}

function resolveObservedResponsibleArea_(estado, etapaActual, storedEtapa, areaActual) {
    const currentArea = String(areaActual || '').trim();
    if (currentArea) return currentArea;
    if (normalizeEstado_(estado) !== 'Observado') return areaResponsablePorEtapa_(etapaIndex_(etapaActual));
    const etapaDestino = resolveObservedReturnEtapa_(storedEtapa, etapaActual);
    if (!etapaDestino) return currentArea;
    return areaResponsablePorEtapa_(etapaIndex_(etapaDestino)) || currentArea;
}

function progresoEtapa_(etapa) {
    const idx = etapaIndex_(etapa);
    return Math.round((idx / ETAPAS_COBRO.length) * 100); // 1/9=11%
}

function macroEstadoPorEtapaIdx_(idx) {
    if (idx <= 1) return 'Abierto';
    if (idx === 2 || idx === 7) return 'En firma';
    if (idx > ETAPAS_COBRO.length) return 'Cerrado';
    return 'En proceso';
}

function normalizeEstado_(raw) {
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

function estadoPorEtapa_(etapa, estadoActual) {
    const actual = normalizeEstado_(estadoActual);
    if (actual === 'Observado') return 'Observado';
    if (actual === 'Anulado') return 'Anulado';
    return macroEstadoPorEtapaIdx_(etapaIndex_(etapa));
}

function areaResponsablePorEtapa_(idx) {
    if (idx === 1) return AREA.LI;
    if (idx === 2) return AREA.PROVEEDOR_SEG;
    if (idx === 3) return AREA.INVENTARIO;
    if (idx === 4) return AREA.CYC;
    if (idx === 5) return AREA.TRANSPORTE;
    if (idx === 6) return AREA.FACTURACION;
    if (idx === 7) return AREA.PROVEEDOR_SEG;
    if (idx === 8) return AREA.CYC;
    if (idx === 9) return AREA.TRANSPORTE;
    if (idx === 10) return AREA.CYC;
    return AREA.LI;
}

function addHours_(dt, h) {
    const d = new Date(dt || new Date());
    return new Date(d.getTime() + (Number(h || 0) * 60 * 60 * 1000));
}

function formatDDMM_(dt) {
    if (!dt) return '';
    return Utilities.formatDate(new Date(dt), Session.getScriptTimeZone(), 'dd/MM');
}

function formatDateTimeSafe_(v) {
    if (!v) return '';
    const d = new Date(v);
    if (isNaN(d.getTime())) return String(v || '');
    return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
}

function sanitizeUploadName_(rawName, fallbackBase) {
    const base = String(rawName || '').trim() || String(fallbackBase || 'archivo');
    const safe = base
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9._-]+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
    return safe || 'archivo';
}

function parseDataUrl_(raw, fallbackMime) {
    const txt = String(raw || '').trim();
    const m = txt.match(/^data:([^;]+);base64,(.+)$/);
    if (m) {
        return {
            mimeType: String(m[1] || '').trim().toLowerCase(),
            b64: String(m[2] || '')
        };
    }
    // Permite base64 directo (sin prefijo data:), usando mime fallback.
    if (txt && /^[a-zA-Z0-9+/=\s]+$/.test(txt)) {
        return {
            mimeType: String(fallbackMime || '').trim().toLowerCase(),
            b64: txt.replace(/\s+/g, '')
        };
    }
    return null;
}

function isAllowedSignedBoletaMime_(mime) {
    const m = String(mime || '').toLowerCase();
    return m === 'application/pdf';
}

function uploadSignedBoletaAllowed_(profile) {
    if (profile.canForce) return true;
    const k = profile.areaKey;
    return (
        k === areaKey_(AREA.TRANSPORTE) ||
        k === areaKey_(AREA.LI)
    );
}

function uploadFieldAllowed_(profile, fieldName) {
    if (profile.canForce) return true;
    const f = String(fieldName || '').trim();
    if (!f) return false;
    const k = normalizeKey_(f);
    if (k === normalizeKey_(WF.firmaBoletaUrl) || k === normalizeKey_(WF.boletaFirmadaUrl)) {
        return uploadSignedBoletaAllowed_(profile) || canEditField_(profile, WF.firmaBoletaUrl) || canEditField_(profile, WF.boletaFirmadaUrl);
    }
    return canEditField_(profile, f);
}

function fieldUploadLabel_(fieldName) {
    const k = normalizeKey_(fieldName);
    if (k === normalizeKey_(WF.firmaBoletaUrl) || k === normalizeKey_(WF.boletaFirmadaUrl)) return 'boleta firmada';
    if (k === normalizeKey_(WF.facturaUrl)) return 'factura';
    if (k === normalizeKey_(WF.firmaFacturaUrl)) return 'firma factura';
    if (k === normalizeKey_(WF.constanciaPagoUrl)) return 'constancia de pago';
    return 'documento';
}

function resumenIncidencia_(itemsJson) {
    try {
        let arr = itemsJson;
        if (typeof arr === 'string') arr = JSON.parse(arr || '[]');
        if (typeof arr === 'string') arr = JSON.parse(arr || '[]'); // compat registros legacy doble-stringify
        if (!Array.isArray(arr) || !arr.length) return 'Conforme';

        const mapPlural = { 'Faltante': 'Faltantes', 'Dañado': 'Dañados', 'DaÃ±ado': 'Dañados', 'Cruzado': 'Cruzados', 'Conforme': 'Conforme' };
        const set = {};
        arr.forEach(it => {
            const inc = String(it.incidencia || 'Conforme').trim();
            if (inc && inc !== 'Conforme') set[inc] = true;
        });
        const keys = Object.keys(set);
        if (!keys.length) return 'Conforme';
        return keys.map(k => mapPlural[k] || k).join(' / ');
    } catch (e) {
        return 'Conforme';
    }
}

function extractDriveFileId_(url) {
    const u = String(url || '');
    if (!u) return '';
    // file/d/ID
    let m = u.match(/\/d\/([a-zA-Z0-9_-]{20,})/);
    if (m && m[1]) return m[1];
    // open?id=ID
    m = u.match(/[?&]id=([a-zA-Z0-9_-]{20,})/);
    if (m && m[1]) return m[1];
    return '';
}

function findRowById_(sh, id) {
    const lastRow = sh.getLastRow();
    if (lastRow < 2) return 0;
    const ids = sh.getRange(2, 1, lastRow - 1, 1).getValues();
    for (let i = 0; i < ids.length; i++) {
        if (String(ids[i][0]) === String(id)) return i + 2; // row real
    }
    return 0;
}

function deleteRowsDescending_(sh, rowNums) {
    const uniq = {};
    const rows = (rowNums || [])
        .map(r => Number(r || 0))
        .filter(r => r >= 2 && !uniq[r] && (uniq[r] = true))
        .sort((a, b) => b - a);
    for (let i = 0; i < rows.length; i++) {
        sh.deleteRow(rows[i]);
    }
    return rows.length;
}

function findRowsByValueInColumn_(sh, colNum, expected) {
    if (!sh || sh.getLastRow() < 2) return [];
    const col = Math.max(1, Number(colNum || 1));
    const values = sh.getRange(2, col, sh.getLastRow() - 1, 1).getValues();
    const out = [];
    for (let i = 0; i < values.length; i++) {
        if (String(values[i][0] || '') === String(expected || '')) out.push(i + 2);
    }
    return out;
}

function ensureAprobacionesSchema_(sh) {
    if (!sh) return { headers: [], map: {} };
    const lastColBase = Math.max(1, sh.getLastColumn());
    let headers = sh.getRange(1, 1, 1, lastColBase).getValues()[0] || [];
    let map = buildHeaderMap_(headers);
    let col = lastColBase;

    for (let i = 0; i < WF_REQUIRED_HEADERS.length; i++) {
        const h = WF_REQUIRED_HEADERS[i];
        const k = normalizeKey_(h);
        if (map[k] != null) continue;
        col += 1;
        sh.getRange(1, col).setValue(h);
        headers.push(h);
        map[k] = col - 1;
    }
    return { headers, map };
}

function headerIdx_(headerMap, names) {
    const arr = names || [];
    for (let i = 0; i < arr.length; i++) {
        const idx = headerMap[normalizeKey_(arr[i])];
        if (idx != null) return idx;
    }
    return -1;
}

function rowVal_(row, headerMap, names) {
    const idx = headerIdx_(headerMap, names);
    if (idx < 0) return '';
    return row[idx];
}

function rowText_(row, headerMap, names) {
    return String(rowVal_(row, headerMap, names) || '').trim();
}

function rowDate_(row, headerMap, names) {
    const v = rowVal_(row, headerMap, names);
    if (!v) return null;
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
}

function writeRowFields_(sh, rowNum, headerMap, updates) {
    const keys = Object.keys(updates || {});
    if (!keys.length) return;

    const lastCol = sh.getLastColumn ? sh.getLastColumn() : Object.keys(headerMap).length;
    const range = sh.getRange(rowNum, 1, 1, lastCol);
    const rowValues = (range.getValues()[0] || []).slice();

    let modified = false;
    for (let i = 0; i < keys.length; i++) {
        const header = keys[i];
        const idx = headerMap[normalizeKey_(header)];
        if (idx == null) continue;
        rowValues[idx] = updates[header];
        modified = true;
    }

    if (!modified) return;
    range.setValues([rowValues]);
}

function applyRowUpdatesToRow_(row, headerMap, updates) {
    const keys = Object.keys(updates || {});
    for (let i = 0; i < keys.length; i++) {
        const header = keys[i];
        const idx = headerMap[normalizeKey_(header)];
        if (idx == null) continue;
        row[idx] = updates[header];
    }
    return row;
}

function getUserProfile_(email) {
    const out = {
        email: String(email || '').trim().toLowerCase(),
        nombre: '',
        rol: '',
        area: '',
        areaKey: '',
        countryCode: '',
        countryName: '',
        isAdmin: false,
        isSupervisor: false,
        canForce: false
    };
    if (!out.email) return out;

    const cacheKey = 'user-profile:' + out.email;
    const cached = cacheGetJson_(cacheKey);
    if (cached && cached.email === out.email) {
        return Object.assign(out, cached);
    }

    const user = findUserRecordByEmail_(out.email);
    if (!user) return out;

    const rol = normalizeRole_(user.rol || '');
    const area = String(user.area || '').trim() || inferAreaFromRole_(rol);
    out.nombre = String(user.nombre || '');
    out.rol = rol;
    out.area = area;
    out.areaKey = areaKey_(area || inferAreaFromRole_(rol));
    out.countryCode = String(user.countryCode || '').trim().toUpperCase();
    out.countryName = String(user.countryName || '').trim();
    out.isAdmin = rol === 'admin';
    out.isSupervisor = rol === 'supervisor';
    out.canForce = out.isAdmin || out.isSupervisor;
    cachePutJson_(cacheKey, Object.assign({}, out), 120);
    return out;
}

function actorCountryFilterEnabled_(profile) {
    return !!(profile && String(profile.email || '').trim() && normalizeCountryCode_(profile.countryCode));
}

function resolveAprobacionCountryCode_(row, headerMap) {
    const stored = normalizeCountryCode_(rowText_(row, headerMap || {}, [WF.countryCode]));
    if (stored) return stored;
    const responsable = String((row && row[14]) || '').trim();
    const inferred = normalizeCountryCode_(inferCountryCodeFromResponsable_(responsable));
    return inferred || DEFAULT_COUNTRY_CODE;
}

function actorCanAccessAprobacionRow_(profile, row, headerMap) {
    if (!actorCountryFilterEnabled_(profile)) return true;
    return resolveAprobacionCountryCode_(row, headerMap) === normalizeCountryCode_(profile.countryCode);
}

function ensureActorCanAccessAprobacionRow_(profile, row, headerMap) {
    const rowCountryCode = resolveAprobacionCountryCode_(row, headerMap);
    if (actorCanAccessAprobacionRow_(profile, row, headerMap)) {
        return { ok: true, countryCode: rowCountryCode };
    }
    const actorCountryCode = normalizeCountryCode_(profile && profile.countryCode);
    return {
        ok: false,
        countryCode: rowCountryCode,
        message: actorCountryCode
            ? ('No tiene acceso a este cobro fuera del entorno ' + actorCountryCode + '.')
            : 'No tiene acceso a este entorno.'
    };
}

function transitionRuleAreas_(fromIdx, toIdx) {
    const k = String(fromIdx) + '>' + String(toIdx);
    const map = {
        '1>2': [areaKey_(AREA.LI)],
        '2>3': [areaKey_(AREA.TRANSPORTE)],
        '3>4': [areaKey_(AREA.INVENTARIO)],
        '4>5': [areaKey_(AREA.CYC)],
        '5>6': [areaKey_(AREA.TRANSPORTE)],
        '6>7': [areaKey_(AREA.FACTURACION)],
        '7>8': [areaKey_(AREA.TRANSPORTE)],
        '8>9': [areaKey_(AREA.CYC)],
        '9>10': [areaKey_(AREA.TRANSPORTE)]
    };
    return map[k] || [];
}

function canMoveTransition_(profile, fromIdx, toIdx) {
    if (profile.canForce) return { ok: true };
    const allowed = transitionRuleAreas_(fromIdx, toIdx);
    if (!allowed.length) return { ok: false, message: 'Transicion no permitida: ' + fromIdx + ' -> ' + toIdx + '.' };
    if (allowed.indexOf(profile.areaKey) >= 0) return { ok: true };
    return { ok: false, message: 'No tiene permisos para mover ' + fromIdx + ' -> ' + toIdx + '.' };
}

function canEditField_(profile, fieldName) {
    if (profile.canForce) return true;
    const key = normalizeKey_(fieldName);

    const editableByArea = {};
    editableByArea[areaKey_(AREA.TRANSPORTE)] = [
        normalizeKey_(WF.boletaFirmadaUrl),
        normalizeKey_(WF.firmaBoletaUrl),
        normalizeKey_(WF.firmaFacturaUrl),
        normalizeKey_(WF.rutaId),
        normalizeKey_(WF.constanciaPagoUrl),
        normalizeKey_(WF.motivoObservacion)
    ];
    editableByArea[areaKey_(AREA.INVENTARIO)] = [normalizeKey_(WF.inventarioStatus), normalizeKey_(WF.comentarioInventario), normalizeKey_(WF.motivoObservacion)];
    editableByArea[areaKey_(AREA.CYC)] = [normalizeKey_(WF.ovNumero), normalizeKey_(WF.liquidacionRef), normalizeKey_(WF.facturasDebitar), normalizeKey_(WF.motivoObservacion)];
    editableByArea[areaKey_(AREA.FACTURACION)] = [normalizeKey_(WF.facturaNumero), normalizeKey_(WF.facturaUrl), normalizeKey_(WF.firmaFacturaLink), normalizeKey_(WF.motivoObservacion)];
    editableByArea[areaKey_(AREA.CONTABILIDAD)] = [normalizeKey_(WF.motivoObservacion)];
    editableByArea[areaKey_(AREA.LI)] = [normalizeKey_(WF.firmaBoletaLink), normalizeKey_(WF.boletaFirmadaUrl), normalizeKey_(WF.firmaBoletaUrl), normalizeKey_(WF.motivoObservacion)];

    const allow = editableByArea[profile.areaKey] || [];
    return allow.indexOf(key) >= 0;
}

function validaRequisitosEntrada_(toIdx, row, headerMap) {
    const pdf = String(row[COL_PDF_URL - 1] || '').trim();
    const boletaFirmada = rowText_(row, headerMap, [WF.boletaFirmadaUrl, WF.firmaBoletaUrl]);
    const inventarioStatus = rowText_(row, headerMap, [WF.inventarioStatus]);
    const ovNumero = rowText_(row, headerMap, [WF.ovNumero]);
    const rutaId = rowText_(row, headerMap, [WF.rutaId]);
    const facturaNumero = rowText_(row, headerMap, [WF.facturaNumero]);
    const facturaUrl = rowText_(row, headerMap, [WF.facturaUrl]);
    const firmaFactura = rowText_(row, headerMap, [WF.firmaFacturaUrl]);
    const liquidacionRef = rowText_(row, headerMap, [WF.liquidacionRef]);
    const constanciaPagoUrl = rowText_(row, headerMap, [WF.constanciaPagoUrl]);

    if (toIdx === 2 && !pdf) return { ok: false, message: 'No puede avanzar a etapa 2 sin PDF.' };
    if (toIdx === 3 && !boletaFirmada) return { ok: false, message: 'No puede avanzar a etapa 3 sin BoletaFirmadaUrl (PDF firmado).' };
    if (toIdx === 4 && !inventarioStatus) return { ok: false, message: 'No puede avanzar a etapa 4 sin InventarioStatus.' };
    if (toIdx === 5 && !ovNumero) return { ok: false, message: 'No puede avanzar a etapa 5 sin OV_Numero.' };
    if (toIdx === 6 && !rutaId) return { ok: false, message: 'No puede avanzar a etapa 6 sin RutaId/evidencia.' };
    if (toIdx === 7 && !facturaUrl && !facturaNumero) return { ok: false, message: 'No puede avanzar a etapa 7 sin FacturaUrl o FacturaNumero.' };
    if (toIdx === 8 && !firmaFactura) return { ok: false, message: 'No puede avanzar a etapa 8 sin FirmaFacturaUrl.' };
    if (toIdx === 9 && !liquidacionRef) return { ok: false, message: 'No puede avanzar a etapa 9 sin la referencia de liquidación.' };
    if (toIdx === 10 && !constanciaPagoUrl) return { ok: false, message: 'No puede avanzar a etapa 10 sin constancia de pago.' };
    return { ok: true };
}

function computeAutoTargetEtapa_(row, headerMap) {
    const etapaActual = normalizeEtapa_(row[COL_ETAPA - 1]);
    const currentIdx = etapaIndex_(etapaActual);
    let targetIdx = currentIdx;
    let reason = '';

    const boletaFirmada = rowText_(row, headerMap, [WF.boletaFirmadaUrl, WF.firmaBoletaUrl]);
    const inventarioStatus = rowText_(row, headerMap, [WF.inventarioStatus]);
    const invOk = inventarioStatus && /^(ok|ajuste|no hay)/i.test(inventarioStatus);
    const ovNumero = rowText_(row, headerMap, [WF.ovNumero]);
    const rutaId = rowText_(row, headerMap, [WF.rutaId]);
    const facturaNumero = rowText_(row, headerMap, [WF.facturaNumero]);
    const facturaUrl = rowText_(row, headerMap, [WF.facturaUrl]);
    const firmaFactura = rowText_(row, headerMap, [WF.firmaFacturaUrl]);
    const liquidacionRef = rowText_(row, headerMap, [WF.liquidacionRef]);
    const constanciaPagoUrl = rowText_(row, headerMap, [WF.constanciaPagoUrl]);

    if (boletaFirmada && targetIdx < 3) { targetIdx = 3; reason = 'Boleta firmada cargada'; }
    if (invOk && targetIdx < 4) { targetIdx = 4; reason = 'Inventario confirmado'; }
    if (ovNumero && targetIdx < 5) { targetIdx = 5; reason = 'OV registrada'; }
    if (rutaId && targetIdx < 6) { targetIdx = 6; reason = 'Ruta registrada'; }
    if ((facturaNumero || facturaUrl) && targetIdx < 7) { targetIdx = 7; reason = 'Factura registrada'; }
    if (firmaFactura && targetIdx < 8) { targetIdx = 8; reason = 'Firma factura cargada'; }
    if (liquidacionRef && targetIdx < 9) { targetIdx = 9; reason = 'Liquidación registrada'; }
    if (constanciaPagoUrl && targetIdx < 10) { targetIdx = 10; reason = 'Constancia de pago cargada'; }

    return {
        currentIdx: currentIdx,
        targetIdx: targetIdx,
        reason: reason
    };
}

function applyAutoEtapaRules_(id, actorEmail, opts) {
    const cfg = opts || {};
    const ss = getDataStore_();
    const sh = ss.getSheetByName('Aprobaciones');
    if (!sh) return { moved: false, message: 'Sin hoja Aprobaciones.' };
    const rowNum = findRowById_(sh, id);
    if (!rowNum) return { moved: false, message: 'ID no encontrado.' };

    const lastCol = sh.getLastColumn();
    const headers = sh.getRange(1, 1, 1, lastCol).getValues()[0];
    const map = buildHeaderMap_(headers);
    const row = sh.getRange(rowNum, 1, 1, lastCol).getValues()[0];
    const estado = normalizeEstado_(row[COL_ESTADO - 1]);
    // Los casos observados deben poder reanudar el flujo cuando el area corrige
    // la informacion obligatoria y guarda la etapa.
    if (estado === 'Cerrado' || estado === 'Anulado') return { moved: false, message: 'Estado no elegible.' };

    const auto = computeAutoTargetEtapa_(row, map);
    if (auto.targetIdx <= auto.currentIdx) return { moved: false, message: 'Sin regla aplicable.' };

    const nextEtapa = ETAPAS_COBRO[auto.targetIdx - 1];
    const moveRes = updateCobroEtapa(id, nextEtapa, actorEmail || 'sistema', {
        force: true,
        systemAuto: true,
        forceReason: auto.reason || 'Auto regla',
        actorCtx: cfg.actorCtx || { origen: cfg.source || 'auto_rule' }
    });
    if (!moveRes || !moveRes.success) {
        return { moved: false, message: moveRes && moveRes.message ? moveRes.message : 'No se pudo mover etapa automáticamente.' };
    }
    return { moved: true, from: auto.currentIdx, to: auto.targetIdx, etapa: nextEtapa, reason: auto.reason };
}

function buildHeaderMap_(headers) {
    const map = {};
    (headers || []).forEach((h, idx) => {
        const k = normalizeKey_(h);
        if (k && map[k] == null) map[k] = idx;
    });
    return map;
}

function readByHeader_(row, headerMap, names) {
    const arr = names || [];
    for (let i = 0; i < arr.length; i++) {
        const idx = headerMap[normalizeKey_(arr[i])];
        if (idx == null) continue;
        const v = String(row[idx] || '').trim();
        if (v) return v;
    }
    return '';
}

function getConfigValue_(key) {
    const wanted = normalizeKey_(key);
    if (!wanted) return '';

    const ss = getDataStore_();
    const sh = ss.getSheetByName('Config');
    if (!sh || sh.getLastRow() < 1) return '';

    const rows = sh.getDataRange().getValues();
    for (let i = 0; i < rows.length; i++) {
        const k = normalizeKey_(rows[i][0]);
        if (i === 0 && (k === 'key' || k === 'clave')) continue;
        if (k === wanted) return String(rows[i][1] || '').trim();
    }
    return '';
}

function ensureConfigSheet_() {
    const ss = getDataStore_();
    let sh = ss.getSheetByName('Config');
    if (!sh) {
        sh = ss.insertSheet('Config');
        sh.getRange(1, 1, 1, 3).setValues([['Key', 'Value', 'UpdatedAt']]);
        return sh;
    }
    const missingCols = 3 - sh.getLastColumn();
    if (missingCols > 0) sh.insertColumnsAfter(sh.getLastColumn(), missingCols);
    return sh;
}

function setConfigValue_(key, value) {
    const wanted = normalizeKey_(key);
    if (!wanted) return;

    const sh = ensureConfigSheet_();
    const label = String(key || '').trim() || key;
    const val = String(value == null ? '' : value);
    const rows = sh.getDataRange().getValues();
    const matches = [];
    for (let i = 0; i < rows.length; i++) {
        const k = normalizeKey_(rows[i][0]);
        if (!k) continue;
        if (i === 0 && (k === 'key' || k === 'clave')) continue;
        if (k === wanted) matches.push(i + 1);
    }

    if (matches.length) {
        sh.getRange(matches[0], 1, 1, 3).setValues([[label, val, new Date()]]);
        if (matches.length > 1) deleteRowsDescending_(sh, matches.slice(1));
        return;
    }
    sh.appendRow([label, val, new Date()]);
}

function deleteConfigValue_(key) {
    const wanted = normalizeKey_(key);
    if (!wanted) return;

    const ss = getDataStore_();
    const sh = ss.getSheetByName('Config');
    if (!sh || sh.getLastRow() < 1) return;
    const rows = sh.getDataRange().getValues();
    const matches = [];
    for (let i = 0; i < rows.length; i++) {
        const k = normalizeKey_(rows[i][0]);
        if (!k) continue;
        if (i === 0 && (k === 'key' || k === 'clave')) continue;
        if (k === wanted) matches.push(i + 1);
    }
    if (matches.length) deleteRowsDescending_(sh, matches);
}

function boolConfig_(key, fallback) {
    const raw = String(getConfigValue_(key) || '').trim().toLowerCase();
    if (!raw) return Boolean(fallback);
    if (raw === '1' || raw === 'true' || raw === 'si' || raw === 'yes' || raw === 'on') return true;
    if (raw === '0' || raw === 'false' || raw === 'no' || raw === 'off') return false;
    return Boolean(fallback);
}

function numberConfig_(key, fallback) {
    const raw = String(getConfigValue_(key) || '').trim();
    if (!raw) return Number(fallback || 0);
    const n = Number(raw);
    return isNaN(n) ? Number(fallback || 0) : n;
}

function listNumberConfig_(key, fallbackCsv) {
    const raw = String(getConfigValue_(key) || fallbackCsv || '').trim();
    if (!raw) return [];
    return raw
        .split(/[;, ]+/)
        .map(x => Number(x))
        .filter(x => !isNaN(x) && x > 0);
}

function getSlaSettings_() {
    const totalHours = Math.max(1, numberConfig_('slaTotalHoras', 48));
    const remindersRaw = listNumberConfig_('slaRecordatoriosHoras', '24,44');
    const reminders = remindersRaw
        .filter(h => h > 0 && h < totalHours)
        .sort((a, b) => a - b);
    return {
        totalHours: totalHours,
        reminders: reminders.length ? reminders : [24, 44]
    };
}

function computeStageSlaDeadline_(stageIdx, baseDate) {
    const cfg = getStageSlaSetting_(stageIdx);
    const hours = Number(cfg && cfg.slaHours ? cfg.slaHours : 0);
    if (!cfg || !cfg.active || hours <= 0) return null;
    const start = baseDate ? new Date(baseDate) : new Date();
    if (isNaN(start.getTime())) return null;
    return addHours_(start, hours);
}

function buildStageSlaEntryFields_(stageIdx, baseDate) {
    const start = baseDate ? new Date(baseDate) : new Date();
    const due = computeStageSlaDeadline_(stageIdx, start);
    const updates = {};
    updates[WF.fechaIngresoEtapaActual] = start;
    updates[WF.fechaLimiteSlaActual] = due || '';
    if (Number(stageIdx || 0) === 2) updates[WF.fechaLimiteFirmaBoleta] = due || '';
    if (Number(stageIdx || 0) === 7) updates[WF.fechaLimiteFirmaFactura] = due || '';
    return updates;
}

function resolveStageSlaLimit_(row, headerMap, stageIdx) {
    const current = rowDate_(row, headerMap, [WF.fechaLimiteSlaActual]);
    if (current) return current;

    if (Number(stageIdx || 0) === 2) {
        const legacyBoleta = rowDate_(row, headerMap, [WF.fechaLimiteFirmaBoleta]);
        if (legacyBoleta) return legacyBoleta;
    }
    if (Number(stageIdx || 0) === 7) {
        const legacyFactura = rowDate_(row, headerMap, [WF.fechaLimiteFirmaFactura]);
        if (legacyFactura) return legacyFactura;
    }

    const cfg = getStageSlaSetting_(stageIdx);
    const hours = Number(cfg && cfg.slaHours ? cfg.slaHours : 0);
    if (!cfg || !cfg.active || hours <= 0) return null;

    const start = rowDate_(row, headerMap, [WF.fechaIngresoEtapaActual])
        || toDateDash_(row[COL_ULT_ACT - 1])
        || toDateDash_(row[1]);
    if (!start) return null;
    return addHours_(start, hours);
}

function escapeCsv_(v) {
    return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
}

function safeJson_(obj) {
    try {
        return JSON.stringify(obj || {});
    } catch (e) {
        return '{}';
    }
}

function parseActorCtx_(actorCtx) {
    const ctx = (actorCtx && typeof actorCtx === 'object') ? actorCtx : {};
    return {
        origen: String(ctx.origen || 'api').trim() || 'api',
        agent: String(ctx.agent || '').trim(),
        ip: String(ctx.ip || '').trim()
    };
}

function buildAuditMeta_(actorCtx, extra) {
    const ctx = parseActorCtx_(actorCtx);
    const payload = {
        origen: ctx.origen,
        agent: ctx.agent,
        ip: ctx.ip
    };
    const ext = (extra && typeof extra === 'object') ? extra : {};
    Object.keys(ext).forEach(k => payload[k] = ext[k]);
    return safeJson_(payload);
}

function buildFieldDiff_(beforeRow, afterRow, headerMap, headersToCompare) {
    const out = {};
    const list = headersToCompare || [];
    for (let i = 0; i < list.length; i++) {
        const h = list[i];
        const idx = headerMap[normalizeKey_(h)];
        if (idx == null) continue;
        const beforeVal = String(beforeRow[idx] == null ? '' : beforeRow[idx]).trim();
        const afterVal = String(afterRow[idx] == null ? '' : afterRow[idx]).trim();
        if (beforeVal === afterVal) continue;
        out[h] = { before: beforeVal, after: afterVal };
    }
    return out;
}

function resolveDeleteAuthScope_(count) {
    return Number(count || 0) > 1 ? AUTH_KEY_SCOPE.DELETE_BULK : AUTH_KEY_SCOPE.DELETE_SINGLE;
}

function authKeyAllowsScope_(storedScope, wantedScope) {
    const scope = normalizeAuthKeyScope_(storedScope);
    const wanted = normalizeAuthKeyScope_(wantedScope);
    return scope === AUTH_KEY_SCOPE.DELETE_ANY || scope === wanted;
}

function validateAuthorizationKey_(plainKey, wantedScope) {
    const secret = String(plainKey || '').trim();
    if (!secret) return { ok: false, message: 'Debe ingresar la clave de autorizacion.' };

    const sh = ensureSheetSchema_('CFG_AUTH_KEY', CFG_SHEET_DEFS.CFG_AUTH_KEY);
    if (sh.getLastRow() < 2) return { ok: false, message: 'No hay claves de autorizacion configuradas.' };

    const values = sh.getDataRange().getValues();
    let matched = null;
    for (let i = 1; i < values.length; i++) {
        const r = values[i];
        const active = parseBoolLoose_(r[4], true);
        const storedHash = String(r[2] || '').trim();
        if (!active || !storedHash) continue;
        if (!verifyPassword_(secret, storedHash)) continue;
        matched = {
            rowNum: i + 1,
            keyId: String(r[0] || '').trim(),
            name: String(r[1] || '').trim(),
            scope: normalizeAuthKeyScope_(r[3]),
            maxUsos: Number(r[5] || 0),
            usosActuales: Number(r[6] || 0)
        };
        break;
    }

    if (!matched) return { ok: false, message: 'Clave de autorizacion invalida.' };
    if (!authKeyAllowsScope_(matched.scope, wantedScope)) {
        return { ok: false, message: 'La clave no autoriza esta accion.' };
    }
    if (matched.maxUsos > 0 && matched.usosActuales >= matched.maxUsos) {
        return { ok: false, message: 'La clave alcanzo su limite de usos.' };
    }

    sh.getRange(matched.rowNum, 7).setValue(Math.max(0, matched.usosActuales) + 1);
    sh.getRange(matched.rowNum, 8).setValue(new Date());
    sh.getRange(matched.rowNum, 10).setValue(new Date());

    return {
        ok: true,
        keyId: matched.keyId,
        name: matched.name,
        scope: matched.scope,
        scopeLabel: authKeyScopeLabel_(matched.scope)
    };
}

function deleteDetalleCobrosById_(idCobro) {
    const ss = getDataStore_();
    const sh = ss.getSheetByName('Detalle_Cobros');
    if (!sh) return 0;
    return deleteRowsDescending_(sh, findRowsByValueInColumn_(sh, 1, idCobro));
}

function deleteAprobacionesCriticasById_(idCobro) {
    const sh = ensureAprobacionesCriticasSheet_();
    return deleteRowsDescending_(sh, findRowsByValueInColumn_(sh, 4, idCobro));
}

function collectCobroFileUrls_(row, headerMap) {
    const urls = [
        String(row[COL_PDF_URL - 1] || '').trim(),
        rowText_(row, headerMap, [WF.boletaFirmadaUrl, WF.firmaBoletaUrl]),
        rowText_(row, headerMap, [WF.facturaUrl]),
        rowText_(row, headerMap, [WF.firmaFacturaUrl])
    ];
    const seen = {};
    return urls.filter(url => {
        const v = String(url || '').trim();
        if (!v || seen[v]) return false;
        seen[v] = true;
        return true;
    });
}

function trashDriveFilesByUrls_(urls) {
    let count = 0;
    const list = Array.isArray(urls) ? urls : [];
    for (let i = 0; i < list.length; i++) {
        const fileId = extractDriveFileId_(list[i]);
        if (!fileId) continue;
        try {
            DriveApp.getFileById(fileId).setTrashed(true);
            count++;
        } catch (e) { }
    }
    return count;
}

function parseJsonSafe_(raw, fallback) {
    try {
        const o = JSON.parse(String(raw || ''));
        return (o && typeof o === 'object') ? o : (fallback || {});
    } catch (e) {
        return fallback || {};
    }
}

function ensurePlantillasSheet_() {
    const ss = getDataStore_();
    let sh = ss.getSheetByName(SHEET_PLANTILLAS);
    if (!sh) sh = ss.insertSheet(SHEET_PLANTILLAS);
    const defaults = [
        ['ETAPA_FIRMA_BOLETA', '[COBRO TRANSPORTE] {{id}} | Firma boleta requerida', 'Actualización de cobro.\nID: {{id}}\nEtapa: {{etapa}}\nProveedor: {{proveedor}}\nRuta: {{ruta}}\nMonto: S/ {{monto}}\nLink firma boleta: {{firmaBoletaLink}}\nPDF: {{pdfUrl}}', true, 'Etapa 2 (inicio flujo)'],
        ['ETAPA_FIRMA_FACTURA', '[COBRO TRANSPORTE] {{id}} | Firma factura requerida', 'Actualización de cobro.\nID: {{id}}\nEtapa: {{etapa}}\nProveedor: {{proveedor}}\nRuta: {{ruta}}\nMonto: S/ {{monto}}\nLink firma factura: {{firmaFacturaLink}}\nPDF: {{pdfUrl}}', true, 'Etapa 6'],
        ['ETAPA_GENERAL', '[COBRO TRANSPORTE] {{id}} | {{accion}}', 'Actualización de cobro.\nID: {{id}}\nAcción: {{accion}}\nEtapa: {{etapa}}\nProveedor: {{proveedor}}\nRuta: {{ruta}}\nMonto: S/ {{monto}}\nPDF: {{pdfUrl}}', true, 'Resto de etapas'],
        ['ETAPA_OBSERVADA_RETORNO', '[COBRO TRANSPORTE] {{id}} | Observado - volver a {{etapa}}', 'Caso observado y regresado para corrección.\nID: {{id}}\nEstado: Observado\nÁrea reportada: {{areaReportada}}\nEtapa actual para corrección: {{etapa}}\nÁrea que reporta observación: {{areaReporta}}\nEtapa reportada: {{etapaReportada}}\nMotivo: {{motivoObservacion}}\nProveedor: {{proveedor}}\nRuta: {{ruta}}\nMonto: S/ {{monto}}\nPDF: {{pdfUrl}}', true, 'Aviso al área reportada cuando el caso regresa por observación'],
        ['SLA_REMINDER', '[COBRO TRANSPORTE] {{id}} | Recordatorio SLA {{marca}}', 'Recordatorio SLA.\nID: {{id}}\nEtapa: {{etapa}}\nVence: {{vence}}\nPDF: {{pdfUrl}}', true, 'SLA 24/44/...'],
        ['SLA_ESCALADO', '[COBRO TRANSPORTE] {{id}} | SLA vencido', 'SLA vencido.\nID: {{id}}\nEtapa: {{etapa}}\nVence: {{vence}}\nPDF: {{pdfUrl}}', true, 'Escalado SLA']
    ];
    if (sh.getLastRow() === 0) {
        sh.appendRow(['Codigo', 'Asunto', 'Cuerpo', 'Activo', 'Notas']);
        for (let i = 0; i < defaults.length; i++) {
            sh.appendRow(defaults[i]);
        }
    }
    if (sh.getLastRow() > 1) {
        const values = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues();
        const seen = {};
        for (let i = 0; i < values.length; i++) {
            seen[normalizeKey_(values[i][0])] = true;
        }
        for (let j = 0; j < defaults.length; j++) {
            const code = normalizeKey_(defaults[j][0]);
            if (seen[code]) continue;
            sh.appendRow(defaults[j]);
        }
    }
    return sh;
}

function initPlantillasSheet() {
    const sh = ensurePlantillasSheet_();
    return { success: true, sheet: sh.getName(), rows: sh.getLastRow() };
}

function renderTemplate_(tpl, vars) {
    let out = String(tpl || '');
    const v = vars || {};
    Object.keys(v).forEach(k => {
        const re = new RegExp('{{\\s*' + String(k).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*}}', 'g');
        out = out.replace(re, String(v[k] == null ? '' : v[k]));
    });
    return out;
}

function injectOvLineIntoMailBody_(bodyRaw, vars) {
    const v = (vars && typeof vars === 'object') ? vars : {};
    const ov = String(v.ovNumero || v.ov || '').trim();
    if (!ov) return String(bodyRaw || '');

    const body = String(bodyRaw || '').replace(/\r\n/g, '\n');
    const lines = body.split('\n');
    for (let i = 0; i < lines.length; i++) {
        if (/^\s*OV(?:[_ ]?Numero)?\s*:/i.test(String(lines[i] || ''))) {
            return body;
        }
    }

    const ovLine = 'OV: ' + ov;
    const anchors = [
        /^\s*Ruta(?:Id)?\s*:/i,
        /^\s*Proveedor\s*:/i,
        /^\s*Etapa\s*:/i,
        /^\s*Accion\s*:/i
    ];
    for (let a = 0; a < anchors.length; a++) {
        for (let i = 0; i < lines.length; i++) {
            if (anchors[a].test(String(lines[i] || ''))) {
                lines.splice(i + 1, 0, ovLine);
                return lines.join('\n');
            }
        }
    }

    if (!body.trim()) return ovLine;
    return body + '\n' + ovLine;
}

function getTemplateByCode_(code, fallbackSubject, fallbackBody, vars) {
    const wanted = normalizeKey_(code);
    if (!wanted) {
        return {
            subject: renderTemplate_(fallbackSubject || '', vars || {}),
            body: injectOvLineIntoMailBody_(renderTemplate_(fallbackBody || '', vars || {}), vars || {})
        };
    }
    const sh = ensurePlantillasSheet_();
    if (!sh || sh.getLastRow() < 2) {
        return {
            subject: renderTemplate_(fallbackSubject || '', vars || {}),
            body: injectOvLineIntoMailBody_(renderTemplate_(fallbackBody || '', vars || {}), vars || {})
        };
    }
    const values = sh.getDataRange().getValues();
    const headers = values[0] || [];
    const map = buildHeaderMap_(headers);
    const idxCode = headerIdx_(map, ['Codigo', 'Code']);
    const idxSub = headerIdx_(map, ['Asunto', 'Subject']);
    const idxBody = headerIdx_(map, ['Cuerpo', 'Body']);
    const idxActive = headerIdx_(map, ['Activo', 'Enabled']);
    for (let i = 1; i < values.length; i++) {
        const r = values[i];
        const key = normalizeKey_(idxCode >= 0 ? r[idxCode] : '');
        if (key !== wanted) continue;
        let active = true;
        if (idxActive >= 0) {
            const v = r[idxActive];
            active = (v === true) || String(v || '').toLowerCase() === 'true' || String(v || '') === '1';
        }
        if (!active) break;
        const subject = idxSub >= 0 ? String(r[idxSub] || '') : '';
        const body = idxBody >= 0 ? String(r[idxBody] || '') : '';
        return {
            subject: renderTemplate_(subject || fallbackSubject || '', vars || {}),
            body: injectOvLineIntoMailBody_(renderTemplate_(body || fallbackBody || '', vars || {}), vars || {})
        };
    }
    return {
        subject: renderTemplate_(fallbackSubject || '', vars || {}),
        body: injectOvLineIntoMailBody_(renderTemplate_(fallbackBody || '', vars || {}), vars || {})
    };
}

function sendChatWebhook_(text, extraObj) {
    const enabled = boolConfig_('chatWebhookEnabled', false);
    const url = String(getConfigValue_('chatWebhookUrl') || '').trim();
    if (!enabled || !url) return { success: false, message: 'Webhook deshabilitado.' };
    try {
        const payload = { text: String(text || '') };
        const ext = (extraObj && typeof extraObj === 'object') ? extraObj : null;
        if (ext) payload.cardsV2 = ext.cardsV2 || undefined;
        UrlFetchApp.fetch(url, {
            method: 'post',
            contentType: 'application/json',
            muteHttpExceptions: true,
            payload: JSON.stringify(payload)
        });
        return { success: true };
    } catch (e) {
        return { success: false, message: String(e) };
    }
}

function normalizeAreaName_(areaRaw) {
    const k = normalizeKey_(areaRaw);
    if (!k) return '';
    if (k === normalizeKey_(AREA.LI) || k === 'logisticainversa' || k === 'li') return AREA.LI;
    if (k === normalizeKey_(AREA.TRANSPORTE) || k === 'trans') return AREA.TRANSPORTE;
    if (k === normalizeKey_(AREA.INVENTARIO)) return AREA.INVENTARIO;
    if (k === normalizeKey_(AREA.CYC) || k === 'cyc' || k === 'creditoscobros' || k === 'creditosycobros') return AREA.CYC;
    if (k === normalizeKey_(AREA.FACTURACION)) return AREA.FACTURACION;
    if (k === normalizeKey_(AREA.CONTABILIDAD) || k === 'conta') return AREA.CONTABILIDAD;
    if (k === normalizeKey_(AREA.PROVEEDOR_SEG) || k === 'proveedorseguimiento' || k === 'proveedor') return AREA.PROVEEDOR_SEG;
    if (k === 'supervisor') return 'Supervisor';
    if (k === 'admin' || k === 'administrador' || k === 'administracion') return 'Administrador';
    return String(areaRaw || '').trim();
}

function splitAreaList_(raw) {
    const txt = String(raw || '').trim();
    if (!txt) return [];
    return txt
        .split(/[;,\n]+/)
        .map(v => normalizeAreaName_(v))
        .filter(Boolean);
}

function normalizeAreaList_(raw) {
    const list = splitAreaList_(raw);
    const seen = {};
    const out = [];
    for (let i = 0; i < list.length; i++) {
        const area = list[i];
        const key = normalizeKey_(area);
        if (!key || seen[key]) continue;
        seen[key] = true;
        out.push(area);
    }
    return out.join(', ');
}

function ensureCorreosSheet_() {
    const ss = getDataStore_();
    let sh = ss.getSheetByName(SHEET_CORREOS);
    if (!sh) sh = ss.insertSheet(SHEET_CORREOS);
    const defaults = [
        [AREA.LI, '', '', true, 'Logistica Inversa'],
        [AREA.TRANSPORTE, '', '', true, 'Transporte'],
        [AREA.INVENTARIO, '', '', true, 'Inventario'],
        [AREA.CYC, '', '', true, 'Creditos y Cobros'],
        [AREA.FACTURACION, '', '', true, 'Facturacion'],
        [AREA.CONTABILIDAD, '', '', true, 'Contabilidad'],
        [AREA.PROVEEDOR_SEG, '', '', true, 'Proveedor seguimiento Transporte'],
        ['Supervisor', '', '', true, 'Supervisor'],
        ['Administrador', '', '', true, 'Admin']
    ];
    if (sh.getLastRow() === 0) {
        sh.appendRow(['Area', 'EmailTo', 'EmailCc', 'Activo', 'Notas']);
        for (let i = 0; i < defaults.length; i++) {
            sh.appendRow(defaults[i]);
        }
    }
    if (sh.getLastRow() > 1) {
        const areaVals = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues();
        const seen = {};
        for (let i = 0; i < areaVals.length; i++) {
            seen[normalizeKey_(normalizeAreaName_(areaVals[i][0]))] = true;
        }
        for (let j = 0; j < defaults.length; j++) {
            const key = normalizeKey_(normalizeAreaName_(defaults[j][0]));
            if (seen[key]) continue;
            sh.appendRow(defaults[j]);
        }
    }
    return sh;
}

function initCorreosSheet() {
    const sh = ensureCorreosSheet_();
    return { success: true, sheet: sh.getName(), rows: sh.getLastRow() };
}

function ensureAprobacionesCriticasSheet_() {
    const ss = getDataStore_();
    let sh = ss.getSheetByName(SHEET_APROBACIONES_CRITICAS);
    if (!sh) sh = ss.insertSheet(SHEET_APROBACIONES_CRITICAS);
    if (sh.getLastRow() === 0) {
        sh.appendRow([
            'SolicitudId', 'FechaSolicitud', 'Tipo', 'IDCobro',
            'SolicitadoPor', 'Motivo', 'Payload',
            'Estado', 'AprobadoPor', 'FechaResolucion', 'Comentario', 'Usado'
        ]);
    }
    return sh;
}

function initAprobacionesCriticasSheet() {
    const sh = ensureAprobacionesCriticasSheet_();
    return { success: true, sheet: sh.getName(), rows: sh.getLastRow() };
}

function crearSolicitudAprobacionCritica(tipo, idCobro, motivo, payloadObj, actorEmail, actorCtx) {
    const profile = getUserProfile_(actorEmail);
    if (!profile.email) return { success: false, message: 'Usuario no autorizado.' };
    const motivoTxt = String(motivo || '').trim();
    if (!motivoTxt) return { success: false, message: 'Debe indicar motivo.' };

    const sh = ensureAprobacionesCriticasSheet_();
    const solicitudId = 'APC-' + new Date().getTime();
    const payload = safeJson_(payloadObj || {});
    sh.appendRow([
        solicitudId,
        new Date(),
        String(tipo || '').trim(),
        String(idCobro || '').trim(),
        profile.email,
        motivoTxt,
        payload,
        'Pendiente',
        '',
        '',
        buildAuditMeta_(actorCtx, {}),
        false
    ]);
    return { success: true, solicitudId };
}

function listarAprobacionesCriticas(estado, actorEmail) {
    const profile = getUserProfile_(actorEmail);
    if (!profile.canForce) return [];

    const sh = ensureAprobacionesCriticasSheet_();
    if (sh.getLastRow() < 2) return [];
    const ss = getDataStore_();
    const shCobros = ss.getSheetByName('Aprobaciones');
    const schemaCobros = shCobros ? ensureAprobacionesSchema_(shCobros) : null;
    const lastColCobros = shCobros ? shCobros.getLastColumn() : 0;
    const mapCobros = (shCobros && schemaCobros)
        ? (schemaCobros.map || buildHeaderMap_(shCobros.getRange(1, 1, 1, lastColCobros).getValues()[0] || []))
        : null;
    const values = sh.getDataRange().getValues();
    const headers = values[0] || [];
    const map = buildHeaderMap_(headers);

    const idxSolicitud = headerIdx_(map, ['SolicitudId']);
    const idxFecha = headerIdx_(map, ['FechaSolicitud']);
    const idxTipo = headerIdx_(map, ['Tipo']);
    const idxId = headerIdx_(map, ['IDCobro']);
    const idxBy = headerIdx_(map, ['SolicitadoPor']);
    const idxMot = headerIdx_(map, ['Motivo']);
    const idxPayload = headerIdx_(map, ['Payload']);
    const idxEstado = headerIdx_(map, ['Estado']);
    const idxApro = headerIdx_(map, ['AprobadoPor']);
    const idxFres = headerIdx_(map, ['FechaResolucion']);
    const idxCom = headerIdx_(map, ['Comentario']);
    const idxUsado = headerIdx_(map, ['Usado']);

    const wanted = String(estado || '').trim();
    const out = [];
    for (let i = 1; i < values.length; i++) {
        const r = values[i];
        const est = String(idxEstado >= 0 ? r[idxEstado] : '').trim() || 'Pendiente';
        if (wanted && est !== wanted) continue;
        const idCobro = idxId >= 0 ? String(r[idxId] || '') : '';
        if (actorCountryFilterEnabled_(profile)) {
            if (!shCobros || !mapCobros || !idCobro) continue;
            const rowNumCobro = findRowById_(shCobros, idCobro);
            if (!rowNumCobro) continue;
            const rowCobro = shCobros.getRange(rowNumCobro, 1, 1, lastColCobros).getValues()[0];
            if (!actorCanAccessAprobacionRow_(profile, rowCobro, mapCobros)) continue;
        }
        out.push({
            solicitudId: idxSolicitud >= 0 ? String(r[idxSolicitud] || '') : '',
            fechaSolicitud: idxFecha >= 0 ? formatDateTimeSafe_(r[idxFecha]) : '',
            tipo: idxTipo >= 0 ? String(r[idxTipo] || '') : '',
            idCobro: idCobro,
            solicitadoPor: idxBy >= 0 ? String(r[idxBy] || '') : '',
            motivo: idxMot >= 0 ? String(r[idxMot] || '') : '',
            payload: idxPayload >= 0 ? String(r[idxPayload] || '') : '',
            estado: est,
            aprobadoPor: idxApro >= 0 ? String(r[idxApro] || '') : '',
            fechaResolucion: idxFres >= 0 ? formatDateTimeSafe_(r[idxFres]) : '',
            comentario: idxCom >= 0 ? String(r[idxCom] || '') : '',
            usado: idxUsado >= 0 ? ((r[idxUsado] === true) || String(r[idxUsado] || '').toLowerCase() === 'true') : false
        });
    }
    out.sort((a, b) => String(b.fechaSolicitud).localeCompare(String(a.fechaSolicitud)));
    return out;
}

function resolverAprobacionCritica(solicitudId, aprobar, comentario, actorEmail, actorCtx) {
    const profile = getUserProfile_(actorEmail);
    if (!profile.canForce) return { success: false, message: 'No autorizado.' };
    const sid = String(solicitudId || '').trim();
    if (!sid) return { success: false, message: 'Solicitud invalida.' };

    const sh = ensureAprobacionesCriticasSheet_();
    if (sh.getLastRow() < 2) return { success: false, message: 'No hay solicitudes.' };
    const ss = getDataStore_();
    const shCobros = ss.getSheetByName('Aprobaciones');
    const schemaCobros = shCobros ? ensureAprobacionesSchema_(shCobros) : null;
    const lastColCobros = shCobros ? shCobros.getLastColumn() : 0;
    const mapCobros = (shCobros && schemaCobros)
        ? (schemaCobros.map || buildHeaderMap_(shCobros.getRange(1, 1, 1, lastColCobros).getValues()[0] || []))
        : null;
    const values = sh.getDataRange().getValues();
    const headers = values[0] || [];
    const map = buildHeaderMap_(headers);
    const idxSolicitud = headerIdx_(map, ['SolicitudId']);
    const idxId = headerIdx_(map, ['IDCobro']);
    const idxEstado = headerIdx_(map, ['Estado']);
    const idxApro = headerIdx_(map, ['AprobadoPor']);
    const idxFres = headerIdx_(map, ['FechaResolucion']);
    const idxCom = headerIdx_(map, ['Comentario']);

    for (let i = 1; i < values.length; i++) {
        const r = values[i];
        if (String(idxSolicitud >= 0 ? r[idxSolicitud] : '') !== sid) continue;
        const idCobro = idxId >= 0 ? String(r[idxId] || '') : '';
        if (actorCountryFilterEnabled_(profile)) {
            if (!shCobros || !mapCobros || !idCobro) return { success: false, message: 'Solicitud fuera de su entorno.' };
            const rowNumCobro = findRowById_(shCobros, idCobro);
            if (!rowNumCobro) return { success: false, message: 'Cobro asociado no encontrado.' };
            const rowCobro = shCobros.getRange(rowNumCobro, 1, 1, lastColCobros).getValues()[0];
            if (!actorCanAccessAprobacionRow_(profile, rowCobro, mapCobros)) {
                return { success: false, message: 'No tiene acceso a esta solicitud fuera de su entorno.' };
            }
        }
        const rowNum = i + 1;
        const estado = String(idxEstado >= 0 ? r[idxEstado] : '').trim() || 'Pendiente';
        if (estado !== 'Pendiente') return { success: false, message: 'La solicitud ya fue resuelta.' };
        const nextEstado = aprobar ? 'Aprobado' : 'Rechazado';
        if (idxEstado >= 0) sh.getRange(rowNum, idxEstado + 1).setValue(nextEstado);
        if (idxApro >= 0) sh.getRange(rowNum, idxApro + 1).setValue(profile.email);
        if (idxFres >= 0) sh.getRange(rowNum, idxFres + 1).setValue(new Date());
        if (idxCom >= 0) sh.getRange(rowNum, idxCom + 1).setValue(buildAuditMeta_(actorCtx, { comentario: String(comentario || '') }));
        return { success: true, estado: nextEstado };
    }
    return { success: false, message: 'Solicitud no encontrada.' };
}

function validarAprobacionCritica_(solicitudId, expectedTipo, idCobro) {
    const sid = String(solicitudId || '').trim();
    if (!sid) return { ok: false, message: 'Falta solicitud de aprobacion.' };
    const sh = ensureAprobacionesCriticasSheet_();
    if (sh.getLastRow() < 2) return { ok: false, message: 'No hay solicitudes.' };
    const values = sh.getDataRange().getValues();
    const headers = values[0] || [];
    const map = buildHeaderMap_(headers);
    const idxSolicitud = headerIdx_(map, ['SolicitudId']);
    const idxTipo = headerIdx_(map, ['Tipo']);
    const idxId = headerIdx_(map, ['IDCobro']);
    const idxEstado = headerIdx_(map, ['Estado']);
    const idxUsado = headerIdx_(map, ['Usado']);

    for (let i = 1; i < values.length; i++) {
        const r = values[i];
        if (String(idxSolicitud >= 0 ? r[idxSolicitud] : '') !== sid) continue;
        const tipo = String(idxTipo >= 0 ? r[idxTipo] : '').trim();
        const id = String(idxId >= 0 ? r[idxId] : '').trim();
        const estado = String(idxEstado >= 0 ? r[idxEstado] : '').trim();
        const usado = idxUsado >= 0 ? ((r[idxUsado] === true) || String(r[idxUsado] || '').toLowerCase() === 'true') : false;
        if (expectedTipo && tipo !== expectedTipo) return { ok: false, message: 'La solicitud no corresponde al tipo esperado.' };
        if (idCobro && id !== String(idCobro || '').trim()) return { ok: false, message: 'La solicitud no corresponde al ID.' };
        if (estado !== 'Aprobado') return { ok: false, message: 'La solicitud no esta aprobada.' };
        if (usado) return { ok: false, message: 'La solicitud ya fue utilizada.' };
        if (idxUsado >= 0) sh.getRange(i + 1, idxUsado + 1).setValue(true);
        return { ok: true };
    }
    return { ok: false, message: 'Solicitud no encontrada.' };
}

function getCorreosAreaTarget_(areaName) {
    const areaNorm = normalizeAreaName_(areaName);
    if (!areaNorm) return { to: '', cc: '' };

    const sh = ensureCorreosSheet_();
    if (!sh || sh.getLastRow() < 2) return { to: '', cc: '' };

    const values = sh.getDataRange().getValues();
    const headers = values[0] || [];
    const map = buildHeaderMap_(headers);

    const idxArea = headerIdx_(map, ['Area', 'AreaResponsable', 'Departamento']);
    // Acepta variantes y typos frecuentes: EmailTo, EmailIo, MailTo, etc.
    let idxTo = headerIdx_(map, ['EmailTo', 'EmailTO', 'EmailIo', 'MailTo', 'To', 'CorreoTo', 'Correos', 'Emails', 'Correo']);
    let idxCc = headerIdx_(map, ['EmailCc', 'EmailCC', 'Cc', 'CorreoCc', 'ConCopia']);
    const idxActivo = headerIdx_(map, ['Activo', 'Enabled', 'Habilitado']);
    // Fallback por posiciÃ³n (layout estÃ¡ndar: A Area, B To, C Cc).
    if (idxTo < 0 && headers.length >= 2) idxTo = 1;
    if (idxCc < 0 && headers.length >= 3) idxCc = 2;

    for (let i = 1; i < values.length; i++) {
        const r = values[i];
        const areaRow = normalizeAreaName_(idxArea >= 0 ? r[idxArea] : r[0]);
        if (!areaRow || normalizeKey_(areaRow) !== normalizeKey_(areaNorm)) continue;

        let activo = true;
        if (idxActivo >= 0) {
            const v = r[idxActivo];
            activo = (v === true) || String(v || '').toLowerCase() === 'true' || String(v || '') === '1';
        }
        if (!activo) return { to: '', cc: '' };

        const to = idxTo >= 0 ? csvEmails_(r[idxTo]) : '';
        const cc = idxCc >= 0 ? csvEmails_(r[idxCc]) : '';
        return { to, cc };
    }
    return { to: '', cc: '' };
}

function findProveedorEmail_(proveedorCodigo, proveedorNombre, countryCode) {
    const ss = getDataStore_();
    const sh = ss.getSheetByName('Proveedores') || findSheetByNormalizedName_(ss, ['Proveedores', 'Proveedor']);
    if (!sh || sh.getLastRow() < 2) return '';

    const values = sh.getDataRange().getValues();
    const headers = values[0] || [];
    const map = buildHeaderMap_(headers);

    const idxCodigo = (map[normalizeKey_('codigo')] != null) ? map[normalizeKey_('codigo')] : 0;
    const idxNombre = (map[normalizeKey_('nombre')] != null) ? map[normalizeKey_('nombre')] : 1;
    const idxCountry = map[normalizeKey_('countrycode')];

    let idxEmail = null;
    const emailKeys = ['email', 'correo', 'mail', 'emailProveedor', 'correoProveedor'];
    for (let i = 0; i < emailKeys.length; i++) {
        const idx = map[normalizeKey_(emailKeys[i])];
        if (idx != null) {
            idxEmail = idx;
            break;
        }
    }

    if (idxEmail == null) {
        const sample = values[1] || [];
        for (let c = 0; c < sample.length; c++) {
            if (String(sample[c] || '').indexOf('@') >= 0) {
                idxEmail = c;
                break;
            }
        }
    }

    if (idxEmail == null) return '';

    const codeRef = String(proveedorCodigo || '').trim().toLowerCase();
    const nameRef = String(proveedorNombre || '').trim().toLowerCase();
    const wantedCountry = resolveCatalogCountryCode_(countryCode);

    for (let i = 1; i < values.length; i++) {
        const r = values[i];
        if (idxCountry != null) {
            const rowCountry = resolveCatalogCountryCode_(r[idxCountry]);
            if (rowCountry !== wantedCountry) continue;
        }
        const email = String(r[idxEmail] || '').trim();
        if (!email || email.indexOf('@') < 0) continue;

        const code = String(r[idxCodigo] || '').trim().toLowerCase();
        const name = String(r[idxNombre] || '').trim().toLowerCase();

        if (codeRef && code && code === codeRef) return email;
        if (nameRef && name && name === nameRef) return email;
    }

    if (nameRef) {
        for (let i = 1; i < values.length; i++) {
            const r = values[i];
            if (idxCountry != null) {
                const rowCountry = resolveCatalogCountryCode_(r[idxCountry]);
                if (rowCountry !== wantedCountry) continue;
            }
            const email = String(r[idxEmail] || '').trim();
            const name = String(r[idxNombre] || '').trim().toLowerCase();
            if (!email || email.indexOf('@') < 0) continue;
            if (name && (name.indexOf(nameRef) >= 0 || nameRef.indexOf(name) >= 0)) return email;
        }
    }
    return '';
}

function resolveProveedorEmail_(row, headerMap, proveedorCodigo, proveedorNombre) {
    const fromRow = readByHeader_(row, headerMap, [
        WF.emailProveedor, 'correoProveedor', 'mailProveedor', 'proveedorEmail'
    ]);
    if (fromRow) return fromRow;
    const countryCode = resolveAprobacionCountryCode_(row, headerMap);
    return findProveedorEmail_(proveedorCodigo, proveedorNombre, countryCode);
}

function resolveInventariosEmail_(row, headerMap) {
    const fromRow = readByHeader_(row, headerMap, [
        WF.emailInventarios, 'correoInventarios', 'inventariosEmail'
    ]);
    if (fromRow) return fromRow;

    const fromArea = getCorreosAreaTarget_(AREA.INVENTARIO).to;
    if (fromArea) return fromArea;

    const prop = String(PropertiesService.getScriptProperties().getProperty(EMAIL_INVENTARIOS_KEY) || '').trim();
    if (prop) return prop;

    return getConfigValue_('emailInventarios') || getConfigValue_('correoInventarios') || '';
}

function resolveTransporteEmail_(row, headerMap) {
    const fromRow = readByHeader_(row, headerMap, [
        WF.emailTransporte, 'correoTransporte', 'transporteEmail'
    ]);
    if (fromRow) return fromRow;

    const fromArea = getCorreosAreaTarget_(AREA.TRANSPORTE).to;
    if (fromArea) return fromArea;

    const prop = String(PropertiesService.getScriptProperties().getProperty(EMAIL_TRANSPORTE_KEY) || '').trim();
    if (prop) return prop;

    return getConfigValue_('emailTransporte') || getConfigValue_('correoTransporte') || '';
}

function resolveCyCEmail_(row, headerMap) {
    const fromRow = readByHeader_(row, headerMap, [
        WF.emailCyC, 'correoCyC', 'emailCreditosCobros'
    ]);
    if (fromRow) return fromRow;

    const fromArea = getCorreosAreaTarget_(AREA.CYC).to;
    if (fromArea) return fromArea;

    const prop = String(PropertiesService.getScriptProperties().getProperty(EMAIL_CYC_KEY) || '').trim();
    if (prop) return prop;

    return getConfigValue_('emailCyC') || getConfigValue_('correoCyC') || getConfigValue_('emailCreditosCobros') || '';
}

function resolveFacturacionEmail_(row, headerMap) {
    const fromRow = readByHeader_(row, headerMap, [
        WF.emailFacturacion, 'correoFacturacion', 'facturacionEmail'
    ]);
    if (fromRow) return fromRow;

    const fromArea = getCorreosAreaTarget_(AREA.FACTURACION).to;
    if (fromArea) return fromArea;

    const prop = String(PropertiesService.getScriptProperties().getProperty(EMAIL_FACTURACION_KEY) || '').trim();
    if (prop) return prop;

    return getConfigValue_('emailFacturacion') || getConfigValue_('correoFacturacion') || '';
}

function resolveContabilidadEmail_(row, headerMap) {
    const fromRow = readByHeader_(row, headerMap, [
        WF.emailContabilidad, 'correoContabilidad', 'contabilidadEmail'
    ]);
    if (fromRow) return fromRow;

    const fromArea = getCorreosAreaTarget_(AREA.CONTABILIDAD).to;
    if (fromArea) return fromArea;

    const prop = String(PropertiesService.getScriptProperties().getProperty(EMAIL_CONTABILIDAD_KEY) || '').trim();
    if (prop) return prop;

    return getConfigValue_('emailContabilidad') || getConfigValue_('correoContabilidad') || '';
}

function resolveUsersByRoleEmails_(roleWanted) {
    const roleNorm = normalizeRole_(roleWanted || '');
    if (!roleNorm) return '';

    const ss = getDataStore_();
    const sh = ss.getSheetByName('Usuarios');
    if (!sh || sh.getLastRow() < 2) return '';

    const values = sh.getDataRange().getValues();
    const headers = values[0] || [];
    const map = buildHeaderMap_(headers);
    const idxEmailFound = headerIdx_(map, ['Email', 'Correo', 'Mail']);
    const idxRolFound = headerIdx_(map, ['Rol', 'Role']);
    const idxActivoFound = headerIdx_(map, ['Activo', 'Enabled', 'Habilitado']);
    const idxEmail = idxEmailFound >= 0 ? idxEmailFound : 0;
    const idxRol = idxRolFound >= 0 ? idxRolFound : 2;
    const idxActivo = idxActivoFound >= 0 ? idxActivoFound : 4;

    const out = [];
    for (let i = 1; i < values.length; i++) {
        const row = values[i] || [];
        const rol = normalizeRole_(row[idxRol] || '');
        if (rol !== roleNorm) continue;

        let activo = true;
        if (idxActivo >= 0) {
            const raw = row[idxActivo];
            activo = (raw === true) || String(raw || '').toLowerCase() === 'true' || String(raw || '') === '1';
        }
        if (!activo) continue;

        const email = String(row[idxEmail] || '').trim();
        if (!email || email.indexOf('@') < 0) continue;
        out.push(email);
    }
    return csvEmails_(out.join(','));
}

function resolveAdminUsersEmails_() {
    return resolveUsersByRoleEmails_('admin');
}

function resolveAdminEmail_() {
    const fromArea = getCorreosAreaTarget_('Administrador').to;
    const fromUsers = resolveAdminUsersEmails_();
    const prop = String(PropertiesService.getScriptProperties().getProperty(EMAIL_ADMIN_KEY) || '').trim();
    const fromCfg = getConfigValue_('emailAdmin') || getConfigValue_('correoAdmin') || '';
    // Fallback a Supervisor para no perder la copia cuando no hay admin explÃ­cito.
    return mergeEmails_(fromArea, fromUsers, prop, fromCfg, resolveSupervisorEmail_());
}

function resolveSupervisorEmail_() {
    const fromArea = getCorreosAreaTarget_('Supervisor').to;
    if (fromArea) return fromArea;

    const prop = String(PropertiesService.getScriptProperties().getProperty(EMAIL_SUPERVISOR_KEY) || '').trim();
    if (prop) return prop;
    return getConfigValue_('emailSupervisor') || getConfigValue_('correoSupervisor') || '';
}

function ensureBitacoraSheet_() {
    const ss = getDataStore_();
    let sh = ss.getSheetByName(SHEET_BITACORA);
    if (!sh) sh = ss.insertSheet(SHEET_BITACORA);
    if (sh.getLastRow() === 0) {
        sh.appendRow(['Fecha', 'ID', 'Usuario', 'Etapa', 'Accion', 'Resultado', 'Destinatario', 'Detalle']);
    }
    return sh;
}

function appendBitacora_(evt) {
    try {
        const sh = ensureBitacoraSheet_();
        sh.appendRow([
            new Date(),
            evt.id || '',
            evt.usuario || '',
            evt.etapa || '',
            evt.accion || '',
            evt.resultado || '',
            evt.destinatario || '',
            evt.detalle || ''
        ]);
    } catch (e) { }
}

function buildEtapaEmailBody_(ctx, accion) {
    const tz = Session.getScriptTimeZone();
    const lines = [
        'Actualización de cobro de transporte',
        'ID: ' + (ctx.id || ''),
        'Acción: ' + (accion || ''),
        'Etapa: ' + (ctx.etapa || ''),
        'Proveedor: ' + (ctx.proveedor || ''),
        'Ruta: ' + (ctx.ruta || '')
    ];
    if (String(ctx.ovNumero || '').trim()) {
        lines.push('OV: ' + String(ctx.ovNumero || '').trim());
    }
    lines.push(
        'Monto: S/ ' + Number(ctx.monto || 0).toFixed(2),
        'Actualizado por: ' + (ctx.actorEmail || 'sistema'),
        'Fecha: ' + Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd HH:mm:ss')
    );
    if (ctx.pdfUrl) lines.push('PDF: ' + ctx.pdfUrl);
    return lines.join('\n');
}

function roleKeyByArea_(areaName) {
    const area = normalizeAreaName_(areaName);
    if (area === AREA.LI) return 'logistica_inversa';
    if (area === AREA.TRANSPORTE || area === AREA.PROVEEDOR_SEG) return 'transporte';
    if (area === AREA.INVENTARIO) return 'inventario';
    if (area === AREA.CYC) return 'creditos_cobros';
    if (area === AREA.FACTURACION) return 'facturacion';
    if (area === AREA.CONTABILIDAD) return 'contabilidad';
    if (area === 'Supervisor') return 'supervisor';
    if (area === 'Administrador') return 'admin';
    return '';
}

function resolveAreaNotificationTarget_(areaName, row, headerMap, proveedorCodigo, proveedorNombre) {
    const area = normalizeAreaName_(areaName);
    const target = getCorreosAreaTarget_(area);
    let to = csvEmails_(target.to);
    const cc = csvEmails_(target.cc);
    const map = headerMap || {};
    const rowData = Array.isArray(row) ? row : [];

    if (!to) {
        if (area === AREA.INVENTARIO) to = resolveInventariosEmail_(rowData, map);
        else if (area === AREA.TRANSPORTE || area === AREA.PROVEEDOR_SEG) to = resolveTransporteEmail_(rowData, map);
        else if (area === AREA.CYC) to = resolveCyCEmail_(rowData, map);
        else if (area === AREA.FACTURACION) to = resolveFacturacionEmail_(rowData, map);
        else if (area === AREA.CONTABILIDAD) to = resolveContabilidadEmail_(rowData, map);
        else if (area === 'Supervisor') to = resolveSupervisorEmail_();
        else if (area === 'Administrador') to = resolveAdminEmail_();
        else if (area === AREA.LI) to = resolveUsersByRoleEmails_('logistica_inversa');
    }

    if (!to && area === AREA.PROVEEDOR_SEG) {
        to = mergeEmails_(
            resolveTransporteEmail_(rowData, map),
            resolveProveedorEmail_(rowData, map, proveedorCodigo, proveedorNombre)
        );
    }

    if (!to) {
        const roleKey = roleKeyByArea_(area);
        if (roleKey) to = resolveUsersByRoleEmails_(roleKey);
    }

    return { area: area, to: csvEmails_(to), cc: cc };
}

function resolveStageNotifyRecipients_(cfg, row, headerMap, proveedorCodigo, proveedorNombre) {
    const toAreas = splitAreaList_(cfg && cfg.areaTo);
    const ccAreas = splitAreaList_(cfg && cfg.ccAreas);
    let to = '';
    let cc = '';
    const ccTargets = [];

    for (let i = 0; i < toAreas.length; i++) {
        const target = resolveAreaNotificationTarget_(toAreas[i], row, headerMap, proveedorCodigo, proveedorNombre);
        if (target && target.to) to = mergeEmails_(to, target.to);
        if (target && target.cc) cc = mergeEmails_(cc, target.cc);
    }

    for (let i = 0; i < ccAreas.length; i++) {
        const target = resolveAreaNotificationTarget_(ccAreas[i], row, headerMap, proveedorCodigo, proveedorNombre);
        ccTargets.push(target);
        if (target) cc = mergeEmails_(cc, target.to, target.cc);
    }

    if (!to) {
        for (let i = 0; i < ccTargets.length; i++) {
            if (ccTargets[i] && ccTargets[i].to) {
                to = ccTargets[i].to;
                break;
            }
        }
    }

    return {
        to: csvEmails_(to),
        cc: csvEmails_(cc)
    };
}

function buildObservedReturnMailBody_(ctx) {
    const tz = Session.getScriptTimeZone();
    const lines = [
        'Caso observado y regresado para corrección.',
        'ID: ' + (ctx.id || ''),
        'Estado: Observado',
        'Área reportada: ' + (ctx.areaReportada || ''),
        'Etapa actual para corrección: ' + (ctx.etapa || ''),
        'Área que reporta observación: ' + (ctx.areaReporta || ''),
        'Etapa reportada: ' + (ctx.etapaReportada || ''),
        'Motivo: ' + (ctx.motivoObservacion || ''),
        'Proveedor: ' + (ctx.proveedor || ''),
        'Ruta: ' + (ctx.ruta || '')
    ];
    if (String(ctx.ovNumero || '').trim()) lines.push('OV: ' + String(ctx.ovNumero || '').trim());
    lines.push(
        'Monto: S/ ' + Number(ctx.monto || 0).toFixed(2),
        'Actualizado por: ' + (ctx.actorEmail || 'sistema'),
        'Fecha: ' + Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd HH:mm:ss')
    );
    if (ctx.pdfUrl) lines.push('PDF: ' + ctx.pdfUrl);
    return lines.join('\n');
}

function sendObservedReturnNotification_(ctx) {
    const data = (ctx && typeof ctx === 'object') ? ctx : {};
    const row = Array.isArray(data.row) ? data.row : [];
    const headerMap = data.headerMap || {};
    const areaReportada = normalizeAreaName_(data.areaReportada || data.areaDestino || '');
    const areaReporta = normalizeAreaName_(data.areaReporta || '');
    const etapaActual = normalizeEtapa_(data.etapaActual || '');
    const etapaReportada = normalizeEtapa_(data.etapaReportada || etapaActual);
    const detalle = {
        id: String(data.id || '').trim(),
        etapa: etapaActual,
        proveedor: String(data.proveedor || row[2] || '').trim(),
        proveedorCodigo: String(data.proveedorCodigo || row[3] || '').trim(),
        ruta: String(data.ruta || row[5] || '').trim(),
        ovNumero: String(data.ovNumero || rowText_(row, headerMap, [WF.ovNumero]) || '').trim(),
        monto: Number(data.monto != null ? data.monto : (row[12] || 0)),
        pdfUrl: String(data.pdfUrl || row[COL_PDF_URL - 1] || '').trim(),
        actorEmail: String(data.actorEmail || 'sistema').trim(),
        accion: 'Retorno por observación'
    };
    const motivoObservacion = String(data.motivoObservacion || '').trim();
    const target = resolveAreaNotificationTarget_(
        areaReportada,
        row,
        headerMap,
        detalle.proveedorCodigo,
        detalle.proveedor
    );
    const destinatario = csvEmails_(target.to || target.cc || '');
    if (!destinatario) {
        const msgNoTo = 'Sin destinatario para el area reportada: ' + (areaReportada || 'Sin area');
        appendBitacora_({
            id: detalle.id,
            usuario: detalle.actorEmail,
            etapa: detalle.etapa,
            accion: 'Notificación retorno por observación',
            resultado: 'Sin envio',
            destinatario: '',
            detalle: buildAuditMeta_(data.actorCtx, {
                motivo: motivoObservacion,
                areaReportada: areaReportada,
                areaReporta: areaReporta,
                etapaReportada: etapaReportada,
                message: msgNoTo
            })
        });
        return { success: false, message: msgNoTo, to: '', cc: '', area: areaReportada };
    }

    const vars = buildMailVars_(detalle, {
        areaReportada: areaReportada,
        areaReporta: areaReporta,
        etapaReportada: etapaReportada,
        motivoObservacion: motivoObservacion
    });
    const subjectFallback = subjectPlantilla_(detalle.id, 'Observado - volver a ' + (detalle.etapa || 'corrección'));
    const bodyFallback = buildObservedReturnMailBody_({
        id: detalle.id,
        etapa: detalle.etapa,
        proveedor: detalle.proveedor,
        ruta: detalle.ruta,
        ovNumero: detalle.ovNumero,
        monto: detalle.monto,
        pdfUrl: detalle.pdfUrl,
        actorEmail: detalle.actorEmail,
        areaReportada: areaReportada,
        areaReporta: areaReporta,
        etapaReportada: etapaReportada,
        motivoObservacion: motivoObservacion
    });
    const tpl = getTemplateByCode_('ETAPA_OBSERVADA_RETORNO', subjectFallback, bodyFallback, vars);
    const body = String(tpl.body || bodyFallback);
    const mailRes = sendStageMail_(target.to, tpl.subject, body, target.cc);
    if (mailRes.success) {
        notifyMultiChannel_(detalle, tpl.subject, body, 'Retorno por observación');
    }

    appendBitacora_({
        id: detalle.id,
        usuario: detalle.actorEmail,
        etapa: detalle.etapa,
        accion: 'Notificación retorno por observación',
        resultado: mailRes.success ? 'Enviado' : 'Error',
        destinatario: destinatario,
        detalle: buildAuditMeta_(data.actorCtx, {
            motivo: motivoObservacion,
            areaReportada: areaReportada,
            areaReporta: areaReporta,
            etapaReportada: etapaReportada,
            message: mailRes.success ? 'Correo enviado al area reportada.' : String(mailRes.message || 'No se pudo enviar correo.')
        })
    });

    return {
        success: Boolean(mailRes && mailRes.success),
        message: String(mailRes && mailRes.message || ''),
        to: csvEmails_(target.to),
        cc: csvEmails_(target.cc),
        area: areaReportada,
        provider: String(mailRes && mailRes.provider || ''),
        statusCode: Number(mailRes && mailRes.statusCode || 0)
    };
}

function sendRegistroBoletaMail_(ctx) {
    const detalle = {
        id: String(ctx.id || '').trim(),
        etapa: String(ctx.etapa || ETAPAS_COBRO[0]).trim(),
        proveedor: String(ctx.proveedor || '').trim(),
        proveedorCodigo: String(ctx.proveedorCodigo || '').trim(),
        ruta: String(ctx.ruta || '').trim(),
        monto: Number(ctx.monto || 0),
        pdfUrl: String(ctx.pdfUrl || '').trim(),
        actorEmail: String(ctx.actorEmail || 'sistema').trim(),
        accion: 'Boleta generada'
    };

    const emailProveedor = findProveedorEmail_(detalle.proveedorCodigo, detalle.proveedor, detalle.countryCode || ctx.countryCode);
    const emailTransporte = resolveTransporteEmail_([], {});
    const emailTransporteUsers = resolveUsersByRoleEmails_('transporte');
    const emailAdmin = resolveAdminEmail_();
    const emailAdminUsers = resolveUsersByRoleEmails_('admin');
    const ccTransporteArea = getCorreosAreaTarget_(AREA.TRANSPORTE).cc;
    const ccAdminArea = getCorreosAreaTarget_('Administrador').cc;
    const ccSupervisorArea = getCorreosAreaTarget_('Supervisor').cc;

    const copies = mergeEmails_(emailTransporte, emailTransporteUsers, emailAdmin, emailAdminUsers, ccTransporteArea, ccAdminArea, ccSupervisorArea);
    const to = emailProveedor || copies;
    const cc = emailProveedor ? copies : '';

    if (!to) {
        appendBitacora_({
            id: detalle.id,
            usuario: detalle.actorEmail,
            etapa: detalle.etapa,
            accion: detalle.accion,
            resultado: 'Sin envio',
            destinatario: '',
            detalle: 'No se encontro correo de proveedor, transporte o admin.'
        });
        return { ok: false, message: 'Sin destinatario' };
    }

    const subjectFallback = subjectPlantilla_(detalle.id, 'Boleta registrada');
    const bodyFallback = [
        'Se registro una boleta de cobro de transporte.',
        'ID: ' + detalle.id,
        'Etapa: ' + detalle.etapa,
        'Proveedor: ' + detalle.proveedor,
        'Ruta: ' + detalle.ruta,
        'Monto: S/ ' + Number(detalle.monto || 0).toFixed(2),
        'Registrado por: ' + (detalle.actorEmail || 'sistema'),
        'PDF: ' + (detalle.pdfUrl || '-')
    ].join('\n');

    const tpl = getTemplateByCode_('ETAPA_GENERAL', subjectFallback, bodyFallback, buildMailVars_(detalle, {
        accion: detalle.accion
    }));
    const subject = String((tpl && tpl.subject) || subjectFallback);
    const body = String((tpl && tpl.body) || bodyFallback);
    const mailRes = sendStageMail_(to, subject, body, cc);
    if (mailRes.success) {
        notifyMultiChannel_(detalle, subject, body, detalle.accion);
    }

    appendBitacora_({
        id: detalle.id,
        usuario: detalle.actorEmail,
        etapa: detalle.etapa,
        accion: detalle.accion,
        resultado: mailRes.success ? 'Enviado' : 'Error',
        destinatario: csvEmails_(to),
        detalle: mailRes.success
            ? ('Correo enviado. CC: ' + csvEmails_(cc))
            : String(mailRes.message || 'Error enviando correo.')
    });

    return {
        ok: !!mailRes.success,
        to: csvEmails_(to),
        cc: csvEmails_(cc),
        message: String(mailRes.message || '')
    };
}

function isHttpUrlMail_(v) {
    return /^https?:\/\/\S+$/i.test(String(v || '').trim());
}

function mailHostLabel_(url) {
    const m = String(url || '').trim().match(/^https?:\/\/([^\/?#]+)/i);
    return m && m[1] ? m[1] : '';
}

function mailToneBySubject_(subject) {
    const s = String(subject || '').toLowerCase();
    if (s.indexOf('sla vencido') >= 0 || s.indexOf('vencido') >= 0) {
        return { accent: '#b42318', soft: '#fff4f2', line: '#f7d6d2' };
    }
    if (s.indexOf('recordatorio') >= 0 || s.indexOf('sla') >= 0) {
        return { accent: '#b26a00', soft: '#fff8eb', line: '#f3e0b5' };
    }
    if (s.indexOf('cerrado') >= 0 || s.indexOf('debitado') >= 0) {
        return { accent: '#107c41', soft: '#eefaf3', line: '#cbeed8' };
    }
    return { accent: '#0a6ed1', soft: '#eef6ff', line: '#d5e7fb' };
}

function mailPrettySubject_(subject) {
    const s = String(subject || '').trim();
    return s.replace(/^\[COBRO TRANSPORTE\]\s*/i, '').trim() || s;
}

function mailFormatLabel_(keyRaw) {
    const raw = String(keyRaw || '').trim();
    const low = raw.toLowerCase();
    const map = {
        'id': 'ID',
        'accion': 'Accion',
        'etapa': 'Etapa',
        'proveedor': 'Proveedor',
        'ruta': 'Ruta',
        'ov': 'OV',
        'ov_numero': 'OV',
        'ov numero': 'OV',
        'monto': 'Monto',
        'actualizado por': 'Actualizado por',
        'fecha': 'Fecha',
        'pdf': 'PDF',
        'vence': 'Vence',
        'link firma boleta': 'Link firma boleta',
        'link firma factura': 'Link firma factura'
    };
    return map[low] || raw;
}

function mailCtaHtml_(label, url, accent) {
    if (!isHttpUrlMail_(url)) return '';
    const safeUrl = escapeHtml_(url);
    const txt = escapeHtml_(label || 'Abrir enlace');
    return '<a href="' + safeUrl + '" target="_blank" rel="noopener" ' +
        'style="display:inline-block;padding:10px 14px;border-radius:10px;background:' + accent + ';' +
        'color:#ffffff;text-decoration:none;font-weight:700;font-size:13px;margin:0 8px 8px 0;">' + txt + '</a>';
}

function mailExtractCobroId_(subject, bodyText) {
    const source = [String(subject || ''), String(bodyText || '')].join('\n');
    const m = source.match(/\b(COB-[A-Z0-9_-]{6,})\b/i);
    return m && m[1] ? String(m[1]).trim() : '';
}

function mailFmtQty_(qty) {
    const raw = String(qty == null ? '' : qty).trim();
    if (!raw) return '-';
    const n = Number(String(raw).replace(',', '.'));
    if (isNaN(n)) return raw;
    if (Math.abs(n - Math.round(n)) < 0.000001) return String(Math.round(n));
    return String(Math.round(n * 100) / 100);
}

function getCobroSkuRowsForMail_(idCobro) {
    const id = String(idCobro || '').trim();
    if (!id) return [];
    try {
        const ss = getDataStore_();
        const sh = ss.getSheetByName('Detalle_Cobros');
        if (!sh || sh.getLastRow() < 2) return [];

        const idRange = sh.getRange(2, 1, sh.getLastRow() - 1, 1);
        const matches = idRange.createTextFinder(id).matchEntireCell(true).findAll() || [];
        if (!matches.length) return [];

        const agg = {};
        const order = [];
        for (let i = 0; i < matches.length; i++) {
            const rowNum = matches[i].getRow();
            const row = sh.getRange(rowNum, 2, 1, 3).getValues()[0] || []; // codigo, descripcion, cantidad
            const codigo = String(row[0] || '').trim();
            const descripcion = String(row[1] || '').trim();
            const key = (codigo || '-') + '||' + (descripcion || '-');
            const qtyNum = Number(String(row[2] == null ? '' : row[2]).replace(',', '.'));
            if (!agg[key]) {
                agg[key] = {
                    codigo: codigo || '-',
                    descripcion: descripcion || '-',
                    cantidad: 0
                };
                order.push(key);
            }
            if (!isNaN(qtyNum)) agg[key].cantidad += qtyNum;
        }

        return order.map(function (k) {
            const it = agg[k];
            return {
                codigo: it.codigo,
                descripcion: it.descripcion,
                cantidad: mailFmtQty_(it.cantidad)
            };
        });
    } catch (e) {
        return [];
    }
}

function buildStyledEmailHtml_(subject, bodyText) {
    const rawSubject = String(subject || '').trim();
    const prettySubject = mailPrettySubject_(rawSubject);
    const tone = mailToneBySubject_(rawSubject);
    const cobroIdForSku = mailExtractCobroId_(rawSubject, bodyText);
    const skuRows = getCobroSkuRowsForMail_(cobroIdForSku);
    const lines = String(bodyText || '').replace(/\r\n/g, '\n').split('\n');
    const kv = [];
    const notes = [];
    let intro = '';
    const ctas = [];
    const seenCtas = {};

    for (let i = 0; i < lines.length; i++) {
        const t = String(lines[i] || '').trim();
        if (!t) continue;
        const m = t.match(/^([^:]{1,80}):\s*(.*)$/);
        if (m) {
            const keyRaw = String(m[1] || '').trim();
            const valueRaw = String(m[2] || '').trim();
            const key = mailFormatLabel_(keyRaw);
            kv.push({ keyRaw: keyRaw, key: key, value: valueRaw });

            if (isHttpUrlMail_(valueRaw)) {
                const keyLow = keyRaw.toLowerCase();
                let ctaLabel = 'Abrir enlace';
                if (keyLow.indexOf('pdf') >= 0) ctaLabel = 'Ver PDF';
                else if (keyLow.indexOf('boleta') >= 0) ctaLabel = 'Firmar boleta';
                else if (keyLow.indexOf('factura') >= 0) ctaLabel = 'Firmar factura';
                const ctaKey = keyLow + '|' + valueRaw;
                if (!seenCtas[ctaKey]) {
                    seenCtas[ctaKey] = true;
                    ctas.push({ label: ctaLabel, url: valueRaw });
                }
            }
            continue;
        }
        if (!intro) intro = t;
        else notes.push(t);
    }

    if (!intro) intro = 'Actualización de cobro de transporte';

    const getVal = function (keys) {
        const wanted = (keys || []).map(function (x) { return String(x || '').toLowerCase(); });
        for (let i = 0; i < kv.length; i++) {
            const k = String(kv[i].keyRaw || '').toLowerCase();
            if (wanted.indexOf(k) >= 0) return String(kv[i].value || '').trim();
        }
        return '';
    };

    const idVal = getVal(['id']);
    const etapaVal = getVal(['etapa']);
    const accionVal = getVal(['accion']);
    const montoVal = getVal(['monto']);

    const badgeHtml = [
        idVal ? ('<span style="display:inline-block;background:#ffffff;border:1px solid ' + tone.line + ';color:#17324d;border-radius:999px;padding:5px 10px;font-size:12px;font-weight:700;margin:0 6px 6px 0;">ID: ' + escapeHtml_(idVal) + '</span>') : '',
        etapaVal ? ('<span style="display:inline-block;background:#ffffff;border:1px solid ' + tone.line + ';color:#17324d;border-radius:999px;padding:5px 10px;font-size:12px;font-weight:700;margin:0 6px 6px 0;">' + escapeHtml_(etapaVal) + '</span>') : '',
        accionVal ? ('<span style="display:inline-block;background:#ffffff;border:1px solid ' + tone.line + ';color:#17324d;border-radius:999px;padding:5px 10px;font-size:12px;font-weight:700;margin:0 6px 6px 0;">' + escapeHtml_(accionVal) + '</span>') : '',
        (montoVal && !/^s\//i.test(montoVal)) ? ('<span style="display:inline-block;background:#ffffff;border:1px solid ' + tone.line + ';color:#17324d;border-radius:999px;padding:5px 10px;font-size:12px;font-weight:700;margin:0 6px 6px 0;">Monto: S/ ' + escapeHtml_(montoVal) + '</span>') : '',
        (montoVal && /^s\//i.test(montoVal)) ? ('<span style="display:inline-block;background:#ffffff;border:1px solid ' + tone.line + ';color:#17324d;border-radius:999px;padding:5px 10px;font-size:12px;font-weight:700;margin:0 6px 6px 0;">Monto: ' + escapeHtml_(montoVal) + '</span>') : ''
    ].join('');

    const rowsHtml = kv.map(function (item) {
        const v = String(item.value || '').trim();
        let valueHtml = '<span style="color:#94a3b8;">-</span>';
        if (v) {
            if (isHttpUrlMail_(v)) {
                const host = mailHostLabel_(v);
                valueHtml =
                    '<a href="' + escapeHtml_(v) + '" target="_blank" rel="noopener" ' +
                    'style="display:inline-block;padding:6px 10px;border:1px solid ' + tone.line + ';border-radius:8px;background:#ffffff;color:' + tone.accent + ';text-decoration:none;font-weight:700;font-size:12px;">Abrir enlace</a>' +
                    (host ? ('<div style="font-size:11px;color:#6b7280;margin-top:4px;">' + escapeHtml_(host) + '</div>') : '');
            } else {
                valueHtml = escapeHtml_(v);
            }
        }
        return '' +
            '<tr>' +
            '<td style="padding:10px 12px;border-bottom:1px solid #eef2f7;color:#5b728b;font-size:12px;font-weight:700;width:34%;">' + escapeHtml_(item.key) + '</td>' +
            '<td style="padding:10px 12px;border-bottom:1px solid #eef2f7;color:#17324d;font-size:13px;line-height:1.35;word-break:break-word;">' + valueHtml + '</td>' +
            '</tr>';
    }).join('');

    const notesHtml = notes.length
        ? notes.map(function (t) {
            return '<div style="margin:0 0 8px 0;color:#334155;font-size:13px;line-height:1.45;">' + escapeHtml_(t) + '</div>';
        }).join('')
        : '';

    const ctasHtml = ctas.length
        ? ctas.map(function (x) { return mailCtaHtml_(x.label, x.url, tone.accent); }).join('')
        : '';

    const skuRowsHtml = skuRows.map(function (item, idx) {
        const odd = (idx % 2) === 0;
        return '' +
            '<tr>' +
            '<td style="padding:9px 10px;border-bottom:1px solid #eef2f7;color:#17324d;font-size:12px;font-weight:700;background:' + (odd ? '#ffffff' : '#fbfdff') + ';white-space:nowrap;">' + escapeHtml_(item.codigo) + '</td>' +
            '<td style="padding:9px 10px;border-bottom:1px solid #eef2f7;color:#334155;font-size:12px;line-height:1.35;background:' + (odd ? '#ffffff' : '#fbfdff') + ';">' + escapeHtml_(item.descripcion) + '</td>' +
            '<td style="padding:9px 10px;border-bottom:1px solid #eef2f7;color:#17324d;font-size:12px;font-weight:700;text-align:right;background:' + (odd ? '#ffffff' : '#fbfdff') + ';white-space:nowrap;">' + escapeHtml_(item.cantidad) + '</td>' +
            '</tr>';
    }).join('');

    const skuTableHtml = skuRowsHtml
        ? ('<div style="padding:14px 18px 0;">' +
            '<div style="font-size:12px;color:#5b728b;font-weight:700;margin:0 0 8px 0;text-transform:uppercase;letter-spacing:.5px;">SKUs (' + String(skuRows.length) + ')</div>' +
            '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:separate;border-spacing:0;border:1px solid #e6edf7;border-radius:12px;overflow:hidden;background:#ffffff;">' +
            '<tr>' +
            '<td style="padding:8px 10px;background:#f7faff;border-bottom:1px solid #dfe8f4;color:#4c678b;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.4px;width:22%;">Codigo</td>' +
            '<td style="padding:8px 10px;background:#f7faff;border-bottom:1px solid #dfe8f4;color:#4c678b;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.4px;">Descripcion</td>' +
            '<td style="padding:8px 10px;background:#f7faff;border-bottom:1px solid #dfe8f4;color:#4c678b;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.4px;text-align:right;width:18%;">Cantidad</td>' +
            '</tr>' +
            skuRowsHtml +
            '</table>' +
            '</div>')
        : '';

    return '' +
        '<!DOCTYPE html>' +
        '<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>' +
        '<body style="margin:0;padding:0;background:#f3f6fb;font-family:Segoe UI, Roboto, Arial, sans-serif;color:#17324d;">' +
        '<div style="display:none;max-height:0;overflow:hidden;opacity:0;">' + escapeHtml_(intro) + '</div>' +
        '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f6fb;margin:0;padding:0;border-collapse:collapse;">' +
        '<tr><td align="center" style="padding:22px 10px;">' +
        '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:780px;border-collapse:collapse;">' +
        '<tr>' +
        '<td style="background:#ffffff;border:1px solid #dde6f1;border-radius:14px;overflow:hidden;box-shadow:0 8px 24px rgba(15,39,74,.07);">' +
        '<div style="height:5px;background:' + tone.accent + ';"></div>' +
        '<div style="padding:16px 18px 12px;background:linear-gradient(180deg,#ffffff 0%,' + tone.soft + ' 100%);border-bottom:1px solid #e9eef6;">' +
        '<div style="font-size:11px;letter-spacing:.8px;text-transform:uppercase;color:#5b728b;font-weight:700;margin-bottom:6px;">Cobro Transporte</div>' +
        '<div style="font-size:20px;line-height:1.2;color:#17324d;font-weight:800;">' + escapeHtml_(prettySubject || rawSubject || 'Notificacion') + '</div>' +
        (badgeHtml ? ('<div style="margin-top:10px;">' + badgeHtml + '</div>') : '') +
        '</div>' +

        '<div style="padding:14px 18px 0;">' +
        '<div style="border:1px solid ' + tone.line + ';background:' + tone.soft + ';border-radius:12px;padding:12px 14px;">' +
        '<div style="font-size:13px;color:#17324d;font-weight:700;margin-bottom:4px;">Resumen</div>' +
        '<div style="font-size:13px;color:#334155;line-height:1.45;">' + escapeHtml_(intro) + '</div>' +
        '</div>' +
        '</div>' +

        (ctasHtml
            ? ('<div style="padding:14px 18px 0;">' +
                '<div style="font-size:12px;color:#5b728b;font-weight:700;margin:0 0 8px 0;text-transform:uppercase;letter-spacing:.5px;">Acciones rapidas</div>' +
                '<div>' + ctasHtml + '</div>' +
                '</div>')
            : '') +

        (rowsHtml
            ? ('<div style="padding:14px 18px 0;">' +
                '<div style="font-size:12px;color:#5b728b;font-weight:700;margin:0 0 8px 0;text-transform:uppercase;letter-spacing:.5px;">Detalle</div>' +
                '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:separate;border-spacing:0;border:1px solid #e6edf7;border-radius:12px;overflow:hidden;background:#ffffff;">' +
                rowsHtml +
                '</table>' +
                '</div>')
            : '') +

        skuTableHtml +

        (notesHtml
            ? ('<div style="padding:14px 18px 0;">' +
                '<div style="font-size:12px;color:#5b728b;font-weight:700;margin:0 0 8px 0;text-transform:uppercase;letter-spacing:.5px;">Observaciones</div>' +
                '<div style="border:1px solid #e6edf7;border-radius:12px;background:#ffffff;padding:12px 14px;">' + notesHtml + '</div>' +
                '</div>')
            : '') +

        '<div style="padding:16px 18px 18px;">' +
        '<div style="border-top:1px solid #edf2f8;padding-top:12px;font-size:11px;line-height:1.45;color:#6b7280;">' +
        'Este es un correo automatico del flujo de Cobro Transporte. Si no reconoce esta notificacion, contacte al administrador del sistema.' +
        '</div>' +
        '</div>' +
        '</td>' +
        '</tr>' +
        '</table>' +
        '</td></tr>' +
        '</table>' +
        '</body></html>';
}

function buildMailBodies_(subject, bodyInput) {
    const isObj = bodyInput && typeof bodyInput === 'object';
    let text = isObj ? String(bodyInput.text || bodyInput.body || '') : String(bodyInput || '');
    let html = isObj ? String(bodyInput.html || '') : '';
    if (!text && html) {
        text = String(html || '')
            .replace(/<style[\s\S]*?<\/style>/gi, '')
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<\/p>/gi, '\n')
            .replace(/<\/div>/gi, '\n')
            .replace(/<[^>]+>/g, ' ')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#039;/g, "'")
            .replace(/[ \t]+\n/g, '\n')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    }
    if (!html) html = buildStyledEmailHtml_(subject, text);
    return { text: text, html: html };
}

function getResendMailConfig_() {
    const props = PropertiesService.getScriptProperties();
    const apiKey = String(props.getProperty(RESEND_API_KEY_PROP) || getConfigValue_('resendApiKey') || '').trim();
    const from = String(getConfigValue_('resendFrom') || props.getProperty(RESEND_FROM_PROP) || '').trim();
    const replyTo = String(getConfigValue_('resendReplyTo') || props.getProperty(RESEND_REPLY_TO_PROP) || '').trim();
    const endpoint = String(getConfigValue_('resendApiUrl') || 'https://api.resend.com/emails').trim();
    const enabledByCfg = boolConfig_('resendEnabled', false);
    const fallbackToMailApp = boolConfig_('resendFallbackMailApp', true);
    const autoEnabled = Boolean(apiKey && from);
    return {
        enabled: Boolean((enabledByCfg || autoEnabled) && apiKey && from),
        fallbackToMailApp: fallbackToMailApp,
        apiKey: apiKey,
        from: from,
        replyTo: replyTo,
        endpoint: endpoint
    };
}

function buildResendHeaders_(apiKey) {
    const headers = {
        Accept: 'application/json',
        'User-Agent': RESEND_USER_AGENT
    };
    if (apiKey) headers.Authorization = 'Bearer ' + String(apiKey || '').trim();
    return headers;
}

function sendWithResend_(toCsv, subject, body, ccCsv, cfg) {
    const toArr = splitEmails_(toCsv);
    if (!toArr.length) return { success: false, provider: 'resend', message: 'Sin destinatario.' };
    try {
        const mailBodies = buildMailBodies_(subject, body);
        const payload = {
            from: cfg.from,
            to: toArr,
            subject: String(subject || ''),
            text: String(mailBodies.text || '')
        };
        if (mailBodies.html) payload.html = String(mailBodies.html || '');
        const ccArr = splitEmails_(ccCsv);
        if (ccArr.length) payload.cc = ccArr;
        const rtArr = splitEmails_(cfg.replyTo);
        if (rtArr.length === 1) payload.reply_to = rtArr[0];
        if (rtArr.length > 1) payload.reply_to = rtArr;

        const resp = UrlFetchApp.fetch(cfg.endpoint, {
            method: 'post',
            contentType: 'application/json',
            muteHttpExceptions: true,
            headers: buildResendHeaders_(cfg.apiKey),
            payload: JSON.stringify(payload)
        });
        const statusCode = Number(resp.getResponseCode() || 0);
        const raw = String(resp.getContentText() || '');
        if (statusCode >= 200 && statusCode < 300) {
            let msgId = '';
            try {
                const obj = JSON.parse(raw || '{}');
                msgId = String(obj.id || '');
            } catch (e) { }
            return { success: true, provider: 'resend', id: msgId, statusCode: statusCode };
        }
        let message = 'Resend HTTP ' + statusCode;
        try {
            const objErr = JSON.parse(raw || '{}');
            if (objErr && objErr.message) message += ': ' + String(objErr.message);
            if (objErr && objErr.error && objErr.error.message) message += ': ' + String(objErr.error.message);
        } catch (e) {
            if (raw) message += ': ' + raw.slice(0, 300);
        }
        return { success: false, provider: 'resend', message: message, statusCode: statusCode };
    } catch (e) {
        return { success: false, provider: 'resend', message: String(e) };
    }
}

function sendStageMail_(to, subject, body, cc) {
    let toList = csvEmails_(to);
    let ccList = csvEmails_(cc);
    const adminCc = csvEmails_(resolveAdminEmail_());
    if (adminCc) ccList = mergeEmails_(ccList, adminCc);
    // Si no hay TO pero sí CC, usar CC como TO para no perder el aviso.
    if (!toList && ccList) {
        toList = ccList;
        ccList = '';
    }
    if (ccList) ccList = removeEmails_(ccList, toList);
    if (!toList) return { success: false, message: 'Sin destinatario.' };

    const resendCfg = getResendMailConfig_();
    const mailBodies = buildMailBodies_(subject, body);
    if (resendCfg.enabled) {
        const resendRes = sendWithResend_(toList, subject, mailBodies, ccList, resendCfg);
        if (resendRes.success) return resendRes;
        if (!resendCfg.fallbackToMailApp) return resendRes;
    }

    try {
        const payload = {
            to: toList,
            subject,
            body: String(mailBodies.text || ''),
            htmlBody: String(mailBodies.html || ''),
            name: 'Cobro Transporte'
        };
        if (ccList) payload.cc = ccList;
        MailApp.sendEmail(payload);
        return { success: true };
    } catch (e) {
        return { success: false, message: String(e) };
    }
}

function logResultadoConsola_(tag, payload) {
    const out = String(tag || 'LOG') + ' ' + safeJson_(payload || {});
    try { console.log(out); } catch (e) { }
    try { Logger.log(out); } catch (e2) { }
}

/**
 * Ejecutar una sola vez desde el editor para solicitar/activar permisos OAuth
 * necesarios para Resend (UrlFetchApp) y fallback de correo (MailApp).
 */
function activarPermisosResend() {
    const cfg = getResendMailConfig_();
    const probeUrl = 'https://api.resend.com/domains';
    const requiredScopes = [
        'https://www.googleapis.com/auth/script.external_request',
        'https://www.googleapis.com/auth/script.send_mail'
    ];

    try {
        // Fuerza permiso de MailApp (fallback).
        const cuotaMail = MailApp.getRemainingDailyQuota();

        const headers = {};
        Object.assign(headers, buildResendHeaders_(cfg.apiKey));

        // Fuerza permiso de UrlFetchApp (Resend).
        const resp = UrlFetchApp.fetch(probeUrl, {
            method: 'get',
            muteHttpExceptions: true,
            headers: headers
        });

        const out = {
            success: true,
            authorizedExternalRequest: true,
            statusCode: Number(resp.getResponseCode() || 0),
            probeUrl: probeUrl,
            fallbackMailQuota: Number(cuotaMail || 0),
            message: 'Permisos activos. Si statusCode=401/403 revise API key o dominio en Resend.',
            requiredScopes: requiredScopes
        };
        logResultadoConsola_('[activarPermisosResend]', out);
        return out;
    } catch (e) {
        const outErr = {
            success: false,
            authorizedExternalRequest: false,
            message: String(e && e.message ? e.message : e),
            hint: 'Ejecute esta funcion desde Apps Script y acepte la ventana de permisos.',
            requiredScopes: requiredScopes
        };
        logResultadoConsola_('[activarPermisosResend]', outErr);
        return outErr;
    }
}

function testResendSend(destino) {
    const cfg = getResendMailConfig_();
    const toCsv = csvEmails_(destino || resolveSupervisorEmail_() || '');
    const cfgOut = {
        enabled: cfg.enabled,
        hasApiKey: Boolean(cfg.apiKey),
        hasFrom: Boolean(cfg.from),
        endpoint: cfg.endpoint,
        fallbackToMailApp: cfg.fallbackToMailApp,
        to: toCsv
    };
    if (!toCsv) {
        const resNoTo = { success: false, message: 'Indique destino o configure correo de Supervisor.', config: cfgOut };
        logResultadoConsola_('[testResendSend]', resNoTo);
        return resNoTo;
    }
    if (!cfg.enabled) {
        const resDisabled = { success: false, message: 'Resend no configurado o deshabilitado.', config: cfgOut };
        logResultadoConsola_('[testResendSend]', resDisabled);
        return resDisabled;
    }
    const subject = '[TEST] Resend Cobro Transporte';
    const body = 'Prueba de envio desde Apps Script a traves de Resend.\nFecha: ' + formatDateTimeSafe_(new Date());
    const res = sendWithResend_(toCsv, subject, body, '', cfg);
    const out = {
        success: Boolean(res && res.success),
        provider: String(res && res.provider || 'resend'),
        message: String(res && res.message || ''),
        statusCode: Number(res && res.statusCode || 0),
        id: String(res && res.id || ''),
        config: cfgOut
    };
    logResultadoConsola_('[testResendSend]', out);
    return out;
}

/**
 * Valida conexion tecnica con Resend sin enviar correos.
 * Hace una consulta GET a /domains usando la API key configurada.
 */
function validarConexionResend() {
    const cfg = getResendMailConfig_();
    const cfgOut = {
        enabled: cfg.enabled,
        hasApiKey: Boolean(cfg.apiKey),
        hasFrom: Boolean(cfg.from),
        endpoint: cfg.endpoint,
        fallbackToMailApp: cfg.fallbackToMailApp
    };

    if (!cfg.apiKey) {
        const resNoKey = {
            success: false,
            connected: false,
            message: 'Falta configurar la API key de Resend.',
            config: cfgOut
        };
        logResultadoConsola_('[validarConexionResend]', resNoKey);
        return resNoKey;
    }

    const probeUrl = 'https://api.resend.com/domains';
    try {
        const resp = UrlFetchApp.fetch(probeUrl, {
            method: 'get',
            muteHttpExceptions: true,
            headers: buildResendHeaders_(cfg.apiKey)
        });
        const statusCode = Number(resp.getResponseCode() || 0);
        const raw = String(resp.getContentText() || '');
        const ok = statusCode >= 200 && statusCode < 300;

        if (ok) {
            let domains = 0;
            try {
                const obj = JSON.parse(raw || '{}');
                domains = Array.isArray(obj.data) ? obj.data.length : 0;
            } catch (e) { }

            let message = 'Conexion OK con Resend.';
            if (!cfg.from) message += ' Falta configurar resendFrom/RESEND_FROM para enviar.';
            const resOk = {
                success: true,
                connected: true,
                statusCode: statusCode,
                probeUrl: probeUrl,
                domains: domains,
                message: message,
                config: cfgOut
            };
            logResultadoConsola_('[validarConexionResend]', resOk);
            return resOk;
        }

        let errMsg = 'Resend HTTP ' + statusCode;
        try {
            const objErr = JSON.parse(raw || '{}');
            if (objErr && objErr.message) errMsg += ': ' + String(objErr.message);
            if (objErr && objErr.error && objErr.error.message) errMsg += ': ' + String(objErr.error.message);
        } catch (e) {
            if (raw) errMsg += ': ' + raw.slice(0, 300);
        }
        const resHttp = {
            success: false,
            connected: false,
            statusCode: statusCode,
            probeUrl: probeUrl,
            message: errMsg,
            config: cfgOut
        };
        logResultadoConsola_('[validarConexionResend]', resHttp);
        return resHttp;
    } catch (e) {
        const resErr = {
            success: false,
            connected: false,
            message: 'Error de conexion con Resend: ' + String(e),
            probeUrl: probeUrl,
            config: cfgOut
        };
        logResultadoConsola_('[validarConexionResend]', resErr);
        return resErr;
    }
}

/**
 * Script de prueba end-to-end para correo.
 * - Valida destinos por Area en hoja "Correos".
 * - Envia 1 correo de prueba por area usando sendStageMail_ (Resend/MailApp).
 * - Si se indica destinoPrueba, TODOS los envios van a ese correo (recomendado).
 */
function scriptPruebaCorreo(destinoPrueba) {
    const overrideTo = csvEmails_(destinoPrueba || '');
    const areas = [AREA.LI, AREA.TRANSPORTE, AREA.INVENTARIO, AREA.CYC, AREA.FACTURACION, AREA.CONTABILIDAD, 'Supervisor'];
    const stamp = formatDateTimeSafe_(new Date());
    const resendCfg = getResendMailConfig_();
    const detalle = [];

    for (let i = 0; i < areas.length; i++) {
        const area = areas[i];
        const target = getCorreosAreaTarget_(area);
        const toFinal = overrideTo || csvEmails_(target.to);
        const ccFinal = overrideTo ? '' : csvEmails_(target.cc);

        if (!toFinal && !ccFinal) {
            detalle.push({
                area: area,
                ok: false,
                toOriginal: csvEmails_(target.to),
                ccOriginal: csvEmails_(target.cc),
                toEnviado: '',
                ccEnviado: '',
                proveedor: 'ninguno',
                message: 'Sin destinatario configurado para el area.'
            });
            continue;
        }

        const subject = '[TEST] Correo flujo | ' + area + ' | ' + stamp;
        const body = [
            'Prueba de envio de correos del flujo de Cobro Transporte.',
            'Área: ' + area,
            'Fecha: ' + stamp,
            'Destino configurado (to): ' + String(target.to || ''),
            'Destino configurado (cc): ' + String(target.cc || ''),
            overrideTo ? ('Destino forzado para prueba: ' + overrideTo) : 'Destino forzado para prueba: no'
        ].join('\n');

        const res = sendStageMail_(toFinal, subject, body, ccFinal);
        detalle.push({
            area: area,
            ok: Boolean(res && res.success),
            toOriginal: csvEmails_(target.to),
            ccOriginal: csvEmails_(target.cc),
            toEnviado: toFinal,
            ccEnviado: ccFinal,
            proveedor: String(res && res.provider ? res.provider : 'mailapp'),
            statusCode: Number(res && res.statusCode || 0),
            id: String(res && res.id || ''),
            message: String(res && res.message || '')
        });
    }

    let ok = 0;
    for (let j = 0; j < detalle.length; j++) {
        if (detalle[j].ok) ok++;
    }
    const fail = detalle.length - ok;

    appendBitacora_({
        id: 'TEST-MAIL',
        usuario: 'sistema',
        etapa: '-',
        accion: 'Script prueba correo',
        resultado: fail ? 'PARCIAL' : 'OK',
        detalle: safeJson_({
            fecha: stamp,
            overrideTo: overrideTo,
            resumen: { ok: ok, fail: fail, total: detalle.length },
            detalle: detalle
        })
    });

    const out = {
        success: fail === 0,
        fecha: stamp,
        transporte: {
            resendEnabled: resendCfg.enabled,
            resendFrom: resendCfg.from || '',
            resendEndpoint: resendCfg.endpoint || '',
            fallbackToMailApp: resendCfg.fallbackToMailApp
        },
        resumen: {
            ok: ok,
            fail: fail,
            total: detalle.length
        },
        detalle: detalle
    };
    logResultadoConsola_('[scriptPruebaCorreo]', out);
    return out;
}

function subjectPlantilla_(id, titulo) {
    return '[COBRO TRANSPORTE] ' + id + ' | ' + titulo;
}

function buildMailVars_(detalle, extras) {
    const tz = Session.getScriptTimeZone();
    const out = {
        id: detalle.id || '',
        etapa: detalle.etapa || '',
        proveedor: detalle.proveedor || '',
        ruta: detalle.ruta || '',
        ovNumero: detalle.ovNumero || '',
        monto: Number(detalle.monto || 0).toFixed(2),
        pdfUrl: detalle.pdfUrl || '',
        actor: detalle.actorEmail || 'sistema',
        fecha: Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd HH:mm:ss'),
        accion: detalle.accion || '',
        firmaBoletaLink: detalle.firmaBoletaLink || '',
        firmaFacturaLink: detalle.firmaFacturaLink || '',
        vence: detalle.vence || '',
        marca: detalle.marca || ''
    };
    const ext = (extras && typeof extras === 'object') ? extras : {};
    Object.keys(ext).forEach(k => out[k] = ext[k]);
    return out;
}

function notifyMultiChannel_(ctx, subject, body, action) {
    const enabled = boolConfig_('chatWebhookEnabled', false);
    if (!enabled) return;
    const text = [
        'Cobro Transporte',
        'Acción: ' + String(action || ''),
        'ID: ' + String(ctx.id || ''),
        'Etapa: ' + String(ctx.etapa || ''),
        'Asunto: ' + String(subject || ''),
        '',
        String(body || '')
    ].join('\n');
    sendChatWebhook_(text);
}

function onEtapaChanged_(ctx) {
    const row = ctx.rowData || [];
    const sh = ctx.sheet || null;
    const rowNum = Number(ctx.rowNum || 0);
    const headers = ctx.headers || [];
    const headerMap = buildHeaderMap_(headers);
    const etapa = normalizeEtapa_(ctx.etapa);
    const idxEtapa = etapaIndex_(etapa);
    const skipRowWrite = Boolean(ctx.skipRowWrite);

    const detalle = {
        id: ctx.id,
        etapa,
        proveedor: String(row[2] || ''),
        proveedorCodigo: String(row[3] || ''),
        ruta: String(row[5] || ''),
        ovNumero: rowText_(row, headerMap, [WF.ovNumero]),
        rmNumero: rowText_(row, headerMap, [WF.rmNumero]),
        monto: Number(row[12] || 0),
        pdfUrl: String(row[COL_PDF_URL - 1] || ''),
        actorEmail: String(ctx.actorEmail || 'sistema')
    };

    const updates = {};
    updates[WF.areaResponsableActual] = areaResponsablePorEtapa_(idxEtapa);
    const baseSlaDate = rowDate_(row, headerMap, [WF.fechaIngresoEtapaActual])
        || toDateDash_(row[COL_ULT_ACT - 1])
        || new Date();
    const stageDue = resolveStageSlaLimit_(row, headerMap, idxEtapa);
    if (!rowDate_(row, headerMap, [WF.fechaIngresoEtapaActual])) {
        updates[WF.fechaIngresoEtapaActual] = baseSlaDate;
    }
    if (!rowDate_(row, headerMap, [WF.fechaLimiteSlaActual])) {
        updates[WF.fechaLimiteSlaActual] = stageDue || '';
    }

    if (idxEtapa === 2) {
        const lim = rowDate_(row, headerMap, [WF.fechaLimiteFirmaBoleta]) || stageDue || computeStageSlaDeadline_(idxEtapa, baseSlaDate);
        updates[WF.fechaLimiteFirmaBoleta] = lim || '';
    }

    if (idxEtapa === 7) {
        const limF = rowDate_(row, headerMap, [WF.fechaLimiteFirmaFactura]) || stageDue || computeStageSlaDeadline_(idxEtapa, baseSlaDate);
        updates[WF.fechaLimiteFirmaFactura] = limF || '';
    }

    if (sh && rowNum > 0 && !skipRowWrite) {
        writeRowFields_(sh, rowNum, headerMap, updates);
    }
    applyRowUpdatesToRow_(row, headerMap, updates);

    const notifyCfg = getStageNotifySetting_(idxEtapa);
    const notifyEnabled = parseBoolLoose_(notifyCfg && notifyCfg.active, true);
    const notifyRecipients = notifyEnabled
        ? resolveStageNotifyRecipients_(notifyCfg, row, headerMap, detalle.proveedorCodigo, detalle.proveedor)
        : { to: '', cc: '' };

    const limiteBoleta = rowDate_(row, headerMap, [WF.fechaLimiteFirmaBoleta]);
    const limiteFactura = rowDate_(row, headerMap, [WF.fechaLimiteFirmaFactura]);
    const firmaBoletaLink = rowText_(row, headerMap, [WF.firmaBoletaLink]) || getConfigValue_('urlFirmaBoleta') || rowText_(row, headerMap, [WF.firmaBoletaUrl]);
    const firmaFacturaLink = rowText_(row, headerMap, [WF.firmaFacturaLink]) || getConfigValue_('urlFirmaFactura') || rowText_(row, headerMap, [WF.firmaFacturaUrl]);

    const actions = [];
    function pushAction_(cfg) {
        const accion = String(cfg.accion || '').trim();
        const to = String(cfg.to || '').trim();
        const cc = String(cfg.cc || '').trim();
        const templateCode = String(cfg.templateCode || 'ETAPA_GENERAL').trim();
        const subjectFallback = String(cfg.subject || subjectPlantilla_(detalle.id, accion)).trim();
        const bodyFallback = String(cfg.body || buildEtapaEmailBody_(detalle, accion)).trim();
        const vars = buildMailVars_(detalle, {
            accion: accion,
            firmaBoletaLink: firmaBoletaLink,
            firmaFacturaLink: firmaFacturaLink,
            vence: String(cfg.vence || '').trim()
        });
        const tpl = getTemplateByCode_(templateCode, subjectFallback, bodyFallback, vars);
        actions.push({
            accion: accion,
            to: to,
            cc: cc,
            subject: String(tpl.subject || subjectFallback),
            body: String(tpl.body || bodyFallback)
        });
    }

    if (idxEtapa === 2 && notifyEnabled) {
        pushAction_({
            accion: 'Firma boleta requerida',
            // El flujo inicia en etapa 2 desde Logistica Inversa.
            // Si proveedor no tiene correo, cae a transporte/supervisor según configuración.
            to: notifyRecipients.to,
            cc: notifyRecipients.cc,
            templateCode: 'ETAPA_FIRMA_BOLETA',
            subject: subjectPlantilla_(detalle.id, 'Firma boleta requerida' + (limiteBoleta ? ' (vence ' + formatDDMM_(limiteBoleta) + ')' : '')),
            body: buildEtapaEmailBody_(detalle, 'Firma boleta requerida') +
                '\n' + (firmaBoletaLink ? ('Link firma boleta: ' + firmaBoletaLink) : 'Link firma boleta: pendiente de configurar.'),
            vence: formatDDMM_(limiteBoleta)
        });
    }

    if (idxEtapa === 3 && notifyEnabled) {
        pushAction_({
            accion: 'Validar inventario',
            to: notifyRecipients.to,
            cc: notifyRecipients.cc,
            templateCode: 'ETAPA_GENERAL',
            subject: subjectPlantilla_(detalle.id, 'Validar inventario'),
            body: buildEtapaEmailBody_(detalle, 'Validar inventario')
        });
    }

    if (idxEtapa === 4 && notifyEnabled) {
        pushAction_({
            accion: 'Generar OV',
            to: notifyRecipients.to,
            cc: notifyRecipients.cc,
            templateCode: 'ETAPA_GENERAL',
            subject: subjectPlantilla_(detalle.id, 'Generar OV'),
            body: buildEtapaEmailBody_(detalle, 'Generar OV')
        });
    }

    if (idxEtapa === 5 && notifyEnabled) {
        pushAction_({
            accion: 'Crear ruta',
            to: notifyRecipients.to,
            cc: notifyRecipients.cc,
            templateCode: 'ETAPA_GENERAL',
            subject: subjectPlantilla_(detalle.id, 'Crear ruta'),
            body: buildEtapaEmailBody_(detalle, 'Crear ruta')
        });
    }

    if (idxEtapa === 6 && notifyEnabled) {
        pushAction_({
            accion: 'Emitir factura',
            // Etapa 6: pasa a Facturacion para emitir/cargar factura (no pedir firma todavia).
            to: notifyRecipients.to,
            cc: notifyRecipients.cc,
            templateCode: 'ETAPA_GENERAL',
            subject: subjectPlantilla_(detalle.id, 'Emitir factura'),
            body: buildEtapaEmailBody_(detalle, 'Emitir factura')
        });
    }

    if (idxEtapa === 7 && notifyEnabled) {
        pushAction_({
            accion: 'Firma factura requerida',
            // Etapa 7: ya corresponde pedir firma de factura al proveedor.
            to: notifyRecipients.to,
            cc: notifyRecipients.cc,
            templateCode: 'ETAPA_FIRMA_FACTURA',
            subject: subjectPlantilla_(detalle.id, 'Firma factura requerida (vence ' + formatDDMM_(limiteFactura) + ')'),
            body: buildEtapaEmailBody_(detalle, 'Firma factura requerida') +
                '\n' + (firmaFacturaLink ? ('Link firma factura: ' + firmaFacturaLink) : 'Link firma factura: pendiente de configurar.'),
            vence: formatDDMM_(limiteFactura)
        });
    }

    if (idxEtapa === 8 && notifyEnabled) {
        pushAction_({
            accion: 'Generar liquidación',
            to: notifyRecipients.to,
            cc: notifyRecipients.cc,
            templateCode: 'ETAPA_GENERAL',
            subject: subjectPlantilla_(detalle.id, 'Generar liquidación'),
            body: buildEtapaEmailBody_(detalle, 'Generar liquidación')
        });
    }

    if (idxEtapa === 9 && notifyEnabled) {
        pushAction_({
            accion: 'Gestionar pago',
            to: notifyRecipients.to,
            cc: notifyRecipients.cc,
            templateCode: 'ETAPA_GENERAL',
            subject: subjectPlantilla_(detalle.id, 'Gestionar pago'),
            body: buildEtapaEmailBody_(detalle, 'Gestionar pago')
        });
    }

    if (idxEtapa === 10 && notifyEnabled) {
        pushAction_({
            accion: 'Aplicación de pago',
            to: notifyRecipients.to,
            cc: notifyRecipients.cc,
            templateCode: 'ETAPA_GENERAL',
            subject: subjectPlantilla_(detalle.id, 'Aplicación de pago'),
            body: buildEtapaEmailBody_(detalle, 'Aplicación de pago')
        });
    }

    const result = [];
    for (let i = 0; i < actions.length; i++) {
        const a = actions[i];
        if (!a.to) {
            appendBitacora_({
                id: detalle.id,
                usuario: detalle.actorEmail,
                etapa,
                accion: a.accion,
                resultado: 'Sin envio',
                destinatario: '',
                detalle: 'No se encontro correo destino para la plantilla.'
            });
            result.push({ accion: a.accion, ok: false, message: 'Sin destinatario' });
            continue;
        }

        const body = a.body || buildEtapaEmailBody_(detalle, a.accion);
        const mailRes = sendStageMail_(a.to, a.subject, body, a.cc);
        if (mailRes.success) {
            notifyMultiChannel_(detalle, a.subject, body, a.accion);
        }
        appendBitacora_({
            id: detalle.id,
            usuario: detalle.actorEmail,
            etapa,
            accion: a.accion,
            resultado: mailRes.success ? 'Enviado' : 'Error',
            destinatario: csvEmails_(a.to),
            detalle: mailRes.success ? 'Correo enviado.' : mailRes.message
        });
        result.push({ accion: a.accion, ok: mailRes.success, to: csvEmails_(a.to), cc: csvEmails_(a.cc || ''), message: mailRes.message || '' });
    }

    try {
        const accionNotif = actions.length ? String(actions[0].accion || '') : 'Cambio de etapa';
        createStageNotifications_({
            id: detalle.id,
            etapa: etapa,
            oldEtapa: String(ctx.oldEtapa || ''),
            actorEmail: detalle.actorEmail,
            row: row,
            headerMap: headerMap,
            accion: accionNotif,
            proveedor: detalle.proveedor,
            ruta: detalle.ruta,
            monto: detalle.monto
        });
    } catch (e) { }

    return result;
}

function resolveResponsableEmailFromRow_(row, headerMap) {
    const direct = readByHeader_(row, headerMap || {}, [
        'ResponsableEmail', 'responsable_email', 'email_responsable'
    ]);
    if (direct && direct.indexOf('@') >= 0) return String(direct).trim().toLowerCase();
    const responsable = String((row && row[14]) || '').trim();
    if (!responsable) return '';
    if (responsable.indexOf('@') >= 0) return responsable.toLowerCase();
    const user = findUserRecordByName_(responsable);
    return user && user.email ? String(user.email).trim().toLowerCase() : '';
}

function buildStageNotificationMessage_(data) {
    const detalle = data || {};
    const etapa = String(detalle.etapa || '').trim();
    const oldEtapa = String(detalle.oldEtapa || '').trim();
    const accion = String(detalle.accion || '').trim();
    const proveedor = String(detalle.proveedor || '').trim();
    const ruta = String(detalle.ruta || '').trim();
    const monto = Number(detalle.monto || 0);
    const parts = [];
    if (oldEtapa && etapa) parts.push('Etapa: ' + oldEtapa + ' → ' + etapa);
    else if (etapa) parts.push('Etapa: ' + etapa);
    if (accion) parts.push('Acción: ' + accion);
    if (proveedor) parts.push('Proveedor: ' + proveedor);
    if (ruta) parts.push('Ruta: ' + ruta);
    if (monto) parts.push('Monto: S/ ' + monto.toFixed(2));
    return parts.join(' | ');
}

function createInAppNotification_(payload) {
    const userEmail = String(payload.userEmail || '').trim().toLowerCase();
    if (!userEmail) return null;
    const row = {
        id: Utilities.getUuid(),
        created_at: new Date().toISOString(),
        user_email: userEmail,
        cobro_id: String(payload.cobroId || ''),
        etapa: String(payload.etapa || ''),
        accion: String(payload.accion || ''),
        message: String(payload.message || ''),
        read_at: null
    };
    try {
        supabaseInsertRows_('ct_notifications', row);
    } catch (e) {
        try { logResultadoConsola_('[createInAppNotification_]', { error: String(e) }); } catch (e2) { }
    }
    return row;
}

function createStageNotifications_(ctx) {
    const data = ctx || {};
    const row = Array.isArray(data.row) ? data.row : [];
    const map = data.headerMap || {};
    const responsableEmail = resolveResponsableEmailFromRow_(row, map);
    const adminEmails = splitEmails_(resolveAdminUsersEmails_());
    const recipients = splitEmails_(mergeEmails_(responsableEmail, adminEmails.join(',')));
    if (!recipients.length) return { success: false, message: 'Sin destinatarios' };

    const message = buildStageNotificationMessage_({
        etapa: data.etapa,
        oldEtapa: data.oldEtapa,
        accion: data.accion,
        proveedor: data.proveedor,
        ruta: data.ruta,
        monto: data.monto
    });

    for (let i = 0; i < recipients.length; i++) {
        createInAppNotification_({
            userEmail: recipients[i],
            cobroId: data.id,
            etapa: data.etapa,
            accion: data.accion || 'Cambio de etapa',
            message: message
        });
    }
    return { success: true, count: recipients.length };
}

function getUserNotifications(actorEmail, opts) {
    const profile = getUserProfile_(actorEmail);
    if (!profile.email) return { success: false, message: 'Usuario no autorizado.' };
    const cfg = opts || {};
    const limit = Math.max(1, Math.min(120, Number(cfg.limit || 30)));
    const includeRead = Boolean(cfg.includeRead);
    const query = {
        select: '*',
        order: 'created_at.desc',
        limit: limit,
        user_email: 'eq.' + profile.email
    };
    if (!includeRead) query.read_at = 'is.null';
    const rows = supabaseRequest_('get', 'ct_notifications', query) || [];
    const list = Array.isArray(rows) ? rows : [];
    const unread = list.filter(r => !r.read_at).length;
    return { success: true, rows: list, unread: unread };
}

function markNotificationRead(id, actorEmail) {
    const profile = getUserProfile_(actorEmail);
    if (!profile.email) return { success: false, message: 'Usuario no autorizado.' };
    const nid = String(id || '').trim();
    if (!nid) return { success: false, message: 'ID requerido.' };
    const query = { id: 'eq.' + nid, user_email: 'eq.' + profile.email };
    const payload = { read_at: new Date().toISOString() };
    const res = supabaseRequest_('patch', 'ct_notifications', query, payload, {
        Prefer: 'return=representation'
    });
    return { success: true, rows: res || [] };
}

function markAllNotificationsRead(actorEmail) {
    const profile = getUserProfile_(actorEmail);
    if (!profile.email) return { success: false, message: 'Usuario no autorizado.' };
    const query = { user_email: 'eq.' + profile.email, read_at: 'is.null' };
    const payload = { read_at: new Date().toISOString() };
    const res = supabaseRequest_('patch', 'ct_notifications', query, payload, {
        Prefer: 'return=representation'
    });
    return { success: true, rows: res || [] };
}

function parseJsonObj_(raw) {
    try {
        const o = JSON.parse(String(raw || '{}'));
        return (o && typeof o === 'object') ? o : {};
    } catch (e) {
        return {};
    }
}

function slaStatusText_(row, headerMap, etapaIdx) {
    const cfg = getStageSlaSetting_(etapaIdx);
    if (!cfg || !cfg.active || Number(cfg.slaHours || 0) <= 0) return '-';
    const limit = resolveStageSlaLimit_(row, headerMap, etapaIdx);
    if (!limit) return 'Sin limite';

    const now = new Date();
    const diff = limit.getTime() - now.getTime();
    if (diff <= 0) return 'Vencido';
    const hours = Math.ceil(diff / (60 * 60 * 1000));
    return 'Vence en ' + hours + 'h';
}

function runSlaReminderTick() {
    const ss = getDataStore_();
    const sh = ss.getSheetByName('Aprobaciones');
    if (!sh || sh.getLastRow() < 2) return { checked: 0, sent: 0 };

    const schema = ensureAprobacionesSchema_(sh);
    const lastCol = sh.getLastColumn();
    const headers = sh.getRange(1, 1, 1, lastCol).getValues()[0];
    const map = buildHeaderMap_(headers);
    const rows = sh.getRange(2, 1, sh.getLastRow() - 1, lastCol).getValues();
    const slaCfg = getSlaSettings_();

    let checked = 0;
    let sent = 0;

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 2;
        const id = String(row[0] || '');
        const etapa = normalizeEtapa_(row[COL_ETAPA - 1]);
        const etapaIdx = etapaIndex_(etapa);
        const estado = normalizeEstado_(row[COL_ESTADO - 1]);
        if (estado === 'Cerrado' || estado === 'Observado') continue;
        if (etapaIdx !== 2 && etapaIdx !== 7) continue;
        const stageCfg = getStageSlaSetting_(etapaIdx);
        const stageHours = Math.max(0, Number(stageCfg && stageCfg.slaHours ? stageCfg.slaHours : 0));
        if (!stageCfg || !stageCfg.active || stageHours <= 0) continue;
        checked++;

        const isBoleta = etapaIdx === 2;
        const limit = resolveStageSlaLimit_(row, map, etapaIdx);
        if (!limit) continue;

        const notif = parseJsonObj_(rowText_(row, map, [WF.slaNotif]));
        const keyEsc = isBoleta ? 'boletaEsc' : 'facturaEsc';

        const now = new Date();
        const start = addHours_(limit, -stageHours);
        const elapsedH = (now.getTime() - start.getTime()) / (60 * 60 * 1000);
        const dueTxt = formatDDMM_(limit);

        const emailProveedor = resolveProveedorEmail_(row, map, String(row[3] || ''), String(row[2] || ''));
        const emailTransporte = resolveTransporteEmail_(row, map);
        const emailSupervisor = resolveSupervisorEmail_();
        const ccTransporteArea = getCorreosAreaTarget_(AREA.TRANSPORTE).cc;
        const ccSupervisorArea = getCorreosAreaTarget_('Supervisor').cc;

        const sendReminder = (accion, to, cc, subject) => {
            if (!to) {
                appendBitacora_({
                    id,
                    usuario: 'sistema',
                    etapa,
                    accion,
                    resultado: 'Sin envio',
                    detalle: 'Sin destinatario para SLA.'
                });
                return false;
            }
            const vars = buildMailVars_({
                id: id,
                etapa: etapa,
                proveedor: String(row[2] || ''),
                ruta: String(row[5] || ''),
                ovNumero: rowText_(row, map, [WF.ovNumero]),
                monto: Number(row[12] || 0),
                pdfUrl: String(row[COL_PDF_URL - 1] || ''),
                actorEmail: 'sistema'
            }, {
                accion: accion,
                vence: dueTxt,
                marca: accion
            });
            const fallbackLines = [
                'Recordatorio SLA de firma',
                'ID: ' + id,
                'Etapa: ' + etapa
            ];
            const ovMailVal = String(rowText_(row, map, [WF.ovNumero]) || '').trim();
            if (ovMailVal) fallbackLines.push('OV: ' + ovMailVal);
            fallbackLines.push(
                'Vence: ' + dueTxt,
                'PDF: ' + String(row[COL_PDF_URL - 1] || '')
            );
            const fallback = fallbackLines.join('\n');
            const tplCode = (accion === 'SLA vencido') ? 'SLA_ESCALADO' : 'SLA_REMINDER';
            const tpl = getTemplateByCode_(tplCode, subject, fallback, vars);
            const res = sendStageMail_(to, String(tpl.subject || subject), String(tpl.body || fallback), cc);
            if (res.success) notifyMultiChannel_(vars, String(tpl.subject || subject), String(tpl.body || fallback), accion);
            appendBitacora_({
                id,
                usuario: 'sistema',
                etapa,
                accion,
                resultado: res.success ? 'Enviado' : 'Error',
                destinatario: csvEmails_(to),
                detalle: res.success ? 'Recordatorio SLA enviado.' : res.message
            });
            return res.success;
        };

        const reminderHours = (slaCfg.reminders || []).filter(h => Number(h || 0) > 0 && Number(h || 0) < stageHours);
        let changed = false;
        for (let hIdx = 0; hIdx < reminderHours.length; hIdx++) {
            const h = Number(reminderHours[hIdx] || 0);
            if (!h || elapsedH < h) continue;
            const mark = isBoleta ? ('boleta' + h) : ('factura' + h);
            if (notif[mark]) continue;
            const title = isBoleta
                ? ('Firma boleta requerida (vence ' + dueTxt + ') - Recordatorio ' + h + 'h')
                : ('Firma factura requerida (vence ' + dueTxt + ') - Recordatorio ' + h + 'h');
            if (sendReminder('SLA ' + h + 'h', emailProveedor, mergeEmails_(emailTransporte, ccTransporteArea), subjectPlantilla_(id, title))) {
                notif[mark] = new Date().toISOString();
                sent++;
                changed = true;
            }
        }

        if (now.getTime() > limit.getTime() && !notif[keyEsc]) {
            const title = isBoleta
                ? 'Firma boleta requerida (vence ' + dueTxt + ') - SLA vencido'
                : 'Firma factura requerida (vence ' + dueTxt + ') - SLA vencido';
            const toEsc = emailTransporte || emailSupervisor;
            const ccEsc = mergeEmails_(emailSupervisor, emailProveedor, ccSupervisorArea, ccTransporteArea);
            if (sendReminder('SLA vencido', toEsc, ccEsc, subjectPlantilla_(id, title))) {
                notif[keyEsc] = new Date().toISOString();
                sent++;
                changed = true;
            }
        }

        if (changed) {
            writeRowFields_(sh, rowNum, schema.map, {
                [WF.slaNotif]: JSON.stringify(notif)
            });
        }
    }

    return { checked, sent };
}

function dailySlaDigestDateKey_(refDate) {
    const dt = refDate ? new Date(refDate) : new Date();
    return Utilities.formatDate(dt, Session.getScriptTimeZone(), 'yyyyMMdd');
}

function dailySlaDigestPropKey_(areaName, dateKey) {
    return SLA_DAILY_DIGEST_PREFIX + String(dateKey || dailySlaDigestDateKey_()) + '_' + normalizeKey_(areaName || 'sin_area');
}

function resolveDailySlaDigestTarget_(areaName) {
    const area = normalizeAreaName_(areaName) || String(areaName || '').trim() || 'Sin area';
    const target = resolveAreaNotificationTarget_(area, [], {}, '', '');
    let to = csvEmails_(target.to);
    const cc = csvEmails_(target.cc);
    if (!to) {
        to = mergeEmails_(resolveSupervisorEmail_(), resolveAdminEmail_());
    }
    return {
        area: area,
        to: csvEmails_(to),
        cc: cc
    };
}

function buildDailySlaDigestMail_(areaName, cases, stats, refDate) {
    const tz = Session.getScriptTimeZone();
    const dt = refDate ? new Date(refDate) : new Date();
    const dateLabel = Utilities.formatDate(dt, tz, 'yyyy-MM-dd');
    const digestId = 'DIGEST-SLA-' + Utilities.formatDate(dt, tz, 'yyyyMMdd');
    const area = normalizeAreaName_(areaName) || String(areaName || '').trim() || 'Sin area';
    const items = (cases || []).slice().sort((a, b) => {
        if (Number(b.horasVencidas || 0) !== Number(a.horasVencidas || 0)) {
            return Number(b.horasVencidas || 0) - Number(a.horasVencidas || 0);
        }
        return Number(b.total || 0) - Number(a.total || 0);
    });
    const shown = items.slice(0, 20);
    const hidden = Math.max(0, items.length - shown.length);
    const totalCases = Number(stats && stats.casos != null ? stats.casos : items.length);
    const totalHours = round2Dash_(stats && stats.horasVencidas != null ? stats.horasVencidas : shown.reduce((acc, x) => acc + Number(x.horasVencidas || 0), 0));
    const totalDays = round2Dash_(stats && stats.diasVencidos != null ? stats.diasVencidos : shown.reduce((acc, x) => acc + Number(x.diasVencidos || 0), 0));
    const maxHours = round2Dash_(stats && stats.maxHorasVencidas != null ? stats.maxHorasVencidas : (shown[0] ? Number(shown[0].horasVencidas || 0) : 0));

    const textLines = [
        'Resumen diario de SLA vencido',
        'Fecha: ' + dateLabel,
        'Área responsable: ' + area,
        'Casos vencidos: ' + totalCases,
        'Horas vencidas acumuladas: ' + Number(totalHours || 0).toFixed(2),
        'Dias vencidos acumulados: ' + Number(totalDays || 0).toFixed(2),
        'Mayor atraso (horas): ' + Number(maxHours || 0).toFixed(2),
        '',
        'Detalle principal:'
    ];

    for (let i = 0; i < shown.length; i++) {
        const c = shown[i];
        textLines.push(
            (i + 1) + '. ' + [
                c.id || '-',
                c.etapa || '-',
                (Number(c.horasVencidas || 0).toFixed(2) + 'h'),
                (Number(c.diasVencidos || 0).toFixed(2) + 'd'),
                c.proveedor || '-',
                ('Vence: ' + (c.fechaLimiteSlaActual || '-')),
                ('Estado: ' + (c.estado || '-'))
            ].join(' | ')
        );
    }
    if (hidden > 0) textLines.push('... ' + hidden + ' caso(s) adicional(es) no listados en este resumen.');

    const htmlRows = shown.map(c => {
        return '' +
            '<tr>' +
            '<td style=\"padding:8px;border-bottom:1px solid #e5e7eb;\">' + escapeHtml_(c.id || '-') + '</td>' +
            '<td style=\"padding:8px;border-bottom:1px solid #e5e7eb;\">' + escapeHtml_(c.etapa || '-') + '</td>' +
            '<td style=\"padding:8px;border-bottom:1px solid #e5e7eb;\">' + escapeHtml_(c.proveedor || '-') + '</td>' +
            '<td style=\"padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;\">' + escapeHtml_(Number(c.horasVencidas || 0).toFixed(2)) + '</td>' +
            '<td style=\"padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;\">' + escapeHtml_(Number(c.diasVencidos || 0).toFixed(2)) + '</td>' +
            '<td style=\"padding:8px;border-bottom:1px solid #e5e7eb;\">' + escapeHtml_(c.fechaLimiteSlaActual || '-') + '</td>' +
            '<td style=\"padding:8px;border-bottom:1px solid #e5e7eb;\">' + escapeHtml_(c.estado || '-') + '</td>' +
            '</tr>';
    }).join('');

    const moreHtml = hidden > 0
        ? '<div style=\"margin-top:10px;color:#64748b;font-size:12px;\">Hay ' + hidden + ' caso(s) adicional(es) fuera del listado principal.</div>'
        : '';

    const html = '' +
        '<!DOCTYPE html><html><body style=\"margin:0;padding:20px;background:#f8fafc;font-family:Arial,sans-serif;color:#0f172a;\">' +
        '<div style=\"max-width:980px;margin:0 auto;background:#ffffff;border:1px solid #dbe5f0;border-radius:14px;overflow:hidden;\">' +
        '<div style=\"padding:18px 20px;background:linear-gradient(135deg,#0f274a,#2563eb);color:#ffffff;\">' +
        '<div style=\"font-size:12px;letter-spacing:.6px;text-transform:uppercase;opacity:.9;\">Cobro Transporte</div>' +
        '<div style=\"font-size:22px;font-weight:800;margin-top:4px;\">Resumen diario SLA vencido</div>' +
        '<div style=\"font-size:13px;opacity:.92;margin-top:6px;\">Área: ' + escapeHtml_(area) + ' | Fecha: ' + escapeHtml_(dateLabel) + '</div>' +
        '</div>' +
        '<div style=\"padding:18px 20px;\">' +
        '<div style=\"display:flex;flex-wrap:wrap;gap:12px;margin-bottom:16px;\">' +
        '<div style=\"min-width:160px;padding:12px 14px;border:1px solid #dbe5f0;border-radius:12px;background:#f8fbff;\"><div style=\"font-size:11px;color:#64748b;text-transform:uppercase;\">Casos</div><div style=\"font-size:24px;font-weight:800;color:#0f274a;\">' + escapeHtml_(String(totalCases)) + '</div></div>' +
        '<div style=\"min-width:160px;padding:12px 14px;border:1px solid #dbe5f0;border-radius:12px;background:#f8fbff;\"><div style=\"font-size:11px;color:#64748b;text-transform:uppercase;\">Horas vencidas</div><div style=\"font-size:24px;font-weight:800;color:#0f274a;\">' + escapeHtml_(Number(totalHours || 0).toFixed(2)) + '</div></div>' +
        '<div style=\"min-width:160px;padding:12px 14px;border:1px solid #dbe5f0;border-radius:12px;background:#f8fbff;\"><div style=\"font-size:11px;color:#64748b;text-transform:uppercase;\">Dias vencidos</div><div style=\"font-size:24px;font-weight:800;color:#0f274a;\">' + escapeHtml_(Number(totalDays || 0).toFixed(2)) + '</div></div>' +
        '<div style=\"min-width:160px;padding:12px 14px;border:1px solid #dbe5f0;border-radius:12px;background:#fff7ed;\"><div style=\"font-size:11px;color:#9a3412;text-transform:uppercase;\">Mayor atraso</div><div style=\"font-size:24px;font-weight:800;color:#9a3412;\">' + escapeHtml_(Number(maxHours || 0).toFixed(2)) + 'h</div></div>' +
        '</div>' +
        '<table style=\"width:100%;border-collapse:collapse;border:1px solid #dbe5f0;border-radius:12px;overflow:hidden;\">' +
        '<thead><tr style=\"background:#eef4ff;color:#0f274a;\">' +
        '<th style=\"padding:9px 8px;text-align:left;font-size:12px;\">ID</th>' +
        '<th style=\"padding:9px 8px;text-align:left;font-size:12px;\">Etapa</th>' +
        '<th style=\"padding:9px 8px;text-align:left;font-size:12px;\">Proveedor</th>' +
        '<th style=\"padding:9px 8px;text-align:right;font-size:12px;\">Horas</th>' +
        '<th style=\"padding:9px 8px;text-align:right;font-size:12px;\">Dias</th>' +
        '<th style=\"padding:9px 8px;text-align:left;font-size:12px;\">Limite</th>' +
        '<th style=\"padding:9px 8px;text-align:left;font-size:12px;\">Estado</th>' +
        '</tr></thead>' +
        '<tbody>' + htmlRows + '</tbody>' +
        '</table>' +
        moreHtml +
        '<div style=\"margin-top:14px;font-size:12px;color:#64748b;\">Resumen automatico del flujo de Cobro Transporte.</div>' +
        '</div></div></body></html>';

    return {
        subject: subjectPlantilla_(digestId, 'Resumen diario SLA vencido - ' + area),
        text: textLines.join('\n'),
        html: html
    };
}

function runDailyOverdueStageNotificationsCore_(forceSend, actorEmail) {
    const force = parseBoolLoose_(forceSend, false);
    const actor = String(actorEmail || 'sistema').trim() || 'sistema';
    const now = new Date();
    const dateKey = dailySlaDigestDateKey_(now);
    const digestId = 'DIGEST-SLA-' + dateKey;
    const snapshot = buildSlaOverdueSnapshot_('', '');
    if (snapshot && snapshot.error) return { success: false, message: snapshot.error };

    const overdueCases = Array.isArray(snapshot && snapshot.overdueCases) ? snapshot.overdueCases : [];
    if (!overdueCases.length) {
        appendBitacora_({
            id: digestId,
            usuario: actor,
            etapa: 'Resumen SLA',
            accion: 'Resumen diario SLA vencido',
            resultado: 'Sin datos',
            detalle: 'No hay etapas vencidas para notificar.'
        });
        return {
            success: true,
            date: dateKey,
            totalAreas: 0,
            overdueCases: 0,
            sent: 0,
            skipped: 0,
            withoutTarget: 0,
            errors: 0,
            areas: [],
            message: 'No hay etapas vencidas para notificar.'
        };
    }

    const groupsMap = {};
    for (let i = 0; i < overdueCases.length; i++) {
        const item = overdueCases[i];
        const area = normalizeAreaName_(item.areaResponsable) || String(item.areaResponsable || '').trim() || 'Sin area';
        const key = areaKey_(area) || normalizeKey_(area);
        if (!groupsMap[key]) {
            groupsMap[key] = {
                area: area,
                cases: [],
                stats: {
                    casos: 0,
                    horasVencidas: 0,
                    diasVencidos: 0,
                    maxHorasVencidas: 0,
                    maxDiasVencidos: 0
                }
            };
        }
        groupsMap[key].cases.push(item);
        groupsMap[key].stats.casos++;
        groupsMap[key].stats.horasVencidas += Number(item.horasVencidas || 0);
        groupsMap[key].stats.diasVencidos += Number(item.diasVencidos || 0);
        groupsMap[key].stats.maxHorasVencidas = Math.max(groupsMap[key].stats.maxHorasVencidas, Number(item.horasVencidas || 0));
        groupsMap[key].stats.maxDiasVencidos = Math.max(groupsMap[key].stats.maxDiasVencidos, Number(item.diasVencidos || 0));
    }

    const groups = Object.keys(groupsMap).map(k => {
        const item = groupsMap[k];
        item.stats.horasVencidas = round2Dash_(item.stats.horasVencidas);
        item.stats.diasVencidos = round2Dash_(item.stats.diasVencidos);
        item.stats.maxHorasVencidas = round2Dash_(item.stats.maxHorasVencidas);
        item.stats.maxDiasVencidos = round2Dash_(item.stats.maxDiasVencidos);
        item.cases.sort((a, b) => Number(b.horasVencidas || 0) - Number(a.horasVencidas || 0));
        return item;
    }).sort((a, b) => {
        if (b.stats.casos !== a.stats.casos) return b.stats.casos - a.stats.casos;
        return b.stats.horasVencidas - a.stats.horasVencidas;
    });

    const props = PropertiesService.getScriptProperties();
    let sent = 0;
    let skipped = 0;
    let withoutTarget = 0;
    let errors = 0;
    const areas = [];

    for (let i = 0; i < groups.length; i++) {
        const item = groups[i];
        const propKey = dailySlaDigestPropKey_(item.area, dateKey);
        if (!force && props.getProperty(propKey)) {
            skipped++;
            areas.push({
                area: item.area,
                casos: item.stats.casos,
                sent: false,
                skipped: true,
                to: '',
                cc: '',
                message: 'Resumen diario ya enviado hoy.'
            });
            continue;
        }

        const target = resolveDailySlaDigestTarget_(item.area);
        const to = csvEmails_(target.to);
        const cc = csvEmails_(target.cc);
        if (!to && !cc) {
            withoutTarget++;
            appendBitacora_({
                id: digestId,
                usuario: actor,
                etapa: 'Resumen SLA',
                accion: 'Resumen diario SLA vencido',
                resultado: 'Sin envio',
                detalle: 'Sin destinatario para el area ' + item.area + '. Casos: ' + item.stats.casos
            });
            areas.push({
                area: item.area,
                casos: item.stats.casos,
                sent: false,
                skipped: false,
                to: '',
                cc: '',
                message: 'Sin destinatario configurado.'
            });
            continue;
        }

        const mail = buildDailySlaDigestMail_(item.area, item.cases, item.stats, now);
        const res = sendStageMail_(to, mail.subject, { text: mail.text, html: mail.html }, cc);
        if (res && res.success) {
            props.setProperty(propKey, new Date().toISOString());
            sent++;
        } else {
            errors++;
        }

        appendBitacora_({
            id: digestId,
            usuario: actor,
            etapa: 'Resumen SLA',
            accion: 'Resumen diario SLA vencido',
            resultado: (res && res.success) ? 'Enviado' : 'Error',
            destinatario: csvEmails_(to || cc),
            detalle: (res && res.success)
                ? ('Área: ' + item.area + '. Casos: ' + item.stats.casos + '. Horas vencidas: ' + item.stats.horasVencidas)
                : ('Área: ' + item.area + '. ' + String(res && res.message ? res.message : 'No se pudo enviar el resumen.'))
        });

        areas.push({
            area: item.area,
            casos: item.stats.casos,
            sent: Boolean(res && res.success),
            skipped: false,
            to: to,
            cc: cc,
            message: String(res && res.message || '')
        });
    }

    return {
        success: errors === 0,
        date: dateKey,
        totalAreas: groups.length,
        overdueCases: overdueCases.length,
        sent: sent,
        skipped: skipped,
        withoutTarget: withoutTarget,
        errors: errors,
        areas: areas,
        message: 'Procesado. Areas: ' + groups.length + ', enviados: ' + sent + ', omitidos: ' + skipped + ', sin destino: ' + withoutTarget + ', errores: ' + errors + '.'
    };
}

function runDailyOverdueStageNotifications() {
    return runDailyOverdueStageNotificationsCore_(false, 'sistema');
}

function adminRunDailyOverdueStageNotifications(forceSend, actorEmail) {
    const guard = requireAdminForConfig_(actorEmail);
    if (!guard.success) return guard;
    return runDailyOverdueStageNotificationsCore_(forceSend, guard.profile.email || actorEmail || 'sistema');
}

/**
 * ============================================================================
 * âœ… NUEVO: ENDPOINT GESTIÃ“N (TABLA + FILTROS)
 * ============================================================================
 * filtros:
 * { estado, responsable, etapa, texto, inicio, fin }
 * inicio/fin: YYYY-MM-DD (opcional)
 */
function buildGestionResult_(filtros, actorEmail, opts) {
    opts = opts || {};
    const applyFilters = !opts.skipFilters;
    const ss = getDataStore_();
    const sh = ss.getSheetByName('Aprobaciones');
    if (!sh || sh.getLastRow() < 2) {
        return {
            rows: [],
            summary: {
                total: 0,
                observados: 0,
                slaVencidos: 0,
                pendientesArea: 0
            }
        };
    }
    const schema = ensureAprobacionesSchema_(sh);
    const profile = getUserProfile_(actorEmail);
    if (!profile.email) return buildEmptyGestionResult_();

    filtros = filtros || {};
    const vista = String(filtros.vista || '').trim();
    const estadoRaw = String(filtros.estado || '').trim();
    let estado = (estadoRaw && estadoRaw !== 'Todos') ? normalizeEstado_(estadoRaw) : '';
    const responsable = String(filtros.responsable || '').trim().toLowerCase();
    const etapa = String(filtros.etapa || '').trim();
    const texto = String(filtros.q || filtros.texto || '').trim().toLowerCase();
    const wantText = applyFilters && !!texto;
    const inicioStr = String(filtros.inicio || '').trim();
    const finStr = String(filtros.fin || '').trim();
    let fInicio = inicioStr ? new Date(inicioStr + 'T00:00:00') : null;
    let fFin = finStr ? new Date(finStr + 'T23:59:59') : null;
    let onlySlaVencido = false;
    let onlyEtapaFirma = false;
    let soloPendientes = Boolean(filtros.soloPendientes === true || String(filtros.soloPendientes || '').toLowerCase() === 'true');

    if (vista === 'observados') estado = 'Observado';
    if (vista === 'sla_vencidos') onlySlaVencido = true;
    if (vista === 'etapa_2_7') onlyEtapaFirma = true;
    if (vista === 'mis_pendientes') soloPendientes = true;
    if (vista === 'hoy') {
        const now = new Date();
        fInicio = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        fFin = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    }
    if (vista === 'semana') {
        const now2 = new Date();
        const base = new Date(now2.getFullYear(), now2.getMonth(), now2.getDate(), 0, 0, 0);
        fFin = new Date(now2.getFullYear(), now2.getMonth(), now2.getDate(), 23, 59, 59);
        fInicio = new Date(base.getTime() - (6 * 24 * 60 * 60 * 1000));
    }

    const tz = Session.getScriptTimeZone();
    const lastCol = sh.getLastColumn();
    const allValues = sh.getRange(1, 1, sh.getLastRow(), lastCol).getValues();
    const headers = allValues[0] || [];
    const map = schema.map || buildHeaderMap_(headers);
    const rows = allValues.length > 1 ? allValues.slice(1) : [];

    const out = [];
    const summary = {
        total: 0,
        observados: 0,
        slaVencidos: 0,
        pendientesArea: 0
    };

    rows.forEach(r => {
        if (!actorCanAccessAprobacionRow_(profile, r, map)) return;
        const id = r[0] || '';
        const fechaCre = r[1] ? new Date(r[1]) : null;
        const prov = r[2] || '';
        const ruta = r[5] || '';
        const monto = Number(r[12] || 0);

        // estado
        const etapaVal = normalizeEtapa_(r[COL_ETAPA - 1]);
        const estBase = normalizeEstado_(r[COL_ESTADO - 1]);
        const est = estBase || macroEstadoPorEtapaIdx_(etapaIndex_(etapaVal));
        const resp = String(r[14] || '');
        const ultActRaw = r[COL_ULT_ACT - 1];
        const ultAct = ultActRaw ? new Date(ultActRaw) : (fechaCre ? new Date(fechaCre) : null);
        const idx = etapaIndex_(etapaVal);
        const areaResponsableActual = rowText_(r, map, [WF.areaResponsableActual]) || areaResponsablePorEtapa_(idx);
        const sla = slaStatusText_(r, map, idx);
        const unidad = String(r[4] || '');
        const factura = String(r[8] || '');
        const licencia = String(r[23] || '');
        const ovNumero = rowText_(r, map, [WF.ovNumero]);
        const rutaId = rowText_(r, map, [WF.rutaId]);
        const inventarioStatus = rowText_(r, map, [WF.inventarioStatus]);
        const boletaFirmadaUrl = rowText_(r, map, [WF.boletaFirmadaUrl, WF.firmaBoletaUrl]);
        const firmaFacturaUrl = rowText_(r, map, [WF.firmaFacturaUrl]);
        const facturasDebitar = rowText_(r, map, [WF.facturasDebitar]);
        const rmNumero = rowText_(r, map, [WF.rmNumero]);
        const debitoRef = rowText_(r, map, [WF.debitoRef]);
        let searchText = '';
        if (wantText) {
            searchText = [
                id, prov, ruta, resp, areaResponsableActual, unidad, String(r[7] || ''),
                factura, licencia, etapaVal, inventarioStatus, ovNumero, rutaId,
                boletaFirmadaUrl, firmaFacturaUrl, facturasDebitar, rmNumero, debitoRef
            ].join(' ').toLowerCase();
        }

        summary.total++;
        if (String(est || '') === 'Observado') summary.observados++;
        if (String(sla || '') === 'Vencido') summary.slaVencidos++;
        if (String(est || '') !== 'Cerrado') {
            if (profile.canForce) summary.pendientesArea++;
            else if (profile.areaKey && areaKey_(areaResponsableActual) === profile.areaKey) summary.pendientesArea++;
        }

        // filtros fecha
        if (applyFilters) {
            if (fechaCre && fInicio && fechaCre < fInicio) return;
            if (fechaCre && fFin && fechaCre > fFin) return;
            if (estado && est !== estado) return;
            if (responsable && !resp.toLowerCase().includes(responsable)) return;
            if (etapa && etapa !== 'Todas' && etapaVal !== etapa) return;

            if (onlySlaVencido && sla !== 'Vencido') return;
            if (onlyEtapaFirma && !(idx === 2 || idx === 7)) return;
            if (soloPendientes) {
                if (est === 'Cerrado') return;
                if (!profile.canForce && profile.areaKey && profile.areaKey !== areaKey_(areaResponsableActual)) return;
            }

            if (wantText && searchText.indexOf(texto) < 0) return;
        }

        const puedePorArea = profile.areaKey && profile.areaKey === areaKey_(areaResponsableActual);
        const puedePorTransicion = (idx < ETAPAS_COBRO.length) ? canMoveTransition_(profile, idx, idx + 1).ok : false;
        const puedeGestionar = profile.canForce || puedePorArea || puedePorTransicion;
        const isMiPendiente = (String(est || '') !== 'Cerrado')
            && (profile.canForce || (profile.areaKey && profile.areaKey === areaKey_(areaResponsableActual)));
        const itemsJson = r[16] || '';
        const incidencia = resumenIncidencia_(itemsJson);
        const prog = progresoEtapa_(etapaVal);
        const pdfUrl = r[COL_PDF_URL - 1] || '';

        out.push({
            id,
            proveedor: prov,
            ruta,
            unidad,
            factura,
            licencia,
            incidencia,
            monto,
            estado: est,
            responsable: resp,
            etapa: etapaVal,
            etapaIndex: idx,
            progreso: prog,
            areaResponsableActual,
            sla,
            puedeGestionar,
            isMiPendiente,
            c9: String(r[7] || ''),
            inventarioStatus,
            ovNumero,
            rutaId,
            boletaFirmadaUrl,
            firmaFacturaUrl,
            facturasDebitar,
            rmNumero,
            debitoRef,
            fechaCreacion: fechaCre ? Utilities.formatDate(fechaCre, tz, 'yyyy-MM-dd HH:mm:ss') : '',
            fechaCreacionTs: fechaCre ? fechaCre.getTime() : 0,
            ultAct: ultAct ? Utilities.formatDate(ultAct, tz, 'yyyy-MM-dd HH:mm:ss') : '',
            pdfUrl
        });
    });

    // orden desc por fecha
    out.sort((a, b) => Number(b.fechaCreacionTs || 0) - Number(a.fechaCreacionTs || 0));
    return { rows: out, summary: summary };
}

function getGestionData(filtros, actorEmail) {
    try {
        const result = buildGestionResult_(filtros, actorEmail);
        if (result && typeof result === 'object') {
            result.error = false;
            result.message = '';
        }
        return result;
    } catch (err) {
        const fallback = buildEmptyGestionResult_();
        fallback.message = logModuleError_('la bandeja de gestión', err);
        return fallback;
    }
}

// Snapshot completo (sin filtros) para cache/local filtering en frontend
function getGestionSnapshot(actorEmail) {
    try {
        const result = buildGestionResult_({}, actorEmail, { skipFilters: true });
        if (result && typeof result === 'object') {
            result.error = false;
            result.message = '';
        }
        return result;
    } catch (err) {
        const fallback = buildEmptyGestionResult_();
        fallback.message = logModuleError_('la bandeja de gestión', err);
        return fallback;
    }
}

function getGestionCobros(filtros, actorEmail) {
    return getGestionData(filtros, actorEmail).rows;
}

/**
 * ============================================================================
 * âœ… NUEVO: UPDATE ETAPA (GUARDA EN Aprobaciones)
 * ============================================================================
 */
function getGestionResumen(actorEmail) {
    return getGestionData({}, actorEmail).summary;
}

function exportGestionCsv(filtros, actorEmail) {
    const rows = getGestionCobros(filtros || {}, actorEmail);
    const head = [
        'ID', 'Proveedor', 'Unidad', 'Ruta', 'Factura', 'Licencia',
        'Incidencia', 'Monto', 'Estado', 'Área', 'Responsable',
        'Etapa', 'SLA', 'OV', 'RutaId', 'FechaCreacion', 'UltAct', 'PdfUrl'
    ];
    const csv = [head.map(escapeCsv_).join(',')];
    for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        csv.push([
            r.id, r.proveedor, r.unidad, r.ruta, r.factura, r.licencia,
            r.incidencia, Number(r.monto || 0).toFixed(2), r.estado, r.areaResponsableActual, r.responsable,
            r.etapa, r.sla, r.ovNumero, r.rutaId, r.fechaCreacion, r.ultAct, r.pdfUrl
        ].map(escapeCsv_).join(','));
    }
    const tz = Session.getScriptTimeZone();
    const stamp = Utilities.formatDate(new Date(), tz, 'yyyyMMdd_HHmmss');
    return {
        success: true,
        fileName: 'Gestion_Cobros_' + stamp + '.csv',
        csv: csv.join('\n'),
        rows: rows.length
    };
}

function deleteGestionCobros(ids, authKey, motivo, actorEmail, actorCtx) {
    try {
        const profile = getUserProfile_(actorEmail);
        if (!profile.email) return { success: false, message: 'Usuario no autorizado.' };

        const requestedIds = Array.isArray(ids) ? ids : [ids];
        const wanted = [];
        const seen = {};
        for (let i = 0; i < requestedIds.length; i++) {
            const id = String(requestedIds[i] || '').trim();
            if (!id || seen[id]) continue;
            seen[id] = true;
            wanted.push(id);
        }
        if (!wanted.length) return { success: false, message: 'Debe indicar al menos un ID.' };

        const reason = String(motivo || '').trim();
        if (!reason) return { success: false, message: 'Debe indicar el motivo de eliminacion.' };

        const ss = getDataStore_();
        const sh = ss.getSheetByName('Aprobaciones');
        if (!sh) return { success: false, message: 'No existe hoja Aprobaciones.' };
        const schema = ensureAprobacionesSchema_(sh);
        const lastCol = sh.getLastColumn();
        const headers = sh.getRange(1, 1, 1, lastCol).getValues()[0];
        const map = schema.map || buildHeaderMap_(headers);
        const auditCtx = parseActorCtx_(actorCtx);

        const foundRows = [];
        const failed = [];
        for (let i = 0; i < wanted.length; i++) {
            const id = wanted[i];
            const rowNum = findRowById_(sh, id);
            if (!rowNum) {
                failed.push({ id: id, message: 'ID no encontrado.' });
                continue;
            }
            const row = sh.getRange(rowNum, 1, 1, lastCol).getValues()[0];
            const access = ensureActorCanAccessAprobacionRow_(profile, row, map);
            if (!access.ok) {
                failed.push({ id: id, message: access.message });
                continue;
            }
            foundRows.push({
                id: id,
                rowNum: rowNum,
                row: row
            });
        }
        if (!foundRows.length) {
            return {
                success: false,
                message: failed.length ? failed[0].message : 'No se encontraron registros para eliminar.',
                ok: 0,
                fail: failed.length,
                failed: failed
            };
        }

        const keyCheck = validateAuthorizationKey_(authKey, resolveDeleteAuthScope_(wanted.length));
        if (!keyCheck.ok) return { success: false, message: keyCheck.message };

        let detailDeleted = 0;
        let criticalDeleted = 0;
        let filesTrashed = 0;
        const rowNumsToDelete = [];
        const deletedIds = [];
        const actionName = wanted.length > 1 ? 'Eliminacion multiple' : 'Eliminacion individual';

        for (let i = 0; i < foundRows.length; i++) {
            const item = foundRows[i];
            const row = item.row;
            rowNumsToDelete.push(item.rowNum);
            deletedIds.push(item.id);
            detailDeleted += deleteDetalleCobrosById_(item.id);
            criticalDeleted += deleteAprobacionesCriticasById_(item.id);
            filesTrashed += trashDriveFilesByUrls_(collectCobroFileUrls_(row, map));

            appendBitacora_({
                id: item.id,
                usuario: profile.email,
                etapa: String(row[COL_ETAPA - 1] || ''),
                accion: actionName,
                resultado: 'OK',
                destinatario: '',
                detalle: buildAuditMeta_(auditCtx, {
                    motivo: reason,
                    keyId: keyCheck.keyId,
                    keyScope: keyCheck.scope,
                    proveedor: String(row[2] || ''),
                    ruta: String(row[5] || ''),
                    monto: Number(row[12] || 0)
                })
            });
        }

        deleteRowsDescending_(sh, rowNumsToDelete);
        return {
            success: true,
            ok: deletedIds.length,
            fail: failed.length,
            deletedIds: deletedIds,
            failed: failed,
            keyId: keyCheck.keyId,
            detailDeleted: detailDeleted,
            criticalDeleted: criticalDeleted,
            filesTrashed: filesTrashed,
            message: deletedIds.length === 1
                ? 'Registro eliminado correctamente.'
                : ('Registros eliminados: ' + deletedIds.length)
        };
    } catch (e) {
        return { success: false, message: 'Error al eliminar registros: ' + String(e && e.message ? e.message : e) };
    }
}

function getCobroTimeline(id, limit, actorEmail) {
    const wantedId = String(id || '').trim();
    if (!wantedId) return [];
    const lim = Math.max(1, Number(limit || 200));
    const profile = getUserProfile_(actorEmail);
    if (!profile.email) return [];
    const ss = getDataStore_();
    const shA = ss.getSheetByName('Aprobaciones');
    if (shA && shA.getLastRow() > 1) {
        const schema = ensureAprobacionesSchema_(shA);
        const lastColA = shA.getLastColumn();
        const headersA = shA.getRange(1, 1, 1, lastColA).getValues()[0] || [];
        const mapA = schema.map || buildHeaderMap_(headersA);
        const rowNumA = findRowById_(shA, wantedId);
        if (!rowNumA) return [];
        const rowA = shA.getRange(rowNumA, 1, 1, lastColA).getValues()[0];
        if (!actorCanAccessAprobacionRow_(profile, rowA, mapA)) return [];
    }
    const sh = ensureBitacoraSheet_();
    if (!sh || sh.getLastRow() < 2) return [];

    const values = sh.getDataRange().getValues();
    const out = [];
    for (let i = values.length - 1; i >= 1; i--) {
        const r = values[i];
        if (String(r[1] || '') !== wantedId) continue;
        const etapaEvt = normalizeEtapa_(r[3] || '');
        const accionEvt = String(r[4] || '').trim();

        // Oculta evento legacy incorrecto: "Firma boleta requerida" en etapa 1.
        // El correo correcto debe aparecer reciÃ©n al iniciar flujo (etapa 2).
        if (accionEvt === 'Firma boleta requerida' && etapaIndex_(etapaEvt) === 1) continue;

        out.push({
            fecha: formatDateTimeSafe_(r[0]),
            id: String(r[1] || ''),
            usuario: String(r[2] || ''),
            etapa: String(r[3] || ''),
            accion: accionEvt,
            resultado: String(r[5] || ''),
            destinatario: String(r[6] || ''),
            detalle: String(r[7] || '')
        });
        if (out.length >= lim) break;
    }
    return out;
}

function updateCobroResponsable(id, responsable, actorEmail, actorCtx) {
    const newResp = String(responsable || '').trim();
    if (!newResp) return { success: false, message: 'Responsable requerido.' };

    const ss = getDataStore_();
    const sh = ss.getSheetByName('Aprobaciones');
    if (!sh) return { success: false, message: 'No existe hoja Aprobaciones.' };
    const schema = ensureAprobacionesSchema_(sh);
    const profile = getUserProfile_(actorEmail);
    if (!profile.email) return { success: false, message: 'Usuario no autorizado.' };

    const rowNum = findRowById_(sh, id);
    if (!rowNum) return { success: false, message: 'ID no encontrado.' };
    const row = sh.getRange(rowNum, 1, 1, sh.getLastColumn()).getValues()[0];
    const map = schema.map || buildHeaderMap_(sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]);
    const access = ensureActorCanAccessAprobacionRow_(profile, row, map);
    if (!access.ok) return { success: false, message: access.message };
    const areaActual = rowText_(row, map, [WF.areaResponsableActual]) || areaResponsablePorEtapa_(etapaIndex_(row[COL_ETAPA - 1]));
    const canUpdate = profile.canForce || (profile.areaKey && profile.areaKey === areaKey_(areaActual));
    if (!canUpdate) return { success: false, message: 'No tiene permiso para reasignar este caso.' };

    const oldResp = String(row[14] || '');
    if (oldResp === newResp) return { success: true, message: 'Sin cambios.' };
    sh.getRange(rowNum, 15).setValue(newResp);
    sh.getRange(rowNum, COL_ULT_ACT).setValue(new Date());

    appendBitacora_({
        id: String(id || ''),
        usuario: String(actorEmail || 'sistema'),
        etapa: String(sh.getRange(rowNum, COL_ETAPA).getValue() || ''),
        accion: 'Cambio responsable',
        resultado: 'OK',
        detalle: buildAuditMeta_(actorCtx, {
            before: oldResp,
            after: newResp
        })
    });
    return { success: true };
}

function bulkUpdateResponsable(ids, responsable, actorEmail, actorCtx) {
    const arr = Array.isArray(ids) ? ids : [];
    if (!arr.length) return { success: false, message: 'Seleccione al menos un ID.' };
    let ok = 0;
    let fail = 0;
    const errors = [];
    for (let i = 0; i < arr.length; i++) {
        const id = String(arr[i] || '').trim();
        if (!id) continue;
        const res = updateCobroResponsable(id, responsable, actorEmail, actorCtx);
        if (res && res.success) ok++;
        else {
            fail++;
            errors.push({ id, message: res && res.message ? res.message : 'Error' });
        }
    }
    return { success: true, ok, fail, errors };
}

function bulkMarcarObservado(ids, motivo, areaDestino, actorEmail, actorCtx) {
    const arr = Array.isArray(ids) ? ids : [];
    if (!arr.length) return { success: false, message: 'Seleccione al menos un ID.' };
    let ok = 0;
    let fail = 0;
    let notifyOk = 0;
    let notifyFail = 0;
    const errors = [];
    const notifyErrors = [];
    for (let i = 0; i < arr.length; i++) {
        const id = String(arr[i] || '').trim();
        if (!id) continue;
        const res = setCobroObservado(id, motivo, areaDestino, actorEmail, actorCtx);
        if (res && res.success) {
            ok++;
            if (res.notification && res.notification.success) notifyOk++;
            else if (res.notification) {
                notifyFail++;
                notifyErrors.push({ id, message: res.notification.message || 'No se pudo enviar la notificacion.' });
            }
        } else {
            fail++;
            errors.push({ id, message: res && res.message ? res.message : 'Error' });
        }
    }
    return { success: true, ok, fail, errors, notifyOk, notifyFail, notifyErrors };
}

function generarZipPdfsGestion(ids, actorEmail, actorCtx) {
    const profile = getUserProfile_(actorEmail);
    if (!profile.email) return { success: false, message: 'Usuario no autorizado.' };
    const arr = Array.isArray(ids) ? ids : [];
    if (!arr.length) return { success: false, message: 'Seleccione al menos un ID.' };

    const ss = getDataStore_();
    const sh = ss.getSheetByName('Aprobaciones');
    if (!sh) return { success: false, message: 'No existe hoja Aprobaciones.' };
    const schema = ensureAprobacionesSchema_(sh);
    const map = schema.map || buildHeaderMap_(sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0] || []);

    const blobs = [];
    const notFound = [];
    for (let i = 0; i < arr.length; i++) {
        const id = String(arr[i] || '').trim();
        if (!id) continue;
        const rowNum = findRowById_(sh, id);
        if (!rowNum) {
            notFound.push(id + ' (ID no encontrado)');
            continue;
        }
        const row = sh.getRange(rowNum, 1, 1, sh.getLastColumn()).getValues()[0];
        const access = ensureActorCanAccessAprobacionRow_(profile, row, map);
        if (!access.ok) {
            notFound.push(id + ' (sin acceso al entorno)');
            continue;
        }
        const pdfUrl = String(row[COL_PDF_URL - 1] || '').trim();
        const fileId = extractDriveFileId_(pdfUrl);
        if (!fileId) {
            notFound.push(id + ' (sin PDF)');
            continue;
        }
        try {
            const file = DriveApp.getFileById(fileId);
            blobs.push(file.getBlob().setName(String(id || 'cobro') + '.pdf'));
        } catch (e) {
            notFound.push(id + ' (PDF inaccesible)');
        }
    }
    if (!blobs.length) return { success: false, message: 'No se encontraron PDFs para comprimir.', notFound };

    const folder = DriveApp.getFolderById(ensurePdfRoot_());
    const stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd_HHmmss');
    const zipBlob = Utilities.zip(blobs, 'Pdfs_Gestion_' + stamp + '.zip');
    const zipFile = folder.createFile(zipBlob);
    applyDriveSharePolicy_(zipFile);

    appendBitacora_({
        id: 'BULK',
        usuario: String(actorEmail || 'sistema'),
        etapa: '-',
        accion: 'ZIP de PDFs',
        resultado: 'OK',
        detalle: buildAuditMeta_(actorCtx, {
            total: blobs.length,
            notFound: notFound.join('; ')
        })
    });

    return {
        success: true,
        url: zipFile.getUrl(),
        fileId: zipFile.getId(),
        fileName: zipFile.getName(),
        total: blobs.length,
        notFound
    };
}

function updateCobroEtapa(id, nuevaEtapa, actorEmail, opts) {
    opts = opts || {};
    const ss = getDataStore_();
    const sh = ss.getSheetByName('Aprobaciones');
    if (!sh) return { success: false, message: 'No existe hoja Aprobaciones.' };
    const schema = ensureAprobacionesSchema_(sh);
    const profile = getUserProfile_(actorEmail);
    if (!profile.email) return { success: false, message: 'Usuario no autorizado.' };
    const actorCtx = parseActorCtx_(opts.actorCtx || opts.ctx || {});

    const row = findRowById_(sh, id);
    if (!row) return { success: false, message: 'ID no encontrado.' };

    const etapaFrom = normalizeEtapa_(sh.getRange(row, COL_ETAPA).getValue());
    const etapaOk = normalizeEtapa_(nuevaEtapa || etapaFrom);
    const fromIdx = etapaIndex_(etapaFrom);
    const toIdx = etapaIndex_(etapaOk);
    const now = new Date();
    const actor = String(actorEmail || '').trim().toLowerCase() || 'sistema';
    const systemAuto = Boolean(opts.systemAuto === true);
    const force = Boolean(systemAuto || (opts.force && profile.canForce));
    const forceReason = String(opts.forceReason || '').trim();
    const lastCol = sh.getLastColumn();
    const headers = sh.getRange(1, 1, 1, lastCol).getValues()[0];
    let rowData = sh.getRange(row, 1, 1, lastCol).getValues()[0];
    const rowBefore = rowData.slice();
    const headerMap = schema.map || buildHeaderMap_(headers);
    const access = ensureActorCanAccessAprobacionRow_(profile, rowData, headerMap);
    if (!access.ok) return { success: false, message: access.message };
    const estadoActual = normalizeEstado_(rowData[COL_ESTADO - 1]);

    if (etapaFrom === etapaOk) {
        return {
            success: true,
            etapa: etapaOk,
            estado: estadoActual || estadoPorEtapa_(etapaOk, estadoActual),
            progreso: progresoEtapa_(etapaOk),
            ultAct: Utilities.formatDate(new Date(rowData[COL_ULT_ACT - 1] || now), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'),
            acciones: []
        };
    }

    if (force && !systemAuto && !forceReason) {
        return { success: false, message: 'Debe indicar motivo para forzar el cambio.', canForce: profile.canForce };
    }

    if (force && !systemAuto && boolConfig_('forceRequireSupervisorApproval', false)) {
        const approvalId = String(opts.approvalId || '').trim();
        if (!approvalId) {
            const req = crearSolicitudAprobacionCritica(
                'FORZAR_ETAPA',
                id,
                forceReason || ('Forzar cambio a ' + etapaOk),
                { from: etapaFrom, to: etapaOk },
                actor,
                actorCtx
            );
            if (!req.success) return { success: false, message: req.message || 'No se pudo crear solicitud.' };
            return {
                success: false,
                requiresApproval: true,
                approvalId: req.solicitudId,
                message: 'Solicitud creada. Requiere aprobacion de supervisor/admin.'
            };
        }
        const val = validarAprobacionCritica_(approvalId, 'FORZAR_ETAPA', id);
        if (!val.ok) return { success: false, message: val.message || 'Aprobacion invalida.' };
    }

    if (!force) {
        if (toIdx !== fromIdx + 1) {
            return { success: false, message: 'No se permiten saltos de etapa.', canForce: profile.canForce };
        }
        const p = canMoveTransition_(profile, fromIdx, toIdx);
        if (!p.ok) return { success: false, message: p.message, canForce: profile.canForce };
        const req = validaRequisitosEntrada_(toIdx, rowData, headerMap);
        if (!req.ok) return { success: false, message: req.message, canForce: profile.canForce };
    }

    const estadoOk = macroEstadoPorEtapaIdx_(toIdx);
    const extraUpdates = {};
    extraUpdates[WF.areaResponsableActual] = areaResponsablePorEtapa_(toIdx);
    if (estadoActual === 'Observado') {
        extraUpdates[WF.motivoObservacion] = '';
        extraUpdates[WF.etapaAnterior] = '';
    }
    const stageSlaUpdates = buildStageSlaEntryFields_(toIdx, now);
    Object.keys(stageSlaUpdates).forEach(k => extraUpdates[k] = stageSlaUpdates[k]);

    const rowValues = rowData.slice();
    rowValues[COL_ETAPA - 1] = etapaOk;
    rowValues[COL_ULT_ACT - 1] = now;
    rowValues[COL_ESTADO - 1] = estadoOk;

    Object.keys(extraUpdates).forEach((header) => {
        const idx = headerMap[normalizeKey_(header)];
        if (idx == null) return;
        rowValues[idx] = extraUpdates[header];
    });

    sh.getRange(row, 1, 1, lastCol).setValues([rowValues]);
    rowData = rowValues;
    const diff = buildFieldDiff_(rowBefore, rowData, headerMap, [
        'Etapa', 'Estado', WF.areaResponsableActual, WF.motivoObservacion, WF.etapaAnterior, WF.fechaIngresoEtapaActual, WF.fechaLimiteSlaActual, WF.fechaLimiteFirmaBoleta, WF.fechaLimiteFirmaFactura
    ]);

    appendBitacora_({
        id,
        usuario: actor,
        etapa: etapaOk,
        accion: force ? 'Cambio de etapa (forzado)' : 'Cambio de etapa',
        resultado: 'OK',
        detalle: buildAuditMeta_(actorCtx, {
            message: 'De "' + etapaFrom + '" a "' + etapaOk + '".',
            forceReason: forceReason,
            systemAuto: systemAuto,
            diff: diff
        })
    });

    const acciones = onEtapaChanged_({
        id,
        etapa: etapaOk,
        oldEtapa: etapaFrom,
        actorEmail: actor,
        rowData,
        headers,
        sheet: sh,
        rowNum: row,
        skipRowWrite: true
    });

    const tz = Session.getScriptTimeZone();
    return {
        success: true,
        etapa: etapaOk,
        estado: estadoOk,
        progreso: progresoEtapa_(etapaOk),
        ultAct: Utilities.formatDate(now, tz, 'yyyy-MM-dd HH:mm:ss'),
        acciones: acciones,
        forceApplied: force
    };
}

function getCobroFlowData(id, actorEmail) {
    try {
        const ss = getDataStore_();
        const sh = ss.getSheetByName('Aprobaciones');
        if (!sh) return { success: false, message: 'No existe hoja Aprobaciones.' };
        const schema = ensureAprobacionesSchema_(sh);

        const rowNum = findRowById_(sh, id);
        if (!rowNum) return { success: false, message: 'ID no encontrado.' };

        const lastCol = sh.getLastColumn();
        const headers = sh.getRange(1, 1, 1, lastCol).getValues()[0];
        const row = sh.getRange(rowNum, 1, 1, lastCol).getValues()[0];
        const map = schema.map || buildHeaderMap_(headers);
        const profile = getUserProfile_(actorEmail);
        if (!profile.email) return { success: false, message: 'Usuario no autorizado.' };
        const access = ensureActorCanAccessAprobacionRow_(profile, row, map);
        if (!access.ok) return { success: false, message: access.message };
        const etapaActual = normalizeEtapa_(row[COL_ETAPA - 1]);
        const idxActual = etapaIndex_(etapaActual);
        const estadoActual = normalizeEstado_(row[COL_ESTADO - 1]);
        const storedEtapaAnterior = rowText_(row, map, [WF.etapaAnterior]);
        const areaStored = rowText_(row, map, [WF.areaResponsableActual]);
        const etapaObservada = resolveObservedSourceEtapa_(storedEtapaAnterior, etapaActual);
        const etapaRetornoObservado = resolveObservedReturnEtapa_(storedEtapaAnterior, etapaActual);
        const areaActual = resolveObservedResponsibleArea_(estadoActual, etapaActual, storedEtapaAnterior, areaStored);
        const areaObservacion = (estadoActual === 'Observado' && etapaObservada)
            ? areaResponsablePorEtapa_(etapaIndex_(etapaObservada))
            : '';
        const canByArea = profile.canForce || (profile.areaKey && profile.areaKey === areaKey_(areaActual));

        const editableFields = [];
        const fields = [
            WF.firmaBoletaUrl, WF.inventarioStatus, WF.comentarioInventario,
            WF.ovNumero, WF.rutaId, WF.facturaNumero, WF.facturaUrl,
            WF.firmaFacturaUrl, WF.liquidacionRef, WF.constanciaPagoUrl,
            WF.facturasDebitar, WF.motivoObservacion
        ];
        for (let i = 0; i < fields.length; i++) {
            if (canEditField_(profile, fields[i])) editableFields.push(fields[i]);
        }
        if (estadoActual === 'Observado' && !profile.canForce) {
            const idxMotivo = editableFields.indexOf(WF.motivoObservacion);
            if (idxMotivo >= 0) editableFields.splice(idxMotivo, 1);
        }

        return {
            success: true,
            id: String(row[0] || ''),
            estado: estadoActual,
            etapa: etapaActual,
            stageCatalog: buildFlowStageCatalog_(),
            sla: slaStatusText_(row, map, idxActual),
            areaResponsableActual: areaActual,
            fechaIngresoEtapaActual: formatDateTimeSafe_(rowVal_(row, map, [WF.fechaIngresoEtapaActual])),
            fechaLimiteSlaActual: formatDateTimeSafe_(resolveStageSlaLimit_(row, map, idxActual)),
            fechaLimiteFirmaBoleta: formatDateTimeSafe_(rowVal_(row, map, [WF.fechaLimiteFirmaBoleta])),
            firmaBoletaLink: rowText_(row, map, [WF.firmaBoletaLink]),
            boletaFirmadaUrl: rowText_(row, map, [WF.boletaFirmadaUrl, WF.firmaBoletaUrl]),
            firmaBoletaUrl: rowText_(row, map, [WF.boletaFirmadaUrl, WF.firmaBoletaUrl]),
            inventarioStatus: rowText_(row, map, [WF.inventarioStatus]),
            comentarioInventario: rowText_(row, map, [WF.comentarioInventario]),
            ovNumero: rowText_(row, map, [WF.ovNumero]),
            rutaId: rowText_(row, map, [WF.rutaId]),
            facturaNumero: rowText_(row, map, [WF.facturaNumero]),
            facturaUrl: rowText_(row, map, [WF.facturaUrl]),
            fechaLimiteFirmaFactura: formatDateTimeSafe_(rowVal_(row, map, [WF.fechaLimiteFirmaFactura])),
            firmaFacturaLink: rowText_(row, map, [WF.firmaFacturaLink]),
            firmaFacturaUrl: rowText_(row, map, [WF.firmaFacturaUrl]),
            liquidacionRef: rowText_(row, map, [WF.liquidacionRef]),
            constanciaPagoUrl: rowText_(row, map, [WF.constanciaPagoUrl]),
            rmNumero: rowText_(row, map, [WF.rmNumero]),
            facturasDebitar: rowText_(row, map, [WF.facturasDebitar]),
            debitoRef: rowText_(row, map, [WF.debitoRef]),
            etapaAnterior: estadoActual === 'Observado' ? etapaObservada : '',
            etapaRetornoObservado: estadoActual === 'Observado' ? etapaRetornoObservado : '',
            areaObservacion: areaObservacion,
            areaRetornoObservado: estadoActual === 'Observado' ? areaActual : '',
            motivoObservacion: rowText_(row, map, [WF.motivoObservacion]),
            permissions: {
                canForce: profile.canForce,
                editableFields: editableFields,
                canMarkObservado: Boolean(canByArea && idxActual > 1 && !['Observado', 'Anulado', 'Cerrado'].includes(estadoActual)),
                canRevertObservado: Boolean(canByArea && estadoActual === 'Observado' && etapaRetornoObservado && etapaRetornoObservado !== etapaActual),
                canAnular: profile.canForce
            }
        };
    } catch (e) {
        return { success: false, message: 'Error al cargar flujo: ' + String(e && e.message ? e.message : e) };
    }
}

function subirPdfFlujo(id, fieldName, fileName, mimeType, dataUrl, actorEmail, actorCtx) {
    try {
        const profile = getUserProfile_(actorEmail);
        if (!profile.email) return { success: false, message: 'Usuario no autorizado.' };
        const auditCtx = parseActorCtx_(actorCtx);
        const incomingField = String(fieldName || '').trim();
        const key = normalizeKey_(incomingField);
        let field = '';
        if (key === normalizeKey_(WF.firmaBoletaUrl) || key === normalizeKey_(WF.boletaFirmadaUrl)) field = WF.boletaFirmadaUrl;
        if (key === normalizeKey_(WF.facturaUrl)) field = WF.facturaUrl;
        if (key === normalizeKey_(WF.firmaFacturaUrl)) field = WF.firmaFacturaUrl;
        if (key === normalizeKey_(WF.constanciaPagoUrl)) field = WF.constanciaPagoUrl;
        if (!field) {
            return { success: false, message: 'Campo de archivo no permitido.' };
        }
        if (!uploadFieldAllowed_(profile, field) && !uploadFieldAllowed_(profile, incomingField)) {
            return { success: false, message: 'No tiene permiso para subir ' + fieldUploadLabel_(field) + '.' };
        }

        const parsed = parseDataUrl_(dataUrl, mimeType);
        if (!parsed || !parsed.b64) return { success: false, message: 'Archivo invalido.' };

        const mime = String(mimeType || parsed.mimeType || '').toLowerCase();
        if (!isAllowedSignedBoletaMime_(mime)) {
            return { success: false, message: 'Formato no permitido. Solo PDF.' };
        }

        const bytes = Utilities.base64Decode(parsed.b64);
        if (!bytes || !bytes.length) return { success: false, message: 'No se pudo leer el archivo.' };
        if (bytes.length > 10 * 1024 * 1024) {
            return { success: false, message: 'El archivo supera 10 MB.' };
        }

        const ss = getDataStore_();
        const sh = ss.getSheetByName('Aprobaciones');
        if (!sh) return { success: false, message: 'No existe hoja Aprobaciones.' };
        const schema = ensureAprobacionesSchema_(sh);

        const rowNum = findRowById_(sh, id);
        if (!rowNum) return { success: false, message: 'ID no encontrado.' };

        const lastCol = sh.getLastColumn();
        const headers = sh.getRange(1, 1, 1, lastCol).getValues()[0];
        const map = schema.map || buildHeaderMap_(headers);
        const row = sh.getRange(rowNum, 1, 1, lastCol).getValues()[0];
        const access = ensureActorCanAccessAprobacionRow_(profile, row, map);
        if (!access.ok) return { success: false, message: access.message };
        const rowBefore = row.slice();
        const proveedorNombre = String(row[2] || '');
        const proveedorCodigo = String(row[3] || '');
        const idxCountryCode = map[normalizeKey_(WF.countryCode)];
        const idxCountryName = map[normalizeKey_(WF.countryName)];
        const idxProcessFolderId = map[normalizeKey_(WF.processFolderId)];
        const idxProcessFolderUrl = map[normalizeKey_(WF.processFolderUrl)];
        const idxProcessFolderName = map[normalizeKey_(WF.processFolderName)];
        const countryCodeStored = idxCountryCode != null ? normalizeCountryCode_(row[idxCountryCode]) : '';
        const countryNameStored = idxCountryName != null ? String(row[idxCountryName] || '').trim() : '';
        const responsableStored = String(row[14] || '').trim();
        const inferredCountryCode = countryCodeStored || inferCountryCodeFromResponsable_(responsableStored) || DEFAULT_COUNTRY_CODE;
        const processFolderCtx = ensureProcessFolderForCobro_({
            processId: id,
            processFolderId: idxProcessFolderId != null ? String(row[idxProcessFolderId] || '').trim() : '',
            createdAt: row[1],
            countryCode: inferredCountryCode,
            countryName: countryNameStored,
            providerName: proveedorNombre,
            providerCode: proveedorCodigo
        });
        const folder = processFolderCtx.folder;

        const ext = '.pdf';
        const labelBase = fieldUploadLabel_(field).replace(/\s+/g, '_');
        let finalName = sanitizeUploadName_(fileName, labelBase + '_' + String(id || '') + '_' + new Date().getTime() + ext);
        if (!/\.[a-z0-9]{2,5}$/i.test(finalName)) finalName += ext;
        const blob = Utilities.newBlob(bytes, mime, finalName);
        const file = folder.createFile(blob);
        applyDriveSharePolicy_(file);
        const fileUrl = file.getUrl();

        const updates = {};
        updates[WF.countryCode] = processFolderCtx.countryCode;
        updates[WF.countryName] = processFolderCtx.countryName;
        updates[WF.processFolderId] = processFolderCtx.folderId;
        updates[WF.processFolderUrl] = processFolderCtx.folderUrl;
        updates[WF.processFolderName] = processFolderCtx.folderName;
        updates[field] = fileUrl;
        if (field === WF.boletaFirmadaUrl) updates[WF.firmaBoletaUrl] = fileUrl; // compat legacy
        writeRowFields_(sh, rowNum, schema.map, updates);
        sh.getRange(rowNum, COL_ULT_ACT).setValue(new Date());
        const rowAfter = sh.getRange(rowNum, 1, 1, lastCol).getValues()[0];
        const diff = buildFieldDiff_(rowBefore, rowAfter, map, [field, WF.firmaBoletaUrl, WF.boletaFirmadaUrl, WF.facturaUrl, WF.firmaFacturaUrl, WF.constanciaPagoUrl]);

        appendBitacora_({
            id: String(id || ''),
            usuario: String(actorEmail || 'sistema'),
            etapa: String(sh.getRange(rowNum, COL_ETAPA).getValue() || ''),
            accion: 'Carga PDF (' + incomingField + ')',
            resultado: 'OK',
            destinatario: '',
            detalle: buildAuditMeta_(auditCtx, { url: fileUrl, diff: diff })
        });

        // Auto-reglas de avance por evidencia cargada.
        const autoRes = applyAutoEtapaRules_(id, actorEmail, { actorCtx: auditCtx, source: 'upload_pdf' });

        return {
            success: true,
            url: fileUrl,
            fileId: file.getId(),
            name: file.getName(),
            autoMove: autoRes
        };
    } catch (e) {
        return { success: false, message: 'Error al subir PDF: ' + String(e && e.message ? e.message : e) };
    }
}

function subirBoletaFirmada(id, fileName, mimeType, dataUrl, actorEmail) {
    return subirPdfFlujo(id, WF.firmaBoletaUrl, fileName, mimeType, dataUrl, actorEmail);
}

function updateCobroCampos(id, updates, actorEmail, actorCtx) {
    updates = updates || {};
    const ss = getDataStore_();
    const sh = ss.getSheetByName('Aprobaciones');
    if (!sh) return { success: false, message: 'No existe hoja Aprobaciones.' };
    const schema = ensureAprobacionesSchema_(sh);
    const profile = getUserProfile_(actorEmail);
    if (!profile.email) return { success: false, message: 'Usuario no autorizado.' };
    const auditCtx = parseActorCtx_(actorCtx);

    const rowNum = findRowById_(sh, id);
    if (!rowNum) return { success: false, message: 'ID no encontrado.' };
    const lastCol = sh.getLastColumn();
    const headers = sh.getRange(1, 1, 1, lastCol).getValues()[0];
    const map = schema.map || buildHeaderMap_(headers);
    const rowBefore = sh.getRange(rowNum, 1, 1, lastCol).getValues()[0];
    const access = ensureActorCanAccessAprobacionRow_(profile, rowBefore, map);
    if (!access.ok) return { success: false, message: access.message };
    const estadoActual = normalizeEstado_(rowBefore[COL_ESTADO - 1]);

    const allowedFields = [
        WF.firmaBoletaLink, WF.boletaFirmadaUrl, WF.firmaBoletaUrl,
        WF.inventarioStatus, WF.comentarioInventario,
        WF.ovNumero, WF.rutaId, WF.facturaNumero, WF.facturaUrl,
        WF.firmaFacturaLink, WF.firmaFacturaUrl,
        WF.liquidacionRef, WF.constanciaPagoUrl, WF.rmNumero, WF.facturasDebitar, WF.debitoRef, WF.motivoObservacion
    ];

    const payload = {};
    const changed = [];

    for (let i = 0; i < allowedFields.length; i++) {
        const h = allowedFields[i];
        if (!(h in updates)) continue;
        if (!canEditField_(profile, h)) {
            return { success: false, message: 'No tiene permiso para editar: ' + h };
        }
        if (h === WF.motivoObservacion && estadoActual === 'Observado' && !profile.canForce) {
            return { success: false, message: 'El comentario de observación solo puede cambiarse al registrar la observación o por un administrador.' };
        }
        let val = updates[h];
        if (h === WF.inventarioStatus) {
            const raw = String(val || '').trim();
            if (raw && ['OK', 'Ajuste', 'No hay'].indexOf(raw) < 0) {
                return { success: false, message: 'InventarioStatus debe ser: OK, Ajuste o No hay.' };
            }
            val = raw;
        }
        const valTxt = String(val || '').trim();
        payload[h] = valTxt;
        // Mantiene compatibilidad entre legacy (FirmaBoletaUrl) y nuevo campo (BoletaFirmadaUrl).
        if (h === WF.firmaBoletaUrl || h === WF.boletaFirmadaUrl) {
            payload[WF.firmaBoletaUrl] = valTxt;
            payload[WF.boletaFirmadaUrl] = valTxt;
        }
        changed.push(h);
    }

    if (!changed.length) return { success: true, message: 'Sin cambios.' };
    payload[WF.areaResponsableActual] = rowText_(rowBefore, map, [WF.areaResponsableActual]) || inferAreaFromRole_(profile.rol);

    const etapaActual = normalizeEtapa_(rowBefore[COL_ETAPA - 1]);
    const idxActual = etapaIndex_(etapaActual);
    const aplicacionPagoTxt = String((WF.facturasDebitar in payload ? payload[WF.facturasDebitar] : rowText_(rowBefore, map, [WF.facturasDebitar])) || '').trim();
    const autoClosed = (idxActual === ETAPAS_COBRO.length && !!aplicacionPagoTxt && estadoActual !== 'Cerrado');

    writeRowFields_(sh, rowNum, schema.map, payload);
    sh.getRange(rowNum, COL_ULT_ACT).setValue(new Date());
    if (autoClosed) sh.getRange(rowNum, COL_ESTADO).setValue('Cerrado');
    const rowAfter = sh.getRange(rowNum, 1, 1, lastCol).getValues()[0];
    const diff = buildFieldDiff_(rowBefore, rowAfter, map, changed.concat([WF.areaResponsableActual, 'Estado']));

    appendBitacora_({
        id,
        usuario: String(actorEmail || 'sistema'),
        etapa: String(sh.getRange(rowNum, COL_ETAPA).getValue() || ''),
        accion: 'Actualización de campos',
        resultado: 'OK',
        detalle: buildAuditMeta_(auditCtx, {
            fields: changed,
            diff: diff,
            autoClosed: autoClosed
        })
    });

    const autoMove = applyAutoEtapaRules_(id, actorEmail, { actorCtx: auditCtx, source: 'update_campos' });
    return { success: true, changed, autoMove, autoClosed };
}

function setCobroObservado(id, motivo, areaDestino, actorEmail, actorCtx) {
    const ss = getDataStore_();
    const sh = ss.getSheetByName('Aprobaciones');
    if (!sh) return { success: false, message: 'No existe hoja Aprobaciones.' };
    const schema = ensureAprobacionesSchema_(sh);
    const profile = getUserProfile_(actorEmail);
    if (!profile.email) return { success: false, message: 'Usuario no autorizado.' };
    const auditCtx = parseActorCtx_(actorCtx);

    const rowNum = findRowById_(sh, id);
    if (!rowNum) return { success: false, message: 'ID no encontrado.' };
    const lastCol = sh.getLastColumn();
    const headers = sh.getRange(1, 1, 1, lastCol).getValues()[0];
    const map = schema.map || buildHeaderMap_(headers);
    const row = sh.getRange(rowNum, 1, 1, lastCol).getValues()[0];
    const access = ensureActorCanAccessAprobacionRow_(profile, row, map);
    if (!access.ok) return { success: false, message: access.message };
    const areaActual = rowText_(row, map, [WF.areaResponsableActual]) || areaResponsablePorEtapa_(etapaIndex_(row[COL_ETAPA - 1]));
    const canObserve = profile.canForce || (profile.areaKey && profile.areaKey === areaKey_(areaActual));
    if (!canObserve) return { success: false, message: 'No tiene permiso para observar este caso.' };
    const now = new Date();
    const etapaActual = normalizeEtapa_(sh.getRange(rowNum, COL_ETAPA).getValue());
    const etapaDestino = previousEtapaCobro_(etapaActual);
    const motivoTxt = String(motivo || '').trim();
    if (!motivoTxt) return { success: false, message: 'Debe indicar MotivoObservacion.' };
    if (!etapaDestino) return { success: false, message: 'La etapa actual no tiene una etapa anterior para devolver.' };

    const idxDestino = etapaIndex_(etapaDestino);
    const areaTxt = areaResponsablePorEtapa_(idxDestino);
    const stageSlaUpdates = buildStageSlaEntryFields_(idxDestino, now);
    sh.getRange(rowNum, COL_ETAPA).setValue(etapaDestino);
    sh.getRange(rowNum, COL_ESTADO).setValue('Observado');
    sh.getRange(rowNum, COL_ULT_ACT).setValue(now);
    const observedUpdates = {
        [WF.etapaAnterior]: etapaActual,
        [WF.motivoObservacion]: motivoTxt,
        [WF.areaResponsableActual]: areaTxt
    };
    Object.keys(stageSlaUpdates).forEach(k => observedUpdates[k] = stageSlaUpdates[k]);
    writeRowFields_(sh, rowNum, schema.map, observedUpdates);

    appendBitacora_({
        id,
        usuario: String(actorEmail || 'sistema'),
        etapa: etapaDestino,
        accion: 'Marcado como Observado',
        resultado: 'OK',
        detalle: buildAuditMeta_(auditCtx, {
            motivo: motivoTxt,
            areaReporta: areaActual,
            areaDestino: areaTxt,
            etapaObservada: etapaActual,
            etapaRetorno: etapaDestino,
            message: 'No puede continuar en la etapa actual. El caso regresa a la etapa anterior con estado Observado.'
        })
    });
    const notification = sendObservedReturnNotification_({
        id: id,
        row: row,
        headerMap: map,
        etapaActual: etapaDestino,
        etapaReportada: etapaActual,
        areaReportada: areaTxt,
        areaReporta: areaActual,
        motivoObservacion: motivoTxt,
        actorEmail: actorEmail,
        actorCtx: auditCtx
    });

    try {
        const rowAfter = sh.getRange(rowNum, 1, 1, lastCol).getValues()[0];
        createStageNotifications_({
            id: id,
            etapa: etapaDestino,
            oldEtapa: etapaActual,
            actorEmail: actorEmail,
            row: rowAfter,
            headerMap: map,
            accion: 'Marcado como Observado',
            proveedor: String(rowAfter[2] || ''),
            ruta: String(rowAfter[5] || ''),
            monto: Number(rowAfter[12] || 0)
        });
    } catch (e) { }

    return {
        success: true,
        estado: 'Observado',
        etapa: etapaDestino,
        etapaAnterior: etapaActual,
        areaResponsableActual: areaTxt,
        notification: notification
    };
}

function revertirCobroObservado(id, actorEmail, actorCtx) {
    const ss = getDataStore_();
    const sh = ss.getSheetByName('Aprobaciones');
    if (!sh) return { success: false, message: 'No existe hoja Aprobaciones.' };
    const schema = ensureAprobacionesSchema_(sh);
    const profile = getUserProfile_(actorEmail);
    if (!profile.email) return { success: false, message: 'Usuario no autorizado.' };
    const auditCtx = parseActorCtx_(actorCtx);

    if (boolConfig_('criticalRevertRequireApproval', false)) {
        const approvalId = String(auditCtx.approvalId || '').trim();
        if (!approvalId) {
            const req = crearSolicitudAprobacionCritica(
                'REVERTIR_OBSERVADO',
                id,
                'Revertir caso observado',
                {},
                actorEmail,
                auditCtx
            );
            if (!req.success) return { success: false, message: req.message || 'No se pudo crear solicitud.' };
            return {
                success: false,
                requiresApproval: true,
                approvalId: req.solicitudId,
                message: 'Solicitud creada. Requiere aprobacion de supervisor/admin.'
            };
        }
        const val = validarAprobacionCritica_(approvalId, 'REVERTIR_OBSERVADO', id);
        if (!val.ok) return { success: false, message: val.message || 'Aprobacion invalida.' };
    }

    const rowNum = findRowById_(sh, id);
    if (!rowNum) return { success: false, message: 'ID no encontrado.' };
    const lastCol = sh.getLastColumn();
    const headers = sh.getRange(1, 1, 1, lastCol).getValues()[0];
    const row = sh.getRange(rowNum, 1, 1, lastCol).getValues()[0];
    const map = schema.map || buildHeaderMap_(headers);
    const access = ensureActorCanAccessAprobacionRow_(profile, row, map);
    if (!access.ok) return { success: false, message: access.message };
    const estado = normalizeEstado_(row[COL_ESTADO - 1]);
    if (estado !== 'Observado') return { success: false, message: 'El caso no esta en estado Observado.' };
    const storedEtapaAnterior = rowText_(row, map, [WF.etapaAnterior]);
    const motivoObservacion = rowText_(row, map, [WF.motivoObservacion]);
    const areaStored = rowText_(row, map, [WF.areaResponsableActual]) || areaResponsablePorEtapa_(etapaIndex_(row[COL_ETAPA - 1]));
    const etapaDestino = resolveObservedReturnEtapa_(storedEtapaAnterior, row[COL_ETAPA - 1]);
    const etapaReportada = resolveObservedSourceEtapa_(storedEtapaAnterior, row[COL_ETAPA - 1]);
    const areaActual = resolveObservedResponsibleArea_(estado, row[COL_ETAPA - 1], storedEtapaAnterior, areaStored);
    const canRevert = profile.canForce || (profile.areaKey && profile.areaKey === areaKey_(areaActual));
    if (!canRevert) return { success: false, message: 'No tiene permiso para revertir este caso.' };
    const idxDestino = etapaIndex_(etapaDestino);
    const now = new Date();
    if (!etapaDestino || idxDestino < 1) {
        return { success: false, message: 'No se pudo determinar la etapa anterior del caso observado.' };
    }
    if (normalizeEtapa_(row[COL_ETAPA - 1]) === etapaDestino) {
        return {
            success: true,
            etapa: etapaDestino,
            estado: 'Observado',
            areaResponsableActual: areaResponsablePorEtapa_(idxDestino),
            message: 'El caso ya se encuentra en la etapa anterior con estado Observado.'
        };
    }

    sh.getRange(rowNum, COL_ETAPA).setValue(etapaDestino);
    sh.getRange(rowNum, COL_ESTADO).setValue('Observado');
    sh.getRange(rowNum, COL_ULT_ACT).setValue(now);
    const stageSlaUpdates = buildStageSlaEntryFields_(idxDestino, now);
    const revertUpdates = {
        [WF.areaResponsableActual]: areaResponsablePorEtapa_(idxDestino),
        [WF.fechaIngresoEtapaActual]: stageSlaUpdates[WF.fechaIngresoEtapaActual],
        [WF.fechaLimiteSlaActual]: stageSlaUpdates[WF.fechaLimiteSlaActual]
    };
    if (stageSlaUpdates[WF.fechaLimiteFirmaBoleta] !== undefined) revertUpdates[WF.fechaLimiteFirmaBoleta] = stageSlaUpdates[WF.fechaLimiteFirmaBoleta];
    if (stageSlaUpdates[WF.fechaLimiteFirmaFactura] !== undefined) revertUpdates[WF.fechaLimiteFirmaFactura] = stageSlaUpdates[WF.fechaLimiteFirmaFactura];
    writeRowFields_(sh, rowNum, map, revertUpdates);

    appendBitacora_({
        id,
        usuario: String(actorEmail || 'sistema'),
        etapa: etapaDestino,
        accion: 'Retorno manual de Observado',
        resultado: 'OK',
        detalle: buildAuditMeta_(auditCtx, {
            message: 'Caso regresado manualmente a la etapa anterior manteniendo el estado Observado.'
        })
    });
    const notification = sendObservedReturnNotification_({
        id: id,
        row: row,
        headerMap: map,
        etapaActual: etapaDestino,
        etapaReportada: etapaReportada,
        areaReportada: areaResponsablePorEtapa_(idxDestino),
        areaReporta: areaResponsablePorEtapa_(etapaIndex_(etapaReportada)),
        motivoObservacion: motivoObservacion,
        actorEmail: actorEmail,
        actorCtx: auditCtx
    });

    try {
        const rowAfter = sh.getRange(rowNum, 1, 1, lastCol).getValues()[0];
        createStageNotifications_({
            id: id,
            etapa: etapaDestino,
            oldEtapa: String(row[COL_ETAPA - 1] || ''),
            actorEmail: actorEmail,
            row: rowAfter,
            headerMap: map,
            accion: 'Retorno manual de Observado',
            proveedor: String(rowAfter[2] || ''),
            ruta: String(rowAfter[5] || ''),
            monto: Number(rowAfter[12] || 0)
        });
    } catch (e) { }

    return {
        success: true,
        etapa: etapaDestino,
        estado: 'Observado',
        areaResponsableActual: areaResponsablePorEtapa_(idxDestino),
        notification: notification
    };
}

function anularCobro(id, motivo, actorEmail, actorCtx) {
    try {
        const ss = getDataStore_();
        const sh = ss.getSheetByName('Aprobaciones');
        if (!sh) return { success: false, message: 'No existe hoja Aprobaciones.' };
        const schema = ensureAprobacionesSchema_(sh);
        const profile = getUserProfile_(actorEmail);
        if (!profile.email) return { success: false, message: 'Usuario no autorizado.' };
        if (!profile.canForce) return { success: false, message: 'Solo administradores pueden anular boletas.' };
        const auditCtx = parseActorCtx_(actorCtx);

        const rowNum = findRowById_(sh, id);
        if (!rowNum) return { success: false, message: 'ID no encontrado.' };
        const lastCol = sh.getLastColumn();
        const headers = sh.getRange(1, 1, 1, lastCol).getValues()[0];
        const row = sh.getRange(rowNum, 1, 1, lastCol).getValues()[0];
        const map = schema.map || buildHeaderMap_(headers);
        const access = ensureActorCanAccessAprobacionRow_(profile, row, map);
        if (!access.ok) return { success: false, message: access.message };

        const estadoActual = normalizeEstado_(row[COL_ESTADO - 1]);
        if (estadoActual === 'Anulado') return { success: false, message: 'Esta boleta ya fue anulada.' };

        const motivoTxt = String(motivo || '').trim();
        if (!motivoTxt) return { success: false, message: 'Debe indicar el motivo de anulacion.' };

        const now = new Date();
        const etapaActual = normalizeEtapa_(sh.getRange(rowNum, COL_ETAPA).getValue());

        sh.getRange(rowNum, COL_ESTADO).setValue('Anulado');
        sh.getRange(rowNum, COL_ULT_ACT).setValue(now);
        writeRowFields_(sh, rowNum, schema.map, {
            [WF.motivoObservacion]: 'ANULADO: ' + motivoTxt
        });

        appendBitacora_({
            id: id,
            usuario: String(actorEmail || 'sistema'),
            etapa: etapaActual,
            accion: 'Cobro anulado',
            resultado: 'OK',
            detalle: buildAuditMeta_(auditCtx, {
                motivo: motivoTxt,
                estadoAnterior: estadoActual
            })
        });

        return { success: true, message: 'Boleta anulada correctamente.' };
    } catch (e) {
        return { success: false, message: 'Error al anular cobro: ' + String(e && e.message ? e.message : e) };
    }
}

function installSlaHourlyTrigger() {
    const trg = ScriptApp.getProjectTriggers();
    const exists = trg.some(t => t.getHandlerFunction() === 'runSlaReminderTick');
    if (exists) return { success: true, message: 'Trigger ya existe.' };
    ScriptApp.newTrigger('runSlaReminderTick').timeBased().everyHours(1).create();
    return { success: true, message: 'Trigger SLA creado (cada hora).' };
}

function installDailySlaDigestTrigger(actorEmail) {
    const guard = requireAdminForConfig_(actorEmail);
    if (!guard.success) return guard;
    const trg = ScriptApp.getProjectTriggers();
    const exists = trg.some(t => t.getHandlerFunction() === 'runDailyOverdueStageNotifications');
    if (exists) return { success: true, message: 'Trigger diario SLA ya existe.' };
    ScriptApp.newTrigger('runDailyOverdueStageNotifications').timeBased().everyDays(1).atHour(8).create();
    return { success: true, message: 'Trigger diario SLA creado (08:00).' };
}

function initSistemaCobros() {
    try { ensureSupabaseScriptProperties_(); } catch (e) { }
    const c = ensureCorreosSheet_();
    const b = ensureBitacoraSheet_();
    const p = ensurePlantillasSheet_();
    const a = ensureAprobacionesCriticasSheet_();
    const cfg = ensureRuleEngineSheets_();
    return {
        success: true,
        sheets: {
            correos: c.getName(),
            bitacora: b.getName(),
            plantillas: p.getName(),
            aprobacionesCriticas: a.getName(),
            configRules: cfg
        }
    };
}

