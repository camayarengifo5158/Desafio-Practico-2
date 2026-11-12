/* ARCHIVO: js/config/firebase.js
   ¿Para qué sirve este archivo en la vida real de la aplicación?

   ÍNDICE:
   - firebaseConfig
   - export app
   - export auth
   - export db
*/

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";

import {
    getAuth,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

import {
    getFirestore,
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCID1eRfzLSHQuKutAhz7Fki4SRRU_ce4g",
    authDomain: "fragola-postres.firebaseapp.com",
    projectId: "fragola-postres",
    storageBucket: "fragola-postres.firebasestorage.app",
    messagingSenderId: "697091581764",
    appId: "1:697091581764:web:0964fedb423b6689229911",
    measurementId: "G-Y98FE4HZML"
};

export const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

export const db = getFirestore(app);

export {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy
};
