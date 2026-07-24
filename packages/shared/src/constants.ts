export const TDRIVE_STORAGE_CHANNEL = "TeleDrive Storage";

export const MAX_UPLOAD_BYTES = 1_073_741_824; // 1GB
export const MAX_ARCHIVE_BYTES = 2_147_483_648; // 2GB
export const MAX_EDITOR_BYTES = 5_242_880; // 5MB

export const EDITABLE_EXTENSIONS = new Set([
  "txt", "md", "json", "js", "jsx", "ts", "tsx", "css", "scss",
  "html", "htm", "xml", "yaml", "yml", "toml", "ini", "cfg",
  "py", "rb", "go", "rs", "java", "c", "cpp", "h", "hpp",
  "sh", "bash", "zsh", "fish", "sql", "csv", "log", "env",
  "gitignore", "dockerignore", "makefile", "dockerfile",
  "vue", "svelte", "astro", "php", "swift", "kt",
]);

export const DELETION_MAX_ATTEMPTS = 12;
export const DELETION_BACKOFF_BASE = 2; // seconds, 2^n
export const DELETION_BACKOFF_MAX = 3600; // 1 hour cap
export const DELETION_LEASE_TIMEOUT = 300; // 5 minutes stale lease
