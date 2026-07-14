import { Events } from 'discord.js'
import { handleMemberGoodbye } from '../features/welcome/welcome.service.js'

export default {
    name: Events.GuildMemberRemove,
    async execute(member) {
        await handleMemberGoodbye(member)
    },
}
