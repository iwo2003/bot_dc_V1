import { PermissionsBitField, SlashCommandBuilder } from 'discord.js'

export default {
    cooldown: 0,
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Sprawdza opóźnienie bota i API.')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

    async execute(interaction) {
        const timestamp = Date.now()
        await interaction.reply('Pinging...')

        interaction.editReply({
            content: `Pong! Bot Latency: ${
                Date.now() - timestamp
            }ms | API Latency: ${Math.round(interaction.client.ws.ping)}ms`,
        })
    },
}
