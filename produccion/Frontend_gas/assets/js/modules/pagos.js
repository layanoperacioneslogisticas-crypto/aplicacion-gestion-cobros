function getPagosSearchQuery_() {
  const input = document.getElementById('pTexto');
  return normalizeSearchTextUi_(input ? input.value : '');
}

function filterPagosRows_(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const query = getPagosSearchQuery_();
  if (!query) return list;
  return list.filter(row => normalizeSearchTextUi_([
    row.id,
    row.operationNumber,
    row.paymentDate,
    row.status,
    row.notes,
    row.countryCode,
    row.countryName,
    Array.isArray(row.providerNames) ? row.providerNames.join(' ') : '',
    Array.isArray(row.cobroIds) ? row.cobroIds.join(' ') : ''
  ].join(' ')).includes(query));
}

function renderPagos(rows) {
  const tb = document.getElementById('pagosBody');
  if (!tb) return;
  const list = filterPagosRows_(rows);
  if (!list.length) {
    const query = getPagosSearchQuery_();
    renderTableState_(tb, 8, query ? 'No se encontraron pagos con esa búsqueda.' : 'Sin pagos registrados todavía.', 'muted');
    return;
  }
  tb.innerHTML = list.map(row => {
    const providers = Array.isArray(row.providerNames) ? row.providerNames.filter(Boolean) : [];
    const providersLabel = providers.length
      ? `${escapeHtmlUi(providers.slice(0, 2).join(', '))}${providers.length > 2 ? `<div class="small text-muted">+${providers.length - 2} más</div>` : ''}`
      : '<span class="text-muted">-</span>';
    return `
      <tr>
        <td class="fw-semibold">${escapeHtmlUi(row.id || '-')}</td>
        <td>${escapeHtmlUi(row.operationNumber || '-')}</td>
        <td>${escapeHtmlUi(row.paymentDate || '-')}</td>
        <td class="text-end text-money">${fmtMoney(row.totalAmount || 0)}</td>
        <td class="text-center"><span class="badge bg-light text-dark border">${fmtNum(row.cobroCount || 0)}</span></td>
        <td>${providersLabel}</td>
        <td><span class="badge bg-success-subtle text-success-emphasis border border-success-subtle">${escapeHtmlUi(row.status || 'Registrado')}</span></td>
        <td class="text-center">
          <div class="d-inline-flex gap-1 flex-wrap justify-content-center">
            <button class="btn btn-sm btn-outline-primary" type="button" title="Ver" aria-label="Ver" onclick="verDetallePago('${escapeHtmlUi(row.id || '')}')">
              <i class="bi bi-eye"></i>
            </button>
            <button class="btn btn-sm btn-outline-secondary" type="button" title="Editar" aria-label="Editar" onclick="abrirEditarPagoAgrupado('${escapeHtmlUi(row.id || '')}')">
              <i class="bi bi-pencil-square"></i>
            </button>
            <button class="btn btn-sm btn-outline-danger" type="button" title="Eliminar" aria-label="Eliminar" onclick="confirmarEliminarPago('${escapeHtmlUi(row.id || '')}')">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </td>
      </tr>`;
  }).join('');
}

function cargarPagos(force) {
  const tb = document.getElementById('pagosBody');
  if (!tb || pagosLoadInFlight) return;
  const hasCached = hasUiCacheData_('pagos');
  if (hasCached) {
    pagosRowsCache = Array.isArray(getUiCacheData_('pagos')) ? getUiCacheData_('pagos') : [];
    renderPagos(pagosRowsCache);
  } else {
    renderTableState_(tb, 8, 'Cargando pagos...', 'loading');
  }
  if (hasCached && !force && isUiCacheFresh_('pagos')) return;

  pagosLoadInFlight = true;
  rpc.withSuccessHandler(resp => {
    pagosLoadInFlight = false;
    const rows = Array.isArray(resp?.rows) ? resp.rows : [];
    pagosRowsCache = rows;
    setUiCacheData_('pagos', rows);
    renderPagos(rows);
  }).withFailureHandler(err => {
    pagosLoadInFlight = false;
    console.error('Error cargando pagos:', err);
    if (hasCached) return;
    renderTableState_(tb, 8, getRunErrorMsg(err, 'No se pudo cargar la lista de pagos.'), 'error');
  }).getPayments(usuarioSesion?.email || '', '');
}

