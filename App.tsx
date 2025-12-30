import React, { useState, useMemo, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Layout } from './components/Layout';
import { AddInvestmentForm } from './components/AddInvestmentForm';
import { InvestmentList } from './components/InvestmentList';
import { ComparisonChart } from './components/ComparisonChart';
import { BenchmarkSelector } from './components/BenchmarkSelector';
import { AnalysisDashboard } from './components/AnalysisDashboard';
import { Investment, InvestmentType, NAVData } from './types';
import { getMFData, isDirectPlan, MFScheme } from './services/mfApiService';
import { generateBacktestData, formatCurrency, calculatePortfolioStats } from './utils/financials';
import { Info, FilterX, AlertCircle, BarChart3, PieChart, Download, Upload, TrendingUp, DollarSign, Wallet, TrendingDown, Activity, ShieldCheck, Tag } from 'lucide-react';

const App: React.FC = () => {
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [selectedInvestmentId, setSelectedInvestmentId] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<'CHART' | 'RATIOS'>('CHART');
  
  // Benchmark State
  const [benchmarkScheme, setBenchmarkScheme] = useState<MFScheme | null>(null);
  const [benchmarkHistory, setBenchmarkHistory] = useState<NAVData[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load from local storage
  useEffect(() => {
    const saved = localStorage.getItem('mf_portfolio_v2');
    if (saved) {
      try {
        setInvestments(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse saved portfolio");
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('mf_portfolio_v2', JSON.stringify(investments));
  }, [investments]);

  // Handle Benchmark Changes
  const handleBenchmarkSelect = async (scheme: MFScheme | null) => {
      setBenchmarkScheme(scheme);
      if (scheme) {
          try {
              const data = await getMFData(scheme.schemeCode);
              if (data) {
                  setBenchmarkHistory(data.data);
              }
          } catch (e) {
              console.error("Failed to fetch benchmark", e);
          }
      } else {
          setBenchmarkHistory([]);
      }
  };

  const handleExportPortfolio = () => {
    const dataStr = JSON.stringify(investments, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `mf-portfolio-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsedData = JSON.parse(content);
        if (Array.isArray(parsedData)) {
            const isValid = parsedData.every(item => item.id && item.schemeCode && item.amount);
            if (isValid) {
                // Ensure tags array exists for legacy imports
                const sanitized = parsedData.map(i => ({ ...i, tags: i.tags || [] }));
                setInvestments(sanitized);
            } else {
                alert("Invalid portfolio file format.");
            }
        }
      } catch (error) {
        console.error("Error parsing file", error);
        alert("Failed to read portfolio file.");
      }
    };
    reader.readAsText(file);
    event.target.value = ''; // Reset
  };

  const handleAddInvestment = async (
    investedScheme: MFScheme, 
    counterpartScheme: MFScheme | null, 
    type: InvestmentType, 
    amount: number, 
    startDate: string,
    endDate: string | undefined,
    tags: string[]
  ) => {
    const isDirect = isDirectPlan(investedScheme.schemeName);
    
    // Create initial entry
    const newInvestment: Investment = {
      id: uuidv4(),
      schemeCode: investedScheme.schemeCode,
      name: investedScheme.schemeName,
      isDirect,
      type,
      amount,
      startDate,
      endDate,
      tags,
      navHistory: [],
      counterpartSchemeCode: counterpartScheme?.schemeCode,
      counterpartName: counterpartScheme?.schemeName,
      isLoading: true
    };

    setInvestments(prev => [...prev, newInvestment]);
    setIsProcessing(true);

    try {
      const mainData = await getMFData(investedScheme.schemeCode);
      if (!mainData) throw new Error("Could not fetch NAV data for selected fund");

      let counterpartData = null;
      if (counterpartScheme) {
        counterpartData = await getMFData(counterpartScheme.schemeCode);
      }

      setInvestments(prev => prev.map(inv => {
        if (inv.id === newInvestment.id) {
            return {
                ...inv,
                isLoading: false,
                category: mainData.meta.scheme_category,
                fundHouse: mainData.meta.fund_house,
                navHistory: mainData.data,
                counterpartNavHistory: counterpartData?.data || [],
                error: !counterpartData ? "Comparison data unavailable" : undefined
            };
        }
        return inv;
      }));

    } catch (err) {
      console.error(err);
      setInvestments(prev => prev.map(inv => 
        inv.id === newInvestment.id 
          ? { ...inv, isLoading: false, error: "Failed to fetch data." } 
          : inv
      ));
    } finally {
      setIsProcessing(false);
    }
  };

  const removeInvestment = (id: string) => {
    setInvestments(prev => prev.filter(inv => inv.id !== id));
    if (selectedInvestmentId === id) {
      setSelectedInvestmentId(null);
    }
  };

  const updateInvestment = (id: string, amount: number, startDate: string, endDate: string | undefined, tags: string[]) => {
    setInvestments(prev => prev.map(inv => 
      inv.id === id 
        ? { ...inv, amount, startDate, endDate, tags }
        : inv
    ));
  };

  const toggleSelection = (id: string) => {
    setSelectedInvestmentId(prev => prev === id ? null : id);
  };

  // Get unique tags
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    investments.forEach(inv => inv.tags?.forEach(t => tags.add(t)));
    return Array.from(tags).sort();
  }, [investments]);

  // Filter data based on selection
  const filteredInvestments = useMemo(() => {
    if (selectedTag) {
        return investments.filter(inv => inv.tags?.includes(selectedTag));
    }
    return investments;
  }, [investments, selectedTag]);

  const activeInvestments = useMemo(() => {
    if (selectedInvestmentId) {
      return investments.filter(inv => inv.id === selectedInvestmentId);
    }
    return filteredInvestments;
  }, [investments, filteredInvestments, selectedInvestmentId]);

  const chartData = useMemo(() => 
    generateBacktestData(activeInvestments, benchmarkHistory), 
  [activeInvestments, benchmarkHistory]);

  // Extended Stats Calculation
  const stats = useMemo(() => {
      return calculatePortfolioStats(activeInvestments, chartData, benchmarkHistory);
  }, [activeInvestments, chartData, benchmarkHistory]);

  const selectedInvestmentName = useMemo(() => {
    if (selectedInvestmentId) {
        const inv = investments.find(i => i.id === selectedInvestmentId);
        return inv ? inv.name : 'Selected Fund';
    }
    if (selectedTag) {
        return `Tag: ${selectedTag}`;
    }
    return 'Entire Portfolio';
  }, [investments, selectedInvestmentId, selectedTag]);

  return (
    <Layout>
      <div className="space-y-12">
        
        {/* SECTION 1: EXPANDED KPI DASHBOARD (Top Priority) */}
        <section>
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-slate-900">Portfolio Performance</h3>
                <div className="flex items-center gap-2">
                    <BenchmarkSelector 
                        selectedScheme={benchmarkScheme} 
                        onSelect={handleBenchmarkSelect} 
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* CARD 1: VALUE & XIRR */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:border-emerald-200 transition-colors">
                    <div>
                        <div className="flex justify-between items-start mb-2">
                            <p className="text-sm text-slate-500 font-medium flex items-center gap-1">
                                <Wallet size={14} /> Total Value
                            </p>
                            <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-bold">
                                {stats.xirr.toFixed(2)}% XIRR
                            </span>
                        </div>
                        <p className="text-3xl font-bold text-slate-900">{formatCurrency(stats.currentValue)}</p>
                    </div>
                    <div className="mt-4 pt-4 border-t border-slate-50 flex justify-between items-center text-xs">
                        <span className="text-slate-400">Invested: {formatCurrency(stats.totalInvested)}</span>
                        <span className="text-emerald-600 font-medium">+{formatCurrency(stats.currentValue - stats.totalInvested)}</span>
                    </div>
                </div>

                {/* CARD 2: PLAN SELECTION IMPACT */}
                <div className={`bg-white p-6 rounded-2xl border shadow-sm flex flex-col justify-between transition-colors ${stats.netImpact >= 0 ? 'border-slate-200 hover:border-emerald-200' : 'border-red-100 hover:border-red-300'}`}>
                     <div>
                        <p className="text-sm text-slate-500 font-medium mb-1 flex items-center gap-1">
                            <ShieldCheck size={14} /> Plan Selection Impact
                        </p>
                        <p className={`text-3xl font-bold ${stats.netImpact >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                            {stats.netImpact >= 0 ? '+' : ''}{formatCurrency(stats.netImpact)}
                        </p>
                    </div>
                     <div className="mt-4 pt-4 border-t border-slate-50 text-xs text-slate-500 flex justify-between">
                        <span>{stats.netImpact >= 0 ? "Saved vs Alternate" : "Loss vs Alternate Plan"}</span>
                        <span className="font-medium">
                             {formatCurrency(Math.abs(stats.yearlyImpact))}/yr
                        </span>
                    </div>
                </div>

                {/* CARD 3: RISK METRICS (MaxDD / RoMaD) */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:border-red-200 transition-colors">
                     <div>
                        <div className="flex justify-between items-start mb-2">
                            <p className="text-sm text-slate-500 font-medium flex items-center gap-1">
                                <TrendingDown size={14} /> Max Drawdown
                            </p>
                             <div className="bg-slate-50 text-slate-500 p-1.5 rounded-md">
                                <Activity size={16} />
                            </div>
                        </div>
                        <p className="text-3xl font-bold text-slate-800">
                            -{stats.maxDrawdown.toFixed(2)}%
                        </p>
                    </div>
                     <div className="mt-4 pt-4 border-t border-slate-50 text-xs flex justify-between items-center">
                        <span className="text-slate-400" title="Return on Max Drawdown">RoMaD Score</span>
                        <span className={`font-bold ${stats.romad > 1 ? 'text-emerald-600' : 'text-amber-500'}`}>{stats.romad.toFixed(2)}</span>
                    </div>
                </div>

                {/* CARD 4: ALPHA / BETA */}
                <div className={`bg-white p-6 rounded-2xl border shadow-sm flex flex-col justify-between transition-colors ${benchmarkScheme ? 'border-slate-200 hover:border-violet-200' : 'border-dashed border-slate-300'}`}>
                    {benchmarkScheme ? (
                        <>
                             <div>
                                <div className="flex justify-between items-start mb-2">
                                    <p className="text-sm text-slate-500 font-medium flex items-center gap-1">
                                        <TrendingUp size={14} /> Alpha
                                    </p>
                                    <span className="text-xs text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full font-medium truncate max-w-[100px]">
                                        vs {benchmarkScheme.schemeName}
                                    </span>
                                </div>
                                <p className={`text-3xl font-bold ${stats.alpha! > 0 ? 'text-violet-600' : 'text-slate-600'}`}>
                                    {stats.alpha! > 0 ? '+' : ''}{stats.alpha!.toFixed(2)}%
                                </p>
                            </div>
                            <div className="mt-4 pt-4 border-t border-slate-50 text-xs flex justify-between items-center">
                                <span className="text-slate-400">Beta (Volatility)</span>
                                <span className="font-bold text-slate-700">{stats.beta!.toFixed(2)}</span>
                            </div>
                        </>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-center text-slate-400">
                            <TrendingUp size={32} className="mb-2 opacity-30" />
                            <p className="text-sm font-medium">Add Benchmark</p>
                            <p className="text-xs mt-1 opacity-70">to see Alpha & Beta</p>
                        </div>
                    )}
                </div>
            </div>
        </section>

        {/* SECTION 2: ADD FUNDS */}
        <section>
             <div className="flex items-end justify-between mb-4 border-t border-slate-200 pt-8">
                 <div>
                    <h3 className="text-xl font-bold text-slate-900">Add Investments</h3>
                    <p className="text-sm text-slate-500">Configure your portfolio</p>
                 </div>
                 <div className="hidden md:block text-xs text-slate-400 max-w-md text-right">
                    We automatically find Direct/Regular plan counterparts.
                 </div>
             </div>
             
             <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                <div className="lg:col-span-8">
                     <AddInvestmentForm onAdd={handleAddInvestment} isProcessing={isProcessing} />
                </div>
                <div className="hidden lg:block lg:col-span-4">
                    <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-6 h-full flex flex-col justify-center">
                        <div className="mb-4 bg-white w-12 h-12 rounded-xl flex items-center justify-center shadow-sm text-blue-600">
                            <Info size={24} />
                        </div>
                        <h4 className="font-bold text-blue-900 text-lg mb-2">How it works</h4>
                        <p className="text-blue-800/80 text-sm leading-relaxed mb-4">
                            1. <strong>Search</strong> for any fund.<br/>
                            2. We <strong>auto-detect</strong> its counterpart.<br/>
                            3. Set <strong>SIP or Lumpsum</strong>.<br/>
                            4. See <strong>Real Returns</strong> & Risk stats.
                        </p>
                    </div>
                </div>
             </div>
        </section>

        {/* SECTION 3: PORTFOLIO LIST */}
        <section>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end border-b border-slate-200 pb-4 mb-6 gap-4 border-t border-slate-200 pt-8">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Your Holdings</h3>
                <p className="text-sm text-slate-500 mt-1">Manage {investments.length} active investments</p>
              </div>
              <div className="flex space-x-2">
                 <input 
                    type="file" 
                    ref={fileInputRef}
                    className="hidden" 
                    accept=".json"
                    onChange={handleFileChange}
                 />
                 <button 
                    onClick={handleImportClick}
                    className="flex items-center px-4 py-2 bg-white border border-slate-200 text-slate-600 hover:text-emerald-600 hover:border-emerald-200 rounded-lg text-sm font-medium transition-all shadow-sm"
                 >
                    <Upload size={16} className="mr-2" /> Import
                 </button>
                 <button 
                    onClick={handleExportPortfolio}
                    className="flex items-center px-4 py-2 bg-white border border-slate-200 text-slate-600 hover:text-emerald-600 hover:border-emerald-200 rounded-lg text-sm font-medium transition-all shadow-sm"
                 >
                    <Download size={16} className="mr-2" /> Export
                 </button>
              </div>
            </div>

            {/* TAG FILTER BAR */}
            {allTags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-6">
                    <button
                        onClick={() => setSelectedTag(null)}
                        className={`px-3 py-1 text-xs font-semibold rounded-full border transition-all ${
                            !selectedTag 
                            ? 'bg-slate-800 text-white border-slate-800' 
                            : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                        }`}
                    >
                        All
                    </button>
                    {allTags.map(tag => (
                        <button
                            key={tag}
                            onClick={() => setSelectedTag(prev => prev === tag ? null : tag)}
                            className={`px-3 py-1 text-xs font-semibold rounded-full border transition-all flex items-center ${
                                selectedTag === tag
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-200 hover:text-emerald-700'
                            }`}
                        >
                            <Tag size={10} className="mr-1.5" />
                            {tag}
                        </button>
                    ))}
                </div>
            )}
            
            <InvestmentList 
              investments={filteredInvestments} 
              onRemove={removeInvestment} 
              onUpdate={updateInvestment}
              selectedId={selectedInvestmentId}
              onSelect={toggleSelection}
            />
        </section>

        {/* SECTION 4: CHARTS */}
        <section className="border-t border-slate-200 pt-8">
            <h3 className="text-xl font-bold text-slate-900 mb-6">Detailed Analysis</h3>
            
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm min-h-[600px] flex flex-col">
                 <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4 border-b border-slate-100 pb-6">
                    <div className="flex-1">
                        <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                        {activeTab === 'CHART' ? 'Growth Chart' : 'Ratios & Risk Analysis'}
                        </h3>
                        <p className="text-sm text-slate-500 mt-1">
                        Analyzing: <span className="font-semibold text-emerald-600">{selectedInvestmentName}</span>
                        </p>
                    </div>
                    
                    <div className="flex flex-col items-end gap-3">
                        {(selectedInvestmentId || selectedTag) && (
                            <button 
                                onClick={() => {
                                    setSelectedInvestmentId(null);
                                    setSelectedTag(null);
                                }}
                                className="flex items-center px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-medium transition-colors"
                            >
                                <FilterX className="w-3 h-3 mr-1.5" />
                                Clear Filter
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex space-x-1 bg-slate-100/50 p-1 rounded-xl w-fit mb-6">
                    <button
                        onClick={() => setActiveTab('CHART')}
                        className={`flex items-center px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
                            activeTab === 'CHART' 
                            ? 'bg-white text-emerald-600 shadow-sm' 
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        <BarChart3 size={16} className="mr-2" />
                        Backtest Chart
                    </button>
                    <button
                        onClick={() => setActiveTab('RATIOS')}
                        className={`flex items-center px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
                            activeTab === 'RATIOS' 
                            ? 'bg-white text-emerald-600 shadow-sm' 
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        <PieChart size={16} className="mr-2" />
                        Ratios & Analysis
                    </button>
                </div>

                <div className="flex-1">
                    {activeTab === 'CHART' ? (
                        <>
                            {chartData.length > 0 ? (
                            <ComparisonChart 
                                data={chartData} 
                                benchmarkName={benchmarkScheme?.schemeName}
                            />
                            ) : (
                            <div className="h-full min-h-[400px] flex flex-col items-center justify-center bg-slate-50/50 rounded-xl border border-dashed border-slate-200 text-slate-400">
                                <BarChart3 size={48} className="mb-4 opacity-20" />
                                <p>Add investments to view the projection graph</p>
                            </div>
                            )}
                            <div className="mt-6 flex items-start p-4 bg-slate-50 rounded-xl border border-slate-100 text-sm">
                                <Info className="h-5 w-5 mr-3 flex-shrink-0 mt-0.5 text-slate-400" />
                                <div className="space-y-1 text-slate-600">
                                    <p>
                                        This chart compares the <strong>actual NAV history</strong>. It is not a projection based on assumed percentages.
                                    </p>
                                    {benchmarkScheme && (
                                        <p className="text-slate-500 text-xs">
                                            <AlertCircle size={12} className="inline mr-1" />
                                            Benchmark curve simulates investing the same amount/dates into {benchmarkScheme.schemeName}.
                                        </p>
                                    )}
                                </div>
                            </div>
                        </>
                    ) : (
                        <AnalysisDashboard 
                            investments={activeInvestments}
                            benchmarkHistory={benchmarkHistory}
                            benchmarkName={benchmarkScheme?.schemeName}
                        />
                    )}
                </div>
            </div>
        </section>

      </div>
    </Layout>
  );
};

export default App;