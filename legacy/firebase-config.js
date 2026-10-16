// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyBwqlx5NPEI9ptnfJguVtuHQpB0QFgaWpE",
    authDomain: "quiz-ciencias-b37d5.firebaseapp.com",
    projectId: "quiz-ciencias-b37d5",
    storageBucket: "quiz-ciencias-b37d5.firebasestorage.app",
    messagingSenderId: "803596008083",
    appId: "1:803596008083:web:4808838f09e812ce66ab66"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export { db, auth };