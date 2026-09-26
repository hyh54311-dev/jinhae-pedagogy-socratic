// 진해고 3학년 교육학 2차시 소크라틱 토론 클라이언트 로직 v2.0
const OPENING_QUESTIONS = {
  topic1: "보상을 끊은 뒤에도 학생이 스스로 공부를 이어가게 하려면, 보상을 언제, 어떻게 거둬들여야 한다고 생각합니까?",
  topic2: "부모의 경제력과 사교육 격차가 엄연히 존재하는 현실에서, 학교 시험(내신·수능) 결과를 온전히 '공정한 개인의 능력과 노력'이라고 정당화할 수 있는 윤리적 근거는 무엇입니까?",
  topic3: "AI가 질문 한 줄에 최적화된 풀이와 요약을 제공할 때 발생하는 '사유의 외주화(Outsourcing of Thinking)'를 차단하고, 학생 스스로 끙끙 앓으며 개념을 구성하게 만들 구체적 통제 장치는 무엇입니까?"
};

const TOPIC_NAMES = {
  topic1: "1번 주제: 보상과 동기",
  topic2: "2번 주제: 학교와 불평등",
  topic3: "3번 주제: AI와 미래교육"
};

const TOPIC_EVIDENCE_MAP = {
  topic1: "• 롤랜드 프라이어(2011) RCT: 투입 보상(독서 등)의 학업성취 유의미 향상\n• 울프람 슐츠: 도파민 보상예측오차(RPE, 초기 행동 점화 플러그)\n• 데시 & 라이언(1999) 128개 메타분석: 유형적 보상의 내재적 동기 훼손(d = -0.34)\n• 마크 레퍼(1973) 상장 실험: 과잉 정당화 효과(외재적 보상이 내적 흥미 구축)",
  topic2: "• 블라우 & 던컨(1967) 지위획득 모형: 본인 교육성취의 직업지위 직접 효과\n• 1974 고교평준화 정책: 취약계층 상급학교 진학 기회 확대\n• 부르디외: 문화자본과 아비투스(상징적 폭력과 불평등 은폐)\n• 2023 사교육비 조사: 월 800만원↑(67.1만원) vs 300만원↓(18.3만원) 3.7배 격차\n• 한국은행(2024): 서울대 진학률 격차 중 92%, 상위권대 75%가 거주지(잠재력 외) 효과",
  topic3: "• 벤저민 블룸(1984): 완전학습과 1:1 튜터링의 2시그마 효과 가설\n• 살만 칸: 칸미고(Khanmigo) 적응형 튜터링 및 소크라틱 가드레일\n• 커트 반렌(2011) 메타분석: 인간 튜터 0.79σ vs 지능형 튜터 0.76σ (2시그마 과장 해체)\n• 로버트 비요크: 바람직한 어려움(Desirable Difficulties) 소멸 및 유창성의 착각\n• 비고츠키: 근접발달영역(ZPD) & 닐 포스트만: 교육의 인간적·윤리적 모델링 대체 불가론"
};

const STORAGE_KEY = "jinhae_socratic_session_v2";

let currentStudent = "";
let currentTopic = "topic1";
let currentPin = "2026";
let currentTurn = 1;
const MAX_TURNS = 12;
let chatHistory = [];
let aiQuestions = [];

// DOM 요소
const startModal = document.getElementById("start-modal");
const startForm = document.getElementById("start-form");
const classPinInput = document.getElementById("class-pin");
const studentNameInput = document.getElementById("student-name");
const topicSelect = document.getElementById("topic-select");

const mainView = document.getElementById("main-view");
const chatArea = document.getElementById("chat-area");
const chatForm = document.getElementById("chat-form");
const userInput = document.getElementById("user-input");
const btnSend = document.getElementById("btn-send");
const charCount = document.getElementById("char-count");
const turnNow = document.getElementById("turn-now");
const progressBar = document.getElementById("progress-bar");
const currentTopicTag = document.getElementById("current-topic-tag");
const currentStudentTag = document.getElementById("current-student-tag");
const cooldownBanner = document.getElementById("cooldown-banner");
const cooldownSec = document.getElementById("cooldown-sec");

