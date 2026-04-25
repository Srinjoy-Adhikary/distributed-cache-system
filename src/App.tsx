import React, { useState, useMemo } from 'react';
import { useCacheCluster, MAX_HASH } from './hooks/useCacheCluster';
import { Activity, Database, Server, Plus, Trash2, Search, Save, Settings, Hash, AlertTriangle, MonitorPlay, FastForward, ArrowUp10 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';

// Helper to deterministically color nodes
const colors = [
    'bg-indigo-500', 'bg-emerald-500', 'bg-amber-500', 
    'bg-rose-500', 'bg-cyan-500', 'bg-fuchsia-500',
    'bg-sky-500', 'bg-violet-500', 'bg-teal-500'
];
const textColors = [
    'text-indigo-600', 'text-emerald-600', 'text-amber-600', 
    'text-rose-600', 'text-cyan-600', 'text-fuchsia-600',
    'text-sky-600', 'text-violet-600', 'text-teal-600'
];
const borderColors = [
    'border-indigo-200', 'border-emerald-200', 'border-amber-200', 
    'border-rose-200', 'border-cyan-200', 'border-fuchsia-200',
    'border-sky-200', 'border-violet-200', 'border-teal-200'
];
const ringColors = [
    'focus:ring-indigo-500', 'focus:ring-emerald-500', 'focus:ring-amber-500', 
    'focus:ring-rose-500', 'focus:ring-cyan-500', 'focus:ring-fuchsia-500',
    'focus:ring-sky-500', 'focus:ring-violet-500', 'focus:ring-teal-500'
];
const getNodeColorIndex = (nodeId: string) => {
    let sum = 0;
    for (let i = 0; i < nodeId.length; i++) sum += nodeId.charCodeAt(i);
    return sum % colors.length;
};

export default function App() {
  const { cluster, loading, addNode, removeNode, setKey, incrKey, getKey, refreshCluster } = useCacheCluster();
  
  const [newNodeName, setNewNodeName] = useState('');
  const [opKey, setOpKey] = useState('');
  const [opValue, setOpValue] = useState('');
  const [opTtl, setOpTtl] = useState('');
  
  const [lastLog, setLastLog] = useState<{ message: string, type: 'success' | 'info' | 'error', details?: any } | null>(null);
  const [latestKeyHash, setLatestKeyHash] = useState<{key: string, hash: number, targetNode: string} | null>(null);

  const handleAddNode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNodeName.trim()) return;
    await addNode(newNodeName.trim());
    setLastLog({ message: `Assigned new shard "${newNodeName}". Keys will naturally redistribute.`, type: 'success' });
    setNewNodeName('');
  };

  const handleSetData = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!opKey.trim() || !opValue.trim()) return;
    setLastLog({ message: `Saving key "${opKey}"...`, type: 'info' });
    const res = await setKey(opKey.trim(), opValue.trim(), opTtl.trim());
    setLatestKeyHash({ key: res.key, hash: res.hash, targetNode: res.assignedNode });
    setLastLog({ 
        message: `Saved! Time: ${res.timeMs}ms`, 
        type: res.error ? 'error' : 'success',
        details: res 
    });
    setOpKey('');
    setOpValue('');
    setOpTtl('');
  };

  const handleIncrData = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!opKey.trim()) return;
    setLastLog({ message: `Incrementing key "${opKey}"...`, type: 'info' });
    const res = await incrKey(opKey.trim());
    
    if (res.error) {
        setLastLog({ message: `INCR failed: ${res.error}`, type: 'error' });
    } else {
        setLatestKeyHash({ key: res.key, hash: res.hash, targetNode: res.assignedNode });
        setLastLog({
            message: `Key "${res.key}" incremented to ${res.value} in ${res.timeMs}ms`,
            type: 'success',
            details: res
        });
    }
  };

  const handleGetData = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!opKey.trim()) return;
    setLastLog({ message: `Fetching key "${opKey}"...`, type: 'info' });
    const res = await getKey(opKey.trim());
    if (res.error) {
        setLastLog({ message: `Cache Miss & DB Miss: ${res.error}`, type: 'error' });
    } else {
        setLatestKeyHash({ key: res.key, hash: res.hash, targetNode: res.nodeId });
        setLastLog({ 
            message: `Retrieved "${res.value}" from ${res.source.toUpperCase()}`, 
            type: 'success',
            details: res
        });
    }
  };

  if (loading) {
      return (
          <div className="flex items-center justify-center h-screen bg-[#f8f9fa] text-slate-500 font-sans">
              <Activity className="animate-spin w-6 h-6 mr-3 text-indigo-500" /> Booting Cluster...
          </div>
      );
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa] text-slate-800 font-sans selection:bg-indigo-100 selection:text-indigo-900 pb-12">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-8">
        
        {/* Header */}
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-6 border-b border-slate-200 gap-4 mt-4">
            <div>
                <h1 className="text-3xl font-semibold tracking-tight text-slate-900 flex items-center gap-3">
                    <Database className="w-8 h-8 text-indigo-600" />
                    HydraCache <span className="text-slate-400 text-lg font-normal tracking-normal font-mono">v1.0</span>
                </h1>
                <p className="text-sm text-slate-500 mt-2 font-medium">Distributed Consistent Hashing & Cache-Aside Simulation</p>
            </div>
            
            <div className="flex items-center gap-4 bg-white px-4 py-2.5 rounded-full shadow-sm border border-slate-200">
                <div className="flex items-center gap-2.5 text-sm font-medium">
                    <div className={cn("w-2.5 h-2.5 rounded-full shadow-sm", cluster.dbConnected ? "bg-emerald-500" : "bg-amber-400")}></div>
                    <span className="text-slate-500">Database Layer:</span>
                    <span className="text-slate-800">{cluster.dbDocs}</span>
                </div>
            </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
            
            {/* Sidebar Controls */}
            <div className="lg:col-span-1 flex flex-col gap-6">
                
                {/* Node Management Panel */}
                <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                        <Server className="w-4 h-4 text-emerald-600" />
                        <h2 className="text-sm font-semibold text-slate-800 uppercase tracking-wider">Cluster Topology</h2>
                    </div>
                    <div className="p-5 space-y-4">
                        <form onSubmit={handleAddNode} className="flex gap-2">
                            <input 
                                value={newNodeName}
                                onChange={e => setNewNodeName(e.target.value)}
                                placeholder="New Node ID..." 
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 bg-white transition-all shadow-sm"
                            />
                            <button type="submit" disabled={!newNodeName} className="px-3 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-xl border border-emerald-200 disabled:opacity-50 transition-colors shadow-sm">
                                <Plus className="w-5 h-5 mx-auto" />
                            </button>
                        </form>
                        
                        <div className="space-y-2">
                            <AnimatePresence>
                                {cluster.nodes.map(nodeId => {
                                    const cIndex = getNodeColorIndex(nodeId);
                                    return (
                                    <motion.div 
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        key={nodeId} 
                                        className={cn("flex items-center justify-between text-sm bg-white border rounded-xl px-4 py-3 group shadow-sm", borderColors[cIndex])}
                                    >
                                        <div className="flex items-center gap-2">
                                            <div className={cn("w-2 h-2 rounded-full", colors[cIndex])} />
                                            <span className={cn("font-mono font-medium", textColors[cIndex])}>{nodeId}</span>
                                        </div>
                                        <button 
                                            onClick={() => removeNode(nodeId)} 
                                            className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-50 hover:bg-red-50 p-1.5 rounded-md"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </motion.div>
                                    )
                                })}
                                {cluster.nodes.length === 0 && (
                                    <div className="text-xs text-amber-700 flex items-center gap-2 p-3 border border-amber-200 rounded-xl bg-amber-50 shadow-sm">
                                        <AlertTriangle className="w-4 h-4 shrink-0" /> Entire cache is down. Requests will fallback to DB.
                                    </div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </div>

                {/* Operations Panel */}
                <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                        <MonitorPlay className="w-4 h-4 text-indigo-600" />
                        <h2 className="text-sm font-semibold text-slate-800 uppercase tracking-wider">Client Simulator</h2>
                    </div>
                    <div className="p-5 space-y-5 text-sm">
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Key Name</label>
                                <input 
                                    value={opKey}
                                    onChange={e => setOpKey(e.target.value)}
                                    placeholder="user:123:profile" 
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 font-mono text-sm placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 shadow-sm transition-all"
                                />
                            </div>
                            
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Payload (For SET)</label>
                                <div className="flex gap-2">
                                    <input 
                                        value={opValue}
                                        onChange={e => setOpValue(e.target.value)}
                                        placeholder='{"name": "John"}' 
                                        className="flex-1 w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 font-mono text-sm placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 shadow-sm transition-all"
                                    />
                                    <input 
                                        value={opTtl}
                                        onChange={e => setOpTtl(e.target.value)}
                                        placeholder='TTL(s)' 
                                        className="w-20 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-900 font-mono text-sm placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 shadow-sm transition-all text-center"
                                    />
                                </div>
                            </div>
                            
                            <div className="flex gap-2 pt-1">
                                <button onClick={handleGetData} disabled={!opKey} className="flex-[0.8] flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-slate-700 rounded-xl py-2.5 border border-slate-200 font-semibold transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:opacity-50">
                                    <Search className="w-4 h-4" /> Get
                                </button>
                                <button onClick={handleIncrData} disabled={!opKey} className="flex-1 flex items-center justify-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl py-2.5 font-semibold transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:opacity-50">
                                    <ArrowUp10 className="w-4 h-4" /> Incr
                                </button>
                                <button onClick={handleSetData} disabled={!opKey || !opValue} className="flex-1 flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl py-2.5 font-semibold transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:opacity-50">
                                    <Save className="w-4 h-4" /> Set
                                </button>
                            </div>
                        </div>

                        {/* Recent Log View */}
                        <AnimatePresence mode="popLayout">
                        {lastLog && (
                            <motion.div 
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0 }}
                                key={Math.random()}
                                className={cn(
                                    "p-4 rounded-xl border text-xs break-words shadow-sm mt-4 relative overflow-hidden",
                                    lastLog.type === 'success' && "bg-emerald-50 border-emerald-200 text-emerald-800",
                                    lastLog.type === 'error' && "bg-rose-50 border-rose-200 text-rose-800",
                                    lastLog.type === 'info' && "bg-blue-50 border-blue-200 text-blue-800"
                                )}
                            >
                                <div className="absolute top-0 left-0 w-1 h-full bg-current opacity-20"></div>
                                <div className="font-medium text-sm mb-1.5">{lastLog.message}</div>
                                {lastLog.details && lastLog.details.timeMs !== undefined && (
                                    <div className="text-[11px] flex gap-3 mt-3 pt-3 border-t border-current/10 font-medium opacity-80">
                                        <span className="flex items-center gap-1.5"><Activity className="w-3 h-3"/> {lastLog.details.timeMs}ms</span>
                                        {lastLog.details.source && (
                                            <span className="flex items-center gap-1.5">Source: <span className="font-mono bg-current/10 px-1.5 py-0.5 rounded">{lastLog.details.source}</span></span>
                                        )}
                                        {lastLog.details.nodeId && (
                                            <span className="flex items-center gap-1.5">Node: <span className="font-mono bg-current/10 px-1.5 py-0.5 rounded">{lastLog.details.nodeId}</span></span>
                                        )}
                                    </div>
                                )}
                            </motion.div>
                        )}
                        </AnimatePresence>

                    </div>
                </div>

            </div>

            {/* Main Visualizer */}
            <div className="lg:col-span-3 space-y-6">
                
                {/* Consistent Hashing Visualizer */}
                <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-sm">
                    <div className="mb-6 max-w-2xl">
                        <h2 className="text-xl font-semibold text-slate-900 flex items-center gap-2.5">
                            <FastForward className="w-6 h-6 text-indigo-500" />
                            Consistent Hash Ring <span className="text-sm font-normal text-slate-400 font-mono ml-2 border border-slate-200 px-2 py-0.5 rounded bg-slate-50">(32-bit namespace)</span>
                        </h2>
                        <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                            Keys (MD5) and Node Replicas are mapped to a circular namespace (flattened below). 
                            When a key falls on the ring, it traverses clockwise (left-to-right) to locate the nearest physical node.
                        </p>
                    </div>

                    <div className="relative w-full h-16 bg-slate-50 rounded-2xl border-2 border-slate-100 my-10 overflow-hidden shadow-inner">
                        {/* Ring Base Line */}
                        <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-200 -translate-y-1/2"></div>
                        
                        {/* Render Node Replicas on the Ring */}
                        {cluster.ring.map((hash, i) => {
                            const left = (hash / MAX_HASH) * 100 + '%';
                            const nodeId = cluster.ringMap[hash];
                            const cIndex = getNodeColorIndex(nodeId);
                            return (
                                <div 
                                    key={`replica-${hash}-${i}`}
                                    style={{ left }} 
                                    className={cn("absolute top-0 w-1 h-full z-10 transition-all cursor-crosshair group hover:w-2", colors[cIndex])}
                                >
                                    {/* Tooltip */}
                                    <div className="absolute top-full mt-2 -translate-x-[calc(50%-0.125rem)] hidden group-hover:block whitespace-nowrap bg-slate-800 text-xs text-white px-2 py-1 rounded shadow-lg font-medium">
                                        {nodeId}
                                        <span className="block text-[10px] text-slate-400">Rep {i % cluster.replicas}</span>
                                    </div>
                                    <div className={cn("absolute top-1/2 left-1/2 -translate-x-[calc(50%+0.125rem)] -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white", colors[cIndex])}></div>
                                </div>
                            );
                        })}

                        {/* Render Latest Accessed Key */}
                        <AnimatePresence>
                        {latestKeyHash && (
                            <motion.div 
                                initial={{ opacity: 0, y: -20, scale: 0.5 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                key={`key-${latestKeyHash.hash}`}
                                style={{ left: (latestKeyHash.hash / MAX_HASH) * 100 + '%' }}
                                className="absolute top-0 w-0.5 h-full bg-slate-900 z-20"
                            >
                                <div className="absolute -top-7 -translate-x-[calc(50%-0.0625rem)] whitespace-nowrap bg-slate-900 text-white text-[11px] font-mono px-2.5 py-1 rounded-md shadow-md pointer-events-none">
                                    {latestKeyHash.key}
                                </div>
                                <div className="absolute top-1/2 left-0 w-12 border-t-[3px] border-slate-900 border-dotted origin-left z-0 -translate-y-1/2 opacity-30" />
                                <div className="absolute top-1/2 left-1/2 -translate-x-[calc(50%+0.0625rem)] -translate-y-1/2 w-2 h-2 rounded-full bg-slate-900"></div>
                            </motion.div>
                        )}
                        </AnimatePresence>
                    </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-sm min-h-[400px]">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h2 className="text-xl font-semibold text-slate-900 flex items-center gap-2.5">
                                <Hash className="w-6 h-6 text-emerald-500" />
                                Memory Shards
                            </h2>
                            <p className="text-sm text-slate-500 mt-1.5 font-medium">LRU Cache State across active instances ({cluster.nodes.length} physical nodes, {cluster.replicas} virtual shards each)</p>
                        </div>
                        <button onClick={() => refreshCluster()} className="text-slate-400 hover:text-slate-700 bg-slate-50 p-2.5 rounded-xl hover:bg-slate-100 transition-colors border border-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-200">
                            <Activity className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <AnimatePresence>
                        {cluster.nodes.map(nodeId => {
                            const cIndex = getNodeColorIndex(nodeId);
                            const isActiveTarget = latestKeyHash?.targetNode === nodeId;
                            return (
                                <motion.div 
                                    layout
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                    key={nodeId}
                                    className={cn(
                                        "bg-white border-[1.5px] rounded-2xl p-5 flex flex-col relative overflow-hidden transition-all", 
                                        borderColors[cIndex],
                                        isActiveTarget ? ringColors[cIndex] + ' ring-2 ring-offset-2' : ''
                                    )}
                                >
                                    {isActiveTarget && (
                                        <div className={cn("absolute inset-0 opacity-5", colors[cIndex])}></div>
                                    )}
                                    {/* Node Header */}
                                    <div className="flex items-center justify-between mb-5 border-b border-slate-100 pb-4 relative z-10">
                                        <div className="flex items-center gap-2.5">
                                            <div className={cn("w-3 h-3 rounded-full", colors[cIndex])} />
                                            <span className={cn("font-mono font-bold tracking-tight text-[15px]", textColors[cIndex])}>{nodeId}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-50 border border-slate-100">
                                            <span className="text-xs font-semibold text-slate-600">
                                                {Object.keys(cluster.state[nodeId] || {}).length}
                                            </span>
                                            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">/ 5 Keys</span>
                                        </div>
                                    </div>

                                    {/* Node Data */}
                                    <div className="flex-1 space-y-2.5 min-h-[140px] relative z-10">
                                        {Object.entries(cluster.state[nodeId] || {}).map(([cKey, cVal]) => (
                                            <motion.div 
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                key={cKey} 
                                                className={cn(
                                                    "text-xs bg-slate-50 border rounded-xl p-3 flex flex-col gap-1.5 transition-colors shadow-sm",
                                                    latestKeyHash?.key === cKey ? `border-indigo-300 bg-indigo-50/50` : `border-slate-200`
                                                )}
                                            >
                                                <span className="font-mono text-slate-700 font-semibold truncate text-[13px]">{cKey}</span>
                                                <span className="text-slate-500 truncate pt-1.5 font-mono bg-white px-2 py-1.5 rounded-lg border border-slate-100">{cVal as string}</span>
                                            </motion.div>
                                        ))}
                                        {Object.keys(cluster.state[nodeId] || {}).length === 0 && (
                                            <div className="flex items-center justify-center h-full text-sm text-slate-400 font-mono bg-slate-50/50 rounded-xl border border-dashed border-slate-200 p-6">
                                                [ Idle Node ]
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            );
                        })}
                        </AnimatePresence>

                        {cluster.nodes.length === 0 && (
                            <div className="col-span-full py-24 flex flex-col items-center justify-center text-slate-400 gap-5 border-[2px] border-dashed border-slate-200 rounded-3xl bg-slate-50/50">
                                <Database className="w-14 h-14 opacity-40 text-slate-400" />
                                <p className="font-medium text-slate-500">Cluster offline. Add a node to begin storing cache data.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            
        </div>
      </div>
    </div>
  );
}
