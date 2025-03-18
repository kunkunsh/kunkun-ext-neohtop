import type { SystemStats } from "$lib/types";
import { sysInfo } from "@kksh/api/ui/custom";

export class SystemMonitor {
  last_network_update: [Date, number, number];

  constructor() {
    this.last_network_update = [new Date(), 0, 0];
  }

  async init() {
    await sysInfo.refreshAll();
    const networks = await sysInfo.networks();
    const initial_rx = networks.reduce(
      (acc, network) => acc + network.total_received,
      0,
    );
    const initial_tx = networks.reduce(
      (acc, network) => acc + network.total_transmitted,
      0,
    );
    this.last_network_update = [new Date(), initial_rx, initial_tx];
  }

  async collectStats(): Promise<SystemStats> {
    let { rx_rate, tx_rate } = await this.calculateNetworkStats();
    let { disk_total, disk_used, disk_free } = await this.calculateDiskStats();
    const cpus = await sysInfo.cpus();
    const memory_total = await sysInfo.totalMemory();
    const memory_used = await sysInfo.usedMemory();
    const memory_free = memory_total - memory_used;
    const memory_cached =
      memory_total - (memory_used + (memory_total - memory_used));
    const uptime = await sysInfo.uptime();
    const load_avg = await sysInfo.loadAverage();
    return {
      cpu_usage: cpus.map((cpu) => cpu.cpu_usage),
      memory_total,
      memory_used,
      memory_free,
      memory_cached,
      uptime,
      load_avg: [load_avg.one, load_avg.five, load_avg.fifteen],
      network_rx_bytes: rx_rate,
      network_tx_bytes: tx_rate,
      disk_total_bytes: disk_total,
      disk_used_bytes: disk_used,
      disk_free_bytes: disk_free,
    };
  }

  async calculateNetworkStats() {
    const networks = await sysInfo.networks();
    let current_rx = networks.reduce(
      (acc, network) => acc + network.total_received,
      0,
    );
    let current_tx = networks.reduce(
      (acc, network) => acc + network.total_transmitted,
      0,
    );

    const elapsed =
      new Date().getTime() - this.last_network_update[0].getTime();
    const rx_rate =
      ((current_rx - this.last_network_update[1]) / elapsed) * 1000;
    const tx_rate =
      ((current_tx - this.last_network_update[2]) / elapsed) * 1000;

    this.last_network_update = [new Date(), current_rx, current_tx];

    return { rx_rate, tx_rate };
  }

  async calculateDiskStats() {
    let disks = await sysInfo.disks();
    disks = disks.filter((disk) => disk.mount_point === "/");
    const disk_total = disks.reduce((acc, disk) => acc + disk.total_space, 0);
    const disk_used = disks.reduce(
      (acc, disk) => acc + disk.total_space - disk.available_space,
      0,
    );
    const disk_free = disks.reduce(
      (acc, disk) => acc + disk.available_space,
      0,
    );

    return { disk_total, disk_used, disk_free };
  }
}

export const systemMonitor = new SystemMonitor();
systemMonitor.init();
