import React, { useMemo, useState } from 'react';
import { Investment } from '../types';
import { getInstallments, formatCurrency } from '../utils/financials';
import { Calculator, AlertTriangle, CheckCircle2, TrendingDown, TrendingUp, Info } from 'lucide-react';

interface TaxHarvestingProps {
  investments: Investment[];
}

interface TaxSummary {
  tag: string;
  ltcg: number;
  ltcl: number;
  stcg: number;
  stcl: number;
  eligibleLTCGToBook: number;
  eligibleLossToBook: number;
  recommendations: {
    fundName: string;
    type: 'LTCG' | 'LTCL' | 'STCL' | 'STCG';
    gain: number;
    currentValue: number;
    units: number;
    date: Date;
  }[];
}

export const TaxHarvesting: React.FC<TaxHarvestingProps> = ({ investments }) => {
  const [expandedTag, setExpandedTag] = useState<string | null>(null);

  const summaries = useMemo(() => {
    const tagMap = new Map<string, TaxSummary>();

    const getOrCreateSummary = (tag: string) => {
      if (!tagMap.has(tag)) {
        tagMap.set(tag, {
          tag,
          ltcg: 0,
          ltcl: 0,
          stcg: 0,
          stcl: 0,
          eligibleLTCGToBook: 0,
          eligibleLossToBook: 0,
          recommendations: []
        });
      }
      return tagMap.get(tag)!;
    };

    investments.forEach(inv => {
      const tags = inv.tags && inv.tags.length > 0 ? inv.tags : ['Untagged'];
      const splitFactor = tags.length;
      
      const installments = getInstallments(inv);
      
      installments.forEach(inst => {
        const splitGain = inst.gain / splitFactor;
        const splitValue = inst.currentValue / splitFactor;
        const splitUnits = inst.units / splitFactor;

        tags.forEach(tag => {
          const summary = getOrCreateSummary(tag);
          
          if (inst.isLTCG) {
            if (splitGain > 0.01) {
              summary.ltcg += splitGain;
              summary.recommendations.push({
                fundName: inv.name,
                type: 'LTCG',
                gain: splitGain,
                currentValue: splitValue,
                units: splitUnits,
                date: inst.date
              });
            } else if (splitGain < -0.01) {
              summary.ltcl += Math.abs(splitGain);
              summary.recommendations.push({
                fundName: inv.name,
                type: 'LTCL',
                gain: splitGain,
                currentValue: splitValue,
                units: splitUnits,
                date: inst.date
              });
            }
          } else {
            if (splitGain > 0.01) {
              summary.stcg += splitGain;
              summary.recommendations.push({
                fundName: inv.name,
                type: 'STCG',
                gain: splitGain,
                currentValue: splitValue,
                units: splitUnits,
                date: inst.date
              });
            } else if (splitGain < -0.01) {
              summary.stcl += Math.abs(splitGain);
              summary.recommendations.push({
                fundName: inv.name,
                type: 'STCL',
                gain: splitGain,
                currentValue: splitValue,
                units: splitUnits,
                date: inst.date
              });
            }
          }
        });
      });
    });

    // Process recommendations and limits
    const results = Array.from(tagMap.values()).map(summary => {
      // Sort recommendations: LTCL -> STCL -> LTCG -> STCG
      summary.recommendations.sort((a, b) => {
        const typeOrder = { 'LTCL': 1, 'STCL': 2, 'LTCG': 3, 'STCG': 4 };
        if (typeOrder[a.type] !== typeOrder[b.type]) {
            return typeOrder[a.type] - typeOrder[b.type];
        }
        if (a.gain < 0 && b.gain < 0) return a.gain - b.gain; // More negative first
        return b.gain - a.gain; // Larger gain first
      });

      // Calculate eligible amounts
      const totalLosses = summary.ltcl + summary.stcl;
      summary.eligibleLossToBook = totalLosses;
      
      // We can book up to 1.25L of tax-free LTCG, PLUS any losses we book
      const maxTaxFreeLTCG = 125000 + totalLosses;
      summary.eligibleLTCGToBook = Math.min(summary.ltcg, maxTaxFreeLTCG);

      return summary;
    });

    return results.sort((a, b) => a.tag.localeCompare(b.tag));
  }, [investments]);

  if (investments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-slate-200 text-slate-500">
        <Calculator size={48} className="mb-4 opacity-20" />
        <p>Add investments to view tax harvesting opportunities.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl flex items-start">
        <Info className="text-emerald-600 mr-3 mt-0.5 flex-shrink-0" size={20} />
        <div className="text-sm text-emerald-800">
          <p className="font-semibold mb-1">Tax Harvesting Strategy</p>
          <p className="mb-2">
            This tool identifies opportunities to save on taxes by booking Long Term Capital Gains (LTCG) up to the tax-free limit of ₹1.25 Lakhs per person per financial year. It also identifies investments at a loss (STCL/LTCL) that can be sold to offset gains, effectively increasing your tax-free withdrawal limit.
          </p>
          <p className="text-emerald-700 text-xs font-medium">
            Note: Exit loads are not automatically calculated. Please verify the exit load of your specific fund before selling, especially for STCG/STCL where a 1% exit load may apply if sold within 1 year.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {summaries.map(summary => {
          const isExpanded = expandedTag === summary.tag;
          const maxTaxFreeLTCG = 125000 + summary.eligibleLossToBook;
          const ltcgRemaining = Math.max(0, maxTaxFreeLTCG - summary.ltcg);
          const ltcgExceeded = summary.ltcg > maxTaxFreeLTCG;

          return (
            <div key={summary.tag} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div 
                className="p-6 cursor-pointer hover:bg-slate-50 transition-colors"
                onClick={() => setExpandedTag(isExpanded ? null : summary.tag)}
              >
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold text-slate-900 flex items-center">
                    <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-lg text-sm mr-3">
                      {summary.tag}
                    </span>
                    Tax Summary
                  </h3>
                  <div className="text-sm font-medium text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
                    {formatCurrency(summary.eligibleLTCGToBook)} Tax-Free LTCG Available
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-slate-50 rounded-xl">
                    <p className="text-xs text-slate-500 font-medium mb-1">Total LTCG</p>
                    <p className={`text-lg font-bold ${summary.ltcg > 0 ? 'text-emerald-600' : 'text-slate-700'}`}>
                      {formatCurrency(summary.ltcg)}
                    </p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-xl">
                    <p className="text-xs text-slate-500 font-medium mb-1">Total STCG</p>
                    <p className={`text-lg font-bold ${summary.stcg > 0 ? 'text-amber-600' : 'text-slate-700'}`}>
                      {formatCurrency(summary.stcg)}
                    </p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-xl">
                    <p className="text-xs text-slate-500 font-medium mb-1">Total LTCL</p>
                    <p className={`text-lg font-bold ${summary.ltcl > 0 ? 'text-red-500' : 'text-slate-700'}`}>
                      {formatCurrency(summary.ltcl)}
                    </p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-xl">
                    <p className="text-xs text-slate-500 font-medium mb-1">Total STCL</p>
                    <p className={`text-lg font-bold ${summary.stcl > 0 ? 'text-red-500' : 'text-slate-700'}`}>
                      {formatCurrency(summary.stcl)}
                    </p>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-sm">
                  <div className="flex items-center text-slate-600">
                    <CheckCircle2 size={16} className="text-emerald-500 mr-1.5" />
                    <span>Base Exemption: <strong>₹1,25,000</strong></span>
                    <span className="mx-2">+</span>
                    <span>Losses to Offset: <strong>{formatCurrency(summary.eligibleLossToBook)}</strong></span>
                    <span className="mx-2">=</span>
                    <span>Max Tax-Free LTCG: <strong>{formatCurrency(maxTaxFreeLTCG)}</strong></span>
                  </div>
                  {ltcgExceeded && (
                    <div className="flex items-center text-amber-600 font-medium">
                      <AlertTriangle size={16} className="mr-1.5" />
                      LTCG exceeds limit by {formatCurrency(summary.ltcg - maxTaxFreeLTCG)}
                    </div>
                  )}
                </div>
              </div>

              {isExpanded && (
                <div className="border-t border-slate-200 bg-slate-50 p-6">
                  <h4 className="font-semibold text-slate-800 mb-4">Recommended Actions</h4>
                  
                  {summary.recommendations.length === 0 ? (
                    <p className="text-sm text-slate-500">No specific actions recommended at this time.</p>
                  ) : (
                    <div className="space-y-3">
                      {/* Group recommendations by fund for cleaner display */}
                      {Object.entries(
                        summary.recommendations.reduce((acc: Record<string, { fundName: string, type: 'LTCG' | 'LTCL' | 'STCL' | 'STCG', gain: number, currentValue: number, units: number, installments: { date: Date, units: number, gain: number, currentValue: number }[] }>, rec: any) => {
                          const key = `${rec.fundName}-${rec.type}`;
                          if (!acc[key]) {
                            acc[key] = { 
                              fundName: rec.fundName,
                              type: rec.type,
                              gain: rec.gain,
                              currentValue: rec.currentValue,
                              units: rec.units,
                              installments: [{ date: rec.date, units: rec.units, gain: rec.gain, currentValue: rec.currentValue }]
                            };
                          } else {
                            acc[key].gain += rec.gain;
                            acc[key].currentValue += rec.currentValue;
                            acc[key].units += rec.units;
                            acc[key].installments.push({ date: rec.date, units: rec.units, gain: rec.gain, currentValue: rec.currentValue });
                          }
                          return acc;
                        }, {})
                      ).map(([key, rec]: [string, any]) => (
                        <div key={key} className="flex flex-col bg-white p-4 rounded-xl border border-slate-200">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-slate-800">{rec.fundName}</p>
                              <p className="text-xs text-slate-500 mt-0.5">
                                Total: {rec.units.toFixed(3)} units • Value: {formatCurrency(rec.currentValue)}
                              </p>
                            </div>
                            <div className="text-right">
                              <div className="flex items-center justify-end gap-2 mb-1">
                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                  rec.type === 'LTCG' ? 'bg-emerald-100 text-emerald-700' :
                                  rec.type === 'STCG' ? 'bg-amber-100 text-amber-700' :
                                  'bg-red-100 text-red-700'
                                }`}>
                                  {rec.type}
                                </span>
                              </div>
                              <p className={`font-bold ${rec.gain > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                {rec.gain > 0 ? '+' : ''}{formatCurrency(rec.gain)}
                              </p>
                            </div>
                          </div>
                          
                          <div className="mt-3 pt-3 border-t border-slate-100">
                            <p className="text-xs font-semibold text-slate-500 mb-2">Installment Breakdown:</p>
                            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                                {rec.installments.sort((a, b) => a.date.getTime() - b.date.getTime()).map((inst, idx) => (
                                    <div key={idx} className="flex justify-between items-center text-xs p-1.5 bg-slate-50 rounded-md">
                                        <span className="text-slate-600 font-medium flex-1">
                                            {inst.date.toLocaleDateString('en-IN', { month: 'short', year: 'numeric', day: 'numeric' })}
                                        </span>
                                        <span className="text-slate-500 text-right w-24">
                                            {inst.units.toFixed(3)} units
                                        </span>
                                        <span className={`font-medium text-right w-24 ${inst.gain > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                            {inst.gain > 0 ? '+' : ''}{formatCurrency(inst.gain)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
