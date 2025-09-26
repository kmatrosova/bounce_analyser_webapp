from fastapi import APIRouter, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse
import pandas as pd
import os
from datetime import datetime
import logging
from ..services.inference_services import InferenceService
from ..models.inference import InferenceProgress, InferenceResult
import json

router = APIRouter()
logger = logging.getLogger(__name__)

# Store inference progress
inference_progress = {}

@router.post("/api/analyze")
async def analyze_file(
    file: UploadFile = File(...),
    background_tasks: BackgroundTasks = None
):
    try:
        # Generate task ID
        task_id = f"inference_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        # Read the CSV file
        contents = await file.read()
        df = pd.read_csv(pd.io.common.BytesIO(contents))
        
        # Extract title from filename
        title = file.filename.replace('.csv', '')
        
        # Save the original file
        os.makedirs("data/raw", exist_ok=True)
        file_path = f"data/raw/{task_id}.csv"
        with open(file_path, "wb") as f:
            f.write(contents)
        
        # Initialize progress
        inference_progress[task_id] = InferenceProgress(
            progress=0,
            message="File uploaded, ready to start processing...",
            total_rows=len(df),
            processed_batches=0,
            title=title,
            is_complete=False
        )
        
        # Start inference in background
        inference_service = InferenceService(task_id, inference_progress)
        background_tasks.add_task(inference_service.run_inference, df, file_path, task_id)
        
        # Return task ID and initial info
        return {
            "task_id": task_id,
            "total_rows": len(df),
            "title": title
        }
            
    except Exception as e:
        logger.error(f"Error in analyze_file: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api/progress/{task_id}", response_model=InferenceProgress)
async def get_progress(task_id: str):
    
    if task_id not in inference_progress:
        logger.error(f"Task {task_id} not found in inference_progress")
        raise HTTPException(status_code=404, detail="Task not found")
    
    return inference_progress[task_id]

@router.get("/api/analyze/{task_id}")
async def get_analysis_results(task_id: str):
    
    # Construct the path to the labeled data file
    labeled_data_path = os.path.join("data", "labeled", f"{task_id}_labeled.csv")
    metadata_path = os.path.join("data", "labeled", f"{task_id}_metadata.json")
    
    if not os.path.exists(labeled_data_path):
        logger.error(f"Labeled data file not found: {labeled_data_path}")
        raise HTTPException(status_code=404, detail="Analysis results not found")
    
    try:
        # Read the labeled data
        df = pd.read_csv(labeled_data_path)
        
        # Read the metadata file to get the original title
        title = task_id.replace('inference_', '')  # Default fallback
        if os.path.exists(metadata_path):
            with open(metadata_path, 'r') as f:
                metadata = json.load(f)
                title = metadata.get('title', title)
        
        # Fill NaN values with empty strings for string columns
        df['bounce_reason'] = df['bounce_reason'].fillna('')
        df['bounce_source'] = df['bounce_source'].fillna('')
        
        # Calculate statistics
        total_bounces = len(df)
        
        # Calculate bounce reasons
        reason_counts = df['bounce_reason'].value_counts()
        reason_percentages = (reason_counts / total_bounces * 100).round(2)
        reason_stats = {
            'counts': {str(k): int(v) for k, v in reason_counts.to_dict().items()},
            'percentages': {str(k): float(v) for k, v in reason_percentages.to_dict().items()}
        }
        
        # Calculate bounce sources
        source_counts = df['bounce_source'].value_counts()
        source_percentages = (source_counts / total_bounces * 100).round(2)
        source_stats = {
            'counts': {str(k): int(v) for k, v in source_counts.to_dict().items()},
            'percentages': {str(k): float(v) for k, v in source_percentages.to_dict().items()}
        }
        
        # Calculate pivot table with proper NaN handling
        pivot = pd.pivot_table(
            df,
            index='bounce_reason',
            columns='bounce_source',
            aggfunc='size',
            fill_value=0
        )
        
        # Convert pivot table to dict and ensure all values are JSON serializable
        pivot_dict = {}
        for reason in pivot.index:
            pivot_dict[str(reason)] = {
                str(source): int(count) for source, count in pivot.loc[reason].items()
            }
        
        # Calculate source breakdown for each reason
        reason_breakdown = {}
        for reason in reason_counts.index:
            reason_df = df[df['bounce_reason'] == reason]
            breakdown_source_counts = reason_df['bounce_source'].value_counts()
            reason_breakdown[str(reason)] = {
                'counts': {str(k): int(v) for k, v in breakdown_source_counts.to_dict().items()}
            }
        
        # Calculate reason breakdown for each source
        source_breakdown = {}
        for source in source_counts.index:
            source_df = df[df['bounce_source'] == source]
            breakdown_reason_counts = source_df['bounce_reason'].value_counts()
            source_breakdown[str(source)] = {
                'counts': {str(k): int(v) for k, v in breakdown_reason_counts.to_dict().items()}
            }
        
        # Prepare response data
        response_data = {
            "total_bounces": int(total_bounces),
            "global_info": {
                "total_bounces": int(total_bounces)
            },
            "reason_stats": reason_stats,
            "source_stats": source_stats,
            "pivot_table": pivot_dict,
            "reason_breakdown": reason_breakdown,
            "source_breakdown": source_breakdown,
            "title": title
        }
        
        return response_data
        
    except Exception as e:
        logger.error(f"Error reading labeled data: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error reading analysis results: {str(e)}") 