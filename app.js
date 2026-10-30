const KEY = 'volumen-limpio-v1';
const RATE = { leve: 0.25, regular: 0.5, agresivo: 0.75 };
const $ = id => document.getElementById(id);
const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const addDays = (s, n) => { const d = new Date(s + 'T00:00:00'); d.setDate(d.getDate() + n); return iso(d); };
const diff = (a, b) => Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 864e5);
const fmt = (n, dec = 2) => n.toLocaleString('es-ES', { minimumFractionDigits: dec, maximumFractionDigits: dec });
const short = s => s.slice(8) + '/' + s.slice(5, 7);
const today = iso(new Date());

let S = { startW: 75, startDate: today, goal: 6, weeks: 12, level: 'regular', entries: {}, dirty: {}, planDirty: 0, syncedUser: null, lastSync: null };
try { const r = localStorage.getItem(KEY); if (r) S = Object.assign(S, JSON.parse(r)); } catch (e) {}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };
const touchPlan = () => { S.planDirty = (S.planDirty || 0) + 1; };

const charts = {};
function draw(id, labels, sets, ymin, ymax) {
  const css = getComputedStyle(document.documentElement);
  const col = n => css.getPropertyValue(n).trim();
  if (charts[id]) charts[id].destroy();
  charts[id] = new Chart($(id), {
    type: 'line',
    data: { labels, datasets: sets.map(s => ({
      label: s.label, data: s.data, borderColor: col(s.color), backgroundColor: col(s.color),
      borderDash: s.dash ? [6, 5] : [], borderWidth: s.w, pointRadius: s.r, showLine: !s.dots, spanGaps: true, tension: s.dots ? 0 : 0.25
    })) },
    options: {
      responsive: true, maintainAspectRatio: false, animation: false,
      plugins: { legend: { position: 'bottom', labels: { color: col('--ink'), usePointStyle: true, boxWidth: 8 } } },
      scales: {
        x: { grid: { display: false }, ticks: { color: col('--mut'), maxTicksLimit: 9, maxRotation: 0 } },
        y: { min: ymin, max: ymax, grid: { color: col('--line') }, ticks: { color: col('--mut') } }
      }
    }
  });
}

