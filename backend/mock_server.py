"""Lightweight mock FastAPI server for front-end testing.

This module mirrors the interface defined in `main.py` but returns
predictable, dummy data so the React client can be exercised without
valid AWS or Gemini credentials.
"""

from __future__ import annotations

import itertools
import uuid
from typing import Dict, List, Tuple

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# --- Shared schema with the production server ---------------------------------

class VideoRequest(BaseModel):
    script: str
    style: str

# --- Mock data lifecycle ------------------------------------------------------

MOCK_VIDEO_URL = (
    # "https://storage.googleapis.com/coverr-main/mp4/Mt_Baker.mp4"
    "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
)
STATUS_FLOW: List[Tuple[str, str]] = [
    ("QUEUED", "Awaiting generation..."),
    ("ANALYZING_SCRIPT", "Parsing script and splitting into scenes."),
    ("GENERATING_PROMPTS", "Authoring Gemini prompts from each scene."),
    ("INVOKING_BEDROCK", "Sending prompts to Nova Reel."),
    ("POLLING_CLIPS", "Waiting for rendered clips to finish."),
    ("COMPLETED", "Assembly complete. 3/3 clips successful."),
]

job_counter = itertools.count(1)
JobPayload = Dict[str, object]
jobs: Dict[str, JobPayload] = {}


def _create_job(payload: VideoRequest) -> str:
    job_id = str(uuid.uuid4())
    jobs[job_id] = {
        "step": 0,
        "status": STATUS_FLOW[0][0],
        "progress": STATUS_FLOW[0][1],
        "video_url": None,
        "request": payload.dict(),
        "human_id": next(job_counter),
    }
    return job_id


def _advance_job(job: JobPayload) -> JobPayload:
    step = job["step"]
    if step < len(STATUS_FLOW) - 1:
        step += 1
        job["step"] = step
        job["status"], job["progress"] = STATUS_FLOW[step]
        if STATUS_FLOW[step][0] == "COMPLETED":
            job["video_url"] = MOCK_VIDEO_URL
    return job


# --- FastAPI setup ------------------------------------------------------------

app = FastAPI(title="Mock AWS Educational Video Generator")
origins = [
    "http://localhost",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Routes -------------------------------------------------------------------

@app.post("/generate")
async def create_video_job(request: VideoRequest):
    job_id = _create_job(request)
    return {"job_id": job_id, "status": jobs[job_id]["status"]}


@app.get("/status/{job_id}")
async def get_video_status(job_id: str):
    job = jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job ID not found")

    job = _advance_job(job)
    return {
        "status": job["status"],
        "progress": job["progress"],
        "video_url": job["video_url"],
        "request": job["request"],
    }


# --- Local entry point --------------------------------------------------------

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
