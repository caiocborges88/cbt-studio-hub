// app.js
import { db } from "./firebase-config.js";
import { collection, getDocs, addDoc, query, where } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Telas
const menuScreen = document.getElementById('menu-screen');
const loginScreen = document.getElementById('login-screen');
const quizScreen = document.getElementById('quiz-screen');
const resultScreen = document.getElementById('result-screen');

// Variáveis do Estado do Jogo
let activeTest = null; 
let questions = [];
let activeStudyMaterial = ""; // NOVO: Guarda o texto do material
let playerName = "";
let playerAge = "";
let currentQuestion = 0;
let score = 0;
let dissertativeAnswers = [];

const TOTAL_TIME = 900; // 15 Minutos
let timeRemaining = TOTAL_TIME;
let globalTimerInterval;
let isTimeUp = false;

// ----------------------------------------------------
// CONTROLE DO MODAL DE ESTUDO
// ----------------------------------------------------
const studyModal = document.getElementById('study-modal');
const studyContent = document.getElementById('study-content');

document.getElementById('btn-open-study-login').addEventListener('click', () => studyModal.classList.remove('hidden'));
document.getElementById('btn-open-study-quiz').addEventListener('click', () => studyModal.classList.remove('hidden'));
document.getElementById('close-modal-btn').addEventListener('click', () => studyModal.classList.add('hidden'));

// ----------------------------------------------------
// FUNÇÃO AUXILIAR: Comprimir foto
// ----------------------------------------------------
const compressImage = (file) => new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let { width, height } = img;
            if (width > 800 || height > 800) {
                if (width > height) { height = Math.floor(height * (800 / width)); width = 800; } 
                else { width = Math.floor(width * (800 / height)); height = 800; }
            }
            canvas.width = width; canvas.height = height;
            canvas.getContext('2d').drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.6).split(',')[1]);
        };
    };
});

// 1. Inicialização: Buscar Provas
async function loadTests() {
    const testListDiv = document.getElementById('test-list');
    try {
        const snapshot = await getDocs(collection(db, "cbt_provas"));
        if(snapshot.empty) return testListDiv.innerHTML = "<p>Nenhuma prova disponível no momento.</p>";

        testListDiv.innerHTML = "";
        snapshot.forEach(doc => {
            const testData = doc.data();
            const btn = document.createElement('button');
            btn.className = "btn-test";
            btn.innerText = testData.title;
            // Envia também o studyMaterial (se não existir, envia string vazia)
            btn.onclick = () => selectTest(doc.id, testData.title, testData.questions, testData.studyMaterial || "");
            testListDiv.appendChild(btn);
        });
        document.querySelector('#menu-screen p').style.display = 'none';
    } catch (e) {
        testListDiv.innerHTML = "<p style='color:red;'>Erro de conexão com o servidor.</p>";
    }
}

// 2. Selecionar Prova
function selectTest(id, title, testQuestions, studyMaterial) {
    activeTest = { id, title };
    questions = testQuestions;
    activeStudyMaterial = studyMaterial;
    
    // Atualiza o texto dentro da janela Modal usando o tradutor Markdown
    if (activeStudyMaterial) {
        // "Cura" as tabelas quebradas pela IA: remove quebras de linha (Enters) indevidas antes das barras
        let materialLimpo = activeStudyMaterial.replace(/\n+[\s\u00A0]+\|/g, ' | ');
        studyContent.innerHTML = marked.parse(materialLimpo);
    } else {
        studyContent.innerHTML = "<p>Nenhum material de estudo foi anexado pelo professor nesta prova.</p>";
    }
    
    document.getElementById('selected-test-title').innerText = title;
    menuScreen.classList.add('hidden');
    loginScreen.classList.remove('hidden');
    
    fetchAndRenderLeaderboard('initial-leaderboard-body');
}

// 3. Iniciar Jogo
document.getElementById('btn-start').addEventListener('click', () => {
    const nameInput = document.getElementById('player-name').value.trim();
    const ageInput = document.getElementById('player-age').value.trim();
    
    if (!nameInput || !ageInput) {
        alert("Preencha nome e idade!");
        return;
    }

    const storageKey = `attempts_${activeTest.id}`;
    let attemptsObj = JSON.parse(localStorage.getItem(storageKey)) || {};
    let currentAttempts = attemptsObj[nameInput] || 0;
    
    if (currentAttempts >= 2) {
        alert(`Poxa, ${nameInput}! Limite de 2 tentativas esgotado para esta prova.`);
        return;
    }
    
    attemptsObj[nameInput] = currentAttempts + 1;
    localStorage.setItem(storageKey, JSON.stringify(attemptsObj));

    playerName = nameInput;
    playerAge = ageInput;
    dissertativeAnswers = []; // Zera as respostas para um novo jogo
    score = 0;
    currentQuestion = 0;
    
    loginScreen.classList.add('hidden');
    quizScreen.classList.remove('hidden');
    document.getElementById('display-name').innerText = `Jogador: ${playerName}`;
    
    startGlobalTimer();
    loadQuestion();
});

