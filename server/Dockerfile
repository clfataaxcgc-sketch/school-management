FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

# Uploaded files are saved per school in uploads/<schoolId>/... Mount a volume
# here in production so they survive container restarts (see docker-compose.yml).
# The app runs as the unprivileged "node" user, not as root.
RUN mkdir -p uploads && chown -R node:node /app
USER node

EXPOSE 5000
CMD ["node", "server.js"]
