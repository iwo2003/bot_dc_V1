import {
    ActionRowBuilder,
    AttachmentBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    EmbedBuilder,
    ModalBuilder,
    PermissionFlagsBits,
    StringSelectMenuBuilder,
    TextInputBuilder,
    TextInputStyle,
} from 'discord.js'
import { consola } from 'consola'
import { getPool } from '../../db/client.js'
import * as ticketRepo from '../../db/tickets.repo.js'
import { getTicketsConfig } from '../../config/load-config.js'
import {
    buildTicketTranscript,
    deleteTranscriptFile,
} from './ticket-transcript.service.js'

const PREFIX = 'ticket'

/**
 * @param {string} action
 * @param {string} [suffix]
 */
function cid(action, suffix = '') {
    return suffix ? `${PREFIX}:${action}:${suffix}` : `${PREFIX}:${action}`
}

/**
 * @param {import('discord.js').BaseInteraction} interaction
 * @param {string} content
 */
async function replyEphemeral(interaction, content) {
    const payload = { content, ephemeral: true }
    if (interaction.replied || interaction.deferred) {
        await interaction.followUp(payload)
    } else {
        await interaction.reply(payload)
    }
}

function assertDatabase() {
    if (!getPool()) {
        throw new Error(
            'System ticketów wymaga MySQL. Ustaw `DB_HOST` i pozostałe zmienne w `.env`.',
        )
    }
}

/**
 * @param {object} cfg
 * @param {string} ticketId
 */
function findTicketType(cfg, ticketId) {
    return cfg.tickets?.find((t) => t.id === ticketId) ?? null
}

/**
 * @param {import('discord.js').GuildMember} member
 * @param {object} cfg
 */
function isStaff(member, cfg) {
    if (!member) return false
    if (member.permissions.has(PermissionFlagsBits.Administrator)) return true
    return cfg.staffRoleIds?.some((id) => member.roles.cache.has(id)) ?? false
}

/**
 * @param {string} template
 * @param {import('discord.js').User} user
 */
function renderChannelName(template, user) {
    return (template || 'ticket-{user}')
        .replace(/\{user\}/g, user.username.toLowerCase().replace(/[^a-z0-9]/g, ''))
        .replace(/\{id\}/g, user.id.slice(-4))
        .slice(0, 100)
}

/**
 * Buduje embed i menu wyboru ticketów (panel startowy).
 * @param {object} cfg
 */
export function buildTicketPanelPayload(cfg) {
    const panel = cfg.panel ?? {}
    const options = (cfg.tickets ?? []).slice(0, 25).map((t) => ({
        label: t.label.slice(0, 100),
        description: (t.description ?? '').slice(0, 100),
        value: t.id,
        emoji: t.emoji || undefined,
    }))

    const embed = new EmbedBuilder()
        .setTitle(panel.title ?? 'Centrum zgłoszeń')
        .setDescription(panel.description ?? 'Wybierz kategorię z menu.')
        .setColor(panel.color ?? 0x5865f2)
        .setTimestamp()

    if (panel.footer) embed.setFooter({ text: panel.footer })

    const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(cid('select'))
            .setPlaceholder('Wybierz typ zgłoszenia...')
            .addOptions(options),
    )

    return { embeds: [embed], components: [row] }
}

/**
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 */
export async function sendTicketPanel(interaction) {
    assertDatabase()

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({
            content: 'Tylko **administrator** może wysłać panel ticketów.',
            ephemeral: true,
        })
    }

    const cfg = await getTicketsConfig()
    if (!cfg.enabled) {
        return interaction.reply({
            content: 'System ticketów jest wyłączony w `tickets.json`.',
            ephemeral: true,
        })
    }

    if (!cfg.tickets?.length) {
        return interaction.reply({
            content: 'Brak zdefiniowanych typów ticketów w `tickets.json`.',
            ephemeral: true,
        })
    }

    const payload = buildTicketPanelPayload(cfg)
    await interaction.reply({ content: 'Panel ticketów wysłany.', ephemeral: true })
    await interaction.channel.send(payload)
}

