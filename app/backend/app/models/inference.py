from pydantic import BaseModel
from typing import Dict, List, Optional

class InferenceProgress(BaseModel):
    progress: int
    message: str
    total_rows: int
    processed_batches: int
    title: str
    is_complete: bool = False

class InferenceStats(BaseModel):
    counts: Dict[str, int]
    percentages: Dict[str, float]

class InferenceBreakdown(BaseModel):
    reason: str
    count: int
    percentage: float
    sources: Dict[str, int]

class SourceBreakdown(BaseModel):
    source: str
    count: int
    percentage: float
    reasons: Dict[str, int]

class PivotTable(BaseModel):
    columns: List[str]
    index: List[str]
    data: List[List[int]]

class InferenceResult(BaseModel):
    total_bounces: int
    global_info: Dict[str, int]
    reason_stats: InferenceStats
    source_stats: InferenceStats
    pivot_table: PivotTable
    reason_breakdown: List[InferenceBreakdown]
    source_breakdown: List[SourceBreakdown]
    data: List[Dict]
    title: str
    progress: int
    message: str
    processed_rows: int
    is_complete: bool 