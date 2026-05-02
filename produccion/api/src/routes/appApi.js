import { Router } from 'express';
import { getGasRuntime } from '../gas/runtime.js';
import { executeLegacySpecial } from '../services/legacySpecial.js';
import {
  createGroupedPaymentModule,
  getPaymentDetailModule,
  listEligiblePaymentCobrosModule,
  listPaymentsModule
} from '../services/paymentsModule.js';

const SPECIAL_METHODS = new Set([
  'getPdfRootMeta',
  'getPdfRootUrl',
  'getDataForFrontend',
  'adminGetProveedores',
  'adminSaveProvider',
  'getCobroFlowData',
  'adminGetMaestroItems',
  'adminGetMaestroItemsJson',
  'procesarCobro',
  'subirPdfFlujo',
  'subirBoletaFirmada',
  'generarZipPdfsGestion',
  'deleteGestionCobros',
  'updateCobroEtapa',
  'updateCobroCampos'
]);

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function requiredString(value, message) {
  const normalized = String(value || '').trim();
  if (!normalized) throw createHttpError(400, message);
  return normalized;
}

function optionalString(value) {
  return String(value || '').trim();
}

function optionalNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function optionalBoolean(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (value == null || value === '') return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'si', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

async function invokeLegacy(method, args, req) {
  if (SPECIAL_METHODS.has(method)) {
    return executeLegacySpecial(method, args, { req });
  }
  const runtime = getGasRuntime();
  if (!runtime.has(method)) {
    throw createHttpError(404, `Metodo no soportado: ${method}`);
  }
  return runtime.call(method, args);
}

function invalidateRuntimeSheets(sheetNames) {
  const runtime = getGasRuntime();
  const list = Array.isArray(sheetNames) ? sheetNames : [sheetNames];
  list.forEach((sheetName) => {
    const normalized = String(sheetName || '').trim();
    if (!normalized || !runtime.has('invalidateDataStoreCache_')) return;
    try {
      runtime.call('invalidateDataStoreCache_', [normalized]);
    } catch {
      // Best effort only.
    }
  });
}

function refreshRuntimeCatalog(sheetNames, clearMethods = []) {
  invalidateRuntimeSheets(sheetNames);
  const runtime = getGasRuntime();
  const methods = Array.isArray(clearMethods) ? clearMethods : [clearMethods];
  methods.forEach((methodName) => {
    const normalized = String(methodName || '').trim();
    if (!normalized || !runtime.has(normalized)) return;
    try {
      runtime.call(normalized, []);
    } catch {
      // Best effort only.
    }
  });
}

function jsonRoute(handler) {
  return async (req, res) => {
    try {
      const result = await handler(req, res);
      if (!res.headersSent) {
        res.json(result ?? null);
      }
    } catch (error) {
      res.status(error?.status || 500).json({
        message: error?.message || 'Error procesando solicitud.',
        stack: process.env.NODE_ENV === 'production' ? undefined : error?.stack
      });
    }
  };
}

export const appApiRouter = Router();

appApiRouter.post('/session/login', jsonRoute((req) => {
  refreshRuntimeCatalog(['Usuarios'], ['clearUserCaches_']);
  return invokeLegacy('validarUsuario', [
    requiredString(req.body?.email, 'Correo requerido.'),
    optionalString(req.body?.password)
  ], req);
}));

appApiRouter.get('/session/restore', jsonRoute((req) => {
  refreshRuntimeCatalog(['Usuarios'], ['clearUserCaches_']);
  return invokeLegacy('restaurarSesionUsuario', [
    requiredString(req.query.email, 'Correo requerido.')
  ], req);
}));

appApiRouter.get('/bootstrap', jsonRoute((req) => {
  return invokeLegacy('getDataForFrontend', [optionalString(req.query.actorEmail)], req);
}));

appApiRouter.get('/catalog/responsables', jsonRoute((req) => {
  refreshRuntimeCatalog(['Usuarios'], ['clearUserCaches_']);
  return invokeLegacy('getResponsablesCatalog', [], req);
}));

appApiRouter.get('/catalog/etapas-cobro', jsonRoute((req) => {
  return invokeLegacy('getEtapasCobro', [], req);
}));

appApiRouter.get('/dashboard/stats', jsonRoute((req) => {
  invalidateRuntimeSheets(['Aprobaciones', 'Detalle_Cobros']);
  return invokeLegacy('getDashboardStats', [optionalString(req.query.actorEmail)], req);
}));

appApiRouter.get('/reports/advanced', jsonRoute((req) => {
  invalidateRuntimeSheets(['Aprobaciones', 'Detalle_Cobros']);
  return invokeLegacy('getAdvancedReportData', [
    optionalString(req.query.inicio),
    optionalString(req.query.fin),
    optionalString(req.query.actorEmail)
  ], req);
}));

appApiRouter.get('/history/cobros', jsonRoute((req) => {
  invalidateRuntimeSheets(['Aprobaciones']);
  return invokeLegacy('getHistorialCobros', [
    optionalNumber(req.query.limit, 80),
    optionalString(req.query.actorEmail)
  ], req);
}));

appApiRouter.get('/storage/pdf-root', jsonRoute((req) => {
  return invokeLegacy('getPdfRootUrl', [], req);
}));

appApiRouter.get('/storage/pdf-root/meta', jsonRoute((req) => {
  return invokeLegacy('getPdfRootMeta', [], req);
}));

appApiRouter.get('/notifications', jsonRoute((req) => {
  return invokeLegacy('getUserNotifications', [
    requiredString(req.query.actorEmail, 'Correo requerido.'),
    {
      limit: optionalNumber(req.query.limit, 30),
      includeRead: optionalBoolean(req.query.includeRead, true),
      force: optionalBoolean(req.query.force, false)
    }
  ], req);
}));

appApiRouter.post('/notifications/:id/read', jsonRoute((req) => {
  return invokeLegacy('markNotificationRead', [
    requiredString(req.params.id, 'Notificacion requerida.'),
    requiredString(req.body?.actorEmail, 'Correo requerido.')
  ], req);
}));

appApiRouter.post('/notifications/read-all', jsonRoute((req) => {
  return invokeLegacy('markAllNotificationsRead', [
    requiredString(req.body?.actorEmail, 'Correo requerido.')
  ], req);
}));

appApiRouter.get('/gestion/snapshot', jsonRoute((req) => {
  invalidateRuntimeSheets(['Aprobaciones', 'Detalle_Cobros']);
  return invokeLegacy('getGestionSnapshot', [optionalString(req.query.actorEmail)], req);
}));

appApiRouter.get('/gestion/resumen', jsonRoute((req) => {
  invalidateRuntimeSheets(['Aprobaciones', 'Detalle_Cobros']);
  return invokeLegacy('getGestionResumen', [optionalString(req.query.actorEmail)], req);
}));

appApiRouter.post('/gestion/delete', jsonRoute((req) => {
  return invokeLegacy('deleteGestionCobros', [
    Array.isArray(req.body?.ids) ? req.body.ids : [],
    optionalString(req.body?.authKey),
    optionalString(req.body?.motivo),
    optionalString(req.body?.actorEmail),
    req.body?.actorCtx || {}
  ], req);
}));

appApiRouter.post('/gestion/responsable/bulk', jsonRoute((req) => {
  return invokeLegacy('bulkUpdateResponsable', [
    Array.isArray(req.body?.ids) ? req.body.ids : [],
    optionalString(req.body?.responsable),
    optionalString(req.body?.actorEmail),
    req.body?.actorCtx || {}
  ], req);
}));

appApiRouter.post('/gestion/observado/bulk', jsonRoute((req) => {
  return invokeLegacy('bulkMarcarObservado', [
    Array.isArray(req.body?.ids) ? req.body.ids : [],
    optionalString(req.body?.motivo),
    optionalString(req.body?.areaDestino),
    optionalString(req.body?.actorEmail),
    req.body?.actorCtx || {}
  ], req);
}));

appApiRouter.post('/gestion/pdfs/zip', jsonRoute((req) => {
  return invokeLegacy('generarZipPdfsGestion', [
    Array.isArray(req.body?.ids) ? req.body.ids : [],
    optionalString(req.body?.actorEmail),
    req.body?.actorCtx || {}
  ], req);
}));

appApiRouter.get('/payments', jsonRoute((req) => {
  return listPaymentsModule({
    actorEmail: optionalString(req.query.actorEmail),
    q: optionalString(req.query.q)
  });
}));

appApiRouter.get('/payments/eligible-cobros', jsonRoute((req) => {
  return listEligiblePaymentCobrosModule({
    actorEmail: optionalString(req.query.actorEmail),
    q: optionalString(req.query.q)
  });
}));

appApiRouter.get('/payments/:id', jsonRoute((req) => {
  return getPaymentDetailModule({
    actorEmail: optionalString(req.query.actorEmail),
    paymentId: requiredString(req.params.id, 'ID de pago requerido.')
  });
}));

appApiRouter.post('/payments', jsonRoute((req) => {
  return createGroupedPaymentModule({
    actorEmail: optionalString(req.body?.actorEmail),
    payment: req.body?.payment || {},
    req
  });
}));

appApiRouter.get('/cobros/:id/timeline', jsonRoute((req) => {
  return invokeLegacy('getCobroTimeline', [
    requiredString(req.params.id, 'ID requerido.'),
    optionalNumber(req.query.limit, 120),
    optionalString(req.query.actorEmail)
  ], req);
}));

appApiRouter.get('/cobros/:id/flow', jsonRoute((req) => {
  invalidateRuntimeSheets(['Aprobaciones', 'Detalle_Cobros']);
  return invokeLegacy('getCobroFlowData', [
    requiredString(req.params.id, 'ID requerido.'),
    optionalString(req.query.actorEmail)
  ], req);
}));

appApiRouter.post('/cobros', jsonRoute((req) => {
  return invokeLegacy('procesarCobro', [req.body || {}], req);
}));

appApiRouter.post('/cobros/:id/etapa', jsonRoute((req) => {
  return invokeLegacy('updateCobroEtapa', [
    requiredString(req.params.id, 'ID requerido.'),
    requiredString(req.body?.etapa, 'Etapa requerida.'),
    optionalString(req.body?.actorEmail),
    req.body?.actorCtx || req.body?.opts || {}
  ], req);
}));

appApiRouter.patch('/cobros/:id/campos', jsonRoute((req) => {
  return invokeLegacy('updateCobroCampos', [
    requiredString(req.params.id, 'ID requerido.'),
    req.body?.updates || {},
    optionalString(req.body?.actorEmail),
    req.body?.actorCtx || {}
  ], req);
}));

appApiRouter.post('/cobros/:id/observado', jsonRoute((req) => {
  return invokeLegacy('setCobroObservado', [
    requiredString(req.params.id, 'ID requerido.'),
    optionalString(req.body?.motivo),
    optionalString(req.body?.areaDestino),
    optionalString(req.body?.actorEmail),
    req.body?.actorCtx || {}
  ], req);
}));

appApiRouter.post('/cobros/:id/observado/revertir', jsonRoute((req) => {
  return invokeLegacy('revertirCobroObservado', [
    requiredString(req.params.id, 'ID requerido.'),
    optionalString(req.body?.actorEmail),
    req.body?.actorCtx || {}
  ], req);
}));

appApiRouter.post('/cobros/:id/anular', jsonRoute((req) => {
  return invokeLegacy('anularCobro', [
    requiredString(req.params.id, 'ID requerido.'),
    optionalString(req.body?.motivo),
    optionalString(req.body?.actorEmail),
    req.body?.actorCtx || {}
  ], req);
}));

appApiRouter.post('/cobros/:id/files', jsonRoute((req) => {
  return invokeLegacy('subirPdfFlujo', [
    requiredString(req.params.id, 'ID requerido.'),
    requiredString(req.body?.fieldName, 'Campo requerido.'),
    optionalString(req.body?.fileName),
    optionalString(req.body?.mimeType),
    optionalString(req.body?.dataUrl),
    optionalString(req.body?.actorEmail),
    req.body?.actorCtx || {}
  ], req);
}));

appApiRouter.get('/aprobaciones-criticas', jsonRoute((req) => {
  return invokeLegacy('listarAprobacionesCriticas', [
    optionalString(req.query.estado),
    optionalString(req.query.actorEmail)
  ], req);
}));

appApiRouter.post('/aprobaciones-criticas/:solicitudId/resolve', jsonRoute((req) => {
  return invokeLegacy('resolverAprobacionCritica', [
    requiredString(req.params.solicitudId, 'Solicitud requerida.'),
    optionalBoolean(req.body?.aprobar, false),
    optionalString(req.body?.comentario),
    optionalString(req.body?.actorEmail),
    req.body?.actorCtx || {}
  ], req);
}));

appApiRouter.get('/admin/users', jsonRoute((req) => {
  refreshRuntimeCatalog(['Usuarios'], ['clearUserCaches_']);
  return invokeLegacy('adminGetUsers', [], req);
}));

appApiRouter.post('/admin/users', jsonRoute((req) => {
  return invokeLegacy('adminSaveUser', [req.body?.user || req.body || {}], req);
}));

appApiRouter.delete('/admin/users/:row', jsonRoute((req) => {
  return invokeLegacy('adminDeleteUser', [
    optionalNumber(req.params.row, 0),
    optionalString(req.query.actorEmail)
  ], req);
}));

appApiRouter.get('/admin/providers', jsonRoute((req) => {
  refreshRuntimeCatalog(['Proveedores'], ['clearProviderCaches_']);
  return invokeLegacy('adminGetProveedores', [optionalString(req.query.actorEmail)], req);
}));

appApiRouter.post('/admin/providers', jsonRoute((req) => {
  return invokeLegacy('adminSaveProvider', [
    req.body?.provider || req.body || {},
    optionalString(req.body?.actorEmail)
  ], req);
}));

appApiRouter.delete('/admin/providers/:row', jsonRoute((req) => {
  return invokeLegacy('adminDeleteProvider', [
    optionalNumber(req.params.row, 0),
    optionalString(req.query.actorEmail)
  ], req);
}));

appApiRouter.post('/admin/providers/:row/toggle-active', jsonRoute((req) => {
  return invokeLegacy('adminToggleProviderActivo', [
    optionalNumber(req.params.row, 0),
    optionalBoolean(req.body?.active, false),
    optionalString(req.body?.actorEmail)
  ], req);
}));

appApiRouter.get('/admin/pilots', jsonRoute((req) => {
  refreshRuntimeCatalog(['Pilotos'], ['clearPilotCaches_']);
  return invokeLegacy('adminGetPilotos', [optionalString(req.query.actorEmail)], req);
}));

appApiRouter.post('/admin/pilots', jsonRoute((req) => {
  return invokeLegacy('adminSavePilot', [
    req.body?.pilot || req.body || {},
    optionalString(req.body?.actorEmail)
  ], req);
}));

appApiRouter.delete('/admin/pilots/:row', jsonRoute((req) => {
  return invokeLegacy('adminDeletePilot', [
    optionalNumber(req.params.row, 0),
    optionalString(req.query.actorEmail)
  ], req);
}));

appApiRouter.get('/admin/maestro', jsonRoute((req) => {
  refreshRuntimeCatalog(['maestro'], ['clearMaestroCaches_']);
  return invokeLegacy('adminGetMaestroItems', [optionalString(req.query.actorEmail)], req);
}));

appApiRouter.get('/admin/maestro.json', jsonRoute((req) => {
  refreshRuntimeCatalog(['maestro'], ['clearMaestroCaches_']);
  return invokeLegacy('adminGetMaestroItemsJson', [optionalString(req.query.actorEmail)], req);
}));

appApiRouter.get('/admin/maestro/debug', jsonRoute((req) => {
  return invokeLegacy('adminDebugMaestroState', [], req);
}));

appApiRouter.post('/admin/maestro/import', jsonRoute((req) => {
  return invokeLegacy('adminImportMaestroItems', [
    Array.isArray(req.body?.items) ? req.body.items : [],
    req.body?.options || {},
    optionalString(req.body?.actorEmail)
  ], req);
}));

appApiRouter.post('/admin/maestro/:row/toggle-active', jsonRoute((req) => {
  return invokeLegacy('adminToggleMaestroActivo', [
    optionalNumber(req.params.row, 0),
    optionalBoolean(req.body?.active, false),
    optionalString(req.body?.actorEmail)
  ], req);
}));

appApiRouter.post('/admin/maestro', jsonRoute((req) => {
  return invokeLegacy('adminSaveMaestroItem', [
    req.body?.item || req.body || {},
    optionalString(req.body?.actorEmail)
  ], req);
}));

appApiRouter.delete('/admin/maestro', jsonRoute((req) => {
  return invokeLegacy('adminDeleteMaestroItem', [
    req.body?.item || req.body || {},
    optionalString(req.body?.actorEmail)
  ], req);
}));

appApiRouter.delete('/admin/maestro/:row', jsonRoute((req) => {
  return invokeLegacy('adminDeleteMaestroItem', [
    optionalNumber(req.params.row, 0),
    optionalString(req.query.actorEmail)
  ], req);
}));

appApiRouter.post('/admin/notifications/daily-overdue/run', jsonRoute((req) => {
  return invokeLegacy('adminRunDailyOverdueStageNotifications', [
    optionalBoolean(req.body?.forceSend, false),
    optionalString(req.body?.actorEmail)
  ], req);
}));

appApiRouter.get('/config/rules', jsonRoute((req) => {
  return invokeLegacy('getRuleConfigData', [optionalString(req.query.actorEmail)], req);
}));

appApiRouter.post('/config/countries', jsonRoute((req) => {
  return invokeLegacy('saveCfgCountry', [
    req.body?.country || req.body || {},
    optionalString(req.body?.actorEmail)
  ], req);
}));

appApiRouter.delete('/config/countries/:row', jsonRoute((req) => {
  return invokeLegacy('deleteCfgCountry', [
    optionalNumber(req.params.row, 0),
    optionalString(req.query.actorEmail)
  ], req);
}));

appApiRouter.post('/config/roles', jsonRoute((req) => {
  return invokeLegacy('saveCfgRole', [
    req.body?.role || req.body || {},
    optionalString(req.body?.actorEmail)
  ], req);
}));

appApiRouter.delete('/config/roles/:row', jsonRoute((req) => {
  return invokeLegacy('deleteCfgRole', [
    optionalNumber(req.params.row, 0),
    optionalString(req.query.actorEmail)
  ], req);
}));

appApiRouter.post('/config/stage-sla', jsonRoute((req) => {
  return invokeLegacy('saveCfgStageSla', [
    req.body?.stageSla || req.body || {},
    optionalString(req.body?.actorEmail)
  ], req);
}));

appApiRouter.post('/config/stage-notify', jsonRoute((req) => {
  return invokeLegacy('saveCfgStageNotify', [
    req.body?.stageNotify || req.body || {},
    optionalString(req.body?.actorEmail)
  ], req);
}));

appApiRouter.post('/config/rules', jsonRoute((req) => {
  return invokeLegacy('saveCfgRule', [
    req.body?.rule || req.body || {},
    optionalString(req.body?.actorEmail)
  ], req);
}));

appApiRouter.delete('/config/rules/:row', jsonRoute((req) => {
  return invokeLegacy('deleteCfgRule', [
    optionalNumber(req.params.row, 0),
    optionalString(req.query.actorEmail)
  ], req);
}));

appApiRouter.post('/config/auth-keys', jsonRoute((req) => {
  return invokeLegacy('saveCfgAuthKey', [
    req.body?.authKey || req.body || {},
    optionalString(req.body?.actorEmail)
  ], req);
}));

appApiRouter.delete('/config/auth-keys/:row', jsonRoute((req) => {
  return invokeLegacy('deleteCfgAuthKey', [
    optionalNumber(req.params.row, 0),
    optionalString(req.query.actorEmail)
  ], req);
}));

appApiRouter.post('/config/correos', jsonRoute((req) => {
  return invokeLegacy('saveCfgCorreo', [
    req.body?.correo || req.body || {},
    optionalString(req.body?.actorEmail)
  ], req);
}));

appApiRouter.delete('/config/correos/:row', jsonRoute((req) => {
  return invokeLegacy('deleteCfgCorreo', [
    optionalNumber(req.params.row, 0),
    optionalString(req.query.actorEmail)
  ], req);
}));

appApiRouter.post('/config/mail-transport', jsonRoute((req) => {
  return invokeLegacy('saveMailTransportConfig', [
    req.body?.mailTransport || req.body || {},
    optionalString(req.body?.actorEmail)
  ], req);
}));

appApiRouter.get('/config/mail-transport/validate', jsonRoute((req) => {
  return invokeLegacy('validarMailTransportConfig', [optionalString(req.query.actorEmail)], req);
}));

appApiRouter.post('/config/mail-transport/test', jsonRoute((req) => {
  return invokeLegacy('testMailTransportConfig', [
    optionalString(req.body?.destino),
    optionalString(req.body?.actorEmail)
  ], req);
}));

appApiRouter.post('/config/triggers/daily-sla-digest/install', jsonRoute((req) => {
  return invokeLegacy('installDailySlaDigestTrigger', [optionalString(req.body?.actorEmail)], req);
}));
