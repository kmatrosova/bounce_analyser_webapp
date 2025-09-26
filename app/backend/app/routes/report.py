from fastapi import APIRouter, HTTPException
from google.cloud import bigquery
import pandas as pd
from ..config import GOOGLE_CLOUD_PROJECT_ID, BIGQUERY_DATASET_ID, BIGQUERY_TABLE_NAME, require_config

router = APIRouter()

require_config()
project_id = GOOGLE_CLOUD_PROJECT_ID
dataset_id = BIGQUERY_DATASET_ID
table_name = BIGQUERY_TABLE_NAME

_bq = bigquery.Client(project=project_id)


@router.get("/api/report/{campaign_id}")
def get_campaign_report(campaign_id: str):
    if not campaign_id:
        raise HTTPException(status_code=400, detail="campaign_id is required")

    query = f"""
        SELECT
          bounce_reason_gpt,
          bounce_source_gpt
        FROM `{project_id}.{dataset_id}.{table_name}`
        WHERE campaign_id = @campaign_id
    """
    try:
        job_config = bigquery.QueryJobConfig(
            query_parameters=[bigquery.ScalarQueryParameter("campaign_id", "STRING", campaign_id)]
        )
        df = _bq.query(query, job_config=job_config).to_dataframe()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"BigQuery error: {e}")

    if df is None or df.empty:
        return {
            "total_bounces": 0,
            "global_info": {"total_bounces": 0},
            "reason_stats": {"counts": {}, "percentages": {}},
            "source_stats": {"counts": {}, "percentages": {}},
            "pivot_table": {},
            "reason_breakdown": {},
            "source_breakdown": {},
            "title": campaign_id,
        }

    # Normalize columns expected by frontend components
    # Create fallback columns 'bounce_reason' and 'bounce_source'
    df = df.copy()
    if "bounce_reason" not in df.columns:
        df["bounce_reason"] = df.get("bounce_reason_gpt").fillna("") if "bounce_reason_gpt" in df.columns else ""
    if "bounce_source" not in df.columns:
        df["bounce_source"] = df.get("bounce_source_gpt").fillna("") if "bounce_source_gpt" in df.columns else ""

    # Ensure string type
    df["bounce_reason"] = df["bounce_reason"].astype(str).fillna("")
    df["bounce_source"] = df["bounce_source"].astype(str).fillna("")

    total_bounces = int(len(df))

    # Reason stats
    reason_counts = df["bounce_reason"].value_counts()
    reason_percentages = ((reason_counts / total_bounces * 100).round(2)) if total_bounces else pd.Series(dtype=float)

    # Source stats
    source_counts = df["bounce_source"].value_counts()
    source_percentages = ((source_counts / total_bounces * 100).round(2)) if total_bounces else pd.Series(dtype=float)

    # Pivot table counts
    if total_bounces:
        pivot = pd.pivot_table(df, index="bounce_reason", columns="bounce_source", aggfunc="size", fill_value=0)
        pivot_dict = {str(reason): {str(src): int(cnt) for src, cnt in pivot.loc[reason].items()} for reason in pivot.index}
    else:
        pivot_dict = {}

    # Breakdown dicts
    reason_breakdown = {}
    for reason in reason_counts.index:
        sub = df[df["bounce_reason"] == reason]
        rb_counts = sub["bounce_source"].value_counts()
        reason_breakdown[str(reason)] = {"counts": {str(k): int(v) for k, v in rb_counts.to_dict().items()}}

    source_breakdown = {}
    for source in source_counts.index:
        sub = df[df["bounce_source"] == source]
        sb_counts = sub["bounce_reason"].value_counts()
        source_breakdown[str(source)] = {"counts": {str(k): int(v) for k, v in sb_counts.to_dict().items()}}

    return {
        "total_bounces": total_bounces,
        "global_info": {"total_bounces": total_bounces},
        "reason_stats": {
            "counts": {str(k): int(v) for k, v in reason_counts.to_dict().items()},
            "percentages": {str(k): float(v) for k, v in reason_percentages.to_dict().items()},
        },
        "source_stats": {
            "counts": {str(k): int(v) for k, v in source_counts.to_dict().items()},
            "percentages": {str(k): float(v) for k, v in source_percentages.to_dict().items()},
        },
        "pivot_table": pivot_dict,
        "reason_breakdown": reason_breakdown,
        "source_breakdown": source_breakdown,
        "title": campaign_id,
    }