function resetPagoAgrupadoForm_() {
  const formIds = ['payOperationNumber', 'payDate', 'payTotalAmount', 'payNotes', 'payCobroSearch'];
  formIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const fileInput = document.getElementById('payConstanciaFile');
  if (fileInput) fileInput.value = '';
  pagosEligibleRowsCache = [];
  clearUiCache_('pagosElegibles');
  const body = document.getElementById('payCobrosBody');
  if (body) {
    renderTableState_(body, 9, 'Cargando boletas elegibles...', 'loading');
  }
  const title = document.getElementById('pagoAgrupadoModalTitle');
  if (title) title.textContent = 'Nuevo pago agrupado';
  const help = document.getElementById('payConstanciaHelp');
  if (help) help.textContent = 'Adjunta la constancia en PDF.';
  const saveBtn = document.getElementById('btnGuardarPagoAgrupado');
  if (saveBtn) saveBtn.innerHTML = '<i class="bi bi-save me-1"></i> Registrar pago';
  pagoAgrupadoEditContext = null;
  updatePagoAgrupadoSummary_();
}

function abrirNuevoPagoAgrupado(options) {
  const cfg = options && typeof options === 'object' ? options : {};
  resetPagoAgrupadoForm_();
  const dateInput = document.getElementById('payDate');
  if (dateInput) dateInput.value = new Date().toISOString().slice(0, 10);
  if (cfg.searchQuery) {
    const searchInput = document.getElementById('payCobroSearch');
    if (searchInput) searchInput.value = String(cfg.searchQuery || '');
  }
  if (cfg.totalAmount > 0) {
    const totalInput = document.getElementById('payTotalAmount');
    if (totalInput) totalInput.value = Number(cfg.totalAmount || 0).toFixed(2);
  }
  if (cfg.notes) {
    const notesInput = document.getElementById('payNotes');
    if (notesInput) notesInput.value = String(cfg.notes || '');
  }
  pagoAgrupadoDraftContext = cfg && cfg.cobroId ? Object.assign({}, cfg) : null;
  normalizeModalBackdrops();
  document.body.classList.remove('modal-open');
  document.body.style.removeProperty('overflow');
  document.body.style.removeProperty('padding-right');
  requestAnimationFrame(() => {
    modalPagoAgrupadoEl.show();
    setTimeout(() => {
      cargarCobrosElegiblesPago(true);
    }, 60);
  });
}

function mergePagoEditRows_(rows, editContext) {
  const baseRows = Array.isArray(rows) ? rows.map(row => Object.assign({}, row)) : [];
  if (!editContext || !Array.isArray(editContext.cobros)) return baseRows;
  const map = new Map(baseRows.map(row => [String(row.id || '').trim(), row]));
  editContext.cobros.forEach(cobro => {
    const cobroId = String(cobro?.cobroId || '').trim();
    if (!cobroId) return;
    const existing = map.get(cobroId);
    const merged = Object.assign({}, existing || {}, {
      id: cobroId,
      proveedor: cobro?.proveedor || existing?.proveedor || '',
      proveedorCodigo: cobro?.proveedorCodigo || existing?.proveedorCodigo || '',
      ruta: cobro?.ruta || existing?.ruta || '',
      unidad: cobro?.unidad || existing?.unidad || '',
      etapa: cobro?.etapa || existing?.etapa || '10. Aplicación de pago',
      estado: cobro?.estado || existing?.estado || 'En proceso',
      totalCobro: Number(cobro?.totalCobro || existing?.totalCobro || 0),
      allocatedAmount: 0,
      saldoPendiente: Number(cobro?.totalCobro || existing?.totalCobro || 0),
      hasExistingPaymentLink: false,
      countryCode: existing?.countryCode || editContext.payment?.countryCode || '',
      countryName: existing?.countryName || editContext.payment?.countryName || '',
      _selected: true,
      _paymentAmount: Number(cobro?.allocatedAmount || 0)
    });
    map.set(cobroId, merged);
  });
  return Array.from(map.values());
}

