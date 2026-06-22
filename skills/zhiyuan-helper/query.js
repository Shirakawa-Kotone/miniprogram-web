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
      if (keyword.length && !keyword.some(k => g.name.indexOf(k) !== -1)) continue
      if (year && !g.history[year]) continue
      if (!g.history?.['2026']) continue
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
  --keyword <str>    专业组关键词 (可重复, 多关键词 OR 匹配)
  --year <str>       年份 2024|2025|2026
  --limit <n>        上限 (默认 200)
  --all-years      输出所有年份数据（默认只输出 2026 年有招生的专业）
  --format <fmt>     输出格式: json (默认) 或 markdown

排名估算:
  --estimate-rank --score <n> --year <str> [--sr <str>]

示例:
  node skills/zhiyuan-helper/query.js --score 620 --sr 物化生 --province 广东
  node skills/zhiyuan-helper/query.js --estimate-rank --score 650 --year 2025
`)
    process.exit(0)
  }

  const params = { score: null, rank: null, sr: null, province: [], batch: [], keyword: [], year: null, limit: DEFAULT_LIMIT, estimateRank: false, format: 'json' }

  for (let i = 0; i < args.length; i++) {
    const next = () => { const v = args[++i]; if (v === undefined) die(`缺少参数值: ${args[i-1]}`); return v }
    switch (args[i]) {
      case '--score': params.score = parseInt(next()); if (isNaN(params.score)) die('--score 需要数字'); break
      case '--rank': params.rank = parseInt(next()); if (isNaN(params.rank)) die('--rank 需要数字'); break
      case '--sr': params.sr = next(); break
      case '--province': params.province.push(next()); break
      case '--batch': params.batch.push(next()); break
      case '--keyword': params.keyword.push(next()); break
      case '--year': params.year = next(); if (!['2024','2025','2026'].includes(params.year)) die('--year 只能为 2024|2025|2026'); break
      case '--limit': params.limit = parseInt(next()); if (isNaN(params.limit) || params.limit < 1) die('--limit 需要正整数'); break
      case '--format': params.format = next(); if (!['json','markdown'].includes(params.format)) die('--format 只能为 json|markdown'); break
      case '--estimate-rank': params.estimateRank = true; break
      default: die(`未知参数: ${args[i]}`)
    }
  }
  return params
}

function die(msg) { console.error(`错误: ${msg}`); process.exit(1) }

// ===== Markdown 格式化输出 =====

function cell(v) { return String(v ?? '').replace(/\|/g, '\\|') }

function splitName(name) {
  // "计算机类(电子信息工程、人工智能)" → {base: "计算机类", majors: "电子信息工程、人工智能"}
  // "工科试验班类(...)(计算机、软件)"" → {base: "工科试验班类(...)", majors: "计算机、软件"}
  const last = name.lastIndexOf('(')
  if (last > 0 && name.endsWith(')')) {
    return { base: name.slice(0, last), majors: name.slice(last + 1, -1) }
  }
  return { base: name, majors: '' }
}

function row(school, g) {
  const { base, majors } = splitName(g.name)
  const srShow = g.srDisplay || '不限'
  const h24 = g.history?.['2024']
  const h25 = g.history?.['2025']
  const s24 = h24 ? (h24.score ?? '') + '/' + (h24.rank ?? '') : '-'
  const s25 = h25 ? (h25.score ?? '') + '/' + (h25.rank ?? '') : '-'
  return `| ${cell(school.school)} | ${cell(school.code)} | ${cell(base)} | ${cell(majors)} | ${cell(g.code)} | ${cell(srShow)} | ${cell(g.batch)} | ${cell(s24)} | ${cell(s25)} | ${cell(g.remark)} |`
}

const TABLE_HEADER = '| 院校 | 院校代号 | 专业组 | 包含专业 | 专业组代号 | 选科 | 批次 | 2024分/排名 | 2025分/排名 | 备注 |'
const TABLE_SEP    = '|------|---------|--------|---------|-----------|------|------|-------------|-------------|------|'

function formatMarkdown(matched) {
  const lines = [TABLE_HEADER, TABLE_SEP]
  for (const school of matched) {
    for (const g of school.groups) {
      lines.push(row(school, g))
    }
  }
  return lines.join('\n')
}

// ===== 冲稳保分档 =====

function classify(matched, score, rank) {
  // 返回 { chong: [{school, group}], wen: [...], bao: [...] }
  const buckets = { chong: [], wen: [], bao: [] }

  for (const school of matched) {
    for (const g of school.groups) {
      const h24 = g.history?.['2024']
      const h25 = g.history?.['2025']

      if (rank) {
        const best = Math.min(h24?.rank ?? Infinity, h25?.rank ?? Infinity)
        if (best === Infinity) continue
        if (best < rank * 0.92) buckets.chong.push({ school, group: g })
        else if (best <= rank * 1.08) buckets.wen.push({ school, group: g })
        else buckets.bao.push({ school, group: g })
      } else if (score) {
        const best = Math.max(h24?.score ?? -Infinity, h25?.score ?? -Infinity)
        if (best === -Infinity) continue
        if (best > score + 5) buckets.chong.push({ school, group: g })
        else if (best >= score - 5) buckets.wen.push({ school, group: g })
        else buckets.bao.push({ school, group: g })
      } else {
        continue
      }
    }
  }

  // 各档内排序
  // 冲：差距从小到大
  buckets.chong.sort((a, b) => tierOrderAsc(a, b, score, rank))
  // 稳：从大到小（接近冲的先展示）
  buckets.wen.sort((a, b) => tierOrderDesc(a, b, score, rank))
  // 保：从大到小（最好的保底优先）
  buckets.bao.sort((a, b) => tierOrderDesc(a, b, score, rank))

  return buckets
}

function tierBestScore(item, score, rank) {
  const h24 = item.group.history?.['2024']
  const h25 = item.group.history?.['2025']
  if (rank) return Math.min(h24?.rank ?? Infinity, h25?.rank ?? Infinity)
  return Math.max(h24?.score ?? -Infinity, h25?.score ?? -Infinity)
}

function tierOrderAsc(a, b, score, rank) {
  return tierBestScore(a, score, rank) - tierBestScore(b, score, rank)
}

function tierOrderDesc(a, b, score, rank) {
  return tierBestScore(b, score, rank) - tierBestScore(a, score, rank)
}

function formatClassified(buckets, score, rank) {
  const lines = []
  const params = []
  if (score) params.push(score + '分')
  if (rank) params.push('排名约' + rank)

  const tierLabel = { chong: '🔥 冲（拼搏）', wen: '✅ 稳（稳妥）', bao: '🛡️ 保（保底）' }

  for (const t of ['chong', 'wen', 'bao']) {
    const items = buckets[t]
    if (!items.length) {
      lines.push('### ' + tierLabel[t] + ' — 暂无')
      lines.push('')
      continue
    }
    lines.push('### ' + tierLabel[t] + ' — ' + items.length + ' 个专业组')
    lines.push(TABLE_HEADER)
    lines.push(TABLE_SEP)
    for (const { school, group: g } of items) {
      lines.push(row(school, g))
    }
    lines.push('')
  }

  return lines.join('\n')
}

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

  // 补全缺失年份，确保始终有 2024/2025 键
  const allYears = ['2024', '2025']
  for (const school of matched) {
    for (const g of school.groups) {
      for (const y of allYears) {
        if (!(y in g.history)) {
          g.history[y] = null
        }
      }
    }
  }

  // JSON 输出：如有分数/排名，给每个专业组标注 tier
  if (params.score || params.rank) {
    const buckets = classify(matched, params.score, params.rank)
    // 清空 matched 里的 groups，按分档顺序重建（含 tier 标记）
    const tierLabel = { chong: '冲', wen: '稳', bao: '保' }
    for (const school of matched) school.groups = []
    for (const t of ['chong', 'wen', 'bao']) {
      for (const { school, group } of buckets[t]) {
        school.groups.push({ ...group, tier: tierLabel[t] })
      }
    }
    // 去掉没有专业组的院校
    for (let i = matched.length - 1; i >= 0; i--) {
      if (!matched[i].groups.length) matched.splice(i, 1)
    }
  }

  const output = {
    params: {
      score: params.score,
      rank: params.rank,
      sr: params.sr,
      province: params.province.length ? params.province : undefined,
      keyword: params.keyword.length ? params.keyword : undefined,
      year: params.year,
    },
    total: matched.reduce((sum, s) => sum + s.groups.length, 0),
    records: matched,
  }

  process.stdout.write(JSON.stringify(output, null, 2) + '\n')
}

main()
