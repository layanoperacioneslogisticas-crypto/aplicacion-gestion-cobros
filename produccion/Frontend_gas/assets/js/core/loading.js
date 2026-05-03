(function () {
  window.LOADING_UI_DELAY_MS = 120;
  window.LOADING_UI_MAX_MS = 90000;
  window.loadingUiState_ = {
    count: 0,
    timer: null,
    hardTimer: null,
    openedAt: 0
  };

  window.setLoadingCopy_ = function setLoadingCopy_(title, message) {
    window.setText('loadingTitle', title || 'Procesando');
    window.setText('loadingMessage', message || 'La aplicacion sigue disponible mientras termina la operacion.');
  };

  window.setLoadingVisible_ = function setLoadingVisible_(visible) {
    const box = document.getElementById('loading');
    if (!box) return;
    box.classList.toggle('is-active', !!visible);
    document.body.classList.toggle('app-busy', !!visible);
  };

  window.stopLoadingWatchdog_ = function stopLoadingWatchdog_() {
    if (!window.loadingUiState_.hardTimer) return;
    clearTimeout(window.loadingUiState_.hardTimer);
    window.loadingUiState_.hardTimer = null;
  };

  window.startLoadingWatchdog_ = function startLoadingWatchdog_() {
    if (!window.LOADING_UI_MAX_MS || window.LOADING_UI_MAX_MS <= 0) return;
    if (window.loadingUiState_.hardTimer) return;
    window.loadingUiState_.hardTimer = setTimeout(function () {
      if (window.loadingUiState_.count <= 0) return;
      window.resetLoadingUi_();
      try {
        window.showUiToast('warning', 'La operacion esta tardando mas de lo esperado. Si no termina, recargue la pagina.');
      } catch (_error) {}
    }, window.LOADING_UI_MAX_MS);
  };

  window.resetLoadingUi_ = function resetLoadingUi_() {
    window.loadingUiState_.count = 0;
    window.loadingUiState_.openedAt = 0;
    if (window.loadingUiState_.timer) {
      clearTimeout(window.loadingUiState_.timer);
      window.loadingUiState_.timer = null;
    }
    window.stopLoadingWatchdog_();
    window.setLoadingCopy_('Procesando', 'La aplicacion sigue disponible mientras termina la operacion.');
    window.setLoadingVisible_(false);
  };

  window.mostrarLoading = function mostrarLoading(visible, opts) {
    const options = (opts && typeof opts === 'object') ? opts : {};
    if (options.title || options.message) {
      window.setLoadingCopy_(options.title, options.message);
    }
    if (visible) {
      const wasIdle = window.loadingUiState_.count <= 0;
      window.loadingUiState_.count += 1;
      if (wasIdle) {
        window.loadingUiState_.openedAt = Date.now();
        window.startLoadingWatchdog_();
      }
      if (window.loadingUiState_.timer) return;
      window.loadingUiState_.timer = setTimeout(function () {
        window.loadingUiState_.timer = null;
        if (window.loadingUiState_.count > 0) window.setLoadingVisible_(true);
      }, window.LOADING_UI_DELAY_MS);
      return;
    }
    if (options.force) {
      window.resetLoadingUi_();
      return;
    }
    window.loadingUiState_.count = Math.max(0, window.loadingUiState_.count - 1);
    if (window.loadingUiState_.count > 0) return;
    window.loadingUiState_.openedAt = 0;
    window.stopLoadingWatchdog_();
    if (window.loadingUiState_.timer) {
      clearTimeout(window.loadingUiState_.timer);
      window.loadingUiState_.timer = null;
    }
    window.setLoadingVisible_(false);
    window.setLoadingCopy_('Procesando', 'La aplicacion sigue disponible mientras termina la operacion.');
  };
})();
