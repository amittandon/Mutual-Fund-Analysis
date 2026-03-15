import React, { useMemo, useState } from 'react';
import { Investment } from '../types';
import { getInstallments, formatCurrency, simulateInvestment } from '../utils/financials';
import { TrendingUp, TrendingDown, Activity, ChevronDown, ChevronUp, ShieldCheck, ShieldAlert } from 'lucide-react';

interface FundPerformanceProps {
  investments: Investment[];
}

export const FundPerformance: React.FC<FundPerformanceProps> = ({ investments }) => {
  const [expandedFundId, setExpandedFundId] = useState<string | null>(null);

  const fundData = useMemo(() => {
    return investments.map(inv => {
      const installments = getInstallments(inv);
      
      let totalInvested = 0;
      let totalRedeemed = 0;
      let currentValue = 0;
      let stcg = 0;
      let stcl = 0;
      let ltcg = 0;
      let ltcl = 0;

      const stats = simulateInvestment(inv, inv.navHistory);
      totalRedeemed = stats.totalRedeemed;

      installments.forEach(inst => {
        totalInvested += inst.investedAmount;
        currentValue += inst.currentValue;

        if (inst.isLTCG) {
          if (inst.gain > 0) ltcg += inst.gain;
          else ltcl += Math.abs(inst.gain);
        } else {
          if (inst.gain > 0) stcg += inst.gain;
          else stcl += Math.abs(inst.gain);
        }
      });

      // Calculate Impact
      let impact = 0;
      if (inv.counterpartNavHistory && inv.counterpartNavHistory.length > 0) {
        const counterpartStats = simulateInvestment(inv, inv.counterpartNavHistory);
        impact = currentValue - counterpartStats.currentValue;
      }

      const totalGain = currentValue - totalInvested;
      const gainPercentage = totalInvested > 0 ? (totalGain / totalInvested) * 100 : 0;

      return {
        id: inv.id,
        name: inv.name,
        type: inv.type,
        isDirect: inv.isDirect,
        impact,
        tags: inv.tags,
        totalInvested,
        totalRedeemed,
        currentValue,
        totalGain: currentValue + totalRedeemed - totalInvested,
        gainPercentage: totalInvested > 0 ? ((currentValue + totalRedeemed - totalInvested) / totalInvested) * 100 : 0,
        stcg,
        stcl,
        ltcg,
        ltcl,
        installments
      };
    }).sort((a, b) => b.currentValue - a.currentValue);
  }, [investments]);

  if (investments.length === 0) {
    return (
      <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm text-center">
        <Activity className="mx-auto h-12 w-12 text-slate-300 mb-4" />
        <h3 className="text-lg font-medium text-slate-900 mb-2">No Investments Found</h3>
        <p className="text-slate-500">Add some investments to see their performance details.</p>
      </div>
    );
  }

  const toggleExpand = (id: string) => {
    setExpandedFundId(prev => prev === id ? null : id);
  };

  return (
    <div className="space-y-6">
      {fundData.map(fund => (
        <div key={fund.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all duration-200">
          <div 
            className="p-6 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 cursor-pointer hover:bg-slate-50"
            onClick={() => toggleExpand(fund.id)}
          >
            <div className="flex-1">
              <div className="flex items-center justify-between md:justify-start gap-4">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-slate-900">{fund.name}</h3>
                  {fund.isDirect ? (
                    <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded border border-emerald-200">
                      <ShieldCheck size={10} /> Direct
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded border border-amber-200">
                      <ShieldAlert size={10} /> Regular
                    </span>
                  )}
                </div>
                {expandedFundId === fund.id ? (
                  <ChevronUp className="text-slate-400 md:hidden" size={20} />
                ) : (
                  <ChevronDown className="text-slate-400 md:hidden" size={20} />
                )}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs font-medium bg-slate-100 text-slate-600 px-2 py-1 rounded-md">
                  {fund.type}
                </span>
                {fund.tags?.map(tag => (
                  <span key={tag} className="text-xs font-medium bg-emerald-50 text-emerald-700 px-2 py-1 rounded-md">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
            
            <div className="text-right flex items-center gap-4">
              <div>
                <p className="text-sm text-slate-500 font-medium mb-1">Current Value</p>
                <p className="text-2xl font-bold text-slate-900">{formatCurrency(fund.currentValue)}</p>
              </div>
              <div className="hidden md:block">
                {expandedFundId === fund.id ? (
                  <ChevronUp className="text-slate-400" size={24} />
                ) : (
                  <ChevronDown className="text-slate-400" size={24} />
                )}
              </div>
            </div>
          </div>

          <div className="p-6 bg-slate-50/50 grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="space-y-1">
              <p className="text-sm text-slate-500 font-medium">Invested Amount</p>
              <p className="text-lg font-semibold text-slate-800">{formatCurrency(fund.totalInvested)}</p>
            </div>

            <div className="space-y-1">
              <p className="text-sm text-slate-500 font-medium">Redeemed Amount</p>
              <p className="text-lg font-semibold text-amber-600">{formatCurrency(fund.totalRedeemed)}</p>
            </div>
            
            <div className="space-y-1">
              <p className="text-sm text-slate-500 font-medium">Total Profit / Loss</p>
              <div className="flex items-center gap-2">
                <p className={`text-lg font-bold ${fund.totalGain >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {fund.totalGain >= 0 ? '+' : ''}{formatCurrency(fund.totalGain)}
                </p>
                <span className={`flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${fund.totalGain >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                  {fund.totalGain >= 0 ? <TrendingUp size={12} className="mr-1" /> : <TrendingDown size={12} className="mr-1" />}
                  {fund.gainPercentage.toFixed(2)}%
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-sm text-slate-500 font-medium">Plan Impact</p>
              <div className="flex items-center gap-2">
                <p className={`text-lg font-bold ${fund.impact >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {fund.impact >= 0 ? '+' : ''}{formatCurrency(fund.impact)}
                </p>
                <span className={`text-[10px] font-bold uppercase tracking-tighter px-1.5 py-0.5 rounded ${fund.impact >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                  {fund.impact >= 0 ? 'Saved' : 'Lost'}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 italic">vs {fund.isDirect ? 'Regular' : 'Direct'} Plan</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-slate-500 font-medium" title="Short Term Capital Gains (< 1 Year)">STCG</p>
                <p className="text-sm font-semibold text-emerald-600">+{formatCurrency(fund.stcg)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-slate-500 font-medium" title="Short Term Capital Loss (< 1 Year)">STCL</p>
                <p className="text-sm font-semibold text-red-500">-{formatCurrency(fund.stcl)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-slate-500 font-medium" title="Long Term Capital Gains (> 1 Year)">LTCG</p>
                <p className="text-sm font-semibold text-emerald-600">+{formatCurrency(fund.ltcg)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-slate-500 font-medium" title="Long Term Capital Loss (> 1 Year)">LTCL</p>
                <p className="text-sm font-semibold text-red-500">-{formatCurrency(fund.ltcl)}</p>
              </div>
            </div>
          </div>

          {expandedFundId === fund.id && (
            <div className="border-t border-slate-200 bg-white">
              <div className="p-6">
                <h4 className="text-sm font-bold text-slate-900 mb-4">Installment Details</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3 font-medium">Date</th>
                        <th className="px-4 py-3 font-medium text-right">Invested</th>
                        <th className="px-4 py-3 font-medium text-right">Units</th>
                        <th className="px-4 py-3 font-medium text-right">Purchase NAV</th>
                        <th className="px-4 py-3 font-medium text-right">Current Value</th>
                        <th className="px-4 py-3 font-medium text-right">Gain/Loss</th>
                        <th className="px-4 py-3 font-medium text-center">Tax Type</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {fund.installments.map((inst, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-4 py-3 font-medium text-slate-900">
                            {(() => {
                              try {
                                return inst.date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
                              } catch (e) {
                                return 'Invalid Date';
                              }
                            })()}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-600">
                            {formatCurrency(inst.investedAmount)}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-600">
                            {inst.units.toFixed(3)}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-600">
                            ₹{inst.purchaseNav.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-slate-900">
                            {formatCurrency(inst.currentValue)}
                          </td>
                          <td className={`px-4 py-3 text-right font-medium ${inst.gain >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                            {inst.gain >= 0 ? '+' : ''}{formatCurrency(inst.gain)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              inst.isLTCG 
                                ? 'bg-purple-100 text-purple-700' 
                                : 'bg-blue-100 text-blue-700'
                            }`}>
                              {inst.isLTCG ? 'LTCG' : 'STCG'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
