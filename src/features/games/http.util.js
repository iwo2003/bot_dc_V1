/**
 * @param {string} url
 * @param {RequestInit & { headers?: Record<string, string> }} [options]
 */
export async function fetchJson(url, options = {}) {
    const res = await fetch(url, {
        ...options,
        headers: {
            Accept: 'application/json',
            ...options.headers,
        },
    })

    if (res.status === 404) {
        return { ok: false, status: 404, data: null }
    }

    const text = await res.text()
    let data = null
    try {
        data = text ? JSON.parse(text) : null
    } catch {
        data = { raw: text }
    }

    if (!res.ok) {
        return { ok: false, status: res.status, data }
    }

    return { ok: true, status: res.status, data }
}
