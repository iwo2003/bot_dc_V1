# bot-dc

Bot Discord do moderacji serwera — komendy slash, logi moderacji i konfigurowalny system ostrzeżeń (warnów) z opcjonalnym zapisem w MySQL.

## Funkcje

- **Komendy moderacyjne** — `/ban`, `/kick`, `/mute`, `/unmute`, `/warn`, `/unwarn`
- **System warnów** — progresywne konsekwencje (mute, ban czasowy, ban permanentny)
- **Logi** — osobne kanały dla użytkowników i administracji
- **Uprawnienia** — role z configu, przypisane komendy per rola/osoba oraz natywne uprawnienia Discord
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

### 4. Uprawnienia bota na Discordzie

W Developer Portal włącz intenty:

- **Server Members Intent** (wymagany)

Na serwerze bot potrzebuje uprawnień m.in.:

- Ban Members
- Kick Members
- Moderate Members
- Send Messages (kanały logów)

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

## Struktura projektu

```
src/
├── index.js                 # Punkt wejścia
├── CommandHandler.js        # Ładowanie i rejestracja slash commands
├── EventHandler.js          # Obsługa eventów Discord
├── commands/util/           # Komendy (test, admin)
├── config/                  # Config moderacji + load-moderation.js
├── db/                      # Klient MySQL i repozytorium warnów
├── events/                  # interactionCreate, ready, status
├── features/                # warny.service, moderation-log.service
└── utils/                   # Uprawnienia, anti-crash, helpery
```

## Licencja

Projekt objęty licencją w pliku [LICENSE](LICENSE) — zobacz plik, aby poznać warunki użytkowania.

## Autor

**iwo2003**