function applyPagoAgrupadoEditContext_() {
  const ctx = pagoAgrupadoEditContext;
  if (!ctx || !Array.isArray(ctx.cobros) || !Array.isArray(pagosEligibleRowsCache) || !pagosEligibleRowsCache.length) return;
  const selectedMap = new Map(
    ctx.cobros.map(row => [String(row?.cobroId || '').trim(), Number(row?.allocatedAmount || 0)])
  );
  pagosEligibleRowsCache.forEach((row) => {
    const cobroId = String(row?.id || '').trim();
    const amount = Number(selectedMap.get(cobroId) || 0);
    row._selected = selectedMap.has(cobroId);
    row._paymentAmount = amount > 0
      ? amount
      : (Number(row.saldoPendiente || 0) > 0 ? Number(row.saldoPendiente || 0) : 0);
  });
}

function abrirEditarPagoAgrupado(paymentId) {
  const id = String(paymentId || '').trim();
  if (!id) {
    Swal.fire('Error', 'No se pudo identificar el pago.', 'error');
    return;
  }
  mostrarLoading(true);
  rpc.withSuccessHandler(resp => {
    mostrarLoading(false);
    const payment = resp?.payment || {};
    const cobros = Array.isArray(resp?.cobros) ? resp.cobros : [];
    resetPagoAgrupadoForm_();
    pagoAgrupadoEditContext = {
      payment,
      cobros
    };
    const title = document.getElementById('pagoAgrupadoModalTitle');
    if (title) title.textContent = `Editar pago ${payment.id || id}`;
    const saveBtn = document.getElementById('btnGuardarPagoAgrupado');
    if (saveBtn) saveBtn.innerHTML = '<i class="bi bi-save me-1"></i> Guardar cambios';
    const help = document.getElementById('payConstanciaHelp');
    if (help) help.textContent = payment.constanciaPagoUrl
      ? 'Si no subes un nuevo PDF, se conservará la constancia actual.'
      : 'Adjunta la constancia en PDF.';

    const operationInput = document.getElementById('payOperationNumber');
    if (operationInput) operationInput.value = String(payment.operationNumber || '');
    const dateInput = document.getElementById('payDate');
    if (dateInput) dateInput.value = String(payment.paymentDate || '');
    const totalInput = document.getElementById('payTotalAmount');
    if (totalInput && Number(payment.totalAmount || 0) > 0) totalInput.value = Number(payment.totalAmount || 0).toFixed(2);
    const notesInput = document.getElementById('payNotes');
    if (notesInput) notesInput.value = String(payment.notes || '');

    normalizeModalBackdrops();
    document.body.classList.remove('modal-open');
    document.body.style.removeProperty('overflow');
    document.body.style.removeProperty('padding-right');
    requestAnimationFrame(() => {
      modalPagoAgrupadoEl.show();
      setTimeout(() => {
        cargarCobrosElegiblesPago(true);
      }, 60);
    });
  }).withFailureHandler(err => {
    mostrarLoading(false);
    Swal.fire('Error', getRunErrorMsg(err, 'No se pudo cargar el pago para editar.'), 'error');
  }).getPaymentDetail(id, usuarioSesion?.email || '');
}

function getCobrosElegiblesPagoSearch_() {
  const input = document.getElementById('payCobroSearch');
  return normalizeSearchTextUi_(input ? input.value : '');
}

