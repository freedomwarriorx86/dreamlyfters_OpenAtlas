"""
Warm the cache for the five test objects right after the Space starts, so the
first visitor (or judge) does not wait for NASA downloads.

It mirrors what the viewer does: resolve the name, list the SPHEREx frames,
pick 24 evenly spread in time (spreadPick in frontend/src/lib/astro.js) and
download those cut-outs, then measure them for the light curve. Errors are
logged and skipped; the site works either way.
"""
import os
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

# backend/ sits next to this file in the Space (/app/backend); override for local tests
sys.path.insert(0, os.environ.get("OPENATLAS_BACKEND_DIR", str(Path(__file__).resolve().parent / "backend")))

TARGETS = [  # (name, resolve name or None, fallback ra, dec) — same as TEST_OBJECTS in store.jsx
    ("WISE 0855", None, 133.79513, -7.24515),
    ("Barnard's Star", "Barnard's Star", 269.446269, 4.768204),
    ("Epsilon Indi B", "eps Ind B", 331.0446, -56.7838),
    ("RW Aurigae", "RW Aur", 76.9564, 30.4014),
    ("R Draconis", "R Dra", 248.1675, 66.7533),
]
N = 24


def spread_pick(frames, n):
    if len(frames) <= n:
        return frames
    out = {}
    for i in range(n):
        f = frames[round(i * (len(frames) - 1) / (n - 1))]
        out[f["id"]] = f
    return list(out.values())


def wait_for_backend(timeout=120):
    t0 = time.time()
    while time.time() - t0 < timeout:
        try:
            urllib.request.urlopen("http://127.0.0.1:8000/api/health", timeout=5)
            return
        except Exception:
            time.sleep(2)


def main():
    wait_for_backend()
    import catalogs
    import spherex as sx

    for name, query, ra, dec in TARGETS:
        t0 = time.time()
        try:
            if query:
                try:
                    r = catalogs.resolve(query)
                    ra, dec = r["ra"], r["dec"]
                except Exception as exc:
                    print(f"[prewarm] {name}: resolve failed ({exc}); using fallback position", flush=True)
            ra, dec = round(ra, 5), round(dec, 5)  # the viewer URL keeps 5 decimals
            # if NASA's archive is briefly down the backend answers with labelled demo
            # frames; those cannot be downloaded, so wait and ask again a few times
            for attempt in range(3):
                res = sx.query_frames(ra, dec)
                if not res.get("demo_mode"):
                    break
                print(f"[prewarm] {name}: archive unavailable ({res.get('error')}); retrying in 90 s", flush=True)
                time.sleep(90)
            if res.get("demo_mode"):
                print(f"[prewarm] {name}: skipped, archive still unavailable", flush=True)
                continue
            pick = spread_pick(res["frames"], N)
            def one(f, ra=ra, dec=dec):
                try:
                    sx.get_cutout(f, ra, dec)
                    sx.photometry(f, ra, dec)
                    return True
                except Exception as exc:
                    print(f"[prewarm] {name}: {f['id']}: {exc}", flush=True)
                    return False

            # 4 at a time, the same limit the backend uses for NASA downloads
            with ThreadPoolExecutor(max_workers=4) as pool:
                ok = sum(pool.map(one, pick))
            print(f"[prewarm] {name}: {ok}/{len(pick)} frames cached in {time.time() - t0:.0f}s", flush=True)
        except Exception as exc:
            print(f"[prewarm] {name}: skipped ({exc})", flush=True)


if __name__ == "__main__":
    main()
