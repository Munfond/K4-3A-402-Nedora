export * from "./types";
export { dealbreakersTool } from "./dealbreakers";
export { segmentsTool } from "./segments";
export { severityStatsTool } from "./severity-stats";
export { executionStatusTool } from "./execution-status";
export { topRequestsTool } from "./top-requests";

import { dealbreakersTool } from "./dealbreakers";
import { executionStatusTool } from "./execution-status";
import { segmentsTool } from "./segments";
import { severityStatsTool } from "./severity-stats";
import { topRequestsTool } from "./top-requests";

/**
 * All area insights tools bundled together
 */
export const areaInsightTools = {
  dealbreakers: dealbreakersTool,
  segments: segmentsTool,
  severityStats: severityStatsTool,
  executionStatus: executionStatusTool,
  topRequests: topRequestsTool,
};