function filterCobrosElegiblesPagoRows_(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const query = getCobrosElegiblesPagoSearch_();
  if (!query) return list;
  return list.filter(row => normalizeSearchTextUi_([
    row.id,
    row.proveedor,
    row.proveedorCodigo,
    row.ruta,
    row.unidad,
    row.estado,
    row.etapa,
    row.countryCode,
    row.countryName
  ].join(' ')).includes(query));
}

function updatePagoAgrupadoSummary_() {
  const selected = (pagosEligibleRowsCache || []).filter(row => row && row._selected);
  const totalAssigned = selected.reduce((sum, row) => sum + Number(row._paymentAmount || 0), 0);
  const summary = document.getElementById('paySelectedSummary');
  const amount = document.getElementById('payAmountSummary');
  if (summary) summary.textContent = `${fmtNum(selected.length)} boletas seleccionadas`;
  if (amount) amount.textContent = `Asignado: ${fmtMoney(totalAssigned)}`;
}

function applyPagoAgrupadoDraftContext_() {
  const ctx = pagoAgrupadoDraftContext;
  if (!ctx || !ctx.cobroId || !Array.isArray(pagosEligibleRowsCache) || !pagosEligibleRowsCache.length) return;
  let selectedCount = 0;
  pagosEligibleRowsCache.forEach((row) => {
    const isTarget = String(row?.id || '').trim() === String(ctx.cobroId || '').trim();
    row._selected = isTarget;
    if (isTarget) {
      const suggested = Number(ctx.suggestedAmount || row.saldoPendiente || row.totalCobro || 0);
      row._paymentAmount = suggested > 0 ? suggested : 0;
      selectedCount += 1;
    }
  });
  if (selectedCount > 0 && ctx.totalAmount > 0) {
    const totalInput = document.getElementById('payTotalAmount');
    if (totalInput) totalInput.value = Number(ctx.totalAmount || 0).toFixed(2);
  }
  pagoAgrupadoDraftContext = null;
}

function renderCobrosElegiblesPago(rows) {
  const tb = document.getElementById('payCobrosBody');
  if (!tb) return;
  const list = filterCobrosElegiblesPagoRows_(rows);
  if (!list.length) {
    const query = getCobrosElegiblesPagoSearch_();
    renderTableState_(tb, 9, query ? 'No se encontraron boletas para esa búsqueda.' : 'No hay boletas elegibles para pago agrupado.', 'muted');
    updatePagoAgrupadoSummary_();
    return;
  }
  tb.innerHTML = list.map((row) => {
    const actualIndex = pagosEligibleRowsCache.indexOf(row);
    return `
      <tr>
        <td class="text-center">
          <input class="form-check-input" type="checkbox" ${row._selected ? 'checked' : ''} onchange="togglePagoCobroSelection_(${actualIndex}, this.checked)">
        </td>
        <td class="fw-semibold">${escapeHtmlUi(row.id || '-')}</td>
        <td>
          <div>${escapeHtmlUi(row.proveedor || '-')}</div>
          <div class="small text-muted">${escapeHtmlUi(row.proveedorCodigo || '-')}</div>
        </td>
        <td>
          <div>${escapeHtmlUi(row.ruta || '-')}</div>
          <div class="small text-muted">${escapeHtmlUi(row.unidad || '-')}</div>
        </td>
        <td>${escapeHtmlUi(row.etapa || '-')}</td>
        <td class="text-end text-money">${fmtMoney(row.totalCobro || 0)}</td>
        <td class="text-end text-money">${fmtMoney(row.allocatedAmount || 0)}</td>
        <td class="text-end text-money">${fmtMoney(row.saldoPendiente || 0)}</td>
        <td class="text-end" style="min-width: 140px;">
          <input type="number" class="form-control form-control-sm text-end" min="0.01" step="0.01"
            value="${Number(row._paymentAmount || 0) > 0 ? Number(row._paymentAmount || 0).toFixed(2) : ''}"
            ${row._selected ? '' : 'disabled'}
            onchange="updatePagoCobroAmount_(${actualIndex}, this.value)"
            oninput="updatePagoCobroAmount_(${actualIndex}, this.value)">
        </td>
      </tr>`;
  }).join('');
  updatePagoAgrupadoSummary_();
}

