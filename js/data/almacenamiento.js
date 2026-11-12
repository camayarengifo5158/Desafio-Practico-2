/* ARCHIVO: js/data/almacenamiento.js
   ALMACENAMIENTO LOCAL (Capa de Acceso a localStorage)

   ÍNDICE:
   - export simularRed()  (línea 16)
   - export leerSync()  (línea 22)
   - export escribirSync()  (línea 32)
   - export eliminarSync()  (línea 43)
   - export leer()  (línea 47)
   - export escribir()  (línea 52)
   - export generarId()  (línea 58)
*/

import { LATENCIA_MS } from '../config/app-config.js';

export function simularRed() {
    const { min, max } = LATENCIA_MS;
    const ms = Math.floor(Math.random() * (max - min + 1)) + min;
    return new Promise((resolver) => setTimeout(resolver, ms));
}

export function leerSync(clave, porDefecto = null) {
    try {
        const texto = localStorage.getItem(clave);
        return texto === null ? porDefecto : JSON.parse(texto);
    } catch (error) {
        console.error(`No se pudo leer "${clave}"`, error);
        return porDefecto;
    }
}

export function escribirSync(clave, valor) {
    try {
        localStorage.setItem(clave, JSON.stringify(valor));
    } catch (error) {
        if (error.name === 'QuotaExceededError') {
            throw new Error('El almacenamiento del navegador está lleno. Elimina datos antiguos e intenta de nuevo.');
        }
        throw new Error('No se pudo guardar la información en el navegador.');
    }
}

export function eliminarSync(clave) {
    localStorage.removeItem(clave);
}

export async function leer(clave, porDefecto = null) {
    await simularRed();
    return leerSync(clave, porDefecto);
}

export async function escribir(clave, valor) {
    await simularRed();
    escribirSync(clave, valor);
    return valor;
}

export function generarId(prefijo = 'id') {
    if (typeof window !== 'undefined' && window.crypto && typeof window.crypto.randomUUID === 'function') {
        return `${prefijo}_${window.crypto.randomUUID().slice(0, 8)}`;
    }
    return `${prefijo}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
