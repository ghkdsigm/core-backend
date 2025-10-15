core-backend/
├─ server/
│ ├─ app.js # Express 진입점(healthz, 라우터 결선)
│ ├─ routes/
│ │ ├─ ingest.js # 업로드(zip 스트림) 수신 → manifest/seq 저장
│ │ └─ compose.js # 5종 배경 합성 트리거 → 결과 JSON 반환
│ └─ services/
│ ├─ openai.js # OpenAI SDK 래퍼(gpt-4o-mini, gpt-image-1)
│ ├─ bgPrompts.js # LLM으로 배경 프롬프트 5개 생성
│ └─ composeSharp.js # Sharp 합성(배경+중앙 프레임)
├─ storage/
│ ├─ seq/ # 업로드된 작업별 원본 시퀀스(자동 생성)
│ └─ renders/ # 합성 산출물(자동 생성)
├─ assets/
│ └─ backgrounds/ # (옵션) 정적 배경 자산. 사용 안 해도 됨
│ └─ .keep # 디렉토리 유지용 더미 파일
├─ .env.example # 환경변수 템플릿(OPENAI_API_KEY 등)
├─ package.json # "type":"module", scripts, deps
├─ README.md # 프로젝트 개요/사용법
└─ .gitignore
