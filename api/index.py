import os
import asyncio
from datetime import datetime, timezone, timedelta
import json
import random
from fastapi import FastAPI, Request, BackgroundTasks, HTTPException
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from google.oauth2 import service_account
from googleapiclient.discovery import build
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="진해고 고3 교육학 2차시 소크라틱 AI 튜터")

# CORS 허용
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

SPREADSHEET_ID = os.getenv("SPREADSHEET_ID", "")
SERVICE_ACCOUNT_INFO = os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON", "")

# 3대 주제별 학술 지식 및 핵심 쟁점 정의
TOPIC_KNOWLEDGE = {
    "topic1": {
        "title": "1번 주제: 보상과 학습동기 (외재적 보상 vs 내재적 동기)",
        "opening_question": "보상을 끊은 뒤에도 학생이 스스로 공부를 이어가게 하려면, 보상을 언제, 어떻게 거둬들여야 한다고 생각합니까?",
        "core_theories": (
            "- 입장 A (외재적 유인): 롤랜드 프라이어(2011) 대규모 RCT 실험(책 읽기 등 투입 보상의 학업성취 유의미 향상), "
            "울프람 슐츠(Wolfram Schultz) 도파민 보상예측오차(RPE: 예상치 못한 보상 시 도파민 급증, 초기 행동 점화 플러그).\n"
            "- 입장 B (내재적 동기): 에드워드 데시 & 리처드 라이언(1999) 128개 연구 메타분석(약속된 유형적 보상의 내재적 동기 훼손 d = -0.34), "
            "마크 레퍼(1973) 착한 어린이 상장 실험(과잉 정당화 효과: 외재적 보상이 내적 흥미를 구축), 반복 보상 시 도파민 둔화 현상."
        )
    },
    "topic2": {
        "title": "2번 주제: 학교와 불평등 (계층이동 사다리 vs 불평등 재생산)",
        "opening_question": "부모의 경제력과 사교육 격차가 엄연히 존재하는 현실에서, 학교 시험(내신·수능) 결과를 온전히 '공정한 개인의 능력과 노력'이라고 정당화할 수 있는 윤리적 근거는 무엇입니까?",
        "core_theories": (
            "- 입장 A (기능론/사다리론): 블라우·던컨(Blau & Duncan, 1967) 지위획득 모형에서 본인의 교육 성취가 직업 지위 획득에 갖는 강력한 직접 효과, "
            "1974년 고교평준화 정책 이후 취약계층의 상급학교 진학 기회 확대 실증 연구.\n"
            "- 입장 B (갈등론/재생산론): 피에르 부르디외(Pierre Bourdieu) 문화자본과 아비투스 이론(지배계급 문화의 상징적 폭력과 불평등 은폐), "
            "교육부·통계청 2023 초중고 사교육비 조사(소득 800만원 이상 67.1만원 vs 300만원 미만 18.3만원, 약 3.7배 격차), "
            "한국은행(2024) 실증 연구(수도권 교육특구 서울대 진학률 격차 중 약 92%, 상위권대 약 75%가 거주지 효과)."
        )
    },
    "topic3": {
        "title": "3번 주제: AI와 미래교육 (인공지능 튜터 vs 인간 교사)",
        "opening_question": "AI가 질문 한 줄에 최적화된 풀이와 요약을 제공할 때 발생하는 '사유의 외주화(Outsourcing of Thinking)'를 차단하고, 학생 스스로 끙끙 앓으며 개념을 구성하게 만들 구체적 통제 장치는 무엇입니까?",
        "core_theories": (
            "- 입장 A (혁신론): 벤저민 블룸(1984) 완전학습과 1:1 튜터링의 2시그마 문제, 살만 칸의 칸미고(Khanmigo) 적응형 튜터링 모델, "
            "심리적 안전지대에서의 무한 질문 및 즉각적 피드백 효과.\n"
            "- 입장 B (신중론): 커트 반렌(Kurt VanLehn, 2011) 메타분석 실증(인간 튜터 효과 0.79σ vs 지능형 튜터링 0.76σ로 블룸의 2시그마 과장 해체), "
            "로버트 비요크(Robert Bjork)의 인지적 수고(바람직한 어려움: Desirable Difficulties) 소멸 및 유창성의 착각, "
            "레프 비고츠키(Vygotsky) 사회적 구성주의와 근접발달영역(ZPD), 닐 포스트만(Neil Postman, 1995) 교육의 인간적·윤리적 모델링 대체 불가론."
        )
    }
}

