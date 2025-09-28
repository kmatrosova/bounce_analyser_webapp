from fastapi import APIRouter, HTTPException
from google.cloud import bigquery
from ..config import GOOGLE_CLOUD_PROJECT_ID, BIGQUERY_DATASET_ID, BIGQUERY_TABLE_NAME, require_config
from typing import Optional

router = APIRouter()

require_config()
project_id = GOOGLE_CLOUD_PROJECT_ID
dataset_id = BIGQUERY_DATASET_ID

# Initialize BigQuery client using ADC
_bq_client = bigquery.Client(project=project_id)


@router.get("/api/campaigns")
def list_campaigns():
    """Return campaigns grouped by client_name with hierarchical structure."""
    if not project_id or not dataset_id:
        raise HTTPException(status_code=500, detail="Missing GOOGLE_CLOUD_PROJECT_ID or BIGQUERY_DATASET_ID")

    query = f"""
        SELECT
          client_name,
          campaign_name,
          campaign_id,
          MAX(timestamp) AS last_updated,
          COUNT(*) AS total
        FROM `{project_id}.{dataset_id}.{BIGQUERY_TABLE_NAME}`
        WHERE campaign_id IS NOT NULL AND client_name IS NOT NULL
        GROUP BY client_name, campaign_name, campaign_id
        ORDER BY client_name, last_updated DESC
        LIMIT 500
    """

    try:
        df = _bq_client.query(query).to_dataframe()
        if df is None or df.empty:
            return []
        
        # Group campaigns by client_name
        clients = {}
        for _, row in df.iterrows():
            client_name = row['client_name']
            if client_name not in clients:
                clients[client_name] = {
                    "client_name": client_name,
                    "campaigns": [],
                    "total_campaigns": 0,
                    "total_bounces": 0,
                    "last_updated": row['last_updated']
                }
            
            campaign = {
                "campaign_id": row['campaign_id'],
                "campaign_name": row['campaign_name'],
                "last_updated": row['last_updated'],
                "total": row['total']
            }
            
            clients[client_name]['campaigns'].append(campaign)
            clients[client_name]['total_campaigns'] += 1
            clients[client_name]['total_bounces'] += row['total']
            
            # Update client's last_updated to the most recent
            if row['last_updated'] > clients[client_name]['last_updated']:
                clients[client_name]['last_updated'] = row['last_updated']
        
        # Convert to list and sort by last_updated
        result = list(clients.values())
        result.sort(key=lambda x: x['last_updated'], reverse=True)
        
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"BigQuery error: {e}")


@router.get("/api/campaigns/{campaign_id}/exists")
def check_campaign_exists(campaign_id: str):
    """Check if a campaign exists. Returns 404 if not found."""
    import logging
    logger = logging.getLogger(__name__)
    
    if not project_id or not dataset_id or not BIGQUERY_TABLE_NAME:
        raise HTTPException(status_code=500, detail="Missing BigQuery configuration")
    
    logger.info(f"Checking campaign existence for ID: {campaign_id}")
    
    query = f"""
        SELECT COUNT(*) as count
        FROM `{project_id}.{dataset_id}.{BIGQUERY_TABLE_NAME}`
        WHERE campaign_id = @campaign_id
    """
    
    try:
        job_config = bigquery.QueryJobConfig(
            query_parameters=[bigquery.ScalarQueryParameter("campaign_id", "STRING", campaign_id)]
        )
        df = _bq_client.query(query, job_config=job_config).to_dataframe()
        count = df.iloc[0]['count'] if not df.empty else 0
        
        logger.info(f"Query result: count = {count} for campaign {campaign_id}")
        
        if count > 0:
            return {"exists": True, "count": int(count), "message": "Campaign exists"}
        else:
            raise HTTPException(status_code=404, detail="Campaign not found")
    except HTTPException:
        # Re-raise HTTPException as-is (including 404s)
        raise
    except Exception as e:
        logger.error(f"BigQuery error for campaign {campaign_id}: {e}")
        raise HTTPException(status_code=500, detail=f"BigQuery error: {e}")


