"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import * as THREE from "three";
import { Search, MapPin, Navigation, Loader2, X, Eye, Smartphone, Telescope, Satellite, Clock, Sun as SunIcon, Moon as MoonIcon, Sparkles, Camera, ChevronDown, RotateCcw, Wifi, WifiOff, Crosshair } from "lucide-react";

// ============================================================
// ASTRONOMY ENGINE — real computed positions (low-precision
// orbital formulas, not full VSOP87, but genuine real-time math)
// ============================================================
const D2R = Math.PI / 180, R2D = 180 / Math.PI;
const mod360 = (d) => { let m = d % 360; if (m < 0) m += 360; return m; };
const mod180 = (d) => { let m = d % 360; if (m > 180) m -= 360; if (m < -180) m += 360; return m; };

const PLANETS = {
  mercury: { a: [0.38709927, 0.00000037], e: [0.20563593, 0.00001906], I: [7.00497902, -0.00594749], L: [252.25032350, 149472.67411175], peri: [77.45779628, 0.16047689], node: [48.33076593, -0.12534081] },
  venus:   { a: [0.72333566, 0.00000390], e: [0.00677672, -0.00004107], I: [3.39467605, -0.00078890], L: [181.97909950, 58517.81538729], peri: [131.60246718, 0.00268329], node: [76.67984255, -0.27769418] },
  earth:   { a: [1.00000261, 0.00000562], e: [0.01671123, -0.00004392], I: [-0.00001531, -0.01294668], L: [100.46457166, 35999.37244981], peri: [102.93768193, 0.32327364], node: [0, 0] },
  mars:    { a: [1.52371034, 0.00001847], e: [0.09339410, 0.00007882], I: [1.84969142, -0.00813131], L: [-4.55343205, 19140.30268499], peri: [-23.94362959, 0.44441088], node: [49.55953891, -0.29257343] },
  jupiter: { a: [5.20288700, -0.00011607], e: [0.04838624, -0.00013253], I: [1.30439695, -0.00183714], L: [34.39644051, 3034.74612775], peri: [14.72847983, 0.21252668], node: [100.47390909, 0.20469106] },
  saturn:  { a: [9.53667594, -0.00125060], e: [0.05386179, -0.00050991], I: [2.48599187, 0.00193609], L: [49.95424423, 1222.49362201], peri: [92.59887831, -0.41897216], node: [113.66242448, -0.28867794] },
  uranus:  { a: [19.18916464, -0.00196176], e: [0.04725744, -0.00004397], I: [0.77263783, -0.00242939], L: [313.23810451, 428.48202785], peri: [170.95427630, 0.40805281], node: [74.01692503, 0.04240589] },
  neptune: { a: [30.06992276, 0.00026291], e: [0.00859048, 0.00005105], I: [1.77004347, 0.00035372], L: [-55.12002969, 218.45945325], peri: [44.96476227, -0.32241464], node: [131.78422574, -0.00508664] },
};
const MEAN_MAG = { mercury: -0.4, venus: -4.4, mars: -0.5, jupiter: -2.2, saturn: 0.5, uranus: 5.7, neptune: 7.8 };
const MEAN_DIST = { mercury: 0.92, venus: 1.2, mars: 0.8, jupiter: 4.5, saturn: 8.5, uranus: 19, neptune: 29 };

function julianDate(date) { return date.getTime() / 86400000 + 2440587.5; }
function centuriesT(jd) { return (jd - 2451545.0) / 36525; }
function obliquity(T) { return 23.439291 - 0.0130042 * T; }

