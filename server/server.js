require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json());

// ---------- Database connection ----------
const sslOn = process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false;
const pool = new Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL, ssl: sslOn }
    : {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        ssl: sslOn,
      }
);

const TYPES = ['hospital', 'clinic', 'pharmacy', 'laboratory', 'dispensary'];
const DISTRICTS = ['Islamabad', 'Rawalpindi'];
const OWNERSHIPS = ['public', 'private', 'semi-govt'];
const SOURCES = ['Student-collected', 'OpenStreetMap', 'Official'];

// ---------- Helpers ----------
function requireKey(req, res, next) {
  if (!process.env.ADMIN_KEY) {
    return res.status(500).json({ error: 'Server admin key is not configured.' });
  }
  if (req.get('x-admin-key') !== process.env.ADMIN_KEY) {
    return res.status(401).json({ error: 'Invalid or missing admin key.' });
  }
  next();
}

function validate(b) {
  const errors = [];
  const name = String(b.name || '').trim();
  if (name.length < 3 || name.length > 150) errors.push('Name must be 3 to 150 characters.');
  if (!TYPES.includes(b.type)) errors.push('Invalid facility type.');
  if (!DISTRICTS.includes(b.district)) errors.push('District must be Islamabad or Rawalpindi.');
  const ownership = b.ownership || 'private';
  if (!OWNERSHIPS.includes(ownership)) errors.push('Invalid ownership.');
  const source = b.source || 'Student-collected';
  if (!SOURCES.includes(source)) errors.push('Invalid source.');

  const lat = Number(b.lat);
  const lng = Number(b.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    errors.push('Latitude and longitude must be numbers.');
  } else if (lat < 33.4 || lat > 33.95 || lng < 72.8 || lng > 73.4) {
    errors.push('Location must be inside the Islamabad-Rawalpindi area.');
  }

  let beds = null;
  if (b.beds !== undefined && b.beds !== null && b.beds !== '') {
    beds = Number(b.beds);
    if (!Number.isInteger(beds) || beds < 0 || beds > 5000) {
      errors.push('Beds must be a whole number from 0 to 5000.');
    }
  }

  const phone = b.phone ? String(b.phone).trim() : null;
  if (phone && !/^[0-9+\-\s()]{6,30}$/.test(phone)) errors.push('Phone number format is invalid.');

  const sector = b.sector ? String(b.sector).trim().slice(0, 40) : null;

  return {
    errors,
    value: {
      name, type: b.type, district: b.district, sector, ownership,
      emergency: b.emergency === true || b.emergency === 'true',
      beds, phone, source,
      verified: b.verified === true || b.verified === 'true',
      lat, lng,
    },
  };
}

function toFeature(r) {
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
    properties: {
      id: r.id, name: r.name, type: r.type, district: r.district, sector: r.sector,
      ownership: r.ownership, emergency: r.emergency, beds: r.beds, phone: r.phone,
      source: r.source, verified: r.verified, updated_at: r.updated_at,
    },
  };
}

const SELECT_COLS = `id, name, type, district, sector, ownership, emergency, beds, phone,
  source, verified, updated_at, ST_X(geom) AS lng, ST_Y(geom) AS lat`;

// ---------- API routes ----------

// GET all facilities (filters: type, district, emergency, source, q)
app.get('/api/facilities', async (req, res) => {
  try {
    const { type, district, emergency, source, q } = req.query;
    const where = [];
    const params = [];
    if (type && TYPES.includes(type)) { params.push(type); where.push(`type = $${params.length}`); }
    if (district && DISTRICTS.includes(district)) { params.push(district); where.push(`district = $${params.length}`); }
    if (source && SOURCES.includes(source)) { params.push(source); where.push(`source = $${params.length}`); }
    if (emergency === 'true') where.push('emergency = TRUE');
    if (q && q.trim()) {
      params.push(`%${q.trim()}%`);
      where.push(`(name ILIKE $${params.length} OR sector ILIKE $${params.length})`);
    }
    const sql = `SELECT ${SELECT_COLS} FROM facilities
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY name`;
    const { rows } = await pool.query(sql, params);
    res.json({ type: 'FeatureCollection', features: rows.map(toFeature) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load facilities.' });
  }
});

// GET statistics
app.get('/api/stats', async (req, res) => {
  try {
    const [total, byType, byDistrict, bySource] = await Promise.all([
      pool.query('SELECT COUNT(*)::int AS n FROM facilities'),
      pool.query('SELECT type AS k, COUNT(*)::int AS n FROM facilities GROUP BY type ORDER BY n DESC'),
      pool.query('SELECT district AS k, COUNT(*)::int AS n FROM facilities GROUP BY district'),
      pool.query('SELECT source AS k, COUNT(*)::int AS n FROM facilities GROUP BY source'),
    ]);
    res.json({
      total: total.rows[0].n,
      byType: byType.rows,
      byDistrict: byDistrict.rows,
      bySource: bySource.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load statistics.' });
  }
});

// GET update history of one facility
app.get('/api/facilities/:id/updates', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id.' });
    const { rows } = await pool.query(
      `SELECT note, updated_by, updated_at FROM facility_updates
       WHERE facility_id = $1 ORDER BY updated_at DESC LIMIT 10`,
      [id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load history.' });
  }
});

// POST create a facility (needs admin key)
app.post('/api/facilities', requireKey, async (req, res) => {
  const { errors, value: v } = validate(req.body || {});
  if (errors.length) return res.status(400).json({ error: errors.join(' ') });
  try {
    const { rows } = await pool.query(
      `INSERT INTO facilities (name, type, district, sector, ownership, emergency, beds, phone, source, verified, geom)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, ST_SetSRID(ST_MakePoint($11,$12),4326))
       RETURNING id`,
      [v.name, v.type, v.district, v.sector, v.ownership, v.emergency, v.beds, v.phone, v.source, v.verified, v.lng, v.lat]
    );
    await pool.query(
      'INSERT INTO facility_updates (facility_id, note) VALUES ($1, $2)',
      [rows[0].id, 'Record created through the website form.']
    );
    res.status(201).json({ id: rows[0].id, message: 'Facility added.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not save the facility.' });
  }
});

// PUT update a facility (needs admin key)
app.put('/api/facilities/:id', requireKey, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id.' });
  const { errors, value: v } = validate(req.body || {});
  if (errors.length) return res.status(400).json({ error: errors.join(' ') });
  try {
    const r = await pool.query(
      `UPDATE facilities SET name=$1, type=$2, district=$3, sector=$4, ownership=$5, emergency=$6,
         beds=$7, phone=$8, source=$9, verified=$10,
         geom=ST_SetSRID(ST_MakePoint($11,$12),4326), updated_at=NOW()
       WHERE id=$13`,
      [v.name, v.type, v.district, v.sector, v.ownership, v.emergency, v.beds, v.phone, v.source, v.verified, v.lng, v.lat, id]
    );
    if (r.rowCount === 0) return res.status(404).json({ error: 'Facility not found.' });
    await pool.query(
      'INSERT INTO facility_updates (facility_id, note) VALUES ($1, $2)',
      [id, 'Record updated through the website form.']
    );
    res.json({ id, message: 'Facility updated.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not update the facility.' });
  }
});

// ---------- Website files ----------
app.use(express.static(path.join(__dirname, '..', 'public')));

// ---------- Start ----------
module.exports = app;
if (require.main === module) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`Server running on http://localhost:${port}`));
}