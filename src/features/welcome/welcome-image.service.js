import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createCanvas, loadImage } from '@napi-rs/canvas'

const projectRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..')

/**
 * @param {string} template
 * @param {object} ctx
 */
export function applyTemplate(template, ctx) {
    return String(template ?? '')
        .replace(/\{user\}/g, ctx.userMention ?? ctx.username ?? '')
        .replace(/\{username\}/g, ctx.username ?? '')
        .replace(/\{server\}/g, ctx.serverName ?? '')
        .replace(/\{count\}/g, String(ctx.memberCount ?? 0))
        .replace(/\{tag\}/g, ctx.tag ?? ctx.username ?? '')
}

/**
 * @param {import('canvas').SKRSContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 * @param {number} r
 */
function roundRect(ctx, x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2)
    ctx.beginPath()
    ctx.moveTo(x + radius, y)
    ctx.lineTo(x + w - radius, y)
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius)
    ctx.lineTo(x + w, y + h - radius)
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h)
    ctx.lineTo(x + radius, y + h)
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius)
    ctx.lineTo(x, y + radius)
    ctx.quadraticCurveTo(x, y, x + radius, y)
    ctx.closePath()
}

/**
 * @param {import('canvas').SKRSContext2D} ctx
 * @param {number} cx
 * @param {number} cy
 * @param {number} radius
 * @param {import('canvas').Image} image
 * @param {string} borderColor
 * @param {number} borderWidth
 */
function drawAvatar(ctx, cx, cy, radius, image, borderColor, borderWidth) {
    ctx.save()
    ctx.beginPath()
    ctx.arc(cx, cy, radius, 0, Math.PI * 2)
    ctx.closePath()
    ctx.clip()
    ctx.drawImage(image, cx - radius, cy - radius, radius * 2, radius * 2)
    ctx.restore()

    if (borderWidth > 0) {
        ctx.beginPath()
        ctx.arc(cx, cy, radius, 0, Math.PI * 2)
        ctx.strokeStyle = borderColor
        ctx.lineWidth = borderWidth
        ctx.stroke()
    }
}

/**
 * @param {object} params
 * @param {import('discord.js').GuildMember} params.member
 * @param {object} params.imageCfg
 * @param {'welcome'|'goodbye'} params.mode
 */
export async function generateWelcomeImage({ member, imageCfg, mode }) {
    const width = imageCfg.width ?? 900
    const height = imageCfg.height ?? 280
    const canvas = createCanvas(width, height)
    const ctx = canvas.getContext('2d')

    ctx.fillStyle = imageCfg.backgroundColor ?? '#0b0b0f'
    ctx.fillRect(0, 0, width, height)

    const bgPath = imageCfg.backgroundImage?.trim()
    if (bgPath) {
        const fullPath = path.isAbsolute(bgPath)
            ? bgPath
            : path.join(projectRoot, bgPath)
        if (fs.existsSync(fullPath)) {
            try {
                const bg = await loadImage(fullPath)
                ctx.globalAlpha = imageCfg.backgroundOpacity ?? 0.35
                ctx.drawImage(bg, 0, 0, width, height)
                ctx.globalAlpha = 1
            } catch {
                // nieprawidłowy plik tła — zostaw kolor
            }
        }
    }

    const ctxData = {
        userMention: `${member.user}`,
        username: member.displayName || member.user.username,
        serverName: member.guild.name,
        memberCount: member.guild.memberCount,
        tag: member.user.tag,
    }

    const avatarCfg = imageCfg.avatar ?? {}
    let contentStartY = 40

    if (avatarCfg.enabled !== false) {
        const size = avatarCfg.size ?? 72
        const radius = size / 2
        const cx = width / 2
        const cy = (avatarCfg.offsetY ?? 28) + radius

        try {
            const avatarUrl = member.user.displayAvatarURL({
                extension: 'png',
                size: 256,
            })
            const avatarImg = await loadImage(avatarUrl)
            drawAvatar(
                ctx,
                cx,
                cy,
                radius,
                avatarImg,
                avatarCfg.borderColor ?? '#ffffff',
                avatarCfg.borderWidth ?? 3,
            )
        } catch {
            // brak avatara — pomiń
        }

        contentStartY = cy + radius + 20
    }

    const lines = imageCfg.lines ?? []
    let y = contentStartY

    for (const line of lines) {
        const text = applyTemplate(line.text, ctxData)
        ctx.font = line.font ?? 'bold 32px sans-serif'
        ctx.fillStyle = line.color ?? '#ffffff'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        ctx.fillText(text, width / 2, y)
        y += (line.lineHeight ?? 42)
    }

    const badge = imageCfg.badge
    if (badge?.enabled !== false && badge?.text) {
        const badgeText = applyTemplate(badge.text, ctxData)
        ctx.font = badge.font ?? 'bold 16px sans-serif'
        const textMetrics = ctx.measureText(badgeText)
        const padX = badge.paddingX ?? 18
        const padY = badge.paddingY ?? 8
        const boxW = textMetrics.width + padX * 2
        const boxH = (badge.fontSize ?? 16) + padY * 2
        const boxX = (width - boxW) / 2
        const boxY = height - (badge.offsetBottom ?? 24) - boxH

        ctx.fillStyle = badge.backgroundColor ?? '#000000'
        roundRect(ctx, boxX, boxY, boxW, boxH, badge.radius ?? 20)
        ctx.fill()

        ctx.fillStyle = badge.textColor ?? '#ffffff'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(badgeText, width / 2, boxY + boxH / 2)
    }

    return canvas.toBuffer('image/png')
}
