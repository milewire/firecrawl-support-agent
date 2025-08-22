FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Expose port (Railway will handle this)
EXPOSE 3000

# Start the simplified Railway bot
CMD ["node", "railway-bot.mjs"]