function cargarCobrosElegiblesPago(force) {
  const tb = document.getElementById('payCobrosBody');
  if (!tb || pagosEligibleLoadInFlight) return;
  const cached = getUiCacheData_('pagosElegibles');
  const hasCached = hasUiCacheData_('pagosElegibles');
  if (hasCached) {
    let cachedRows = (Array.isArray(cached) ? cached : []).map(row => Object.assign({}, row));
    if (pagoAgrupadoEditContext) {
      cachedRows = mergePagoEditRows_(cachedRows, pagoAgrupadoEditContext);
    }
    pagosEligibleRowsCache = cachedRows;
    applyPagoAgrupadoEditContext_();
    renderCobrosElegiblesPago(pagosEligibleRowsCache);
  } else {
    renderTableState_(tb, 9, 'Cargando boletas elegibles...', 'loading');
  }
  if (hasCached && !force && isUiCacheFresh_('pagosElegibles')) return;

  pagosEligibleLoadInFlight = true;
  rpc.withSuccessHandler(resp => {
    pagosEligibleLoadInFlight = false;
    let rows = (Array.isArray(resp?.rows) ? resp.rows : []).map(row => Object.assign({}, row, {
      _selected: false,
      _paymentAmount: Number(row.saldoPendiente || 0) > 0 ? Number(row.saldoPendiente || 0) : 0
    }));
    if (pagoAgrupadoEditContext) {
      rows = mergePagoEditRows_(rows, pagoAgrupadoEditContext);
    }
    pagosEligibleRowsCache = rows;
    applyPagoAgrupadoDraftContext_();
    applyPagoAgrupadoEditContext_();
    setUiCacheData_('pagosElegibles', rows.map(row => Object.assign({}, row)));
    renderCobrosElegiblesPago(rows);
  }).withFailureHandler(err => {
    pagosEligibleLoadInFlight = false;
    console.error('Error cargando boletas elegibles:', err);
    if (hasCached) return;
    renderTableState_(tb, 9, getRunErrorMsg(err, 'No se pudieron cargar las boletas elegibles.'), 'error');
  }).getEligiblePaymentCobros(usuarioSesion?.email || '', '');
}

function filtrarCobrosElegiblesPago() {
  renderCobrosElegiblesPago(pagosEligibleRowsCache);
}

function abrirPagosDesdeFlow() {
  const ctx = getCurrentFlowContext_();
  modalFlowEl.hide();
  abrirPagos();
  const searchInput = document.getElementById('pTexto');
  const query = ctx.debitoRef || ctx.id || '';
  if (searchInput) searchInput.value = query;
  setTimeout(() => {
    renderPagos(pagosRowsCache);
    window.scrollTo(0, 0);
  }, 140);
}

function crearPagoAgrupadoDesdeFlow() {
  const ctx = getCurrentFlowContext_();
  if (!ctx.id) {
    Swal.fire('Error', 'No se pudo identificar la boleta actual.', 'error');
    return;
  }
  modalFlowEl.hide();
  abrirPagos();
  setTimeout(() => {
    abrirNuevoPagoAgrupado({
      cobroId: ctx.id,
      searchQuery: ctx.id,
      totalAmount: ctx.totalCobro > 0 ? ctx.totalCobro : ctx.montoPago,
      suggestedAmount: ctx.totalCobro > 0 ? ctx.totalCobro : ctx.montoPago,
      notes: `Pago agrupado iniciado desde boleta ${ctx.id}${ctx.proveedor ? ' · ' + ctx.proveedor : ''}`
    });
  }, 180);
}

