export interface ModelEntry {
  id: string;
  filename: string;
  format: string;
  sizeBytes: number;
  sizeMB: string;
  modified: string;
}

export interface ServerInfo {
  ip: string;
  port: number;
  url: string;
}
