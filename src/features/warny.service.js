import { EmbedBuilder } from 'discord.js'
import { consola } from 'consola'
import { getModerationConfig } from '../config/load-moderation.js'
import { getPool } from '../db/client.js'
import * as warnRepo from '../db/warny.repo.js'
import { sendModerationLogs } from './moderation-log.service.js'
import {
    MAX_TIMEOUT_MS,
    assertNotSelf,
} from '../utils/moderation.util.js'
import {
    PermissionFlagsBits,
    memberHasPermission,
    hasConfigCommandAccess,
} from '../utils/permissions.util.js'

const MS_DAY = 24 * 60 * 60 * 1000
const MS_MINUTE = 60_000

function resetWindowMs(warnCfg) {
    return (warnCfg.resetWindowDays ?? 30) * MS_DAY
}

function getLevels(warnCfg) {
    const levels = warnCfg.levels
    if (Array.isArray(levels) && levels.length > 0) return levels
    return [
        { action: 'mute', muteMinutes: 30 },
        { action: 'mute', muteMinutes: 60 },
        { action: 'mute', muteMinutes: 180 },
        { action: 'mute', muteMinutes: 720 },
        { action: 'mute', muteMinutes: 10080 },
    ]
}

function getMaxWarns(warnCfg) {
    return getLevels(warnCfg).length
}

/**
 * @param {object} warnCfg
 * @param {number} level — 1-based
 */
function getLevelConfig(warnCfg, level) {
    const levels = getLevels(warnCfg)
    return levels[level - 1] ?? { action: 'none' }
}

function muteMs(levelCfg) {
    const minutes = Math.max(1, Number(levelCfg.muteMinutes) || 60)
    return Math.min(minutes * MS_MINUTE, MAX_TIMEOUT_MS)
}

function formatDuration(ms) {
    const minutes = Math.round(ms / MS_MINUTE)
    if (minutes < 60) return `${minutes} min`
    const hours = Math.round(minutes / 60)
    if (hours < 48) return `${hours} h`
    const days = Math.round(hours / 24)
    return `${days} dni`
}

function consequenceText(level, warnCfg) {
    const cfg = getLevelConfig(warnCfg, level)
    const max = getMaxWarns(warnCfg)

    switch (cfg.action) {
        case 'mute':
            return `Nałożono **wyciszenie** na **${formatDuration(muteMs(cfg))}**.`
        case 'ban_temp':
            return `**Ban na ${cfg.banDays ?? 14} dni** — potem automatyczny odban.`
        case 'ban_perm':
            return '**Ban permanentny** na tym serwerze.'
        case 'none':
            return 'Samo ostrzeżenie — bez dodatkowej akcji na koncie.'
        default:
            return `Ostrzeżenie ${level}/${max}.`
    }
}

function isSevereAction(levelCfg) {
    return levelCfg.action === 'ban_perm' || levelCfg.action === 'ban_temp'
}

function buildDmEmbed(nextLevel, reason, modTag, guildName, warnCfg, modCfg) {
    const levelCfg = getLevelConfig(warnCfg, nextLevel)
    const max = getMaxWarns(warnCfg)

    return new EmbedBuilder()
        .setColor(
            isSevereAction(levelCfg)
                ? (modCfg.embedColors?.warnSevere ?? 0xed4245)
                : (modCfg.embedColors?.warn ?? 0xfee75c),
        )
        .setTitle(`Ostrzeżenie ${nextLevel}/${max}`)
        .setDescription(
            `Otrzymałeś ostrzeżenie na serwerze **${guildName}**.`,
        )
        .addFields(
            { name: 'Powód', value: reason.slice(0, 1024) || '—', inline: false },
            { name: 'Moderator', value: modTag.slice(0, 256), inline: true },
            {
                name: 'Konsekwencja',
                value: consequenceText(nextLevel, warnCfg),
                inline: false,
            },
            {
                name: 'Reset licznika',
                value: `Jeśli przez **${warnCfg.resetWindowDays ?? 30} dni** nie dostaniesz kolejnego ostrzeżenia, licznik wraca do zera.`,
                inline: false,
            },
        )
        .setTimestamp()
}

async function sendWarnDm(user, embed, enabled) {
    if (!enabled) return null
    try {
        await user.send({ embeds: [embed] })
        return true
    } catch {
        return false
    }
}

/**
 * @param {import('discord.js').Guild} guild
 * @param {import('discord.js').GuildMember | null} targetMember
 * @param {import('discord.js').User} targetUser
 * @param {object} levelCfg
 * @param {number} nextLevel
 * @param {number} maxWarns
 * @param {string} reason
 * @param {string} modTag
 */
