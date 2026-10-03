import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { delimiter, dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";

export function batchCommandLine(command, args) {
  const tokens = [command, ...args].map(String);
  if (tokens.some(token => /[\r\n"&|<>^%!]/.test(token))) throw new Error("Unsafe Windows batch argument");
  return `"${tokens.map(token => `"${token}"`).join(" ")}"`;
}

export function run(command, args = [], options = {}) {
  if (!options || typeof options !== "object") throw new TypeError("run options must be an object, e.g. { cwd }");
  const commandFile = process.platform === "win32" && /\.(?:cmd|bat)$/i.test(String(command));
  const executable = commandFile ? process.env.ComSpec || "cmd.exe" : command;
  const parameters = commandFile ? ["/d", "/s", "/v:off", "/c", batchCommandLine(command, args)] : args;
  const result = spawnSync(executable, parameters, {
    cwd: options.cwd,
    env: options.env ?? process.env,
    encoding: options.capture ? "utf8" : undefined,
    stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
    shell: false,
    windowsVerbatimArguments: commandFile,
  });
  if (result.error) {
    if (options.allowFailure) return { status: 127, stdout: "", stderr: result.error.message };
    throw result.error;
  }
  const outcome = {
    status: result.status ?? 1,
    stdout: options.capture ? String(result.stdout ?? "") : "",
    stderr: options.capture ? String(result.stderr ?? "") : "",
  };
  if (!options.allowFailure && outcome.status !== 0) process.exit(outcome.status || 1);
  return outcome;
}

export function findOnPath(names) {
  const pathEntries = String(process.env.PATH || "").split(delimiter).filter(Boolean);
  for (const name of names) {
    const candidates = process.platform === "win32"
      ? [name, `${name}.exe`, `${name}.cmd`, `${name}.bat`]
      : [name];
    for (const entry of pathEntries) {
      for (const candidate of candidates) {
        const absolute = resolve(entry, candidate);
        if (existsSync(absolute)) return absolute;
      }
    }
  }
  return null;
}

function decodeLocalProperty(value) {
  return String(value || "")
    .replace(/\\:/g, ":")
    .replace(/\\\\/g, "\\")
    .trim();
}

export function sdkFromLocalProperties(androidProject) {
  if (!androidProject) return null;
  const file = resolve(androidProject, "local.properties");
  if (!existsSync(file)) return null;
  const match = readFileSync(file, "utf8").match(/^sdk\.dir\s*=\s*(.+)$/m);
  if (!match) return null;
  const sdk = decodeLocalProperty(match[1]);
  return sdk && existsSync(sdk) ? resolve(sdk) : null;
}

export function androidSdkRoot(androidProject) {
  const candidates = [
    process.env.ANDROID_SDK_ROOT,
    process.env.ANDROID_HOME,
    sdkFromLocalProperties(androidProject),
    process.platform === "win32" && process.env.LOCALAPPDATA ? resolve(process.env.LOCALAPPDATA, "Android", "Sdk") : null,
    process.platform === "darwin" && process.env.HOME ? resolve(process.env.HOME, "Library", "Android", "sdk") : null,
    process.platform !== "win32" && process.platform !== "darwin" && process.env.HOME ? resolve(process.env.HOME, "Android", "Sdk") : null,
  ];
  const root = candidates.find((candidate) => candidate && existsSync(resolve(candidate, "platforms/android-36/android.jar")));
  return root ? resolve(root) : null;
}

export function ensureLocalProperties(androidProject, sdkRoot) {
  if (!androidProject || !existsSync(androidProject)) throw new Error("Generated Android project is missing");
  if (!sdkRoot) throw new Error("Android SDK platform 36 missing; set ANDROID_SDK_ROOT to an SDK with platforms/android-36/android.jar");
  const file = resolve(androidProject, "local.properties");
  const portable = resolve(sdkRoot).replaceAll("\\", "/");
  const contents = existsSync(file) ? readFileSync(file, "utf8") : "";
  const entry = `sdk.dir=${portable}`;
  writeFileSync(file, /^sdk\.dir\s*=/m.test(contents) ? contents.replace(/^sdk\.dir\s*=.*$/m, entry) : `${contents}${contents && !contents.endsWith("\n") ? "\n" : ""}${entry}\n`);
  return file;
}

export function resolveAdb(androidProject) {
  const sdk = androidSdkRoot(androidProject);
  if (sdk) {
    const candidate = resolve(sdk, "platform-tools", process.platform === "win32" ? "adb.exe" : "adb");
    if (existsSync(candidate)) return candidate;
  }
  return findOnPath(["adb"]);
}

export function resolveJava() {
  const javaHome = process.env.JAVA_HOME;
  if (javaHome) {
    const candidate = resolve(javaHome, "bin", process.platform === "win32" ? "java.exe" : "java");
    if (existsSync(candidate)) return candidate;
  }
  return findOnPath(["java"]);
}

export function javaMajor(javaPath) {
  if (!javaPath) return null;
  const result = run(javaPath, ["-version"], { capture: true, allowFailure: true });
  const text = `${result.stderr}\n${result.stdout}`;
  const match = text.match(/version\s+"(?:(1)\.)?(\d+)/i);
  if (!match) return null;
  return Number(match[2]);
}

export function supportedJavaMajor(major) {
  return Number.isInteger(major) && major >= 21 && major <= 24;
}

export function parseAdbDevices(output) {
  return String(output || "")
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [serial, state, ...rest] = line.split(/\s+/);
      return { serial, state, detail: rest.join(" ") };
    });
}

export function adbDevices(adbPath) {
  if (!adbPath) return [];
  const result = run(adbPath, ["devices", "-l"], { capture: true, allowFailure: true });
  if (result.status !== 0) return [];
  return parseAdbDevices(result.stdout);
}

export function selectDevice(devices, requestedSerial) {
  if (requestedSerial) {
    const device = devices.find((item) => item.serial === requestedSerial);
    if (!device) throw new Error(`ADB device not found: ${requestedSerial}`);
    if (device.state !== "device") throw new Error(`ADB device ${requestedSerial} is ${device.state}, not authorized/ready.`);
    return device;
  }
  const ready = devices.filter((item) => item.state === "device");
  if (ready.length === 1) return ready[0];
  if (ready.length === 0) throw new Error("No authorized Android device/emulator is connected.");
  throw new Error(`Multiple Android devices are connected (${ready.map((item) => item.serial).join(", ")}). Pass --serial <id>.`);
}

export function adb(adbPath, serial, args, options = {}) {
  return run(adbPath, ["-s", serial, ...args], options);
}

export function shell(adbPath, serial, args, options = {}) {
  return adb(adbPath, serial, ["shell", ...args], options);
}

export function sha256File(file) {
  const hash = createHash("sha256");
  hash.update(readFileSync(file));
  return hash.digest("hex");
}

export function fileInfo(file) {
  if (!existsSync(file)) return null;
  const stat = statSync(file);
  return { path: resolve(file), bytes: stat.size, sha256: sha256File(file) };
}

export function parseFlags(argv) {
  const flags = new Map();
  const positionals = [];
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      positionals.push(token);
      continue;
    }
    const [rawKey, inline] = token.slice(2).split("=", 2);
    if (inline != null) {
      flags.set(rawKey, inline);
      continue;
    }
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      flags.set(rawKey, next);
      index += 1;
    } else {
      flags.set(rawKey, true);
    }
  }
  return { flags, positionals };
}

export function boolFlag(flags, name) {
  const value = flags.get(name);
  if (value == null) return false;
  return value === true || value === "1" || value === "true" || value === "yes";
}
