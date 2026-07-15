#!/usr/bin/env node

/**
 * 禾 · 媒体记录 CLI（零依赖版）
 * 仅需 Node.js 18+，无需 npm install
 *
 * 用法：
 *   node he.mjs register --email xxx --password xxx --username xxx
 *   node he.mjs login --email xxx --password xxx
 *   node he.mjs search "三体"
 *   node he.mjs add --title "三体" --type tv --status wishlist
 *   node he.mjs list --status wishlist
 *   node he.mjs update <id> --status watched --rating 4
 *   node he.mjs delete <id>
 *   node he.mjs whoami
 *   node he.mjs logout
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, dirname } from 'node:path'

// 全局错误处理（超时、网络错误等）
function handleError(err) {
  const msg = err?.name === 'AbortError' ? '请求超时，请检查网络连接' : (err?.message || '未知错误')
  out({ error: msg })
  process.exit(1)
}

// ===== 配置（API key 已隐藏在代理服务器中，零密钥泄露）=====
const API_BASE = 'https://he-viewport.vercel.app/api'
const TOKEN_PATH = join(homedir(), '.he', 'auth.json')

// ===== 工具函数 =====

function fetchTimeout(url, opts = {}, ms = 8000) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(t))
}

function parseArgs(argv) {
  const args = argv.slice(2)
  const command = args[0] || ''
  const rest = args.slice(1)
  const opts = {}
  const positional = []
  for (let i = 0; i < rest.length; i++) {
    if (rest[i].startsWith('--')) {
      const k = rest[i].slice(2)
      if (i + 1 < rest.length && !rest[i + 1].startsWith('--')) {
        opts[k] = rest[++i]
      } else {
        opts[k] = true
      }
    } else {
      positional.push(rest[i])
    }
  }
  return { command, opts, positional }
}

function out(data) {
  console.log(JSON.stringify(data, null, 2))
}

function getToken() {
  if (!existsSync(TOKEN_PATH)) {
    out({ error: '未登录，请先执行 login 命令' })
    process.exit(1)
  }
  return JSON.parse(readFileSync(TOKEN_PATH, 'utf-8'))
}

async function dbRequest(method, path, body) {
  const token = getToken()
  const headers = {
    Authorization: `Bearer ${token.access_token}`,
    'Content-Type': 'application/json',
  }
  if (body) headers['Prefer'] = 'return=representation'

  const res = await fetchTimeout(`${API_BASE}/${path}`, {
    method, headers, body: body ? JSON.stringify(body) : undefined,
  })

  if (res.status === 401) {
    try { unlinkSync(TOKEN_PATH) } catch {}
    out({ error: '登录已过期，请重新执行 login' })
    process.exit(1)
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    out({ error: err.error || err.message || err.code || `HTTP ${res.status}` })
    process.exit(1)
  }
  return res.status === 204 ? null : res.json()
}

// ===== 认证命令 =====

async function register(opts) {
  if (!opts.email || !opts.password || !opts.username) {
    out({ error: '用法: he register --email xxx --password xxx --username xxx' })
    process.exit(1)
  }
  const res = await fetchTimeout(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: opts.email, password: opts.password, username: opts.username,
    }),
  })
  const data = await res.json()
  if (!res.ok) {
    out({ error: data.error || '注册失败' })
    process.exit(1)
  }
  if (data.access_token) {
    mkdirSync(dirname(TOKEN_PATH), { recursive: true })
    writeFileSync(TOKEN_PATH, JSON.stringify({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      user_id: data.user_id, email: data.email,
    }))
  }
  out({
    success: true, user_id: data.user_id, email: data.email,
    session: !!data.access_token,
    message: data.message || (data.access_token ? '注册成功，已自动登录' : '注册成功，请执行 login 登录'),
  })
}

async function login(opts) {
  if (!opts.email || !opts.password) {
    out({ error: '用法: he login --email xxx --password xxx' })
    process.exit(1)
  }
  const res = await fetchTimeout(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: opts.email, password: opts.password }),
  })
  const data = await res.json()
  if (!res.ok) {
    out({ error: data.error || '登录失败' })
    process.exit(1)
  }
  mkdirSync(dirname(TOKEN_PATH), { recursive: true })
  writeFileSync(TOKEN_PATH, JSON.stringify({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    user_id: data.user_id, email: data.email,
  }))
  out({ success: true, user_id: data.user_id, email: data.email })
}

async function logout() {
  try { unlinkSync(TOKEN_PATH) } catch {}
  out({ success: true, message: '已退出登录' })
}

async function whoami() {
  if (!existsSync(TOKEN_PATH)) {
    out({ authenticated: false, message: '未登录，请先执行 login' })
    return
  }
  const token = getToken()
  const res = await fetchTimeout(`${API_BASE}/whoami`, {
    headers: { Authorization: `Bearer ${token.access_token}` },
  })
  const data = await res.json().catch(() => ({ authenticated: false }))
  if (!data.authenticated) {
    try { unlinkSync(TOKEN_PATH) } catch {}
  }
  out(data)
}

// ===== 搜索（无需登录）=====

async function search(opts, positional) {
  const query = positional[0]
  if (!query) { out({ error: '用法: he search "关键词"' }); process.exit(1) }

  const params = new URLSearchParams({ q: query })
  if (opts.type) params.set('type', opts.type)

  const res = await fetchTimeout(`${API_BASE}/search?${params}`)
  if (!res.ok) {
    out({ error: '搜索失败，请稍后重试' })
    process.exit(1)
  }
  out(await res.json())
}

// ===== 记录 CRUD（需要登录）=====

async function add(opts) {
  if (!opts.title || !opts.type || !opts.status) {
    out({ error: '用法: he add --title xxx --type movie|tv|book --status watched|wishlist' })
    process.exit(1)
  }
  const token = getToken()
  const body = {
    title: opts.title, type: opts.type, status: opts.status,
    rating: parseInt(opts.rating) || 0, review: opts.review || '',
    cover_url: opts.cover || '', external_id: opts['external-id'] || null,
    external_source: opts['external-source'] || null, tags: [],
    user_id: token.user_id,
    watched_date: new Date().toISOString().split('T')[0],
  }
  const data = await dbRequest('POST', 'records', body)
  out({ success: true, id: data[0].id, title: data[0].title, status: data[0].status })
}

async function list(opts) {
  let path = `records?select=id,title,type,status,rating,watched_date,cover_url&order=created_at.desc`
  if (opts.status) path += `&status=eq.${opts.status}`
  if (opts.type) path += `&type=eq.${opts.type}`
  const data = await dbRequest('GET', path)
  out(data)
}

async function update(opts, positional) {
  const id = positional[0]
  if (!id) { out({ error: '用法: he update <id> --status watched --rating 4' }); process.exit(1) }
  const updates = { updated_at: new Date().toISOString() }
  if (opts.status) updates.status = opts.status
  if (opts.rating) updates.rating = parseInt(opts.rating)
  if (opts.review !== undefined) updates.review = opts.review
  await dbRequest('PATCH', `records?id=eq.${id}`, updates)
  out({ success: true, id })
}

async function del(positional) {
  const id = positional[0]
  if (!id) { out({ error: '用法: he delete <id>' }); process.exit(1) }
  await dbRequest('DELETE', `records?id=eq.${id}`)
  out({ success: true, id })
}

// ===== 主入口 =====

const { command, opts, positional } = parseArgs(process.argv)

async function main() {
  switch (command) {
    case 'register': await register(opts); break
    case 'login': await login(opts); break
    case 'logout': await logout(); break
    case 'whoami': await whoami(); break
    case 'search': await search(opts, positional); break
    case 'add': await add(opts); break
    case 'list': await list(opts); break
    case 'update': await update(opts, positional); break
    case 'delete': await del(positional); break
    default:
      out({ error: `未知命令: ${command}`, commands: ['register', 'login', 'logout', 'whoami', 'search', 'add', 'list', 'update', 'delete'] })
      process.exit(1)
  }
}

main().catch(handleError)