function togglePagoCobroSelection_(index, checked) {
  const row = pagosEligibleRowsCache[index];
  if (!row) return;
  row._selected = !!checked;
  if (row._selected && !(Number(row._paymentAmount || 0) > 0)) {
    row._paymentAmount = Number(row.saldoPendiente || 0) > 0 ? Number(row.saldoPendiente || 0) : 0;
  }
  renderCobrosElegiblesPago(pagosEligibleRowsCache);
}

function updatePagoCobroAmount_(index, value) {
  const row = pagosEligibleRowsCache[index];
  if (!row) return;
  const parsed = parseLooseNumberUi_(value);
  row._paymentAmount = parsed > 0 ? parsed : 0;
  updatePagoAgrupadoSummary_();
}

function readFileAsDataUrlUi_(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('No se pudo leer el archivo seleccionado.'));
    reader.readAsDataURL(file);
  });
}

async function guardarPagoAgrupado() {
  const operationNumber = String(document.getElementById('payOperationNumber')?.value || '').trim();
  const paymentDate = String(document.getElementById('payDate')?.value || '').trim();
  const totalAmount = parseLooseNumberUi_(document.getElementById('payTotalAmount')?.value || '');
  const notes = String(document.getElementById('payNotes')?.value || '').trim();
  const fileInput = document.getElementById('payConstanciaFile');
  const file = fileInput && fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;
  const isEditing = Boolean(pagoAgrupadoEditContext?.payment?.id);
  const selectedItems = (pagosEligibleRowsCache || [])
    .filter(row => row && row._selected)
    .map(row => ({
      cobroId: String(row.id || '').trim(),
      amount: parseLooseNumberUi_(row._paymentAmount)
    }));
  const invalidItem = selectedItems.find(item => !(item.amount > 0));
  const sumAssigned = selectedItems.reduce((sum, item) => sum + Number(item.amount || 0), 0);

  if (!operationNumber) return Swal.fire('Error', 'Debe ingresar el número de operación.', 'error');
  if (!paymentDate) return Swal.fire('Error', 'Debe ingresar la fecha de pago.', 'error');
  if (!(totalAmount > 0)) return Swal.fire('Error', 'Debe ingresar un monto total válido.', 'error');
  if (!selectedItems.length) return Swal.fire('Error', 'Seleccione al menos una boleta.', 'error');
  if (invalidItem) return Swal.fire('Error', 'Cada boleta seleccionada debe tener un monto mayor a 0.', 'error');
  if (Math.abs(sumAssigned - totalAmount) > 0.009) {
    return Swal.fire('Error', 'La suma asignada a las boletas debe coincidir con el monto total del pago.', 'error');
  }
  if (!file && !isEditing) return Swal.fire('Error', 'Adjunte la constancia de pago en PDF.', 'error');
  if (file && String(file.type || '').toLowerCase() !== 'application/pdf' && !String(file.name || '').toLowerCase().endsWith('.pdf')) {
    return Swal.fire('Error', 'La constancia debe estar en formato PDF.', 'error');
  }
  if (file && Number(file.size || 0) > 10 * 1024 * 1024) {
    return Swal.fire('Error', 'La constancia supera 10 MB.', 'error');
  }

  try {
    mostrarLoading(true);
    const dataUrl = file ? await readFileAsDataUrlUi_(file) : '';
    const payload = {
      operationNumber,
      paymentDate,
      totalAmount,
      notes,
      items: selectedItems,
      fileName: file ? String(file.name || 'constancia_pago.pdf') : '',
      mimeType: file ? 'application/pdf' : '',
      dataUrl
    };
    if (isEditing && pagoAgrupadoEditContext?.payment?.constanciaPagoUrl) {
      payload.constanciaPagoUrl = String(pagoAgrupadoEditContext.payment.constanciaPagoUrl || '');
    }
    const rpcCall = rpc.withSuccessHandler(resp => {
      mostrarLoading(false);
      if (!resp || !resp.success) {
        Swal.fire('Error', resp?.message || `No se pudo ${isEditing ? 'actualizar' : 'registrar'} el pago agrupado.`, 'error');
        return;
      }
      modalPagoAgrupadoEl.hide();
      clearUiCache_('pagos');
      clearUiCache_('pagosElegibles');
      clearUiCache_('gestion');
      pagoAgrupadoEditContext = null;
      cargarPagos(true);
      if (currentWorkspaceModule === 'gestion') cargarGestion(false, true);
      Swal.fire(
        'Guardado',
        `Pago ${resp.paymentId || ''} ${isEditing ? 'actualizado' : 'registrado'} y asociado a ${fmtNum(resp.cobroCount || 0)} boletas.`,
        'success'
      );
    }).withFailureHandler(err => {
      mostrarLoading(false);
      Swal.fire('Error', getRunErrorMsg(err, `No se pudo ${isEditing ? 'actualizar' : 'registrar'} el pago agrupado.`), 'error');
    });

    if (isEditing) {
      rpcCall.updateGroupedPayment(pagoAgrupadoEditContext.payment.id, payload, usuarioSesion?.email || '');
    } else {
      rpcCall.createGroupedPayment(payload, usuarioSesion?.email || '');
    }
  } catch (err) {
    mostrarLoading(false);
    Swal.fire('Error', getRunErrorMsg(err, 'No se pudo leer la constancia de pago.'), 'error');
  }
}

