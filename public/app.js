const API = '/api';
const TYPE_META = {
  hospital:   { color: '#E4572E', letter: 'H', label: 'Hospital' },
  clinic:     { color: '#5B8266', letter: 'C', label: 'Clinic' },
  pharmacy:   { color: '#2F6DB5', letter: 'P', label: 'Pharmacy' },
  laboratory: { color: '#8A4FA0', letter: 'L', label: 'Laboratory' },
  dispensary: { color: '#B9831A', letter: 'D', label: 'Dispensary' },
};

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

let features = [];
let markers = {};
let firstLoad = true;
let pickMarker = null;

// ---------- Map ----------
const map = L.map('map').setView([33.66, 73.05], 11);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  maxZoom: 19,
}).addTo(map);
const layer = L.layerGroup().addTo(map);

// Legend
$('#legend').innerHTML = Object.values(TYPE_META)
  .map((m) => `<div><span class="mini" style="--c:${m.color}">${m.letter}</span>${m.label}</div>`)
  .join('');

function makeIcon(f) {
  const m = TYPE_META[f.properties.type] || TYPE_META.clinic;
  return L.divIcon({
    className: 'tagwrap',
    html: `<div class="tag ${f.properties.emergency ? 'em' : ''}" style="--c:${m.color}">${m.letter}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -14],
  });
}

function popupHtml(f) {
  const p = f.properties;
  const m = TYPE_META[p.type] || TYPE_META.clinic;
  const official = p.verified || p.source !== 'Student-collected';
  return `
    <div class="pop">
      <h3>${esc(p.name)}</h3>
      <div class="badges">
        <span class="badge plain">${esc(m.label)}</span>
        ${p.emergency ? '<span class="badge red">24/7 Emergency</span>' : ''}
        <span class="badge ${official ? 'sage' : 'plain'}">${official ? 'Verified / ' + esc(p.source) : 'Student-collected'}</span>
      </div>
      <dl>
        <dt>District</dt><dd>${esc(p.district)}</dd>
        <dt>Sector</dt><dd>${esc(p.sector || '-')}</dd>
        <dt>Ownership</dt><dd>${esc(p.ownership)}</dd>
        <dt>Beds</dt><dd>${p.beds ?? '-'}</dd>
        <dt>Phone</dt><dd>${esc(p.phone || '-')}</dd>
      </dl>
      <button class="btn primary editBtn" data-id="${p.id}" type="button">Update record</button>
      <div class="hist" id="hist-${p.id}">Loading history...</div>
    </div>`;
}

// ---------- Loading data ----------
function queryString() {
  const p = new URLSearchParams();
  const q = $('#q').value.trim();
  if (q) p.set('q', q);
  if ($('#fType').value) p.set('type', $('#fType').value);
  if ($('#fDistrict').value) p.set('district', $('#fDistrict').value);
  if ($('#fSource').value) p.set('source', $('#fSource').value);
  if ($('#fEmergency').checked) p.set('emergency', 'true');
  return p.toString();
}

async function load() {
  try {
    const res = await fetch(`${API}/facilities?${queryString()}`);
    if (!res.ok) throw new Error('Request failed');
    const data = await res.json();
    features = data.features;
    draw();
    loadStats();
  } catch (e) {
    toast('Could not load data from the server.', true);
  }
}

function draw() {
  layer.clearLayers();
  markers = {};
  const bounds = [];

  features.forEach((f) => {
    const [lng, lat] = f.geometry.coordinates;
    const mk = L.marker([lat, lng], { icon: makeIcon(f) });
    mk.bindPopup(() => popupHtml(f), { maxWidth: 300 });
    mk.on('popupopen', () => loadHistory(f.properties.id));
    mk.addTo(layer);
    markers[f.properties.id] = mk;
    bounds.push([lat, lng]);
  });

  if (firstLoad && bounds.length) {
    map.fitBounds(bounds, { padding: [40, 40] });
    firstLoad = false;
  }

  $('#count').textContent = `${features.length} record${features.length === 1 ? '' : 's'}`;
  $('#list').innerHTML = features.length
    ? features.map((f) => {
        const p = f.properties;
        const m = TYPE_META[p.type] || TYPE_META.clinic;
        return `<div class="item" data-id="${p.id}" style="--c:${m.color}">
          <span class="mini" style="--c:${m.color}">${m.letter}</span>
          <div><h3>${esc(p.name)}</h3><p>${esc(p.district)}${p.sector ? ' / ' + esc(p.sector) : ''} / ${esc(p.source)}</p></div>
        </div>`;
      }).join('')
    : '<div class="empty">No facilities match these filters.</div>';
}

async function loadStats() {
  try {
    const res = await fetch(`${API}/stats`);
    const s = await res.json();
    const isb = (s.byDistrict.find((x) => x.k === 'Islamabad') || {}).n || 0;
    const rwp = (s.byDistrict.find((x) => x.k === 'Rawalpindi') || {}).n || 0;
    const stu = (s.bySource.find((x) => x.k === 'Student-collected') || {}).n || 0;
    $('#stats').innerHTML = `
      <div class="stat"><b>${s.total}</b><span>Total</span></div>
      <div class="stat"><b>${isb}</b><span>Islamabad</span></div>
      <div class="stat"><b>${rwp}</b><span>Rawalpindi</span></div>
      <div class="stat"><b>${stu}</b><span>Student data</span></div>`;
  } catch (e) { /* stats are optional */ }
}

async function loadHistory(id) {
  const box = document.getElementById(`hist-${id}`);
  if (!box) return;
  try {
    const res = await fetch(`${API}/facilities/${id}/updates`);
    const rows = await res.json();
    box.innerHTML = rows.length
      ? '<b>HISTORY</b>' + rows.map((r) =>
          `<div>${new Date(r.updated_at).toLocaleDateString()} - ${esc(r.note)}</div>`).join('')
      : 'No history yet.';
  } catch (e) {
    box.textContent = 'History unavailable.';
  }
}

// ---------- Filters ----------
let timer;
$('#q').addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(load, 300); });
['#fType', '#fDistrict', '#fSource', '#fEmergency'].forEach((s) => $(s).addEventListener('change', load));
$('#reset').addEventListener('click', () => {
  $('#q').value = ''; $('#fType').value = ''; $('#fDistrict').value = '';
  $('#fSource').value = ''; $('#fEmergency').checked = false;
  load();
});

$('#list').addEventListener('click', (e) => {
  const item = e.target.closest('.item');
  if (!item) return;
  const mk = markers[item.dataset.id];
  if (mk) { map.flyTo(mk.getLatLng(), 15, { duration: 0.8 }); setTimeout(() => mk.openPopup(), 850); }
});

// ---------- Form ----------
const drawer = $('#drawer');

function openForm(feature) {
  $('#formError').textContent = '';
  $('#form').reset();
  $('#fId').value = '';
  $('#formTitle').textContent = 'New record';
  try { $('#adminKey').value = sessionStorage.getItem('adminKey') || ''; } catch (e) { /* ignore */ }

  if (feature) {
    const p = feature.properties;
    const [lng, lat] = feature.geometry.coordinates;
    $('#formTitle').textContent = 'Update record';
    $('#fId').value = p.id;
    $('#name').value = p.name;
    $('#type').value = p.type;
    $('#district').value = p.district;
    $('#sector').value = p.sector || '';
    $('#ownership').value = p.ownership;
    $('#beds').value = p.beds ?? '';
    $('#phone').value = p.phone || '';
    $('#source').value = p.source;
    $('#emergency').checked = p.emergency;
    $('#verified').checked = p.verified;
    $('#lat').value = lat;
    $('#lng').value = lng;
  }
  drawer.classList.add('open');
}

function closeForm() {
  drawer.classList.remove('open');
  if (pickMarker) { map.removeLayer(pickMarker); pickMarker = null; }
}

$('#addBtn').addEventListener('click', () => openForm(null));
$('#closeForm').addEventListener('click', closeForm);

// Edit button inside popup
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.editBtn');
  if (!btn) return;
  const f = features.find((x) => String(x.properties.id) === btn.dataset.id);
  if (f) { map.closePopup(); openForm(f); }
});

// Pick location on map
$('#pickBtn').addEventListener('click', () => {
  document.body.classList.add('picking');
  map.once('click', (e) => {
    $('#lat').value = e.latlng.lat.toFixed(6);
    $('#lng').value = e.latlng.lng.toFixed(6);
    if (pickMarker) map.removeLayer(pickMarker);
    pickMarker = L.circleMarker(e.latlng, { radius: 9, color: '#14213D', weight: 2, fillColor: '#E4572E', fillOpacity: 1 }).addTo(map);
    document.body.classList.remove('picking');
  });
});

$('#form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = $('#formError');
  err.textContent = '';

  const name = $('#name').value.trim();
  const lat = parseFloat($('#lat').value);
  const lng = parseFloat($('#lng').value);
  const key = $('#adminKey').value.trim();
  const beds = $('#beds').value;

  if (name.length < 3) return (err.textContent = 'Please enter a facility name (at least 3 characters).');
  if (Number.isNaN(lat) || Number.isNaN(lng)) return (err.textContent = 'Latitude and longitude are required. Use "Pick location on map".');
  if (beds !== '' && (Number($(' #beds').value) < 0 || !Number.isInteger(Number(beds)))) return (err.textContent = 'Beds must be a whole number.');
  if (!key) return (err.textContent = 'Admin key is required to save.');

  const id = $('#fId').value;
  const body = {
    name,
    type: $('#type').value,
    district: $('#district').value,
    sector: $('#sector').value.trim(),
    ownership: $('#ownership').value,
    beds: beds === '' ? null : Number(beds),
    phone: $('#phone').value.trim(),
    source: $('#source').value,
    emergency: $('#emergency').checked,
    verified: $('#verified').checked,
    lat, lng,
  };

  const btn = $('#saveBtn');
  btn.disabled = true;
  try {
    const res = await fetch(id ? `${API}/facilities/${id}` : `${API}/facilities`, {
      method: id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-key': key },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { err.textContent = data.error || 'Could not save the record.'; return; }
    try { sessionStorage.setItem('adminKey', key); } catch (e2) { /* ignore */ }
    closeForm();
    toast(id ? 'Record updated and saved to PostgreSQL.' : 'Record added and saved to PostgreSQL.');
    load();
  } catch (e3) {
    err.textContent = 'Network error. Is the server running?';
  } finally {
    btn.disabled = false;
  }
});

// ---------- Toast ----------
function toast(msg, isError) {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'toast show' + (isError ? ' err' : '');
  setTimeout(() => t.classList.remove('show'), 3500);
}

load();