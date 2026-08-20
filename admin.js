import { db, auth } from "./firebase-config.js";
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { collection, addDoc, getDocs, query, where, doc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Elementos Básicos
const loginScreen = document.getElementById('login-screen');
const dashboardScreen = document.getElementById('dashboard-screen');
const btnLogin = document.getElementById('btn-login');
const btnLogout = document.getElementById('btn-logout');

// Elementos das Abas
const tabCriar = document.getElementById('tab-criar');
const tabCorrigir = document.getElementById('tab-corrigir');
const tabGerenciar = document.getElementById('tab-gerenciar');
const sectionCriar = document.getElementById('section-criar');
const sectionCorrigir = document.getElementById('section-corrigir');
const sectionGerenciar = document.getElementById('section-gerenciar');

// Elementos de Criação
const apiKeyInput = document.getElementById('gemini-api-key');
const btnGerarIA = document.getElementById('btn-gerar-ia');
const aiStatus = document.getElementById('ai-status');
const btnSalvar = document.getElementById('btn-salvar');
const statusBox = document.getElementById('status');

// Elementos de Correção e Gerenciamento
const btnCarregarPendencias = document.getElementById('btn-carregar-pendencias');
const listaPendencias = document.getElementById('lista-pendencias');
const btnCarregarProvas = document.getElementById('btn-carregar-provas');
const listaProvasGerenciar = document.getElementById('lista-provas-gerenciar');

// Carregar Chave da API
apiKeyInput.value = localStorage.getItem('geminiApiKey') || '';
apiKeyInput.addEventListener('input', () => localStorage.setItem('geminiApiKey', apiKeyInput.value.trim()));

// Navegação entre Abas
tabCriar.addEventListener('click', () => {
    sectionCriar.style.display = 'block';
    sectionCorrigir.style.display = 'none';
    sectionGerenciar.style.display = 'none';
});
tabCorrigir.addEventListener('click', () => {
    sectionCriar.style.display = 'none';
    sectionCorrigir.style.display = 'block';
    sectionGerenciar.style.display = 'none';
    carregarPendencias();
});
tabGerenciar.addEventListener('click', () => {
    sectionCriar.style.display = 'none';
    sectionCorrigir.style.display = 'none';
    sectionGerenciar.style.display = 'block';
    carregarProvas();
});

// Autenticação
onAuthStateChanged(auth, (user) => {
    if (user) {
        loginScreen.style.display = 'none';
        dashboardScreen.style.display = 'block';
    } else {
        loginScreen.style.display = 'block';
        dashboardScreen.style.display = 'none';
    }
});

btnLogin.addEventListener('click', async () => {
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value.trim();
    if(!email || !password) return;
    try {
        await signInWithEmailAndPassword(auth, email, password);
        document.getElementById('login-error').style.display = 'none';
    } catch (error) {
        document.getElementById('login-error').innerText = "Erro ao fazer login.";
        document.getElementById('login-error').style.display = 'block';
    }
});

btnLogout.addEventListener('click', async () => await signOut(auth));

// ----------------------------------------------------
// MOTOR DE CRIAÇÃO (TEXTO -> IA)
// ----------------------------------------------------
btnGerarIA.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();
    const textContent = document.getElementById('materia-conteudo').value.trim();
    
    if (!apiKey) return aiStatus.innerHTML = "<span style='color:red;'>Insira sua chave de API do Gemini.</span>";
    if (!textContent || textContent.length < 50) return aiStatus.innerHTML = "<span style='color:red;'>Cole um texto válido no campo de Material de Estudo.</span>";

    aiStatus.innerHTML = "<span style='color:blue;'>Lendo o texto e gerando questões (Isso leva alguns segundos)... 🧠⏳</span>";
    btnGerarIA.disabled = true;

    // NOVO: Captura os valores digitados no painel
    const qtdObj = parseInt(document.getElementById('qtd-objetivas').value) || 20;
    const qtdDiss = parseInt(document.getElementById('qtd-dissertativas').value) || 0;

    try {
        // NOVO: Adapta a regra da IA com base na escolha do professor
        let regrasDissertativas = qtdDiss > 0 
            ? `e ${qtdDiss} questões dissertativas\n3. Dissertativas: { "q": "Pergunta?", "gabarito": "Explicação" }` 
            : `(NÃO crie questões dissertativas, faça apenas de múltipla escolha).`;

        const prompt = `Você é um professor. Crie ${qtdObj} questões de múltipla escolha ${regrasDissertativas} baseadas EXCLUSIVAMENTE no material abaixo:
        --- INÍCIO DO MATERIAL ---
        ${textContent.substring(0, 50000)}
        --- FIM DO MATERIAL ---
        Regras RIGOROSAS:
        1. Retorne ESTRITAMENTE um array JSON válido sem markdown.
        2. Múltipla Escolha: { "q": "Pergunta?", "options": ["A", "B", "C", "D"], "answer": 1 }`;

        // LISTA DE MOTORES BLINDADA E ESTÁVEL
        const modelos = [
            'gemini-flash-lite-latest', 
            'gemini-1.5-flash', 
            'gemini-2.0-flash', 
            'gemini-flash-latest', 
            'gemini-pro'
        ];
        
        let iaResponseText = "";
        let sucesso = false;

        for (const modelo of modelos) {
            aiStatus.innerHTML = `<span style='color:blue;'>Conectando ao motor ${modelo}... 🧠⏳</span>`;
            try {
                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
                });
                const data = await response.json();
                if (response.ok && data.candidates) {
                    iaResponseText = data.candidates[0].content.parts[0].text;
                    sucesso = true;
                    break;
                }
            } catch (err) { }
        }

        if (!sucesso) throw new Error("Servidores do Google sobrecarregados. Tente novamente em 1 minuto.");

        iaResponseText = iaResponseText.replace(/```json/gi, '').replace(/```/g, '').trim();
        JSON.parse(iaResponseText); 
        document.getElementById('materia-questoes').value = iaResponseText;
        aiStatus.innerHTML = "<span style='color:green;'>✅ Questões geradas com sucesso!</span>";
    } catch (error) {
        aiStatus.innerHTML = `<span style='color:red;'>Erro: ${error.message}</span>`;
    } finally {
        btnGerarIA.disabled = false;
    }
});