function verDetallePago(paymentId) {
  const id = String(paymentId || '').trim();
  if (!id) {
    Swal.fire('Error', 'No se pudo identificar el pago.', 'error');
    return;
  }
  pagoDetalleActualId = id;
  const body = document.getElementById('pagoDetalleBody');
  const title = document.getElementById('pagoDetalleTitle');
  if (title) title.textContent = `Detalle de pago ${id}`;
  if (body) body.innerHTML = '<div class="text-center py-4 text-muted">Cargando detalle...</div>';
  modalPagoDetalleEl.show();
  rpc.withSuccessHandler(resp => {
    const payment = resp?.payment || {};
    const cobros = Array.isArray(resp?.cobros) ? resp.cobros : [];
    const countryLabel = payment.countryCode ? getCountryDisplayLabelUi_(payment.countryCode) : (payment.countryName || '-');
    body.innerHTML = `
      <div class="row g-3 mb-3">
        <div class="col-md-4"><div class="small text-muted">Número de operación</div><div class="fw-semibold">${escapeHtmlUi(payment.operationNumber || '-')}</div></div>
        <div class="col-md-3"><div class="small text-muted">Fecha pago</div><div class="fw-semibold">${escapeHtmlUi(payment.paymentDate || '-')}</div></div>
        <div class="col-md-3"><div class="small text-muted">Monto total</div><div class="fw-semibold">${fmtMoney(payment.totalAmount || 0)}</div></div>
        <div class="col-md-2"><div class="small text-muted">Estado</div><div class="fw-semibold">${escapeHtmlUi(payment.status || '-')}</div></div>
        <div class="col-md-6"><div class="small text-muted">País</div><div class="fw-semibold">${escapeHtmlUi(countryLabel || '-')}</div></div>
        <div class="col-md-6"><div class="small text-muted">Registrado por</div><div class="fw-semibold">${escapeHtmlUi(payment.createdBy || '-')}</div></div>
        <div class="col-12"><div class="small text-muted">Notas</div><div class="fw-semibold">${escapeHtmlUi(payment.notes || '-')}</div></div>
        <div class="col-12">
          <button type="button" class="btn btn-outline-primary btn-sm" onclick="openPdfInApp('${escapeHtmlUi(payment.constanciaPagoUrl || '')}','Constancia ${escapeHtmlUi(payment.operationNumber || payment.id || 'pago')}')">
            <i class="bi bi-file-earmark-pdf me-1"></i> Ver constancia
          </button>
        </div>
      </div>
      <div class="table-responsive border rounded">
        <table class="table table-sm align-middle mb-0">
          <thead class="table-light">
            <tr>
              <th>ID boleta</th>
              <th>Proveedor</th>
              <th>Ruta</th>
              <th>Etapa</th>
              <th class="text-end">Total boleta</th>
              <th class="text-end">Monto aplicado</th>
            </tr>
          </thead>
          <tbody>
            ${cobros.length ? cobros.map(row => `
              <tr>
                <td class="fw-semibold">${escapeHtmlUi(row.cobroId || '-')}</td>
                <td>
                  <div>${escapeHtmlUi(row.proveedor || '-')}</div>
                  <div class="small text-muted">${escapeHtmlUi(row.proveedorCodigo || '-')}</div>
                </td>
                <td>
                  <div>${escapeHtmlUi(row.ruta || '-')}</div>
                  <div class="small text-muted">${escapeHtmlUi(row.unidad || '-')}</div>
                </td>
                <td>${escapeHtmlUi(row.etapa || '-')}</td>
                <td class="text-end text-money">${fmtMoney(row.totalCobro || 0)}</td>
                <td class="text-end text-money">${fmtMoney(row.allocatedAmount || 0)}</td>
              </tr>`).join('') : '<tr><td colspan="6" class="text-center text-muted py-3">Sin boletas asociadas.</td></tr>'}
          </tbody>
        </table>
      </div>`;
  }).withFailureHandler(err => {
    body.innerHTML = `<div class="text-center text-danger py-4">${escapeHtmlUi(getRunErrorMsg(err, 'No se pudo cargar el detalle del pago.'))}</div>`;
  }).getPaymentDetail(id, usuarioSesion?.email || '');
}

