/* ============================================================
   App: 高考录取数据查询 - Web版
   移植自微信小程序，适配移动端浏览器 + GitHub Pages
   ============================================================ */

// ============================================================
// 常量
// ============================================================
const SR_RMAP = ['04*05', '04', '04*06', '04*05*06']
const SR_MAP = { '04': '物理', '05': '化学', '06': '生物' }

const PROVINCES_ALL = [
  '安徽', '北京', '重庆', '福建', '甘肃', '广东', '广西', '贵州',
  '海南', '河北', '河南', '黑龙江', '湖北', '湖南', '吉林', '江苏', '江西',
  '辽宁', '内蒙古', '宁夏', '青海', '山东', '山西', '陕西', '上海', '四川',
  '天津', '西藏', '香港', '新疆', '云南', '浙江'
]

const SR_LIST = ['不限', '物化生', '物化政', '物化地', '物政生', '物政地', '物生地']
const SR_CODES = ['', '04*05*06', '04*05', '04*05', '04*06', '04', '04*06']
let BATCH_ALL = []  // 动态填充：从展开数据中提取的唯一批次列表
const PAGE_SIZE = 30
const SEARCH_DEBOUNCE = 200

const MOON_SVG = '<svg viewBox="0 0 24 24" width="1.2em" height="1.2em"><path fill="currentColor" d="M7.5 2c-1.79 1.15-3 3.18-3 5.5s1.21 4.35 3.03 5.5C4.46 13 2 10.54 2 7.5A5.5 5.5 0 0 1 7.5 2m11.57 1.5l1.43 1.43L4.93 20.5L3.5 19.07zm-6.18 2.43L11.41 5L9.97 6l.42-1.7L9 3.24l1.75-.12l.58-1.65L12 3.1l1.73.03l-1.35 1.13zm-3.3 3.61l-1.16-.73l-1.12.78l.34-1.32l-1.09-.83l1.36-.09l.45-1.29l.51 1.27l1.36.03l-1.05.87zM19 13.5a5.5 5.5 0 0 1-5.5 5.5c-1.22 0-2.35-.4-3.26-1.07l7.69-7.69c.67.91 1.07 2.04 1.07 3.26m-4.4 6.58l2.77-1.15l-.24 3.35zm4.33-2.7l1.15-2.77l2.2 2.54zm1.15-4.96l-1.14-2.78l3.34.24zM9.63 18.93l2.77 1.15l-2.53 2.19z"></path></svg>'

// ============================================================
// 志愿填报辅助 — 地区定义
// ============================================================
const REGIONS = {
  '全部省份': null,
  '东部沿海': ['辽宁','河北','天津','山东','江苏','上海','浙江','福建','广东'],
  '长三角': ['上海','江苏','浙江'],
  '珠三角': ['广东'],
  '京津冀': ['北京','天津','河北'],
  '江浙沪': ['江苏','浙江','上海'],
  '北上广': ['北京','上海','广东'],
  '长江以南': ['上海','江苏','浙江','安徽','福建','江西','湖北','湖南','广东','广西','海南','重庆','四川','贵州','云南','西藏'],
  '长江以北': ['北京','天津','河北','山西','内蒙古','辽宁','吉林','黑龙江','山东','河南','陕西','甘肃','青海','宁夏','新疆'],
  '华中': ['河南','湖北','湖南'],
  '东北': ['辽宁','吉林','黑龙江'],
  '西北': ['陕西','甘肃','青海','宁夏','新疆'],
  '西南': ['重庆','四川','贵州','云南','西藏'],
  '本省': ['江西'],
  '除了本省': ['北京','天津','河北','山西','内蒙古','辽宁','吉林','黑龙江','上海','江苏','浙江','安徽','福建','山东','河南','湖北','湖南','广东','广西','海南','重庆','四川','贵州','云南','西藏','陕西','甘肃','青海','宁夏','新疆','香港'],
}
const REGION_NAMES = Object.keys(REGIONS)

// 辅助面板选科选项（3+1+2 实际组合）
const AS_SR_LIST = ['物化生', '物化政', '物化地', '物政生', '物政地', '物生地']
const AS_SR_CODES = ['04*05*06', '04*05', '04*05', '04*06', '04', '04*06']

const ALGO_LIST = [
  { value: 'default', label: '默认（可推荐新专业）', desc: '优先使用2026年预估排名划定冲稳保，若无2026预估排名数据则参考2024-2025年平均排名。此模式下2026年新增的院校专业组也能获得推荐，适合希望全面了解所有可选机会的考生。' },
  { value: 'min', label: '按最低（最激进）', desc: '仅使用2024-2025年的最低排名（即该专业组录取名次最好的年份）作为参考依据，不使用2026预估排名，不会推荐无历史数据的新增专业。此模式参考的录取门槛最低，给出的冲稳保判断最为激进，适合敢于冲刺且对某专业有强烈意愿的考生。' },
  { value: 'avg', label: '按平均', desc: '仅使用2024-2025年的平均排名作为参考依据，不使用2026预估排名，不会推荐无历史数据的新增专业。此模式用历史平均水平来衡量冲稳保，适合参考往年录取趋势做判断的考生。' },
  { value: 'max', label: '按最高（最保守）', desc: '仅使用2024-2025年的最高排名（即该专业组录取名次最差的年份）作为参考依据，不使用2026预估排名，不会推荐无历史数据的新增专业。此模式参考的录取门槛最高，给出的冲稳保判断最为保守，适合风险承受能力较低的考生。' },
  { value: 'only2024', label: '仅2024', desc: '仅使用2024年的录取数据作为参考依据，不考虑2025年及2026年预估数据，适合希望完全参照2024年录取情况的考生。' },
  { value: 'only2025', label: '仅2025', desc: '仅使用2025年的录取数据作为参考依据，不考虑2024年及2026年预估数据，适合希望完全参照2025年录取情况的考生。' },
]

// ============================================================
// 应用状态
// ============================================================
const state = {
  // Data
  allData: [],          // 全量展开数据
  allData2024: [],
  allData2025: [],
  allData2026: [],
  mergedCache: null,    // 合并缓存（全部模式）
  searchCache: [],      // 搜索结果缓存
  searchIsGrouped: false,

  // Filters
  year: '',
  selectedProvinces: [],
  provinceLabel: '全部省份',
  selectedBatches: [],
  batchLabel: '全部批次',
  asSelectedBatches: [],
  asBatchLabel: '全部批次',
  code: '',
  name: '',
  srIdx: 0,
  groupName: '',
  groupCode: '',
  minScore: '',
  maxRank: '',
  only2026: false,
  hideSports: false,
  hideCoop: false,
  assistantHideCoop: false,
  assistantOnly985211: false,
  darkMode: false,

  // UI
  loaded: false,
  filterHidden: false,
  displayList: [],
  page: 0,
  totalCount: 0,
  hasMore: false,
  loadTime: 0,
  remarkExpanded: {},

  // Province picker temp state
  tempSelectedProvinces: [],
  tempChecked: [],

  // Batch picker temp state
  tempSelectedBatches: [],
  tempBatchChecked: [],

  // Tutorial
  tutorialMode: 'merged',
  tutorialStep: 0,
  tutorialSteps: [],
  tutorialDemo: null,
  tutorialRemarkExpanded: false,

  // Assistant: 服从调剂
  assistantAdjust: false,
  assistantAdjustExpanded: {},
  assistantAlgoIdx: 0,           // index into ALGO_LIST
}

// DOM references (set once on init)
let DOM = {}

// 批次选择上下文：'search' | 'assistant'
let _batchCtx = 'search'

// ============================================================
// 数据加载 & 展开（分块处理，支持进度更新）
// ============================================================
function expandAllData(startPct, callback) {
  if (!window.ALL_DATA_RAW) {
    updateProgress(100, '数据文件未加载，请刷新重试')
    if (callback) callback(false)
    return
  }

  updateProgress(startPct || 25, '正在展开数据...')

  const raw = window.ALL_DATA_RAW
  const { a: provincePool, b: schoolNamePool, c: groupNamePool, d: records, e: extra } = raw
  const { b: batchPool, p: planPool, g: gcPool, f: feePool, r: remarkPool, sl: schoolLinkPool } = extra
  const out = new Array(records.length)
  const yearMap = ['2024', '2025', '2026']
  const TOTAL = records.length

  // 按年份分三段处理：2024(0-22472), 2025(22472-47184), 2026(47184-74163)
  const yearRanges = [
    { start: 0, end: 22471, label: '2024', pct: 35 },
    { start: 22472, end: 47183, label: '2025', pct: 45 },
    { start: 47184, end: TOTAL - 1, label: '2026', pct: 55 },
  ]

  let rangeIdx = 0

  function processRange() {
    if (rangeIdx >= yearRanges.length) {
      // 全部展开完成
      state.allData = out
      updateProgress(62, '数据展开完成，正在构建索引...')

      setTimeout(() => {
        updateProgress(68, '正在按年份拆分数据...')
        // 这里数据已经就绪，但 splitByYear 被延迟到用户点击年份时触发
        // 直接继续构建缓存
        setTimeout(() => {
          if (callback) callback(true)
        }, 50)
      }, 50)
      return
    }

    const range = yearRanges[rangeIdx]
    updateProgress(range.pct, '正在展开' + range.label + '年数据...')

    // 每次处理约 1/3 的数据（约 2.2~2.7万条），分多步执行避免长时间阻塞
    const CHUNK_SIZE = 5000
    let pos = range.start
    const end = range.end

    function processChunk() {
      const chunkEnd = Math.min(pos + CHUNK_SIZE, end + 1)
      for (let i = pos; i < chunkEnd; i++) {
        const r = records[i]
        const srCode = SR_RMAP[r[4]] || ''
        out[i] = [
          yearMap[r[0]] || '2024',
          provincePool[r[1]] || '',
          String(r[2] || '').padStart(4, '0'),
          schoolNamePool[r[3]] || '',
          srCode,
          groupNamePool[r[5]] || '',
          r[6], r[7], r[8],
          batchPool[r[9]] || '',
          planPool[r[10]] || '',
          gcPool[r[11]] || '',
          feePool[r[12]] || '',
          remarkPool[r[13]] || '',
          srCode ? srCode.split('*').map(s => SR_MAP[s] || s).join(' ') : '不限',
          r[14] !== undefined ? gcPool[r[14]] || '' : '',
          schoolLinkPool ? schoolLinkPool[r[3]] || '' : '',
        ]
      }
      pos = chunkEnd

      if (pos <= end) {
        // 同一范围内继续分块
        const pctInRange = range.pct + Math.floor((pos - range.start) / (end - range.start + 1) * 8)
        updateProgress(pctInRange, '正在展开' + range.label + '年数据... (' + (pos - range.start + 1) + '条)')
        setTimeout(processChunk, 16)
      } else {
        // 当前年份完成，进入下一年份
        rangeIdx++
        setTimeout(processRange, 16)
      }
    }

    processChunk()
  }

  // 从 DOM 初始化回调开始
  processRange()
}

// ============================================================
// 进度条更新
// ============================================================
function updateProgress(pct, stage) {
  const el = document.getElementById('progress-fill')
  const pctEl = document.getElementById('load-pct')
  const stageEl = document.getElementById('load-stage')
  if (el) el.style.width = pct + '%'
  if (pctEl) pctEl.textContent = pct + '%'
  if (stageEl) stageEl.textContent = stage || ''
}

// ============================================================
// 合并缓存（全部模式）
// ============================================================
function buildMergedCache() {
  if (state.mergedCache) return
  const groups = new Map()
  const data = state.allData
  for (let i = 0; i < data.length; i++) {
    const r = data[i]
    const key = r[3] + '\x00' + r[5]
    let grp = groups.get(key)
    if (!grp) {
      grp = {
        p: r[1], c: r[2], n: r[3], s: r[4], g: r[5],
        rows: new Map(),
        _diffs: null,
      }
      groups.set(key, grp)
    }
    // 按收费分组，同专业名下不同收费的记录形成独立行
    const feeKey = String(r[12])
    let row = grp.rows.get(feeKey)
    if (!row) {
      row = {
        a: null, b: null, d: null,
        batch: r[9], plan: r[10], gc: r[11], fee: r[12],
        remark: r[13], _sd: r[14],
        _vr: {},
      }
      grp.rows.set(feeKey, row)
    }
    const yr = r[0]
    if (!row._vr[yr]) row._vr[yr] = {}
    row._vr[yr].gc = r[11]
    row._vr[yr].batch = r[9]
    row._vr[yr].plan = r[10]
    row._vr[yr].fee = r[12]

    if (yr === '2024') {
      if (!row.a) row.a = { s: r[6], r: r[7], e: r[8] }
    } else if (yr === '2025') {
      if (!row.b) row.b = { s: r[6], r: r[7], e: r[8] }
    } else {
      if (!row.d) row.d = { s: r[6], r: r[7], e: r[8], code: r[15], link: r[16] || '' }
      // 2026 数据覆盖行级别字段，优先使用最新信息
      row.gc = r[11]; row.batch = r[9]
      row.plan = r[10]; row.fee = r[12]
    }
  }
  // 摊平：每行成为一个独立条目
  state.mergedCache = []
  for (const grp of groups.values()) {
    for (const row of grp.rows.values()) {
      state.mergedCache.push({
        p: grp.p, c: grp.c, n: grp.n, s: grp.s, g: grp.g,
        a: row.a, b: row.b, d: row.d,
        batch: row.batch, plan: row.plan, gc: row.gc, fee: row.fee,
        remark: row.remark, _sd: row._sd,
        _vr: row._vr,
        _diffs: null,
      })
    }
  }
}

function buildBatchList() {
  const set = new Set()
  for (let i = 0; i < state.allData.length; i++) {
    const v = state.allData[i][9]
    if (v) set.add(v)
  }
  BATCH_ALL = Array.from(set).sort()
}

// ============================================================
// 同专业组其他专业映射表（基于 2026 年数据）
// ============================================================
function buildGroupMajorMap() {
  if (state._groupMajorMapCache) return state._groupMajorMapCache
  const map = new Map()
  const yearIdx = 2 // 2026
  const raw = window.ALL_DATA_RAW
  if (!raw) return map
  const { a: provincePool, b: schoolNamePool, c: groupNamePool, d: records, e: extra } = raw
  const { b: batchPool, p: planPool, g: gcPool, f: feePool, r: remarkPool } = extra

  const yearRanges = [
    { start: 0, end: 22471 },
    { start: 22472, end: 47183 },
    { start: 47184, end: records.length - 1 },
  ]
  const { start, end } = yearRanges[yearIdx]

  for (let i = start; i <= end; i++) {
    const r = records[i]
    const school = schoolNamePool[r[3]] || ''
    const groupCode = gcPool[r[11]] || ''
    const groupName = groupNamePool[r[5]] || ''
    if (!school || !groupCode) continue
    const key = school + '\x00' + groupCode
    if (!map.has(key)) map.set(key, [])
    const list = map.get(key)
    // 去重：同一专业组下可能有同名专业
    if (!list.some(m => m.n === groupName)) {
      list.push({
        n: groupName,
        code: r[14] !== undefined ? gcPool[r[14]] || '' : '',
        planCount: r[8],
        remark: remarkPool[r[13]] || '',
      })
    }
  }
  state._groupMajorMapCache = map
  return map
}

// ============================================================
// 工具函数
// ============================================================
function parseSR(sr) {
  if (!sr) return ['不限']
  return sr.split('*').map(s => SR_MAP[s] || s)
}

// 选科兼容性匹配：学生的选科组合需包含专业要求的全部科目
function isSrCompatible(studentCode, requirementCode) {
  if (!requirementCode) return true
  if (!studentCode) return false
  const required = requirementCode.split('*')
  const student = studentCode.split('*')
  return required.every(s => student.includes(s))
}

