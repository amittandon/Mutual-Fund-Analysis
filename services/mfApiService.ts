export interface MFScheme {
  schemeCode: string;
  schemeName: string;
}

export interface MFMeta {
  fund_house: string;
  scheme_type: string;
  scheme_category: string;
  scheme_code: string;
  scheme_name: string;
}

export interface MFData {
  meta: MFMeta;
  data: {
    date: string;
    nav: string;
  }[];
}

export const searchMF = async (query: string, retries = 3): Promise<MFScheme[]> => {
  try {
    const cleanedQuery = String(query).trim();
    if (!cleanedQuery) return [];

    for (let i = 0; i <= retries; i++) {
      try {
        const res = await fetch(`https://api.mfapi.in/mf/search?q=${encodeURIComponent(cleanedQuery)}`, {
          referrerPolicy: 'no-referrer',
          cache: 'no-cache'
        });
        
        if (res.status === 429 || res.status >= 500) {
          const waitTime = Math.pow(2, i) * 1000;
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }

        if (!res.ok) {
          if (i < retries) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            continue;
          }
          return [];
        }

        const data = await res.json();
        if (!Array.isArray(data)) {
          if (i < retries) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            continue;
          }
          return [];
        }
        
        return data.map((scheme: any) => ({
          ...scheme,
          schemeCode: String(scheme.schemeCode).trim()
        }));
      } catch (e) {
        if (i === retries) throw e;
        const waitTime = Math.pow(2, i) * 1000;
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
    return [];
  } catch (e) {
    console.error("Search failed", e);
    return [];
  }
};

export const getMFData = async (code: string, retries = 4): Promise<MFData | null> => {
  const cleanedCode = String(code).trim();
  if (!cleanedCode || cleanedCode === 'undefined' || cleanedCode === 'null') {
    console.error("Invalid scheme code provided to getMFData:", code);
    return null;
  }

  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(`https://api.mfapi.in/mf/${cleanedCode}`, {
        referrerPolicy: 'no-referrer',
        cache: 'no-cache'
      });

      // Handle rate limiting (429) and server errors (5xx) with exponential backoff
      if (res.status === 429 || res.status >= 500) {
        const waitTime = Math.pow(2, i) * 1000;
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }

      if (!res.ok) {
        if (i < retries) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }
        return null;
      }

      const data = await res.json();
      if (!data || !data.data || !Array.isArray(data.data)) {
        if (i < retries) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }
        return null;
      }
      return data;
    } catch (e) {
      if (i === retries) return null;
      const waitTime = Math.pow(2, i) * 1000;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  return null;
};

// Helper to parse any date format ("dd-mm-yyyy" or "yyyy-mm-dd") to Date object
const parseAnyDate = (dateStr: string): Date => {
  if (!dateStr || typeof dateStr !== 'string') return new Date(NaN);
  const parts = dateStr.split('-');
  if (parts.length !== 3) return new Date(NaN);
  
  const p0 = Number(parts[0]);
  const p1 = Number(parts[1]);
  const p2 = Number(parts[2]);

  if (p0 > 1000) {
    // yyyy-mm-dd
    return new Date(p0, p1 - 1, p2);
  } else if (p2 > 1000) {
    // dd-mm-yyyy
    return new Date(p2, p1 - 1, p0);
  }
  return new Date(NaN);
};

/**
 * Downsamples NAV data to reduce storage and memory footprint.
 * - Keeps daily data for the last 30 days.
 * - Keeps weekly data for the last year.
 * - Keeps monthly data for older history.
 * - Always preserves "importantDates" (e.g., transaction dates).
 */
export const downsampleNAVData = (
  data: { date: string; nav: string; }[], 
  importantDates: string[] = []
): { date: string; nav: string; }[] => {
  if (!data || data.length === 0) return [];
  
  // Ensure data is sorted descending (latest first) for consistent logic
  const sortedData = [...data].sort((a, b) => parseAnyDate(b.date).getTime() - parseAnyDate(a.date).getTime());
  
  // Sort important dates for faster lookup
  const importantSet = new Set(importantDates);
  
  const now = new Date();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(now.getDate() - 30);
  
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(now.getFullYear() - 1);

  const result: { date: string; nav: string; }[] = [];
  const seenWeeks = new Set<string>();
  const seenMonths = new Set<string>();

  // Data is now guaranteed to be descending (latest first)
  for (const entry of sortedData) {
    if (importantSet.has(entry.date)) {
      result.push(entry);
      continue;
    }

    const date = parseAnyDate(entry.date);
    
    if (date > thirtyDaysAgo) {
      // Keep daily for last 30 days
      result.push(entry);
    } else if (date > oneYearAgo) {
      // Keep weekly for data between 30 days and 1 year
      const year = date.getFullYear();
      const week = Math.floor(date.getDate() / 7);
      const weekKey = `${year}-${date.getMonth()}-${week}`;
      if (!seenWeeks.has(weekKey)) {
        result.push(entry);
        seenWeeks.add(weekKey);
      }
    } else {
      // Keep monthly for data older than 1 year
      const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
      if (!seenMonths.has(monthKey)) {
        result.push(entry);
        seenMonths.add(monthKey);
      }
    }
  }

  return result;
};

// Helper to check if a name looks like a Direct plan
export const isDirectPlan = (name: string): boolean => {
  return name.toLowerCase().includes('direct');
};

