"""Comprehensive mock FastAPI server for local front-end testing.

The production system exposes multiple tool endpoints (video, image, etc.).
This mock server re-creates those routes so the React client can be fully
exercised on a laptop without AWS, OpenAI, or Google credentials.
"""

from __future__ import annotations

import itertools
import random
import uuid
from typing import Any, Dict, List, Tuple

from fastapi import FastAPI, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware

# --- Mock data lifecycle ------------------------------------------------------

MOCK_VIDEO_URL = (
    "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
)
IMAGE_PLACEHOLDERS = [
    "https://images.unsplash.com/photo-1472214103451-9374bd1c798e",
    "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee",
    "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429",
]
STATUS_FLOW: List[Tuple[str, str]] = [
    ("QUEUED", "Awaiting generation..."),
    ("ANALYZING_SCRIPT", "Parsing script and splitting into scenes."),
    ("GENERATING_PROMPTS", "Authoring Gemini prompts from each scene."),
    ("INVOKING_BEDROCK", "Sending prompts to Nova Reel."),
    ("POLLING_CLIPS", "Waiting for rendered clips to finish."),
    ("COMPLETED", "Assembly complete. 3/3 clips successful."),
]

JobPayload = Dict[str, Any]
jobs: Dict[str, JobPayload] = {}
job_counter = itertools.count(1)


async def _extract_form_payload(request: Request) -> tuple[Dict[str, str], List[UploadFile]]:
    """Split incoming multipart form data into text fields and files."""

    form = await request.form()
    text_fields: Dict[str, str] = {}
    files: List[UploadFile] = []
    for key, value in form.multi_items():
        if isinstance(value, UploadFile):
            files.append(value)
        else:
            text_fields[key] = value
    return text_fields, files


def _create_video_job(payload: JobPayload) -> str:
    job_id = str(uuid.uuid4())
    jobs[job_id] = {
        "step": 0,
        "status": STATUS_FLOW[0][0],
        "progress": STATUS_FLOW[0][1],
        "video_url": None,
        "prompt": payload.get("prompt", ""),
        "model": payload.get("model"),
        "tool": payload.get("tool", "video"),
        "attachments": payload.get("attachments", []),
        "metadata": payload.get("metadata", {}),
        "job_number": next(job_counter),
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


def _attachment_meta(files: List[UploadFile]) -> List[Dict[str, Any]]:
    return [
        {
            "name": upload.filename,
            "content_type": upload.content_type,
        }
        for upload in files
        if upload.filename
    ]


# --- FastAPI setup ------------------------------------------------------------

app = FastAPI(title="Mock GPT Workflow Server")
origins = [
    "http://localhost",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Routes -------------------------------------------------------------------

@app.post("/api/video/{model_slug}")
async def enqueue_video(model_slug: str, request: Request):
    text_fields, uploads = await _extract_form_payload(request)
    prompt = text_fields.get("prompt", "")
    tool = text_fields.get("tool", "video")
    model = text_fields.get("model", model_slug)
    metadata = {
        key: value
        for key, value in text_fields.items()
        if key not in {"prompt", "tool", "model"}
    }
    attachments = _attachment_meta(uploads)

    job_id = _create_video_job(
        {
            "prompt": prompt,
            "model": model,
            "tool": tool,
            "attachments": attachments,
            "metadata": metadata,
        }
    )

    return {
        "job_id": job_id,
        "status": jobs[job_id]["status"],
        "progress": jobs[job_id]["progress"],
        "prompt": prompt,
        "model": model,
        "tool": tool,
        "attachments": attachments,
        "metadata": metadata,
    }


@app.post("/api/image/{model_slug}")
async def generate_image(model_slug: str, request: Request):
    text_fields, uploads = await _extract_form_payload(request)
    prompt = text_fields.get("prompt", "")
    tool = text_fields.get("tool", "image")
    model = text_fields.get("model", model_slug)
    metadata = {
        key: value
        for key, value in text_fields.items()
        if key not in {"prompt", "tool", "model"}
    }
    attachments = _attachment_meta(uploads)

    # Use random placeholder to mimic multiple returns
    image_url = random.choice(IMAGE_PLACEHOLDERS)
    variation_seed = uuid.uuid4().hex[:6]

    return {
        "status": "COMPLETED",
        "prompt": prompt,
        "model": model,
        "tool": tool,
        "metadata": metadata,
        "attachments": attachments,
        "image_url": f"{image_url}?auto=format&seed={variation_seed}",
        "variations": [
            {
                "id": f"{variation_seed}-a",
                "url": f"{image_url}?auto=format&fit=crop&w=1024&var=a",
            },
            {
                "id": f"{variation_seed}-b",
                "url": f"{image_url}?auto=format&fit=crop&w=1024&var=b",
            },
        ],
    }


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
        "prompt": job["prompt"],
        "model": job["model"],
        "tool": job["tool"],
        "attachments": job["attachments"],
        "metadata": job["metadata"],
    }


@app.get("/health")
async def healthcheck():
    return {"ok": True, "jobs": len(jobs)}


# --- Local entry point --------------------------------------------------------

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
