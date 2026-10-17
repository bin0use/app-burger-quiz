FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

# Dépendances d'abord (mise en cache des couches)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY . .
# Dossier de sauvegarde de la partie accessible à l'utilisateur non-root
RUN mkdir -p data && chown node:node data

USER node
EXPOSE 3000

CMD ["node", "server.js"]
