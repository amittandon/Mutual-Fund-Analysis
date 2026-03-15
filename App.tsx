import React, { useState, useMemo, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Layout } from './components/Layout';
import { AddInvestmentForm } from './components/AddInvestmentForm';
import { CustomFundForm } from './components/CustomFundForm';
import { InvestmentTable } from './components/InvestmentTable';
import { ComparisonChart } from './components/ComparisonChart';
import { BenchmarkSelector } from './components/BenchmarkSelector';
import { AnalysisDashboard } from './components/AnalysisDashboard';
import { TaxHarvesting } from './components/TaxHarvesting';
import { FundPerformance } from './components/FundPerformance';
import { RedemptionModal } from './components/RedemptionModal';
import { RedemptionHistory } from './components/RedemptionHistory';
import { EditInvestmentModal } from './components/EditInvestmentModal';
import { FundManager } from './components/FundManager';
import { Investment, InvestmentType, NAVData, Redemption } from './types';
import { getMFData, isDirectPlan, MFScheme, DEAD_FUND_MAPPING, downsampleNAVData } from './services/mfApiService';
import { generateBacktestData, formatCurrency, calculatePortfolioStats, parseISODate, getLatestValidNav } from './utils/financials';
import { Info, FilterX, AlertCircle, BarChart3, PieChart, Download, Upload, Wallet, TrendingDown, TrendingUp, Activity, ShieldCheck, Tag, LayoutDashboard, List, PlusCircle, Database, Calculator, FileText, RefreshCw, LogOut, X, ArrowRightLeft } from 'lucide-react';

