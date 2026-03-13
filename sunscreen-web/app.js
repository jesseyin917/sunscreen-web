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
    low: `UV ${rounded} is low right now. Fine for short trips, but longer outdoor time still deserves sunglasses and sunscreen backup.`,
    moderate: `UV ${rounded} is already strong enough to matter. If you stay outside, protect exposed skin within about ${mins}–${mins + 10} minutes.`,
    high: `UV ${rounded} is high. Skin can start taking damage in around ${mins} minutes — shade, sunscreen, and a hat should happen now.`,
    'very-high': `UV ${rounded} is very high. Skin damage can begin in roughly ${mins} minutes — cover up and reduce direct exposure.`,
    extreme: `UV ${rounded} is extreme. Unprotected skin can burn fast, around ${mins} minutes or less — avoid peak sun where possible.`
  };
  return map[level.key];
}

function buildActionText(level) {
  const actions = {
    low: 'Short outdoor tasks are usually okay. If you will be out for a while, prep before noon.',
    moderate: 'Good time to add sunscreen, sunglasses, and a hat before walking outside.',
    high: 'Move outdoor activity earlier or later if you can. Shade + SPF 50+ + protective clothing together.',
    'very-high': 'This is genuinely risky Australian sun. Dress for protection, not just comfort.',
    extreme: 'Treat this as a hazard, not just weather. Keep outdoor time short and fully protected.'
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
  $('exposureText').textContent = `Estimated unprotected exposure time: around ${estimateMinutes(uv)} minutes in peak conditions for fair-to-medium skin.`;
  $('actionText').textContent = buildActionText(level);
  updateClothing(level.key);
}

function locationText(lat, lon) {
  return `Live reading near ${lat.toFixed(2)}, ${lon.toFixed(2)}`;
}

async function fetchUv(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=uv_index&timezone=auto`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch UV data');
  const data = await res.json();
  return data.current?.uv_index ?? 0;
}

async function loadUvFor(lat, lon, label) {
  const uv = await fetchUv(lat, lon);
  renderUvCard(uv, label || locationText(lat, lon));
}

async function useMyLocation() {
  $('uvAlert').textContent = 'Fetching live UV data…';
  if (!navigator.geolocation) {
    $('uvAlert').textContent = 'Geolocation is not supported in this browser. Use Chrome or Edge for the live demo.';
    return;
  }

  navigator.geolocation.getCurrentPosition(async (position) => {
    try {
      const { latitude, longitude } = position.coords;
      await loadUvFor(latitude, longitude, locationText(latitude, longitude));
    } catch (error) {
      $('uvAlert').textContent = 'Could not load live UV right now. The rest of the dashboard still uses real published datasets.';
      console.error(error);
    }
  }, async () => {
    $('uvAlert').textContent = 'Location access was denied. Loading Melbourne demo data instead…';
    try {
      await loadUvFor(-37.8136, 144.9631, 'Melbourne fallback');
    } catch (error) {
      console.error(error);
    }
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
  return { canvas, ctx, w: cssWidth, h: cssHeight };
}

function drawAxes(ctx, w, h, padding, rows = 4) {
  const innerH = h - padding.top - padding.bottom;
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.28)';
  ctx.lineWidth = 1;
  for (let i = 0; i < rows; i++) {
    const y = padding.top + (innerH / (rows - 1)) * i;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(w - padding.right, y);
    ctx.stroke();
  }
}

function drawMelanomaChart() {
  const { ctx, w, h } = setupCanvas('cancerChart');
  const data = window.SUN_DATA.melanomaTrend;
  const padding = { top: 24, right: 18, bottom: 34, left: 50 };
  const innerW = w - padding.left - padding.right;
  const innerH = h - padding.top - padding.bottom;
  const maxY = Math.max(...data.flatMap((d) => [d.incidence, d.mortality]));

  ctx.clearRect(0, 0, w, h);
  drawAxes(ctx, w, h, padding, 4);

  const series = [
    { key: 'incidence', color: '#ef4444', label: 'Incidence' },
    { key: 'mortality', color: '#7c3aed', label: 'Mortality' }
  ];

  series.forEach((seriesItem, sIndex) => {
    ctx.beginPath();
    data.forEach((point, index) => {
      const x = padding.left + (innerW / (data.length - 1)) * index;
      const y = padding.top + innerH - (point[seriesItem.key] / maxY) * innerH;
      if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = seriesItem.color;
    ctx.lineWidth = 3;
    ctx.stroke();

    data.forEach((point, index) => {
      const x = padding.left + (innerW / (data.length - 1)) * index;
      const y = padding.top + innerH - (point[seriesItem.key] / maxY) * innerH;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(x, y, 4.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = seriesItem.color;
      ctx.lineWidth = 2;
      ctx.stroke();
      if (sIndex === 0) {
        ctx.fillStyle = '#475569';
        ctx.font = '12px Inter';
        ctx.textAlign = 'center';
        ctx.fillText(String(point.year), x, h - 10);
      }
    });
  });

  ctx.font = '12px Inter';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#334155';
  ctx.fillText('Cases / deaths', 8, 16);
  ctx.fillText('Year', 8, h - 12);

  let legendX = w - 170;
  series.forEach((item, idx) => {
    const y = 16 + idx * 18;
    ctx.fillStyle = item.color;
    ctx.fillRect(legendX, y - 8, 12, 12);
    ctx.fillStyle = '#334155';
    ctx.fillText(item.label, legendX + 18, y + 2);
  });
}

function drawBehaviourChart() {
  const { ctx, w, h } = setupCanvas('heatChart');
  const sunscreen = window.SUN_DATA.behaviourByAge.sunscreenMostDays;
  const sunburn = window.SUN_DATA.behaviourByAge.sunburnLastWeek;
  const padding = { top: 24, right: 20, bottom: 56, left: 46 };
  const innerW = w - padding.left - padding.right;
  const innerH = h - padding.top - padding.bottom;
  const n = sunscreen.length;
  const groupW = innerW / n;
  const barW = Math.min(22, groupW * 0.28);
  const maxY = 50;

  ctx.clearRect(0, 0, w, h);
  drawAxes(ctx, w, h, padding, 6);

  sunscreen.forEach((point, index) => {
    const x0 = padding.left + index * groupW + groupW / 2;
    const sunscreenVal = point.value;
    const sunburnVal = sunburn[index]?.value || 0;
    const h1 = (sunscreenVal / maxY) * innerH;
    const h2 = (sunburnVal / maxY) * innerH;
    const y1 = padding.top + innerH - h1;
    const y2 = padding.top + innerH - h2;

    ctx.fillStyle = '#f97316';
    ctx.fillRect(x0 - barW - 3, y1, barW, h1);
    ctx.fillStyle = '#0ea5e9';
    ctx.fillRect(x0 + 3, y2, barW, h2);

    ctx.fillStyle = '#475569';
    ctx.font = '11px Inter';
    ctx.textAlign = 'center';
    const shortLabel = point.label.replace(' years', '').replace(' and over', '+');
    ctx.fillText(shortLabel, x0, h - 10);
  });

  ctx.font = '12px Inter';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#334155';
  ctx.fillText('Percent of people', 8, 16);
  ctx.fillText('Age group', 8, h - 12);

  const legend = [
    { label: 'Used SPF30+ on most days', color: '#f97316' },
    { label: 'Had sunburn last week', color: '#0ea5e9' }
  ];
  let legendX = w - 220;
  legend.forEach((item, idx) => {
    const y = 16 + idx * 18;
    ctx.fillStyle = item.color;
    ctx.fillRect(legendX, y - 8, 12, 12);
    ctx.fillStyle = '#334155';
    ctx.fillText(item.label, legendX + 18, y + 2);
  });
}

function renderSources() {
  const target = $('sourceList');
  if (!target) return;
  target.innerHTML = '';
  window.SUN_DATA.sources.forEach((item) => {
    const li = document.createElement('li');
    li.textContent = item;
    target.appendChild(li);
  });
}

function boot() {
  drawMelanomaChart();
  drawBehaviourChart();
  renderSources();
  updateClothing(state.level === 'neutral' ? 'moderate' : state.level);

  if (!state.listenersBound) {
    $('locateBtn').addEventListener('click', useMyLocation);
    state.listenersBound = true;
  }
}

window.addEventListener('resize', boot);
window.addEventListener('DOMContentLoaded', async () => {
  boot();
  try {
    await loadUvFor(-37.8136, 144.9631, 'Melbourne default');
  } catch (error) {
    console.error(error);
  }
});
