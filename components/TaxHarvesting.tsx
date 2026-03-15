import React, { useMemo, useState } from 'react';
import { Investment } from '../types';
import { getInstallments, formatCurrency } from '../utils/financials';
import { Calculator, AlertTriangle, CheckCircle2, TrendingDown, TrendingUp, Info, Download, Tag, X } from 'lucide-react';

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

interface HarvestingAction {
  fundName: string;
  date: Date;
  type: 'LTCG' | 'LTCL' | 'STCL' | 'STCG';
  gain: number;
  value: number;
  units: number;
  tags?: string[];
}

export const TaxHarvesting: React.FC<TaxHarvestingProps> = ({ investments }) => {
  const [expandedTag, setExpandedTag] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    investments.forEach(inv => {
      inv.tags?.forEach(tag => tags.add(tag));
    });
    return Array.from(tags).sort();
  }, [investments]);

  const { summaries } = useMemo(() => {
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

    return { 
      summaries: results.sort((a, b) => a.tag.localeCompare(b.tag))
    };
  }, [investments]);

  const filteredActions = useMemo(() => {
    const actions: HarvestingAction[] = [];
    
    summaries.forEach(s => {
      // If no tag is selected, we want to include everything from every summary
      // If a tag is selected, we only want the portions belonging to that tag
      if (!selectedTag || s.tag === selectedTag) {
        s.recommendations.forEach(r => {
          actions.push({
            fundName: r.fundName,
            date: r.date,
            type: r.type,
            gain: r.gain,
            value: r.currentValue,
            units: r.units,
            tags: [s.tag]
          });
        });
      }
    });

    return actions;
  }, [summaries, selectedTag]);

  const consolidatedActions = useMemo(() => {
    const map = new Map<string, { 
      fundName: string; 
      type: 'LTCG' | 'LTCL' | 'STCL' | 'STCG'; 
      gain: number; 
      value: number; 
      units: number;
      tags: string[];
      lotCount: number;
    }>();

    filteredActions.forEach(a => {
      const tag = a.tags?.[0] || 'Untagged';
      const key = `${a.fundName}-${a.type}-${tag}`;
      if (!map.has(key)) {
        map.set(key, { 
          fundName: a.fundName,
          type: a.type,
          gain: a.gain,
          value: a.value,
          units: a.units,
          tags: [tag],
          lotCount: 1 
        });
      } else {
        const existing = map.get(key)!;
        existing.gain += a.gain;
        existing.value += a.value;
        existing.units += a.units;
        existing.lotCount += 1;
      }
    });

    return Array.from(map.values());
  }, [filteredActions]);

  const filteredSummaries = useMemo(() => {
    if (!selectedTag) return summaries;
    return summaries.filter(s => s.tag === selectedTag);
  }, [summaries, selectedTag]);

  const handleExportCSV = () => {
    const headers = ['Fund Name', 'Type', 'Units', 'Gain/Loss', 'Current Value', 'Tag'];
    const rows = consolidatedActions.map(a => [
      `"${a.fundName}"`,
      a.type,
      a.units.toFixed(3),
      a.gain.toFixed(2),
      a.value.toFixed(2),
      `"${a.tags[0]}"`
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `tax_harvesting_${selectedTag || 'all'}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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
      {/* TAG FILTER BAR */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          <button
            onClick={() => setSelectedTag(null)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-all ${
              !selectedTag 
              ? 'bg-slate-800 text-white border-slate-800' 
              : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
            }`}
          >
            All Tags
          </button>
          {allTags.map(tag => (
            <button
              key={tag}
              onClick={() => setSelectedTag(prev => prev === tag ? null : tag)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-all flex items-center ${
                selectedTag === tag
                ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-200 hover:text-emerald-700'
              }`}
            >
              <Tag size={12} className="mr-1.5" />
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* TAX HARVESTING SUMMARY SECTION */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-top-4 duration-500">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-emerald-100 p-2 rounded-lg">
                <Calculator className="h-5 w-5 text-emerald-600" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">Tax Harvesting Summary</h2>
            </div>
            <p className="text-sm text-slate-500">
              Follow these steps to optimize your tax liability {selectedTag ? `for tag: ${selectedTag}` : 'for the current financial year'}.
            </p>
          </div>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 transition-all shadow-sm"
          >
            <Download size={16} />
            Export CSV
          </button>
        </div>

        <div className="p-6 space-y-8">
          {/* STEP 1: BOOK LOSSES */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-900 text-white text-xs font-bold">1</span>
              <h3 className="font-bold text-slate-800">Book Losses to Offset Gains (STCL & LTCL)</h3>
            </div>
            
            {consolidatedActions.filter(a => a.gain < -0.01).length > 0 ? (
                <div className="overflow-hidden border border-slate-100 rounded-xl">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-500 font-semibold text-xs uppercase tracking-wider">
                      <tr>
                        <th className="px-4 py-3">Fund Name</th>
                        {!selectedTag && <th className="px-4 py-3">Tag</th>}
                        <th className="px-4 py-3">Type</th>
                        <th className="px-4 py-3 text-right">Total Loss</th>
                        <th className="px-4 py-3 text-right">Withdrawal Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {consolidatedActions
                        .filter(a => a.gain < -0.01)
                        .sort((a, b) => a.gain - b.gain)
                        .map((action, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-4 py-3">
                              <div className="font-medium text-slate-900">{action.fundName}</div>
                              <div className="text-[10px] text-slate-400">Consolidated from {action.lotCount} lots</div>
                            </td>
                            {!selectedTag && (
                              <td className="px-4 py-3">
                                <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                                  {action.tags[0]}
                                </span>
                              </td>
                            )}
                            <td className="px-4 py-3">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${action.type === 'STCL' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                                {action.type}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-red-600 font-mono">{formatCurrency(action.gain)}</td>
                            <td className="px-4 py-3 text-right text-slate-600 font-medium font-mono">{formatCurrency(action.value)}</td>
                          </tr>
                        ))}
                    </tbody>
                    <tfoot className="bg-slate-50/50 font-bold border-t border-slate-100">
                      <tr>
                        <td colSpan={!selectedTag ? 3 : 2} className="px-4 py-3 text-slate-500 text-xs uppercase">Total Potential Loss Offset</td>
                        <td className="px-4 py-3 text-right text-red-600 font-mono">
                          {formatCurrency(consolidatedActions.filter(a => a.gain < -0.01).reduce((sum, a) => sum + a.gain, 0))}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-900 font-mono">
                          {formatCurrency(consolidatedActions.filter(a => a.gain < -0.01).reduce((sum, a) => sum + a.value, 0))}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
            ) : (
              <div className="p-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center">
                <p className="text-sm text-slate-400">No loss-making investments found to harvest.</p>
              </div>
            )}
          </div>

          {/* STEP 2: BOOK TAX-FREE LTCG */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-900 text-white text-xs font-bold">2</span>
              <h3 className="font-bold text-slate-800">Book Tax-Free Long Term Gains (LTCG)</h3>
            </div>
            
            {consolidatedActions.filter(a => a.type === 'LTCG' && a.gain > 0.01).length > 0 ? (
              <div className="space-y-4">
                <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <TrendingUp className="text-emerald-600" size={20} />
                    <div>
                      <p className="text-sm font-bold text-emerald-900">Total Harvestable LTCG</p>
                      <p className="text-xs text-emerald-700">Book up to ₹1.25L + any losses booked above</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-emerald-600">
                      {formatCurrency(consolidatedActions.filter(a => a.type === 'LTCG' && a.gain > 0.01).reduce((sum, a) => sum + a.gain, 0))}
                    </p>
                  </div>
                </div>

                <div className="overflow-hidden border border-slate-100 rounded-xl">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-500 font-semibold text-xs uppercase tracking-wider">
                      <tr>
                        <th className="px-4 py-3">Fund Name</th>
                        {!selectedTag && <th className="px-4 py-3">Tag</th>}
                        <th className="px-4 py-3 text-right">Total Gain</th>
                        <th className="px-4 py-3 text-right">Withdrawal Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {consolidatedActions
                        .filter(a => a.type === 'LTCG' && a.gain > 0.01)
                        .sort((a, b) => b.gain - a.gain)
                        .map((action, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-4 py-3">
                              <div className="font-medium text-slate-900">{action.fundName}</div>
                              <div className="text-[10px] text-slate-400">Consolidated from {action.lotCount} lots</div>
                            </td>
                            {!selectedTag && (
                              <td className="px-4 py-3">
                                <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                                  {action.tags[0]}
                                </span>
                              </td>
                            )}
                            <td className="px-4 py-3 text-right font-bold text-emerald-600 font-mono">+{formatCurrency(action.gain)}</td>
                            <td className="px-4 py-3 text-right text-slate-600 font-medium font-mono">{formatCurrency(action.value)}</td>
                          </tr>
                        ))}
                    </tbody>
                    <tfoot className="bg-slate-50/50 font-bold border-t border-slate-100">
                      <tr>
                        <td colSpan={!selectedTag ? 2 : 1} className="px-4 py-3 text-slate-500 text-xs uppercase">Total Harvestable Gain</td>
                        <td className="px-4 py-3 text-right text-emerald-600 font-mono">
                          {formatCurrency(consolidatedActions.filter(a => a.type === 'LTCG' && a.gain > 0.01).reduce((sum, a) => sum + a.gain, 0))}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-900 font-mono">
                          {formatCurrency(consolidatedActions.filter(a => a.type === 'LTCG' && a.gain > 0.01).reduce((sum, a) => sum + a.value, 0))}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center">
                <p className="text-sm text-slate-400">No LTCG opportunities found.</p>
              </div>
            )}
          </div>

          {/* WARNING: STCG */}
          <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl flex items-start gap-3">
            <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={18} />
            <div className="text-xs text-amber-800 leading-relaxed">
              <p className="font-bold mb-1">Important Note on STCG:</p>
              <p>
                Short Term Capital Gains (STCG) are taxed at 20%. It is generally <strong>not recommended</strong> to book STCG unless you have significant STCL (Short Term Capital Loss) to offset it. Re-investing immediately after booking STCG will incur tax without the benefit of the tax-free limit available for LTCG.
              </p>
            </div>
          </div>
        </div>
      </div>

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
        {filteredSummaries.map(summary => {
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
