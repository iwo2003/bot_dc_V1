import 'dotenv/config'

export const TOKEN = process.env.TOKEN
export const CLIENT_ID = process.env.CLIENT_ID
/** Ustaw w .env — bot rejestruje komendy tylko na tej gildii i obsługuje slash tylko tam. */
export const GUILD_ID = process.env.GUILD_ID?.trim() || ''
export const DEFAULT_COMMAND_COOLDOWN =
    process.env.DEFAULT_COMMAND_COOLDOWN || 3

/** MySQL — opcjonalne; bez DB_HOST bot startuje bez bazy */
export const DB_HOST = process.env.DB_HOST?.trim() || ''
export const DB_PORT = Number(process.env.DB_PORT) || 3306
export const DB_USER = process.env.DB_USER?.trim() || 'root'
export const DB_PASSWORD = process.env.DB_PASSWORD ?? ''
export const DB_NAME = process.env.DB_NAME?.trim() || 'bot_dc'

/** Klucze API gier — opcjonalne; bez klucza dana gra zwróci komunikat w /stats */
export const RIOT_API_KEY = process.env.RIOT_API_KEY?.trim() || ''
export const STEAM_API_KEY = process.env.STEAM_API_KEY?.trim() || ''
export const FORTNITE_API_KEY = process.env.FORTNITE_API_KEY?.trim() || ''
