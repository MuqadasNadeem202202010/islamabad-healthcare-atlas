-- =====================================================
-- Islamabad Healthcare Atlas  |  create_and_populate.sql
-- Muqadas Nadeem | FA23-BRG-051 | COMSATS Islamabad
-- Course: Web GIS | Dr. Farooq Buzdar
-- =====================================================

CREATE EXTENSION IF NOT EXISTS postgis;

DROP TABLE IF EXISTS facility_updates;
DROP TABLE IF EXISTS facilities;

-- Main spatial table (point geometry)
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

CREATE INDEX idx_facilities_geom ON facilities USING GIST (geom);
CREATE INDEX idx_facilities_type ON facilities (type);
CREATE INDEX idx_facilities_district ON facilities (district);

-- Second related table: history log of changes
CREATE TABLE facility_updates (
    id           SERIAL PRIMARY KEY,
    facility_id  INTEGER NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
    note         TEXT NOT NULL,
    updated_by   VARCHAR(80) DEFAULT 'Muqadas Nadeem',
    updated_at   TIMESTAMP DEFAULT NOW()
);

-- Seed data (approximate coordinates, to be verified/refined on the map)
-- ST_MakePoint(longitude, latitude)
INSERT INTO facilities (name, type, district, sector, ownership, emergency, beds, source, geom) VALUES
('Pakistan Institute of Medical Sciences (PIMS)', 'hospital', 'Islamabad', 'G-8', 'public',    TRUE, 1500, 'Student-collected', ST_SetSRID(ST_MakePoint(73.0500, 33.7050), 4326)),
('Shifa International Hospital',                  'hospital', 'Islamabad', 'H-8', 'private',   TRUE, 500,  'Student-collected', ST_SetSRID(ST_MakePoint(73.0800, 33.6800), 4326)),
('Polyclinic Hospital',                           'hospital', 'Islamabad', 'G-6', 'public',    TRUE, 600,  'Student-collected', ST_SetSRID(ST_MakePoint(73.0750, 33.7150), 4326)),
('Capital Hospital (CDA)',                        'hospital', 'Islamabad', 'G-6', 'public',    TRUE, 200,  'Student-collected', ST_SetSRID(ST_MakePoint(73.0790, 33.7125), 4326)),
('Ali Medical Centre',                            'hospital', 'Islamabad', 'F-8', 'private',   TRUE, 150,  'Student-collected', ST_SetSRID(ST_MakePoint(73.0370, 33.7100), 4326)),
('Maroof International Hospital',                 'hospital', 'Islamabad', 'F-10','private',   TRUE, 250,  'Student-collected', ST_SetSRID(ST_MakePoint(73.0130, 33.6960), 4326)),
('Kulsum International Hospital',                 'hospital', 'Islamabad', 'Blue Area','private',TRUE,200, 'Student-collected', ST_SetSRID(ST_MakePoint(73.0640, 33.7170), 4326)),
('KRL Hospital',                                  'hospital', 'Islamabad', 'G-9', 'semi-govt', TRUE, 350,  'Student-collected', ST_SetSRID(ST_MakePoint(73.0350, 33.6930), 4326)),
('Combined Military Hospital (CMH) Rawalpindi',   'hospital', 'Rawalpindi','Saddar','semi-govt',TRUE, 1000, 'Student-collected', ST_SetSRID(ST_MakePoint(73.0580, 33.6010), 4326)),
('Holy Family Hospital',                          'hospital', 'Rawalpindi','Satellite Town','public',TRUE,900,'Student-collected', ST_SetSRID(ST_MakePoint(73.0640, 33.6370), 4326)),
('Benazir Bhutto Hospital',                       'hospital', 'Rawalpindi','Murree Road','public',TRUE,1000,'Student-collected', ST_SetSRID(ST_MakePoint(73.0620, 33.6290), 4326)),
('Rawalpindi Institute of Cardiology',            'hospital', 'Rawalpindi','Westridge','public', TRUE, 400, 'Student-collected', ST_SetSRID(ST_MakePoint(73.0450, 33.6060), 4326));

-- NOTE: Only 12 seed rows so far. The remaining 15+ clinics, pharmacies and
-- laboratories will be imported from OpenStreetMap (Overpass) in the next step.
-- Coordinates above are approximate; refine them from OSM / Google Maps.

INSERT INTO facility_updates (facility_id, note) VALUES
(1, 'Initial record created from student field survey.'),
(2, 'Initial record created from student field survey.');

-- Sample queries (assignment requirement: retrieve, filter, count, update)
-- SELECT id, name, type, district, ST_AsGeoJSON(geom) FROM facilities;
-- SELECT * FROM facilities WHERE type = 'hospital' AND emergency = TRUE;
-- SELECT district, type, COUNT(*) FROM facilities GROUP BY district, type;
-- UPDATE facilities SET beds = 520, updated_at = NOW() WHERE id = 2;