/**
 * @param {import('discord.js').StringSelectMenuInteraction} interaction
 */
async function handleTicketSelect(interaction) {
    const cfg = await getTicketsConfig()
    const ticketId = interaction.values[0]
    const ticketType = findTicketType(cfg, ticketId)

    if (!ticketType) {
        return replyEphemeral(interaction, 'Nieznany typ ticketu.')
    }

    const questions = (ticketType.questions ?? []).slice(0, 5)
    if (questions.length === 0) {
        return replyEphemeral(interaction, 'Ten typ ticketu nie ma pytań w configu.')
    }

    const modal = new ModalBuilder()
        .setCustomId(cid('modal', ticketId))
        .setTitle(ticketType.label.slice(0, 45))

    for (const q of questions) {
        const style =
            q.style === 'paragraph' ? TextInputStyle.Paragraph : TextInputStyle.Short
        modal.addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId(q.custom_id)
                    .setLabel(q.label.slice(0, 45))
                    .setStyle(style)
                    .setPlaceholder((q.placeholder ?? '').slice(0, 100))
                    .setRequired(true)
                    .setMaxLength(style === TextInputStyle.Paragraph ? 1000 : 200),
            ),
        )
    }

    await interaction.showModal(modal)

    // Reset menu na panelu — można wybrać tę samą opcję ponownie
    try {
        const panelPayload = buildTicketPanelPayload(cfg)
        await interaction.message.edit({
            embeds: panelPayload.embeds,
            components: panelPayload.components,
        })
    } catch {
        // panel mógł zostać usunięty — nie przerywaj tworzenia ticketu
    }
}

/**
 * @param {import('discord.js').ModalSubmitInteraction} interaction
 * @param {string} ticketId
 */
async function handleTicketModalSubmit(interaction, ticketId) {
    assertDatabase()

    const cfg = await getTicketsConfig()
    const ticketType = findTicketType(cfg, ticketId)
    if (!ticketType) {
        return replyEphemeral(interaction, 'Nieznany typ ticketu.')
    }

    const guild = interaction.guild
    const member = interaction.member
    if (!guild || !member) {
        return replyEphemeral(interaction, 'Tickety działają tylko na serwerze.')
    }

    const openCount = await ticketRepo.countOpenTicketsForUser(guild.id, interaction.user.id)
    if (openCount > 0) {
        return replyEphemeral(
            interaction,
            'Masz już **otwarty ticket**. Zamknij go, zanim utworzysz nowy.',
        )
    }

    if (!ticketType.category_id?.trim()) {
        return replyEphemeral(
            interaction,
            `Brak \`category_id\` dla typu **${ticketType.label}** w tickets.json.`,
        )
    }

    await interaction.deferReply({ ephemeral: true })

    const answers = {}
    for (const q of ticketType.questions ?? []) {
        answers[q.custom_id] = interaction.fields.getTextInputValue(q.custom_id)
    }

    const overwrites = [
        { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
        {
            id: interaction.user.id,
            allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.AttachFiles,
            ],
        },
        {
            id: guild.members.me.id,
            allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.ManageChannels,
            ],
        },
    ]

    for (const roleId of cfg.staffRoleIds ?? []) {
        overwrites.push({
            id: roleId,
            allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.ManageMessages,
            ],
        })
    }

    const channelName = renderChannelName(cfg.channelNameTemplate, interaction.user)

    const channel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: ticketType.category_id.trim(),
        topic: `Ticket ${ticketType.label} — ${interaction.user.tag}`,
        permissionOverwrites: overwrites,
        reason: `Ticket ${ticketType.label} — ${interaction.user.tag}`,
    })

    await ticketRepo.insertTicket({
        channelId: channel.id,
        guildId: guild.id,
        userId: interaction.user.id,
        ticketType: ticketId,
    })

    const welcome = cfg.welcome ?? {}
    const welcomeEmbed = new EmbedBuilder()
        .setTitle(
            (welcome.title ?? 'Ticket — {type}').replace('{type}', ticketType.label),
        )
        .setDescription(
            (welcome.description ?? 'Witaj {user}!')
                .replace('{user}', `${interaction.user}`)
                .replace('{type}', ticketType.label),
        )
        .setColor(welcome.color ?? cfg.panel?.color ?? 0x5865f2)
        .setTimestamp()

    const answerFields = (ticketType.questions ?? []).map((q) => ({
        name: q.label,
        value: (answers[q.custom_id] || '—').slice(0, 1024),
        inline: false,
    }))
    welcomeEmbed.addFields(...answerFields)

    const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(cid('claim', channel.id))
            .setLabel('Przyjmij')
            .setEmoji('🙋‍♂️')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId(cid('close', channel.id))
            .setLabel('Zamknij')
            .setEmoji('🔒')
            .setStyle(ButtonStyle.Danger),
    )

    await channel.send({
        content: `${interaction.user}`,
        embeds: [welcomeEmbed],
        components: [buttons],
    })

    await interaction.editReply({
        content: `Ticket utworzony: ${channel}`,
    })

    consola.info(`[tickets] Utworzono ${channel.name} (${ticketType.id}) — ${interaction.user.tag}`)
}