async function applyWarnConsequence(
    guild,
    targetMember,
    targetUser,
    levelCfg,
    nextLevel,
    maxWarns,
    reason,
    modTag,
) {
    const guildId = guild.id
    const now = Date.now()
    const label = `Warn ${nextLevel}/${maxWarns}`

    switch (levelCfg.action) {
        case 'mute': {
            if (!targetMember) {
                throw new Error(
                    'Użytkownik musi być na serwerze, żeby nałożyć wyciszenie (mute).',
                )
            }
            await targetMember.timeout(
                muteMs(levelCfg),
                `${label} | ${reason} | ${modTag}`,
            )
            await warnRepo.setWarnMuteActive(guildId, targetUser.id)
            break
        }
        case 'ban_temp': {
            const banDays = Math.max(1, Number(levelCfg.banDays) || 14)
            const unbanAt = now + banDays * MS_DAY
            await warnRepo.deleteWarnMuteActive(guildId, targetUser.id).catch(() => {})
            await guild.members.ban(targetUser, {
                deleteMessageSeconds: 0,
                reason: `${label} (${banDays} dni) | ${reason} | ${modTag}`,
            })
            await warnRepo.upsertTempBan(guildId, targetUser.id, unbanAt)
            break
        }
        case 'ban_perm': {
            await warnRepo.deleteTempBan(guildId, targetUser.id).catch(() => {})
            await warnRepo.deleteWarnMuteActive(guildId, targetUser.id).catch(() => {})
            await guild.members.ban(targetUser, {
                deleteMessageSeconds: 0,
                reason: `${label} (permanentny) | ${reason} | ${modTag}`,
            })
            break
        }
        case 'none':
            break
        default:
            throw new Error(`Nieznana akcja warna: ${levelCfg.action}`)
    }
}

function needsMutePermission(levelCfg) {
    return levelCfg.action === 'mute'
}

function needsBanPermission(levelCfg) {
    return levelCfg.action === 'ban_temp' || levelCfg.action === 'ban_perm'
}

/**
 * Czy któryś ze zdjętych poziomów warna miał akcję mute.
 * @param {object} warnCfg
 * @param {number} previousCount
 * @param {number} newCount
 */
function removedLevelsHadMute(warnCfg, previousCount, newCount) {
    for (let level = previousCount; level > newCount; level--) {
        if (getLevelConfig(warnCfg, level).action === 'mute') return true
    }
    return false
}

/**
 * @param {import('discord.js').Guild} guild
 * @param {import('discord.js').User} targetUser
 * @param {string} modTag
 */
async function tryRemoveWarnMute(guild, targetUser, modTag) {
    const guildId = guild.id
    const hadWarnMute = await warnRepo.hasWarnMuteActive(guildId, targetUser.id)
    if (!hadWarnMute) return false

    const member = await guild.members.fetch(targetUser.id).catch(() => null)
    if (!member?.moderatable) {
        await warnRepo.deleteWarnMuteActive(guildId, targetUser.id)
        return false
    }

    try {
        await member.timeout(null, `Unwarn — zdjęcie wyciszenia z warna | ${modTag}`)
        await warnRepo.deleteWarnMuteActive(guildId, targetUser.id)
        return true
    } catch {
        return false
    }
}

export async function processWarnTempUnbans(client) {
    const pool = getPool()
    if (!pool) return

    let due
    try {
        due = await warnRepo.listDueTempBans(Date.now())
    } catch (e) {
        consola.warn('[warny] listDueTempBans:', e.message ?? e)
        return
    }

    for (const row of due) {
        try {
            const guild = await client.guilds.fetch(row.guild_id).catch(() => null)
            if (!guild) {
                await warnRepo.deleteTempBan(row.guild_id, row.user_id)
                continue
            }
            await guild.members.unban(row.user_id, 'Koniec bana tymczasowego (system warnów)')
            await warnRepo.deleteTempBan(row.guild_id, row.user_id)
            consola.info(`[warny] Odbanowano ${row.user_id} na ${row.guild_id}`)
        } catch (e) {
            consola.warn('[warny] unban:', row.user_id, e.message ?? e)
            await warnRepo.deleteTempBan(row.guild_id, row.user_id).catch(() => {})
        }
    }
}

export function initWarnyScheduler(client) {
    const tick = () => {
        processWarnTempUnbans(client).catch((e) => consola.error(e))
    }
    tick()
    setInterval(tick, 90_000)
}

