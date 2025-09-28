'use client';

import { useState } from 'react';
import FileUpload from './FileUpload';
import { BounceData, Client, Campaign } from '@/types';

interface CampaignHistoryProps {
  clients: Client[];
  onCampaignSelect: (campaignId: string) => void;
  onNewCampaign: (data: BounceData, fileName: string) => void;
  onTaskStarted: (clientName: string, campaignName: string, fileName: string) => void;
}

export default function CampaignHistory({ clients, onCampaignSelect, onNewCampaign, onTaskStarted }: CampaignHistoryProps) {
  const [showUpload, setShowUpload] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null);
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());

  const handleDataLoaded = (data: BounceData, fileName: string) => {
    onNewCampaign(data, fileName);
    setShowUpload(false);
  };

  const handleTaskStarted = (clientName: string, campaignName: string, fileName: string) => {
    onTaskStarted(clientName, campaignName, fileName);
    setShowUpload(false);
  };

  const handleCampaignSelect = (campaignId: string) => {
    setSelectedCampaign(campaignId);
    onCampaignSelect(campaignId);
  };

  const toggleClient = (clientName: string) => {
    const newExpanded = new Set(expandedClients);
    if (newExpanded.has(clientName)) {
      newExpanded.delete(clientName);
    } else {
      newExpanded.add(clientName);
    }
    setExpandedClients(newExpanded);
  };

  return (
    <>
      <div className="fixed left-0 top-0 h-full w-64 bg-white shadow-lg z-50">
        {/* Content */}
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="p-4 border-b">
            <button
              onClick={() => setShowUpload(true)}
              className="w-full bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors"
            >
              Add new campaign
            </button>
          </div>

          {/* Client/Campaign list */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-4 pb-2">
              <h2 className="text-lg font-semibold text-gray-700">Clients</h2>
            </div>
            <div className="px-4 pb-4">
            {clients.map((client) => (
              <div key={client.client_name} className="mb-3">
                {/* Client header */}
                <button
                  onClick={() => toggleClient(client.client_name)}
                  className="w-full text-left p-2 rounded-md hover:bg-gray-50 transition-colors flex items-center justify-between"
                >
                  <div className="flex items-center">
                    <svg
                      className={`w-4 h-4 mr-2 transition-transform ${
                        expandedClients.has(client.client_name) ? 'rotate-90' : ''
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    <span className="font-medium text-gray-900">{client.client_name}</span>
                  </div>
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                    {client.total_campaigns} campaigns
                  </span>
                </button>

                {/* Campaign list for this client */}
                {expandedClients.has(client.client_name) && (
                  <div className="ml-6 mt-1 space-y-1">
                    {client.campaigns.map((campaign) => (
                      <button
                        key={campaign.campaign_id}
                        onClick={() => handleCampaignSelect(campaign.campaign_id)}
                        className={`w-full text-left p-2 rounded-md hover:bg-gray-50 transition-colors ${
                          campaign.campaign_id === selectedCampaign ? 'bg-indigo-50 text-indigo-700' : ''
                        }`}
                      >
                        <div className="font-medium text-sm">{campaign.campaign_name}</div>
                        <div className="text-xs text-gray-500">
                          {new Date(campaign.last_updated).toLocaleDateString()}
                          {!campaign.isLoading && ` • ${campaign.total} bounces`}
                        </div>
                        {campaign.isLoading && (
                          <div className="mt-1 flex items-center">
                            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-indigo-600"></div>
                            <span className="text-xs text-gray-400 ml-2">Loading...</span>
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            </div>
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
              clients={clients}
            />
          </div>
        </div>
      )}
    </>
  );
} 