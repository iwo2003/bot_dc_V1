import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    ModalBuilder,
    StringSelectMenuBuilder,
    TextInputBuilder,
    TextInputStyle,
} from 'discord.js'
import { consola } from 'consola'
import { getAutoChannelConfig } from '../config/load-auto-channel.js'
import {
    applyOwnerPermissions,
    getActiveChannelMeta,
    isActiveTempChannel,
    transferChannelOwnership,
    unregisterTempChannel,
} from './auto-channel.service.js'

const PREFIX = 'ac'

/** Kody Discord API — interakcja/wiadomość już nieważna (np. po usunięciu kanału) */
const IGNORABLE_INTERACTION_CODES = new Set([10003, 10008, 10062, 40060])

/**
 * @param {unknown} e
 */
function isIgnorableInteractionError(e) {
    const err = /** @type {{ code?: number, message?: string }} */ (e)
    if (IGNORABLE_INTERACTION_CODES.has(err?.code ?? 0)) return true
    const msg = String(err?.message ?? e)
    return (
        msg.includes('Unknown interaction') ||
        msg.includes('Unknown Message') ||
        msg.includes('Unknown Channel')
    )
}

/**
 * @param {import('discord.js').MessageComponentInteraction} interaction
 * @param {import('discord.js').InteractionUpdateOptions} payload
 */
async function safeInteractionUpdate(interaction, payload) {
    try {
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply(payload)
        } else {
            await interaction.update(payload)
        }
    } catch (e) {
        if (!isIgnorableInteractionError(e)) throw e
    }
}

/**
 * @param {import('discord.js').BaseInteraction} interaction
 * @param {string} content
 */
async function replyEphemeral(interaction, content) {
    const payload = { content, ephemeral: true }
    try {
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp(payload)
        } else {
            await interaction.reply(payload)
        }
    } catch (e) {
        if (!isIgnorableInteractionError(e)) throw e
    }
}

/**
 * @param {string} action
 * @param {string} channelId
 * @param {string} [suffix]
 */
function cid(action, channelId, suffix = '') {
    const id = suffix ? `${action}:${suffix}:${channelId}` : `${action}:${channelId}`
    return `${PREFIX}:${id}`
}

/**
 * @param {string} customId
 */
function parseCustomId(customId) {
    if (!customId.startsWith(`${PREFIX}:`)) return null
    const parts = customId.slice(PREFIX.length + 1).split(':')
    if (parts.length < 2) return null
    return {
        action: parts[0],
        channelId: parts[parts.length - 1],
        sub: parts.length > 2 ? parts.slice(1, -1).join(':') : null,
    }
}

/**
 * @param {import('discord.js').BaseInteraction} interaction
 * @param {string} channelId
 */
async function verifyOwner(interaction, channelId) {
    if (!isActiveTempChannel(channelId)) {
        await replyEphemeral(interaction, 'Ten kanał nie jest już aktywnym kanałem tymczasowym.')
        return false
    }

    const meta = getActiveChannelMeta(channelId)
    if (!meta || interaction.user.id !== meta.ownerId) {
        await replyEphemeral(interaction, 'Tylko **właściciel** kanału może używać tego panelu.')
        return false
    }

    return true
}

/**
 * @param {import('discord.js').Guild} guild
 * @param {string} channelId
 */
async function fetchVoiceChannel(guild, channelId) {
    const channel = await guild.channels.fetch(channelId).catch(() => null)
    if (!channel?.isVoiceBased()) return null
    return channel
}

/**
 * @param {import('discord.js').VoiceBasedChannel} channel
 * @param {import('discord.js').GuildMember} owner
 * @param {import('../config/auto-channel.example.js').default} cfg
 */
function buildPanelEmbed(channel, owner, cfg) {
    const meta = getActiveChannelMeta(channel.id)
    const limit = channel.userLimit ?? 0

    return new EmbedBuilder()
        .setColor(cfg.panel?.embedColor ?? 0x5865f2)
        .setTitle('Panel kanału głosowego')
        .setDescription(
            `Witaj ${owner}! Zarządzaj swoim kanałem **${channel.name}** poniżej.\n` +
                'Panel jest widoczny tylko dla Ciebie jako właściciela.',
        )
        .addFields(
            { name: 'Właściciel', value: `${owner}`, inline: true },
            { name: 'Limit osób', value: limit === 0 ? 'Brak' : String(limit), inline: true },
            {
                name: 'Status',
                value: [
                    meta?.locked ? '🔒 Zablokowany' : '🔓 Otwarty',
                    meta?.hidden ? '👁 Ukryty' : '👁‍🗨 Widoczny',
                ].join(' · '),
                inline: false,
            },
        )
        .setFooter({ text: 'Tylko właściciel może używać przycisków i menu.' })
        .setTimestamp()
}

