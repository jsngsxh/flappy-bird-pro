# 小鸟过管道 - 项目文档

## 项目位置

- **微信小游戏**: `C:\Users\XUEWENQI\WeChatProjects\minigame-1\`
- **APK源码**: `G:\vs code projets\game\flappy-bird-mobile\`
- **原始Python版**: `G:\vs code projets\game\flappy bird.py`

## 项目结构（微信小游戏）

```
minigame-1/
├── game.js              # 主入口，import Main + new Main()
├── game.json            # 竖屏 + openDataContext配置
├── js/
│   └── main.js          # 全部游戏逻辑（~700行）
├── openDataContext/
│   └── index.js         # 好友排行榜渲染
├── project.config.json  # AppID: wx438c571c2ea52100, compileType: game
└── project.private.config.json
```

## 游戏架构

### Canvas渲染
- `wx.createCanvas()` 在 js/main.js 顶部创建主画布
- 设计分辨率 400×600，letterbox 居中缩放
- `ctx.save/translate(offsetX,offsetY)/scale(scale,scale)/restore`

### 屏幕状态机
`sreen` 变量：`menu` → `birds` → `birdDetail` → `playing` → `gameover`

### 三只小鸟
| 索引 | 名字 | 颜色(身体/翅膀) | 命数 | 特征 |
|------|------|-----------------|------|------|
| 0 | 小黄 | #FFD700/#FFA500 | 3 | 受击耗命炸管道 |
| 1 | 小红 | #FF5252/#D32F2F | 1 | 首次10分+1命，之后每15分+1命 |
| 2 | 小粉 | #FF80AB/#E91E63 | 2 | 绿管变金管，金管+4分，金管同时累积绿色计数 |

状态变量：`selectedBird`（当前选中），`detailBird`（详情页展示）

### 生命系统
- `lives`（当前命数），`maxLives`（最大），`invincible`（无敌剩余秒数）
- 碰管：若 lives>1 → lives--, invincible=1.5, 炸管道+粒子
- 碰管时无敌闪烁（`Math.floor(invincible*10)%2===0` 才画鸟）
- 边界（顶/底）直接死亡
- HUD 爱心：只显示 lives 个红心，扣命从右侧消失

### 难度系统
- `level = (pipesPassed / 10) | 0` — 每通过10根管道升1级
- `sb = level * 8`（速度加成），`gs = Math.min(level * 2, 16)`（碰撞容错）
- 蓝色连击降1级

### 管道类型
```js
PD = [
  {c:'#228B22', sm:1.0, gm:1.00, pts:1, prob:42},      // 绿色-普通
  {c:'#CC3333', sm:1.5, gm:1.00, pts:1, prob:18, fast:1}, // 红色-加速
  {c:'#3366CC', sm:1.0, gm:1.00, pts:1, prob:18, osc:40}, // 蓝色-浮动
  {c:'#8B3DB5', sm:1.0, gm:0.80, pts:1, prob:12},        // 紫色-收窄(80%)
  {c:'#FFB800', sm:1.0, gm:1.00, pts:3, prob:10},        // 金色-奖励
];
```

### 连击系统
累计通过10根同色管道触发，各自独立：
| 颜色 | 效果 | 类型 |
|------|------|------|
| 🟢绿 | 其他四种管道计数各+2 | 瞬间 |
| 🔴红 | 永久+1命 | 瞬间 |
| 🔵蓝 | 难度永久-1级 | 瞬间 |
| 🟣紫 | 下5管间隙翻倍（生成时扣减） | 持续 |
| 🟡金 | 下5管得分翻倍（得分时扣减） | 持续 |
- 紫/金可同时触发叠加
- HUD：金显示"金xN"，紫不显示数字（生成时计数无意义）
- 实现：`pipeCounts[5]` + `comboTimers[5]`

### 紫色管道细节
- 间隙 `gm: 0.80`（原0.75→试过0.775→最终0.80）
- 连击时 `comboTimers[3]` 在 mkPipe() 中 check+decrement
- 触发 `comboTimers[3]=5` → 下一根新管 spawn 时 gap*=2 并 timers--
- HUD 不显示紫色连击数字

### 黄色管道细节
- 连击时 `comboTimers[4]=5`，在 scoring 时 pts*=2 并 timers--

### 按钮布局（菜单界面）
- 开始按钮(绿)：y=200, w=180, h=52
- 小鸟按钮(黄)：y=275, w=180, h=52
- 奖杯按钮：x=18, y=DESIGN_H-GH-75=470, w=55, h=55
- 预览鸟：x=DESIGN_W/2-105=95, 在按钮左侧

### 触摸系统
- `wx.onTouchStart` 单事件
- 菜单：坐标检测按钮区域（多路径兼容：touches[0] → changedTouches[0] → e）
- playing：任意触摸跳跃
- 按钮坐标预计算为屏幕像素：`offsetX + designX * scale`

### 排行榜
- `wx.setUserCloudStorage` 上传最高分
- `openDataContext/index.js` 绘制好友排行
- 所有玩家统一样式（无特殊标记）
- game.json 需 `"openDataContext": "openDataContext"`

### 音频
- `wx.createWebAudioContext()` → OscillatorNode 生成音效
- sfxJ(跳跃), sfxS(得分), sfxB(奖励), sfxH(死亡), sfxHit(受伤)

## 重要规则

**修改代码必须遵守：**
1. 禁止全局替换（replace_all: true），尤其数字常量
2. 每次替换前用 Grep 确认唯一性
3. 数字常量必须带完整上下文修改
4. 上次事故：20→15 全局替换导致 SPAWN=200→150（管道变密）、btnY=200→150（UI错位）等十几处误改

**用户偏好：**
- 全自动操作，不问问题
- 只改用户要求的，不扩大范围
- 交流使用中文

## APK版本
- 路径：`G:\vs code projets\game\flappy-bird-mobile\`
- 包名：`com.xiaoniao.guandao`
- 应用名：`小鸟过管道`
- 自定义图标已适配所有分辨率
- www/index.html 为独立Web版（无微信API）
- 构建：`export JAVA_HOME=... && ANDROID_HOME=... && cd android && ./gradlew assembleDebug`
- JDK: `C:\Users\XUEWENQI\jdk-21.0.2`
- Android SDK: `C:\Users\XUEWENQI\Android\Sdk`

## 隐私声明
- URL: `https://jsngsxh.github.io/privacy/`
- 仓库：`github.com/jsngsxh/privacy`