function getProvinceLabel(arr) {
  if (!arr || !arr.length) return '全部省份'
  if (arr.length <= 2) return arr.join('、')
  return arr.slice(0, 2).join('、') + ' 等' + arr.length + '个省份'
}

function getBatchLabel(arr) {
  if (!arr || !arr.length) return '全部批次'
  if (arr.length <= 2) return arr.join('、')
  return arr.slice(0, 2).join('、') + ' 等' + arr.length + '个批次'
}

function computeDiffs(g, vr) {
  const yrs = []
  if (g.a) yrs.push('2024')
  if (g.b) yrs.push('2025')
  if (g.d) yrs.push('2026')
  if (yrs.length < 2) return null
  const diffs = []
  const fields = [
    { key: 'gc', label: '专业组代码' },
    { key: 'batch', label: '批次' },
    { key: 'plan', label: '性质' },
    { key: 'fee', label: '收费标准' },
  ]
  for (const f of fields) {
    const vals = {}
    for (const y of yrs) {
      const yr = vr[y]
      if (!yr) continue
      const v = yr[f.key]
      if (v === undefined || v === null) continue
      if (!vals[v]) vals[v] = []
      vals[v].push(y)
    }
    if (Object.keys(vals).length > 1) {
      const entries = Object.entries(vals).map(([v, ys]) => ({
        years: ys.join('、') + '年',
        value: String(v),
      }))
      diffs.push({ field: f.label, entries })
    }
  }
  return diffs.length ? diffs : null
}

// ============================================================
// 核心搜索
// ============================================================
function doSearch() {
  if (!state.loaded) return

  // 若处于志愿推荐模式，退出并执行常规搜索
  if (DOM.assistantResults.style.display !== 'none') {
    exitAssistant()
  }

  const t0 = Date.now()

  const { year, selectedProvinces, selectedBatches, code, name, srIdx, groupName, groupCode, minScore, maxRank, only2026, hideSports, hideCoop } = state
  const sr = srIdx > 0 ? SR_CODES[srIdx] : ''
  const ms = parseInt(minScore) || 0
  const mr = parseInt(maxRank) || 0

  // 输入校验：最低分和最低排名不能为负数或非数字
  const rawMinScore = String(minScore).trim()
  const rawMaxRank = String(maxRank).trim()
  const parsedMin = parseInt(rawMinScore)
  const parsedMax = parseInt(rawMaxRank)
  const minInvalid = rawMinScore !== '' && (isNaN(parsedMin) || parsedMin < 0)
  const maxInvalid = rawMaxRank !== '' && (isNaN(parsedMax) || parsedMax < 0)
  if (minInvalid || maxInvalid) {
    state.searchCache = []
    state.displayList = []
    state.page = 0
    state.totalCount = 0
    state.hasMore = false
    state.loadTime = 0
    DOM.resultCards.innerHTML = ''
    DOM.totalCount.textContent = '0'
    DOM.loadTime.textContent = ''
    DOM.loadingMore.style.display = 'none'
    DOM.emptyMsg.style.display = 'block'
    DOM.emptyMsg.textContent = '请检查输入内容'
    return
  }
  const provinceSet = selectedProvinces.length ? new Set(selectedProvinces) : null
  const codeStr = String(code).trim()
  const nameStr = String(name).trim()
  const groupStr = String(groupName).trim()
  const groupCodeStr = String(groupCode).trim()

  if (!year) {
    // 全部模式
    if (!state.mergedCache) return
    const results = []

    for (let i = 0; i < state.mergedCache.length; i++) {
      const g = state.mergedCache[i]
      if (provinceSet && !provinceSet.has(g.p)) continue
      if (codeStr && String(g.c).indexOf(codeStr) === -1) continue
      if (nameStr && g.n.indexOf(nameStr) === -1) continue
      if (sr && !isSrCompatible(sr, g.s)) continue
      if (groupStr && g.g.indexOf(groupStr) === -1) continue
      if (groupCodeStr && String(g.gc).indexOf(groupCodeStr) === -1) continue
      if (hideSports && (g.g.indexOf('体育') !== -1 || g.n.indexOf('体育') !== -1)) continue
      if (hideCoop && (g.g.indexOf('中外合作') !== -1 || (g.remark && g.remark.indexOf('中外合作') !== -1))) continue
      if (only2026 && !g.d) continue
      if (selectedBatches.length && selectedBatches.indexOf(g.batch) === -1) continue

      let needClone = false
      if (ms || mr) {
        let anyPass = false
        if (g.a) {
          const pass = (!ms || Number(g.a.s) >= ms) && (!mr || Number(g.a.r) <= mr)
          if (!pass) needClone = true; else anyPass = true
        }
        if (g.b) {
          const pass = (!ms || Number(g.b.s) >= ms) && (!mr || Number(g.b.r) <= mr)
          if (!pass) needClone = true; else anyPass = true
        }
        // 仅2026招生模式下，2026年为计划招生数据可能无有效分数排名，不纳入筛选
        if (g.d && !only2026) {
          const pass = (!ms || Number(g.d.s) >= ms) && (!mr || Number(g.d.r) <= mr)
          if (!pass) needClone = true; else anyPass = true
        }
        if (!anyPass) continue
      }

      if (needClone) {
        const c = { ...g, _vr: g._vr, remarkExpanded: false }
        if (ms) {
          if (c.a && Number(c.a.s) < ms) c.a = null
          if (c.b && Number(c.b.s) < ms) c.b = null
          // 仅2026招生模式下保留2026数据行，不因分数排名过滤而清除
          if (c.d && Number(c.d.s) < ms && !only2026) c.d = null
        }
        if (mr) {
          if (c.a && Number(c.a.r) > mr) c.a = null
          if (c.b && Number(c.b.r) > mr) c.b = null
          if (c.d && Number(c.d.r) > mr && !only2026) c.d = null
        }
        c._diffs = computeDiffs(c, c._vr)
        results.push(c)
      } else {
        results.push(g)
      }
    }

    results.sort((a, b) => {
      const getRefRank = function(item) {
        // 两年平均排名（2024+2025），仅有一年则用单年
        if (item.a && item.b) return (Number(item.a.r) + Number(item.b.r)) / 2
        if (item.a) return Number(item.a.r)
        if (item.b) return Number(item.b.r)
        if (item.d) return Number(item.d.r)
        return 0
      }
      const hasRankA = !!(a.a || a.b)
      const hasRankB = !!(b.a || b.b)
      if (hasRankA && !hasRankB) return -1
      if (!hasRankA && hasRankB) return 1
      const ra = getRefRank(a)
      const rb = getRefRank(b)
      if (!ra && !rb) return 0
      if (!ra) return 1
      if (!rb) return -1
      // 排名越低越好：无筛选时最优排名靠前，有筛选时边界排名靠前
      return (ms || mr) ? rb - ra : ra - rb
    })

    state.searchCache = results
    state.searchIsGrouped = true
    state.page = 0
    state.displayList = []
    state.totalCount = results.length
    state.hasMore = results.length > PAGE_SIZE
    state.loadTime = Date.now() - t0
    state.remarkExpanded = {}
  } else {
    // 单年份模式
    const data = year === '2024' ? state.allData2024 : year === '2025' ? state.allData2025 : state.allData2026
    const result = []
    for (let i = 0, len = data.length; i < len; i++) {
      const r = data[i]
      if (ms && r[6] < ms) continue
      if (mr && r[7] > mr) continue
      if (provinceSet && !provinceSet.has(r[1])) continue
      if (sr && !isSrCompatible(sr, r[4])) continue
      if (codeStr && r[2].indexOf(codeStr) === -1) continue
      if (nameStr && r[3].indexOf(nameStr) === -1) continue
      if (groupStr && r[5].indexOf(groupStr) === -1) continue
      if (groupCodeStr && String(r[11]).indexOf(groupCodeStr) === -1) continue
      if (only2026 && r[0] !== '2026') continue
      if (selectedBatches.length && selectedBatches.indexOf(r[9]) === -1) continue
      if (hideSports && (r[5].indexOf('体育') !== -1 || r[3].indexOf('体育') !== -1)) continue
      if (hideCoop && (r[5].indexOf('中外合作') !== -1 || r[13].indexOf('中外合作') !== -1)) continue
      result.push(r)
    }
    if (ms || mr) {
      result.sort((a, b) => b[7] - a[7])
    } else {
      result.sort((a, b) => a[7] - b[7])
    }
    state.searchCache = result
    state.searchIsGrouped = false
    state.page = 0
    state.displayList = []
    state.totalCount = result.length
    state.hasMore = result.length > PAGE_SIZE
    state.loadTime = Date.now() - t0
    state.remarkExpanded = {}
  }
  renderResults()
}

// ============================================================
// 分页加载
// ============================================================
function loadMore() {
  const start = state.page * PAGE_SIZE
  const end = Math.min(start + PAGE_SIZE, state.searchCache.length)
  const chunk = state.searchCache.slice(start, end)
  if (!chunk.length) {
    state.hasMore = false
    renderMore()
    return
  }
  if (state.searchIsGrouped) {
    for (let i = 0; i < chunk.length; i++) {
      const item = chunk[i]
      if (item._diffs === null && item._vr) {
        item._diffs = computeDiffs(item, item._vr)
      }
    }
  }
  state.displayList = state.displayList.concat(chunk)
  state.page++
  state.hasMore = end < state.searchCache.length
  renderMore()
}

// ============================================================
// 渲染：结果列表
// ============================================================
function renderResults() {
  loadMore() // 从 page 0 开始加载
  DOM.totalCount.textContent = state.totalCount
  DOM.loadTime.textContent = state.loadTime ? '(' + state.loadTime + 'ms)' : ''
  DOM.emptyMsg.textContent = '无匹配结果'

  if (state.totalCount === 0) {
    DOM.emptyMsg.style.display = 'block'
  } else {
    DOM.emptyMsg.style.display = 'none'
  }
}

function renderMore() {
  const container = DOM.resultCards
  const fragment = document.createDocumentFragment()

  for (let i = 0; i < state.displayList.length; i++) {
    const item = state.displayList[i]
    const card = state.searchIsGrouped ? renderCardGrouped(item, i) : renderCardSingle(item, i)
    fragment.appendChild(card)
  }

  container.innerHTML = ''
  container.appendChild(fragment)

  DOM.totalCount.textContent = state.totalCount
  DOM.loadingMore.style.display = state.hasMore ? 'block' : 'none'
  DOM.emptyMsg.style.display = state.totalCount === 0 ? 'block' : 'none'
}

function renderCardGrouped(item, idx, groupMajorMap) {
  const card = document.createElement('div')
  card.className = 'card'
  card.dataset.idx = idx

  // Header
  const header = document.createElement('div')
  header.className = 'card-header'
  header.innerHTML = '<span class="card-name">' + escHtml(item.n) + '</span>' +
    getSchoolTagHtml(item.n) +
    '<span class="card-code">' + escHtml(item.c) + '</span>' +
    (item.d && !item.a && !item.b ? '<span class="tag-new">新</span>' : '')
  card.appendChild(header)

  // Body
  const body = document.createElement('div')
  body.className = 'card-body'

  // Province
  body.appendChild(makeRow('省份', item.p))
  // Batch
  if (item.batch) body.appendChild(makeRow('批次', item.batch, 'badge'))
  // Subject
  body.appendChild(makeRow('选科', item._sd, 'tag'))
  // Plan type
  if (item.plan) body.appendChild(makeRow('性质', item.plan))
  // Group name
  if (item.g) body.appendChild(makeRow('专业名称', item.g, 'full'))
  // Group code
  if (item.gc) body.appendChild(makeRow('专业组代码', item.gc))

  // 2024 row
  if (item.a) {
    body.appendChild(makeYearRow('2024',
      '<span class="card-value highlight">' + item.a.s + '分</span>' +
      '<span class="card-value highlight">最低排名 ' + item.a.r + '</span>' +
      '<span class="card-value">录取' + item.a.e + '人</span>'))
  }
  // 2025 row
  if (item.b) {
    body.appendChild(makeYearRow('2025',
      '<span class="card-value highlight">' + item.b.s + '分</span>' +
      '<span class="card-value highlight">最低排名 ' + item.b.r + '</span>' +
      '<span class="card-value">录取' + item.b.e + '人</span>'))
  }
  // 2026 row（含专业代号与计划录取）
  if (item.d) {
    body.appendChild(make2026Row(
      '<span class="card-value">专业代号 ' + escHtml(item.d.code) + '</span>' +
      '<span class="card-value">计划录取' + item.d.e + '人</span>'))
    // 收费标准 + 招生简章坐一桌
    const parts2026 = []
    if (item.fee) parts2026.push('收费标准 ' + item.fee + '元/年')
    if (item.d.link) parts2026.push('<a class="card-link" href="' + escHtml(item.d.link) + '" target="_blank" rel="noopener noreferrer">招生简章 ↗</a>')
    if (parts2026.length) {
      body.appendChild(make2026SubRow(parts2026.join(' &nbsp;|&nbsp; ')))
    }
  }

  // Remark
  if (item.remark) {
    const isOpen = state.remarkExpanded[idx]
    body.appendChild(makeRemarkToggle(idx, isOpen))
    if (isOpen) {
      body.appendChild(makeRemarkBody(item.remark))
    }
  }

  // Diffs
  if (item._diffs) {
    const diffSection = renderDiffs(item._diffs)
    if (diffSection) body.appendChild(diffSection)
  }

  // 服从调剂：同专业组其他专业
  if (groupMajorMap && item.g) {
    const mapKey = item.n + '\x00' + item.gc
    const cardKey = item.n + '\x00' + item.g
    const majors = groupMajorMap.get(mapKey)
    if (majors && majors.length > 1) {
      const others = majors.filter(m => m.n !== item.g)
      if (others.length > 0) {
        const _isOpen = state.assistantAdjustExpanded[cardKey]
        body.appendChild(makeOtherMajorsHeader(cardKey, others, _isOpen))
        if (_isOpen) {
          body.appendChild(makeOtherMajorsBody(others))
        }
      }
    }
  }

  card.appendChild(body)
  return card
}

function makeOtherMajorsHeader(mapKey, others, isOpen) {
  const wrapper = document.createElement('div')
  wrapper.className = 'card-row card-remark-header'
  wrapper.dataset.adjustKey = mapKey
  wrapper.innerHTML = '<span class="card-label">同专业组其他专业</span>' +
    '<span class="card-remark-toggle">' + (isOpen ? '收起<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 15l-6-6-6 6"/></svg>' : '展开▼(' + others.length + '个)') + '</span>'
  wrapper.addEventListener('click', function (e) {
    e.stopPropagation()
    toggleAdjustExpand(this.dataset.adjustKey)
  })
  return wrapper
}

function makeOtherMajorsBody(others) {
  const list = document.createElement('div')
  list.className = 'card-row card-remark-body'
  const listInner = document.createElement('div')
  listInner.className = 'adjust-majors-list'
  for (const m of others) {
    const item = document.createElement('span')
    item.className = 'adjust-major-item'
    item.innerHTML = '· <span class="major-name">' + escHtml(m.n) + '</span>' +
      (m.code ? ' <span class="major-detail">(代号' + escHtml(m.code) + ')</span>' : '') +
      (m.planCount ? ' <span class="major-detail">计划' + m.planCount + '人</span>' : '')
    listInner.appendChild(item)
  }
  list.appendChild(listInner)
  return list
}

