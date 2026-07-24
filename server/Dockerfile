# 1단계: node.js 버전 24.15.0
FROM node:24-alpine AS builder

WORKDIR /app

COPY package*.json ./

# 의존성 설치 
RUN npm ci

COPY . .
#dist 폴더 생성 
RUN npm run build


# 2단계: 실제 실행
FROM node:24-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/config/application.yaml ./src/config/application.yaml
COPY --from=builder /app/schema.sql ./schema.sql

EXPOSE 8080

CMD ["node", "dist/app.js"]