btnSalvar.addEventListener('click', async () => {
    const titulo = document.getElementById('materia-nome').value.trim();
    const conteudoText = document.getElementById('materia-conteudo').value.trim();
    const questoesText = document.getElementById('materia-questoes').value.trim();

    if(!titulo || !questoesText) return statusBox.innerHTML = "<span style='color:red;'>Preencha o título e o JSON.</span>";

    try {
        let array = JSON.parse(questoesText);

        // BLINDAGEM: Garante que as questões sejam sempre uma Lista (Array)
        if (!Array.isArray(array)) {
            // Se a IA colocou dentro de um objeto, o sistema extrai a lista automaticamente
            if (array.questions) array = array.questions;
            else if (array.questoes) array = array.questoes;
            else throw new Error("O formato gerado não é uma lista [ ... ]. Gere novamente.");
        }

        if (!Array.isArray(array)) {
            if (array.questions) array = array.questions;
            else if (array.questoes) array = array.questoes;
            else throw new Error("O formato gerado não é uma lista [ ... ]. Gere novamente.");
        }

        await addDoc(collection(db, "cbt_provas"), { 
            title: titulo, 
            studyMaterial: conteudoText, 
            studyPdf: pdfLink, 
            questions: array, 
            createdAt: new Date() 
        });
        
        statusBox.innerHTML = "<span style='color:green;'>✅ Prova publicada no App!</span>";
        document.getElementById('materia-nome').value = "";
        document.getElementById('materia-conteudo').value = "";
        document.getElementById('materia-questoes').value = "";
        document.getElementById('materia-pdf').value = ""; // NOVO: Limpa o campo do link do PDF
    } catch(e) {
        statusBox.innerHTML = `<span style='color:red;'>Erro ao salvar: ${e.message || "Formato JSON inválido"}</span>`;
    }
});

// ----------------------------------------------------
// MOTOR DE GERENCIAMENTO (EXCLUIR PROVAS)
// ----------------------------------------------------
btnCarregarProvas.addEventListener('click', carregarProvas);

async function carregarProvas() {
    listaProvasGerenciar.innerHTML = "<p>Buscando provas no servidor... ☁️</p>";
    try {
        const snapshot = await getDocs(collection(db, "cbt_provas"));
        if (snapshot.empty) {
            listaProvasGerenciar.innerHTML = "<p style='color: green; font-weight: bold;'>Nenhuma prova cadastrada no sistema.</p>";
            return;
        }

        listaProvasGerenciar.innerHTML = "";
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const div = document.createElement('div');
            div.style.cssText = "background: #FFEBEE; border: 1px solid #EF9A9A; padding: 15px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center;";
            
            div.innerHTML = `
                <span style="font-weight: bold; color: #C62828;">${data.title}</span>
                <button id="btn-del-${docSnap.id}" style="background: #D32F2F; color: white; border: none; padding: 8px 12px; border-radius: 5px; cursor: pointer; font-weight: bold;">Excluir 🗑️</button>
            `;
            listaProvasGerenciar.appendChild(div);

            document.getElementById(`btn-del-${docSnap.id}`).addEventListener('click', async () => {
                const confirmacao = confirm(`ATENÇÃO: Tem certeza que deseja APAGAR a prova "${data.title}" definitivamente?`);
                if (confirmacao) {
                    try {
                        await deleteDoc(doc(db, "cbt_provas", docSnap.id));
                        alert("✅ Prova excluída com sucesso!");
                        carregarProvas(); 
                    } catch (error) {
                        alert("Erro ao tentar excluir a prova.");
                    }
                }
            });
        });
    } catch (error) {
        console.error(error);
        listaProvasGerenciar.innerHTML = "<p style='color:red;'>Erro ao buscar provas.</p>";
    }
}

// ----------------------------------------------------
// MOTOR DE CORREÇÃO (RESPOSTAS -> IA)
// ----------------------------------------------------
btnCarregarPendencias.addEventListener('click', carregarPendencias);

