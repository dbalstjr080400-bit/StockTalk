# Railway 실제 배포 가이드

현재 StockTalk 저장소는 루트 `Dockerfile`과 `railway.json`을 포함하고 있습니다. 컨테이너가 시작될 때 `pnpm db:migrate`를 실행한 뒤 앱을 시작하며, Railway가 주입하는 `PORT`와 `/api/health` 헬스체크를 사용합니다. 게시글은 MySQL `discussion_posts` 테이블에 저장됩니다.

## 먼저 준비할 값

앱 서비스에 다음 변수를 설정합니다.

```text
DATABASE_URL=${{MySQL.MYSQL_URL}}
MANUS_JWT_SECRET=<긴 무작위 문자열>
OWNER_LOGIN_ID=admin
```

`MySQL`은 MySQL 서비스 이름입니다. 서비스 이름을 다르게 만들었다면 `${{MySQL.MYSQL_URL}}`에서 `MySQL` 부분을 실제 서비스 이름으로 바꿉니다. `OWNER_LOGIN_ID`와 동일한 아이디로 최초 가입하면 관리자 계정이 됩니다. 이미 가입한 계정이라면 그 아이디로 다음 로그인할 때 관리자 권한이 적용됩니다.

필요할 때만 `TOSS_CLIENT_ID`, `TOSS_CLIENT_SECRET`, `APP_BASE_URL`을 추가합니다. `MANUS_JWT_SECRET`은 로컬에서 `openssl rand -base64 48`로 만들 수 있습니다. 비밀번호나 API 키를 Git 저장소에 커밋하지 마세요.

## 방법 A: Railway CLI

현재 저장소가 GitHub 저장소가 아니어도 되므로 이 방법이 가장 간단합니다. 로컬 컴퓨터에서 저장소를 clone한 뒤 프로젝트 폴더에서 실행합니다.

### 1. CLI 설치와 로그인

macOS/Linux/WSL에서는 다음 중 하나를 사용합니다.

```bash
npm i -g @railway/cli
# 또는 Railway 공식 설치 스크립트
bash <(curl -fsSL railway.com/install.sh)
```

로그인합니다.

```bash
railway login
railway whoami
```

브라우저를 열 수 없는 SSH 환경에서는 `railway login --browserless`를 사용합니다.

### 2. Railway 프로젝트와 앱 서비스 만들기

새 프로젝트라면 저장소 루트에서 실행합니다.

```bash
cd /path/to/stocktalk
railway init
```

기존 Railway 프로젝트를 사용할 때는 대신 다음을 실행합니다.

```bash
railway link
```

워크스페이스, 프로젝트, 환경을 선택한 뒤 앱 서비스를 배포합니다.

```bash
railway up
```

`railway up`은 현재 디렉터리를 업로드하고, 저장소의 `Dockerfile`을 사용해 빌드·배포합니다. 여러 서비스가 있으면 앱 서비스를 선택하거나 다음처럼 지정합니다.

```bash
railway up --service stocktalk
```

### 3. MySQL 추가

배포 후 Railway 대시보드의 프로젝트 캔버스에서 `+ New` → `Database` → `MySQL`을 선택합니다. MySQL 서비스가 완전히 실행된 뒤 앱 서비스의 변수로 이동합니다.

CLI로 앱 서비스가 연결된 상태라면 다음처럼 변수를 설정할 수 있습니다.

```bash
railway variable set 'DATABASE_URL=${{MySQL.MYSQL_URL}}'
railway variable set "MANUS_JWT_SECRET=$(openssl rand -base64 48)"
railway variable set 'OWNER_LOGIN_ID=admin'
```

앱 서비스가 아닌 다른 서비스에 연결되어 있다면 먼저 `railway service`로 앱 서비스를 선택하거나 `railway link --service <앱서비스명>`을 실행합니다. `DATABASE_URL`은 반드시 앱 서비스에 설정해야 합니다.

### 4. 환경변수 적용 후 재배포

```bash
railway up
railway logs
```

시작 로그에 migration 실행과 `Server listening on port ...`가 표시되어야 합니다. migration이 실패하면 앱은 의도적으로 시작되지 않습니다. 이는 빈 DB나 잘못된 DB 연결로 앱이 실행되는 것을 막기 위한 동작입니다.

### 5. 공개 주소 생성과 확인

```bash
railway domain
railway domain list
```

생성된 주소로 헬스체크를 확인합니다.

```bash
curl https://<생성된-주소>/api/health
```

정상 응답은 다음과 같은 JSON입니다.

```json
{"status":"ok"}
```

## 방법 B: Railway 웹 콘솔

웹 콘솔 방식은 GitHub 저장소가 필요합니다. 현재 원격 저장소가 GitHub가 아니라면 먼저 이 프로젝트를 사용자의 GitHub 저장소에 push하거나 CLI 방식을 사용하세요.

1. Railway 대시보드에서 `New Project`를 누릅니다.
2. `Deploy from GitHub Repo`를 선택하고 GitHub 연결을 승인합니다.
3. StockTalk 저장소와 `main` 브랜치를 선택합니다.
4. `Deploy Now`를 누릅니다. Railway는 저장소의 `railway.json`과 루트 `Dockerfile`을 사용합니다.
5. 프로젝트 캔버스에서 `+ New` → `Database` → `MySQL`을 추가합니다.
6. 앱 서비스를 클릭하고 `Variables`에서 다음 값을 추가합니다.

```text
DATABASE_URL=${{MySQL.MYSQL_URL}}
MANUS_JWT_SECRET=<긴 무작위 문자열>
OWNER_LOGIN_ID=admin
```

7. `Deploy` 또는 `Redeploy`를 눌러 앱을 다시 배포합니다.
8. 앱 서비스의 `Settings` 또는 `Networking`에서 `Generate Domain`을 눌러 공개 주소를 생성합니다.
9. 브라우저에서 공개 주소를 열고 회원가입, 로그인, 게시글 작성, 관리자 화면을 확인합니다.

GitHub 연동을 사용하면 `main` 브랜치에 push할 때 자동 배포를 설정할 수 있습니다. 배포 실패 시 앱 서비스의 `Deployments`에서 빌드 로그와 런타임 로그를 확인합니다.

## 운영 전 확인

MySQL은 기본적으로 프로젝트 내부 private 네트워크에서 앱과 연결합니다. 앱 연결을 위해 MySQL에 public access를 열 필요가 없습니다. 공개 TCP Proxy는 외부 DB 접속이 꼭 필요할 때만 사용하세요.

운영용으로는 MySQL 서비스의 백업을 활성화하고, 게시글이 실제로 유지되는지 테스트합니다. 새 게시글 작성 후 앱을 재배포하고 다시 조회해도 게시글이 남아 있어야 합니다. Railway의 MySQL 문서는 백업과 point-in-time recovery도 안내합니다.

## 공식 문서

- [Railway CLI](https://docs.railway.com/cli)
- [CLI 배포](https://docs.railway.com/cli/deploying)
- [Railway 빠른 시작](https://docs.railway.com/quick-start)
- [Railway MySQL](https://docs.railway.com/databases/mysql)
- [Railway 변수 참조](https://docs.railway.com/variables/reference)
- [Railway 프로젝트 연결](https://docs.railway.com/cli/link)
