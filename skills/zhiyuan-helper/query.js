#!/usr/bin/env node
'use strict'

/**
 * 高考录取数据查询脚本（Skill 内置版）
 * ─────────────────────────────────────
 * 读取同目录下的 schools.json，按条件过滤后输出 JSON。
 * 供 zhiyuan-helper skill 调用，不依赖外部路径。
 *
 * 用法:
 *   node skills/zhiyuan-helper/query.js --score 620 --sr 物化生 --province 广东
 *   node skills/zhiyuan-helper/query.js --estimate-rank --score 650 --year 2025
 */

const fs = require('fs')
const path = require('path')

// ===== 常量 =====
const SR_MAP = { '04': '物理', '05': '化学', '06': '生物' }
const DATA_FILE = path.join(__dirname, 'schools.json')
const SCORE_BUFFER = 10
const RANK_BUFFER_RATIO = 0.30
const DEFAULT_LIMIT = 200

// ===== SR 解析与宽松匹配 =====

function parseSrCodes(sr) {
  if (!sr || sr === '不限') return []
  if (sr.includes('*')) return sr.split('*').filter(Boolean)
  const map = { '物': '04', '理': '04', '化': '05', '生': '06' }
  const chars = sr.replace(/[+\s]/g, '')
  const codes = []
  for (const ch of chars) {
    const c = map[ch]
    if (c) codes.push(c)
  }
  return [...new Set(codes)]
}

function srMatch(userSr, schoolSr) {
  if (!schoolSr) return true
  const userSet = new Set(parseSrCodes(userSr))
  const schoolCodes = parseSrCodes(schoolSr)
  if (schoolCodes.length === 0) return true
  return schoolCodes.every(c => userSet.has(c))
}

function numericKeys(obj) {
  return Object.fromEntries(
    Object.entries(obj).filter(([k]) => /^\d{4}$/.test(k))
  )
}

// ===== 数据加载 =====

function loadData() {
  if (!fs.existsSync(DATA_FILE)) {
    throw new Error(`找不到数据文件: ${DATA_FILE}\n请先生成数据: node docs/build-data.js`)
  }
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'))
}

// ===== 过滤 =====

function passesScoreRank(group, score, rank) {
  const entries = Object.values(numericKeys(group.history))
  if (entries.length === 0) return true

  if (score != null && rank != null) {
    return entries.some(e =>
      (e.score != null && e.score >= score - SCORE_BUFFER && e.score <= score + SCORE_BUFFER) ||
      (e.rank != null && e.rank > 0 &&
        e.rank >= rank * (1 - RANK_BUFFER_RATIO) && e.rank <= rank * (1 + RANK_BUFFER_RATIO))
    )
  }
  if (score != null) {
    return entries.some(e => e.score != null && Math.abs(e.score - score) <= SCORE_BUFFER)
  }
  if (rank != null) {
    return entries.some(e =>
      e.rank != null && e.rank > 0 &&
      e.rank >= rank * (1 - RANK_BUFFER_RATIO) && e.rank <= rank * (1 + RANK_BUFFER_RATIO)
    )
  }
  return true
}

function filterSchools(schools, params) {
  const { province, batch, sr, keyword, year, score, rank } = params
  const provinceSet = province.length ? new Set(province) : null
  const batchSet = batch.length ? new Set(batch) : null
  const result = []

  for (const school of schools) {
    if (provinceSet && !provinceSet.has(school.province)) continue

    const matchedGroups = []

    for (const g of school.groups) {
      if (batchSet && !batchSet.has(g.batch)) continue
      if (sr && !srMatch(sr, g.sr)) continue
      if (keyword && g.name.indexOf(keyword) === -1) continue
      if (year && !g.history[year]) continue
      if (!passesScoreRank(g, score, rank)) continue

      matchedGroups.push(g)
    }

    if (matchedGroups.length > 0) {
      result.push({ ...school, groups: matchedGroups })
    }

    if (result.length >= params.limit) break
  }

  return result
}

// ===== 排名估算 =====