const App: React.FC = () => {
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [selectedInvestmentId, setSelectedInvestmentId] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [redemptionTarget, setRedemptionTarget] = useState<Investment | null>(null);
  const [editingInvestment, setEditingInvestment] = useState<Investment | null>(null);
  
  // Navigation State
  const [currentTab, setCurrentTab] = useState<'DASHBOARD' | 'PORTFOLIO' | 'FUND_DETAILS' | 'ADD_FUND' | 'ADD_CUSTOM' | 'TAX_HARVESTING' | 'REDEMPTIONS' | 'FUND_MANAGER'>('DASHBOARD');
  const [analysisView, setAnalysisView] = useState<'CHART' | 'RATIOS'>('CHART');
  
  // Benchmark State
  const [benchmarkScheme, setBenchmarkScheme] = useState<MFScheme | null>(null);
  const [benchmarkHistory, setBenchmarkHistory] = useState<NAVData[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const getImportantDates = (inv: Investment): string[] => {
    const dates: string[] = [];
    const start = parseISODate(inv.startDate);
    
    const formatDate = (d: Date) => {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}-${month}-${year}`;
    };

    if (inv.type === InvestmentType.LUMPSUM) {
      dates.push(formatDate(start));
    } else {
      const startDay = start.getDate();
      const now = new Date();
      let cursorDate = new Date(start);
      cursorDate.setDate(1);

      while (cursorDate <= now) {
        const year = cursorDate.getFullYear();
        const month = cursorDate.getMonth();
        const maxDayInMonth = new Date(year, month + 1, 0).getDate();
        const actualDay = Math.min(startDay, maxDayInMonth);
        const paymentDate = new Date(year, month, actualDay);

        if (paymentDate >= start && paymentDate <= now && (!inv.endDate || paymentDate <= parseISODate(inv.endDate))) {
          dates.push(formatDate(paymentDate));
        }
        cursorDate.setMonth(cursorDate.getMonth() + 1);
      }
    }
    
    inv.redemptions?.forEach(r => {
      const d = parseISODate(r.date);
      if (!isNaN(d.getTime())) {
        dates.push(formatDate(d));
      }
    });

    return dates;
  };

  const migrateInvestments = (invs: Investment[]): Investment[] => {
    return invs.map(inv => {
      if (inv.source === 'CUSTOM') return inv;
      
      let updated = { ...inv };
      let needsRefresh = false;

      // Check if history is missing (as we don't save it to localStorage anymore)
      if (!inv.navHistory || inv.navHistory.length === 0) {
        needsRefresh = true;
      } else {
        // Migration: Downsample old data if it exists
        const importantDates = getImportantDates(inv);
        updated.navHistory = downsampleNAVData(inv.navHistory, importantDates);
        if (inv.counterpartNavHistory && inv.counterpartNavHistory.length > 0) {
          updated.counterpartNavHistory = downsampleNAVData(inv.counterpartNavHistory, importantDates);
        }
      }

      // Check main scheme
      const codeStr = String(inv.schemeCode);
      if (DEAD_FUND_MAPPING[codeStr]) {
        updated.schemeCode = DEAD_FUND_MAPPING[codeStr].schemeCode;
        updated.name = DEAD_FUND_MAPPING[codeStr].schemeName;
        updated.navHistory = []; // Clear history to force refresh
        needsRefresh = true;
      }

      // Check counterpart scheme
      if (inv.counterpartSchemeCode) {
        const cpCodeStr = String(inv.counterpartSchemeCode);
        if (DEAD_FUND_MAPPING[cpCodeStr]) {
          updated.counterpartSchemeCode = DEAD_FUND_MAPPING[cpCodeStr].schemeCode;
          updated.counterpartName = DEAD_FUND_MAPPING[cpCodeStr].schemeName;
          updated.counterpartNavHistory = []; // Clear history to force refresh
          needsRefresh = true;
        }
      }

      if (needsRefresh) {
        updated.isLoading = true;
      }

      return updated;
    });
  };

  // Load from local storage
  useEffect(() => {
    const saved = localStorage.getItem('mf_portfolio_v2');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const migrated = migrateInvestments(parsed);
        setInvestments(migrated);
        
        // Trigger refresh for loaded investments since we don't save history to avoid quota limits
        if (migrated.length > 0) {
          refreshNavs(migrated);
        }
      } catch (e) {
        console.error("Failed to parse saved portfolio");
      }
    }
  }, []);

  useEffect(() => {
    try {
      // Strip history to avoid QuotaExceededError in localStorage
      // We only save the metadata and transaction details
      const strippedInvs = investments.map(inv => ({
        ...inv,
        navHistory: [],
        counterpartNavHistory: [],
        isLoading: false // Reset loading state for saved data
      }));
      localStorage.setItem('mf_portfolio_v2', JSON.stringify(strippedInvs));
    } catch (e) {
      console.error("Failed to save to localStorage", e);
      // If it still fails even after stripping (very unlikely unless there are thousands of transactions)
      if (e instanceof Error && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
         console.warn("Local storage quota exceeded even after stripping history.");
      }
    }
  }, [investments]);

  // Handle Benchmark Changes
  const handleBenchmarkSelect = async (scheme: MFScheme | null) => {
      setBenchmarkScheme(scheme);
      if (scheme) {
          try {
              const data = await getMFData(scheme.schemeCode);
              if (data) {
                  // Downsample benchmark too
                  setBenchmarkHistory(downsampleNAVData(data.data));
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
    reader.onerror = (e) => {
      console.error("FileReader error", e);
    };
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        if (!content) throw new Error("File is empty");
        
        const parsedData = JSON.parse(content);
        if (Array.isArray(parsedData)) {
            // Basic validation
            const validInvestments = parsedData.filter(item => item && typeof item === 'object' && item.id && item.name);
            
            if (validInvestments.length > 0) {
                // Ensure tags array exists for legacy imports and sanitize
                const sanitized = validInvestments.map(i => ({ 
                    ...i, 
                    tags: Array.isArray(i.tags) ? i.tags : [],
                    amount: Number(i.amount) || 0,
                    startDate: String(i.startDate || ''),
                    endDate: i.endDate ? String(i.endDate) : undefined
                }));
                
                const migrated = migrateInvestments(sanitized);
                setInvestments(migrated);
                setError(null);
            } else {
                setError("The file does not contain valid portfolio data.");
            }
        } else {
            setError("Invalid file format. Expected a JSON array of investments.");
        }
      } catch (error) {
        console.error("Error parsing file", error);
        setError("Failed to read portfolio file. Please ensure it is a valid JSON file.");
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
    
    // Create initial entry with isLoading=true
    // The fetchMissingNavs useEffect will pick this up and fetch the data
    const newInvestment: Investment = {
      id: uuidv4(),
      source: 'API',
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
    setCurrentTab('PORTFOLIO'); // Switch to portfolio after adding
  };

  const handleAddCustomFund = (
    name: string,
    type: InvestmentType,
    amount: number,
    startDate: string,
    endDate: string | undefined,
    navHistory: NAVData[],
    tags: string[]
  ) => {
      const newInvestment: Investment = {
          id: uuidv4(),
          source: 'CUSTOM',
          schemeCode: 'CUSTOM',
          name: name,
          isDirect: true, // Defaulting custom to direct for color coding
          type,
          amount,
          startDate,
          endDate,
          tags,
          navHistory: navHistory,
          isLoading: false
      };
      
      setInvestments(prev => [...prev, newInvestment]);
      setCurrentTab('PORTFOLIO');
  };

  const removeInvestment = (id: string) => {
    setInvestments(prev => prev.filter(inv => inv.id !== id));
    if (selectedInvestmentId === id) {
      setSelectedInvestmentId(null);
    }
  };

  const updateInvestment = async (id: string, updates: { 
    name: string; 
    schemeCode?: string; 
    isDirect?: boolean; 
    counterpartSchemeCode?: string | null;
    counterpartName?: string;
    source?: 'API' | 'CUSTOM';
    startDate?: string;
  }) => {
    const inv = investments.find(i => i.id === id);
    if (!inv) return;

    let navHistory = inv.navHistory;
    let counterpartNavHistory = inv.counterpartNavHistory;
    
    setProcessingId(id);

    try {
      // If primary scheme changed, fetch new history
      if (updates.schemeCode && updates.schemeCode !== inv.schemeCode) {
        const data = await getMFData(updates.schemeCode);
        if (data) navHistory = data.data;
      }

      // If counterpart scheme changed, fetch new history
      if (updates.counterpartSchemeCode !== undefined && updates.counterpartSchemeCode !== inv.counterpartSchemeCode) {
        if (updates.counterpartSchemeCode) {
          const data = await getMFData(updates.counterpartSchemeCode);
          if (data) counterpartNavHistory = data.data;
        } else {
          counterpartNavHistory = undefined;
        }
      }

      // Re-downsample if needed
      const mergedInv = { ...inv, ...updates };
      const importantDates = getImportantDates(mergedInv);
      
      if (navHistory) navHistory = downsampleNAVData(navHistory, importantDates);
      if (counterpartNavHistory) counterpartNavHistory = downsampleNAVData(counterpartNavHistory, importantDates);

      setInvestments(prev => prev.map(i => 
        i.id === id ? { 
          ...i, 
          ...updates,
          navHistory: navHistory || i.navHistory,
          counterpartNavHistory: counterpartNavHistory,
          isLoading: false
        } : i
      ));
    } catch (error) {
      console.error("Failed to update investment data:", error);
    } finally {
      setProcessingId(null);
    }
  };

  const addRedemption = (investmentId: string, redemption: Redemption) => {
    setInvestments(prev => prev.map(inv => {
      if (inv.id === investmentId) {
        return {
          ...inv,
          redemptions: [...(inv.redemptions || []), redemption]
        };
      }
      return inv;
    }));
  };

  const removeRedemption = (investmentId: string, redemptionId: string) => {
    setInvestments(prev => prev.map(inv => {
      if (inv.id === investmentId) {
        return {
          ...inv,
          redemptions: (inv.redemptions || []).filter(r => r.id !== redemptionId)
        };
      }
      return inv;
    }));
  };

  const refreshSingleNav = async (id: string) => {
    setProcessingId(id);
    setError(null);
    const inv = investments.find(i => i.id === id);
    if (!inv || inv.source === 'CUSTOM') {
      setProcessingId(null);
      return;
    }

    try {
      const mainData = await getMFData(inv.schemeCode);
      if (!mainData || !mainData.data) {
        throw new Error(`No data returned for ${inv.name}`);
      }

      let counterpartData = null;
      if (inv.counterpartSchemeCode) {
        counterpartData = await getMFData(inv.counterpartSchemeCode);
      }
      
      const importantDates = getImportantDates(inv);

      setInvestments(prev => prev.map(i => {
        if (i.id === id) {
          return {
            ...i,
            category: mainData?.meta?.scheme_category || i.category,
            fundHouse: mainData?.meta?.fund_house || i.fundHouse,
            navHistory: downsampleNAVData(mainData.data, importantDates),
            counterpartNavHistory: counterpartData ? downsampleNAVData(counterpartData.data, importantDates) : i.counterpartNavHistory,
            isLoading: false,
            error: undefined
          };
        }
        return i;
      }));
    } catch (err) {
      console.error(`Failed to refresh NAV for ${inv.name}`, err);
      setError(`Failed to refresh data for ${inv.name}. The API might be down.`);
    }
    setProcessingId(null);
  };

  const isFetchingRef = useRef(false);

  const fetchMissingNavs = async (invs: Investment[]) => {
    if (isFetchingRef.current) return;
    const needingFetch = invs.filter(i => i.isLoading && i.source === 'API');
    if (needingFetch.length === 0) return;

    isFetchingRef.current = true;
    setIsProcessing(true);

    // Process sequentially to avoid rate limits
    for (const inv of needingFetch) {
      try {
        const mainData = await getMFData(inv.schemeCode);
        let counterpartData = null;
        if (inv.counterpartSchemeCode) {
          counterpartData = await getMFData(inv.counterpartSchemeCode);
        }
        
        const importantDates = getImportantDates(inv);

        setInvestments(prev => {
          const newInvs = [...prev];
          const index = newInvs.findIndex(i => i.id === inv.id);
          if (index !== -1) {
            const latestNav = mainData ? getLatestValidNav(mainData.data) : 0;
            const latestCpNav = counterpartData ? getLatestValidNav(counterpartData.data) : 0;

            newInvs[index] = {
              ...newInvs[index],
              category: mainData?.meta?.scheme_category || newInvs[index].category,
              fundHouse: mainData?.meta?.fund_house || newInvs[index].fundHouse,
              navHistory: mainData ? downsampleNAVData(mainData.data, importantDates) : newInvs[index].navHistory,
              currentNav: latestNav || newInvs[index].currentNav,
              counterpartNavHistory: counterpartData ? downsampleNAVData(counterpartData.data, importantDates) : newInvs[index].counterpartNavHistory,
              counterpartCurrentNav: latestCpNav || newInvs[index].counterpartCurrentNav,
              isLoading: false,
              error: mainData ? undefined : "Failed to fetch NAV data"
            };
          }
          return newInvs;
        });
        // Small delay between requests
        await new Promise(r => setTimeout(r, 200));
      } catch (err) {
        console.error(`Failed to fetch NAV for ${inv.name}`, err);
        setInvestments(prev => {
          const newInvs = [...prev];
          const index = newInvs.findIndex(i => i.id === inv.id);
          if (index !== -1) {
            newInvs[index] = { ...newInvs[index], isLoading: false, error: "Failed to fetch NAV data" };
          }
          return newInvs;
        });
      }
    }

    setIsProcessing(false);
    isFetchingRef.current = false;
  };

  useEffect(() => {
    fetchMissingNavs(investments).catch(err => console.error("fetchMissingNavs error", err));
  }, [investments.map(i => i.isLoading).join(',')]);

  const refreshNavs = async (targetInvs?: Investment[] | React.MouseEvent) => {
    if (isProcessing) return;
    
    try {
      setIsProcessing(true);
      setError(null);
      
      let errorCount = 0;
      
      // We iterate over a snapshot of the current investments or the provided target
      // If called from onClick, targetInvs will be an event object, so we default to investments
      const currentInvs = Array.isArray(targetInvs) ? targetInvs : [...investments];
      
      if (currentInvs.length === 0) {
        setIsProcessing(false);
        return;
      }

      for (const inv of currentInvs) {
        if (inv.source === 'CUSTOM') continue;
        
        // Mark this specific fund as loading in the UI
        setInvestments(prev => prev.map(i => i.id === inv.id ? { ...i, isLoading: true } : i));

        try {
          const mainData = await getMFData(inv.schemeCode);
          if (!mainData || !mainData.data) {
            throw new Error(`No data returned for ${inv.name}`);
          }

          let counterpartData = null;
          if (inv.counterpartSchemeCode) {
            counterpartData = await getMFData(inv.counterpartSchemeCode);
          }
          
          const importantDates = getImportantDates(inv);
          
          setInvestments(prev => prev.map(i => {
            if (i.id === inv.id) {
              const latestNav = getLatestValidNav(mainData.data);
              const latestCpNav = counterpartData ? getLatestValidNav(counterpartData.data) : i.counterpartCurrentNav;

              return {
                ...i,
                category: mainData?.meta?.scheme_category || i.category,
                fundHouse: mainData?.meta?.fund_house || i.fundHouse,
                navHistory: downsampleNAVData(mainData.data, importantDates),
                currentNav: latestNav || i.currentNav,
                counterpartNavHistory: counterpartData ? downsampleNAVData(counterpartData.data, importantDates) : i.counterpartNavHistory,
                counterpartCurrentNav: latestCpNav || i.counterpartCurrentNav,
                isLoading: false,
                error: undefined
              };
            }
            return i;
          }));
          
          // Small delay between requests to avoid rate limits
          await new Promise(r => setTimeout(r, 300));
        } catch (err) {
          console.error(`Failed to refresh NAV for ${inv.name}`, err);
          errorCount++;
          setInvestments(prev => prev.map(i => {
            if (i.id === inv.id) {
              return { ...i, isLoading: false, error: "Failed to refresh NAV data" };
            }
            return i;
          }));
        }
      }
      
      if (errorCount > 0) {
        setError(`${errorCount} fund(s) failed to refresh. Please check the portfolio table for details.`);
      }
    } catch (err) {
      console.error("Global refresh failed", err);
      setError("Failed to refresh portfolio. Please try again later.");
    } finally {
      setIsProcessing(false);
    }
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
      {/* Error Notification */}
      {error && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-4 duration-300">
          <div className="bg-red-600 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 max-w-md border border-red-500/20">
            <div className="bg-white/20 p-2 rounded-lg">
              <AlertCircle size={20} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold">Something went wrong</p>
              <p className="text-xs opacity-90 mt-0.5">{error}</p>
            </div>
            <button 
              onClick={() => setError(null)}
              className="p-1 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      {/* GLOBAL NAVIGATION */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-200 pb-2 mb-8 gap-4">
          <nav className="flex space-x-2 bg-slate-100 p-1 rounded-xl overflow-x-auto max-w-full">
              <button 
                onClick={() => setCurrentTab('DASHBOARD')}
                className={`flex items-center px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${currentTab === 'DASHBOARD' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                  <LayoutDashboard size={16} className="mr-2"/> Dashboard
              </button>
              <button 
                onClick={() => setCurrentTab('PORTFOLIO')}
                className={`flex items-center px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${currentTab === 'PORTFOLIO' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                  <List size={16} className="mr-2"/> Portfolio
              </button>
              <button 
                onClick={() => setCurrentTab('FUND_DETAILS')}
                className={`flex items-center px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${currentTab === 'FUND_DETAILS' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                  <FileText size={16} className="mr-2"/> Fund Details
              </button>
              <button 
                onClick={() => setCurrentTab('ADD_FUND')}
                className={`flex items-center px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${currentTab === 'ADD_FUND' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                  <PlusCircle size={16} className="mr-2"/> Add Mutual Fund
              </button>
               <button 
                onClick={() => setCurrentTab('ADD_CUSTOM')}
                className={`flex items-center px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${currentTab === 'ADD_CUSTOM' ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                  <Database size={16} className="mr-2"/> Add Manual Fund Details
              </button>
              <button 
                onClick={() => setCurrentTab('TAX_HARVESTING')}
                className={`flex items-center px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${currentTab === 'TAX_HARVESTING' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                  <Calculator size={16} className="mr-2"/> Tax Harvesting
              </button>
              <button 
                onClick={() => setCurrentTab('REDEMPTIONS')}
                className={`flex items-center px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${currentTab === 'REDEMPTIONS' ? 'bg-white text-amber-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                  <LogOut size={16} className="mr-2"/> Redemptions
              </button>
              <button 
                onClick={() => setCurrentTab('FUND_MANAGER')}
                className={`flex items-center px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${currentTab === 'FUND_MANAGER' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                  <ArrowRightLeft size={16} className="mr-2"/> Fund Manager
              </button>
          </nav>

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
                    className="flex items-center px-3 py-2 bg-white border border-slate-200 text-slate-600 hover:text-emerald-600 hover:border-emerald-200 rounded-lg text-xs font-medium transition-all shadow-sm"
                 >
                    <Upload size={14} className="mr-2" /> Import
                 </button>
                 <button 
                    onClick={handleExportPortfolio}
                    className="flex items-center px-3 py-2 bg-white border border-slate-200 text-slate-600 hover:text-emerald-600 hover:border-emerald-200 rounded-lg text-xs font-medium transition-all shadow-sm"
                 >
                    <Download size={14} className="mr-2" /> Export
                 </button>
           </div>
      </div>

      <div className="space-y-12">
        
        {/* VIEW: DASHBOARD */}
        {currentTab === 'DASHBOARD' && (
            <>
                {/* SECTION 1: EXPANDED KPI DASHBOARD (Top Priority) */}
                <section className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-bold text-slate-900">Performance Summary</h3>
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
                                        <p className={`text-3xl font-bold ${(stats.alpha ?? 0) > 0 ? 'text-violet-600' : 'text-slate-600'}`}>
                                            {(stats.alpha ?? 0) > 0 ? '+' : ''}{(stats.alpha ?? 0).toFixed(2)}%
                                        </p>
                                    </div>
                                    <div className="mt-4 pt-4 border-t border-slate-50 text-xs flex justify-between items-center">
                                        <span className="text-slate-400">Beta (Volatility)</span>
                                        <span className="font-bold text-slate-700">{(stats.beta ?? 0).toFixed(2)}</span>
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

                 {/* SECTION 4: CHARTS & ANALYSIS */}
                <section className="pt-2 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm min-h-[600px] flex flex-col">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4 border-b border-slate-100 pb-6">
                            <div className="flex-1">
                                <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                                {analysisView === 'CHART' ? 'Growth Chart' : 'Ratios & Risk Analysis'}
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
                                onClick={() => setAnalysisView('CHART')}
                                className={`flex items-center px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
                                    analysisView === 'CHART' 
                                    ? 'bg-white text-emerald-600 shadow-sm' 
                                    : 'text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                <BarChart3 size={16} className="mr-2" />
                                Backtest Chart
                            </button>
                            <button
                                onClick={() => setAnalysisView('RATIOS')}
                                className={`flex items-center px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
                                    analysisView === 'RATIOS' 
                                    ? 'bg-white text-emerald-600 shadow-sm' 
                                    : 'text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                <PieChart size={16} className="mr-2" />
                                Ratios & Analysis
                            </button>
                        </div>

                        <div className="flex-1">
                            {analysisView === 'CHART' ? (
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
            </>
        )}

        {/* VIEW: PORTFOLIO LIST */}
        {currentTab === 'PORTFOLIO' && (
             <section className="animate-in fade-in slide-in-from-right-4 duration-300">
                 <div className="flex justify-between items-center mb-6">
                    <div>
                        <h3 className="text-xl font-bold text-slate-900">Your Portfolio</h3>
                        <p className="text-sm text-slate-500">Manage all your investments</p>
                    </div>
                    <button 
                        onClick={refreshNavs}
                        disabled={isProcessing}
                        className="flex items-center px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <RefreshCw size={16} className={`mr-2 ${isProcessing ? 'animate-spin' : ''}`} />
                        {isProcessing ? 'Refreshing...' : 'Refresh All NAVs'}
                    </button>
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

                 <InvestmentTable 
                    investments={filteredInvestments} 
                    onRemove={removeInvestment}
                    onEdit={setEditingInvestment}
                    onRefresh={refreshSingleNav}
                    onRedeem={setRedemptionTarget}
                    processingId={processingId}
                 />
             </section>
        )}

        {/* VIEW: FUND DETAILS */}
        {currentTab === 'FUND_DETAILS' && (
             <section className="animate-in fade-in slide-in-from-right-4 duration-300 max-w-5xl mx-auto">
                  <div className="mb-6 flex justify-between items-center">
                    <div>
                        <h3 className="text-xl font-bold text-slate-900">Fund Details</h3>
                        <p className="text-sm text-slate-500">View performance and tax breakdown for each individual fund</p>
                    </div>
                    <button 
                        onClick={refreshNavs}
                        disabled={isProcessing}
                        className="flex items-center px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <RefreshCw size={16} className={`mr-2 ${isProcessing ? 'animate-spin' : ''}`} />
                        {isProcessing ? 'Refreshing...' : 'Refresh All NAVs'}
                    </button>
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

                 <FundPerformance investments={filteredInvestments} />
             </section>
        )}

        {/* VIEW: ADD MUTUAL FUND */}
        {currentTab === 'ADD_FUND' && (
            <section className="animate-in fade-in slide-in-from-right-4 duration-300 max-w-5xl mx-auto">
                 <div className="mb-6">
                    <h3 className="text-xl font-bold text-slate-900">Add Mutual Fund</h3>
                    <p className="text-sm text-slate-500">Search via API or Bulk Import</p>
                 </div>
                 <AddInvestmentForm onAdd={handleAddInvestment} isProcessing={isProcessing} />
            </section>
        )}

        {/* VIEW: ADD CUSTOM FUND */}
        {currentTab === 'ADD_CUSTOM' && (
             <section className="animate-in fade-in slide-in-from-right-4 duration-300 max-w-3xl mx-auto">
                  <div className="mb-6">
                    <h3 className="text-xl font-bold text-slate-900">Create Custom Investment</h3>
                    <p className="text-sm text-slate-500">Manually track private funds, real estate, or unlisted assets</p>
                 </div>
                 <CustomFundForm onAdd={handleAddCustomFund} />
             </section>
        )}

        {/* VIEW: TAX HARVESTING */}
        {currentTab === 'TAX_HARVESTING' && (
             <section className="animate-in fade-in slide-in-from-right-4 duration-300 max-w-5xl mx-auto">
                  <div className="mb-6">
                    <h3 className="text-xl font-bold text-slate-900">Tax Harvesting</h3>
                    <p className="text-sm text-slate-500">Optimize your tax liability by booking LTCG and losses</p>
                 </div>
                 <TaxHarvesting investments={investments} />
             </section>
        )}

        {/* VIEW: FUND MANAGER */}
        {currentTab === 'FUND_MANAGER' && (
             <section className="animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="mb-6">
                      <h3 className="text-xl font-bold text-slate-900">Fund Manager</h3>
                      <p className="text-sm text-slate-500">Verify and fix fund codes and their counterparts for accurate comparison</p>
                  </div>
                  <FundManager 
                    investments={investments}
                    onUpdateFund={updateInvestment}
                  />
             </section>
        )}
        {currentTab === 'REDEMPTIONS' && (
             <section className="animate-in fade-in slide-in-from-right-4 duration-300 max-w-5xl mx-auto">
                  <div className="mb-6">
                    <h3 className="text-xl font-bold text-slate-900">Redemption History</h3>
                    <p className="text-sm text-slate-500">View and manage your past withdrawals</p>
                 </div>
                 <RedemptionHistory 
                    investments={investments} 
                    onRemoveRedemption={removeRedemption}
                 />
             </section>
        )}

        {redemptionTarget && (
          <RedemptionModal 
            investment={redemptionTarget}
            onClose={() => setRedemptionTarget(null)}
            onAddRedemption={addRedemption}
          />
        )}

        {editingInvestment && (
          <EditInvestmentModal
            investment={editingInvestment}
            onClose={() => setEditingInvestment(null)}
            onSave={updateInvestment}
          />
        )}

      </div>
    </Layout>
  );
};

export default App;