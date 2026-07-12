import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { consola } from 'consola'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const localPath = path.join(__dirname, 'moderation.js')
const examplePath = path.join(__dirname, 'moderation.example.js')

/** @type {import('./moderation.example.js').default | null} */
let cached = null

export async function getModerationConfig() {
    if (cached) return cached

    const target = fs.existsSync(localPath) ? localPath : examplePath

    if (!fs.existsSync(localPath)) {
        consola.warn(
            '[moderation] Brak src/config/moderation.js — używam moderation.example.js. Skopiuj szablon i uzupełnij ID.',
        )
    }

    cached = (await import(`file://${target}`)).default
    return cached
}
