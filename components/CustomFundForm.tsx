import React, { useState } from 'react';
import { InvestmentType, NAVData } from '../types';
import { PlusCircle, Trash2, Save, Calendar, Database, Info, Loader2 } from 'lucide-react';

interface CustomFundFormProps {
  onAdd: (
    name: string,
    type: InvestmentType,
    amount: number,
    startDate: string,
    endDate: string | undefined,
    navHistory: NAVData[],
    tags: string[]
  ) => void;
}

export const CustomFundForm: React.FC<CustomFundFormProps> = ({ onAdd }) => {
  // Basic Info State
  const [name, setName] = useState('');
  const [type, setType] = useState<InvestmentType>(InvestmentType.SIP);
  const [amount, setAmount] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [tags, setTags] = useState('');

  // NAV Data State
  // We initialize with one row
  const [navRows, setNavRows] = useState<{date: string, nav: string}[]>([
    { date: '', nav: '' }
  ]);

  const [isProcessing, setIsProcessing] = useState(false);

  const handleAddRow = () => {
    setNavRows([...navRows, { date: '', nav: '' }]);
  };

  const handleRemoveRow = (index: number) => {
    if (navRows.length > 1) {
        const newRows = [...navRows];
        newRows.splice(index, 1);
        setNavRows(newRows);
    }
  };

  const handleRowChange = (index: number, field: 'date' | 'nav', value: string) => {
    const newRows = [...navRows];
    newRows[index] = { ...newRows[index], [field]: value };
    setNavRows(newRows);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);

    // Validate inputs
    const validNavs = navRows.filter(r => r.date && r.nav).map(r => ({
        // Convert yyyy-mm-dd to dd-mm-yyyy for consistency with API format in types
        date: r.date.split('-').reverse().join('-'), 
        nav: r.nav
    }));

    if (validNavs.length === 0) {
        alert("Please add at least one NAV entry.");
        setIsProcessing(false);
        return;
    }

    // Sort NAVs descending by date (API convention used in app)
    validNavs.sort((a, b) => {
        const da = a.date.split('-').reverse().join('-');
        const db = b.date.split('-').reverse().join('-');
        return new Date(db).getTime() - new Date(da).getTime();
    });

    const tagList = tags.split(',').map(t => t.trim()).filter(t => t.length > 0);

    // Simulate a small delay for UX
    setTimeout(() => {
        onAdd(
            name,
            type,
            parseFloat(amount),
            startDate,
            endDate || undefined,
            validNavs,
            tagList
        );
        setIsProcessing(false);
        // Reset form
        setName('');
        setAmount('');
        setNavRows([{ date: '', nav: '' }]);
        setTags('');
    }, 500);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
        <div className="p-2 bg-purple-50 text-purple-700 rounded-lg">
            <Database size={20} />
        </div>
        <div>
            <h2 className="text-lg font-bold text-slate-900">Add Fund Manually</h2>
            <p className="text-xs text-slate-400">Manually enter NAV history for specific dates</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        
        {/* SECTION 1: INVESTMENT DETAILS */}
        <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide flex items-center">
                1. Fund & Investment Details
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5">Fund Name</label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. My Private Real Estate Fund"
                        className="w-full rounded-lg border-slate-200 border px-3 py-2.5 text-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none"
                        required
                    />
                </div>

                <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5">Type</label>
                    <select
                        value={type}
                        onChange={(e) => setType(e.target.value as InvestmentType)}
                        className="w-full rounded-lg border-slate-200 border px-3 py-2.5 text-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none bg-white"
                    >
                        <option value={InvestmentType.SIP}>SIP</option>
                        <option value={InvestmentType.LUMPSUM}>Lumpsum</option>
                    </select>
                </div>

                <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5">Amount (₹)</label>
                    <input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="10000"
                        className="w-full rounded-lg border-slate-200 border px-3 py-2.5 text-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none"
                        required
                    />
                </div>

                <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5">Start Date</label>
                    <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full rounded-lg border-slate-200 border px-3 py-2.5 text-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none text-slate-600"
                        required
                    />
                </div>

                <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5">End Date (Optional)</label>
                    <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full rounded-lg border-slate-200 border px-3 py-2.5 text-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none text-slate-600"
                    />
                </div>
                
                <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5">Tags (Optional)</label>
                    <input
                        type="text"
                        value={tags}
                        onChange={(e) => setTags(e.target.value)}
                        placeholder="Comma separated tags..."
                        className="w-full rounded-lg border-slate-200 border px-3 py-2.5 text-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none"
                    />
                </div>
            </div>
        </div>

        {/* SECTION 2: NAV HISTORY */}
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide flex items-center">
                    2. Specific NAV Entries
                </h3>
                <button
                    type="button"
                    onClick={handleAddRow}
                    className="text-xs font-bold text-purple-600 hover:bg-purple-50 px-3 py-1.5 rounded-lg transition-colors flex items-center"
                >
                    <PlusCircle size={14} className="mr-1.5" /> Add Row
                </button>
            </div>
            
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                <div className="flex items-center text-xs text-slate-400 mb-2 px-1">
                    <span className="flex-1 font-semibold">Date</span>
                    <span className="flex-1 font-semibold pl-2">NAV Value</span>
                    <span className="w-8"></span>
                </div>
                
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                    {navRows.map((row, idx) => (
                        <div key={idx} className="flex gap-2 items-center animate-in fade-in slide-in-from-left-2 duration-300">
                            <div className="flex-1">
                                <input
                                    type="date"
                                    value={row.date}
                                    onChange={(e) => handleRowChange(idx, 'date', e.target.value)}
                                    className="w-full rounded-lg border-slate-200 border px-2 py-2 text-sm focus:border-purple-500 outline-none"
                                    required
                                />
                            </div>
                            <div className="flex-1">
                                <input
                                    type="number"
                                    step="0.0001"
                                    value={row.nav}
                                    onChange={(e) => handleRowChange(idx, 'nav', e.target.value)}
                                    placeholder="NAV"
                                    className="w-full rounded-lg border-slate-200 border px-2 py-2 text-sm focus:border-purple-500 outline-none"
                                    required
                                />
                            </div>
                            <button
                                type="button"
                                onClick={() => handleRemoveRow(idx)}
                                className="w-8 h-9 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                disabled={navRows.length === 1}
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    ))}
                </div>
                
                <div className="mt-3 flex items-start gap-2 text-xs text-slate-500 bg-blue-50/50 p-2 rounded-lg border border-blue-100">
                    <Info size={14} className="text-blue-500 mt-0.5 flex-shrink-0" />
                    <p>
                        The backtester will use these exact NAVs for the specified dates. For dates between entries, it will use the closest previous NAV. 
                        Ensure you add NAVs corresponding to your SIP dates for accuracy.
                    </p>
                </div>
            </div>
        </div>

        <div className="pt-4 border-t border-slate-100">
            <button
                type="submit"
                disabled={isProcessing}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-purple-200 transition-all flex justify-center items-center disabled:opacity-50"
            >
                {isProcessing ? (
                    <>
                        <Loader2 className="animate-spin mr-2 h-4 w-4" /> Saving Custom Fund...
                    </>
                ) : (
                    <>
                        <Save className="mr-2 h-4 w-4" /> Save to Portfolio
                    </>
                )}
            </button>
        </div>

      </form>
    </div>
  );
};