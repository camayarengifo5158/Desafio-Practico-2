/* ==========================================================
   ALMACENAMIENTO LOCAL (Capa de Acceso a localStorage)
   Archivo: js/data/almacenamiento.js
   ----------------------------------------------------------
   ¿Para qué sirve este archivo?
   Es el "envoltorio" (wrapper) seguro para el almacenamiento del
   navegador (`localStorage`).

   ¿Por qué no usamos localStorage directamente en todo el código?
   Por dos razones de arquitectura profesional:
   1. Seguridad contra fallos: Si localStorage se llena o si alguien
      guarda texto con formato JSON dañado, la aplicación normal tronaría
      con pantalla blanca. Este archivo atrapa esos errores con `try/catch`
      y los maneja con elegancia.
   2. Desacoplamiento: Si mañana el negocio decide mover el carrito
      a cookies o a IndexedDB, solo cambiamos este archivo y el resto de la
      tienda sigue funcionando sin enterarse del cambio.
   ========================================================== */

// Traemos el rango de tiempo configurado para simular demoras de red (120 a 300 ms)
import { LATENCIA_MS } from '../config/app-config.js';

/* ----------------------------------------------------------
   simularRed()
   ¿Para qué sirve?
   Pausa la ejecución durante una fracción de segundo (entre 120ms y 300ms).
   Sirve para que las operaciones locales se sientan como llamadas reales
   a un servidor remoto, permitiendo ver las animaciones de carga (spinners)
   y probando cómo reacciona la interfaz ante la latencia natural de internet.
   ---------------------------------------------------------- */
export function simularRed() {
    const { min, max } = LATENCIA_MS;
    // Calculamos un número aleatorio entre min y max
    const ms = Math.floor(Math.random() * (max - min + 1)) + min;
    // Retornamos una Promesa que se resuelve sola cuando termina el temporizador
    return new Promise((resolver) => setTimeout(resolver, ms));
}

/* ----------------------------------------------------------
   leerSync(clave, porDefecto)
   ¿Para qué sirve?
   Lee una clave de localStorage de forma sincrónica e inmediata.
   - Si la clave no existe, devuelve el valor por defecto que le digamos (ej: un arreglo vacío []).
   - Si el contenido está corrupto o mal formateado, no deja que el sistema truene,
     imprime una advertencia en la consola y devuelve el valor por defecto.
   ---------------------------------------------------------- */
export function leerSync(clave, porDefecto = null) {
    try {
        const texto = localStorage.getItem(clave);
        // Si no hay nada guardado con esa clave, devolvemos el valor por defecto
        return texto === null ? porDefecto : JSON.parse(texto);
    } catch (error) {
        console.error(`No se pudo leer "${clave}"`, error);
        return porDefecto;
    }
}

/* ----------------------------------------------------------
   escribirSync(clave, valor)
   ¿Para qué sirve?
   Convierte un objeto de JavaScript en texto con `JSON.stringify` y lo
   guarda en el disco local del navegador bajo una clave específica.
   
   Manejo de errores profesional:
   Si el disco del navegador del usuario está saturado (`QuotaExceededError`),
   lanza un mensaje en español comprensible en vez de un código críptico del navegador.
   ---------------------------------------------------------- */
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

/* ----------------------------------------------------------
   eliminarSync(clave)
   ¿Para qué sirve?
   Borra por completo una entrada de localStorage (por ejemplo,
   al cerrar sesión o vaciar el carrito).
   ---------------------------------------------------------- */
export function eliminarSync(clave) {
    localStorage.removeItem(clave);
}

/* ----------------------------------------------------------
   leer(clave, porDefecto) y escribir(clave, valor)
   ¿Para qué sirven?
   Son las versiones asíncronas con Promesas que utilizan los
   módulos que esperan latencia de red simulada.
   ---------------------------------------------------------- */
export async function leer(clave, porDefecto = null) {
    await simularRed();
    return leerSync(clave, porDefecto);
}

export async function escribir(clave, valor) {
    await simularRed();
    escribirSync(clave, valor);
    return valor;
}

/* ----------------------------------------------------------
   generarId(prefijo)
   ¿Para qué sirve?
   Crea identificadores únicos para registros del sistema (ej: 'pst_a93f1b', 'usr_81bc2e').
   - Intenta usar la API criptográfica nativa del navegador (`crypto.randomUUID`).
   - Si el navegador es antiguo o no soporta crypto, usa un generador de respaldo
     basado en la marca de tiempo actual (`Date.now().toString(36)`) y números aleatorios.
   ---------------------------------------------------------- */
export function generarId(prefijo = 'id') {
    if (typeof window !== 'undefined' && window.crypto && typeof window.crypto.randomUUID === 'function') {
        return `${prefijo}_${window.crypto.randomUUID().slice(0, 8)}`;
    }
    return `${prefijo}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
