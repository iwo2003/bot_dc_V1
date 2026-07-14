import { Events } from 'discord.js'
import { handleSelfRoleReaction } from '../features/selfrole/selfrole.service.js'

export default {
    name: Events.MessageReactionAdd,
    async execute(reaction, user) {
        await handleSelfRoleReaction(reaction, user, true)
    },
}
