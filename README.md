# bot-dc

Bot Discord do moderacji serwera — komendy slash, logi moderacji, tymczasowe kanały głosowe z panelem konfiguracyjnym oraz system ostrzeżeń (warnów) z opcjonalnym zapisem w MySQL.

## Funkcje

- **Komendy moderacyjne** — `/ban`, `/kick`, `/mute`, `/unmute`, `/warn`, `/unwarn`
- **System warnów** — progresywne konsekwencje (mute, ban czasowy, ban permanentny)
- **Logi** — osobne kanały dla użytkowników i administracji
- **Uprawnienia** — role z configu, przypisane komendy per rola/osoba oraz natywne uprawnienia Discord
- **Tymczasowe kanały głosowe** — kanał-hub tworzy prywatny kanał; pusty kanał jest usuwany automatycznie
- **Panel właściciela** — embed z przyciskami w chacie głosowym (Text in Voice)
- **MySQL opcjonalne** — bot startuje bez bazy; warny wymagają MySQL
- **Jedna gildia** — komendy rejestrowane tylko na wyznaczonym serwerze (`GUILD_ID`)

## Wymagania

- [Node.js](https://nodejs.org/) 18+
- Konto bota w [Discord Developer Portal](https://discord.com/developers/applications)
- (Opcjonalnie) serwer [MySQL](https://www.mysql.com/) — dla systemu warnów

## Instalacja

```bash
git clone <url-repozytorium>
cd bot_dc_V1
npm install
```

## Konfiguracja

### 1. Zmienne środowiskowe

Skopiuj szablon i uzupełnij dane:

```bash
cp .env.example .env
```

| Zmienna | Opis |
|---------|------|
| `TOKEN` | Token bota z Developer Portal |
| `CLIENT_ID` | Application ID aplikacji Discord |
| `GUILD_ID` | ID serwera, na którym bot działa |
| `DEFAULT_COMMAND_COOLDOWN` | Cooldown komend w sekundach (domyślnie `3`) |
| `DB_HOST` | Adres MySQL — puste = bot bez bazy |
| `DB_PORT` | Port MySQL (domyślnie `3306`) |
| `DB_USER` | Użytkownik MySQL |
| `DB_PASSWORD` | Hasło MySQL |
| `DB_NAME` | Nazwa bazy (domyślnie `bot_dc`) |

### 2. Baza danych (opcjonalnie)

Jeśli używasz warnów, utwórz bazę na serwerze MySQL:

```sql
CREATE DATABASE `bot_dc` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Schemat tabel tworzy się automatycznie przy starcie bota.

### 3. Konfiguracja moderacji

```bash
cp src/config/moderation.example.js src/config/moderation.js
```

W `moderation.js` ustaw m.in.:

- `moderatorRoleIds` / `moderatorUserIds` — pełny dostęp do komend
- `roleCommands` / `userCommands` — dostęp do wybranych komend
- `channels.userLogsChannelId` / `channels.adminLogsChannelId` — kanały logów
- `warn.levels` — konsekwencje dla kolejnych ostrzeżeń

Plik `moderation.js` jest w `.gitignore` i nie trafia do repozytorium.

### 4. Tymczasowe kanały głosowe (opcjonalnie)

```bash
cp src/config/auto-channel.example.js src/config/auto-channel.js
```

#### Podstawowa konfiguracja

| Pole | Opis |
|------|------|
| `enabled` | `true` — włącza funkcję |
| `hubChannelId` | ID kanału głosowego-hub (np. „➕ Utwórz kanał”) |
| `categoryId` | Kategoria na nowe kanały (puste = jak hub) |
| `nameTemplate` | Szablon nazwy: `{user}`, `{nick}`, `{id}` |
| `userLimit` | Domyślny limit osób przy tworzeniu (0 = bez limitu) |
| `bitrate` | Bitrate przy tworzeniu kanału w bps (domyślnie `64000`) |
| `deleteDelayMs` | Opóźnienie przed usunięciem pustego kanału (ms) |
| `oneChannelPerUser` | Jeden aktywny kanał na użytkownika |
| `ownerPermissions` | Dodatkowe uprawnienia właściciela (`manageChannel`, `moveMembers`, `muteMembers`) |

**Przykład szablonu:** `🔊 {user}` → `🔊 JanKowalski`

#### Panel konfiguracyjny (`panel`)

| Pole | Opis |
|------|------|
| `panel.enabled` | Włącza/wyłącza panel przy tworzeniu kanału |
| `panel.embedColor` | Kolor embeda (hex, np. `0x5865f2`) |
| `panel.fallbackDm` | Gdy Text in Voice nie działa — wyślij panel na DM |

Plik `auto-channel.js` jest w `.gitignore`.

### 5. Uprawnienia bota na Discordzie

W Developer Portal włącz intenty:

- **Server Members Intent** (wymagany)
- **Guild Voice States** (wymagany dla kanałów głosowych)

Na serwerze bot potrzebuje uprawnień m.in.:

- Ban Members
- Kick Members
- Moderate Members
- Manage Channels
- Send Messages (logi + Text in Voice w kanałach głosowych)
- Connect (dołączanie do kanałów głosowych)

## Uruchomienie

```bash
# produkcja
npm start

# development
npm run dev

# development z auto-restartem
npm run dev:watch
```

Po zalogowaniu bot automatycznie rejestruje komendy slash na serwerze z `GUILD_ID`.

## Komendy

| Komenda | Opis |
|---------|------|
| `/ping` | Test działania bota |
| `/ban` | Ban użytkownika (opcjonalnie usuwanie wiadomości 0–7 dni) |
| `/kick` | Wyrzucenie z serwera |
| `/mute` | Wyciszenie (timeout, max 28 dni) |
| `/unmute` | Zdjęcie wyciszenia |
| `/warn` | Ostrzeżenie z konsekwencją z configu |
| `/unwarn` | Zdjęcie ostrzeżeń (całość lub wybrana liczba) |

Komendy moderacyjne są widoczne tylko dla osób z odpowiednimi uprawnieniami (config + Discord).

## System warnów

Domyślnie 5 poziomów ostrzeżeń — każdy kolejny to dłuższe wyciszenie:

| Warn | Domyślna akcja |
|------|----------------|
| 1 | Mute 30 min |
| 2 | Mute 60 min |
| 3 | Mute 3 h |
| 4 | Mute 12 h |
| 5 | Mute 7 dni |

- Licznik resetuje się po **30 dniach** bez nowego warna (konfigurowalne).
- Możliwe akcje w configu: `mute`, `ban_temp`, `ban_perm`, `none`.
- Tymczasowe bany są odbanowywane automatycznie (scheduler co 90 s).

## Tymczasowe kanały głosowe

### Jak to działa

1. Utwórz kanał głosowy-hub (np. „➕ Utwórz kanał”) i wpisz jego ID w `hubChannelId`.
2. Użytkownik wchodzi na hub → bot tworzy kanał według `nameTemplate` i przenosi go tam.
3. Właściciel dostaje uprawnienie **Zarządzanie kanałem**.
4. Bot wysyła **panel konfiguracyjny** w chacie kanału (Text in Voice).
5. Gdy kanał opustoszeje, bot usuwa go po `deleteDelayMs` (domyślnie 1,5 s).

### Panel właściciela (Text in Voice)

Wymaga włączonego **Text in Voice** na serwerze Discord. Panel wysyłany jest **tylko przy tworzeniu** nowego kanału. Korzystać może **wyłącznie właściciel**.

| Rząd | Akcje |
|------|-------|
| 1 | 🔒 Zablokuj · 🔓 Odblokuj · 👁 Ukryj · 👁‍🗨 Pokaż |
| 2 | ✏️ Zmień nazwę (modal) · 👥 Ustaw limit (modal) |
| 3 | 👢 Wyrzuć (menu) · 👑 Przekaż właściciela (menu) · 🗑 Usuń kanał |

| Akcja | Opis |
|-------|------|
| Zablokuj / Odblokuj | Blokuje lub odblokowuje dołączanie dla @everyone |
| Ukryj / Pokaż | Ukrywa lub pokazuje kanał dla @everyone |
| Zmień nazwę | Modal — nowa nazwa kanału (max 100 znaków) |
| Ustaw limit | Modal — limit osób (0–99, 0 = bez limitu) |
| Wyrzuć | Menu — wyrzuca wybranego użytkownika z kanału |
| Przekaż właściciela | Menu — przekazuje uprawnienia użytkownikowi na kanale |
| Usuń kanał | Potwierdzenie i natychmiastowe usunięcie |

Jeśli Text in Voice nie jest dostępny, panel trafia na **DM** właściciela (`panel.fallbackDm: true`).

## Struktura projektu

```
src/
├── index.js                      # Punkt wejścia, intenty, ładowanie komend
├── CommandHandler.js             # Ładowanie i rejestracja slash commands
├── EventHandler.js               # Auto-ładowanie eventów
├── commands/util/
│   ├── test/ping.command.js
│   └── admin/                    # ban, kick, mute, unmute, warn, unwarn
├── config/
│   ├── moderation.example.js     # Szablon configu moderacji
│   ├── auto-channel.example.js   # Szablon configu kanałów głosowych
│   └── load-config.js            # Loader moderation.js + auto-channel.js
├── db/
│   ├── client.js                 # Pool MySQL + migracja schematu
│   └── warny.repo.js
├── events/
│   ├── interaction-create.event.js
│   ├── voice-state-update.event.js
│   └── bot-logged-in.event.js
├── features/
│   ├── warny.service.js
│   ├── moderation-log.service.js
│   ├── auto-channel.service.js
│   └── auto-channel-panel.service.js
└── utils/                        # Uprawnienia, anti-crash, helpery
```

## Pliki ignorowane przez Git

| Plik | Powód |
|------|-------|
| `.env` | Token bota i dane MySQL |
| `src/config/moderation.js` | Lokalne ID ról i kanałów |
| `src/config/auto-channel.js` | Lokalne ID kanałów głosowych |
| `node_modules/` | Zależności npm |

## Licencja

Projekt objęty licencją w pliku [LICENSE](LICENSE) — zobacz plik, aby poznać warunki użytkowania.

## Autor

**iwo2003**