// New Helper: Intelligently find the best Direct Growth match for a raw query
export const findBestMatchingScheme = async (rawQuery: string): Promise<MFScheme | null> => {
  // Try with hyphens replaced by spaces first, as the API is sensitive to them
  const initialQuery = rawQuery.replace(/-/g, ' ').replace(/\s\s+/g, ' ').trim();
  let results = await searchMF(initialQuery);
  
  // Retry Strategy 1: Clean up common noise words if exact match failed
  if (!results || results.length === 0) {
      const cleaned = initialQuery
        .replace(/Mid ?Cap/gi, '')
        .replace(/Large ?Cap/gi, '')
        .replace(/Small ?Cap/gi, '')
        .replace(/Flexi ?Cap/gi, '')
        .replace(/Multi ?Cap/gi, '')
        .replace(/Fund/gi, '')
        .replace(/Scheme/gi, '')
        .replace(/Plan/gi, '')
        .replace(/Option/gi, '')
        .replace(/Growth/gi, '')
        .replace(/Direct/gi, '')
        .replace(/Regular/gi, '')
        .replace(/\s\s+/g, ' ')
        .trim();
      
      if (cleaned.length > 2 && cleaned !== initialQuery) {
           results = await searchMF(cleaned);
      }
  }

  // Retry Strategy 2: Try first 2-3 significant words
  if (!results || results.length === 0) {
       const words = rawQuery.split(' ').filter(w => w.length > 2);
       if (words.length >= 2) {
           const shortened = words.slice(0, 2).join(' ');
           results = await searchMF(shortened);
       }
  }

  if (!results || results.length === 0) return null;

  // We prioritize: Direct Plan AND Growth Option
  // Most users want to backtest the growth option of the direct plan.
  
  const lowerQuery = rawQuery.toLowerCase();
  const looksLikeIDCW = lowerQuery.includes('idcw') || lowerQuery.includes('dividend');

  // Filter logic
  const bestMatch = results.find(s => {
    const n = s.schemeName.toLowerCase();
    const isDirect = n.includes('direct');
    const isGrowth = n.includes('growth');
    const isIDCW = n.includes('idcw') || n.includes('dividend');

    if (looksLikeIDCW) {
       return isDirect && isIDCW;
    }
    return isDirect && isGrowth;
  });

  // If no perfect match, try just Direct
  if (!bestMatch) {
      return results.find(s => s.schemeName.toLowerCase().includes('direct')) || results[0];
  }

  return bestMatch;
};

// Helper to find the counterpart scheme (Direct <-> Regular)
export const findCounterpartScheme = async (originalCode: string, originalName: string): Promise<MFScheme | null> => {
  const isDirect = isDirectPlan(originalName);
  
  // Strategy: Extract the "Base Name" of the fund.
  // Most funds are formatted as: "Fund Name - Plan - Option"
  // E.g., "Nippon India Growth Fund - Growth Plan - Growth Option"
  // If we extract just "Nippon India Growth Fund", searching for that usually returns all variants.
  
  const parts = originalName.split(' - ');
  let queriesToTry: string[] = [];

  // 1. First priority: The prefix before the first hyphen (if valid length)
  if (parts.length > 1 && parts[0].length > 5) {
      queriesToTry.push(parts[0].trim());
  }

  // 2. Second priority: Regex cleaning (fallback if hyphen logic fails or is insufficient)
  // Remove keywords like "Direct Plan", "Regular Plan", "Growth Option", etc.
  let cleanedName = originalName
    .replace(/Direct Plan/gi, '')
    .replace(/Direct/gi, '')
    .replace(/Regular Plan/gi, '')
    .replace(/Regular/gi, '')
    .replace(/Growth Option/gi, '')
    .replace(/Growth Plan/gi, '')
    .replace(/Growth/gi, '') // Be careful, some funds have 'Growth' in the actual name, but rare for 'Growth Fund'
    .replace(/Option/gi, '')
    .replace(/-/g, ' ')
    .replace(/\s\s+/g, ' ')
    .trim();
  
  if (cleanedName && cleanedName !== parts[0]?.trim()) {
      queriesToTry.push(cleanedName);
  }
  
  // 3. Third priority: Specific targeting
  // If we have Regular, search "BaseName Direct"
  // If we have Direct, search "BaseName" (Regular usually implies no suffix)
  if (parts.length > 1) {
      if (!isDirect) {
          queriesToTry.push(`${parts[0].trim()} Direct`);
      }
  }
  
  // 4. Fallback: First 3 words of original name
  const firstWords = originalName.split(' ').slice(0, 3).join(' ');
  if (firstWords.length > 4) {
      queriesToTry.push(firstWords);
  }

  // Remove duplicates
  queriesToTry = [...new Set(queriesToTry)];

  // Helper to check if a scheme is the correct counterpart
  const isCounterpart = (s: MFScheme) => {
      if (s.schemeCode === originalCode) return false;
      
      const name = s.schemeName.toLowerCase();
      const origLower = originalName.toLowerCase();
      
      // Check Plan Type (Direct vs Regular)
      if (isDirect) {
          // We have Direct, looking for Regular.
          // Regular plans usually DO NOT have 'Direct' in the name.
          if (name.includes('direct')) return false;
      } else {
          // We have Regular, looking for Direct.
          if (!name.includes('direct')) return false;
      }

      // Check Option Type (Growth vs IDCW)
      const isGrowth = origLower.includes('growth');
      const isIDCW = origLower.includes('idcw') || origLower.includes('dividend');

      if (isGrowth && !name.includes('growth')) return false;
      if (isIDCW && (!name.includes('idcw') && !name.includes('dividend'))) return false;
      
      return true;
  };

  for (const q of queriesToTry) {
      const results = await searchMF(q);
      const match = results.find(isCounterpart);
      if (match) return match;
  }

  return null;
};