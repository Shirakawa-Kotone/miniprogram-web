#!/usr/bin/env node
'use strict'

/**
 * 高考录取数据构建脚本 (history/build-data.js)
 * ───────────────────────────────────────────────
 * 读取 xlsx 历史类数据 → 输出压缩格式 alldata.js
 *
 * 用法: node history/build-data.js
 * 输出: history/alldata.js
 */

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

// 选科代码映射（历史类）
const SR_MAP = { '08': '历史', '07': '思想政治', '09': '地理' }
const SR_RMAP = ['08', '08*07', '08*07*09', '08*09']

// ===== 数据加载（python3 + openpyxl → 临时 JSON 文件） =====

function loadData() {
  const xlsxPath = path.resolve(__dirname, '..', '江西省2024-2025年录取数据_47153条.xlsx')
  if (!fs.existsSync(xlsxPath)) {
    console.error(`错误: 找不到 ${xlsxPath}`)
    process.exit(1)
  }

  const jsonFile = path.join(__dirname, '_temp_data.json')
  const pyFile = path.join(__dirname, '_load_data.py')

  const pyScript = `
import json, openpyxl
wb = openpyxl.load_workbook('${xlsxPath}', read_only=True)
ws = wb.active
# Read headers
headers = [c.value for c in next(ws.iter_rows(min_row=1, max_row=1))]
# Read all rows (fast: iter_rows)
rows = [list(r) for r in ws.iter_rows(min_row=2, values_only=True)]
with open('${jsonFile}', 'w', encoding='utf-8') as f:
  json.dump({'headers': headers, 'rows': rows}, f, ensure_ascii=False)
print(f'OK, {len(rows)} rows')
`

  fs.writeFileSync(pyFile, pyScript, 'utf-8')

  try {
    const result = execSync(`python3 "${pyFile}"`, {
      encoding: 'utf-8',
      timeout: 120000,
    })
    console.log('Python 导出完成:', result.trim())
    const raw = fs.readFileSync(jsonFile, 'utf-8')
    return JSON.parse(raw)
  } finally {
    try { fs.unlinkSync(pyFile) } catch (_) {}
    try { fs.unlinkSync(jsonFile) } catch (_) {}
  }
}

// ===== 主流程 =====

