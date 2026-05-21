FROM critoma/amd64_u24_noble_ism_security

USER root
RUN apt-get update && apt-get install -y \
    openjdk-17-jdk \
    g++ \
    openmpi-bin \
    libopenmpi-dev \
    snmpd \
    && apt-get clean

RUN printf "agentAddress udp:161\nrocommunity public 0.0.0.0/0\n" > /etc/snmp/snmpd.conf

WORKDIR /app

COPY ./lib /app/lib
COPY HsmSubscriber.java /app/
COPY hsm_worker.cpp /app/

RUN apt-get update && apt-get install -y openssh-server openssh-client

RUN mkdir /var/run/sshd && \
    echo 'root:root' | chpasswd && \
    sed -i 's/#PermitRootLogin prohibit-password/PermitRootLogin yes/' /etc/ssh/sshd_config && \
    ssh-keygen -A

RUN ssh-keygen -t rsa -f /root/.ssh/id_rsa -N "" && \
    cp /root/.ssh/id_rsa.pub /root/.ssh/authorized_keys && \
    echo "StrictHostKeyChecking no" >> /etc/ssh/ssh_config

RUN apt-get update && apt-get install -y \
    openjdk-17-jdk \
    g++ \
    openmpi-bin \
    libopenmpi-dev \
    libssl-dev \
    && apt-get clean

RUN mpic++ -fopenmp hsm_worker.cpp -o hsm_worker -lcrypto

RUN javac -cp ".:lib/*" HsmSubscriber.java

ENV OMPI_ALLOW_RUN_AS_ROOT=1
ENV OMPI_ALLOW_RUN_AS_ROOT_CONFIRM=1

RUN ssh-keygen -A

CMD ["sh", "-c", "service snmpd start && mkdir -p /tmp/hsm/ssh && cp /root/.ssh/id_rsa.pub /tmp/hsm/ssh/master_key.pub && sleep 2 && cat /tmp/hsm/ssh/master_key.pub >> /root/.ssh/authorized_keys && /usr/sbin/sshd && java -cp .:lib/* HsmSubscriber"]
