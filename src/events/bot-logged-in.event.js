import chalk from 'chalk'
import { Events } from 'discord.js'
import { consola } from 'consola'
import { initDatabase } from '../db/client.js'
import { initAutoChannel } from '../features/auto-channel.service.js'
import { initWarnyScheduler } from '../features/warny.service.js'

export default {
    name: Events.ClientReady,
    once: true,
    async execute(client) {
        consola.success(
            chalk.greenBright(`Zalogowano jako ${client.user.tag}!`),
        )

        await client.commandHandler.registerCommands()
        await initDatabase()
        await initAutoChannel(client)
        initWarnyScheduler(client)
    },
}
