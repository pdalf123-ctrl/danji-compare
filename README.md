# DanjiLab MVP

서울 아파트 단지를 카카오 장소검색 API로 자동 수집하고, 지도 기반으로 유사 단지 추천 및 A/B 비교를 제공하는 MVP입니다.

## 파일 구조

```txt
server.js
package.json
public/index.html
data/apartments-cache.json   # 서버 실행 후 자동 생성
```

## Render 환경변수

Render Dashboard → Service → Environment에 아래 값을 넣으세요.

```txt
KAKAO_REST_KEY=카카오 REST API 키
KAKAO_JS_KEY=카카오 JavaScript 키
```

기존 코드처럼 API 키를 코드에 직접 넣는 방식은 노출 위험이 있어서 권장하지 않습니다.

## 실행

```bash
npm install
npm start
```

접속 후 서버가 카카오 API로 서울 25개 구 아파트를 수집합니다. 최초 수집은 시간이 걸릴 수 있고, 수집 결과는 `data/apartments-cache.json`에 저장됩니다.

## 주요 기능

- 풀스크린 지도 UI
- 서울 25개 구 아파트 자동 수집
- 구/키워드/조건 필터
- 단지 클릭 시 상세 패널
- 가까운 지하철역/초등학교 자동 분석
- 강남 접근성 점수
- 유사 단지 추천
- A/B 단지 비교표

## 주의

카카오 장소검색 기반 MVP이므로 모든 아파트 단지를 100% 보장하지 않습니다. 추후 실거래가 공공데이터, 공동주택관리정보시스템, 수동 검수 DB를 붙이면 완성도가 올라갑니다.
