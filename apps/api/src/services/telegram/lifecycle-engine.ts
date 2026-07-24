/**
 * Telegram Storage Lifecycle Engine (Central Brain for TDrive)
 * Upload Planner, Chunk Planner, Queue Scheduler, Consistent Hashing & Account Router.
 */

export interface LifeCycleUploadParams {
  userId: string;
  fileSize: number;
  fileName: string;
  mimeType?: string;
  fileHash?: string;
}

export interface UploadPlan {
  chunkSize: number;
  totalChunks: number;
  selectedAccountId: string;
  targetChannel: string;
  targetTopicId?: string;
  isInstantUpload: boolean;
  priority: "Critical" | "High" | "Normal" | "Low";
}

/**
 * Adaptive Chunk Planner
 */
export function calculateAdaptiveChunkSize(fileSize: number): number {
  // < 10MB => 1MB chunks
  if (fileSize < 10 * 1024 * 1024) return 1024 * 1024; // 1 MB
  // < 100MB => 4MB chunks
  if (fileSize < 100 * 1024 * 1024) return 4 * 1024 * 1024; // 4 MB
  // < 1GB => 8MB chunks
  if (fileSize < 1024 * 1024 * 1024) return 8 * 1024 * 1024; // 8 MB
  // >= 1GB => 16MB chunks
  return 16 * 1024 * 1024; // 16 MB
}

/**
 * Consistent Hash Channel & Topic Selector
 */
export function getPlacementTarget(fileName: string, fileHash?: string): { channel: string; topicName: string } {
  const seed = fileHash || fileName;
  let hashNum = 0;
  for (let i = 0; i < seed.length; i++) {
    hashNum = (hashNum << 5) - hashNum + seed.charCodeAt(i);
    hashNum |= 0;
  }
  const absHash = Math.abs(hashNum);
  const channelIndex = (absHash % 3) + 1;
  const topicIndex = (absHash % 10) + 1;
  
  return {
    channel: `TeleDrive Storage ${channelIndex}`,
    topicName: `Topic Thread ${topicIndex}`,
  };
}

/**
 * Upload Planner & Strategy Evaluator
 */
export async function createUploadPlan(params: LifeCycleUploadParams): Promise<UploadPlan> {
  const chunkSize = calculateAdaptiveChunkSize(params.fileSize);
  const totalChunks = Math.max(1, Math.ceil(params.fileSize / chunkSize));
  const placement = getPlacementTarget(params.fileName, params.fileHash);

  let priority: "Critical" | "High" | "Normal" | "Low" = "Normal";
  if (params.fileSize > 500 * 1024 * 1024) {
    priority = "High";
  }

  return {
    chunkSize,
    totalChunks,
    selectedAccountId: "default-account",
    targetChannel: placement.channel,
    targetTopicId: placement.topicName,
    isInstantUpload: false,
    priority,
  };
}
