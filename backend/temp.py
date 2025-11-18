from fastapi import FastAPI, BackgroundTasks, HTTPException, Request ,Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uuid
import time
import spacy
from google import genai
from dotenv import load_dotenv
import os
import boto3
import json
import random

# Optional Bytez client import (only used for the bytez route)
try:
    from bytez import Bytez
except Exception:
    Bytez = None

# --- CONFIGURATION & CLIENT INITIALIZATION ---
load_dotenv()

# Environment Variables
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY")
AWS_REGION = os.getenv("AWS_REGION")
S3_BUCKET_NAME = os.getenv("S3_BUCKET_NAME")
BYTEZ_API_KEY = os.getenv("BYTEZ_API_KEY")  # optional

# Initialize AWS clients
s3_client = None
bedrock_runtime = None

if AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY:
    try:
        s3_client = boto3.client(
            's3',
            aws_access_key_id=AWS_ACCESS_KEY_ID,
            aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
            region_name=AWS_REGION
        )
        # Initialize the Bedrock Runtime client for T2V
        bedrock_runtime = boto3.client(
            'bedrock-runtime',
            aws_access_key_id=AWS_ACCESS_KEY_ID,
            aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
            region_name=AWS_REGION
        )
        print("INFO: AWS S3 and Bedrock clients initialized.")
    except Exception as e:
        print(f"ERROR: Failed to initialize AWS clients. Check credentials/region. {e}")
        s3_client = None
else:
    print("WARNING: AWS Credentials are missing. S3/Bedrock integration will be skipped.")

# Initialize Gemini Client
if GEMINI_API_KEY:
    ai_client = genai.Client(api_key=GEMINI_API_KEY)
else:
    print("WARNING: GEMINI_API_KEY not found. LLM prompting will be skipped.")
    ai_client = None

# Initialize Spacy NLP
try:
    nlp = spacy.load("en_core_web_sm")
except OSError:
    print("WARNING: Spacy model 'en_core_web_sm' not found. Script analysis will be basic.")
    nlp = None

# Initialize Bytez SDK (if available)
sdk_bytez = None
if Bytez and BYTEZ_API_KEY:
    try:
        sdk_bytez = Bytez(BYTEZ_API_KEY)
        print("INFO: Bytez SDK initialized.")
    except Exception as e:
        print("WARNING: failed to init Bytez SDK:", e)
        sdk_bytez = None
elif Bytez and not BYTEZ_API_KEY:
    print("WARNING: BYTEZ_API_KEY not set — bytez route will attempt to run but may fail without key.")
    try:
        sdk_bytez = Bytez("")  # allow empty key for local/mock usage
    except Exception:
        sdk_bytez = None
else:
    print("Bytez client not installed or unavailable; /api/video/ali-vilab/... will still be present but may error.")

# --- FASTAPI SETUP ---
app = FastAPI()

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

class VideoRequest(BaseModel):
    script: str
    style: str

# Global dictionary to track job statuses
job_status = {}

# --- helpers to extract multipart form-data (like your frontend sends) ---
async def _extract_form_payload(request: Request):
    form = await request.form()
    text_fields = {}
    files = []
    for key, value in form.multi_items():
        # UploadFile instances come from form data
        # do not attempt to read file content here — just capture metadata/filename
        try:
            from starlette.datastructures import UploadFile as StarletteUploadFile
            is_file = isinstance(value, StarletteUploadFile)
        except Exception:
            is_file = False

        if is_file:
            files.append(value)
        else:
            text_fields[key] = value
    return text_fields, files

def _attachment_meta(files):
    return [
        {
            "name": f.filename,
            "content_type": f.content_type if hasattr(f, "content_type") else None,
        }
        for f in files
        if getattr(f, "filename", None)
    ]


