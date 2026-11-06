const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const os = require('os');
const { parseProject } = require('./project-parser');
const { compileProject, findMacleCompiler } = require('./compiler');
const { createMockBackend } = require('./mock-backend');
const { LiveReloadManager } = require('./watcher');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf'
};

class MacleWebSimulatorServer {
  constructor(options = {}) {
    this.port = options.port || 30001;
    this.host = options.host || '0.0.0.0';
    this.sourceDir = options.source ? path.resolve(options.source) : null;
    this.runtimeDir = path.resolve(__dirname, '../runtime');
    this.webDir = path.resolve(__dirname, '../web');
    this.projectInfo = null;
    this.appDir = null;
    this.mockBackend = null;
    this.liveReload = new LiveReloadManager();
    this.server = null;
    this.isWatching = !!options.watch;
  }

  async init() {
    // If no source path provided, search for default sample-project or opendoc
    if (!this.sourceDir) {
      const candidates = [
        path.resolve(__dirname, '../../sample-project/dist'),
        path.resolve(__dirname, '../../sample-project'),
        path.resolve(__dirname, '../../opendoc/miniapp-taro/dist'),
        path.resolve(__dirname, '../../opendoc/miniapp')
      ];
      this.sourceDir = candidates.find(c => fs.existsSync(c)) || path.resolve('.');
    }

    // Parse project
    this.projectInfo = parseProject(this.sourceDir);
    const projectName = this.projectInfo.projectName;

    // Compile if necessary
    const compileRes = await compileProject(this.sourceDir, projectName);
    this.appDir = compileRes.outDir;

    // Initialize mock backend for this app
    this.mockBackend = createMockBackend(this.appDir);

    // Setup watcher if requested
    if (this.isWatching) {
      this.liveReload.watchDirectory(this.sourceDir, async () => {
        await compileProject(this.sourceDir, projectName);
      });
    }

    return this;
  }

