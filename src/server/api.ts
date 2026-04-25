import { Router } from 'express';
import mongoose from 'mongoose';
import { cacheCluster } from './cacheCluster';

const router = Router();

// DB connection state helper
const isDbConnected = () => mongoose.connection.readyState === 1;

// Define a simple Mongoose schema for the persistent DB layer
interface IDataPair {
  key: string;
  value: string;
}

const DataPairSchema = new mongoose.Schema<IDataPair>({
  key: { type: String, required: true, unique: true },
  value: { type: String, required: true },
});
const DataPair = mongoose.models.DataPair || mongoose.model<IDataPair>('DataPair', DataPairSchema);

// In-memory fallback if Mongo is disconnected
const fallbackDb = new Map<string, string>();


// Simulated Database Interaction with slight delay to show "cache miss" latency overhead
const dbGet = async (key: string): Promise<string | null> => {
    await new Promise(r => setTimeout(r, 800)); // Simulate DB latency
    if (isDbConnected()) {
        const doc = await DataPair.findOne({ key });
        return doc ? doc.value : null;
    }
    return fallbackDb.get(key) || null;
};

const dbSet = async (key: string, value: string) => {
    await new Promise(r => setTimeout(r, 800)); // Simulate DB write latency
    if (isDbConnected()) {
        await DataPair.findOneAndUpdate({ key }, { value }, { upsert: true });
    } else {
        fallbackDb.set(key, value);
    }
};

const dbDelete = async (key: string) => {
    if (isDbConnected()) {
        await DataPair.deleteOne({ key });
    } else {
        fallbackDb.delete(key);
    }
}


// --- API Routes ---

// Get overall cluster state
router.get('/cluster', (req, res) => {
    res.json({
        nodes: Array.from(cacheCluster.nodes.keys()),
        state: cacheCluster.getState(),
        ring: cacheCluster.ring,
        ringMap: Object.fromEntries(cacheCluster.ringMap),
        replicas: cacheCluster.replicas,
        dbConnected: isDbConnected(),
        dbDocs: isDbConnected() ? "Available in MongoDB" : fallbackDb.size + " docs (in-memory persistent mockup)"
    });
});

// Configure nodes
router.post('/cluster/node', (req, res) => {
    const { nodeId } = req.body;
    if (!nodeId) return res.status(400).json({ error: 'Node ID missing' });
    cacheCluster.addNode(nodeId);
    res.json({ success: true, nodes: Array.from(cacheCluster.nodes.keys()) });
});

router.delete('/cluster/node/:nodeId', (req, res) => {
    const { nodeId } = req.params;
    cacheCluster.removeNode(nodeId);
    res.json({ success: true, nodes: Array.from(cacheCluster.nodes.keys()) });
});

// Get/Set data
router.get('/data/:key', async (req, res) => {
    const { key } = req.params;
    const start = Date.now();
    const keyHash = cacheCluster.hash(key);
    
    // 1. Try Cache
    const node = cacheCluster.getNode(key);
    if (!node) {
        return res.status(500).json({ error: 'No cache nodes available' });
    }

    const cachedValue = node.cache.get(key);
    
    if (cachedValue) {
        // Cache Hit!
        return res.json({
            key,
            hash: keyHash,
            value: cachedValue,
            source: 'cache',
            nodeId: node.id,
            timeMs: Date.now() - start
        });
    }

    // 2. Cache Miss - Load from DB
    const dbValue = await dbGet(key);
    if (dbValue) {
        // Populate cache
        node.cache.set(key, dbValue);
        
        return res.json({
            key,
            hash: keyHash,
            value: dbValue,
            source: 'database',
            nodeId: node.id,
            timeMs: Date.now() - start
        });
    }

    // Not found anywhere
    res.status(404).json({ error: 'Key not found' });
});

router.post('/data', async (req, res) => {
    const { key, value, ttlSeconds } = req.body;
    if (!key || !value) return res.status(400).json({ error: 'Missing key or value' });

    const start = Date.now();
    const keyHash = cacheCluster.hash(key);

    // 1. Write to DB first (Database-source-of-truth)
    await dbSet(key, value);

    // 2. Invalidate or update cache (we will update it for Cache-Aside/Write-Through)
    const node = cacheCluster.getNode(key);
    if (node) {
        node.cache.set(key, value, ttlSeconds);
    }

    res.json({ success: true, key, hash: keyHash, timeMs: Date.now() - start, assignedNode: node?.id });
});

router.post('/data/:key/incr', async (req, res) => {
    const { key } = req.params;
    const start = Date.now();
    const keyHash = cacheCluster.hash(key);
    const node = cacheCluster.getNode(key);
    
    if (!node) {
        return res.status(500).json({ error: 'No cache nodes available' });
    }
    
    // Simulate atomic DB operation
    const dbValue = await dbGet(key);
    const num = dbValue ? parseInt(dbValue, 10) : 0;
    const nextVal = (isNaN(num) ? 0 : num) + 1;
    await dbSet(key, nextVal.toString());

    // Update Cache
    const finalVal = node.cache.incr(key);

    res.json({ success: true, key, hash: keyHash, value: finalVal.toString(), timeMs: Date.now() - start, assignedNode: node.id });
});

export default router;
