# 小鸟过管道 - 微信小游戏（交接文档）

> 本文档专为接手此项目的 AI/开发者编写。请先完整阅读 `js/main.js`（约 1339 行，全部游戏逻辑）再动手改代码。

## 一、项目信息

| 项 | 值 |
|---|---|
| 项目路径 | `C:\Users\XUEWENQI\WeChatProjects\minigame-1\` |
| 游戏类型 | 微信小游戏（Canvas 2D，非小程序的 wxml 结构） |
| AppID | `wx438c571c2ea52100`（project.config.json） |
| 入口 | `game.js` → `import Main from './js/main'` |
| 主逻辑 | `js/main.js`（1339 行，单文件全部逻辑） |
| 排行榜 | `openDataContext/index.js`（142 行，开放数据域） |
| 徽章图片 | `images/9b647e46292f815019884c03df3d97cb.png` |
| 开发工具 | 微信开发者工具（stable），模拟器 + 真机预览调试 |
| 已上架 | 微信小程序平台（已通过审核） |

**操作方式**：微信开发者工具打开项目目录 → 编译运行。改完代码点「编译」即可生效。

## 二、架构总览

### 画布与缩放
- `wx.createCanvas()` 创建主画布，设计分辨率 400×600，letterbox 居中
- DPR 处理：`dpr = Math.min(pixelRatio, 2)`（上限 2x 保证手机流畅），画布物理尺寸 = 屏幕 × dpr，渲染时 `ctx.scale(dpr)` 包住整个画面
- `render()` 里有两层 save/restore：外层 DPR，内层设计坐标变换

### 屏幕状态机
```
menu → birds → birdDetail → playing → (pause/countdown)
     → achievements → badgeDetail
     → shop
     → badgeEarned → gameover → menu