function toggleAdjustExpand(mapKey) {
  state.assistantAdjustExpanded[mapKey] = !state.assistantAdjustExpanded[mapKey]
  // 直接同步重绘，无需 loading 动画
  if (DOM.assistantResults.style.display !== 'none') {
    _execAssistant(parseInt(DOM.asScore.value) || 0, parseInt(DOM.asRank.value) || 0,
      asSrIdx >= 0 ? AS_SR_CODES[asSrIdx] : '', REGIONS[REGION_NAMES[asRegionIdx]],
      String(DOM.asKeyword.value).trim())
  }
}

function renderCardSingle(record, idx) {
  const card = document.createElement('div')
  card.className = 'card'
  card.dataset.idx = idx

  const header = document.createElement('div')
  header.className = 'card-header'
  header.innerHTML = '<span class="card-year">' + escHtml(record[0]) + '</span>' +
    '<span class="card-name">' + escHtml(record[3]) + '</span>' +
    getSchoolTagHtml(record[3]) +
    '<span class="card-code">' + escHtml(record[2]) + '</span>'
  card.appendChild(header)

  const body = document.createElement('div')
  body.className = 'card-body'

  body.appendChild(makeRow('省份', record[1]))
  if (record[9]) body.appendChild(makeRow('批次', record[9], 'badge'))
  body.appendChild(makeRow('选科', record[14], 'tag'))
  if (record[10]) body.appendChild(makeRow('性质', record[10]))
  if (record[5]) body.appendChild(makeRow('专业名称', record[5], 'full'))
  if (record[11]) body.appendChild(makeRow('专业组代码', record[11]))
  // 2026年记录显示专业代号
  if (record[0] === '2026' && record[15]) body.appendChild(makeRow('专业代号', record[15]))

  if (record[0] !== '2026') {
    body.appendChild(makeRow('最低分', String(record[6]), 'highlight'))
    body.appendChild(makeRow('最低排名', String(record[7]), 'highlight'))
    body.appendChild(makeRow('录取', record[8] + '人'))
  } else {
    body.appendChild(makeRow('计划录取', record[8] + '人', 'highlight'))
    // 招生简章链接
    if (record[16]) {
      body.appendChild(makeLinkRow(record[16]))
    }
  }
  if (record[12]) body.appendChild(makeRow('收费标准', record[12] + '元/年'))

  if (record[13]) {
    const isOpen = state.remarkExpanded[idx]
    body.appendChild(makeRemarkToggle(idx, isOpen))
    if (isOpen) {
      body.appendChild(makeRemarkBody(record[13]))
    }
  }

  card.appendChild(body)
  return card
}

// Helper: simple row
function makeRow(label, value, cls) {
  const row = document.createElement('div')
  row.className = 'card-row'
  row.innerHTML = '<span class="card-label">' + escHtml(label) + '</span>' +
    '<span class="card-value' + (cls ? ' ' + cls : '') + '">' + escHtml(value) + '</span>'
  return row
}

// Helper: year data row (grouped)
function makeYearRow(year, html) {
  const row = document.createElement('div')
  row.className = 'card-row'
  row.innerHTML = '<span class="gp-label">' + year + '</span>' + html
  return row
}

function make2026Row(html) {
  const row = document.createElement('div')
  row.className = 'card-row gp-year'
  row.innerHTML = '<span class="gp-label">2026</span>' + html
  return row
}

function make2026SubRow(html) {
  const row = document.createElement('div')
  row.className = 'card-row gp-year-sub'
  row.innerHTML = '<span class="gp-label"></span>' + html
  return row
}

// Helper: link row (招生简章)
function makeLinkRow(url) {
  const row = document.createElement('div')
  row.className = 'card-row card-link-row'
  row.innerHTML = '<span class="card-label">招生简章</span>' +
    '<a class="card-link" href="' + escHtml(url) + '" target="_blank" rel="noopener noreferrer">查看招生章程 ↗</a>'
  return row
}

// Helper: remark toggle
function makeRemarkToggle(idx, isOpen) {
  const row = document.createElement('div')
  row.className = 'card-row card-remark-header'
  row.dataset.remarkIdx = idx
  row.innerHTML = '<span class="card-label">备注</span>' +
    '<span class="card-remark-toggle">' + (isOpen ? '收起<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 15l-6-6-6 6"/></svg>' : '展开▼') + '</span>'
  row.addEventListener('click', function (e) {
    e.stopPropagation()
    toggleRemark(this.dataset.remarkIdx)
  })
  return row
}

function makeRemarkBody(text) {
  const row = document.createElement('div')
  row.className = 'card-row card-remark-body'
  row.innerHTML = '<span class="card-value full">' + escHtml(text) + '</span>'
  return row
}

// Diffs rendering
function renderDiffs(diffs) {
  if (!diffs || !diffs.length) return null
  const section = document.createElement('div')
  section.className = 'diff-section'
  for (const diff of diffs) {
    const group = document.createElement('div')
    group.className = 'diff-group'
    const label = diff.field === '专业组代码' ? '专业组代码变动' : diff.field + '差异'
    group.innerHTML = '<span class="diff-field">' + label + '</span>'
    for (const entry of diff.entries) {
      const e = document.createElement('div')
      e.className = 'diff-entry'
      e.innerHTML = '<span class="diff-years">' + escHtml(entry.years) + '</span>' +
        '<span class="diff-arrow">→</span>' +
        '<span class="diff-val">' + escHtml(entry.value) + '</span>'
      group.appendChild(e)
    }
    section.appendChild(group)
  }
  return section
}

// ============================================================
// 事件处理：状态变更 → 重新搜索
// ============================================================

function onYearChange(year) {
  if (year === '2026') {
    state.minScore = ''
    state.maxRank = ''
    DOM.inputMinScore.value = ''
    DOM.inputMaxRank.value = ''
  }
  state.year = year
  // 切换到具体年份时取消「仅2026招生」勾选
  if (year) {
    state.only2026 = false
  }
  updateFilterUI()
  if (year) splitByYear()
  doSearch()
}

function splitByYear() {
  if (state.allData2024.length) return
  state.allData2024 = state.allData.filter(r => r[0] === '2024')
  state.allData2025 = state.allData.filter(r => r[0] === '2025')
  state.allData2026 = state.allData.filter(r => r[0] === '2026')
}

function toggleRemark(idx) {
  state.remarkExpanded[idx] = !state.remarkExpanded[idx]
  renderMore()
}

function onToggleOnly2026() {
  state.only2026 = !state.only2026
  updateFilterUI()
  doSearch()
}

function onToggleHideSports() {
  state.hideSports = !state.hideSports
  updateFilterUI()
  doSearch()
}

function onToggleHideCoop() {
  state.hideCoop = !state.hideCoop
  updateFilterUI()
  doSearch()
}

function onAssistantToggleHideCoop() {
  state.assistantHideCoop = !state.assistantHideCoop
  updateToggleUI('as-toggle-hide-coop', state.assistantHideCoop)
  if (DOM.assistantResults.style.display !== 'none') {
    startAssistant()
  }
}

function onAssistantToggleOnly985211() {
  state.assistantOnly985211 = !state.assistantOnly985211
  updateToggleUI('as-toggle-only-985211', state.assistantOnly985211)
  if (DOM.assistantResults.style.display !== 'none') {
    startAssistant()
  }
}

function onToggleAdjust() {
  state.assistantAdjust = !state.assistantAdjust
  state.assistantAdjustExpanded = {}
  updateFilterUI()
  // 如果当前在志愿推荐模式，刷新结果
  if (DOM.assistantResults.style.display !== 'none') {
    startAssistant()
  }
}

function openAlgoPicker() {
  renderAlgoList()
  DOM.algoModal.style.display = 'flex'
}

function closeAlgoPicker() {
  DOM.algoModal.style.display = 'none'
}

function confirmAlgoPicker() {
  DOM.algoModal.style.display = 'none'
  const idx = state.assistantAlgoIdx
  DOM.algoLabel.textContent = ALGO_LIST[idx].label
  // 刷新推荐结果
  if (DOM.assistantResults.style.display !== 'none') {
    startAssistant()
  }
}

function renderAlgoList() {
  const list = DOM.algoList
  list.innerHTML = ''
  for (let i = 0; i < ALGO_LIST.length; i++) {
    const item = document.createElement('div')
    item.className = 'scroll-select-item' + (state.assistantAlgoIdx === i ? ' selected' : '')
    item.dataset.idx = i
    item.innerHTML = '<strong>' + ALGO_LIST[i].label + '</strong>' +
      '<span class="algo-desc">' + ALGO_LIST[i].desc + '</span>'
    item.addEventListener('click', function () {
      state.assistantAlgoIdx = parseInt(this.dataset.idx)
      renderAlgoList()
    })
    list.appendChild(item)
  }
}

function onToggleDarkMode() {
  state.darkMode = !state.darkMode
  document.documentElement.classList.toggle('dark-mode', state.darkMode)
  try { localStorage.setItem('dark_mode', String(state.darkMode)) } catch (e) {}
}

function doReset() {
  state.year = ''
  state.selectedProvinces = []
  state.provinceLabel = '全部省份'
  state.selectedBatches = []
  state.batchLabel = '全部批次'
  state.code = ''
  state.name = ''
  state.srIdx = 0
  state.groupName = ''
  state.groupCode = ''
  state.minScore = ''
  state.maxRank = ''
  state.only2026 = false
  state.hideSports = false
  state.hideCoop = false
  syncInputsFromState()
  updateFilterUI()
  doSearch()
}

function scrollToTop() {
  if (_mobileAssistantActive) {
    // 志愿推荐模式 → 滚动活跃列到顶部
    const activeBody = DOM.asColumns.querySelector('.as-column.active .as-column-body')
    if (activeBody) {
      activeBody.scrollTop = 0
    } else {
      DOM.asColumns.scrollTop = 0
    }
  } else {
    // 正常搜索模式：展开筛选栏
    state.filterHidden = false
    DOM.filterBar.classList.remove('hidden')
    DOM.toggleFilter.textContent = '收起筛选'
    updateFilterUI()
    // 滚动到页面顶部（兼容不同滚动容器）
    DOM.resultList.scrollTop = 0
    window.scrollTo(0, 0)
    DOM.floatBtn.style.display = 'none'
  }
}

// ============================================================
// 省市多选弹窗
// ============================================================
function openProvincePicker() {
  state.tempSelectedProvinces = [...state.selectedProvinces]
  state.tempChecked = PROVINCES_ALL.map(p => state.selectedProvinces.indexOf(p) !== -1)
  renderProvincePicker()
  DOM.provinceModal.style.display = 'flex'
}

function closeProvincePicker() {
  DOM.provinceModal.style.display = 'none'
}

function toggleProvince(idx) {
  const item = PROVINCES_ALL[idx]
  if (state.tempChecked[idx]) {
    const i = state.tempSelectedProvinces.indexOf(item)
    if (i !== -1) state.tempSelectedProvinces.splice(i, 1)
  } else {
    state.tempSelectedProvinces.push(item)
  }
  state.tempChecked[idx] = !state.tempChecked[idx]
  renderProvincePicker()
}

function selectAllProvinces() {
  state.tempSelectedProvinces = [...PROVINCES_ALL]
  state.tempChecked = PROVINCES_ALL.map(() => true)
  renderProvincePicker()
}

function clearProvinces() {
  state.tempSelectedProvinces = []
  state.tempChecked = PROVINCES_ALL.map(() => false)
  renderProvincePicker()
}

function confirmProvincePicker() {
  state.selectedProvinces = [...state.tempSelectedProvinces]
  state.provinceLabel = getProvinceLabel(state.selectedProvinces)
  DOM.provinceModal.style.display = 'none'
  DOM.provinceLabel.textContent = state.provinceLabel
  DOM.provinceLabel.className = state.selectedProvinces.length ? '' : 'placeholder-text'
  doSearch()
}

function renderProvincePicker() {
  const list = DOM.provinceList
  list.innerHTML = ''
  for (let i = 0; i < PROVINCES_ALL.length; i++) {
    const item = document.createElement('div')
    item.className = 'modal-item'
    item.dataset.idx = i
    item.innerHTML = '<div class="check-box' + (state.tempChecked[i] ? ' checked' : '') + '">' +
      (state.tempChecked[i] ? '<span class="check-mark">✓</span>' : '') +
      '</div><span class="modal-item-text">' + PROVINCES_ALL[i] + '</span>'
    item.addEventListener('click', function () {
      toggleProvince(parseInt(this.dataset.idx))
    })
    list.appendChild(item)
  }
}

// ============================================================
// 批次多选弹窗
// ============================================================
function openBatchPicker(ctx) {
  _batchCtx = ctx || 'search'
  const src = _batchCtx === 'assistant' ? state.asSelectedBatches : state.selectedBatches
  state.tempSelectedBatches = [...src]
  state.tempBatchChecked = BATCH_ALL.map(b => src.indexOf(b) !== -1)
  renderBatchPicker()
  DOM.batchModal.style.display = 'flex'
}

function closeBatchPicker() {
  DOM.batchModal.style.display = 'none'
}

function toggleBatch(idx) {
  const item = BATCH_ALL[idx]
  if (state.tempBatchChecked[idx]) {
    const i = state.tempSelectedBatches.indexOf(item)
    if (i !== -1) state.tempSelectedBatches.splice(i, 1)
  } else {
    state.tempSelectedBatches.push(item)
  }
  state.tempBatchChecked[idx] = !state.tempBatchChecked[idx]
  renderBatchPicker()
}

function selectAllBatches() {
  state.tempSelectedBatches = [...BATCH_ALL]
  state.tempBatchChecked = BATCH_ALL.map(() => true)
  renderBatchPicker()
}

function clearBatches() {
  state.tempSelectedBatches = []
  state.tempBatchChecked = BATCH_ALL.map(() => false)
  renderBatchPicker()
}

function confirmBatchPicker() {
  const target = _batchCtx === 'assistant' ? state.asSelectedBatches : state.selectedBatches
  const labelKey = _batchCtx === 'assistant' ? 'asBatchLabel' : 'batchLabel'
  const labelEl = _batchCtx === 'assistant' ? DOM.asBatchLabel : DOM.batchLabel

  target.length = 0
  target.push(...state.tempSelectedBatches)
  state[labelKey] = getBatchLabel(target)
  DOM.batchModal.style.display = 'none'
  labelEl.textContent = state[labelKey]
  labelEl.className = target.length ? '' : 'placeholder-text'

  if (_batchCtx === 'assistant') {
    if (DOM.assistantResults.style.display !== 'none') {
      startAssistant()
    }
  } else {
    doSearch()
  }
}

function renderBatchPicker() {
  const list = DOM.batchList
  list.innerHTML = ''
  for (let i = 0; i < BATCH_ALL.length; i++) {
    const item = document.createElement('div')
    item.className = 'modal-item'
    item.dataset.idx = i
    item.innerHTML = '<div class="check-box' + (state.tempBatchChecked[i] ? ' checked' : '') + '">' +
      (state.tempBatchChecked[i] ? '<span class="check-mark">✓</span>' : '') +
      '</div><span class="modal-item-text">' + BATCH_ALL[i] + '</span>'
    item.addEventListener('click', function () {
      toggleBatch(parseInt(this.dataset.idx))
    })
    list.appendChild(item)
  }
}

// ============================================================
// 选科选择弹窗
// ============================================================
function openSRPicker() {
  renderSRList()
  DOM.srModal.style.display = 'flex'
}

function closeSRPicker() {
  DOM.srModal.style.display = 'none'
}

function confirmSR() {
  DOM.srModal.style.display = 'none'
  DOM.srLabel.textContent = SR_LIST[state.srIdx]
  DOM.srLabel.className = state.srIdx === 0 ? 'placeholder-text' : ''
  doSearch()
}

