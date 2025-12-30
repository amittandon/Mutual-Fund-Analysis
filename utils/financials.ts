import { Investment, ChartDataPoint, InvestmentType, NAVData, PortfolioMetrics } from '../types';

// Helper to parse "dd-mm-yyyy" (API format) to Date object (Local Midnight)
const parseAPIDate = (dateStr: string): Date => {
  const [d, m, y] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
};

// Helper to parse "yyyy-mm-dd" (Input format) to Date object (Local Midnight)
const parseISODate = (dateStr: string): Date => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
};

// Helper to get NAV avoiding mutation and handling gaps
const getNAV = (history: NAVData[], targetDate: Date, mode: 'PURCHASE' | 'VALUATION'): number | null => {
  if (!history || history.length === 0) return null;

  const targetTime = targetDate.getTime();
  
  if (mode === 'PURCHASE') {
    // Find first NAV >= targetDate (or closest future)
    for (let i = history.length - 1; i >= 0; i--) {
      const d = parseAPIDate(history[i].date);
      if (d.getTime() >= targetTime) {
        return parseFloat(history[i].nav);
      }
    }
    // If target is after last known date, return last known
    const latestDate = parseAPIDate(history[0].date);
    if (targetTime > latestDate.getTime()) {
        return parseFloat(history[0].nav);
    }
    return null;
  } else {
    // Find closest NAV <= targetDate (Valuation)
    for (const entry of history) {
      const d = parseAPIDate(entry.date);
      if (d.getTime() <= targetTime) {
        return parseFloat(entry.nav);
      }
    }
    return null;
  }
};

interface CashFlow {
  date: Date;
  amount: number; // Negative for outflow, Positive for inflow
}

// Helper: Simulate a single investment to get precise Units and Cashflows
// This unifies logic between Chart, KPIs, and Ratio tables.
const simulateInvestment = (inv: Investment, navHistory: NAVData[] | undefined) => {
    const cashFlows: CashFlow[] = [];
    let units = 0;
    let totalInvested = 0;
    
    if (!navHistory || navHistory.length === 0) {
        return { units: 0, totalInvested: 0, cashFlows: [], currentValue: 0 };
    }

    const startDate = parseISODate(inv.startDate);
    const endDate = inv.endDate ? parseISODate(inv.endDate) : null;
    const now = new Date();
    now.setHours(0,0,0,0);

    // Date Simulation Logic
    if (inv.type === InvestmentType.LUMPSUM) {
        const nav = getNAV(navHistory, startDate, 'PURCHASE');
        if (nav) {
            units += inv.amount / nav;
            totalInvested += inv.amount;
            cashFlows.push({ date: startDate, amount: -inv.amount });
        }
    } else {
        // SIP Logic matching generateBacktestData
        const startDay = startDate.getDate();
        let cursorDate = new Date(startDate);
        // Normalize cursor to start of month for iteration safety
        cursorDate.setDate(1);

        while (cursorDate <= now) {
            const year = cursorDate.getFullYear();
            const month = cursorDate.getMonth();

            // Determine strict payment date for this month
            const maxDayInMonth = new Date(year, month + 1, 0).getDate();
            const actualDay = Math.min(startDay, maxDayInMonth);
            const paymentDate = new Date(year, month, actualDay);

            // Validation
            const isStarted = paymentDate.getTime() >= startDate.getTime();
            const isNotFuture = paymentDate <= now;
            const isBeforeEnd = endDate ? paymentDate <= endDate : true;

            if (isStarted && isNotFuture && isBeforeEnd) {
                 const nav = getNAV(navHistory, paymentDate, 'PURCHASE');
                 if (nav) {
                     units += inv.amount / nav;
                     totalInvested += inv.amount;
                     cashFlows.push({ date: paymentDate, amount: -inv.amount });
                 }
            }
            
            // Move to next month
            cursorDate.setMonth(cursorDate.getMonth() + 1);
        }
    }

    // Calculate Current Value
    // Use the latest NAV available in history (usually [0] is latest desc)
    const currentNav = parseFloat(navHistory[0].nav);
    const currentValue = units * currentNav;

    return {
        units,
        totalInvested,
        cashFlows,
        currentValue
    };
};

