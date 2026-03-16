const $ = (id) => document.getElementById(id);

const state = {
  uv: null,
  level: 'neutral',
  listenersBound: false,
};

const levelMeta = [
  { min: 0, max: 2.99, key: 'low', label: 'Low' },
  { min: 3, max: 5.99, key: 'moderate', label: 'Moderate' },
  { min: 6, max: 7.99, key: 'high', label: 'High' },
  { min: 8, max: 10.99, key: 'very-high', label: 'Very High' },
  { min: 11, max: Infinity, key: 'extreme', label: 'Extreme' }
];

function getLevel(uv) {
  return levelMeta.find((item) => uv >= item.min && uv <= item.max) || levelMeta[0];
}

function estimateMinutes(uv) {
  if (uv < 3) return 60;
  if (uv < 6) return 35;
  if (uv < 8) return 22;
  if (uv < 11) return 12;
  return 8;
}

function buildHumanAlert(uv, level) {
  const mins = estimateMinutes(uv);
  const rounded = Math.round(uv * 10) / 10;
  const map = {
    low: `UV ${rounded} is low right now. You are mostly safe for short outdoor time, but longer exposure still deserves protection.`,
    moderate: `UV ${rounded} is already strong enough to matter. Protect exposed skin within about ${mins}–${mins + 10} minutes if you stay outside.`,
    high: `UV ${rounded} is high. Skin can start taking damage in around ${mins} minutes — shade, sunscreen, and a hat should happen now.`,
    'very-high': `UV ${rounded} is very high. Skin damage can begin in roughly ${mins} minutes — cover up and reduce direct exposure now.`,
    extreme: `UV ${rounded} is extreme. Unprotected skin can burn fast, around ${mins} minutes or less — avoid peak sun where possible.`
  };
  return map[level.key];
}

function buildActionText(level) {
  const actions = {
    low: 'Short outdoor trips are usually fine. For longer time outside, prep sunscreen and sunglasses first.',
    moderate: 'Now is the time to add sunscreen, sunglasses, and a hat before staying outdoors.',
    high: 'Plan for shade, long sleeves, and SPF 50+ together rather than treating them separately.',
    'very-high': 'This level needs active protection — clothing, accessories, and reduced direct exposure all matter.',
    extreme: 'Treat this as a hazard. Minimise direct exposure and use maximum practical protection.'
  };
  return actions[level.key];
}

function renderList(targetId, items) {
  const list = $(targetId);
  list.innerHTML = '';
  (items || []).forEach((item) => {
    const li = document.createElement('li');
    li.textContent = item;
    list.appendChild(li);
  });
}

function updateDynamicClothing(payload, levelKey) {
  const clothing = payload?.clothing;
  if (!clothing) return;

  $('outfitTitle').textContent = clothing.outfitTitle;
  $('outfitHeadline').textContent = clothing.headline;
  $('campaignTitle').textContent = clothing.campaign;
  $('campaignText').textContent = clothing.caution;
  $('cautionText').textContent = clothing.caution;

  renderList('outfitList', clothing.outfitItems);
  renderList('materialsList', clothing.materials);
  renderList('accessoriesList', clothing.accessories);

  const grid = $('clothingGrid');
  grid.className = `clothing-grid clothing-theme-${clothing.theme || levelKey}`;
}

function renderUvCard(payload) {
  const uv = payload.uvIndex;
  const locationLabel = payload.location;
  const level = getLevel(uv);
  state.uv = uv;
  state.level = level.key;

  $('uvValue').textContent = uv.toFixed(1);
  const badge = $('uvBadge');
  badge.textContent = level.label;
  badge.className = `uv-badge ${level.key}`;
  $('uvLocation').textContent = locationLabel;
  $('uvAlert').textContent = buildHumanAlert(uv, level);
  $('exposureText').textContent = `Estimated unprotected exposure time: around ${estimateMinutes(uv)} minutes in peak conditions for fair-to-medium skin.`;
  $('actionText').textContent = buildActionText(level);
  updateDynamicClothing(payload, level.key);
}

const CONFIG_API_BASE = window.APP_CONFIG?.apiBase?.trim?.() || '';
const API_BASE = CONFIG_API_BASE || (
  window.location.hostname.includes('localhost') || window.location.hostname.includes('127.0.0.1')
    ? 'http://127.0.0.1:8000'
    : ''
);

