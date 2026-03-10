import { describe, it, beforeAll, afterAll } from 'vitest'
import { game } from '../sdk'
import { press, waitFor, assert, waitForScene, sleep, find } from '../sdk'

describe('Settings Screen Flow', () => {
    beforeAll(async () => {
        await game.connect()
    })

    afterAll(async () => {
        await game.disconnect()
    })

    it('should open settings screen', async () => {
        await press(game, 'GP_SETTING')

        await waitFor(game, { id: 'SETTING_CLOSE' })

        await assert(game, { id: 'SETTING_MUSIC' }, { state: 'visible' })
        await assert(game, { id: 'SETTING_SOUND' }, { state: 'visible' })
        await assert(game, { id: 'SETTING_CLOSE' }, { state: 'visible' })
    })

    it('should execute secret unlock sequence', async () => {
        if (
            (await find(game, { id: 'music_icon' }))?.texture ===
            'default-resources/setting-screen/icn_music_on'
        ) {
            await press(game, 'SETTING_MUSIC', 40)
            await sleep(50)
        }
        if (
            (await find(game, { id: 'sound_icon' }))?.texture ===
            'default-resources/setting-screen/icn_sound_on'
        ) {
            await press(game, 'SETTING_SOUND', 40)
            await sleep(50)
        }

        const sequence = '121213214231'

        for (const digit of sequence) {
            if (digit === '1' || digit === '2') {
                await press(game, 'SETTING_MUSIC', 40)
                await sleep(50)
            } else if (digit === '3' || digit === '4') {
                await press(game, 'SETTING_SOUND', 40)
                await sleep(50)
            }
        }
    })

    it('should unlock devtools', async () => {
        await waitForScene(game, 'DEVTOOLS_OVERLAY_SCENE')

        await press(game, 'SETTING_HOME')
        await waitFor(game, { id: 'CLASSIC_BUTTON' })
        await sleep(500)

        await press(game, 'CLASSIC_BUTTON')
        await waitFor(game, { id: 'GP_SETTING' })
    })
})
