import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBgt-bit6_YqH6QRCuZg-j-1DCfxy_QVAs",
  authDomain: "formulario-inscricao-23b57.firebaseapp.com",
  projectId: "formulario-inscricao-23b57",
  storageBucket: "formulario-inscricao-23b57.firebasestorage.app",
  messagingSenderId: "130577565011",
  appId: "1:130577565011:web:d3d72fde6b428fc43b8da6",
  measurementId: "G-9JSFQ893MM"
};

export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });
export const MASTER_EMAIL = 'lindolfoandrew0@gmail.com';