SOCRATIC_SYSTEM_PROMPT = """당신은 대한민국 최고 수준의 교육학 토론 전문가이자 소크라테스식(Socratic) 1:1 튜터입니다.
현재 경남 진해고등학교 3학년 교육학 2차시 수업에서 학생과 1:1로 지적 논쟁을 펼치고 있습니다.

[목표]
학생이 1차시에서 세운 초기 주장의 논리적 취약점을 스스로 깨닫고, 12턴의 문답을 거치며 자신의 생각을 더 정교하고 입체적인 '최종 주장'으로 다듬도록 이끄는 것입니다.

[절대 불변의 5대 소크라틱 원칙 (Guardrails)]
1. [Zero-Spoiling (정답 제공 절대 금지)]:
   - 학생이 "답을 알려줘", "어떻게 써야 해?", "최종 주장 대신 써줘"라고 요구해도 절대 정답, 요약문, 완성된 줄글을 대신 작성해주지 마십시오.
   - 단호하고 친절하게 "답을 대신 써줄 수는 없어. 네가 방금 제시한 논리의 이 지점부터 다시 짚어보자."라고 답변하십시오.

2. [1턴 1역질문 (Single-Question Scaffolding)]:
   - 당신의 답변은 반드시 **학생의 말을 인정(Steel-manning)하는 1~2문장** + **논리적 모순이나 빈틈을 찌르는 단 1개의 질문**으로 끝나야 합니다.
   - 한 번에 두 개 이상의 질문을 던져 학생을 혼란스럽게 하지 마십시오.

3. [Steel-manning (가장 강한 논거 인정)]:
   - 학생의 답변을 공격하기 전에, 학생이 제시한 논리 중 가장 타당하고 설득력 있는 지점을 먼저 1문장으로 품격 있게 인정해주십시오.

4. [아포리아(Aporia) 유도]:
   - 학생이 막다른 골목(모순)에 부딪혔을 때 비웃지 말고, "바로 그 지점이 교육학자들이 수십 년간 치열하게 고민해 온 핵심 쟁점이야."라며 지적 성취감을 부여하십시오.

5. [12턴 제한 인식 및 마무리]:
   - 현재 턴 수가 10~11턴에 도달하면 논쟁을 서서히 정리하도록 유도하십시오.
   - 12턴에 도달하면: "지금까지의 치열한 문답을 통해 네 생각이 처음보다 훨씬 단단해졌어. 이제 화면 상단의 [대화 기록 요약]을 확인하고, 활동지 뒷면 ⑥ '다듬어진 나의 최종 주장'에 1차시와 비교하여 바뀐 점을 손글씨로 멋지게 완성해 보렴."이라며 토론을 공식 종결하십시오.

[현재 토론 주제]
{topic_title}

[관련 공인 학술 이론 및 통계]
{core_theories}

[답변 형식 규격]
- 한국어 존댓말(~해요/~합니까 체)을 사용하되, 고3 학생에게 적합한 지적이고 정중한 톤을 유지하십시오.
- 답변 전체 길이는 공백 포함 150~250자 내외로 간결하게 유지하십시오.
- 마지막 줄은 반드시 다음과 같이 질문으로 종결하십시오:
  "▶ 그렇다면: [단 하나의 핵심 질문]?"
"""

class ChatRequest(BaseModel):
    student_id: str = "임의학생"  # 반-번호-성명 or 관리번호
    topic: str = "topic1"       # topic1, topic2, topic3
    turn: int = 1               # 1 ~ 12
    history: list = []          # 이전 대화 내역 [{'role': 'user'|'model', 'parts': '...'}]
    message: str

