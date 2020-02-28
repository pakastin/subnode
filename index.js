const cp = require('child_process');
const net = require('net');
const http = require('http');

module.exports = function subnode (path, args, options) {
  let child;
  let port;
  let lastTry = 0;
  let errorTimeout = 0;

  const getPort = () => {
    return new Promise((resolve, reject) => {
      const server = net.createServer();
      server.listen((err) => {
        if (err) {
          console.error(new Error(err));
          return setTimeout(async () => {
            resolve(await getPort());
          }, 1000);
        }
        const { port } = server.address();
        if (port) {
          server.close(() => {
            resolve(port);
          });
        } else {
          reject(new Error("Couldn't get port"));
        }
      });
    });
  };

  const fork = async (path, args, options) => {
    if (child) {
      kill(child);
    }
    port = await getPort();
    const defaultOptions = {
      env: {
        ...process.env,
        NODE_PORT: port
      }
    };
    const _child = child = cp.fork(path, args, {
      ...defaultOptions,
      ...(options || {})
    });

    const retry = (err) => {
      if (err) {
        console.error(new Error(err));
      }
      if (_child !== child) {
        return;
      }
      const diff = Date.now() - lastTry;

      lastTry = Date.now();

      if (diff < errorTimeout + 1000) {
        errorTimeout += 100;
      } else {
        errorTimeout = 0;
      }
      setTimeout(() => {
        fork(path, args, options);
      }, errorTimeout);
    };

    child.on('close', retry);
  };

  const kill = (child) => {
    child.kill();
  };

  const proxy = (req, res) => {
    const xForwardedFor = req.getHeader ? req.getHeader('x-forwarded-for') : req.get('x-forwarded-for');
    const ip = req.ip ? req.ip : req.socket.localAddress;

    const proxiedRequest = http.request({
      host: 'localhost',
      port,
      path: req.path,
      method: req.method,
      headers: {
        ...req.headers,
        'X-Forwarded-For': xForwardedFor ? `${xForwardedFor}, ${ip}` : ip
      }
    }, (proxiedResponse) => {
      const { statusCode, statusMessage, headers } = proxiedResponse;
      res.writeHead(statusCode, statusMessage, headers);
      proxiedResponse.pipe(res);
    });

    proxiedRequest.on('error', (err) => {
      console.error(new Error(err));
      res.end();
    });

    req.pipe(proxiedRequest);
  };

  fork(path, args, options);

  return {
    get process () {
      return child;
    },
    get port () {
      return port;
    },
    fork,
    kill,
    proxy
  };
};
