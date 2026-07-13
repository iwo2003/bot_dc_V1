/**
 * Szablon konfiguracji integracji z grami.
 * Skopiuj jako `games.js` w tym samym folderze.
 * Klucze API ustaw w `.env` (RIOT_API_KEY, STEAM_API_KEY, FORTNITE_API_KEY).
 */
export default {
    /** Włącz / wyłącz moduł statystyk gier */
    enabled: true,

    /** Włączone gry: lol | valorant | cs2 | minecraft | fortnite */
    enabledGames: ['lol', 'valorant', 'cs2', 'minecraft', 'fortnite'],

  /** Domyślny region LoL (platform): eune, euw, na, kr, ... */
    defaultLolRegion: 'eune',

    /** Domyślny region Valorant: eu, na, ap, kr, latam, br */
    defaultValorantRegion: 'eu',

    /** Domyślny routing Riot Account API: europe, americas, asia */
    defaultRiotRouting: 'europe',

    /** Kolory embedów per gra */
    embedColors: {
        lol: 0xc89b3c,
        valorant: 0xfd455e,
        cs2: 0xf79e1b,
        minecraft: 0x57a757,
        fortnite: 0x9d4dbb,
    },

    /** Cooldown komendy /stats w sekundach */
    cooldownSeconds: 10,
}
