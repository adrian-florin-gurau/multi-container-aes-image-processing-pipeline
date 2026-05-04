const express = require('express');
const mysql = require('mysql2/promise');
const { MongoClient } = require('mongodb');
const app = express();

const mysqlConfig = {
    host: 'c05_storage',
    user: 'root',
    password: 'root',
    database: 'hsm_db'
};

// 1. Endpoint for BMP picture rendering
app.get('/image/:jobId', async (req, res) => {
    try {
        const connection = await mysql.createConnection(mysqlConfig);
        const [rows] = await connection.execute(
            'SELECT image_data FROM processed_images WHERE job_id = ?', 
            [req.params.jobId]
        );

        if (rows.length > 0) {
            // Force download behavior
            res.setHeader('Content-Disposition', `attachment; filename="result_${req.params.jobId}.bmp"`);
            res.setHeader('Content-Type', 'image/bmp');
            res.send(rows[0].image_data);
        } else {
            res.status(404).send('Image not found');
        }
    } catch (err) {
        res.status(500).send(err.message);
    }
});

const mongoClient = new MongoClient('mongodb://127.0.0.1:27017', {
    serverSelectionTimeoutMS: 2000 
});

let db;

// 2. Endpoint for SNMP/Metrics display
app.get('/metrics', async (req, res) => {
    try {
        // If the initial connection failed, try to connect now
        if (!db) {
            await mongoClient.connect();
            db = mongoClient.db('hsm_metrics');
        }
        
        const docs = await db.collection('nodes').find().toArray();
        res.json(docs);
    } catch (err) {
        console.error("Mongo Error:", err);
        res.status(500).send("Database connection error: " + err.message);
    }
});

app.listen(8081, '0.0.0.0', () => console.log('C05 API running on port 8081'));