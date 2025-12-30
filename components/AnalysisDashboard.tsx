import React, { useMemo } from 'react';
import { Investment, NAVData } from '../types';
import { calculateFundRatios, formatCurrency } from '../utils/financials';
import { TrendingUp, Activity, Scale, Percent, AlertCircle } from 'lucide-react';

interface AnalysisDashboardProps {
  investments: Investment[];
  benchmarkHistory: NAVData[];
  benchmarkName?: string;
}

const MetricCard: React.FC<{ 
  title: string; 
  value: string; 
  icon: React.ReactNode; 
  desc: string; 
  colorClass: string 
}> = ({ title, value, icon, desc, colorClass }) => (
  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-start justify-between">
    <div>
      <p className="text-sm text-slate-500 font-medium mb-1">{title}</p>
      <h3 className={`text-2xl font-bold ${colorClass}`}>{value}</h3>
      <p className="text-xs text-slate-400 mt-1">{desc}</p>
    </div>
    <div className={`p-2 rounded-lg ${colorClass.replace('text', 'bg').replace('700', '50').replace('600', '50').replace('500', '50')} opacity-80`}>
        {icon}
    </div>
  </div>
);

export const AnalysisDashboard: React.FC<AnalysisDashboardProps> = ({ investments, benchmarkHistory, benchmarkName }) => {
  const data = useMemo(() => 
    calculateFundRatios(investments, benchmarkHistory), 
  [investments, benchmarkHistory]);

  const hasBenchmark = benchmarkHistory && benchmarkHistory.length > 0;

  if (investments.length === 0) {
    return (
        <div className="flex flex-col items-center justify-center h-64 text-slate-400 bg-white rounded-xl border border-dashed border-slate-200">
            <Activity size={32} className="mb-2" />
            <p>Add investments to see analysis</p>
        </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      
      {/* Portfolio Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard 
            title="Portfolio XIRR" 
            value={`${data.portfolio.xirr.toFixed(2)}%`}
            icon={<Percent size={20} className="text-emerald-600" />}
            desc="Annualized Return"
            colorClass="text-emerald-600"
        />
        <MetricCard 
            title="Portfolio Volatility" 
            value={`${data.portfolio.volatility.toFixed(2)}%`}
            icon={<Activity size={20} className="text-orange-500" />}
            desc="Annualized Std Dev"
            colorClass="text-orange-500"
        />
        <MetricCard 
            title="Beta (vs Benchmark)" 
            value={hasBenchmark ? data.portfolio.beta.toFixed(2) : 'N/A'}
            icon={<Scale size={20} className="text-blue-500" />}
            desc={hasBenchmark ? `Risk relative to ${benchmarkName?.split(' ')[0] || 'Market'}` : 'Select Benchmark'}
            colorClass="text-blue-600"
        />
        <MetricCard 
            title="Jensen's Alpha" 
            value={hasBenchmark ? data.portfolio.alpha.toFixed(2) + '%' : 'N/A'}
            icon={<TrendingUp size={20} className="text-violet-500" />}
            desc={hasBenchmark ? "Excess return over risk adjusted" : 'Select Benchmark'}
            colorClass="text-violet-600"
        />
      </div>

      {!hasBenchmark && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg flex items-start text-sm">
            <AlertCircle size={16} className="mt-0.5 mr-2 flex-shrink-0" />
            <p>Please select a benchmark (e.g. Nifty 50 ETF) above to calculate Alpha and Beta ratios.</p>
        </div>
      )}

      {/* Detailed Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
            <h3 className="font-semibold text-slate-800">Fund Wise Ratios</h3>
        </div>
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-500 font-medium">
                    <tr>
                        <th className="px-6 py-3">Fund Name</th>
                        <th className="px-6 py-3 text-right">Invested</th>
                        <th className="px-6 py-3 text-right">Current Value</th>
                        <th className="px-6 py-3 text-right text-emerald-600">XIRR</th>
                        <th className="px-6 py-3 text-right">Volatility</th>
                        <th className="px-6 py-3 text-right text-blue-600">Beta</th>
                        <th className="px-6 py-3 text-right text-violet-600">Alpha</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {data.funds.map((fund) => (
                        <tr key={fund.name} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4 font-medium text-slate-900 max-w-[200px] truncate" title={fund.name}>
                                {fund.name}
                            </td>
                            <td className="px-6 py-4 text-right whitespace-nowrap">{formatCurrency(fund.invested)}</td>
                            <td className="px-6 py-4 text-right whitespace-nowrap">{formatCurrency(fund.currentValue)}</td>
                            <td className="px-6 py-4 text-right font-semibold text-emerald-600">{fund.xirr.toFixed(2)}%</td>
                            <td className="px-6 py-4 text-right">{fund.volatility.toFixed(2)}%</td>
                            <td className="px-6 py-4 text-right text-slate-600">
                                {hasBenchmark ? fund.beta.toFixed(2) : '-'}
                            </td>
                            <td className="px-6 py-4 text-right text-violet-600 font-medium">
                                {hasBenchmark ? (fund.alpha > 0 ? '+' : '') + fund.alpha.toFixed(2) + '%' : '-'}
                            </td>
                        </tr>
                    ))}
                    <tr className="bg-slate-50 font-bold border-t border-slate-200">
                        <td className="px-6 py-4">Total Portfolio</td>
                        <td className="px-6 py-4 text-right">{formatCurrency(data.portfolio.invested)}</td>
                        <td className="px-6 py-4 text-right">{formatCurrency(data.portfolio.currentValue)}</td>
                        <td className="px-6 py-4 text-right text-emerald-700">{data.portfolio.xirr.toFixed(2)}%</td>
                        <td className="px-6 py-4 text-right text-slate-900">{data.portfolio.volatility.toFixed(2)}%</td>
                        <td className="px-6 py-4 text-right text-blue-700">{hasBenchmark ? data.portfolio.beta.toFixed(2) : '-'}</td>
                        <td className="px-6 py-4 text-right text-violet-700">{hasBenchmark ? data.portfolio.alpha.toFixed(2) + '%' : '-'}</td>
                    </tr>
                </tbody>
            </table>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-500">
         <div className="bg-slate-50 p-3 rounded-lg">
             <strong className="block text-slate-700 mb-1">Methodology</strong>
             <ul className="list-disc pl-4 space-y-1">
                 <li><strong>XIRR:</strong> Calculated using Newton-Raphson method on daily cashflows.</li>
                 <li><strong>Volatility:</strong> Annualized standard deviation of daily returns (252 days).</li>
                 <li><strong>Beta:</strong> Covariance of Fund vs Benchmark returns divided by Benchmark variance.</li>
                 <li><strong>Alpha:</strong> Jensen's Alpha assuming Risk Free rate of 6%.</li>
             </ul>
         </div>
      </div>
    </div>
  );
};
