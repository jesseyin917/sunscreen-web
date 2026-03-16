window.SUN_DATA = {
  melanomaTrend: [
    { year: 1983, incidence: 3776, mortality: 623 },
    { year: 1986, incidence: 4702, mortality: 688 },
    { year: 1989, incidence: 5722, mortality: 782 },
    { year: 1992, incidence: 6562, mortality: 867 },
    { year: 1995, incidence: 7464, mortality: 935 },
    { year: 1998, incidence: 7978, mortality: 966 },
    { year: 2001, incidence: 8965, mortality: 1074 },
    { year: 2004, incidence: 9840, mortality: 1199 },
    { year: 2007, incidence: 10390, mortality: 1315 },
    { year: 2010, incidence: 11404, mortality: 1432 }
  ],
  heatTrend: [
    { year: 2011, anomaly: 0.0 },
    { year: 2012, anomaly: 0.24 },
    { year: 2013, anomaly: 1.33 },
    { year: 2014, anomaly: 1.04 },
    { year: 2015, anomaly: 0.94 },
    { year: 2016, anomaly: 0.99 },
    { year: 2017, anomaly: 1.06 },
    { year: 2018, anomaly: 1.12 },
    { year: 2019, anomaly: 1.52 },
    { year: 2020, anomaly: 1.15 }
  ],
  clothingByLevel: {
    low: [
      'A tee is fine for short outdoor trips, but bring sunglasses and backup sunscreen.',
      'If you will stay outside longer, add a lightweight overshirt.',
      'A hat still helps during midday sun.'
    ],
    moderate: [
      'Choose breathable long sleeves or a tighter-weave overshirt.',
      'Wear sunglasses and a bucket hat or wide-brim hat.',
      'Use SPF 50+ on exposed skin.'
    ],
    high: [
      'Go for UPF-rated clothing or tightly woven long sleeves.',
      'Pick a wide-brim hat that covers face, ears, and neck.',
      'Longer shorts or lightweight pants are safer for long outdoor time.',
      'Plan for shade breaks.'
    ],
    'very-high': [
      'Use long sleeves with strong coverage and breathable fabric.',
      'Pair a wide-brim hat with sunglasses and SPF 50+.',
      'Choose lighter full-leg coverage when possible.',
      'Avoid staying out in direct peak sun.'
    ],
    extreme: [
      'Maximum coverage is the move: long sleeves, long pants, wide-brim hat.',
      'Use SPF 50+, sunglasses, and frequent shade breaks.',
      'Keep outdoor time short where possible.',
      'Treat this like a real hazard, not just “nice weather”.'
    ]
  },
  sources: [
    'Australian Cancer Incidence and Mortality (data.gov.au / AIHW)',
    '2021 SoE Climate Annual mean temperature anomaly Australia (1910 to 2020) via data.gov.au',
    'Live UV data: Open-Meteo via FastAPI backend API'
  ]
};
