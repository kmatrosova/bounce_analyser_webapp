from fastapi import APIRouter, HTTPException
from google.cloud import bigquery
from ..config import GOOGLE_CLOUD_PROJECT_ID, BIGQUERY_DATASET_ID, BIGQUERY_TABLE_NAME, require_config

router = APIRouter()

require_config()
project_id = GOOGLE_CLOUD_PROJECT_ID
dataset_id = BIGQUERY_DATASET_ID

# Initialize BigQuery client using ADC
_bq_client = bigquery.Client(project=project_id)


@router.get("/api/campaigns")
def list_campaigns():
    """Return all campaigns with last_updated and total counts."""
    if not project_id or not dataset_id:
        raise HTTPException(status_code=500, detail="Missing GOOGLE_CLOUD_PROJECT_ID or BIGQUERY_DATASET_ID")

    query = f"""
        SELECT
          campaign_id,
          MAX(timestamp) AS last_updated,
          COUNT(*) AS total
        FROM `{project_id}.{dataset_id}.{BIGQUERY_TABLE_NAME}`
        WHERE campaign_id IS NOT NULL
        GROUP BY campaign_id
        ORDER BY last_updated DESC
        LIMIT 500
    """

    try:
        df = _bq_client.query(query).to_dataframe()
        return [] if df is None or df.empty else df.to_dict("records")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"BigQuery error: {e}")


