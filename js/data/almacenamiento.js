/* ==========================================================
   ALMACENAMIENTO (capa más baja de datos)
   Envuelve localStorage en funciones asíncronas. El resto de
   la aplicación nunca toca localStorage directamente: siempre
   pasa por aquí. Así, si mañana cambiamos a Firebase, solo se
   reemplaza esta capa y los repositorios.
   ========================================================== */

import { LATENCIA_MS } from '../config/app-config.js';

// Espera un tiempo aleatorio para simular la latencia de un servicio remoto
export function simularRed() {
    const { min, max } = LATENCIA_MS;
    const ms = Math.floor(Math.random() * (max - min + 1)) + min;
    return new Promise((resolver) => setTimeout(resolver, ms));
}

// Lee y convierte de JSON. Si la clave no existe devuelve el valor por defecto.
export function leerSync(clave, porDefecto = null) {
    try {
        const texto = localStorage.getItem(clave);
        return texto === null ? porDefecto : JSON.parse(texto);
    } catch (error) {
        console.error(`No se pudo leer "${clave}"`, error);
        return porDefecto;
    }
}

// Convierte a JSON y guarda. Lanza un error entendible si el navegador no tiene espacio.
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

// Versiones asíncronas: son las que usan los repositorios
export async function leer(clave, porDefecto = null) {
    await simularRed();
    return leerSync(clave, porDefecto);
}

export async function escribir(clave, valor) {
    await simularRed();
    escribirSync(clave, valor);
    return valor;
}

// Genera un identificador único para cada registro
export function generarId(prefijo = 'id') {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
        return `${prefijo}_${window.crypto.randomUUID().slice(0, 8)}`;
    }
    return `${prefijo}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
