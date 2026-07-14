import { AttachmentBuilder } from 'discord.js'
import { consola } from 'consola'
import { GUILD_ID } from '../../config.js'
import { getWelcomeConfig } from '../../config/load-config.js'
import { applyTemplate, generateWelcomeImage } from './welcome-image.service.js'

/**
 * @param {string} guildId
 */
function isTargetGuild(guildId) {
    return !GUILD_ID || guildId === GUILD_ID
}

/**
 * @param {import('discord.js').GuildMember} member
 * @param {object} sectionCfg
 * @param {'welcome'|'goodbye'} mode
 */
async function sendWelcomeMessage(member, sectionCfg, mode) {
    const channelId = sectionCfg.channelId?.trim()
    if (!channelId) {
        consola.warn(`[welcome] Brak channelId dla trybu: ${mode}`)
        return
    }

    const channel = await member.guild.channels.fetch(channelId).catch(() => null)
    if (!channel?.isTextBased()) {
        consola.warn(`[welcome] Nieprawidłowy kanał (${mode}): ${channelId}`)
        return
    }

    const ctx = {
        userMention: `${member.user}`,
        username: member.displayName || member.user.username,
        serverName: member.guild.name,
        memberCount: member.guild.memberCount,
        tag: member.user.tag,
    }

    const files = []
    if (sectionCfg.image) {
        try {
            const buffer = await generateWelcomeImage({
                member,
                imageCfg: sectionCfg.image,
                mode,
            })
            files.push(
                new AttachmentBuilder(buffer, {
                    name: `${mode}-${member.id}.png`,
                }),
            )
        } catch (e) {
            consola.warn(`[welcome] obrazek (${mode}):`, e.message ?? e)
        }
    }

    let content = applyTemplate(sectionCfg.message ?? '', ctx)
    if (sectionCfg.mentionUser && mode === 'welcome') {
        if (!content.includes(member.user.id)) {
            content = `${member.user} ${content}`.trim()
        }
    }

    await channel.send({
        content: content || undefined,
        files,
    })
}

/**
 * @param {import('discord.js').GuildMember} member
 * @param {object} sectionCfg
 */
async function sendWelcomeDm(member, sectionCfg) {
    if (!sectionCfg.dm?.enabled) return

    const ctx = {
        username: member.displayName || member.user.username,
        serverName: member.guild.name,
        memberCount: member.guild.memberCount,
        tag: member.user.tag,
    }

    try {
        await member.send(applyTemplate(sectionCfg.dm.message ?? '', ctx))
    } catch {
        // DM wyłączone u użytkownika
    }
}

/**
 * @param {import('discord.js').GuildMember} member
 */
export async function handleMemberWelcome(member) {
    if (!member.guild || member.user.bot) return
    if (!isTargetGuild(member.guild.id)) return

    const cfg = await getWelcomeConfig()
    if (!cfg.enabled || !cfg.welcome?.enabled) return

    try {
        await sendWelcomeMessage(member, cfg.welcome, 'welcome')
        await sendWelcomeDm(member, cfg.welcome)
        consola.info(`[welcome] Powitanie: ${member.user.tag} na ${member.guild.name}`)
    } catch (e) {
        consola.error('[welcome] join:', e.message ?? e)
    }
}

/**
 * @param {import('discord.js').GuildMember} member
 */
export async function handleMemberGoodbye(member) {
    if (!member.guild || member.user.bot) return
    if (!isTargetGuild(member.guild.id)) return

    const cfg = await getWelcomeConfig()
    if (!cfg.enabled || !cfg.goodbye?.enabled) return

    try {
        await sendWelcomeMessage(member, cfg.goodbye, 'goodbye')
        await sendWelcomeDm(member, cfg.goodbye)
        consola.info(`[welcome] Pożegnanie: ${member.user.tag} z ${member.guild.name}`)
    } catch (e) {
        consola.error('[welcome] leave:', e.message ?? e)
    }
}

/**
 * @param {import('discord.js').Client} client
 */
export async function initWelcome(client) {
    const cfg = await getWelcomeConfig()
    if (!cfg.enabled) {
        consola.info('[welcome] Wyłączone w welcome.json.')
        return
    }

    const parts = []
    if (cfg.welcome?.enabled) parts.push(`join → ${cfg.welcome.channelId || 'brak ID'}`)
    if (cfg.goodbye?.enabled) parts.push(`leave → ${cfg.goodbye.channelId || 'brak ID'}`)

    consola.success(`[welcome] Aktywne: ${parts.join(', ') || 'brak kanałów'}`)
}
