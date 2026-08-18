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
// FUNÇÃO AUXILIAR: Converter Arquivo para Envio Seguro
// ----------------------------------------------------
const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = error => reject(error);
});

// ----------------------------------------------------
// MOTOR DE INTELIGÊNCIA ARTIFICIAL (VISÃO DO GEMINI)
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
    
    // Trava de segurança estendida para 30MB
    if (file.size > 30 * 1024 * 1024) {
        aiStatus.innerHTML = "<span style='color:red;'>O arquivo ultrapassa 30MB. Por favor, comprima o arquivo em sites como 'ilovepdf.com' antes de enviar.</span>";
        return;
    }

    aiStatus.innerHTML = "<span style='color:blue;'>Enviando o documento para análise da IA (Isso leva cerca de 1 minuto)... 🧠⏳</span>";
    btnGerarIA.disabled = true;

    try {
        // 1. Converter PDF em dados brutos
        const base64Pdf = await fileToBase64(file);

        // 2. Prompt Blindado
        const prompt = `Você é um professor especialista elaborando uma avaliação escolar. Leia o documento PDF em anexo (ele contém páginas escaneadas) e crie 25 questões de múltipla escolha baseadas EXCLUSIVAMENTE nos assuntos, textos e imagens matemáticas deste documento.
        
        CRÍTICO: NUNCA crie perguntas sobre as regras de formatação abaixo. O assunto da prova DEVE ser o assunto do PDF.

        Regras de Saída:
        1. 4 opções de resposta por questão.
        2. Retorne ESTRITAMENTE um array JSON válido.
        3. Sem marcações Markdown (\`\`\`json), sem textos de introdução.
        4. Formato exato:
        [ { "q": "Pergunta 1?", "options": ["A", "B", "C", "D"], "answer": 1 } ]`;

        // 3. Sistema de Fallback com modelos Multimodais que você tem acesso
        const modelosDeReserva = [
            'gemini-2.5-flash',
            'gemini-2.5-pro',
            'gemini-flash-latest'
        ];

        let iaResponseText = "";
        let sucesso = false;

        for (const modelo of modelosDeReserva) {
            aiStatus.innerHTML = `<span style='color:blue;'>Processando as imagens com o motor ${modelo}... 🧠⏳</span>`;
            
            try {
                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{
                            parts: [
                                { text: prompt },
                                { inlineData: { mimeType: "application/pdf", data: base64Pdf } }
                            ]
                        }]
                    })
                });

                const data = await response.json();

                if (response.ok && data.candidates && data.candidates.length > 0) {
                    iaResponseText = data.candidates[0].content.parts[0].text;
                    sucesso = true;
                    break;
                } else {
                    console.warn(`Sobrecarga no motor ${modelo}, tentando o próximo rota...`);
                }
            } catch (err) {
                console.warn(`Erro na rota ${modelo}:`, err);
            }
        }

        if (!sucesso) {
            throw new Error("Todos os motores do Google falharam ou estão cheios. Tente novamente.");
        }

        // 4. Limpeza e Validação
        iaResponseText = iaResponseText.replace(/```json/gi, '').replace(/```/g, '').trim();

        document.getElementById('materia-questoes').value = iaResponseText;
        aiStatus.innerHTML = "<span style='color:green;'>✅ Questões geradas com sucesso! A IA conseguiu ler os exercícios.</span>";

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