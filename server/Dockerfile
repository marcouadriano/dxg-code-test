# One image for both the API (default command) and the audit worker
# (`node dist/audit-worker/main.js`). See "Docker Compose" in README.md.

FROM docker.io/library/node:24-slim AS build
WORKDIR /app
RUN npm install -g pnpm@12.4.1

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
RUN pnpm build && pnpm prune --prod

FROM docker.io/library/node:24-slim
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
RUN mkdir -p uploads/photos && chown -R node:node uploads

USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
