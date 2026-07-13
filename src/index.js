import { Client, GatewayIntentBits } from 'discord.js'
import { fileURLToPath } from 'url'
import path from 'path'
import fs from 'fs'

import { TOKEN } from './config.js'
import EventHandler from './EventHandler.js'
import CommandHandler from './CommandHandler.js'
import AntiCrash from './utils/anti-crash.util.js'
import { consola } from 'consola'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const packageJsonPath = path.join(__dirname, '..', 'package.json')
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))

AntiCrash.init()

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates,
    ],
})

consola.start(`Starting app '${packageJson.name}'`)
consola.box(`Author:  ${packageJson.author}\nVersion: ${packageJson.version}`)

const eventHandler = new EventHandler(client)
const commandHandler = new CommandHandler(client, {})

client.commandHandler = commandHandler
client.eventHandler = eventHandler

await Promise.all([
    commandHandler.loadCommand('./commands/util/test/ping.command.js'),
    commandHandler.loadCommand('./commands/util/info/licencja.command.js'),
    commandHandler.loadCommand('./commands/util/admin/ban.command.js'),
    commandHandler.loadCommand('./commands/util/admin/kick.command.js'),
    commandHandler.loadCommand('./commands/util/admin/mute.command.js'),
    commandHandler.loadCommand('./commands/util/admin/unmute.command.js'),
    commandHandler.loadCommand('./commands/util/admin/warn.command.js'),
    commandHandler.loadCommand('./commands/util/admin/unwarn.command.js'),
])

commandHandler.displayLoadedCommands()

client.login(TOKEN)
