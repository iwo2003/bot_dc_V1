import { EmbedBuilder, PermissionFlagsBits } from 'discord.js'
import { consola } from 'consola'
import { GUILD_ID } from '../config.js'
import { getAntiRaidConfig, getModerationConfig } from '../config/load-config.js'

/** @type {Map<string, number[]>} guildId → timestamps dołączeń */
const joinBuckets = new Map()

/** @type {Map<string, number>} guildId → raid mode do (ms) */
const raidModeUntil = new Map()

/** @type {Map<string, number[]>} guildId:userId → timestamps wiadomości */
const messageBuckets = new Map()

const URL_REGEX = /https?:\/\/[^\s<>()]+/gi

/**
 * @param {string} guildId
 */
function isTargetGuild(guildId) {
    return !GUILD_ID || guildId === GUILD_ID
}

/**
 * @param {import('discord.js').GuildMember} member
 * @param {import('./anti-raid.example.js').default} cfg
 */
async function isImmune(member, cfg) {
    if (!member) return false
    if (member.permissions.has(PermissionFlagsBits.Administrator)) return true
    if (cfg.immuneUserIds?.includes(member.id)) return true
    if (cfg.immuneRoleIds?.some((id) => member.roles.cache.has(id))) return true

    const modCfg = await getModerationConfig().catch(() => null)
    if (modCfg?.moderatorUserIds?.includes(member.id)) return true
    if (modCfg?.moderatorRoleIds?.some((id) => member.roles.cache.has(id))) {
        return true
    }

    return false
}

/**
 * @param {import('./anti-raid.example.js').default} cfg
 */
async function resolveLogChannelId(cfg) {
    const own = cfg.logChannelId?.trim()
    if (own) return own

    const modCfg = await getModerationConfig().catch(() => null)
    return modCfg?.channels?.adminLogsChannelId?.trim() || ''
}

/**
 * @param {import('discord.js').Guild} guild
 * @param {import('./anti-raid.example.js').default} cfg
 * @param {object} params
 */
async function sendAntiRaidLog(guild, cfg, { title, description, fields = [] }) {
    const channelId = await resolveLogChannelId(cfg)
    if (!channelId) return

    try {
        const channel = await guild.channels.fetch(channelId).catch(() => null)
        if (!channel?.isTextBased()) return

        const embed = new EmbedBuilder()
            .setColor(cfg.embedColor ?? 0xed4245)
            .setTitle(`[ANTY-RAID] ${title}`)
            .setDescription(description.slice(0, 4096))
            .setTimestamp()

        for (const [name, value] of Object.entries(fields)) {
            embed.addFields({
                name,
                value: String(value).slice(0, 1024),
                inline: true,
            })
        }

        await channel.send({ embeds: [embed] })
    } catch (e) {
        consola.warn('[anti-raid] log:', e.message ?? e)
    }
}

/**
 * @param {string} guildId
 */
function isRaidMode(guildId) {
    const until = raidModeUntil.get(guildId) ?? 0
    if (Date.now() < until) return true
    if (until > 0) raidModeUntil.delete(guildId)
    return false
}

/**
 * @param {string} guildId
 * @param {import('./anti-raid.example.js').default} cfg
 */
function recordJoinAndCheckRaid(guildId, cfg) {
    const raidCfg = cfg.antiRaid ?? {}
    const windowMs = Math.max(1000, (raidCfg.joinWindowSeconds ?? 15) * 1000)
    const now = Date.now()

    let bucket = joinBuckets.get(guildId) ?? []
    bucket = bucket.filter((t) => now - t < windowMs)
    bucket.push(now)
    joinBuckets.set(guildId, bucket)

    const threshold = Math.max(2, raidCfg.joinThreshold ?? 8)
    if (bucket.length >= threshold) {
        const duration = Math.max(30, (raidCfg.raidModeSeconds ?? 120) * 1000)
        raidModeUntil.set(guildId, now + duration)
        return true
    }
    return false
}

/**
 * @param {import('discord.js').User} user
 * @param {number} minDays
 */
function isYoungAccount(user, minDays) {
    const ageMs = Date.now() - user.createdTimestamp
    return ageMs < minDays * 24 * 60 * 60 * 1000
}

/**
 * @param {import('discord.js').GuildMember} member
 * @param {'ban'|'kick'|'timeout'} action
 * @param {string} reason
 * @param {number} [timeoutMinutes]
 */
async function punishMember(member, action, reason, timeoutMinutes = 15) {
    const me = member.guild.members.me
    if (!me) return false

    try {
        switch (action) {
            case 'ban':
                if (!member.bannable) return false
                await member.ban({ deleteMessageSeconds: 0, reason })
                return true
            case 'kick':
                if (!member.kickable) return false
                await member.kick(reason)
                return true
            case 'timeout': {
                if (!member.moderatable) return false
                const ms = Math.min(timeoutMinutes * 60_000, 28 * 24 * 60 * 60 * 1000)
                await member.timeout(ms, reason)
                return true
            }
            default:
                return false
        }
    } catch (e) {
        consola.warn('[anti-raid] punish:', member.id, e.message ?? e)
        return false
    }
}