/**
 * @param {import('discord.js').ButtonInteraction} interaction
 * @param {string} channelId
 */
async function handleTicketClaim(interaction, channelId) {
    assertDatabase()

    const cfg = await getTicketsConfig()
    if (!isStaff(interaction.member, cfg)) {
        return replyEphemeral(interaction, 'Tylko **staff** może przyjąć ticket.')
    }

    const ticket = await ticketRepo.getTicketByChannel(channelId)
    if (!ticket) {
        return replyEphemeral(interaction, 'Ten ticket nie istnieje w bazie.')
    }

    if (ticket.claimed_by) {
        return replyEphemeral(
            interaction,
            `Ticket został już przyjęty przez <@${ticket.claimed_by}>.`,
        )
    }

    await ticketRepo.claimTicket(channelId, interaction.user.id)

    const disabledRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(cid('claim', channelId))
            .setLabel(`Przyjęty: ${interaction.user.username}`)
            .setEmoji('🙋‍♂️')
            .setStyle(ButtonStyle.Success)
            .setDisabled(true),
        new ButtonBuilder()
            .setCustomId(cid('close', channelId))
            .setLabel('Zamknij')
            .setEmoji('🔒')
            .setStyle(ButtonStyle.Danger),
    )

    await interaction.update({ components: [disabledRow] })
    await interaction.followUp({
        content: `🙋‍♂️ Ticket przejął **${interaction.user.tag}**.`,
    })

    consola.info(`[tickets] Przyjęto ${channelId} przez ${interaction.user.tag}`)
}

/**
 * @param {import('discord.js').ButtonInteraction} interaction
 * @param {string} channelId
 */
