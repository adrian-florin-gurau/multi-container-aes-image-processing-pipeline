const os = require('os');
const { MongoClient } = require('mongodb');

async function collectMetrics() {
    const client = new MongoClient('mongodb://localhost:27017');
    try {
        await client.connect();
        const db = client.db('hsm_metrics');
        
        const stats = {
            node: os.hostname(),
            os: os.type(),
            cpuUsage: os.loadavg()[0], // 1 minute load avg
            freeMem: os.freemem(),
            totalMem: os.totalmem(),
            timestamp: new Date()
        };

        await db.collection('nodes').insertOne(stats);
        console.log("Metrics saved to MongoDB");
    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}

// Collect every 10 seconds
setInterval(collectMetrics, 10000);