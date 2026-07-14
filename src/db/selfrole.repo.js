import { getPool } from './client.js'

function poolOrThrow() {
    const p = getPool()
    if (!p) {
        throw new Error(
            'System self-role wymaga MySQL. Ustaw `DB_HOST` i pozostałe zmienne w `.env`.',
        )
    }
    return p
}

/**
 * @param {object} data
 */
export async function insertPanel(data) {
    const p = poolOrThrow()
    const [result] = await p.execute(
        `INSERT INTO selfrole_panels (guild_id, channel_id, message_id, title, intro, color, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
            data.guildId,
            data.channelId,
            data.messageId,
            data.title,
            data.intro ?? null,
            data.color ?? 5793266,
            data.createdAt ?? Date.now(),
        ],
    )
    return Number(result.insertId)
}

/**
 * @param {number} panelId
 */
export async function getPanelById(panelId) {
    const p = poolOrThrow()
    const [rows] = await p.execute(
        `SELECT id, guild_id, channel_id, message_id, title, intro, color, created_at
         FROM selfrole_panels WHERE id = ? LIMIT 1`,
        [panelId],
    )
    return rows[0] ?? null
}

/**
 * @param {string} messageId
 */
export async function getPanelByMessageId(messageId) {
    const p = poolOrThrow()
    const [rows] = await p.execute(
        `SELECT id, guild_id, channel_id, message_id, title, intro, color, created_at
         FROM selfrole_panels WHERE message_id = ? LIMIT 1`,
        [messageId],
    )
    return rows[0] ?? null
}

/**
 * @param {string} guildId
 */
export async function countPanelsByGuild(guildId) {
    const p = poolOrThrow()
    const [rows] = await p.execute(
        'SELECT COUNT(*) AS cnt FROM selfrole_panels WHERE guild_id = ?',
        [guildId],
    )
    return Number(rows[0]?.cnt ?? 0)
}

/**
 * @param {number} panelId
 */
export async function deletePanel(panelId) {
    const p = poolOrThrow()
    await p.execute('DELETE FROM selfrole_entries WHERE panel_id = ?', [panelId])
    await p.execute('DELETE FROM selfrole_panels WHERE id = ?', [panelId])
}

/**
 * @param {number} panelId
 */
export async function listEntriesByPanel(panelId) {
    const p = poolOrThrow()
    const [rows] = await p.execute(
        `SELECT id, panel_id, role_id, emoji_key, emoji_name, emoji_animated, sort_order
         FROM selfrole_entries WHERE panel_id = ? ORDER BY sort_order ASC, id ASC`,
        [panelId],
    )
    return rows
}

/**
 * @param {object} data
 */
export async function insertEntry(data) {
    const p = poolOrThrow()
    const [result] = await p.execute(
        `INSERT INTO selfrole_entries (panel_id, role_id, emoji_key, emoji_name, emoji_animated, sort_order)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
            data.panelId,
            data.roleId,
            data.emojiKey,
            data.emojiName ?? null,
            data.emojiAnimated ? 1 : 0,
            data.sortOrder ?? 0,
        ],
    )
    return Number(result.insertId)
}

/**
 * @param {number} entryId
 */
export async function getEntryById(entryId) {
    const p = poolOrThrow()
    const [rows] = await p.execute(
        `SELECT id, panel_id, role_id, emoji_key, emoji_name, emoji_animated, sort_order
         FROM selfrole_entries WHERE id = ? LIMIT 1`,
        [entryId],
    )
    return rows[0] ?? null
}

/**
 * @param {number} panelId
 * @param {string} roleId
 */
export async function deleteEntryByPanelAndRole(panelId, roleId) {
    const p = poolOrThrow()
    const [result] = await p.execute(
        'DELETE FROM selfrole_entries WHERE panel_id = ? AND role_id = ?',
        [panelId, roleId],
    )
    return result.affectedRows > 0
}

/**
 * @param {string} messageId
 * @param {import('discord.js').Emoji} emoji
 */
export async function findEntryByMessageAndEmoji(messageId, emoji) {
    const panel = await getPanelByMessageId(messageId)
    if (!panel) return null

    const entries = await listEntriesByPanel(panel.id)
    const match = entries.find((entry) => entryMatchesEmoji(entry, emoji))
    if (!match) return null

    return { panel, entry: match }
}

/**
 * @param {object} entry
 * @param {import('discord.js').Emoji} emoji
 */
export function entryMatchesEmoji(entry, emoji) {
    if (emoji.id) {
        return entry.emoji_key === emoji.id
    }
    return !entry.emoji_name && entry.emoji_key === emoji.name
}
