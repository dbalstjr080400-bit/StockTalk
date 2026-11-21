# 모아 | 함께 보는 투자 이야기

React / Express / tRPC / Drizzle starter, adapted from the Sandbox web-db-user template.

- `pnpm dev`: development server; honors `PORT` (default 3000).
- `pnpm build` / `pnpm start`: build and serve `dist/index.js` and `dist/public/`.
- `pnpm db:migrate`: apply checked-in migrations. `pnpm db:push`: generate and apply new schema changes.
- `pnpm check` / `pnpm test`: types and application tests.

Start with the Webdev skill's default-template guide. Platform login, storage, payments and service contracts live in its shared references; read the relevant capability before extending its helper.

`server/_core/publicConfig.ts` exposes only named public runtime values. Private keys stay server-side. The platform serves managed `/manus-storage/` assets; the application does not register a second proxy.

Platform configuration is readable and editable through `webdev.config`. Default settings are initial values, not enforced constraints. The agent may modify the files, commands and configuration or follow the flexible guide for another stack.

## 종목 목록

- `GET /api/stocks`는 목록 출처(`source`), 수집 일시(`asOf`), 종목을 반환합니다. 현재 기본 목록은 한국투자증권의 공개 국내·해외 종목 마스터 스냅샷으로, 토스증권의 실제 취급 종목과 같다고 보장하지 않습니다. 시세가 아닙니다.
- `python3 scripts/update-stock-snapshot.py`로 스냅샷을 수동 갱신합니다. 실행에는 외부 데이터 파일 접속이 필요합니다. 정상 검증한 뒤에만 기존 파일을 덮어씁니다.
- 토스 Open API의 `TOSS_CLIENT_ID`, `TOSS_CLIENT_SECRET`이 서버 환경에 모두 설정되어 있고 접근이 허용되면 모든 7개 마켓을 조회합니다. 모두 성공해야 토스 공식 목록으로 표시하고, 하루 동안 프로세스 메모리에 캐시합니다. 실패 시 기존의 완전한 토스 목록 또는 공개 스냅샷으로 대체합니다. 서버 재시작 시 캐시는 사라집니다.
- 토스 API는 발급 계좌와 허용 IP가 필요하며, 새 액세스 토큰 발급이 같은 클라이언트의 기존 토큰을 무효화할 수 있습니다. 토스 및 한국투자증권 데이터의 제3자 표시·배포 권한과 약관을 확인하기 전에는 해당 데이터를 공개 서비스에 배포하지 마세요. 토스의 Open API 약관은 시세정보의 제3자 제공·배포 등을 제한합니다.
