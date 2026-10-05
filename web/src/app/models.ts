export interface Incident {
  id: string;
  machineId: string;
  severity: string;
  title: string;
  description: string;
  status: string;
}

export interface Machine {
  id: string;
  name: string;
  state: string;
  line: string;
  telemetry: Record<string, number | string | boolean | null>;
  observedAt: string;
}

export interface Health {
  provider: string;
  models: { chat: string; embedding: string };
  dependencies: Record<string, boolean>;
  synthetic: boolean;
}

export interface Evidence {
  id: string;
  title: string;
  content: string;
  score: number;
}

export interface Ticket {
  id: string;
  title: string;
  incidentId: string;
  status: string;
  approvedBy: string | null;
}

export interface AuditEntry {
  eventName: string;
  at: string;
  payload: unknown;
}

export interface Run {
  id: string;
  mode: string;
  traceId: string;
  traceUrl?: string;
  durationMs: number;
  warnings: string[];
  evidence: Evidence[];
  events: { tool: string; arguments: Record<string, unknown>; durationMs: number; status: string }[];
  findings: {
    summary: string;
    hypothesis: string;
    steps: { text: string; citations: string[] }[];
    uncertainties: string[];
  };
  ticket: { id: string; status: string } | null;
}

export interface SearchResult {
  mode: string;
  warning?: string | null;
  evidence: Evidence[];
}

export interface Handover {
  mode: string;
  summary: string;
  incidentIds: string[];
  facts: unknown;
}
