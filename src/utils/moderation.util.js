/** Maksymalny timeout Discord (28 dni) w milisekundach */
export const MAX_TIMEOUT_MS = 28 * 24 * 60 * 60 * 1000

/** 7 dni wiadomości przy banie (sekundy, limit API) */
export const MAX_DELETE_MESSAGE_SECONDS = 7 * 24 * 60 * 60

/**
 * @param {import('discord.js').GuildMember | null} executor
 * @param {import('discord.js').GuildMember} target
 */
export function assertNotSelf(executor, target) {
    if (executor && target.id === executor.id) {
        throw new Error('Nie możesz użyć tej komendy na sobie.')
    }
}