// 4. Mecânica do Cronômetro
function startGlobalTimer() {
    timeRemaining = TOTAL_TIME;
    updateTimerDisplay();
    
    globalTimerInterval = setInterval(() => {
        timeRemaining--;
        if (timeRemaining > 0) {
            updateTimerDisplay();
            if (timeRemaining <= 10) {
                const gt = document.getElementById('global-timer');
                gt.style.color = "#D32F2F"; gt.style.backgroundColor = "#FFEBEE";
            }
        } else if (timeRemaining === 0) {
            isTimeUp = true;
            const gt = document.getElementById('global-timer');
            gt.innerText = "Tempo Esgotado! Acertos valem -1 ponto!";
            gt.style.backgroundColor = "#FFCDD2"; gt.style.color = "#B71C1C";
        }
    }, 1000);
}

function updateTimerDisplay() {
    let m = Math.floor(timeRemaining / 60).toString().padStart(2, '0');
    let s = (timeRemaining % 60).toString().padStart(2, '0');
    document.getElementById('global-timer').innerText = `Tempo Restante: ${m}:${s}`;
}

function formatTimeDisplay(totalSeconds) {
    return `${Math.floor(totalSeconds / 60)}m ${totalSeconds % 60}s`;
}

// 5. Exibição Híbrida (Múltipla Escolha / Dissertativa)
function loadQuestion() {
    document.getElementById('next-btn').classList.add('hidden');
    document.getElementById('feedback').innerText = "";
    document.getElementById('display-progress').innerText = `${currentQuestion + 1} / ${questions.length}`;
    
    const q = questions[currentQuestion];
    document.getElementById('question-text').innerText = q.q;
    
    const optionsContainer = document.getElementById('options-container');
    const dissertativeContainer = document.getElementById('dissertative-container');
    
    if (q.options && Array.isArray(q.options) && q.options.length > 0) {
        optionsContainer.classList.remove('hidden');
        dissertativeContainer.classList.add('hidden');
        
        let optionsHtml = "";
        q.options.forEach((opt, index) => {
            optionsHtml += `<button onclick="window.submitAnswer(${index})">${opt}</button>`;
        });
        optionsContainer.innerHTML = optionsHtml;
    } else {
        optionsContainer.classList.add('hidden');
        dissertativeContainer.classList.remove('hidden');
        
        document.getElementById('text-answer').value = "";
        document.getElementById('photo-answer').value = "";
        
        document.getElementById('text-answer').disabled = false;
        document.getElementById('photo-answer').disabled = false;
        document.getElementById('btn-submit-dissertative').classList.remove('hidden');
    }
}

// Envio de Múltipla Escolha
window.submitAnswer = function(selectedIndex) {
    const q = questions[currentQuestion];
    const feedback = document.getElementById('feedback');
    
    document.querySelectorAll('.options button').forEach(btn => btn.disabled = true);

    if(selectedIndex === q.answer) {
        if (isTimeUp) {
            score -= 1;
            feedback.innerText = `✅ Certo... mas tempo esgotado! -1 ponto.`;
            feedback.style.color = "#E65100";
        } else {
            score += 100;
            feedback.innerText = `✅ Certo! +100 pontos!`;
            feedback.style.color = "#2E7D32";
        }
    } else {
        feedback.innerText = `❌ Ops! A correta era: ${q.options[q.answer]}`;
        feedback.style.color = "#C62828";
    }
    
    document.getElementById('display-score').innerText = `Pontos: ${score}`;
    document.getElementById('next-btn').classList.remove('hidden');
};

