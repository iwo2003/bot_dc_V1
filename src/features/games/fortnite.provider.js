import { FORTNITE_API_KEY } from '../../config.js'
import { fetchJson } from './http.util.js'

/**
 * @param {object} params
 * @param {string} params.player
 */
export async function fetchFortniteStats({ player }) {
    const name = player.trim()
    if (!name) throw new Error('Podaj nazwę gracza Fortnite.')

    const headers = { Accept: 'application/json' }
    if (FORTNITE_API_KEY) {
        headers.Authorization = FORTNITE_API_KEY
    }

    const url = `https://fortnite-api.com/v2/stats/br/v2?name=${encodeURIComponent(name)}`
    const res = await fetchJson(url, { headers })

    if (!res.ok) {
        if (res.status === 403 || res.status === 401) {
            throw new Error(
                'Fortnite API wymaga klucza — ustaw `FORTNITE_API_KEY` w `.env` (https://fortnite-api.com/).',
            )
        }
        if (res.status === 404) {
            throw new Error('Nie znaleziono gracza Fortnite lub profil jest prywatny.')
        }
        throw new Error(`Fortnite API błąd (${res.status}).`)
    }

    const data = res.data?.data
    if (!data) {
        throw new Error('Brak danych statystyk Fortnite dla tego gracza.')
    }

    const account = data.account
    const stats = data.stats?.all?.overall ?? data.stats?.all?.solo ?? {}

    const wins = stats.wins ?? 0
    const kills = stats.kills ?? 0
    const matches = stats.matches ?? 0
    const kd = stats.kd ?? (matches > 0 ? (kills / Math.max(matches - wins, 1)).toFixed(2) : '—')
    const winRate = matches > 0 ? `${Math.round((wins / matches) * 100)}%` : '—'

    return {
        title: `Fortnite — ${account?.name ?? name}`,
        color: 0x9d4dbb,
        thumbnail: account?.avatar ?? undefined,
        image: account?.avatar ?? undefined,
        fields: [
            { name: 'Platforma', value: account?.platform ?? '—', inline: true },
            { name: 'Wygrane', value: String(wins), inline: true },
            { name: 'Win rate', value: winRate, inline: true },
            { name: 'Zabójstwa', value: String(kills), inline: true },
            { name: 'Mecze', value: String(matches), inline: true },
            { name: 'K/D', value: String(kd), inline: true },
        ],
    }
}
