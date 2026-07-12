import consola from 'consola'
import { ActivityType, Events } from 'discord.js'

export default {
    name: Events.ClientReady,
    once: true,
    async execute(client) {
        client.user.setStatus('online')
        await client.user.setActivity({
            name: 'Discord',
            type: ActivityType.Custom,
        })
        consola.success('Załadowano status!')
    },
}
