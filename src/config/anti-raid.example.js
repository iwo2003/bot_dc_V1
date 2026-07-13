/**
 * Szablon konfiguracji anty-raid / anty-spam.
 * Skopiuj jako `anti-raid.js` w tym samym folderze i uzupełnij.
 * Plik `anti-raid.js` NIE trafia na GitHub (jest w .gitignore).
 */
export default {
    /** Włącz / wyłącz cały moduł */
    enabled: false,

    /**
     * Kanał logów anty-raid (ID).
     * Puste = użyje channels.adminLogsChannelId z moderation.js (jeśli ustawione).
     */
    logChannelId: '',

    /** Role zwolnione z filtrów anty-spam i anty-link */
    immuneRoleIds: [
        // '123456789012345678',
    ],

    /** Użytkownicy zwolnieni z filtrów */
    immuneUserIds: [
        // '123456789012345678',
    ],

    /** Automatyczne banowanie nieautoryzowanych botów reklamowych */
    antiBot: {
        enabled: true,
        /** Banuj boty dołączające na serwer (poza allowedBotIds) */
        banUnauthorizedBots: true,
        /** Dozwolone ID botów (np. własny bot, MEE6, Carl-bot) */
        allowedBotIds: [
            // '123456789012345678',
        ],
    },

    /** Wykrywanie masowego dołączania (raid) */
    antiRaid: {
        enabled: true,
        /** Ile dołączeń w oknie czasowym uruchamia tryb raid */
        joinThreshold: 8,
        /** Okno liczenia dołączeń (sekundy) */
        joinWindowSeconds: 15,
        /** Jak długo trwa tryb raid po wykryciu (sekundy) */
        raidModeSeconds: 120,
        /** Konta młodsze niż X dni są karane w trybie raid */
        minAccountAgeDays: 7,
        /** ban | kick */
        action: 'ban',
    },

    /** Wykrywanie masowego wysyłania wiadomości (spam) */
    antiSpam: {
        enabled: true,
        /** Max wiadomości w oknie */
        maxMessages: 6,
        /** Okno czasowe (sekundy) */
        intervalSeconds: 7,
        /** Usuń wiadomości użytkownika przy wykryciu */
        deleteMessages: true,
        /** timeout | kick | ban */
        action: 'timeout',
        timeoutMinutes: 15,
        /** Kanały ignorowane (ID) */
        ignoredChannelIds: [],
    },

    /** Wykrywanie niebezpiecznych linków i scamów */
    antiLink: {
        enabled: true,
        /** Blokuj zaproszenia discord.gg / discord.com/invite (poza osobami z immunitetem) */
        blockDiscordInvites: true,
        blockedDomains: [
            'discorcl.gift',
            'discord-nitro',
            'discordnitro',
            'steamcommunily.com',
            'steamcommunitly.com',
            'free-nitro',
            'nitro-free',
            'dlscord',
            'discorcl',
        ],
        blockedPatterns: [
            'discord\\.gift',
            'free\\s*nitro',
            'nitro\\s*free',
            'steam\\s*commun[il]ty',
            '@everyone.*http',
            'http.*@everyone',
        ],
        whitelistDomains: [
            'discord.com',
            'discord.gg',
            'youtube.com',
            'youtu.be',
            'github.com',
            'twitch.tv',
            'spotify.com',
        ],
        /** delete | timeout | ban — przy wykryciu złego linku */
        action: 'delete',
        timeoutMinutes: 60,
    },

    embedColor: 0xed4245,
}