/**
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 */
export async function runWarnFromInteraction(interaction) {
    if (!getPool()) {
        return interaction.reply({
            content: 'System warnów wymaga działającej bazy MySQL (sprawdź `.env`).',
            ephemeral: true,
        })
    }

    if (!interaction.inCachedGuild() || !interaction.member) {
        return interaction.reply({
            content: 'Tej komendy możesz użyć tylko na serwerze.',
            ephemeral: true,
        })
    }

    const targetUser = interaction.options.getUser('user', true)
    const targetMember = interaction.options.getMember('user')
    const reason =
        interaction.options.getString('reason')?.trim() || 'Brak podanego powodu'

    if (targetUser.id === interaction.user.id) {
        return interaction.reply({
            content: 'Nie możesz nadać ostrzeżenia samemu sobie.',
            ephemeral: true,
        })
    }
    if (targetUser.bot) {
        return interaction.reply({
            content: 'Nie można ostrzegać bota.',
            ephemeral: true,
        })
    }

    const modCfg = await getModerationConfig()
    const warnCfg = modCfg.warn ?? {}
    const maxWarns = getMaxWarns(warnCfg)
    const guild = interaction.guild
    const guildId = guild.id
    const now = Date.now()

    const state = await warnRepo.getWarnState(guildId, targetUser.id)
    let effective = state.warn_count
    const lastAt = state.last_warn_at

    if (lastAt > 0 && now - lastAt > resetWindowMs(warnCfg)) {
        effective = 0
    }

    if (effective >= maxWarns) {
        return interaction.reply({
            content: `Ten użytkownik ma już maksymalny poziom ostrzeżeń (${maxWarns}) w bieżącym okresie.`,
            ephemeral: true,
        })
    }

    const nextLevel = effective + 1
    const levelCfg = getLevelConfig(warnCfg, nextLevel)
    const configWarn = await hasConfigCommandAccess(interaction, 'warn')

    if (needsMutePermission(levelCfg)) {
        if (!targetMember) {
            return interaction.reply({
                content:
                    'Użytkownik musi być na serwerze, żeby nałożyć wyciszenie przy tym warnie.',
                ephemeral: true,
            })
        }
        assertNotSelf(interaction.member, targetMember)
        if (!targetMember.moderatable) {
            return interaction.reply({
                content: 'Nie mogę nałożyć timeoutu na tego użytkownika.',
                ephemeral: true,
            })
        }
        if (
            !configWarn &&
            !memberHasPermission(
                interaction.member,
                PermissionFlagsBits.ModerateMembers,
            )
        ) {
            return interaction.reply({
                content: 'Potrzebujesz uprawnienia **Moderowanie członków**.',
                ephemeral: true,
            })
        }
    }

    if (needsBanPermission(levelCfg)) {
        if (
            !configWarn &&
            !memberHasPermission(interaction.member, PermissionFlagsBits.BanMembers)
        ) {
            return interaction.reply({
                content: 'Potrzebujesz uprawnienia **Banowanie członków**.',
                ephemeral: true,
            })
        }
        if (targetMember) {
            assertNotSelf(interaction.member, targetMember)
            if (
                targetMember.id !== guild.ownerId &&
                !targetMember.manageable
            ) {
                return interaction.reply({
                    content: 'Nie możesz zbanować tego użytkownika (hierarchia ról).',
                    ephemeral: true,
                })
            }
        }
    }

    if (targetMember && levelCfg.action !== 'none') {
        assertNotSelf(interaction.member, targetMember)
    }

    await interaction.deferReply({ ephemeral: true })

    const modTag = interaction.user.tag

    try {
        await applyWarnConsequence(
            guild,
            targetMember,
            targetUser,
            levelCfg,
            nextLevel,
            maxWarns,
            reason,
            modTag,
        )
        await warnRepo.setWarnState(guildId, targetUser.id, nextLevel, now)
    } catch (e) {
        consola.error('[warny] akcja:', e)
        await interaction.editReply({
            content: `Nie udało się wykonać konsekwencji warna: ${e.message ?? e}`,
        })
        return
    }

    const dmEmbed = buildDmEmbed(nextLevel, reason, modTag, guild.name, warnCfg, modCfg)
    const dmEnabled = modCfg.dm?.warn !== false
    const dmOk = await sendWarnDm(targetUser, dmEmbed, dmEnabled)

    await sendModerationLogs({
        interaction,
        action: 'warn',
        targetUser,
        reason,
        extraFields: {
            'Poziom warna': `${nextLevel}/${maxWarns}`,
            Akcja: levelCfg.action ?? 'none',
            Konsekwencja: consequenceText(nextLevel, warnCfg).replace(/\*\*/g, ''),
        },
    })

    await interaction.editReply({
        content: `Nadano **warn ${nextLevel}/${maxWarns}** użytkownikowi ${targetUser.tag}.${
            !dmEnabled
                ? ''
                : dmOk
                  ? ''
                  : ' (nie udało się wysłać DM — użytkownik może mieć wyłączone wiadomości od nieznajomych.)'
        }`,
    })
}

