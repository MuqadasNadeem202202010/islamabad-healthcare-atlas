-- =====================================================
-- Islamabad Healthcare Atlas | create_and_populate.sql
-- Student : Muqadas Nadeem (FA23-BRG-051)
-- University: COMSATS University Islamabad
-- Course  : Web GIS | Instructor: Dr. Farooq Buzdar
-- =====================================================
-- How to run: create a database named healthcare_atlas, open the Query Tool,
-- then run this script. If your pgAdmin runs only one statement at a time,
-- select and run each statement separately, in the order given below.
-- Coordinates are WGS84 (EPSG:4326), stored as ST_MakePoint(longitude, latitude).

-- 1. Enable PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. Clean start
DROP TABLE IF EXISTS facility_updates;
DROP TABLE IF EXISTS facilities;

-- 3. Main spatial table (point geometry)
CREATE TABLE facilities (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(150) NOT NULL,
    type        VARCHAR(30)  NOT NULL
                CHECK (type IN ('hospital','clinic','pharmacy','laboratory','dispensary')),
    district    VARCHAR(30)  NOT NULL
                CHECK (district IN ('Islamabad','Rawalpindi')),
    sector      VARCHAR(40),
    ownership   VARCHAR(20)  NOT NULL DEFAULT 'private'
                CHECK (ownership IN ('public','private','semi-govt')),
    emergency   BOOLEAN      NOT NULL DEFAULT FALSE,
    beds        INTEGER      CHECK (beds IS NULL OR beds >= 0),
    phone       VARCHAR(30),
    source      VARCHAR(30)  NOT NULL DEFAULT 'Student-collected'
                CHECK (source IN ('Student-collected','OpenStreetMap','Official')),
    verified    BOOLEAN      NOT NULL DEFAULT FALSE,
    geom        GEOMETRY(Point, 4326) NOT NULL,
    created_at  TIMESTAMP DEFAULT NOW(),
    updated_at  TIMESTAMP DEFAULT NOW()
);

-- 4. Indexes (spatial + attribute filters)
CREATE INDEX idx_facilities_geom ON facilities USING GIST (geom);
CREATE INDEX idx_facilities_type ON facilities (type);
CREATE INDEX idx_facilities_district ON facilities (district);

-- 5. Second related table: history of changes
CREATE TABLE facility_updates (
    id           SERIAL PRIMARY KEY,
    facility_id  INTEGER NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
    note         TEXT NOT NULL,
    updated_by   VARCHAR(80) DEFAULT 'Muqadas Nadeem',
    updated_at   TIMESTAMP DEFAULT NOW()
);

