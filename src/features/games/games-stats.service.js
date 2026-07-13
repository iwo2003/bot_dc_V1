import { EmbedBuilder } from 'discord.js'
import { consola } from 'consola'
import { getGamesConfig } from '../../config/load-config.js'
import { fetchFortniteStats } from './fortnite.provider.js'
import { fetchMinecraftStats } from './minecraft.provider.js'
import { fetchLolStats, fetchValorantStats } from './riot.provider.js'
import { resolveValorantShard } from './regions.util.js'
import { fetchCs2Stats } from './steam.provider.js'

/** @type {Record<string, string>} */
const GAME_LABELS = {
    lol: 'League of Legends',
    valorant: 'Valorant',
    cs2: 'Counter-Strike 2',
    minecraft: 'Minecraft',
    fortnite: 'Fortnite',
}

/**
 * @param {import('../../config/games.example.js').default} cfg
 * @param {string} game
 */
function gameColor(cfg, game) {
    return cfg.embedColors?.[game] ?? 0x5865f2
}

/**
 * @param {object} stats
 * @param {number} fallbackColor
 */
function buildStatsEmbed(stats, fallbackColor) {
    const embed = new EmbedBuilder()
        .setColor(stats.color ?? fallbackColor)
        .setTitle(stats.title)
        .setTimestamp()

    if (stats.thumbnail) embed.setThumbnail(stats.thumbnail)
    if (stats.image) embed.setImage(stats.image)

    for (const field of stats.fields ?? []) {
        embed.addFields({
            name: field.name,
            value: String(field.value).slice(0, 1024),
            inline: field.inline ?? false,
        })
    }

    return embed
}

/**
 * @param {object} params
 * @param {string} params.game
 * @param {string} params.player
 * @param {string} [params.region]
 */
export async function fetchGameStats({ game, player, region }) {
    const cfg = await getGamesConfig()

    if (!cfg.enabled) {
        throw new Error('Moduł statystyk gier jest wyłączony w `games.js`.')
    }

    if (!cfg.enabledGames?.includes(game)) {
        throw new Error(`Gra **${GAME_LABELS[game] ?? game}** jest wyłączona w configu.`)
    }

    const routing = cfg.defaultRiotRouting ?? 'europe'

    switch (game) {
        case 'lol':
            return fetchLolStats({
                player,
                region: region ?? cfg.defaultLolRegion ?? 'eune',
                routing,
            })
        case 'valorant':
            return fetchValorantStats({
                player,
                region: resolveValorantShard(region ?? cfg.defaultValorantRegion ?? 'eu'),
                routing,
            })
        case 'cs2':
            return fetchCs2Stats({ player })
        case 'minecraft':
            return fetchMinecraftStats({ player })
        case 'fortnite':
            return fetchFortniteStats({ player })
        default:
            throw new Error('Nieznana gra.')
    }
}

/**
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 */
export async function runStatsCommand(interaction) {
    const cfg = await getGamesConfig()
    const game = interaction.options.getString('gra', true)
    const player = interaction.options.getString('gracz', true)
    const region = interaction.options.getString('region') ?? undefined

    await interaction.deferReply()

    try {
        const stats = await fetchGameStats({ game, player, region })
        const embed = buildStatsEmbed(stats, gameColor(cfg, game))
        await interaction.editReply({ embeds: [embed] })
    } catch (e) {
        consola.warn('[games] stats:', e.message ?? e)
        await interaction.editReply({
            content: `❌ ${e.message ?? 'Nie udało się pobrać statystyk.'}`,
        })
    }
}

/**
 * @param {import('discord.js').Client} client
 */
export async function initGames(client) {
    const cfg = await getGamesConfig()
    if (!cfg.enabled) {
        consola.info('[games] Wyłączone w configu.')
        return
    }

    const enabled = (cfg.enabledGames ?? [])
        .map((g) => GAME_LABELS[g] ?? g)
        .join(', ')

    consola.success(`[games] Aktywne: ${enabled || 'brak gier'}`)
}
