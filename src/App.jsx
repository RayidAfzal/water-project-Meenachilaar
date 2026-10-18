
import { useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Waves,
  Activity,
  Radio,
  RefreshCw,
  Database,
  Clock,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import "./App.css";

const SUPABASE_URL = "https://lkpeinbepwjcuxecqljp.supabase.co";
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const supabase = SUPABASE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_KEY)
  : null;

function formatTime(value) {
  return new Date(value).toLocaleString();
}

function MetricCard({ icon: Icon, label, value, unit, note, accent }) {
  return (
    <div className={`metric-card ${accent || ""}`}>
      <div className="metric-icon"><Icon size={24} /></div>
      <div className="metric-content">
        <p>{label}</p>
        <h2>{value} <span>{unit}</span></h2>
        <small>{note}</small>
      </div>
    </div>
  );
}

export default function App() {
  const [readings, setReadings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastChecked, setLastChecked] = useState(null);

  async function fetchReadings() {
    if (!supabase) {
      setError("Add your Supabase publishable key to the .env file.");
      setLoading(false);
      return;
    }

    const { data, error: queryError } = await supabase
      .from("water_readings")
      .select(
        "id, recorded_at, device_id, sensor_1_cm, sensor_2_cm, water_level_cm, sensor_1_valid, sensor_2_valid"
      )
      .order("recorded_at", { ascending: false })
      .limit(500);

    if (queryError) {
      setError(queryError.message);
    } else {
      setReadings(data || []);
      setError("");
      setLastChecked(new Date());
    }

    setLoading(false);
  }

  useEffect(() => {
    fetchReadings();
    const timer = setInterval(fetchReadings, 15000);
    return () => clearInterval(timer);
  }, []);

  const latest = readings[0];
  const chartData = [...readings].reverse().map((r) => ({
    time: new Date(r.recorded_at).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
    level: Number(r.water_level_cm),
  }));

  const online =
    latest &&
    Date.now() - new Date(latest.recorded_at).getTime() < 120000;

  return (
    <main className="dashboard">
      <header className="topbar">
        <div className="brand">
          <div className="brand-icon"><Waves size={30} /></div>
          <div>
            <h1>Meenachilaar Monitor</h1>
            <p>Water level monitoring system</p>
          </div>
        </div>

        <div className="top-actions">
          <span className={`status-pill ${online ? "online" : ""}`}>
            <span className="status-dot" />
            {online ? "LIVE" : "NO RECENT DATA"}
          </span>
          <button className="refresh-button" onClick={fetchReadings}>
            <RefreshCw size={16} /> Refresh
          </button>
        </div>
      </header>

      {error && (
        <div className="notice error">
          <AlertTriangle size={18} />
          <div><strong>Could not load readings</strong><p>{error}</p></div>
        </div>
      )}

      {!error && !loading && !latest && (
        <div className="notice">
          No readings yet. Once the ESP32 uploads data, it will appear here.
        </div>
      )}

      <section className="metrics-grid">
        <MetricCard
          icon={Waves}
          label="Current Water Level"
          value={latest ? Number(latest.water_level_cm).toFixed(1) : "—"}
          unit="cm"
          note="Latest recorded measurement"
          accent="primary"
        />
        <MetricCard
          icon={Activity}
          label="Sensor 1 Distance"
          value={latest?.sensor_1_cm != null ? Number(latest.sensor_1_cm).toFixed(1) : "—"}
          unit="cm"
          note={latest?.sensor_1_valid ? "Sensor functioning" : "Invalid / unavailable"}
        />
        <MetricCard
          icon={Radio}
          label="Sensor 2 Distance"
          value={latest?.sensor_2_cm != null ? Number(latest.sensor_2_cm).toFixed(1) : "—"}
          unit="cm"
          note={latest?.sensor_2_valid ? "Sensor functioning" : "Invalid / unavailable"}
        />
        <MetricCard
          icon={Database}
          label="Stored Readings"
          value={readings.length}
          unit=""
          note="Most recent 500 records"
        />
      </section>

      <section className="main-grid">
        <article className="panel chart-panel">
          <div className="panel-heading">
            <div><Activity size={20} /><h2>Water Level History</h2></div>
            <span>Last {chartData.length} readings</span>
          </div>

          <div className="chart">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="waterFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#22d3ee" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#203549" strokeDasharray="4 4" />
                  <XAxis dataKey="time" stroke="#8299ad" tick={{ fontSize: 11 }} />
                  <YAxis stroke="#8299ad" tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      background: "#102234",
                      border: "1px solid #29445b",
                      borderRadius: 10,
                    }}
                    formatter={(v) => [`${v} cm`, "Water level"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="level"
                    stroke="#22d3ee"
                    strokeWidth={2.5}
                    fill="url(#waterFill)"
                    connectNulls={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty-chart">
                {loading ? "Loading readings…" : "Your water-level history will appear here"}
              </div>
            )}
          </div>
          <p className="panel-footnote">
            <Clock size={14} /> Times shown in your browser's local timezone.
          </p>
        </article>

        <article className="panel level-panel">
          <div className="panel-heading">
            <div><Waves size={20} /><h2>Latest Reading</h2></div>
          </div>
          {latest ? (
            <div className="level-content">
              <div className="water-gauge">
                <div className="gauge-fill" style={{
                  height: `${Math.max(0, Math.min(100, Number(latest.water_level_cm)))}%`
                }} />
              </div>
              <div className="level-details">
                <span className="muted">Water level</span>
                <strong>{Number(latest.water_level_cm).toFixed(1)} cm</strong>
                <span className="muted">Device: {latest.device_id}</span>
                <div className="sensor-check">
                  {latest.sensor_1_valid && latest.sensor_2_valid
                    ? <><CheckCircle2 size={17} /> Both sensors valid</>
                    : <><AlertTriangle size={17} /> Check sensor status</>}
                </div>
                <small>Recorded {formatTime(latest.recorded_at)}</small>
              </div>
            </div>
          ) : (
            <div className="empty-chart">Waiting for first reading</div>
          )}
        </article>
      </section>

      <section className="panel table-panel">
        <div className="panel-heading">
          <div><Database size={20} /><h2>Recent Readings</h2></div>
          <span>{readings.length} records loaded</span>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Device</th>
                <th>Sensor 1 (cm)</th>
                <th>Sensor 2 (cm)</th>
                <th>Water Level (cm)</th>
                <th>Sensor Status</th>
              </tr>
            </thead>
            <tbody>
              {readings.map((r) => (
                <tr key={r.id}>
                  <td>{formatTime(r.recorded_at)}</td>
                  <td>{r.device_id}</td>
                  <td>{r.sensor_1_cm ?? "—"}</td>
                  <td>{r.sensor_2_cm ?? "—"}</td>
                  <td className="level-value">
                    {Number(r.water_level_cm).toFixed(1)}
                  </td>
                  <td>
                    <span className={`table-status ${r.sensor_1_valid && r.sensor_2_valid ? "good" : "warning"}`}>
                      {r.sensor_1_valid && r.sensor_2_valid ? "Valid" : "Check sensors"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {lastChecked && (
          <p className="panel-footnote">
            <RefreshCw size={13} /> Last refreshed {lastChecked.toLocaleTimeString()}
            {" · "}Automatically refreshes every 15 seconds
          </p>
        )}
      </section>

      <footer>Meenachilaar Monitor <span>•</span> Cloud-connected water monitoring</footer>
    </main>
  );
}
