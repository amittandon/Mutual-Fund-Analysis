import React, { useState } from 'react';
import { X, Calendar, IndianRupee, Hash, AlertCircle } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { Investment, Redemption } from '../types';

interface RedemptionModalProps {
  investment: Investment;
  onClose: () => void;
  onAddRedemption: (investmentId: string, redemption: Redemption) => void;
}

export const RedemptionModal: React.FC<RedemptionModalProps> = ({ investment, onClose, onAddRedemption }) => {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [type, setType] = useState<'AMOUNT' | 'UNITS' | 'ALL'>('AMOUNT');
  const [value, setValue] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (type !== 'ALL' && (!value || parseFloat(value) <= 0)) {
      setError('Please enter a valid value');
      return;
    }

    const redemptionDate = new Date(date);
    const investmentStartDate = new Date(investment.startDate);
    if (redemptionDate < investmentStartDate) {
      setError(`Redemption date cannot be before investment start date (${investment.startDate})`);
      return;
    }

    const redemption: Redemption = {
      id: uuidv4(),
      date,
      type,
      amount: type === 'AMOUNT' ? parseFloat(value) : undefined,
      units: type === 'UNITS' ? parseFloat(value) : undefined,
    };

    onAddRedemption(investment.id, redemption);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Redeem Investment</h3>
            <p className="text-xs text-slate-500 truncate max-w-[250px]">{investment.name}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
            <X size={20} className="text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-100 rounded-lg flex items-center gap-2 text-red-600 text-sm">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Redemption Date</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Redemption Type</label>
            <div className="grid grid-cols-3 gap-2">
              {(['AMOUNT', 'UNITS', 'ALL'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`py-2 text-xs font-semibold rounded-lg border transition-all ${
                    type === t
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-200'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {type !== 'ALL' && (
            <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-200">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                {type === 'AMOUNT' ? 'Amount to Redeem' : 'Units to Redeem'}
              </label>
              <div className="relative">
                {type === 'AMOUNT' ? (
                  <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                ) : (
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                )}
                <input
                  type="number"
                  step="any"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder={type === 'AMOUNT' ? 'e.g. 50000' : 'e.g. 125.5'}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                  required
                />
              </div>
            </div>
          )}

          <div className="pt-4">
            <button
              type="submit"
              className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition-all shadow-lg shadow-slate-200 flex items-center justify-center gap-2"
            >
              Confirm Redemption
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
