# ===== 기본 설정 =====
# docker compose 바이너리
COMPOSE ?= docker compose
# 사용할 compose 파일들 (필요 시 " -f docker-compose.yml -f docker-compose.dev.yml" 식으로 확장)
FILES   ?= -f compose.yml
# compose 프로필이 있으면 " --profile dev" 처럼 지정
PROFILE ?=
# 기본 서비스명(셸 진입/명령 실행 대상)
SERVICE ?= web
# 로그 Tail 기본 라인 수
TAIL    ?= 200

# 색상 출력(선택)
YELLOW  := \033[33m
GREEN   := \033[32m
NC      := \033[0m

# ===== 공통 옵션 =====
DC = $(COMPOSE) $(FILES) $(PROFILE)

.PHONY: help build up start stop restart logs ps sh bash exec down clean fclean re pull prune images

help:
	@echo ""
	@echo "$(YELLOW)사용법$(NC)"
	@echo "  make build        # 이미지 빌드"
	@echo "  make up           # 컨테이너 실행(-d)"
	@echo "  make start        # 이미 생성된 컨테이너 시작"
	@echo "  make stop         # 컨테이너 중지"
	@echo "  make restart      # 컨테이너 재시작"
	@echo "  make logs         # 로그 팔로우 (기본 tail=$(TAIL))"
	@echo "  make ps           # 상태 확인"
	@echo "  make sh           # $(SERVICE) 컨테이너에 sh 진입 (SERVICE=...)"
	@echo "  make bash         # bash 진입 (없으면 sh)"
	@echo "  make exec CMD='npm run test'  # $(SERVICE)에서 임의 명령 실행"
	@echo "  make down         # 컨테이너 중지 및 제거"
	@echo "  make clean        # down + 볼륨 제거 + orphans 제거"
	@echo "  make fclean       # clean + 로컬 이미지 제거(--rmi local)"
	@echo "  make re           # fclean 후 up (재생성)"
	@echo "  make pull         # 이미지 풀"
	@echo "  make prune        # 사용하지 않는 리소스 정리(주의)"
	@echo "  make images       # 관련 이미지 목록"
	@echo ""
	@echo "$(GREEN)예시$(NC)"
	@echo "  make up"
	@echo "  make logs TAIL=500"
	@echo "  make sh SERVICE=web"
	@echo "  make exec SERVICE=web CMD='npm run dev'"
	@echo "  make fclean"
	@echo ""

build:
	$(DC) build

up:
	$(DC) up -d

start:
	$(DC) start

stop:
	$(DC) stop

restart:
	$(DC) restart

logs:
	$(DC) logs -f --tail=$(TAIL)

ps:
	$(DC) ps

sh:
	$(DC) exec $(SERVICE) bash -lc 'exec bash'

bash:
	$(DC) exec $(SERVICE) bash -lc 'exec bash'

# 예: make exec CMD='npm run test'
exec:
	@if [ -z "$(CMD)" ]; then \
		echo "사용법: make exec CMD='명령어' [SERVICE=web]"; exit 1; \
	fi
	$(DC) exec $(SERVICE) sh -lc "$(CMD)"

down:
	$(DC) down

clean:
	$(DC) down -v --remove-orphans

fclean:
	$(DC) down -v --rmi local --remove-orphans

re: fclean up

pull:
	$(DC) pull

prune:
	# 사용하지 않는 컨테이너/네트워크/이미지/볼륨 정리(확인 프롬프트 O)
	docker system prune

images:
	# 현재 프로젝트 관련 이미지들(로컬) 표시
	docker images --format 'table {{.Repository}}\t{{.Tag}}\t{{.ID}}\t{{.Size}}'
