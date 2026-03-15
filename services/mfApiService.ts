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

export const DEAD_FUND_MAPPING: Record<string, MFScheme> = {
  '149153': { schemeCode: '151034', schemeName: 'HSBC Midcap Fund - Regular Growth' },
  '149154': { schemeCode: '151036', schemeName: 'HSBC Midcap Fund - Direct Growth' },
  '149152': { schemeCode: '151033', schemeName: 'HSBC Midcap Fund - Regular IDCW' },
  '149155': { schemeCode: '151035', schemeName: 'HSBC Midcap Fund - Direct IDCW' },
  // L&T Midcap Fund (old codes before HSBC acquisition)
  '113247': { schemeCode: '151034', schemeName: 'HSBC Midcap Fund - Regular Growth' },
  '118834': { schemeCode: '151036', schemeName: 'HSBC Midcap Fund - Direct Growth' },
  '113248': { schemeCode: '151033', schemeName: 'HSBC Midcap Fund - Regular IDCW' },
  '118835': { schemeCode: '151035', schemeName: 'HSBC Midcap Fund - Direct IDCW' },
  // L&T Flexi Cap / Equity Fund
  '102012': { schemeCode: '151042', schemeName: 'HSBC Flexi Cap Fund - Regular Growth' },
  '119104': { schemeCode: '151044', schemeName: 'HSBC Flexi Cap Fund - Direct Growth' },
  // L&T Emerging Businesses
  '128951': { schemeCode: '151026', schemeName: 'HSBC Emerging Businesses Fund - Regular Growth' },
  '128952': { schemeCode: '151028', schemeName: 'HSBC Emerging Businesses Fund - Direct Growth' },
  // L&T Tax Advantage
  '102033': { schemeCode: '151022', schemeName: 'HSBC ELSS Tax Saver Fund - Regular Growth' },
  '119109': { schemeCode: '151024', schemeName: 'HSBC ELSS Tax Saver Fund - Direct Growth' },
};

export const searchMF = async (query: string): Promise<MFScheme[]> => {
  try {
    const cleanedQuery = String(query).trim();
    if (!cleanedQuery) return [];

    const res = await fetch(`https://api.mfapi.in/mf/search?q=${encodeURIComponent(cleanedQuery)}`, {
      referrerPolicy: 'no-referrer',
      cache: 'no-cache'
    });
    
    if (!res.ok) {
      console.error(`Search failed with status: ${res.status}`);
      return [];
    }
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    
    // Map dead funds to their active counterparts
    return data.map((scheme: any) => {
      const codeStr = String(scheme.schemeCode).trim();
      if (DEAD_FUND_MAPPING[codeStr]) {
        return DEAD_FUND_MAPPING[codeStr];
      }
      return {
        ...scheme,
        schemeCode: codeStr // Ensure it's a string
      };
    });
  } catch (e) {
    console.error("Search failed", e);
    return [];
  }
};

export const LEGACY_STITCH_MAP: Record<string, string[]> = {
  '151034': ['149153', '113247', '102013'], // HSBC Midcap Reg (Current <- Interim <- L&T <- DBS Chola)
  '151036': ['149154', '118834'],           // HSBC Midcap Dir
  '151033': ['149152', '113248', '102014'], // HSBC Midcap Reg IDCW
  '151035': ['149155', '118835'],           // HSBC Midcap Dir IDCW
  '151042': ['102012'],                     // HSBC Flexi Reg
  '151044': ['119104'],                     // HSBC Flexi Dir
  '151026': ['128951'],                     // HSBC Emerging Reg
  '151028': ['128952'],                     // HSBC Emerging Dir
  '151022': ['102033'],                     // HSBC ELSS Reg
  '151024': ['119109'],                     // HSBC ELSS Dir
};

export const getMFData = async (code: string, retries = 2): Promise<MFData | null> => {
  const cleanedCode = String(code).trim();
  if (!cleanedCode || cleanedCode === 'undefined' || cleanedCode === 'null') {
    console.error("Invalid scheme code provided to getMFData:", code);
    return null;
  }

  const fetchSingle = async (c: string): Promise<MFData | null> => {
    for (let i = 0; i <= retries; i++) {
      try {
        const res = await fetch(`https://api.mfapi.in/mf/${c}`, {
          referrerPolicy: 'no-referrer',
          cache: 'no-cache'
        });

        if (res.status === 429) {
          const waitTime = Math.pow(2, i) * 1000;
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }

        if (!res.ok) {
          if (i < retries) continue;
          return null;
        }

        const data = await res.json();
        if (!data || !data.data || !Array.isArray(data.data)) {
          if (i < retries) continue;
          return null;
        }
        return data;
      } catch (e) {
        if (i === retries) return null;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    return null;
  };

  const mainData = await fetchSingle(cleanedCode);
  if (!mainData) return null;

  // Stitching Logic
  if (LEGACY_STITCH_MAP[cleanedCode]) {
    let stitchedHistory = [...mainData.data];
    const existingDates = new Set(stitchedHistory.map(d => d.date));

    for (const legacyCode of LEGACY_STITCH_MAP[cleanedCode]) {
      const legacyData = await fetchSingle(legacyCode);
      if (legacyData && legacyData.data) {
        // Only add dates that don't exist in the current set
        for (const entry of legacyData.data) {
          if (!existingDates.has(entry.date)) {
            stitchedHistory.push(entry);
            existingDates.add(entry.date);
          }
        }
      }
    }

    // Re-sort by date descending (latest first)
    const parseDate = (s: string) => {
      const [d, m, y] = s.split('-').map(Number);
      return new Date(y, m - 1, d).getTime();
    };
    stitchedHistory.sort((a, b) => parseDate(b.date) - parseDate(a.date));
    
    return {
      ...mainData,
      data: stitchedHistory
    };
  }

  return mainData;
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