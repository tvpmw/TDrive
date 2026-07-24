export type FileKind = "file" | "folder";

export type StorageProvider = "telegram-private-channel" | "telegram-supergroup-topic";

export type SyncStatus =
  | "local"
  | "synced"
  | "syncing"
  | "sync_failed"
  | "waiting_for_telegram_session"
  | "pending_upload";

export type DeletionJobStatus = "pending" | "processing" | "failed" | "completed";

export interface StorageRef {
  provider: StorageProvider;
  remoteId: string | null;
  channelName: string;
  topicId?: string | null;
}

export interface DriveItem {
  id: string;
  userId: string;
  kind: FileKind;
  name: string;
  parentId: string | null;
  size: number;
  mimeType: string | null;
  createdAt: string;
  updatedAt: string;
  storage: StorageRef;
  syncStatus: SyncStatus;
  syncError: string | null;
  deletedAt: string | null;
  shareToken?: string | null;
  shareExpiresAt?: string | null;
  hasSharePassword?: boolean;
  downloadCount?: number;
  isEncrypted?: number;
  maxDownloads?: number | null;
  fileHash?: string | null;
  extractedText?: string | null;
  isStarred?: number;
  tags?: string | null;
  collections?: string | null;
  uploaderEmail?: string | null;
}

export interface StorageStatus {
  configured: boolean;
  provider: StorageProvider;
  channelName: string;
}

export interface CreateFolderRequest {
  name: string;
  parentId?: string | null;
}

export interface CreateFileRequest {
  name: string;
  parentId?: string | null;
  size: number;
  mimeType?: string | null;
}

export interface UpdateDriveItemRequest {
  name?: string;
  parentId?: string | null;
}

export interface DownloadZipRequest {
  itemIds: string[];
}

export interface TextFileResponse {
  name: string;
  content: string;
  encoding: string;
  newline: string;
  revision: number;
}

export interface SaveTextFileRequest {
  content: string;
  encoding?: string;
  newline?: string;
  revision?: number;
}

export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
}

export interface DeletionJob {
  id: string;
  userId: string;
  remoteId: string;
  status: DeletionJobStatus;
  attempts: number;
  nextAttemptAt: string;
  lastError: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  email: string;
  isOperator: boolean;
  hasTelegramApiCredentials: boolean;
  hasTelegramSession: boolean;
  driveInitialized: boolean;
}
