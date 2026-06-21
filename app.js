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

const SR_LIST = ['不限', '物理', '物理+化学', '物理+生物', '物理+化学+生物']
const SR_CODES = ['', '04', '04*05', '04*06', '04*05*06']
const PAGE_SIZE = 30
const SEARCH_DEBOUNCE = 200

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

  // Tutorial
  tutorialMode: 'merged',
  tutorialStep: 0,
  tutorialSteps: [],
  tutorialDemo: null,
  tutorialRemarkExpanded: false,
}

// DOM references (set once on init)
let DOM = {}

// ============================================================
// 数据加载 & 展开（分块处理，支持进度更新）
// ============================================================
function expandAllData(callback) {
  if (!window.ALL_DATA_RAW) {
    updateProgress(100, '数据文件未加载，请刷新重试')
    if (callback) callback(false)
    return
  }

  updateProgress(25, '正在展开2024年数据...')

  const raw = window.ALL_DATA_RAW
  const { a: provincePool, b: schoolNamePool, c: groupNamePool, d: records, e: extra } = raw
  const { b: batchPool, p: planPool, g: gcPool, f: feePool, r: remarkPool } = extra
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
          String(r[2] || ''),
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
        a: null, b: null, d: null,
        batch: r[9], plan: r[10], gc: r[11], fee: r[12],
        remark: r[13], _sd: r[14],
        _vr: {},
        _diffs: null,
      }
      groups.set(key, grp)
    }
    const yr = r[0]
    if (!grp._vr[yr]) grp._vr[yr] = {}
    grp._vr[yr].gc = r[11]
    grp._vr[yr].batch = r[9]
    grp._vr[yr].plan = r[10]
    grp._vr[yr].fee = r[12]

    if (yr === '2024') {
      if (!grp.a) grp.a = { s: r[6], r: r[7], e: r[8] }
    } else if (yr === '2025') {
      if (!grp.b) grp.b = { s: r[6], r: r[7], e: r[8] }
    } else {
      if (!grp.d) grp.d = { s: r[6], r: r[7], e: r[8] }
      grp.c = r[2]; grp.gc = r[11]; grp.batch = r[9]
      grp.plan = r[10]; grp.fee = r[12]
    }
  }
  state.mergedCache = Array.from(groups.values())
}

// ============================================================
// 工具函数
// ============================================================
function parseSR(sr) {
  if (!sr) return ['不限']
  return sr.split('*').map(s => SR_MAP[s] || s)
}

function getProvinceLabel(arr) {
  if (!arr || !arr.length) return '全部省份'
  if (arr.length <= 2) return arr.join('、')
  return arr.slice(0, 2).join('、') + ' 等' + arr.length + '个省份'
}

