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
let playerName = "";
let playerAge = "";
let currentQuestion = 0;
let score = 0;

const TOTAL_TIME = 900; // 15 Minutos
let timeRemaining = TOTAL_TIME;
let globalTimerInterval;
let isTimeUp = false;

// 1. Inicialização: Buscar Provas ao abrir a página
async function loadTests() {
    const testListDiv = document.getElementById('test-list');
    try {
        const snapshot = await getDocs(collection(db, "cbt_provas"));
        if(snapshot.empty) {
            testListDiv.innerHTML = "<p>Nenhuma prova disponível no momento.</p>";
            return;
        }

        testListDiv.innerHTML = "";
        snapshot.forEach(doc => {
            const testData = doc.data();
            const btn = document.createElement('button');
            btn.className = "btn-test";
            btn.innerText = testData.title;
            // Ao clicar, prepara o ambiente para essa prova específica
            btn.onclick = () => selectTest(doc.id, testData.title, testData.questions);
            testListDiv.appendChild(btn);
        });
        document.querySelector('#menu-screen p').style.display = 'none';
    } catch (e) {
        console.error("Erro ao buscar provas:", e);
        testListDiv.innerHTML = "<p style='color:red;'>Erro de conexão com o servidor.</p>";
    }
}

// 2. Selecionar Prova e Ir para o Login
function selectTest(id, title, testQuestions) {
    activeTest = { id, title };
    questions = testQuestions;
    
    document.getElementById('selected-test-title').innerText = title;
    menuScreen.classList.add('hidden');
    loginScreen.classList.remove('hidden');
    
    fetchAndRenderLeaderboard('initial-leaderboard-body');
}

// 3. Iniciar Jogo (Controle de Tentativas)
document.getElementById('btn-start').addEventListener('click', () => {
    const nameInput = document.getElementById('player-name').value.trim();
    const ageInput = document.getElementById('player-age').value.trim();
    
    if (!nameInput || !ageInput) {
        alert("Preencha nome e idade!");
        return;
    }

    // Controle local atrelado ao ID da prova (2 tentativas por prova)
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

// 5. Exibição e Validação de Questões
function loadQuestion() {
    document.getElementById('next-btn').classList.add('hidden');
    document.getElementById('feedback').innerText = "";
    document.getElementById('display-progress').innerText = `${currentQuestion + 1} / ${questions.length}`;
    
    const q = questions[currentQuestion];
    document.getElementById('question-text').innerText = q.q;
    
    let optionsHtml = "";
    q.options.forEach((opt, index) => {
        optionsHtml += `<button onclick="window.submitAnswer(${index})">${opt}</button>`;
    });
    document.getElementById('options-container').innerHTML = optionsHtml;
}

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

document.getElementById('next-btn').addEventListener('click', () => {
    currentQuestion++;
    if (currentQuestion >= questions.length) {
        clearInterval(globalTimerInterval);
        endGame();
    } else {
        loadQuestion();
    }
});

// 6. Fim de Jogo e Salvar no Ranking
async function endGame() {
    quizScreen.classList.add('hidden');
    resultScreen.classList.remove('hidden');
    
    let timeSpent = TOTAL_TIME - timeRemaining;
    if(timeSpent < 0) timeSpent = TOTAL_TIME;

    document.getElementById('final-score-text').innerHTML = `${playerName}, fez <strong>${score} pontos</strong><br><span style="font-size: 0.6em; color: #757575;">em ${formatTimeDisplay(timeSpent)}!</span>`;
    document.getElementById('leaderboard-body').innerHTML = "<tr><td colspan='4'>A gravar e ordenar ranking... ☁️</td></tr>";
    
    try {
        await addDoc(collection(db, "cbt_rankings"), {
            testId: activeTest.id,  // Vincula a nota à prova específica
            name: playerName,
            age: playerAge,
            points: score,
            time: timeSpent
        });
    } catch (e) {
        console.error("Erro ao salvar nota: ", e);
    }
    
    await fetchAndRenderLeaderboard('leaderboard-body');
}

// 7. Buscar e Ordenar Ranking (Corrigido: Ordenação pelo Cliente - Ponto Cego Resolvido)
async function fetchAndRenderLeaderboard(tbodyId) {
    let tbody = document.getElementById(tbodyId);
    try {
        // Busca TODAS as notas desta prova específica sem exigir índices de composição
        const q = query(collection(db, "cbt_rankings"), where("testId", "==", activeTest.id));
        const querySnapshot = await getDocs(q);
        
        let scores = [];
        querySnapshot.forEach(doc => scores.push(doc.data()));

        // Ordenação client-side: 1º Pontos Decrescente, 2º Tempo Crescente
        scores.sort((a, b) => {
            if (b.points === a.points) return a.time - b.time;
            return b.points - a.points;
        });

        tbody.innerHTML = "";
        let i = 0;
        
        // Exibir o Top 10
        for(let s of scores.slice(0, 10)) {
            let isCurrent = (s.name === playerName && s.points === score && playerName !== "") ? 'class="highlight"' : '';
            let medal = (i === 0) ? "🥇 1º" : (i === 1) ? "🥈 2º" : (i === 2) ? "🥉 3º" : `${i + 1}º`;
            
            tbody.innerHTML += `
                <tr ${isCurrent}>
                    <td>${medal}</td>
                    <td>${s.name} (${s.age} anos)</td>
                    <td>${s.points}</td>
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

// Inicializa a aplicação ao abrir
window.onload = loadTests;