import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TRANSCRIPT_DIR = path.join(__dirname, '..', '..', 'data', 'transcripts')

function ensureTranscriptDir() {
    if (!fs.existsSync(TRANSCRIPT_DIR)) {
        fs.mkdirSync(TRANSCRIPT_DIR, { recursive: true })
    }
}

/**
 * @param {string} text
 */
function escapeHtml(text) {
    return String(text ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

/**
 * @param {import('discord.js').Message} message
 */
function formatMessageContent(message) {
    let content = message.content || ''
    if (message.embeds.length > 0) {
        content += content ? '\n' : ''
        content += `[Embed: ${message.embeds[0].title ?? 'bez tytułu'}]`
    }
    if (message.attachments.size > 0) {
        content += content ? '\n' : ''
        for (const att of message.attachments.values()) {
            content += `[Załącznik: ${att.url}]\n`
        }
    }
    return content || '<em>(brak treści)</em>'
}

/**
 * @param {object} params
 * @param {import('discord.js').TextChannel} params.channel
 * @param {object} params.ticket
 * @param {string} params.ticketLabel
 * @param {import('discord.js').User} params.creator
 */
export async function buildTicketTranscript({ channel, ticket, ticketLabel, creator }) {
    ensureTranscriptDir()

    const allMessages = []
    let lastId

    // Pobieranie historii wiadomości (partiami po 100)
    while (true) {
        const batch = await channel.messages.fetch({
            limit: 100,
            ...(lastId ? { before: lastId } : {}),
        })
        if (batch.size === 0) break
        allMessages.push(...batch.values())
        lastId = batch.last()?.id
        if (batch.size < 100) break
    }

    allMessages.sort((a, b) => a.createdTimestamp - b.createdTimestamp)

    const rows = allMessages
        .map((msg) => {
            const time = new Date(msg.createdTimestamp).toLocaleString('pl-PL')
            const author = escapeHtml(msg.author.tag)
            const body = formatMessageContent(msg)
            const isBot = msg.author.bot ? ' bot' : ''
            const isStaff = msg.author.id === ticket.claimed_by ? ' staff' : ''
            return `<div class="message${isBot}${isStaff}">
                <div class="meta"><span class="author">${author}</span> <span class="time">${time}</span></div>
                <div class="content">${escapeHtml(body).replace(/\n/g, '<br>')}</div>
            </div>`
        })
        .join('\n')

    const created = new Date(Number(ticket.created_at)).toLocaleString('pl-PL')
    const closed = new Date().toLocaleString('pl-PL')

    const html = `<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Transkrypcja — ${escapeHtml(ticketLabel)} — ${escapeHtml(creator.tag)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
    background: #313338;
    color: #dbdee1;
    padding: 24px;
    line-height: 1.5;
  }
  .header {
    background: #2b2d31;
    border-radius: 8px;
    padding: 20px;
    margin-bottom: 24px;
    border-left: 4px solid #5865f2;
  }
  .header h1 { font-size: 1.4rem; color: #f2f3f5; margin-bottom: 12px; }
  .header p { color: #b5bac1; font-size: 0.9rem; margin: 4px 0; }
  .messages { display: flex; flex-direction: column; gap: 12px; }
  .message {
    background: #2b2d31;
    border-radius: 8px;
    padding: 12px 16px;
    border: 1px solid #1e1f22;
  }
  .message.bot { border-left: 3px solid #5865f2; }
  .message.staff { border-left: 3px solid #57f287; }
  .meta { margin-bottom: 6px; }
  .author { font-weight: 600; color: #f2f3f5; }
  .time { color: #949ba4; font-size: 0.8rem; margin-left: 8px; }
  .content { color: #dbdee1; word-break: break-word; }
  .footer {
    margin-top: 24px;
    text-align: center;
    color: #949ba4;
    font-size: 0.8rem;
  }
</style>
</head>
<body>
  <div class="header">
    <h1>Transkrypcja ticketu</h1>
    <p><strong>Typ:</strong> ${escapeHtml(ticketLabel)}</p>
    <p><strong>Twórca:</strong> ${escapeHtml(creator.tag)} (${escapeHtml(creator.id)})</p>
    <p><strong>Kanał:</strong> #${escapeHtml(channel.name)}</p>
    <p><strong>Status:</strong> ${escapeHtml(ticket.status)}</p>
    <p><strong>Przyjęty przez:</strong> ${ticket.claimed_by ? escapeHtml(ticket.claimed_by) : '—'}</p>
    <p><strong>Utworzono:</strong> ${created}</p>
    <p><strong>Zamknięto:</strong> ${closed}</p>
  </div>
  <div class="messages">
    ${rows || '<p>Brak wiadomości.</p>'}
  </div>
  <div class="footer">Wygenerowano przez bot-dc · ${closed}</div>
</body>
</html>`

    const safeName = `ticket-${channel.id}-${Date.now()}.html`
    const filePath = path.join(TRANSCRIPT_DIR, safeName)
    fs.writeFileSync(filePath, html, 'utf8')

    return { filePath, fileName: safeName }
}

/**
 * @param {string} filePath
 */
export function deleteTranscriptFile(filePath) {
    try {
        if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath)
    } catch {
        // plik mógł zostać już usunięty
    }
}