function heliocentric(key, T) {
  const el = PLANETS[key];
  const a = el.a[0] + el.a[1] * T, e = el.e[0] + el.e[1] * T, I = el.I[0] + el.I[1] * T;
  const L = el.L[0] + el.L[1] * T, peri = el.peri[0] + el.peri[1] * T, node = el.node[0] + el.node[1] * T;
  const omega = peri - node;
  const M = mod180(L - peri);
  let E = M * D2R;
  for (let i = 0; i < 10; i++) E = E - (E - e * Math.sin(E) - M * D2R) / (1 - e * Math.cos(E));
  const xo = a * (Math.cos(E) - e), yo = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const cO = Math.cos(node * D2R), sO = Math.sin(node * D2R), cI = Math.cos(I * D2R), sI = Math.sin(I * D2R), cW = Math.cos(omega * D2R), sW = Math.sin(omega * D2R);
  const x = (cO * cW - sO * sW * cI) * xo + (-cO * sW - sO * cW * cI) * yo;
  const y = (sO * cW + cO * sW * cI) * xo + (-sO * sW + cO * cW * cI) * yo;
  const z = (sW * sI) * xo + (cW * sI) * yo;
  return { x, y, z };
}
function eclToEq(x, y, z, T) {
  const eps = obliquity(T) * D2R;
  const xe = x, ye = y * Math.cos(eps) - z * Math.sin(eps), ze = y * Math.sin(eps) + z * Math.cos(eps);
  const r = Math.sqrt(xe * xe + ye * ye + ze * ze);
  let ra = Math.atan2(ye, xe) * R2D; if (ra < 0) ra += 360;
  const dec = Math.asin(ze / r) * R2D;
  return { ra, dec, dist: r };
}
function planetEq(key, T) {
  const eH = heliocentric("earth", T), pH = heliocentric(key, T);
  return eclToEq(pH.x - eH.x, pH.y - eH.y, pH.z - eH.z, T);
}
function sunEq(T) {
  const eH = heliocentric("earth", T);
  return eclToEq(-eH.x, -eH.y, -eH.z, T);
}
function moonEq(T) {
  const D = mod360(297.8501921 + 445267.1114034 * T) * D2R;
  const M = mod360(357.5291092 + 35999.0502909 * T) * D2R;
  const Mp = mod360(134.9633964 + 477198.8675055 * T) * D2R;
  const F = mod360(93.2720950 + 483202.0175233 * T) * D2R;
  const Lp = mod360(218.3164477 + 481267.88123421 * T);
  let lon = Lp + 6.289 * Math.sin(Mp) - 1.274 * Math.sin(2 * D - Mp) + 0.658 * Math.sin(2 * D) - 0.186 * Math.sin(M) - 0.059 * Math.sin(2 * D - 2 * Mp) - 0.057 * Math.sin(2 * D - M - Mp) + 0.053 * Math.sin(2 * D + Mp) + 0.046 * Math.sin(2 * D - M) + 0.041 * Math.sin(Mp - M) - 0.035 * Math.sin(D) - 0.031 * Math.sin(Mp + M);
  let lat = 5.128 * Math.sin(F) + 0.281 * Math.sin(Mp + F) - 0.278 * Math.sin(F - Mp) - 0.173 * Math.sin(2 * D - F) + 0.055 * Math.sin(2 * D + F - Mp) + 0.046 * Math.sin(2 * D - F - Mp) + 0.033 * Math.sin(F + 2 * Mp) + 0.017 * Math.sin(2 * D + F);
  lon = mod360(lon);
  const lonr = lon * D2R, latr = lat * D2R, eps = obliquity(T) * D2R;
  let ra = Math.atan2(Math.sin(lonr) * Math.cos(eps) - Math.tan(latr) * Math.sin(eps), Math.cos(lonr)) * R2D;
  if (ra < 0) ra += 360;
  const dec = Math.asin(Math.sin(latr) * Math.cos(eps) + Math.cos(latr) * Math.sin(eps) * Math.sin(lonr)) * R2D;
  const illum = (1 - Math.cos(D)) / 2;
  return { ra, dec, illum };
}
function gmst(jd, T) { return mod360(280.46061837 + 360.98564736629 * (jd - 2451545.0) + 0.000387933 * T * T - (T * T * T) / 38710000); }
function altAz(ra, dec, lat, lon, jd, T) {
  const lst = mod360(gmst(jd, T) + lon);
  let H = mod360(lst - ra); if (H > 180) H -= 360;
  const Hr = H * D2R, latr = lat * D2R, decr = dec * D2R;
  const sinAlt = Math.sin(decr) * Math.sin(latr) + Math.cos(decr) * Math.cos(latr) * Math.cos(Hr);
  const alt = Math.asin(Math.min(1, Math.max(-1, sinAlt))) * R2D;
  const cosAz = (Math.sin(decr) - Math.sin(latr) * sinAlt) / (Math.cos(latr) * Math.cos(Math.asin(sinAlt)) || 1e-9);
  let az = Math.acos(Math.min(1, Math.max(-1, cosAz))) * R2D;
  if (Math.sin(Hr) > 0) az = 360 - az;
  return { alt, az };
}
function geodeticECEF(lat, lon, altKm) {
  const R = 6371, r = R + altKm, latr = lat * D2R, lonr = lon * D2R;
  return { x: r * Math.cos(latr) * Math.cos(lonr), y: r * Math.cos(latr) * Math.sin(lonr), z: r * Math.sin(latr) };
}
function topocentric(satECEF, obsLat, obsLon, obsECEF) {
  const dx = satECEF.x - obsECEF.x, dy = satECEF.y - obsECEF.y, dz = satECEF.z - obsECEF.z;
  const latr = obsLat * D2R, lonr = obsLon * D2R;
  const east = -Math.sin(lonr) * dx + Math.cos(lonr) * dy;
  const north = -Math.sin(latr) * Math.cos(lonr) * dx - Math.sin(latr) * Math.sin(lonr) * dy + Math.cos(latr) * dz;
  const up = Math.cos(latr) * Math.cos(lonr) * dx + Math.cos(latr) * Math.sin(lonr) * dy + Math.sin(latr) * dz;
  const range = Math.sqrt(east * east + north * north + up * up);
  const elevation = Math.asin(up / range) * R2D;
  let azimuth = Math.atan2(east, north) * R2D; if (azimuth < 0) azimuth += 360;
  return { elevation, azimuth, range };
}
function wrapLon(d) { let m = d % 360; if (m > 180) m -= 360; if (m < -180) m += 360; return m; }

const SAT_EPOCH_JD = julianDate(new Date("2025-01-01T00:00:00Z"));
const CURATED_SATS = [
  { name: "Tiangong (CSS)", altKm: 389, inc: 41.5, raan0: 45, u0: 0, periodMin: 92.7, mag: -1.0 },
  { name: "Hubble Space Telescope", altKm: 535, inc: 28.5, raan0: 120, u0: 90, periodMin: 95.4, mag: 2.0 },
  { name: "Starlink Train", altKm: 550, inc: 53.0, raan0: 200, u0: 200, periodMin: 95.6, mag: 3.5 },
];
function propagateCircular(sat, jd) {
  const dtMin = (jd - SAT_EPOCH_JD) * 1440;
  const u = mod360(sat.u0 + 360 * (dtMin / sat.periodMin));
  const R = 6371 + sat.altKm;
  const ur = u * D2R, ir = sat.inc * D2R, raanr = sat.raan0 * D2R;
  const xo = R * Math.cos(ur), yo = R * Math.sin(ur);
  const x1 = xo, y1 = yo * Math.cos(ir), z1 = yo * Math.sin(ir);
  const X = x1 * Math.cos(raanr) - y1 * Math.sin(raanr), Y = x1 * Math.sin(raanr) + y1 * Math.cos(raanr), Z = z1;
  const T = centuriesT(jd), gst = gmst(jd, T) * D2R;
  const xe = X * Math.cos(gst) + Y * Math.sin(gst), ye = -X * Math.sin(gst) + Y * Math.cos(gst), ze = Z;
  const lat = Math.asin(ze / R) * R2D, lon = wrapLon(Math.atan2(ye, xe) * R2D);
  return { lat, lon, altKm: sat.altKm, ecef: { x: xe, y: ye, z: ze } };
}

