(function () {
  const DEFAULT_COUNTRY_CATALOG_UI = [
    { countryCode: 'PE', name: 'Peru' },
    { countryCode: 'BO', name: 'Bolivia' }
  ];

  window.UI_CACHE_STALE_MS = 45000;
  window.uiDataCache = {
    dashboard: { data: null, at: 0 },
    catalogosCobro: { data: null, at: 0 },
    usuarios: { data: null, at: 0 },
    proveedores: { data: null, at: 0 },
    pilotos: { data: null, at: 0 },
    maestro: { data: null, at: 0 },
    historial: { data: null, at: 0 },
    reportes: { data: null, at: 0 },
    gestion: { data: null, at: 0 },
    gestionResumen: { data: null, at: 0 },
    pagos: { data: null, at: 0 },
    pagosElegibles: { data: null, at: 0 },
    countries: { data: null, at: 0 },
    roles: { data: null, at: 0 },
    stageSla: { data: null, at: 0 },
    stageNotify: { data: null, at: 0 },
    rules: { data: null, at: 0 },
    correos: { data: null, at: 0 },
    authKeys: { data: null, at: 0 }
  };

  window.setText = function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.innerText = value;
  };

  window.getUiCacheEntry_ = function getUiCacheEntry_(key) {
    if (!window.uiDataCache[key]) window.uiDataCache[key] = { data: null, at: 0 };
    return window.uiDataCache[key];
  };

  window.setUiCacheData_ = function setUiCacheData_(key, data) {
    const entry = window.getUiCacheEntry_(key);
    entry.data = data;
    entry.at = Date.now();
    return data;
  };

  window.getUiCacheData_ = function getUiCacheData_(key) {
    return window.getUiCacheEntry_(key).data;
  };

  window.hasUiCacheData_ = function hasUiCacheData_(key) {
    const data = window.getUiCacheData_(key);
    return data !== null && data !== undefined;
  };

  window.isUiCacheFresh_ = function isUiCacheFresh_(key, maxAge) {
    const age = Number(maxAge || window.UI_CACHE_STALE_MS);
    const at = Number(window.getUiCacheEntry_(key).at || 0);
    return !!at && (Date.now() - at) <= age;
  };

  window.clearUiCache_ = function clearUiCache_(key) {
    const entry = window.getUiCacheEntry_(key);
    entry.data = null;
    entry.at = 0;
  };

  window.clearAllUiCaches_ = function clearAllUiCaches_() {
    Object.keys(window.uiDataCache).forEach(window.clearUiCache_);
  };

  window.escapeHtmlUi = function escapeHtmlUi(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  window.renderTableState_ = function renderTableState_(tbody, colspan, text, tone) {
    if (!tbody) return;
    const palette = String(tone || 'muted').toLowerCase();
    const icon = palette === 'error'
      ? '<i class="bi bi-exclamation-octagon me-2"></i>'
      : palette === 'loading'
        ? '<div class="spinner-border spinner-border-sm text-primary me-2"></div>'
        : '';
    const colorClass = palette === 'error' ? 'text-danger' : 'text-muted';
    tbody.innerHTML = '<tr><td colspan="' + Number(colspan || 1) + '" class="text-center ' + colorClass + ' py-3">' + icon + window.escapeHtmlUi(text || 'Sin datos') + '</td></tr>';
  };

  window.normalizeSearchTextUi_ = function normalizeSearchTextUi_(value) {
    return String(value == null ? '' : value)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  };

  window.parseLooseNumberUi_ = function parseLooseNumberUi_(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    const raw = String(value == null ? '' : value).trim();
    if (!raw) return 0;
    const compact = raw.replace(/\s+/g, '');
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
    return Number.isFinite(parsed) ? parsed : 0;
  };

  window.fmtNum = function fmtNum(value) {
    const n = Number(value || 0);
    return n.toLocaleString('es-PE');
  };

  window.fmtMoney = function fmtMoney(value) {
    const n = Number(value || 0);
    return 'S/ ' + n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  window.getRunErrorMsg = function getRunErrorMsg(err, fallback) {
    if (!err) return fallback || 'Error inesperado';
    if (typeof err === 'string') return err;
    if (err.message) return String(err.message);
    if (err.details) return String(err.details);
    if (err.description) return String(err.description);
    return fallback || 'Error inesperado';
  };

  window.showUiToast = function showUiToast(type, msg) {
    const icon = type === 'error' ? 'error' : type === 'warning' ? 'warning' : 'info';
    Swal.fire({
      toast: true,
      position: 'top-end',
      icon,
      title: String(msg || 'Operacion completada'),
      showConfirmButton: false,
      timer: 4200,
      timerProgressBar: true
    });
  };

  window.normalizeModalBackdrops = function normalizeModalBackdrops() {
    const openModalCount = document.querySelectorAll('.modal.show').length;
    const backdrops = Array.from(document.querySelectorAll('.modal-backdrop'));
    while (backdrops.length > openModalCount) {
      const extraBackdrop = backdrops.pop();
      if (extraBackdrop) extraBackdrop.remove();
    }
    if (!openModalCount) {
      document.body.classList.remove('modal-open');
      document.body.style.removeProperty('overflow');
      document.body.style.removeProperty('padding-right');
    }
  };

  window.getCountryCatalogUi_ = function getCountryCatalogUi_() {
    const normalizeRows = typeof window.normalizeCountryRows_ === 'function'
      ? window.normalizeCountryRows_
      : function fallbackNormalizeCountryRows(rows) {
          return Array.isArray(rows) ? rows : [];
        };
    const cached = normalizeRows(window.getUiCacheData_('countries') || []);
    return cached.length ? cached : DEFAULT_COUNTRY_CATALOG_UI.slice();
  };

  window.getCountryDisplayLabelUi_ = function getCountryDisplayLabelUi_(countryCode) {
    const code = String(countryCode || '').trim().toUpperCase();
    if (!code) return '';
    const match = window.getCountryCatalogUi_().find(function (country) {
      return String(country.countryCode || '').trim().toUpperCase() === code;
    });
    const name = String((match && match.name) || code).trim();
    return code + ' - ' + name;
  };
})();