# --- HELPER FUNCTIONS FOR BEDROCK T2V ---
def poll_bedrock_job(invocation_arn: str) -> dict:
    """Checks the status of the asynchronous Bedrock T2V job."""
    if not bedrock_runtime:
        return {"status": "FAILED", "video_url": None, "message": "Bedrock client not initialized."}
    
    try:
        response = bedrock_runtime.get_async_invoke(
            invocationArn=invocation_arn
        )
        status = response.get("status", "Unknown")
        
        if status == "Completed":
            arn_parts = invocation_arn.split('/')
            invocation_id = arn_parts[-1] 
            final_s3_key = f"jobs/{invocation_id}/output.mp4"
            presigned_url = s3_client.generate_presigned_url(
                ClientMethod='get_object',
                Params={'Bucket': S3_BUCKET_NAME, 'Key': final_s3_key},
                ExpiresIn=3600 
            )
            return {"status": "COMPLETED", "video_url": presigned_url, "message": "Video generated and URL pre-signed."}
        
        elif status == "Failed":
            return {"status": "FAILED", "video_url": None, "message": response.get('failureMessage', 'Unknown failure.')}
            
        return {"status": "IN_PROGRESS", "video_url": None, "message": f"Job status: {status}"}
        
    except Exception as e:
        return {"status": "FAILED", "video_url": None, "message": f"Polling error: {str(e)}"}


# --- CORE BACKGROUND TASK (UNCHANGED LOGIC) ---
def generate_video_task(job_id: str, request: VideoRequest):
    # (This function is copied unchanged from your code)
    print(f"Starting job {job_id} for script: {request.script[:30]}...")
    
    job_status[job_id]['status'] = "ANALYZING_SCRIPT"
    scenes = []

    if nlp:
        doc = nlp(request.script)
        scenes = [sent.text for sent in doc.sents]
    else:
        scenes = request.script.split(". ") 
    
    time.sleep(1) 
    job_status[job_id]['status'] = 'GENERATING_PROMPTS'
    generated_prompts = []

    if ai_client and scenes:
        for i, scene_text in enumerate(scenes):
            system_instruction = (
                "You are an expert cinematic storyboard artist. "
                f"Convert the following scene description into a single, hyper-detailed, technical, "
                f"and vivid text-to-video prompt, using the visual style: '{request.style}'. "
                f"Focus on visual movement and rich detail. The final prompt should be less than 512 characters. "
                f"The output must be ONLY the prompt text, nothing else."
            )
            
            try:
                response = ai_client.models.generate_content(
                    model="gemini-2.5-flash",
                    contents=scene_text,
                    config={"system_instruction": system_instruction}
                )
                
                generated_prompts.append(response.text[:512]) 
                print(f"--- GENERATED PROMPT for Scene {i + 1} ---\n{response.text[:100]}...\n------------------------")
                time.sleep(1)
            except Exception as e:
                print(f"Error generating prompt: {e}")
                generated_prompts.append(f"A detailed scene of {scene_text[:50]} in {request.style} style.")
    
    num_clips = len(generated_prompts)
    if num_clips == 0:
        job_status[job_id]['status'] = 'FAILED'
        job_status[job_id]['progress'] = 'Failed to generate any prompts from script.'
        return

    job_status[job_id]['status'] = 'INVOKING_BEDROCK'
    invocation_arns = []
    
    s3_output_uri = f"s3://{S3_BUCKET_NAME}/jobs/" 
    
    if bedrock_runtime:
        for i, prompt in enumerate(generated_prompts):
            job_status[job_id]['progress'] = f"Submitting clip {i + 1}/{num_clips} to Nova Reel..."
            
            model_input = {
                "taskType": "TEXT_VIDEO",
                "textToVideoParams": {"text": prompt},
                "videoGenerationConfig": {
                    "durationSeconds": 6, 
                    "fps": 24,
                    "dimension": "1280x720",
                    "seed": random.randint(0, 2147483646)
                },
            }
            
            try:
                response = bedrock_runtime.start_async_invoke(
                    modelId="amazon.nova-reel-v1:0",
                    modelInput=model_input,
                    outputDataConfig={"s3OutputDataConfig": {"s3Uri": s3_output_uri}}
                )
                invocation_arns.append(response['invocationArn'])
            except Exception as e:
                print(f"Bedrock Invocation Error for clip {i + 1}: {e}")
                invocation_arns.append(None) 
            
            time.sleep(2) 

    job_status[job_id]['status'] = 'POLLING_CLIPS'
    clip_urls = []
    max_wait_time_minutes = 10
    start_time = time.time()
    
    while time.time() - start_time < (max_wait_time_minutes * 60) and len(clip_urls) < num_clips:
        for i in range(len(clip_urls), num_clips): 
            arn = invocation_arns[i]
            if arn:
                result = poll_bedrock_job(arn)
                if result['status'] == "COMPLETED":
                    clip_urls.append(result['video_url'])
                    job_status[job_id]['progress'] = f"Clip {i + 1}/{num_clips} Completed."
                elif result['status'] == "FAILED":
                    clip_urls.append("FAILED_CLIP")
                    job_status[job_id]['progress'] = f"Clip {i + 1}/{num_clips} FAILED: {result['message']}"
                elif result['status'] == "IN_PROGRESS":
                    job_status[job_id]['progress'] = f"Waiting on Clip {i + 1}/{num_clips}. Current status: {result['message']}."
            else:
                clip_urls.append("FAILED_CLIP")
        if len(clip_urls) == num_clips:
            break
        time.sleep(15)

    successful_clips = [url for url in clip_urls if url and url != "FAILED_CLIP"]
    
    if successful_clips:
        final_video_url = successful_clips[0] 
        job_status[job_id]['status'] = 'COMPLETED'
        job_status[job_id]['video_url'] = final_video_url
        job_status[job_id]['progress'] = f"Assembly complete. {len(successful_clips)}/{num_clips} clips successful."
    else:
        job_status[job_id]['status'] = 'FAILED'
        job_status[job_id]['video_url'] = None
        job_status[job_id]['progress'] = 'T2V generation failed for all clips.'

    print(f"Job {job_id} FINAL STATUS: {job_status[job_id]['status']}. URL: {job_status[job_id]['video_url']}")


