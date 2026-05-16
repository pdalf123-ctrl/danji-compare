# DanjiLab DB Platform

국토교통부 공동주택 단지 기본정보 XLSX에서 추출한 수도권 아파트 8,808개 기반 MVP입니다.

## 파일 구조

```txt
server.js
package.json
public/index.html
public/style.css
public/app.js
data/apartments.json
scripts/geocode.js
```

## Render 환경변수

```txt
KAKAO_REST_KEY=카카오 REST API 키
KAKAO_JS_KEY=카카오 JavaScript 키
```

## 카카오 설정

Kakao Developers → 내 애플리케이션 → 플랫폼 → Web 사이트 도메인에 아래 등록:

```txt
https://danji-compare.onrender.com
```

## 중요한 변경점

이 버전은 카카오 장소검색으로 아파트를 찾지 않습니다.

```txt
국토부 공동주택 DB → apartments.json → 지도/비교
```

카카오 API는 좌표 생성용으로만 사용합니다.

## 좌표 생성

처음에는 좌표가 없는 단지도 임시좌표로 표시됩니다.
실제 좌표를 붙이려면 사이트 우측 상단 `좌표 생성` 버튼을 누르거나 Render Shell에서:

```bash
npm run geocode
```

를 실행합니다.

좌표 생성 결과는 `data/apartments.geocoded.json`으로 저장됩니다.
Render 무료 인스턴스는 파일 저장이 영구 보장되지 않으므로, 최종적으로는 로컬에서 geocode 실행 후 결과 JSON을 GitHub에 커밋하는 방식이 가장 안정적입니다.
