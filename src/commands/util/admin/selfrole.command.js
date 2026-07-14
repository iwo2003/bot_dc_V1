import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js'
import {
    addSelfRoleEntry,
    createSelfRolePanel,
    deleteSelfRolePanel,
    refreshSelfRolePanel,
    removeSelfRoleEntry,
} from '../../../features/selfrole/selfrole.service.js'

export default {
    cooldown: 3,
    data: new SlashCommandBuilder()
        .setName('selfrole')
        .setDescription('Zarządzanie panelami self-role (reakcje).')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand((sc) =>
            sc
                .setName('panel')
                .setDescription('Tworzy nowy panel self-role na tym kanale.')
                .addStringOption((o) =>
                    o
                        .setName('tytul')
                        .setDescription('Tytuł embeda (np. „Wybierz swoje role”)')
                        .setRequired(true)
                        .setMaxLength(256),
                )
                .addStringOption((o) =>
                    o
                        .setName('opis')
                        .setDescription(
                            'Tekst nad listą ról (domyślnie: „Zareaguj reakcją…”)',
                        )
                        .setMaxLength(1000),
                )
                .addStringOption((o) =>
                    o
                        .setName('kolor')
                        .setDescription('Kolor embeda: #5865F2 lub liczba dziesiętna'),
                ),
        )
        .addSubcommand((sc) =>
            sc
                .setName('add')
                .setDescription('Dodaje rolę do istniejącego panelu.')
                .addStringOption((o) =>
                    o
                        .setName('wiadomosc')
                        .setDescription('ID wiadomości panelu (PPM → Kopiuj ID)')
                        .setRequired(true),
                )
                .addRoleOption((o) =>
                    o.setName('rola').setDescription('Rola do przypisania').setRequired(true),
                )
                .addStringOption((o) =>
                    o
                        .setName('emoji')
                        .setDescription('Emoji: 🤠, :nazwa: lub <:nazwa:id>')
                        .setRequired(true),
                ),
        )
        .addSubcommand((sc) =>
            sc
                .setName('remove')
                .setDescription('Usuwa rolę z panelu.')
                .addStringOption((o) =>
                    o
                        .setName('wiadomosc')
                        .setDescription('ID wiadomości panelu')
                        .setRequired(true),
                )
                .addRoleOption((o) =>
                    o.setName('rola').setDescription('Rola do usunięcia').setRequired(true),
                ),
        )
        .addSubcommand((sc) =>
            sc
                .setName('refresh')
                .setDescription('Odświeża embed i reakcje panelu.')
                .addStringOption((o) =>
                    o
                        .setName('wiadomosc')
                        .setDescription('ID wiadomości panelu')
                        .setRequired(true),
                ),
        )
        .addSubcommand((sc) =>
            sc
                .setName('delete')
                .setDescription('Usuwa panel z bazy i wiadomość z kanału.')
                .addStringOption((o) =>
                    o
                        .setName('wiadomosc')
                        .setDescription('ID wiadomości panelu')
                        .setRequired(true),
                ),
        ),

    async execute(interaction) {
        if (!interaction.inCachedGuild()) {
            return interaction.reply({
                content: 'Ta komenda działa tylko na serwerze.',
                ephemeral: true,
            })
        }

        const sub = interaction.options.getSubcommand()

        try {
            switch (sub) {
                case 'panel':
                    await createSelfRolePanel(interaction)
                    break
                case 'add':
                    await addSelfRoleEntry(interaction)
                    break
                case 'remove':
                    await removeSelfRoleEntry(interaction)
                    break
                case 'refresh':
                    await refreshSelfRolePanel(interaction)
                    break
                case 'delete':
                    await deleteSelfRolePanel(interaction)
                    break
                default:
                    await interaction.reply({
                        content: 'Nieznana subkomenda.',
                        ephemeral: true,
                    })
            }
        } catch (e) {
            await interaction.reply({
                content: `❌ ${e.message ?? 'Operacja nie powiodła się.'}`,
                ephemeral: true,
            })
        }
    },
}
