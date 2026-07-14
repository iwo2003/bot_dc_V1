import { EmbedBuilder, parseEmoji, PermissionFlagsBits } from 'discord.js'
import { consola } from 'consola'
import { getPool } from '../../db/client.js'
import * as selfroleRepo from '../../db/selfrole.repo.js'

function assertDatabase() {
    if (!getPool()) {
        throw new Error(
            'System self-role wymaga MySQL. Ustaw `DB_HOST` i pozostałe zmienne w `.env`.',
        )
    }
}

/**
 * @param {string} input
 */
export function parseColorInput(input) {
    if (!input?.trim()) return 5793266
    const trimmed = input.trim()
    if (trimmed.startsWith('#')) {
        const hex = trimmed.slice(1)
        if (!/^[0-9a-fA-F]{6}$/.test(hex)) {
            throw new Error('Kolor musi być w formacie `#RRGGBB`.')
        }
        return parseInt(hex, 16)
    }
    const num = Number(trimmed)
    if (!Number.isInteger(num) || num < 0 || num > 0xffffff) {
        throw new Error('Kolor musi być `#RRGGBB` lub liczbą dziesiętną.')
    }
    return num
}

/**
 * @param {string} input
 * @param {import('discord.js').Guild} guild
 */
export function resolveEmojiInput(input, guild) {
    const trimmed = input.trim()
    const parsed = parseEmoji(trimmed)

    if (parsed?.id) {
        const custom = guild.emojis.cache.get(parsed.id)
        if (!custom) {
            throw new Error('Nie znaleziono tego emoji na serwerze.')
        }
        return {
            emojiKey: custom.id,
            emojiName: custom.name,
            emojiAnimated: custom.animated,
            reaction: custom,
        }
    }

    if (trimmed.startsWith(':') && trimmed.endsWith(':')) {
        const name = trimmed.slice(1, -1)
        const custom = guild.emojis.cache.find((e) => e.name === name)
        if (!custom) {
            throw new Error(`Nie znaleziono emoji :${name}: na serwerze.`)
        }
        return {
            emojiKey: custom.id,
            emojiName: custom.name,
            emojiAnimated: custom.animated,
            reaction: custom,
        }
    }

    if (!trimmed) {
        throw new Error('Podaj emoji (unicode lub :nazwa: / <:nazwa:id>).')
    }

    return {
        emojiKey: trimmed,
        emojiName: null,
        emojiAnimated: false,
        reaction: trimmed,
    }
}

/**
 * @param {object} entry
 */
export function formatEntryEmoji(entry) {
    if (entry.emoji_name) {
        return entry.emoji_animated
            ? `<a:${entry.emoji_name}:${entry.emoji_key}>`
            : `<:${entry.emoji_name}:${entry.emoji_key}>`
    }
    return entry.emoji_key
}

/**
 * @param {object} panel
 * @param {object[]} entries
 */
export function buildPanelEmbed(panel, entries) {
    const lines = entries.map(
        (entry) => `${formatEntryEmoji(entry)} — <@&${entry.role_id}>`,
    )

    let description = ''
    if (panel.intro?.trim()) {
        description += `${panel.intro.trim()}\n\n`
    }
    description += lines.length
        ? lines.join('\n')
        : '_Brak ról — użyj `/selfrole add`, aby dodać pierwszą rolę._'

    return new EmbedBuilder()
        .setTitle(panel.title)
        .setDescription(description)
        .setColor(Number(panel.color))
}

/**
 * @param {import('discord.js').Message} message
 * @param {object[]} entries
 */
export async function syncPanelReactions(message, entries) {
    const botReactions = [...message.reactions.cache.values()].filter((r) =>
        r.me,
    )
    for (const reaction of botReactions) {
        try {
            await reaction.users.remove(message.client.user.id)
        } catch {
            // ignoruj
        }
    }

    for (const entry of entries) {
        const emoji = entry.emoji_name
            ? entry.emoji_animated
                ? `<a:${entry.emoji_name}:${entry.emoji_key}>`
                : `<:${entry.emoji_name}:${entry.emoji_key}>`
            : entry.emoji_key
        try {
            await message.react(emoji)
        } catch (e) {
            consola.warn(
                `[selfrole] Nie udało się dodać reakcji ${emoji}:`,
                e.message ?? e,
            )
        }
    }
}

/**
 * @param {import('discord.js').Guild} guild
 * @param {import('discord.js').Role} role
 */