function editarPagoActualDetalle() {
  const id = String(pagoDetalleActualId || '').trim();
  if (!id) return;
  modalPagoDetalleEl.hide();
  setTimeout(() => abrirEditarPagoAgrupado(id), 120);
}

function eliminarPagoActualDetalle() {
  const id = String(pagoDetalleActualId || '').trim();
  if (!id) return;
  modalPagoDetalleEl.hide();
  setTimeout(() => confirmarEliminarPago(id), 120);
}

async function confirmarEliminarPago(paymentId) {
  const id = String(paymentId || '').trim();
  if (!id) {
    Swal.fire('Error', 'No se pudo identificar el pago.', 'error');
    return;
  }
  const confirm = await Swal.fire({
    icon: 'warning',
    title: 'Eliminar pago agrupado',
    text: `Se eliminará el pago ${id} y se liberarán sus boletas asociadas.`,
    showCancelButton: true,
    confirmButtonText: 'Sí, eliminar',
    cancelButtonText: 'Cancelar',
    confirmButtonColor: '#d33'
  });
  if (!confirm.isConfirmed) return;

  mostrarLoading(true);
  rpc.withSuccessHandler(resp => {
    mostrarLoading(false);
    clearUiCache_('pagos');
    clearUiCache_('pagosElegibles');
    clearUiCache_('gestion');
    if (pagoDetalleActualId === id) pagoDetalleActualId = '';
    cargarPagos(true);
    if (currentWorkspaceModule === 'gestion') cargarGestion(false, true);
    Swal.fire('Eliminado', `Pago ${resp?.paymentId || id} eliminado correctamente.`, 'success');
  }).withFailureHandler(err => {
    mostrarLoading(false);
    Swal.fire('Error', getRunErrorMsg(err, 'No se pudo eliminar el pago agrupado.'), 'error');
  }).deleteGroupedPayment(id, usuarioSesion?.email || '');
}

const pTextoEl = document.getElementById('pTexto');
if (pTextoEl) {
  pTextoEl.addEventListener('input', () => {
    if (hasUiCacheData_('pagos')) renderPagos(getUiCacheData_('pagos'));
  });
  pTextoEl.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    cargarPagos(true);
  });
}

const payCobroSearchEl = document.getElementById('payCobroSearch');
if (payCobroSearchEl) {
  payCobroSearchEl.addEventListener('input', () => filtrarCobrosElegiblesPago());
}