function computeDiffs(g, vr) {
  const yrs = []
  if (g.a) yrs.push('2024')
  if (g.b) yrs.push('2025')
  if (g.d) yrs.push('2026')
  if (yrs.length < 2) return null
  const diffs = []
  const fields = [
    { key: 'gc', label: '专业组' },
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
  const t0 = Date.now()

  const { year, selectedProvinces, code, name, srIdx, groupName, groupCode, minScore, maxRank, only2026, hideSports, hideCoop } = state
  const sr = srIdx > 0 ? SR_CODES[srIdx] : ''
  const ms = parseInt(minScore) || 0
  const mr = parseInt(maxRank) || 0
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
      if (sr && g.s !== sr) continue
      if (groupStr && g.g.indexOf(groupStr) === -1) continue
      if (groupCodeStr && String(g.gc).indexOf(groupCodeStr) === -1) continue
      if (hideSports && (g.g.indexOf('体育') !== -1 || g.n.indexOf('体育') !== -1)) continue
      if (hideCoop && (g.g.indexOf('中外合作') !== -1 || (g.remark && g.remark.indexOf('中外合作') !== -1))) continue
      if (only2026 && !g.d) continue

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
        if (g.d) {
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
          if (c.d && Number(c.d.s) < ms) c.d = null
        }
        if (mr) {
          if (c.a && Number(c.a.r) > mr) c.a = null
          if (c.b && Number(c.b.r) > mr) c.b = null
          if (c.d && Number(c.d.r) > mr) c.d = null
        }
        c._diffs = computeDiffs(c, c._vr)
        results.push(c)
      } else {
        results.push(g)
      }
    }

    results.sort((a, b) => {
      const hasScoreA = !!(a.a || a.b)
      const hasScoreB = !!(b.a || b.b)
      if (hasScoreA && !hasScoreB) return -1
      if (!hasScoreA && hasScoreB) return 1
      const sa = Number((a.b || a.a || a.d || {}).s || 0)
      const sb = Number((b.b || b.a || b.d || {}).s || 0)
      return (ms || mr) ? sa - sb : sb - sa
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
      if (sr && r[4] !== sr) continue
      if (codeStr && r[2].indexOf(codeStr) === -1) continue
      if (nameStr && r[3].indexOf(nameStr) === -1) continue
      if (groupStr && r[5].indexOf(groupStr) === -1) continue
      if (groupCodeStr && String(r[11]).indexOf(groupCodeStr) === -1) continue
      if (only2026 && r[0] !== '2026') continue
      if (hideSports && (r[5].indexOf('体育') !== -1 || r[3].indexOf('体育') !== -1)) continue
      if (hideCoop && (r[5].indexOf('中外合作') !== -1 || r[13].indexOf('中外合作') !== -1)) continue
      result.push(r)
    }
    if (ms || mr) {
      result.sort((a, b) => a[6] - b[6])
    } else {
      result.sort((a, b) => b[6] - a[6])
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

function renderCardGrouped(item, idx) {
  const card = document.createElement('div')
  card.className = 'card'
  card.dataset.idx = idx

  // Header
  const header = document.createElement('div')
  header.className = 'card-header'
  header.innerHTML = '<span class="card-name">' + escHtml(item.n) + '</span>' +
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
  if (item.gc) body.appendChild(makeRow('专业组', item.gc))

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
  // 2026 row
  if (item.d) {
    body.appendChild(make2026Row(
      '<span class="card-value">计划录取' + item.d.e + '人</span>'))
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

  card.appendChild(body)
  return card
}

function renderCardSingle(record, idx) {
  const card = document.createElement('div')
  card.className = 'card'
  card.dataset.idx = idx

  const header = document.createElement('div')
  header.className = 'card-header'
  header.innerHTML = '<span class="card-year">' + escHtml(record[0]) + '</span>' +
    '<span class="card-name">' + escHtml(record[3]) + '</span>' +
    '<span class="card-code">' + escHtml(record[2]) + '</span>'
  card.appendChild(header)

  const body = document.createElement('div')
  body.className = 'card-body'

  body.appendChild(makeRow('省份', record[1]))
  if (record[9]) body.appendChild(makeRow('批次', record[9], 'badge'))
  body.appendChild(makeRow('选科', record[14], 'tag'))
  if (record[10]) body.appendChild(makeRow('性质', record[10]))
  if (record[5]) body.appendChild(makeRow('专业名称', record[5], 'full'))
  if (record[11]) body.appendChild(makeRow('专业组', record[11]))

  if (record[0] !== '2026') {
    body.appendChild(makeRow('最低分', String(record[6]), 'highlight'))
    body.appendChild(makeRow('最低排名', String(record[7]), 'highlight'))
    body.appendChild(makeRow('录取', record[8] + '人'))
  } else {
    body.appendChild(makeRow('计划录取', record[8] + '人', 'highlight'))
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

// Helper: remark toggle
function makeRemarkToggle(idx, isOpen) {
  const row = document.createElement('div')
  row.className = 'card-row card-remark-header'
  row.dataset.remarkIdx = idx
  row.innerHTML = '<span class="card-label">备注</span>' +
    '<span class="card-remark-toggle">' + (isOpen ? '收起▲' : '展开▼') + '</span>'
  row.addEventListener('click', function (e) {
    e.stopPropagation()
    toggleRemark(parseInt(this.dataset.remarkIdx))
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
    const label = diff.field === '专业组' ? '专业组变动' : diff.field + '差异'
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
  }
  state.year = year
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

function doReset() {
  state.year = ''
  state.selectedProvinces = []
  state.provinceLabel = '全部省份'
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
  state.filterHidden = false
  updateFilterUI()
  DOM.resultList.scrollTop = 0
  DOM.resultList.querySelector('#result-top').scrollIntoView()
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

  // Toggle switches
  updateToggleUI('toggle-only2026', state.only2026)
  updateToggleUI('toggle-hide-sports', state.hideSports)
  updateToggleUI('toggle-hide-coop', state.hideCoop)

  // Score/rank row visibility
  DOM.scoreRow.style.display = (state.year === '2026' || state.only2026) ? 'none' : 'flex'
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
      { title: '专业组', desc: '院校将招生专业按选科要求等条件划分为不同专业组。同一院校不同专业组的录取分数可能差异很大。' },
      { title: '2024年录取数据', desc: '2024年该专业录取的最低高考分数（600分）、最低全省排名（10000名）和实际录取人数（35人）。分数和排名越高录取难度越大，建议优先参考排名。' },
      { title: '2025年录取数据', desc: '2025年录取数据（580分，15000名，38人）。可与2024年对比观察分数和排名的涨跌趋势。' },
      { title: '2026年计划数据', desc: '2026年该专业的计划招生名额（40人）。实际录取人数可能会有微调。2026年为志愿填报参考数据，非最终录取结果。' },
      { title: '备注', desc: '该专业的特殊说明，包括外语要求、性别限制、身体条件、政治面貌要求等。点击可展开查看完整内容。' },
      { title: '年份差异对比', desc: '当同一院校+专业在不同年份间存在差异时，卡片底部会展示对比信息。例如专业组代码变动、收费标准调整等。' },
    ],
    demo: {
      n: '赣江大学（仅供示范）', c: '8888', p: '江西',
      batch: '本科', plan: '非定向',
      s: '物理+化学', g: '人工智能', gc: 'A01',
      _sd: '物理 化学',
      a: { s: 600, r: 10000, e: 35 },
      b: { s: 580, r: 15000, e: 38 },
      d: { e: 40 },
      remark: '本数据仅供示范用途，并非真实录取信息。',
      _newLabel: true,
      _diffs: [
        {
          field: '专业组',
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
      { title: '专业组', desc: '该专业的组代码，用于标识不同的专业组。' },
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
      { title: '选科要求', desc: '该专业对高考选考科目的要求。本示范为「物理+生物」，需同时选考这两科方可报考。' },
      { title: '性质', desc: '招生计划的性质。2026年计划数据中的性质分类与往年一致。' },
      { title: '专业名称', desc: '该专业组包含的专业名称。本示范为南昌大学「法学」专业。' },
      { title: '专业组', desc: '该专业的组代码。2026年法学专业组代码为502。' },
      { title: '计划录取', desc: '2026年该专业的计划招生名额（7人）。实际录取人数可能会有微调。' },
      { title: '收费标准', desc: '每学年的学费标准（4950元/年）。不同专业学费可能不同。' },
      { title: '备注', desc: '该专业的特殊说明，可点击展开查看完整内容。' },
    ],
    demo: {
      year: '2026', p: '江西', c: '8101', n: '南昌大学',
      sr: '物理+生物', g: '法学', gc: '502', batch: '本科',
      plan: '非定向',
      planCount: 7, fee: '4950',
      remark: '不招单色不能识别的考生。',
    },
  },
}

const MODE_CYCLE = ['merged', 'single2025', 'single2026']

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
    if (state.tutorialMode === 'single2026') {
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
      toggleEl.textContent = state.tutorialRemarkExpanded ? '收起▲' : '展开▼'
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
    if (state.tutorialMode === 'single2026') {
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
  } else {
    return renderTutorialSingle2026(demo, stepIdx)
  }
}

function renderTutorialMerged(d, stepIdx) {
  return '<div class="demo-card">' +
    '<div class="card-header' + (stepIdx === 0 || stepIdx === 1 ? ' row-current' : '') + '" id="hl-0">' +
      '<span class="card-name">' + escHtml(d.n) + '</span>' +
      '<span class="card-code">' + escHtml(d.c) + '</span>' +
      (d._newLabel ? '<span class="tag-new">新</span>' : '') +
    '</div>' +
    '<div class="card-body">' +
      '<div class="card-row' + (stepIdx === 2 ? ' row-current' : '') + '" id="hl-2"><span class="card-label">省份</span><span class="card-value">' + escHtml(d.p) + '</span></div>' +
      '<div class="card-row' + (stepIdx === 3 ? ' row-current' : '') + '" id="hl-3"><span class="card-label">批次</span><span class="card-value badge">' + escHtml(d.batch) + '</span></div>' +
      '<div class="card-row' + (stepIdx === 4 ? ' row-current' : '') + '" id="hl-4"><span class="card-label">选科</span><span class="card-value tag">' + escHtml(d._sd) + '</span></div>' +
      '<div class="card-row' + (stepIdx === 5 ? ' row-current' : '') + '" id="hl-5"><span class="card-label">性质</span><span class="card-value">' + escHtml(d.plan) + '</span></div>' +
      '<div class="card-row' + (stepIdx === 6 ? ' row-current' : '') + '" id="hl-6"><span class="card-label">专业名称</span><span class="card-value full">' + escHtml(d.g) + '</span></div>' +
      '<div class="card-row' + (stepIdx === 7 ? ' row-current' : '') + '" id="hl-7"><span class="card-label">专业组</span><span class="card-value">' + escHtml(d.gc) + '</span></div>' +
      (d.a ? '<div class="card-row row-highlight' + (stepIdx === 8 ? ' row-current' : '') + '" id="hl-8"><span class="gp-label">2024</span><span class="card-value highlight">' + d.a.s + '分</span><span class="card-value highlight">最低排名 ' + d.a.r + '</span><span class="card-value">录取' + d.a.e + '人</span></div>' : '') +
      (d.b ? '<div class="card-row row-highlight' + (stepIdx === 9 ? ' row-current' : '') + '" id="hl-9"><span class="gp-label">2025</span><span class="card-value highlight">' + d.b.s + '分</span><span class="card-value highlight">最低排名 ' + d.b.r + '</span><span class="card-value">录取' + d.b.e + '人</span></div>' : '') +
      (d.d ? '<div class="card-row gp-year' + (stepIdx === 10 ? ' row-current' : '') + '" id="hl-10"><span class="gp-label">2026</span><span class="card-value">计划录取' + d.d.e + '人</span></div>' : '') +
      (d.remark ? '<div class="card-row card-remark-header ' + (stepIdx === 11 ? ' row-current' : '') + '" id="hl-11" onclick="toggleDemoRemark()"><span class="card-label">备注</span><span class="card-remark-toggle">' + (state.tutorialRemarkExpanded ? '收起▲' : '展开▼') + '</span></div>' : '') +
      (state.tutorialRemarkExpanded && d.remark ? '<div class="card-row card-remark-body' + (stepIdx === 11 ? ' row-current' : '') + '"><span class="card-value full">' + escHtml(d.remark) + '</span></div>' : '') +
      (d._diffs ? '<div class="diff-section' + (stepIdx === 12 ? ' row-current' : '') + '" id="hl-12">' + renderTutorialDiffs(d._diffs) + '</div>' : '') +
    '</div></div>'
}

function renderTutorialSingle2025(d, stepIdx) {
  return '<div class="demo-card">' +
    '<div class="card-header' + (stepIdx === 0 ? ' row-current' : '') + '" id="hl-0">' +
      '<span class="card-year">' + escHtml(d.year) + '</span>' +
      '<span class="card-name">' + escHtml(d.n) + '</span>' +
      '<span class="card-code">' + escHtml(d.c) + '</span>' +
    '</div>' +
    '<div class="card-body">' +
      '<div class="card-row' + (stepIdx === 1 ? ' row-current' : '') + '" id="hl-1"><span class="card-label">省市</span><span class="card-value">' + escHtml(d.p) + '</span></div>' +
      '<div class="card-row' + (stepIdx === 2 ? ' row-current' : '') + '" id="hl-2"><span class="card-label">批次</span><span class="card-value badge">' + escHtml(d.batch) + '</span></div>' +
      '<div class="card-row' + (stepIdx === 3 ? ' row-current' : '') + '" id="hl-3"><span class="card-label">选科</span><span class="card-value tag">' + escHtml(d.sr) + '</span></div>' +
      '<div class="card-row' + (stepIdx === 4 ? ' row-current' : '') + '" id="hl-4"><span class="card-label">性质</span><span class="card-value">' + escHtml(d.plan) + '</span></div>' +
      '<div class="card-row' + (stepIdx === 5 ? ' row-current' : '') + '" id="hl-5"><span class="card-label">专业名称</span><span class="card-value full">' + escHtml(d.g) + '</span></div>' +
      '<div class="card-row' + (stepIdx === 6 ? ' row-current' : '') + '" id="hl-6"><span class="card-label">专业组</span><span class="card-value">' + escHtml(d.gc) + '</span></div>' +
      '<div class="card-row row-highlight' + ((stepIdx === 7 || stepIdx === 8) ? ' row-current' : '') + '" id="hl-7"><span class="card-label">最低分</span><span class="card-value highlight">' + d.score + '</span><span class="card-label">最低排名</span><span class="card-value highlight">' + d.rank + '</span></div>' +
      '<div class="card-row' + (stepIdx === 9 ? ' row-current' : '') + '" id="hl-9"><span class="card-label">录取</span><span class="card-value">' + d.enrolled + '人</span></div>' +
      '<div class="card-row' + (stepIdx === 10 ? ' row-current' : '') + '" id="hl-10"><span class="card-label">收费标准</span><span class="card-value">' + d.fee + '元/年</span></div>' +
      (d.remark ? '<div class="card-row card-remark-header ' + (stepIdx === 11 ? ' row-current' : '') + '" id="hl-11" onclick="toggleDemoRemark()"><span class="card-label">备注</span><span class="card-remark-toggle">' + (state.tutorialRemarkExpanded ? '收起▲' : '展开▼') + '</span></div>' : '') +
      (state.tutorialRemarkExpanded && d.remark ? '<div class="card-row card-remark-body' + (stepIdx === 11 ? ' row-current' : '') + '"><span class="card-value full">' + escHtml(d.remark) + '</span></div>' : '') +
    '</div></div>'
}

function renderTutorialSingle2026(d, stepIdx) {
  return '<div class="demo-card">' +
    '<div class="card-header' + (stepIdx === 0 ? ' row-current' : '') + '" id="hl-0">' +
      '<span class="card-year">' + escHtml(d.year) + '</span>' +
      '<span class="card-name">' + escHtml(d.n) + '</span>' +
      '<span class="card-code">' + escHtml(d.c) + '</span>' +
    '</div>' +
    '<div class="card-body">' +
      '<div class="card-row' + (stepIdx === 1 ? ' row-current' : '') + '" id="hl-1"><span class="card-label">省市</span><span class="card-value">' + escHtml(d.p) + '</span></div>' +
      '<div class="card-row' + (stepIdx === 2 ? ' row-current' : '') + '" id="hl-2"><span class="card-label">批次</span><span class="card-value badge">' + escHtml(d.batch) + '</span></div>' +
      '<div class="card-row' + (stepIdx === 3 ? ' row-current' : '') + '" id="hl-3"><span class="card-label">选科</span><span class="card-value tag">' + escHtml(d.sr) + '</span></div>' +
      '<div class="card-row' + (stepIdx === 4 ? ' row-current' : '') + '" id="hl-4"><span class="card-label">性质</span><span class="card-value">' + escHtml(d.plan) + '</span></div>' +
      '<div class="card-row' + (stepIdx === 5 ? ' row-current' : '') + '" id="hl-5"><span class="card-label">专业名称</span><span class="card-value full">' + escHtml(d.g) + '</span></div>' +
      '<div class="card-row' + (stepIdx === 6 ? ' row-current' : '') + '" id="hl-6"><span class="card-label">专业组</span><span class="card-value">' + escHtml(d.gc) + '</span></div>' +
      '<div class="card-row' + (stepIdx === 7 ? ' row-current' : '') + '" id="hl-7"><span class="card-label">计划录取</span><span class="card-value highlight">' + d.planCount + '人</span></div>' +
      '<div class="card-row' + (stepIdx === 8 ? ' row-current' : '') + '" id="hl-8"><span class="card-label">收费标准</span><span class="card-value">' + d.fee + '元/年</span></div>' +
      (d.remark ? '<div class="card-row card-remark-header ' + (stepIdx === 9 ? ' row-current' : '') + '" id="hl-9" onclick="toggleDemoRemark()"><span class="card-label">备注</span><span class="card-remark-toggle">' + (state.tutorialRemarkExpanded ? '收起▲' : '展开▼') + '</span></div>' : '') +
      (state.tutorialRemarkExpanded && d.remark ? '<div class="card-row card-remark-body' + (stepIdx === 9 ? ' row-current' : '') + '"><span class="card-value full">' + escHtml(d.remark) + '</span></div>' : '') +
    '</div></div>'
}

function renderTutorialDiffs(diffs) {
  let html = ''
  for (const diff of diffs) {
    const label = diff.field === '专业组' ? '专业组变动' : diff.field + '差异'
    html += '<div class="diff-group"><span class="diff-field">' + label + '</span>'
    for (const entry of diff.entries) {
      html += '<div class="diff-entry"><span class="diff-years">' + escHtml(entry.years) + '</span><span class="diff-arrow">→</span><span class="diff-val">' + escHtml(entry.value) + '</span></div>'
    }
    html += '</div>'
  }
  return html
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

    // Help
    btnHelp: document.getElementById('btn-help'),
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

  // Toggle switches
  document.getElementById('toggle-only2026').addEventListener('click', onToggleOnly2026)
  document.getElementById('toggle-hide-sports').addEventListener('click', onToggleHideSports)
  document.getElementById('toggle-hide-coop').addEventListener('click', onToggleHideCoop)

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

  // Help button
  DOM.btnHelp.addEventListener('click', function () {
    openTutorial(true)
  })

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
}

// ============================================================
// 启动
// ============================================================
function init() {
  updateProgress(10, '正在加载数据文件...')

  // 延迟执行确保 DOM 已渲染
  setTimeout(() => {
    initDOM()
    bindEvents()

    updateProgress(20, '加载完成，正在初始化界面...')

    // 展开数据（分块异步，带进度）
    setTimeout(() => {
      expandAllData(function (success) {
        if (!success) {
          updateProgress(100, '数据加载失败，请刷新页面重试')
          return
        }

        updateProgress(75, '正在构建查询缓存...')

        setTimeout(() => {
          buildMergedCache()

          updateProgress(82, '正在优化搜索结果排序...')

          setTimeout(() => {
            updateProgress(90, '准备就绪...')

            // 切换到主页面
            setTimeout(() => {
              DOM.pageLoading.style.display = 'none'
              DOM.pageIndex.style.display = 'flex'

              state.loaded = true

              // 首访引导
              let tutorialDone = false
              try { tutorialDone = localStorage.getItem('tutorial_done') } catch (e) {}
              if (!tutorialDone) {
                openTutorial(false)
              }

              // 初始搜索
              doSearch()
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
