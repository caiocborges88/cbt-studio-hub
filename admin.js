import { db, auth } from "./firebase-config.js";
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { collection, addDoc, getDocs, query, where, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Elementos Básicos
const loginScreen = document.getElementById('login-screen');
const dashboardScreen = document.getElementById('dashboard-screen');
const btnLogin = document.getElementById('btn-login');
const btnLogout = document.getElementById('btn-logout');

// Elementos das Abas
const tabCriar = document.getElementById('tab-criar');
const tabCorrigir = document.getElementById('tab-corrigir');
const sectionCriar = document.getElementById('section-criar');
const sectionCorrigir = document.getElementById('section-corrigir');

// Elementos de Criação
const apiKeyInput = document.getElementById('gemini-api-key');
const btnGerarIA = document.getElementById('btn-gerar-ia');
const aiStatus = document.getElementById('ai-status');
const btnSalvar = document.getElementById('btn-salvar');
const statusBox = document.getElementById('status');

// Elementos de Correção
const btnCarregarPendencias = document.getElementById('btn-carregar-pendencias');
const listaPendencias = document.getElementById('lista-pendencias');

// Carregar Chave da API
apiKeyInput.value = localStorage.getItem('geminiApiKey') || '';
apiKeyInput.addEventListener('input', () => localStorage.setItem('geminiApiKey', apiKeyInput.value.trim()));

// Navegação entre Abas
tabCriar.addEventListener('click', () => {
    sectionCriar.style.display = 'block';
    sectionCorrigir.style.display = 'none';
});
tabCorrigir.addEventListener('click', () => {
    sectionCriar.style.display = 'none';
    sectionCorrigir.style.display = 'block';
    carregarPendencias();
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
    
    if (!apiKey) {
        aiStatus.innerHTML = "<span style='color:red;'>Insira sua chave de API do Gemini.</span>";
        return;
    }
    if (!textContent || textContent.length < 50) {
        aiStatus.innerHTML = "<span style='color:red;'>Cole um texto válido no campo de Material de Estudo (mínimo 50 caracteres).</span>";
        return;
    }

    aiStatus.innerHTML = "<span style='color:blue;'>Lendo o texto e gerando questões (Isso leva alguns segundos)... 🧠⏳</span>";
    btnGerarIA.disabled = true;

    try {
        const prompt = `Você é um professor. Crie 20 questões de múltipla escolha e 5 questões dissertativas baseadas EXCLUSIVAMENTE no material abaixo:
        
        --- INÍCIO DO MATERIAL ---
        ${textContent.substring(0, 50000)}
        --- FIM DO MATERIAL ---

        Regras RIGOROSAS de saída:
        1. Retorne ESTRITAMENTE um array JSON válido, sem NENHUM texto antes ou depois.
        2. NUNCA use formatação Markdown (\`\`\`json). O primeiro caractere da sua resposta deve ser [ e o último ].
        3. Para Múltipla Escolha: { "q": "Pergunta?", "options": ["A", "B", "C", "D"], "answer": 1 }
        4. Para Dissertativas: { "q": "Pergunta?", "gabarito": "Explicação da resposta correta" }`;

        // Sistema de Fallback focado em modelos de texto rápidos
        const modelosDeReserva = [
            'gemini-2.5-flash',
            'gemini-flash-latest',
            'gemini-2.5-pro'
        ];

        let iaResponseText = "";
        let sucesso = false;

        for (const modelo of modelosDeReserva) {
            aiStatus.innerHTML = `<span style='color:blue;'>Conectando ao motor ${modelo}... 🧠⏳</span>`;
            
            try {
                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }]
                    })
                });

                const data = await response.json();

                if (response.ok && data.candidates && data.candidates.length > 0) {
                    iaResponseText = data.candidates[0].content.parts[0].text;
                    sucesso = true;
                    break;
                } else {
                    console.warn(`Motor ${modelo} indisponível. Tentando o próximo...`);
                }
            } catch (err) {
                console.warn(`Falha na conexão com ${modelo}:`, err);
            }
        }

        if (!sucesso) {
            throw new Error("Todos os motores do Google falharam. Tente novamente em alguns minutos.");
        }

        // Limpeza de Markdown acidental
        iaResponseText = iaResponseText.replace(/```json/gi, '').replace(/```/g, '').trim();

        // Validação de segurança: Força o teste estrutural do JSON antes de colocar na tela
        JSON.parse(iaResponseText); 

        document.getElementById('materia-questoes').value = iaResponseText;
        aiStatus.innerHTML = "<span style='color:green;'>✅ Questões geradas com sucesso! Verifique o JSON abaixo e clique em Publicar.</span>";

    } catch (error) {
        console.error(error);
        aiStatus.innerHTML = `<span style='color:red;'>Erro: ${error.message} (Verifique se o texto não quebrou a formatação da IA).</span>`;
    } finally {
        btnGerarIA.disabled = false;
    }
});

