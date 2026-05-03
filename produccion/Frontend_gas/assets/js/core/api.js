(function () {
  function buildApiQueryString_(query) {
    const params = new URLSearchParams();
    Object.entries(query || {}).forEach(([key, value]) => {
      if (value == null || value === '') return;
      params.append(key, String(value));
    });
    return params.toString();
  }

  const apiRouteMap_ = {
    validarUsuario: (args) => ({ method: 'POST', path: '/api/session/login', body: { email: args[0] || '', password: args[1] || '' } }),
    restaurarSesionUsuario: (args) => ({ method: 'GET', path: '/api/session/restore', query: { email: args[0] || '' } }),
    getDataForFrontend: (args) => ({ method: 'GET', path: '/api/bootstrap', query: { actorEmail: args[0] || '' } }),
    getResponsablesCatalog: () => ({ method: 'GET', path: '/api/catalog/responsables' }),
    getEtapasCobro: () => ({ method: 'GET', path: '/api/catalog/etapas-cobro' }),
    getDashboardStats: (args) => ({ method: 'GET', path: '/api/dashboard/stats', query: { actorEmail: args[0] || '' } }),
    getAdvancedReportData: (args) => ({ method: 'GET', path: '/api/reports/advanced', query: { inicio: args[0] || '', fin: args[1] || '', actorEmail: args[2] || '' } }),
    getHistorialCobros: (args) => ({ method: 'GET', path: '/api/history/cobros', query: { limit: args[0], actorEmail: args[1] || '' } }),
    getPdfRootUrl: () => ({ method: 'GET', path: '/api/storage/pdf-root' }),
    getPdfRootMeta: () => ({ method: 'GET', path: '/api/storage/pdf-root/meta' }),
    getUserNotifications: (args) => {
      const opts = (args[1] && typeof args[1] === 'object') ? args[1] : {};
      return {
        method: 'GET',
        path: '/api/notifications',
        query: {
          actorEmail: args[0] || '',
          limit: opts.limit,
          includeRead: opts.includeRead,
          force: opts.force
        }
      };
    },
    markNotificationRead: (args) => ({ method: 'POST', path: '/api/notifications/' + encodeURIComponent(String(args[0] || '')) + '/read', body: { actorEmail: args[1] || '' } }),
    markAllNotificationsRead: (args) => ({ method: 'POST', path: '/api/notifications/read-all', body: { actorEmail: args[0] || '' } }),
    getGestionSnapshot: (args) => ({ method: 'GET', path: '/api/gestion/snapshot', query: { actorEmail: args[0] || '' } }),
    getGestionResumen: (args) => ({ method: 'GET', path: '/api/gestion/resumen', query: { actorEmail: args[0] || '' } }),
    getPayments: (args) => ({ method: 'GET', path: '/api/payments', query: { actorEmail: args[0] || '', q: args[1] || '' } }),
    getEligiblePaymentCobros: (args) => ({ method: 'GET', path: '/api/payments/eligible-cobros', query: { actorEmail: args[0] || '', q: args[1] || '' } }),
    getPaymentDetail: (args) => ({ method: 'GET', path: '/api/payments/' + encodeURIComponent(String(args[0] || '')), query: { actorEmail: args[1] || '' } }),
    createGroupedPayment: (args) => ({ method: 'POST', path: '/api/payments', body: { payment: args[0] || {}, actorEmail: args[1] || '' } }),
    updateGroupedPayment: (args) => ({ method: 'PATCH', path: '/api/payments/' + encodeURIComponent(String(args[0] || '')), body: { payment: args[1] || {}, actorEmail: args[2] || '' } }),
    deleteGroupedPayment: (args) => ({ method: 'DELETE', path: '/api/payments/' + encodeURIComponent(String(args[0] || '')), query: { actorEmail: args[1] || '' } }),
    deleteGestionCobros: (args) => ({ method: 'POST', path: '/api/gestion/delete', body: { ids: args[0] || [], authKey: args[1] || '', motivo: args[2] || '', actorEmail: args[3] || '', actorCtx: args[4] || {} } }),
    bulkUpdateResponsable: (args) => ({ method: 'POST', path: '/api/gestion/responsable/bulk', body: { ids: args[0] || [], responsable: args[1] || '', actorEmail: args[2] || '', actorCtx: args[3] || {} } }),
    bulkMarcarObservado: (args) => ({ method: 'POST', path: '/api/gestion/observado/bulk', body: { ids: args[0] || [], motivo: args[1] || '', areaDestino: args[2] || '', actorEmail: args[3] || '', actorCtx: args[4] || {} } }),
    generarZipPdfsGestion: (args) => ({ method: 'POST', path: '/api/gestion/pdfs/zip', body: { ids: args[0] || [], actorEmail: args[1] || '', actorCtx: args[2] || {} } }),
    getCobroTimeline: (args) => ({ method: 'GET', path: '/api/cobros/' + encodeURIComponent(String(args[0] || '')) + '/timeline', query: { limit: args[1], actorEmail: args[2] || '' } }),
    getCobroFlowData: (args) => ({ method: 'GET', path: '/api/cobros/' + encodeURIComponent(String(args[0] || '')) + '/flow', query: { actorEmail: args[1] || '' } }),
    listarAprobacionesCriticas: (args) => ({ method: 'GET', path: '/api/aprobaciones-criticas', query: { estado: args[0] || '', actorEmail: args[1] || '' } }),
    resolverAprobacionCritica: (args) => ({ method: 'POST', path: '/api/aprobaciones-criticas/' + encodeURIComponent(String(args[0] || '')) + '/resolve', body: { aprobar: !!args[1], comentario: args[2] || '', actorEmail: args[3] || '', actorCtx: args[4] || {} } }),
    procesarCobro: (args) => ({ method: 'POST', path: '/api/cobros', body: args[0] || {} }),
    updateCobroEtapa: (args) => ({ method: 'POST', path: '/api/cobros/' + encodeURIComponent(String(args[0] || '')) + '/etapa', body: { etapa: args[1] || '', actorEmail: args[2] || '', actorCtx: args[3] || {} } }),
    updateCobroCampos: (args) => ({ method: 'PATCH', path: '/api/cobros/' + encodeURIComponent(String(args[0] || '')) + '/campos', body: { updates: args[1] || {}, actorEmail: args[2] || '', actorCtx: args[3] || {} } }),
    setCobroObservado: (args) => ({ method: 'POST', path: '/api/cobros/' + encodeURIComponent(String(args[0] || '')) + '/observado', body: { motivo: args[1] || '', areaDestino: args[2] || '', actorEmail: args[3] || '', actorCtx: args[4] || {} } }),
    revertirCobroObservado: (args) => ({ method: 'POST', path: '/api/cobros/' + encodeURIComponent(String(args[0] || '')) + '/observado/revertir', body: { actorEmail: args[1] || '', actorCtx: args[2] || {} } }),
    anularCobro: (args) => ({ method: 'POST', path: '/api/cobros/' + encodeURIComponent(String(args[0] || '')) + '/anular', body: { motivo: args[1] || '', actorEmail: args[2] || '', actorCtx: args[3] || {} } }),
    subirPdfFlujo: (args) => ({ method: 'POST', path: '/api/cobros/' + encodeURIComponent(String(args[0] || '')) + '/files', body: { fieldName: args[1] || '', fileName: args[2] || '', mimeType: args[3] || '', dataUrl: args[4] || '', actorEmail: args[5] || '', actorCtx: args[6] || {} } }),
    adminGetUsers: () => ({ method: 'GET', path: '/api/admin/users' }),
    adminSaveUser: (args) => ({ method: 'POST', path: '/api/admin/users', body: { user: args[0] || {} } }),
    adminDeleteUser: (args) => ({ method: 'DELETE', path: '/api/admin/users/' + encodeURIComponent(String(args[0] || '')), query: { actorEmail: args[1] || '' } }),
    adminGetProveedores: (args) => ({ method: 'GET', path: '/api/admin/providers', query: { actorEmail: args[0] || '' } }),
    adminSaveProvider: (args) => ({ method: 'POST', path: '/api/admin/providers', body: { provider: args[0] || {}, actorEmail: args[1] || '' } }),
    adminDeleteProvider: (args) => ({ method: 'DELETE', path: '/api/admin/providers/' + encodeURIComponent(String(args[0] || '')), query: { actorEmail: args[1] || '' } }),
    adminToggleProviderActivo: (args) => ({ method: 'POST', path: '/api/admin/providers/' + encodeURIComponent(String(args[0] || '')) + '/toggle-active', body: { active: !!args[1], actorEmail: args[2] || '' } }),
    adminGetPilotos: (args) => ({ method: 'GET', path: '/api/admin/pilots', query: { actorEmail: args[0] || '' } }),
    adminSavePilot: (args) => ({ method: 'POST', path: '/api/admin/pilots', body: { pilot: args[0] || {}, actorEmail: args[1] || '' } }),
    adminDeletePilot: (args) => ({ method: 'DELETE', path: '/api/admin/pilots/' + encodeURIComponent(String(args[0] || '')), query: { actorEmail: args[1] || '' } }),
    adminGetMaestroItems: (args) => ({ method: 'GET', path: '/api/admin/maestro', query: { actorEmail: args[0] || '' } }),
    adminGetMaestroItemsJson: (args) => ({ method: 'GET', path: '/api/admin/maestro.json', query: { actorEmail: args[0] || '' } }),
    adminDebugMaestroState: () => ({ method: 'GET', path: '/api/admin/maestro/debug' }),
    adminImportMaestroItems: (args) => ({ method: 'POST', path: '/api/admin/maestro/import', body: { items: args[0] || [], options: args[1] || {}, actorEmail: args[2] || '' } }),
    adminSaveMaestroItem: (args) => ({ method: 'POST', path: '/api/admin/maestro', body: { item: args[0] || {}, actorEmail: args[1] || '' } }),
    adminDeleteMaestroItem: (args) => {
      const target = args[0];
      if (target && typeof target === 'object') {
        return {
          method: 'DELETE',
          path: '/api/admin/maestro',
          body: { item: target, actorEmail: args[1] || '' }
        };
      }
      return {
        method: 'DELETE',
        path: '/api/admin/maestro/' + encodeURIComponent(String(target || '')),
        query: { actorEmail: args[1] || '' }
      };
    },
    adminToggleMaestroActivo: (args) => {
      const target = args[0];
      if (target && typeof target === 'object') {
        return {
          method: 'POST',
          path: '/api/admin/maestro/toggle-active',
          body: { item: target, active: !!args[1], actorEmail: args[2] || '' }
        };
      }
      return {
        method: 'POST',
        path: '/api/admin/maestro/' + encodeURIComponent(String(target || '')) + '/toggle-active',
        body: { active: !!args[1], actorEmail: args[2] || '' }
      };
    },
    getRuleConfigData: (args) => ({ method: 'GET', path: '/api/config/rules', query: { actorEmail: args[0] || '' } }),
    saveCfgCountry: (args) => ({ method: 'POST', path: '/api/config/countries', body: { country: args[0] || {}, actorEmail: args[1] || '' } }),
    deleteCfgCountry: (args) => ({ method: 'DELETE', path: '/api/config/countries/' + encodeURIComponent(String(args[0] || '')), query: { actorEmail: args[1] || '' } }),
    saveCfgRole: (args) => ({ method: 'POST', path: '/api/config/roles', body: { role: args[0] || {}, actorEmail: args[1] || '' } }),
    deleteCfgRole: (args) => ({ method: 'DELETE', path: '/api/config/roles/' + encodeURIComponent(String(args[0] || '')), query: { actorEmail: args[1] || '' } }),
    saveCfgStageSla: (args) => ({ method: 'POST', path: '/api/config/stage-sla', body: { stageSla: args[0] || {}, actorEmail: args[1] || '' } }),
    saveCfgStageNotify: (args) => ({ method: 'POST', path: '/api/config/stage-notify', body: { stageNotify: args[0] || {}, actorEmail: args[1] || '' } }),
    saveCfgRule: (args) => ({ method: 'POST', path: '/api/config/rules', body: { rule: args[0] || {}, actorEmail: args[1] || '' } }),
    deleteCfgRule: (args) => ({ method: 'DELETE', path: '/api/config/rules/' + encodeURIComponent(String(args[0] || '')), query: { actorEmail: args[1] || '' } }),
    saveCfgCorreo: (args) => ({ method: 'POST', path: '/api/config/correos', body: { correo: args[0] || {}, actorEmail: args[1] || '' } }),
    deleteCfgCorreo: (args) => ({ method: 'DELETE', path: '/api/config/correos/' + encodeURIComponent(String(args[0] || '')), query: { actorEmail: args[1] || '' } }),
    saveCfgAuthKey: (args) => ({ method: 'POST', path: '/api/config/auth-keys', body: { authKey: args[0] || {}, actorEmail: args[1] || '' } }),
    deleteCfgAuthKey: (args) => ({ method: 'DELETE', path: '/api/config/auth-keys/' + encodeURIComponent(String(args[0] || '')), query: { actorEmail: args[1] || '' } }),
    saveMailTransportConfig: (args) => ({ method: 'POST', path: '/api/config/mail-transport', body: { mailTransport: args[0] || {}, actorEmail: args[1] || '' } }),
    validarMailTransportConfig: (args) => ({ method: 'GET', path: '/api/config/mail-transport/validate', query: { actorEmail: args[0] || '' } }),
    testMailTransportConfig: (args) => ({ method: 'POST', path: '/api/config/mail-transport/test', body: { destino: args[0] || '', actorEmail: args[1] || '' } }),
    installDailySlaDigestTrigger: (args) => ({ method: 'POST', path: '/api/config/triggers/daily-sla-digest/install', body: { actorEmail: args[0] || '' } }),
    adminRunDailyOverdueStageNotifications: (args) => ({ method: 'POST', path: '/api/admin/notifications/daily-overdue/run', body: { forceSend: !!args[0], actorEmail: args[1] || '' } })
  };

  async function apiFetch_(method, args) {
    const methodKey = String(method || '').trim();
    const routeFactory = apiRouteMap_[methodKey];
    if (typeof routeFactory !== 'function') {
      throw { message: 'Metodo API no soportado: ' + methodKey };
    }

    const route = routeFactory(Array.isArray(args) ? args : []);
    const queryString = buildApiQueryString_(route.query);
    const url = queryString ? (route.path + '?' + queryString) : route.path;
    const headers = { Accept: 'application/json' };
    const init = {
      method: route.method || 'GET',
      headers
    };

    if (route.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(route.body);
    }

    const res = await fetch(url, init);
    const text = await res.text();
    let payload = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch (_error) {
      payload = text;
    }
    if (!res.ok) {
      throw (payload && typeof payload === 'object')
        ? payload
        : { message: String(payload || ('HTTP ' + res.status)) };
    }
    return payload;
  }

  function createApiRunner_(successHandler, failureHandler, userObject) {
    return new Proxy({}, {
      get(_target, prop) {
        if (prop === 'withSuccessHandler') {
          return (fn) => createApiRunner_(fn, failureHandler, userObject);
        }
        if (prop === 'withFailureHandler') {
          return (fn) => createApiRunner_(successHandler, fn, userObject);
        }
        if (prop === 'withUserObject') {
          return (obj) => createApiRunner_(successHandler, failureHandler, obj);
        }
        return (...args) => {
          return apiFetch_(prop, args)
            .then((payload) => {
              if (typeof successHandler === 'function') successHandler(payload, userObject);
              return payload;
            })
            .catch((err) => {
              if (typeof failureHandler === 'function') {
                failureHandler(err, userObject);
                return;
              }
              console.error('API error:', err);
            });
        };
      }
    });
  }

  window.buildApiQueryString_ = buildApiQueryString_;
  window.apiRouteMap_ = apiRouteMap_;
  window.apiFetch_ = apiFetch_;
  window.createApiRunner_ = createApiRunner_;
})();