async function carregarPendencias() {
    listaPendencias.innerHTML = "<p>Buscando provas no servidor... ☁️</p>";
    try {
        const q = query(collection(db, "cbt_rankings"), where("status", "==", "Pendente"));
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
            listaPendencias.innerHTML = "<p style='color: green; font-weight: bold;'>Tudo em dia! Nenhum aluno aguardando correção.</p>";
            return;
        }

        listaPendencias.innerHTML = "";
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const div = document.createElement('div');
            div.style.cssText = "background: #FFF9C4; border: 1px solid #FBC02D; padding: 15px; border-radius: 8px;";
            
            div.innerHTML = `
                <h4 style="margin-top: 0; color: #E65100;">Aluno: ${data.name}</h4>
                <p><strong>Nota Provisória Atual:</strong> ${data.points} pontos</p>
                <div id="respostas-${docSnap.id}"></div>
                <button id="btn-corrigir-${docSnap.id}" style="background: #0288D1; color: white; border: none; padding: 10px; border-radius: 5px; cursor: pointer; width: 100%; font-weight: bold; margin-top: 10px;">Iniciar Correção IA 🤖</button>
                <div id="feedback-ia-${docSnap.id}" style="margin-top: 15px; font-weight: bold;"></div>
            `;
            listaPendencias.appendChild(div);

            document.getElementById(`btn-corrigir-${docSnap.id}`).addEventListener('click', () => {
                corrigirAluno(docSnap.id, data);
            });
        });
    } catch (error) {
        console.error(error);
        listaPendencias.innerHTML = "<p style='color:red;'>Erro ao buscar pendências.</p>";
    }
}

async function corrigirAluno(docId, studentData) {
    const apiKey = apiKeyInput.value.trim();
    const btn = document.getElementById(`btn-corrigir-${docId}`);
    const feedbackBox = document.getElementById(`feedback-ia-${docId}`);
    
    if (!apiKey) return alert("Insira sua chave de API na aba 'Criar Nova Prova' primeiro.");

    btn.disabled = true;
    feedbackBox.innerHTML = "<span style='color: blue;'>A IA está avaliando as respostas... ⏳</span>";

    let novaPontuacao = studentData.points; 
    let aiFeedbacks = [];

    try {
        for (let i = 0; i < studentData.dissertativeAnswers.length; i++) {
            const resp = studentData.dissertativeAnswers[i];
            novaPontuacao -= 100; 

            const promptCorrecao = `Atue como um professor avaliando o aluno. 
            Pergunta: ${resp.questionText}
            Gabarito Esperado: ${resp.gabarito}
            Resposta em texto do aluno: ${resp.textAnswer || "Nenhum texto digitado"}

            Analise a resposta. Se a imagem em anexo contiver escrita, priorize a leitura da imagem.
            Retorne ESTRITAMENTE um JSON válido, sem markdown, no formato:
            {
                "nota": <número inteiro de 0 a 100 representando a qualidade da resposta>,
                "feedback": "<uma frase curta elogiando o acerto ou explicando onde o aluno errou>"
            }`;

            let requestBody = { contents: [{ parts: [{ text: promptCorrecao }] }] };
            if (resp.photoBase64) {
                requestBody.contents[0].parts.push({
                    inlineData: { mimeType: "image/jpeg", data: resp.photoBase64 }
                });
            }

            // LISTA DE MOTORES BLINDADA PARA CORREÇÃO
            const modelosCorrecao = ['gemini-flash-lite-latest', 'gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-flash-latest', 'gemini-pro'];
            let correcaoResponse = null;
            let correcaoSucesso = false;

            for (const mod of modelosCorrecao) {
                try {
                    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${mod}:generateContent?key=${apiKey}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(requestBody)
                    });
                    const aiData = await res.json();
                    if (res.ok && aiData.candidates) {
                        correcaoResponse = aiData.candidates[0].content.parts[0].text;
                        correcaoSucesso = true;
                        break;
                    }
                } catch(e) {}
            }

            if (!correcaoSucesso) throw new Error("Falha ao contatar a API.");

            const avaliacaoJson = JSON.parse(correcaoResponse.replace(/```json/gi, '').replace(/```/g, '').trim());

            novaPontuacao += avaliacaoJson.nota;
            aiFeedbacks.push(`Q${resp.questionIndex}: Nota ${avaliacaoJson.nota} - ${avaliacaoJson.feedback}`);
        }

        feedbackBox.innerHTML = `<span style='color: green;'>Correção concluída! Salvando nota final (${novaPontuacao} pts)...</span>`;

        await updateDoc(doc(db, "cbt_rankings", docId), {
            points: novaPontuacao,
            status: "Corrigido",
            teacherFeedback: aiFeedbacks.join(" | ")
        });

        feedbackBox.innerHTML = `<span style='color: green;'>✅ Nota salva no ranking!</span>`;
        btn.style.display = 'none';

        setTimeout(carregarPendencias, 2000);

    } catch (error) {
        console.error(error);
        feedbackBox.innerHTML = `<span style='color: red;'>Erro na avaliação da IA. Tente novamente em 1 minuto.</span>`;
        btn.disabled = false;
    }
}