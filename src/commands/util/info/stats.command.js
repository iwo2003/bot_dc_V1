import { SlashCommandBuilder } from 'discord.js'
import { runStatsCommand } from '../../../features/games/games-stats.service.js'

export default {
    cooldown: 10,
    data: new SlashCommandBuilder()
        .setName('stats')
        .setDescription('Statystyki gracza z wybranej gry (LoL, Valorant, CS2, Minecraft, Fortnite).')
        .addStringOption((o) =>
            o
                .setName('gra')
                .setDescription('Wybierz grę')
                .setRequired(true)
                .addChoices(
                    { name: 'League of Legends', value: 'lol' },
                    { name: 'Valorant', value: 'valorant' },
                    { name: 'Counter-Strike 2', value: 'cs2' },
                    { name: 'Minecraft', value: 'minecraft' },
                    { name: 'Fortnite', value: 'fortnite' },
                ),
        )
        .addStringOption((o) =>
            o
                .setName('gracz')
                .setDescription(
                    'Nick gracza — LoL/Valorant: Nick#TAG, CS2: Steam ID/URL/vanity, MC/FN: nick',
                )
                .setRequired(true)
                .setMaxLength(100),
        )
        .addStringOption((o) =>
            o
                .setName('region')
                .setDescription('LoL: eune, euw, na… | Valorant: eu, na, ap… (opcjonalnie)')
                .setMaxLength(16),
        ),

    async execute(interaction) {
        await runStatsCommand(interaction)
    },
}
