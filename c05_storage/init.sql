-- 1. Create the database
CREATE DATABASE IF NOT EXISTS hsm_db;
USE hsm_db;

-- 2. Create the table
CREATE TABLE IF NOT EXISTS processed_images (
    id INT AUTO_INCREMENT PRIMARY KEY,
    job_id VARCHAR(255) NOT NULL,
    image_data LONGBLOB NOT NULL,
    processed_at DATETIME NOT NULL
);

-- 3. Grant remote access to root (The Fix for c03_master)
-- This allows root to connect from any IP using the password 'root'
ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY 'root';
CREATE USER IF NOT EXISTS 'root'@'%' IDENTIFIED WITH mysql_native_password BY 'root';
GRANT ALL PRIVILEGES ON *.* TO 'root'@'%' WITH GRANT OPTION;
FLUSH PRIVILEGES;