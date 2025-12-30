import React, { useState } from 'react';
import { Investment, InvestmentType } from '../types';
import { Trash2, Loader2, TrendingUp, AlertTriangle, CheckCircle2, Edit2, Check, X, Calendar, IndianRupee, ArrowRight, Tag } from 'lucide-react';

interface InvestmentListProps {
  investments: Investment[];
  onRemove: (id: string) => void;
  onUpdate: (id: string, amount: number, startDate: string, endDate: string | undefined, tags: string[]) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export const InvestmentList: React.FC<InvestmentListProps> = ({ investments, onRemove, onUpdate, selectedId, onSelect }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{amount: string, startDate: string, endDate: string, tags: string}>({ amount: '', startDate: '', endDate: '', tags: '' });

  const handleEditClick = (e: React.MouseEvent, inv: Investment) => {
    e.stopPropagation();
    setEditingId(inv.id);
    setEditValues({ 
        amount: inv.amount.toString(), 
        startDate: inv.startDate,
        endDate: inv.endDate || '',
        tags: inv.tags ? inv.tags.join(', ') : ''
    });
  };

  const handleCancel = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(null);
  };

  const handleSave = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (editingId && editValues.amount && editValues.startDate) {
        if (editValues.endDate && editValues.startDate > editValues.endDate) {
            alert("End date must be after start date");
            return;
        }
      const tagList = editValues.tags.split(',').map(t => t.trim()).filter(t => t.length > 0);
      onUpdate(editingId, parseFloat(editValues.amount), editValues.startDate, editValues.endDate || undefined, tagList);
      setEditingId(null);
    }
  };

  const handleRemove = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    onRemove(id);
  };

  const handleCardClick = (id: string) => {
    // Only allow selection if not editing
    if (!editingId) {
        onSelect(id);
    }
  };

  if (investments.length === 0) {
    return (
      <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-300 shadow-sm">
        <div className="mx-auto h-16 w-16 text-slate-300 flex items-center justify-center rounded-full bg-slate-50 mb-4">
          <TrendingUp size={32} />
        </div>
        <h3 className="text-lg font-semibold text-slate-900">No investments added</h3>
        <p className="mt-2 text-slate-500 max-w-sm mx-auto">
          Start by adding a mutual fund using the configuration panel above to analyze your portfolio.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {investments.map((inv) => {
        const isEditing = editingId === inv.id;
        const isSelected = selectedId === inv.id;

        return (
          <div 
            key={inv.id} 
            onClick={() => handleCardClick(inv.id)}
            className={`
                group relative bg-white rounded-2xl transition-all duration-300 p-5 cursor-pointer
                ${isEditing 
                    ? 'border-2 border-emerald-500 shadow-lg scale-[1.02] z-10' 
                    : isSelected 
                        ? 'border-2 border-emerald-500 shadow-md ring-4 ring-emerald-50/50' 
                        : 'border border-slate-200 hover:shadow-xl hover:border-emerald-200 hover:-translate-y-1'
                }
            `}
          >
            <div className="flex justify-between items-start mb-4">
              <div className="flex-1 pr-3">
                 <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide mb-2 ${inv.isDirect ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'}`}>
                    {inv.isDirect ? 'Direct' : 'Regular'} Plan
                 </span>
                <h4 className="font-bold text-slate-900 line-clamp-2 leading-tight h-[2.5em]" title={inv.name}>
                  {inv.name}
                </h4>
              </div>
              
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity absolute top-4 right-4 bg-white/90 backdrop-blur-sm p-1 rounded-lg shadow-sm border border-slate-100">
                {isEditing ? (
                  <>
                    <button 
                      onClick={(e) => handleSave(e)}
                      className="text-white bg-emerald-500 hover:bg-emerald-600 p-1.5 rounded-md transition-colors shadow-sm"
                      title="Save"
                    >
                      <Check size={14} />
                    </button>
                    <button 
                      onClick={(e) => handleCancel(e)}
                      className="text-slate-500 hover:bg-slate-100 p-1.5 rounded-md transition-colors"
                      title="Cancel"
                    >
                      <X size={14} />
                    </button>
                  </>
                ) : (
                  <>
                    <button 
                      onClick={(e) => handleEditClick(e, inv)}
                      className="text-slate-400 hover:text-blue-600 hover:bg-blue-50 p-1.5 rounded-md transition-colors"
                      title="Edit"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button 
                      onClick={(e) => handleRemove(e, inv.id)}
                      className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-md transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="space-y-4">
              {isEditing ? (
                <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-100 shadow-inner" onClick={(e) => e.stopPropagation()}>
                   <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-500 block">Amount</label>
                      <div className="relative">
                        <IndianRupee size={12} className="absolute left-2.5 top-2.5 text-slate-400"/>
                        <input 
                            type="number" 
                            value={editValues.amount}
                            onChange={(e) => setEditValues({...editValues, amount: e.target.value})}
                            className="w-full text-sm pl-7 pr-2 py-1.5 border border-slate-200 rounded-lg focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                        />
                      </div>
                   </div>
                   <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-slate-500 block">Start</label>
                            <input 
                                type="date" 
                                value={editValues.startDate}
                                onChange={(e) => setEditValues({...editValues, startDate: e.target.value})}
                                className="w-full text-sm px-2 py-1.5 border border-slate-200 rounded-lg focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                            />
                        </div>
                        {inv.type === InvestmentType.SIP && (
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-slate-500 block">End</label>
                                <input 
                                    type="date" 
                                    value={editValues.endDate}
                                    onChange={(e) => setEditValues({...editValues, endDate: e.target.value})}
                                    className="w-full text-sm px-2 py-1.5 border border-slate-200 rounded-lg focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                                />
                            </div>
                        )}
                   </div>
                   <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-500 block">Tags</label>
                        <div className="relative">
                            <Tag size={12} className="absolute left-2.5 top-2.5 text-slate-400"/>
                            <input 
                                type="text" 
                                value={editValues.tags}
                                onChange={(e) => setEditValues({...editValues, tags: e.target.value})}
                                placeholder="Comma separated tags"
                                className="w-full text-sm pl-7 pr-2 py-1.5 border border-slate-200 rounded-lg focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                            />
                        </div>
                   </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-100">
                    <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-0.5">{inv.type}</span>
                    <span className="font-bold text-slate-900 flex items-center gap-1">
                        <IndianRupee size={12} className="text-slate-400"/> {inv.amount.toLocaleString('en-IN')}
                    </span>
                  </div>
                   <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-100">
                    <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-0.5">Duration</span>
                    <span className="font-bold text-slate-900 flex items-center gap-1">
                        <span className="truncate">
                        {new Date(inv.startDate).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })}
                        {inv.endDate ? (
                            <>
                             <ArrowRight size={10} className="inline mx-1 text-slate-400" />
                             {new Date(inv.endDate).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })}
                            </>
                        ) : (
                             inv.type === InvestmentType.SIP ? <span className="text-emerald-600 text-[10px] ml-1 uppercase">Ongoing</span> : null
                        )}
                        </span>
                    </span>
                  </div>
                </div>
              )}

              {/* Tags Rendering */}
              {inv.tags && inv.tags.length > 0 && !isEditing && (
                <div className="flex flex-wrap gap-1 mt-1">
                    {inv.tags.map(tag => (
                        <span key={tag} className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded border border-slate-200 flex items-center">
                            <Tag size={8} className="mr-1 opacity-50" />
                            {tag}
                        </span>
                    ))}
                </div>
              )}
              
              <div className="pt-3 border-t border-slate-100">
                 {inv.isLoading ? (
                  <div className="flex items-center text-emerald-600 text-xs font-medium bg-emerald-50 px-3 py-2 rounded-lg">
                    <Loader2 className="animate-spin mr-2 h-3 w-3" />
                    Fetching NAV history...
                  </div>
                ) : (
                  <div className="space-y-2">
                    {inv.counterpartSchemeCode ? (
                          <div className="flex items-center text-slate-500 text-xs bg-slate-50 px-2 py-1.5 rounded-md border border-slate-100">
                              <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-emerald-500 flex-shrink-0" />
                              <span className="truncate">Comparing vs {inv.isDirect ? 'Regular' : 'Direct'}</span>
                          </div>
                      ) : (
                          <div className="flex items-center text-amber-600 text-xs bg-amber-50 px-2 py-1.5 rounded-md border border-amber-100">
                              <AlertTriangle className="w-3.5 h-3.5 mr-1.5 flex-shrink-0" />
                              Comparison Unavailable
                          </div>
                      )}
  
                    {inv.error && (
                      <div className="text-xs text-red-500 bg-red-50 px-2 py-1 rounded-md border border-red-100">
                          {inv.error}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            
            {/* Selection Indicator */}
            {isSelected && (
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white"></div>
            )}
          </div>
        );
      })}
    </div>
  );
};