# Use the mandatory security image
FROM critoma/amd64_u24_noble_ism_security

# 1. Install Java 17 and OpenMPI development tools
# We need g++ and mpi-bin to compile and run the native worker
USER root
RUN apt-get update && apt-get install -y \
    openjdk-17-jdk \
    g++ \
    openmpi-bin \
    libopenmpi-dev \
    && apt-get clean

# 2. Set working directory
WORKDIR /app

# 3. Copy dependencies and source code
# Ensure your local folder has: HsmSubscriber.java, hsm_worker.cpp, and /lib folder
COPY ./lib /app/lib
COPY HsmSubscriber.java /app/
COPY hsm_worker.cpp /app/

# Install SSH components
RUN apt-get update && apt-get install -y openssh-server openssh-client

# Configure SSH for MPI
RUN mkdir /var/run/sshd && \
    echo 'root:root' | chpasswd && \
    sed -i 's/#PermitRootLogin prohibit-password/PermitRootLogin yes/' /etc/ssh/sshd_config && \
    ssh-keygen -A

# Generate keys so containers can talk without passwords
RUN ssh-keygen -t rsa -f /root/.ssh/id_rsa -N "" && \
    cp /root/.ssh/id_rsa.pub /root/.ssh/authorized_keys && \
    echo "StrictHostKeyChecking no" >> /etc/ssh/ssh_config

# 4. Compile the Native C++ Worker
# -fopenmp enables the OpenMP parallel loops
# -o hsm_worker creates the binary that Java will call
RUN mpic++ -fopenmp hsm_worker.cpp -o hsm_worker

# 5. Compile the Java POJO Subscriber
# We include the lib folder in the classpath so it finds RabbitMQ and MySQL drivers
RUN javac -cp ".:lib/*" HsmSubscriber.java

# 6. Set Environment Variables
# Helps OpenMPI run smoothly inside Docker containers
ENV OMPI_ALLOW_RUN_AS_ROOT=1
ENV OMPI_ALLOW_RUN_AS_ROOT_CONFIRM=1

RUN ssh-keygen -A

# 7. Start the Java Subscriber
# The classpath must include the current directory (.) and all JARs in lib
# 7. Use a startup script to synchronize keys
CMD ["sh", "-c", "mkdir -p /tmp/hsm/ssh && cp /root/.ssh/id_rsa.pub /tmp/hsm/ssh/master_key.pub && sleep 2 && cat /tmp/hsm/ssh/master_key.pub >> /root/.ssh/authorized_keys && /usr/sbin/sshd && java -cp .:lib/* HsmSubscriber"]