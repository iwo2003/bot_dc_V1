import { ChannelType, PermissionFlagsBits } from 'discord.js'
import { consola } from 'consola'
import { getAutoChannelConfig } from '../config/load-config.js'

/** @type {Map<string, { ownerId: string, guildId: string, locked?: boolean, hidden?: boolean }>} */
const activeChannels = new Map()

/** @type {Map<string, string>} guildId:userId → channelId */
const userChannels = new Map()

/** @type {Map<string, NodeJS.Timeout>} */
const deleteTimers = new Map()

/**
 * @param {string} template
 * @param {import('discord.js').GuildMember} member
 */
export function renderChannelName(template, member) {
    const user = member.user.username
    const nick = member.displayName || user
    const idSuffix = member.id.slice(-4)

    return template
        .replace(/\{user\}/g, user)
        .replace(/\{nick\}/g, nick)
        .replace(/\{id\}/g, idSuffix)
        .slice(0, 100)
}

/**
 * @param {import('./auto-channel.example.js').default} cfg
 * @param {import('discord.js').GuildMember} owner
 */
export function buildOwnerOverwrites(cfg, owner) {
    const perms = [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.Connect,
        PermissionFlagsBits.Speak,
    ]

    if (cfg.ownerPermissions?.manageChannel !== false) {
        perms.push(PermissionFlagsBits.ManageChannels)
    }
    if (cfg.ownerPermissions?.moveMembers) {
        perms.push(PermissionFlagsBits.MoveMembers)
    }
    if (cfg.ownerPermissions?.muteMembers) {
        perms.push(PermissionFlagsBits.MuteMembers, PermissionFlagsBits.DeafenMembers)
    }

    return [
        {
            id: owner.guild.roles.everyone.id,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect],
        },
        {
            id: owner.id,
            allow: perms,
        },
    ]
}

/**
 * @param {import('discord.js').VoiceBasedChannel} channel
 * @param {import('./auto-channel.example.js').default} cfg
 * @param {import('discord.js').GuildMember} newOwner
 * @param {string} oldOwnerId
 */
export async function applyOwnerPermissions(channel, cfg, newOwner) {
    await channel.permissionOverwrites.set(buildOwnerOverwrites(cfg, newOwner))
}

function userKey(guildId, userId) {
    return `${guildId}:${userId}`
}

function registerChannel(channelId, guildId, ownerId) {
    activeChannels.set(channelId, { ownerId, guildId, locked: false, hidden: false })
    userChannels.set(userKey(guildId, ownerId), channelId)
}

/** @param {string} channelId */
export function unregisterTempChannel(channelId) {
    const meta = activeChannels.get(channelId)
    if (meta) {
        userChannels.delete(userKey(meta.guildId, meta.ownerId))
    }
    activeChannels.delete(channelId)

    const timer = deleteTimers.get(channelId)
    if (timer) {
        clearTimeout(timer)
        deleteTimers.delete(channelId)
    }
}

function unregisterChannel(channelId) {
    unregisterTempChannel(channelId)
}

/** @param {string} channelId */
export function isActiveTempChannel(channelId) {
    return activeChannels.has(channelId)
}

/** @param {string} channelId */
export function getActiveChannelMeta(channelId) {
    return activeChannels.get(channelId) ?? null
}

/**
 * @param {string} channelId
 * @param {string} newOwnerId
 */
export function transferChannelOwnership(channelId, newOwnerId) {
    const meta = activeChannels.get(channelId)
    if (!meta) return false

    userChannels.delete(userKey(meta.guildId, meta.ownerId))
    meta.ownerId = newOwnerId
    meta.locked = false
    meta.hidden = false
    userChannels.set(userKey(meta.guildId, newOwnerId), channelId)
    return true
}

/**
 * @param {import('discord.js').Guild} guild
 * @param {import('discord.js').GuildMember} member
 * @param {import('./auto-channel.example.js').default} cfg
 * @returns {Promise<{ channel: import('discord.js').VoiceBasedChannel, created: boolean }>}
 */
