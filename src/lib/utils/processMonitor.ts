import type { Process } from "$lib/types";
import { shell, sysInfo } from "@kksh/api/ui/custom";

type ProcessStaticInfo = {
  name: string;
  command: string;
  user: string;
};

type ProcessStatus = Awaited<ReturnType<typeof sysInfo.processes>>[0]["status"];
type DiskUsage = Awaited<ReturnType<typeof sysInfo.processes>>[0]["disk_usage"];

type ProcessData = {
  pid: number;
  name: string;
  cmd: string[];
  user_id: string | null;
  cpu_usage: number;
  memory: number;
  status: ProcessStatus;
  ppid: number | null;
  environ: string[];
  root: string;
  virtual_memory: number;
  start_time: number;
  run_time: number;
  disk_usage: DiskUsage;
  session_id: number | null;
};

export class ProcessMonitor {
  process_cache: Map<number, ProcessStaticInfo>;

  constructor() {
    this.process_cache = new Map();
  }

  async collectProcesses(): Promise<Process[]> {
    const current_time = this.getCurrentTime();
    const processesData = await this.collectProcessData(current_time);
    return this.buildProcessInfo(processesData);
  }

  async collectProcessData(current_time: number): Promise<ProcessData[]> {
    const processes = await sysInfo.processes();
    return processes.map((process) => {
      let start_time = process.start_time;
      return {
        pid: process.pid,
        name: process.name,
        cmd: process.cmd,
        user_id: process.user_id,
        cpu_usage: process.cpu_usage,
        memory: process.memory,
        status: process.status,
        ppid: process.parent,
        environ: process.environ,
        root: process.root ?? "",
        virtual_memory: process.virtual_memory,
        start_time: process.start_time,
        run_time: start_time > 0 ? current_time - start_time : 0,
        disk_usage: process.disk_usage,
        session_id: process.session_id,
      } satisfies ProcessData;
    });
  }

  getCurrentTime(): number {
    return Math.floor(Date.now() / 1000); // Get current time in seconds since UNIX epoch
  }

  killProcess(pid: number) {
    return shell.killPid(pid);
  }

  buildProcessInfo(processesData: ProcessData[]): Process[] {
    return processesData.map((data) => {
      let cached_info = this.process_cache.get(data.pid);

      if (!cached_info) {
        this.process_cache.set(data.pid, {
          name: data.name,
          command: data.cmd.join(" "),
          user: data.user_id || "-",
        });
        cached_info = this.process_cache.get(data.pid);
      }
      if (!cached_info) {
        throw new Error("Process info not found");
      }
      return {
        pid: data.pid,
        ppid: data.ppid || 0,
        name: cached_info.name,
        cpu_usage: data.cpu_usage,
        memory_usage: data.memory,
        status: data.status as string,
        user: cached_info.user,
        command: cached_info.command,
        threads: undefined,
        environ: data.environ,
        root: data.root,
        virtual_memory: data.virtual_memory,
        start_time: data.start_time,
        run_time: data.run_time,
        disk_usage: [data.disk_usage.read_bytes, data.disk_usage.written_bytes],
        session_id: data.session_id ?? undefined,
      } satisfies Process;
    });
  }
}

export const processMonitor = new ProcessMonitor();
