import { EmbedBuilder, SlashCommandBuilder } from 'discord.js'
import { sendModerationLogs } from '../../../features/moderation-log.service.js'
import { getModerationConfig } from '../../../config/load-config.js'
import { MAX_TIMEOUT_MS, assertNotSelf } from '../../../utils/moderation.util.js'
import { assertCommandAccess } from '../../../utils/permissions.util.js'

const MAX_MINUTES = Math.floor(MAX_TIMEOUT_MS / 60_000)

export default {
    cooldown: 2,
    data: new SlashCommandBuilder()
        .setName('mute')
        .setDescription('Wycisza użytkownika (timeout Discord — max 28 dni).')
        .setDefaultMemberPermissions(0)
        .addUserOption((o) =>
            o.setName('user').setDescription('Użytkownik').setRequired(true),
        )
        .addIntegerOption((o) =>
            o
                .setName('minutes')
                .setDescription(`Czas wyciszenia w minutach (1–${MAX_MINUTES})`)
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(MAX_MINUTES),
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
            await assertCommandAccess(interaction, 'mute')
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
                content: 'Nie mogę nałożyć timeoutu na tego użytkownika.',
                ephemeral: true,
            })
        }

        const minutes = interaction.options.getInteger('minutes', true)
        const ms = minutes * 60_000
        const reason =
            interaction.options.getString('reason') ?? 'Brak podanego powodu'

        await interaction.deferReply({ ephemeral: true })

        try {
            await member.timeout(ms, `${reason} | ${interaction.user.tag}`)

            const cfg = await getModerationConfig()
            const embed = new EmbedBuilder()
                .setColor(cfg.embedColors?.mute ?? 0xfee75c)
                .setTitle('Wyciszenie')
                .setDescription(`Wyciszono **${member.user.tag}**`)
                .addFields(
                    {
                        name: 'Użytkownik',
                        value: `${member.user.tag} (\`${member.id}\`)`,
                    },
                    { name: 'Czas', value: `${minutes} min` },
                    { name: 'Powód', value: reason },
                )
                .setTimestamp()

            await sendModerationLogs({
                interaction,
                action: 'mute',
                targetUser: member.user,
                reason,
                extraFields: { Czas: `${minutes} min` },
            })

            await interaction.editReply({ embeds: [embed] })
        } catch (e) {
            await interaction.editReply({
                content: `Nie udało się wyciszyć: ${e.message ?? e}`,
            })
        }
    },
}