// Envio de Questão Dissertativa (Assíncrono com Compressão)
document.getElementById('btn-submit-dissertative').addEventListener('click', async () => {
    const textVal = document.getElementById('text-answer').value.trim();
    const photoInput = document.getElementById('photo-answer');
    const fileVal = photoInput.files.length;
    const feedback = document.getElementById('feedback');

    if (!textVal && fileVal === 0) {
        alert("Por favor, digite uma resposta ou envie uma foto do seu caderno!");
        return;
    }

    document.getElementById('text-answer').disabled = true;
    photoInput.disabled = true;
    document.getElementById('btn-submit-dissertative').classList.add('hidden');
    
    feedback.innerText = "Processando imagem... ⏳";
    feedback.style.color = "#0277BD";

    let base64Photo = null;
    if (fileVal > 0) {
        base64Photo = await compressImage(photoInput.files[0]);
    }

    // Salva a resposta no array em memória
    dissertativeAnswers.push({
        questionIndex: currentQuestion + 1,
        questionText: questions[currentQuestion].q,
        gabarito: questions[currentQuestion].gabarito || "Sem gabarito registrado",
        textAnswer: textVal,
        photoBase64: base64Photo
    });
    
    if (isTimeUp) {
        score -= 1;
    } else {
        score += 100; 
    }
    
    feedback.innerText = `✅ Resposta registrada! (Aguardando correção do professor)`;
    feedback.style.color = "#2E7D32";
    
    document.getElementById('display-score').innerText = `Pontos: ${score}`;
    document.getElementById('next-btn').classList.remove('hidden');
});

// Avançar questão
document.getElementById('next-btn').addEventListener('click', () => {
    currentQuestion++;
    if (currentQuestion >= questions.length) {
        clearInterval(globalTimerInterval);
        endGame();
    } else {
        loadQuestion();
    }
});

// 6. Fim de Jogo e Salvar no Ranking com as Respostas Inclusas
async function endGame() {
    quizScreen.classList.add('hidden');
    resultScreen.classList.remove('hidden');
    
    let timeSpent = TOTAL_TIME - timeRemaining;
    if(timeSpent < 0) timeSpent = TOTAL_TIME;

    document.getElementById('final-score-text').innerHTML = `${playerName}, fez <strong>${score} pontos provisórios</strong><br><span style="font-size: 0.6em; color: #757575;">em ${formatTimeDisplay(timeSpent)}!</span>`;
    document.getElementById('leaderboard-body').innerHTML = "<tr><td colspan='4'>A gravar e ordenar ranking... ☁️</td></tr>";
    
    try {
        await addDoc(collection(db, "cbt_rankings"), {
            testId: activeTest.id,
            name: playerName,
            age: playerAge,
            points: score,
            time: timeSpent,
            // Novo: Enviando as provas escritas para a nuvem
            dissertativeAnswers: dissertativeAnswers,
            status: dissertativeAnswers.length > 0 ? "Pendente" : "Corrigido"
        });
    } catch (e) {
        console.error("Erro ao salvar nota: ", e);
    }
    
    await fetchAndRenderLeaderboard('leaderboard-body');
}

// 7. Buscar e Ordenar Ranking 
async function fetchAndRenderLeaderboard(tbodyId) {
    let tbody = document.getElementById(tbodyId);
    try {
        const q = query(collection(db, "cbt_rankings"), where("testId", "==", activeTest.id));
        const querySnapshot = await getDocs(q);
        
        let scores = [];
        querySnapshot.forEach(doc => scores.push(doc.data()));

        scores.sort((a, b) => {
            if (b.points === a.points) return a.time - b.time;
            return b.points - a.points;
        });

        tbody.innerHTML = "";
        let i = 0;
        
        for(let s of scores.slice(0, 10)) {
            let isCurrent = (s.name === playerName && s.points === score && playerName !== "") ? 'class="highlight"' : '';
            let medal = (i === 0) ? "🥇 1º" : (i === 1) ? "🥈 2º" : (i === 2) ? "🥉 3º" : `${i + 1}º`;
            
            // Adiciona uma etiqueta visual se a nota do aluno puder mudar
            let pendingBadge = s.status === "Pendente" ? " ⏳" : "";

            tbody.innerHTML += `
                <tr ${isCurrent}>
                    <td>${medal}</td>
                    <td>${s.name} (${s.age} anos)</td>
                    <td>${s.points}${pendingBadge}</td>
                    <td>${formatTimeDisplay(s.time)}</td>
                </tr>`;
            i++;
        }

        if (scores.length === 0) tbody.innerHTML = "<tr><td colspan='4'>Sem resultados. Seja o primeiro!</td></tr>";
    } catch (e) {
        console.error("Erro ao ler ranking: ", e);
        tbody.innerHTML = "<tr><td colspan='4' style='color:red;'>Erro ao carregar ranking.</td></tr>";
    }
}

window.onload = loadTests;