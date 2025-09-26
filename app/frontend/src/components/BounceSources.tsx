'use client';

import React, { useState, useRef, useEffect } from 'react';
import { StatsData, BreakdownData, ChartDataPoint } from '@/types';
import ChartContainer from './ChartContainer';
import BreakdownPanel from './BreakdownPanel';

interface BounceSourcesProps {
  stats: StatsData;
  breakdown: BreakdownData;
}

export default function BounceSources({ stats, breakdown }: BounceSourcesProps) {
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [chartType, setChartType] = useState<'bar' | 'pie'>('bar');
  const isFirstRender = useRef(true);
  const isFirstPieShow = useRef(true);

  // Convert stats to chart data
  const chartData: ChartDataPoint[] = Object.entries(stats.counts)
    .map(([name, value]) => ({
      name,
      value,
      percentage: stats.percentages[name]
    }))
    .sort((a, b) => b.value - a.value);

  const handleChartTypeChange = (type: 'bar' | 'pie') => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
    }
    setChartType(type);
    if (type === 'pie') {
      isFirstPieShow.current = true;
    }
  };

  // Set isFirstPieShow to false after the pie chart has been shown
  useEffect(() => {
    if (chartType === 'pie' && isFirstPieShow.current) {
      const timer = setTimeout(() => {
        isFirstPieShow.current = false;
      }, 1000); // Wait for animation to complete
      return () => clearTimeout(timer);
    }
  }, [chartType]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <ChartContainer
        data={chartData}
        onItemClick={setSelectedSource}
        chartType={chartType}
        onChartTypeChange={handleChartTypeChange}
        title="Main Bounce Sources"
        isFirstRender={isFirstRender.current}
        isFirstPieShow={isFirstPieShow.current}
      />
      <BreakdownPanel
        selectedItem={selectedSource}
        breakdown={breakdown}
        title="Bounce Reasons"
        noDataMessage="No bounce reasons available for this source"
        clickMessage="Click on a bar or pie slice to see the bounce reasons"
      />
    </div>
  );
} 