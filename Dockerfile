FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8082

COPY ds-jaja/package*.json ./
RUN npm ci --omit=dev

COPY ds-jaja/server.js ./
COPY ds-jaja/src ./src
COPY ds-jaja/public ./public
COPY ds-jaja/scripts ./scripts

RUN mkdir -p /app/data && chown -R node:node /app

USER node

EXPOSE 8082

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 8082) + '/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