// ============================================================
// STATIC DATA
// ============================================================
const STARS = [
  { n: "Sirius", ra: 101.287, dec: -16.716, mag: -1.46 }, { n: "Canopus", ra: 95.988, dec: -52.696, mag: -0.74 },
  { n: "Alpha Centauri", ra: 219.902, dec: -60.834, mag: -0.27 }, { n: "Arcturus", ra: 213.915, dec: 19.182, mag: -0.05 },
  { n: "Vega", ra: 279.234, dec: 38.784, mag: 0.03 }, { n: "Capella", ra: 79.172, dec: 45.998, mag: 0.08 },
  { n: "Rigel", ra: 78.634, dec: -8.202, mag: 0.13 }, { n: "Procyon", ra: 114.825, dec: 5.225, mag: 0.34 },
  { n: "Betelgeuse", ra: 88.793, dec: 7.407, mag: 0.50 }, { n: "Achernar", ra: 24.429, dec: -57.237, mag: 0.46 },
  { n: "Altair", ra: 297.696, dec: 8.868, mag: 0.76 }, { n: "Aldebaran", ra: 68.980, dec: 16.509, mag: 0.85 },
  { n: "Antares", ra: 247.352, dec: -26.432, mag: 0.96 }, { n: "Spica", ra: 201.298, dec: -11.161, mag: 0.97 },
  { n: "Pollux", ra: 116.329, dec: 28.026, mag: 1.14 }, { n: "Fomalhaut", ra: 344.413, dec: -29.622, mag: 1.16 },
  { n: "Deneb", ra: 310.358, dec: 45.280, mag: 1.25 }, { n: "Regulus", ra: 152.093, dec: 11.967, mag: 1.36 },
  { n: "Castor", ra: 113.650, dec: 31.888, mag: 1.58 }, { n: "Polaris", ra: 37.955, dec: 89.264, mag: 1.98 },
];
const CITIES = [
  { n: "New York, USA", lat: 40.7128, lon: -74.0060 }, { n: "Los Angeles, USA", lat: 34.0522, lon: -118.2437 },
  { n: "London, UK", lat: 51.5074, lon: -0.1278 }, { n: "Tokyo, Japan", lat: 35.6762, lon: 139.6503 },
  { n: "Mumbai, India", lat: 19.0760, lon: 72.8777 }, { n: "Sydney, Australia", lat: -33.8688, lon: 151.2093 },
  { n: "Cairo, Egypt", lat: 30.0444, lon: 31.2357 }, { n: "São Paulo, Brazil", lat: -23.5505, lon: -46.6333 },
  { n: "Moscow, Russia", lat: 55.7558, lon: 37.6173 }, { n: "Beijing, China", lat: 39.9042, lon: 116.4074 },
  { n: "Paris, France", lat: 48.8566, lon: 2.3522 }, { n: "Dubai, UAE", lat: 25.2048, lon: 55.2708 },
  { n: "Cape Town, South Africa", lat: -33.9249, lon: 18.4241 }, { n: "Reykjavik, Iceland", lat: 64.1466, lon: -21.9426 },
  { n: "Singapore", lat: 1.3521, lon: 103.8198 },
];
const LIGHT_POLLUTION = {
  urban: { label: "Urban", icon: "🏙️", limitMag: 4.0 },
  suburban: { label: "Suburban", icon: "🏘️", limitMag: 5.0 },
  rural: { label: "Rural", icon: "🌾", limitMag: 6.0 },
  darksky: { label: "Dark Sky", icon: "🏔️", limitMag: 6.8 },
};
const CAMERA_TIPS = ["Enable Night Mode (3–10 sec exposure)", "Tap the brightest point to set focus to infinity", "Set ISO to 800–1600 if your camera app allows manual control", "Rest your phone on something stable — a wall, railing, or mini tripod"];

function tierOf(mag, alt, effLimit) {
  if (alt < 0) return "below";
  if (mag <= effLimit) return "naked";
  if (mag <= effLimit + 2.5) return "phone";
  return "telescope";
}
function tierMeta(tier) {
  switch (tier) {
    case "naked": return { icon: Eye, label: "Naked Eye Visible", color: "text-emerald-400", ring: "ring-emerald-400/40", bg: "bg-emerald-400/10" };
    case "phone": return { icon: Smartphone, label: "Phone Camera Visible", color: "text-cyan-400", ring: "ring-cyan-400/40", bg: "bg-cyan-400/10" };
    case "telescope": return { icon: Telescope, label: "Telescope Only", color: "text-purple-400", ring: "ring-purple-400/40", bg: "bg-purple-400/10" };
    default: return { icon: Eye, label: "Below Horizon", color: "text-gray-500", ring: "ring-gray-600/30", bg: "bg-gray-800/40" };
  }
}