const btnHelper = document.getElementById("btn-helper");
const btnResetChat = document.getElementById("btn-reset-chat");
const helperModal = document.getElementById("helper-modal");
const btnCloseHelper = document.getElementById("btn-close-helper");
const helperQSelect = document.getElementById("helper-q-select");
const snippetHardest = document.getElementById("snippet-hardest");
const snippetStuck = document.getElementById("snippet-stuck");
const snippetEvidence = document.getElementById("snippet-evidence");
const snippetFinalFrame = document.getElementById("snippet-final-frame");

const btnCopyQ1 = document.getElementById("btn-copy-q1");
const btnCopyQ2 = document.getElementById("btn-copy-q2");
const btnCopyQ3 = document.getElementById("btn-copy-q3");
const btnCopyQ6 = document.getElementById("btn-copy-q6");

// 세션 저장 및 복구
function saveSessionState() {
  const state = {
    student: currentStudent,
    topic: currentTopic,
    pin: currentPin,
    turn: currentTurn,
    history: chatHistory,
    questions: aiQuestions
  };
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.warn("SessionStorage 저장 실패:", err);
  }
}

function restoreSessionState() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const state = JSON.parse(raw);
    if (!state.student || !state.history || state.history.length === 0) return false;

    currentStudent = state.student;
    currentTopic = state.topic || "topic1";
    currentPin = state.pin || "2026";
    currentTurn = state.turn || 1;
    chatHistory = state.history || [];
    aiQuestions = state.questions || [];

    // UI 복원
    currentStudentTag.textContent = currentStudent;
    currentTopicTag.textContent = TOPIC_NAMES[currentTopic];
    updateTurnProgress();

    startModal.classList.add("hidden");
    mainView.classList.remove("hidden");

    chatArea.innerHTML = "";
    chatHistory.forEach((item, idx) => {
      if (item.role === "user") {
        appendUserMessage(item.content, false);
      } else {
        appendAiMessage(item.content, idx === 0, false);
      }
    });

    updateHelperModalContent();

    if (currentTurn > MAX_TURNS) {
      showCompletionAlert();
    }

    scrollToBottom();
    return true;
  } catch (err) {
    console.warn("Session 복구 실패:", err);
    return false;
  }
}

// 1. 토론 시작 핸들러
startForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const rawId = studentNameInput.value.trim();
  const pin = classPinInput.value.trim();
  currentTopic = topicSelect.value;

  if (!rawId || !pin) return;

  currentStudent = rawId;
  currentPin = pin;

  currentStudentTag.textContent = currentStudent;
  currentTopicTag.textContent = TOPIC_NAMES[currentTopic];

  startModal.classList.add("hidden");
  mainView.classList.remove("hidden");

  // 첫 번째 발문 삽입 (1차시 종결 질문 직면)
  const openingMsg = OPENING_QUESTIONS[currentTopic];
  appendAiMessage(openingMsg, true, true);

  // [중요 버그 수정 ①] 모델의 첫 오프닝 질문을 히스토리에 반드시 추가!
  chatHistory.push({ role: "model", content: openingMsg });
  aiQuestions.push(openingMsg);

  updateHelperModalContent();
  saveSessionState();
  userInput.focus();
});

// 2. 메시지 전송 핸들러
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = userInput.value.trim();
  if (!text || currentTurn > MAX_TURNS) return;

  if (text.length > 500) {
    alert("메시지는 500자 이내로 작성해주세요.");
    return;
  }

  // 학생 메시지 화면 렌더링
  appendUserMessage(text, true);
  userInput.value = "";
  charCount.textContent = "0";
  userInput.disabled = true;
  btnSend.disabled = true;

  // 히스토리에 학생 메시지 추가
  chatHistory.push({ role: "user", content: text });

  // 로딩 인디케이터 표시
  const loadingRow = showLoadingIndicator();

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        student_id: currentStudent,
        topic: currentTopic,
        turn: currentTurn,
        history: chatHistory.slice(0, -1), // 현재 학생 발화를 제외한 이전 맥락 전달
        message: text,
        pin: currentPin
      })
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || `서버 통신 오류 (${res.status})`);
    }

    const data = await res.json();
    loadingRow.remove();

    // AI 응답 렌더링
    appendAiMessage(data.reply, false, true);
    chatHistory.push({ role: "model", content: data.reply });
    aiQuestions.push(data.reply);
    updateHelperModalContent();

    // 턴 수 증가 및 프로그레스 업데이트
    currentTurn++;
    updateTurnProgress();
    saveSessionState();

    // 12턴 도달 시 종결 처리
    if (currentTurn > MAX_TURNS) {
      showCompletionAlert();
    } else {
      // 3초 쿨다운 타이머 시작 (API 먹통 및 연타 방지)
      startCooldown(3);
    }
  } catch (err) {
    loadingRow.remove();
    // [중요 버그 수정 ④] 에러 발생 시 미완료된 user 메시지를 히스토리에서 롤백하고 입력 텍스트 복구
    if (chatHistory.length > 0 && chatHistory[chatHistory.length - 1].role === "user") {
      chatHistory.pop();
    }
    userInput.value = text;
    charCount.textContent = text.length;

    appendSystemMessage(`⚠️ ${err.message}`);
    userInput.disabled = false;
    btnSend.disabled = false;
    userInput.focus();
  }
});

