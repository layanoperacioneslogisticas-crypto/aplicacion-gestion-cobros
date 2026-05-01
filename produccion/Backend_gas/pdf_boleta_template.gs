function buildCobroPdfHtml_(view) {
    const data = view || {};
    const rows = String(data.rows || '');
    const signVista = String(data.signVista || '<div class="sig-empty">Sin firma</div>');
    const signPiloto = String(data.signPiloto || '<div class="sig-empty">Sin firma</div>');

    return `
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
            <div class="brand-sub">Boleta interna - Preimpreso digital</div>
          </div>
        </div>
        <div class="docbox">
          <div class="doc-id">#${data.id || ''}</div>
          <div class="doc-meta">${data.fechaStr || ''} - ${data.horaStr || ''}</div>
          <div class="pill">Documento interno</div>
        </div>
      </div>
    </div>
    <div class="content">
      <div class="grid">
        <div class="field"><div class="k">Responsable</div><div class="v">${data.responsable || ''}</div></div>
        <div class="field"><div class="k">Pais</div><div class="v">${data.countryName || '-'}</div></div>
        <div class="field"><div class="k">Bodega</div><div class="v">${data.bodega || ''}</div></div>
        <div class="field"><div class="k">C9 / Centro</div><div class="v">${data.c9 || ''}</div></div>
        <div class="field"><div class="k">Licencia</div><div class="v">${data.licencia || ''}</div></div>
        <div class="field">
          <div class="k">Proveedor</div>
          <div class="v">${data.proveedorNombre || ''}</div>
          <div class="muted" style="font-size:10px;margin-top:2px;">Codigo: ${data.proveedorCodigo || '-'}</div>
        </div>
        <div class="field"><div class="k">Piloto</div><div class="v">${data.pilotoNombre || ''}</div></div>
        <div class="field"><div class="k">Unidad / Placa</div><div class="v">${data.unidad || ''}</div></div>
        <div class="field"><div class="k">Ruta Fisica</div><div class="v">${data.ruta || ''}</div></div>
      </div>
      <table>
        <thead>
          <tr>
            <th style="width:10%;">Codigo</th>
            <th style="width:34%;">Descripcion</th>
            <th style="width:9%;" class="text-center">Cajas</th>
            <th style="width:9%;" class="text-center">Unds</th>
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
          <div class="txt"><strong>Obs:</strong> ${data.observaciones || ''}</div>
          <div class="txt muted" style="margin-top:6px;"><strong>Factura Ref:</strong> ${data.factura || ''}</div>
        </div>
        <div class="card">
          <div class="lbl">Total Cajas</div>
          <div class="val">${data.totalCajas || '0'}</div>
          <div class="muted" style="font-size:10px;margin-top:6px;">Lineas: ${data.totalLineas || '0'}</div>
        </div>
        <div class="card">
          <div class="lbl">Total Unidades</div>
          <div class="val">${data.totalUnidadesSueltas || '0'}</div>
          <div class="muted" style="font-size:10px;margin-top:6px;">Calculo por UxC</div>
        </div>
        <div class="card money">
          <div class="lbl">Monto Total (S/)</div>
          <div class="val">${data.totalMonto || '0.00'}</div>
          <div class="muted" style="font-size:10px;margin-top:6px;">Validacion previa obligatoria</div>
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
        <div>Generado automaticamente por el sistema de Cobros a Transporte - Grupo PDC.</div>
        <div>Documento interno - ${data.fechaStr || ''} ${data.horaStr || ''}</div>
      </div>
    </div>
  </div>
</body>
</html>`;
}
