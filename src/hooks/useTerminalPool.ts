import { useCallback, useRef, useEffect, useMemo } from 'react';
import { useTerminalGridStore } from '../stores/terminalGridStore';

interface UseTerminalPoolReturn {
  connect: (paneId: string) => void;
  confirmConnection: (paneId: string, tmuxSession: string, tmuxPane: string) => void;
  reportConnectionFailed: (paneId: string) => void;
  disconnect: (paneId: string) => Promise<void>;
  disconnectAll: () => Promise<void>;
  isConnected: (paneId: string) => boolean;
  canConnect: () => boolean;
  connectedPaneIds: Set<string>;
  connectingPaneIds: Set<string>;
}

export function useTerminalPool(): UseTerminalPoolReturn {
  // Granular state selectors
  const connectedPanes = useTerminalGridStore((s) => s.connectedPanes);
  const connectingPanes = useTerminalGridStore((s) => s.connectingPanes);

  // Actions — stable references from create()
  const unregisterConnection = useTerminalGridStore((s) => s.unregisterConnection);
  const removeConnecting = useTerminalGridStore((s) => s.removeConnecting);
  const addConnecting = useTerminalGridStore((s) => s.addConnecting);
  const promoteToConnected = useTerminalGridStore((s) => s.promoteToConnected);
  const storeIsConnected = useTerminalGridStore((s) => s.isConnected);
  const storeCanConnect = useTerminalGridStore((s) => s.canConnect);
  const getLeastRecentlyUsed = useTerminalGridStore((s) => s.getLeastRecentlyUsed);

  const connectingRef = useRef<Set<string>>(new Set());

  const disconnect = useCallback(async (paneId: string) => {
    try {
      await window.electronAPI.terminalDisconnect(paneId);
    } catch {
      // Ignore disconnect errors
    }
    unregisterConnection(paneId);
    removeConnecting(paneId);
    connectingRef.current.delete(paneId);
  }, [unregisterConnection, removeConnecting]);

  const connect = useCallback((paneId: string) => {
    // Already connected or connecting
    if (storeIsConnected(paneId) || connectingPanes.has(paneId)) return;

    // Evict LRU if at capacity
    if (!storeCanConnect()) {
      const lruId = getLeastRecentlyUsed();
      if (lruId) {
        disconnect(lruId);
      } else {
        // All panes are focused or protected, can't connect
        return;
      }
    }

    connectingRef.current.add(paneId);
    addConnecting(paneId);
  }, [connectingPanes, storeIsConnected, storeCanConnect, getLeastRecentlyUsed, addConnecting, disconnect]);

  const confirmConnection = useCallback((paneId: string, tmuxSession: string, tmuxPane: string) => {
    connectingRef.current.delete(paneId);
    // Atomic: remove from connecting + add to connected in a single set()
    // to prevent shouldConnect from toggling true->false->true between renders
    promoteToConnected(paneId, tmuxSession, tmuxPane);
  }, [promoteToConnected]);

  const reportConnectionFailed = useCallback((paneId: string) => {
    connectingRef.current.delete(paneId);
    removeConnecting(paneId);
  }, [removeConnecting]);

  const disconnectAll = useCallback(async () => {
    const paneIds = Array.from(connectedPanes.keys());
    await Promise.all(paneIds.map((id) => disconnect(id)));
  }, [connectedPanes, disconnect]);

  const isConnected = useCallback((paneId: string) => {
    return storeIsConnected(paneId);
  }, [storeIsConnected]);

  const canConnect = useCallback(() => {
    return storeCanConnect();
  }, [storeCanConnect]);

  // Memoize connectedPaneIds Set so it's referentially stable
  const connectedPaneIds = useMemo(
    () => new Set(connectedPanes.keys()),
    [connectedPanes]
  );

  const connectingPaneIds = connectingPanes;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Don't disconnect on unmount - let connections persist across navigation
    };
  }, []);

  return {
    connect,
    confirmConnection,
    reportConnectionFailed,
    disconnect,
    disconnectAll,
    isConnected,
    canConnect,
    connectedPaneIds,
    connectingPaneIds,
  };
}
