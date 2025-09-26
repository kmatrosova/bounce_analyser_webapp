from fastapi import APIRouter, UploadFile, File, HTTPException
import csv
import io
import requests
from ..config import BOUNCE_PROCESSOR_URL
from google.oauth2 import id_token
from google.auth.transport.requests import Request
import subprocess
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

router = APIRouter()

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


@router.post("/api/upload/csv")
async def upload_csv(file: UploadFile = File(...)):
    if not BOUNCE_PROCESSOR_URL:
        raise HTTPException(status_code=500, detail="BOUNCE_PROCESSOR_URL not configured")

    try:
        content = await file.read()
        text = content.decode("utf-8", errors="replace")
        reader = csv.DictReader(io.StringIO(text))

        inserted = 0
        errors = 0
        last_response = None

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

        for row in reader:
            payload = {
                "data": {
                    "data_source": "webapp",
                    "timestamp": normalize_timestamp(row.get("timestamp")),
                    "message_id": f"webapp_{row.get('campaign_id', 'unknown')}_{row.get('recipient', '')}_{hash(str(row.get('timestamp', '')))}",
                    "campaign_id": row.get("campaign_id") or "unknown",
                    "client_name": row.get("client_name") or row.get("account_id") or "unknown", 
                    "sender_email": row.get("sender") or "",
                    "recipient_email": row.get("recipient") or "",
                    "bounce_message": row.get("bounce_message") or "",
                },
                "callback_url": None,
                "priority": 1,
            }

            try:
                r = requests.post(ingest_url, json=payload, headers=headers, timeout=60)
                last_response = r.text
                if r.status_code == 200:
                    inserted += 1
                else:
                    logger.warning("Ingest failed: %s - %s", r.status_code, r.text)
                    errors += 1
            except Exception as e:
                errors += 1
                last_response = str(e)
                logger.exception("Request to bounce_processor failed")

        return {"ok": True, "inserted": inserted, "errors": errors, "last_response": last_response}

    except Exception as e:
        logger.exception("Upload failed")
        raise HTTPException(status_code=500, detail=f"Upload failed: {e}")


