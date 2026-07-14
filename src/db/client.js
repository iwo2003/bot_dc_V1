import mysql from 'mysql2/promise'
import { consola } from 'consola'
import { DB_HOST, DB_NAME, DB_PASSWORD, DB_PORT, DB_USER } from '../config.js'

/** @type {import('mysql2/promise').Pool | null} */
let pool = null

async function ensureSchema(p) {
    await p.execute(`
        CREATE TABLE IF NOT EXISTS guild_warns (
            guild_id VARCHAR(32) NOT NULL,
            user_id VARCHAR(32) NOT NULL,
            warn_count TINYINT UNSIGNED NOT NULL DEFAULT 0,
            last_warn_at BIGINT NOT NULL DEFAULT 0,
            PRIMARY KEY (guild_id, user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)
    await p.execute(`
        CREATE TABLE IF NOT EXISTS warn_temp_bans (
            guild_id VARCHAR(32) NOT NULL,
            user_id VARCHAR(32) NOT NULL,
            unban_at BIGINT NOT NULL,
            PRIMARY KEY (guild_id, user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)
    await p.execute(`
        CREATE TABLE IF NOT EXISTS warn_active_mutes (
            guild_id VARCHAR(32) NOT NULL,
            user_id VARCHAR(32) NOT NULL,
            PRIMARY KEY (guild_id, user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)
    await p.execute(`
        CREATE TABLE IF NOT EXISTS tickets (
            channel_id VARCHAR(32) NOT NULL,
            guild_id VARCHAR(32) NOT NULL,
            user_id VARCHAR(32) NOT NULL,
            ticket_type VARCHAR(64) NOT NULL,
            claimed_by VARCHAR(32) NULL DEFAULT NULL,
            status ENUM('open', 'claimed', 'closed') NOT NULL DEFAULT 'open',
            created_at BIGINT NOT NULL,
            PRIMARY KEY (channel_id),
            INDEX idx_tickets_user (guild_id, user_id, status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)
    await p.execute(`
        CREATE TABLE IF NOT EXISTS selfrole_panels (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            guild_id VARCHAR(32) NOT NULL,
            channel_id VARCHAR(32) NOT NULL,
            message_id VARCHAR(32) NOT NULL,
            title VARCHAR(256) NOT NULL,
            intro TEXT NULL,
            color INT UNSIGNED NOT NULL DEFAULT 5793266,
            created_at BIGINT NOT NULL,
            PRIMARY KEY (id),
            UNIQUE KEY uq_selfrole_message (message_id),
            INDEX idx_selfrole_guild (guild_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)
    await p.execute(`
        CREATE TABLE IF NOT EXISTS selfrole_entries (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            panel_id INT UNSIGNED NOT NULL,
            role_id VARCHAR(32) NOT NULL,
            emoji_key VARCHAR(128) NOT NULL,
            emoji_name VARCHAR(64) NULL,
            emoji_animated TINYINT(1) NOT NULL DEFAULT 0,
            sort_order INT NOT NULL DEFAULT 0,
            PRIMARY KEY (id),
            UNIQUE KEY uq_selfrole_panel_role (panel_id, role_id),
            UNIQUE KEY uq_selfrole_panel_emoji (panel_id, emoji_key),
            INDEX idx_selfrole_panel (panel_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)
}

/**
 * Wywołaj po starcie bota.
 * Dane logowania: DB_HOST, DB_USER, DB_PASSWORD, DB_NAME (i opcjonalnie DB_PORT) w `.env`.
 */
export async function initDatabase() {
    if (!DB_HOST) {
        consola.warn(
            '[db] Brak DB_HOST w .env — bot działa bez MySQL (warny, tickety i self-role wymagają bazy).',
        )
        return
    }

    try {
        pool = mysql.createPool({
            host: DB_HOST,
            port: DB_PORT,
            user: DB_USER,
            password: DB_PASSWORD,
            database: DB_NAME,
            waitForConnections: true,
            connectionLimit: 8,
            enableKeepAlive: true,
            connectTimeout: 10_000,
        })

        await pool.query('SELECT 1')
        await ensureSchema(pool)
        consola.success(
            `[db] MySQL: połączenie OK (${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}).`,
        )
    } catch (e) {
        pool = null
        const msg = String(e?.message ?? e)
        consola.error('[db] MySQL — błąd połączenia:', msg)

        if (msg.includes('Unknown database')) {
            consola.info(
                `[db] Utwórz bazę na serwerze MySQL, np.: CREATE DATABASE \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,
            )
        }
    }
}

/** @returns {import('mysql2/promise').Pool | null} */
export function getPool() {
    return pool
}