function renderSRList() {
  const list = DOM.srList
  list.innerHTML = ''
  for (let i = 0; i < SR_LIST.length; i++) {
    const item = document.createElement('div')
    item.className = 'scroll-select-item' + (state.srIdx === i ? ' selected' : '')
    item.textContent = SR_LIST[i]
    item.dataset.idx = i
    item.addEventListener('click', function () {
      state.srIdx = parseInt(this.dataset.idx)
      renderSRList()
    })
    list.appendChild(item)
  }
}

// ============================================================
// UI 状态同步
// ============================================================
function updateFilterUI() {
  // Year tabs
  const tabs = DOM.yearTabs.querySelectorAll('.tab')
  tabs.forEach(t => t.classList.toggle('active', t.dataset.year === state.year))

  // Province label
  DOM.provinceLabel.textContent = state.provinceLabel
  DOM.provinceLabel.className = state.selectedProvinces.length ? '' : 'placeholder-text'

  // SR label
  DOM.srLabel.textContent = SR_LIST[state.srIdx]
  DOM.srLabel.className = state.srIdx === 0 ? 'placeholder-text' : ''

  // Batch label
  DOM.batchLabel.textContent = state.batchLabel
  DOM.batchLabel.className = state.selectedBatches.length ? '' : 'placeholder-text'
  if (DOM.asBatchLabel) {
    DOM.asBatchLabel.textContent = state.asBatchLabel
    DOM.asBatchLabel.className = state.asSelectedBatches.length ? '' : 'placeholder-text'
  }

  // Toggle switches
  updateToggleUI('toggle-only2026', state.only2026)
  updateToggleUI('toggle-hide-sports', state.hideSports)
  updateToggleUI('toggle-hide-coop', state.hideCoop)
  updateToggleUI('toggle-adjust', state.assistantAdjust)

  // Score/rank row visibility: 仅在选择2026单年份时隐藏
  // 在「全部」模式中即使勾选「仅2026招生」也保持可见，因为分组数据仍有2024/2025的分数排名
  DOM.scoreRow.style.display = state.year === '2026' ? 'none' : 'flex'
  // 「仅2026招生」仅在「全部」模式下显示，选中具体年份时隐藏
  const toggleOnly2026 = document.getElementById('toggle-only2026')
  if (toggleOnly2026) {
    toggleOnly2026.style.display = state.year ? 'none' : ''
  }
}

function updateToggleUI(id, isOn) {
  const el = document.getElementById(id)
  if (!el) return
  el.classList.toggle('on', isOn)
  el.querySelector('.toggle-box').classList.toggle('checked', isOn)
}

function syncInputsFromState() {
  DOM.inputCode.value = state.code
  DOM.inputName.value = state.name
  DOM.inputGroupName.value = state.groupName
  DOM.inputGroupCode.value = state.groupCode
  DOM.inputMinScore.value = state.minScore
  DOM.inputMaxRank.value = state.maxRank
}

function syncStateFromInputs() {
  state.code = DOM.inputCode.value
  state.name = DOM.inputName.value
  state.groupName = DOM.inputGroupName.value
  state.groupCode = DOM.inputGroupCode.value
  state.minScore = DOM.inputMinScore.value
  state.maxRank = DOM.inputMaxRank.value
}

function escHtml(str) {
  if (str === null || str === undefined) return ''
  const d = document.createElement('div')
  d.textContent = String(str)
  return d.innerHTML
}

// ============================================================
// 985/211 标签查找
// ============================================================
function getSchoolTag(name) {
  if (!window.SCHOOL_TAGS) return ''
  if (!getSchoolTag._map) {
    const map = new Map()
    const data = window.SCHOOL_TAGS
    const norm = s => s.replace(/（/g, '(').replace(/）/g, ')')
    const is985 = new Set(data['985'] ? data['985'].map(norm) : [])
    const is211 = new Set(data['211'] ? data['211'].map(norm) : [])
    const allNames = new Set([...is985, ...is211])
    for (const n of allNames) {
      const c = []
      if (is985.has(n)) c.push('985')
      if (is211.has(n)) c.push('211')
      map.set(n, c.join('&'))
    }
    getSchoolTag._map = map
  }
  const normalized = name.replace(/（/g, '(').replace(/）/g, ')')
  return getSchoolTag._map.get(normalized) || ''
}

function getSchoolTagHtml(name) {
  const tag = getSchoolTag(name)
  if (!tag) return ''
  const parts = tag.split('&')
  let html = parts.map(t => '<span class="school-tag tag-' + t + '">' + t + '</span>').join('')
  const rank = getSchoolRanking(name)
  if (rank && parts.includes('211')) {
    html += '<span class="school-rank">软科#' + rank + '</span>'
  }
  return html
}

function getSchoolRanking(name) {
  if (!window.SCHOOL_RANKINGS) return null
  if (!getSchoolRanking._map) {
    const map = new Map()
    const data = window.SCHOOL_RANKINGS
    const norm = s => s.replace(/（/g, '(').replace(/）/g, ')')
    if (data.rankings_985) {
      for (const r of data.rankings_985) map.set(norm(r.name), r.rank)
    }
    if (data.rankings_211_only) {
      for (const r of data.rankings_211_only) map.set(norm(r.name), r.rank)
    }
    getSchoolRanking._map = map
  }
  const normalized = name.replace(/（/g, '(').replace(/）/g, ')')
  return getSchoolRanking._map.get(normalized) || null
}

// ============================================================
// 引导教程
// ============================================================
const TUTORIAL = {
  merged: {
    steps: [
      { title: '院校名称与代号', desc: '院校的全称及其在江西省高考招生的唯一代号。在「全部」模式中显示的院校代号为2026年的编号，其他年份若不同可在下方差异对比中查看。' },
      { title: '「新」标签', desc: '标注有红色「新」字的专业组为2026年新增招生专业，暂无2024、2025年实际录取数据可供参考。选择此类专业时需结合其他信息综合评估录取难度。' },
      { title: '省市', desc: '院校所在的省份/直辖市，反映学校的地理位置和城市资源。' },
      { title: '批次', desc: '录取批次类型，如「本科」指普通本科批次、「提前本科」指提前批。不同批次录取时间、政策不同，需根据成绩定位选择合适的批次。' },
      { title: '选科要求', desc: '该专业对高考选考科目的要求，只有选科符合的考生才能报考。「不限选科」即所有考生均可报考。本示范要求「物理+化学」。' },
      { title: '性质', desc: '招生计划的性质。「非定向」为普通招生；「定向」面向特定地区/单位就业。' },
      { title: '专业名称', desc: '该专业组包含的具体招生专业。每个专业组可能包含一个或多个相关专业。' },
      { title: '专业组代码', desc: '院校将招生专业按选科要求等条件划分为不同专业组。同一院校不同专业组的录取分数可能差异很大。' },
      { title: '2024年录取数据', desc: '2024年该专业录取的最低高考分数（600分）、最低全省排名（10000名）和实际录取人数（35人）。分数和排名越高录取难度越大，建议优先参考排名。' },
      { title: '2025年录取数据', desc: '2025年录取数据（580分，15000名，38人）。可与2024年对比观察分数和排名的涨跌趋势。' },
      { title: '2026年计划数据与收费标准', desc: '2026年该专业的计划招生名额（40人）和专业代号。下方同时显示该专业 2026 年的收费标准（5800 元/年）。实际录取人数可能会有微调。2026年为志愿填报参考数据，非最终录取结果。' },
      { title: '备注', desc: '该专业的特殊说明，包括外语要求、性别限制、身体条件、政治面貌要求等。点击可展开查看完整内容。' },
      { title: '年份差异对比', desc: '当同一院校+专业在不同年份间存在差异时，卡片底部会展示对比信息。例如专业组代码变动、收费标准调整等。' },
    ],
    demo: {
      n: '赣江大学（仅供示范）', c: '8888', p: '江西',
      batch: '本科', plan: '非定向',
      s: '物理+化学', g: '人工智能', gc: '501',
      _sd: '物理 化学',
      a: { s: 600, r: 10000, e: 35 },
      b: { s: 580, r: 15000, e: 38 },
      d: { e: 40, code: 'A01' },
      fee: '5800',
      remark: '本数据仅供示范用途，并非真实录取信息。',
      _newLabel: true,
      _diffs: [
        {
          field: '专业组代码',
          entries: [
            { years: '2024年、2025年', value: 'G01' },
            { years: '2026年', value: 'A01' },
          ],
        },
        {
          field: '收费标准',
          entries: [
            { years: '2024年、2025年', value: '5250' },
            { years: '2026年', value: '5800' },
          ],
        },
      ],
    },
  },
  single2025: {
    steps: [
      { title: '院校名称与代号', desc: '院校的全称及其在江西省高考招生的唯一代号。' },
      { title: '省市', desc: '院校所在的省份/直辖市。可配合省份筛选快速定位特定地区的院校。' },
      { title: '批次', desc: '录取批次类型。不同批次录取时间、政策不同，需根据成绩定位选择。' },
      { title: '选科要求', desc: '该专业对高考选考科目的要求。本示范中为「物理」，即选考物理的考生方可报考。' },
      { title: '性质', desc: '招生计划的性质。非定向为普通招生，定向面向特定地区就业。' },
      { title: '专业名称', desc: '该专业组包含的专业名称。本示范为南昌大学「经济学」专业。' },
      { title: '专业组代码', desc: '该专业的组代码，用于标识不同的专业组。' },
      { title: '最低分', desc: '该专业录取的最低高考分数（574分），是评估录取难度最直接的指标。' },
      { title: '最低排名', desc: '该专业录取的最低全省排名（19639名）。相比分数，排名能更准确地反映录取难度。' },
      { title: '录取人数', desc: '该专业实际录取的学生人数（17人），反映招生规模。' },
      { title: '收费标准', desc: '每学年的学费标准（4950元/年）。不同学校和专业的学费差异较大。' },
      { title: '备注', desc: '该专业的特殊说明，可点击展开查看完整内容。' },
    ],
    demo: {
      year: '2025', p: '江西', c: '8101', n: '南昌大学',
      sr: '物理', g: '经济学', gc: '020101', batch: '本科',
      plan: '非定向',
      score: 574, rank: 19639, enrolled: 17, fee: '4950',
      remark: '不招单色不能识别的考生。',
    },
  },
  single2026: {
    steps: [
      { title: '院校名称与代号', desc: '院校的全称及其在江西省高考招生的唯一代号。2026年为志愿填报参考数据。' },
      { title: '省市', desc: '院校所在的省份/直辖市。' },
      { title: '批次', desc: '录取批次类型。2026年招生计划延续了之前的批次划分。' },
      { title: '选科要求', desc: '该专业对高考选考科目的要求。本示范为「物理+生物」，需同时选考这两科方可报考。显示为「物理 生物」。' },
      { title: '性质', desc: '招生计划的性质。2026年计划数据中的性质分类与往年一致。' },
      { title: '专业名称', desc: '该专业组包含的专业名称。本示范为南昌大学「法学」专业。' },
      { title: '专业组代码', desc: '该专业的组代码。2026年法学专业组代码为502。' },
      { title: '专业代号', desc: '2026年新增的专业唯一代号（如A0、A1），用于精确标识该专业。' },
      { title: '计划录取', desc: '2026年该专业的计划招生名额（7人）。实际录取人数可能会有微调。' },
      { title: '收费标准', desc: '每学年的学费标准（4950元/年）。不同专业学费可能不同。' },
      { title: '备注', desc: '该专业的特殊说明，可点击展开查看完整内容。' },
    ],
    demo: {
      year: '2026', p: '江西', c: '8101', n: '南昌大学',
      sr: '物理 生物', g: '法学', gc: '502', batch: '本科',
      plan: '非定向',
      planCount: 7, fee: '4950', majorCode: 'A0',
      remark: '不招单色不能识别的考生。',
    },
  },
  assistant: {
    steps: [
      { title: '高考分数', desc: '输入你的高考总分。系统根据分数自动匹配合适的院校范围。此处示范填写 620 分，代表总分 620 分的考生。' },
      { title: '全省排名', desc: '你的高考全省排名。比分数更能精准反映录取位置。如果你只填了分数未填排名，点击「志愿推荐」后系统会自动从 2026 年一分一段表换算对应排名。' },
      { title: '选科要求', desc: '选择你的高考选科组合（如「物化生」）。系统会在推荐时优先匹配选科符合的专业组，同时也会宽松匹配选科相符但不完全一致的专业组，扩大选择范围。' },
      { title: '地区偏好', desc: '按院校所在地筛选，支持按省份或按区域（如「长三角」「珠三角」「本省」）选择。不选则推荐全国所有院校。' },
      { title: '专业意向', desc: '输入你感兴趣的专业关键词（如「计算机 医学」），用空格分隔多个关键词。系统会搜索专业名称中包含这些关键词的专业组进行推荐。' },
      { title: '批次选择', desc: '限定推荐结果在某个录取批次范围内。不选则包含所有批次，建议根据你的成绩批次定位缩小范围。' },
      { title: '推荐算法', desc: '选择排名参考策略。「默认」优先使用 2026 预估排名，若无则参考历史平均排名，适合希望了解所有可选机会的考生。「按最低/平均/最高」仅使用 2024–2025 历史数据进行激进/中性/保守判断，不会推荐无历史数据的新增专业。「仅2024/仅2025」完全参照单年数据。' },
      { title: '服从调剂', desc: '开启后，每个被推荐的专业组下方会展开同组内的其他专业，方便你了解该专业组还有哪些专业可选，在一组内找平衡。' },
      { title: '筛选开关', desc: '「隐藏中外合作」过滤掉学费较高的中外合作办学项目；「仅推选985/211」将推荐范围限制在 985/211 重点院校。两个开关可同时开启。' },
      { title: '冲稳保结果', desc: '推荐结果按「冲」「稳」「保」三栏排列。冲—录取排名高于你的排名的院校（需争取）；稳—录取排名与你相当的院校（较稳妥）；保—录取排名低于你的排名的院校（保底选择）。点击卡片可查看详情，上下滑动浏览所有推荐。' },
    ],
    demo: {
      score: '620',
      rank: '8000',
      sr: '物化生',
      region: '全部省份',
      keyword: '计算机 医学',
      batch: '全部批次',
      algo: '默认（可推荐新专业）',
    },
  },
}

const MODE_CYCLE = ['merged', 'single2025', 'single2026', 'assistant']

function openTutorial(fromHelp) {
  state.tutorialMode = 'merged'
  state.tutorialStep = 0
  state.tutorialSteps = TUTORIAL.merged.steps
  state.tutorialDemo = TUTORIAL.merged.demo
  state.tutorialRemarkExpanded = false
  DOM.tutorialSkip.style.display = fromHelp ? 'none' : ''
  DOM.tutorialOverlay.style.display = 'flex'
  renderTutorial()
}

function closeTutorial() {
  DOM.tutorialOverlay.style.display = 'none'
}

function switchTutorialMode(mode) {
  state.tutorialMode = mode
  state.tutorialStep = 0
  state.tutorialSteps = TUTORIAL[mode].steps
  state.tutorialDemo = TUTORIAL[mode].demo
  state.tutorialRemarkExpanded = false
  renderTutorial()
  // Update tabs
  DOM.tutorialTabs.querySelectorAll('.mode-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.mode === mode)
  })
}

function tutorialNext() {
  const nextIdx = state.tutorialStep + 1
  if (nextIdx < state.tutorialSteps.length) {
    const isRemarkStep = state.tutorialSteps[nextIdx].title.indexOf('备注') !== -1
    state.tutorialStep = nextIdx
    state.tutorialRemarkExpanded = isRemarkStep
    renderTutorial()
  } else {
    if (state.tutorialMode === 'single2026' || state.tutorialMode === 'assistant') {
      finishTutorial()
    } else {
      const curIdx = MODE_CYCLE.indexOf(state.tutorialMode)
      switchTutorialMode(MODE_CYCLE[curIdx + 1])
    }
  }
}

