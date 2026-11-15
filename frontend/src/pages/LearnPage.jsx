import React, { useEffect, useMemo, useState } from "react";
import { GLOSSARY, GROUPS } from "../lib/glossary";
import { TEST_OBJECTS, useAtlas } from "../store";
import { useStagger } from "../lib/motion";

// ---------------------------------------------------------------------------
// Tiny deterministic "sky" used by the demos
const rnd = (seed) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const STARS = (() => {
  const r = rnd(42);
  return Array.from({ length: 34 }, () => ({ x: 8 + r() * 184, y: 8 + r() * 184, b: 0.25 + r() ** 2 * 0.75 }));
})();
const NOISE = (() => {
  const r = rnd(7);
  return [Array.from({ length: 260 }, () => ({ x: r() * 200, y: r() * 200, o: r() * 0.55 }))];
})();
const MOVER = (t) => ({ x: 70 + t * 60, y: 120 - t * 30 });

function Sky({ t = 0, noise = null, faint = 0, mover = true, stretch = "linear", children, label }) {
  const k = stretch === "asinh" ? 0.55 : stretch === "log" ? 0.4 : 1;
  const lift = (b) => Math.pow(b, k);
  const m = MOVER(t);
  return (
    <svg viewBox="0 0 200 200" className="demo-sky" role="img" aria-label={label}>
      <rect width="200" height="200" fill="#060b16" />
      {noise && noise.map((n, i) => <rect key={i} x={n.x} y={n.y} width="2" height="2" fill="#5EEAD4" opacity={n.o} />)}
      {STARS.map((s, i) => <circle key={i} cx={s.x} cy={s.y} r={1 + 2.2 * lift(s.b)} fill="#E8EEF8" opacity={Math.min(1, 0.15 + lift(s.b))} />)}
      {faint > 0 && <circle cx="140" cy="60" r="2.4" fill="#E8EEF8" opacity={faint} />}
      {mover && <circle cx={m.x} cy={m.y} r="3" fill="#FFB86B" />}
      {children}
    </svg>
  );
}

function useTicker(on, ms, n) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!on) return;
    const id = setInterval(() => setI((x) => (x + 1) % n), ms);
    return () => clearInterval(id);
  }, [on, ms, n]);
  return [i, setI];
}

function BlinkDemo() {
  const [play, setPlay] = useState(true);
  const [i, setI] = useTicker(play, 600, 4);
  return (
    <figure className="demo" data-reveal>
      <Sky t={i / 3} label="Four frames of the same patch of sky; one orange dot moves" />
      <figcaption>
        <b>1 · Blink</b> Same patch, four dates. Stars stay put; the orange dot drifts — it is close by, or moving fast.
        <div className="demo-ctl">
          <button className="ghost" onClick={() => setPlay(!play)}>{play ? "Pause" : "Play"}</button>
          <span className="mono">frame {i + 1}/4</span>
          <button className="ghost" onClick={() => { setPlay(false); setI((i + 1) % 4); }}>Step →</button>
        </div>
      </figcaption>
    </figure>
  );
}

function StackDemo() {
  const [n, setN] = useState(1);
  // random noise drops as 1/√n when n frames are averaged
  const noise = NOISE[0].map((p) => ({ ...p, o: p.o / Math.sqrt(n) }));
  return (
    <figure className="demo" data-reveal>
      <Sky noise={noise} faint={Math.min(1, 0.12 + 0.11 * n)} mover={false} label={`Average of ${n} frames: noise fades, a faint star appears`} />
      <figcaption>
        <b>2 · Stack</b> Averaging frames washes out the random speckles. Watch the faint star at the top right appear.
        <label className="demo-ctl">Frames averaged <input className="range" type="range" min="1" max="8" value={n} onChange={(e) => setN(+e.target.value)} /> <span className="mono">{n}</span></label>
      </figcaption>
    </figure>
  );
}

