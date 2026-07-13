import { Events } from 'discord.js'
import { handleMemberJoin } from '../features/anti-raid.service.js'

export default {
    name: Events.GuildMemberAdd,
    async execute(member) {
        await handleMemberJoin(member)
    },
}
