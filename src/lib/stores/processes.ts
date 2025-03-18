import { writable, derived } from "svelte/store";
import type { Process, SystemStats } from "$lib/types";
import { invoke } from "@tauri-apps/api/core";
import { sysInfo } from "@kksh/api/ui/custom";
import { processMonitor } from "$lib/utils/processMonitor";
import { systemMonitor } from "$lib/utils/systemMonitor";

interface ProcessStore {
  processes: Process[];
  systemStats: SystemStats | null;
  error: string | null;
  isLoading: boolean;
  searchTerm: string;
  currentPage: number;
  pinnedProcesses: Set<string>;
  selectedProcess: Process | null;
  showInfoModal: boolean;
  showConfirmModal: boolean;
  processToKill: Process | null;
  isKilling: boolean;
  isFrozen: boolean;
  selectedProcessPid: number | null;
  sortConfig: {
    field: keyof Process;
    direction: "asc" | "desc";
  };
}

const initialState: ProcessStore = {
  processes: [],
  systemStats: null,
  error: null,
  isLoading: true,
  searchTerm: "",
  currentPage: 1,
  pinnedProcesses: new Set(),
  selectedProcess: null,
  showInfoModal: false,
  showConfirmModal: false,
  processToKill: null,
  isKilling: false,
  isFrozen: false,
  selectedProcessPid: null,
  sortConfig: {
    field: "cpu_usage",
    direction: "desc",
  },
};

function createProcessStore() {
  const { subscribe, set, update } = writable<ProcessStore>(initialState);

  // Define all methods first
  const setIsLoading = (isLoading: boolean) =>
    update((state) => ({ ...state, isLoading }));

  const getProcesses = async () => {
    try {
      // const result = await invoke<[Process[], SystemStats]>("get_processes");
      const processes = await processMonitor.collectProcesses();
      const systemStats = await systemMonitor.collectStats();
      await sysInfo.refreshAll();
      update((state) => {
        let updatedSelectedProcess = state.selectedProcess;
        if (state.selectedProcessPid) {
          updatedSelectedProcess =
            processes.find((p) => p.pid === state.selectedProcessPid) || null;
        }

        return {
          ...state,
          processes,
          systemStats,
          error: null,
          selectedProcess: updatedSelectedProcess,
        };
      });
    } catch (e: unknown) {
      update((state) => ({
        ...state,
        error: e instanceof Error ? e.message : String(e),
      }));
    }
  };

  const killProcess = async (pid: number) => {
    try {
      update((state) => ({ ...state, isKilling: true }));
      const success = await invoke<boolean>("kill_process", { pid });
      if (success) {
        await getProcesses();
      } else {
        throw new Error("Failed to kill process");
      }
    } catch (e: unknown) {
      update((state) => ({
        ...state,
        error: e instanceof Error ? e.message : String(e),
      }));
    } finally {
      update((state) => ({ ...state, isKilling: false }));
    }
  };

  const toggleSort = (field: keyof Process) => {
    update((state) => ({
      ...state,
      sortConfig: {
        field,
        direction:
          state.sortConfig.field === field
            ? state.sortConfig.direction === "asc"
              ? "desc"
              : "asc"
            : "desc",
      },
    }));
  };

  const togglePin = (command: string) => {
    update((state) => {
      const newPinnedProcesses = new Set(state.pinnedProcesses);
      if (newPinnedProcesses.has(command)) {
        newPinnedProcesses.delete(command);
      } else {
        newPinnedProcesses.add(command);
      }
      return { ...state, pinnedProcesses: newPinnedProcesses };
    });
  };

  const setSearchTerm = (searchTerm: string) =>
    update((state) => ({ ...state, searchTerm, currentPage: 1 }));

  const setIsFrozen = (isFrozen: boolean) =>
    update((state) => ({ ...state, isFrozen }));

  const setCurrentPage = (currentPage: number) =>
    update((state) => ({ ...state, currentPage }));

  const showProcessDetails = (process: Process) => {
    update((state) => ({
      ...state,
      selectedProcessPid: process.pid,
      selectedProcess: process,
      showInfoModal: true,
    }));
  };

  const closeProcessDetails = () => {
    update((state) => ({
      ...state,
      showInfoModal: false,
      selectedProcess: null,
      selectedProcessPid: null,
    }));
  };

  const confirmKillProcess = (process: Process) => {
    update((state) => ({
      ...state,
      processToKill: process,
      showConfirmModal: true,
    }));
  };

  const closeConfirmKill = () => {
    update((state) => ({
      ...state,
      showConfirmModal: false,
      processToKill: null,
    }));
  };

  const handleConfirmKill = async () => {
    let processToKill: Process | null = null;

    let currentState: ProcessStore | undefined;
    const unsubscribe = subscribe((state) => {
      currentState = state;
    });
    unsubscribe();

    if (currentState?.processToKill && "pid" in currentState.processToKill) {
      processToKill = currentState.processToKill;
    }

    if (!processToKill?.pid) {
      return;
    }

    try {
      await killProcess(processToKill.pid);
    } finally {
      update((state) => ({
        ...state,
        showConfirmModal: false,
        processToKill: null,
      }));
    }
  };

  // Return all methods
  return {
    subscribe,
    set,
    update,
    setIsLoading,
    getProcesses,
    killProcess,
    toggleSort,
    togglePin,
    setSearchTerm,
    setIsFrozen,
    setCurrentPage,
    showProcessDetails,
    closeProcessDetails,
    confirmKillProcess,
    closeConfirmKill,
    handleConfirmKill,
  };
}

export const processStore = createProcessStore();