-- 6. Sample data (24 records, student-collected, approximate coordinates)
INSERT INTO facilities (name, type, district, sector, ownership, emergency, beds, phone, source, verified, geom) VALUES
('Pakistan Institute of Medical Sciences (PIMS)', 'hospital', 'Islamabad', 'G-8', 'public', TRUE, 1500, NULL, 'Student-collected', FALSE, ST_SetSRID(ST_MakePoint(73.0500, 33.7050), 4326)),
('Shifa International Hospital', 'hospital', 'Islamabad', 'H-8', 'private', TRUE, 500, NULL, 'Student-collected', FALSE, ST_SetSRID(ST_MakePoint(73.0800, 33.6800), 4326)),
('Polyclinic Hospital', 'hospital', 'Islamabad', 'G-6', 'public', TRUE, 600, NULL, 'Student-collected', FALSE, ST_SetSRID(ST_MakePoint(73.0750, 33.7150), 4326)),
('Capital Hospital (CDA)', 'hospital', 'Islamabad', 'G-6', 'public', TRUE, 200, NULL, 'Student-collected', FALSE, ST_SetSRID(ST_MakePoint(73.0790, 33.7125), 4326)),
('Ali Medical Centre', 'hospital', 'Islamabad', 'F-8', 'private', TRUE, 150, NULL, 'Student-collected', FALSE, ST_SetSRID(ST_MakePoint(73.0370, 33.7100), 4326)),
('Maroof International Hospital', 'hospital', 'Islamabad', 'F-10', 'private', TRUE, 250, NULL, 'Student-collected', FALSE, ST_SetSRID(ST_MakePoint(73.0130, 33.6960), 4326)),
('Kulsum International Hospital', 'hospital', 'Islamabad', 'Blue Area', 'private', TRUE, 200, NULL, 'Student-collected', FALSE, ST_SetSRID(ST_MakePoint(73.0640, 33.7170), 4326)),
('KRL Hospital', 'hospital', 'Islamabad', 'G-9', 'semi-govt', TRUE, 350, NULL, 'Student-collected', FALSE, ST_SetSRID(ST_MakePoint(73.0350, 33.6930), 4326)),
('Combined Military Hospital (CMH) Rawalpindi', 'hospital', 'Rawalpindi', 'Saddar', 'semi-govt', TRUE, 1000, NULL, 'Student-collected', FALSE, ST_SetSRID(ST_MakePoint(73.0580, 33.6010), 4326)),
('Holy Family Hospital', 'hospital', 'Rawalpindi', 'Satellite Town', 'public', TRUE, 900, NULL, 'Student-collected', FALSE, ST_SetSRID(ST_MakePoint(73.0640, 33.6370), 4326)),
('Benazir Bhutto Hospital', 'hospital', 'Rawalpindi', 'Murree Road', 'public', TRUE, 1000, NULL, 'Student-collected', FALSE, ST_SetSRID(ST_MakePoint(73.0620, 33.6290), 4326)),
('Rawalpindi Institute of Cardiology', 'hospital', 'Rawalpindi', 'Westridge', 'public', TRUE, 400, NULL, 'Student-collected', FALSE, ST_SetSRID(ST_MakePoint(73.0450, 33.6060), 4326)),
('Fazal Din''s Pharma Plus (F-7)', 'pharmacy', 'Islamabad', 'F-7', 'private', FALSE, NULL, NULL, 'Student-collected', FALSE, ST_SetSRID(ST_MakePoint(73.0555, 33.7213), 4326)),
('Fazal Din''s Pharma Plus (F-6)', 'pharmacy', 'Islamabad', 'F-6', 'private', FALSE, NULL, NULL, 'Student-collected', FALSE, ST_SetSRID(ST_MakePoint(73.0790, 33.7290), 4326)),
('Fazal Din''s Pharma Plus (Saddar)', 'pharmacy', 'Rawalpindi', 'Saddar', 'private', FALSE, NULL, NULL, 'Student-collected', FALSE, ST_SetSRID(ST_MakePoint(73.0560, 33.5950), 4326)),
('Fazal Din''s Pharma Plus (G-9)', 'pharmacy', 'Islamabad', 'G-9', 'private', FALSE, NULL, NULL, 'Student-collected', FALSE, ST_SetSRID(ST_MakePoint(73.0380, 33.6940), 4326)),
('Chughtai Lab (F-7)', 'laboratory', 'Islamabad', 'F-7', 'private', FALSE, NULL, NULL, 'Student-collected', FALSE, ST_SetSRID(ST_MakePoint(73.0545, 33.7205), 4326)),
('Excel Labs (Blue Area)', 'laboratory', 'Islamabad', 'Blue Area', 'private', FALSE, NULL, NULL, 'Student-collected', FALSE, ST_SetSRID(ST_MakePoint(73.0600, 33.7150), 4326)),
('Islamabad Diagnostic Centre', 'laboratory', 'Islamabad', 'F-8', 'private', FALSE, NULL, NULL, 'Student-collected', FALSE, ST_SetSRID(ST_MakePoint(73.0390, 33.7090), 4326)),
('Chughtai Lab (Saddar)', 'laboratory', 'Rawalpindi', 'Saddar', 'private', FALSE, NULL, NULL, 'Student-collected', FALSE, ST_SetSRID(ST_MakePoint(73.0540, 33.5990), 4326)),
('CDA Dispensary (G-7)', 'dispensary', 'Islamabad', 'G-7', 'public', FALSE, NULL, NULL, 'Student-collected', FALSE, ST_SetSRID(ST_MakePoint(73.0650, 33.7120), 4326)),
('CDA Dispensary (I-8)', 'dispensary', 'Islamabad', 'I-8', 'public', FALSE, NULL, NULL, 'Student-collected', FALSE, ST_SetSRID(ST_MakePoint(73.0750, 33.6670), 4326)),
('Al-Shifa Trust Eye Hospital', 'hospital', 'Rawalpindi', 'Jhelum Road', 'private', TRUE, 300, NULL, 'Student-collected', FALSE, ST_SetSRID(ST_MakePoint(73.0700, 33.6125), 4326)),
('Fauji Foundation Hospital', 'hospital', 'Rawalpindi', 'Mall Road', 'semi-govt', TRUE, 500, NULL, 'Student-collected', FALSE, ST_SetSRID(ST_MakePoint(73.0430, 33.5940), 4326));

INSERT INTO facility_updates (facility_id, note) VALUES
(1, 'Initial record created from student field survey.'),
(2, 'Initial record created from student field survey.');

-- 7. Example queries (retrieve, filter, count, update)

-- Retrieve all facilities with coordinates
-- SELECT id, name, type, district, ST_X(geom) AS lng, ST_Y(geom) AS lat FROM facilities;

-- Filter: emergency hospitals in Islamabad
-- SELECT name, sector, beds FROM facilities
-- WHERE type = 'hospital' AND district = 'Islamabad' AND emergency = TRUE;

-- Count by district and type
-- SELECT district, type, COUNT(*) FROM facilities GROUP BY district, type ORDER BY district, type;

-- Spatial query: facilities within 3 km of PIMS
-- SELECT name, type FROM facilities
-- WHERE ST_DWithin(geom::geography, ST_SetSRID(ST_MakePoint(73.0500, 33.7050), 4326)::geography, 3000);

-- Update a record
-- UPDATE facilities SET beds = 520, updated_at = NOW() WHERE name = 'Shifa International Hospital';