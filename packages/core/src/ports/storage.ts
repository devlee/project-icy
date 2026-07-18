/**
 * StorageAdapter abstracts where binary content lives.
 * Local impl: filesystem under content/. Cloud impl (phase 4): S3/R2 + CDN.
 * All paths are relative keys like "raw/2026-07/pair-abc/anime.png".
 */
export interface StorageAdapter {
  /** Write bytes to a key, creating parent dirs/prefixes as needed. */
  put(key: string, data: Buffer): Promise<void>;
  get(key: string): Promise<Buffer>;
  exists(key: string): Promise<boolean>;
  delete(key: string): Promise<void>;
  /** List keys under a prefix. */
  list(prefix: string): Promise<string[]>;
  /**
   * A URL the UI can load the object from.
   * Local impl returns a studio-served route; cloud impl returns a signed CDN URL.
   */
  publicUrl(key: string): string;
  /** Absolute filesystem path if the backend is file-based, else null. */
  localPath(key: string): string | null;
}