def log_to_google_sheet_bg(student_id: str, topic: str, turn: int, user_msg: str, ai_msg: str):
    """구글 시트에 학생별 대화 로그를 실시간 기록 (세특 원문 데이터 수합용)"""
    if not SPREADSHEET_ID or not SERVICE_ACCOUNT_INFO:
        return
    try:
        info = json.loads(SERVICE_ACCOUNT_INFO)
        creds = service_account.Credentials.from_service_account_info(
            info, scopes=['https://www.googleapis.com/auth/spreadsheets']
        )
        service = build('sheets', 'v4', credentials=creds)
        kst_now = (datetime.now(timezone.utc) + timedelta(hours=9)).strftime('%Y-%m-%d %H:%M:%S')
        
        values = [[kst_now, student_id, topic, turn, user_msg, ai_msg]]
        body = {'values': values}
        service.spreadsheets().values().append(
            spreadsheetId=SPREADSHEET_ID,
            range='대화로그!A:F',
            valueInputOption='RAW',
            insertDataOption='INSERT_ROWS',
            body=body
        ).execute()
    except Exception as e:
        print(f"Error logging to Google Sheets: {e}")

@app.get("/api/health")
async def health_check():
    return {"status": "ok", "service": "jinhae-pedagogy-socratic-api", "model": "gemini-3.8-flash"}

@app.get("/api/topics")
async def get_topics():
    return TOPIC_KNOWLEDGE

@app.post("/api/chat")
async def chat_endpoint(req: ChatRequest, background_tasks: BackgroundTasks):
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY가 서버에 설정되지 않았습니다.")
    
    topic_data = TOPIC_KNOWLEDGE.get(req.topic, TOPIC_KNOWLEDGE["topic1"])
    system_instruction = SOCRATIC_SYSTEM_PROMPT.format(
        topic_title=topic_data["title"],
        core_theories=topic_data["core_theories"]
    )
    
    model = genai.GenerativeModel(
        model_name="gemini-3.8-flash",
        system_instruction=system_instruction,
        generation_config={
            "temperature": 0.7,
            "top_p": 0.9,
            "max_output_tokens": 500,
        }
    )
    
    # 히스토리 구성
    chat_history = []
    for item in req.history:
        role = "user" if item.get("role") == "user" else "model"
        chat_history.append({"role": role, "parts": [item.get("content", "")]})
        
    chat = model.start_chat(history=chat_history)
    
    # 429 Too Many Requests 먹통 방지: 최대 3회 지수 백오프 재시도 로직
    max_retries = 3
    ai_reply = ""
    for attempt in range(max_retries):
        try:
            response = await asyncio.to_thread(chat.send_message, req.message)
            ai_reply = response.text.strip()
            break
        except Exception as e:
            err_str = str(e)
            if "429" in err_str or "quota" in err_str.lower() or "resource" in err_str.lower():
                wait_time = (2 ** attempt) + random.uniform(0.1, 0.5)
                print(f"[Rate Limit 429] 재시도 대기: {wait_time:.2f}초 (시도 {attempt+1}/{max_retries})")
                await asyncio.sleep(wait_time)
            else:
                print(f"Gemini API 에러: {e}")
                raise HTTPException(status_code=500, detail=f"AI 응답 생성 실패: {err_str}")
    
    if not ai_reply:
        ai_reply = "일시적으로 대화량이 많아 지연되고 있습니다. 3초 뒤에 다시 질문을 보내주세요."

    # 구글 시트에 백그라운드로 안전하게 로깅
    background_tasks.add_task(
        log_to_google_sheet_bg,
        student_id=req.student_id,
        topic=req.topic,
        turn=req.turn,
        user_msg=req.message,
        ai_msg=ai_reply
    )

    return {
        "reply": ai_reply,
        "turn": req.turn,
        "is_final": (req.turn >= 12),
        "topic": req.topic
    }
