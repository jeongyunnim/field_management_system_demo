#!/usr/bin/env bash
set -euo pipefail

# 사용법:
# COPY entrypoint.sh /usr/local/bin/entrypoint.sh
# RUN chmod +x /usr/local/bin/entrypoint.sh
# ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
# CMD ["pmtiles","serve","/data/gunsan.pmtiles","--port","8082"]
#
# 또는 도커 실행 시 직접 인자 전달:
# docker run ... my-image pmtiles serve /data/gunsan.pmtiles --port 8082

# === 설정: 필요하면 바꾸세요 ===
BREW_PREFIX="/home/linuxbrew/.linuxbrew"
FALLBACK_NPM_PKG="pmtiles@latest"
DEFAULT_PACKAGES="pmtiles nginx"
APT_PACKAGES="build-essential curl file git python3 python3-distutils ca-certificates procps gnupg wget"

# 로그 유틸
log() { printf '%s %s\n' "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" "$*"; }

log "entrypoint: 시작"

# 0) 인자 처리 (명령이 주어지면 마지막에 exec로 실행)
CMD_ARGS=("$@")

# 1) apt-get(또는 apk 등)으로 의존성 설치 (가능한 경우만)
if command -v apt-get >/dev/null 2>&1; then
  log "apt-get detected: 필수 패키지 설치 시도..."
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -y
  apt-get install -y --no-install-recommends ${APT_PACKAGES}
  # 청소
  rm -rf /var/lib/apt/lists/*
elif command -v apk >/dev/null 2>&1; then
  log "apk detected: 필요한 패키지 설치 시도..."
  apk add --no-cache curl build-base ca-certificates git python3
else
  log "패키지 매니저를 찾을 수 없습니다. 필요한 툴(curl 등)이 설치되어 있어야 합니다."
fi

# 2) 이미 brew가 설치되어 있는지 확인
if [ -x "${BREW_PREFIX}/bin/brew" ] || command -v brew >/dev/null 2>&1; then
  log "Homebrew가 이미 설치되어 있습니다."
else
  log "Homebrew 설치 시작..."
  # 스크립트 비대화형 설치
  export NONINTERACTIVE=1
  # 설치 스크립트 실행
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" || {
    log "Homebrew 설치 스크립트 실행 실패"
  }
fi

# 3) 현재 세션에 brew 환경 적용 (shellenv)
if [ -f "${BREW_PREFIX}/bin/brew" ]; then
  eval "$(${BREW_PREFIX}/bin/brew shellenv)"
  # 영구화를 위해 profile.d에도 추가 (루트/모든 유저에 적용)
  if [ ! -f /etc/profile.d/linuxbrew.sh ]; then
    log "Creating /etc/profile.d/linuxbrew.sh for persistent PATH"
    cat > /etc/profile.d/linuxbrew.sh <<'BASH'
# Linuxbrew environment
export PATH=/home/linuxbrew/.linuxbrew/bin:/home/linuxbrew/.linuxbrew/sbin:$PATH
export MANPATH=/home/linuxbrew/.linuxbrew/share/man:$MANPATH
export INFOPATH=/home/linuxbrew/.linuxbrew/share/info:$INFOPATH
BASH
  fi
  log "brew 환경 적용 완료"
else
  log "WARN: ${BREW_PREFIX}/bin/brew 를 찾을 수 없습니다. brew 설치가 정상적이지 않을 수 있습니다."
fi

# 4) brew 업데이트 & pmtiles 설치 시도
BREW_OK=0
if command -v brew >/dev/null 2>&1; then
  log "brew 업데이트 시도..."
  brew update || log "brew update 실패(무시). 계속 진행합니다."
  # install packages (공백으로 구분 리스트)
  for pkg in ${DEFAULT_PACKAGES}; do
    log "brew install 시도: ${pkg}"
    if brew list --formula | grep -q "^${pkg}\$"; then
      log "이미 설치됨: ${pkg}"
    else
      if brew install "${pkg}"; then
        log "brew install 성공: ${pkg}"
      else
        log "brew install 실패: ${pkg}"
      fi
    fi
  done
  BREW_OK=1
else
  log "brew 명령을 찾을 수 없습니다. brew 설치 실패 또는 PATH 문제."
fi

exec npm run dev -- --host 0.0.0.0 --port 5173