/**
 * @param {string} url
 */
function extractHostname(url) {
    try {
        const parsed = new URL(url.replace(/[>,.)]+$/, ''))
        return parsed.hostname.toLowerCase().replace(/^www\./, '')
    } catch {
        return ''
    }
}

/**
 * @param {string} host
 * @param {string[]} list
 */
function hostMatchesList(host, list) {
    if (!host || !Array.isArray(list)) return false
    return list.some((entry) => {
        const needle = String(entry).toLowerCase().replace(/^www\./, '')
        return host === needle || host.endsWith(`.${needle}`) || host.includes(needle)
    })
}

/**
 * @param {string} content
 * @param {import('./anti-raid.example.js').default} cfg
 */
function scanMessageForThreats(content, cfg) {
    const linkCfg = cfg.antiLink ?? {}
    if (!linkCfg.enabled) return null

    const lower = content.toLowerCase()
    const urls = content.match(URL_REGEX) ?? []

    for (const pattern of linkCfg.blockedPatterns ?? []) {
        try {
            if (new RegExp(pattern, 'i').test(content)) {
                return { type: 'pattern', detail: pattern }
            }
        } catch {
            // nieprawidłowy regex w configu — pomiń
        }
    }

    if (linkCfg.blockDiscordInvites) {
        if (
            /discord\.gg\/[a-z0-9]+/i.test(content) ||
            /discord\.com\/invite\/[a-z0-9]+/i.test(content) ||
            /discordapp\.com\/invite\/[a-z0-9]+/i.test(content)
        ) {
            return { type: 'discord_invite', detail: 'Zaproszenie Discord' }
        }
    }

    for (const url of urls) {
        const host = extractHostname(url)
        if (!host) continue

        if (hostMatchesList(host, linkCfg.whitelistDomains ?? [])) continue

        if (hostMatchesList(host, linkCfg.blockedDomains ?? [])) {
            return { type: 'blocked_domain', detail: host }
        }

        for (const pattern of linkCfg.blockedPatterns ?? []) {
            if (lower.includes(pattern.toLowerCase()) || host.includes(pattern.toLowerCase())) {
                return { type: 'blocked_domain', detail: host || pattern }
            }
        }
    }

    return null
}

/**
 * @param {string} guildId
 * @param {string} userId
 * @param {import('./anti-raid.example.js').default} cfg
 */
function recordMessageAndCheckSpam(guildId, userId, cfg) {
    const spamCfg = cfg.antiSpam ?? {}
    const windowMs = Math.max(1000, (spamCfg.intervalSeconds ?? 7) * 1000)
    const key = `${guildId}:${userId}`
    const now = Date.now()

    let bucket = messageBuckets.get(key) ?? []
    bucket = bucket.filter((t) => now - t < windowMs)
    bucket.push(now)
    messageBuckets.set(key, bucket)

    const max = Math.max(2, spamCfg.maxMessages ?? 6)
    return bucket.length >= max
}

/**
 * @param {import('discord.js').Message} message
 */
async function deleteMessageSafe(message) {
    try {
        if (message.deletable) await message.delete()
    } catch {
        // wiadomość mogła zostać już usunięta
    }
}

/**
 * @param {import('discord.js').GuildMember} member
 * @param {import('./anti-raid.example.js').default} cfg
 */