// ============================================================
// MAIN COMPONENT
// ============================================================
export default function ZenithApp() {
  const [observer, setObserver] = useState({ lat: 40.7128, lon: -74.0060, name: "New York, USA", source: "default" });
  const [geoStatus, setGeoStatus] = useState("locating");
  const [timeOffsetH, setTimeOffsetH] = useState(0);
  const [lightPoll, setLightPoll] = useState("suburban");
  const [now, setNow] = useState(new Date());
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [iss, setIss] = useState({ status: "loading" });
  const [sats, setSats] = useState({ status: "loading", live: false, list: [] });
  const [modalObj, setModalObj] = useState(null);
  const [showLocOverlay, setShowLocOverlay] = useState(true);
  const [locMessage, setLocMessage] = useState(null);
  const [liveTracking, setLiveTracking] = useState(false);

  const mountRef = useRef(null);
  const threeRef = useRef({});
  const searchDebounce = useRef(null);

  // live clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const effectiveTime = useMemo(() => new Date(now.getTime() + timeOffsetH * 3600000), [now, timeOffsetH]);

  // ---- Reverse geocoding: parse structured address (city/state/country) ----
  const reverseGeocode = useCallback(async (lat, lon) => {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 7000);
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1`, { signal: ctrl.signal });
      clearTimeout(t);
      const data = await res.json();
      const addr = data.address || {};
      const city = addr.city || addr.town || addr.village || addr.county || addr.suburb || addr.hamlet;
      const state = addr.state || addr.region;
      const country = addr.country;
      const parts = [city, state, country].filter(Boolean);
      const name = parts.length ? parts.join(", ") : (data.display_name ? data.display_name.split(",").slice(0, 2).join(",").trim() : null);
      if (name) setObserver((o) => ({ ...o, name }));
    } catch (e) { /* keep coordinate fallback already shown */ }
  }, []);

  // ---- Exact location detection on page load ----
  useEffect(() => {
    if (!navigator.geolocation) {
      setGeoStatus("unavailable");
      setShowLocOverlay(false);
      setLocMessage("Geolocation isn't supported here — click on the globe or use the search bar to explore");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setObserver({ lat: latitude, lon: longitude, name: `${latitude.toFixed(3)}°, ${longitude.toFixed(3)}°`, source: "geo" });
        setGeoStatus("granted");
        setShowLocOverlay(false);
        reverseGeocode(latitude, longitude);
      },
      (err) => {
        setGeoStatus("denied");
        setShowLocOverlay(false);
        setLocMessage(err && err.code === 1 ? "Location access denied — click on the globe or use the search bar to explore" : "Couldn't detect your location — click on the globe or use the search bar to explore");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, [reverseGeocode]);

  // ---- Optional continuous tracking ----
  useEffect(() => {
    if (!liveTracking || !navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setObserver((o) => (o.source === "geo" || o.source === "geo-live") ? { ...o, lat: latitude, lon: longitude, source: "geo-live" } : o);
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [liveTracking]);

  // ISS polling
  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 6000);
        const res = await fetch("https://api.wheretheiss.at/v1/satellites/25544", { signal: ctrl.signal });
        clearTimeout(t);
        const data = await res.json();
        if (!cancelled) setIss({ status: "live", lat: data.latitude, lon: data.longitude, altKm: data.altitude, vel: data.velocity });
      } catch (e) {
        if (!cancelled) setIss((prev) => prev.status === "live" ? prev : { status: "unavailable" });
      }
    };
    poll();
    const t = setInterval(poll, 8000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  // Satellite live fetch (best-effort), fallback to curated
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 5000);
        const res = await fetch("https://celestrak.org/NORAD/elements/gp.php?GROUP=stations&FORMAT=json", { signal: ctrl.signal });
        clearTimeout(t);
        if (!res.ok) throw new Error("bad response");
        const data = await res.json();
        if (!cancelled && Array.isArray(data) && data.length) {
          const GM = 398600.4418;
          const parsed = data.filter((s) => s.NORAD_CAT_ID !== 25544).slice(0, 3).map((s) => {
            const n = parseFloat(s.MEAN_MOTION) * 2 * Math.PI / 86400;
            const a = Math.cbrt(GM / (n * n));
            return { name: s.OBJECT_NAME || "Satellite", altKm: a - 6371, inc: parseFloat(s.INCLINATION), raan0: parseFloat(s.RA_OF_ASC_NODE), u0: parseFloat(s.MEAN_ANOMALY), periodMin: 1440 / parseFloat(s.MEAN_MOTION), mag: 3.5 };
          });
          setSats({ status: "ready", live: true, list: parsed });
        } else throw new Error("empty");
      } catch (e) {
        if (!cancelled) setSats({ status: "ready", live: false, list: CURATED_SATS });
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // search (debounced)
  useEffect(() => {
    if (!searchQ || searchQ.length < 3) { setSearchResults([]); return; }
    clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 6000);
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQ)}&limit=5`, { signal: ctrl.signal });
        clearTimeout(t);
        const data = await res.json();
        setSearchResults(data.map((d) => ({ name: d.display_name.split(",").slice(0, 3).join(","), lat: parseFloat(d.lat), lon: parseFloat(d.lon) })));
      } catch (e) { setSearchResults([]); }
      setSearchLoading(false);
    }, 600);
  }, [searchQ]);

  // ===== ASTRONOMY: compute all objects =====
  const objects = useMemo(() => {
    const jd = julianDate(effectiveTime), T = centuriesT(jd);
    const sun = sunEq(T);
    const sunAA = altAz(sun.ra, sun.dec, observer.lat, observer.lon, jd, T);
    const sunAlt = sunAA.alt;

    let skyState, factor;
    if (sunAlt > 0) { skyState = "Daytime"; factor = 0; }
    else if (sunAlt > -18) { skyState = "Twilight"; factor = Math.min(1, -sunAlt / 18); }
    else { skyState = "Night"; factor = 1; }
    const baseline = LIGHT_POLLUTION[lightPoll].limitMag;
    const effLimit = baseline * factor + -5 * (1 - factor);

    const list = [];

    const moon = moonEq(T);
    const moonAA = altAz(moon.ra, moon.dec, observer.lat, observer.lon, jd, T);
    const moonMag = -12.7 + 2.5 * Math.log10(1 / Math.max(moon.illum, 0.01));
    list.push({ id: "moon", name: "The Moon", kind: "moon", mag: Math.min(moonMag, -1), alt: moonAA.alt, az: moonAA.az, illumPct: Math.round(moon.illum * 100), tier: tierOf(Math.min(moonMag, -1), moonAA.alt, effLimit) });

    Object.keys(MEAN_MAG).forEach((key) => {
      const p = planetEq(key, T);
      const aa = altAz(p.ra, p.dec, observer.lat, observer.lon, jd, T);
      const mag = MEAN_MAG[key] + 5 * Math.log10(p.dist / MEAN_DIST[key]);
      list.push({ id: key, name: key[0].toUpperCase() + key.slice(1), kind: "planet", mag, alt: aa.alt, az: aa.az, tier: tierOf(mag, aa.alt, effLimit) });
    });

    STARS.forEach((s) => {
      const aa = altAz(s.ra, s.dec, observer.lat, observer.lon, jd, T);
      list.push({ id: "star-" + s.n, name: s.n, kind: "star", mag: s.mag, alt: aa.alt, az: aa.az, tier: tierOf(s.mag, aa.alt, effLimit) });
    });

    if (iss.status === "live") {
      const satE = geodeticECEF(iss.lat, iss.lon, iss.altKm);
      const obsE = geodeticECEF(observer.lat, observer.lon, 0);
      const topo = topocentric(satE, observer.lat, observer.lon, obsE);
      let issMag = null, issNote = "";
      if (sunAlt > 6) { issNote = "Daytime — not visible"; }
      else if (sunAlt < -18) { issNote = "Likely in Earth's shadow"; }
      else { issMag = -2.5; }
      list.push({ id: "iss", name: "ISS — International Space Station", kind: "satellite", mag: issMag ?? 10, alt: topo.elevation, az: topo.azimuth, tier: issMag !== null ? tierOf(issMag, topo.elevation, effLimit) : "below", note: issNote, live: true, rangeKm: Math.round(topo.range) });
    }

    if (sats.status === "ready") {
      sats.list.forEach((s, i) => {
        const sp = propagateCircular(s, jd);
        const obsE = geodeticECEF(observer.lat, observer.lon, 0);
        const topo = topocentric(sp.ecef, observer.lat, observer.lon, obsE);
        let satNote = "", visMag = null;
        if (sunAlt > 6) satNote = "Daytime — not visible";
        else if (sunAlt < -18) satNote = "Likely in Earth's shadow";
        else visMag = s.mag;
        list.push({ id: "sat-" + i, name: s.name, kind: "satellite", mag: visMag ?? 10, alt: topo.elevation, az: topo.azimuth, tier: visMag !== null ? tierOf(visMag, topo.elevation, effLimit) : "below", note: satNote, live: sats.live });
      });
    }

    list.sort((a, b) => b.alt - a.alt);
    return { list, sunAlt, skyState, effLimit, baseline };
  }, [effectiveTime, observer, lightPoll, iss, sats]);

  // ===== THREE.JS GLOBE =====
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const width = mount.clientWidth, height = mount.clientHeight;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.z = 6.5;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0x6677aa, 1.2));
    const pLight = new THREE.PointLight(0x00d4ff, 1.5);
    pLight.position.set(5, 3, 5);
    scene.add(pLight);

    const globeGroup = new THREE.Group();
    scene.add(globeGroup);

    const sphereGeo = new THREE.SphereGeometry(2, 48, 48);
    const sphereMat = new THREE.MeshPhongMaterial({ color: 0x0a1a2f, shininess: 25, transparent: true, opacity: 0.96 });
    const sphereMesh = new THREE.Mesh(sphereGeo, sphereMat);
    globeGroup.add(sphereMesh);

    const wireGeo = new THREE.SphereGeometry(2.015, 24, 16);
    const wireMat = new THREE.MeshBasicMaterial({ color: 0x00d4ff, wireframe: true, transparent: true, opacity: 0.18 });
    globeGroup.add(new THREE.Mesh(wireGeo, wireMat));

    // starfield
    const starGeo = new THREE.BufferGeometry();
    const starCount = 600;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const r = 40 + Math.random() * 30;
      const th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
      starPos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      starPos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th);
      starPos[i * 3 + 2] = r * Math.cos(ph);
    }
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
    const starField = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.12, transparent: true, opacity: 0.7 }));
    scene.add(starField);

    function latLonToVec(lat, lon, r) {
      const phi = (90 - lat) * D2R, theta = (lon + 180) * D2R;
      return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
    }

    const obsMarker = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 16), new THREE.MeshBasicMaterial({ color: 0x8b5cf6 }));
    globeGroup.add(obsMarker);
    const obsRing = new THREE.Mesh(new THREE.RingGeometry(0.08, 0.12, 24), new THREE.MeshBasicMaterial({ color: 0x8b5cf6, transparent: true, opacity: 0.6, side: THREE.DoubleSide }));
    globeGroup.add(obsRing);

    const issMarker = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 12), new THREE.MeshBasicMaterial({ color: 0x00d4ff }));
    issMarker.visible = false;
    globeGroup.add(issMarker);

    threeRef.current = { scene, camera, renderer, globeGroup, sphereMesh, obsMarker, obsRing, issMarker, latLonToVec, mount, flyTarget: null };

    // Fly the globe so the given lat/lon faces the camera dead-on.
    // Closed-form solution for the two Euler angles (no roll introduced,
    // stays consistent with the drag-rotation interaction below).
    threeRef.current.flyToLatLon = (lat, lon) => {
      const dir = latLonToVec(lat, lon, 1);
      const rx = Math.atan2(dir.y, dir.z);
      const pz2 = Math.sqrt(dir.y * dir.y + dir.z * dir.z);
      const ry = Math.atan2(-dir.x, pz2);
      threeRef.current.flyTarget = { x: rx, y: ry };
    };

    // interaction
    let isDragging = false, dragMoved = false, lastX = 0, lastY = 0;
    const raycaster = new THREE.Raycaster();
    const onDown = (e) => { isDragging = true; dragMoved = false; lastX = e.clientX; lastY = e.clientY; threeRef.current.flyTarget = null; };
    const onMove = (e) => {
      if (!isDragging) return;
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) dragMoved = true;
      globeGroup.rotation.y += dx * 0.005;
      globeGroup.rotation.x = Math.max(-1.4, Math.min(1.4, globeGroup.rotation.x + dy * 0.005));
      lastX = e.clientX; lastY = e.clientY;
    };
    const onUp = (e) => {
      if (isDragging && !dragMoved) {
        const rect = renderer.domElement.getBoundingClientRect();
        const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
        raycaster.setFromCamera(ndc, camera);
        const hits = raycaster.intersectObject(sphereMesh);
        if (hits.length) {
          const local = globeGroup.worldToLocal(hits[0].point.clone());
          const r = local.length();
          const lat = 90 - Math.acos(local.y / r) * R2D;
          const lon = mod180(Math.atan2(local.z, -local.x) * R2D - 180);
          threeRef.current.onGlobeClick && threeRef.current.onGlobeClick(lat, lon);
        }
      }
      isDragging = false;
    };
    const onWheel = (e) => { e.preventDefault(); camera.position.z = Math.max(3.5, Math.min(12, camera.position.z + e.deltaY * 0.003)); };
    renderer.domElement.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    renderer.domElement.addEventListener("wheel", onWheel, { passive: false });

    let raf;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      const ft = threeRef.current.flyTarget;
      if (ft) {
        let dx = ft.x - globeGroup.rotation.x;
        let dy = ft.y - globeGroup.rotation.y;
        dy = ((dy + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
        globeGroup.rotation.x += dx * 0.07;
        globeGroup.rotation.y += dy * 0.07;
        if (Math.abs(dx) < 0.002 && Math.abs(dy) < 0.002) threeRef.current.flyTarget = null;
      } else if (!isDragging) {
        globeGroup.rotation.y += 0.0006;
      }
      renderer.render(scene, camera);
    };
    animate();

    const resizeObs = new ResizeObserver(() => {
      const w = mount.clientWidth, h = mount.clientHeight;
      camera.aspect = w / h; camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    resizeObs.observe(mount);

    return () => {
      cancelAnimationFrame(raf);
      resizeObs.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      renderer.domElement.removeEventListener("wheel", onWheel);
      sphereGeo.dispose(); sphereMat.dispose(); wireGeo.dispose(); wireMat.dispose(); starGeo.dispose();
      renderer.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    };
  }, []);

  // register click handler with latest setObserver
  useEffect(() => {
    threeRef.current.onGlobeClick = (lat, lon) => {
      setObserver({ lat, lon, name: `${lat.toFixed(2)}°, ${lon.toFixed(2)}°`, source: "globe" });
      reverseGeocode(lat, lon);
    };
  }, [reverseGeocode]);

  // update markers on observer/iss change
  useEffect(() => {
    const r = threeRef.current;
    if (!r.obsMarker) return;
    const pos = r.latLonToVec(observer.lat, observer.lon, 2.05);
    r.obsMarker.position.copy(pos);
    r.obsRing.position.copy(pos);
    r.obsRing.lookAt(pos.clone().multiplyScalar(2));
  }, [observer]);
  useEffect(() => {
    const r = threeRef.current;
    if (!r.issMarker) return;
    if (iss.status === "live") {
      r.issMarker.visible = true;
      r.issMarker.position.copy(r.latLonToVec(iss.lat, iss.lon, 2.1));
    } else r.issMarker.visible = false;
  }, [iss]);

  // fly the globe to face newly detected / searched / selected locations
  // (skip when the user just dragged-and-clicked the globe themselves,
  // and skip the initial default-city placeholder)
  useEffect(() => {
    if (observer.source === "globe" || observer.source === "default") return;
    if (!threeRef.current.flyToLatLon) return;
    threeRef.current.flyToLatLon(observer.lat, observer.lon);
  }, [observer.lat, observer.lon, observer.source]);

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) return;
    setGeoStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setObserver({ lat: latitude, lon: longitude, name: `${latitude.toFixed(3)}°, ${longitude.toFixed(3)}°`, source: "geo" });
        setGeoStatus("granted");
        setLocMessage(null);
        reverseGeocode(latitude, longitude);
      },
      () => { setGeoStatus("denied"); setLocMessage("Location access denied — click on the globe or use the search bar to explore"); },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const tryThisInfo = useCallback((obj) => {
    if (timeOffsetH !== 0) return { window: "Estimate only available when viewing live time (reset the time slider)." };
    const jdNow = julianDate(now), T0 = centuriesT(jdNow);
    let minutesVisible = null;
    for (let m = 0; m <= 180; m += 10) {
      const t = new Date(now.getTime() + m * 60000);
      const jd = julianDate(t), T = centuriesT(jd);
      let aa;
      if (obj.kind === "planet") aa = altAz(planetEq(obj.id, T).ra, planetEq(obj.id, T).dec, observer.lat, observer.lon, jd, T);
      else if (obj.kind === "moon") { const mo = moonEq(T); aa = altAz(mo.ra, mo.dec, observer.lat, observer.lon, jd, T); }
      else if (obj.kind === "star") { const s = STARS.find((x) => "star-" + x.n === obj.id); aa = altAz(s.ra, s.dec, observer.lat, observer.lon, jd, T); }
      else { minutesVisible = "a few"; break; }
      if (aa.alt < 5) { minutesVisible = m; break; }
    }
    return { window: minutesVisible === null ? "Visible for the next several hours" : minutesVisible === "a few" ? "Fast mover — check again shortly" : `~${minutesVisible} more minutes above a comfortable viewing angle` };
  }, [now, observer, timeOffsetH]);

  const visibleList = objects.list.filter((o) => o.alt > -3);
  const skyIcon = objects.sunAlt > 0 ? SunIcon : MoonIcon;

  return (
    <div className="w-full h-full min-h-[820px] bg-black text-gray-100 relative overflow-hidden rounded-lg" style={{ fontFamily: "system-ui, sans-serif" }}>
      <style>{`
        @keyframes zenithPulse { 0%,100%{opacity:.5} 50%{opacity:1} }
        .zenith-pulse { animation: zenithPulse 2s ease-in-out infinite; }
        @keyframes zenithFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
        .zenith-float { animation: zenithFloat 3s ease-in-out infinite; }
        .zenith-scroll::-webkit-scrollbar { width: 6px; }
        .zenith-scroll::-webkit-scrollbar-thumb { background: rgba(0,212,255,0.3); border-radius: 3px; }
      `}</style>

      {/* Globe */}
      <div ref={mountRef} className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Full-screen exact-location detection overlay (first load only) */}
      {showLocOverlay && (
        <div className="absolute inset-0 z-50 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center gap-3">
          <Crosshair className="w-10 h-10 text-cyan-400 animate-spin" style={{ animationDuration: "2s" }} />
          <div className="text-cyan-300 font-medium tracking-wide">Detecting your exact location…</div>
          <div className="text-xs text-gray-500">Using your device's GPS / network location</div>
        </div>
      )}

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 p-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between z-20 pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto bg-black/40 backdrop-blur-md border border-cyan-500/20 rounded-xl px-4 py-2">
          <Sparkles className="w-5 h-5 text-cyan-400 zenith-pulse" />
          <span className="font-bold text-lg tracking-wide bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">Celestial Eye</span>
        </div>

        <div className="relative w-full sm:w-80 pointer-events-auto">
          <div className="flex items-center gap-2 bg-black/50 backdrop-blur-md border border-cyan-500/20 rounded-xl px-3 py-2">
            <Search className="w-4 h-4 text-cyan-400 flex-shrink-0" />
            <input
              value={searchQ}
              onChange={(e) => { setSearchQ(e.target.value); setShowDropdown(true); }}
              onFocus={() => setShowDropdown(true)}
              placeholder="Search for a location..."
              className="bg-transparent outline-none text-sm w-full placeholder-gray-500"
            />
            {searchLoading && <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />}
          </div>
          {showDropdown && (
            <div className="absolute mt-2 w-full bg-black/80 backdrop-blur-md border border-cyan-500/20 rounded-xl overflow-hidden zenith-scroll max-h-72 overflow-y-auto">
              {searchResults.length > 0 && (
                <div>
                  <div className="px-3 py-1.5 text-xs text-gray-500 uppercase tracking-wide">Search results</div>
                  {searchResults.map((r, i) => (
                    <button key={i} onClick={() => { setObserver({ lat: r.lat, lon: r.lon, name: r.name, source: "search" }); setShowDropdown(false); setSearchQ(""); }} className="w-full text-left px-3 py-2 text-sm hover:bg-cyan-500/10 flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" /> <span className="truncate">{r.name}</span>
                    </button>
                  ))}
                </div>
              )}
              <div className="px-3 py-1.5 text-xs text-gray-500 uppercase tracking-wide border-t border-white/5">Major cities</div>
              {CITIES.map((c, i) => (
                <button key={i} onClick={() => { setObserver({ lat: c.lat, lon: c.lon, name: c.n, source: "city" }); setShowDropdown(false); }} className="w-full text-left px-3 py-2 text-sm hover:bg-cyan-500/10 flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" /> {c.n}
                </button>
              ))}
              <button onClick={() => setShowDropdown(false)} className="w-full text-center px-3 py-2 text-xs text-gray-500 hover:bg-white/5 border-t border-white/5">Close</button>
            </div>
          )}
        </div>

        <div className="flex gap-2 pointer-events-auto">
          <button onClick={() => setLiveTracking((v) => !v)} title="Continuously update your position" className={`flex items-center gap-1.5 backdrop-blur-md border rounded-xl px-3 py-2 text-xs transition-colors ${liveTracking ? "bg-emerald-500/20 border-emerald-400/50 text-emerald-300" : "bg-black/40 border-white/10 text-gray-400 hover:border-white/30"}`}>
            {liveTracking ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />} Live
          </button>
          <button onClick={handleUseMyLocation} className="flex items-center gap-2 bg-black/40 backdrop-blur-md border border-purple-500/30 hover:border-purple-400/60 rounded-xl px-3 py-2 text-sm transition-colors">
            <Navigation className="w-4 h-4 text-purple-400" />
            {geoStatus === "locating" ? "Locating…" : "Use My Location"}
          </button>
        </div>
      </div>

      {/* Friendly denied / unavailable message */}
      {locMessage && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 bg-black/75 backdrop-blur-md border border-purple-500/30 rounded-xl px-4 py-2.5 text-sm text-purple-200 flex items-center gap-3 max-w-[90%]">
          <span>{locMessage}</span>
          <button onClick={() => setLocMessage(null)} className="text-gray-500 hover:text-white flex-shrink-0"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Bottom-right panel */}
      <div className="absolute bottom-4 right-4 top-24 w-full sm:w-96 max-w-[calc(100%-2rem)] z-20 bg-black/55 backdrop-blur-md border border-cyan-500/20 rounded-2xl flex flex-col overflow-hidden">
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center gap-2 text-sm text-purple-300 mb-1">
            <MapPin className="w-4 h-4" /> <span className="truncate">{observer.name}</span>
            {observer.source === "geo" && <span className="text-[10px] text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded flex-shrink-0">Exact</span>}
            {observer.source === "geo-live" && <span className="text-[10px] text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded flex-shrink-0 zenith-pulse">Live</span>}
          </div>
          <div className="text-xs text-gray-500 mb-3">{observer.lat.toFixed(3)}°, {observer.lon.toFixed(3)}°</div>

          <div className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2">
            <div className="flex items-center gap-2 text-sm">
              {(() => { const Icon = skyIcon; return <Icon className="w-4 h-4 text-cyan-300" />; })()}
              <span>{objects.skyState} Sky</span>
            </div>
            <select value={lightPoll} onChange={(e) => setLightPoll(e.target.value)} className="bg-black/40 border border-white/10 rounded-md text-xs px-2 py-1 outline-none">
              {Object.entries(LIGHT_POLLUTION).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
            </select>
          </div>
          <div className="text-xs text-gray-500 mt-2">Honesty Filter limiting magnitude right now: <span className="text-cyan-300">{objects.effLimit.toFixed(1)}</span> — only objects brighter than this will read as "visible."</div>
        </div>

        <div className="flex-1 overflow-y-auto zenith-scroll p-3 space-y-2">
          {visibleList.map((obj) => {
            const meta = tierMeta(obj.tier);
            const Icon = meta.icon;
            return (
              <div key={obj.id} className={`rounded-xl border ${meta.ring} ${meta.bg} p-3`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Icon className={`w-4 h-4 flex-shrink-0 ${meta.color}`} />
                    <span className="text-sm font-medium truncate">{obj.name}</span>
                    {obj.kind === "satellite" && (obj.live ? <Wifi className="w-3 h-3 text-emerald-400 flex-shrink-0" /> : <WifiOff className="w-3 h-3 text-amber-400 flex-shrink-0" />)}
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0">{obj.alt.toFixed(0)}° alt</span>
                </div>
                <div className={`text-xs mt-1 ${meta.color}`}>{meta.label}{obj.kind !== "satellite" ? ` · mag ${obj.mag.toFixed(1)}` : ""}</div>
                {obj.note && <div className="text-xs text-gray-500 mt-0.5">{obj.note}</div>}
                {obj.kind === "moon" && <div className="text-xs text-gray-500 mt-0.5">{obj.illumPct}% illuminated</div>}
                {obj.tier === "phone" && (
                  <button onClick={() => setModalObj(obj)} className="mt-2 flex items-center gap-1.5 text-xs bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 px-2.5 py-1.5 rounded-lg transition-colors">
                    <Camera className="w-3.5 h-3.5" /> Try This
                  </button>
                )}
                {obj.tier === "naked" && (
                  <button onClick={() => setModalObj(obj)} className="mt-2 flex items-center gap-1.5 text-xs bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 px-2.5 py-1.5 rounded-lg transition-colors">
                    <Eye className="w-3.5 h-3.5" /> Try This
                  </button>
                )}
              </div>
            );
          })}
          {visibleList.length === 0 && <div className="text-sm text-gray-500 text-center py-8">Nothing above the horizon right now.</div>}
        </div>

        {/* Time travel */}
        <div className="p-4 border-t border-white/10">
          <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
            <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Time Travel</span>
            <div className="flex items-center gap-2">
              <span className="text-cyan-300" suppressHydrationWarning>{effectiveTime.toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
              {timeOffsetH !== 0 && <button onClick={() => setTimeOffsetH(0)} className="text-gray-500 hover:text-cyan-300"><RotateCcw className="w-3.5 h-3.5" /></button>}
            </div>
          </div>
          <input type="range" min={-168} max={168} value={timeOffsetH} onChange={(e) => setTimeOffsetH(parseInt(e.target.value))} className="w-full accent-cyan-400" />
          <div className="flex justify-between text-[10px] text-gray-600 mt-1"><span>−168h</span><span>now</span><span>+168h</span></div>
        </div>
      </div>

      {/* Hint */}
      <div className="absolute bottom-4 left-4 z-10 text-xs text-gray-500 bg-black/40 backdrop-blur-md rounded-lg px-3 py-1.5 hidden sm:block">
        Drag globe to rotate · Click to set location · Scroll to zoom
      </div>

      {/* Try This Modal */}
      {modalObj && (
        <div className="absolute inset-0 z-30 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setModalObj(null)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-gray-950 border border-cyan-500/30 rounded-2xl max-w-sm w-full p-5 zenith-float">
            <div className="flex items-start justify-between mb-3">
              <h3 className="font-bold text-lg text-cyan-300">{modalObj.name}</h3>
              <button onClick={() => setModalObj(null)} className="text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="text-sm text-gray-400 mb-4">{tryThisInfo(modalObj).window}</div>
            {modalObj.tier === "phone" ? (
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-500 mb-2">Phone camera settings</div>
                <ul className="space-y-2">
                  {CAMERA_TIPS.map((tip, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="text-cyan-400 mt-0.5">•</span> <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="text-sm">
                <div className="text-xs uppercase tracking-wide text-gray-500 mb-2">Naked-eye viewing</div>
                <p className="text-gray-300">Look toward azimuth <span className="text-cyan-300">{modalObj.az.toFixed(0)}°</span> at an altitude of <span className="text-cyan-300">{modalObj.alt.toFixed(0)}°</span> above the horizon. Give your eyes 10–15 minutes to adjust to the dark for the best view.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
