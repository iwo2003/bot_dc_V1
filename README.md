# bot-dc

Bot Discord do moderacji serwera — komendy slash, logi moderacji, anty-raid/anty-spam, tymczasowe kanały głosowe z panelem konfiguracyjnym oraz system ostrzeżeń (warnów) z opcjonalnym zapisem w MySQL.

## Funkcje

- **Komendy moderacyjne** — `/ban`, `/kick`, `/mute`, `/unmute`, `/warn`, `/unwarn`
- **System warnów** — progresywne konsekwencje (mute, ban czasowy, ban permanentny)
- **Logi** — osobne kanały dla użytkowników i administracji
- **Uprawnienia** — role z configu, przypisane komendy per rola/osoba oraz natywne uprawnienia Discord
- **Tymczasowe kanały głosowe** — kanał-hub tworzy prywatny kanał; pusty kanał jest usuwany automatycznie
- **Panel właściciela** — embed z przyciskami w chacie głosowym (Text in Voice)
- **Anty-raid / anty-spam** — ban botów reklamowych, wykrywanie raidów, spamu i podejrzanych linków
- **Statystyki gier** — `/stats` dla LoL, Valorant, CS2, Minecraft, Fortnite (embed + obrazek)
- **System ticketów** — formularze (Modals), MySQL, transkrypcja HTML, przyjmij/zamknij
- **Powitania / pożegnania** — generowany obrazek (canvas) z avatar, tekstem i licznikiem członków
- **Self-role** — panele z embedem i reakcjami emoji (MySQL, wiele paneli)
- **MySQL opcjonalne** — warny, tickety i self-role wymagają bazy; reszta działa bez niej
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

### 5. Anty-raid / anty-spam (opcjonalnie)

```bash
cp src/config/anti-raid.example.js src/config/anti-raid.js
```

| Moduł | Opis |
|-------|------|
| `antiBot` | Automatyczny ban nieautoryzowanych botów (whitelist w `allowedBotIds`) |
| `antiRaid` | Wykrywa masowe dołączanie; w trybie raid karze młode konta (ban/kick) |
| `antiSpam` | Limit wiadomości w czasie — timeout, kick lub ban |
| `antiLink` | Blokuje scam linki, phishing i zaproszenia Discord |

| Pole | Opis |
|------|------|
| `enabled` | Włącza cały moduł |
| `logChannelId` | Kanał logów (puste = `adminLogsChannelId` z moderation.js) |
| `immuneRoleIds` / `immuneUserIds` | Zwolnieni z filtrów (admini i moderatorzy z moderation.js też) |

Plik `anti-raid.js` jest w `.gitignore`.

### 6. Statystyki gier (opcjonalnie)

```bash
cp src/config/games.example.js src/config/games.js
```

W `.env` ustaw klucze API (opcjonalnie per gra):

