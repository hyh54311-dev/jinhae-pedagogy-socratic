// 진해고 3학년 교육학 2차시 소크라틱 토론 클라이언트 로직
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

let currentStudent = "";
let currentTopic = "topic1";
let currentTurn = 1;
const MAX_TURNS = 12;
let chatHistory = [];
let aiQuestions = [];

// DOM 요소
const startModal = document.getElementById("start-modal");
const startForm = document.getElementById("start-form");
const mainView = document.getElementById("main-view");
const chatArea = document.getElementById("chat-area");
const chatForm = document.getElementById("chat-form");
const userInput = document.getElementById("user-input");
const btnSend = document.getElementById("btn-send");
const turnNow = document.getElementById("turn-now");
const progressBar = document.getElementById("progress-bar");
const currentTopicTag = document.getElementById("current-topic-tag");
const currentStudentTag = document.getElementById("current-student-tag");
const cooldownBanner = document.getElementById("cooldown-banner");
const cooldownSec = document.getElementById("cooldown-sec");

const btnHelper = document.getElementById("btn-helper");
const helperModal = document.getElementById("helper-modal");
const btnCloseHelper = document.getElementById("btn-close-helper");
const snippetHardest = document.getElementById("snippet-hardest");

// 1. 토론 시작 핸들러
startForm.addEventListener("submit", (e) => {
  e.preventDefault();
  currentStudent = document.getElementById("student-name").value.trim();
  currentTopic = document.getElementById("topic-select").value;

  if (!currentStudent) return;

  currentStudentTag.textContent = currentStudent;
  currentTopicTag.textContent = TOPIC_NAMES[currentTopic];

  startModal.classList.add("hidden");
  mainView.classList.remove("hidden");

  // 첫 번째 발문 삽입 (1차시 종결 질문)
  const openingMsg = OPENING_QUESTIONS[currentTopic];
  appendAiMessage(openingMsg, true);
  aiQuestions.push(openingMsg);
  updateHelperSnippet();
  userInput.focus();
});

// 2. 메시지 전송 핸들러
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = userInput.value.trim();
  if (!text || currentTurn > MAX_TURNS) return;

  // 학생 메시지 추가
  appendUserMessage(text);
  userInput.value = "";
  userInput.disabled = true;
  btnSend.disabled = true;

  // 히스토리에 추가
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
        history: chatHistory.slice(0, -1),
        message: text
      })
    });

    if (!res.ok) {
      throw new Error(`서버 응답 오류 (${res.status})`);
    }

    const data = await res.json();
    loadingRow.remove();

    appendAiMessage(data.reply);
    chatHistory.push({ role: "model", content: data.reply });
    aiQuestions.push(data.reply);
    updateHelperSnippet();

    // 턴 수 증가 및 게이지 업데이트
    currentTurn++;
    updateTurnProgress();

    // 12턴 도달 시 종결 처리
    if (currentTurn > MAX_TURNS) {
      showCompletionAlert();
    } else {
      // 3초 쿨다운 타이머 시작 (API 먹통 방지)
      startCooldown(3);
    }
  } catch (err) {
    loadingRow.remove();
    appendSystemMessage(`⚠️ 일시적인 통신 장애가 발생했습니다: ${err.message}. 잠시 후 다시 전송해주세요.`);
    userInput.disabled = false;
    btnSend.disabled = false;
    userInput.focus();
  }
});

// UI 유틸리티
function appendUserMessage(text) {
  const row = document.createElement("div");
  row.className = "msg-row user";
  row.innerHTML = `
    <div class="msg-avatar">나</div>
    <div class="msg-bubble">${escapeHtml(text)}</div>
  `;
  chatArea.appendChild(row);
  scrollToBottom();
}

function appendAiMessage(text, isOpening = false) {
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
  scrollToBottom();
}

function appendSystemMessage(text) {
  const row = document.createElement("div");
  row.style.textAlign = "center";
  row.style.fontSize = "12px";
  row.style.color = "#dc2626";
  row.style.margin = "8px 0";
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
      이제 상단 <strong>[📝 학습지 도우미]</strong>를 눌러 핵심 내용을 확인하고,<br>
      종이 학습지 뒷면 <strong>⑥ [다듬어진 나의 최종 주장]</strong>을 손글씨로 완성하십시오!
    </p>
  `;
  chatArea.appendChild(completionBox);
  scrollToBottom();
}

function updateHelperSnippet() {
  if (aiQuestions.length > 0) {
    const lastQ = aiQuestions[aiQuestions.length - 1];
    snippetHardest.textContent = lastQ;
  }
}

function copySnippet(elementId) {
  const el = document.getElementById(elementId);
  navigator.clipboard.writeText(el.textContent).then(() => {
    alert("클립보드에 복사되었습니다! 학습지에 손글씨로 옮겨 적으세요.");
  });
}

btnHelper.addEventListener("click", () => helperModal.classList.remove("hidden"));
btnCloseHelper.addEventListener("click", () => helperModal.classList.add("hidden"));

function scrollToBottom() {
  chatArea.scrollTop = chatArea.scrollHeight;
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
