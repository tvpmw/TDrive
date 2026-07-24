export const queryKeys = {
  all: ["tdrive"] as const,
  files: (parentId: string | null) => [...queryKeys.all, "files", parentId] as const,
  file: (id: string) => [...queryKeys.all, "file", id] as const,
  trash: () => [...queryKeys.all, "trash"] as const,
  deletionJobs: () => [...queryKeys.all, "deletion-jobs"] as const,
  serverFiles: (path?: string) => [...queryKeys.all, "server-files", path] as const,
  storageStatus: () => [...queryKeys.all, "storage-status"] as const,
  me: () => [...queryKeys.all, "me"] as const,
  registrationSettings: () => [...queryKeys.all, "registration-settings"] as const,
  folderPath: (id: string) => [...queryKeys.all, "folder-path", id] as const,
  storageUsage: () => [...queryKeys.all, "storage-usage"] as const,
};
