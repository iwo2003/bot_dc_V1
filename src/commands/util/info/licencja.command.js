import { EmbedBuilder, SlashCommandBuilder } from 'discord.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoUrl = 'https://github.com/iwo2003/bot_dc_V1'

/**
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 */
export default {
    cooldown: 5,
    data: new SlashCommandBuilder()
        .setName('licencja')
        .setDescription('Informacje o licencji bota i warunkach użytkowania.'),

    async execute(interaction) {
        const packageJson = JSON.parse(
            fs.readFileSync(path.join(__dirname, '..', '..', '..', '..', 'package.json'), 'utf8'),
        )

        const embed = new EmbedBuilder()
            .setColor(0x5865f2)
            .setTitle('Licencja — bot-dc')
            .setDescription(
                [
                    `**Autor:** ${packageJson.author}`,
                    `**Wersja:** ${packageJson.version}`,
                    '',
                    'Oprogramowanie można używać **bezpłatnie** w projektach osobistych, edukacyjnych, portfolio i na serwerach Discord.',
                    '',
                    '**Zakaz użytu komercyjnego** — nie wolno sprzedawać bota, oferować go jako płatnej usługi ani czerpać bezpośredniego zysku z kodu.',
                    '',
                    '**Wymagana atrybucja** — przy wykorzystaniu kodu zachowaj informację o licencji i link do repozytorium autora.',
                    '',
                    `**Repozytorium:** [github.com/iwo2003/bot_dc_V1](${repoUrl})`,
                    '',
                    '_Oprogramowanie dostarczane „TAK JAK JEST”, bez gwarancji._',
                ].join('\n'),
            )
            .setFooter({ text: 'Pełna treść licencji: plik LICENSE w repozytorium' })
            .setTimestamp()

        await interaction.reply({ embeds: [embed] })
    },
}
