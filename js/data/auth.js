/* ARCHIVO: js/data/auth.js
   ¿Para qué sirve este archivo en la vida real de la aplicación?

   ÍNDICE:
   - usuarioActivo  (línea 37)
   - export usuarioPublico()  (línea 57)
   - export usuarioActual()  (línea 63)
   - export esAdmin()  (línea 67)
   - export requerirSesion()  (línea 71)
   - export requerirRol()  (línea 79)
   - export registrar()  (línea 87)
   - export iniciarSesion()  (línea 128)
   - export cerrarSesion()  (línea 149)
*/

import { ROLES, CLAVES } from '../config/app-config.js';
import {
    auth,
    db,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    doc,
    getDoc,
    setDoc
} from '../config/firebase.js';
import { validarRegistro } from '../logica/validaciones.js';

export class ErrorAutorizacion extends Error {
    constructor(mensaje = 'No tienes permiso para realizar esta acción.') {
        super(mensaje);
        this.name = 'ErrorAutorizacion';
    }
}

let usuarioActivo = JSON.parse(localStorage.getItem(CLAVES.sesion) || 'null');

onAuthStateChanged(auth, async (userFirebase) => {
    if (userFirebase) {
        try {
            const docRef = doc(db, 'usuarios', userFirebase.uid);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                usuarioActivo = { id: userFirebase.uid, ...docSnap.data() };
                localStorage.setItem(CLAVES.sesion, JSON.stringify(usuarioActivo));
            }
        } catch (e) {
            console.error('Error sincronizando el perfil del usuario con Firestore:', e);
        }
    } else {
        usuarioActivo = null;
        localStorage.removeItem(CLAVES.sesion);
    }
});

export function usuarioPublico(usuario) {
    if (!usuario) return null;
    const { hash, sal, ...publico } = usuario;
    return publico;
}

export function usuarioActual() {
    return usuarioActivo ? usuarioPublico(usuarioActivo) : null;
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

export async function registrar({ nombre, email, contrasena, confirmacion }) {
    const errores = validarRegistro({ nombre, email, contrasena, confirmacion });
    if (Object.keys(errores).length > 0) {
        const error = new Error('Revisa los campos marcados.');
        error.campos = errores;
        throw error;
    }

    try {
        const credencial = await createUserWithEmailAndPassword(auth, email.trim(), contrasena);
        const uid = credencial.user.uid;

        const nuevoUsuario = {
            id: uid,
            nombre: nombre.trim(),
            email: email.trim().toLowerCase(),
            rol: ROLES.CLIENTE,
            creadoEn: new Date().toISOString()
        };

        await setDoc(doc(db, 'usuarios', uid), nuevoUsuario);

        usuarioActivo = nuevoUsuario;
        localStorage.setItem(CLAVES.sesion, JSON.stringify(nuevoUsuario));
        return usuarioPublico(nuevoUsuario);

    } catch (error) {
        if (error.code === 'auth/email-already-in-use') {
            const err = new Error('Ya existe una cuenta con ese correo.');
            err.campos = { email: 'Este correo ya está registrado.' };
            throw err;
        }
        if (error.code === 'auth/weak-password') {
            const err = new Error('La contraseña es demasiado débil.');
            err.campos = { contrasena: 'Debe tener al menos 6 caracteres.' };
            throw err;
        }
        throw new Error(error.message || 'Error al registrar el usuario.');
    }
}

export async function iniciarSesion(email, contrasena) {
    try {
        const credencial = await signInWithEmailAndPassword(auth, String(email).trim(), contrasena);
        const uid = credencial.user.uid;

        const docRef = doc(db, 'usuarios', uid);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            throw new Error('Perfil de usuario no encontrado en la base de datos.');
        }

        usuarioActivo = { id: uid, ...docSnap.data() };
        localStorage.setItem(CLAVES.sesion, JSON.stringify(usuarioActivo));
        return usuarioPublico(usuarioActivo);

    } catch (error) {
        throw new Error('Correo o contraseña incorrectos.');
    }
}

export async function cerrarSesion() {
    await signOut(auth);
    usuarioActivo = null;
    localStorage.removeItem(CLAVES.sesion);
    localStorage.removeItem(CLAVES.carrito);
    document.dispatchEvent(new CustomEvent('carrito:cambio', { detail: [] }));
}