// 글자 수 실시간 카운팅
userInput.addEventListener("input", () => {
  charCount.textContent = userInput.value.length;
});

// UI 유틸리티
function appendUserMessage(text, doScroll = true) {
  const row = document.createElement("div");
  row.className = "msg-row user";
  row.innerHTML = `
    <div class="msg-avatar">나</div>
    <div class="msg-bubble">${escapeHtml(text)}</div>
  `;
  chatArea.appendChild(row);
  if (doScroll) scrollToBottom();
}

function appendAiMessage(text, isOpening = false, doScroll = true) {
  const row = document.createElement("div");
  row.className = "msg-row ai";

  let formatted = escapeHtml(text);
  if (formatted.includes("▶")) {
    const parts = formatted.split("▶");
    formatted = parts[0] + `<span class="ai-highlight">▶ ${parts.slice(1).join("▶")}</span>`;
  }

  row.innerHTML = `
    <div class="msg-avatar">AI</div>
    <div class="msg-bubble">
      ${isOpening ? `<span style="font-size:11px; font-weight:700; color:#2563eb; display:block; margin-bottom:4px;">[1차시 종결 질문 직면]</span>` : ""}
      ${formatted}
    </div>
  `;
  chatArea.appendChild(row);
  if (doScroll) scrollToBottom();
}

function appendSystemMessage(text) {
  const row = document.createElement("div");
  row.style.textAlign = "center";
  row.style.fontSize = "12px";
  row.style.color = "#dc2626";
  row.style.margin = "8px 0";
  row.style.backgroundColor = "#fef2f2";
  row.style.padding = "6px 12px";
  row.style.borderRadius = "6px";
  row.textContent = text;
  chatArea.appendChild(row);
  scrollToBottom();
}

function showLoadingIndicator() {
  const row = document.createElement("div");
  row.className = "msg-row ai";
  row.innerHTML = `
    <div class="msg-avatar">AI</div>
    <div class="msg-bubble" style="color:#64748b; font-style:italic;">
      AI 튜터가 당신의 논리를 짚어보는 중입니다... 💭
    </div>
  `;
  chatArea.appendChild(row);
  scrollToBottom();
  return row;
}

function updateTurnProgress() {
  const displayTurn = Math.min(currentTurn, MAX_TURNS);
  turnNow.textContent = displayTurn;
  const pct = (displayTurn / MAX_TURNS) * 100;
  progressBar.style.width = `${pct}%`;
}

function startCooldown(seconds) {
  cooldownBanner.classList.remove("hidden");
  let remaining = seconds;
  cooldownSec.textContent = remaining;

  const timer = setInterval(() => {
    remaining--;
    if (remaining > 0) {
      cooldownSec.textContent = remaining;
    } else {
      clearInterval(timer);
      cooldownBanner.classList.add("hidden");
      userInput.disabled = false;
      btnSend.disabled = false;
      userInput.focus();
    }
  }, 1000);
}

