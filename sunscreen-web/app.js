const $ = (id) => document.getElementById(id);

const state = {
  uv: null,
  level: 'neutral'
};

const levelMeta = [
  { min: 0, max: 2.99, key: 'low', label: 'Low', color: '#16a34a' },
  { min: 3, max: 5.99, key: 'moderate', label: 'Moderate', color: '#d97706' },
  { min: 6, max: 7.99, key: 'high', label: 'High', color: '#ea580c' },
  { min: 8, max: 10.99, key: 'very-high', label: 'Very High', color: '#dc2626' },
  { min: 11, max: Infinity, key: 'extreme', label: 'Extreme', color: '#7c3aed' }
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
    low: `UV ${rounded} is low right now. You are relatively safe for short trips, but longer outdoor time still deserves sunscreen and sunglasses.`,
    moderate: `UV ${rounded} is already strong enough to matter. If you stay outside, protect exposed skin within about ${mins}–${mins + 10} minutes.`,
    high: `UV ${rounded} is high. Your skin can start taking damage in around ${mins} minutes — shade, sunscreen, and a hat are a smart move now.`,
    'very-high': `UV ${rounded} is very high. Skin damage can begin in roughly ${mins} minutes — find shade now and cover up before staying outdoors.`,
    extreme: `UV ${rounded} is extreme. Unprotected skin can burn fast, around ${mins} minutes or less — avoid direct sun where possible.`
  };
  return map[level.key];
}

function buildActionText(level) {
  const actions = {
    low: 'Okay for most short outdoor tasks. If you will be outside for longer, prep sunscreen before noon.',
    moderate: 'Reapply sunscreen, add sunglasses, and consider a hat if you are walking between classes.',
    high: 'Try to shift outdoor activity earlier/later. Shade + SPF 50+ + hat should happen together.',
    'very-high': 'This is not “nice weather, no problem” sun. Reduce direct exposure and dress for protection.',
    extreme: 'Treat this like a serious hazard. Avoid peak sun, use full protection, and keep outings short.'
  };
  return actions[level.key];
}

function updateClothing(levelKey) {
  const list = $('outfitList');
  list.innerHTML = '';
  const items = window.SUN_DATA.clothingByLevel[levelKey] || window.SUN_DATA.clothingByLevel.low;
  items.forEach((item) => {
    const li = document.createElement('li');
    li.textContent = item;
    list.appendChild(li);
  });
  $('outfitTitle').textContent = `Recommended outfit for ${levelKey.replace('-', ' ')} UV`;
}

function renderUvCard(uv, locationLabel) {
  const level = getLevel(uv);
  state.uv = uv;
  state.level = level.key;

  $('uvValue').textContent = uv.toFixed(1);
  const badge = $('uvBadge');
  badge.textContent = level.label;
  badge.className = `uv-badge ${level.key}`;
  $('uvLocation').textContent = locationLabel;
  $('uvAlert').textContent = buildHumanAlert(uv, level);
  $('exposureText').textContent = `Estimated unprotected exposure time: around ${estimateMinutes(uv)} minutes for fair-to-medium skin in peak conditions.`;
  $('actionText').textContent = buildActionText(level);
  updateClothing(level.key);
}

async function reverseGeocode(lat, lon) {
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${lat}&longitude=${lon}&language=en&format=json`;
    const res = await fetch(url);
    const data = await res.json();
    const place = data?.results?.[0];
    if (!place) return `Lat ${lat.toFixed(2)}, Lon ${lon.toFixed(2)}`;
    return `${place.name}${place.admin1 ? ', ' + place.admin1 : ''}`;
  } catch {
    return `Lat ${lat.toFixed(2)}, Lon ${lon.toFixed(2)}`;
  }
}

async function fetchUv(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=uv_index,temperature_2m&timezone=auto`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch UV data');
  const data = await res.json();
  return data.current?.uv_index ?? 0;
}

async function useMyLocation() {
  $('uvAlert').textContent = 'Fetching live UV data…';
  if (!navigator.geolocation) {
    $('uvAlert').textContent = 'Geolocation is not supported in this browser. For demo day, test in Chrome or Edge.';
    return;
  }

  navigator.geolocation.getCurrentPosition(async (position) => {
    try {
      const { latitude, longitude } = position.coords;
      const [uv, locationLabel] = await Promise.all([
        fetchUv(latitude, longitude),
        reverseGeocode(latitude, longitude)
      ]);
      renderUvCard(uv, locationLabel);
    } catch (error) {
      $('uvAlert').textContent = 'Could not load live UV right now. Keep the UI and swap in cached demo data if needed.';
      console.error(error);
    }
  }, () => {
    $('uvAlert').textContent = 'Location access was denied. For class demo, allow location or hardcode Melbourne as fallback.';
  });
}

function drawLineChart(canvasId, data, options) {
  const canvas = $(canvasId);
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const width = rect.width * dpr;
  const height = canvas.height * dpr;
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  const w = rect.width;
  const h = canvas.height / dpr;
  const padding = { top: 24, right: 18, bottom: 32, left: 44 };
  const innerW = w - padding.left - padding.right;
  const innerH = h - padding.top - padding.bottom;
  const minY = Math.min(...data.map(d => d.value));
  const maxY = Math.max(...data.map(d => d.value));

  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 4; i++) {
    const y = padding.top + (innerH / 3) * i;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(w - padding.right, y);
    ctx.stroke();
  }

  ctx.beginPath();
  data.forEach((point, index) => {
    const x = padding.left + (innerW / (data.length - 1)) * index;
    const y = padding.top + innerH - ((point.value - minY) / (maxY - minY || 1)) * innerH;
    if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = options.color;
  ctx.lineWidth = 3;
  ctx.stroke();

  data.forEach((point, index) => {
    const x = padding.left + (innerW / (data.length - 1)) * index;
    const y = padding.top + innerH - ((point.value - minY) / (maxY - minY || 1)) * innerH;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x, y, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = options.color;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#475569';
    ctx.font = '12px Inter';
    ctx.textAlign = 'center';
    ctx.fillText(String(point.year), x, h - 10);
  });

  ctx.fillStyle = '#334155';
  ctx.font = '12px Inter';
  ctx.textAlign = 'left';
  ctx.fillText(options.labelTop, 8, 16);
  ctx.fillText(options.labelBottom, 8, h - 12);
}

function boot() {
  drawLineChart('cancerChart', window.SUN_DATA.cancerTrend, {
    color: '#ef4444',
    labelTop: 'Estimated cases',
    labelBottom: 'Year'
  });

  drawLineChart('heatChart', window.SUN_DATA.heatTrend, {
    color: '#f97316',
    labelTop: 'Temp anomaly (°C)',
    labelBottom: 'Year'
  });

  updateClothing('moderate');
  $('locateBtn').addEventListener('click', useMyLocation);
}

window.addEventListener('resize', boot);
window.addEventListener('DOMContentLoaded', boot);
