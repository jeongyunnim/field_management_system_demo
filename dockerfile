FROM node:20-bullseye-slim

# 컨테이너 안에서 일반 사용자 사용 (호스트 파일 권한 꼬임 방지)
USER root
WORKDIR /app

# 의존성 캐시 최적화
COPY --chown=node:node package*.json ./
# COPY tools/entrypoint.sh /app/tools/entrypoint.sh
RUN npm ci || npm install

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
     iproute2 \
     iputils-ping \
     curl \
     ca-certificates \
     netcat-openbsd \
     dnsutils \
     traceroute \
     gcc

RUN npm install -g pmtiles@latest

# RUN chmod 777 /app/tools/entrypoint.sh

EXPOSE 8080 8081 8082 2222

# 파일 변경 감지(도커 볼륨 환경) 안정화
ENV CHOKIDAR_USEPOLLING=true
ENV WATCHPACK_POLLING=true
ENV HOST=0.0.0.0

USER node

CMD ["npm", "run", "dev"]