```
`screen` 变量控制，`render()` 末尾按 screen 分发绘制函数。

### 触摸
- `wx.onTouchStart` 单事件处理所有屏幕的按钮检测（坐标多路径兼容 touches[0]/changedTouches[0]/e）
- 排行榜模式下另有 `wx.onTouchMove/onTouchEnd` 处理滑动滚动

## 三、游戏系统（当前实现）

### 1. 三只小鸟与稀有度
| 鸟 | 稀有度 | 颜色 | 开局命 | 特性 |
|---|---|---|---|---|
| 小黄 | 普通 | 绿 #4CAF50 | 3 | 均衡 |
| 小红 | 稀有 | 蓝 #2196F3 | 1 | 首次10分+1命，之后每15分+1命 |
| 小粉 | 史诗 | 紫 #9C27B0 | 2 | 绿管变金管，金管+4分，金管同时积累绿计数 |

稀有度五档：普通绿/稀有蓝/史诗紫/传说橙/神话红（`rColors`/`rNames`）。
小鸟选择界面：白卡 + 稀有度色边框（选中 6px 否则 4px）+ 底部色条显示「稀有度 · ★」。

### 2. 升星系统
- `birdStars = [1,1,1]`（每只鸟星级），存储键 `fbStars`
- 费用表 `starCosts = [[1,2],[2,5],[3,10]]`，`starCosts[鸟][当前星-1]` 为升星费用
- 升星按钮在小鸟详情页，点击扣币（`totalScore -= 费用*100`）升星，播放 `sfxUp`

| 鸟 | 2星效果（费用） | 3星效果（费用） |
|---|---|---|
| 小黄 | +2命，共5命（1币） | 连击需8管（10管→8管）（2币） |
| 小红 | +1命，共2命（2币） | 每次吸血+1.5（半心）（5币） |
| 小粉 | +1命，共3命（3币） | 50%闪避管道，闪避成功移除当前管道，无无敌（10币） |

### 3. 半心系统
- `lives` 是浮点数，支持 `.5` 值
- HUD 画心：整心全红，半心右半部 45% 黑遮罩
- 每行最多 12 个心，超出换第二行（y 偏移 24），分数 y 位置随之动态调整（63 或 71）
- 管道伤害固定 -1（`lives--`），`lives > 1` 判定存活
- 小红 3 星吸血 1.5 时弹窗显示 `+1.5❤`

### 4. 金币系统
- `totalScore` 累计总分（跨局持久化），`coins = floor(totalScore / 100)`
- 每累计 100 分 = 1 金币，**局内实时检测**：`baseScore`（开局前总分）+ 当前分跨过 100 阈值立刻 +1 币并弹 `+🪙`
- 显示：菜单右上角、HUD 右上角（DESIGN_W-10, y=68）
- 存储键 `fbTotal`

### 5. 管道与连击
- 5 种管道（概率权重）：绿42/红18(加速)/蓝18(浮动)/紫12(窄间隙)/金10(+3分)
- 连击：同色管道累计达标触发，**全类型 do-while 链式检测**（不是只查当前管道类型！），余数保留（`-= req` 而非 `= 0`）
- 达标数 `reqC`：小黄3星=8，其他=10
- 效果：绿=其他计数+2，红=+1命，蓝=难度-1，紫=下5管间隙翻倍，金=下5管得分翻倍
- 连击文字上下错开：`py = birdY - 30 + cc * 22`（cc 为本次触发计数）
- 小粉金管同时加绿计数（`if (selectedBird===2 && p.type===4) pipeCounts[0]++`）
- 进度条 HUD 显示 `N/8` 或 `N/10`（按 reqC）

### 6. 成就/徽章系统
- 目前只有一个成就：`初出茅庐` = 单局达到100分，**判定用 `score`（本局分数）不是 `best`（历史最高）**
- 徽章图片：`images/9b647e46292f815019884c03df3d97cb.png`（用户提供的模板，可美化）
- 成就界面：2列×N行卡片网格（和商店同布局），已获得亮白+金边，未获得半透明
- 点击卡片进入 `badgeDetail` 详情页（大徽章+条件+状态）
- 新徽章获得：死亡时先弹 `badgeEarned` 面板（`newBadges` 数组支持多个依次弹出，点一下切下一个，全看完才进 gameover）
- 存储键 `fbAch`（`achDone` 对象）

### 7. 商店
- 菜单第4个按钮（橙），商品卡片列表
- **火箭背包**（10币）：购买后可在商店「穿戴/脱下」，穿戴后小鸟背上出现小火箭模型（局内 `drawBird`、菜单预览、详情页均显示）
- 局中右下角圆形 🚀 按钮（圆心 360,505 半径26）：点击冲刺 1.2 秒（管道/地面 2.2 倍速），期间无敌可撞碎管道，撞顶/撞底不死；CD 30 秒（HUD 显示剩余秒数）
- 存储键 `fbShop`（JSON `{"rocket":{"owned":false,"equipped":false}}`）
- 金币不足时卡片下方红字提示「金币不足!」（`shopMsg`/`shopMsgT`，非游戏屏在 upd 中计时）

### 8. 排行榜（已上架可用）
- 开放数据域 `openDataContext/index.js`
- 点击奖杯 → `postMessage({type:'updateRank', best})` → 开放数据域拉取
- 数据源优先 `wx.getRankManager`，降级 `wx.getFriendCloudStorage`，再失败显示空列表
- 可滑动（主域 touchmove 转发 scrollY，`postMessage({type:'scroll'})`），无 9 人上限
- 返回按钮左上角（与各界面一致），不再一碰就关
- 分数上传：死亡时 `wx.setUserCloudStorage({key:'bestScore'})`

### 9. 其他功能
- **暂停**：HUD 右上角 ∥ 按钮；暂停中任意触摸启动 3 秒倒计时（大字 3→2→1）后恢复；`paused`+`resumeCountdown`+`cdTimer`
- **静音**：五个界面都有 🔊/🔇 按钮，存储键 `fbMuted`
- **音效**：WebAudioContext + OscillatorNode 合成，`ia()` 延迟创建（首次开始游戏时）
- **DPR**：上限 2x（`Math.min(pixelRatio, 2)`）

## 四、音效参数表（重要！用户调了很久）

所有音效统一 **triangle 波形**（square/sawtooth 在手机上音色失真，用户明确要求全三角波），`beep(f, ty, d, v, rd)`：

| 函数 | 频率 | 时长 | 音量 | rd(衰减) |
|---|---|---|---|---|
| sfxJ 跳跃 | 900Hz | 0.06 | 0.2 | 1 |
| sfxS 得分 | 880→1100Hz 双音 | 0.1 | 0.15 | 0 |
| sfxB 奖励 | 660→880→1320Hz 三连 | 0.08 | 0.1~0.2 | 0 |
| sfxH 死亡 | 180Hz | 0.3 | 0.25 | 1 |
| sfxHit 碰撞 | 250Hz | 0.18 | 0.22 | 1 |
| sfxAch 徽章 | 523→659→784→1047Hz 上行 | 0.15 | 0.15~0.3 | 0 |
| sfxDodge 闪避 | 1200→400Hz 下扫 | 0.04 | 0.06 | 1 |
| sfxUp 升星 | 880→1100→1320→1760Hz 上行 | 0.12 | 0.12~0.25 | 0 |
| sfxRocket 冲刺 | 300→600→1200Hz 上扫 | 0.1~0.16 | 0.18~0.22 | 1 |

**改音效必读**：
1. 不要改回 square/sawtooth 波形
2. 频率不要低于 150Hz（手机扬声器放不出低频）
3. `if (muted) return;` 保留在每个 sfx 开头
4. `ia()` 延迟创建，别改成启动即创建（曾导致问题）

## 五、存储键汇总

| 键 | 内容 | 类型 |
|---|---|---|
| `fbBest` | 历史最高分 | int |
| `fbTotal` | 累计总分（金币来源） | int |
| `fbStars` | 三鸟星级 [1,1,1] | JSON |
| `fbAch` | 成就完成表 {} | JSON |
| `fbMuted` | 静音开关 | JSON bool |
| `fbShop` | 商店已购/穿戴 {"rocket":{owned,equipped}} | JSON |

**注意**：数据持久化是「加载」，不是「每次启动重置」——不要加 `wx.setStorageSync('xxx', 默认值)` 覆盖用户数据（曾因此被骂）。

## 六、界面布局速查（设计坐标 400×600）

- 菜单按钮：开始 y=195 / 小鸟 y=249 / 成就 y=303 / 商店 y=357（高44，间隔10）
- HUD：心 y=14 / 分数 y=63（行2时71）/ 最高分右上 y=50 / 金币右上 y=68 / 等级 y=78 / 管道进度条 y=95 起 / 静音+暂停右上 y=8-36 / 火箭技能按钮右下角 (360,505) 半径26
- 成就卡片：2列，x=25/205，宽170，高104；商店商品卡片：x=30 宽340 高140（按钮 110,206,180x34）
- 各二级界面返回按钮：左上角 (20,20,60,35)
- 小鸟选择：3列 x=25/145/265，卡片 110×195

## 七、修改规则（严格遵守）

1. **禁止全局替换**（replace_all），数字常量尤其危险——曾因 20→15 全局替换导致十几处误改（SPAWN、btnY 等）
2. 替换前用 Grep 确认唯一性
3. 数字常量必须带完整上下文修改
4. 每改完一个功能自查一遍相关逻辑（用户会直接指出 bug，一次做对很重要）
5. 用户要求：全自动操作、不问多余问题、只改要求的、交流用中文
6. 数据类改动注意持久化加载而非重置

## 八、平台变体

| 平台 | 路径 | 说明 |
|---|---|---|
| 微信小游戏（主） | `C:\Users\XUEWENQI\WeChatProjects\minigame-1\` | 本文档覆盖 |
| Android APK | `G:\vs code projets\game\flappy-bird-mobile\` | Capacitor 打包，`www/index.html` 独立 Web 版（无微信API、无排行榜），构建见该目录旧 CLAUDE.md |
| 原始 Python | `G:\vs code projets\game\flappy bird.py` | 原型 |

如需同步新功能到 APK 版：改 `www/index.html`（用 `var` 风格），然后 `npx cap sync android && cd android && ./gradlew assembleDebug`（JAVA_HOME=`C:/Users/XUEWENQI/jdk-21.0.2`，ANDROID_HOME=`C:/Users/XUEWENQI/Android/Sdk`），产物复制到桌面。

## 九、待办/可能的方向

1. 更多商店商品（火箭背包已完成：购买/穿戴/局中技能/CD）
2. 徽章图片美化（用户提供的是模板图）
3. 更多徽章（用户会陆续发图）
4. 传说/神话稀有度暂无对应鸟
5. 排行榜头像异步加载有内存泄漏隐患（img.onload 闭包持有 y 变量，滚动后错位）

## 十、用户偏好

- 交流全部用中文
- 改游戏只改要求的部分，不扩大范围
- 用户会先让你做界面，再逐步给玩法细节——每步做扎实
