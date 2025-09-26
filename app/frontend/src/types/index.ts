export interface BounceData {
  global_info: {
    total_bounces: number;
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