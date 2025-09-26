'use client';

import { useState } from 'react';

interface PivotTableProps {
  data: Record<string, Record<string, number>>;
}

export default function PivotTable({ data }: PivotTableProps) {
  const [threshold, setThreshold] = useState(5);
  const [showOnlyHighlighted, setShowOnlyHighlighted] = useState(false);

  // Get all unique sources and reasons
  const sources = Array.from(new Set(Object.values(data).flatMap(row => Object.keys(row))));
  const reasons = Object.keys(data);

  // Calculate row and column totals
  const rowTotals = reasons.reduce((acc, reason) => {
    acc[reason] = Object.values(data[reason]).reduce((sum, val) => sum + val, 0);
    return acc;
  }, {} as Record<string, number>);

  const columnTotals = sources.reduce((acc, source) => {
    acc[source] = reasons.reduce((sum, reason) => sum + (data[reason][source] || 0), 0);
    return acc;
  }, {} as Record<string, number>);

  // Calculate grand total
  const grandTotal = Object.values(rowTotals).reduce((sum, val) => sum + val, 0);

  // Find highlighted cells
  const highlightedCells = new Set<string>();
  Object.entries(data).forEach(([reason, row]) => {
    Object.entries(row).forEach(([source, value]) => {
      const percentage = (value / grandTotal) * 100;
      if (percentage >= threshold) {
        highlightedCells.add(`${reason}-${source}`);
      }
    });
  });

  // Filter data if showOnlyHighlighted is true
  const filteredData = showOnlyHighlighted
    ? Object.entries(data).reduce((acc, [reason, row]) => {
        const hasHighlightedCell = Object.entries(row).some(([source, value]) => {
          const percentage = (value / grandTotal) * 100;
          return percentage >= threshold;
        });
        if (hasHighlightedCell) {
          acc[reason] = row;
        }
        return acc;
      }, {} as Record<string, Record<string, number>>)
    : data;

  // Filter sources if showOnlyHighlighted is true
  const filteredSources = showOnlyHighlighted
    ? sources.filter(source =>
        Object.entries(filteredData).some(([_, row]) => {
          const value = row[source] || 0;
          const percentage = (value / grandTotal) * 100;
          return percentage >= threshold;
        })
      )
    : sources;

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-semibold">Combined Pivot Table</h2>
        <div className="flex items-center gap-4">
          <label htmlFor="threshold" className="text-sm text-gray-600">
            Threshold (%):
          </label>
          <input
            id="threshold"
            type="range"
            min="5"
            max="95"
            step="5"
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            className="w-32"
          />
          <span className="text-sm font-medium">{threshold}%</span>
          
          <div className="flex items-center gap-2 ml-4">
            <label htmlFor="showOnlyHighlighted" className="text-sm text-gray-600">
              Show only highlighted:
            </label>
            <button
              id="showOnlyHighlighted"
              onClick={() => setShowOnlyHighlighted(!showOnlyHighlighted)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                showOnlyHighlighted ? 'bg-indigo-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  showOnlyHighlighted ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="sticky left-0 bg-gray-50 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider z-10">
              </th>
              {filteredSources.map((source) => (
                <th
                  key={source}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  {source}
                </th>
              ))}
              <th className="sticky right-0 bg-gray-50 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider z-10">
                Total
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {Object.entries(filteredData).map(([reason, row]) => (
              <tr key={reason}>
                <td className="sticky left-0 bg-gray-50 px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 z-10">
                  {reason}
                </td>
                {filteredSources.map((source) => {
                  const value = row[source] || 0;
                  const percentage = (value / grandTotal) * 100;
                  const isAboveThreshold = percentage >= threshold;
                  return (
                    <td
                      key={source}
                      className={`px-6 py-4 whitespace-nowrap text-sm ${
                        isAboveThreshold ? 'bg-red-50 font-semibold' : ''
                      }`}
                    >
                      {value.toLocaleString()}
                    </td>
                  );
                })}
                <td className="sticky right-0 bg-gray-50 px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 z-10">
                  {rowTotals[reason].toLocaleString()}
                </td>
              </tr>
            ))}
            <tr className="bg-gray-50">
              <td className="sticky left-0 bg-gray-50 px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 z-10">
                Total
              </td>
              {filteredSources.map((source) => (
                <td
                  key={source}
                  className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900"
                >
                  {columnTotals[source].toLocaleString()}
                </td>
              ))}
              <td className="sticky right-0 bg-gray-50 px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 z-10">
                {grandTotal.toLocaleString()}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
} 