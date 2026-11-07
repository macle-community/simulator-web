#!/usr/bin/env node
/**
 * Macle MiniProgram Standalone Web Simulator CLI
 * Pure Node.js - Zero Electron Dependencies
 */

const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const { MacleWebSimulatorServer } = require('./server');

const args = process.argv.slice(2);

function printHelp() {
  console.log(`
Macle MiniProgram Standalone Web Simulator
Version: 1.0.0 (Engine: 26.6.0-LG0001 / Runtime: v100.4.2)

Usage:
  macle-simulator-web [options]

Options:
  -s, --source <path>     Path to compiled or source Macle project (e.g. sample-project/dist)
  -p, --port <port>       Port to run the simulator server (default: 30001)
  -H, --host <host>       Host to bind server (default: 0.0.0.0)
  -w, --watch             Watch files and auto-recompile / live-reload on changes
  -o, --open              Automatically open simulator in default browser
  -v, --version           Show version information
  -h, --help              Show this help message

Examples:
  npx @macle-community/simulator-web -s ./sample-project/dist
  macle-simulator-web -s ./opendoc/miniapp --watch --open
  macle-simulator-web -p 30005
`);
  process.exit(0);
}

if (args.includes('-h') || args.includes('--help')) {
  printHelp();
}

if (args.includes('-v') || args.includes('--version')) {
  console.log('macle-simulator-web v1.0.0');
  console.log('Macle Engine: 26.6.0-LG0001');
  console.log('Framework Runtime: v100.4.2');
  process.exit(0);
}

function getArgValue(shortFlag, longFlag, defaultValue) {
  const shortIdx = args.indexOf(shortFlag);
  if (shortIdx !== -1 && args[shortIdx + 1]) return args[shortIdx + 1];
  const longIdx = args.indexOf(longFlag);
  if (longIdx !== -1 && args[longIdx + 1]) return args[longIdx + 1];
  return defaultValue;
}

const source = getArgValue('-s', '--source', null);
const portStr = getArgValue('-p', '--port', '30001');
const host = getArgValue('-H', '--host', '0.0.0.0');
const watch = args.includes('-w') || args.includes('--watch');
const shouldOpen = args.includes('-o') || args.includes('--open');

const port = parseInt(portStr, 10) || 30001;

async function run() {
  try {
    const simulator = new MacleWebSimulatorServer({
      source,
      port,
      host,
      watch
    });

    await simulator.init();
    const { localUrl } = await simulator.start();

    if (shouldOpen) {
      openBrowser(localUrl);
    }

    process.on('SIGINT', () => {
      console.log('\n[Simulator] Stopping web simulator server...');
      simulator.close();
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      simulator.close();
      process.exit(0);
    });
  } catch (err) {
    console.error('[Simulator] Fatal error starting web simulator:', err);
    process.exit(1);
  }
}

function openBrowser(url) {
  const start = process.platform === 'darwin' ? 'open' :
                process.platform === 'win32' ? 'start' : 'xdg-open';
  exec(`${start} ${url}`, (err) => {
    if (err) {
      console.warn('[Simulator] Could not auto-open browser:', err.message);
    }
  });
}

run();