// Thin client for the OpenAtlas API (served under /api by the same origin).

const qs = (p) =>
  new URLSearchParams(Object.entries(p).filter(([, v]) => v !== undefined && v !== null && v !== "")).toString();

export async function getJSON(path, params = {}, { signal } = {}) {
  const res = await fetch(`/api/${path}?${qs(params)}`, { signal });
  let body = null;
  try { body = await res.json(); } catch { /* non-JSON error page */ }
  if (!res.ok) {
    const msg = body?.detail || (res.status === 524 ? "The archive took too long to answer (timeout). Try again." : `HTTP ${res.status}`);
    const err = new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
    err.status = res.status;
    throw err;
  }
  return body;
}

const view = (s) => ({ ra: s.ra, dec: s.dec, fov: s.fov, collection: s.collection });

export const frameURL = (s, id, extra = {}) =>
  `/api/frame/${encodeURIComponent(id)}?${qs({ ...view(s), stretch: s.stretch, flags: s.showFlags || undefined,
    mask: s.maskFlags || undefined, size: 512, ...extra })}`;
export const stackURL = (s, ids) => `/api/stack?${qs({ ...view(s), stretch: s.stretch, ids: ids.join(",") })}`;
export const diffURL = (s, ids, op, a, b) => `/api/diff?${qs({ ...view(s), ids: ids.join(","), op, a, b })}`;
export const gifURL = (s, ids, fps) =>
  `/api/export.gif?${qs({ ...view(s), stretch: s.stretch, ids: ids.join(","), fps, flags: s.showFlags || undefined })}`;

export const api = {
  resolve: (name) => getJSON("resolve", { name }),
  frames: (ra, dec, collection, opts) => getJSON("frames", { ra, dec, collection }, opts),
  photometry: (s, ids, opts) => getJSON("photometry", { ra: s.ra, dec: s.dec, collection: s.collection, ids: ids.join(",") }, opts),
  candidates: (s, ids, opts) => getJSON("candidates", { ...view(s), ids: ids.join(",") }, opts),
  values: (s, id) => getJSON(`frame/${encodeURIComponent(id)}/values`, view(s)),
  gaia: (s) => getJSON("gaia", { ra: s.ra, dec: s.dec, fov: s.fov }),
  wise: (s) => getJSON("wise", { ra: s.ra, dec: s.dec, fov: s.fov }),
  flags: () => getJSON("flags"),
  releases: () => getJSON("releases"),
};

/** Run async tasks with limited concurrency. */
export async function pool(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const k = i++;
      try { out[k] = await fn(items[k], k); } catch (e) { out[k] = { error: e }; }
    }
  });
  await Promise.all(workers);
  return out;
}

export function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

export function download(name, content, type = "text/csv") {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

export function toCSV(rows, cols) {
  const esc = (v) => {
    if (v === null || v === undefined) return "";
    const s = Array.isArray(v) ? v.join(" ") : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch { /* ignore */ }
    ta.remove();
    return ok;
  }
}
