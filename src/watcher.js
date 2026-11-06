const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');

class LiveReloadManager extends EventEmitter {
  constructor() {
    super();
    this.clients = new Set();
    this.watchers = [];
    this.debounceTimer = null;
  }

  addClient(res) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });
    res.write('data: connected\n\n');
    this.clients.add(res);

    res.on('close', () => {
      this.clients.delete(res);
    });
  }

  notifyReload(reason = 'file-change') {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      console.log(`[Watcher] Triggering simulator reload (reason: ${reason})...`);
      for (const client of this.clients) {
        try {
          client.write('data: reload\n\n');
        } catch (e) {
          this.clients.delete(client);
        }
      }
      this.emit('reload', reason);
    }, 300);
  }

  watchDirectory(targetDir, onChangeCallback) {
    if (!fs.existsSync(targetDir)) return;
    try {
      const watcher = fs.watch(targetDir, { recursive: true }, (eventType, filename) => {
        if (!filename) return;
        // Ignore dotfiles, temp files, node_modules, and git
        if (filename.startsWith('.') || filename.includes('node_modules') || filename.includes('.git')) {
          return;
        }
        if (onChangeCallback) {
          onChangeCallback(eventType, filename);
        }
        this.notifyReload(filename);
      });
      this.watchers.push(watcher);
      console.log(`[Watcher] Watching directory for live reload: ${targetDir}`);
    } catch (err) {
      console.warn(`[Watcher] Could not watch ${targetDir}:`, err.message);
    }
  }

  closeAll() {
    for (const w of this.watchers) {
      try { w.close(); } catch (e) {}
    }
    this.watchers = [];
    for (const c of this.clients) {
      try { c.end(); } catch (e) {}
    }
    this.clients.clear();
  }
}

module.exports = { LiveReloadManager };
