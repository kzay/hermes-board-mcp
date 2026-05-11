import { execFile } from 'child_process';

export interface CommandOptions {
  cwd?: string;
  timeout?: number;
  maxBuffer?: number;
}

export interface CommandResult {
  stdout: string;
  stderr: string;
}

export async function runCommand(
  cmd: string,
  args: string[],
  opts: CommandOptions = {}
): Promise<CommandResult> {
  const { cwd, timeout = 30_000, maxBuffer = 2 * 1024 * 1024 } = opts;
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout, maxBuffer, cwd }, (err: Error | null, stdout: string, stderr: string) => {
      if (err) {
        reject(new Error(`${cmd} failed: ${err.message}\n${stderr || ''}`));
      } else {
        resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
      }
    });
  });
}
