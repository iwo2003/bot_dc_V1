import { PermissionFlagsBits } from 'discord.js'
import { getModerationConfig } from '../config/load-moderation.js'

/** @type {Record<string, bigint | bigint[] | null>} */
export const MOD_COMMAND_PERMISSIONS = {
    ban: PermissionFlagsBits.BanMembers,
    kick: PermissionFlagsBits.KickMembers,
    mute: PermissionFlagsBits.ModerateMembers,
    unmute: PermissionFlagsBits.ModerateMembers,
    warn: [
        PermissionFlagsBits.ModerateMembers,
        PermissionFlagsBits.BanMembers,
    ],
    unwarn: PermissionFlagsBits.ModerateMembers,
}

export const ALL_MOD_COMMANDS = Object.keys(MOD_COMMAND_PERMISSIONS)

/**
 * Czy członek ma uprawnienie (z roli lub bezpośrednio).
 * @param {import('discord.js').GuildMember} member
 * @param {bigint} permission
 */
export function memberHasPermission(member, permission) {
    if (!member || !permission) return false

    if (member.permissions.has(PermissionFlagsBits.Administrator)) return true
    if (member.permissions.has(permission)) return true

    return member.roles.cache.some((role) =>
        role.permissions.has(permission),
    )
}

function listAllowsCommand(commands, commandName) {
    if (!Array.isArray(commands)) return false
    return commands.includes('all') || commands.includes(commandName)
}

/**
 * @param {import('discord.js').GuildMember} member
 * @param {bigint | bigint[]} discordPermission
 */
function memberHasAnyPermission(member, discordPermission) {
    if (!discordPermission) return false
    const list = Array.isArray(discordPermission)
        ? discordPermission
        : [discordPermission]
    return list.some((p) => memberHasPermission(member, p))
}

/**
 * @param {object} cfg
 * @param {import('discord.js').GuildMember} member
 * @param {string} commandName
 */
function hasConfigRoleCommand(cfg, member, commandName) {
    if (
        cfg.moderatorRoleIds?.some((roleId) => member.roles.cache.has(roleId))
    ) {
        return true
    }

    for (const entry of cfg.roleCommands ?? []) {
        if (
            entry?.roleId &&
            member.roles.cache.has(entry.roleId) &&
            listAllowsCommand(entry.commands, commandName)
        ) {
            return true
        }
    }

    return false
}

/**
 * @param {object} cfg
 * @param {string} userId
 * @param {string} commandName
 */
function hasConfigUserCommand(cfg, userId, commandName) {
    if (cfg.moderatorUserIds?.includes(userId)) return true

    for (const entry of cfg.userCommands ?? []) {
        if (
            entry?.userId === userId &&
            listAllowsCommand(entry.commands, commandName)
        ) {
            return true
        }
    }

    return false
}

/**
 * Dostęp wyłącznie z configu (roleCommands / userCommands / pełny dostęp).
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {string} commandName
 */
export async function hasConfigCommandAccess(interaction, commandName) {
    if (!interaction.inCachedGuild() || !interaction.member) return false

    const cfg = await getModerationConfig()
    return (
        hasConfigUserCommand(cfg, interaction.user.id, commandName) ||
        hasConfigRoleCommand(cfg, interaction.member, commandName)
    )
}

/**
 * 1. administratorzy
 * 2. role/osoby z pełnym dostępem (moderatorRoleIds / moderatorUserIds)
 * 3. role/osoby z przypisaną komendą (roleCommands / userCommands)
 * 4. rangi z odpowiednim uprawnieniem Discord
 *
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {string} commandName — ban | kick | mute | unmute | warn
 */
export async function hasCommandAccess(interaction, commandName) {
    if (!interaction.inCachedGuild() || !interaction.member) return false

    const cfg = await getModerationConfig()
    const member = interaction.member
    const userId = interaction.user.id
    const discordPermission = MOD_COMMAND_PERMISSIONS[commandName]

    if (!discordPermission) return false

    if (memberHasPermission(member, PermissionFlagsBits.Administrator)) {
        return true
    }

    if (hasConfigUserCommand(cfg, userId, commandName)) return true
    if (hasConfigRoleCommand(cfg, member, commandName)) return true

    if (memberHasAnyPermission(member, discordPermission)) return true

    return false
}

/**
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {string} commandName
 */
export async function assertCommandAccess(interaction, commandName) {
    const ok = await hasCommandAccess(interaction, commandName)
    if (!ok) {
        throw new Error(
            `Nie masz uprawnień do komendy /${commandName} (rola/osoba z configu, przypisana komenda lub uprawnienie Discord).`,
        )
    }
}

/** @deprecated Użyj hasCommandAccess */
export async function hasModeratorAccess(interaction, discordPermission) {
    if (!interaction.inCachedGuild() || !interaction.member) return false

    const cfg = await getModerationConfig()
    const member = interaction.member
    const userId = interaction.user.id

    if (cfg.moderatorUserIds?.includes(userId)) return true
    if (
        cfg.moderatorRoleIds?.some((roleId) => member.roles.cache.has(roleId))
    ) {
        return true
    }
    if (memberHasPermission(member, PermissionFlagsBits.Administrator)) {
        return true
    }
    if (discordPermission && memberHasAnyPermission(member, discordPermission)) {
        return true
    }
    return false
}

/** @deprecated Użyj assertCommandAccess */
export async function assertModeratorAccess(interaction, discordPermission) {
    const ok = await hasModeratorAccess(interaction, discordPermission)
    if (!ok) {
        throw new Error(
            'Nie masz uprawnień do tej komendy (rola z configu, ranga z uprawnieniem Discord lub administrator).',
        )
    }
}

export { PermissionFlagsBits }
