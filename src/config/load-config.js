import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { consola } from 'consola'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('./moderation.example.js').default | null} */
let moderationCached = null

/** @type {import('./auto-channel.example.js').default | null} */
let autoChannelCached = null

/**
 * @param {string} localFile
 * @param {string} exampleFile
 * @param {string} logTag
 * @param {string} warnMessage
 */
async function loadLocalConfig(localFile, exampleFile, logTag, warnMessage) {
    const localPath = path.join(__dirname, localFile)
    const examplePath = path.join(__dirname, exampleFile)
    const target = fs.existsSync(localPath) ? localPath : examplePath

    if (!fs.existsSync(localPath)) {
        consola.warn(`[${logTag}] ${warnMessage}`)
    }

    return (await import(`file://${target}`)).default
}

export async function getModerationConfig() {
    if (moderationCached) return moderationCached

    moderationCached = await loadLocalConfig(
        'moderation.js',
        'moderation.example.js',
        'moderation',
        'Brak src/config/moderation.js — używam moderation.example.js. Skopiuj szablon i uzupełnij ID.',
    )
    return moderationCached
}

export async function getAutoChannelConfig() {
    if (autoChannelCached) return autoChannelCached

    autoChannelCached = await loadLocalConfig(
        'auto-channel.js',
        'auto-channel.example.js',
        'auto-channel',
        'Brak src/config/auto-channel.js — używam auto-channel.example.js. Skopiuj szablon i uzupełnij ID.',
    )
    return autoChannelCached
}
