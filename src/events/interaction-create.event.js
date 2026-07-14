import { Collection, Events } from 'discord.js'
import { consola } from 'consola'
import { DEFAULT_COMMAND_COOLDOWN, GUILD_ID } from '../config.js'
import { handleAutoChannelPanelInteraction } from '../features/auto-channel-panel.service.js'
import { handleTicketInteraction } from '../features/tickets/ticket.service.js'

export default {
    name: Events.InteractionCreate,
    async execute(interaction) {
        if (GUILD_ID && interaction.guildId && interaction.guildId !== GUILD_ID) {
            if (interaction.isRepliable()) {
                return interaction.reply({
                    content:
                        'Ten bot działa tylko na wyznaczonym serwerze — tu nie możesz używać komend.',
                    ephemeral: true,
                })
            }
            return
        }

        if (!interaction.isChatInputCommand()) {
            try {
                const ticketHandled = await handleTicketInteraction(interaction)
                if (ticketHandled) return

                const handled = await handleAutoChannelPanelInteraction(interaction)
                if (handled) return
            } catch (error) {
                if (!String(error?.message ?? error).includes('Unknown interaction')) {
                    consola.error('[auto-channel] interaction:', error)
                }
                if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
                    await interaction
                        .reply({
                            content: 'Wystąpił błąd podczas obsługi panelu kanału.',
                            ephemeral: true,
                        })
                        .catch(() => {})
                }
            }
            return
        }

        const { commandName, client } = interaction
        const { cooldowns } = client

        const command = interaction.client.commands.get(interaction.commandName)

        if (!command) {
            consola.error(`No command matching ${commandName} was found.`)
            return
        }

        if (!cooldowns.has(command.data.name)) {
            cooldowns.set(command.data.name, new Collection())
        }

        const now = Date.now()
        const timestamps = cooldowns.get(command.data.name)

        const cooldownAmount =
            (command.cooldown ?? DEFAULT_COMMAND_COOLDOWN) * 1000

        const userId = interaction.user.id

        if (timestamps.has(userId)) {
            const expirationTime = timestamps.get(userId) + cooldownAmount

            if (now < expirationTime) {
                const expiredTimestamp = Math.round(expirationTime / 1000)
                return interaction.reply({
                    content: `Komendę ${commandName} możesz ponownie użyć <t:${expiredTimestamp}:R>.`,
                    ephemeral: true,
                })
            }
        }

        timestamps.set(userId, now)
        setTimeout(() => timestamps.delete(userId), cooldownAmount)

        try {
            await command.execute(interaction)
        } catch (error) {
            consola.error(error)
            const payload = {
                content: 'Wystąpił błąd podczas wykonywania tego polecenia!',
                ephemeral: true,
            }

            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(payload)
            } else {
                await interaction.reply(payload)
            }
        }
    },
}
