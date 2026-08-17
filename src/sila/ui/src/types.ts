export interface CognitiveTags {
  scene_description?: string;
  lighting?: string;
  keywords?: string[];
}

export interface Capsule {
  capsule_id: string;
  timestamp: number;
  blur_score: number;
  is_junk: number;
  score: number | null;
  cognitive?: CognitiveTags;
}

export interface ParentMedia {
  parent_id: string;
  filepath: string;
  filename: string;
  media_type: "video" | "photo";
  file_size: number;
  created_at: number;
  capsules: Capsule[];
  max_score?: number;
}

export interface SearchResponse {
  query: string;
  latencyMs: number;
  count: number;
  items: ParentMedia[];
  isMock: boolean;
}

export interface TelemetryRecord {
  id?: number;
  operation_name: string;
  duration_ms: number;
  timestamp: number;
}

export interface OperationStat {
  avg_ms: number;
  count: number;
  min_ms: number;
  max_ms: number;
}

export interface TelemetryStats {
  average_ms: number;
  p95_ms: number;
  min_ms: number;
  max_ms: number;
  total_queries: number;
  by_operation: Record<string, OperationStat>;
}

export interface TelemetryPayload {
  recent: TelemetryRecord[];
  stats: TelemetryStats;
  friendly_names: Record<string, string>;
}

export interface ActiveSearchTelemetry {
  query: string;
  latencyMs: number;
  count: number;
  timestamp: number;
  isSearching: boolean;
  elapsedMs?: number;
}