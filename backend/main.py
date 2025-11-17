from fastapi import FastAPI, BackgroundTasks, HTTPException
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

# --- CONFIGURATION & CLIENT INITIALIZATION ---
load_dotenv()

# Environment Variables
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY")
AWS_REGION = os.getenv("AWS_REGION")
S3_BUCKET_NAME = os.getenv("S3_BUCKET_NAME")

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

# --- FASTAPI SETUP ---
app = FastAPI()

origins = [
    "http://localhost", 
    "http://localhost:5173",
    "http://127.0.0.1:5173"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

class VideoRequest(BaseModel):
    script: str
    style: str

# Global dictionary to track job statuses
job_status = {}

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
            # The Nova Reel output is in the specified S3 URI, under a folder named after the invocation ID
            # e.g., s3://<BUCKET>/jobs/<invocation_id>/output.mp4
            arn_parts = invocation_arn.split('/')
            # The last part of the ARN (after the last '/') is the invocation ID
            invocation_id = arn_parts[-1] 
            
            # Construct the final S3 key based on where we told Nova Reel to write
            final_s3_key = f"jobs/{invocation_id}/output.mp4"
            
            # Generate a temporary, public pre-signed URL for the video (valid for 1 hour)
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


# --- CORE BACKGROUND TASK ---

def generate_video_task(job_id: str, request: VideoRequest):
    print(f"Starting job {job_id} for script: {request.script[:30]}...")
    
    # --- PHASE 1: Script Analysis and Prompt Generation (Gemini) ---
    job_status[job_id]['status'] = "ANALYZING_SCRIPT"
    scenes = []

    if nlp:
        doc = nlp(request.script)
        scenes = [sent.text for sent in doc.sents]
    else:
        # Fallback to simple split if Spacy fails
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
                
                # Use a maximum of 512 characters for the Bedrock prompt limit
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

    # --- PHASE 2: Bedrock T2V Invocation (START) ---
    job_status[job_id]['status'] = 'INVOKING_BEDROCK'
    invocation_arns = []
    
    # Bedrock Nova Reel writes directly to this S3 prefix
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
                    "seed": random.randint(0, 2147483646) # Ensure unique results
                },
            }
            
            try:
                response = bedrock_runtime.start_async_invoke(
                    modelId="amazon.nova-reel-v1:0", # Current Nova Reel Model ID
                    modelInput=model_input,
                    outputDataConfig={"s3OutputDataConfig": {"s3Uri": s3_output_uri}}
                )
                invocation_arns.append(response['invocationArn'])
            except Exception as e:
                print(f"Bedrock Invocation Error for clip {i + 1}: {e}")
                invocation_arns.append(None) 
            
            time.sleep(2) 

    # --- PHASE 3: Bedrock Polling (WAIT) ---
    job_status[job_id]['status'] = 'POLLING_CLIPS'
    clip_urls = []
    max_wait_time_minutes = 10 # Set a reasonable limit for T2V
    start_time = time.time()
    
    while time.time() - start_time < (max_wait_time_minutes * 60) and len(clip_urls) < num_clips:
        
        # Check jobs that haven't been completed yet (length of clip_urls tracks completed jobs)
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
                clip_urls.append("FAILED_CLIP") # Handle jobs that failed to start

        if len(clip_urls) == num_clips:
            break
            
        time.sleep(15) # Wait 15 seconds between polling attempts

    # --- PHASE 4: Final Assembly and Status Update ---
    
    successful_clips = [url for url in clip_urls if url and url != "FAILED_CLIP"]
    
    if successful_clips:
        # NOTE: In a professional app, you would use MoviePy/FFmpeg here on a separate EC2/ECS container 
        # to stitch all clips in 'successful_clips' into one final video.
        # For simplicity, we use the first successful clip's URL as the final output.
        final_video_url = successful_clips[0] 
        
        job_status[job_id]['status'] = 'COMPLETED'
        job_status[job_id]['video_url'] = final_video_url
        job_status[job_id]['progress'] = f"Assembly complete. {len(successful_clips)}/{num_clips} clips successful."
    else:
        job_status[job_id]['status'] = 'FAILED'
        job_status[job_id]['video_url'] = None
        job_status[job_id]['progress'] = 'T2V generation failed for all clips.'

    print(f"Job {job_id} FINAL STATUS: {job_status[job_id]['status']}. URL: {job_status[job_id]['video_url']}")


# --- FASTAPI ENDPOINTS ---

@app.post("/generate")
async def create_video_job(request: VideoRequest, background_tasks: BackgroundTasks):
    if not ai_client or not bedrock_runtime:
        raise HTTPException(status_code=503, detail="Service not configured: Missing GEMINI API Key or AWS Bedrock Access.")

    job_id = str(uuid.uuid4())
    job_status[job_id] = {
        'status': 'QUEUED',
        'progress': 'Awaiting generation...',
        'video_url': None,
        'request': request.dict() 
    }
    background_tasks.add_task(generate_video_task, job_id, request)
    return {"job_id": job_id, "status": job_status[job_id]['status']}

@app.get("/status/{job_id}")
async def get_video_status(job_id: str):
    if job_id not in job_status:
        raise HTTPException(status_code=404, detail="Job ID not found")
    return job_status[job_id]


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)