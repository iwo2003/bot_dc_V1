import { RIOT_API_KEY } from '../../config.js'
import { fetchJson } from './http.util.js'
import { parseRiotId, resolveLolPlatform, resolveValorantShard } from './regions.util.js'

/**
 * @param {string} routing europe | americas | asia
 * @param {string} gameName
 * @param {string} tagLine
 */
async function getRiotAccount(routing, gameName, tagLine) {
    const url = `https://${routing}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`
    return fetchJson(url, {
        headers: { 'X-Riot-Token': RIOT_API_KEY },
    })
}

/**
 * @param {string} platform
 * @param {string} puuid
 */
async function getLolSummonerByPuuid(platform, puuid) {
    const url = `https://${platform}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`
    return fetchJson(url, {
        headers: { 'X-Riot-Token': RIOT_API_KEY },
    })
}

/**
 * @param {string} platform
 * @param {string} summonerId
 */
async function getLolLeagueEntries(platform, summonerId) {
    const url = `https://${platform}.api.riotgames.com/lol/league/v4/entries/by-summoner/${summonerId}`
    return fetchJson(url, {
        headers: { 'X-Riot-Token': RIOT_API_KEY },
    })
}

/**
 * @param {string} platform
 * @param {string} puuid
 */
async function getLolMasteryTop(platform, puuid) {
    const url = `https://${platform}.api.riotgames.com/lol/champion-mastery/v4/champion-masteries/by-puuid/${puuid}/top?count=1`
    return fetchJson(url, {
        headers: { 'X-Riot-Token': RIOT_API_KEY },
    })
}

function formatRanked(entries) {
    if (!Array.isArray(entries) || entries.length === 0) {
        return 'Brak danych ranked'
    }

    return entries
        .map((e) => {
            const wr =
                e.wins + e.losses > 0
                    ? Math.round((e.wins / (e.wins + e.losses)) * 100)
                    : 0
            return `**${e.queueType.replace('RANKED_', '')}** — ${e.tier} ${e.rank} (${e.leaguePoints} LP) · ${e.wins}W/${e.losses}L (${wr}%)`
        })
        .join('\n')
}

/**
 * @param {object} params
 * @param {string} params.player
 * @param {string} [params.region]
 * @param {string} [params.routing]
 */
export async function fetchLolStats({ player, region, routing = 'europe' }) {
    if (!RIOT_API_KEY) {
        throw new Error(
            'Brak `RIOT_API_KEY` w `.env`. Uzyskaj klucz na https://developer.riotgames.com/',
        )
    }

    const riotId = parseRiotId(player)
    if (!riotId) {
        throw new Error(
            'Podaj Riot ID w formacie **Nick#TAG** (np. `Faker#KR1`).',
        )
    }

    const platform = resolveLolPlatform(region ?? 'eune')

    const account = await getRiotAccount(
        routing,
        riotId.gameName,
        riotId.tagLine,
    )
    if (!account.ok) {
        if (account.status === 404) throw new Error('Nie znaleziono gracza LoL.')
        if (account.status === 403) {
            throw new Error('Nieprawidłowy lub wygasły klucz Riot API (403).')
        }
        throw new Error(`Riot API błąd (${account.status}).`)
    }

    const puuid = account.data.puuid
    const summoner = await getLolSummonerByPuuid(platform, puuid)
    if (!summoner.ok) {
        throw new Error(
            `Nie znaleziono summoner na regionie **${region ?? 'eune'}**. Spróbuj innego regionu.`,
        )
    }

    const [league, mastery] = await Promise.all([
        getLolLeagueEntries(platform, summoner.data.id),
        getLolMasteryTop(platform, puuid),
    ])

    const topMastery =
        mastery.ok && mastery.data?.[0]
            ? `Poziom ${mastery.data[0].championLevel} (pkt: ${mastery.data[0].championPoints})`
            : '—'

    const iconId = summoner.data.profileIconId
    const versionRes = await fetchJson(
        'https://ddragon.leagueoflegends.com/api/versions.json',
    )
    const patch = versionRes.ok && versionRes.data?.[0] ? versionRes.data[0] : '14.1.1'

    return {
        title: `League of Legends — ${riotId.gameName}#${riotId.tagLine}`,
        color: 0xc89b3c,
        thumbnail: `https://ddragon.leagueoflegends.com/cdn/${patch}/img/profileicon/${iconId}.png`,
        image: `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Ahri_0.jpg`,
        fields: [
            { name: 'Region', value: region ?? 'eune', inline: true },
            { name: 'Poziom', value: String(summoner.data.summonerLevel ?? '?'), inline: true },
            { name: 'Top mastery', value: topMastery, inline: true },
            { name: 'Ranking', value: formatRanked(league.data), inline: false },
        ],
    }
}

/**
 * @param {string} shard
 * @param {string} puuid
 */
async function getValorantMmr(shard, puuid) {
    const url = `https://${shard}.api.riotgames.com/val/ranked/v1/mmr/${puuid}`
    return fetchJson(url, {
        headers: { 'X-Riot-Token': RIOT_API_KEY },
    })
}

/**
 * @param {object} params
 * @param {string} params.player
 * @param {string} [params.region]
 * @param {string} [params.routing]
 */
export async function fetchValorantStats({ player, region, routing = 'europe' }) {
    if (!RIOT_API_KEY) {
        throw new Error(
            'Brak `RIOT_API_KEY` w `.env`. Uzyskaj klucz na https://developer.riotgames.com/',
        )
    }

    const riotId = parseRiotId(player)
    if (!riotId) {
        throw new Error('Podaj Riot ID w formacie **Nick#TAG** (np. `Player#EUW`).')
    }

    const shard = resolveValorantShard(region ?? 'eu')

    const account = await getRiotAccount(
        routing,
        riotId.gameName,
        riotId.tagLine,
    )
    if (!account.ok) {
        if (account.status === 404) throw new Error('Nie znaleziono gracza Valorant.')
        if (account.status === 403) {
            throw new Error('Nieprawidłowy lub wygasły klucz Riot API (403).')
        }
        throw new Error(`Riot API błąd (${account.status}).`)
    }

    const puuid = account.data.puuid
    const mmr = await getValorantMmr(shard, puuid)

    let rankText = 'Brak danych ranked (gracz mógł nie grać w tym akcie)'
    if (mmr.ok && mmr.data) {
        const latest = mmr.data.latestCompetitiveUpdate ?? mmr.data
        const tier = latest.tierAfterUpdate ?? latest.tier ?? mmr.data.currenttier
        const rr = latest.rankedRatingAfterUpdate ?? latest.rankedRating ?? mmr.data.ranking_in_tier
        if (tier != null) {
            rankText = `Tier **${tier}** · ${rr ?? '?'} RR`
        }
    }

    return {
        title: `Valorant — ${riotId.gameName}#${riotId.tagLine}`,
        color: 0xfd455e,
        thumbnail: `https://media.valorant-api.com/agents/950302ca-ec1-4c06-b1f5-8d3d6b0f9b3a/displayicon.png`,
        image: `https://media.valorant-api.com/maps/2bee0dc9-4ffe-519b-1cbd-7fbe763a6047/listviewicon.png`,
        fields: [
            { name: 'Region', value: shard, inline: true },
            { name: 'Riot ID', value: `${riotId.gameName}#${riotId.tagLine}`, inline: true },
            { name: 'Ranking', value: rankText, inline: false },
        ],
    }
}
