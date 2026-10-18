import { useEffect, useMemo, useState } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend,
} from "recharts";
import {
  Waves, Activity, Radio, RefreshCw, Database, Clock, CheckCircle2,
  AlertTriangle, Download, Wifi, Signal, TrendingUp, TrendingDown,
} from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import "./App.css";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://lkpeinbepwjcuxecqljp.supabase.co";
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const supabase = SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;
const PAGE_SIZE = 1000;
const ONLINE_MS = 60_000;
const OFFLINE_MS = 5 * 60_000;

function formatTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}
function fmt(value, digits = 1) {
  return value == null || !Number.isFinite(Number(value)) ? "—" : Number(value).toFixed(digits);
}
function relativeLabel(value) {
  if (value == null || !Number.isFinite(Number(value))) return "—";
  const n = Number(value);
  return `${n > 0 ? "+" : ""}${n.toFixed(1)} cm`;
}
function MetricCard({ icon: Icon, label, value, unit, note, accent }) {
  return <div className={`metric-card ${accent || ""}`}>
    <div className="metric-icon"><Icon size={24} /></div>
    <div className="metric-content"><p>{label}</p><h2>{value} <span>{unit}</span></h2><small>{note}</small></div>
  </div>;
}
function csvCell(value) {
  if (value == null) return "";
  const s = String(value);
  return /[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}
function downloadCsv(rows) {
  const headers = ["id", "recorded_at", "device_id", "sensor_1_cm", "sensor_1_valid", "sensor_1_baseline_cm", "sensor_1_change_cm", "sensor_2_cm", "sensor_2_valid", "sensor_2_baseline_cm", "sensor_2_change_cm", "water_level_cm"];
  const content = [headers.join(","), ...rows.map((r) => headers.map((h) => csvCell(r[h])).join(","))].join("\r\n");
  const blob = new Blob(["\uFEFF", content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `meenachilaar-readings-${new Date().toISOString().replaceAll(":", "-")}.csv`;
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

export default function App() {
  const [readings, setReadings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [lastChecked, setLastChecked] = useState(null);
  const [now, setNow] = useState(Date.now());

  async function fetchReadings() {
    if (!supabase) { setError("Add VITE_SUPABASE_PUBLISHABLE_KEY to your local/Vercel environment variables."); setLoading(false); return; }
    let all = [];
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error: queryError } = await supabase.from("water_readings")
        .select("id, recorded_at, device_id, sensor_1_cm, sensor_2_cm, water_level_cm, sensor_1_valid, sensor_2_valid, sensor_1_baseline_cm, sensor_2_baseline_cm, sensor_1_change_cm, sensor_2_change_cm")
        .order("recorded_at", { ascending: false }).order("id", { ascending: false })
        .range(from, from + PAGE_SIZE - 1);
      if (queryError) { setError(queryError.message); setLoading(false); return; }
      all = all.concat(data || []);
      if (!data || data.length < PAGE_SIZE) break;
    }
    setReadings(all); setError(""); setLastChecked(new Date()); setLoading(false);
  }

  async function exportAll() {
    setExporting(true);
    try {
      if (!supabase) throw new Error("Supabase publishable key is not configured.");
      let all = [];
      for (let from = 0; ; from += PAGE_SIZE) {
        const { data, error: queryError } = await supabase.from("water_readings")
          .select("id, recorded_at, device_id, sensor_1_cm, sensor_2_cm, water_level_cm, sensor_1_valid, sensor_2_valid, sensor_1_baseline_cm, sensor_2_baseline_cm, sensor_1_change_cm, sensor_2_change_cm")
          .order("recorded_at", { ascending: false }).order("id", { ascending: false })
          .range(from, from + PAGE_SIZE - 1);
        if (queryError) throw queryError;
        all = all.concat(data || []);
        if (!data || data.length < PAGE_SIZE) break;
      }
      downloadCsv(all);
    } catch (e) { setError(`CSV export failed: ${e.message || e}`); }
    finally { setExporting(false); }
  }

  useEffect(() => {
    fetchReadings();
    const fetchTimer = setInterval(fetchReadings, 15000);
    const clockTimer = setInterval(() => setNow(Date.now()), 1000);
    return () => { clearInterval(fetchTimer); clearInterval(clockTimer); };
  }, []);

  const latest = readings[0];
  const ageMs = latest ? Math.max(0, now - new Date(latest.recorded_at).getTime()) : Infinity;
  const deviceState = !latest ? "No data" : ageMs < ONLINE_MS ? "Online" : ageMs < OFFLINE_MS ? "Stale" : "Offline";
  const chartData = useMemo(() => [...readings].reverse().map((r) => ({
    time: new Date(r.recorded_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    distance1: r.sensor_1_cm == null ? null : Number(r.sensor_1_cm),
    distance2: r.sensor_2_cm == null ? null : Number(r.sensor_2_cm),
    change1: r.sensor_1_change_cm == null ? null : Number(r.sensor_1_change_cm),
    change2: r.sensor_2_change_cm == null ? null : Number(r.sensor_2_change_cm),
  })), [readings]);

  return <main className="dashboard">
    <header className="topbar">
      <div className="brand"><div className="brand-icon"><Waves size={30} /></div><div><h1>Meenachilaar Monitor</h1><p>Water-level monitoring system</p></div></div>
      <div className="top-actions">
        <span className={`status-pill ${deviceState.toLowerCase().replace(" ", "-")}`}><span className="status-dot" />{deviceState.toUpperCase()}</span>
        <button className="refresh-button" onClick={fetchReadings}><RefreshCw size={16} /> Refresh</button>
        <button className="refresh-button download-button" onClick={exportAll} disabled={exporting}><Download size={16} /> {exporting ? "Preparing CSV…" : "Download all CSV"}</button>
      </div>
    </header>

    {error && <div className="notice error"><AlertTriangle size={18} /><div><strong>Dashboard notice</strong><p>{error}</p></div></div>}
    {!error && !loading && !latest && <div className="notice">No readings yet. Once the ESP32 uploads data, it will appear here.</div>}

    <section className="metrics-grid">
      <MetricCard icon={Clock} label="Last reading received" value={latest ? formatTime(latest.recorded_at) : "—"} unit="" note={latest ? `Received ${Math.floor(ageMs / 1000)} seconds ago` : "Waiting for first record"} accent="primary" />
      <MetricCard icon={Activity} label="Sensor 1 distance" value={latest?.sensor_1_valid ? fmt(latest.sensor_1_cm) : "No Echo"} unit={latest?.sensor_1_valid ? "cm" : ""} note={latest?.sensor_1_valid ? "Valid measurement" : "Invalid / unavailable"} />
      <MetricCard icon={Radio} label="Sensor 2 distance" value={latest?.sensor_2_valid ? fmt(latest.sensor_2_cm) : "No Echo"} unit={latest?.sensor_2_valid ? "cm" : ""} note={latest?.sensor_2_valid ? "Valid measurement" : "Invalid / unavailable"} />
      <MetricCard icon={Database} label="Stored readings" value={readings.length} unit="" note="All rows currently accessible" />
      <MetricCard icon={TrendingUp} label="Sensor 1 relative change" value={relativeLabel(latest?.sensor_1_change_cm)} unit="" note={latest?.sensor_1_baseline_cm != null ? `Baseline ${fmt(latest.sensor_1_baseline_cm)} cm` : "Baseline not recorded"} />
      <MetricCard icon={TrendingUp} label="Sensor 2 relative change" value={relativeLabel(latest?.sensor_2_change_cm)} unit="" note={latest?.sensor_2_baseline_cm != null ? `Baseline ${fmt(latest.sensor_2_baseline_cm)} cm` : "Baseline not recorded"} />
      <MetricCard icon={Waves} label="Relative level change" value={relativeLabel(latest?.water_level_cm)} unit="" note="Positive = rise · negative = fall" />
      <MetricCard icon={Signal} label="Record validity" value={latest ? `${Number(!!latest.sensor_1_valid) + Number(!!latest.sensor_2_valid)}/2` : "—"} unit="sensors" note="Valid sensors in latest record" />
    </section>

    <section className="status-strip panel">
      <div><Activity size={18} /><span><strong>Device status:</strong> {deviceState}</span></div>
      <div><Wifi size={18} /><span><strong>Last dashboard check:</strong> {lastChecked ? lastChecked.toLocaleTimeString() : "—"}</span></div>
      <div><Signal size={18} /><span><strong>GSM:</strong> Not reported by current database schema</span></div>
    </section>

    <section className="main-grid">
      <article className="panel chart-panel">
        <div className="panel-heading"><div><Activity size={20} /><h2>Sensor Distance History</h2></div><span>{chartData.length} points</span></div>
        <div className="chart">{chartData.length ? <ResponsiveContainer width="100%" height="100%"><LineChart data={chartData}><CartesianGrid stroke="#203549" strokeDasharray="4 4" /><XAxis dataKey="time" stroke="#8299ad" tick={{ fontSize: 11 }} /><YAxis stroke="#8299ad" tick={{ fontSize: 11 }} /><Tooltip contentStyle={{ background: "#102234", border: "1px solid #29445b", borderRadius: 10 }} /><Legend /><Line type="monotone" dataKey="distance1" name="Sensor 1 (cm)" stroke="#22d3ee" connectNulls={false} dot={false} /><Line type="monotone" dataKey="distance2" name="Sensor 2 (cm)" stroke="#a78bfa" connectNulls={false} dot={false} /></LineChart></ResponsiveContainer> : <div className="empty-chart">{loading ? "Loading readings…" : "Sensor history will appear here"}</div>}</div>
        <p className="panel-footnote"><Clock size={14} /> Times use your browser's local timezone.</p>
      </article>
      <article className="panel chart-panel">
        <div className="panel-heading"><div><Waves size={20} /><h2>Relative Water-Level Change</h2></div><span>Rise / fall from baseline</span></div>
        <div className="chart">{chartData.length ? <ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData}><defs><linearGradient id="changeFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#34d399" stopOpacity={0.3} /><stop offset="100%" stopColor="#34d399" stopOpacity={0.02} /></linearGradient></defs><CartesianGrid stroke="#203549" strokeDasharray="4 4" /><XAxis dataKey="time" stroke="#8299ad" tick={{ fontSize: 11 }} /><YAxis stroke="#8299ad" tick={{ fontSize: 11 }} /><Tooltip contentStyle={{ background: "#102234", border: "1px solid #29445b", borderRadius: 10 }} /><Legend /><Area type="monotone" dataKey="change1" name="Sensor 1 change (cm)" stroke="#34d399" fill="url(#changeFill)" connectNulls={false} /><Area type="monotone" dataKey="change2" name="Sensor 2 change (cm)" stroke="#fbbf24" fill="none" connectNulls={false} /></AreaChart></ResponsiveContainer> : <div className="empty-chart">Waiting for sensor data</div>}</div>
        <p className="panel-footnote"><TrendingUp size={14} /> Positive = water rose; negative = water fell.</p>
      </article>
    </section>

    <section className="panel table-panel">
      <div className="panel-heading"><div><Database size={20} /><h2>Reading History</h2></div><span>{readings.length} records loaded</span></div>
      <div className="table-wrap"><table><thead><tr><th>Time</th><th>Device</th><th>S1 distance</th><th>S1 baseline</th><th>S1 change</th><th>S1 status</th><th>S2 distance</th><th>S2 baseline</th><th>S2 change</th><th>S2 status</th><th>Relative level</th></tr></thead>
        <tbody>{readings.map((r) => <tr key={r.id}><td>{formatTime(r.recorded_at)}</td><td>{r.device_id || "—"}</td><td>{r.sensor_1_valid ? `${fmt(r.sensor_1_cm)} cm` : "No Echo"}</td><td>{r.sensor_1_baseline_cm == null ? "—" : `${fmt(r.sensor_1_baseline_cm)} cm`}</td><td className={Number(r.sensor_1_change_cm) >= 0 ? "level-value" : "fall-value"}>{relativeLabel(r.sensor_1_change_cm)}</td><td><span className={`table-status ${r.sensor_1_valid ? "good" : "warning"}`}>{r.sensor_1_valid ? "Valid" : "No Echo"}</span></td><td>{r.sensor_2_valid ? `${fmt(r.sensor_2_cm)} cm` : "No Echo"}</td><td>{r.sensor_2_baseline_cm == null ? "—" : `${fmt(r.sensor_2_baseline_cm)} cm`}</td><td className={Number(r.sensor_2_change_cm) >= 0 ? "level-value" : "fall-value"}>{relativeLabel(r.sensor_2_change_cm)}</td><td><span className={`table-status ${r.sensor_2_valid ? "good" : "warning"}`}>{r.sensor_2_valid ? "Valid" : "No Echo"}</span></td><td className="level-value">{relativeLabel(r.water_level_cm)}</td></tr>)}</tbody>
      </table></div>
      {lastChecked && <p className="panel-footnote"><RefreshCw size={13} /> Last refreshed {lastChecked.toLocaleTimeString()} · Automatically refreshes every 15 seconds. CSV exports all rows in batches.</p>}
    </section>
    <footer>Meenachilaar Monitor <span>•</span> Cloud-connected water monitoring</footer>
  </main>;
}
