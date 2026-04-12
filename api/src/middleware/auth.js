import { getUserFromJwt, getUserProfileByEmail } from '../services/supabase.js';

function normalizeRole(raw) {
  const r = String(raw || '').trim().toLowerCase();
  if (!r) return '';
  if (r === 'admin' || r === 'administrador') return 'admin';
  if (r === 'supervisor') return 'supervisor';
  if (r === 'cobrador' || r === 'logisticainversa') return 'logistica_inversa';
  if (r === 'transporte') return 'transporte';
  if (r === 'inventario') return 'inventario';
  if (r === 'creditosycobros' || r === 'cyc' || r === 'creditoscobros') return 'creditos_cobros';
  if (r === 'facturacion') return 'facturacion';
  if (r === 'contabilidad' || r === 'conta') return 'contabilidad';
  return r;
}

function inferAreaFromRole(roleNorm) {
  if (roleNorm === 'logistica_inversa' || roleNorm === 'cobrador') return 'Logistica Inversa';
  if (roleNorm === 'transporte') return 'Transporte';
  if (roleNorm === 'inventario') return 'Inventario';
  if (roleNorm === 'creditos_cobros' || roleNorm === 'cyc') return 'Creditos y Cobros';
  if (roleNorm === 'facturacion') return 'Facturacion';
  if (roleNorm === 'contabilidad' || roleNorm === 'conta') return 'Contabilidad';
  if (roleNorm === 'supervisor') return 'Supervisor';
  if (roleNorm === 'admin') return 'Administrador';
  return '';
}

export async function requireAuth(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return res.status(401).json({ success: false, message: 'Missing token' });
  try {
    const user = await getUserFromJwt(token);
    if (!user) return res.status(401).json({ success: false, message: 'Invalid token' });
    req.user = user;
    const profileRow = await getUserProfileByEmail(user.email || '');
    const rol = normalizeRole(profileRow && profileRow.rol);
    const area = String((profileRow && profileRow.area) || '').trim() || inferAreaFromRole(rol);
    req.profile = {
      email: String(user.email || '').trim().toLowerCase(),
      nombre: String((profileRow && profileRow.nombre) || user.user_metadata?.full_name || ''),
      rol: rol,
      area: area,
      areaKey: area.toLowerCase().replace(/[^a-z0-9]/g, ''),
      countryCode: String((profileRow && profileRow.country_code) || '').trim().toUpperCase(),
      isAdmin: rol === 'admin',
      isSupervisor: rol === 'supervisor',
      canForce: rol === 'admin' || rol === 'supervisor'
    };
    next();
  } catch (err) {
    res.status(401).json({ success: false, message: 'Auth error' });
  }
}
