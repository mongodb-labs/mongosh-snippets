(() => {
  const localRequire = require('module').createRequire(__filename);
  const downloadURL = localRequire('mongodb-download-url').default;
  const download = localRequire('download');
  const crypto = localRequire('crypto');
  const child_process = localRequire('child_process');
  const os = localRequire('os');
  const { promises: fs } = localRequire('fs');

  class MongodWrapper {
    constructor(options) {
      this.options = options;
      this.proc = null;
      this.log = '';
      if (!options.port) options.port = '27017';

      this.waitReady = new Promise(resolve => this.markReady = resolve);
    }

    async spawn() {
      const { url, artifact } = await downloadURL(this.options);
      const id = crypto.createHash('sha256').update(artifact).digest('hex').slice(0, 20);
      const downloadPath = `${os.homedir()}/.mongodb/spawn-mongod-downloads/${id}`;
      let hasDownload = false;
      try {
        await fs.stat(downloadPath);
        hasDownload = true;
      } catch {}
      if (!hasDownload) {
        print(`[Downloading mongod from ${url} to ${downloadPath} ...]`);
        await fs.mkdir(downloadPath, { recursive: true });
        await download(url, downloadPath, { extract: true, strip: 1 });
      }

      let tmpDbPath;
      let { port, dbpath } = this.options;
      if (!dbpath) {
        dbpath = `${os.tmpdir()}/spawn-mongod-db-${crypto.randomBytes(10).toString('hex')}`;
        await fs.mkdir(dbpath, { recursive: true });
        tmpDbPath = dbpath;
      }

      this.proc = child_process.spawn(`${downloadPath}/bin/mongod`, [
        '--port', port,
        '--dbpath', dbpath
      ], { stdio: 'pipe' });
      this.proc.stdout.setEncoding('utf8').on('data', chunk => {
        this.log += chunk;
        if (this.log.includes('Waiting for connections')) this.markReady('listening!');
      });
      this.proc.stderr.setEncoding('utf8').on('data', chunk => {
        this.log += chunk;
      });
      this.proc.on('exit', () => {
        this.exited = true;
        if (tmpDbPath) {
          fs.rmdir(this.tmpDbPath, { recursive: true }).catch(() => {});
        }
        print(`mongod process for port ${port} stopped`);
      });
      process.on('exit', () => {
        if (!this.exited) this.stop();
      });
    }

    get url() {
      return this.exited ? null : `mongodb://localhost:${this.options.port}/?directConnection=true&serverSelectionTimeoutMS=2000`;
    }

    getMongo() {
      return this.mongo = this.mongo || Mongo(this.url);
    }

    getDB(name) {
      return this.getMongo().getDB(name);
    }

    stop() {
      this.proc.kill();
    }
  }

  globalThis.spawnMongod = function(options) {
    const wrapper = new MongodWrapper(options);
    wrapper.spawn();
    return wrapper;
  };
})();
