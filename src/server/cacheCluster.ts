import crypto from 'crypto';

export interface CacheItem {
  value: string;
  expiresAt: number | null;
}

export class LRUCache {
  capacity: number;
  data: Map<string, CacheItem>;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.data = new Map();
  }

  get(key: string): string | null {
    if (!this.data.has(key)) return null;
    const item = this.data.get(key)!;
    if (item.expiresAt !== null && Date.now() > item.expiresAt) {
      this.data.delete(key);
      return null;
    }
    this.data.delete(key);
    this.data.set(key, item);
    return item.value;
  }

  set(key: string, value: string, ttlSeconds?: number) {
    if (this.data.has(key)) {
      this.data.delete(key);
    } else if (this.data.size >= this.capacity) {
      const firstKey = this.data.keys().next().value;
      if (firstKey !== undefined) {
        this.data.delete(firstKey);
      }
    }
    const expiresAt = ttlSeconds ? Date.now() + (ttlSeconds * 1000) : null;
    this.data.set(key, { value, expiresAt });
  }

  incr(key: string): number {
    const current = this.get(key);
    const num = current ? parseInt(current, 10) : 0;
    const nextVal = (isNaN(num) ? 0 : num) + 1;
    
    // Preserve existing TTL if present
    let ttlSeconds = undefined;
    const existingEntry = this.data.get(key);
    if (existingEntry && existingEntry.expiresAt) {
        ttlSeconds = Math.max(0, Math.ceil((existingEntry.expiresAt - Date.now()) / 1000));
    }
    
    this.set(key, nextVal.toString(), ttlSeconds);
    return nextVal;
  }

  remove(key: string) {
    this.data.delete(key);
  }

  clear() {
    this.data.clear();
  }
}

export class CacheNode {
  id: string;
  cache: LRUCache;

  constructor(id: string, capacity: number = 5) {
    this.id = id;
    this.cache = new LRUCache(capacity);
  }
}

export const MAX_HASH = 0xffffffff; // 32-bit max value (4,294,967,295)

export class ConsistentHashRing {
  nodes: Map<string, CacheNode> = new Map();
  ring: number[] = [];
  ringMap: Map<number, string> = new Map();
  replicas: number = 3; // Virtual nodes to ensure even distribution

  // Expose the hashing algorithm: MD5 truncated to 32-bit int
  public hash(key: string): number {
    const hashStr = crypto.createHash('md5').update(key).digest('hex');
    return parseInt(hashStr.substring(0, 8), 16);
  }

  addNode(id: string, capacity: number = 5) {
    if (this.nodes.has(id)) return;
    this.nodes.set(id, new CacheNode(id, capacity));
    
    // Add replicas (virtual nodes) for this physical node
    for (let i = 0; i < this.replicas; i++) {
        const nodeHash = this.hash(`${id}:${i}`);
        this.ring.push(nodeHash);
        this.ringMap.set(nodeHash, id);
    }
    
    // Keep ring sorted to allow quick binary search (or linear search for simplicity here)
    this.ring.sort((a, b) => a - b);
  }

  removeNode(id: string) {
    if (!this.nodes.has(id)) return;
    const node = this.nodes.get(id);
    
    this.nodes.delete(id);
    
    // Remove all replicas of this node from the ring
    for (let i = 0; i < this.replicas; i++) {
      const nodeHash = this.hash(`${id}:${i}`);
      this.ring = this.ring.filter(h => h !== nodeHash);
      this.ringMap.delete(nodeHash);
    }
  }

  // Consistent Hashing mapping: find the first node on the ring with hash >= keyHash
  getNode(key: string): CacheNode | null {
    if (this.ring.length === 0) return null;
    const keyHash = this.hash(key);
    
    for (const nodeHash of this.ring) {
      if (keyHash <= nodeHash) {
        return this.nodes.get(this.ringMap.get(nodeHash)!) || null;
      }
    }
    
    // Wrap around the ring to the first node if keyHash is greater than all node hashes
    return this.nodes.get(this.ringMap.get(this.ring[0])!) || null;
  }

  getState() {
    const state: any = {};
    const now = Date.now();
    for (const [id, node] of this.nodes.entries()) {
      const nodeData: any = {};
      for (const [k, v] of node.cache.data.entries()) {
        if (v.expiresAt !== null && now > v.expiresAt) {
          node.cache.data.delete(k); // Lazy eviction
        } else {
          // Send back simple strings: "val" or "val (TTL: Xs)"
          const ttlStr = v.expiresAt !== null ? ` (TTL: ${Math.ceil((v.expiresAt - now)/1000)}s)` : '';
          nodeData[k] = `${v.value}${ttlStr}`;
        }
      }
      state[id] = nodeData;
    }
    return state;
  }
}

export const cacheCluster = new ConsistentHashRing();
// Add initial nodes
cacheCluster.addNode('node-alpha');
cacheCluster.addNode('node-beta');
cacheCluster.addNode('node-gamma');
