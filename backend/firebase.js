// =================================================================================
// ARQUIVO: firebase.js (Para o Backend)
// Responsável por inicializar o Firebase para o processo principal (main.js).
// =================================================================================

import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

// Suas configurações do Firebase (as mesmas usadas no renderer)
const firebaseConfig = {
    apiKey: "AIzaSyDlObTouPsIIopQu2u4kuLHo92eA8_G6aQ",
    authDomain: "kanban-escritorio.firebaseapp.com",
    databaseURL: "https://kanban-escritorio-default-rtdb.firebaseio.com",
    projectId: "kanban-escritorio",
    storageBucket: "kanban-escritorio.appspot.com",
    messagingSenderId: "186135841918",
    appId: "1:186135841918:web:bda192f126d44125355c2f",
    measurementId: "G-ZC6RYDQTHK"
};

// Inicializa o Firebase. O segundo argumento "backend" é um nome opcional
// para a instância, útil para evitar conflitos se você tivesse múltiplas conexões.
const app = initializeApp(firebaseConfig, "backend");

// Obtém a referência do Realtime Database e a exporta
const database = getDatabase(app);

export { database };
