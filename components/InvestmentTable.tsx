import React from 'react';
import { Investment, InvestmentType } from '../types';
import { Trash2, IndianRupee, Tag, ArrowRight, TrendingUp, AlertTriangle } from 'lucide-react';
import { formatCurrency } from '../utils/financials';

interface InvestmentTableProps {
  investments: Investment[];
  onRemove: (id: string) => void;
}

export const InvestmentTable: React.FC<InvestmentTableProps> = ({ investments, onRemove }) => {
  if (investments.length === 0) {
    return (
      <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-300 shadow-sm">
        <div className="mx-auto h-16 w-16 text-slate-300 flex items-center justify-center rounded-full bg-slate-50 mb-4">
          <TrendingUp size={32} />
        </div>
        <h3 className="text-lg font-semibold text-slate-900">Portfolio is empty</h3>
        <p className="mt-2 text-slate-500 max-w-sm mx-auto">
          Navigate to "Add Funds" or "Custom Fund" to start building your portfolio.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs tracking-wider">
            <tr>
              <th className="px-6 py-4">Fund Name</th>
              <th className="px-6 py-4">Type</th>
              <th className="px-6 py-4">Plan</th>
              <th className="px-6 py-4 text-right">Amount</th>
              <th className="px-6 py-4">Duration</th>
              <th className="px-6 py-4">Comparison</th>
              <th className="px-6 py-4 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {investments.map((inv) => (
              <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex flex-col">
                    <span className="font-semibold text-slate-900 line-clamp-2 max-w-xs" title={inv.name}>
                      {inv.name}
                    </span>
                    {inv.tags && inv.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {inv.tags.map(tag => (
                          <span key={tag} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
                            <Tag size={8} className="mr-1 opacity-50" />
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                    inv.type === InvestmentType.SIP ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'
                  }`}>
                    {inv.type}
                  </span>
                </td>
                <td className="px-6 py-4">
                   {inv.source === 'CUSTOM' ? (
                       <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded">Custom</span>
                   ) : (
                    <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                        inv.isDirect ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                    }`}>
                        {inv.isDirect ? 'Direct' : 'Regular'}
                    </span>
                   )}
                </td>
                <td className="px-6 py-4 text-right font-medium text-slate-700">
                  <span className="flex items-center justify-end gap-0.5">
                    <IndianRupee size={12} className="text-slate-400" />
                    {inv.amount.toLocaleString('en-IN')}
                    {inv.type === InvestmentType.SIP && <span className="text-slate-400 text-xs font-normal">/mo</span>}
                  </span>
                </td>
                <td className="px-6 py-4 text-slate-600">
                  <div className="flex items-center gap-1 text-xs">
                    <span>{new Date(inv.startDate).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })}</span>
                    <ArrowRight size={12} className="text-slate-400" />
                    {inv.endDate ? (
                      <span>{new Date(inv.endDate).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })}</span>
                    ) : (
                      <span className="text-emerald-600 font-medium">Now</span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4">
                  {inv.source === 'CUSTOM' ? (
                      <span className="text-xs text-slate-400 italic">No counterpart</span>
                  ) : inv.counterpartSchemeCode ? (
                    <div className="flex items-center gap-1.5 text-xs text-slate-600">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                      Vs {inv.isDirect ? 'Regular' : 'Direct'}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-xs text-amber-600" title="Comparison data unavailable">
                      <AlertTriangle size={12} />
                      N/A
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 text-center">
                  <button
                    onClick={() => onRemove(inv.id)}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Remove Investment"
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
  );
};