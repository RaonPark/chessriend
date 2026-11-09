# Cburnett 기물 그래픽 BSD-3-Clause 고지

## What
- 보드 기물(react-chessboard 기본 SVG)과 왕 아이콘(`ChessKing.tsx`)에 쓰인 **Cburnett 기물** 출처와 라이선스를 고지한다.
- 라이선스는 **BSD-3-Clause**를 골랐다.
- 라이선스·보안 점검(`docs/chore_license-security-audit_작업내역.md`) **L4** 항목을 처리한다.

## Why
- Cburnett 기물은 작성자가 GFDL 1.2+ / CC BY-SA 3.0 / BSD 3-Clause / GPL 2+ 중 하나를 고르게 한다 (Wikimedia Commons 원본 페이지에서 확인).
- BSD-3을 고른 이유
  - 조건이 가장 가볍다: 고지와 면책 문구만 유지하면 된다.
  - CC BY-SA·GPL처럼 우리 코드나 파생물에 같은 라이선스를 요구하지 않는다.
- BSD-3 2항: 바이너리 배포 시 "문서 및/또는 함께 배포되는 자료"에 고지를 넣어야 한다.
  - 웹앱은 빌드 결과물이 곧 배포물이다. 그래서 `frontend/public/`에 두어 `dist/`에 함께 실리게 했다.
- react-chessboard는 MIT지만, 패키지 라이선스가 안에 든 그림의 라이선스를 바꾸지는 않는다.
  - 그림에는 Cburnett 라이선스가 그대로 적용된다.

## 주요 파일
- `frontend/public/THIRD_PARTY_NOTICES.txt` (신규)
  - 고지 원본이다. 출처 URL과 BSD-3-Clause 전문을 담았다.
  - 빌드 시 `dist/`로 복사되어 `/THIRD_PARTY_NOTICES.txt`로 제공된다.
- `NOTICE` (신규, 저장소 루트): 요약과 위 파일 안내.
- `frontend/src/shared/components/ChessKing.tsx`: 출처·라이선스 주석.
- `docs/chore_license-security-audit_작업내역.md` (gitignore 대상이라 로컬에서만 수정)
  - 체크리스트에서 `L4·L5`를 둘로 나누고 L4를 완료로 표시했다.
  - L5(NNUE 고지)는 미완료로 남겼다.

## 검증
- `pnpm build` 후 `dist/THIRD_PARTY_NOTICES.txt` 생성과 내용 확인.

## 후속
- 앱 화면(푸터 / "오픈소스 라이선스" 페이지)에서 이 파일로 링크한다. L1(Stockfish GPL 고지 페이지)과 함께 하는 것이 효율적이다.
- L6에서 `THIRD_PARTY_NOTICES`를 자동 생성하게 되면, 이 파일의 Cburnett 항목을 그 결과에 합쳐야 한다.
  - Cburnett는 npm 의존성 메타데이터에 나오지 않아 자동 생성에서 빠진다.
- L5 NNUE 고지는 남아 있다.
