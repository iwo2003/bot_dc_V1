import { fetchJson } from './http.util.js'

/**
 * @param {object} params
 * @param {string} params.player
 */
export async function fetchMinecraftStats({ player }) {
    const username = player.trim()
    if (!username || username.length > 16) {
        throw new Error('Podaj prawidłową nazwę gracza Minecraft (max 16 znaków).')
    }

    const profile = await fetchJson(
        `https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(username)}`,
    )

    if (!profile.ok || !profile.data?.id) {
        throw new Error('Nie znaleziono gracza Minecraft o tej nazwie.')
    }

    const uuid = profile.data.id.replace(
        /(.{8})(.{4})(.{4})(.{4})(.{12})/,
        '$1-$2-$3-$4-$5',
    )
    const name = profile.data.name ?? username

    const skinUrl = `https://crafatar.com/renders/body/${uuid}?overlay&scale=10`
    const avatarUrl = `https://crafatar.com/avatars/${uuid}?overlay`

    return {
        title: `Minecraft — ${name}`,
        color: 0x57a757,
        thumbnail: avatarUrl,
        image: skinUrl,
        fields: [
            { name: 'Nick', value: name, inline: true },
            { name: 'UUID', value: `\`${uuid}\``, inline: false },
            {
                name: 'Profil',
                value: `[NameMC](https://namemc.com/profile/${encodeURIComponent(name)})`,
                inline: true,
            },
            {
                name: 'Skin',
                value: `[Crafatar](https://crafatar.com/skins/${uuid})`,
                inline: true,
            },
        ],
    }
}
