FROM critoma/amd64_u24_noble_ism_security AS builder

RUN apt-get update && apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

FROM critoma/amd64_u24_noble_ism_security AS runner

RUN apt-get update && apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs snmpd && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

RUN printf "agentAddress udp:161\nrocommunity public 0.0.0.0/0\n" > /etc/snmp/snmpd.conf

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist

EXPOSE 3001

CMD ["sh", "-c", "service snmpd start && node dist/main"]
