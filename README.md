# 高考录取数据查询 - 网页版

江西省 2024-2026 年高考录取数据查询工具，支持院校、专业、分数、排名等多维度筛选。

免责声明：所有的有关于志愿推荐部分内容均由算法根据往年数据推荐，本人（本项目组）不为任何盲目相信志愿填报助手导致的后果负责

> [📋 查看更新日志 →](https://shirakawa-kotone.github.io/miniprogram-web/changelog/)

---

## 项目结构

```text
web/
├── index.html                    # 单页应用入口（所有 UI 结构）
├── style.css                     # 移动端优先样式 + 深色模式
├── app.js                        # 核心应用逻辑（~1575 行）
├── alldata.js                    # 压缩数据文件（~4.7MB，gzip 后 ~1MB）
├── docs/
│   ├── query.js                  # 通用 Node.js 查询脚本（供 AI 助手调用）
│   └── QUERY_GUIDE.md            # AI 助手通用使用指南
├── skills/
│   └── zhiyuan-helper/
│       ├── SKILL.md              # Claude Code skill 定义
│       ├── query.js              # skill 内置查询脚本（独立数据包）
│       └── schools.json          # skill 内置数据（2258 院校 × 3.7 万专业组）
├── CHANGELOG.md                  # 更新日志
├── changelog/
│   └── index.html                # 更新日志渲染页面
└── README.md                     # 本文件
```

## 功能特性

- **年份切换**：「全部」「2024」「2025」「2026」四种模式
  - 「全部」模式合并同院校+专业组，跨年对比
- **多维度筛选**：省份（多选弹窗）、院校名称/代号、选科要求、批次、专业组名称/代码、最低分/最低排名
- **开关筛选**：仅显示 2026 招生、隐藏体育专业、隐藏中外合作办学
- **结果排序**：有分数条件时升序，否则降序
- **前 N 条**：默认显示前 30 条结果，上拉可查看更多
- **年份差异对比**：自动检测专业组、批次、性质、收费标准的跨年变化
- **备注折叠**：使用原生 `details/summary`，点击展开/收起备注信息
- **首访引导**：第一次使用时自动弹出交互式使用指南，高亮对应行
- **深色模式**：跟随系统或手动切换，无闪烁加载
- **回到顶部**：滚动页面后出现浮动按钮

## 数据说明

数据来自江西省 2024-2026 年高考录取/志愿填报数据，经处理合并为字符串池压缩格式以提高加载效率。

- 总记录数：74,163 条（2024 年: 22,472 / 2025 年: 24,712 / 2026 年: 26,979）
- 数据文件：`alldata.js`（~4.7MB，gzip 后约 1MB），客户端异步展开
- 2024-2025 年为实际录取数据，2026 年为志愿分组参考数据

## 技术栈

纯前端实现，零构建、零依赖：

- **HTML5 + CSS3** — 移动端优先，Flexbox 自适应布局，860px 断点双栏
- **Vanilla JavaScript** — 无框架、无构建工具、无包管理器
- **GitHub Pages** — 部署在静态托管上运行

## 本地开发与部署

项目无需安装任何依赖，仅需一个静态 HTTP 服务器即可预览。

### 方式一：Python（推荐）

```bash
# 进入项目目录
cd /Users/chen/dev/web

# 启动本地服务器
python3 -m http.server 5500
```

然后访问 [http://localhost:5500](http://localhost:5500)

### 方式二：Node.js

```bash
# 全局安装 serve（仅首次）
npx serve .

# 或使用 npm（如果已安装）
npx serve . -p 5500
```

然后访问 `http://localhost:3000`（`serve` 默认端口）或 `http://localhost:5500`。

### 方式三：部署到 GitHub Pages

1. 将代码推送到 GitHub 仓库的 `main` 分支
2. 仓库 Settings → **Pages** → Source: **Deploy from branch**, 选择 `main` 分支，目录 `/ (root)`
3. 等待 GitHub Actions 完成部署，访问 `https://<用户名>.github.io/<仓库名>/`

---

## 查询脚本（通用）

`docs/query.js` 是标准的 Node.js CLI 工具，不限 AI 助手类型（Claude Code、OpenAI Codex CLI、Gemini CLI、Cursor 等均可使用）。

```bash
# 查看所有参数
node docs/query.js --help

# 按分数/选科/省份/专业查询
node docs/query.js --score 620 --sr 物化生 --province 广东 --keyword 计算机

# 按排名查询
node docs/query.js --rank 8000 --province 北京 --province 上海

# 仅查看 2025 年数据
node docs/query.js --score 620 --year 2025

# 估算排名（只知道分数时）
node docs/query.js --estimate-rank --score 650 --year 2025
```

查询结果以 JSON 格式输出，按「院校 → 专业组」组织，含历年录取分数、排名、计划数：

```json
{
  "total": 136,
  "records": [{
    "school": "华南理工大学",
    "code": "1662",
    "province": "广东",
    "nature": "非定向",
    "groups": [{
      "name": "计算机类",
      "code": "0809",
      "sr": "04+05",
      "srDisplay": "物理 化学",
      "batch": "本科",
      "fee": 6850,
      "history": {
        "2024": { "score": 637, "rank": 2164, "count": 5 },
        "2025": { "score": 628, "rank": 2518, "count": 6 }
      }
    }]
  }]
}
```

> 详细 AI 助手指南：`docs/QUERY_GUIDE.md`

---

## AI Skills

### 免责声明

1. 本项目的志愿填报建议基于 AI 模型生成，可能存在数据遗漏、分析偏差或信息滞后，不构成任何形式的报考承诺或保证。
2. 用户因参考本项目建议而导致的志愿填报失误、录取结果不满意或任何直接、间接损失，本项目概不负责。
3. 最终填报决策应以江西省教育考试院官方发布的数据、院校招生章程及当年志愿填报系统为准。
4. 使用本项目即视为用户已充分理解并同意上述条款，一切填报行为由用户本人自主决定并承担后果。

### zhiyuan-helper（Claude Code 插件）

这个 Skill 就像是 Claude Code 的一个「高考数据插件」。装上之后，你不用手敲命令，直接跟 Claude 说人话就能查数据。

#### 安装方法（二选一）

##### 方法一：从 GitHub 安装（最简单，推荐小白用）

打开终端（Mac 上叫「终端」或「Terminal」），复制粘贴下面这一行，按回车：

```bash
npx skills install https://github.com/Shirakawa-Kotone/miniprogram-web.git
```

> 这是什么意思？`npx skills install` 是 Claude Code 的安装命令，后面跟的是本项目的 GitHub 仓库地址。它会自动从网上下载 skill 并装好。

##### 方法二：如果你已经下载了这个项目（本地安装）

```bash
# 创建软链接（相当于在桌面放个快捷方式，数据会随着项目更新自动同步）
ln -sf $(pwd)/skills/zhiyuan-helper ~/.claude/skills/zhiyuan-helper

# 或者直接复制过去（装好后就不依赖这个文件夹了）
cp -r skills/zhiyuan-helper ~/.claude/skills/zhiyuan-helper
```

#### 装好之后怎么用？

打开 Claude Code，直接用大白话说就行：

> 🙋 **你问：** "620分 物化生 想去广东学计算机"
>
> 🤖 **Claude 会：** 自动查数据 → 按「冲/稳/保」三档给你推荐学校
>
> ---
>
> 🙋 **你问：** "南昌大学2025年录取线多少"
>
> 🤖 **Claude 会：** 查出南昌大学各专业组的录取分数和排名
>
> ---
>
> 🙋 **你问：** "帮我推荐冲稳保志愿方案"
>
> 🤖 **Claude 会：** 先问你的分数/排名、选科、想去哪、想学啥，然后给你排方案

#### 这个插件内部做了什么？

1. **问情况** → 问你的分数/排名、选考科目（物化生？物化？）、想去的省份、想学的专业
2. **查数据** → 按照你给的条件，从数据库中筛选匹配的学校和专业
3. **扩展搜索** → 如果结果太少（比如你说"学计算机"，会自动帮你搜软件、信息、智能等相关专业）
4. **分档推荐** → 按你的分数，分成「冲一冲」「稳一稳」「保一保」三档
5. **整理成表格** → 最后给你一份清晰明了的志愿推荐表

想了解更详细的规则，看 `skills/zhiyuan-helper/SKILL.md`。

### 其他 AI 助手（通用查询脚本）

如果用的是 OpenAI Codex CLI、Gemini CLI、Cursor 等其他 AI 工具，不支持 Claude 插件：

```bash
# 在项目文件夹里，直接运行这个查询脚本
node docs/query.js --score 620 --sr 物化生 --province 广东 --keyword 计算机
```

详细用法看 `docs/QUERY_GUIDE.md`。

---

## 参数说明（URL 查询参数）

| 参数 | 说明 | 示例 |
| ------ | ------ | ------ |
| `province` | 省份（可多选） | `province=广东&province=浙江` |
| `batch` | 批次（可多选） | `batch=本科` |
| `code` | 院校代号 | `code=1662` |
| `name` | 院校名称（模糊） | `name=南昌大学` |
| `major` | 专业组名称（模糊） | `major=计算机` |
| `groupCode` | 专业组代码 | `groupCode=0809` |
| `subject` | 选科代码 | `subject=04*05` |
| `minScore` | 最低分 | `minScore=600` |
| `maxRank` | 最高排名 | `maxRank=5000` |
| `only2026` | 仅显示 2026 招生 | `only2026=1` |
| `hideSports` | 隐藏体育专业 | `hideSports=1` |
| `hideCoop` | 隐藏中外合作 | `hideCoop=1` |
| `line` | 显示前N条 | `line=50` |
