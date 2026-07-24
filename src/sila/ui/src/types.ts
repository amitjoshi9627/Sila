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
}