/**
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 */
export async function runUnwarnFromInteraction(interaction) {
    if (!getPool()) {
        return interaction.reply({
            content: 'System warnów wymaga działającej bazy MySQL (sprawdź `.env`).',
            ephemeral: true,
        })
    }

    if (!interaction.inCachedGuild()) {
        return interaction.reply({
            content: 'Tej komendy możesz użyć tylko na serwerze.',
            ephemeral: true,
        })
    }

    const targetUser = interaction.options.getUser('user', true)
    const amount = interaction.options.getInteger('ilosc')
    const reason =
        interaction.options.getString('reason')?.trim() || 'Brak podanego powodu'

    if (targetUser.bot) {
        return interaction.reply({
            content: 'Nie można modyfikować warnów bota.',
            ephemeral: true,
        })
    }

    const guildId = interaction.guild.id
    const state = await warnRepo.getWarnState(guildId, targetUser.id)

    if (state.warn_count <= 0) {
        return interaction.reply({
            content: `${targetUser.tag} nie ma aktywnych ostrzeżeń w bazie.`,
            ephemeral: true,
        })
    }

    await interaction.deferReply({ ephemeral: true })

    const previous = state.warn_count
    let newCount

    try {
        if (amount == null) {
            await warnRepo.deleteWarnState(guildId, targetUser.id)
            await warnRepo.deleteTempBan(guildId, targetUser.id).catch(() => {})
            newCount = 0
        } else {
            newCount = await warnRepo.decrementWarnState(
                guildId,
                targetUser.id,
                amount,
            )
            if (newCount === 0) {
                await warnRepo.deleteTempBan(guildId, targetUser.id).catch(() => {})
            }
        }
    } catch (e) {
        consola.error('[warny] unwarn:', e)
        await interaction.editReply({
            content: `Nie udało się zdjąć ostrzeżenia: ${e.message ?? e}`,
        })
        return
    }

    const modCfg = await getModerationConfig()
    const warnCfg = modCfg.warn ?? {}
    const maxWarns = getMaxWarns(warnCfg)
    const removed = previous - newCount

    let muteRemoved = false
    if (
        removedLevelsHadMute(warnCfg, previous, newCount) &&
        (await warnRepo.hasWarnMuteActive(guildId, targetUser.id))
    ) {
        muteRemoved = await tryRemoveWarnMute(
            interaction.guild,
            targetUser,
            interaction.user.tag,
        )
    }

    await sendModerationLogs({
        interaction,
        action: 'unwarn',
        targetUser,
        reason,
        extraFields: {
            'Było warnów': `${previous}/${maxWarns}`,
            'Jest warnów': `${newCount}/${maxWarns}`,
            'Zdjęto': String(removed),
            ...(muteRemoved ? { Wyciszenie: 'Zdjęte (z warna)' } : {}),
        },
    })

    const summary =
        newCount === 0
            ? `Zresetowano ostrzeżenia użytkownika ${targetUser.tag} (**${previous}** → **0**).`
            : `Zdjęto **${removed}** ostrzeżeń u ${targetUser.tag} (**${previous}** → **${newCount}**).`

    const dmEnabled = modCfg.dm?.unwarn === true
    if (dmEnabled) {
        try {
            await targetUser.send({
                content: [
                    `Twoje ostrzeżenia na serwerze **${interaction.guild.name}** zostały zmienione.`,
                    `Było: **${previous}**, jest: **${newCount}**.`,
                    `Powód: ${reason}`,
                    `Moderator: ${interaction.user.tag}`,
                ].join('\n'),
            })
        } catch {
            // opcjonalne DM — nie przerywaj komendy
        }
    }

    const muteNote = muteRemoved
        ? '\nZdjęto też **wyciszenie** nałożone przez warn.'
        : '\n*Nie cofa to bana na Discordzie — tylko licznik w bazie (oraz mute z warna, jeśli dotyczy).*'

    await interaction.editReply({
        content: `${summary}${muteNote}`,
    })
}
