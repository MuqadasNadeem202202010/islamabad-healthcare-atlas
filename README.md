# Islamabad Healthcare Atlas

Database-driven Web GIS application (Assignment No. 2, Web GIS Lab).

- **Student:** Muqadas Nadeem (FA23-BRG-051)
- **University:** COMSATS University Islamabad
- **Instructor:** Dr. Farooq Buzdar

A map of hospitals, clinics, pharmacies, laboratories and dispensaries in Islamabad and Rawalpindi.
Records are stored in PostgreSQL/PostGIS, served as GeoJSON by a Node.js + Express API,
and displayed on a Leaflet map. Users can search, filter, add and update records.
Each record shows whether it is **student-collected** or from a verified/official source.

## Tech stack
PostgreSQL + PostGIS, Node.js, Express, `pg`, Leaflet, vanilla JavaScript.

## Folder structure
```
Assignment_2/
├── sql/create_and_populate.sql
├── server/ (server.js, package.json)
├── public/ (index.html, style.css, app.js)
├── vercel.json
├── .env.example
└── README.md
```

## Setup
1. **Install** PostgreSQL with PostGIS, and Node.js.
2. **Create the database** in pgAdmin 4 named `healthcare_atlas`, then run
   `sql/create_and_populate.sql` (run `CREATE EXTENSION postgis;` first, then the
   statements one at a time if pgAdmin runs only one statement).
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
24+ records. Facility names are real places; coordinates were collected by the student and
are approximate, so they are marked **Student-collected** and unverified until checked.
Base map: OpenStreetMap contributors.

## Security
No passwords or secrets are stored in this repository. Database credentials and the admin
key are read from environment variables.