export const generateBacktestData = (
  investments: Investment[], 
  benchmarkHistory?: NAVData[]
): ChartDataPoint[] => {
  if (investments.length === 0) return [];

  const activeInvestments = investments.filter(i => 
    (i.navHistory && i.navHistory.length > 0) || 
    (i.counterpartNavHistory && i.counterpartNavHistory.length > 0)
  );

  if (activeInvestments.length === 0) return [];

  const startDates = activeInvestments.map(i => parseISODate(i.startDate).getTime());
  const minDate = new Date(Math.min(...startDates));
  minDate.setDate(1);
  minDate.setHours(0,0,0,0);

  const now = new Date();
  now.setHours(0,0,0,0);

  const dataPoints: ChartDataPoint[] = [];

  const portfolio = activeInvestments.map(inv => ({
    ...inv,
    parsedStartDate: parseISODate(inv.startDate),
    parsedEndDate: inv.endDate ? parseISODate(inv.endDate) : null,
    unitsDirect: 0,
    unitsRegular: 0,
    totalInvested: 0,
    hasLumpsumInvested: false
  }));

  let benchmarkUnits = 0;
  const hasBenchmark = benchmarkHistory && benchmarkHistory.length > 0;

  let cursorDate = new Date(minDate);

  while (cursorDate <= now) {
    const year = cursorDate.getFullYear();
    const month = cursorDate.getMonth();
    let monthEndDate = new Date(year, month + 1, 0); 
    if (monthEndDate > now) monthEndDate = new Date(now);

    portfolio.forEach(inv => {
      let paymentDate: Date | null = null;
      
      if (inv.type === InvestmentType.SIP) {
        const startDay = inv.parsedStartDate.getDate();
        const maxDayInMonth = new Date(year, month + 1, 0).getDate();
        const actualDay = Math.min(startDay, maxDayInMonth);
        const candidateDate = new Date(year, month, actualDay);

        // Check if date is within range (Start <= Date <= Now) AND (Date <= EndDate if exists)
        const isStarted = candidateDate.getTime() >= inv.parsedStartDate.getTime();
        const isNotFuture = candidateDate <= now;
        const isBeforeEnd = inv.parsedEndDate ? candidateDate <= inv.parsedEndDate : true;

        if (isStarted && isNotFuture && isBeforeEnd) {
            paymentDate = candidateDate;
        }

      } else {
        if (!inv.hasLumpsumInvested) {
             const sameMonth = inv.parsedStartDate.getMonth() === month && inv.parsedStartDate.getFullYear() === year;
             if (sameMonth) {
                 paymentDate = inv.parsedStartDate;
             }
        }
      }

      if (paymentDate) {
         if (inv.type === InvestmentType.LUMPSUM) inv.hasLumpsumInvested = true;

         // Calculate Direct Scenario Units
         // Note: Logic here explicitly separates Direct/Regular scenarios for the chart lines
         if (inv.isDirect && inv.navHistory?.length) {
             const nav = getNAV(inv.navHistory, paymentDate, 'PURCHASE');
             if (nav) inv.unitsDirect += inv.amount / nav;
         } else if (!inv.isDirect && inv.counterpartNavHistory?.length) {
             const nav = getNAV(inv.counterpartNavHistory, paymentDate, 'PURCHASE');
             if (nav) inv.unitsDirect += inv.amount / nav;
         }

         // Calculate Regular Scenario Units
         if (!inv.isDirect && inv.navHistory?.length) {
             const nav = getNAV(inv.navHistory, paymentDate, 'PURCHASE');
             if (nav) inv.unitsRegular += inv.amount / nav;
         } else if (inv.isDirect && inv.counterpartNavHistory?.length) {
             const nav = getNAV(inv.counterpartNavHistory, paymentDate, 'PURCHASE');
             if (nav) inv.unitsRegular += inv.amount / nav;
         }

         // Benchmark Buy
         if (hasBenchmark) {
             const bNav = getNAV(benchmarkHistory!, paymentDate, 'PURCHASE');
             if (bNav) {
                 benchmarkUnits += inv.amount / bNav;
             }
         }

         inv.totalInvested += inv.amount;
      }
    });

    let totalDirectVal = 0;
    let totalRegularVal = 0;
    let totalActualVal = 0;
    let totalCounterpartVal = 0;
    let totalInvested = 0;
    let totalBenchmarkVal = 0;

    portfolio.forEach(inv => {
        totalInvested += inv.totalInvested;

        // --- SCENARIO 1: ALL DIRECT ---
        const historyD = inv.isDirect ? inv.navHistory : inv.counterpartNavHistory;
        const unitsD = inv.unitsDirect;
        let valD = 0;
        if (unitsD > 0 && historyD) {
            const nav = getNAV(historyD, monthEndDate, 'VALUATION');
            if (nav) valD = unitsD * nav;
        }
        totalDirectVal += valD;

        // --- SCENARIO 2: ALL REGULAR ---
        const historyR = !inv.isDirect ? inv.navHistory : inv.counterpartNavHistory;
        const unitsR = inv.unitsRegular;
        let valR = 0;
        if (unitsR > 0 && historyR) {
            const nav = getNAV(historyR, monthEndDate, 'VALUATION');
            if (nav) valR = unitsR * nav;
        }
        totalRegularVal += valR;

        // --- SCENARIO 3: ACTUAL SELECTION ---
        if (inv.isDirect) {
            totalActualVal += valD;
            totalCounterpartVal += valR;
        } else {
            totalActualVal += valR;
            totalCounterpartVal += valD;
        }
    });

    if (hasBenchmark && benchmarkUnits > 0) {
        const bNav = getNAV(benchmarkHistory!, monthEndDate, 'VALUATION');
        if (bNav) {
            totalBenchmarkVal = benchmarkUnits * bNav;
        }
    }

    if (totalInvested > 0) {
        dataPoints.push({
            month: monthEndDate.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
            directValue: Math.round(totalDirectVal),
            regularValue: Math.round(totalRegularVal),
            actualValue: Math.round(totalActualVal),
            counterpartValue: Math.round(totalCounterpartVal),
            investedAmount: Math.round(totalInvested),
            benchmarkValue: hasBenchmark ? Math.round(totalBenchmarkVal) : undefined
        });
    }

    cursorDate.setMonth(cursorDate.getMonth() + 1);
    cursorDate.setDate(1); 
  }

  return dataPoints;
};