| Zmienna | Gra | Gdzie uzyskać klucz |
|---------|-----|---------------------|
| `RIOT_API_KEY` | LoL, Valorant | [developer.riotgames.com](https://developer.riotgames.com/) |
| `STEAM_API_KEY` | CS2 | [steamcommunity.com/dev/apikey](https://steamcommunity.com/dev/apikey) |
| `FORTNITE_API_KEY` | Fortnite | [fortnite-api.com](https://fortnite-api.com/) |
| — | Minecraft | Bez klucza (Mojang API + Crafatar) |

**Komenda:** `/stats gra:... gracz:... region:...`

| Gra | Format `gracz` | Region (opcjonalnie) |
|-----|----------------|----------------------|
| LoL | `Nick#TAG` | `eune`, `euw`, `na`… |
| Valorant | `Nick#TAG` | `eu`, `na`, `ap`… |
| CS2 | Steam ID, vanity lub URL profilu | — |
| Minecraft | Nick Java Edition | — |
| Fortnite | Nick Epic | — |

Plik `games.js` jest w `.gitignore`.

### 7. System ticketów (wymaga MySQL)

```bash
cp src/config/tickets.example.json src/config/tickets.json
```

Uzupełnij w `tickets.json`:
- `staffRoleIds` — role obsługujące tickety
- `transcriptLogChannelId` — kanał na transkrypcje HTML
- `category_id` — ID kategorii Discord dla każdego typu ticketu

**Typy ticketów (przykładowe):** Pomoc, Rekrutacja, Inne

**Komenda:** `/ticket-panel` (tylko administrator) — wysyła embed z menu wyboru.

**Przepływ:**
1. Użytkownik wybiera typ z menu → formularz (max 5 pytań)
2. Bot tworzy prywatny kanał (twórca + staff)
3. Na kanale: embed z odpowiedziami + przyciski **Przyjmij** / **Zamknij**
4. Staff przyjmuje ticket → zapis `claimed_by` w MySQL
5. Staff zamyka → transkrypcja HTML na kanał logów → usunięcie kanału po 5 s

**Limity:** 1 otwarty ticket na użytkownika.

Plik `tickets.json` jest w `.gitignore`.

### 8. Powitania i pożegnania (canvas)

```bash
cp src/config/welcome.example.json src/config/welcome.json
```

W `welcome.json` ustaw m.in.:

| Pole | Opis |
|------|------|
| `welcome.channelId` | Kanał powitalny |
| `goodbye.channelId` | Kanał pożegnań |
| `welcome.message` / `goodbye.message` | Tekst nad obrazkiem (`{user}`, `{username}`, `{server}`, `{count}`) |
| `welcome.mentionUser` | Ping @user w wiadomości |
| `welcome.dm` / `goodbye.dm` | Opcjonalna wiadomość prywatna |
| `*.image.width` | Szerokość obrazka w pikselach (domyślnie `900`) |
| `*.image.height` | Wysokość obrazku w pikselach (domyślnie `280`) |
| `*.image.backgroundColor` | Kolor tła, gdy brak pliku lub przed nałożeniem grafiki |
| `*.image.backgroundImage` | Tło PNG/JPG (np. `assets/welcome/background.png`) — skalowane do `width` × `height` |
| `*.image.backgroundOpacity` | Przezroczystość tła graficznego (`0`–`1`, domyślnie `0.35`) |
| `*.image.lines` | Linie tekstu na obrazku (font, kolor, opcjonalnie `lineHeight`) |
| `*.image.badge` | Badge z licznikiem (np. „Jest już nas #{count}”) |
| `*.image.avatar` | Avatar, rozmiar, obramowanie, `offsetY` |

**Rozmiar obrazka (`width` / `height`):** wartości w pikselach określają cały canvas wysyłany jako załącznik PNG. Tło (`backgroundImage`) jest rozciągane do tych wymiarów; avatar, teksty i badge układają się względem środka i krawędzi tego prostokąta. Domyślnie `900×280` daje szeroki, niski baner podobny do Discordowych powitań — dobrze mieści się w kanale bez przewijania. Przy większej wysokości (np. `400`) zostaw więcej miejsca między liniami (`lineHeight` w `lines`) albo zwiększ `avatar.offsetY` i `badge.offsetBottom`, żeby elementy się nie nachodziły. Zbyt duże wymiary (np. powyżej `2000` px) zwiększają rozmiar pliku i czas generowania.

**Placeholdery:** `{user}` `{username}` `{server}` `{count}` `{tag}`

Plik `welcome.json` jest w `.gitignore`.

### 9. Self-role (reakcje + MySQL)

Panel jak na Discordzie: embed z listą `emoji — @rola` i reakcje pod wiadomością. Kliknięcie reakcji **dodaje** rolę, usunięcie reakcji **zdejmuje** rolę. Użytkownik może mieć **dowolnie wiele** ról z jednego panelu. Możesz utworzyć **wiele paneli** (np. gry, powiadomienia).

**Wymaga MySQL** — tabele `selfrole_panels` i `selfrole_entries` tworzą się automatycznie przy starcie bota.

| Komenda | Opis |
|---------|------|
| `/selfrole panel` | Tworzy pusty panel na bieżącym kanale (`tytul`, opcjonalnie `opis`, `kolor`) |
| `/selfrole add` | Dodaje rolę do panelu (`wiadomosc` = ID wiadomości, `rola`, `emoji`) |
| `/selfrole remove` | Usuwa rolę z panelu |
| `/selfrole refresh` | Odświeża embed i reakcje (po ręcznych zmianach) |
| `/selfrole delete` | Usuwa panel z bazy i wiadomość z kanału |

**Emoji:** unicode (`🤠`), nazwa serwera (`:TFT:`) lub pełny format (`<:TFT:123456789>`).

**Kolor embeda:** `#5865F2` lub liczba dziesiętna (np. `5793266`).

Rola musi być **niżej** niż najwyższa rola bota. Bot potrzebuje uprawnienia **Zarządzaj rolami**.

### 10. Uprawnienia bota na Discordzie

W Developer Portal włącz intenty:

- **Server Members Intent** (wymagany)
- **Message Content Intent** (wymagany dla anty-spam i anty-link)
- **Guild Voice States** (wymagany dla kanałów głosowych)
- **Guild Message Reactions** (wymagany dla self-role)

Na serwerze bot potrzebuje uprawnień m.in.:

- Ban Members
- Kick Members
- Moderate Members
- Manage Messages (usuwanie spamu / linków)
- Manage Channels
- Manage Roles (self-role)
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
| `/licencja` | Informacje o licencji i warunkach użytkowania (dla wszystkich) |
| `/stats` | Statystyki gracza z LoL, Valorant, CS2, Minecraft lub Fortnite (dla wszystkich) |
| `/ticket-panel` | Wysyła panel ticketów z menu (tylko administrator) |
| `/selfrole panel` | Tworzy panel self-role na kanale (tylko administrator) |
| `/selfrole add` | Dodaje rolę i reakcję do panelu |
| `/selfrole remove` | Usuwa rolę z panelu |
| `/selfrole refresh` | Odświeża embed i reakcje panelu |
| `/selfrole delete` | Usuwa panel i wiadomość |
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

## Anty-raid / anty-spam

### Anty-bot
Nieautoryzowany bot dołączający na serwer jest **automatycznie banowany** (chyba że jest na liście `allowedBotIds`).

### Anty-raid
Gdy w krótkim czasie dołączy zbyt wielu użytkowników (`joinThreshold` w `joinWindowSeconds`), włącza się **tryb raid**. W tym trybie konta młodsze niż `minAccountAgeDays` są banowane lub wyrzucane.

### Anty-spam
Bot liczy wiadomości użytkownika w oknie czasowym. Po przekroczeniu limitu usuwa wiadomość i nakłada karę (timeout / kick / ban).

### Anty-link
Skanuje treść wiadomości pod kątem:
- podejrzanych domen (phishing, fałszywy Nitro, fałszywy Steam),
- wzorców scam w tekście,
- nieautoryzowanych zaproszeń Discord (`discord.gg`, `discord.com/invite`).

Akcje i listy domen konfigurujesz w `anti-raid.js`. Zdarzenia trafiają na kanał logów.

## Struktura projektu

```
src/
├── index.js                      # Punkt wejścia, intenty, ładowanie komend
├── CommandHandler.js             # Ładowanie i rejestracja slash commands
├── EventHandler.js               # Auto-ładowanie eventów
├── commands/util/
│   ├── test/ping.command.js
│   ├── info/licencja.command.js
│   └── admin/                    # ban, kick, mute, selfrole, ticket-panel, …
├── config/
│   ├── moderation.example.js
│   ├── auto-channel.example.js
│   ├── anti-raid.example.js
│   ├── games.example.js
│   ├── welcome.example.json
│   └── load-config.js
├── db/
│   ├── client.js
│   ├── warny.repo.js
│   ├── tickets.repo.js
│   └── selfrole.repo.js
├── events/
│   ├── interaction-create.event.js
│   ├── message-create.event.js
│   ├── message-reaction-add.event.js
│   ├── message-reaction-remove.event.js
│   ├── guild-member-add.event.js
│   ├── guild-member-remove.event.js
│   ├── voice-state-update.event.js
│   └── bot-logged-in.event.js
├── features/
│   ├── selfrole/selfrole.service.js
│   ├── welcome/
│   ├── tickets/
│   ├── warny.service.js
│   ├── moderation-log.service.js
│   ├── anti-raid.service.js
│   ├── games/
│   │   ├── games-stats.service.js
│   │   ├── riot.provider.js
│   │   ├── steam.provider.js
│   │   ├── minecraft.provider.js
│   │   └── fortnite.provider.js
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
| `src/config/anti-raid.js` | Lokalna konfiguracja anty-raid |
| `src/config/games.js` | Lokalna konfiguracja gier |
| `src/config/tickets.json` | Lokalna konfiguracja ticketów |
| `src/config/welcome.json` | Lokalna konfiguracja powitań |
| `data/transcripts/` | Tymczasowe pliki HTML |
| `node_modules/` | Zależności npm |

## Licencja

Projekt objęty licencją w pliku [LICENSE](LICENSE) — zobacz plik, aby poznać warunki użytkowania.

## Autor

**iwo2003**
