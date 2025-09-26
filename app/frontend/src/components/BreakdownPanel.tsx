'use client';

import React from 'react';
import { BreakdownPanelProps } from '@/types';

export default function BreakdownPanel({
  selectedItem,
  breakdown,
  title,
  noDataMessage,
  clickMessage,
}: BreakdownPanelProps) {
  // Get breakdown data for selected item
  const breakdownData = selectedItem && breakdown[selectedItem]
    ? Object.entries(breakdown[selectedItem].counts).map(([name, value]) => ({
        name,
        value
      })).sort((a, b) => b.value - a.value)
    : [];

  return (
    <div className="bg-gray-50 rounded-lg p-4 h-[400px] overflow-y-auto">
      {selectedItem ? (
        breakdown[selectedItem] ? (
          <>
            <h3 className="text-lg font-semibold mb-4">{title} for {selectedItem}</h3>
            <div className="space-y-4">
              {breakdownData.map((item) => (
                <div key={item.name} className="flex justify-between items-center">
                  <span className="font-medium">{item.name}</span>
                  <div className="text-right">
                    <div className="font-semibold">{item.value.toLocaleString()}</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            {noDataMessage}
          </div>
        )
      ) : (
        <div className="flex items-center justify-center h-full text-gray-500">
          {clickMessage}
        </div>
      )}
    </div>
  );
} 