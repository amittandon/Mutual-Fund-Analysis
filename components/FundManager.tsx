import React, { useState, useEffect, useRef } from 'react';
import { Search, Loader2, Save, RefreshCw, AlertCircle, Info, ArrowRightLeft, CheckCircle2, XCircle } from 'lucide-react';
import { Investment, NAVData } from '../types';
import { searchMF, MFScheme, getMFData, findCounterpartScheme } from '../services/mfApiService';
import { getLatestValidNav, formatCurrency } from '../utils/financials';

interface FundManagerProps {
  investments: Investment[];
  onUpdateFund: (id: string, updates: Partial<Investment>) => Promise<void>;
}

export const FundManager: React.FC<FundManagerProps> = ({ investments, onUpdateFund }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  
  // Local state for editing
  const [editData, setEditData] = useState<{
    schemeCode: string;
    name: string;
    counterpartSchemeCode: string;
    counterpartName: string;
  } | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MFScheme[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchTarget, setSearchTarget] = useState<'PRIMARY' | 'COUNTERPART' | null>(null);
  
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (searchQuery.length < 3) {
      setSearchResults([]);
      return;
    }

    if (searchTimeout.current) clearTimeout(searchTimeout.current);

    setIsSearching(true);
    searchTimeout.current = setTimeout(async () => {
      try {
        const results = await searchMF(searchQuery);
        setSearchResults(results.slice(0, 10));
      } catch (err) {
        console.error("Search failed", err);
      } finally {
        setIsSearching(false);
      }
    }, 500);

    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, [searchQuery]);

  const handleStartEdit = (inv: Investment) => {
    setEditingId(inv.id);
    setEditData({
      schemeCode: inv.schemeCode,
      name: inv.name,
      counterpartSchemeCode: inv.counterpartSchemeCode || '',
      counterpartName: inv.counterpartName || ''
    });
    setSearchQuery('');
    setSearchResults([]);
    setSearchTarget(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditData(null);
    setSearchQuery('');
    setSearchResults([]);
    setSearchTarget(null);
  };

  const handleCodeChange = async (target: 'PRIMARY' | 'COUNTERPART', code: string) => {
    if (!editData) return;
    
    const newEditData = { ...editData };
    if (target === 'PRIMARY') {
      newEditData.schemeCode = code;
    } else {
      newEditData.counterpartSchemeCode = code;
    }
    setEditData(newEditData);

    // If code is 6 digits, try to fetch name
    if (code.length === 6) {
      try {
        const data = await getMFData(code);
        if (data && data.meta) {
          if (target === 'PRIMARY') {
            setEditData(prev => prev ? { ...prev, name: data.meta.scheme_name } : null);
            // Auto-fetch counterpart if primary changed
            const cp = await findCounterpartScheme(code, data.meta.scheme_name);
            if (cp) {
              setEditData(prev => prev ? { 
                ...prev, 
                counterpartSchemeCode: cp.schemeCode,
                counterpartName: cp.schemeName
              } : null);
            }
          } else {
            setEditData(prev => prev ? { ...prev, counterpartName: data.meta.scheme_name } : null);
          }
        }
      } catch (err) {
        console.error("Failed to fetch fund name by code", err);
      }
    }
  };

  const handleSelectSearchResult = async (scheme: MFScheme) => {
    if (!editData || !searchTarget) return;

    if (searchTarget === 'PRIMARY') {
      const cp = await findCounterpartScheme(scheme.schemeCode, scheme.schemeName);
      setEditData({
        ...editData,
        schemeCode: scheme.schemeCode,
        name: scheme.schemeName,
        counterpartSchemeCode: cp?.schemeCode || editData.counterpartSchemeCode,
        counterpartName: cp?.schemeName || editData.counterpartName
      });
    } else {
      setEditData({
        ...editData,
        counterpartSchemeCode: scheme.schemeCode,
        counterpartName: scheme.schemeName
      });
    }
    
    setSearchQuery('');
    setSearchResults([]);
    setSearchTarget(null);
  };

  const handleSave = async () => {
    if (!editingId || !editData) return;
    
    setIsProcessing(editingId);
    try {
      await onUpdateFund(editingId, {
        schemeCode: editData.schemeCode,
        name: editData.name,
        counterpartSchemeCode: editData.counterpartSchemeCode || undefined,
        counterpartName: editData.counterpartName || undefined
      });
      setEditingId(null);
      setEditData(null);
    } catch (err) {
      console.error("Failed to save fund updates", err);
    } finally {
      setIsProcessing(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Scheme Manager</h3>
            <p className="text-xs text-slate-500">Verify and fix fund codes and their counterparts</p>
          </div>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500 bg-white px-3 py-1.5 rounded-full border border-slate-200">
            <Info size={14} className="text-blue-500" />
            Changing a scheme code will re-fetch its entire history
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 text-[11px] uppercase tracking-wider font-bold text-slate-500 border-b border-slate-100">
                <th className="px-6 py-4">Investment</th>
                <th className="px-6 py-4">Primary Scheme (Selected)</th>
                <th className="px-6 py-4">Counterpart Scheme (Comparison)</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {investments.map((inv) => {
                const isEditing = editingId === inv.id;
                const primaryNav = getLatestValidNav(inv.navHistory);
                const cpNav = inv.counterpartNavHistory ? getLatestValidNav(inv.counterpartNavHistory) : 0;

                return (
                  <tr key={inv.id} className={`group transition-colors ${isEditing ? 'bg-blue-50/30' : 'hover:bg-slate-50/50'}`}>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-900">{inv.name}</span>
                        <span className="text-[10px] text-slate-400 font-medium uppercase mt-0.5">{inv.type} • {inv.source}</span>
                      </div>
                    </td>
                    
                    <td className="px-6 py-4">
                      {isEditing ? (
                        <div className="space-y-2 max-w-xs">
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={editData?.schemeCode}
                              onChange={(e) => handleCodeChange('PRIMARY', e.target.value)}
                              placeholder="Code"
                              className="w-20 px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                            />
                            <div className="relative flex-1">
                              <input
                                type="text"
                                value={searchTarget === 'PRIMARY' ? searchQuery : editData?.name}
                                onChange={(e) => {
                                  if (searchTarget !== 'PRIMARY') setSearchTarget('PRIMARY');
                                  setSearchQuery(e.target.value);
                                  setEditData(prev => prev ? { ...prev, name: e.target.value } : null);
                                }}
                                onFocus={() => setSearchTarget('PRIMARY')}
                                placeholder="Search or enter name"
                                className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                              />
                              {isSearching && searchTarget === 'PRIMARY' && (
                                <Loader2 size={12} className="absolute right-2 top-2 animate-spin text-blue-500" />
                              )}
                              {searchResults.length > 0 && searchTarget === 'PRIMARY' && (
                                <div className="absolute top-full left-0 right-0 bg-white border border-slate-200 rounded-lg shadow-xl mt-1 z-50 max-h-40 overflow-y-auto divide-y divide-slate-50">
                                  {searchResults.map(s => (
                                    <div 
                                      key={s.schemeCode}
                                      onClick={() => handleSelectSearchResult(s)}
                                      className="px-3 py-2 hover:bg-blue-50 cursor-pointer text-[10px]"
                                    >
                                      <p className="font-bold text-slate-700">{s.schemeName}</p>
                                      <p className="text-slate-400">Code: {s.schemeCode}</p>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">{inv.schemeCode}</span>
                            <span className="text-xs font-medium text-slate-700 truncate max-w-[200px]">{inv.name}</span>
                          </div>
                          <div className="mt-1 flex items-center gap-1.5">
                            <span className="text-[10px] text-slate-400">Current NAV:</span>
                            <span className="text-[10px] font-bold text-emerald-600">{formatCurrency(primaryNav)}</span>
                          </div>
                        </div>
                      )}
                    </td>

                    <td className="px-6 py-4">
                      {isEditing ? (
                        <div className="space-y-2 max-w-xs">
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={editData?.counterpartSchemeCode}
                              onChange={(e) => handleCodeChange('COUNTERPART', e.target.value)}
                              placeholder="Code"
                              className="w-20 px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                            />
                            <div className="relative flex-1">
                              <input
                                type="text"
                                value={searchTarget === 'COUNTERPART' ? searchQuery : editData?.counterpartName}
                                onChange={(e) => {
                                  if (searchTarget !== 'COUNTERPART') setSearchTarget('COUNTERPART');
                                  setSearchQuery(e.target.value);
                                  setEditData(prev => prev ? { ...prev, counterpartName: e.target.value } : null);
                                }}
                                onFocus={() => setSearchTarget('COUNTERPART')}
                                placeholder="Search or enter name"
                                className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                              />
                              {isSearching && searchTarget === 'COUNTERPART' && (
                                <Loader2 size={12} className="absolute right-2 top-2 animate-spin text-blue-500" />
                              )}
                              {searchResults.length > 0 && searchTarget === 'COUNTERPART' && (
                                <div className="absolute top-full left-0 right-0 bg-white border border-slate-200 rounded-lg shadow-xl mt-1 z-50 max-h-40 overflow-y-auto divide-y divide-slate-50">
                                  {searchResults.map(s => (
                                    <div 
                                      key={s.schemeCode}
                                      onClick={() => handleSelectSearchResult(s)}
                                      className="px-3 py-2 hover:bg-blue-50 cursor-pointer text-[10px]"
                                    >
                                      <p className="font-bold text-slate-700">{s.schemeName}</p>
                                      <p className="text-slate-400">Code: {s.schemeCode}</p>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col">
                          {inv.counterpartSchemeCode ? (
                            <>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">{inv.counterpartSchemeCode}</span>
                                <span className="text-xs font-medium text-slate-700 truncate max-w-[200px]">{inv.counterpartName}</span>
                              </div>
                              <div className="mt-1 flex items-center gap-1.5">
                                <span className="text-[10px] text-slate-400">Current NAV:</span>
                                <span className="text-[10px] font-bold text-blue-600">{formatCurrency(cpNav)}</span>
                              </div>
                            </>
                          ) : (
                            <span className="text-xs text-slate-400 italic">No counterpart configured</span>
                          )}
                        </div>
                      )}
                    </td>

                    <td className="px-6 py-4 text-right">
                      {isEditing ? (
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={handleCancelEdit}
                            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Cancel"
                          >
                            <XCircle size={18} />
                          </button>
                          <button
                            onClick={handleSave}
                            disabled={isProcessing === inv.id}
                            className="p-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors disabled:opacity-50"
                            title="Save Changes"
                          >
                            {isProcessing === inv.id ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleStartEdit(inv)}
                          className="px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-1.5 ml-auto"
                        >
                          <ArrowRightLeft size={14} />
                          Modify Schemes
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 flex gap-3">
        <AlertCircle size={20} className="text-amber-500 shrink-0" />
        <div className="text-xs text-amber-800 leading-relaxed">
          <p className="font-bold mb-1">Important Note on Data Integrity:</p>
          <p>
            The comparison logic relies on both schemes having overlapping historical data. 
            If you swap a scheme with one that has a shorter history than your investment start date, 
            the backtest results might be incomplete. Always verify that the "Direct" and "Regular" 
            versions belong to the same fund house and category for accurate impact analysis.
          </p>
        </div>
      </div>
    </div>
  );
};
