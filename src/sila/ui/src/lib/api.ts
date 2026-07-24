import type { ParentMedia } from "../types";

const API_BASE = "http://localhost:8000/api";

export async function fetchMedia(limit = 100): Promise<{ items: ParentMedia[], isMock: boolean }> {
  try {
    const res = await fetch(`${API_BASE}/media?limit=${limit}`);
    if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
    const data = await res.json();
    return { items: data, isMock: false };
  } catch (error) {
    console.error("Critical API Failure: Could not connect to Python backend.", error);
    return { items: [], isMock: false }; 
  }
}

export async function searchMedia(query: string): Promise<{ items: ParentMedia[], isMock: boolean }> {
  try {
    const res = await fetch(`${API_BASE}/search?query=${encodeURIComponent(query)}`);
    if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
    const data = await res.json();
    return { items: data, isMock: false };
  } catch (error) {
    console.error("Search API Failure.", error);
    return { items: [], isMock: false };
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