export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount);
};

// Newton-Raphson method to calculate XIRR
export const calculateXIRR = (transactions: CashFlow[], currentValue: number, valuationDate: Date): number => {
  const flows = [...transactions, { date: valuationDate, amount: currentValue }];
  
  if (flows.length < 2) return 0;
  
  // Initial guess (10%)
  let rate = 0.1; 
  
  for (let i = 0; i < 50; i++) { // Max 50 iterations
    let fValue = 0;
    let fDerivative = 0;
    
    for (const flow of flows) {
      const days = (flow.date.getTime() - flows[0].date.getTime()) / (1000 * 60 * 60 * 24);
      const years = days / 365;
      
      const r = Math.max(rate, -0.99); 
      
      const pvFactor = Math.pow(1 + r, years);
      fValue += flow.amount / pvFactor;
      fDerivative -= (years * flow.amount) / (pvFactor * (1 + r));
    }
    
    if (Math.abs(fValue) < 1) break; // Precision threshold
    
    const newRate = rate - fValue / fDerivative;
    if (isNaN(newRate) || !isFinite(newRate)) return 0; 
    rate = newRate;
  }
  
  return rate * 100; // Return percentage
};

// Calculate Max Drawdown from a series of values
const calculateMaxDrawdown = (values: number[]): number => {
    if (values.length === 0) return 0;
    
    let maxPeak = values[0];
    let maxDrawdown = 0;

    for (const v of values) {
        if (v > maxPeak) {
            maxPeak = v;
        }
        const drawdown = (maxPeak - v) / maxPeak;
        if (drawdown > maxDrawdown) {
            maxDrawdown = drawdown;
        }
    }

    return maxDrawdown * 100; // percentage
};

