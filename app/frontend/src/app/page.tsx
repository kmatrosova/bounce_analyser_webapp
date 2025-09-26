'use client';

import { useEffect, useState } from 'react';
import { BounceData } from '@/types';
import CampaignHistory from '@/components/CampaignHistory';
import GlobalInfo from '@/components/GlobalInfo';
import BounceReasons from '@/components/BounceReasons';
import BounceSources from '@/components/BounceSources';
import PivotTable from '@/components/PivotTable';

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

export default function Home() {
  const [data, setData] = useState<BounceData | null>(null);
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);

  // Load existing campaigns from backend (BigQuery) on first load
  useEffect(() => {
    const loadExistingCampaigns = async () => {
      try {
        const res = await fetch('http://localhost:8081/api/campaigns', { cache: 'no-store' });
        if (!res.ok) return;
        const rows: Array<{ campaign_id: string; last_updated: string; total: number }> = await res.json();
        const mapped: Campaign[] = rows.map((r) => ({
          id: r.campaign_id,
          name: r.campaign_id,
          date: new Date(r.last_updated).toISOString().split('T')[0],
          totalBounces: r.total,
          data: null,
        }));
        setCampaigns(mapped);
      } catch (e) {
        console.error('Failed to load campaigns from backend', e);
      }
    };
    loadExistingCampaigns();
  }, []);

  const handleDataLoaded = (newData: BounceData, fileName: string) => {
    // Create a new campaign
    const newCampaign: Campaign = {
      id: Date.now().toString(),
      name: newData.title || fileName.replace('.csv', ''),
      date: new Date().toISOString().split('T')[0],
      totalBounces: newData.global_info.total_bounces,
      data: newData
    };

    // Add to campaigns list and select it
    setCampaigns(prev => [newCampaign, ...prev]);
    setSelectedCampaign(newCampaign.id);
    setData(newData);
  };

  const handleTaskStarted = (taskId: string, fileName: string) => {
    // Create a new campaign with loading state
    const newCampaign: Campaign = {
      id: Date.now().toString(),
      name: fileName.replace('.csv', ''),
      date: new Date().toISOString().split('T')[0],
      totalBounces: 0,
      data: null,
      taskId: taskId,
      isLoading: true,
      progress: 0,
      progressMessage: "Processing started..."
    };

    // Add to campaigns list and select it
    setCampaigns(prev => [newCampaign, ...prev]);
    setSelectedCampaign(newCampaign.id);
    setData(null);

    // Start polling for progress
    pollProgress(taskId, newCampaign.id);
  };

  const pollProgress = async (taskId: string, campaignId: string) => {
    try {
      const response = await fetch(`http://localhost:8000/api/progress/${taskId}`);
      const progressData = await response.json();
      
      // Update campaign progress
      setCampaigns(prev => prev.map(campaign => 
        campaign.id === campaignId 
          ? { ...campaign, progress: progressData.progress, progressMessage: progressData.message }
          : campaign
      ));

      // Update selected campaign data if this is the current one
      if (selectedCampaign === campaignId) {
        setData(null); // Clear data to show progress
      }
      
      if (progressData.progress === 100 && progressData.is_complete) {
        // Get final results
        const finalResponse = await fetch(`http://localhost:8000/api/analyze/${taskId}`);
        const finalData = await finalResponse.json();
        
        // Update campaign with final data
        setCampaigns(prev => prev.map(campaign => 
          campaign.id === campaignId 
            ? { 
                ...campaign, 
                data: finalData, 
                isLoading: false, 
                totalBounces: finalData.global_info.total_bounces,
                name: finalData.title || campaign.name
              }
            : campaign
        ));

        // Update selected campaign data if this is the current one
        if (selectedCampaign === campaignId) {
          setData(finalData);
        }
      } else {
        // Continue polling
        setTimeout(() => pollProgress(taskId, campaignId), 1000);
      }
    } catch (error) {
      console.error('Error polling progress:', error);
      // Update campaign with error state
      setCampaigns(prev => prev.map(campaign => 
        campaign.id === campaignId 
          ? { ...campaign, isLoading: false, progressMessage: "Error occurred" }
          : campaign
      ));
    }
  };

  const handleCampaignSelect = (campaignId: string) => {
    setSelectedCampaign(campaignId);
    // Fetch report for this campaign from backend (BigQuery)
    fetch(`http://localhost:8081/api/report/${encodeURIComponent(campaignId)}`)
      .then((r) => r.json())
      .then((report) => setData(report))
      .catch((e) => console.error('Failed to load campaign report', e));
  };

  return (
    <main className="min-h-screen">
      <CampaignHistory
        campaigns={campaigns}
        onCampaignSelect={handleCampaignSelect}
        onNewCampaign={handleDataLoaded}
        onTaskStarted={handleTaskStarted}
      />
      
      <div className={`transition-all duration-300 ${data ? 'ml-64' : 'ml-12'}`}>
        <div className="p-8">
          {!data ? (
            <div className="flex items-center justify-center h-screen">
              <div className="text-center">
                <h1 className="text-3xl font-bold mb-4">Bounce Report</h1>
                <p className="text-gray-600">Select a campaign from the menu or add a new one to begin.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              <h1 className="text-3xl font-bold mb-8">Bounce Report</h1>
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
                      <div
                        className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300"
                        style={{ width: `${campaigns.find(c => c.id === selectedCampaign)?.progress || 0}%` }}
                      ></div>
                    </div>
                    <div className="text-sm text-gray-500">
                      {campaigns.find(c => c.id === selectedCampaign)?.progressMessage || "Processing started..."}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
