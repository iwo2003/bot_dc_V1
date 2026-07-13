import { STEAM_API_KEY } from '../../config.js'
import { fetchJson } from './http.util.js'

const CS2_APP_ID = 730

/**
 * @param {string} input
 */
function normalizeSteamInput(input) {
    const trimmed = input.trim()
    if (/^\d{17}$/.test(trimmed)) return { steamId: trimmed }

    const urlMatch = trimmed.match(/steamcommunity\.com\/(?:profiles|id)\/([^/?]+)/i)
    if (urlMatch) {
        const part = urlMatch[1]
        if (/^\d{17}$/.test(part)) return { steamId: part }
        return { vanity: part }
    }

    return { vanity: trimmed }
}

/**
 * @param {string} vanity
 */
async function resolveVanity(vanity) {
    const url = `https://api.steampowered.com/ISteamUser/ResolveVanityURL/v0001/?key=${STEAM_API_KEY}&vanityurl=${encodeURIComponent(vanity)}`
    const res = await fetchJson(url)
    if (!res.ok || res.data?.response?.success !== 1) return null
    return res.data.response.steamid
}

/**
 * @param {string} steamId
 */
async function getPlayerSummary(steamId) {
    const url = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${STEAM_API_KEY}&steamids=${steamId}`
    return fetchJson(url)
}

/**
 * @param {string} steamId
 */
async function getCs2Stats(steamId) {
    const url = `https://api.steampowered.com/ISteamUserStats/GetUserStatsForGame/v0002/?appid=${CS2_APP_ID}&key=${STEAM_API_KEY}&steamid=${steamId}`
    return fetchJson(url)
}

/**
 * @param {object[]} stats
 * @param {string} name
 */
function statValue(stats, name) {
    const s = stats?.find((x) => x.name === name)
    return s?.value ?? null
}

/**
 * @param {object} params
 * @param {string} params.player
 */
export async function fetchCs2Stats({ player }) {
    if (!STEAM_API_KEY) {
        throw new Error(
            'Brak `STEAM_API_KEY` w `.env`. Klucz: https://steamcommunity.com/dev/apikey',
        )
    }

    const parsed = normalizeSteamInput(player)
    let steamId = parsed.steamId

    if (!steamId && parsed.vanity) {
        steamId = await resolveVanity(parsed.vanity)
        if (!steamId) {
            throw new Error('Nie znaleziono profilu Steam dla podanej nazwy/URL.')
        }
    }

    const [summary, stats] = await Promise.all([
        getPlayerSummary(steamId),
        getCs2Stats(steamId),
    ])

    const profile = summary.ok ? summary.data?.response?.players?.[0] : null
    if (!profile) {
        throw new Error('Nie znaleziono profilu Steam.')
    }

    const gameStats = stats.ok ? stats.data?.playerstats?.stats : null
    const kills = statValue(gameStats, 'total_kills')
    const deaths = statValue(gameStats, 'total_deaths')
    const wins = statValue(gameStats, 'total_wins')
    const matches = statValue(gameStats, 'total_matches_played')
    const hs = statValue(gameStats, 'total_kills_headshot')

    const kd =
        kills != null && deaths != null && deaths > 0
            ? (kills / deaths).toFixed(2)
            : '—'
    const hsPercent =
        kills != null && hs != null && kills > 0
            ? `${Math.round((hs / kills) * 100)}%`
            : '—'

    const statsPrivate = stats.data?.playerstats?.stats === undefined && !stats.ok

    return {
        title: `Counter-Strike 2 — ${profile.personaname}`,
        color: 0xf79e1b,
        thumbnail: profile.avatarfull || profile.avatarmedium,
        image: profile.avatarfull || undefined,
        fields: [
            { name: 'Steam ID', value: steamId, inline: true },
            { name: 'Status', value: profile.personastate === 1 ? 'Online' : 'Offline', inline: true },
            {
                name: 'Statystyki CS2',
                value: statsPrivate
                    ? 'Profil prywatny lub brak danych CS2 w Steam API.'
                    : [
                          `Zabójstwa: **${kills ?? '—'}**`,
                          `Śmierci: **${deaths ?? '—'}**`,
                          `K/D: **${kd}**`,
                          `Headshot: **${hsPercent}**`,
                          `Wygrane: **${wins ?? '—'}** / Mecze: **${matches ?? '—'}**`,
                      ].join('\n'),
                inline: false,
            },
            {
                name: 'Profil',
                value: `[Steam Community](https://steamcommunity.com/profiles/${steamId})`,
                inline: false,
            },
        ],
    }
}
