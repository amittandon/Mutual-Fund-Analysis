import React from 'react';
import { Investment, Redemption } from '../types';
import { formatCurrency } from '../utils/financials';
import { Calendar, IndianRupee, Hash, Trash2, History, AlertCircle } from 'lucide-react';

interface RedemptionHistoryProps {
  investments: Investment[];
  onRemoveRedemption: (investmentId: string, redemptionId: string) => void;
}

export const RedemptionHistory: React.FC<RedemptionHistoryProps> = ({ investments, onRemoveRedemption }) => {
  const allRedemptions = investments.flatMap(inv => 
    (inv.redemptions || []).map(r => ({
      ...r,
      investmentId: inv.id,
      investmentName: inv.name
    }))
  ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (allRedemptions.length === 0) {
    return (
      <div className="bg-white p-12 rounded-2xl border border-dashed border-slate-300 shadow-sm text-center">
        <div className="mx-auto h-16 w-16 text-slate-300 flex items-center justify-center rounded-full bg-slate-50 mb-4">
          <History size={32} />
        </div>
        <h3 className="text-lg font-semibold text-slate-900">No redemptions found</h3>
        <p className="mt-2 text-slate-500 max-w-sm mx-auto">
          You haven't recorded any redemptions yet. Use the "Redeem" button in the Portfolio list to record a withdrawal.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-start gap-3 text-sm text-amber-800">
        <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
        <p>
          Redemptions are processed using <strong>FIFO (First-In-First-Out)</strong> logic. 
          The oldest units are redeemed first for tax and performance calculations.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs tracking-wider">
              <tr>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Investment</th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4 text-right">Value</th>
                <th className="px-6 py-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {allRedemptions.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-900">
                    <div className="flex items-center gap-2">
                      <Calendar size={14} className="text-slate-400" />
                      {new Date(r.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-slate-700 font-medium line-clamp-1" title={r.investmentName}>
                      {r.investmentName}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                      r.type === 'ALL' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {r.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-slate-900">
                    <div className="flex items-center justify-end gap-1">
                      {r.type === 'AMOUNT' ? (
                        <>
                          <IndianRupee size={14} className="text-slate-400" />
                          {formatCurrency(r.amount || 0).replace('₹', '')}
                        </>
                      ) : r.type === 'UNITS' ? (
                        <>
                          <Hash size={14} className="text-slate-400" />
                          {r.units?.toFixed(3)} Units
                        </>
                      ) : (
                        <span className="text-red-600">Full Exit</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button
                      onClick={() => onRemoveRedemption(r.investmentId, r.id)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete Record"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
