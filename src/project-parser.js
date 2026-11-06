const fs = require('fs');
const path = require('path');

/**
 * Discovers and parses Macle miniprogram project configuration
 */
function parseProject(projectDir) {
  const resolvedDir = path.resolve(projectDir);
  let appConfig = null;
  let projectConfig = null;
  let isCompiled = false;
  let appDir = resolvedDir;

  // Check if projectDir is already a compiled dist folder
  const appServiceCandidates = [
    path.join(resolvedDir, 'app-service.js'),
    path.join(resolvedDir, 'root/debug/app/app-service.js')
  ];

  for (const cand of appServiceCandidates) {
    if (fs.existsSync(cand)) {
      isCompiled = true;
      appDir = path.dirname(cand);
      break;
    }
  }

  // Look for app-config.json or app.json
  const configCandidates = [
    path.join(appDir, 'app-config.json'),
    path.join(resolvedDir, 'app-config.json'),
    path.join(resolvedDir, 'app.json'),
    path.join(appDir, 'app.json')
  ];

  for (const cand of configCandidates) {
    if (fs.existsSync(cand)) {
      try {
        appConfig = JSON.parse(fs.readFileSync(cand, 'utf8'));
        break;
      } catch (err) {
        console.warn(`[Parser] Warning: Failed to parse ${cand}:`, err.message);
      }
    }
  }

  // Look for project.config.json
  const projCandidates = [
    path.join(resolvedDir, 'project.config.json'),
    path.join(path.dirname(resolvedDir), 'project.config.json')
  ];

  for (const cand of projCandidates) {
    if (fs.existsSync(cand)) {
      try {
        projectConfig = JSON.parse(fs.readFileSync(cand, 'utf8'));
        break;
      } catch (e) {}
    }
  }

  const projectName = (projectConfig && projectConfig.projectname) ||
                      path.basename(resolvedDir);

  const pages = (appConfig && Array.isArray(appConfig.pages)) ? appConfig.pages : ['pages/index/index'];
  const entryPagePath = (appConfig && appConfig.entryPagePath) || pages[0] || 'pages/index/index';
  const windowConfig = (appConfig && appConfig.window) || {
    navigationBarTitleText: projectName,
    navigationBarBackgroundColor: '#000000',
    navigationBarTextStyle: 'white'
  };

  return {
    sourceDir: resolvedDir,
    appDir,
    isCompiled,
    projectName,
    pages,
    entryPagePath,
    window: windowConfig,
    tabBar: (appConfig && appConfig.tabBar) || null,
    appConfig,
    projectConfig
  };
}

module.exports = { parseProject };