// Calculate Volatility (Annualized Standard Deviation of Returns)
const calculateVolatility = (navHistory: NAVData[], startDate: Date): number => {
    const history = navHistory
        .map(h => ({ date: parseAPIDate(h.date), nav: parseFloat(h.nav) }))
        .filter(h => h.date >= startDate)
        .sort((a, b) => a.date.getTime() - b.date.getTime()); 

    if (history.length < 30) return 0;

    const returns = [];
    for (let i = 1; i < history.length; i++) {
        const r = (history[i].nav - history[i - 1].nav) / history[i - 1].nav;
        returns.push(r);
    }

    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length;
    
    return Math.sqrt(variance) * Math.sqrt(252) * 100;
};

// Calculate Beta (Covariance / Variance)
const calculateBeta = (assetHistory: NAVData[], benchmarkHistory: NAVData[], startDate: Date): number => {
    const assetMap = new Map<string, number>();
    assetHistory.forEach(h => assetMap.set(h.date, parseFloat(h.nav)));
    
    // Normalize dates
    const commonDates = benchmarkHistory
        .filter(h => parseAPIDate(h.date) >= startDate && assetMap.has(h.date))
        .map(h => h.date)
        .reverse(); // Ensure Ascending order

    if (commonDates.length < 30) return 1; 

    const assetReturns: number[] = [];
    const benchReturns: number[] = [];
    
    for (let i = 1; i < commonDates.length; i++) {
        const currDate = commonDates[i];
        const prevDate = commonDates[i-1];
        
        const assetCurr = assetMap.get(currDate)!;
        const assetPrev = assetMap.get(prevDate)!;
        
        const benchCurr = parseFloat(benchmarkHistory.find(h => h.date === currDate)!.nav);
        const benchPrev = parseFloat(benchmarkHistory.find(h => h.date === prevDate)!.nav);

        assetReturns.push((assetCurr - assetPrev) / assetPrev);
        benchReturns.push((benchCurr - benchPrev) / benchPrev);
    }

    const meanAsset = assetReturns.reduce((a, b) => a + b, 0) / assetReturns.length;
    const meanBench = benchReturns.reduce((a, b) => a + b, 0) / benchReturns.length;

    let covariance = 0;
    let varianceBench = 0;

    for (let i = 0; i < assetReturns.length; i++) {
        covariance += (assetReturns[i] - meanAsset) * (benchReturns[i] - meanBench);
        varianceBench += Math.pow(benchReturns[i] - meanBench, 2);
    }

    if (varianceBench === 0) return 1;
    return covariance / varianceBench;
};

