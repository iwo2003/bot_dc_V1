/**
 * Szablon konfiguracji moderacji.
 * Skopiuj ten plik jako `moderation.js` w tym samym folderze i uzupełnij ID.
 * Plik `moderation.js` NIE trafia na GitHub (jest w .gitignore).
 */
export default {
    /** Role z pełnym dostępem do wszystkich komend moderacji */
    moderatorRoleIds: [
        // '123456789012345678',
    ],

    /** Osoby z pełnym dostępem do wszystkich komend moderacji */
    moderatorUserIds: [
        // '123456789012345678',
    ],

    /**
     * Konkretne komendy per rola.
     * commands: 'ban' | 'kick' | 'mute' | 'unmute' | 'warn' | 'unwarn' | 'all'
     *
     * @example
     * { roleId: '123456789012345678', commands: ['warn', 'mute'] }
     * { roleId: '987654321098765432', commands: ['all'] }
     */
    roleCommands: [
        // { roleId: '123456789012345678', commands: ['warn', 'mute'] },
    ],

    /**
     * Konkretne komendy per osoba.
     *
     * @example
     * { userId: '123456789012345678', commands: ['kick'] }
     */
    userCommands: [
        // { userId: '123456789012345678', commands: ['ban', 'kick'] },
    ],

    /**
     * Dodatkowo każda ranga z uprawnieniem Discord (Ban/Kick/Moderate)
     * lub administrator może używać odpowiednich komend — bez wpisywania tutaj.
     */
    channels: {
        /** Kanał z logami dla użytkowników (skrócone embedy) */
        userLogsChannelId: '',
        /** Kanał z pełnymi logami dla administracji */
        adminLogsChannelId: '',
    },

    embedColors: {
        ban: 0xed4245,
        kick: 0xe67e22,
        mute: 0xfee75c,
        warn: 0xfee75c,
        warnSevere: 0xed4245,
        unwarn: 0x57f287,
    },

    /**
     * Wysyłanie prywatnych wiadomości (DM) do użytkowników.
     * true = włączone, false = wyłączone
     */
    dm: {
        warn: true,
        unwarn: false,
    },

    warn: {
        /** Po ilu dniach bez nowego warna licznik się zeruje */
        resetWindowDays: 30,

        /**
         * Konsekwencje dla każdego poziomu warna (indeks 0 = warn 1, itd.).
         * action:
         *   - 'mute'      — timeout (wymaga obecności na serwerze)
         *   - 'ban_temp'  — ban czasowy (banDays)
         *   - 'ban_perm'  — ban permanentny
         *   - 'none'      — samo ostrzeżenie bez akcji Discord
         */
        levels: [
            { action: 'mute', muteMinutes: 30 },
            { action: 'mute', muteMinutes: 60 },
            { action: 'mute', muteMinutes: 180 },
            { action: 'mute', muteMinutes: 720 },
            { action: 'mute', muteMinutes: 10080 },
        ],
    },
}
