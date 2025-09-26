'use client';

import { useState } from 'react';
import FileUpload from './FileUpload';
import { BounceData } from '@/types';

interface Campaign {
  id: string;
  name: string;
  date: string;
  totalBounces: number;
  data: BounceData | null;
  taskId?: string;
  isLoading?: boolean;
  progress?: number;
  progressMessage?: string;
}

interface CampaignHistoryProps {
  campaigns: Campaign[];
  onCampaignSelect: (campaignId: string) => void;
  onNewCampaign: (data: BounceData, fileName: string) => void;
  onTaskStarted: (taskId: string, fileName: string) => void;
}

export default function CampaignHistory({ campaigns, onCampaignSelect, onNewCampaign, onTaskStarted }: CampaignHistoryProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null);

  const handleDataLoaded = (data: BounceData, fileName: string) => {
    onNewCampaign(data, fileName);
    setShowUpload(false);
  };

  const handleTaskStarted = (taskId: string, fileName: string) => {
    onTaskStarted(taskId, fileName);
    setShowUpload(false);
  };

  const handleCampaignSelect = (campaignId: string) => {
    setSelectedCampaign(campaignId);
    onCampaignSelect(campaignId);
  };

  return (
    <>
      <div className={`fixed left-0 top-0 h-full bg-white shadow-lg transition-all duration-300 z-50 ${
        isOpen ? 'w-64' : 'w-12'
      }`}>
        {/* Toggle button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="absolute -right-3 top-4 bg-white rounded-full p-1 shadow-md hover:bg-gray-50 z-50"
        >
          <svg
            className={`w-4 h-4 transform transition-transform ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {/* Content */}
        <div className={`h-full flex flex-col ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          {/* Header */}
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold">Campaigns</h2>
            <button
              onClick={() => setShowUpload(true)}
              className="mt-2 w-full bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors"
            >
              Add new campaign
            </button>
          </div>

          {/* Campaign list */}
          <div className="flex-1 overflow-y-auto p-4">
            {campaigns.map((campaign) => (
              <button
                key={campaign.id}
                onClick={() => handleCampaignSelect(campaign.id)}
                className={`w-full text-left p-3 rounded-md hover:bg-gray-50 mb-2 transition-colors ${
                  campaign.id === selectedCampaign ? 'bg-indigo-50 text-indigo-700' : ''
                }`}
              >
                <div className="font-medium">{campaign.name}</div>
                <div className="text-sm text-gray-500">
                  {campaign.date} • {campaign.isLoading ? 'Processing...' : `${campaign.totalBounces} bounces`}
                </div>
                {campaign.isLoading && campaign.progress !== undefined && (
                  <div className="mt-2">
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <div
                        className="bg-indigo-600 h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${campaign.progress}%` }}
                      ></div>
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {campaign.progressMessage}
                    </div>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Upload modal */}
      {showUpload && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Add New Campaign</h3>
              <button
                onClick={() => setShowUpload(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <FileUpload 
              onDataLoaded={handleDataLoaded} 
              onTaskStarted={handleTaskStarted}
              onClose={() => setShowUpload(false)}
            />
          </div>
        </div>
      )}
    </>
  );
} 