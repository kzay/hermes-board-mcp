FROM node:20-slim AS builder

WORKDIR /app

COPY server/package.json server/package-lock.json* server/tsconfig.json ./
RUN npm ci

COPY server/src/ src/
COPY server/policy.yaml .
RUN npm run build

FROM node:20-slim

WORKDIR /app

COPY server/package.json server/package-lock.json* ./
RUN npm ci --omit=dev 2>/dev/null || npm install --omit=dev

COPY --from=builder /app/dist /app/dist
COPY server/policy.yaml .

ENV PORT=7332
ENV PATH="/root/.local/bin:$PATH"

EXPOSE 7332

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:7332/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

ENTRYPOINT ["node", "dist/src/cli.js", "start"]
