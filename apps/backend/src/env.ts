export interface AppEnv {
  port: number;
  configFile: string;
  mock: boolean;
}

export function readEnv(): AppEnv {
  return {
    port: Number(process.env.PORT ?? 3100),
    configFile: process.env.CONFIG_FILE ?? './data/config.json',
    mock: process.env.MOCK === '1',
  };
}