function render() {
  const rate = RATE[S.level];
  const rateKg = S.startW * rate / 100;
  const plan = i => S.startW + (i / 7) * rateKg;
  const horizon = S.weeks * 7;

  // Panel del plan
  $('pace').innerHTML = '+' + fmt(rateKg) + ' <small>kg por semana</small>';
  const needKg = S.goal / S.weeks, needPct = needKg / S.startW * 100;
  const wksAtLevel = S.goal / rateKg;
  $('goalText').textContent = 'Para ganar ' + fmt(S.goal, 1) + ' kg en ' + S.weeks + ' semanas necesitas ' + fmt(needKg) + ' kg por semana (' + fmt(needPct) + ' %). Con el nivel ' + S.level + ' llegarías en unas ' + fmt(wksAtLevel, 1) + ' semanas.';
  const fit = $('fit');
  if (needPct <= 0.3) fit.textContent = 'Tu objetivo encaja con un volumen leve: el ritmo más seguro para ganar poca grasa.';
  else if (needPct <= 0.6) fit.textContent = 'Tu objetivo encaja con un volumen regular: buen equilibrio entre ritmo y grasa.';
  else if (needPct <= 0.9) fit.textContent = 'Tu objetivo exige un ritmo agresivo: es probable que parte de lo ganado sea grasa.';
  else fit.textContent = 'Este ritmo supera el nivel agresivo: casi seguro incluirá bastante grasa. Considera más semanas o menos kilos.';

  // Datos diarios dentro del periodo
  const dates = Array.from({ length: horizon + 1 }, (_, i) => addDays(S.startDate, i));
  const raw = dates.map(d => S.entries[d] ?? null);
  let last = -1; raw.forEach((v, i) => { if (v !== null) last = i; });
  const avg7 = raw.map((_, i) => {
    if (i > last) return null;
    const v = raw.slice(Math.max(0, i - 6), i + 1).filter(x => x !== null);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  });
  const planLine = dates.map((_, i) => plan(i));
  const goalLine = dates.map((_, i) => S.startW + S.goal * i / horizon);
  const goalLabel = 'Objetivo (+' + fmt(S.goal, 1) + ' kg en ' + S.weeks + ' sem)';

  // Datos semanales
  const wl = [], wa = [], wp = [], wg = [];
  for (let w = 0; w < S.weeks; w++) {
    const v = raw.slice(w * 7, w * 7 + 7).filter(x => x !== null);
    wl.push('Sem ' + (w + 1));
    wa.push(v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);
    wp.push(plan(w * 7 + 3));
    wg.push(S.startW + S.goal * (w * 7 + 3) / horizon);
  }

  const all = [...raw, ...avg7, ...wa].filter(x => x !== null);
  const ymin = Math.floor(Math.min(S.startW, ...all) - 1);
  const ymax = Math.ceil(Math.max(S.startW + S.goal, planLine[horizon], ...all) + 1);

  draw('cDaily', dates.map(short), [
    { label: 'Peso del día', data: raw, color: '--mut', r: 3, w: 0, dots: true },
    { label: 'Media 7 días', data: avg7, color: '--acc', r: 0, w: 3 },
    { label: 'Plan (' + S.level + ')', data: planLine, color: '--plan', r: 0, w: 2, dash: true },
    { label: goalLabel, data: goalLine, color: '--ok', r: 0, w: 2, dash: true }
  ], ymin, ymax);
  draw('cWeekly', wl, [
    { label: 'Media de la semana', data: wa, color: '--acc', r: 4, w: 3 },
    { label: 'Plan (' + S.level + ')', data: wp, color: '--plan', r: 0, w: 2, dash: true },
    { label: goalLabel, data: wg, color: '--ok', r: 0, w: 2, dash: true }
  ], ymin, ymax);

  // Estado actual
  if (last >= 0 && avg7[last] !== null) {
    const cur = avg7[last], gain = cur - S.startW, pn = plan(last), dif = cur - pn;
    $('cur').textContent = fmt(cur, 1) + ' kg';
    $('gain').textContent = (gain >= 0 ? '+' : '') + fmt(gain, 1) + ' kg';
    $('planNow').textContent = fmt(pn, 1) + ' kg';
    $('status').textContent = dif > 0.4
      ? 'Vas ' + fmt(dif, 1) + ' kg por encima del plan: parte del aumento puede ser grasa o retención. Valora bajar un nivel.'
      : dif < -0.4
      ? 'Vas ' + fmt(-dif, 1) + ' kg por debajo del plan: te falta algo de ingesta para llegar al ritmo elegido.'
      : 'Vas dentro del plan. Sigue así.';
  } else {
    ['cur', 'gain', 'planNow'].forEach(i => $(i).textContent = '—');
    $('status').textContent = 'Guarda tu primer peso para ver tu progreso.';
  }

  // Últimos registros
  const ul = $('recent'); ul.innerHTML = '';
  Object.keys(S.entries).sort().reverse().slice(0, 5).forEach(d => {
    const li = document.createElement('li');
    li.innerHTML = '<span>' + short(d) + ' · ' + fmt(S.entries[d], 1) + ' kg</span>';
    const b = document.createElement('button'); b.textContent = 'Quitar'; b.setAttribute('aria-label', 'Quitar el registro del ' + short(d));
    b.onclick = () => { delete S.entries[d]; S.dirty[d] = 'del'; save(); render(); sync(); };
    li.appendChild(b); ul.appendChild(li);
  });
}

function fill() {
  $('startW').value = S.startW; $('startDate').value = S.startDate; $('goal').value = S.goal; $('weeks').value = S.weeks;
  document.querySelector('input[name=level][value=' + S.level + ']').checked = true;
}
function readPlan() {
  const n = (id, min, max, def) => { const v = parseFloat($(id).value); return isFinite(v) ? Math.min(max, Math.max(min, v)) : def; };
  S.startW = n('startW', 30, 250, S.startW);
  S.goal = n('goal', 0.5, 30, S.goal);
  S.weeks = Math.round(n('weeks', 2, 26, S.weeks));
  S.startDate = $('startDate').value || S.startDate;
  S.level = document.querySelector('input[name=level]:checked').value;
  touchPlan(); save(); fill(); render(); sync();
}
['startW', 'startDate', 'goal', 'weeks'].forEach(id => $(id).addEventListener('change', readPlan));
document.querySelectorAll('input[name=level]').forEach(r => r.addEventListener('change', readPlan));

$('d').value = today;
$('add').onclick = () => {
  const v = parseFloat($('w').value), d = $('d').value;
  if (!isFinite(v) || v < 30 || v > 250 || !d) { $('w').focus(); return; }
  S.entries[d] = Math.round(v * 10) / 10; S.dirty[d] = 'set'; save(); $('w').value = ''; render(); sync();
};
$('w').addEventListener('keydown', e => { if (e.key === 'Enter') $('add').click(); });

