FROM node:20-alpine

WORKDIR /app

# 1) 빌드 도구 (node-gyp 등) - 필요한 경우
RUN apk add --no-cache python3 make g++ libc6-compat

# 2) (프라이빗 레지스트리 사용 시) .npmrc 먼저 복사
# COPY .npmrc ./

# 3) 패키지 먼저 복사 → 레이어 캐시 극대화
COPY package.json package-lock.json* ./

# 4) lockfile이 있으면 npm ci, 없으면 npm install
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# 5) 소스 복사
COPY . .

ENV HOST=0.0.0.0
EXPOSE 5173
CMD ["npm","run","dev","--","--host","0.0.0.0"]
