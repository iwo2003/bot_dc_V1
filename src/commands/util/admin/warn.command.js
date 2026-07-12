import { SlashCommandBuilder } from 'discord.js'
import { runWarnFromInteraction } from '../../../features/warny.service.js'
import { assertCommandAccess } from '../../../utils/permissions.util.js'

export default {
    cooldown: 2,
    data: new SlashCommandBuilder()
        .setName('warn')
        .setDescription(
            'Ostrzeżenie z konfigurowalnymi konsekwencjami (domyślnie 5× mute). Licznik w MySQL.',
        )
        .setDefaultMemberPermissions(0)
        .addUserOption((o) =>
            o.setName('user').setDescription('Użytkownik').setRequired(true),
        )
        .addStringOption((o) =>
            o
                .setName('reason')
                .setDescription('Powód ostrzeżenia')
                .setRequired(true)
                .setMaxLength(500),
        ),

    async execute(interaction) {
        if (!interaction.inCachedGuild()) {
            return interaction.reply({
                content: 'Ta komenda działa tylko na serwerze.',
                ephemeral: true,
            })
        }

        try {
            await assertCommandAccess(interaction, 'warn')
        } catch (e) {
            return interaction.reply({ content: e.message, ephemeral: true })
        }

        await runWarnFromInteraction(interaction)
    },
}