function main() {
  console.log('正在读取 xlsx 数据...')
  const { headers, rows } = loadData()
  console.log(`共读取 ${rows.length} 行`)

  // 字段索引
  const idx = {}
  headers.forEach((h, i) => { idx[h] = i })

  // ---- 1. 去重 ----
  const seen = new Set()
  const deduped = []
  for (const row of rows) {
    // 去重: year | schoolCode | groupCode | major | score | rank | count
    const key = `${row[idx['年份']]}|${row[idx['院校代号']]}|${row[idx['专业组代码']]}|${row[idx['录取专业']]}|${row[idx['最低分']]}|${row[idx['最低排名']]}|${row[idx['录取人数']]}`
    if (!seen.has(key)) {
      seen.add(key)
      deduped.push(row)
    }
  }
  console.log(`去重后: ${deduped.length} 行 (去除了 ${rows.length - deduped.length} 重复行)`)

  // ---- 2. 按 (year, schoolCode, groupCode) 聚合 ----
  const groupMap = new Map()
  for (const row of deduped) {
    const year = String(row[idx['年份']])
    const schoolCode = String(row[idx['院校代号']])
    const groupCode = String(row[idx['专业组代码']])
    const key = `${year}|${schoolCode}|${groupCode}`

    if (!groupMap.has(key)) {
      groupMap.set(key, {
        year,
        province: String(row[idx['院校省市']] || ''),
        schoolCode,
        schoolName: String(row[idx['院校名称']] || ''),
        batch: String(row[idx['批次']] || ''),
        planType: String(row[idx['计划性质']] || ''),
        sr: String(row[idx['选科要求']] || ''),
        groupCode,
        groupName: String(row[idx['专业组名称']] || ''),
        remark: String(row[idx['专业备注']] || ''),
        fee: String(row[idx['收费标准(元/年)']] || ''),
        score: row[idx['最低分']] != null && row[idx['最低分']] !== '' ? Number(row[idx['最低分']]) : 0,
        rank: row[idx['最低排名']] != null && row[idx['最低排名']] !== '' ? Number(row[idx['最低排名']]) : 0,
        count: row[idx['录取人数']] != null && row[idx['录取人数']] !== '' ? Number(row[idx['录取人数']]) : 0,
      })
    }
  }

  const records = Array.from(groupMap.values())
  console.log(`聚合后: ${records.length} 条记录`)

  const yearCount = {}
  for (const r of records) {
    yearCount[r.year] = (yearCount[r.year] || 0) + 1
  }
  console.log('各年份记录数:', yearCount)

  // ---- 3. 构建字符串池 ----
  const poolA = new Map()
  const poolB = new Map()
  const poolC = new Map()
  const poolBatch = new Map()
  const poolPlan = new Map()
  const poolGC = new Map()
  const poolFee = new Map()
  const poolRemark = new Map()

  function getOrAdd(map, key) {
    if (map.has(key)) return map.get(key)
    if (!key && key !== 0) {
      map.set('', map.size)
      return map.get('')
    }
    const i = map.size
    map.set(key, i)
    return i
  }

  const d = records.map(r => {
    const provinceIdx = getOrAdd(poolA, r.province)
    const schoolIdx = getOrAdd(poolB, r.schoolName)
    const groupIdx = getOrAdd(poolC, r.groupName)
    const batchIdx = getOrAdd(poolBatch, r.batch)
    const planIdx = getOrAdd(poolPlan, r.planType)
    const gcIdx = getOrAdd(poolGC, r.groupCode)
    const feeIdx = getOrAdd(poolFee, r.fee)
    const remarkIdx = getOrAdd(poolRemark, r.remark)
    const yearIdx = r.year === '2025' ? 1 : 0
    // srIdx: -1=不限, 0='08', 1='08*07', 2='08*07*09', 3='08*09'
    let srIdx = -1
    if (r.sr) {
      srIdx = SR_RMAP.indexOf(r.sr)
    }
    return [
      yearIdx, provinceIdx, r.schoolCode, schoolIdx, srIdx, groupIdx,
      r.score, r.rank, r.count, batchIdx, planIdx, gcIdx, feeIdx, remarkIdx, null,
    ]
  })

  // ---- 4. 输出 ----
  function poolToArray(pool) {
    const arr = new Array(pool.size)
    for (const [key, i] of pool) arr[i] = key
    return arr
  }

  const output = {
    a: poolToArray(poolA),
    b: poolToArray(poolB),
    c: poolToArray(poolC),
    d,
    e: {
      b: poolToArray(poolBatch),
      p: poolToArray(poolPlan),
      g: poolToArray(poolGC),
      f: poolToArray(poolFee),
      r: poolToArray(poolRemark),
    },
  }

  // 学校排名（与物理版一致）
  const schoolRankings = {
    year: 2026, source: '软科中国大学排名（主榜）',
    rankings_985: [
      { rank: 1, name: '清华大学' }, { rank: 2, name: '北京大学' }, { rank: 3, name: '浙江大学' },
      { rank: 4, name: '上海交通大学' }, { rank: 5, name: '复旦大学' }, { rank: 6, name: '南京大学' },
      { rank: 7, name: '中国科学技术大学' }, { rank: 8, name: '武汉大学' }, { rank: 9, name: '华中科技大学' },
      { rank: 10, name: '西安交通大学' }, { rank: 11, name: '北京航空航天大学' }, { rank: 12, name: '哈尔滨工业大学' },
      { rank: 13, name: '中山大学' }, { rank: 14, name: '北京理工大学' }, { rank: 15, name: '东南大学' },
      { rank: 16, name: '四川大学' }, { rank: 17, name: '中国人民大学' }, { rank: 18, name: '同济大学' },
      { rank: 19, name: '北京师范大学' }, { rank: 20, name: '天津大学' }, { rank: 21, name: '南开大学' },
      { rank: 22, name: '山东大学' }, { rank: 23, name: '西北工业大学' }, { rank: 24, name: '中国农业大学' },
      { rank: 25, name: '厦门大学' }, { rank: 26, name: '吉林大学' }, { rank: 27, name: '中南大学' },
      { rank: 28, name: '大连理工大学' }, { rank: 29, name: '华东师范大学' }, { rank: 31, name: '湖南大学' },
      { rank: 32, name: '华南理工大学' }, { rank: 33, name: '电子科技大学' }, { rank: 34, name: '重庆大学' },
      { rank: 38, name: '东北大学' }, { rank: 40, name: '兰州大学' }, { rank: 51, name: '中国海洋大学' },
      { rank: 69, name: '西北农林科技大学' }, { rank: 79, name: '中央民族大学' },
    ],
    rankings_211_only: [
      { rank: 35, name: '北京科技大学' }, { rank: 35, name: '上海财经大学' }, { rank: 36, name: '南京理工大学' },
      { rank: 37, name: '南京航空航天大学' }, { rank: 39, name: '西安电子科技大学' }, { rank: 41, name: '北京交通大学' },
      { rank: 42, name: '华东理工大学' }, { rank: 42, name: '中央财经大学' }, { rank: 43, name: '哈尔滨工程大学' },
      { rank: 44, name: '郑州大学' }, { rank: 45, name: '华中农业大学' }, { rank: 46, name: '苏州大学' },
      { rank: 48, name: '东北师范大学' }, { rank: 49, name: '西南交通大学' }, { rank: 50, name: '北京邮电大学' },
      { rank: 52, name: '江南大学' }, { rank: 53, name: '华中师范大学' }, { rank: 54, name: '武汉理工大学' },
      { rank: 55, name: '南京农业大学' }, { rank: 56, name: '中国地质大学（武汉）' }, { rank: 56, name: '中国政法大学' },
      { rank: 57, name: '北京化工大学' }, { rank: 57, name: '对外经济贸易大学' }, { rank: 57, name: '中南财经政法大学' },
      { rank: 58, name: '南京师范大学' }, { rank: 59, name: '暨南大学' }, { rank: 60, name: '上海大学' },
      { rank: 60, name: '天津医科大学' }, { rank: 61, name: '西南大学' }, { rank: 62, name: '中国石油大学（北京）' },
      { rank: 63, name: '河海大学' }, { rank: 63, name: '陕西师范大学' }, { rank: 63, name: '北京中医药大学' },
      { rank: 65, name: '北京工业大学' }, { rank: 66, name: '西南财经大学' }, { rank: 67, name: '中国矿业大学' },
      { rank: 70, name: '西北大学' }, { rank: 71, name: '云南大学' }, { rank: 72, name: '东华大学' },
      { rank: 73, name: '中国石油大学（华东）' }, { rank: 74, name: '南昌大学' }, { rank: 75, name: '中国地质大学（北京）' },
      { rank: 76, name: '中国矿业大学（北京）' }, { rank: 77, name: '福州大学' }, { rank: 79, name: '华南师范大学' },
      { rank: 79, name: '北京外国语大学' }, { rank: 80, name: '合肥工业大学' }, { rank: 81, name: '上海外国语大学' },
      { rank: 82, name: '中国传媒大学' }, { rank: 83, name: '北京林业大学' }, { rank: 84, name: '华北电力大学' },
      { rank: 85, name: '贵州大学' }, { rank: 86, name: '广西大学' }, { rank: 87, name: '海南大学' },
      { rank: 88, name: '中国药科大学' }, { rank: 89, name: '长安大学' }, { rank: 92, name: '湖南师范大学' },
      { rank: 97, name: '太原理工大学' }, { rank: 101, name: '安徽大学' }, { rank: 107, name: '河北工业大学' },
      { rank: 113, name: '大连海事大学' }, { rank: 114, name: '内蒙古大学' }, { rank: 115, name: '东北林业大学' },
      { rank: 120, name: '东北农业大学' }, { rank: 125, name: '辽宁大学' }, { rank: 131, name: '新疆大学' },
      { rank: 134, name: '四川农业大学' }, { rank: 135, name: '石河子大学' }, { rank: 137, name: '宁夏大学' },
      { rank: 157, name: '延边大学' }, { rank: 177, name: '北京体育大学' }, { rank: 201, name: '西藏大学' },
      { rank: 203, name: '青海大学' },
    ],
    not_in_main_ranking: [
      '国防科技大学（军事院校）', '海军军医大学（军事院校）',
      '空军军医大学（军事院校）', '中央音乐学院（艺术类院校）',
    ],
  }

  // ---- 5. 写入文件 ----
  const outPath = path.join(__dirname, 'alldata.js')

  const schoolTags = {
    '985': [
      '清华大学', '北京大学', '中国人民大学', '北京航空航天大学', '北京理工大学',
      '中国农业大学', '北京师范大学', '中央民族大学', '复旦大学', '上海交通大学',
      '同济大学', '华东师范大学', '西安交通大学', '西北工业大学', '西北农林科技大学',
      '中南大学', '湖南大学', '国防科技大学', '南京大学', '东南大学', '四川大学',
      '电子科技大学', '东北大学', '大连理工大学', '山东大学', '中国海洋大学',
      '武汉大学', '华中科技大学', '中山大学', '华南理工大学', '南开大学', '天津大学',
      '浙江大学', '中国科学技术大学', '哈尔滨工业大学', '吉林大学', '厦门大学',
      '重庆大学', '兰州大学',
    ],
    '211': [
      '清华大学', '北京大学', '中国人民大学', '北京交通大学', '北京工业大学',
      '北京航空航天大学', '北京理工大学', '北京科技大学', '北京化工大学', '北京邮电大学',
      '中国农业大学', '北京林业大学', '中国传媒大学', '中央民族大学', '北京师范大学',
      '中央音乐学院', '对外经济贸易大学', '北京中医药大学', '北京外国语大学',
      '中国地质大学（北京）', '中国矿业大学（北京）', '中国石油大学（北京）',
      '中国政法大学', '中央财经大学', '华北电力大学', '北京体育大学',
      '复旦大学', '上海交通大学', '同济大学', '华东师范大学', '上海外国语大学',
      '上海大学', '东华大学', '上海财经大学', '华东理工大学', '海军军医大学',
      '南京大学', '东南大学', '苏州大学', '南京师范大学', '中国矿业大学',
      '中国药科大学', '河海大学', '南京理工大学', '江南大学', '南京农业大学',
      '南京航空航天大学', '西北大学', '西安交通大学', '西北工业大学', '长安大学',
      '西北农林科技大学', '陕西师范大学', '西安电子科技大学', '空军军医大学',
      '武汉大学', '华中科技大学', '武汉理工大学', '中南财经政法大学', '华中师范大学',
      '华中农业大学', '中国地质大学（武汉）', '四川大学', '西南交通大学',
      '电子科技大学', '四川农业大学', '西南财经大学', '中山大学', '暨南大学',
      '华南理工大学', '华南师范大学', '大连理工大学', '东北大学', '辽宁大学',
      '大连海事大学', '湖南大学', '中南大学', '湖南师范大学', '国防科技大学',
      '哈尔滨工业大学', '哈尔滨工程大学', '东北农业大学', '东北林业大学',
      '南开大学', '天津大学', '天津医科大学', '吉林大学', '延边大学', '东北师范大学',
      '中国科学技术大学', '安徽大学', '合肥工业大学', '山东大学', '中国海洋大学',
      '中国石油大学（华东）', '重庆大学', '西南大学', '厦门大学', '福州大学',
      '华北电力大学（保定）', '河北工业大学', '新疆大学', '石河子大学', '太原理工大学',
      '内蒙古大学', '浙江大学', '南昌大学', '郑州大学', '广西大学', '云南大学',
      '贵州大学', '兰州大学', '宁夏大学', '青海大学', '海南大学', '西藏大学',
    ],
  }

  const code = 'window.LISHI_DATA_RAW = ' + JSON.stringify(output) +
    ';\n\nwindow.SCHOOL_TAGS = ' + JSON.stringify(schoolTags, null, 2) +
    ';\n\nwindow.SCHOOL_RANKINGS = ' + JSON.stringify(schoolRankings, null, 2) + ';\n'
  fs.writeFileSync(outPath, code, 'utf-8')

  const rawSize = Buffer.byteLength(code, 'utf-8')
  console.log(`\n写入完成: ${outPath}`)
  console.log(`文件大小: ${(rawSize / 1024 / 1024).toFixed(2)} MB`)
  console.log(`记录总数: ${d.length}`)
  console.log(`省份数: ${poolA.size}`)
  console.log(`院校数: ${poolB.size}`)
  console.log(`专业组数: ${poolC.size}`)
  console.log(`批次池: ${poolBatch.size}`)
  console.log(`性质池: ${poolPlan.size}`)
  console.log(`专业组代码池: ${poolGC.size}`)
  console.log(`收费池: ${poolFee.size}`)
  console.log(`备注池: ${poolRemark.size}`)
}

main()
