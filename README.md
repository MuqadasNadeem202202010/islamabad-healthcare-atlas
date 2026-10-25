# Islamabad Healthcare Atlas

Database-driven Web GIS application (Assignment No. 2, Web GIS Lab).

- **Student:** Muqadas Nadeem (FA23-BRG-051)
- **University:** COMSATS University Islamabad
- **Instructor:** Dr. Farooq Buzdar
- **Live demo:** https://islamabad-healthcare-atlas.vercel.app

A map of hospitals, clinics, pharmacies, laboratories and dispensaries in Islamabad and Rawalpindi.
Records are stored in PostgreSQL/PostGIS, served as GeoJSON by a Node.js + Express API,
and displayed on a Leaflet map. Users can search, filter, add and update records.
Each record shows whether it is **student-collected** or from a verified/official source.

## Tech stack
PostgreSQL + PostGIS, Node.js, Express, `pg`, Leaflet, vanilla JavaScript.
Deployment: Vercel (app) and Neon (cloud PostgreSQL with PostGIS).

## Folder structure
```
Assignment_2/
├── sql/create_and_populate.sql
├── server/            (server.js, package.json, package-lock.json)
├── public/            (index.html, style.css, app.js)
├── api/index.js       (Vercel entry point)
├── package.json       (dependencies for Vercel)
├── vercel.json
├── .env.example
├── report.pdf
└── README.md
```

## Setup (local)
1. **Install** PostgreSQL with PostGIS, and Node.js.
2. **Create the database** in pgAdmin 4 named `healthcare_atlas`. Run
   `CREATE EXTENSION postgis;` first, then run `sql/create_and_populate.sql`
   (if pgAdmin runs only one statement at a time, run the statements one by one).
3. **Configure the connection:** copy `.env.example` to `.env` in the project root and
   put your own database password and admin key in it. Never commit `.env`.
4. **Install dependencies:**
   ```
   cd server
   npm install
   ```
5. **Run the app:**
   ```
   node server.js
   ```
   Open http://localhost:3000

## Deployment (Vercel + Neon)
1. Create a free Neon project, enable PostGIS (`CREATE EXTENSION postgis;`) and run
   `sql/create_and_populate.sql` in the Neon SQL Editor.
2. Push this repository to GitHub and import it in Vercel.
3. Add these environment variables in Vercel: `DATABASE_URL` (Neon connection string),
   `DB_SSL=true` and `ADMIN_KEY`.

## API
| Method | Route | Description |
|---|---|---|
| GET | `/api/facilities?type=&district=&source=&emergency=&q=` | GeoJSON of facilities (filters) |
| GET | `/api/stats` | Counts by type, district and source |
| GET | `/api/facilities/:id/updates` | Update history of a record |
| POST | `/api/facilities` | Add a record (needs `x-admin-key` header) |
| PUT | `/api/facilities/:id` | Update a record (needs `x-admin-key` header) |

## Features
- Live map from PostgreSQL/PostGIS data
- Search by name/sector; filter by type, district, data source and 24/7 emergency
- Add and update records through a form, with validation on client and server
- Update history stored in a second related table (`facility_updates`)
- Data persists in PostgreSQL after page refresh

## Data
24 records. Facility names are real places; coordinates were collected by the student and
are approximate, so they are marked **Student-collected** and unverified until checked.
Base map: OpenStreetMap contributors.

## Security
No passwords or secrets are stored in this repository. Database credentials and the admin
key are read from environment variables.