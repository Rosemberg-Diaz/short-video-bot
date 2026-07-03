import { spawn } from "node:child_process";

export interface ProcessResult {
  stdout: string;
  stderr: string;
}

export function runProcess(
  executable: string,
  args: string[],
  options: { input?: string; cwd?: string } = {},
): Promise<ProcessResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      cwd: options.cwd,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => (stdout += chunk));
    child.stderr.on("data", (chunk: string) => (stderr += chunk));
    child.on("error", (error) => {
      reject(
        new Error(
          `No se pudo ejecutar "${executable}". Verifica su ruta. ${error.message}`,
        ),
      );
    });
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(
          new Error(
            `"${executable}" terminó con código ${code}.\n${stderr.trim()}`,
          ),
        );
      }
    });

    if (options.input) child.stdin.write(options.input);
    child.stdin.end();
  });
}

export async function assertExecutable(
  executable: string,
  versionArgs = ["-version"],
): Promise<void> {
  await runProcess(executable, versionArgs);
}