async function handleTicketClose(interaction, channelId) {
    assertDatabase()

    const cfg = await getTicketsConfig()
    if (!isStaff(interaction.member, cfg)) {
        return replyEphemeral(interaction, 'Tylko **staff** może zamknąć ticket.')
    }

    const ticket = await ticketRepo.getTicketByChannel(channelId)
    if (!ticket) {
        return replyEphemeral(interaction, 'Ten ticket nie istnieje w bazie.')
    }

    const channel = interaction.channel
    if (!channel?.isTextBased()) {
        return replyEphemeral(interaction, 'Nie znaleziono kanału ticketu.')
    }

    await interaction.deferReply()

    const ticketType = findTicketType(cfg, ticket.ticket_type)
    const ticketLabel = ticketType?.label ?? ticket.ticket_type

    let creator
    try {
        creator = await interaction.client.users.fetch(ticket.user_id)
    } catch {
        creator = { tag: ticket.user_id, id: ticket.user_id }
    }

    let transcriptPath = null
    let transcriptName = null

    try {
        const { filePath, fileName } = await buildTicketTranscript({
            channel,
            ticket,
            ticketLabel,
            creator,
        })
        transcriptPath = filePath
        transcriptName = fileName

        const logChannelId = cfg.transcriptLogChannelId?.trim()
        if (!logChannelId) {
            throw new Error('Brak `transcriptLogChannelId` w tickets.json.')
        }

        const logChannel = await interaction.guild.channels.fetch(logChannelId).catch(() => null)
        if (!logChannel?.isTextBased()) {
            throw new Error('Kanał logów transkrypcji jest nieprawidłowy.')
        }

        const logEmbed = new EmbedBuilder()
            .setColor(0xed4245)
            .setTitle('Ticket zamknięty')
            .addFields(
                { name: 'Typ', value: ticketLabel, inline: true },
                { name: 'Twórca', value: `${creator.tag ?? creator.id}`, inline: true },
                { name: 'Zamknął', value: interaction.user.tag, inline: true },
                {
                    name: 'Przyjęty przez',
                    value: ticket.claimed_by ? `<@${ticket.claimed_by}>` : '—',
                    inline: true,
                },
            )
            .setTimestamp()

        const attachment = new AttachmentBuilder(filePath, { name: fileName })
        await logChannel.send({ embeds: [logEmbed], files: [attachment] })
    } catch (e) {
        consola.error('[tickets] transcript:', e.message ?? e)
        await interaction.editReply({
            content: `Błąd transkrypcji: ${e.message ?? e}`,
        })
        deleteTranscriptFile(transcriptPath)
        return
    }

    await ticketRepo.markTicketClosed(channelId)
    await ticketRepo.deleteTicket(channelId)
    deleteTranscriptFile(transcriptPath)

    const delay = Math.max(1000, Number(cfg.closeDelayMs) || 5000)
    await interaction.editReply({
        content: `🔒 Ticket zamknięty. Transkrypcja wysłana na kanał logów. Kanał zostanie usunięty za ${delay / 1000}s.`,
    })

    setTimeout(async () => {
        try {
            await channel.delete('Ticket zamknięty — auto-usunięcie')
            consola.info(`[tickets] Usunięto kanał ${channelId}`)
        } catch (e) {
            consola.warn('[tickets] delete channel:', e.message ?? e)
        }
    }, delay)
}

/**
 * Obsługa interakcji ticketów (select, modal, przyciski).
 * @param {import('discord.js').BaseInteraction} interaction
 */
export async function handleTicketInteraction(interaction) {
    const customId = interaction.customId
    if (!customId?.startsWith(`${PREFIX}:`)) return false

    try {
        assertDatabase()

        if (interaction.isStringSelectMenu() && customId === cid('select')) {
            await handleTicketSelect(interaction)
            return true
        }

        if (interaction.isModalSubmit() && customId.startsWith(`${PREFIX}:modal:`)) {
            const ticketId = customId.slice(`${PREFIX}:modal:`.length)
            await handleTicketModalSubmit(interaction, ticketId)
            return true
        }

        if (interaction.isButton()) {
            if (customId.startsWith(`${PREFIX}:claim:`)) {
                const channelId = customId.slice(`${PREFIX}:claim:`.length)
                await handleTicketClaim(interaction, channelId)
                return true
            }
            if (customId.startsWith(`${PREFIX}:close:`)) {
                const channelId = customId.slice(`${PREFIX}:close:`.length)
                await handleTicketClose(interaction, channelId)
                return true
            }
        }
    } catch (e) {
        consola.error('[tickets] interaction:', e.message ?? e)
        if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
            await replyEphemeral(interaction, `Błąd: ${e.message ?? e}`)
        } else if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ content: `Błąd: ${e.message ?? e}` }).catch(() => {})
        }
    }

    return true
}

/**
 * @param {import('discord.js').Client} client
 */
export async function initTickets(client) {
    try {
        assertDatabase()
        const cfg = await getTicketsConfig()
        if (!cfg.enabled) {
            consola.info('[tickets] Wyłączone w tickets.json.')
            return
        }
        consola.success(
            `[tickets] Aktywne — ${cfg.tickets?.length ?? 0} typów, logi: ${cfg.transcriptLogChannelId || 'brak ID'}`,
        )
    } catch (e) {
        consola.warn('[tickets]', e.message ?? e)
    }
}
