# 高考录取数据查询工具

> 面向 AI 编码助手的通用使用说明。  
> 适用于任何支持执行 Bash 命令的 AI 编程助手（Claude Code、OpenAI Codex CLI、Gemini CLI、Cursor 等）。

## 快速开始

项目根目录下执行：

```bash
# 查看所有参数
node skills/zhiyuan-helper/query.js --help

# 按分数查询（自动匹配 ±10 分）
node skills/zhiyuan-helper/query.js --score 620 --sr 物化生 --province 广东 --keyword 计算机

# 按排名查询（自动匹配 ±30%）
node skills/zhiyuan-helper/query.js --rank 8000 --province 北京 --batch 本科

# 控制返回条数（默认 50）
node skills/zhiyuan-helper/query.js --score 620 --limit 50

# 估算排名（只知道分数时）
node skills/zhiyuan-helper/query.js --estimate-rank --score 650 --year 2025 --sr 物化生
```

如果 skill 安装到了 Claude Code 目录：

```bash
node ~/.claude/skills/zhiyuan-helper/query.js --score 620 --sr 物化生 --province 广东
```

## 数据文件

数据在 `skills/zhiyuan-helper/schools.json`（2258 所院校 × 3.7 万专业组），由 `docs/build-data.js` 从 `alldata.js` 生成。

如需更新数据：

```bash
node docs/build-data.js
```

## 数据格式

`query.js` 的输出是 JSON，按「院校 → 专业组」组织，`records[].code` 为**院校代号**，`records[].groups[].code` 为**专业组代号**：

```json
{
  "total": 136,
  "records": [{
    "school": "华南理工大学",
    "code": "1662",         // 院校代号
    "province": "广东",
    "nature": "非定向",
    "groups": [{
      "name": "计算机类",     // 专业组名称
      "code": "0809",        // 专业组代号
      "majorCode": "AB",     // 专业代号（部分有）
      "sr": "04*05",
      "srDisplay": "物理 化学",
      "batch": "本科",
      "fee": 6850,
      "remark": "",
      "history": {
        "2024": { "score": 637, "rank": 2164, "count": 5 },
        "2025": { "score": 628, "rank": 2518, "count": 6 }
      }
    }]
  }]
}
```

## 冲稳保推荐逻辑

AI 助手拿到查询结果后，按以下规则给考生分档：

### 有排名时

```text
取专业组 2024/2025 最低排名中最优值:
  bestRank = min(h2024.rank, h2025.rank)

分档:
  冲: bestRank < 考生排名 × 0.92
  稳: 考生排名 × 0.92 ≤ bestRank ≤ 考生排名 × 1.08
  保: bestRank > 考生排名 × 1.08
```

### 只有分数时

```text
取专业组 2024/2025 最低分中的最高值:
  bestScore = max(h2024.score, h2025.score)

分档:
  冲: bestScore > 考生分数 + 5
  稳: 考生分数 - 5 ≤ bestScore ≤ 考生分数 + 5
  保: bestScore < 考生分数 - 5
```

### 选科宽松匹配

```text
考生的选科集合 ⊇ 学校要求的选科集合 即匹配
例: "物化生" → 匹配 物理/物化/物生/物化生/不限
```

### 专业语义搜索

当用户意向宽泛时，AI 助手自行将意图拆解为多个关键词逐一查询后去重：

| 用户说 | 扩展关键词 |
| -------- | ----------- |
| "人工智能" | 人工智能、计算机、智能、数据 |
| "学医" | 临床医学、口腔医学、医学、药学 |
| "当老师" | 师范、教育、数学与应用数学 |
| "计算机" | 计算机、软件、网络、信息、智能 |
