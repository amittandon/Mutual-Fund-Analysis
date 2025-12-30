import React, { useState, useEffect, useRef } from 'react';
import { Search, X, TrendingUp, Loader2 } from 'lucide-react';
import { searchMF, MFScheme } from '../services/mfApiService';

interface BenchmarkSelectorProps {
  onSelect: (scheme: MFScheme | null) => void;
  selectedScheme: MFScheme | null;
}

export const BenchmarkSelector: React.FC<BenchmarkSelectorProps> = ({ onSelect, selectedScheme }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MFScheme[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.length < 3) {
      setResults([]);
      return;
    }

    if (searchTimeout.current) clearTimeout(searchTimeout.current);

    setIsSearching(true);
    searchTimeout.current = setTimeout(async () => {
      const data = await searchMF(query);
      // We want to allow ETFs (which track indices) and Index Funds.
      // Usually "Nifty" or "Sensex" searches return ETFs like "Nippon India ETF Nifty 50 BeES".
      // We no longer strictly filter for "growth" only, as ETFs might be named differently, 
      // but we still limit results.
      setResults(data.slice(0, 15));
      setIsSearching(false);
    }, 500);

    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, [query]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (scheme: MFScheme) => {
    onSelect(scheme);
    setIsOpen(false);
    setQuery('');
  };

  const clearSelection = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(null);
  };

  return (
    <div className="relative" ref={dropdownRef}>
        {!isOpen && !selectedScheme ? (
            <button 
                onClick={() => setIsOpen(true)}
                className="flex items-center text-sm text-violet-600 hover:text-violet-700 hover:bg-violet-50 px-3 py-1.5 rounded-lg transition-colors border border-dashed border-violet-200"
            >
                <TrendingUp size={14} className="mr-2" />
                Add Benchmark (Index / ETF)
            </button>
        ) : !isOpen && selectedScheme ? (
             <div 
                className="flex items-center text-sm bg-violet-50 text-violet-700 px-3 py-1.5 rounded-lg border border-violet-100 cursor-pointer group"
                onClick={() => setIsOpen(true)}
             >
                <span className="font-medium truncate max-w-[200px] mr-2" title={selectedScheme.schemeName}>
                    Vs {selectedScheme.schemeName}
                </span>
                <button onClick={clearSelection} className="text-violet-400 hover:text-violet-700 p-0.5 rounded-full hover:bg-violet-200">
                    <X size={12} />
                </button>
            </div>
        ) : (
            <div className="absolute top-0 right-0 z-50 w-full md:w-80">
                <div className="bg-white rounded-xl shadow-xl border border-slate-200 p-2">
                    <div className="relative">
                        <input
                            autoFocus
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search ETF (e.g. Nifty BeES)..."
                            className="w-full pl-8 pr-8 py-2 text-sm border-b border-slate-100 outline-none"
                        />
                        <Search className="absolute left-2 top-2.5 text-slate-400" size={14} />
                        <button onClick={() => setIsOpen(false)} className="absolute right-2 top-2.5 text-slate-400 hover:text-slate-600">
                            <X size={14} />
                        </button>
                    </div>
                    
                    <div className="max-h-60 overflow-y-auto mt-2">
                         {isSearching ? (
                            <div className="flex justify-center p-4">
                                <Loader2 className="animate-spin text-violet-500" size={20} />
                            </div>
                        ) : results.length > 0 ? (
                            results.map(s => (
                                <div 
                                    key={s.schemeCode}
                                    onClick={() => handleSelect(s)}
                                    className="px-3 py-2 hover:bg-violet-50 cursor-pointer rounded-md"
                                >
                                    <p className="text-xs font-medium text-slate-700 line-clamp-2">{s.schemeName}</p>
                                    <p className="text-[10px] text-slate-400">{s.schemeCode}</p>
                                </div>
                            ))
                        ) : query.length > 2 ? (
                            <div className="p-3 text-center text-xs text-slate-400">
                                No funds found. Try "BeES" or "Index"
                            </div>
                        ) : (
                            <div className="p-3 text-center text-xs text-slate-400">
                                Search for ETFs (e.g. "Nifty BeES", "Gold BeES") or Index Funds.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};