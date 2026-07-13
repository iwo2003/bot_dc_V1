import { EmbedBuilder, SlashCommandBuilder } from 'discord.js'
import { sendModerationLogs } from '../../../features/moderation-log.service.js'
import { getModerationConfig } from '../../../config/load-config.js'
import { assertNotSelf } from '../../../utils/moderation.util.js'
import { assertCommandAccess } from '../../../utils/permissions.util.js'

export default {
    cooldown: 2,
    data: new SlashCommandBuilder()
        .setName('unmute')
        .setDescription('Zdejmuje timeout (odciszenie).')
        .setDefaultMemberPermissions(0)
        .addUserOption((o) =>
            o.setName('user').setDescription('Użytkownik').setRequired(true),
        ),

    async execute(interaction) {
        if (!interaction.inCachedGuild()) {
            return interaction.reply({
                content: 'Ta komenda działa tylko na serwerze.',
                ephemeral: true,
            })
        }

        try {
            await assertCommandAccess(interaction, 'unmute')
        } catch (e) {
            return interaction.reply({ content: e.message, ephemeral: true })
        }

        const member = interaction.options.getMember('user')
        if (!member) {
            return interaction.reply({
                content: 'Tego użytkownika nie ma na serwerze.',
                ephemeral: true,
            })
        }

        try {
            assertNotSelf(interaction.member, member)
        } catch (e) {
            return interaction.reply({ content: e.message, ephemeral: true })
        }

        if (!member.moderatable) {
            return interaction.reply({
                content: 'Nie mogę zmodyfikować timeoutu tego użytkownika.',
                ephemeral: true,
            })
        }

        await interaction.deferReply({ ephemeral: true })

        try {
            await member.timeout(null, `Odciszenie | ${interaction.user.tag}`)

            const cfg = await getModerationConfig()
            const embed = new EmbedBuilder()
                .setColor(cfg.embedColors?.mute ?? 0xfee75c)
                .setTitle('Odciszenie')
                .setDescription(`Zdjęto timeout dla **${member.user.tag}**`)
                .setTimestamp()

            await sendModerationLogs({
                interaction,
                action: 'unmute',
                targetUser: member.user,
                reason: 'Odciszenie',
            })

            await interaction.editReply({ embeds: [embed] })
        } catch (e) {
            await interaction.editReply({
                content: `Nie udało się odciszyć: ${e.message ?? e}`,
            })
        }
    },
}
