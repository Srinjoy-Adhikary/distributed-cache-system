import { useState, useEffect, useCallback } from 'react';

type CacheData = {
    [key: string]: string;
}

export type ClusterState = {
    nodes: string[];
    state: { [nodeId: string]: CacheData };
    ring: number[];
    ringMap: { [hash: string]: string };
    replicas: number;
    dbConnected: boolean;
    dbDocs: string;
};

export const MAX_HASH = 0xffffffff;

export function useCacheCluster() {
    const [cluster, setCluster] = useState<ClusterState>({ 
        nodes: [], 
        state: {}, 
        ring: [],
        ringMap: {},
        replicas: 3,
        dbConnected: false, 
        dbDocs: '0' 
    });
    const [loading, setLoading] = useState(true);

    const refreshCluster = useCallback(async () => {
        try {
            const res = await fetch('/api/cluster');
            const data = await res.json();
            setCluster(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        refreshCluster();
        const interval = setInterval(refreshCluster, 2000); // Poll every 2s
        return () => clearInterval(interval);
    }, [refreshCluster]);

    const addNode = async (nodeId: string) => {
        await fetch('/api/cluster/node', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nodeId })
        });
        refreshCluster();
    };

    const removeNode = async (nodeId: string) => {
        await fetch(`/api/cluster/node/${nodeId}`, { method: 'DELETE' });
        refreshCluster();
    };

    const setKey = async (key: string, value: string, ttlSeconds?: string) => {
        const payload: any = { key, value };
        if (ttlSeconds && !isNaN(parseInt(ttlSeconds))) payload.ttlSeconds = parseInt(ttlSeconds);
        
        const res = await fetch('/api/data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        refreshCluster();
        return res.json();
    };

    const incrKey = async (key: string) => {
        const res = await fetch(`/api/data/${key}/incr`, { method: 'POST' });
        refreshCluster();
        return res.json();
    };

    const getKey = async (key: string) => {
        const res = await fetch(`/api/data/${key}`);
        return res.json();
    };

    return { cluster, loading, addNode, removeNode, setKey, getKey, incrKey, refreshCluster };
}
