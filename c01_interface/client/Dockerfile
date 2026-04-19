# Use the mandatory assignment image
FROM critoma/amd64_u24_noble_ism_security

# Avoid prompts during installation
ENV DEBIAN_FRONTEND=noninteractive

# 1. Install Node.js (Version 20 is stable)
RUN apt-get update && apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs

# 2. Set the working directory
WORKDIR /app

# 3. Copy package files first (for better caching)
COPY package*.json ./

# 4. Install dependencies
RUN npm install

# 5. Copy the rest of the application
COPY . .

# 6. Build the Next.js app
# (Assuming you're using 'output: standalone' in next.config.js for K8s optimization)
RUN npm run build

# 7. Expose the default Next.js port
EXPOSE 3000

# 8. Start the app
CMD ["npm", "run", "start"]