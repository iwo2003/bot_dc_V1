import { Events } from 'discord.js'
import { handleSelfRoleReaction } from '../features/selfrole/selfrole.service.js'

export default {
    name: Events.MessageReactionRemove,
    async execute(reaction, user) {
        await handleSelfRoleReaction(reaction, user, false)
    },
}
