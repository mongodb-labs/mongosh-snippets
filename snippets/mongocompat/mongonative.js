var cd = process.chdir;
var getHostName = os.hostname;
var hostname = os.hostname;
var pwd = process.cwd;
var _rand = Math.random;
var _isWindows = () => process.platform === 'win32';

function cat(filename, useBinaryMode) {
  let contents = fs.readFileSync(filename, 'utf8');
  if (!useBinaryMode && _isWindows()) {
    contents = contents.replace(/(?<!\r)\n/g, '\r\n');
  }
  return contents;
}

function getMemInfo() {
  return { resident: process.memoryUsage().rss,/* virtual: ? */ };
}

function isInteractive() {
  const argv = process.argv.slice(2);
  if (argv.includes('--shell')) return true;
  const loadedFiles = argv.filter(arg => !arg.startsWith('-'));
  if (argv.includes('--nodb')) {
    return loadedFiles.length === 0;
  } else {
    return loadedFiles.length <= 1;
  }
}

function listFiles(dir = '.') {
  const files = fs.readdirSync(dir, { withFileTypes: true });
  return files.map(dirent => {
    const obj = { baseName: dirent.name, name: path.join(dir, dirent.name) };
    obj.isDirectory = dirent.isDirectory();
    if (dirent.isFile()) {
      obj.size = fs.statSync(obj.name).size;
    }
    return obj;
  });
}

function ls(dir) {
  return listFiles(dir).map(file => file.name);
}

function md5sumFile(filename) {
  return crypto.createHash('md5').update(fs.readFileSync(filename)).digest('hex');
}

function mkdir(path) {
  const ret = fs.mkdirSync(path, { recursive: true });
  if (ret === undefined) {
    return { exists: true, created: false };
  } else {
    return { exists: true, created: true };
  }
}

function removeFile(path) {
  let existed = false;
  try {
    fs.statSync(path);
    existed = true;
  } catch {}
  fs.rmSync(path, { recursive: true, force: true });
  return existed;
}