function showCompletionAlert() {
  userInput.disabled = true;
  btnSend.disabled = true;
  userInput.placeholder = "12턴 토론이 성공적으로 완료되었습니다. 학습지 뒷면을 완성하세요!";

  const completionBox = document.createElement("div");
  completionBox.style.background = "#ecfdf5";
  completionBox.style.border = "1.5px solid #10b981";
  completionBox.style.borderRadius = "12px";
  completionBox.style.padding = "16px";
  completionBox.style.margin = "12px 0";
  completionBox.style.textAlign = "center";
  completionBox.innerHTML = `
    <h3 style="color:#065f46; font-size:16px; font-weight:800; margin-bottom:6px;">🎉 12턴 소크라틱 토론 완료!</h3>
    <p style="color:#047857; font-size:13px; line-height:1.5;">
      AI와의 치열한 문답을 모두 마쳤습니다.<br>
      상단 <strong>[📝 학습지 도우미]</strong>를 눌러 핵심 내용을 확인하고,<br>
      종이 학습지 뒷면 <strong>⑥ [다듬어진 나의 최종 주장]</strong>을 손글씨로 완성하십시오!
    </p>
  `;
  chatArea.appendChild(completionBox);
  scrollToBottom();
}

// 학습지 도우미 모달 업데이트 (3대 문항 정밀 지원)
function updateHelperModalContent() {
  // 1. 문항 ①: AI가 던진 질문 목록 갱신
  helperQSelect.innerHTML = "";
  if (aiQuestions.length === 0) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "아직 질문이 없습니다.";
    helperQSelect.appendChild(opt);
    snippetHardest.textContent = "토론이 시작되면 질문이 표시됩니다.";
  } else {
    aiQuestions.forEach((q, idx) => {
      const opt = document.createElement("option");
      opt.value = q;
      const cleanSummary = q.replace(/\[1차시 종결 질문 직면\]/g, "").replace(/\n/g, " ").trim();
      opt.textContent = `[턴 ${idx === 0 ? "오프닝" : idx}] ${cleanSummary.slice(0, 38)}...`;
      helperQSelect.appendChild(opt);
    });
    // 기본으로 가장 최근(또는 마지막) 질문 선택
    helperQSelect.selectedIndex = helperQSelect.options.length - 1;
    snippetHardest.textContent = helperQSelect.value;
  }

  // 3. 문항 ③: 주제별 실증 학술 근거 표시
  snippetEvidence.textContent = TOPIC_EVIDENCE_MAP[currentTopic] || "해당 주제의 학술 근거를 불러오는 중입니다.";
}

helperQSelect.addEventListener("change", () => {
  snippetHardest.textContent = helperQSelect.value;
});

// 복사 헬퍼 함수
function copyToClipboard(text, msg) {
  navigator.clipboard.writeText(text).then(() => {
    alert(msg);
  }).catch(() => {
    // 대체 복사
    const tempInput = document.createElement("textarea");
    tempInput.value = text;
    document.body.appendChild(tempInput);
    tempInput.select();
    document.execCommand("copy");
    document.body.removeChild(tempInput);
    alert(msg);
  });
}

btnCopyQ1.addEventListener("click", () => {
  copyToClipboard(snippetHardest.textContent, "문항 ① 질문이 클립보드에 복사되었습니다! 학습지에 옮겨 적으세요.");
});

btnCopyQ2.addEventListener("click", () => {
  copyToClipboard(snippetStuck.textContent.trim(), "문항 ② 서술틀이 복사되었습니다!");
});

btnCopyQ3.addEventListener("click", () => {
  copyToClipboard(snippetEvidence.textContent.trim(), "문항 ③ 학술 근거가 복사되었습니다!");
});

btnCopyQ6.addEventListener("click", () => {
  copyToClipboard(snippetFinalFrame.textContent.trim(), "문항 ⑥ 최종 주장 문장틀이 복사되었습니다!");
});

btnHelper.addEventListener("click", () => {
  updateHelperModalContent();
  helperModal.classList.remove("hidden");
});

btnCloseHelper.addEventListener("click", () => {
  helperModal.classList.add("hidden");
});

// 대화 초기화 버튼
btnResetChat.addEventListener("click", () => {
  if (confirm("정말로 대화를 초기화하고 처음부터 다시 시작하시겠습니까?\n(현재까지의 대화 기록이 삭제됩니다)")) {
    sessionStorage.removeItem(STORAGE_KEY);
    window.location.reload();
  }
});

function scrollToBottom() {
  chatArea.scrollTop = chatArea.scrollHeight;
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// 페이지 로드 시 세션 복원 시도
window.addEventListener("DOMContentLoaded", () => {
  restoreSessionState();
});
