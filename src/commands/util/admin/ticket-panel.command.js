import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js'
import { sendTicketPanel } from '../../../features/tickets/ticket.service.js'

export default {
    cooldown: 5,
    data: new SlashCommandBuilder()
        .setName('ticket-panel')
        .setDescription('Wysyła panel ticketów z menu wyboru (tylko administrator).')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        if (!interaction.inCachedGuild()) {
            return interaction.reply({
                content: 'Ta komenda działa tylko na serwerze.',
                ephemeral: true,
            })
        }

        try {
            await sendTicketPanel(interaction)
        } catch (e) {
            await interaction.reply({
                content: `❌ ${e.message ?? 'Nie udało się wysłać panelu.'}`,
                ephemeral: true,
            })
        }
    },
}