# --- FASTAPI ENDPOINTS (NEW API LAYOUT) ---

@app.post("/api/video/nova")
async def api_video_nova(request: Request, background_tasks: BackgroundTasks):
    """
    Accepts multipart/form-data like your frontend:
    - prompt (string) -> becomes VideoRequest.script
    - style (optional) or metadata.style -> becomes VideoRequest.style
    - model, tool, other metadata allowed
    """
    text_fields, uploads = await _extract_form_payload(request)
    prompt = text_fields.get("prompt", "") or text_fields.get("script", "")
    style = text_fields.get("style", text_fields.get("model", "default-style"))

    job_id = str(uuid.uuid4())
    video_request = VideoRequest(script=prompt, style=style)

    job_status[job_id] = {
        'status': 'QUEUED',
        'progress': 'Awaiting generation...',
        'video_url': None,
        'request': video_request.dict(),
        'attachments': _attachment_meta(uploads),
        'metadata': {k: v for k, v in text_fields.items() if k not in {"prompt", "style", "script", "tool", "model"}}
    }

    background_tasks.add_task(generate_video_task, job_id, video_request)

    return {
        "job_id": job_id,
        "status": job_status[job_id]['status'],
        "progress": job_status[job_id]['progress'],
        "prompt": prompt,
        "style": style
    }


# async def generate_bytez_task(job_id: str, prompt: str, model_slug: str):
#     """
#     Async task to generate video or image using Bytez.
#     The model_slug is passed dynamically.
#     """
#     try:
#         job_status[job_id]['status'] = "IN_PROGRESS"
#         job_status[job_id]['progress'] = f"Generating using Bytez model: {model_slug} ..."

