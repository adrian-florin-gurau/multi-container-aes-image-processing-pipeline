FROM critoma/amd64_u24_noble_ism_security

# 1.1. Install dependencies, GPG keys, and the MongoDB repository
RUN apt-get update && apt-get install -y \
    mysql-server \
    nodejs \
    npm \
    curl \
    gnupg \
    && rm -f /usr/share/keyrings/mongodb-server-8.0.gpg \
    && curl -fsSL https://www.mongodb.org/static/pgp/server-8.0.asc | \
       gpg --batch --dearmor -o /usr/share/keyrings/mongodb-server-8.0.gpg \
    && echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-8.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/8.0 multiverse" | \
       tee /etc/apt/sources.list.d/mongodb-org-8.0.list

# 1.2. Install MongoDB-org
RUN apt-get update && apt-get install -y \
    mongodb-org \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# 2. Setup Node.js dependencies
COPY package.json .
RUN npm install

# 3. Copy source files
COPY . .

# 4. Setup MySQL initialization
RUN mkdir -p /docker-entrypoint-initdb.d && cp init.sql /docker-entrypoint-initdb.d/

# 5. Start-up script to run all three services
# In a real environment we'd use 'supervisord', but a shell script works for school
# Start MySQL, Mongo, the Metrics Collector, AND the REST API
CMD service mysql start && \
    mongod --fork --logpath /var/log/mongodb.log && \
    node snmp_collector.js & \
    node server.js