export const calculatePortfolioStats = (
    investments: Investment[],
    chartData: ChartDataPoint[],
    benchmarkHistory?: NAVData[]
): PortfolioMetrics => {
    
    let totalInvested = 0;
    let actualValue = 0;
    let counterpartValue = 0;
    const allCashFlows: CashFlow[] = [];

    // Recalculate everything using strict simulation to ensure consistency
    investments.forEach(inv => {
        // Actual Simulation: ALWAYS use inv.navHistory (Selected Fund)
        const history = inv.navHistory;
        const stats = simulateInvestment(inv, history);
        
        totalInvested += stats.totalInvested;
        actualValue += stats.currentValue;
        allCashFlows.push(...stats.cashFlows);

        // Counterpart Simulation: Use inv.counterpartNavHistory (The Other Fund)
        // If counterpart data is missing, we can't calculate a comparison value, so we default to 0 (or Actual, to avoid showing false loss).
        // Defaulting to 0 makes Impact = Actual - 0 = Actual (Confusing). 
        // Let's only calculate counterpart value if history exists.
        if (inv.counterpartNavHistory && inv.counterpartNavHistory.length > 0) {
             const counterpartStats = simulateInvestment(inv, inv.counterpartNavHistory);
             counterpartValue += counterpartStats.currentValue;
        } else {
             // If comparison is missing, assume neutral impact for this fund
             counterpartValue += stats.currentValue;
        }
    });

    // Net Impact (Actual - Counterpart)
    // If I have Direct, Actual > Counterpart (Regular). Impact is Positive (Saved money).
    // If I have Regular, Actual < Counterpart (Direct). Impact is Negative (Lost money).
    const netImpact = actualValue - counterpartValue;

    // Approximate duration for yearly impact
    let yearlyImpact = 0;
    if (chartData.length > 0) {
        const months = chartData.length;
        let years = months / 12;
        if (years < 0.1) years = 0.1;
        yearlyImpact = netImpact / years;
    }

    // XIRR on Actual Value
    const xirr = calculateXIRR(allCashFlows, actualValue, new Date());
    
    // Absolute Return on Actual
    const absoluteReturn = totalInvested > 0 
        ? ((actualValue - totalInvested) / totalInvested) * 100 
        : 0;

    // Max Drawdown based on Actual Portfolio curve
    const portfolioValues = chartData.map(d => d.actualValue);
    const maxDrawdown = calculateMaxDrawdown(portfolioValues);

    const romad = maxDrawdown > 0 ? xirr / maxDrawdown : (xirr > 0 ? 100 : 0); 

    // Alpha & Beta wrt Selected Funds (Actual Portfolio)
    let alpha = 0;
    let beta = 0;

    if (benchmarkHistory && benchmarkHistory.length > 0 && chartData.length > 6) {
        const portfolioReturns = [];
        const benchmarkReturns = [];
        
        for (let i = 1; i < chartData.length; i++) {
             const prev = chartData[i-1];
             const curr = chartData[i];
             
             // Net Flow (New Investment)
             const cashflow = curr.investedAmount - prev.investedAmount;
             
             if(prev.actualValue > 0 && prev.benchmarkValue !== undefined && curr.benchmarkValue !== undefined) {
                 const pDenom = prev.actualValue + cashflow;
                 const pRet = pDenom > 0 ? (curr.actualValue - prev.actualValue - cashflow) / pDenom : 0;
                 
                 const bDenom = prev.benchmarkValue + cashflow;
                 const bRet = bDenom > 0 ? (curr.benchmarkValue - prev.benchmarkValue - cashflow) / bDenom : 0;

                 portfolioReturns.push(pRet);
                 benchmarkReturns.push(bRet);
             }
        }

        if (portfolioReturns.length > 0) {
            const meanPort = portfolioReturns.reduce((a,b) => a+b, 0) / portfolioReturns.length;
            const meanBench = benchmarkReturns.reduce((a,b) => a+b, 0) / benchmarkReturns.length;
            
            let cov = 0;
            let varBench = 0;
            for(let i=0; i<portfolioReturns.length; i++) {
                cov += (portfolioReturns[i] - meanPort) * (benchmarkReturns[i] - meanBench);
                varBench += Math.pow(benchmarkReturns[i] - meanBench, 2);
            }
            
            beta = varBench > 0 ? cov / varBench : 1;
            
            const rf = 0.06;
            const rm = Math.pow(1 + meanBench, 12) - 1;
            const rp = xirr / 100;
            
            alpha = rp - (rf + beta * (rm - rf));
            alpha = alpha * 100;
        }
    }

    return {
        totalInvested,
        currentValue: actualValue, // Updated to return Actual Portfolio Value
        regularValue: 0, // Deprecated in UI
        actualValue,
        counterpartValue,
        netImpact,
        yearlyImpact,
        xirr,
        absoluteReturn,
        maxDrawdown,
        romad,
        alpha: benchmarkHistory ? alpha : undefined,
        beta: benchmarkHistory ? beta : undefined
    };
};