async function getOrCreateUserChannel(guild, member, cfg) {
    const key = userKey(guild.id, member.id)

    if (cfg.oneChannelPerUser !== false && userChannels.has(key)) {
        const existingId = userChannels.get(key)
        const existing = await guild.channels.fetch(existingId).catch(() => null)
        if (existing?.type === ChannelType.GuildVoice) {
            return { channel: existing, created: false }
        }
        unregisterChannel(existingId)
    }

    const hub = await guild.channels.fetch(cfg.hubChannelId.trim()).catch(() => null)
    if (!hub || hub.type !== ChannelType.GuildVoice) {
        throw new Error('Nie znaleziono kanału-hub (hubChannelId) lub to nie jest kanał głosowy.')
    }

    const categoryId = cfg.categoryId?.trim() || hub.parentId || null
    const userLimit = Number(cfg.userLimit) > 0 ? Number(cfg.userLimit) : undefined
    const bitrate = Number(cfg.bitrate) > 0 ? Number(cfg.bitrate) : undefined

    const channel = await guild.channels.create({
        name: renderChannelName(cfg.nameTemplate, member),
        type: ChannelType.GuildVoice,
        parent: categoryId,
        userLimit,
        bitrate,
        reason: `Auto kanał — utworzony przez ${member.user.tag}`,
        permissionOverwrites: buildOwnerOverwrites(cfg, member),
    })

    registerChannel(channel.id, guild.id, member.id)
    consola.info(`[auto-channel] Utworzono ${channel.name} (${channel.id}) dla ${member.user.tag}`)

    return { channel, created: true }
}

/**
 * @param {import('discord.js').Guild} guild
 * @param {string} channelId
 * @param {import('./auto-channel.example.js').default} cfg
 */
async function scheduleDeleteIfEmpty(guild, channelId, cfg) {
    if (!activeChannels.has(channelId)) return

    const existingTimer = deleteTimers.get(channelId)
    if (existingTimer) clearTimeout(existingTimer)

    const delay = Math.max(500, Number(cfg.deleteDelayMs) || 1500)

    const timer = setTimeout(async () => {
        deleteTimers.delete(channelId)

        if (!activeChannels.has(channelId)) return

        try {
            const channel = await guild.channels.fetch(channelId).catch(() => null)
            if (!channel || channel.type !== ChannelType.GuildVoice) {
                unregisterChannel(channelId)
                return
            }

            if (channel.members.size === 0) {
                await channel.delete('Auto kanał — pusty, usunięcie automatyczne')
                consola.info(`[auto-channel] Usunięto pusty kanał ${channel.name} (${channelId})`)
                unregisterChannel(channelId)
            }
        } catch (e) {
            consola.warn('[auto-channel] delete:', channelId, e.message ?? e)
            unregisterChannel(channelId)
        }
    }, delay)

    deleteTimers.set(channelId, timer)
}

/**
 * @param {import('discord.js').VoiceState} oldState
 * @param {import('discord.js').VoiceState} newState
 */
export async function handleVoiceStateUpdate(oldState, newState) {
    const cfg = await getAutoChannelConfig()
    if (!cfg.enabled) return

    const hubId = cfg.hubChannelId?.trim()
    if (!hubId) return

    const member = newState.member ?? oldState.member
    if (!member || member.user.bot) return

    const guild = newState.guild ?? oldState.guild
    if (!guild) return

    const joinedHub = newState.channelId === hubId && oldState.channelId !== hubId
    const leftTempChannel =
        oldState.channelId &&
        oldState.channelId !== hubId &&
        activeChannels.has(oldState.channelId)

    if (joinedHub) {
        try {
            const { channel, created } = await getOrCreateUserChannel(guild, member, cfg)
            if (member.voice.channelId !== channel.id) {
                await member.voice.setChannel(channel)
            }
            if (created) {
                const { sendOwnerPanel } = await import('./auto-channel-panel.service.js')
                await sendOwnerPanel(channel, member, cfg)
            }
        } catch (e) {
            consola.error('[auto-channel] join hub:', e.message ?? e)
            if (member.voice.channelId === hubId) {
                await member.voice.disconnect().catch(() => {})
            }
        }
        return
    }

    if (leftTempChannel) {
        await scheduleDeleteIfEmpty(guild, oldState.channelId, cfg)
    }
}

/**
 * @param {import('discord.js').Client} client
 */
export async function initAutoChannel(client) {
    const cfg = await getAutoChannelConfig()
    if (!cfg.enabled) {
        consola.info('[auto-channel] Wyłączone w configu.')
        return
    }

    if (!cfg.hubChannelId?.trim()) {
        consola.warn('[auto-channel] Włączone, ale brak hubChannelId — funkcja nieaktywna.')
        return
    }

    const panelInfo =
        cfg.panel?.enabled === false ? 'panel wyłączony' : 'panel włączony (Text in Voice)'

    consola.success(
        `[auto-channel] Aktywne — hub: ${cfg.hubChannelId}, szablon: "${cfg.nameTemplate}", ${panelInfo}`,
    )
}
