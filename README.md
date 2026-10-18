# Meenachilaar Monitor

React + Vite dashboard for the Meenachilaar water monitoring project.

## Environment variables

Set these in `.env.local` for local development and in Vercel Project Settings for deployment:

```env
VITE_SUPABASE_URL=https://lkpeinbepwjcuxecqljp.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
```

Use only the Supabase publishable key in frontend environment variables. Never put the Supabase secret/service-role key in the browser or ESP32 firmware.

## Required Supabase migration

Run `supabase-migration.sql` in the Supabase SQL Editor before deploying the updated dashboard. The Edge Function `ingest-water-reading` must also be updated to accept nullable sensor distances and `water_level_cm`, and insert `sensor_1_baseline_cm`, `sensor_2_baseline_cm`, `sensor_1_change_cm`, and `sensor_2_change_cm`. If the function has an explicit insert allowlist, add those fields to it. The frontend cannot store these fields on its own.

## Dashboard features

- Last received reading and an estimated online/stale/offline state
- Sensor distances, baseline distances, and relative rise/fall
- Separate sensor-distance and relative-change charts
- Recent history with `No Echo` for invalid measurements
- Download all accessible records as CSV, paginated in batches
- Automatic refresh every 15 seconds

The online state is inferred from the latest received record: online under 60 seconds, stale from 60 seconds to 5 minutes, offline after 5 minutes. It indicates data freshness, not guaranteed physical device health.

## Run locally

```bash
npm install
npm run dev
```
