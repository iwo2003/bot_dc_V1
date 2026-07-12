import { SlashCommandBuilder } from 'discord.js'
import { runUnwarnFromInteraction } from '../../../features/warny.service.js'
import { assertCommandAccess } from '../../../utils/permissions.util.js'

export default {
    cooldown: 2,
    data: new SlashCommandBuilder()
        .setName('unwarn')
        .setDescription('Zdejmuje ostrzeżenia użytkownika (licznik w MySQL).')
        .setDefaultMemberPermissions(0)
        .addUserOption((o) =>
            o.setName('user').setDescription('Użytkownik').setRequired(true),
        )
        .addIntegerOption((o) =>
            o
                .setName('ilosc')
                .setDescription('Ile warnów zdjąć (puste = resetuj wszystkie)')
                .setMinValue(1)
                .setMaxValue(20),
        )
        .addStringOption((o) =>
            o.setName('reason').setDescription('Powód (opcjonalnie)').setMaxLength(500),
        ),

    async execute(interaction) {
        if (!interaction.inCachedGuild()) {
            return interaction.reply({
                content: 'Ta komenda działa tylko na serwerze.',
                ephemeral: true,
            })
        }

        try {
            await assertCommandAccess(interaction, 'unwarn')
        } catch (e) {
            return interaction.reply({ content: e.message, ephemeral: true })
        }

        await runUnwarnFromInteraction(interaction)
    },
}
