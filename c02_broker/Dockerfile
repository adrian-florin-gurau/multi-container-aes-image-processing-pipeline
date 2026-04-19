FROM critoma/amd64_u24_noble_ism_security

# Avoid prompts during installation
ENV DEBIAN_FRONTEND=noninteractive

# 1. Update and install RabbitMQ
RUN apt-get update && apt-get install -y \
    rabbitmq-server \
    && apt-get clean

# 2. Enable the Management Plugin (Dashboard)
RUN rabbitmq-plugins enable rabbitmq_management

# 3. Configure RabbitMQ to allow guest access from outside localhost
# By default, RabbitMQ guest user is restricted to localhost
RUN echo "loopback_users = none" > /etc/rabbitmq/rabbitmq.conf

# 4. Expose standard ports
# 5672: AMQP protocol (for NestJS connection)
# 15672: Management UI (for your browser)
EXPOSE 5672 15672

# Copy the definitions file into the container
COPY definitions.json /etc/rabbitmq/definitions.json

# Tell RabbitMQ to load the definitions on startup
RUN echo "load_definitions = /etc/rabbitmq/definitions.json" >> /etc/rabbitmq/rabbitmq.conf

RUN rabbitmq-plugins enable --offline rabbitmq_management

# 5. Start the server
# We use 'rabbitmq-server' directly so it runs as the main process
CMD ["rabbitmq-server"]