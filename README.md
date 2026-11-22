# 모아 | 함께 보는 투자 이야기

React / Express / tRPC / Drizzle starter, adapted from the Sandbox web-db-user template.

- `pnpm dev`: development server; honors `PORT` (default 3000).
- `pnpm build` / `pnpm start`: build and serve `dist/index.js` and `dist/public/`.
- `pnpm db:migrate`: apply checked-in migrations. `pnpm db:push`: generate and apply new schema changes.
- `pnpm check` / `pnpm test`: types and application tests.

Start with the Webdev skill's default-template guide. Platform login, storage, payments and service contracts live in its shared references; read the relevant capability before extending its helper.

`server/_core/publicConfig.ts` exposes only named public runtime values. Private keys stay server-side. The platform serves managed `/manus-storage/` assets; the application does not register a second proxy.

Platform configuration is readable and editable through `webdev.config`. Default settings are initial values, not enforced constraints. The agent may modify the files, commands and configuration or follow the flexible guide for another stack.

## Railway 배포 준비

이 저장소는 루트 `Dockerfile`과 `railway.json`을 사용해 Railway에서 컨테이너로 배포할 수 있습니다. Railway 프로젝트에는 앱 서비스와 MySQL 서비스를 만들고, 앱 서비스의 `DATABASE_URL`을 `${{MySQL.MYSQL_URL}}`로 연결하세요. 배포 컨테이너는 시작할 때 `pnpm db:migrate`를 먼저 실행한 뒤 서버를 시작하므로, 체크인된 Drizzle migration이 운영 DB에 순서대로 적용됩니다. migration 실패 시 앱이 시작되지 않아 잘못된 스키마로 운영되는 것을 막습니다.

앱 서비스에는 최소한 `DATABASE_URL`, `MANUS_JWT_SECRET`, `OWNER_LOGIN_ID`를 설정해야 합니다. `MANUS_JWT_SECRET`은 긴 무작위 문자열을 사용하고, `OWNER_LOGIN_ID`에는 관리자용으로 사용할 자체 로그인 아이디를 넣으세요. 해당 아이디로 최초 가입하면 관리자 권한으로 생성되며, 이미 가입한 계정이라면 다음 로그인 때 관리자 권한으로 승격됩니다. `TOSS_CLIENT_ID`와 `TOSS_CLIENT_SECRET`은 토스 종목 목록 연동을 사용할 때만 추가합니다.

Railway Health Check 경로는 `/api/health`이며, 앱은 Railway가 주입하는 `PORT`를 그대로 사용합니다. 게시글은 애플리케이션 파일이 아니라 MySQL의 `discussion_posts` 테이블에 저장되므로 MySQL 서비스의 영속 볼륨과 백업을 반드시 유지해야 합니다. Railway의 Custom Domain을 연결한 뒤 `APP_BASE_URL`도 실제 주소로 갱신하세요.

## 종목 목록

- `GET /api/stocks`는 목록 출처(`source`), 수집 일시(`asOf`), 종목을 반환합니다. 현재 기본 목록은 한국투자증권의 공개 국내·해외 종목 마스터 스냅샷으로, 토스증권의 실제 취급 종목과 같다고 보장하지 않습니다. 시세가 아닙니다.
- `python3 scripts/update-stock-snapshot.py`로 스냅샷을 수동 갱신합니다. 실행에는 외부 데이터 파일 접속이 필요합니다. 정상 검증한 뒤에만 기존 파일을 덮어씁니다.
- 토스 Open API의 `TOSS_CLIENT_ID`, `TOSS_CLIENT_SECRET`이 서버 환경에 모두 설정되어 있고 접근이 허용되면 모든 7개 마켓을 조회합니다. 모두 성공해야 토스 공식 목록으로 표시하고, 하루 동안 프로세스 메모리에 캐시합니다. 실패 시 기존의 완전한 토스 목록 또는 공개 스냅샷으로 대체합니다. 서버 재시작 시 캐시는 사라집니다.
- 토스 API는 발급 계좌와 허용 IP가 필요하며, 새 액세스 토큰 발급이 같은 클라이언트의 기존 토큰을 무효화할 수 있습니다. 토스 및 한국투자증권 데이터의 제3자 표시·배포 권한과 약관을 확인하기 전에는 해당 데이터를 공개 서비스에 배포하지 마세요. 토스의 Open API 약관은 시세정보의 제3자 제공·배포 등을 제한합니다.
