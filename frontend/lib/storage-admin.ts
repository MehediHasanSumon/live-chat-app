export type StoragePolicy = {
  id: number;
  global_cap_bytes: number;
  auto_cleanup_enabled: boolean;
  large_file_threshold_bytes: number;
  large_file_rule_enabled: boolean;
  large_file_delete_after_days: number;
  small_file_threshold_bytes: number;
  small_file_rule_enabled: boolean;
  small_file_delete_after_days: number;
  cleanup_behavior: "delete_binary_keep_message";
  updated_by: number | null;
  updated_at: string | null;
};

export type StorageUsage = {
  id: number;
  live_object_count: number;
  live_bytes: number;
  deleted_bytes_total: number;
  updated_at: string | null;
};

export type StorageObjectAdminItem = {
  id: number;
  object_uuid: string;
  owner_user_id: number | null;
  purpose: "message_attachment" | "user_avatar" | "group_avatar";
  media_kind: "image" | "video" | "audio" | "voice" | "file" | "gif";
  storage_driver: "local";
  original_name: string;
  mime_type: string;
  file_ext: string | null;
  size_bytes: number;
  checksum_sha256: string | null;
  width: number | null;
  height: number | null;
  duration_ms: number | null;
  waveform_json: number[] | null;
  thumbnail_path: string | null;
  preview_blurhash: string | null;
  virus_scan_status: "pending" | "clean" | "infected" | "failed";
  transcode_status: "pending" | "processing" | "ready" | "failed";
  ref_count: number;
  first_attached_at: string | null;
  last_attached_at: string | null;
  retention_mode: "default" | "exempt";
  delete_eligible_at: string | null;
  deleted_at: string | null;
  deleted_reason: string | null;
  is_expired: boolean;
  placeholder_text: string | null;
  display_name: string;
  download_url: string | null;
  created_at: string;
  updated_at: string;
};

export type StorageCleanupRun = {
  id: number;
  rule_key: "large_after_7d" | "small_after_30d" | "manual";
  dry_run: boolean;
  status: "running" | "completed" | "failed";
  objects_scanned: number;
  objects_deleted: number;
  bytes_freed: number;
  initiated_by: number | null;
  started_at: string;
  finished_at: string | null;
  notes: string | null;
};

export type StorageCleanupPreview = {
  rule_key: "large_after_7d" | "small_after_30d";
  objects_scanned: number;
  bytes_freed: number;
  objects: StorageObjectAdminItem[];
};
