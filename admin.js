// admin.js
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

// Monitorar estado de autenticação
onAuthStateChanged(auth, (user) => {
    if (user) {
        // Logado
        loginScreen.style.display = 'none';
        dashboardScreen.style.display = 'block';
    } else {
        // Deslogado
        loginScreen.style.display = 'block';
        dashboardScreen.style.display = 'none';
    }
});

// Função de Login
btnLogin.addEventListener('click', async () => {
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value.trim();
    
    if(!email || !password) return;

    try {
        await signInWithEmailAndPassword(auth, email, password);
        loginError.style.display = 'none';
    } catch (error) {
        // Nova linha adicionada para imprimir o erro real no console (F12)
        console.error("Código do Erro Firebase:", error.code);
        console.error("Mensagem do Erro:", error.message);
        
        loginError.innerText = "Erro ao fazer login. Verifique e-mail e senha.";
        loginError.style.display = 'block';
    }
});

// Função de Logout
btnLogout.addEventListener('click', async () => {
    await signOut(auth);
});

// Função para Salvar Prova
btnSalvar.addEventListener('click', async () => {
    const titulo = document.getElementById('materia-nome').value.trim();
    const questoesText = document.getElementById('materia-questoes').value.trim();

    if(!titulo || !questoesText) {
        statusBox.innerHTML = "<span style='color:red;'>Preencha o título e cole as questões!</span>";
        return;
    }

    try {
        statusBox.innerHTML = "<span style='color:blue;'>Validando e salvando...</span>";
        
        // Validação estrita do JSON (Ponto cego corrigido)
        const questoesArray = JSON.parse(questoesText);
        
        if(!Array.isArray(questoesArray) || questoesArray.length === 0) {
            throw new Error("O formato não é um Array válido de questões.");
        }

        // Salvando no Firestore
        await addDoc(collection(db, "cbt_provas"), {
            title: titulo,
            questions: questoesArray,
            createdAt: new Date()
        });

        statusBox.innerHTML = "<span style='color:green;'>✅ Prova criada com sucesso!</span>";
        document.getElementById('materia-nome').value = "";
        document.getElementById('materia-questoes').value = "";

    } catch(e) {
        console.error(e);
        statusBox.innerHTML = "<span style='color:red;'>Erro: Formato JSON inválido. Verifique o código gerado pela IA.</span>";
    }
});