$('demo').onclick = () => {
  S.startW = 75; S.startDate = addDays(today, -35); Object.keys(S.entries).forEach(d => S.dirty[d] = 'del'); S.entries = {};
  for (let i = 0; i <= 35; i++) {
    const dd = addDays(S.startDate, i);
    S.entries[dd] = Math.round((75 + i / 7 * 0.4 + Math.sin(i * 1.7) * 0.45) * 10) / 10; S.dirty[dd] = 'set';
  }
  touchPlan(); save(); fill(); render(); sync();
};
let armed = false;
$('clear').onclick = () => {
  if (!armed) { armed = true; $('clear').textContent = 'Pulsa otra vez para confirmar'; setTimeout(() => { armed = false; $('clear').textContent = 'Borrar datos'; }, 3000); return; }
  Object.keys(S.entries).forEach(d => S.dirty[d] = 'del'); S.entries = {}; armed = false; $('clear').textContent = 'Borrar datos'; save(); render(); sync();
};

// Copia de seguridad
const msg = t => { const m = $('bkMsg'); m.hidden = false; m.textContent = t; };
function backupJSON() {
  return JSON.stringify({ app: 'volumen-limpio', version: 1, exported: today,
    settings: { startW: S.startW, startDate: S.startDate, goal: S.goal, weeks: S.weeks, level: S.level },
    entries: S.entries }, null, 2);
}
$('exp').onclick = async () => {
  const json = backupJSON();
  const name = 'volumen-limpio-' + today + '.json';
  try {
    const blob = new Blob([json], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    msg('Copia descargada: ' + name);
  } catch (e) { $('paste').value = json; msg('No se pudo descargar. Copia el texto de abajo y guárdalo en un archivo .json.'); }
};
function importJSON(text) {
  let o; try { o = JSON.parse(text); } catch (e) { msg('El contenido no es válido: no se ha cambiado nada.'); return; }
  const src = o && o.entries && typeof o.entries === 'object' ? o.entries : null;
  if (!src) { msg('No encuentro registros en ese contenido: no se ha cambiado nada.'); return; }
  const re = /^\d{4}-\d{2}-\d{2}$/; let n = 0;
  Object.keys(src).forEach(d => { const v = Number(src[d]); if (re.test(d) && v >= 30 && v <= 250) { S.entries[d] = Math.round(v * 10) / 10; S.dirty[d] = 'set'; n++; } });
  const s = o.settings || {};
  const num = (v, a, b) => isFinite(v) && v !== null && v >= a && v <= b;
  if (num(s.startW, 30, 250)) S.startW = +s.startW;
  if (num(s.goal, 0.5, 30)) S.goal = +s.goal;
  if (num(s.weeks, 2, 26)) S.weeks = Math.round(s.weeks);
  if (typeof s.startDate === 'string' && re.test(s.startDate)) S.startDate = s.startDate;
  if (RATE[s.level]) S.level = s.level;
  touchPlan(); save(); fill(); render(); sync();
  msg('Importados ' + n + ' registros y el plan.');
}
$('imp').onclick = () => $('file').click();
$('file').addEventListener('change', async e => {
  const f = e.target.files[0]; if (!f) return;
  try { importJSON(await f.text()); } catch (err) { msg('No se pudo leer el archivo.'); }
  e.target.value = '';
});
$('impText').onclick = () => { if ($('paste').value.trim()) importJSON($('paste').value); else msg('Pega primero el contenido de una copia.'); };

// ---- Cuenta y sincronización (Supabase) ----
const SB_URL = 'https://aoptvzeqktzoqyujtces.supabase.co';
const SB_KEY = 'sb_publishable_aO6M0u3BUVEiEZ_Bbv_b6A_uK6eK4Mr'; // clave pública: la seguridad la da Row Level Security
const sb = (window.supabase && window.supabase.createClient) ? window.supabase.createClient(SB_URL, SB_KEY) : null;
let user = null, syncing = false, again = false;

const amsg = t => { const m = $('acctMsg'); m.hidden = !t; m.textContent = t || ''; };
function acctUI() {
  $('acctOut').hidden = !!user; $('acctIn').hidden = !user;
  if (user) $('who').textContent = 'Conectado como ' + user.email + (S.lastSync ? ' · última sincronización a las ' + S.lastSync : '');
}

// Estrategia: primero se suben los cambios pendientes (S.dirty), después se baja todo lo de la nube.
async function sync() {
  if (!sb || !user) return;
  if (syncing) { again = true; return; }
  if (!navigator.onLine) { amsg('Sin conexión: los cambios se subirán cuando vuelvas a estar online.'); return; }
  syncing = true; amsg('Sincronizando…');
  try {
    if (S.syncedUser !== user.id) {                       // primer acceso en este dispositivo
      Object.keys(S.entries).forEach(d => S.dirty[d] = 'set');
      const { data: rp, error: ep } = await sb.from('plans').select('user_id').maybeSingle();
      if (ep) throw ep;
      if (!rp) touchPlan();                               // si la nube ya tiene plan, gana el de la nube
      S.syncedUser = user.id; save();
    }
    const snap = Object.assign({}, S.dirty), planSnap = S.planDirty || 0;
    const sets = Object.keys(snap).filter(d => snap[d] === 'set' && S.entries[d] != null);
    const dels = Object.keys(snap).filter(d => snap[d] === 'del');
    if (sets.length) {
      const rows = sets.map(d => ({ user_id: user.id, day: d, kg: S.entries[d] }));
      const { error } = await sb.from('weights').upsert(rows, { onConflict: 'user_id,day' });
      if (error) throw error;
    }
    if (dels.length) {
      const { error } = await sb.from('weights').delete().in('day', dels);
      if (error) throw error;
    }
    if (planSnap) {
      const { error } = await sb.from('plans').upsert({ user_id: user.id, start_w: S.startW, start_date: S.startDate,
        goal: S.goal, weeks: S.weeks, level: S.level, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
      if (error) throw error;
    }
    Object.keys(snap).forEach(d => { if (S.dirty[d] === snap[d]) delete S.dirty[d]; });
    if (S.planDirty === planSnap) S.planDirty = 0;

    const remote = {}; let from = 0;                      // bajar todos los pesos (de 1000 en 1000)
    for (;;) {
      const { data, error } = await sb.from('weights').select('day,kg').order('day').range(from, from + 999);
      if (error) throw error;
      data.forEach(r => remote[r.day] = Number(r.kg));
      if (data.length < 1000) break;
      from += 1000;
    }
    Object.keys(S.dirty).forEach(d => { if (S.dirty[d] === 'set') remote[d] = S.entries[d]; else delete remote[d]; });
    S.entries = remote;
    if (!S.planDirty) {
      const { data, error } = await sb.from('plans').select('*').maybeSingle();
      if (error) throw error;
      if (data) { S.startW = Number(data.start_w); S.startDate = data.start_date; S.goal = Number(data.goal); S.weeks = data.weeks; S.level = data.level; }
    }
    S.lastSync = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    save(); fill(); render(); acctUI(); amsg('Sincronizado.');
  } catch (e) {
    amsg('No se pudo sincronizar (' + (e && e.message ? e.message : 'error') + '). Se reintentará.');
  } finally {
    syncing = false;
    if (again) { again = false; setTimeout(sync, 0); }
  }
}

if (sb) {
  sb.auth.getSession().then(({ data }) => { user = data.session ? data.session.user : null; acctUI(); if (user) sync(); });
  sb.auth.onAuthStateChange((evt, session) => { user = session ? session.user : null; acctUI(); if (user) setTimeout(sync, 0); });
} else {
  amsg('No se pudo cargar el módulo de cuentas. La app funciona solo en este dispositivo.');
}
const cred = () => ({ email: $('em').value.trim(), password: $('pw').value });
$('login').onclick = async () => {
  const c = cred(); if (!sb) return;
  if (!c.email || !c.password) { amsg('Escribe tu email y tu contraseña.'); return; }
  amsg('Entrando…');
  const { error } = await sb.auth.signInWithPassword(c);
  amsg(error ? 'No se pudo entrar: ' + error.message : '');
};
$('signup').onclick = async () => {
  const c = cred(); if (!sb) return;
  if (!c.email || c.password.length < 6) { amsg('Escribe un email y una contraseña de al menos 6 caracteres.'); return; }
  amsg('Creando cuenta…');
  const { data, error } = await sb.auth.signUp(c);
  if (error) amsg('No se pudo crear la cuenta: ' + error.message);
  else amsg(data.session ? '' : 'Cuenta creada. Revisa tu correo para confirmarla y luego pulsa Entrar.');
};
$('syncNow').onclick = () => sync();
$('logout').onclick = async () => {
  await sync();
  if (Object.keys(S.dirty).length || S.planDirty) { amsg('Hay cambios sin subir. Conéctate a internet y reintenta antes de cerrar sesión.'); return; }
  Object.assign(S, { startW: 75, startDate: today, goal: 6, weeks: 12, level: 'regular', entries: {}, dirty: {}, planDirty: 0, syncedUser: null, lastSync: null });
  save(); fill(); render();
  await sb.auth.signOut(); amsg('Sesión cerrada.');
};
window.addEventListener('online', () => sync());

matchMedia('(prefers-color-scheme: dark)').addEventListener('change', render);
fill(); render();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
