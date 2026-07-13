import { EmbedBuilder, SlashCommandBuilder } from 'discord.js'
import { sendModerationLogs } from '../../../features/moderation-log.service.js'
import { getModerationConfig } from '../../../config/load-config.js'
import { assertNotSelf } from '../../../utils/moderation.util.js'
import { assertCommandAccess } from '../../../utils/permissions.util.js'

export default {
    cooldown: 2,
    data: new SlashCommandBuilder()
        .setName('kick')
        .setDescription('Wyrzuca użytkownika z serwera.')
        .setDefaultMemberPermissions(0)
        .addUserOption((o) =>
            o.setName('user').setDescription('Użytkownik do wyrzucenia').setRequired(true),
        )
        .addStringOption((o) =>
            o.setName('reason').setDescription('Powód (opcjonalnie)').setMaxLength(512),
        ),

    async execute(interaction) {
        if (!interaction.inCachedGuild()) {
            return interaction.reply({
                content: 'Ta komenda działa tylko na serwerze.',
                ephemeral: true,
            })
        }

        try {
            await assertCommandAccess(interaction, 'kick')
        } catch (e) {
            return interaction.reply({ content: e.message, ephemeral: true })
        }

        const member = interaction.options.getMember('user')
        if (!member) {
            return interaction.reply({
                content: 'Tego użytkownika nie ma na serwerze — użyj /ban.',
                ephemeral: true,
            })
        }

        try {
            assertNotSelf(interaction.member, member)
        } catch (e) {
            return interaction.reply({ content: e.message, ephemeral: true })
        }

        if (!member.kickable) {
            return interaction.reply({
                content: 'Nie mogę wyrzucić tego użytkownika (brak uprawnień lub hierarchia ról).',
                ephemeral: true,
            })
        }

        const reason =
            interaction.options.getString('reason') ?? 'Brak podanego powodu'

        await interaction.deferReply({ ephemeral: true })

        try {
            await member.kick(`${reason} | ${interaction.user.tag}`)

            const cfg = await getModerationConfig()
            const embed = new EmbedBuilder()
                .setColor(cfg.embedColors?.kick ?? 0xe67e22)
                .setTitle('Wyrzucenie')
                .setDescription(`Wyrzucono **${member.user.tag}**`)
                .addFields(
                    {
                        name: 'Użytkownik',
                        value: `${member.user.tag} (\`${member.id}\`)`,
                    },
                    { name: 'Powód', value: reason },
                )
                .setTimestamp()

            await sendModerationLogs({
                interaction,
                action: 'kick',
                targetUser: member.user,
                reason,
            })

            await interaction.editReply({ embeds: [embed] })
        } catch (e) {
            await interaction.editReply({
                content: `Nie udało się wyrzucić: ${e.message ?? e}`,
            })
        }
    },
}
