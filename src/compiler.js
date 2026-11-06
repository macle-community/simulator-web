const path = require('path');
const fs = require('fs');
const os = require('os');

/**
 * Search candidates for official @macle/compiler
 */
function findMacleCompiler() {
  const candidates = [
    path.join(__dirname, '../../DevToolkit_26.6.0/DevToolkit_26.6.0-LG0001/Macle_26.6.0-LG0001_Engine_Compiler/node_modules/@macle/compiler'),
    path.join(__dirname, '../../../DevToolkit_26.6.0/DevToolkit_26.6.0-LG0001/Macle_26.6.0-LG0001_Engine_Compiler/node_modules/@macle/compiler'),
    path.join(__dirname, '../../DevToolkit_25.9.0/Macle_25.9.0_DevSuite_IDE/macle-miniprogram-tools-25.9.0-file/extension/node_modules/@macle/compiler'),
    path.join(__dirname, '../node_modules/@macle/compiler')
  ];

  for (const cand of candidates) {
    if (fs.existsSync(cand)) {
      try {
        const compiler = require(cand);
        return { compiler, path: cand };
      } catch (err) {
        console.warn(`[Compiler] Notice: Candidate found at ${cand} but could not be loaded:`, err.message);
      }
    }
  }
  return null;
}

/**
 * Compile or prepare project assets for web simulator
 */
async function compileProject(sourceDir, projectName) {
  const compilerInfo = findMacleCompiler();
  const outComposeDir = path.join(os.homedir(), '.macle/target/compose', projectName, 'root/debug/app');

  // Check if sourceDir is already compiled (e.g. contains app-service.js)
  const isAlreadyCompiled = fs.existsSync(path.join(sourceDir, 'app-service.js')) ||
                            fs.existsSync(path.join(sourceDir, 'app-config.json'));

  fs.mkdirSync(outComposeDir, { recursive: true });

  if (isAlreadyCompiled) {
    // Copy compiled files directly
    copyDirectory(sourceDir, outComposeDir);
    return {
      success: true,
      mode: 'precompiled',
      outDir: outComposeDir
    };
  }

  // Needs compilation via @macle/compiler
  if (!compilerInfo) {
    console.warn('[Compiler] Warning: @macle/compiler not found; copying source files directly.');
    copyDirectory(sourceDir, outComposeDir);
    return {
      success: false,
      mode: 'raw-copy',
      outDir: outComposeDir,
      error: '@macle/compiler not found'
    };
  }

  try {
    const startTime = Date.now();
    console.log(`[Compiler] Pre-compiling Macle source (${sourceDir})...`);
    await compilerInfo.compiler.compile(sourceDir, outComposeDir, { debug: true, es5: false });

    // Sync project config if available
    const projConf = path.join(sourceDir, 'project.config.json');
    if (fs.existsSync(projConf)) {
      fs.copyFileSync(projConf, path.join(outComposeDir, 'project.config.json'));
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[Compiler] Pre-compilation successful -> ${outComposeDir} (${elapsed}s)`);

    return {
      success: true,
      mode: 'compiled',
      outDir: outComposeDir,
      compilerPath: compilerInfo.path,
      elapsed
    };
  } catch (err) {
    console.error('[Compiler] Compilation error:', err.message);
    return {
      success: false,
      mode: 'error',
      outDir: outComposeDir,
      error: err.message
    };
  }
}

function copyDirectory(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== '.git') {
        copyDirectory(srcPath, destPath);
      }
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

module.exports = {
  findMacleCompiler,
  compileProject,
  copyDirectory
};
