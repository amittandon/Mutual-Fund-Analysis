import React from 'react';
import { TrendingUp } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-slate-50/50 text-slate-900 font-sans selection:bg-emerald-100 selection:text-emerald-900">
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 supports-[backdrop-filter]:bg-white/60">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="bg-emerald-50 p-2 rounded-lg">
                <TrendingUp className="h-6 w-6 text-emerald-600" />
              </div>
              <span className="text-xl font-bold tracking-tight text-slate-900">
                Mutual Fund <span className="text-emerald-600">Analyser</span>
              </span>
            </div>
            <div className="flex items-center space-x-6">
              <a href="#" className="text-sm font-medium text-slate-600 hover:text-emerald-600 transition-colors">
                Dashboard
              </a>
              <a href="https://www.amfiindia.com/" target="_blank" rel="noreferrer" className="text-sm font-medium text-slate-500 hover:text-slate-900">
                AMFI Data
              </a>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      <footer className="border-t border-slate-200 mt-20 bg-white">
        <div className="max-w-[1600px] mx-auto px-4 py-8 text-center sm:text-left sm:flex justify-between items-center text-slate-500 text-sm">
          <p>© {new Date().getFullYear()} TrueValue Backtester. Powered by Gemini.</p>
          <p className="mt-2 sm:mt-0 text-xs text-slate-400 max-w-md">
            Disclaimer: Returns are estimated based on historical CAGRs and current expense ratios. 
            This is for educational comparison only and not financial advice.
          </p>
        </div>
      </footer>
    </div>
  );
};
