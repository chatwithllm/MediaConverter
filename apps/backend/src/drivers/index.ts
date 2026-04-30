export interface ValidateResult {
  ok: boolean;
  error?: string;
  details?: Record<string, unknown>;
}

export interface ListEntry {
  name: string;
  isDirectory: boolean;
}

export interface SourceDriver<TConfig> {
  validate(config: TConfig): Promise<ValidateResult>;
  list(config: TConfig, subPath: string): Promise<ListEntry[]>;
}
