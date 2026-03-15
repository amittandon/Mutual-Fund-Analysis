import React, { useState, useEffect, useRef } from 'react';
import { X, Save, Search, Loader2, ChevronRight, AlertCircle, Info } from 'lucide-react';
import { Investment } from '../types';
import { searchMF, MFScheme, findCounterpartScheme, isDirectPlan } from '../services/mfApiService';

interface EditInvestmentModalProps {
  investment: Investment;
  onClose: () => void;
  onSave: (id: string, updates: { 
    name: string; 
    schemeCode?: string; 
    isDirect?: boolean; 
    counterpartSchemeCode?: string | null;
    source?: 'AMFI' | 'CUSTOM';
  }) => Promise<void>;
}

export const EditInvestmentModal: React.FC<EditInvestmentModalProps> = ({ investment, onClose, onSave }) => {
  const [name, setName] = useState(investment.name);
  const [isCustom, setIsCustom] = useState(investment.source === 'CUSTOM');
  
  // Search state for AMFI funds
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MFScheme[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedScheme, setSelectedScheme] = useState<MFScheme | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setName(investment.name);
    setIsCustom(investment.source === 'CUSTOM');
  }, [investment]);

  useEffect(() => {
    if (query.length < 3) {
      setResults([]);
      return;
    }

    if (searchTimeout.current) clearTimeout(searchTimeout.current);

    setIsSearching(true);
    searchTimeout.current = setTimeout(async () => {
      try {
        const data = await searchMF(query);
        setResults(data.slice(0, 10));
      } catch (err) {
        console.error("Search failed in modal", err);
      } finally {
        setIsSearching(false);
      }
    }, 500);

    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, [query]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setResults([]);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSchemeSelect = (scheme: MFScheme) => {
    setSelectedScheme(scheme);
    setName(scheme.schemeName);
    setQuery('');
    setResults([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsProcessing(true);
    try {
      if (selectedScheme) {
        // Full fund swap
        const isDirect = isDirectPlan(selectedScheme.schemeName);
        const counterpart = await findCounterpartScheme(selectedScheme.schemeCode, selectedScheme.schemeName);
        
        await onSave(investment.id, {
          name: selectedScheme.schemeName,
          schemeCode: selectedScheme.schemeCode,
          isDirect: isDirect,
          counterpartSchemeCode: counterpart?.schemeCode || null,
          source: 'AMFI'
        });
      } else {
        // Just name change or custom fund update
        await onSave(investment.id, { 
          name: name.trim(),
          // If it was AMFI and we just changed name, keep other data
          // If it was CUSTOM, keep it CUSTOM
        });
      }
      onClose();
    } catch (error) {
      console.error("Failed to update fund:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Modify Investment</h3>
            <p className="text-xs text-slate-500">Change fund name or swap with a different AMFI fund</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Current Info */}
          <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 flex gap-3">
            <Info size={18} className="text-blue-500 shrink-0 mt-0.5" />
            <div className="text-xs text-blue-800">
              <p className="font-bold mb-1">Current Fund:</p>
              <p className="opacity-80">{investment.name}</p>
              <p className="mt-1 font-medium">Type: {investment.type} | Source: {investment.source}</p>
            </div>
          </div>

          {/* Search New Fund */}
          {!isCustom && (
            <div className="space-y-2 relative" ref={dropdownRef}>
              <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Search size={16} className="text-slate-400" />
                Swap with AMFI Fund (Optional)
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search to replace this fund..."
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all pr-10"
                />
                {isSearching && (
                  <div className="absolute right-3 top-3">
                    <Loader2 size={18} className="text-blue-500 animate-spin" />
                  </div>
                )}
              </div>
              
              {results.length > 0 && (
                <div className="absolute top-full left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-2xl mt-2 max-h-60 overflow-y-auto z-50 divide-y divide-slate-50">
                  {results.map((scheme) => (
                    <div
                      key={scheme.schemeCode}
                      onClick={() => handleSchemeSelect(scheme)}
                      className="px-4 py-3 hover:bg-blue-50 cursor-pointer group flex items-center justify-between"
                    >
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-700 group-hover:text-blue-900">{scheme.schemeName}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">Code: {scheme.schemeCode}</p>
                      </div>
                      <ChevronRight size={16} className="text-slate-300 group-hover:text-blue-500" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Display Name Input */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">
              Display Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none transition-all"
              placeholder="Enter fund name"
              required
            />
            {selectedScheme && (
              <div className="flex items-center gap-2 text-xs text-emerald-600 font-medium bg-emerald-50 p-2 rounded-lg border border-emerald-100">
                <AlertCircle size={14} />
                New fund selected. Data will be re-fetched from AMFI.
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isProcessing}
              className="flex-1 py-3 px-4 rounded-xl bg-slate-900 text-white font-semibold hover:bg-slate-800 transition-all flex items-center justify-center gap-2 shadow-lg shadow-slate-200 disabled:opacity-50"
            >
              {isProcessing ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              {isProcessing ? 'Updating...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
