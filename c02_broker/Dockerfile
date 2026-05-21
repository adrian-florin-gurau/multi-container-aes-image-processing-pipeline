FROM critoma/amd64_u24_noble_ism_security

RUN apt-get update && apt-get install -y \
    rabbitmq-server \
    snmpd \
    && apt-get clean

RUN printf "agentAddress udp:161\nrocommunity public 0.0.0.0/0\n" > /etc/snmp/snmpd.conf

RUN rabbitmq-plugins enable --offline rabbitmq_management

RUN echo "loopback_users = none" > /etc/rabbitmq/rabbitmq.conf && \
    echo "load_definitions = /etc/rabbitmq/definitions.json" >> /etc/rabbitmq/rabbitmq.conf

COPY definitions.json /etc/rabbitmq/definitions.json
RUN chown rabbitmq:rabbitmq /etc/rabbitmq/definitions.json

EXPOSE 5672 15672

CMD ["sh", "-c", "service snmpd start && rabbitmq-server"]
