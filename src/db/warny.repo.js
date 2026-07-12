import { getPool } from './client.js'

/**
 * @returns {Promise<{ warn_count: number, last_warn_at: number }>}
 */
export async function getWarnState(guildId, userId) {
    const p = getPool()
    if (!p) return { warn_count: 0, last_warn_at: 0 }
    const [rows] = await p.execute(
        'SELECT warn_count, last_warn_at FROM guild_warns WHERE guild_id = ? AND user_id = ? LIMIT 1',
        [guildId, userId],
    )
    const r = rows[0]
    if (!r) return { warn_count: 0, last_warn_at: 0 }
    return {
        warn_count: Number(r.warn_count) || 0,
        last_warn_at: Number(r.last_warn_at) || 0,
    }
}

export async function deleteWarnState(guildId, userId) {
    const p = getPool()
    if (!p) throw new Error('Brak połączenia z MySQL')
    await p.execute(
        'DELETE FROM guild_warns WHERE guild_id = ? AND user_id = ?',
        [guildId, userId],
    )
}

/**
 * @returns {Promise<number>} nowa liczba warnów
 */
export async function decrementWarnState(guildId, userId, amount) {
    const state = await getWarnState(guildId, userId)
    const newCount = Math.max(0, state.warn_count - amount)

    if (newCount === 0) {
        await deleteWarnState(guildId, userId)
        return 0
    }

    await setWarnState(guildId, userId, newCount, state.last_warn_at)
    return newCount
}

export async function setWarnState(guildId, userId, warnCount, lastWarnAtMs) {
    const p = getPool()
    if (!p) throw new Error('Brak połączenia z MySQL')
    await p.execute(
        `INSERT INTO guild_warns (guild_id, user_id, warn_count, last_warn_at)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE warn_count = VALUES(warn_count), last_warn_at = VALUES(last_warn_at)`,
        [guildId, userId, warnCount, lastWarnAtMs],
    )
}

export async function upsertTempBan(guildId, userId, unbanAtMs) {
    const p = getPool()
    if (!p) throw new Error('Brak połączenia z MySQL')
    await p.execute(
        `INSERT INTO warn_temp_bans (guild_id, user_id, unban_at)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE unban_at = VALUES(unban_at)`,
        [guildId, userId, unbanAtMs],
    )
}

export async function deleteTempBan(guildId, userId) {
    const p = getPool()
    if (!p) return
    await p.execute(
        'DELETE FROM warn_temp_bans WHERE guild_id = ? AND user_id = ?',
        [guildId, userId],
    )
}

export async function setWarnMuteActive(guildId, userId) {
    const p = getPool()
    if (!p) throw new Error('Brak połączenia z MySQL')
    await p.execute(
        `INSERT INTO warn_active_mutes (guild_id, user_id)
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE guild_id = VALUES(guild_id)`,
        [guildId, userId],
    )
}

export async function deleteWarnMuteActive(guildId, userId) {
    const p = getPool()
    if (!p) return
    await p.execute(
        'DELETE FROM warn_active_mutes WHERE guild_id = ? AND user_id = ?',
        [guildId, userId],
    )
}

export async function hasWarnMuteActive(guildId, userId) {
    const p = getPool()
    if (!p) return false
    const [rows] = await p.execute(
        'SELECT 1 FROM warn_active_mutes WHERE guild_id = ? AND user_id = ? LIMIT 1',
        [guildId, userId],
    )
    return rows.length > 0
}

/** @returns {Promise<{ guild_id: string, user_id: string, unban_at: number }[]>} */
export async function listDueTempBans(nowMs) {
    const p = getPool()
    if (!p) return []
    const [rows] = await p.execute(
        'SELECT guild_id, user_id, unban_at FROM warn_temp_bans WHERE unban_at <= ?',
        [nowMs],
    )
    return rows.map((r) => ({
        guild_id: String(r.guild_id),
        user_id: String(r.user_id),
        unban_at: Number(r.unban_at),
    }))
}
