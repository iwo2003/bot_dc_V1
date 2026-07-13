import { EmbedBuilder, SlashCommandBuilder } from 'discord.js'
import { sendModerationLogs } from '../../../features/moderation-log.service.js'
import { getModerationConfig } from '../../../config/load-config.js'
import {
    MAX_DELETE_MESSAGE_SECONDS,
    assertNotSelf,
} from '../../../utils/moderation.util.js'
import {
    assertCommandAccess,
} from '../../../utils/permissions.util.js'

export default {
    cooldown: 2,
    data: new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Banuje użytkownika na serwerze.')
        .setDefaultMemberPermissions(0)
        .addUserOption((o) =>
            o.setName('user').setDescription('Użytkownik do zbanowania').setRequired(true),
        )
        .addStringOption((o) =>
            o.setName('reason').setDescription('Powód (opcjonalnie)').setMaxLength(512),
        )
        .addIntegerOption((o) =>
            o
                .setName('delete_days')
                .setDescription('Usuń wiadomości z ostatnich N dni (0–7)')
                .setMinValue(0)
                .setMaxValue(7),
        ),

    async execute(interaction) {
        if (!interaction.inCachedGuild()) {
            return interaction.reply({
                content: 'Ta komenda działa tylko na serwerze.',
                ephemeral: true,
            })
        }

        try {
            await assertCommandAccess(interaction, 'ban')
        } catch (e) {
            return interaction.reply({ content: e.message, ephemeral: true })
        }

        const user = interaction.options.getUser('user', true)
        if (user.id === interaction.user.id) {
            return interaction.reply({
                content: 'Nie możesz zbanować samego siebie.',
                ephemeral: true,
            })
        }

        const reason =
            interaction.options.getString('reason') ?? 'Brak podanego powodu'
        const deleteDays = interaction.options.getInteger('delete_days') ?? 0
        const member = interaction.options.getMember('user')

        if (member) {
            try {
                assertNotSelf(interaction.member, member)
            } catch (e) {
                return interaction.reply({ content: e.message, ephemeral: true })
            }
            if (!member.manageable) {
                return interaction.reply({
                    content: 'Nie mogę zbanować tego użytkownika (hierarchia ról).',
                    ephemeral: true,
                })
            }
        }

        const deleteMessageSeconds =
            deleteDays > 0
                ? Math.min(deleteDays * 24 * 60 * 60, MAX_DELETE_MESSAGE_SECONDS)
                : undefined

        await interaction.deferReply({ ephemeral: true })

        try {
            await interaction.guild.members.ban(user, {
                reason: `${reason} | ${interaction.user.tag}`,
                deleteMessageSeconds,
            })

            const cfg = await getModerationConfig()
            const embed = new EmbedBuilder()
                .setColor(cfg.embedColors?.ban ?? 0xed4245)
                .setTitle('Ban')
                .setDescription(`Zbanowano **${user.tag}**`)
                .addFields(
                    { name: 'Użytkownik', value: `${user.tag} (\`${user.id}\`)` },
                    { name: 'Powód', value: reason },
                    {
                        name: 'Usunięte wiadomości',
                        value: deleteDays ? `Do ${deleteDays} dni wstecz` : 'Brak',
                    },
                )
                .setTimestamp()

            await sendModerationLogs({
                interaction,
                action: 'ban',
                targetUser: user,
                reason,
                extraFields: {
                    'Usunięte wiadomości': deleteDays
                        ? `Do ${deleteDays} dni`
                        : 'Brak',
                },
            })

            await interaction.editReply({ embeds: [embed] })
        } catch (e) {
            await interaction.editReply({
                content: `Nie udało się zbanować: ${e.message ?? e}`,
            })
        }
    },
}
