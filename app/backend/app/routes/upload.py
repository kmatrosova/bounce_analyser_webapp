from fastapi import APIRouter, UploadFile, File, HTTPException, Form, BackgroundTasks
import csv
import io
import aiohttp
import asyncio
from ..config import BOUNCE_PROCESSOR_URL
from google.oauth2 import id_token
from google.auth.transport.requests import Request
import subprocess
import logging
from datetime import datetime
import uuid

logger = logging.getLogger(__name__)

router = APIRouter()

# In-memory storage for task status (in production, use Redis or database)
task_status = {}

def normalize_timestamp(timestamp_str):
    """Normalize timestamp to ISO format that bounce_processor expects"""
    if not timestamp_str:
        return datetime.utcnow().isoformat()
    
    try:
        # Handle 'Z' timezone format (common in ISO timestamps)
        if timestamp_str.endswith('Z'):
            timestamp_str = timestamp_str.replace('Z', '+00:00')
        
        # Ensure it's a valid ISO format
        # If we have a timestamp like "2025-02-04T17:18:21" add timezone
        if '+' not in timestamp_str:
            # Assume UTC if no timezone is present
            timestamp_str += '+00:00'
            
        # Validate it can be parsed
        datetime.fromisoformat(timestamp_str)
        return timestamp_str
    except (ValueError, TypeError):
        logger.warning(f"Invalid timestamp {timestamp_str}, using current time")
        return datetime.utcnow().isoformat()


async def process_csv_background(task_id: str, csv_content: str, client_name: str, campaign_name: str, headers: dict):
    """Process CSV rows in background"""
    try:
        task_status[task_id] = {"status": "processing", "inserted": 0, "errors": 0}
        
        reader = csv.DictReader(io.StringIO(csv_content))
        ingest_url = f"{BOUNCE_PROCESSOR_URL.rstrip('/')}/api/v1/ingest/webapp"
        campaign_id = f"{client_name}-{campaign_name}"
        
        # Process rows concurrently (but limit concurrency to avoid overwhelming the service)
        semaphore = asyncio.Semaphore(10)  # Max 10 concurrent requests
        
        async def process_row(row):
            async with semaphore:
                payload = {
                    "data": {
                        "data_source": "webapp",
                        "timestamp": normalize_timestamp(row.get("timestamp")),
                        "message_id": f"webapp_{campaign_id}_{row.get('recipient', '')}_{hash(str(row.get('timestamp', '')))}",
                        "campaign_id": campaign_id,
                        "campaign_name": campaign_name,
                        "client_id": client_name,
                        "client_name": client_name,
                        "sender_email": row.get("sender") or "",
                        "recipient_email": row.get("recipient") or "",
                        "bounce_message": row.get("bounce_message") or "",
                    },
                    "callback_url": None,
                    "priority": 1,
                }
                
                try:
                    async with aiohttp.ClientSession() as session:
                        async with session.post(ingest_url, json=payload, headers=headers, timeout=30) as response:
                            if response.status == 200:
                                task_status[task_id]["inserted"] += 1
                            else:
                                task_status[task_id]["errors"] += 1
                                logger.warning("Ingest failed: %s - %s", response.status, await response.text())
                except Exception as e:
                    task_status[task_id]["errors"] += 1
                    logger.exception("Request to bounce_processor failed")
        
        # Process all rows concurrently
        tasks = [process_row(row) for row in reader]
        await asyncio.gather(*tasks, return_exceptions=True)
        
        # Mark as completed
        task_status[task_id]["status"] = "completed"
        logger.info(f"Task {task_id} completed: {task_status[task_id]['inserted']} inserted, {task_status[task_id]['errors']} errors")
        
    except Exception as e:
        task_status[task_id]["status"] = "failed"
        task_status[task_id]["error"] = str(e)
        logger.exception(f"Background processing failed for task {task_id}")


@router.post("/api/upload/csv")
async def upload_csv(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    client_name: str = Form(...),
    campaign_name: str = Form(...)
):
    if not BOUNCE_PROCESSOR_URL:
        raise HTTPException(status_code=500, detail="BOUNCE_PROCESSOR_URL not configured")

    try:
        # Generate unique task ID
        task_id = str(uuid.uuid4())
        
        # Read file content
        content = await file.read()
        text = content.decode("utf-8", errors="replace")
        
        # Prepare headers for authentication
        ingest_url = f"{BOUNCE_PROCESSOR_URL.rstrip('/')}/api/v1/ingest/webapp"
        headers = {"Content-Type": "application/json"}
        
        # If calling a private Cloud Run URL, acquire an ID token for audience = service URL
        if ingest_url.startswith("https://") and ".run.app" in ingest_url:
            try:
                target_audience = BOUNCE_PROCESSOR_URL.rstrip('/')
                token = id_token.fetch_id_token(Request(), target_audience)
                headers["Authorization"] = f"Bearer {token}"
            except Exception as e:
                logger.warning("ADC ID token fetch failed, falling back to gcloud: %s", e)
                # Fallback: use gcloud to mint an identity token (dev only)
                try:
                    result = subprocess.run(
                        [
                            "gcloud",
                            "auth",
                            "print-identity-token",
                            f"--audiences={target_audience}",
                        ],
                        check=True,
                        capture_output=True,
                        text=True,
                    )
                    token = result.stdout.strip()
                    headers["Authorization"] = f"Bearer {token}"
                except Exception as e2:
                    logger.exception("Failed to acquire ID token via gcloud")
                    raise HTTPException(status_code=500, detail=f"Failed to acquire ID token (ADC and gcloud): {e2}")

        # Start background processing
        background_tasks.add_task(
            process_csv_background, 
            task_id, 
            text, 
            client_name, 
            campaign_name, 
            headers
        )
        
        # Return immediately with task ID
        return {
            "ok": True, 
            "task_id": task_id, 
            "status": "processing",
            "message": "CSV upload started, processing in background"
        }

    except Exception as e:
        logger.exception("Upload failed")
        raise HTTPException(status_code=500, detail=f"Upload failed: {e}")


@router.get("/api/upload/status/{task_id}")
async def get_upload_status(task_id: str):
    """Get the status of an upload task"""
    if task_id not in task_status:
        raise HTTPException(status_code=404, detail="Task not found")
    
    return task_status[task_id]


