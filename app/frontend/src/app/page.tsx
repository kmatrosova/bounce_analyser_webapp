'use client';

import { useEffect, useState, useRef } from 'react';
import { BounceData, Client } from '@/types';
import CampaignHistory from '@/components/CampaignHistory';
import FileUpload from '@/components/FileUpload';
import GlobalInfo from '@/components/GlobalInfo';
import BounceReasons from '@/components/BounceReasons';
import BounceSources from '@/components/BounceSources';
import PivotTable from '@/components/PivotTable';

export default function Home() {
  const [data, setData] = useState<BounceData | null>(null);
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [showAddData, setShowAddData] = useState(false);
  const [isLoadingCampaign, setIsLoadingCampaign] = useState(false);
  const pollingTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const selectedCampaignRef = useRef<string | null>(null);

  // Update ref whenever selectedCampaign changes
  useEffect(() => {
    selectedCampaignRef.current = selectedCampaign;
  }, [selectedCampaign]);

  // Load existing campaigns from backend (BigQuery) on first load
  useEffect(() => {
    const loadExistingCampaigns = async () => {
      try {
        const res = await fetch('http://localhost:8081/api/campaigns', { cache: 'no-store' });
        if (!res.ok) return;
        const clientData: Client[] = await res.json();
        setClients(clientData);
      } catch (e) {
        console.error('Failed to load campaigns from backend', e);
      }
    };
    loadExistingCampaigns();
  }, []);

  const handleDataLoaded = (newData: BounceData, fileName: string) => {
    // This function is now handled by the task flow
    setData(newData);
  };

  const handleTaskStarted = (clientName: string, campaignName: string, fileName: string) => {
    // Create campaign ID from client and campaign names
    const campaignId = `${clientName}-${campaignName}`;
    
    // First, check if this campaign already exists in our current clients list
    const existingCampaign = clients
      .flatMap(client => client.campaigns)
      .find(campaign => campaign.campaign_id === campaignId);
    
    if (existingCampaign) {
      // Campaign already exists, just update it with loading state
      console.log(`Adding data to existing campaign ${campaignId}, setting isLoading: true`);
      setClients(prev => prev.map(client => ({
        ...client,
        campaigns: client.campaigns.map(campaign => 
          campaign.campaign_id === campaignId 
            ? { 
                ...campaign, 
                isLoading: true
              }
            : campaign
        )
      })));
    } else {
      // Campaign doesn't exist, add it to clients list
      setClients(prev => {
        // Check if client already exists
        const existingClientIndex = prev.findIndex(client => client.client_name === clientName);
        
        if (existingClientIndex >= 0) {
          // Client exists, add new campaign to it
          const newCampaign = {
            campaign_id: campaignId,
            campaign_name: campaignName,
            last_updated: new Date().toISOString(),
            total: 0,
            isLoading: true
          };
          
          return prev.map((client, index) => 
            index === existingClientIndex 
              ? {
                  ...client,
                  campaigns: [newCampaign, ...client.campaigns],
                  total_campaigns: client.total_campaigns + 1,
                  total_bounces: client.total_bounces
                }
              : client
          );
        } else {
          // Client doesn't exist, create new client with the campaign
          const newClient = {
            client_name: clientName,
            campaigns: [{
              campaign_id: campaignId,
              campaign_name: campaignName,
              last_updated: new Date().toISOString(),
              total: 0,
              isLoading: true
            }],
            total_campaigns: 1,
            total_bounces: 0,
            last_updated: new Date().toISOString()
          };
          
          return [newClient, ...prev];
        }
      });
    }
    
    setSelectedCampaign(campaignId);
    setData(null);

    // Start simple polling for completion - check if campaign data is available
    pollForCompletion(campaignId);
  };

  const pollForCompletion = (campaignId: string) => {
    const checkCompletion = async () => {
      try {
        const response = await fetch(`http://localhost:8081/api/report/${encodeURIComponent(campaignId)}`);
        
        if (response.ok) {
          // Data exists but might not be fully processed yet
          const data = await response.json();
          console.log(`Campaign ${campaignId} exists but has ${data.global_info.total_bounces} bounces - checking if processing is complete`);
          
          // If we get 0 bounces, it might mean the data isn't fully processed yet
          if (data.global_info.total_bounces === 0) {
            console.log(`Campaign ${campaignId} shows 0 bounces, continuing to poll...`);
            const timeoutId = setTimeout(checkCompletion, 2000); // Check every 2 seconds
            pollingTimeouts.current.set(campaignId, timeoutId);
            return;
          }
          
          // Check if this is an existing campaign that might have been updated
          const currentCampaign = clients.flatMap(c => c.campaigns).find(c => c.campaign_id === campaignId);
          if (currentCampaign && currentCampaign.total > 0 && data.global_info.total_bounces <= currentCampaign.total) {
            console.log(`Campaign ${campaignId} bounce count (${data.global_info.total_bounces}) hasn't increased from current (${currentCampaign.total}), continuing to poll...`);
            const timeoutId = setTimeout(checkCompletion, 2000); // Check every 2 seconds
            pollingTimeouts.current.set(campaignId, timeoutId);
            return;
          }
          
          // Data is ready! Update UI
          const finalData = data;
          console.log(`Campaign ${campaignId} completed with ${finalData.global_info.total_bounces} bounces`);
          console.log('Final data structure:', finalData);
          
          // Update campaign with final data in a single state update
          setClients(prev => {
            console.log('Current clients state before update:', prev);
            const newClients = prev.map(client => {
              const hasTargetCampaign = client.campaigns.some(campaign => campaign.campaign_id === campaignId);
              
              if (!hasTargetCampaign) {
                return client;
              }
              
              const updatedCampaigns = client.campaigns.map(campaign => {
                if (campaign.campaign_id === campaignId) {
                  console.log(`Updating campaign ${campaignId} with ${finalData.global_info.total_bounces} bounces and setting isLoading: false`);
                  // Create a completely new object to ensure React detects the change
                  return { 
                    campaign_id: campaign.campaign_id,
                    campaign_name: campaign.campaign_name,
                    last_updated: new Date().toISOString(),
                    total: finalData.global_info.total_bounces,
                    isLoading: false
                  };
                }
                return campaign;
              });
              
              const newTotalBounces = updatedCampaigns.reduce((sum, campaign) => sum + campaign.total, 0);
              
              // Create a completely new client object to ensure React detects the change
              return {
                client_name: client.client_name,
                campaigns: updatedCampaigns,
                total_campaigns: client.total_campaigns,
                total_bounces: newTotalBounces,
                last_updated: new Date().toISOString()
              };
            });
            
            console.log('Updated clients state:', newClients);
            return newClients;
          });

          // Update selected campaign data if this is the current one
          // Use ref to get the current selectedCampaign value to avoid stale closure
          const currentSelectedCampaign = selectedCampaignRef.current;
          if (currentSelectedCampaign === campaignId) {
            console.log(`Campaign ${campaignId} is currently selected, updating main data view`);
            setData(finalData);
          } else {
            console.log(`Campaign ${campaignId} is not currently selected (${currentSelectedCampaign}), skipping main data view update`);
          }
          
          // Clear timeout
          const timeoutId = pollingTimeouts.current.get(campaignId);
          if (timeoutId) {
            clearTimeout(timeoutId);
            pollingTimeouts.current.delete(campaignId);
          }
        } else if (response.status === 404) {
          // Campaign doesn't exist yet, keep polling
          const timeoutId = setTimeout(checkCompletion, 3000); // Check every 3 seconds
          pollingTimeouts.current.set(campaignId, timeoutId);
        } else {
          throw new Error(`Unexpected error: ${response.status}`);
        }
      } catch (error) {
        console.error('Error checking completion:', error);
        
        // Update error state
        setClients(prev => prev.map(client => ({
          ...client,
          campaigns: client.campaigns.map(campaign => 
            campaign.campaign_id === campaignId 
              ? { 
                  ...campaign, 
                  isLoading: false
                }
              : campaign
          )
        })));

        // Clear timeout
        const timeoutId = pollingTimeouts.current.get(campaignId);
        if (timeoutId) {
          clearTimeout(timeoutId);
          pollingTimeouts.current.delete(campaignId);
        }
      }
    };
    
    // Start checking
    checkCompletion();
  };

  const handleCampaignSelect = (campaignId: string) => {
    // Set loading state immediately
    setIsLoadingCampaign(true);
    
    // Only clear timeout for the campaign being selected (if any)
    const timeoutId = pollingTimeouts.current.get(campaignId);
    if (timeoutId) {
      console.log(`Clearing polling timeout for campaign ${campaignId}`);
      clearTimeout(timeoutId);
      pollingTimeouts.current.delete(campaignId);
    } else {
      console.log(`No polling timeout found for campaign ${campaignId}`);
    }
    
    console.log(`Active polling timeouts:`, Array.from(pollingTimeouts.current.keys()));
    
    setSelectedCampaign(campaignId);
    setData(null); // Clear data while loading new report

    // Fetch data in background (non-blocking)
    fetch(`http://localhost:8081/api/report/${encodeURIComponent(campaignId)}`)
      .then(res => {
        if (!res.ok) {
          throw new Error(`Failed to fetch report for ${campaignId}: ${res.statusText}`);
        }
        return res.json();
      })
      .then(reportData => {
        console.log(`Loading existing campaign ${campaignId} with ${reportData.global_info.total_bounces} bounces`);
        
        // Always update the campaign in the clients list with the correct bounce count
        setClients(prev => prev.map(client => ({
          ...client,
          campaigns: client.campaigns.map(campaign => 
            campaign.campaign_id === campaignId ? { 
              ...campaign, 
              isLoading: false,
              total: reportData.global_info.total_bounces,
              last_updated: new Date().toISOString()
            } : campaign
          )
        })));

        // Always set the data - let React handle the state updates
        setData(reportData);
        setIsLoadingCampaign(false); // Clear loading state
      })
      .catch(error => {
        console.error(`Error fetching report for campaign ${campaignId}:`, error);
        
        // Update campaign loading state
        setClients(prev => prev.map(client => ({
          ...client,
          campaigns: client.campaigns.map(campaign => 
            campaign.campaign_id === campaignId ? { ...campaign, isLoading: false } : campaign
          )
        })));

        // Clear data on error
        setData(null);
        setIsLoadingCampaign(false); // Clear loading state on error too
      });
  };

  // Helper function to get client and campaign names from campaign ID
  const getClientAndCampaignNames = (campaignId: string) => {
    if (!campaignId || !campaignId.includes('-')) {
      return { clientName: '', campaignName: '' };
    }
    const parts = campaignId.split('-');
    const clientName = parts[0];
    const campaignName = parts.slice(1).join('-');
    return { clientName, campaignName };
  };

  // Helper function to get oldest record date
  const getOldestRecordDate = (data: BounceData | null) => {
    if (!data || !data.global_info || !data.global_info.oldest_record) {
      return null;
    }
    try {
      return new Date(data.global_info.oldest_record).toLocaleDateString();
    } catch (error) {
      return null;
    }
  };

  return (
            <main className="min-h-screen">
              <CampaignHistory
                clients={clients}
                onCampaignSelect={handleCampaignSelect}
                onNewCampaign={handleDataLoaded}
                onTaskStarted={(clientName, campaignName, fileName) => handleTaskStarted(clientName, campaignName, fileName)}
              />
      
              <div className="ml-64">
        <div className="p-8">
          {!data ? (
            isLoadingCampaign ? (
              <div className="flex items-center justify-center h-screen">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">Loading campaign...</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-screen">
                <div className="text-center">
                  <h1 className="text-3xl font-bold mb-4">Bounce Report</h1>
                  <p className="text-gray-600">Select a campaign from the menu or add a new one to begin.</p>
                </div>
              </div>
            )
          ) : (
            <div className="space-y-8">
              <div className="flex justify-between items-center mb-8">
                <div>
                  {(() => {
                    const { clientName, campaignName } = getClientAndCampaignNames(selectedCampaign || '');
                    const oldestDate = getOldestRecordDate(data);
                    return (
                      <>
                        <h1 className="text-3xl font-bold">{clientName} - {campaignName}</h1>
                        {oldestDate && (
                          <p className="text-gray-600 mt-1">Oldest record: {oldestDate}</p>
                        )}
                      </>
                    );
                  })()}
                </div>
                <button
                  onClick={() => setShowAddData(true)}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors flex items-center space-x-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span>Add Data</span>
                </button>
              </div>
              {data ? (
                <>
                  <GlobalInfo data={data.global_info} />
                  <BounceReasons 
                    stats={data.reason_stats}
                    breakdown={data.reason_breakdown}
                  />
                  <BounceSources 
                    stats={data.source_stats}
                    breakdown={data.source_breakdown}
                  />
                  <PivotTable data={data.pivot_table} />
                </>
              ) : (
                <div className="flex items-center justify-center h-64">
                  <div className="text-center">
                    <div className="text-lg font-medium mb-4">Processing...</div>
                    <div className="w-full max-w-md bg-gray-200 rounded-full h-2.5 mb-4">
                      <div className="bg-indigo-600 h-2.5 rounded-full animate-pulse"></div>
                    </div>
                    <div className="text-sm text-gray-500">
                      Data is being processed in the background...
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Add Data modal for existing campaigns */}
      {showAddData && selectedCampaign && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Add Data to Campaign</h3>
              <button
                onClick={() => setShowAddData(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <FileUpload 
              onDataLoaded={(data, fileName) => {
                handleDataLoaded(data, fileName);
                setShowAddData(false);
              }}
              onTaskStarted={(clientName, campaignName, fileName) => {
                handleTaskStarted(clientName, campaignName, fileName);
                setShowAddData(false);
              }}
              onClose={() => setShowAddData(false)}
              prefilledClientName={selectedCampaign.includes('-') ? selectedCampaign.split('-')[0] : selectedCampaign}
              prefilledCampaignName={selectedCampaign.includes('-') ? selectedCampaign.split('-').slice(1).join('-') : selectedCampaign}
              isAddingData={true}
              clients={clients}
            />
          </div>
        </div>
      )}
    </main>
  );
}
