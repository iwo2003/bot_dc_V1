/**
 * Szablon konfiguracji tymczasowych kanałów głosowych.
 * Skopiuj jako `auto-channel.js` w tym samym folderze i uzupełnij ID.
 * Plik `auto-channel.js` NIE trafia na GitHub (jest w .gitignore).
 */
export default {
    /** Włącz / wyłącz całą funkcję */
    enabled: false,

    /**
     * ID kanału głosowego-hub („➕ Utwórz kanał”).
     * Wejście na ten kanał tworzy prywatny kanał głosowy i przenosi użytkownika.
     */
    hubChannelId: '',

    /**
     * Kategoria, w której mają powstawać nowe kanały.
     * Puste = ta sama kategoria co kanał-hub (lub brak kategorii, jeśli hub jest poza nią).
     */
    categoryId: '',

    /**
     * Szablon nazwy nowego kanału (max 100 znaków po podstawieniu).
     * Placeholdery:
     *   {user} — nazwa użytkownika Discord
     *   {nick} — nick na serwerze (display name)
     *   {id}   — ostatnie 4 cyfry ID użytkownika
     */
    nameTemplate: '🔊 {user}',

    /** Limit osób na kanale (0 = bez limitu) */
    userLimit: 0,

    /** Bitrate w bps (64000 = domyślny Discord; max zależy od poziomu boost serwera) */
    bitrate: 64000,

    /**
     * Opóźnienie przed usunięciem pustego kanału (ms).
     * Zapobiega race condition, gdy użytkownik szybko przeskakuje między kanałami.
     */
    deleteDelayMs: 1500,

    /**
     * true — jeden aktywny kanał na użytkownika (ponowne wejście na hub przenosi do istniejącego).
     * false — każde wejście na hub tworzy nowy kanał.
     */
    oneChannelPerUser: true,

    /**
     * Uprawnienia właściciela kanału (osoby, która go utworzyła).
     * Domyślnie: zarządzanie kanałem + mówienie.
     */
    ownerPermissions: {
        manageChannel: true,
        moveMembers: false,
        muteMembers: false,
    },

    /**
     * Panel konfiguracyjny w chacie kanału głosowego (Text in Voice).
     * Wysyłany tylko przy tworzeniu nowego kanału — tylko właściciel może klikać.
     */
    panel: {
        /** false — wyłącza panel */
        enabled: true,
        /** Kolor embeda panelu */
        embedColor: 0x5865f2,
        /**
         * Gdy Text in Voice nie działa — wyślij panel na DM właścicielowi.
         * false — tylko log w konsoli, bez DM.
         */
        fallbackDm: true,
    },
}