/**
 * @param {string} channelId
 */
function buildPanelComponents(channelId) {
    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(cid('lock', channelId))
            .setLabel('Zablokuj')
            .setEmoji('🔒')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(cid('unlock', channelId))
            .setLabel('Odblokuj')
            .setEmoji('🔓')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(cid('hide', channelId))
            .setLabel('Ukryj')
            .setEmoji('👁')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(cid('show', channelId))
            .setLabel('Pokaż')
            .setEmoji('👁‍🗨')
            .setStyle(ButtonStyle.Secondary),
    )

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(cid('rename', channelId))
            .setLabel('Zmień nazwę')
            .setEmoji('✏️')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId(cid('limit', channelId))
            .setLabel('Ustaw limit')
            .setEmoji('👥')
            .setStyle(ButtonStyle.Primary),
    )

    const row3 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(cid('kick', channelId))
            .setLabel('Wyrzuć')
            .setEmoji('👢')
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId(cid('transfer', channelId))
            .setLabel('Przekaż właściciela')
            .setEmoji('👑')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId(cid('delete', channelId))
            .setLabel('Usuń kanał')
            .setEmoji('🗑')
            .setStyle(ButtonStyle.Danger),
    )

    return [row1, row2, row3]
}

/**
 * @param {import('discord.js').VoiceBasedChannel} voiceChannel
 * @param {import('discord.js').GuildMember} owner
 * @param {import('../config/auto-channel.example.js').default} cfg
 */
export async function sendOwnerPanel(voiceChannel, owner, cfg) {
    if (cfg.panel?.enabled === false) return null

    const embed = buildPanelEmbed(voiceChannel, owner, cfg)
    const components = buildPanelComponents(voiceChannel.id)
    const payload = { embeds: [embed], components }

    if (voiceChannel.isSendable()) {
        try {
            const msg = await voiceChannel.send(payload)
            consola.info(`[auto-channel] Wysłano panel na kanale ${voiceChannel.name}`)
            return msg
        } catch (e) {
            consola.warn('[auto-channel] panel send:', e.message ?? e)
        }
    } else {
        consola.warn(
            '[auto-channel] Kanał głosowy nie obsługuje wiadomości — włącz **Text in Voice** na serwerze Discord.',
        )
    }

    if (cfg.panel?.fallbackDm !== false) {
        try {
            await owner.send({
                content:
                    'Nie udało się wysłać panelu w chacie kanału głosowego (włącz Text in Voice). Oto panel:',
                ...payload,
            })
            consola.info(`[auto-channel] Panel wysłany DM do ${owner.user.tag}`)
            return null
        } catch {
            consola.warn(`[auto-channel] Nie udało się wysłać panelu DM do ${owner.user.tag}`)
        }
    }

    return null
}

/**
 * @param {import('discord.js').ButtonInteraction} interaction
 * @param {string} channelId
 */
async function showRenameModal(interaction, channelId) {
    const modal = new ModalBuilder()
        .setCustomId(cid('rename_submit', channelId))
        .setTitle('Zmiana nazwy kanału')
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('name')
                    .setLabel('Nowa nazwa (max 100 znaków)')
                    .setStyle(TextInputStyle.Short)
                    .setMinLength(1)
                    .setMaxLength(100)
                    .setRequired(true),
            ),
        )

    await interaction.showModal(modal)
}

/**
 * @param {import('discord.js').ButtonInteraction} interaction
 * @param {string} channelId
 */
async function showLimitModal(interaction, channelId) {
    const modal = new ModalBuilder()
        .setCustomId(cid('limit_submit', channelId))
        .setTitle('Limit osób na kanale')
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('limit')
                    .setLabel('Limit (0 = bez limitu, max 99)')
                    .setStyle(TextInputStyle.Short)
                    .setMinLength(1)
                    .setMaxLength(2)
                    .setPlaceholder('np. 5 lub 0')
                    .setRequired(true),
            ),
        )

    await interaction.showModal(modal)
}

