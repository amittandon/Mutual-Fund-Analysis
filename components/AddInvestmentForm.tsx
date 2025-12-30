import React, { useState, useEffect, useRef } from 'react';
import { InvestmentType } from '../types';
import { PlusCircle, Search, Loader2, Edit2, Check, X, ChevronRight, ListPlus, Wand2, Trash2, Calendar, DollarSign, AlertCircle, RefreshCw, Tag } from 'lucide-react';
import { searchMF, MFScheme, findCounterpartScheme, isDirectPlan, findBestMatchingScheme } from '../services/mfApiService';

interface AddInvestmentFormProps {
  onAdd: (
    investedScheme: MFScheme, 
    counterpartScheme: MFScheme | null, 
    type: InvestmentType, 
    amount: number, 
    startDate: string,
    endDate: string | undefined,
    tags: string[]
  ) => void;
  isProcessing: boolean;
}

interface BulkRow {
  id: number;
  name: string;
  type: InvestmentType;
  amount: string;
  startDate: string;
  endDate: string;
  tags: string; // Comma separated tags
  status: 'IDLE' | 'SEARCHING' | 'FOUND' | 'ERROR';
  foundName?: string;
  errorMessage?: string;
}

export const AddInvestmentForm: React.FC<AddInvestmentFormProps> = ({ onAdd, isProcessing }) => {
  const [mode, setMode] = useState<'SINGLE' | 'BULK'>('SINGLE');

  // --- SINGLE MODE STATE ---
  const [step, setStep] = useState<'SEARCH' | 'CONFIGURE'>('SEARCH');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MFScheme[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [directScheme, setDirectScheme] = useState<MFScheme | null>(null);
  const [regularScheme, setRegularScheme] = useState<MFScheme | null>(null);
  const [investedIn, setInvestedIn] = useState<'DIRECT' | 'REGULAR'>('REGULAR');
  const [editingSlot, setEditingSlot] = useState<'DIRECT' | 'REGULAR' | null>(null);
  const [type, setType] = useState<InvestmentType>(InvestmentType.SIP);
  const [amount, setAmount] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [tags, setTags] = useState<string>(''); // Comma separated string
  
  // --- BULK MODE STATE ---
  const [bulkRows, setBulkRows] = useState<BulkRow[]>([
    { id: 1, name: '', type: InvestmentType.SIP, amount: '', startDate: '', endDate: '', tags: '', status: 'IDLE' }
  ]);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [bulkInvestedType, setBulkInvestedType] = useState<'DIRECT' | 'REGULAR'>('REGULAR');
  
  // Manual Fix State
  const [fixingRowId, setFixingRowId] = useState<number | null>(null);
  const [fixQuery, setFixQuery] = useState('');
  const [fixResults, setFixResults] = useState<MFScheme[]>([]);
  const [isFixSearching, setIsFixSearching] = useState(false);

  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fixSearchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const fixDropdownRef = useRef<HTMLDivElement>(null);

  // --- SINGLE MODE LOGIC ---

  const resetForm = () => {
    setStep('SEARCH');
    setQuery('');
    setResults([]);
    setDirectScheme(null);
    setRegularScheme(null);
    setAmount('');
    setStartDate('');
    setEndDate('');
    setTags('');
    setEditingSlot(null);
  };

  useEffect(() => {
    if (query.length < 3) {
      setResults([]);
      return;
    }

    if (searchTimeout.current) clearTimeout(searchTimeout.current);

    setIsSearching(true);
    searchTimeout.current = setTimeout(async () => {
      const data = await searchMF(query);
      setResults(data.slice(0, 10));
      setIsSearching(false);
    }, 500);

    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, [query]);

  // Fix Search Effect
  useEffect(() => {
    if (fixQuery.length < 3) {
      setFixResults([]);
      return;
    }
    if (fixSearchTimeout.current) clearTimeout(fixSearchTimeout.current);

    setIsFixSearching(true);
    fixSearchTimeout.current = setTimeout(async () => {
      const data = await searchMF(fixQuery);
      setFixResults(data.slice(0, 10));
      setIsFixSearching(false);
    }, 500);

    return () => {
      if (fixSearchTimeout.current) clearTimeout(fixSearchTimeout.current);
    };
  }, [fixQuery]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setResults([]);
        if (editingSlot) {
            setEditingSlot(null);
            setQuery(''); 
        }
      }
      if (fixDropdownRef.current && !fixDropdownRef.current.contains(event.target as Node)) {
          setFixingRowId(null);
          setFixResults([]);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [editingSlot, fixingRowId]);

  const handleInitialSelect = async (scheme: MFScheme) => {
    setQuery('');
    setResults([]);
    
    const isDirect = isDirectPlan(scheme.schemeName);
    
    let dScheme: MFScheme | null = isDirect ? scheme : null;
    let rScheme: MFScheme | null = !isDirect ? scheme : null;

    setInvestedIn(isDirect ? 'DIRECT' : 'REGULAR');

    try {
      const counterpart = await findCounterpartScheme(scheme.schemeCode, scheme.schemeName);
      if (counterpart) {
        if (isDirect) rScheme = counterpart;
        else dScheme = counterpart;
      }
    } catch (e) {
      console.error("Auto-match failed", e);
    }

    setDirectScheme(dScheme);
    setRegularScheme(rScheme);
    setStep('CONFIGURE');
  };

  const handleSlotSelect = (scheme: MFScheme) => {
    if (editingSlot === 'DIRECT') setDirectScheme(scheme);
    if (editingSlot === 'REGULAR') setRegularScheme(scheme);
    
    setEditingSlot(null);
    setQuery('');
    setResults([]);
  };

  const startEditingSlot = (slot: 'DIRECT' | 'REGULAR') => {
    setEditingSlot(slot);
    setQuery(''); 
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const investedScheme = investedIn === 'DIRECT' ? directScheme : regularScheme;
    const counterpartScheme = investedIn === 'DIRECT' ? regularScheme : directScheme;
    
    if (!investedScheme || !amount || !startDate) return;
    
    if (endDate && startDate > endDate) {
        alert("End date must be after start date");
        return;
    }

    const tagList = tags.split(',').map(t => t.trim()).filter(t => t.length > 0);

    onAdd(investedScheme, counterpartScheme, type, parseFloat(amount), startDate, endDate || undefined, tagList);
    resetForm();
  };

  // --- BULK MODE LOGIC ---

  const addBulkRow = () => {
    setBulkRows(prev => [
      ...prev,
      { id: Date.now(), name: '', type: InvestmentType.SIP, amount: '', startDate: '', endDate: '', tags: '', status: 'IDLE' }
    ]);
  };

  const updateBulkRow = (id: number, field: keyof BulkRow, value: string) => {
    setBulkRows(prev => prev.map(row => row.id === id ? { ...row, [field]: value } : row));
  };

  const removeBulkRow = (id: number) => {
    if (bulkRows.length > 1) {
        setBulkRows(prev => prev.filter(row => row.id !== id));
    }
  };

  const startFixingRow = (row: BulkRow) => {
      setFixingRowId(row.id);
      setFixQuery(row.name); // Pre-fill with existing name
      // Trigger search immediately if name is long enough
      if (row.name.length >= 3) {
          setIsFixSearching(true);
          searchMF(row.name).then(res => {
              setFixResults(res.slice(0, 10));
              setIsFixSearching(false);
          });
      }
  };

  const handleFixSelect = async (rowId: number, selectedScheme: MFScheme) => {
      setFixingRowId(null);
      setFixQuery('');
      setFixResults([]);
      
      // Update the row with the selected name so user sees it
      updateBulkRow(rowId, 'name', selectedScheme.schemeName);
      
      // Now process this specific scheme as if it was auto-detected
      // We wrap it in an array to reuse logic or just handle it directly here
      await processSingleBulkRow(rowId, selectedScheme);
  };

  const processSingleBulkRow = async (rowId: number, specificScheme?: MFScheme) => {
      // Find row
      const row = bulkRows.find(r => r.id === rowId);
      if (!row) return;

      setBulkRows(prev => prev.map(r => r.id === rowId ? { ...r, status: 'SEARCHING' } : r));
      
      try {
          let directScheme: MFScheme | null = null;
          let regularScheme: MFScheme | null = null;

          if (specificScheme) {
              // Manual Mode: We have the specific scheme user picked.
              const isPickedDirect = isDirectPlan(specificScheme.schemeName);
              const counterpart = await findCounterpartScheme(specificScheme.schemeCode, specificScheme.schemeName);
              
              directScheme = isPickedDirect ? specificScheme : counterpart;
              regularScheme = isPickedDirect ? counterpart : specificScheme;
          } else {
              // Auto Mode
              const bestMatch = await findBestMatchingScheme(row.name);
              if (!bestMatch) {
                  throw new Error("Fund not found");
              }
              const isMatchDirect = isDirectPlan(bestMatch.schemeName);
              const counterpart = await findCounterpartScheme(bestMatch.schemeCode, bestMatch.schemeName);

              if (!counterpart) {
                   throw new Error(isMatchDirect ? "Counterpart Regular plan not found" : "Counterpart Direct plan not found");
              }

              directScheme = isMatchDirect ? bestMatch : counterpart;
              regularScheme = isMatchDirect ? counterpart : bestMatch;
          }

          if (directScheme && regularScheme) {
            // Determine which one is the "Invested" scheme based on the global bulk setting
            const investedScheme = bulkInvestedType === 'DIRECT' ? directScheme : regularScheme;
            const counterpartScheme = bulkInvestedType === 'DIRECT' ? regularScheme : directScheme;
            
            const rowTags = row.tags ? row.tags.split(',').map(t => t.trim()).filter(t => t) : [];

            onAdd(
                investedScheme, 
                counterpartScheme, 
                row.type, 
                parseFloat(row.amount), 
                row.startDate, 
                row.endDate || undefined,
                rowTags
            );
            setBulkRows(prev => prev.map(r => r.id === rowId ? { ...r, status: 'FOUND', foundName: investedScheme.schemeName, errorMessage: undefined } : r));
          } else {
             throw new Error("Pairing failed");
          }

      } catch (e: any) {
          console.error(e);
          setBulkRows(prev => prev.map(r => r.id === rowId ? { ...r, status: 'ERROR', errorMessage: e.message || 'Fund not found or pair missing' } : r));
      }
  };

  const processBulkRows = async () => {
    setBulkProcessing(true);
    
    // Filter rows that are IDLE or ERROR (allow retrying errors)
    const rowsToProcess = bulkRows.filter(r => (r.status === 'IDLE' || r.status === 'ERROR') && r.name && r.amount && r.startDate);

    for (const row of rowsToProcess) {
        await processSingleBulkRow(row.id);
        await new Promise(r => setTimeout(r, 200)); // Rate limit
    }

    setBulkProcessing(false);

    // Auto-clear successfull rows after a short delay
    setTimeout(() => {
        setBulkRows(prev => {
             const pending = prev.filter(r => r.status !== 'FOUND');
             // If all are done (or empty), reset to a fresh blank row
             if (pending.length === 0) {
                 return [{ id: Date.now(), name: '', type: InvestmentType.SIP, amount: '', startDate: '', endDate: '', tags: '', status: 'IDLE' }];
             }
             return pending;
        });
    }, 1500);
  };

  // --- RENDER HELPERS ---

  const renderSchemeCard = (label: string, scheme: MFScheme | null, slot: 'DIRECT' | 'REGULAR') => {
    const isSelected = investedIn === slot;
    const isEditing = editingSlot === slot;

    if (isEditing) {
       return (
         <div className="relative p-1" ref={dropdownRef}>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Search {label}</label>
            <div className="relative">
                <input
                    autoFocus
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={`Search ${label}...`}
                    className="w-full rounded-md border-emerald-500 border-2 px-3 py-2 text-sm outline-none shadow-sm"
                />
                 <button 
                    type="button"
                    onClick={() => setEditingSlot(null)}
                    className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
                >
                    <X size={16} />
                </button>
            </div>
            {results.length > 0 && (
                <div className="absolute top-full left-0 right-0 bg-white border border-slate-200 rounded-lg shadow-xl mt-1 max-h-48 overflow-y-auto z-50">
                    {results.map((s) => (
                        <div
                            key={s.schemeCode}
                            onClick={() => handleSlotSelect(s)}
                            className="px-3 py-2 hover:bg-emerald-50 cursor-pointer text-xs text-slate-700 border-b border-slate-50"
                        >
                            {s.schemeName}
                        </div>
                    ))}
                </div>
            )}
         </div>
       )
    }

    return (
      <div 
        className={`p-4 rounded-xl border-2 transition-all relative group cursor-pointer ${
          isSelected 
          ? 'border-emerald-500 bg-emerald-50/30' 
          : 'border-slate-200 bg-white hover:border-emerald-200'
        }`}
        onClick={() => setInvestedIn(slot)}
      >
        <div className="flex justify-between items-start gap-2">
            <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${isSelected ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>
                        {label}
                    </span>
                    {isSelected && <span className="text-[10px] text-emerald-600 font-medium flex items-center"><Check size={10} className="mr-0.5"/> Selected</span>}
                </div>
                {scheme ? (
                    <p className={`text-sm font-semibold leading-tight line-clamp-2 ${isSelected ? 'text-slate-900' : 'text-slate-600'}`}>
                        {scheme.schemeName}
                    </p>
                ) : (
                    <p className="text-sm italic text-amber-600/80">Select plan manually</p>
                )}
            </div>
        </div>
        
        <button 
            type="button"
            onClick={(e) => {
                e.stopPropagation();
                startEditingSlot(slot);
            }}
            className="absolute top-2 right-2 p-1.5 text-slate-300 hover:text-blue-600 hover:bg-blue-50 rounded-full opacity-0 group-hover:opacity-100 transition-all"
            title="Change Fund"
        >
            <Edit2 size={12} />
        </button>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 relative z-20 h-full">
      
      {/* HEADER WITH TABS */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 border-b border-slate-100 pb-4 gap-4">
        <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg transition-colors ${mode === 'SINGLE' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                {mode === 'SINGLE' ? <PlusCircle size={20} /> : <ListPlus size={20} />}
            </div>
            <div>
                <h2 className="text-lg font-bold text-slate-900 leading-none">
                    {mode === 'SINGLE' ? 'Add Investment' : 'Bulk Import'}
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                    {mode === 'SINGLE' ? 'Detailed configuration' : 'Auto-match raw data'}
                </p>
            </div>
        </div>

        <div className="flex p-1 bg-slate-100 rounded-lg">
            <button
                onClick={() => setMode('SINGLE')}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${mode === 'SINGLE' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
                Search Fund
            </button>
            <button
                onClick={() => setMode('BULK')}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${mode === 'BULK' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
                Raw Input
            </button>
        </div>
      </div>

      {mode === 'SINGLE' ? (
        // --- SINGLE MODE UI ---
        step === 'SEARCH' ? (
            <div className="relative pb-8" ref={dropdownRef}>
              <div className="relative group">
                 <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    {isSearching ? <Loader2 className="h-5 w-5 text-emerald-500 animate-spin" /> : <Search className="h-5 w-5 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />}
                 </div>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="E.g. HDFC Midcap Opportunities..."
                  className="pl-11 w-full rounded-xl border-slate-200 border-2 px-4 py-3.5 text-sm focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all shadow-sm"
                  autoFocus
                />
              </div>
              
              {results.length > 0 && (
                <div className="absolute top-full left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-2xl mt-2 max-h-72 overflow-y-auto z-50 divide-y divide-slate-50">
                  {results.map((scheme) => (
                    <div
                      key={scheme.schemeCode}
                      onClick={() => handleInitialSelect(scheme)}
                      className="px-4 py-3 hover:bg-emerald-50 cursor-pointer group flex items-center justify-between"
                    >
                      <div>
                        <p className="text-sm font-medium text-slate-700 group-hover:text-emerald-900">{scheme.schemeName}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">Code: {scheme.schemeCode}</p>
                      </div>
                      <ChevronRight size={16} className="text-slate-300 group-hover:text-emerald-500" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
               
               <div className="space-y-3">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Select Plan to Invest In</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 relative">
                      {renderSchemeCard('DIRECT', directScheme, 'DIRECT')}
                      {renderSchemeCard('REGULAR', regularScheme, 'REGULAR')}
                  </div>
               </div>
    
               <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Investment Type</label>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    onClick={() => setType(InvestmentType.SIP)}
                                    className={`py-2 text-sm font-medium rounded-lg border transition-all ${type === InvestmentType.SIP ? 'bg-white border-emerald-500 text-emerald-700 shadow-sm' : 'border-transparent text-slate-500 hover:bg-white hover:shadow-sm'}`}
                                >
                                    SIP
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setType(InvestmentType.LUMPSUM)}
                                    className={`py-2 text-sm font-medium rounded-lg border transition-all ${type === InvestmentType.LUMPSUM ? 'bg-white border-emerald-500 text-emerald-700 shadow-sm' : 'border-transparent text-slate-500 hover:bg-white hover:shadow-sm'}`}
                                >
                                    Lumpsum
                                </button>
                            </div>
                        </div>
    
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Amount (₹)</label>
                            <input
                                type="number"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder="5000"
                                min="100"
                                className="w-full rounded-lg border-slate-200 border px-3 py-2.5 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none bg-white"
                                required
                            />
                        </div>
                    </div>
    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Start Date</label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                max={new Date().toISOString().split('T')[0]}
                                className="w-full rounded-lg border-slate-200 border px-3 py-2.5 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none bg-white"
                                required
                            />
                        </div>
                        
                        {type === InvestmentType.SIP && (
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">End Date (Optional)</label>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    min={startDate}
                                    max={new Date().toISOString().split('T')[0]}
                                    className="w-full rounded-lg border-slate-200 border px-3 py-2.5 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none bg-white placeholder-slate-400 text-slate-700"
                                />
                            </div>
                        )}
                    </div>
               </div>

               {/* Tags Input */}
               <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Tags (Optional)</label>
                  <div className="relative">
                      <Tag size={16} className="absolute left-3 top-3 text-slate-400" />
                      <input
                          type="text"
                          value={tags}
                          onChange={(e) => setTags(e.target.value)}
                          placeholder="e.g. Tax Saving, ELSS, Goal-Car (Comma separated)"
                          className="w-full rounded-xl border-slate-200 border pl-9 pr-4 py-2.5 text-sm focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all shadow-sm"
                      />
                  </div>
               </div>
    
               <div className="flex gap-3 pt-2">
                   <button
                     type="button"
                     onClick={resetForm}
                     className="flex-1 py-3 bg-white border border-slate-200 text-slate-600 font-medium rounded-xl hover:bg-slate-50 transition-colors text-sm"
                   >
                     Cancel
                   </button>
                   <button
                    type="submit"
                    disabled={isProcessing || !directScheme || !regularScheme}
                    className="flex-[2] bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-emerald-200 transition-all flex justify-center items-center disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none text-sm"
                    >
                    {isProcessing ? (
                        <>
                        <Loader2 className="animate-spin mr-2 h-4 w-4" />
                        Crunching Data...
                        </>
                    ) : (
                        'Add to Portfolio'
                    )}
                    </button>
               </div>
            </form>
          )
      ) : (
        // --- BULK MODE UI ---
        <div className="space-y-4">
            <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 text-sm text-blue-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start">
                    <div className="bg-blue-100 p-2 rounded-lg mr-3 mt-0.5">
                         <Wand2 size={18} className="text-blue-600" />
                    </div>
                    <div>
                        <p className="font-semibold mb-1">Smart Bulk Import</p>
                        <p className="opacity-90 text-xs">
                            Paste raw fund names. We auto-match the counterpart for comparison.
                        </p>
                    </div>
                </div>
                
                <div className="flex items-center bg-white p-1 rounded-lg border border-blue-100 shadow-sm">
                    <span className="text-[10px] font-bold text-slate-400 uppercase px-2 mr-1">I Invested In:</span>
                    <button
                        onClick={() => setBulkInvestedType('REGULAR')}
                        className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${bulkInvestedType === 'REGULAR' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                        Regular Plans
                    </button>
                    <button
                        onClick={() => setBulkInvestedType('DIRECT')}
                        className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${bulkInvestedType === 'DIRECT' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                        Direct Plans
                    </button>
                </div>
            </div>

            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1 -mr-2 pl-1 py-1 custom-scrollbar" ref={fixDropdownRef}>
                {bulkRows.map((row) => (
                    <div 
                        key={row.id} 
                        className={`
                            relative p-4 rounded-xl border-2 transition-all group animate-in fade-in slide-in-from-bottom-2 duration-300
                            ${row.status === 'ERROR' ? 'border-red-200 bg-red-50/30' : 
                              row.status === 'FOUND' ? 'border-emerald-200 bg-emerald-50/30' : 
                              row.status === 'SEARCHING' ? 'border-blue-200 bg-blue-50/10' :
                              'border-slate-200 bg-white hover:border-blue-300 hover:shadow-md'}
                        `}
                    >
                        {/* Remove Button */}
                        <button 
                            onClick={() => removeBulkRow(row.id)}
                            disabled={bulkRows.length <= 1 || bulkProcessing}
                            className="absolute top-3 right-3 text-slate-300 hover:text-red-500 p-1 rounded-md transition-colors disabled:opacity-0"
                            title="Remove row"
                        >
                            <Trash2 size={16} />
                        </button>

                        {/* Status Icon Indicator (Absolute Left) */}
                         <div className="absolute top-4 left-0 w-1 h-8 rounded-r-full bg-slate-200 transition-colors duration-500"
                              style={{backgroundColor: row.status === 'FOUND' ? '#10b981' : row.status === 'ERROR' ? '#ef4444' : row.status === 'SEARCHING' ? '#3b82f6' : '#e2e8f0'}}
                         />

                        <div className="pl-3">
                            {/* Row 1: Name Input or Fix Search */}
                            <div className="mb-4 pr-6 relative">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Fund Name</label>
                                
                                {fixingRowId === row.id ? (
                                    // SEARCH FIX MODE
                                    <div className="relative z-50">
                                        <div className="flex items-center border-b-2 border-blue-500 pb-1">
                                            <Search size={16} className="text-blue-500 mr-2 animate-pulse" />
                                            <input
                                                autoFocus
                                                type="text"
                                                value={fixQuery}
                                                onChange={(e) => setFixQuery(e.target.value)}
                                                placeholder="Search for correct fund..."
                                                className="w-full text-base font-medium bg-transparent outline-none text-slate-900 placeholder:text-slate-400"
                                            />
                                            {isFixSearching && <Loader2 size={16} className="animate-spin text-blue-500" />}
                                            <button 
                                                onClick={() => setFixingRowId(null)} 
                                                className="ml-2 text-slate-400 hover:text-slate-600"
                                            >
                                                <X size={16} />
                                            </button>
                                        </div>
                                        {fixResults.length > 0 && (
                                            <div className="absolute top-full left-0 w-full bg-white border border-slate-200 rounded-b-lg rounded-r-lg shadow-xl max-h-48 overflow-y-auto mt-1 z-50">
                                                {fixResults.map(res => (
                                                    <div 
                                                        key={res.schemeCode}
                                                        className="px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm text-slate-700 border-b border-slate-50 last:border-0"
                                                        onClick={() => handleFixSelect(row.id, res)}
                                                    >
                                                        {res.schemeName}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        {fixQuery.length > 2 && !isFixSearching && fixResults.length === 0 && (
                                            <div className="absolute top-full left-0 w-full bg-white border border-slate-200 rounded-lg shadow-xl p-3 text-xs text-slate-400 mt-1 z-50">
                                                No funds found.
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    // NORMAL INPUT MODE
                                    <div className="flex items-center">
                                        <input 
                                            type="text" 
                                            placeholder="e.g. Mirae Asset Large Cap Fund" 
                                            value={row.name}
                                            onChange={(e) => updateBulkRow(row.id, 'name', e.target.value)}
                                            className="w-full text-base font-medium border-b border-slate-200 focus:border-blue-500 focus:ring-0 outline-none bg-transparent py-1 placeholder:text-slate-300 text-slate-700 disabled:opacity-75 disabled:cursor-not-allowed"
                                            disabled={row.status === 'FOUND' || bulkProcessing}
                                        />
                                        {row.status === 'ERROR' && (
                                            <button
                                                onClick={() => startFixingRow(row)}
                                                className="ml-2 flex items-center text-xs font-bold text-red-500 bg-red-50 hover:bg-red-100 px-2 py-1 rounded-md transition-colors"
                                            >
                                                <RefreshCw size={12} className="mr-1" />
                                                Fix Match
                                            </button>
                                        )}
                                    </div>
                                )}
                                
                                {row.status === 'FOUND' && (
                                    <p className="text-xs text-emerald-600 flex items-center mt-1 font-medium">
                                        <Check size={12} className="mr-1" /> Mapped: {row.foundName}
                                    </p>
                                )}
                                {row.status === 'ERROR' && !fixingRowId && (
                                    <p className="text-xs text-red-500 mt-1 font-medium flex items-center">
                                        <AlertCircle size={12} className="mr-1" /> 
                                        {row.errorMessage || "Match failed. Try fixing manually."}
                                    </p>
                                )}
                            </div>

                            {/* Row 2: Grid Inputs */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                 <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Type</label>
                                    <select 
                                        value={row.type}
                                        onChange={(e) => updateBulkRow(row.id, 'type', e.target.value as any)}
                                        className="w-full text-sm border border-slate-200 rounded-lg px-2 py-2 outline-none bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all disabled:bg-slate-50"
                                        disabled={row.status === 'FOUND' || bulkProcessing}
                                    >
                                        <option value="SIP">SIP (Monthly)</option>
                                        <option value="LUMPSUM">Lumpsum</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Amount</label>
                                    <div className="relative">
                                        <span className="absolute left-2.5 top-2 text-slate-400 text-xs">₹</span>
                                        <input 
                                            type="number" 
                                            placeholder="5000" 
                                            value={row.amount}
                                            onChange={(e) => updateBulkRow(row.id, 'amount', e.target.value)}
                                            className="w-full text-sm border border-slate-200 rounded-lg pl-6 pr-2 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all disabled:bg-slate-50"
                                            disabled={row.status === 'FOUND' || bulkProcessing}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Start Date</label>
                                    <input 
                                        type="date" 
                                        value={row.startDate}
                                        onChange={(e) => updateBulkRow(row.id, 'startDate', e.target.value)}
                                        className="w-full text-sm border border-slate-200 rounded-lg px-2 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all text-slate-600 disabled:bg-slate-50"
                                        disabled={row.status === 'FOUND' || bulkProcessing}
                                    />
                                </div>

                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">End Date (Opt)</label>
                                    <input 
                                        type="date" 
                                        value={row.endDate}
                                        onChange={(e) => updateBulkRow(row.id, 'endDate', e.target.value)}
                                        className={`w-full text-sm border border-slate-200 rounded-lg px-2 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all text-slate-600 ${row.type === 'LUMPSUM' ? 'bg-slate-50 opacity-50 cursor-not-allowed' : 'disabled:bg-slate-50'}`}
                                        disabled={row.status === 'FOUND' || bulkProcessing || row.type === 'LUMPSUM'}
                                    />
                                </div>
                            </div>

                             {/* Row 3: Tags Input */}
                             <div className="mt-3">
                                 <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Tags (Optional)</label>
                                 <div className="relative">
                                    <Tag size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
                                    <input
                                        type="text"
                                        value={row.tags}
                                        onChange={(e) => updateBulkRow(row.id, 'tags', e.target.value)}
                                        placeholder="e.g. ELSS, Goal-Car (Comma separated)"
                                        className="w-full text-sm border border-slate-200 rounded-lg pl-8 pr-2 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all disabled:bg-slate-50"
                                        disabled={row.status === 'FOUND' || bulkProcessing}
                                    />
                                 </div>
                            </div>

                        </div>
                    </div>
                ))}
            </div>
            
            <div className="pt-2 flex flex-col md:flex-row gap-3">
                 <button 
                    onClick={addBulkRow}
                    disabled={bulkProcessing}
                    className="flex items-center justify-center px-6 py-3 border-2 border-dashed border-slate-300 text-slate-500 rounded-xl hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-all text-sm font-medium"
                 >
                    <PlusCircle size={18} className="mr-2" /> Add Another Fund
                 </button>
                 <button 
                    onClick={processBulkRows}
                    disabled={bulkProcessing || bulkRows.every(r => !r.name || !r.startDate)}
                    className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-200 transition-all flex justify-center items-center disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none text-sm"
                 >
                    {bulkProcessing ? (
                        <>
                        <Loader2 className="animate-spin mr-2 h-4 w-4" />
                        Processing...
                        </>
                    ) : (
                        'Process & Import All'
                    )}
                </button>
            </div>
        </div>
      )}
    </div>
  );
};