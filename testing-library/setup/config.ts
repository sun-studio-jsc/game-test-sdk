export interface Config {
    gameUrl: string
    mode: 'launch' | 'connect'
    cdpUrl: string
    gameServer: string
    commandTimeout: number
    pollInterval: number
}

export function defineConfig(config: Config): Config {
    return config
}