#         if not sdk_bytez:
#             raise Exception("Bytez SDK not initialized.")

#         # Dynamically run the model
#         model = sdk_bytez.model(model_slug)
#         res = model.run(prompt)

#         output_url = getattr(res, "output", None)
#         error = getattr(res, "error", None)

#         if error:
#             job_status[job_id]['status'] = "FAILED"
#             job_status[job_id]['progress'] = str(error)
#             # Use a generic key: video_url or image_url depending on type
#             key = "video_url" if "video" in model_slug else "image_url"
#             job_status[job_id][key] = None
#             return

#         job_status[job_id]['status'] = "COMPLETED"
#         job_status[job_id]['progress'] = f"{'Video' if 'video' in model_slug else 'Image'} generated successfully"
#         key = "video_url" if "video" in model_slug else "image_url"
#         job_status[job_id][key] = output_url

#     except Exception as e:
#         job_status[job_id]['status'] = "FAILED"
#         job_status[job_id]['progress'] = str(e)
#         key = "video_url" if "video" in model_slug else "image_url"
#         job_status[job_id][key] = None

# async def generate_bytez_task(job_id: str, prompt: str, model_slug: str):
#     """
#     Async task to generate video or image using Bytez.
#     Handles single/multiple images and videos in a unified way.
#     """
#     try:
#         job_status[job_id]['status'] = "IN_PROGRESS"
#         job_status[job_id]['progress'] = f"Generating using Bytez model: {model_slug} ..."

#         if not sdk_bytez:
#             raise Exception("Bytez SDK not initialized.")

#         # Dynamically run the model
#         model = sdk_bytez.model(model_slug)
#         res = model.run(prompt)

#         output = getattr(res, "output", None)
#         error = getattr(res, "error", None)

#         key = "video_url" if "video" in model_slug else "image_url"

#         if error:
#             job_status[job_id]['status'] = "FAILED"
#             job_status[job_id]['progress'] = str(error)
#             job_status[job_id][key] = None
#             return

#         if "video" in model_slug:
#             # Video: expect output to be a single URL string
#             job_status[job_id]['status'] = "COMPLETED"
#             job_status[job_id]['progress'] = "Video generated successfully"
#             job_status[job_id]['video_url'] = output
#         else:
#             # Image: normalize output into a list of URLs
#             image_urls = []

#             if isinstance(output, str):
#                 image_urls = [output]
#             elif isinstance(output, list):
#                 for item in output:
#                     if isinstance(item, str):
#                         image_urls.append(item)
#                     elif isinstance(item, dict) and "url" in item:
#                         image_urls.append(item["url"])
#             elif isinstance(output, dict):
#                 # Single dict with url key
#                 if "url" in output and isinstance(output["url"], str):
#                     image_urls = [output["url"]]

#             job_status[job_id]['status'] = "COMPLETED"
#             job_status[job_id]['progress'] = f"{len(image_urls)} image(s) generated"
#             job_status[job_id]['image_url'] = image_urls

#     except Exception as e:
#         key = "video_url" if "video" in model_slug else "image_url"
#         job_status[job_id]['status'] = "FAILED"
#         job_status[job_id]['progress'] = str(e)
#         job_status[job_id][key] = None


# @app.post("/api/{tool}/{model_slug:path}")
# async def api_bytez_universal(
#     tool: str,  # "video" or "image"
#     model_slug: str,
#     prompt: str = Form(...),
#     background_tasks: BackgroundTasks = None
# ):
#     # Validate tool
#     if tool not in {"video", "image"}:
#         raise HTTPException(400, f"Unknown tool: {tool}. Must be 'video' or 'image'.")

#     if not sdk_bytez:
#         raise HTTPException(503, "Bytez SDK not initialized.")

