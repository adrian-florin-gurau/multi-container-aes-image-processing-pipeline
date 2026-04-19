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

// 2. Endpoint for SNMP/Metrics display
app.get('/metrics', async (req, res) => {
    const client = new MongoClient('mongodb://localhost:27017');
    try {
        await client.connect();
        const docs = await client.db('hsm_metrics').collection('nodes').find().toArray();
        res.json(docs);
    } finally {
        await client.close();
    }
});

app.listen(8081, '0.0.0.0', () => console.log('C05 API running on port 8081'));