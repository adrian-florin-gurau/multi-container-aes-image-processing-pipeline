FROM critoma/amd64_u24_noble_ism_security

# Avoid prompts during installation
ENV DEBIAN_FRONTEND=noninteractive

# 1.1. & 1.2. Install dependencies (MySQL, Node, Mongo)
RUN apt-get update && apt-get install -y --no-install-recommends \
    mysql-server nodejs npm curl gnupg ca-certificates && \
    # 2. Setup MongoDB Key (Added --yes to gpg and -f to rm to prevent "File exists" error)
    mkdir -p /usr/share/keyrings && \
    rm -f /usr/share/keyrings/mongodb-server-8.0.gpg && \
    curl -fsSL https://www.mongodb.org/static/pgp/server-8.0.asc | \
    gpg --batch --yes --dearmor -o /usr/share/keyrings/mongodb-server-8.0.gpg && \
    # 3. Add Repository (Jammy is the correct target for 8.0 on Noble right now)
    echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-8.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/8.0 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-8.0.list && \
    # 4. Final Install
    apt-get update && \
    apt-get install -y mongodb-org && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Set the working directory
WORKDIR /app

# 2. Setup Node.js dependencies
COPY package.json .
RUN npm install

# 3. Copy source files
COPY . .

# 4. Setup MySQL initialization
RUN mkdir -p /docker-entrypoint-initdb.d && cp init.sql /docker-entrypoint-initdb.d/

# 5. Start-up script
CMD service mysql start && \
    mongod --fork --logpath /var/log/mongodb.log --bind_ip_all && \
    node snmp_collector.js & \
    node server.js