function assertAssignableRole(guild, role) {
    if (role.managed) {
        throw new Error('Nie można przypisać roli zarządzanej przez integrację.')
    }
    const me = guild.members.me
    if (!me?.permissions.has(PermissionFlagsBits.ManageRoles)) {
        throw new Error('Bot nie ma uprawnienia **Zarządzaj rolami**.')
    }
    if (role.position >= me.roles.highest.position) {
        throw new Error(
            'Rola musi być **niżej** niż najwyższa rola bota na liście ról.',
        )
    }
}

/**
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 */
export async function createSelfRolePanel(interaction) {
    assertDatabase()

    const title = interaction.options.getString('tytul', true)
    const intro =
        interaction.options.getString('opis') ??
        'Zareaguj reakcją pod spodem, aby odebrać role:'
    const color = parseColorInput(interaction.options.getString('kolor') ?? '')

    const panelData = {
        title,
        intro,
        color,
        guild_id: interaction.guildId,
        channel_id: interaction.channelId,
        message_id: '0',
    }

    const embed = buildPanelEmbed(panelData, [])
    const message = await interaction.channel.send({ embeds: [embed] })

    const panelId = await selfroleRepo.insertPanel({
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        messageId: message.id,
        title,
        intro,
        color,
    })

    await interaction.reply({
        content: `✅ Utworzono panel self-role (ID wiadomości: \`${message.id}\`, panel #${panelId}).\nDodaj role: \`/selfrole add wiadomosc:${message.id} rola:@Rola emoji:🎮\``,
        ephemeral: true,
    })
}

/**
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 */
export async function addSelfRoleEntry(interaction) {
    assertDatabase()

    const messageId = interaction.options.getString('wiadomosc', true)
    const role = interaction.options.getRole('rola', true)
    const emojiInput = interaction.options.getString('emoji', true)

    const panel = await selfroleRepo.getPanelByMessageId(messageId)
    if (!panel || panel.guild_id !== interaction.guildId) {
        throw new Error('Nie znaleziono panelu o podanym ID wiadomości na tym serwerze.')
    }

    assertAssignableRole(interaction.guild, role)

    const emoji = resolveEmojiInput(emojiInput, interaction.guild)
    const entries = await selfroleRepo.listEntriesByPanel(panel.id)

    if (entries.some((e) => e.role_id === role.id)) {
        throw new Error('Ta rola jest już na panelu.')
    }
    if (entries.some((e) => e.emoji_key === emoji.emojiKey)) {
        throw new Error('To emoji jest już używane na tym panelu.')
    }

    await selfroleRepo.insertEntry({
        panelId: panel.id,
        roleId: role.id,
        emojiKey: emoji.emojiKey,
        emojiName: emoji.emojiName,
        emojiAnimated: emoji.emojiAnimated,
        sortOrder: entries.length,
    })

    const updatedEntries = await selfroleRepo.listEntriesByPanel(panel.id)
    const channel = await interaction.guild.channels.fetch(panel.channel_id)
    if (!channel?.isTextBased()) {
        throw new Error('Kanał panelu nie istnieje lub nie obsługuje wiadomości.')
    }

    const message = await channel.messages.fetch(panel.message_id)
    const embed = buildPanelEmbed(panel, updatedEntries)
    await message.edit({ embeds: [embed] })
    await message.react(emoji.reaction)

    await interaction.reply({
        content: `✅ Dodano ${formatEntryEmoji({
            emoji_key: emoji.emojiKey,
            emoji_name: emoji.emojiName,
            emoji_animated: emoji.emojiAnimated ? 1 : 0,
        })} → ${role} na panel \`${messageId}\`.`,
        ephemeral: true,
    })
}

/**
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 */
export async function removeSelfRoleEntry(interaction) {
    assertDatabase()

    const messageId = interaction.options.getString('wiadomosc', true)
    const role = interaction.options.getRole('rola', true)

    const panel = await selfroleRepo.getPanelByMessageId(messageId)
    if (!panel || panel.guild_id !== interaction.guildId) {
        throw new Error('Nie znaleziono panelu o podanym ID wiadomości na tym serwerze.')
    }

    const entries = await selfroleRepo.listEntriesByPanel(panel.id)
    const entry = entries.find((e) => e.role_id === role.id)
    if (!entry) {
        throw new Error('Ta rola nie jest przypisana do tego panelu.')
    }

    await selfroleRepo.deleteEntryByPanelAndRole(panel.id, role.id)
    const updatedEntries = entries.filter((e) => e.role_id !== role.id)

    const channel = await interaction.guild.channels.fetch(panel.channel_id)
    if (!channel?.isTextBased()) {
        throw new Error('Kanał panelu nie istnieje.')
    }

    const message = await channel.messages.fetch(panel.message_id)
    await message.edit({ embeds: [buildPanelEmbed(panel, updatedEntries)] })
    await syncPanelReactions(message, updatedEntries)

    await interaction.reply({
        content: `✅ Usunięto ${role} z panelu \`${messageId}\`.`,
        ephemeral: true,
    })
}

