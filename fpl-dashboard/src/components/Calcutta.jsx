import React from 'react';
import { DollarSign } from 'lucide-react';

const Calcutta = () => {
  return (
    <div className="min-h-screen bg-slate-900 text-gray-100">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-2">
            <DollarSign className="text-green-400" size={32} />
            <h1 className="text-3xl font-bold text-white">BPL Calcutta Auction</h1>
            <DollarSign className="text-green-400" size={32} />
          </div>
          <p className="text-gray-400">Coming Soon</p>
        </div>

        {/* Placeholder Content */}
        <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-8 text-center">
          <div className="text-6xl mb-4">🏏</div>
          <h2 className="text-xl font-semibold text-white mb-2">Calcutta Auction</h2>
          <p className="text-gray-400 max-w-md mx-auto">
            The Calcutta auction page is under construction. Check back soon for live auction tracking, 
            team ownership, and payout calculations.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Calcutta;

