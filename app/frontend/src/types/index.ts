export interface BounceData {
  global_info: {
    total_bounces: number;
    oldest_record?: string;
  };
  reason_stats: StatsData;
  source_stats: StatsData;
  pivot_table: Record<string, Record<string, number>>;
  reason_breakdown: BreakdownData;
  source_breakdown: BreakdownData;
  title?: string;
}

export interface StatsData {
  counts: Record<string, number>;
  percentages: Record<string, number>;
}

export interface BreakdownData {
  [key: string]: {
    counts: Record<string, number>;
  };
}

export interface ChartDataPoint {
  name: string;
  value: number;
  percentage: number;
}

export interface ChartProps {
  data: ChartDataPoint[];
  onItemClick: (name: string) => void;
  chartType: 'bar' | 'pie';
  onChartTypeChange: (type: 'bar' | 'pie') => void;
  title: string;
  isFirstRender: boolean;
  isFirstPieShow: boolean;
}

export interface BreakdownPanelProps {
  selectedItem: string | null;
  breakdown: BreakdownData;
  title: string;
  noDataMessage: string;
  clickMessage: string;
}

export interface ChartData {
  name: string;
  value: number;
  percentage: number;
}

// New types for hierarchical campaign structure
export interface Campaign {
  campaign_id: string;
  campaign_name: string;
  last_updated: string;
  total: number;
  isLoading?: boolean;
}

export interface Client {
  client_name: string;
  campaigns: Campaign[];
  total_campaigns: number;
  total_bounces: number;
  last_updated: string;
  isExpanded?: boolean;
} 