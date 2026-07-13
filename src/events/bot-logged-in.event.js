import chalk from 'chalk'
import { Events } from 'discord.js'
import { consola } from 'consola'
import { initDatabase } from '../db/client.js'
import { initAntiRaid } from '../features/anti-raid.service.js'
import { initGames } from '../features/games/games-stats.service.js'
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
        await initAntiRaid(client)
        await initGames(client)
        await initAutoChannel(client)
        initWarnyScheduler(client)
    },
}