function tutorialPrev() {
  // 全部对比第一步，按钮显示为"跳过"，点击直接退出引导
  if (state.tutorialMode === 'merged' && state.tutorialStep === 0) {
    finishTutorialAndStart()
    return
  }
  if (state.tutorialStep > 0) {
    const prevIdx = state.tutorialStep - 1
    const isRemarkStep = state.tutorialSteps[prevIdx].title.indexOf('备注') !== -1
    state.tutorialStep = prevIdx
    state.tutorialRemarkExpanded = isRemarkStep
    renderTutorial()
  }
}

function toggleDemoRemark() {
  state.tutorialRemarkExpanded = !state.tutorialRemarkExpanded
  const card = DOM.tutorialCard.querySelector('.demo-card')
  if (card) {
    const remarkBody = card.querySelector('.card-remark-body')
    const toggleEl = card.querySelector('.card-remark-toggle')
    if (remarkBody) {
      remarkBody.style.display = state.tutorialRemarkExpanded ? '' : 'none'
    }
    if (toggleEl) {
      toggleEl.innerHTML = state.tutorialRemarkExpanded ? '收起<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 15l-6-6-6 6"/></svg>' : '展开▼'
    }
  }
}

function finishTutorial() {
  try { localStorage.setItem('tutorial_done', '1') } catch (e) {}
  closeTutorial()
}

function finishTutorialAndStart() {
  try { localStorage.setItem('tutorial_done', '1') } catch (e) {}
  closeTutorial()
}