/**
 * @param {import('discord.js').VoiceBasedChannel} channel
 * @param {string} ownerId
 */
function getKickableMembers(channel, ownerId) {
    return [...channel.members.values()].filter(
        (m) => !m.user.bot && m.id !== ownerId,
    )
}

/**
 * @param {import('discord.js').ButtonInteraction} interaction
 * @param {import('discord.js').VoiceBasedChannel} channel
 * @param {string} channelId
 * @param {string} ownerId
 * @param {'kick'|'transfer'} mode
 */
async function showMemberSelect(interaction, channel, channelId, ownerId, mode) {
    const members = getKickableMembers(channel, ownerId)

    if (members.length === 0) {
        return replyEphemeral(
            interaction,
            mode === 'kick'
                ? 'Na kanale nie ma innych użytkowników do wyrzucenia.'
                : 'Na kanale nie ma nikogo, komu można przekazać właścicielstwo.',
        )
    }

    const action = mode === 'kick' ? 'kick_pick' : 'transfer_pick'
    const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(cid(action, channelId))
            .setPlaceholder(
                mode === 'kick' ? 'Wybierz użytkownika do wyrzucenia' : 'Wybierz nowego właściciela',
            )
            .addOptions(
                members.slice(0, 25).map((m) => ({
                    label: m.displayName.slice(0, 100),
                    description: m.user.tag.slice(0, 100),
                    value: m.id,
                })),
            ),
    )

    await interaction.reply({
        content:
            mode === 'kick'
                ? 'Wybierz użytkownika, którego chcesz wyrzucić z kanału:'
                : 'Wybierz użytkownika, któremu przekażesz właścicielstwo:',
        components: [row],
        ephemeral: true,
    })
}

/**
 * @param {import('discord.js').ButtonInteraction} interaction
 * @param {string} channelId
 */
async function showDeleteConfirm(interaction, channelId) {
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(cid('delete_confirm', channelId))
            .setLabel('Tak, usuń kanał')
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId(cid('delete_cancel', channelId))
            .setLabel('Anuluj')
            .setStyle(ButtonStyle.Secondary),
    )

    await interaction.reply({
        content: '**Na pewno** chcesz usunąć ten kanał? Tej operacji nie można cofnąć.',
        components: [row],
        ephemeral: true,
    })
}

/**
 * @param {import('discord.js').BaseInteraction} interaction
 */
