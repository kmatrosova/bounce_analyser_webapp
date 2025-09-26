'use client';

interface GlobalInfoProps {
  data: {
    total_bounces: number;
  };
}

export default function GlobalInfo({ data }: GlobalInfoProps) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-2xl font-semibold mb-4">📌 Global Info</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-500">Total Bounces</p>
          <p className="text-2xl font-bold">{data.total_bounces.toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
} 