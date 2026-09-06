# 🎮 증강 오목 (Augmented Gomoku)

멋쟁이사자처럼 클라우드 엔지니어링 부트캠프 2차 팀 프로젝트. 렌주룰 기반에 아이템 요소를 더한 오목 게임을 기획부터 배포까지 직접 만들었다. **Node.js (TypeScript) 백엔드**와 **React (Vite + TypeScript) 프론트엔드**로 구성된 실시간 멀티플레이어 게임이다.

## 팀 구성 및 역할

김동재(본인), 조윤지, 양지훈, 김다현 — 본인은 클라이언트·서버 양쪽에 걸쳐 풀스택으로 개발에 참여했고, 특히 실시간 대전 로직과 Redis 기반 세션 관리를 설계했다.

## 주요 기능

- 인증, 로비, 대기방(실시간 매칭·방 생성) → 실시간 오목 대전
- 렌주룰 + 아이템이 있는 오목 — 단순 클론이 아니라 게임성을 직접 기획해 추가
- Redis 기반 세션 관리 + 접속 끊김 유예 처리 — 네트워크가 끊겨도 대전이 바로 종료되지 않도록 설계
- 전적/기록 조회, 프로필 관리(S3 이미지 업로드), 다크모드
- k6로 동시 접속 약 3,000명까지 부하 테스트 — 다만 이 테스트가 실제 대전 흐름까지 충분히 검증하지는 못했다는 한계를 인지하고 팀 내부에 공유
- AWS에 약 1주일간 실제 배포·운영 (이후 비용 문제로 종료)

---

## 개발 환경 가이드

처음 개발에 참여하는 팀원분들은 아래 가이드를 순서대로 따라서 로컬 개발 환경을 구축해 주세요.

---
## 0. 브렌치 설명
* **main** : 팀 프로젝트에 필요한 문서들과 개발 완료된 버전들만 머지해서 관리합니다.
  * **dev** : 개발 진행과정을 전체적으로 관리하는 브랜치입니다. 
    * **server-dev** : 서버 관련된 작업을 관리하는 브랜치입니다. 작업 후에 dev로 머지하여 관리합니다.
    * **front-dev** : 프론트 관련 작업을 관리하는 브랜치입니다. 작업 후에 dev로 머지하여 관리합니다.

**개인 작업용 브랜치는 server-dev 혹은 front-dev에서만 만들고 머지해주세요**


## 📋 1. 사전 준비물 (Pre-requisites)

아무것도 설치되지 않은 PC라면 아래 두 프로그램을 먼저 설치해야 합니다.

1. **Node.js 설치**
   * [Node.js 공식 홈페이지](https://nodejs.org/)에서 LTS(Long Term Support) 버전을 다운로드하여 설치해 주세요. (v20 이상 권장)
   * 설치가 완료되면 터미널(명령 프롬프트)에서 `node -v`와 `npm -v`를 입력해 정상적으로 설치되었는지 확인합니다.

2. **Visual Studio Code (VS Code) 설치**
   * 코드 편집기로 [VS Code](https://code.visualstudio.com/)를 권장합니다.
   * VS Code를 설치한 후, 확장 프로그램(Extensions) 탭에서 아래 항목들을 필수로 설치해 주세요.
     * **Prettier - Code formatter** (코드 스타일 자동 정렬)
     * **Tailwind CSS IntelliSense** (디자인 클래스 자동 완성)

---

## 🛠️ 2. 저장소 복제 및 의존성 설치

1. 저장소를 클론(Clone)하거나 폴더를 VS Code로 열어줍니다.
   ```bash
   # 깃 클론
   git clone https://github.com/KimDJ7105/project2-1team.git
   cd Project2-1team
   # 서버 의존성 설치
   cd server
   npm install
   # 클라이언트 의존성 설치
   cd ../client
   npm install
   ```

## 3. 서버 실행 및 테스트 방법

프로젝트에 Redis가 추가됨에 따라 로컬 실행시 docker로 redis를 실행시켜줘야 합니다.<br>
다음 명령어를 이용해서 docker에 Redis를 띄워주세요
```bash
 docker run -d --name local-redis -p 6379:6379 redis:alpine
```

server 폴더와 client 폴더 내부에서 각각 npm run dev 명령어를 사용하시면 됩니다.
이를 위해서 2개의 터미널 창을 띄우셔야 합니다.
  ```bash
  example/path/project2-1team/server/ : npm run dev
  example/path/project2-1team/client/ : npm run dev
  ```

npm start 명령어를 사용하여 서비스 모드로 서버를 실행할 수 있습니다.
```bash
example/path/project2-1team/server/ : npm start
```

## 📂 프로젝트 폴더 구조
client/: React + TypeScript 프론트엔드 소스 코드<br>

server/: Node.js + TypeScript 백엔드 소스 코드<br>

shared/: 서버와 클라이언트가 공통으로 사용하는 TypeScript 인터페이스(타입 명세) 정의 폴더

## 프로젝트 환경
  dev : 개발시 사용, 서버 실행 명령어는 npm run dev. 인 메모리 DB 사용
  prod : 서비스시 사용, 서버 실행 명령어는 npm start. AWS RDS 사용 
