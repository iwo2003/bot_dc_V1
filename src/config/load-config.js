import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { consola } from 'consola'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('./moderation.example.js').default | null} */
let moderationCached = null

/** @type {import('./auto-channel.example.js').default | null} */
let autoChannelCached = null

/** @type {import('./anti-raid.example.js').default | null} */
let antiRaidCached = null

/** @type {import('./games.example.js').default | null} */
let gamesCached = null

/**
 * @param {string} localFile
 * @param {string} exampleFile
 * @param {string} logTag
 * @param {string} warnMessage
 */
async function loadLocalConfig(localFile, exampleFile, logTag, warnMessage) {
    const localPath = path.join(__dirname, localFile)
    const examplePath = path.join(__dirname, exampleFile)

    if (!fs.existsSync(localPath) && !fs.existsSync(examplePath)) {
        consola.error(
            `[${logTag}] Brak ${localFile} i ${exampleFile} w src/config/.`,
        )
        throw new Error(`Brak pliku konfiguracji: ${exampleFile}`)
    }

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

export async function getAntiRaidConfig() {
    if (antiRaidCached) return antiRaidCached

    antiRaidCached = await loadLocalConfig(
        'anti-raid.js',
        'anti-raid.example.js',
        'anti-raid',
        'Brak src/config/anti-raid.js — używam anti-raid.example.js. Skopiuj szablon i uzupełnij.',
    )
    return antiRaidCached
}

export async function getGamesConfig() {
    if (gamesCached) return gamesCached

    gamesCached = await loadLocalConfig(
        'games.js',
        'games.example.js',
        'games',
        'Brak src/config/games.js — używam games.example.js. Skopiuj szablon i uzupełnij.',
    )
    return gamesCached
}

/** @type {object | null} */
let ticketsCached = null

/**
 * Ładuje tickets.json lub tickets.example.json (format JSON).
 */
export async function getTicketsConfig() {
    if (ticketsCached) return ticketsCached

    const localPath = path.join(__dirname, 'tickets.json')
    const examplePath = path.join(__dirname, 'tickets.example.json')

    if (!fs.existsSync(localPath) && !fs.existsSync(examplePath)) {
        throw new Error('Brak tickets.json i tickets.example.json w src/config/.')
    }

    const target = fs.existsSync(localPath) ? localPath : examplePath

    if (!fs.existsSync(localPath)) {
        consola.warn(
            '[tickets] Brak src/config/tickets.json — używam tickets.example.json. Skopiuj szablon i uzupełnij.',
        )
    }

    ticketsCached = JSON.parse(fs.readFileSync(target, 'utf8'))
    return ticketsCached
}

export function clearTicketsConfigCache() {
    ticketsCached = null
}

/** @type {object | null} */
let welcomeCached = null

export async function getWelcomeConfig() {
    if (welcomeCached) return welcomeCached

    const localPath = path.join(__dirname, 'welcome.json')
    const examplePath = path.join(__dirname, 'welcome.example.json')

    if (!fs.existsSync(localPath) && !fs.existsSync(examplePath)) {
        throw new Error('Brak welcome.json i welcome.example.json w src/config/.')
    }

    const target = fs.existsSync(localPath) ? localPath : examplePath

    if (!fs.existsSync(localPath)) {
        consola.warn(
            '[welcome] Brak src/config/welcome.json — używam welcome.example.json. Skopiuj szablon i uzupełnij.',
        )
    }

    welcomeCached = JSON.parse(fs.readFileSync(target, 'utf8'))
    return welcomeCached
}