export async function handleAutoChannelPanelInteraction(interaction) {
    const customId =
        interaction.customId ??
        (interaction.isModalSubmit() ? interaction.customId : null)

    if (!customId?.startsWith(`${PREFIX}:`)) return false

    const parsed = parseCustomId(customId)
    if (!parsed) return false

    const { action, channelId } = parsed

    if (action === 'delete_cancel') {
        await safeInteractionUpdate(interaction, {
            content: 'Anulowano usuwanie kanału.',
            components: [],
        })
        return true
    }

    if (!(await verifyOwner(interaction, channelId))) return true

    const cfg = await getAutoChannelConfig()
    const guild = interaction.guild
    if (!guild) {
        await replyEphemeral(interaction, 'Ta akcja działa tylko na serwerze.')
        return true
    }

    const channel = await fetchVoiceChannel(guild, channelId)
    if (!channel) {
        await replyEphemeral(interaction, 'Nie znaleziono kanału głosowego.')
        return true
    }

    const meta = getActiveChannelMeta(channelId)
    const everyone = guild.roles.everyone

    try {
        switch (action) {
            case 'lock': {
                await channel.permissionOverwrites.edit(everyone, { Connect: false })
                if (meta) meta.locked = true
                await replyEphemeral(interaction, '🔒 Kanał **zablokowany** — tylko osoby z dostępem mogą dołączyć.')
                break
            }
            case 'unlock': {
                await channel.permissionOverwrites.edit(everyone, {
                    ViewChannel: true,
                    Connect: true,
                })
                if (meta) {
                    meta.locked = false
                    meta.hidden = false
                }
                await replyEphemeral(interaction, '🔓 Kanał **odblokowany** — każdy może dołączyć.')
                break
            }
            case 'hide': {
                await channel.permissionOverwrites.edit(everyone, { ViewChannel: false })
                if (meta) meta.hidden = true
                await replyEphemeral(interaction, '👁 Kanał **ukryty** przed @everyone.')
                break
            }
            case 'show': {
                await channel.permissionOverwrites.edit(everyone, {
                    ViewChannel: true,
                    Connect: meta?.locked ? false : true,
                })
                if (meta) meta.hidden = false
                await replyEphemeral(interaction, '👁‍🗨 Kanał jest znowu **widoczny**.')
                break
            }
            case 'rename':
                await showRenameModal(interaction, channelId)
                break
            case 'limit':
                await showLimitModal(interaction, channelId)
                break
            case 'kick': {
                await showMemberSelect(interaction, channel, channelId, meta.ownerId, 'kick')
                break
            }
            case 'transfer': {
                await showMemberSelect(interaction, channel, channelId, meta.ownerId, 'transfer')
                break
            }
            case 'delete':
                await showDeleteConfirm(interaction, channelId)
                break
            case 'delete_confirm': {
                await safeInteractionUpdate(interaction, {
                    content: '🗑 Kanał został usunięty.',
                    components: [],
                })
                unregisterTempChannel(channelId)
                await channel
                    .delete('Usunięcie przez właściciela (panel auto-kanału)')
                    .catch((e) =>
                        consola.warn('[auto-channel] delete channel:', e.message ?? e),
                    )
                break
            }
            case 'rename_submit': {
                const name = interaction.fields.getTextInputValue('name').trim()
                if (!name) {
                    await replyEphemeral(interaction, 'Nazwa nie może być pusta.')
                    break
                }
                await channel.setName(name.slice(0, 100))
                await replyEphemeral(interaction, `✏️ Nazwa zmieniona na **${name.slice(0, 100)}**.`)
                break
            }
            case 'limit_submit': {
                const raw = interaction.fields.getTextInputValue('limit').trim()
                const num = Number.parseInt(raw, 10)
                if (Number.isNaN(num) || num < 0 || num > 99) {
                    await replyEphemeral(interaction, 'Podaj liczbę od **0** do **99** (0 = bez limitu).')
                    break
                }
                await channel.setUserLimit(num)
                await replyEphemeral(
                    interaction,
                    num === 0
                        ? '👥 Usunięto limit osób na kanale.'
                        : `👥 Limit ustawiony na **${num}** osób.`,
                )
                break
            }
            case 'kick_pick': {
                if (!interaction.isStringSelectMenu()) break
                const targetId = interaction.values[0]
                const target = await guild.members.fetch(targetId).catch(() => null)
                if (!target?.voice?.channelId || target.voice.channelId !== channelId) {
                    await safeInteractionUpdate(interaction, {
                        content: 'Użytkownik nie jest już na tym kanale.',
                        components: [],
                    })
                    break
                }
                await target.voice.disconnect('Wyrzucony przez właściciela kanału (panel)')
                await safeInteractionUpdate(interaction, {
                    content: `👢 Wyrzucono **${target.displayName}** z kanału.`,
                    components: [],
                })
                break
            }
            case 'transfer_pick': {
                if (!interaction.isStringSelectMenu()) break
                const newOwnerId = interaction.values[0]
                const newOwner = await guild.members.fetch(newOwnerId).catch(() => null)
                if (!newOwner?.voice?.channelId || newOwner.voice.channelId !== channelId) {
                    await safeInteractionUpdate(interaction, {
                        content: 'Wybrany użytkownik musi być na kanale głosowym.',
                        components: [],
                    })
                    break
                }

                await applyOwnerPermissions(channel, cfg, newOwner)
                transferChannelOwnership(channelId, newOwnerId)

                await safeInteractionUpdate(interaction, {
                    content: `👑 Przekazano właścicielstwo użytkownikowi **${newOwner.displayName}**.`,
                    components: [],
                })
                break
            }
            default:
                return false
        }
    } catch (e) {
        if (!isIgnorableInteractionError(e)) {
            consola.error('[auto-channel] panel:', action, e.message ?? e)
            await replyEphemeral(interaction, `Błąd: ${e.message ?? e}`)
        }
    }

    return true
}
