import { getPool } from './client.js'

/**
 * @returns {Promise<{ channel_id: string, guild_id: string, user_id: string, ticket_type: string, claimed_by: string | null, status: string, created_at: number } | null>}
 */
export async function getTicketByChannel(channelId) {
    const p = getPool()
    if (!p) throw new Error('Brak połączenia z MySQL — tickety wymagają bazy danych.')
    const [rows] = await p.execute(
        'SELECT channel_id, guild_id, user_id, ticket_type, claimed_by, status, created_at FROM tickets WHERE channel_id = ? LIMIT 1',
        [channelId],
    )
    return rows[0] ?? null
}

/**
 * @param {string} guildId
 * @param {string} userId
 */
export async function countOpenTicketsForUser(guildId, userId) {
    const p = getPool()
    if (!p) throw new Error('Brak połączenia z MySQL — tickety wymagają bazy danych.')
    const [rows] = await p.execute(
        `SELECT COUNT(*) AS cnt FROM tickets
         WHERE guild_id = ? AND user_id = ? AND status IN ('open', 'claimed')`,
        [guildId, userId],
    )
    return Number(rows[0]?.cnt ?? 0)
}

/**
 * @param {object} data
 */
export async function insertTicket(data) {
    const p = getPool()
    if (!p) throw new Error('Brak połączenia z MySQL — tickety wymagają bazy danych.')
    await p.execute(
        `INSERT INTO tickets (channel_id, guild_id, user_id, ticket_type, claimed_by, status, created_at)
         VALUES (?, ?, ?, ?, NULL, 'open', ?)`,
        [
            data.channelId,
            data.guildId,
            data.userId,
            data.ticketType,
            data.createdAt ?? Date.now(),
        ],
    )
}

/**
 * @param {string} channelId
 * @param {string} claimedBy
 */
export async function claimTicket(channelId, claimedBy) {
    const p = getPool()
    if (!p) throw new Error('Brak połączenia z MySQL — tickety wymagają bazy danych.')
    await p.execute(
        `UPDATE tickets SET claimed_by = ?, status = 'claimed' WHERE channel_id = ?`,
        [claimedBy, channelId],
    )
}

/**
 * @param {string} channelId
 */
export async function markTicketClosed(channelId) {
    const p = getPool()
    if (!p) throw new Error('Brak połączenia z MySQL — tickety wymagają bazy danych.')
    await p.execute(`UPDATE tickets SET status = 'closed' WHERE channel_id = ?`, [channelId])
}

/**
 * @param {string} channelId
 */
export async function deleteTicket(channelId) {
    const p = getPool()
    if (!p) throw new Error('Brak połączenia z MySQL — tickety wymagają bazy danych.')
    await p.execute('DELETE FROM tickets WHERE channel_id = ?', [channelId])
}
