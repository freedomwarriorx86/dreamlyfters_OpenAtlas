"""
Deploy OpenAtlas to a Hugging Face Space (free Docker CPU tier).

    pip install huggingface_hub
    HF_TOKEN=hf_xxx python deploy/huggingface/deploy.py <user>/<space-name> [--no-build]

Builds the frontend (npm run build), assembles the Space in a temp folder
(Dockerfile, start.sh, prewarm.py, README card, backend/, built frontend/,
serve.py), creates the Space if needed and uploads it. Hugging Face then builds
the Docker image; the site is at https://<user>-<space-name>.hf.space
"""
import argparse
import os
import shutil
import subprocess
import tempfile
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("space", help="<user>/<space-name>, e.g. dreamlyfters/openatlas")
    ap.add_argument("--no-build", action="store_true", help="use the existing frontend/dist")
    a = ap.parse_args()
    token = os.environ.get("HF_TOKEN")
    if not token:
        raise SystemExit("Set HF_TOKEN to a Hugging Face access token with write permission.")

    if not a.no_build:
        subprocess.run(["npm", "run", "build"], cwd=REPO / "frontend", check=True)
    dist = REPO / "frontend" / "dist"
    if not (dist / "index.html").exists():
        raise SystemExit("frontend/dist is missing; run without --no-build.")

    from huggingface_hub import HfApi

    with tempfile.TemporaryDirectory() as tmp:
        out = Path(tmp)
        for name in ("Dockerfile", "start.sh", "prewarm.py", "README.md"):
            shutil.copy2(HERE / name, out / name)
        shutil.copy2(REPO / "deploy" / "serve.py", out / "serve.py")
        shutil.copytree(REPO / "backend", out / "backend", ignore=shutil.ignore_patterns("__pycache__", "*.pyc"))
        shutil.copytree(dist, out / "frontend")

        api = HfApi(token=token)
        api.create_repo(a.space, repo_type="space", space_sdk="docker", exist_ok=True)
        api.upload_folder(folder_path=str(out), repo_id=a.space, repo_type="space",
                          commit_message="Deploy OpenAtlas", delete_patterns=["*"])
    user, name = a.space.split("/")
    print(f"Uploaded. Hugging Face is building the image now (a few minutes).")
    print(f"Space page: https://huggingface.co/spaces/{a.space}")
    print(f"Site:       https://{user.lower()}-{name.lower().replace('_', '-')}.hf.space")


if __name__ == "__main__":
    main()
