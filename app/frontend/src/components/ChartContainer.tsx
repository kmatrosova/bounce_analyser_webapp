'use client';

import React from 'react';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { ChartProps } from '@/types';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FF6B6B', '#4ECDC4'];

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ payload: { name: string; value: number; percentage: number } }>;
}

const CustomTooltip = ({ active, payload }: TooltipProps) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white p-2 border border-gray-200 rounded shadow">
        <p className="font-medium">{data.name}</p>
        <p>{data.value.toLocaleString()} bounces</p>
        <p>{data.percentage.toFixed(1)}%</p>
      </div>
    );
  }
  return null;
};

// Function to format label text
const formatLabel = (text: string) => {
  if (text.length > 15) {
    return text.substring(0, 12) + '...';
  }
  return text;
};

export default function ChartContainer({
  data,
  onItemClick,
  chartType,
  onChartTypeChange,
  title,
  isFirstRender,
  isFirstPieShow,
}: ChartProps) {
  // Create color mapping for consistent colors
  const colorMap = data.reduce((acc, item, index) => {
    acc[item.name] = COLORS[index % COLORS.length];
    return acc;
  }, {} as Record<string, string>);

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-semibold">{title}</h2>
        <div className="flex gap-2">
          <button
            onClick={() => onChartTypeChange('bar')}
            className={`px-3 py-1 rounded ${chartType === 'bar' ? 'bg-blue-500 text-white' : 'bg-gray-100'}`}
          >
            Bar
          </button>
          <button
            onClick={() => onChartTypeChange('pie')}
            className={`px-3 py-1 rounded ${chartType === 'pie' ? 'bg-blue-500 text-white' : 'bg-gray-100'}`}
          >
            Pie
          </button>
        </div>
      </div>

      <div className="h-[400px]">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === 'bar' ? (
            <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="name" 
                angle={-45}
                textAnchor="end"
                height={60}
                tick={{ fontSize: 12 }}
                tickFormatter={formatLabel}
              />
              <YAxis />
              <Tooltip content={<CustomTooltip />} />
              <Bar
                dataKey="value"
                fill="#8884d8"
                isAnimationActive={isFirstRender}
                onClick={(data) => onItemClick(data.name)}
                style={{ cursor: 'pointer' }}
              >
                {data.map((entry) => (
                  <Cell 
                    key={`cell-${entry.name}`} 
                    fill={colorMap[entry.name]}
                    style={{ cursor: 'pointer' }}
                  />
                ))}
              </Bar>
            </BarChart>
          ) : (
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={150}
                label={false}
                isAnimationActive={isFirstPieShow}
                activeIndex={-1}
                activeShape={undefined}
                innerRadius={0}
              >
                {data.map((entry) => (
                  <Cell 
                    key={`cell-${entry.name}`} 
                    fill={colorMap[entry.name]}
                    onClick={() => onItemClick(entry.name)}
                    style={{ outline: 'none', cursor: 'pointer' }}
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                layout="vertical" 
                align="right" 
                verticalAlign="middle"
                formatter={(value) => <span className="text-gray-700">{value}</span>}
              />
            </PieChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
} 