function DiffDemo() {
  const a = MOVER(0), b = MOVER(1);
  return (
    <figure className="demo" data-reveal>
      <svg viewBox="0 0 200 200" className="demo-sky" role="img" aria-label="Difference image: only the moving object remains, as an orange and violet pair">
        <rect width="200" height="200" fill="#0b1426" />
        <circle cx={b.x} cy={b.y} r="9" fill="#FFB86B" opacity=".35" /><circle cx={b.x} cy={b.y} r="4" fill="#FFB86B" />
        <circle cx={a.x} cy={a.y} r="9" fill="#A78BFA" opacity=".35" /><circle cx={a.x} cy={a.y} r="4" fill="#A78BFA" />
        <path d={`M${a.x + 6} ${a.y - 3}L${b.x - 7} ${b.y + 3}`} stroke="#97A6C2" strokeDasharray="3 3" />
      </svg>
      <figcaption><b>3 · Difference</b> Late minus early: every steady star cancels out. Violet = where it was, orange = where it is now.</figcaption>
    </figure>
  );
}

function StretchDemo() {
  const [st, setSt] = useState("linear");
  return (
    <figure className="demo" data-reveal>
      <Sky stretch={st} mover={false} faint={st === "linear" ? 0.15 : st === "asinh" ? 0.6 : 0.8} label={`The same image shown with a ${st} stretch`} />
      <figcaption>
        <b>4 · Stretch</b> Same data, different contrast. Linear hides faint stars; asinh and log lift them up.
        <div className="seg demo-ctl" role="group" aria-label="Stretch">
          {["linear", "asinh", "log"].map((s) => <button key={s} className={st === s ? "on" : ""} onClick={() => setSt(s)}>{s}</button>)}
        </div>
      </figcaption>
    </figure>
  );
}

export default function LearnPage() {
  const { go, openObject } = useAtlas();
  const [q, setQ] = useState("");
  const ref = useStagger([q]);
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? GLOSSARY.filter((g) => (g.term + g.short + g.long).toLowerCase().includes(t)) : GLOSSARY;
  }, [q]);
  useEffect(() => {
    const h = window.location.hash.slice(1);
    if (h) setTimeout(() => document.getElementById(h)?.scrollIntoView({ block: "center" }), 100);
  }, []);
  return (
    <main className="page" ref={ref}>
      <header className="learn-hero" data-tour="learn-hero">
        <p className="h">Learning Hub</p>
        <h1>How to hunt for <span className="grad">moving things</span> in the sky</h1>
        <p className="note" style={{ maxWidth: 720, fontSize: 14 }}>
          You do not need to be an astronomer. Four ideas are enough to use OpenAtlas — try them below, then look up any word you meet in the viewer.
        </p>
      </header>
      <section className="demos" aria-label="Interactive examples" data-tour="learn-demos">
        <BlinkDemo /><StackDemo /><DiffDemo /><StretchDemo />
      </section>
      <section className="pn" aria-label="Try it" data-tour="learn-try">
        <p className="h">Try it on real data</p>
        <div className="try">
          {TEST_OBJECTS.slice(0, 3).map((o) => (
            <button key={o.key} className="pre" onClick={() => { openObject(o); go("/"); }}>
              <span className="ic" style={{ background: o.color + "26", color: o.color }}>{o.icon}</span>
              <div><b>{o.name}</b><span>{o.look}</span></div>
            </button>
          ))}
        </div>
      </section>
      <section aria-label="Glossary" data-tour="learn-glossary">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap", margin: "8px 0 14px" }}>
          <div><p className="h">Glossary</p><h2 style={{ margin: "6px 0 0", fontSize: 24 }}>Every word in the viewer, in plain language</h2></div>
          <label className="search" style={{ maxWidth: 320 }}>
            <span className="sr">Search the glossary</span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search: blink, µm, Gaia…" />
          </label>
        </div>
        {GROUPS.map((grp) => {
          const items = list.filter((g) => g.group === grp);
          if (!items.length) return null;
          return (
            <div key={grp} className="gloss-group">
              <h3>{grp}</h3>
              <div className="gloss">
                {items.map((g) => (
                  <article key={g.id} id={g.id} className="gloss-card" data-reveal>
                    <h4>{g.term}</h4>
                    <p className="lead">{g.short}</p>
                    <p>{g.long}</p>
                    {g.example && <p className="gl-ex">Example: {g.example}</p>}
                  </article>
                ))}
              </div>
            </div>
          );
        })}
        {!list.length && <p className="note">No term matches “{q}”.</p>}
      </section>
    </main>
  );
}
