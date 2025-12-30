import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import { ChartDataPoint } from '../types';
import { formatCurrency } from '../utils/financials';
import { COLORS } from '../constants';

interface ComparisonChartProps {
  data: ChartDataPoint[];
  benchmarkName?: string;
}

const CustomTooltip = ({ active, payload, label, benchmarkName }: any) => {
  if (active && payload && payload.length) {
    const direct = payload.find((p: any) => p.dataKey === 'directValue');
    const regular = payload.find((p: any) => p.dataKey === 'regularValue');
    const invested = payload.find((p: any) => p.dataKey === 'investedAmount');
    const benchmark = payload.find((p: any) => p.dataKey === 'benchmarkValue');

    const directVal = direct?.value || 0;
    const regularVal = regular?.value || 0;
    const benchmarkVal = benchmark?.value || 0;

    const diff = directVal - regularVal;

    return (
      <div className="bg-white p-4 border border-slate-100 shadow-xl rounded-lg text-sm z-50">
        <p className="font-bold text-slate-700 mb-2">{label}</p>
        <div className="space-y-1">
           <p className="text-slate-500">
            Invested: <span className="font-semibold text-slate-900">{formatCurrency(invested?.value || 0)}</span>
          </p>
          <p className="text-emerald-600">
            Direct Plan: <span className="font-bold">{formatCurrency(directVal)}</span>
          </p>
          <p className="text-blue-600">
            Regular Plan: <span className="font-bold">{formatCurrency(regularVal)}</span>
          </p>
          
          {benchmark && (
            <div className="pt-2 mt-2 border-t border-slate-100">
                <p style={{ color: COLORS.benchmark }}>
                    {benchmarkName || 'Benchmark'}: <span className="font-bold">{formatCurrency(benchmarkVal)}</span>
                </p>
                {directVal > benchmarkVal ? (
                    <p className="text-xs text-emerald-600 mt-1">
                        Direct is beating benchmark by {formatCurrency(directVal - benchmarkVal)}
                    </p>
                ) : (
                    <p className="text-xs text-red-500 mt-1">
                        Direct is trailing benchmark by {formatCurrency(benchmarkVal - directVal)}
                    </p>
                )}
            </div>
          )}

          <div className="mt-2 pt-2 border-t border-slate-100 text-xs">
            {diff >= 0 ? (
                <span className="text-emerald-600 font-medium">
                  Direct saved you {formatCurrency(diff)}
                </span>
            ) : (
                <span className="text-red-500 font-medium">
                  Direct is behind by {formatCurrency(Math.abs(diff))}
                </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export const ComparisonChart: React.FC<ComparisonChartProps> = ({ data, benchmarkName }) => {
  // Guard against empty data to prevent render issues
  if (!data || data.length === 0) return null;

  return (
    // Use min-width: 0 to prevent flex item overflow causing width calculation errors
    // Use explicit style object for height to be safe
    <div className="w-full min-w-0" style={{ height: 400 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{
            top: 10,
            right: 10,
            left: 0,
            bottom: 0,
          }}
        >
          <defs>
            <linearGradient id="colorDirect" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={COLORS.direct} stopOpacity={0.2}/>
              <stop offset="95%" stopColor={COLORS.direct} stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="colorRegular" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={COLORS.regular} stopOpacity={0.2}/>
              <stop offset="95%" stopColor={COLORS.regular} stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="colorBenchmark" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={COLORS.benchmark} stopOpacity={0.1}/>
              <stop offset="95%" stopColor={COLORS.benchmark} stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis 
            dataKey="month" 
            tick={{fontSize: 12, fill: '#94a3b8'}} 
            tickLine={false}
            axisLine={false}
            minTickGap={30}
          />
          <YAxis 
            tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`}
            tick={{fontSize: 12, fill: '#94a3b8'}} 
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<CustomTooltip benchmarkName={benchmarkName} />} />
          <Legend wrapperStyle={{ paddingTop: '20px' }} />
          
          <Area
            type="monotone"
            dataKey="directValue"
            name="Direct Plan"
            stroke={COLORS.direct}
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorDirect)"
          />
          <Area
            type="monotone"
            dataKey="regularValue"
            name="Regular Plan"
            stroke={COLORS.regular}
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorRegular)"
          />
          {data.length > 0 && data[0].benchmarkValue !== undefined && (
            <Area
                type="monotone"
                dataKey="benchmarkValue"
                name={benchmarkName || "Benchmark"}
                stroke={COLORS.benchmark}
                strokeDasharray="5 5"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorBenchmark)"
            />
          )}
          <Area
            type="monotone"
            dataKey="investedAmount"
            name="Invested Amount"
            stroke={COLORS.invested}
            strokeWidth={1}
            strokeDasharray="3 3"
            fill="transparent"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};