const snmp = require('net-snmp');
const { MongoClient } = require('mongodb');

const targets = (process.env.SNMP_TARGETS || 'c01_frontend,c01_backend,c02_broker,c03_master,c04_worker,c05_storage')
    .split(',')
    .map((target) => target.trim())
    .filter(Boolean);

const community = process.env.SNMP_COMMUNITY || 'public';
const mongoClient = new MongoClient('mongodb://127.0.0.1:27017');

const oids = {
    sysDescr: '1.3.6.1.2.1.1.1.0',
    sysName: '1.3.6.1.2.1.1.5.0',
    hrProcessorLoad: '1.3.6.1.2.1.25.3.3.1.2',
    hrStorageDescr: '1.3.6.1.2.1.25.2.3.1.3',
    hrStorageAllocationUnits: '1.3.6.1.2.1.25.2.3.1.4',
    hrStorageSize: '1.3.6.1.2.1.25.2.3.1.5',
    hrStorageUsed: '1.3.6.1.2.1.25.2.3.1.6'
};

function createSession(target) {
    return snmp.createSession(target, community, {
        timeout: 1500,
        retries: 1,
        version: snmp.Version2c
    });
}

function get(session, oid) {
    return new Promise((resolve, reject) => {
        session.get([oid], (error, varbinds) => {
            if (error) {
                reject(error);
                return;
            }

            const varbind = varbinds[0];
            if (snmp.isVarbindError(varbind)) {
                reject(new Error(snmp.varbindError(varbind)));
                return;
            }

            resolve(String(varbind.value));
        });
    });
}

function subtree(session, oid) {
    return new Promise((resolve, reject) => {
        const values = {};

        session.subtree(
            oid,
            (varbinds) => {
                for (const varbind of varbinds) {
                    if (!snmp.isVarbindError(varbind)) {
                        const index = varbind.oid.slice(oid.length + 1);
                        values[index] = varbind.value;
                    }
                }
            },
            (error) => {
                if (error) {
                    reject(error);
                    return;
                }

                resolve(values);
            }
        );
    });
}

function average(values) {
    const numbers = Object.values(values).map(Number).filter((value) => Number.isFinite(value));
    if (numbers.length === 0) {
        return null;
    }

    return numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
}

function getPhysicalMemory(descriptions, allocationUnits, sizes, used) {
    const entry = Object.entries(descriptions).find(([, description]) => {
        const text = String(description).toLowerCase();
        return text.includes('physical memory') || text.includes('real memory') || text === 'memory';
    });

    if (!entry) {
        return { totalMem: null, usedMem: null, freeMem: null };
    }

    const index = entry[0];
    const unit = Number(allocationUnits[index]);
    const size = Number(sizes[index]);
    const usedSize = Number(used[index]);

    if (![unit, size, usedSize].every(Number.isFinite)) {
        return { totalMem: null, usedMem: null, freeMem: null };
    }

    const totalMem = unit * size;
    const usedMem = unit * usedSize;

    return {
        totalMem,
        usedMem,
        freeMem: totalMem - usedMem
    };
}

async function collectTarget(target) {
    const session = createSession(target);

    try {
        const [os, nodeName, processorLoad, storageDescr, allocationUnits, storageSize, storageUsed] = await Promise.all([
            get(session, oids.sysDescr),
            get(session, oids.sysName),
            subtree(session, oids.hrProcessorLoad),
            subtree(session, oids.hrStorageDescr),
            subtree(session, oids.hrStorageAllocationUnits),
            subtree(session, oids.hrStorageSize),
            subtree(session, oids.hrStorageUsed)
        ]);

        return {
            node: target,
            snmpName: nodeName,
            os,
            cpuUsage: average(processorLoad),
            ...getPhysicalMemory(storageDescr, allocationUnits, storageSize, storageUsed),
            source: 'snmp',
            timestamp: new Date()
        };
    } finally {
        session.close();
    }
}

async function collectMetrics() {
    try {
        await mongoClient.connect();
        const db = mongoClient.db('hsm_metrics');

        const results = await Promise.allSettled(targets.map(collectTarget));
        const docs = results.map((result, index) => {
            if (result.status === 'fulfilled') {
                return result.value;
            }

            return {
                node: targets[index],
                source: 'snmp',
                error: result.reason.message,
                timestamp: new Date()
            };
        });

        if (docs.length > 0) {
            await db.collection('nodes').insertMany(docs);
            console.log(`SNMP metrics saved for ${docs.length} nodes`);
        }
    } catch (error) {
        console.error(error);
    }
}

collectMetrics();
setInterval(collectMetrics, 10000);
