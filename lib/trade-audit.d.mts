export type ExecutionRow = {
  rowNumber: number;
  executionId: string;
  orderId: string;
  timestamp: string;
  account: string;
  assetType: string;
  currency: string;
  symbol: string;
  side: "BUY" | "SELL" | string;
  quantity: number;
  price: number;
  commission: number;
  setup: string;
  plannedRisk: number;
  riskLimit: number;
  reportedNetPnl: number;
  raw: Record<string, string>;
};

export type AuditIssue = {
  id: string;
  severity: "error" | "warning" | "info";
  code: string;
  title: string;
  detail: string;
  rowNumber: number | null;
  executionId: string | null;
  symbol: string | null;
};

export type RoundTrip = {
  id: string;
  account: string;
  symbol: string;
  openedAt: string;
  closedAt: string;
  executionIds: string[];
  setup: string;
  grossPnl: number;
  fees: number;
  netPnl: number;
  reportedNetPnl: number;
  pnlVariance: number;
  orderCount: number;
  executionCount: number;
  status: "closed";
};

export type AuditReport = {
  rowsReceived: number;
  executionsAccepted: number;
  executionsCalculated: number;
  openPositionExecutionCount: number;
  rejectedCount: number;
  calculationExcludedCount: number;
  unaccountedRowCount: number;
  duplicateCount: number;
  errorCount: number;
  warningCount: number;
  ruleBreaches: number;
  grossPnl: number;
  fees: number;
  netPnl: number;
  pnlVariance: number;
  pnlComparisonCount: number;
  roundTrips: RoundTrip[];
  openPositions: Array<{ account: string; symbol: string; side: string; quantity: number; averagePrice: number; executionIds: string[] }>;
  issues: AuditIssue[];
  accepted: ExecutionRow[];
};

export const DEMO_CSV: string;
export function parseExecutionCsv(text: string): ExecutionRow[];
export function auditExecutions(rows: ExecutionRow[]): AuditReport;
export function auditCsv(text: string): AuditReport;
export function issuesToCsv(issues: AuditIssue[]): string;