  start() {
    this.server = http.createServer((req, res) => {
      this.handleRequest(req, res);
    });

    return new Promise((resolve, reject) => {
      this.server.listen(this.port, this.host, () => {
        const localUrl = `http://localhost:${this.port}`;
        const networkIp = getNetworkIp();
        const networkUrl = networkIp ? `http://${networkIp}:${this.port}` : null;

        console.log('\n======================================================');
        console.log('   🚀 Macle Web Simulator (Standalone Edition)');
        console.log('======================================================');
        console.log(`  Project:     ${this.projectInfo.projectName}`);
        console.log(`  Source:      ${this.sourceDir}`);
        console.log(`  App Target:  ${this.appDir}`);
        console.log(`  Local URL:   ${localUrl}`);
        if (networkUrl) {
          console.log(`  Network URL: ${networkUrl} (Scan on mobile)`);
        }
        console.log(`  Workbench:   ${localUrl}/`);
        console.log(`  Dual-Thread: ${localUrl}/dist/root/debug/simulator/index.html`);
        console.log('======================================================\n');

        resolve({ localUrl, networkUrl, port: this.port });
      });

      this.server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          console.warn(`[Simulator] Port ${this.port} is in use, trying ${this.port + 1}...`);
          this.port++;
          this.server.listen(this.port, this.host);
        } else {
          reject(err);
        }
      });
    });
  }

  handleRequest(req, res) {
    // Add CORS & iFrame permissions headers to all responses
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('X-Frame-Options', 'ALLOWALL');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      return res.end();
    }

    const parsedUrl = url.parse(req.url, true);
    const reqPath = parsedUrl.pathname;

    // 1. API: Live Reload SSE
    if (reqPath === '/api/live-reload') {
      return this.liveReload.addClient(res);
    }

    // 2. API: Project Info
    if (reqPath === '/api/project-info') {
      const info = {
        projectName: this.projectInfo.projectName,
        sourceDir: this.sourceDir,
        appDir: this.appDir,
        pages: this.projectInfo.pages,
        entryPagePath: this.projectInfo.entryPagePath,
        window: this.projectInfo.window,
        tabBar: this.projectInfo.tabBar,
        simulatorUrl: `/dist/root/debug/simulator/index.html`,
        engineVersion: '26.6.0-LG0001',
        runtimeVersion: '100.4.2'
      };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(info));
    }

    // 3. API: Recompile
    if (reqPath === '/api/recompile' && req.method === 'POST') {
      compileProject(this.sourceDir, this.projectInfo.projectName).then(result => {
        this.liveReload.notifyReload('manual-recompile');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      });
      return;
    }

    // 4. MCSS Native Mock Backend (/mcss/simulate/*)
    if (reqPath.startsWith('/mcss/simulate')) {
      return this.handleMockBackend(req, res, parsedUrl);
    }

    // 5. Web Simulator Workbench Shell (/ and /__web)
    if (reqPath === '/' || reqPath === '/__web' || reqPath === '/index.html') {
      return this.serveStaticFile(path.join(this.webDir, 'index.html'), res);
    }
    if (reqPath === '/simulator.css') {
      return this.serveStaticFile(path.join(this.webDir, 'simulator.css'), res);
    }
    if (reqPath === '/simulator.js') {
      return this.serveStaticFile(path.join(this.webDir, 'simulator.js'), res);
    }
    if (reqPath === '/qrcode.js') {
      return this.serveStaticFile(path.join(this.webDir, 'qrcode.js'), res);
    }

    // 6. Dual-thread Macle Runtime Routing:
    // Resolve:
    // - /dist/root/debug/framework/... or /framework/... -> runtimeDir/framework/...
    // - /dist/root/debug/simulator/... or /simulator/... -> runtimeDir/simulator/...
    // - /dist/root/debug/app/... or /app/... -> appDir/...
    let diskPath = this.resolveRuntimePath(reqPath);
    if (diskPath && fs.existsSync(diskPath)) {
      const stat = fs.statSync(diskPath);
      if (stat.isDirectory()) {
        diskPath = path.join(diskPath, 'index.html');
      }
      if (fs.existsSync(diskPath)) {
        return this.serveStaticFile(diskPath, res);
      }
    }

    // 7. Check if file exists inside appDir directly (e.g. static assets, images)
    const directAppPath = path.join(this.appDir, reqPath.replace(/^\//, ''));
    if (fs.existsSync(directAppPath) && fs.statSync(directAppPath).isFile()) {
      return this.serveStaticFile(directAppPath, res);
    }

    // 8. 404 Not Found
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(`404 Not Found: ${reqPath}`);
  }

  resolveRuntimePath(reqPath) {
    // Strip project name or /dist prefix if present:
    // e.g. /dist/root/debug/framework/... or /miniapp/root/debug/framework/... -> /root/debug/framework/...
    const normalized = reqPath.replace(/^\/(dist|[a-zA-Z0-9_-]+)\/root\/debug\//, '/');

    if (normalized.startsWith('/framework/')) {
      const sub = normalized.replace(/^\/framework\//, '');
      return path.join(this.runtimeDir, 'framework', sub);
    }

    if (normalized.startsWith('/simulator/')) {
      const sub = normalized.replace(/^\/simulator\//, '');
      return path.join(this.runtimeDir, 'simulator', sub);
    }

    if (normalized.startsWith('/remoteDebug/')) {
      const sub = normalized.replace(/^\/remoteDebug\//, '');
      return path.join(this.runtimeDir, 'remoteDebug', sub);
    }

    if (normalized.startsWith('/app/')) {
      const sub = normalized.replace(/^\/app\//, '');
      return path.join(this.appDir, sub);
    }

    // Fallbacks for direct relative references
    if (reqPath.startsWith('/root/debug/framework/')) {
      return path.join(this.runtimeDir, 'framework', reqPath.replace('/root/debug/framework/', ''));
    }
    if (reqPath.startsWith('/root/debug/simulator/')) {
      return path.join(this.runtimeDir, 'simulator', reqPath.replace('/root/debug/simulator/', ''));
    }
    if (reqPath.startsWith('/root/debug/app/')) {
      return path.join(this.appDir, reqPath.replace('/root/debug/app/', ''));
    }

    return null;
  }

  serveStaticFile(filePath, res) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        return res.end('Internal Server Error: ' + err.message);
      }
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    });
  }

  handleMockBackend(req, res, parsedUrl) {
    const subRoute = parsedUrl.pathname.replace(/^\/mcss\/simulate/, '');

    if (req.method === 'POST') {
      let bodyStr = '';
      req.on('data', chunk => bodyStr += chunk);
      req.on('end', () => {
        let body = {};
        try {
          body = JSON.parse(bodyStr);
        } catch (e) {
          body = { data: bodyStr };
        }

        if (subRoute === '/requestData') {
          return this.mockBackend.handleRequestData(req, res, body);
        }
        if (subRoute === '/saveFile') {
          return this.mockBackend.handleSaveFile(req, res, body);
        }
        if (subRoute === '/removeSaved') {
          return this.mockBackend.handleRemoveSaved(req, res, body);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ errMsg: `${subRoute.replace('/', '')}:ok` }));
      });
      return;
    }

    if (req.method === 'GET') {
      if (subRoute === '/fileInfo') {
        return this.mockBackend.handleFileInfo(req, res, parsedUrl.query);
      }
      if (subRoute === '/savedFileList') {
        return this.mockBackend.handleSavedFileList(req, res);
      }
      if (subRoute === '/savedFileInfo') {
        return this.mockBackend.handleSavedFileInfo(req, res, parsedUrl.query);
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ errMsg: `${subRoute.replace('/', '')}:ok` }));
      return;
    }

    res.writeHead(405, { 'Content-Type': 'text/plain' });
    res.end('Method Not Allowed');
  }

  close() {
    this.liveReload.closeAll();
    if (this.server) {
      this.server.close();
    }
  }
}

function getNetworkIp() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return null;
}

module.exports = { MacleWebSimulatorServer };
