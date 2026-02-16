/**
 * TaskExecutor - Spawns a claude CLI process and manages its lifecycle
 * Executes task descriptions via `claude --print "<prompt>"`
 */

import { spawn, type ChildProcess } from 'child_process';

/**
 * Result of a task execution
 */
export interface ExecutionResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  durationMs: number;
}

/**
 * TaskExecutor configuration
 */
export interface TaskExecutorConfig {
  /** Path to claude CLI binary (default: 'claude') */
  claudeBinary?: string;

  /** Working directory for task execution */
  workingDirectory?: string;

  /** Maximum execution time in ms (default: 600000 = 10 min) */
  timeoutMs?: number;
}

/**
 * TaskExecutor class
 */
export class TaskExecutor {
  private claudeBinary: string;
  private workingDirectory: string;
  private timeoutMs: number;
  private currentProcess: ChildProcess | null = null;
  private aborted = false;

  constructor(config: TaskExecutorConfig = {}) {
    this.claudeBinary = config.claudeBinary || process.env.CLAUDE_BINARY || 'claude';
    this.workingDirectory = config.workingDirectory || process.env.TASK_WORKING_DIR || process.cwd();
    this.timeoutMs = config.timeoutMs || parseInt(process.env.TASK_TIMEOUT_MS || '600000', 10);
  }

  /**
   * Execute a task description via claude CLI
   */
  async execute(
    description: string,
    onProgress?: (chunk: string) => void,
  ): Promise<ExecutionResult> {
    this.aborted = false;
    const startTime = Date.now();
    let stdout = '';
    let stderr = '';
    let timedOut = false;

    return new Promise<ExecutionResult>((resolve) => {
      const proc = spawn(this.claudeBinary, ['--print', description], {
        cwd: this.workingDirectory,
        shell: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      this.currentProcess = proc;

      // Set up timeout
      const timer = setTimeout(() => {
        timedOut = true;
        this.killProcess(proc);
      }, this.timeoutMs);

      proc.stdout?.on('data', (data: Buffer) => {
        const chunk = data.toString();
        stdout += chunk;
        if (onProgress) {
          onProgress(chunk);
        }
      });

      proc.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        clearTimeout(timer);
        this.currentProcess = null;

        resolve({
          exitCode: code,
          stdout,
          stderr,
          timedOut,
          durationMs: Date.now() - startTime,
        });
      });

      proc.on('error', (err) => {
        clearTimeout(timer);
        this.currentProcess = null;

        stderr += err.message;
        resolve({
          exitCode: 1,
          stdout,
          stderr,
          timedOut: false,
          durationMs: Date.now() - startTime,
        });
      });
    });
  }

  /**
   * Abort the currently running process
   */
  abort(): boolean {
    if (!this.currentProcess) {
      return false;
    }

    this.aborted = true;
    this.killProcess(this.currentProcess);
    return true;
  }

  /**
   * Whether the last execution was aborted
   */
  wasAborted(): boolean {
    return this.aborted;
  }

  /**
   * Whether a process is currently running
   */
  isRunning(): boolean {
    return this.currentProcess !== null;
  }

  /**
   * Kill a process, handling Windows process tree cleanup
   */
  private killProcess(proc: ChildProcess): void {
    if (!proc.pid) {
      return;
    }

    try {
      if (process.platform === 'win32') {
        // Windows: use taskkill to kill entire process tree
        spawn('taskkill', ['/pid', proc.pid.toString(), '/f', '/t'], {
          shell: true,
          stdio: 'ignore',
        });
      } else {
        // Unix: kill process group
        proc.kill('SIGTERM');
      }
    } catch {
      // Process may have already exited
    }
  }
}
