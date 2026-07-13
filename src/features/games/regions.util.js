/** LoL platform → host */
export const LOL_PLATFORMS = {
    br: 'br1',
    eune: 'eun1',
    euw: 'euw1',
    jp: 'jp1',
    kr: 'kr',
    lan: 'la1',
    las: 'la2',
    na: 'na1',
    oce: 'oc1',
    tr: 'tr1',
    ru: 'ru',
    ph: 'ph2',
    sg: 'sg2',
    th: 'th2',
    tw: 'tw2',
    vn: 'vn2',
}

/** Valorant shard */
export const VAL_SHARDS = ['eu', 'na', 'ap', 'kr', 'latam', 'br']

/**
 * @param {string} region
 */
export function resolveLolPlatform(region) {
    const key = region?.toLowerCase().trim() || 'eune'
    return LOL_PLATFORMS[key] ?? key
}

/**
 * @param {string} region
 */
export function resolveValorantShard(region) {
    const key = region?.toLowerCase().trim() || 'eu'
    return VAL_SHARDS.includes(key) ? key : 'eu'
}

/**
 * @param {string} player
 */
export function parseRiotId(player) {
    const trimmed = player.trim()
    const hash = trimmed.lastIndexOf('#')
    if (hash <= 0 || hash === trimmed.length - 1) return null
    return {
        gameName: trimmed.slice(0, hash).trim(),
        tagLine: trimmed.slice(hash + 1).trim(),
    }
}
