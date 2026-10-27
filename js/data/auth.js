/* ==========================================================
   AUTENTICACIÓN Y AUTORIZACIÓN
   Registro, inicio y cierre de sesión con usuarios guardados
   en localStorage. Las contraseñas se guardan como hash
   SHA-256 con una "sal" aleatoria, nunca en texto plano.

   requerirSesion() y requerirRol() son los "guardias" que usan
   los repositorios antes de leer o modificar datos protegidos:
   no basta con ocultar botones en la interfaz.
   ========================================================== */

import { CLAVES, ROLES } from '../config/app-config.js';
import { leerSync, escribirSync, eliminarSync, simularRed, generarId } from './almacenamiento.js';
import { validarRegistro } from '../logica/validaciones.js';

// Error especial para distinguir problemas de permisos de otros errores
export class ErrorAutorizacion extends Error {
    constructor(mensaje = 'No tienes permiso para realizar esta acción.') {
        super(mensaje);
        this.name = 'ErrorAutorizacion';
    }
}

// ---------- Utilidades de contraseña ----------

function generarSal() {
    const bytes = new Uint8Array(4);
    window.crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

// SHA-256(sal + ":" + contraseña) en hexadecimal. crypto.subtle es asíncrono.
export async function calcularHash(sal, contrasena) {
    const datos = new TextEncoder().encode(`${sal}:${contrasena}`);
    const buffer = await window.crypto.subtle.digest('SHA-256', datos);
    return Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, '0')).join('');
}

// Quita sal y hash antes de entregar un usuario a la interfaz
export function usuarioPublico(usuario) {
    if (!usuario) return null;
    const { sal, hash, ...publico } = usuario;
    return publico;
}

// ---------- Sesión ----------

export function usuarioActual() {
    const sesion = leerSync(CLAVES.sesion);
    if (!sesion) return null;
    const usuarios = leerSync(CLAVES.usuarios, []);
    const usuario = usuarios.find((u) => u.id === sesion.usuarioId);
    // Si el usuario fue eliminado o se restablecieron los datos, la sesión deja de ser válida
    if (!usuario) {
        eliminarSync(CLAVES.sesion);
        return null;
    }
    return usuarioPublico(usuario);
}

export function esAdmin(usuario = usuarioActual()) {
    return Boolean(usuario && usuario.rol === ROLES.ADMIN);
}

export function requerirSesion() {
    const usuario = usuarioActual();
    if (!usuario) {
        throw new ErrorAutorizacion('Debes iniciar sesión para continuar.');
    }
    return usuario;
}

export function requerirRol(rol) {
    const usuario = requerirSesion();
    if (usuario.rol !== rol) {
        throw new ErrorAutorizacion();
    }
    return usuario;
}

function abrirSesion(usuario) {
    escribirSync(CLAVES.sesion, { usuarioId: usuario.id, inicio: new Date().toISOString() });
}

// ---------- Operaciones públicas ----------

export async function registrar({ nombre, email, contrasena, confirmacion }) {
    const errores = validarRegistro({ nombre, email, contrasena, confirmacion });
    if (Object.keys(errores).length > 0) {
        const error = new Error('Revisa los campos marcados.');
        error.campos = errores;
        throw error;
    }

    await simularRed();
    const usuarios = leerSync(CLAVES.usuarios, []);
    const emailNormalizado = email.trim().toLowerCase();

    if (usuarios.some((u) => u.email === emailNormalizado)) {
        const error = new Error('Ya existe una cuenta con ese correo.');
        error.campos = { email: 'Este correo ya está registrado.' };
        throw error;
    }

    const sal = generarSal();
    const nuevo = {
        id: generarId('usr'),
        nombre: nombre.trim(),
        email: emailNormalizado,
        rol: ROLES.CLIENTE, // nadie puede elegir ser administrador al registrarse
        sal,
        hash: await calcularHash(sal, contrasena),
        creadoEn: new Date().toISOString()
    };

    usuarios.push(nuevo);
    escribirSync(CLAVES.usuarios, usuarios);
    abrirSesion(nuevo);
    return usuarioPublico(nuevo);
}

export async function iniciarSesion(email, contrasena) {
    await simularRed();
    const usuarios = leerSync(CLAVES.usuarios, []);
    const usuario = usuarios.find((u) => u.email === String(email).trim().toLowerCase());

    // Mismo mensaje para correo o contraseña incorrectos: no revelamos qué cuentas existen
    const credencialesInvalidas = new Error('Correo o contraseña incorrectos.');
    if (!usuario) throw credencialesInvalidas;

    const hash = await calcularHash(usuario.sal, contrasena);
    if (hash !== usuario.hash) throw credencialesInvalidas;

    abrirSesion(usuario);
    return usuarioPublico(usuario);
}

export async function cerrarSesion() {
    await simularRed();
    eliminarSync(CLAVES.sesion);
}
