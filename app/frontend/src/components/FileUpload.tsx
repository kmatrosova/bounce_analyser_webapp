'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { BounceData } from '@/types';

interface FileUploadProps {
  onDataLoaded: (data: BounceData, fileName: string) => void;
  onTaskStarted: (taskId: string, fileName: string) => void;
  onClose: () => void;
}

interface ProgressData {
  progress: number;
  message: string;
  total_rows?: number;
  processed_batches?: number;
}

export default function FileUpload({ onDataLoaded, onTaskStarted, onClose }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [taskId, setTaskId] = useState<string | null>(null);
  const [progressData, setProgressData] = useState<ProgressData | null>(null);
  const pollTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const [totalRows, setTotalRows] = useState<number | undefined>(undefined);
  const [processedRows, setProcessedRows] = useState<number | undefined>(undefined);
  const [title, setTitle] = useState<string | undefined>(undefined);

  const updateProgress = useCallback((data: ProgressData) => {
    setProgress(data.progress);
    setProgressMessage(data.message);
    setProgressData(data);
    setTotalRows(data.total_rows);
    setProcessedRows(data.processed_batches);
  }, []);

  const pollProgress = useCallback(async () => {
    if (!taskId) return;
    
    try {
      const response = await fetch(`http://localhost:8000/api/progress/${taskId}`);
      const data = await response.json();
      
      updateProgress(data);
      
      if (data.progress === 100 && data.is_complete) {
        const finalResponse = await fetch(`http://localhost:8000/api/analyze/${taskId}`);
        const finalData = await finalResponse.json();
        onDataLoaded(finalData, data.title || '');
        onClose();
      } else {
        pollTimeoutRef.current = setTimeout(pollProgress, 1000);
      }
    } catch (error) {
      console.error('Error polling progress:', error);
      setError('Error checking progress');
    }
  }, [taskId, onDataLoaded, onClose, updateProgress]);

  useEffect(() => {
    let isMounted = true;

    const startPolling = async () => {
      if (taskId && isMounted) {
        await pollProgress();
      }
    };

    if (taskId) {
      startPolling();
    }

    return () => {
      isMounted = false;
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
      }
    };
  }, [taskId, pollProgress]);

  const handleFile = async (file: File) => {
    try {
      setError(null);
      setProgress(0);
      setProgressMessage("Uploading file...");
      setTaskId(null);
      setIsLoading(true);

      const formData = new FormData();
      formData.append('file', file);

      // Upload file to webapp backend which will forward rows to bounce_processor
      const uploadResponse = await fetch('http://localhost:8081/api/upload/csv', {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.statusText}`);
      }

      const result = await uploadResponse.json();
      setProgressMessage("Upload complete. Records inserted via bounce_processor.");
      setProgress(100);
      setIsLoading(false);
      // No local processing; close modal
      onClose();
    } catch (error) {
      console.error('Error:', error);
      setError(error instanceof Error ? error.message : 'An error occurred');
      setProgress(0);
      setProgressMessage("Upload failed");
      setIsLoading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      await handleFile(file);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await handleFile(file);
    }
  };

  return (
    <div className="w-full">
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center ${
          isDragging ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300'
        } ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          type="file"
          accept=".csv"
          onChange={handleFileSelect}
          className="hidden"
          id="file-upload"
          disabled={isLoading}
        />
        <label
          htmlFor="file-upload"
          className="cursor-pointer"
        >
          <div className="space-y-4">
            <div className="flex justify-center">
              <svg
                className="w-12 h-12 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
            </div>
            <div className="text-gray-600">
              {isLoading ? (
                <div className="space-y-2">
                  <div className="text-sm font-medium">{progressMessage}</div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div
                      className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                  <div className="text-sm text-gray-500">
                    {progressData?.processed_batches && progressData?.total_rows
                      ? `Processing batch ${progressData.processed_batches} of ${progressData.total_rows} (${progress}%)`
                      : `${progress}%`}
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-sm font-medium">
                    Drag and drop your CSV file here, or click to select
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Only CSV files are supported
                  </p>
                </>
              )}
            </div>
          </div>
        </label>
      </div>
      {error && (
        <div className="mt-4 text-red-600 text-sm text-center">{error}</div>
      )}
    </div>
  );
}