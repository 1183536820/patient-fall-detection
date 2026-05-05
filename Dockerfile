# 第一阶段：构建前端
FROM node:18 AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# 第二阶段：运行后端
FROM node:18

WORKDIR /app

RUN apt-get update && apt-get install -y python3 python3-pip python3-dev build-essential

COPY package*.json ./
RUN npm ci --only=production

COPY --from=builder /app/dist ./dist
COPY server ./server
COPY python ./python
COPY .env.example ./

RUN cd python && pip3 install --no-cache-dir ultralytics opencv-python numpy

RUN mkdir -p uploads falls_videos detection_results

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "server/index.js"]
