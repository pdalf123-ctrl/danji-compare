DanjiLab MVP v3 — 수도권 아파트 비교지도
서울·경기·인천 아파트 단지를 카카오 장소검색 API로 자동 수집하고, 지도 기반으로 유사 단지 추천 및 A/B 비교를 제공하는 MVP입니다.
파일 구조
```txt
server.js
package.json
public/index.html
data/apartments-cache.json   # 서버 실행 후 자동 생성
```
Render 환경변수
Render Dashboard → Service → Environment에 아래 값을 넣으세요.
```txt
KAKAO\_REST\_KEY=카카오 REST API 키
KAKAO\_JS\_KEY=카카오 JavaScript 키
```
기존 코드처럼 API 키를 코드에 직접 넣는 방식은 노출 위험이 있어서 권장하지 않습니다.
실행
```bash
npm install
npm start
```
접속 후 서버가 카카오 API로 수도권 아파트를 수집합니다. 최초 수집은 시간이 걸릴 수 있고, 수집 결과는 `data/apartments-cache.json`에 저장됩니다.
주요 기능
풀스크린 지도 UI
서울 25개구 + 경기 31개 시군 + 인천 10개 군구 아파트 자동 수집
서울/경기/인천 및 시군구 필터
단지명/동/주소 검색
단지 클릭 시 상세 패널
가까운 지하철역/초등학교 자동 분석
강남역 기준 접근성 점수
유사 단지 추천
A/B 단지 비교표
주의
카카오 장소검색 기반 MVP이므로 모든 아파트 단지를 100% 보장하지 않습니다. 비주거 시설은 최대한 제외하도록 필터링했지만, 일부 오탐/누락은 발생할 수 있습니다. 추후 공동주택관리정보시스템, 실거래가 공공데이터, 수동 검수 DB를 붙이면 완성도가 올라갑니다.