function renderTutorial() {
  const demo = state.tutorialDemo
  const steps = state.tutorialSteps
  const stepIdx = state.tutorialStep

  // Card rendering
  DOM.tutorialCard.innerHTML = renderTutorialCard(demo, state.tutorialMode, stepIdx)

  // Step progress
  DOM.stepCount.textContent = '第 ' + (stepIdx + 1) + '/' + steps.length + ' 步'
  DOM.stepBarFill.style.width = ((stepIdx + 1) / steps.length * 100) + '%'

  // Step content
  DOM.stepTitle.textContent = steps[stepIdx].title
  DOM.stepDesc.textContent = steps[stepIdx].desc

  // Nav buttons
  if (state.tutorialMode === 'merged' && stepIdx === 0) {
    DOM.btnPrev.textContent = '跳过'
    DOM.btnPrev.classList.remove('disabled')
  } else {
    DOM.btnPrev.textContent = '← 上一步'
    DOM.btnPrev.classList.toggle('disabled', stepIdx === 0)
  }
  const isLast = stepIdx === steps.length - 1
  if (isLast) {
    if (state.tutorialMode === 'single2026' || state.tutorialMode === 'assistant') {
      DOM.btnNext.textContent = '完成'
    } else {
      DOM.btnNext.textContent = '下一模式 →'
    }
  } else {
    DOM.btnNext.textContent = '下一步 →'
  }

  // Scroll to highlighted row
  setTimeout(() => {
    const hlEl = DOM.tutorialCard.querySelector('.row-current')
    if (hlEl) {
      hlEl.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
  }, 100)
}

function renderTutorialCard(demo, mode, stepIdx) {
  if (mode === 'merged') {
    return renderTutorialMerged(demo, stepIdx)
  } else if (mode === 'single2025') {
    return renderTutorialSingle2025(demo, stepIdx)
  } else if (mode === 'assistant') {
    return renderTutorialAssistant(demo, stepIdx)
  } else {
    return renderTutorialSingle2026(demo, stepIdx)
  }
}

function renderTutorialMerged(d, stepIdx) {
  return '<div class="demo-card">' +
    '<div class="card-header' + (stepIdx === 0 || stepIdx === 1 ? ' row-current' : '') + '" id="hl-0">' +
      '<span class="card-name">' + escHtml(d.n) + '</span>' +
      getSchoolTagHtml(d.n) +
      '<span class="card-code">' + escHtml(d.c) + '</span>' +
      (d._newLabel ? '<span class="tag-new">新</span>' : '') +
    '</div>' +
    '<div class="card-body">' +
      '<div class="card-row' + (stepIdx === 2 ? ' row-current' : '') + '" id="hl-2"><span class="card-label">省份</span><span class="card-value">' + escHtml(d.p) + '</span></div>' +
      '<div class="card-row' + (stepIdx === 3 ? ' row-current' : '') + '" id="hl-3"><span class="card-label">批次</span><span class="card-value badge">' + escHtml(d.batch) + '</span></div>' +
      '<div class="card-row' + (stepIdx === 4 ? ' row-current' : '') + '" id="hl-4"><span class="card-label">选科</span><span class="card-value tag">' + escHtml(d._sd) + '</span></div>' +
      '<div class="card-row' + (stepIdx === 5 ? ' row-current' : '') + '" id="hl-5"><span class="card-label">性质</span><span class="card-value">' + escHtml(d.plan) + '</span></div>' +
      '<div class="card-row' + (stepIdx === 6 ? ' row-current' : '') + '" id="hl-6"><span class="card-label">专业名称</span><span class="card-value full">' + escHtml(d.g) + '</span></div>' +
      '<div class="card-row' + (stepIdx === 7 ? ' row-current' : '') + '" id="hl-7"><span class="card-label">专业组代码</span><span class="card-value">' + escHtml(d.gc) + '</span></div>' +
      (d.a ? '<div class="card-row row-highlight' + (stepIdx === 8 ? ' row-current' : '') + '" id="hl-8"><span class="gp-label">2024</span><span class="card-value highlight">' + d.a.s + '分</span><span class="card-value highlight">最低排名 ' + d.a.r + '</span><span class="card-value">录取' + d.a.e + '人</span></div>' : '') +
      (d.b ? '<div class="card-row row-highlight' + (stepIdx === 9 ? ' row-current' : '') + '" id="hl-9"><span class="gp-label">2025</span><span class="card-value highlight">' + d.b.s + '分</span><span class="card-value highlight">最低排名 ' + d.b.r + '</span><span class="card-value">录取' + d.b.e + '人</span></div>' : '') +
      (d.d ? '<div class="card-row gp-year' + (stepIdx === 10 ? ' row-current' : '') + '" id="hl-10"><span class="gp-label">2026</span><span class="card-value">专业代号 ' + escHtml(d.d.code) + '</span><span class="card-value">计划录取' + d.d.e + '人</span></div>' : '') +
      (d.d && d.fee ? '<div class="card-row gp-year-sub' + (stepIdx === 10 ? ' row-current' : '') + '"><span class="gp-label"></span>收费标准 ' + d.fee + '元/年</div>' : '') +
      (d.remark ? '<div class="card-row card-remark-header ' + (stepIdx === 11 ? ' row-current' : '') + '" id="hl-11" onclick="toggleDemoRemark()"><span class="card-label">备注</span><span class="card-remark-toggle">' + (state.tutorialRemarkExpanded ? '收起<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 15l-6-6-6 6"/></svg>' : '展开▼') + '</span></div>' : '') +
      (state.tutorialRemarkExpanded && d.remark ? '<div class="card-row card-remark-body' + (stepIdx === 11 ? ' row-current' : '') + '"><span class="card-value full">' + escHtml(d.remark) + '</span></div>' : '') +
      (d._diffs ? '<div class="diff-section' + (stepIdx === 12 ? ' row-current' : '') + '" id="hl-12">' + renderTutorialDiffs(d._diffs) + '</div>' : '') +
    '</div></div>'
}

function renderTutorialSingle2025(d, stepIdx) {
  return '<div class="demo-card">' +
    '<div class="card-header' + (stepIdx === 0 ? ' row-current' : '') + '" id="hl-0">' +
      '<span class="card-year">' + escHtml(d.year) + '</span>' +
      '<span class="card-name">' + escHtml(d.n) + '</span>' +
      getSchoolTagHtml(d.n) +
      '<span class="card-code">' + escHtml(d.c) + '</span>' +
    '</div>' +
    '<div class="card-body">' +
      '<div class="card-row' + (stepIdx === 1 ? ' row-current' : '') + '" id="hl-1"><span class="card-label">省份</span><span class="card-value">' + escHtml(d.p) + '</span></div>' +
      '<div class="card-row' + (stepIdx === 2 ? ' row-current' : '') + '" id="hl-2"><span class="card-label">批次</span><span class="card-value badge">' + escHtml(d.batch) + '</span></div>' +
      '<div class="card-row' + (stepIdx === 3 ? ' row-current' : '') + '" id="hl-3"><span class="card-label">选科</span><span class="card-value tag">' + escHtml(d.sr) + '</span></div>' +
      '<div class="card-row' + (stepIdx === 4 ? ' row-current' : '') + '" id="hl-4"><span class="card-label">性质</span><span class="card-value">' + escHtml(d.plan) + '</span></div>' +
      '<div class="card-row' + (stepIdx === 5 ? ' row-current' : '') + '" id="hl-5"><span class="card-label">专业名称</span><span class="card-value full">' + escHtml(d.g) + '</span></div>' +
      '<div class="card-row' + (stepIdx === 6 ? ' row-current' : '') + '" id="hl-6"><span class="card-label">专业组代码</span><span class="card-value">' + escHtml(d.gc) + '</span></div>' +
      '<div class="card-row row-highlight' + ((stepIdx === 7 || stepIdx === 8) ? ' row-current' : '') + '" id="hl-7"><span class="card-label">最低分</span><span class="card-value highlight">' + d.score + '</span><span class="card-label">最低排名</span><span class="card-value highlight">' + d.rank + '</span></div>' +
      '<div class="card-row' + (stepIdx === 9 ? ' row-current' : '') + '" id="hl-9"><span class="card-label">录取</span><span class="card-value">' + d.enrolled + '人</span></div>' +
      '<div class="card-row' + (stepIdx === 10 ? ' row-current' : '') + '" id="hl-10"><span class="card-label">收费标准</span><span class="card-value">' + d.fee + '元/年</span></div>' +
      (d.remark ? '<div class="card-row card-remark-header ' + (stepIdx === 11 ? ' row-current' : '') + '" id="hl-11" onclick="toggleDemoRemark()"><span class="card-label">备注</span><span class="card-remark-toggle">' + (state.tutorialRemarkExpanded ? '收起<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 15l-6-6-6 6"/></svg>' : '展开▼') + '</span></div>' : '') +
      (state.tutorialRemarkExpanded && d.remark ? '<div class="card-row card-remark-body' + (stepIdx === 11 ? ' row-current' : '') + '"><span class="card-value full">' + escHtml(d.remark) + '</span></div>' : '') +
    '</div></div>'
}

function renderTutorialSingle2026(d, stepIdx) {
  return '<div class="demo-card">' +
    '<div class="card-header' + (stepIdx === 0 ? ' row-current' : '') + '" id="hl-0">' +
      '<span class="card-year">' + escHtml(d.year) + '</span>' +
      '<span class="card-name">' + escHtml(d.n) + '</span>' +
      getSchoolTagHtml(d.n) +
      '<span class="card-code">' + escHtml(d.c) + '</span>' +
    '</div>' +
    '<div class="card-body">' +
      '<div class="card-row' + (stepIdx === 1 ? ' row-current' : '') + '" id="hl-1"><span class="card-label">省份</span><span class="card-value">' + escHtml(d.p) + '</span></div>' +
      '<div class="card-row' + (stepIdx === 2 ? ' row-current' : '') + '" id="hl-2"><span class="card-label">批次</span><span class="card-value badge">' + escHtml(d.batch) + '</span></div>' +
      '<div class="card-row' + (stepIdx === 3 ? ' row-current' : '') + '" id="hl-3"><span class="card-label">选科</span><span class="card-value tag">' + escHtml(d.sr) + '</span></div>' +
      '<div class="card-row' + (stepIdx === 4 ? ' row-current' : '') + '" id="hl-4"><span class="card-label">性质</span><span class="card-value">' + escHtml(d.plan) + '</span></div>' +
      '<div class="card-row' + (stepIdx === 5 ? ' row-current' : '') + '" id="hl-5"><span class="card-label">专业名称</span><span class="card-value full">' + escHtml(d.g) + '</span></div>' +
      '<div class="card-row' + (stepIdx === 6 ? ' row-current' : '') + '" id="hl-6"><span class="card-label">专业组代码</span><span class="card-value">' + escHtml(d.gc) + '</span></div>' +
      '<div class="card-row' + (stepIdx === 7 ? ' row-current' : '') + '" id="hl-7"><span class="card-label">专业代号</span><span class="card-value">' + escHtml(d.majorCode) + '</span></div>' +
      '<div class="card-row' + (stepIdx === 8 ? ' row-current' : '') + '" id="hl-8"><span class="card-label">计划录取</span><span class="card-value highlight">' + d.planCount + '人</span></div>' +
      '<div class="card-row' + (stepIdx === 9 ? ' row-current' : '') + '" id="hl-9"><span class="card-label">收费标准</span><span class="card-value">' + d.fee + '元/年</span></div>' +
      (d.remark ? '<div class="card-row card-remark-header ' + (stepIdx === 10 ? ' row-current' : '') + '" id="hl-10" onclick="toggleDemoRemark()"><span class="card-label">备注</span><span class="card-remark-toggle">' + (state.tutorialRemarkExpanded ? '收起<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 15l-6-6-6 6"/></svg>' : '展开▼') + '</span></div>' : '') +
      (state.tutorialRemarkExpanded && d.remark ? '<div class="card-row card-remark-body' + (stepIdx === 10 ? ' row-current' : '') + '"><span class="card-value full">' + escHtml(d.remark) + '</span></div>' : '') +
    '</div></div>'
}

function renderTutorialAssistant(d, stepIdx) {
  var hl = function (s) { return (stepIdx === s ? ' row-current' : '') }
  var rankHint = '<span class="as-rank-hint">（自动换算）</span>'
  // 面板部分（步骤 0-8）
  var body = ''
  if (stepIdx < 9) {
    body = '<div class="as-body' + hl(0) + hl(1) + hl(2) + hl(3) + hl(4) + hl(5) + hl(6) + hl(7) + hl(8) + '">' +
      '<div class="as-row' + hl(0) + hl(1) + '" id="hl-0">' +
        '<div class="as-half' + hl(0) + '" id="hl-0"><span class="as-label">高考分数</span><input class="input input-sm" type="number" value="' + escHtml(d.score) + '" readonly="readonly" style="color:var(--text)"/></div>' +
        '<div class="as-half' + hl(1) + '" id="hl-1"><span class="as-label">全省排名' + rankHint + '</span><input class="input input-sm" type="number" value="' + escHtml(d.rank) + '" readonly="readonly" style="color:var(--text)"/></div>' +
      '</div>' +
      '<div class="as-row' + hl(2) + hl(3) + '" id="hl-2">' +
        '<div class="as-half' + hl(2) + '" id="hl-2"><span class="as-label">选科要求</span><div class="picker picker-sm"><span class="placeholder-text">' + escHtml(d.sr) + '</span></div></div>' +
        '<div class="as-half' + hl(3) + '" id="hl-3"><span class="as-label">地区偏好</span><div class="picker picker-sm"><span>' + escHtml(d.region) + '</span></div></div>' +
      '</div>' +
      '<div class="as-row' + hl(4) + hl(5) + '" id="hl-4">' +
        '<div class="as-half' + hl(4) + '" id="hl-4"><span class="as-label">专业意向</span><input class="input input-sm" placeholder="' + escHtml(d.keyword) + '" value="' + escHtml(d.keyword) + '" readonly="readonly" style="color:var(--text)"/></div>' +
        '<div class="as-half' + hl(5) + '" id="hl-5"><span class="as-label">批次选择</span><div class="picker picker-sm"><span class="placeholder-text">' + escHtml(d.batch) + '</span></div></div>' +
      '</div>' +
      '<div class="as-row as-row-algo-adjust' + hl(6) + hl(7) + '" id="hl-6">' +
        '<div class="as-algo-picker-section' + hl(6) + '" id="hl-6"><span class="as-label">推荐算法</span><div class="picker picker-sm"><span>' + escHtml(d.algo) + '</span></div></div>' +
        '<div class="toggle-item algo-toggle' + hl(7) + '" id="hl-7"><div class="toggle-box checked"><span class="toggle-check">✓</span></div><span class="toggle-label">服从调剂（同时显示同专业组其他专业）</span></div>' +
      '</div>' +
      '<div class="as-row' + hl(8) + '" id="hl-8">' +
        '<div class="as-half" style="display:flex;flex-direction:column;justify-content:flex-end;"><div class="toggle-item"><div class="toggle-box"><span class="toggle-check"></span></div><span class="toggle-label">隐藏中外合作</span></div></div>' +
        '<div class="as-half" style="display:flex;flex-direction:column;justify-content:flex-end;"><div class="toggle-item"><div class="toggle-box"><span class="toggle-check"></span></div><span class="toggle-label">仅推选985/211</span></div></div>' +
      '</div>' +
      '<div class="as-action"><button class="btn btn-search" disabled>开始推荐</button></div>' +
    '</div>'
  } else {
    // 步骤 9：冲稳保结果面板
    body = '<div class="as-results-panel">' +
      '<div class="as-header-simple"><span>📋 志愿填报辅助 — 推荐结果</span></div>' +
      '<div class="as-columns' + hl(9) + '" id="hl-9">' +
        '<div class="as-col reach"><div class="as-col-header"><span class="as-col-tag">冲</span><span class="as-col-num">3 个推荐</span></div>' +
          '<div class="as-col-card" style="opacity:0.6"><div class="card-header"><span class="card-name">首冲大学</span><span class="card-code">2801</span></div><div class="card-body"><div class="card-row"><span class="card-label">2025最低排名</span><span class="card-value highlight">7200</span></div></div></div>' +
          '<div class="as-col-card" style="opacity:0.35"><div class="card-header"><span class="card-name">冲刺学院</span><span class="card-code">3601</span></div><div class="card-body"><div class="card-row"><span class="card-label">2025最低排名</span><span class="card-value highlight">7500</span></div></div></div>' +
        '</div>' +
        '<div class="as-col safe"><div class="as-col-header"><span class="as-col-tag">稳</span><span class="as-col-num">5 个推荐</span></div>' +
          '<div class="as-col-card" style="opacity:0.8"><div class="card-header"><span class="card-name">稳妥大学</span><span class="card-code">4801</span></div><div class="card-body"><div class="card-row"><span class="card-label">2025最低排名</span><span class="card-value highlight">8900</span></div></div></div>' +
          '<div class="as-col-card" style="opacity:0.5"><div class="card-header"><span class="card-name">安全学院</span><span class="card-code">6201</span></div><div class="card-body"><div class="card-row"><span class="card-label">2025最低排名</span><span class="card-value highlight">9500</span></div></div></div>' +
        '</div>' +
        '<div class="as-col fallback"><div class="as-col-header"><span class="as-col-tag">保</span><span class="as-col-num">4 个推荐</span></div>' +
          '<div class="as-col-card" style="opacity:0.9"><div class="card-header"><span class="card-name">保底大学</span><span class="card-code">8201</span></div><div class="card-body"><div class="card-row"><span class="card-label">2025最低排名</span><span class="card-value highlight">12000</span></div></div></div>' +
          '<div class="as-col-card" style="opacity:0.6"><div class="card-header"><span class="card-name">保底学院</span><span class="card-code">8801</span></div><div class="card-body"><div class="card-row"><span class="card-label">2025最低排名</span><span class="card-value highlight">15000</span></div></div></div>' +
        '</div>' +
      '</div>' +
    '</div>'
  }
  return '<div class="demo-card">' +
    '<div class="assistant-section" style="padding:0">' +
      '<div class="as-toggle-row" style="cursor:default"><span class="as-toggle-title">📋 志愿填报辅助</span></div>' +
      body +
    '</div></div>'
}

function renderTutorialDiffs(diffs) {
  let html = ''
  for (const diff of diffs) {
    const label = diff.field === '专业组代码' ? '专业组代码变动' : diff.field + '差异'
    html += '<div class="diff-group"><span class="diff-field">' + label + '</span>'
    for (const entry of diff.entries) {
      html += '<div class="diff-entry"><span class="diff-years">' + escHtml(entry.years) + '</span><span class="diff-arrow">→</span><span class="diff-val">' + escHtml(entry.value) + '</span></div>'
    }
    html += '</div>'
  }
  return html
}

// ============================================================
// 志愿填报辅助
// ============================================================

// Assistant SR and region state
let asSrIdx = -1  // -1 = 未选择
let asRegionIdx = 0
let _mobileAssistantActive = false  // 手机端志愿推荐模式是否激活
let _asComputing = false  // 防止重复点击
let _asGen = 0  // 递增计数器，避免并发 setTimeout 渲染过期结果

function openAssistantSR() {
  renderASSRList()
  DOM.asSrModal.style.display = 'flex'
}

function renderASSRList() {
  const list = DOM.asSrList
  list.innerHTML = ''
  for (let i = 0; i < AS_SR_LIST.length; i++) {
    const item = document.createElement('div')
    item.className = 'scroll-select-item' + (asSrIdx === i ? ' selected' : '')
    item.textContent = AS_SR_LIST[i]
    item.dataset.idx = i
    item.addEventListener('click', function () {
      asSrIdx = parseInt(this.dataset.idx)
      renderASSRList()
    })
    list.appendChild(item)
  }
  // 分隔 + 历史方向提示
  const divider = document.createElement('div')
  divider.className = 'scroll-select-item disabled'
  divider.textContent = '─ 历史方向暂不支持 ─'
  divider.style.cssText = 'color:var(--text-muted);font-size:11px;text-align:center;pointer-events:none;'
  list.appendChild(divider)
}

function confirmASSR() {
  DOM.asSrModal.style.display = 'none'
  if (asSrIdx >= 0) {
    DOM.asSrLabel.textContent = AS_SR_LIST[asSrIdx]
    DOM.asSrLabel.className = ''
  }
}

function openAssistantRegion() {
  renderRegionList()
  DOM.regionModal.style.display = 'flex'
}

function renderRegionList() {
  const list = DOM.regionList
  list.innerHTML = ''
  for (let i = 0; i < REGION_NAMES.length; i++) {
    const item = document.createElement('div')
    item.className = 'scroll-select-item' + (asRegionIdx === i ? ' selected' : '')
    item.textContent = REGION_NAMES[i]
    item.dataset.idx = i
    item.addEventListener('click', function () {
      asRegionIdx = parseInt(this.dataset.idx)
      renderRegionList()
    })
    list.appendChild(item)
  }
}

function confirmRegionPicker() {
  DOM.regionModal.style.display = 'none'
  DOM.asRegionLabel.textContent = REGION_NAMES[asRegionIdx]
  DOM.asRegionLabel.className = asRegionIdx === 0 ? 'placeholder-text' : ''
}

function getBestScore(group) {
  const scores = []
  if (group.d && group.d.s) scores.push(group.d.s)
  if (group.a && group.a.s) scores.push(group.a.s)
  if (group.b && group.b.s) scores.push(group.b.s)
  return scores.length ? Math.max(...scores) : null
}

function getRefScore(group, algorithm) {
  if (algorithm === 'default') {
    // 默认：优先 2026 预估分
    if (group.d && group.d.s) return Number(group.d.s)
    const scores = []
    if (group.a && group.a.s) scores.push(Number(group.a.s))
    if (group.b && group.b.s) scores.push(Number(group.b.s))
    return scores.length ? Math.max(...scores) : 0
  }
  if (algorithm === 'only2024') return group.a && group.a.s ? Number(group.a.s) : 0
  if (algorithm === 'only2025') return group.b && group.b.s ? Number(group.b.s) : 0
  // min / avg / max: 仅使用 2024-2025 分数
  const scores = []
  if (group.a && group.a.s) scores.push(Number(group.a.s))
  if (group.b && group.b.s) scores.push(Number(group.b.s))
  if (scores.length === 0) return 0
  if (algorithm === 'min') return Math.min(...scores)
  if (algorithm === 'avg') return scores.reduce((a, b) => a + b, 0) / scores.length
  if (algorithm === 'max') return Math.max(...scores)
  return 0
}

function calculateTier(userScore, userRank, group, algorithm) {
  algorithm = algorithm || 'default'

  // ── 默认模式（可推荐"新"专业）─────────────────────────────
  if (algorithm === 'default') {
    // Priority 1: 2026 estimated rank, with deviation check
    if (userRank && group.d && group.d.r) {
      const rankOk = Math.abs(group.d.r - userRank) / userRank <= 0.15
      let deviationOk
      if (userScore && group.d.s) {
        deviationOk = Math.abs(group.d.s - userScore) <= 20 && rankOk
      } else {
        deviationOk = rankOk
      }
      if (deviationOk) {
        const ratio = group.d.r / userRank
        if (ratio < 0.92) return '冲'
        if (ratio <= 1.08) return '稳'
        // 保双重熔断：分数 > userScore-15 且 排名 ≤ max(userRank×130%, userRank+3000)
        const rankCap = Math.max(userRank * 1.30, userRank + 3000)
        if (group.d.r > rankCap) return null
        if (userScore) {
          const bestScore = getBestScore(group)
          if (bestScore !== null && bestScore < userScore - 15) return null
        }
        return '保'
      }
    }

    // Priority 2: 2024/2025 average rank
    if (userRank) {
      const ranks = []
      if (group.a && group.a.r) ranks.push(group.a.r)
      if (group.b && group.b.r) ranks.push(group.b.r)
      if (ranks.length > 0) {
        const avgRank = ranks.reduce((a, b) => a + b, 0) / ranks.length
        const ratio = avgRank / userRank
        if (ratio < 0.92) return '冲'
        if (ratio <= 1.08) return '稳'
        // 保双重熔断
        const rankCap = Math.max(userRank * 1.30, userRank + 3000)
        if (avgRank > rankCap) return null
        if (userScore) {
          const bestScore = getBestScore(group)
          if (bestScore !== null && bestScore < userScore - 15) return null
        }
        return '保'
      }
    }

    // Priority 3: Score-based fallback
    if (userScore) {
      const scores = []
      if (group.d && group.d.s) scores.push(group.d.s)
      if (group.a && group.a.s) scores.push(group.a.s)
      if (group.b && group.b.s) scores.push(group.b.s)
      if (scores.length > 0) {
        const bestScore = Math.max(...scores)
        if (bestScore > userScore + 5) return '冲'
        if (bestScore >= userScore - 5) return '稳'
        return '保'
      }
    }
    return null
  }

  // ── min / avg / max / only2024 / only2025 — 仅使用历史数据 ──
  const ranks = []
  if (algorithm !== 'only2025' && group.a && group.a.r) ranks.push(group.a.r)
  if (algorithm !== 'only2024' && group.b && group.b.r) ranks.push(group.b.r)

  let refRank = null
  if (ranks.length > 0) {
    if (algorithm === 'min') refRank = Math.min(...ranks)
    else if (algorithm === 'avg') refRank = ranks.reduce((a, b) => a + b, 0) / ranks.length
    else if (algorithm === 'max') refRank = Math.max(...ranks)
    else refRank = ranks[0]  // only2024 / only2025
  }

  if (userRank && refRank !== null) {
    const ratio = refRank / userRank
    if (ratio < 0.92) return '冲'
    if (ratio <= 1.08) return '稳'
    const rankCap = Math.max(userRank * 1.30, userRank + 3000)
    if (refRank > rankCap) return null
    if (userScore) {
      const scores = []
      if (algorithm !== 'only2025' && group.a && group.a.s) scores.push(Number(group.a.s))
      if (algorithm !== 'only2024' && group.b && group.b.s) scores.push(Number(group.b.s))
      if (scores.length > 0) {
        const bestScore = Math.max(...scores)
        if (bestScore < userScore - 15) return null
      }
    }
    return '保'
  }

  // Score-based fallback（仅使用历史分，不含2026预估分）
  if (userScore) {
    const scores = []
    if (algorithm !== 'only2025' && group.a && group.a.s) scores.push(Number(group.a.s))
    if (algorithm !== 'only2024' && group.b && group.b.s) scores.push(Number(group.b.s))
    if (scores.length > 0) {
      const bestScore = Math.max(...scores)
      if (bestScore > userScore + 5) return '冲'
      if (bestScore >= userScore - 5) return '稳'
      return '保'
    }
  }

  return null
}
// ============================================================
// 一分一段表数据（物理类 2026）
// ============================================================
const WL_SCORES = [698,697,696,695,694,693,692,691,690,689,688,687,686,685,684,683,682,681,680,679,678,677,676,675,674,673,672,671,670,669,668,667,666,665,664,663,662,661,660,659,658,657,656,655,654,653,652,651,650,649,648,647,646,645,644,643,642,641,640,639,638,637,636,635,634,633,632,631,630,629,628,627,626,625,624,623,622,621,620,619,618,617,616,615,614,613,612,611,610,609,608,607,606,605,604,603,602,601,600,599,598,597,596,595,594,593,592,591,590,589,588,587,586,585,584,583,582,581,580,579,578,577,576,575,574,573,572,571,570,569,568,567,566,565,564,563,562,561,560,559,558,557,556,555,554,553,552,551,550,549,548,547,546,545,544,543,542,541,540,539,538,537,536,535,534,533,532,531,530,529,528,527,526,525,524,523,522,521,520,519,518,517,516,515,514,513,512,511,510,509,508,507,506,505,504,503,502,501,500,499,498,497,496,495,494,493,492,491,490,489,488,487,486,485,484,483,482,481,480,479,478,477,476,475,474,473,472,471,470,469,468,467,466,465,464,463,462,461,460,459,458,457,456,455,454,453,452,451,450,449,448,447,446,445,444,443,442,441,440,439,438,437,436,435,434,433,432,431,430,429,428,427,426,425,424,423,422,421,420,419,418,417,416,415,414,413,412,411,410,409,408,407,406,405,404,403,402,401,400,399,398,397,396,395,394,393,392,391,390,389,388,387,386,385,384,383,382,381,380,379,378,377,376,375,374,373,372,371,370,369,368,367,366,365,364,363,362,361,360,359,358,357,356,355,354,353,352,351,350,349,348,347,346,345,344,343,342,341,340,339,338,337,336,335,334,333,332,331,330,329,328,327,326,325,324,323,322,321,320,319,318,317,316,315,314,313,312,311,310,309,308,307,306,305,304,303,302,301,300,299,298,297,296,295,294,293,292,291,290,289,288,287,286,285,284,283,282,281,280,279,278,277,276,275,274,273,272,271,270,269,268,267,266,265,264,263,262,261,260,259,258,257,256,255,254,253,252,251,250,249,248,247,246,245,244,243,242,241,240,239,238,237,236,235,234,233,232,231,230,229,228,227,226,225,224,223,222,221,220,219,218,217,216,215,214,213,212,211,210,209,208,207,206,205,204,203,202,201,200,199,198,197,196,195,194,193,192,191,190,189,188,187,186,185,184,183,182,181,180,179,178,177,176,175,174,173,172,171,170,169,168,167,166,165,164,163,162,161,160,159,158,157,156,155,154,153,152,151,150,149,148,147,146,145,144,143,142,141,140,139,138,137,136,135,134,133,132,131,130,129,128,127,126,125,124,123,122,121,120,118,117,116,115,114,113,112,111,109,108,107,106,104,103,102,101,100]
const WL_CUMULATIVES = [31,35,40,47,48,61,73,85,99,111,125,137,152,168,184,201,236,274,302,338,381,406,439,471,514,552,604,664,719,772,828,881,940,1016,1088,1166,1239,1350,1443,1548,1646,1736,1855,1941,2046,2135,2249,2358,2475,2597,2707,2841,2975,3115,3282,3400,3575,3756,3913,4084,4273,4457,4642,4837,5011,5204,5441,5673,5891,6104,6346,6588,6837,7069,7322,7546,7798,8073,8340,8626,8900,9163,9475,9757,10079,10384,10708,11015,11346,11674,12041,12377,12747,13133,13491,13857,14244,14629,15022,15379,15796,16227,16656,17104,17561,18009,18447,18926,19372,19819,20353,20837,21306,21785,22275,22766,23260,23766,24298,24846,25395,25937,26486,27024,27634,28214,28765,29390,30018,30584,31230,31829,32480,33098,33769,34418,35073,35716,36366,37022,37729,38462,39152,39844,40561,41287,42026,42794,43516,44266,45021,45787,46547,47352,48164,48955,49697,50517,51298,52102,52899,53705,54529,55379,56272,57145,58003,58853,59691,60572,61443,62326,63244,64147,65010,65938,66821,67732,68701,69643,70608,71538,72505,73497,74420,75378,76304,77293,78294,79293,80283,81286,82268,83293,84267,85255,86214,87223,88283,89294,90320,91291,92314,93375,94390,95448,96460,97553,98563,99637,100710,101778,102836,103922,105078,106149,107194,108274,109329,110356,111416,112487,113525,114598,115719,116825,117916,118906,120028,121085,122141,123166,124222,125246,126308,127379,128430,129463,130551,131571,132645,133620,134656,135637,136672,137707,138693,139728,140717,141750,142800,143799,144726,145711,146663,147634,148537,149493,150410,151320,152203,153123,154052,154983,155892,156783,157635,158466,159346,160234,161121,161933,162776,163604,164445,165237,166063,166845,167626,168418,169244,170052,170867,171651,172413,173158,173871,174570,175294,176013,176694,177371,178102,178835,179546,180208,180913,181615,182336,182970,183676,184341,184957,185585,186258,186857,187431,188045,188683,189266,189866,190521,191037,191629,192228,192818,193373,193909,194458,195017,195567,196092,196623,197136,197666,198183,198678,199219,199738,200254,200716,201210,201728,202166,202709,203214,203683,204164,204640,205083,205520,205989,206400,206793,207210,207596,207991,208384,208796,209168,209557,209903,210328,210716,211079,211449,211839,212223,212579,212962,213316,213650,213993,214354,214726,215086,215399,215774,216072,216414,216745,217027,217354,217669,217966,218309,218616,218926,219248,219560,219851,220128,220416,220689,220963,221289,221574,221833,222114,222387,222671,222974,223242,223522,223789,224086,224358,224596,224858,225111,225367,225607,225847,226095,226347,226571,226819,227051,227291,227520,227724,227965,228191,228443,228650,228901,229127,229322,229546,229761,229963,230155,230366,230550,230785,230998,231194,231395,231600,231806,232002,232210,232404,232590,232784,232989,233177,233366,233521,233694,233876,234050,234254,234447,234614,234762,234904,235080,235241,235403,235558,235723,235877,236042,236189,236360,236509,236673,236825,237004,237144,237287,237422,237552,237715,237849,237979,238095,238196,238328,238426,238537,238661,238765,238866,238995,239083,239179,239277,239368,239467,239562,239667,239737,239801,239875,239938,240014,240101,240166,240237,240293,240338,240390,240447,240499,240541,240590,240633,240684,240721,240776,240818,240849,240875,240914,240945,240975,241013,241046,241070,241092,241112,241137,241161,241185,241208,241234,241257,241270,241285,241302,241321,241339,241348,241365,241377,241388,241402,241422,241433,241442,241458,241470,241481,241490,241506,241518,241528,241534,241544,241554,241562,241569,241574,241582,241588,241596,241601,241605,241611,241616,241622,241629,241639,241642,241648,241656,241661,241670,241682,241686,241687,241691,241696,241700,241710,241717,241724,241728,241733,241740,241745,241753,241757,241758,241763,241765,241771,241773,241776,241780,241781,241785,241789,241794,241800,241802,241807,241812,241817,241821,241825,241828,241834,241838]

/**
 * 将高考分数转换为一分一段排名
 * @param {number} score - 高考分数
 * @returns {number|null} 排名，若无法换算则返回 null
 */
function scoreToRank(score) {
  if (!score || score <= 0) return null
  if (score > WL_SCORES[0]) return 1
  if (score < WL_SCORES[WL_SCORES.length - 1]) return WL_CUMULATIVES[WL_CUMULATIVES.length - 1]
  for (let i = 0; i < WL_SCORES.length; i++) {
    if (WL_SCORES[i] === score) return WL_CUMULATIVES[i]
    if (WL_SCORES[i] < score) return i > 0 ? WL_CUMULATIVES[i - 1] : WL_CUMULATIVES[0]
  }
  return WL_CUMULATIVES[WL_CUMULATIVES.length - 1]
}


function startAssistant() {
  // Guard: data not loaded
  if (!state.loaded || !state.mergedCache) {
    DOM.asColumns.innerHTML = '<div class="as-empty">数据加载中，请稍候...</div>'
    showAssistantMode()
    return
  }
  // Read inputs
  const scoreVal = parseInt(DOM.asScore.value) || 0
  let rank = parseInt(DOM.asRank.value) || 0

  // 如果未填写排名但有分数，则从一分一段表自动换算
  if (!rank && scoreVal > 0) {
    const converted = scoreToRank(scoreVal)
    if (converted) {
      DOM.asRank.value = converted
      DOM.asRank.classList.add('as-rank-auto')
      DOM.asRankHint.style.display = 'inline'
      rank = converted
    }
  }

  if (!scoreVal && !rank) {
    DOM.asColumns.innerHTML = '<div class="as-empty">请输入高考分数或全省排名</div>'
    showAssistantMode()
    return
  }

  // 防重复点击
  if (_asComputing) return
  _asComputing = true

  // 先显示加载动画再延迟计算，让浏览器有机会渲染 loading 状态
  DOM.asColumns.innerHTML = '<div class="as-loading"><div class="as-loading-spinner"></div><span>正在计算志愿推荐...</span></div>'
  showAssistantMode()

  const srCode = asSrIdx >= 0 ? AS_SR_CODES[asSrIdx] : ''
  const regionProvinces = REGIONS[REGION_NAMES[asRegionIdx]]
  const keyword = String(DOM.asKeyword.value).trim()

  const gen = ++_asGen
  setTimeout(function () {
    _execAssistant(scoreVal, rank, srCode, regionProvinces, keyword)
  }, 0)
}

function _execAssistant(score, rank, srCode, regionProvinces, keyword) {
  const results = { '冲': [], '稳': [], '保': [] }
  const data = state.mergedCache || []
  const algoVal = ALGO_LIST[state.assistantAlgoIdx].value
  const kws = keyword ? keyword.split(/\s+/).filter(Boolean) : null
  // 预计算考生选科 Set
  const userSrCodes = srCode ? new Set(srCode.split('*').filter(Boolean)) : null

  for (let i = 0; i < data.length; i++) {
    const g = data[i]

    // 仅推荐 2026 年有招生计划的专业组
    if (!g.d) continue

    // 非默认算法：仅推荐有对应历史数据的专业组，不出现"新"专业
    if (algoVal !== 'default') {
      const hasHist = algoVal === 'only2024' ? !!g.a : algoVal === 'only2025' ? !!g.b : (g.a || g.b)
      if (!hasHist) continue
    }

    // Region filter
    if (regionProvinces && regionProvinces.indexOf(g.p) === -1) continue

    // Subject filter (减量匹配：考生选科 ⊇ 专业要求)
    if (userSrCodes && g.s) {
      const reqCodes = g.s.split('*').filter(Boolean)
      if (reqCodes.length && !reqCodes.every(c => userSrCodes.has(c))) continue
    }

    // 专业名搜索（多项用空格分隔，OR 匹配）
    if (kws) {
      const matchAny = kws.some(function(kw) { return g.g.indexOf(kw) !== -1 })
      if (!matchAny) continue
    }

    // Batch filter（使用推荐面板独立的批次选择）
    if (state.asSelectedBatches.length && state.asSelectedBatches.indexOf(g.batch) === -1) continue

    // Skip sports/coop based on existing filters
    if (state.hideSports && (g.g.indexOf('体育') !== -1 || g.n.indexOf('体育') !== -1)) continue
    if (state.assistantHideCoop && (g.g.indexOf('中外合作') !== -1 || (g.remark && g.remark.indexOf('中外合作') !== -1))) continue

    // 仅推选 985/211
    if (state.assistantOnly985211 && !getSchoolTag(g.n)) continue

    // Calculate tier
    const tier = calculateTier(score, rank, g, algoVal)
    if (tier && results[tier]) {
      results[tier].push(g)
    }
  }

  // Sort within each tier（保：从高到低，冲/稳：从低到高）
  for (const t of ['冲', '稳', '保']) {
    const order = t === '保' ? -1 : 1
    results[t].sort((a, b) => {
      const sa = getRefScore(b, algoVal)
      const sb = getRefScore(a, algoVal)
      return order * (sb - sa)
    })
  }

  try {
    renderAssistantResults(results, score, rank)
  } catch (e) {
    console.error(e)
    DOM.asColumns.innerHTML = '<div class="as-empty">计算时出现错误，请重试</div>'
  } finally {
    _asComputing = false
  }
}

function renderAssistantResults(results, userScore, userRank) {
  const container = DOM.asColumns
  const tiers = ['冲', '稳', '保']
  const labels = { '冲': '冲', '稳': '稳', '保': '保' }
  const classes = { '冲': 'reach', '稳': 'safe', '保': 'fallback' }

  const total = tiers.reduce((s, t) => s + results[t].length, 0)

  if (total === 0) {
    container.innerHTML = '<div class="as-empty">未找到匹配的院校和专业，请调整输入条件后重试</div>'
    return
  }

  container.innerHTML = ''
  const oldRemarkExpanded = state.remarkExpanded
  state.remarkExpanded = {}

  // Build tab bar
  const tabBar = document.createElement('div')
  tabBar.className = 'as-tab-bar'
  tabBar.id = 'as-tab-bar'
  for (const t of tiers) {
    const count = results[t].length
    const tab = document.createElement('span')
    tab.className = 'as-tab ' + classes[t] + (t === '冲' ? ' active' : '')
    tab.dataset.tier = t
    tab.textContent = labels[t] + ' (' + count + ')'
    tabBar.appendChild(tab)
  }
  container.appendChild(tabBar)

  // Build columns — 使用 DocumentFragment 批量追加，减少回流
  const adjustMap = state.assistantAdjust ? buildGroupMajorMap() : null

  for (const t of tiers) {
    const items = results[t]
    const isActive = t === '冲'

    const col = document.createElement('div')
    col.className = 'as-column' + (isActive ? ' active' : '')
    col.dataset.tier = t

    const header = document.createElement('div')
    header.className = 'as-column-header ' + classes[t]
    header.innerHTML = labels[t] + ' <span style="font-weight:normal;font-size:12px">' + items.length + '个专业组</span>'
    col.appendChild(header)

    const body = document.createElement('div')
    body.className = 'as-column-body'
    body.addEventListener('scroll', function () {
      if (_mobileAssistantActive) {
        DOM.floatBtn.style.display = this.scrollTop > 300 ? 'flex' : 'none'
      }
    })

    if (items.length) {
      const frag = document.createDocumentFragment()
      for (let i = 0; i < items.length; i++) {
        frag.appendChild(renderCardGrouped(items[i], 'as-' + t + '-' + i, adjustMap))
      }
      body.appendChild(frag)
    } else {
      const empty = document.createElement('div')
      empty.className = 'as-empty'
      empty.style.padding = '20px 0'
      empty.textContent = '该档暂无推荐'
      body.appendChild(empty)
    }

    col.appendChild(body)
    container.appendChild(col)
  }

  state.remarkExpanded = oldRemarkExpanded
  updateAssistantLayout()

  // Bind tab switching
  const tabs = container.querySelectorAll('.as-tab')
  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      const tier = this.dataset.tier
      container.querySelectorAll('.as-tab').forEach(function (t) { t.classList.remove('active') })
      this.classList.add('active')
      container.querySelectorAll('.as-column').forEach(function (c) {
        c.classList.toggle('active', c.dataset.tier === tier)
      })
      // 切换列时检查新列的滚动位置
      const activeBody = container.querySelector('.as-column.active .as-column-body')
      if (activeBody) {
        DOM.floatBtn.style.display = activeBody.scrollTop > 300 ? 'flex' : 'none'
      }
    })
  })
}

