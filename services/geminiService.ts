// This service is deprecated in favor of direct MFAPI.in integration
import { GroundingSource } from "../types";

export const analyzeFund = async (fundName: string): Promise<{ details: null, sources: GroundingSource[] }> => {
  return { details: null, sources: [] };
};