btnSalvar.addEventListener('click', async () => {
    const titulo = document.getElementById('materia-nome').value.trim();
    const conteudoText = document.getElementById('materia-conteudo').value.trim(); // Captura o material de estudo
    const questoesText = document.getElementById('materia-questoes').value.trim();

    if(!titulo || !questoesText) return statusBox.innerHTML = "<span style='color:red;'>Preencha o título e o JSON.</span>";

    try {
        const array = JSON.parse(questoesText);
        // Salva tudo no banco de dados, incluindo o texto de estudo
        await addDoc(collection(db, "cbt_provas"), { 
            title: titulo, 
            studyMaterial: conteudoText, 
            questions: array, 
            createdAt: new Date() 
        });
        
        statusBox.innerHTML = "<span style='color:green;'>✅ Prova e material enviados aos alunos!</span>";
        document.getElementById('materia-nome').value = "";
        document.getElementById('materia-conteudo').value = "";
        document.getElementById('materia-questoes').value = "";
    } catch(e) {
        statusBox.innerHTML = "<span style='color:red;'>Erro: Formato JSON inválido.</span>";
    }
});

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

            // Adiciona listener para o botão de corrigir aquele aluno específico
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
    
    if (!apiKey) {
        alert("Insira sua chave de API na aba 'Criar Nova Prova' primeiro.");
        return;
    }

    btn.disabled = true;
    feedbackBox.innerHTML = "<span style='color: blue;'>A IA está avaliando as respostas... ⏳</span>";

    let novaPontuacao = studentData.points; // Começa com a nota atual (que ganhou +100 provisórios por questão discursiva)
    let aiFeedbacks = [];

    try {
        // Percorre todas as respostas discursivas deste aluno
        for (let i = 0; i < studentData.dissertativeAnswers.length; i++) {
            const resp = studentData.dissertativeAnswers[i];
            
            // Subtraímos os 100 pontos provisórios que o aplicativo deu antes de aplicar a nota real da IA
            novaPontuacao -= 100; 

            // Montagem do Prompt de Correção
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

            // Prepara o corpo da requisição (Text ou Text + Foto)
            let requestBody = { contents: [{ parts: [{ text: promptCorrecao }] }] };
            if (resp.photoBase64) {
                requestBody.contents[0].parts.push({
                    inlineData: { mimeType: "image/jpeg", data: resp.photoBase64 }
                });
            }

            // Chamada direta para o Gemini Flash (ideal para correção rápida)
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });

            const aiData = await response.json();
            if (!response.ok) throw new Error("Falha ao contatar a API para correção.");

            const rawText = aiData.candidates[0].content.parts[0].text;
            const avaliacaoJson = JSON.parse(rawText.replace(/```json/gi, '').replace(/```/g, '').trim());

            // Soma a nota real ao placar
            novaPontuacao += avaliacaoJson.nota;
            aiFeedbacks.push(`Q${resp.questionIndex}: Nota ${avaliacaoJson.nota} - ${avaliacaoJson.feedback}`);
        }

        feedbackBox.innerHTML = `<span style='color: green;'>Correção concluída! Salvando nota final (${novaPontuacao} pts)...</span>`;

        // Atualiza o documento no banco de dados
        await updateDoc(doc(db, "cbt_rankings", docId), {
            points: novaPontuacao,
            status: "Corrigido",
            teacherFeedback: aiFeedbacks.join(" | ")
        });

        feedbackBox.innerHTML = `<span style='color: green;'>✅ Nota atualizada e salva no ranking! O aluno subiu no painel.</span>`;
        btn.style.display = 'none';

        // Recarrega a lista após 2 segundos
        setTimeout(carregarPendencias, 2000);

    } catch (error) {
        console.error(error);
        feedbackBox.innerHTML = `<span style='color: red;'>Erro na avaliação da IA. Tente novamente.</span>`;
        btn.disabled = false;
    }
}