function updateAssistantLayout() {
  const container = DOM.asColumns
  if (!container) return
  // If right-col width < 500px, add tab-mode class
  const rightCol = container.closest('.right-col')
  if (rightCol) {
    const w = rightCol.offsetWidth
    container.classList.toggle('tab-mode', w < 500)
  }
}

function showAssistantMode() {
  DOM.resultBar.style.display = 'none'
  DOM.resultList.style.display = 'none'
  DOM.assistantResults.style.display = 'flex'
  DOM.assistantResults.style.flex = '1'
}

function exitAssistant() {
  DOM.resultBar.style.display = ''
  DOM.resultList.style.display = ''
  DOM.assistantResults.style.display = 'none'
  // 重置切换按钮文字
  DOM.btnAsToggle.textContent = '志愿推荐'
  _mobileAssistantActive = false
  // 手机端：恢复被隐藏的筛选行和年份选项卡
  if (window.innerWidth < 860) {
    DOM.assistantSection.style.display = ''
    const rows = DOM.filterFields.querySelectorAll('.filter-row')
    for (let i = 1; i < rows.length; i++) {
      rows[i].style.display = ''
    }
    DOM.yearTabs.style.display = ''
  }
}

function toggleMobileAssistant() {
  if (_mobileAssistantActive) {
    exitAssistant()
    return
  }
  // 进入志愿推荐模式
  _mobileAssistantActive = true
  DOM.btnAsToggle.textContent = '返回搜索'
  // 手机端专有布局调整
  if (window.innerWidth < 860) {
    // 确保筛选栏展开
    DOM.filterBar.classList.remove('hidden')
    state.filterHidden = false
    DOM.toggleFilter.textContent = '收起筛选'
    // 隐藏其他筛选行，保留年份选项卡行
    const rows = DOM.filterFields.querySelectorAll('.filter-row')
    for (let i = 1; i < rows.length; i++) {
      rows[i].style.display = 'none'
    }
    // 隐藏年份选项卡中的全部和年份
    DOM.yearTabs.style.display = 'none'
    DOM.assistantSection.style.display = 'block'
  }
  // 切换右侧结果区到志愿推荐模式
  startAssistant()
}

// ============================================================
// 志愿填报辅助 — 桌面端折叠/展开
// ============================================================
function toggleAssistantCollapse() {
  DOM.assistantSection.classList.toggle('collapsed')
}

function checkAssistantOverflow() {
  // 仅在桌面端生效
  if (window.innerWidth < 860) return
  const fb = DOM.filterBar
  // 如果内容溢出且当前未折叠，自动折叠
  if (fb.scrollHeight > fb.clientHeight && !DOM.assistantSection.classList.contains('collapsed')) {
    DOM.assistantSection.classList.add('collapsed')
  }
}

