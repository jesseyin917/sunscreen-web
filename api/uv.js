module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const apiKey = process.env.OPENWEATHER_API_KEY;
  const lat = req.query.lat;
  const lon = req.query.lon;
  const label = req.query.label || null;

  if (!apiKey) {
    return res.status(500).json({ error: 'Missing OPENWEATHER_API_KEY environment variable' });
  }

  if (!lat || !lon) {
    return res.status(400).json({ error: 'lat and lon are required' });
  }

  const upstream = `https://api.openweathermap.org/data/3.0/onecall?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&units=metric&appid=${encodeURIComponent(apiKey)}`;

  try {
    const response = await fetch(upstream);
    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }

    if (!response.ok) {
      return res.status(response.status).json({
        error: 'OpenWeather request failed',
        details: data,
      });
    }

    return res.status(200).json({
      location: label,
      lat: Number(lat),
      lon: Number(lon),
      uvi: data?.current?.uvi ?? null,
      fetchedAt: data?.current?.dt ?? null,
      source: 'OpenWeather One Call 3.0 via serverless proxy',
    });
  } catch (error) {
    return res.status(500).json({ error: 'Proxy request failed', details: String(error) });
  }
};
