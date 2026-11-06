const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const crypto = require('crypto');
const url = require('url');

/**
 * Native Macle MCSS Simulator Backend
 * Handles /mcss/simulate/* endpoints
 */
function createMockBackend(appDir) {
  const storeDir = path.join(appDir, 'store');
  const tmpDir = path.join(appDir, 'tmp');
  fs.mkdirSync(storeDir, { recursive: true });
  fs.mkdirSync(tmpDir, { recursive: true });

  return {
    handleRequestData(req, res, body) {
      try {
        const data = body.data || {};
        const params = data.mockType ? data.inputParams : (typeof data.inputParams === 'string' ? JSON.parse(data.inputParams) : data.inputParams);
        const targetUrl = params.url;
        const method = (params.method || 'GET').toUpperCase();
        const headers = params.header || {};
        const postData = params.data ? (typeof params.data === 'string' ? params.data : JSON.stringify(params.data)) : null;

        if (!targetUrl) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ errMsg: 'requestData:fail missing url' }));
        }

        const parsedUrl = new URL(targetUrl);
        const isHttps = parsedUrl.protocol === 'https:';
        const client = isHttps ? https : http;

        if (postData && !headers['Content-Type']) {
          headers['Content-Type'] = 'application/json';
        }
        if (postData) {
          headers['Content-Length'] = Buffer.byteLength(postData);
        }

        const requestOptions = {
          hostname: parsedUrl.hostname,
          port: parsedUrl.port || (isHttps ? 443 : 80),
          path: parsedUrl.pathname + parsedUrl.search,
          method: method,
          headers: headers,
          timeout: params.timeout || 10000
        };

        const proxyReq = client.request(requestOptions, (proxyRes) => {
          let chunks = [];
          proxyRes.on('data', chunk => chunks.push(chunk));
          proxyRes.on('end', () => {
            const buffer = Buffer.concat(chunks);
            const contentType = proxyRes.headers['content-type'] || '';
            let responseData;

            if (contentType.includes('application/json')) {
              try {
                responseData = JSON.parse(buffer.toString('utf8'));
              } catch (e) {
                responseData = buffer.toString('utf8');
              }
            } else {
              responseData = buffer.toString('utf8');
            }

            res.writeHead(proxyRes.statusCode || 200, {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            });
            res.end(JSON.stringify(responseData));
          });
        });

        proxyReq.on('error', (err) => {
          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ errMsg: `requestData:fail ${err.message}` }));
        });

        proxyReq.on('timeout', () => {
          proxyReq.destroy();
          res.writeHead(504, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ errMsg: 'requestData:fail timeout' }));
        });

        if (postData) {
          proxyReq.write(postData);
        }
        proxyReq.end();
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ errMsg: `requestData:error ${err.message}` }));
      }
    },

    handleSaveFile(req, res, body) {
      try {
        const data = body.data || {};
        const params = typeof data.inputParams === 'string' ? JSON.parse(data.inputParams) : (data.inputParams || {});
        const tempPath = params.tempFilePath || '';
        const fileName = path.basename(tempPath);
        const sourceFile = path.join(tmpDir, fileName);
        const targetFile = path.join(storeDir, fileName);

        if (!fileName || !fs.existsSync(sourceFile)) {
          // If file not in tmpDir, create a mock saved file
          const mockContent = 'mock-saved-content';
          fs.writeFileSync(targetFile, mockContent);
        } else {
          fs.copyFileSync(sourceFile, targetFile);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          errMsg: 'savedFile:ok',
          savedFilePath: `/store/${fileName}`
        }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ errMsg: `saveFile:fail ${err.message}` }));
      }
    },

    handleRemoveSaved(req, res, body) {
      try {
        const data = body.data || {};
        const params = typeof data.inputParams === 'string' ? JSON.parse(data.inputParams) : (data.inputParams || {});
        const filePath = params.filePath || '';
        const fileName = path.basename(filePath);
        const targetFile = path.join(storeDir, fileName);

        if (fs.existsSync(targetFile)) {
          fs.unlinkSync(targetFile);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ errMsg: 'removeSavedFile:ok' }));
        } else {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ errMsg: 'removeSavedFile:fail file not exist' }));
        }
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ errMsg: `removeSaved:fail ${err.message}` }));
      }
    },

    handleFileInfo(req, res, query) {
      try {
        const dataStr = query.data;
        const params = typeof dataStr === 'string' ? JSON.parse(dataStr) : (dataStr || {});
        const filePath = params.filePath || '';
        const algorithm = (params.digestAlgorithm || 'sha256').toLowerCase();
        const targetFile = path.resolve(appDir, filePath.replace(/^\//, ''));

        if (fs.existsSync(targetFile)) {
          const content = fs.readFileSync(targetFile);
          const hash = crypto.createHash(algorithm).update(content).digest('hex');
          const stat = fs.statSync(targetFile);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            errMsg: 'getFileInfo:ok',
            digest: hash,
            size: stat.size
          }));
        } else {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ errMsg: 'getFileInfo:fail file not exist' }));
        }
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ errMsg: `getFileInfo:fail ${err.message}` }));
      }
    },

    handleSavedFileList(req, res) {
      try {
        const files = fs.readdirSync(storeDir);
        const fileList = files.map(file => {
          const p = path.join(storeDir, file);
          const stat = fs.statSync(p);
          return {
            filePath: `/store/${file}`,
            size: stat.size,
            creatTime: stat.ctimeMs
          };
        });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ errMsg: 'getSavedFileList:ok', fileList }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ errMsg: `getSavedFileList:fail ${err.message}` }));
      }
    },

    handleSavedFileInfo(req, res, query) {
      try {
        const dataStr = query.data;
        const params = typeof dataStr === 'string' ? JSON.parse(dataStr) : (dataStr || {});
        const fileName = path.basename(params.filePath || '');
        const targetFile = path.join(storeDir, fileName);

        if (fs.existsSync(targetFile)) {
          const stat = fs.statSync(targetFile);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            errMsg: 'getSavedFileInfo:ok',
            size: stat.size,
            createTime: stat.ctimeMs
          }));
        } else {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ errMsg: 'getSavedFileInfo:fail file not find' }));
        }
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ errMsg: `getSavedFileInfo:fail ${err.message}` }));
      }
    }
  };
}

module.exports = { createMockBackend };