export async function handleMemberJoin(member) {
    const cfg = await getAntiRaidConfig()
    if (!cfg.enabled || !isTargetGuild(member.guild.id)) return

    const botCfg = cfg.antiBot ?? {}
    const raidCfg = cfg.antiRaid ?? {}

    if (member.user.bot && botCfg.enabled && botCfg.banUnauthorizedBots) {
        const allowed = botCfg.allowedBotIds ?? []
        if (!allowed.includes(member.id)) {
            const reason = 'Anty-raid: nieautoryzowany bot'
            const banned = await punishMember(member, 'ban', reason)
            if (banned) {
                consola.info(`[anti-raid] Zbanowano bota ${member.user.tag} (${member.id})`)
                await sendAntiRaidLog(member.guild, cfg, {
                    title: 'Nieautoryzowany bot',
                    description: `Zbanowano bota **${member.user.tag}**.`,
                    fields: {
                        'ID bota': member.id,
                        Powód: reason,
                    },
                })
            }
            return
        }
    }

    if (!raidCfg.enabled) return

    const raidTriggered = recordJoinAndCheckRaid(member.guild.id, cfg)
    if (raidTriggered) {
        consola.warn(`[anti-raid] Tryb raid na ${member.guild.name} (${member.guild.id})`)
        await sendAntiRaidLog(member.guild, cfg, {
            title: 'Wykryto raid',
            description:
                `Wykryto masowe dołączanie (**${raidCfg.joinThreshold ?? 8}**+ osób w **${raidCfg.joinWindowSeconds ?? 15}s**). Tryb raid aktywny przez **${raidCfg.raidModeSeconds ?? 120}s**.`,
            fields: {
                Ostatnie: `Dołączył: ${member.user.tag}`,
            },
        })
    }

    if (!isRaidMode(member.guild.id)) return
    if (await isImmune(member, cfg)) return

    const minDays = Math.max(0, raidCfg.minAccountAgeDays ?? 7)
    if (!isYoungAccount(member.user, minDays)) return

    const action = raidCfg.action === 'kick' ? 'kick' : 'ban'
    const reason = `Anty-raid: podejrzane konto (${minDays} dni) w trybie raid`
    const punished = await punishMember(member, action, reason)

    if (punished) {
        consola.info(`[anti-raid] ${action} ${member.user.tag} (raid mode)`)
        await sendAntiRaidLog(member.guild, cfg, {
            title: `Akcja raid: ${action}`,
            description: `Użytkownik **${member.user.tag}** — konto młodsze niż ${minDays} dni.`,
            fields: {
                ID: member.id,
                'Wiek konta': `${Math.floor((Date.now() - member.user.createdTimestamp) / 86_400_000)} dni`,
            },
        })
    }
}

/**
 * @param {import('discord.js').Message} message
 */
export async function handleMessage(message) {
    if (!message.guild || message.author.bot || !message.member) return
    if (!isTargetGuild(message.guild.id)) return

    const cfg = await getAntiRaidConfig()
    if (!cfg.enabled) return
    if (await isImmune(message.member, cfg)) return

    const spamCfg = cfg.antiSpam ?? {}
    const linkCfg = cfg.antiLink ?? {}

    if (spamCfg.ignoredChannelIds?.includes(message.channel.id)) return

    const content = message.content ?? ''
    if (!content.trim()) return

    let threat = scanMessageForThreats(content, cfg)
    let spamHit = false

    if (spamCfg.enabled) {
        spamHit = recordMessageAndCheckSpam(
            message.guild.id,
            message.author.id,
            cfg,
        )
    }

    if (!threat && !spamHit) return

    let action = 'delete'
    let reason = 'Anty-raid'
    let timeoutMinutes = 15
    let logTitle = 'Wykryto zagrożenie'

    if (threat) {
        action = linkCfg.action ?? 'delete'
        timeoutMinutes = linkCfg.timeoutMinutes ?? 60
        reason =
            threat.type === 'discord_invite'
                ? 'Anty-raid: nieautoryzowane zaproszenie Discord'
                : `Anty-raid: podejrzany link (${threat.detail})`
        logTitle =
            threat.type === 'discord_invite'
                ? 'Zablokowano zaproszenie'
                : 'Zablokowano podejrzany link'
    } else if (spamHit) {
        action = spamCfg.action ?? 'timeout'
        timeoutMinutes = spamCfg.timeoutMinutes ?? 15
        reason = 'Anty-raid: spam wiadomości'
        logTitle = 'Wykryto spam'
    }

    if (spamCfg.deleteMessages !== false || threat) {
        await deleteMessageSafe(message)
    }

    let punished = false
    if (action === 'timeout') {
        punished = await punishMember(message.member, 'timeout', reason, timeoutMinutes)
    } else if (action === 'kick' || action === 'ban') {
        punished = await punishMember(message.member, action, reason)
    }

    consola.info(
        `[anti-raid] ${logTitle}: ${message.author.tag} w #${message.channel.name}`,
    )

    await sendAntiRaidLog(message.guild, cfg, {
        title: logTitle,
        description: `Użytkownik **${message.author.tag}** na ${message.channel}.`,
        fields: {
            Powód: reason,
            Akcja: punished ? action : 'tylko usunięcie',
            ...(threat ? { Szczegóły: threat.detail } : {}),
            Treść: content.slice(0, 200),
        },
    })
}

/**
 * @param {import('discord.js').Client} client
 */
export async function initAntiRaid(client) {
    const cfg = await getAntiRaidConfig()
    if (!cfg.enabled) {
        consola.info('[anti-raid] Wyłączone w configu.')
        return
    }

    const parts = []
    if (cfg.antiBot?.enabled) parts.push('anti-bot')
    if (cfg.antiRaid?.enabled) parts.push('anti-raid')
    if (cfg.antiSpam?.enabled) parts.push('anti-spam')
    if (cfg.antiLink?.enabled) parts.push('anti-link')

    consola.success(`[anti-raid] Aktywne: ${parts.join(', ') || 'brak modułów'}`)
    consola.info(
        '[anti-raid] Wymaga intentu Message Content w Developer Portal.',
    )
}
