FROM node:22-alpine

WORKDIR /app

# Install build dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy application code
COPY . .

# Expose backend port
EXPOSE 5000

ENV NODE_ENV=production
ENV HOST=0.0.0.0

# Start server
CMD ["node", "Server.js"]
