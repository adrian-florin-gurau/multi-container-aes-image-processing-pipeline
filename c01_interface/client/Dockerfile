FROM critoma/amd64_u24_noble_ism_security

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs snmpd

RUN printf "agentAddress udp:161\nrocommunity public 0.0.0.0/0\n" > /etc/snmp/snmpd.conf

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run build

EXPOSE 3000

CMD ["sh", "-c", "service snmpd start && npm run start"]