async function fetchUvByCoords(lat, lon, label) {
  const url = `${API_BASE}/api/uv/current?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}${label ? `&label=${encodeURIComponent(label)}` : ''}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function fetchUvByQuery(query) {
  const url = `${API_BASE}/api/uv/current?q=${encodeURIComponent(query)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function loadUvFor(lat, lon, label) {
  $('uvAlert').textContent = 'Fetching live UV data…';
  const data = await fetchUvByCoords(lat, lon, label);
  renderUvCard(data);
}

async function searchUv() {
  const input = $('locationInput');
  const query = input.value.trim();
  if (!query) {
    $('uvAlert').textContent = 'Enter an Australian suburb or postcode first.';
    return;
  }
  $('uvAlert').textContent = 'Searching suburb/postcode…';
  try {
    const data = await fetchUvByQuery(query);
    renderUvCard(data);
  } catch (error) {
    $('uvAlert').textContent = 'Could not find UV data for that suburb or postcode.';
    console.error(error);
  }
}

async function useMyLocation() {
  if (!navigator.geolocation) {
    $('uvAlert').textContent = 'Geolocation is not supported in this browser. Use the suburb/postcode search instead.';
    return;
  }

  navigator.geolocation.getCurrentPosition(async (position) => {
    try {
      const { latitude, longitude } = position.coords;
      await loadUvFor(latitude, longitude, `Your location (${latitude.toFixed(2)}, ${longitude.toFixed(2)})`);
    } catch (error) {
      $('uvAlert').textContent = 'Could not load live UV right now. Try suburb/postcode search instead.';
      console.error(error);
    }
  }, async () => {
    $('uvAlert').textContent = 'Location access was denied. Try suburb/postcode search instead.';
  });
}

function setupCanvas(canvasId) {
  const canvas = $(canvasId);
  const dpr = window.devicePixelRatio || 1;
  const cssWidth = canvas.clientWidth || canvas.parentElement.clientWidth || 400;
  const cssHeight = parseInt(canvas.getAttribute('height'), 10) || 240;
  canvas.width = cssWidth * dpr;
  canvas.height = cssHeight * dpr;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w: cssWidth, h: cssHeight };
}

function drawGrid(ctx, w, h, padding, rows) {
  const innerH = h - padding.top - padding.bottom;
  ctx.strokeStyle = 'rgba(29,29,31,0.15)';
  ctx.lineWidth = 1;
  for (let i = 0; i < rows; i++) {
    const y = padding.top + (innerH / (rows - 1)) * i;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(w - padding.right, y);
    ctx.stroke();
  }
}

function drawLineSeries(ctx, data, xFor, yFor, color) {
  ctx.beginPath();
  data.forEach((point, index) => {
    const x = xFor(point, index);
    const y = yFor(point, index);
    if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.stroke();

  data.forEach((point, index) => {
    const x = xFor(point, index);
    const y = yFor(point, index);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x, y, 4.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
  });
}

function drawMelanomaChart() {
  const { ctx, w, h } = setupCanvas('cancerChart');
  const data = window.SUN_DATA.melanomaTrend;
  const padding = { top: 26, right: 20, bottom: 36, left: 52 };
  const innerW = w - padding.left - padding.right;
  const innerH = h - padding.top - padding.bottom;
  const maxY = Math.max(...data.flatMap((d) => [d.incidence, d.mortality]));
  const xFor = (_, index) => padding.left + (innerW / (data.length - 1)) * index;
  const yForInc = (point) => padding.top + innerH - (point.incidence / maxY) * innerH;
  const yForMort = (point) => padding.top + innerH - (point.mortality / maxY) * innerH;

  ctx.clearRect(0, 0, w, h);
  drawGrid(ctx, w, h, padding, 5);
  drawLineSeries(ctx, data, xFor, yForInc, '#ff4d4d');
  drawLineSeries(ctx, data, xFor, yForMort, '#7f52ff');

  ctx.fillStyle = '#1d1d1f';
  ctx.font = '12px Inter';
  ctx.textAlign = 'center';
  data.forEach((point, index) => ctx.fillText(String(point.year), xFor(point, index), h - 10));

  const legend = [
    { label: 'Incidence', color: '#ff4d4d' },
    { label: 'Mortality', color: '#7f52ff' }
  ];
  let legendX = w - 150;
  legend.forEach((item, idx) => {
    const y = 18 + idx * 18;
    ctx.fillStyle = item.color;
    ctx.fillRect(legendX, y - 8, 12, 12);
    ctx.fillStyle = '#1d1d1f';
    ctx.textAlign = 'left';
    ctx.fillText(item.label, legendX + 18, y + 2);
  });
}

function drawHeatChart() {
  const { ctx, w, h } = setupCanvas('heatChart');
  const data = window.SUN_DATA.heatTrend;
  const padding = { top: 26, right: 20, bottom: 36, left: 52 };
  const innerW = w - padding.left - padding.right;
  const innerH = h - padding.top - padding.bottom;
  const minY = Math.min(...data.map((d) => d.anomaly));
  const maxY = Math.max(...data.map((d) => d.anomaly));
  const xFor = (_, index) => padding.left + (innerW / (data.length - 1)) * index;
  const yFor = (point) => padding.top + innerH - ((point.anomaly - minY) / (maxY - minY || 1)) * innerH;

  ctx.clearRect(0, 0, w, h);
  drawGrid(ctx, w, h, padding, 5);
  drawLineSeries(ctx, data, xFor, yFor, '#ff7a00');

  ctx.fillStyle = '#1d1d1f';
  ctx.font = '12px Inter';
  ctx.textAlign = 'center';
  data.forEach((point, index) => ctx.fillText(String(point.year), xFor(point, index), h - 10));

  ctx.textAlign = 'left';
  ctx.fillText('Temperature anomaly (°C)', 8, 16);
}

function renderSources() {
  const target = $('sourceList');
  target.innerHTML = '';
  window.SUN_DATA.sources.forEach((item) => {
    const li = document.createElement('li');
    li.textContent = item;
    target.appendChild(li);
  });
}

function bindEvents() {
  if (state.listenersBound) return;
  $('locateBtn').addEventListener('click', useMyLocation);
  $('searchBtn').addEventListener('click', searchUv);
  $('locationInput').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') searchUv();
  });
  document.querySelectorAll('.query-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      $('locationInput').value = btn.dataset.query || '';
      await searchUv();
    });
  });
  state.listenersBound = true;
}

function boot() {
  drawMelanomaChart();
  drawHeatChart();
  renderSources();
  bindEvents();
}

window.addEventListener('resize', boot);
window.addEventListener('DOMContentLoaded', async () => {
  boot();
  try {
    const data = await fetchUvByQuery('Melbourne');
    renderUvCard(data);
  } catch (error) {
    console.error(error);
  }
});
