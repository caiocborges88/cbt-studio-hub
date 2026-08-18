import { db, auth } from "./firebase-config.js";
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { collection, addDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Elementos da tela
const loginScreen = document.getElementById('login-screen');
const dashboardScreen = document.getElementById('dashboard-screen');
const btnLogin = document.getElementById('btn-login');
const btnLogout = document.getElementById('btn-logout');
const btnSalvar = document.getElementById('btn-salvar');
const loginError = document.getElementById('login-error');
const statusBox = document.getElementById('status');

// Elementos da IA
const apiKeyInput = document.getElementById('gemini-api-key');
const btnGerarIA = document.getElementById('btn-gerar-ia');
const aiStatus = document.getElementById('ai-status');

// Carregar Chave da API salva localmente
apiKeyInput.value = localStorage.getItem('geminiApiKey') || '';
apiKeyInput.addEventListener('input', () => {
    localStorage.setItem('geminiApiKey', apiKeyInput.value.trim());
});

// Monitorar Autenticação
onAuthStateChanged(auth, (user) => {
    if (user) {
        loginScreen.style.display = 'none';
        dashboardScreen.style.display = 'block';
    } else {
        loginScreen.style.display = 'block';
        dashboardScreen.style.display = 'none';
    }
});

// Funções de Autenticação
btnLogin.addEventListener('click', async () => {
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value.trim();
    if(!email || !password) return;
    try {
        await signInWithEmailAndPassword(auth, email, password);
        loginError.style.display = 'none';
    } catch (error) {
        console.error(error.code, error.message);
        loginError.innerText = "Erro ao fazer login. Verifique e-mail e senha.";
        loginError.style.display = 'block';
    }
});

btnLogout.addEventListener('click', async () => {
    await signOut(auth);
});

// ----------------------------------------------------
// MOTOR DE INTELIGÊNCIA ARTIFICIAL (PDF -> GEMINI)
// ----------------------------------------------------
btnGerarIA.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();
    const fileInput = document.getElementById('pdf-upload');
    
    if (!apiKey) {
        aiStatus.innerHTML = "<span style='color:red;'>Insira sua chave de API do Gemini.</span>";
        return;
    }
    if (fileInput.files.length === 0) {
        aiStatus.innerHTML = "<span style='color:red;'>Selecione um arquivo PDF.</span>";
        return;
    }

    const file = fileInput.files[0];
    aiStatus.innerHTML = "<span style='color:blue;'>Lendo o arquivo PDF... 📄</span>";
    btnGerarIA.disabled = true;

    try {
        // 1. Extrair Texto do PDF
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({data: arrayBuffer}).promise;
        let extractedText = "";

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(" ");
            extractedText += pageText + "\n";
        }

        // 2. Enviar para a Inteligência Artificial com Fallback Automático
        const prompt = `Atue como um gerador de sistemas educacionais. Crie 25 questões de múltipla escolha baseadas EXCLUSIVAMENTE neste material: \n\n${extractedText.substring(0, 30000)}\n\nRegras:\n1. 4 opções por questão.\n2. Retorne ESTRITAMENTE um array JSON, sem marcações Markdown, sem texto antes ou depois.\n3. Formato:\n[ { "q": "Pergunta?", "options": ["A", "B", "C", "D"], "answer": 1 } ]`;

        // Lista de modelos para tentar em ordem de prioridade
        const modelosDeReserva = [
            'gemini-3.1-flash-lite',
            'gemini-3.5-flash-lite',
            'gemini-2.5-flash',
            'gemini-pro-latest'
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
                    break; // Sai do loop se a resposta for bem-sucedida
                } else {
                    console.warn(`Motor ${modelo} indisponível. Tentando o próximo...`);
                }
            } catch (err) {
                console.warn(`Falha na conexão com ${modelo}:`, err);
            }
        }

        if (!sucesso) {
            throw new Error("Todos os motores do Google estão sobrecarregados no momento. Tente novamente em alguns minutos.");
        }
        
        // Sanitização: Remover formatação Markdown residual da IA
        iaResponseText = iaResponseText.replace(/```json/gi, '').replace(/```/g, '').trim();

        // 3. Imprimir Resultado
        document.getElementById('materia-questoes').value = iaResponseText;
        aiStatus.innerHTML = "<span style='color:green;'>✅ Questões geradas com sucesso! Verifique abaixo e clique em Publicar.</span>";

    } catch (error) {
        console.error(error);
        aiStatus.innerHTML = `<span style='color:red;'>Erro: ${error.message}</span>`;
    } finally {
        btnGerarIA.disabled = false;
    }
});

// ----------------------------------------------------
// SALVAR PROVA NO FIREBASE
// ----------------------------------------------------
btnSalvar.addEventListener('click', async () => {
    const titulo = document.getElementById('materia-nome').value.trim();
    const questoesText = document.getElementById('materia-questoes').value.trim();

    if(!titulo || !questoesText) {
        statusBox.innerHTML = "<span style='color:red;'>Preencha o título e o código JSON!</span>";
        return;
    }

    try {
        statusBox.innerHTML = "<span style='color:blue;'>Validando e salvando...</span>";
        const questoesArray = JSON.parse(questoesText);
        
        if(!Array.isArray(questoesArray) || questoesArray.length === 0) {
            throw new Error("Formato inválido.");
        }

        await addDoc(collection(db, "cbt_provas"), {
            title: titulo,
            questions: questoesArray,
            createdAt: new Date()
        });

        statusBox.innerHTML = "<span style='color:green;'>✅ Prova criada e enviada para o App!</span>";
        document.getElementById('materia-nome').value = "";
        document.getElementById('materia-questoes').value = "";
        document.getElementById('pdf-upload').value = "";
        aiStatus.innerHTML = "";

    } catch(e) {
        console.error(e);
        statusBox.innerHTML = "<span style='color:red;'>Erro: Formato JSON inválido. Verifique o código gerado.</span>";
    }
});