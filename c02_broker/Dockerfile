FROM critoma/amd64_u24_noble_ism_security

# 1. Update and install RabbitMQ
RUN apt-get update && apt-get install -y \
    rabbitmq-server \
    && apt-get clean

# 2. Enable Management Plugin (Offline mode ensures it's baked into the image)
RUN rabbitmq-plugins enable --offline rabbitmq_management

# 3. Create a clean configuration file
# This allows guest access and loads your specific definitions
RUN echo "loopback_users = none" > /etc/rabbitmq/rabbitmq.conf && \
    echo "load_definitions = /etc/rabbitmq/definitions.json" >> /etc/rabbitmq/rabbitmq.conf

# 4. Copy the definitions (Queues, Users, Exchanges)
COPY definitions.json /etc/rabbitmq/definitions.json
RUN chown rabbitmq:rabbitmq /etc/rabbitmq/definitions.json

# 5. Expose necessary ports
# 5672: AMQP, 15672: Management UI
EXPOSE 5672 15672

# 6. Start the server
CMD ["rabbitmq-server"]