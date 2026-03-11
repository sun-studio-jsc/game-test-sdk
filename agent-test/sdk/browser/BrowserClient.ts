import {
    chromium,
    Locator,
    type Browser,
    type BrowserContext,
    type Dialog,
    type Page,
} from 'playwright'

const DEFAULT_TIMEOUT = 10_000

export interface BrowserClientConfig {
    gameUrl: string
    headless?: boolean
    timeout?: number
    mode?: 'launch' | 'connect'
    cdpUrl?: string
}

export interface WaitElementOptions {
    state?: 'visible' | 'hidden' | 'attached' | 'detached'
    timeout?: number
}

export class BrowserClient {
    private readonly config: BrowserClientConfig
    private readonly timeout: number
    private internalBrowser: Browser | null = null
    private internalContext: BrowserContext | null = null
    private internalPage: Page | null = null

    constructor(config: BrowserClientConfig) {
        this.config = config
        this.timeout = config.timeout ?? DEFAULT_TIMEOUT
    }

    private connect() {
        if (this.config.mode === 'connect') {
            return this.connectOverCDP()
        } else {
            return this.launchBrowser()
        }
    }

    async disconnect() {
        await this.internalBrowser?.close()
        this.internalBrowser = null
        this.internalContext = null
        this.internalPage = null
    }

    private async connectOverCDP() {
        const cdpUrl = this.config.cdpUrl ?? 'http://localhost:9222'
        this.internalBrowser = await chromium.connectOverCDP(cdpUrl)
        const contexts = this.internalBrowser.contexts()
        this.internalContext = contexts[0] ?? (await this.internalBrowser.newContext())
        const pages = this.internalContext.pages()
        this.internalPage = pages[0] ?? (await this.internalContext.newPage())
    }

    private async launchBrowser() {
        const headless = this.config.headless ?? false
        this.internalBrowser = await chromium.launch({ headless })
        this.internalContext = await this.internalBrowser.newContext()
        this.internalPage = await this.internalContext.newPage()
        await this.internalPage.goto(this.config.gameUrl, { waitUntil: 'networkidle' })
    }

    private get page(): Page {
        if (!this.internalPage)
            throw new Error('BrowserClient is not connected. Call connect() first.')
        return this.internalPage
    }

    private get context(): BrowserContext {
        if (!this.internalContext)
            throw new Error('BrowserClient is not connected. Call connect() first.')
        return this.internalContext
    }

    public navigate(url: string) {
        return this.page.goto(url, { waitUntil: 'networkidle', timeout: this.timeout })
    }

    public reload() {
        return this.page.reload({ waitUntil: 'networkidle', timeout: this.timeout })
    }

    public async openTab(url?: string) {
        const newPage = await this.context.newPage()
        if (url) await newPage.goto(url, { waitUntil: 'networkidle', timeout: this.timeout })
        const tab = new BrowserClient({ ...this.config })
        tab.internalBrowser = this.internalBrowser
        tab.internalContext = this.internalContext
        tab.internalPage = newPage
        return tab
    }

    public closeTab() {
        return this.page.close()
    }

    public pressElement(selector: string) {
        return this.page.click(selector, { timeout: this.timeout })
    }

    public typeIn(selector: string, text: string) {
        return this.page.fill(selector, text, { timeout: this.timeout })
    }

    public async isElementVisible(selector: string) {
        try {
            const locator = this.page.locator(selector)
            const count = await locator.count()
            if (count === 0) return false
            return locator.first().isVisible()
        } catch {
            return false
        }
    }

    public waitForElement(selector: string, opts?: WaitElementOptions) {
        const state = opts?.state ?? 'visible'
        const timeout = opts?.timeout ?? this.timeout
        return this.page.waitForSelector(selector, { state, timeout })
    }

    public assertElement(selector: string, opts?: Pick<WaitElementOptions, 'state'>) {
        const state = opts?.state ?? 'visible'
        const locator = this.page.locator(selector)

        if (state === 'visible') {
            return this.assertElementVisible(selector, locator)
        }

        return this.assertElementHidden(selector, locator)
    }

    private async assertElementVisible(selector: string, locator: Locator) {
        const count = await locator.count()
        if (count === 0) {
            throw new Error(`Expected element "${selector}" to be visible but it was not found`)
        }

        const isVisible = await locator.first().isVisible()
        if (!isVisible) {
            throw new Error(`Expected element "${selector}" to be visible but it is hidden`)
        }
    }

    private async assertElementHidden(selector: string, locator: Locator) {
        const count = await locator.count()
        if (count === 0) return

        const isVisible = await locator.first().isVisible()
        if (isVisible) {
            throw new Error(`Expected element "${selector}" to be hidden but it is visible`)
        }
    }

    public onDialog(handler: (dialog: Dialog) => Promise<void>) {
        return this.page.on('dialog', handler)
    }

    public screenshot(path?: string) {
        return this.page.screenshot({ path, type: 'png' })
    }

    getPage(): Page {
        return this.page
    }
}