#     # Prepare job
#     job_id = str(uuid.uuid4())
#     job_status[job_id] = {
#         "status": "QUEUED",
#         "progress": "Waiting to start...",
#         "video_url": None,
#         "image_url": None,
#         "model_slug": model_slug,
#         "tool": tool
#     }

#     # Add background task with dynamic model_slug
#     background_tasks.add_task(generate_bytez_task, job_id, prompt, model_slug)

#     return {
#         "job_id": job_id,
#         "status": "QUEUED",
#         "tool": tool,
#         "model_slug": model_slug
#     }

async def generate_bytez_task(job_id: str, prompt: str, model_slug: str, tool: str):
    """
    Async task to generate video or image using Bytez.
    Handles single/multiple images and videos in a unified way.
    """
    try:
        job_status[job_id]['status'] = "IN_PROGRESS"
        job_status[job_id]['progress'] = f"Generating using Bytez model: {model_slug} ..."

        if not sdk_bytez:
            raise Exception("Bytez SDK not initialized.")

        # Dynamically run the model
        model = sdk_bytez.model(model_slug)
        res = model.run(prompt)

        output = getattr(res, "output", None)
        error = getattr(res, "error", None)

        is_video = tool.lower() == "video"
        key = "video_url" if is_video else "image_url"

        if error:
            job_status[job_id]['status'] = "FAILED"
            job_status[job_id]['progress'] = str(error)
            job_status[job_id][key] = None
            return

        if is_video:
            # Video: expect output to be a single URL string
            job_status[job_id]['status'] = "COMPLETED"
            job_status[job_id]['progress'] = "Video generated successfully"
            job_status[job_id]['video_url'] = output
        else:
            # Image: normalize output into a list of URLs
            image_urls = []

            if isinstance(output, str):
                image_urls = [output]
            elif isinstance(output, list):
                for item in output:
                    if isinstance(item, str):
                        image_urls.append(item)
                    elif isinstance(item, dict) and "url" in item:
                        image_urls.append(item["url"])
            elif isinstance(output, dict) and "url" in output and isinstance(output["url"], str):
                image_urls = [output["url"]]

            job_status[job_id]['status'] = "COMPLETED"
            job_status[job_id]['progress'] = f"{len(image_urls)} image(s) generated"
            job_status[job_id]['image_url'] = image_urls

    except Exception as e:
        key = "video_url" if tool.lower() == "video" else "image_url"
        job_status[job_id]['status'] = "FAILED"
        job_status[job_id]['progress'] = str(e)
        job_status[job_id][key] = None


@app.post("/api/{tool}/{model_slug:path}")
async def api_bytez_universal(
    tool: str,  # "video" or "image"
    model_slug: str,
    prompt: str = Form(...),
    background_tasks: BackgroundTasks = None
):
    # Validate tool
    tool = tool.lower()
    if tool not in {"video", "image"}:
        raise HTTPException(400, f"Unknown tool: {tool}. Must be 'video' or 'image'.")

    if not sdk_bytez:
        raise HTTPException(503, "Bytez SDK not initialized.")

    # Prepare job
    job_id = str(uuid.uuid4())
    job_status[job_id] = {
        "status": "QUEUED",
        "progress": "Waiting to start...",
        "video_url": None,
        "image_url": None,
        "model_slug": model_slug,
        "tool": tool
    }

    # Add background task with tool parameter
    background_tasks.add_task(generate_bytez_task, job_id, prompt, model_slug, tool)

    return {
        "job_id": job_id,
        "status": "QUEUED",
        "tool": tool,
        "model_slug": model_slug
    }


# Status and health endpoints (match frontend API_ENDPOINTS.status)
@app.get("/status/{job_id}")
async def get_video_status(job_id: str):
    if job_id not in job_status:
        raise HTTPException(status_code=404, detail="Job ID not found")
    return job_status[job_id]

@app.get("/health")
async def health():
    return {"ok": True, "jobs": len(job_status)}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
