import { Events } from 'discord.js'
import { handleVoiceStateUpdate } from '../features/auto-channel.service.js'

export default {
    name: Events.VoiceStateUpdate,
    async execute(oldState, newState) {
        await handleVoiceStateUpdate(oldState, newState)
    },
}