function estimateRank(schools, params) {
  const { score, year, sr } = params
  if (score == null || !year) {
    return { error: '需要 --score 和 --year' }
  }

  const matches = []
  for (const school of schools) {
    for (const g of school.groups) {
      if (sr && !srMatch(sr, g.sr)) continue
      const h = g.history[year]
      if (!h || h.score == null) continue
      if (Math.abs(h.score - score) > 5) continue
      if (h.rank != null && h.rank > 0) {
        matches.push(h.rank)
      }
    }
  }

  if (matches.length === 0) {
    return { score, year, estimatedRank: null, confidence: 'none', sampleSize: 0 }
  }

  const avgRank = Math.round(matches.reduce((a, b) => a + b, 0) / matches.length)
  const confidence = matches.length >= 50 ? 'high' : matches.length >= 20 ? 'medium' : 'low'
  return { score, year, estimatedRank: avgRank, confidence, sampleSize: matches.length }
}

// ===== CLI =====

function parseArgs() {
  const args = process.argv.slice(2)
  if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
    console.log(`
用法: node <skill-dir>/query.js [选项]

查询选项:
  --score <n>        考生分数 (匹配 ±10)
  --rank <n>         考生排名 (匹配 ±30%)
  --sr <str>         选科: 物化生 / 04*05*06
  --province <name>  省份 (可重复)
  --batch <name>     批次 (可重复)
  --keyword <str>    专业组关键词
  --year <str>       年份 2024|2025|2026
  --limit <n>        上限 (默认 200)

排名估算:
  --estimate-rank --score <n> --year <str> [--sr <str>]

示例:
  node skills/zhiyuan-helper/query.js --score 620 --sr 物化生 --province 广东
  node skills/zhiyuan-helper/query.js --estimate-rank --score 650 --year 2025
`)
    process.exit(0)
  }

  const params = { score: null, rank: null, sr: null, province: [], batch: [], keyword: null, year: null, limit: DEFAULT_LIMIT, estimateRank: false }

  for (let i = 0; i < args.length; i++) {
    const next = () => { const v = args[++i]; if (v === undefined) die(`缺少参数值: ${args[i-1]}`); return v }
    switch (args[i]) {
      case '--score': params.score = parseInt(next()); if (isNaN(params.score)) die('--score 需要数字'); break
      case '--rank': params.rank = parseInt(next()); if (isNaN(params.rank)) die('--rank 需要数字'); break
      case '--sr': params.sr = next(); break
      case '--province': params.province.push(next()); break
      case '--batch': params.batch.push(next()); break
      case '--keyword': params.keyword = next(); break
      case '--year': params.year = next(); if (!['2024','2025','2026'].includes(params.year)) die('--year 只能为 2024|2025|2026'); break
      case '--limit': params.limit = parseInt(next()); if (isNaN(params.limit) || params.limit < 1) die('--limit 需要正整数'); break
      case '--estimate-rank': params.estimateRank = true; break
      default: die(`未知参数: ${args[i]}`)
    }
  }
  return params
}

function die(msg) { console.error(`错误: ${msg}`); process.exit(1) }

// ===== 主流程 =====

function main() {
  const params = parseArgs()
  let data
  try { data = loadData() } catch (e) { die(e.message) }

  const schools = data.schools

  if (params.estimateRank) {
    const result = estimateRank(schools, params)
    console.log(JSON.stringify(result, null, 2))
    return
  }

  const matched = filterSchools(schools, params)

  // 补全缺失年份，确保始终有 2024/2025/2026 键
  const allYears = ['2024', '2025', '2026']
  for (const school of matched) {
    for (const g of school.groups) {
      for (const y of allYears) {
        if (!(y in g.history)) {
          g.history[y] = null
        }
      }
    }
  }

  const output = {
    params: {
      score: params.score,
      rank: params.rank,
      sr: params.sr,
      province: params.province.length ? params.province : undefined,
      keyword: params.keyword,
      year: params.year,
    },
    total: matched.reduce((sum, s) => sum + s.groups.length, 0),
    records: matched,
  }

  process.stdout.write(JSON.stringify(output, null, 2) + '\n')
}

main()
