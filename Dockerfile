# Use Node.js LTS version
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files (server)
COPY server/package*.json ./server/

# Install production dependencies
WORKDIR /app/server
RUN npm ci --only=production

# Back to app root
WORKDIR /app

# Copy server code
COPY server/ ./server/

# Copy frontend files
COPY index.html vitamind.css ./
COPY modules/ ./modules/
COPY icons/ ./icons/
COPY manifest.json sw.js ./

# Create non-root user for security
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

# Change ownership
RUN chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

# Expose port (Fly.io uses 8080)
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

# Start the application
CMD ["node", "server/index.js"]