/**
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 */
export async function refreshSelfRolePanel(interaction) {
    assertDatabase()

    const messageId = interaction.options.getString('wiadomosc', true)
    const panel = await selfroleRepo.getPanelByMessageId(messageId)
    if (!panel || panel.guild_id !== interaction.guildId) {
        throw new Error('Nie znaleziono panelu o podanym ID wiadomości na tym serwerze.')
    }

    const entries = await selfroleRepo.listEntriesByPanel(panel.id)
    const channel = await interaction.guild.channels.fetch(panel.channel_id)
    if (!channel?.isTextBased()) {
        throw new Error('Kanał panelu nie istnieje.')
    }

    const message = await channel.messages.fetch(panel.message_id)
    await message.edit({ embeds: [buildPanelEmbed(panel, entries)] })
    await syncPanelReactions(message, entries)

    await interaction.reply({
        content: `✅ Odświeżono panel \`${messageId}\` (${entries.length} ról).`,
        ephemeral: true,
    })
}

/**
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 */
export async function deleteSelfRolePanel(interaction) {
    assertDatabase()

    const messageId = interaction.options.getString('wiadomosc', true)
    const panel = await selfroleRepo.getPanelByMessageId(messageId)
    if (!panel || panel.guild_id !== interaction.guildId) {
        throw new Error('Nie znaleziono panelu o podanym ID wiadomości na tym serwerze.')
    }

    const channel = await interaction.guild.channels.fetch(panel.channel_id)
    if (channel?.isTextBased()) {
        try {
            const message = await channel.messages.fetch(panel.message_id)
            await message.delete()
        } catch {
            // wiadomość mogła zostać usunięta ręcznie
        }
    }

    await selfroleRepo.deletePanel(panel.id)

    await interaction.reply({
        content: `✅ Usunięto panel \`${messageId}\` z bazy i wiadomość z kanału.`,
        ephemeral: true,
    })
}

/**
 * @param {import('discord.js').MessageReaction | import('discord.js').PartialMessageReaction} reaction
 * @param {import('discord.js').User | import('discord.js').PartialUser} user
 * @param {boolean} addRole
 */
export async function handleSelfRoleReaction(reaction, user, addRole) {
    if (user.bot || !reaction.message.guild) return

    try {
        if (reaction.partial) await reaction.fetch()
        if (reaction.message.partial) await reaction.message.fetch()
        if (user.partial) await user.fetch()
    } catch {
        return
    }

    if (!getPool()) return

    const match = await selfroleRepo.findEntryByMessageAndEmoji(
        reaction.message.id,
        reaction.emoji,
    )
    if (!match) return

    const guild = reaction.message.guild
    const member = await guild.members.fetch(user.id).catch(() => null)
    if (!member) return

    const role = guild.roles.cache.get(match.entry.role_id)
    if (!role) {
        consola.warn(`[selfrole] Rola ${match.entry.role_id} nie istnieje.`)
        return
    }

    try {
        assertAssignableRole(guild, role)
    } catch (e) {
        consola.warn('[selfrole]', e.message ?? e)
        return
    }

    try {
        if (addRole) {
            if (!member.roles.cache.has(role.id)) {
                await member.roles.add(role, 'Self-role — reakcja')
            }
        } else if (member.roles.cache.has(role.id)) {
            await member.roles.remove(role, 'Self-role — usunięcie reakcji')
        }
    } catch (e) {
        consola.warn(`[selfrole] ${user.tag}:`, e.message ?? e)
    }
}

/**
 * @param {import('discord.js').Client} client
 */
export async function initSelfRole(client) {
    if (!getPool()) {
        consola.warn('[selfrole] Brak MySQL — moduł self-role wyłączony.')
        return
    }

    const guildId = process.env.GUILD_ID
    if (!guildId) {
        consola.info('[selfrole] MySQL OK — panele zarządzane komendą /selfrole.')
        return
    }

    const count = await selfroleRepo.countPanelsByGuild(guildId)
    consola.success(`[selfrole] Aktywne — ${count} panel(i) w bazie dla tej gildii.`)
}