export const calculateFundRatios = (investments: Investment[], benchmarkHistory: NAVData[]) => {
    const allCashFlows: CashFlow[] = []; // Collect ALL cashflows for True Portfolio XIRR

    const funds = investments.map(inv => {
        // ALWAYS use the selected plan's history (inv.navHistory)
        const history = inv.navHistory;
        if (!history || history.length === 0) return null;
        
        // Strict Simulation
        const stats = simulateInvestment(inv, history);
        const startDate = parseISODate(inv.startDate);
        const now = new Date();
        
        // Add to aggregate portfolio cashflows
        allCashFlows.push(...stats.cashFlows);

        const xirr = calculateXIRR(stats.cashFlows, stats.currentValue, new Date());
        const volatility = calculateVolatility(history, startDate);
        
        let beta = 0;
        let alpha = 0;

        if (benchmarkHistory && benchmarkHistory.length > 0) {
             beta = calculateBeta(history, benchmarkHistory, startDate);
             
             // Alpha Calculation (Jensen's)
             // R_p - [ R_f + Beta * (R_m - R_f) ]
             
             const bStartNav = getNAV(benchmarkHistory, startDate, 'PURCHASE');
             
             if (bStartNav) {
                const bEndNav = parseFloat(benchmarkHistory[0].nav);
                const years = (now.getTime() - startDate.getTime()) / (1000 * 3600 * 24 * 365);
                
                // Market Return (Annualized CAGR over the period)
                const rm = Math.pow(bEndNav / bStartNav, 1/Math.max(years, 0.1)) - 1;
                
                const rf = 0.06; // Risk Free Rate (Assumed 6%)
                alpha = (xirr/100) - (rf + beta * (rm - rf));
                alpha = alpha * 100;
             } else {
                 // If benchmark data is missing for start date, cannot assume alpha
                 alpha = 0;
             }
        }

        return {
            name: inv.name,
            invested: stats.totalInvested,
            currentValue: stats.currentValue,
            xirr,
            volatility,
            beta,
            alpha
        };
    }).filter(f => f !== null) as any[];

    // Recalculate Portfolio Aggregates (Weighted)
    const totalInvested = funds.reduce((acc, f) => acc + f.invested, 0);
    const totalValue = funds.reduce((acc, f) => acc + f.currentValue, 0);
    
    // FIX 1: Calculate TRUE Portfolio XIRR using aggregate cashflows
    // (Previous method of weighted average XIRR is mathematically incorrect for portfolio returns)
    const portfolioXirr = calculateXIRR(allCashFlows, totalValue, new Date());

    const weightedVol = totalValue > 0 ? funds.reduce((acc, f) => acc + (f.volatility * (f.currentValue/totalValue)), 0) : 0;
    const weightedBeta = totalValue > 0 ? funds.reduce((acc, f) => acc + (f.beta * (f.currentValue/totalValue)), 0) : 0;
    const weightedAlpha = totalValue > 0 ? funds.reduce((acc, f) => acc + (f.alpha * (f.currentValue/totalValue)), 0) : 0;

    return {
        funds,
        portfolio: {
            invested: totalInvested,
            currentValue: totalValue,
            xirr: portfolioXirr, // Using True XIRR
            volatility: weightedVol,
            beta: weightedBeta,
            alpha: weightedAlpha
        }
    };
};