// ============================================================
// 初始化与事件绑定
// ============================================================
function initDOM() {
  DOM = {
    // Loading
    progressFill: document.getElementById('progress-fill'),
    loadPct: document.getElementById('load-pct'),
    loadStage: document.getElementById('load-stage'),
    pageLoading: document.getElementById('page-loading'),
    pageIndex: document.getElementById('page-index'),

    // Filter bar
    filterBar: document.getElementById('filter-bar'),
    filterFields: document.getElementById('filter-fields'),
    yearTabs: document.getElementById('year-tabs'),
    inputCode: document.getElementById('input-code'),
    inputName: document.getElementById('input-name'),
    inputGroupName: document.getElementById('input-group-name'),
    inputGroupCode: document.getElementById('input-group-code'),
    inputMinScore: document.getElementById('input-min-score'),
    inputMaxRank: document.getElementById('input-max-rank'),
    scoreRow: document.getElementById('filter-score-row'),
    btnSearch: document.getElementById('btn-search'),
    btnReset: document.getElementById('btn-reset'),
    toggleFilter: document.getElementById('toggle-filter'),

    // Province
    provinceModal: document.getElementById('province-modal'),
    provinceList: document.getElementById('province-list'),
    provinceLabel: document.getElementById('province-label'),
    btnProvinces: document.getElementById('btn-provinces'),
    btnSelectAll: document.getElementById('btn-select-all'),
    btnClearAll: document.getElementById('btn-clear-all'),
    btnConfirmProvince: document.getElementById('btn-confirm-province'),

    // SR
    srModal: document.getElementById('sr-modal'),
    srList: document.getElementById('sr-list'),
    srLabel: document.getElementById('sr-label'),
    btnSR: document.getElementById('btn-sr'),
    btnConfirmSR: document.getElementById('btn-confirm-sr'),

    // Batch
    batchModal: document.getElementById('batch-modal'),
    batchList: document.getElementById('batch-list'),
    batchLabel: document.getElementById('batch-label'),
    btnBatches: document.getElementById('btn-batches'),
    btnSelectAllBatch: document.getElementById('btn-select-all-batch'),
    btnClearAllBatch: document.getElementById('btn-clear-all-batch'),
    btnConfirmBatch: document.getElementById('btn-confirm-batch'),

    // Results
    resultList: document.getElementById('result-list'),
    resultCards: document.getElementById('result-cards'),
    totalCount: document.getElementById('total-count'),
    loadTime: document.getElementById('load-time'),
    emptyMsg: document.getElementById('empty-msg'),
    loadingMore: document.getElementById('loading-more'),
    floatBtn: document.getElementById('float-btn'),

    // Tutorial
    tutorialOverlay: document.getElementById('tutorial-overlay'),
    tutorialCard: document.getElementById('tutorial-card'),
    tutorialTabs: document.getElementById('tutorial-tabs'),
    tutorialSkip: document.getElementById('tutorial-skip'),
    stepCount: document.getElementById('step-count'),
    stepBarFill: document.getElementById('step-bar-fill'),
    stepTitle: document.getElementById('step-title'),
    stepDesc: document.getElementById('step-desc'),
    btnPrev: document.getElementById('btn-prev'),
    btnNext: document.getElementById('btn-next'),

    // Mobile assistant toggle
    btnAsToggle: document.getElementById('btn-as-toggle'),

    // Help
    btnDarkMode: document.getElementById('btn-dark-mode'),
    btnHelp: document.getElementById('btn-help'),
    btnFeedback: document.getElementById('btn-feedback'),
    btnHelpBar: document.getElementById('btn-help-bar'),
    btnFeedbackBar: document.getElementById('btn-feedback-bar'),
    btnDarkModeBar: document.getElementById('btn-dark-mode-bar'),

    // Assistant batch picker
    asBtnBatches: document.getElementById('as-btn-batches'),
    asBatchLabel: document.getElementById('as-batch-label'),

    // Assistant SR picker
    asSrModal: document.getElementById('as-sr-modal'),
    asSrList: document.getElementById('as-sr-list'),
    btnConfirmASSR: document.getElementById('btn-confirm-as-sr'),

    // Region picker
    regionModal: document.getElementById('region-modal'),
    regionList: document.getElementById('region-list'),
    btnConfirmRegion: document.getElementById('btn-confirm-region'),

    // Assistant section (filter bar)
    assistantSection: document.getElementById('assistant-section'),
    asToggleRow: document.getElementById('as-toggle-row'),
    asBody: document.getElementById('as-body'),
    // Assistant
    asScore: document.getElementById('as-score'),
    asRank: document.getElementById('as-rank'),
	    asRankHint: document.getElementById('as-rank-hint'),
    asSrLabel: document.getElementById('as-sr-label'),
    asSr: document.getElementById('as-sr'),
    asRegionLabel: document.getElementById('as-region-label'),
    asRegion: document.getElementById('as-region'),
    asKeyword: document.getElementById('as-keyword'),
    btnAssistant: document.getElementById('btn-assistant'),
    btnExitAssistant: document.getElementById('btn-exit-assistant'),
    algoPicker: document.getElementById('btn-algo'),
    algoLabel: document.getElementById('algo-label'),
    algoModal: document.getElementById('algo-modal'),
    algoList: document.getElementById('algo-list'),
    btnConfirmAlgo: document.getElementById('btn-confirm-algo'),
    assistantResults: document.getElementById('assistant-results'),
    asColumns: document.getElementById('as-columns'),
    resultBar: document.getElementById('result-bar'),
  }
}

function bindEvents() {
  // Year tabs (event delegation)
  DOM.yearTabs.addEventListener('click', function (e) {
    const tab = e.target.closest('.tab')
    if (!tab || tab.dataset.year === undefined) return
    onYearChange(tab.dataset.year)
  })

  // Input fields (debounced)
  const inputFields = [
    DOM.inputCode, DOM.inputName, DOM.inputGroupName,
    DOM.inputGroupCode, DOM.inputMinScore, DOM.inputMaxRank
  ]
  let searchTimer = null
  inputFields.forEach(el => {
    el.addEventListener('input', function () {
      syncStateFromInputs()
      if (searchTimer) clearTimeout(searchTimer)
      searchTimer = setTimeout(doSearch, SEARCH_DEBOUNCE)
    })
  })

  // Province picker
  DOM.btnProvinces.addEventListener('click', openProvincePicker)
  DOM.provinceModal.addEventListener('click', function (e) {
    if (e.target === this) closeProvincePicker()
  })
  DOM.btnSelectAll.addEventListener('click', selectAllProvinces)
  DOM.btnClearAll.addEventListener('click', clearProvinces)
  DOM.btnConfirmProvince.addEventListener('click', confirmProvincePicker)

  // SR picker
  DOM.btnSR.addEventListener('click', openSRPicker)
  DOM.srModal.addEventListener('click', function (e) {
    if (e.target === this) closeSRPicker()
  })
  DOM.btnConfirmSR.addEventListener('click', confirmSR)

  // Batch picker
  DOM.btnBatches.addEventListener('click', function () { openBatchPicker('search') })
  DOM.batchModal.addEventListener('click', function (e) {
    if (e.target === this) closeBatchPicker()
  })
  DOM.btnSelectAllBatch.addEventListener('click', selectAllBatches)
  DOM.btnClearAllBatch.addEventListener('click', clearBatches)
  DOM.btnConfirmBatch.addEventListener('click', confirmBatchPicker)

  // Toggle switches
  document.getElementById('toggle-only2026').addEventListener('click', onToggleOnly2026)
  document.getElementById('toggle-hide-sports').addEventListener('click', onToggleHideSports)
  document.getElementById('toggle-hide-coop').addEventListener('click', onToggleHideCoop)
  document.getElementById('toggle-adjust').addEventListener('click', onToggleAdjust)
  document.getElementById('as-toggle-hide-coop').addEventListener('click', onAssistantToggleHideCoop)
  document.getElementById('as-toggle-only-985211').addEventListener('click', onAssistantToggleOnly985211)
  DOM.btnDarkMode.addEventListener('click', onToggleDarkMode)

  // Mobile assistant toggle
  DOM.btnAsToggle.addEventListener('click', toggleMobileAssistant)

  // Search / Reset
  DOM.btnSearch.addEventListener('click', function () {
    syncStateFromInputs()
    doSearch()
  })
  DOM.btnReset.addEventListener('click', doReset)

  // Filter toggle
  DOM.toggleFilter.addEventListener('click', function () {
    state.filterHidden = !state.filterHidden
    DOM.filterBar.classList.toggle('hidden', state.filterHidden)
    DOM.toggleFilter.textContent = state.filterHidden ? '展开筛选' : '收起筛选'
    DOM.floatBtn.style.display = state.filterHidden ? 'flex' : 'none'
  })

  // Float button (scroll to top)
  DOM.floatBtn.addEventListener('click', scrollToTop)

  // Scroll to load more
  let lastScrollTop = 0
  DOM.resultList.addEventListener('scroll', function () {
    const { scrollTop, scrollHeight, clientHeight } = this
    if (scrollHeight - scrollTop - clientHeight < 100 && state.hasMore) {
      loadMore()
    }
    // Show float btn when scrolled past filter
    DOM.floatBtn.style.display = scrollTop > 300 ? 'flex' : 'none'
    lastScrollTop = scrollTop
  })

  // 志愿推荐模式滚动 → 显示/隐藏返回顶部按钮（通过列体直接绑定）
  // 实际绑定在 renderAssistantResults 中创建列体时完成

  // Help button
  DOM.btnHelp.addEventListener('click', function () {
    openTutorial(true)
  })

  // Feedback button → GitHub Issues
  DOM.btnFeedback.addEventListener('click', function () {
    window.open('https://github.com/Shirakawa-Kotone/miniprogram-web/issues/new', '_blank')
  })

  // Result bar action buttons
  DOM.btnHelpBar.addEventListener('click', function () { openTutorial(true) })
  DOM.btnFeedbackBar.addEventListener('click', function () {
    window.open('https://github.com/Shirakawa-Kotone/miniprogram-web/issues/new', '_blank')
  })
  DOM.btnDarkModeBar.addEventListener('click', onToggleDarkMode)

  // Tutorial events
  DOM.tutorialSkip.addEventListener('click', finishTutorialAndStart)

  // Tutorial tabs
  DOM.tutorialTabs.addEventListener('click', function (e) {
    const tab = e.target.closest('.mode-tab')
    if (!tab || !tab.dataset.mode) return
    switchTutorialMode(tab.dataset.mode)
  })

  DOM.btnNext.addEventListener('click', tutorialNext)
  DOM.btnPrev.addEventListener('click', tutorialPrev)

  // Click overlay to close tutorial
  DOM.tutorialOverlay.addEventListener('click', function (e) {
    if (e.target === this) finishTutorialAndStart()
  })

  // Assistant — batch picker
  DOM.asBtnBatches.addEventListener('click', function () { openBatchPicker('assistant') })
  // Assistant — SR picker (独立弹窗)
  DOM.asSr.addEventListener('click', openAssistantSR)
  DOM.asSrModal.addEventListener('click', function (e) {
    if (e.target === this) DOM.asSrModal.style.display = 'none'
  })
  DOM.btnConfirmASSR.addEventListener('click', confirmASSR)
  // Assistant — region picker modal
  DOM.asRegion.addEventListener('click', openAssistantRegion)
  DOM.regionModal.addEventListener('click', function (e) {
    if (e.target === this) DOM.regionModal.style.display = 'none'
  })
  DOM.btnConfirmRegion.addEventListener('click', confirmRegionPicker)
  // Assistant — start recommendation
  DOM.btnAssistant.addEventListener('click', startAssistant)
  // Assistant — exit
  DOM.btnExitAssistant.addEventListener('click', exitAssistant)
  // Assistant — algorithm picker
  DOM.algoPicker.addEventListener('click', openAlgoPicker)
  DOM.algoModal.addEventListener('click', function (e) {
    if (e.target === this) closeAlgoPicker()
  })
  DOM.btnConfirmAlgo.addEventListener('click', confirmAlgoPicker)
  // Assistant — Enter key triggers search
  DOM.asKeyword.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') startAssistant()
  })
  DOM.asScore.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') startAssistant()
  })
  DOM.asRank.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') startAssistant()
  })
  // 用户修改排名时清除自动换算高亮 + 隐藏推荐结果
  DOM.asRank.addEventListener('input', function () {
    this.classList.remove('as-rank-auto')
    DOM.asRankHint.style.display = 'none'
    if (DOM.assistantResults.style.display !== 'none') exitAssistant()
  })
  // 用户修改分数时清除已自动换算的排名 + 隐藏推荐结果
  DOM.asScore.addEventListener('input', function () {
    if (DOM.asRank.classList.contains('as-rank-auto')) {
      DOM.asRank.value = ''
      DOM.asRank.classList.remove('as-rank-auto')
      DOM.asRankHint.style.display = 'none'
    }
    if (DOM.assistantResults.style.display !== 'none') exitAssistant()
  })

  // Assistant section collapse toggle
  DOM.asToggleRow.addEventListener('click', toggleAssistantCollapse)

  // Resize handlers
  window.addEventListener('resize', function () {
    if (DOM.assistantResults.style.display !== 'none') {
      updateAssistantLayout()
    }
    checkAssistantOverflow()
  })
}

// ============================================================
// 启动
// ============================================================
function init() {
  // 冻结 CSS 动画当前进度（alldata.js 下载期间 CSS animation 已从 10% 往上推）
  // 后续第一个 updateProgress 从该值继续而不是硬编码 20%，避免进度倒退
  const $pf = document.getElementById('progress-fill')
  let frozenPct = 10
  if ($pf) {
    const trackW = $pf.parentElement.clientWidth
    if (trackW > 0) {
      const visualPct = Math.round(($pf.getBoundingClientRect().width / trackW) * 100)
      frozenPct = Math.max(10, Math.min(60, visualPct))
      $pf.style.animation = 'none'
      $pf.style.width = frozenPct + '%'
      const $pct = document.getElementById('load-pct')
      const $stage = document.getElementById('load-stage')
      if ($pct) $pct.textContent = frozenPct + '%'
      if ($stage) $stage.textContent = '正在加载数据文件...'
    }
  }

  // 延迟执行确保 DOM 已渲染
  setTimeout(() => {
    initDOM()
    bindEvents()

    // 从冻结位置继续，保证不会倒退
    const loadPct = Math.max(frozenPct, 20)
    updateProgress(loadPct, '加载完成，正在初始化界面...')

    // 展开数据（分块异步，带进度）
    setTimeout(() => {
      expandAllData(loadPct, function (success) {
        if (!success) {
          updateProgress(100, '数据加载失败，请刷新页面重试')
          return
        }

        updateProgress(75, '正在构建查询缓存...')

        setTimeout(() => {
          buildMergedCache()
          buildBatchList()

          updateProgress(82, '正在优化搜索结果排序...')

          setTimeout(() => {
            updateProgress(90, '准备就绪...')

            // 切换到主页面
            setTimeout(() => {
              DOM.pageLoading.style.display = 'none'
              DOM.pageIndex.style.display = ''

              state.loaded = true
              state.darkMode = document.documentElement.classList.contains('dark-mode')

              // 首访引导
              let tutorialDone = false
              try { tutorialDone = localStorage.getItem('tutorial_done') } catch (e) {}
              if (!tutorialDone) {
                openTutorial(false)
              }

              // 初始搜索
              doSearch()
              // 桌面端检测助手区是否溢出
              setTimeout(checkAssistantOverflow, 300)
            }, 200)
          }, 80)
        }, 80)
      })
    }, 80)
  }, 50)
}

// 页面加载完成后启动
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init)
} else {
  init()
}
