# @macle-community/simulator-web

> Standalone, lightweight, zero-Electron web simulator and developer workbench for Macle MiniPrograms (Taro React/Vue & Native MAML).

[![npm version](https://img.shields.io/npm/v/@macle-community/simulator-web.svg)](https://www.npmjs.com/package/@macle-community/simulator-web)
[![Engine](https://img.shields.io/badge/Engine-26.6.0--LG0001-blue.svg)](https://www.huawei.com)
[![Runtime](https://img.shields.io/badge/Runtime-v100.4.2-green.svg)](https://www.huawei.com)
[![License](https://img.shields.io/badge/License-MIT-brightgreen.svg)](LICENSE)
[![Zero-Dependency](https://img.shields.io/badge/Dependencies-Zero%20(Pure%20Node.js)-orange.svg)]()

---

## ✨ Features

- **Zero Electron Dependencies**: Runs on standard Node.js (v16+) with zero heavy binary dependencies. Compatible with Linux, macOS, Windows, Docker, and remote cloud development environments.
- **Official Dual-Thread Engine (v26.6.0-LG0001 / v100.4.2)**: Includes official service and view runtime engines, patched with webpack chunk loading proxy traps and null-safe DOM reconciliation.
- **Embedded Web Workbench**:
  - **Realistic Device Frames**: Huawei Mate 60 Pro, Huawei Pura 70 Ultra, iPhone 15 Pro, iPhone 14 Pro Max, iPhone 13, iPhone 8 / SE, and iPad Pro 11".
  - **Device Controls**: Portrait / Landscape orientation rotation, zoom scaling (50%, 75%, 100%, 125%, Fit-to-screen).
  - **Touch Gesture Simulation**: Mouse-to-touch emulation with animated ripple cursor.
  - **Page Selector**: Direct navigation to any page declared in `app.json`.
- **Integrated DevTools Drawer**:
  - **Console**: Captures logs from both the logic thread (`service.js`) and render thread (`view.js`), with level filtering and interactive JavaScript REPL.
  - **Storage**: Real-time inspection, editing, and deletion of `ma.getStorage` and `localStorage` keys.
  - **Network**: Monitor and inspect `ma.request` calls, latency, payloads, and HTTP statuses.
  - **App Info**: Project metadata, registered routes, window settings, and compiler versions.
- **Live Reload & Watcher**: Automatic file watching and hot-reloading via Server-Sent Events (SSE).
- **Mobile Device Preview via QR Code**: Auto-detects local LAN IP and generates a mobile-ready QR code for instant testing on physical phones/tablets.
- **Universal Compilation**: Compiles native MAML miniapps via `@macle/compiler` or serves pre-compiled Taro output bundles.

---

## 🚀 Quick Start

### 1. Installation via NPM

```bash
# Global CLI installation
npm install -g @macle-community/simulator-web

# Or run directly via npx
npx @macle-community/simulator-web -s ./dist
```

### 2. Run from Source / Repository

```bash
# Clone the repository
git clone https://github.com/natiDotnet/macle-simulator-web.git
cd macle-simulator-web

# Run the web simulator
node src/cli.js -s ../sample-project/dist
```

### 3. CLI Options

```bash
macle-simulator-web [options]

Options:
  -s, --source <path>     Path to compiled (dist) or source Macle project [default: auto-detected]
  -p, --port <port>       Port to run the simulator server [default: 30001]
  -H, --host <host>       Host interface to bind [default: 0.0.0.0]
  -w, --watch             Watch files and auto-recompile / live-reload on changes
  -o, --open              Automatically open simulator in default browser
  -v, --version           Show version information
  -h, --help              Show help message
```

### 3. NPM Scripts

```bash
# Run with sample project
npm run sample

# Run with opendoc native miniapp
npm run opendoc

# Watch mode
npm run dev
```

---

## 📁 Project Structure

```
macle-web-simulator/
├── src/
│   ├── cli.js                       # CLI executable entry point
│   ├── server.js                    # Pure Node.js HTTP server & static router
│   ├── compiler.js                  # @macle/compiler runner
│   ├── mock-backend.js              # /mcss/simulate/* native Macle backend APIs
│   ├── project-parser.js            # app.json & project.config.json parser
│   └── watcher.js                   # Live reload file watcher & SSE emitter
├── runtime/                         # Bundled 26.6.0-LG0001 / v100.4.2 runtime
│   ├── framework/                   # service.js & view.js
│   └── simulator/                   # native.js, service.html, webview.js, common.css
├── web/                             # Web simulator shell & DevTools
│   ├── index.html                   # Workbench UI
│   ├── simulator.css                # Sleek device frames & dark DevTools theme
│   ├── simulator.js                 # Device dimensions, devtools, and router logic
│   └── qrcode.js                    # Client-side QR generator
├── package.json
└── README.md
```

---

## 🛠️ Native APIs Supported in Web Simulation

- `ma.request`: Outbound HTTP request proxying through the backend server.
- `ma.getStorage` / `ma.setStorage` / `ma.removeStorage` / `ma.clearStorage`.
- `ma.navigateTo` / `ma.redirectTo` / `ma.navigateBack` / `ma.switchTab`.
- `ma.setNavigationBarTitle` / `ma.setNavigationBarColor`.
- `ma.showToast` / `ma.showModal` / `ma.showLoading` / `ma.hideLoading`.
- `ma.getSystemInfo` / `ma.getSystemInfoSync` (responsive to device viewport changes).
- `ma.saveFile` / `ma.removeSavedFile` / `ma.getFileInfo` / `ma.getSavedFileList`.

---

## 📄 License

MIT © [Macle Team & natiDotnet](https://github.com/natiDotnet)
