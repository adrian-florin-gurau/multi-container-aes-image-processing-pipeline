FROM critoma/amd64_u24_noble_ism_security

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
    mysql-server nodejs npm curl gnupg ca-certificates snmpd && \
    mkdir -p /usr/share/keyrings && \
    rm -f /usr/share/keyrings/mongodb-server-8.0.gpg && \
    curl -fsSL https://www.mongodb.org/static/pgp/server-8.0.asc | \
    gpg --batch --yes --dearmor -o /usr/share/keyrings/mongodb-server-8.0.gpg && \
    echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-8.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/8.0 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-8.0.list && \
    apt-get update && \
    apt-get install -y mongodb-org && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

RUN printf "agentAddress udp:161\nrocommunity public 0.0.0.0/0\n" > /etc/snmp/snmpd.conf

WORKDIR /app

COPY package.json .
RUN npm install

COPY . .

RUN mkdir -p /docker-entrypoint-initdb.d && cp init.sql /docker-entrypoint-initdb.d/

CMD service snmpd start && \
    service mysql start && \
    mongod --fork --logpath /var/log/mongodb.log --bind_ip_all && \
    echo "Waiting for services..." && \
    sleep 10 && \
    node snmp_collector.js & \
    node server.js
