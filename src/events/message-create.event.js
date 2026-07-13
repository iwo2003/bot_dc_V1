import { Events } from 'discord.js'
import { handleMessage } from '../features/anti-raid.service.js'

export default {
    name: Events.MessageCreate,
    async execute(message) {
        await handleMessage(message)
    },
}
