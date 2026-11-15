# Sprint 4 Report — OpenAtlas
**Date:** November 15, 2026
**Scrum Master:** ADK
**Challenge:** Planet X and SPHEREx

---

## Goal of This Sprint
Final submission preparation — demo video, public deployment, and NASA Space Apps platform submission.

---

## What We Accomplished
- Demo video scripted and produced using Remotion (React-based programmatic video)
- Application deployed to Windows server with public access via Cloudflare Tunnel
- Custom domain connected (GoDaddy)
- NASA Space Apps platform submission completed
- All sprint reports finalized (sprints 1–4)
- README updated with live URL and final architecture

---

## Demo Video

| Item | Detail |
|------|--------|
| Format | 30-second text-driven video, English captions throughout |
| Tool | Remotion with Claude Code MCP integration |
| Hosting | YouTube |
| Scenes | Starfield → problem statement → blink animation → "Meet OpenAtlas" reveal → UI screenshots → team credits |

**Script summary:**

| Time | Content |
|------|---------|
| 0:00–0:05 | "Billions of objects are hiding in our sky. Moving. Changing. Invisible to the naked eye." |
| 0:05–0:12 | SPHEREx blink animation. "The only way to find them? Watch the sky blink." |
| 0:12–0:15 | Logo reveal. "Meet OpenAtlas." |
| 0:15–0:23 | UI screenshots. "Real NASA data · 102 spectral channels · DR1 Nov 2026." |
| 0:23–0:28 | "dreamlyfters · NASA Space Apps Challenge 2026 · Niğde" |
| 0:28–0:30 | Live URL |

---

## Full Architecture Delivered

```
Browser (openatlas.space)
    │
    ├── React 19 + Vite frontend
    │   ├── CoordinateInput   — name resolve, RA/Dec/FOV, presets
    │   ├── ImageViewer       — blink animation (<img> tag cycling)
    │   ├── TimeLapseControls — play/pause/speed/scrubber
    │   └── SpectrumChart     — inline SVG spectrum (102 channels)
    │
    └── /api proxy → FastAPI backend (port 8000)
            ├── GET /api/health
            ├── GET /api/resolve?name=     (SIMBAD name resolution)
            ├── GET /api/frames            (IRSA TAP → spherex.obscore)
            ├── GET /api/frame/{obs_id}    (FITS → ZScale → PNG)
            ├── GET /api/spectrum          (102-channel spectrum)
            ├── GET /api/gaia             (Gaia DR3 proper motions)
            └── GET /api/wise             (AllWISE infrared sources)
```

## Data Sources

| Source | Table / Service | Use |
|--------|----------------|-----|
| NASA/IPAC IRSA | `spherex.obscore` via TAP | SPHEREx DR1 frame metadata |
| NASA/IPAC IRSA | FITS download URLs | Raw image data |
| CDS/SIMBAD | `simbad.u-strasbg.fr/TAP` | Object name → RA/Dec |
| Gaia DR3 | `gaiadr3.gaia_source` via ESA TAP | Proper motion overlays |
| AllWISE | `allwise_p3as_psd` via IRSA TAP | Infrared source overlays |

---

## Task Distribution
| Role | Responsibility |
|---|---|
| Team Lead / Scrum Master | Submission coordination, sprint reporting, video production |
| Backend Developer | Deployment, server configuration, Cloudflare Tunnel |
| Frontend Developer | Final UI polish, production build |
| Research | Documentation, NASA submission form |

---

## Test Targets

| Object | RA (°) | Dec (°) | Expected |
|--------|--------|---------|---------|
| Barnard's Star | 269.45 | +4.69 | High proper motion — moves across frames |
| WISE 0855−0714 | 133.79 | −7.24 | Cold brown dwarf — faint at short λ |
| Proxima Centauri | 217.42 | −62.68 | Nearest star — large proper motion |
| M31 (Andromeda) | 10.68 | +41.27 | Extended source — galaxy structure |
| Galactic Center | 266.42 | −29.01 | Dense star field, high source density |

---

## Challenges Encountered
- SPHEREx DR1 released only 2 days before the event (Nov 13, 2026); required rapid data integration
- NixOS + openSUSE hybrid environment caused Python ABI issues (resolved in Sprint 3)
- 30-second video format required careful scripting to convey technical depth concisely
- Coordinating deployment, video production, and submission simultaneously on Day 2

---

## Reflections

**What went well:**
- Full IRSA TAP integration with real SPHEREx DR1 data achieved
- Demo mode fallback ensured the app was always presentable even without live data
- Remotion gave programmatic control over the demo video — full creative control

**What we would improve with more time:**
- Real-time moving object detection (frame-to-frame source matching algorithm)
- Mobile-responsive UI improvements
- Multi-wavelength composite viewer (combine SPHEREx channels as false-color RGB)
- Public API endpoint for other researchers to query

---

## Cumulative Project Velocity

| Sprint | Story Points | Focus |
|--------|-------------|-------|
| Sprint 1 | 8 | Project scaffold, data research, repo setup |
| Sprint 2 | 33 | Full pipeline — IRSA TAP, FITS→PNG, React viewer |
| Sprint 3 | 10 | Environment fixes, app running end-to-end |
| Sprint 4 | 15 | Demo video, deployment, submission |
| **Total** | **66** | |

---

## Status: ✅ Complete — Submitted
