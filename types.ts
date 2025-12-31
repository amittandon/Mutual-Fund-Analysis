export enum InvestmentType {
  SIP = 'SIP',
  LUMPSUM = 'LUMPSUM'
}

export interface NAVData {
  date: string; // dd-mm-yyyy
  nav: string;
}

export interface GroundingSource {
  title?: string;
  uri?: string;
}

export interface Investment {
  id: string;
  schemeCode: string;
  name: string;
  category?: string;
  fundHouse?: string;
  
  source: 'API' | 'CUSTOM'; // New field to distinguish source

  isDirect: boolean;
  navHistory: NAVData[];
  
  counterpartSchemeCode?: string;
  counterpartName?: string;
  counterpartNavHistory?: NAVData[];
  
  type: InvestmentType;
  amount: number;
  startDate: string; // ISO Date string
  endDate?: string; // ISO Date string (Optional)
  
  tags: string[]; 
  
  isLoading: boolean;
  error?: string;
}

export interface ChartDataPoint {
  month: string;
  directValue: number;
  regularValue: number;
  actualValue: number;
  counterpartValue: number;
  investedAmount: number;
  benchmarkValue?: number;
}

export interface PortfolioMetrics {
  totalInvested: number;
  currentValue: number;
  regularValue: number; 
  actualValue: number;
  counterpartValue: number;
  netImpact: number; 
  yearlyImpact: number;
  xirr: number;
  absoluteReturn: number;
  maxDrawdown: number;
  romad: number;
  alpha?: number;
  beta?: number;
}