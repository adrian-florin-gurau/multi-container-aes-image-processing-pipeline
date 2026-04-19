# Stage 1: Build
# We use the ISM image to ensure any shared libraries or headers are present
FROM critoma/amd64_u24_noble_ism_security AS builder

# Install Node.js (since the base is Ubuntu-based)
RUN apt-get update && apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Stage 2: Production
FROM critoma/amd64_u24_noble_ism_security AS runner

# Install Node.js runtime only
RUN apt-get update && apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm install --omit=dev

# Copy build from stage 1
COPY --from=builder /app/dist ./dist

EXPOSE 3001

CMD ["node", "dist/main"]