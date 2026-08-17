import type { ParentMedia, SearchResponse, TelemetryPayload } from "../types";

const API_BASE = "http://localhost:8000/api";

export async function fetchMedia(limit = 100): Promise<{ items: ParentMedia[]; isMock: boolean }> {
  try {
    const res = await fetch(`${API_BASE}/media?limit=${limit}`);
    if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
    const data = await res.json();
    return { items: Array.isArray(data) ? data : [], isMock: false };
  } catch (error) {
    console.error("Critical API Failure: Could not connect to Python backend.", error);
    return { items: [], isMock: false }; 
  }
}

export async function searchMedia(query: string): Promise<SearchResponse> {
  try {
    const res = await fetch(`${API_BASE}/search?query=${encodeURIComponent(query)}`);
    if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
    const data = await res.json();
    
    // server.py returns: { query, latency_ms, count, results }
    const items: ParentMedia[] = Array.isArray(data.results)
      ? data.results
      : Array.isArray(data)
      ? data
      : [];
    const latencyMs = typeof data.latency_ms === "number" ? data.latency_ms : 0;
    const count = typeof data.count === "number" ? data.count : items.length;

    return {
      query: data.query || query,
      latencyMs,
      count,
      items,
      isMock: false,
    };
  } catch (error) {
    console.error("Search API Failure.", error);
    return {
      query,
      latencyMs: 0,
      count: 0,
      items: [],
      isMock: false,
    };
  }
}

export async function fetchTelemetry(limit = 40): Promise<TelemetryPayload> {
  try {
    const res = await fetch(`${API_BASE}/telemetry?limit=${limit}`);
    if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
    const data = await res.json();
    return {
      recent: data.recent || [],
      stats: data.stats || {
        average_ms: 0,
        p95_ms: 0,
        min_ms: 0,
        max_ms: 0,
        total_queries: 0,
        by_operation: {},
      },
      friendly_names: data.friendly_names || {},
    };
  } catch (error) {
    console.error("Telemetry API Failure.", error);
    return {
      recent: [],
      stats: {
        average_ms: 0,
        p95_ms: 0,
        min_ms: 0,
        max_ms: 0,
        total_queries: 0,
        by_operation: {},
      },
      friendly_names: {},
    };
  }
}

export function imageUrlFor(capsuleId: string): string {
  return `${API_BASE}/proxy/${capsuleId}`;
}

export async function setParentJunkStatus(parentId: string, isJunk: number) {
  const res = await fetch(`${API_BASE}/parent/${parentId}/quality`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ is_junk: isJunk }),
  });
  if (!res.ok) throw new Error("Failed to update parent quality status");
  return res.json();
}

export async function exportAlbum(albumName: string, parentIds: string[]) {
  const res = await fetch(`${API_BASE}/export`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ album_name: albumName, parent_ids: parentIds }),
  });
  if (!res.ok) throw new Error("Export failed");
  return res.json();
}

export async function undoExport() {
  const res = await fetch(`${API_BASE}/undo`, { method: "POST" });
  if (!res.ok) throw new Error("Undo failed");
  return res.json();
}

export async function emptyTrash() {
  const res = await fetch(`${API_BASE}/junk/empty`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to empty trash");
  return res.json();
}
