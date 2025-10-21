'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { BounceData, Client } from '@/types';

interface FileUploadProps {
  onDataLoaded: (data: BounceData) => void;
  onTaskStarted: (clientName: string, campaignName: string) => void;
  onClose: () => void;
  // Optional props for pre-populating existing campaign
  prefilledClientName?: string;
  prefilledCampaignName?: string;
  isAddingData?: boolean; // To disable editing client/campaign when adding to existing
  clients?: Client[]; // List of existing clients for dropdown
}

interface ProgressData {
  progress: number;
  message: string;
  total_rows?: number;
  processed_batches?: number;
}

export default function FileUpload({ onDataLoaded, onTaskStarted, onClose, prefilledClientName, prefilledCampaignName, isAddingData, clients = [] }: FileUploadProps) {
  // API URL - use proxy API route for authenticated backend requests
  const API_URL = typeof window !== 'undefined' && window.location.hostname.includes('run.app')
    ? '/api/proxy'  // Use proxy route in production (adds Cloud Run auth)
    : 'http://localhost:8081';  // Direct to backend in local dev
  
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [progressData, setProgressData] = useState<ProgressData | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const pollTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  
  // New fields for client and campaign
  const [clientName, setClientName] = useState(prefilledClientName || '');
  const [campaignName, setCampaignName] = useState(prefilledCampaignName || '');
  const [fileSelected, setFileSelected] = useState<File | null>(null);
  const [isCheckingCampaign, setIsCheckingCampaign] = useState(false);
  const [campaignExists, setCampaignExists] = useState<boolean | null>(null);
  const [showClientDropdown, setShowClientDropdown] = useState(false);

  const updateProgress = useCallback((data: ProgressData) => {
    setProgress(data.progress);
    setProgressMessage(data.message);
    setProgressData(data);
  }, []);

  const pollProgress = useCallback(async (currentTaskId: string) => {
    try {
      const response = await fetch(`http://localhost:8000/api/progress/${currentTaskId}`);
      const data = await response.json();
      
      updateProgress(data);
      
      if (data.progress === 100 && data.is_complete) {
        const finalResponse = await fetch(`http://localhost:8000/api/analyze/${currentTaskId}`);
        const finalData = await finalResponse.json();
        onDataLoaded(finalData);
        onClose();
      } else {
        pollTimeoutRef.current = setTimeout(() => pollProgress(currentTaskId), 1000);
      }
    } catch (error) {
      console.error('Error polling progress:', error);
      setError('Error checking progress');
    }
  }, [onDataLoaded, onClose, updateProgress]);

  useEffect(() => {
    let isMounted = true;

    const startPolling = async () => {
      if (taskId && isMounted) {
        await pollProgress(taskId);
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
    setFileSelected(file);
    setError(null);
    setCampaignExists(null);
  };

  const checkExistingCampaign = async (clientName: string, campaignName: string) => {
    setIsCheckingCampaign(true);
    try {
      const campaignId = `${clientName}-${campaignName}`;
      const response = await fetch(`${API_URL}/api/campaigns/${encodeURIComponent(campaignId)}/exists`);
      const exists = response.status === 200;
      setCampaignExists(exists);
    } catch (error) {
      console.error('Error checking campaign:', error);
      // Assume campaign does not exist if check fails
      setCampaignExists(false);
    } finally {
      setIsCheckingCampaign(false);
    }
  };

  const handleClientCampaignChange = () => {
    if (clientName.trim() && campaignName.trim()) {
      checkExistingCampaign(clientName.trim(), campaignName.trim());
    }
  };

  // Filter clients based on current input
  const filteredClients = clients.filter(client => 
    client.client_name.toLowerCase().includes(clientName.toLowerCase())
  );

  // Initialize prefilled values on mount/prop changes
  useEffect(() => {
    if (prefilledClientName) {
      setClientName(prefilledClientName);
    }
    if (prefilledCampaignName) {
      setCampaignName(prefilledCampaignName);
    }
  }, [prefilledClientName, prefilledCampaignName]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showClientDropdown) {
        const target = event.target as Element;
        // Don't close if clicking on the input field, dropdown button, or dropdown content
        if (!target.closest('.client-dropdown-container')) {
          setShowClientDropdown(false);
        }
      }
    };

    if (showClientDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showClientDropdown]);

  const handleUpload = async () => {
    if (!fileSelected || !clientName.trim() || !campaignName.trim()) {
      setError('Please select a file, client name, and campaign name');
      return;
    }

    // Only check campaign conflicts when creating a new campaign
    if (!isAddingData && campaignExists) {
      setError(`This client already has a campaign named "${campaignName.trim()}". Please choose a different campaign name.`);
      return;
    }

    try {
      setError(null);
      setIsLoading(true);
      
      // Immediately create task/campaign with loading state
      onTaskStarted(clientName.trim(), campaignName.trim());
      
      // Close popup immediately
      onClose();

      // Handle upload in background without blocking
      const formData = new FormData();
      formData.append('file', fileSelected);
      formData.append('client_name', clientName.trim());
      formData.append('campaign_name', campaignName.trim());

      fetch(`${API_URL}/api/upload/csv`, {
        method: 'POST',
        body: formData,
      })
      .then(response => {
        if (!response.ok) {
          throw new Error(`Upload failed: ${response.statusText}`);
        }
        return response.json();
      })
      .then(result => {
        console.log('Upload started:', result);
        // The upload is now processing in background
        if (result.task_id) {
          setTaskId(result.task_id);
        }
        setIsLoading(false);
      })
      .catch(error => {
        console.error('Upload failed:', error);
        setIsLoading(false);
      });
      
    } catch (error) {
      console.error('Error:', error);
      setIsLoading(false);
      setError(error instanceof Error ? error.message : 'An error occurred');
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

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  return (
    <div className="w-full space-y-4">
      {/* Client and Campaign name fields - always visible */}
      <div className="space-y-4">
        <div className="relative client-dropdown-container">
          <label htmlFor="client-name" className="block text-sm font-medium text-gray-700">
            Client Name
          </label>
          <div className="relative">
            <input
              type="text"
              id="client-name"
              value={clientName}
              onChange={(e) => {
                setClientName(e.target.value);
                // Keep dropdown open while typing if there are clients and not adding data
                if (clients.length > 0 && !isAddingData) {
                  setShowClientDropdown(true);
                }
                if (e.target.value.trim()) {
                  handleClientCampaignChange();
                }
              }}
              onFocus={() => {
                if (clients.length > 0 && !isAddingData) {
                  setShowClientDropdown(true);
                }
              }}
              className={`mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm border border-gray-300 px-3 py-2 pr-8 ${isAddingData ? 'bg-gray-100 text-gray-500' : ''}`}
              placeholder="Enter client name"
              disabled={isLoading || isAddingData}
            />
            {clients.length > 0 && !isAddingData && (
              <button
                type="button"
                onClick={() => setShowClientDropdown(!showClientDropdown)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-auto"
              >
                <svg
                  className={`h-4 w-4 text-gray-400 transition-transform ${showClientDropdown ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            )}
          </div>
          
          {/* Client dropdown */}
          {showClientDropdown && clients.length > 0 && !isAddingData && (
            <div className="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none">
              {filteredClients.length > 0 ? (
                filteredClients.map((client) => (
                  <button
                    key={client.client_name}
                    type="button"
                    onClick={() => {
                      setClientName(client.client_name);
                      setShowClientDropdown(false);
                      if (campaignName.trim()) {
                        checkExistingCampaign(client.client_name, campaignName.trim());
                      }
                    }}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                  >
                    <div className="flex justify-between items-center">
                      <span>{client.client_name}</span>
                      <span className="text-xs text-gray-500">{client.total_campaigns} campaigns</span>
                    </div>
                  </button>
                ))
              ) : (
                <div className="px-4 py-2 text-sm text-gray-500 italic">
                  No matching clients
                </div>
              )}
            </div>
          )}
        </div>

        <div>
          <label htmlFor="campaign-name" className="block text-sm font-medium text-gray-700">
            Campaign Name
          </label>
            <input
              type="text"
              id="campaign-name"
              value={campaignName}
              onChange={(e) => {
                setCampaignName(e.target.value);
                if (clientName.trim() && e.target.value.trim()) {
                  checkExistingCampaign(clientName.trim(), e.target.value.trim());
                }
              }}
              className={`mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm border border-gray-300 px-3 py-2 ${isAddingData ? 'bg-gray-100 text-gray-500' : ''}`}
              placeholder="Enter campaign name"
              disabled={isLoading || isAddingData}
            />
          {!isAddingData && isCheckingCampaign && (
            <p className="mt-1 text-sm text-gray-500">Checking if campaign exists...</p>
          )}
          {!isAddingData && campaignExists === true && (
            <p className="mt-1 text-sm text-red-600">
              This client already has a campaign named &ldquo;{campaignName}&rdquo;. Please choose a different campaign name.
            </p>
          )}
          {!isAddingData && campaignExists === false && (
            <p className="mt-1 text-sm text-green-600">
              Campaign name is available.
            </p>
          )}
        </div>
      </div>

      {/* File upload area */}
      {!fileSelected ? (
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
                <p className="text-sm font-medium">
                  Drag and drop your CSV file here, or click to select
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Only CSV files are supported
                </p>
              </div>
            </div>
          </label>
        </div>
      ) : (
        <div className="border rounded-lg p-4">
          <div className="flex items-center">
            <svg
              className="w-8 h-8 text-green-500 mr-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">{fileSelected.name}</p>
              <p className="text-xs text-gray-500">File selected</p>
            </div>
            <button
              onClick={() => { setFileSelected(null); setError(null); }}
              className="text-sm border rounded px-2 py-1"
            >
              Change
            </button>
          </div>
        </div>
      )}

      {/* Upload button and progress - always visible if file is selected */}
      {fileSelected && (
        <div className="space-y-4">
          <div className="flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              onClick={handleUpload}
              disabled={isLoading || campaignExists === true || !clientName.trim() || !campaignName.trim() || !fileSelected}
              className={`px-4 py-2 text-sm rounded-lg text-white ${
                isLoading || campaignExists === true || !clientName.trim() || !campaignName.trim() || !fileSelected
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700'
              }`}
            >
              {isLoading ? (
                <div className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {progressMessage}
                </div>
              ) : (
                'Upload'
              )}
            </button>
          </div>

          {isLoading && (
            <div className="space-y-2">
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
          )}
        </div>
      )}

      {error && (
        <div className="mt-4 text-red-600 text-sm text-center bg-red-50 border border-red-200 rounded p-3">{error}</div>
      )}
    </div>
  );
}