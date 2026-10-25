require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

// Islamabad + Rawalpindi area (south, west, north, east)
const BBOX = '33.50,72.90,33.80,73.20';
const QUERY = `[out:json][timeout:60];
(
  nwr["amenity"~"^(clinic|pharmacy|hospital|doctors)$"]["name"](${BBOX});
  nwr["healthcare"="laboratory"]["name"](${BBOX});
);
out center 400;`;

function mapType(t) {
  if (t.healthcare === 'laboratory') return 'laboratory';
  if (t.amenity === 'hospital') return 'hospital';
  if (t.amenity === 'pharmacy') return 'pharmacy';
  return 'clinic';
}

async function main() {
  console.log('Downloading data from OpenStreetMap...');
    const resp = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
      'User-Agent': 'IslamabadHealthcareAtlas/1.0 (COMSATS student project)',
    },
    body: 'data=' + encodeURIComponent(QUERY),
  });
  if (!resp.ok) throw new Error('Overpass error: ' + resp.status);
  const data = await resp.json();

  const items = data.elements
    .map((e) => {
      const lat = e.lat ?? e.center?.lat;
      const lng = e.lon ?? e.center?.lon;
      const t = e.tags || {};
      if (!lat || !lng || !t.name) return null;
      return {
        name: t.name.slice(0, 150),
        type: mapType(t),
        district: lat < 33.655 ? 'Rawalpindi' : 'Islamabad',
        sector: (t['addr:suburb'] || t['addr:street'] || '').slice(0, 40) || null,
        phone: (t.phone || t['contact:phone'] || '').slice(0, 30) || null,
        emergency: t.emergency === 'yes',
        lat,
        lng,
      };
    })
    .filter(Boolean);

  const limits = { hospital: 4, clinic: 10, pharmacy: 10, laboratory: 6 };
  const count = {};
  const selected = items.filter((i) => {
    count[i.type] = (count[i.type] || 0) + 1;
    return count[i.type] <= limits[i.type];
  });

  let added = 0;
  for (const i of selected) {
    const r = await pool.query(
      `INSERT INTO facilities (name, type, district, sector, ownership, emergency, phone, source, verified, geom)
       SELECT $1,$2,$3,$4,'private',$5,$6,'OpenStreetMap',TRUE, ST_SetSRID(ST_MakePoint($7,$8),4326)
       WHERE NOT EXISTS (SELECT 1 FROM facilities WHERE name = $1)`,
      [i.name, i.type, i.district, i.sector, i.emergency, i.phone, i.lng, i.lat]
    );
    added += r.rowCount;
  }
  console.log('Done. Added ' + added + ' new records from OpenStreetMap.');
  await pool.end();
}

main().catch((e) => {
  console.error('Import failed:', e.message);
  process.exit(1);
});