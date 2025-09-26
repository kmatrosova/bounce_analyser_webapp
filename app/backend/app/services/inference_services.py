"""Inference service for processing bounce analysis requests."""

import asyncio
import json
import logging
import os
from typing import Dict, List, Tuple
from concurrent.futures import ThreadPoolExecutor

import pandas as pd
from functools import partial

from core.inference.bounce_inference import BounceInference
from core.utils import prepare_batches

from core.config import DEFAULT_BATCHING, MAX_CONCURRENT_TASKS

logger = logging.getLogger(__name__)


class InferenceService:
    """Service for handling bounce analysis inference with progress tracking."""

    def __init__(self, task_id: str, progress_dict: Dict):
        """Initialize the inference service.

        Args:
            task_id: Unique identifier for the inference task.
            progress_dict: Shared dictionary for storing progress updates.
        """
        self.task_id = task_id
        self.progress_dict = progress_dict
        self.batching = DEFAULT_BATCHING
        self.max_concurrent_tasks = MAX_CONCURRENT_TASKS  # Number of batches to process in parallel

    def update_progress(
        self,
        progress: int,
        message: str,
        processed_batches: int = None,
        is_complete: bool = False
    ) -> None:
        """Update progress in the shared dictionary.

        Args:
            progress: Progress percentage (0-100).
            message: Status message.
            processed_batches: Number of batches processed.
            is_complete: Whether the task is complete.
        """
        if self.task_id not in self.progress_dict:
            logger.error(f"Task {self.task_id} not found in progress dictionary")
            return

        current_progress = self.progress_dict[self.task_id]
        current_progress.progress = progress
        current_progress.message = message
        if processed_batches is not None:
            current_progress.processed_batches = processed_batches
        current_progress.is_complete = is_complete

    async def process_batch(
        self,
        batch: List[str],
        batch_num: int,
        total_batches: int
    ) -> Tuple[List[str], List[str]]:
        """Process a single batch of messages.

        Args:
            batch: List of messages to process.
            batch_num: Current batch number.
            total_batches: Total number of batches.

        Returns:
            Tuple of (source_predictions, reason_predictions).
        """
        try:
            loop = asyncio.get_running_loop()
            
            with ThreadPoolExecutor() as pool:
                # Run blocking I/O calls in a separate thread
                source_future = loop.run_in_executor(
                    pool, partial(self.source_inference.predict, batch)
                )
                reason_future = loop.run_in_executor(
                    pool, partial(self.reason_inference.predict, batch)
                )

                # Await the results from the thread pool
                source_predictions, reason_predictions = await asyncio.gather(
                    source_future, reason_future
                )

                return source_predictions, reason_predictions
        except Exception as e:
            logger.error(f"Error processing batch {batch_num}: {str(e)}")
            raise

    async def run_inference(
        self,
        df: pd.DataFrame,
        file_path: str,
        task_id: str
    ) -> pd.DataFrame:
        """Run inference on the dataset with proper progress tracking.

        Args:
            df: DataFrame containing messages to analyze.
            file_path: Path to the uploaded file.
            task_id: Unique identifier for the task.

        Returns:
            DataFrame with predictions added.

        Raises:
            Exception: If inference fails.
        """
        try:
            # Initialize inference objects (will auto-load models from logs)
            self.source_inference = BounceInference.from_model_info('source', self.batching)
            self.reason_inference = BounceInference.from_model_info('reason', self.batching)

            # Get messages from DataFrame
            messages = df['reply_message'].astype(str).tolist()
            total_messages = len(messages)

            # Initialize progress
            self.update_progress(
                progress=0,
                message="Starting analysis...",
                processed_batches=0
            )

            # Create batches using shared utility
            batches = prepare_batches(messages, 'source', self.batching)  # Using source as default
            total_batches = len(batches)

            logger.info(f"Created {total_batches} batches for {total_messages} messages")

            # Process batches with concurrency control
            all_source_predictions = []
            all_reason_predictions = []

            for i in range(0, total_batches, self.max_concurrent_tasks):
                batch_group = batches[i:i + self.max_concurrent_tasks]
                batch_tasks = [
                    self.process_batch(
                        batch,
                        i + j + 1,
                        total_batches
                    )
                    for j, batch in enumerate(batch_group)
                ]

                # Wait for all batches in the group to complete
                results = await asyncio.gather(*batch_tasks)

                # Extend predictions
                for source_preds, reason_preds in results:
                    all_source_predictions.extend(source_preds)
                    all_reason_predictions.extend(reason_preds)

                # Update progress after entire group completes
                processed_batches = i + len(batch_group)
                progress = min(100, int((processed_batches / total_batches) * 100))
                self.update_progress(
                    progress=progress,
                    message=f"Processed {processed_batches}/{total_batches} batches",
                    processed_batches=processed_batches
                )

            # Create combined DataFrame with results
            df_combined = df.copy()
            df_combined['bounce_source'] = all_source_predictions
            df_combined['bounce_reason'] = all_reason_predictions

            # Save labeled data
            os.makedirs("data/labeled", exist_ok=True)
            labeled_path = f"data/labeled/{task_id}_labeled.csv"
            df_combined.to_csv(labeled_path, index=False)

            # Save metadata
            metadata_path = f"data/labeled/{task_id}_metadata.json"
            with open(metadata_path, 'w') as f:
                json.dump({
                    'task_id': task_id,
                    'total_rows': total_messages,
                    'processed_batches': total_batches,
                    'source_model_id': self.source_inference.model_id,
                    'reason_model_id': self.reason_inference.model_id
                }, f)

            # Update final progress
            self.update_progress(
                progress=100,
                message="Analysis complete!",
                processed_batches=total_batches,
                is_complete=True
            )

            logger.info(f"Inference completed successfully for task {task_id}")
            return df_combined

        except Exception as e:
            logger.error(f"Error in run_inference: {str(e)}")
            self.update_progress(
                progress=0,
                message=f"Error: {str(e)}",
                processed_batches=0
            )
            raise 