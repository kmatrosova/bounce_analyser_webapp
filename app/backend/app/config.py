import os
from dotenv import load_dotenv

# Load .env from project root if present
load_dotenv()

GOOGLE_CLOUD_PROJECT_ID = os.getenv("GOOGLE_CLOUD_PROJECT_ID", "")
BIGQUERY_DATASET_ID = os.getenv("BIGQUERY_DATASET_ID", "")
BOUNCE_PROCESSOR_URL = os.getenv("BOUNCE_PROCESSOR_URL", "")
BIGQUERY_TABLE_NAME = os.getenv("BIGQUERY_TABLE_NAME", "bounced_emails")

def require_config() -> None:
    missing = []
    if not GOOGLE_CLOUD_PROJECT_ID:
        missing.append("GOOGLE_CLOUD_PROJECT_ID")
    if not BIGQUERY_DATASET_ID:
        missing.append("BIGQUERY_DATASET_ID")
    if missing:
        raise RuntimeError(f"Missing required environment variables: {', '.join(missing)}")


