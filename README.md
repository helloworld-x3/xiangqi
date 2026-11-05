# 弈 · 中国象棋 / Xiangqi

离线、同屏双人中国象棋。Android App 与网页共用同一套规则与界面；没有 AI、联网对战、账号或广告。

## 安卓 APK

在本仓库的 [Actions → Android APK](https://github.com/helloworld-x3/xiangqi/actions/workflows/android-apk.yml) 打开最新成功的构建，下载 **xiangqi-android-apk** artifact，解压后安装 `xiangqi-2.0.0-debug.apk`。GitHub 下载 Actions artifact 需要登录。

- 支持 Android 8.0（API 26）及以上，需要支持现代网页特性的 Android System WebView。
- 首次安装时，按系统提示允许当前浏览器或文件管理器“安装未知应用”。
- 安装后所有页面、脚本、图标已在 APK 中，不需要网络，也不申请网络或存储权限。
- 本版本是 debug 签名测试包，适合侧载体验，不是应用商店正式发行版。不同 CI 构建的 debug 签名可能不同；若更新时提示签名不兼容，卸载重装会清除本地棋局。正式发布需要配置长期保存的 release 签名密钥。
- 构建同时提供 `SHA256SUMS.txt` 供核对下载文件，artifact 保留 30 天。后续可从 Actions 重新构建。

## v2 App 优化

- 中文界面与手机底部操作栏，适配系统安全区和横竖屏。
- 自动保存棋谱与设置，重新打开继续对弈；通过重放合法棋谱验证存档，损坏存档安全恢复为新局。
- 悔棋、棋盘翻转、面对面棋子朝向、走子提示开关、可关闭的落子音效。
- 显示失子、棋谱、将军、将死、困毙；新对局先确认。
- 棋盘按钮具有文字标签，支持 Tab、方向键和 Enter/空格操作。

## 网页本地运行

运行网页不需要 npm 或第三方服务：

```sh
git clone --branch app/android-v2 https://github.com/helloworld-x3/xiangqi.git
cd xiangqi
python3 -m http.server 8080
```

浏览器打开 http://localhost:8080。也可以直接打开 `index.html`，但不同浏览器对 file:// 存储的支持不同；自动续局推荐使用本地 HTTP 或 Android App。

红方先走，点击己方棋子再点击目标位置。绿色点表示合法走子，绿色圈表示可以吃子。上方“黑方/红方”会随棋盘翻转切换；面对面模式会把上方一方的棋子文字转向对面棋手。

棋局仅保存在当前浏览器/应用中；隐私模式、清理应用数据或卸载 App 可能删除存档。网页和 APK 各自保存，不会互相同步。没有请求后台服务，也不上传棋谱。音效由设备上的 Web Audio 合成，无外部音频文件。

## 自己构建 Android APK

安装 JDK 17、Android SDK platform 35 / build-tools 35.0.0，以及 Gradle 8.11.1。配置 `ANDROID_HOME` 或在 `android/local.properties` 中设置 `sdk.dir`：

```sh
gradle --no-daemon -p android assembleDebug lintDebug
```

产物：`android/app/build/outputs/apk/debug/app-debug.apk`。Gradle 会自动把根目录网页资源复制到 APK 的 assets，不需要手工复制。Android 通过 WebViewAssetLoader 在受限制的本地 HTTPS 来源加载资源，不使用任意远程网页或原生 JS 桥接。

## 测试

Node.js 22：

```sh
node test.cjs
node tests/app.test.cjs
```

浏览器集成测试：

```sh
npm install
npx playwright install chromium
npm run test:browser
```

规则测试含所有棋子限制、将帅照面、自将、炮架变化、将死、困毙，以及标准开局 perft 深度 1/2/3：44 / 1920 / 79666。状态/UI 单测验证存档重放、悔棋、损坏存档、存储失败、设置和点击操作。Playwright 用真实 Chromium 测试手机触控布局、刷新续局、悔棋、翻转、面对面、提示开关、新局确认和宽度溢出，并在 Actions 中上传界面截图。

GitHub Actions 会自动运行以上检查、Android 编译与 Lint。构建成功并不替代真机安装验收；手机系统/WebView 差异还需要实际设备体验确认。

## 代码结构

- `index.html` / `styles.css` / `app.js`：中文自适应界面。
- `engine.js`：象棋规则，浏览器与 Node.js 共用。
- `persistence.js`：棋局操作、紧凑存档与合法棋谱重放。
- `icons/`：本地图标。
- `android/`：Java Android 壳与 Gradle 构建。
- `test.cjs`、`tests/`：规则、状态与浏览器测试。
- `.github/workflows/android-apk.yml`：APK 自动构建。

标准 9×10 棋盘，包含九宫、河界、蹩马腿、塞象眼、隔子打炮、兵卒过河和将帅照面限制。将死或无合法走法（困毙）判负，不允许走子后自将。长将、重复局面和限着和棋不自动裁定。
