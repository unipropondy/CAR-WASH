FROM node:18-alpine

WORKDIR /app

# Install backend dependencies
COPY Backend/package*.json ./
RUN npm ci --only=production

# Copy backend application
COPY Backend/ .

EXPOSE 5000

ENV NODE_ENV=production
ENV HOST=0.0.0.0

CMD ["node", "Server.js"]
