import { EmbedBuilder } from 'discord.js'
import { getModerationConfig } from '../config/load-moderation.js'

const ACTION_LABELS = {
    ban: 'Ban',
    kick: 'Wyrzucenie',
    mute: 'Wyciszenie',
    unmute: 'Odciszenie',
    warn: 'Ostrzeżenie',
    unwarn: 'Zdjęcie ostrzeżenia',
}

/**
 * @param {object} params
 * @param {import('discord.js').ChatInputCommandInteraction} params.interaction
 * @param {'ban'|'kick'|'mute'|'unmute'|'warn'|'unwarn'} params.action
 * @param {import('discord.js').User} params.targetUser
 * @param {string} [params.reason]
 * @param {Record<string, string>} [params.extraFields]
 */
export async function sendModerationLogs({
    interaction,
    action,
    targetUser,
    reason,
    extraFields = {},
}) {
    const cfg = await getModerationConfig()
    const guild = interaction.guild
    if (!guild) return

    const label = ACTION_LABELS[action] ?? action
    const color = cfg.embedColors?.[action] ?? 0x5865f2
    const mod = interaction.user

    const userChannelId = cfg.channels?.userLogsChannelId?.trim()
    const adminChannelId = cfg.channels?.adminLogsChannelId?.trim()

    if (userChannelId) {
        const userEmbed = new EmbedBuilder()
            .setColor(color)
            .setTitle(label)
            .setDescription(
                `Użytkownik **${targetUser.tag}** został objęty akcją moderacyjną.`,
            )
            .addFields(
                {
                    name: 'Użytkownik',
                    value: `${targetUser} (\`${targetUser.id}\`)`,
                    inline: false,
                },
                {
                    name: 'Powód',
                    value: (reason || 'Brak podanego powodu').slice(0, 1024),
                    inline: false,
                },
            )
            .setTimestamp()

        await sendToChannel(guild, userChannelId, userEmbed)
    }

    if (adminChannelId) {
        const adminEmbed = new EmbedBuilder()
            .setColor(color)
            .setTitle(`[ADMIN] ${label}`)
            .addFields(
                {
                    name: 'Użytkownik',
                    value: `${targetUser.tag} (\`${targetUser.id}\`)`,
                    inline: true,
                },
                {
                    name: 'Moderator',
                    value: `${mod.tag} (\`${mod.id}\`)`,
                    inline: true,
                },
                {
                    name: 'Powód',
                    value: (reason || 'Brak podanego powodu').slice(0, 1024),
                    inline: false,
                },
            )
            .setTimestamp()

        for (const [name, value] of Object.entries(extraFields)) {
            adminEmbed.addFields({
                name,
                value: String(value).slice(0, 1024),
                inline: true,
            })
        }

        await sendToChannel(guild, adminChannelId, adminEmbed)
    }
}

/**
 * @param {import('discord.js').Guild} guild
 * @param {string} channelId
 * @param {EmbedBuilder} embed
 */
async function sendToChannel(guild, channelId, embed) {
    try {
        const channel = await guild.channels.fetch(channelId).catch(() => null)
        if (!channel?.isTextBased()) return
        await channel.send({ embeds: [embed] })
    } catch {
        // logi są opcjonalne — nie przerywaj komendy
    }
}
