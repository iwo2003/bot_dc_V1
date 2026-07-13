import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { consola } from 'consola'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const localPath = path.join(__dirname, 'auto-channel.js')
const examplePath = path.join(__dirname, 'auto-channel.example.js')

/** @type {import('./auto-channel.example.js').default | null} */
let cached = null

export async function getAutoChannelConfig() {
    if (cached) return cached

    const target = fs.existsSync(localPath) ? localPath : examplePath

    if (!fs.existsSync(localPath)) {
        consola.warn(
            '[auto-channel] Brak src/config/auto-channel.js — używam auto-channel.example.js. Skopiuj szablon i uzupełnij ID.',
        )
    }

    cached = (await import(`file://${target}`)).default
    return cached
}
