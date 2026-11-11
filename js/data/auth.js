/* ==============================================================================
   ARCHIVO: js/data/auth.js
   CAPA: Persistencia y Autenticación (Firebase Auth + Firestore)
   ==============================================================================
   ¿Para qué sirve este archivo en la vida real de la aplicación?
   Este módulo es el "portero de la discoteca" y el "oficial de registro civil" de Fragola.
   Se encarga de absolutamente todo lo que tiene que ver con quién es la persona que está
   usando la página web:
   - Crear cuentas nuevas de cliente con correo y contraseña.
   - Iniciar sesión validando credenciales contra Firebase Auth.
   - Mantener al usuario conectado aunque recargue la página o navegue entre pestañas.
   - Guardar y leer el perfil en la colección "usuarios" de Cloud Firestore (para saber su rol: admin o cliente).
   - Bloquear el paso a personas no autorizadas mediante "guardias" de acceso (requerirSesion, requerirRol).
   - Cerrar sesión limpiando la memoria y vaciando el carrito de compras.
   ============================================================================== */

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

// ------------------------------------------------------------------------------
// CLASE DE ERROR PERSONALIZADA
// ------------------------------------------------------------------------------
// ¿Por qué creamos este error?
// Para que la interfaz sepa exactamente cuándo un fallo ocurrió por culpa de
// "falta de permisos" (ej. un cliente intentando entrar al panel de administración)
// en lugar de un error de red o de base de datos.
export class ErrorAutorizacion extends Error {
    constructor(mensaje = 'No tienes permiso para realizar esta acción.') {
        super(mensaje);
        this.name = 'ErrorAutorizacion';
    }
}

// ------------------------------------------------------------------------------
// GESTIÓN DE SESIÓN EN MEMORIA Y CACHÉ LOCAL
// ------------------------------------------------------------------------------
// ¿Por qué guardamos el usuario en memoria y a la vez en localStorage?
// NOTA PEDAGÓGICA PARA LA DEFENSA TÉCNICA:
// Firebase Auth almacena la sesión en IndexedDB de forma asíncrona. Eso significa que
// cuando el usuario abre una página como `pedidos.html`, Firebase tarda unos 300 milisegundos
// en despertar y decirnos "sí, este usuario está conectado".
// Si esperáramos esos 300 ms, la página parpadearía o pensaría erróneamente que no hay nadie
// conectado y redirigiría a `ingresar.html`.
// Al guardar una copia en `localStorage.getItem(CLAVES.sesion)`, la interfaz sabe QUIÉN ES
// el usuario de inmediato (en 0 milisegundos) y la página carga fluidamente.
let usuarioActivo = JSON.parse(localStorage.getItem(CLAVES.sesion) || 'null');

// VIGILANTE EN TIEMPO REAL DE FIREBASE (Listener de Autenticación)
// Cada vez que la página carga, o cuando el usuario inicia o cierra sesión en otra pestaña,
// esta función se ejecuta automáticamente para verificar el estado oficial en los servidores de Google.
onAuthStateChanged(auth, async (userFirebase) => {
    if (userFirebase) {
        // El usuario está autenticado en Google. Ahora vamos a Firestore a traer su información
        // de negocio (su nombre real y su rol: 'admin' o 'cliente').
        try {
            const docRef = doc(db, 'usuarios', userFirebase.uid);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                // Unimos el UID de autenticación con los datos del documento de Firestore
                usuarioActivo = { id: userFirebase.uid, ...docSnap.data() };
                localStorage.setItem(CLAVES.sesion, JSON.stringify(usuarioActivo));
            }
        } catch (e) {
            console.error('Error sincronizando el perfil del usuario con Firestore:', e);
        }
    } else {
        // No hay sesión en Firebase: limpiamos la memoria y el almacenamiento local
        usuarioActivo = null;
        localStorage.removeItem(CLAVES.sesion);
    }
});

// Limpia datos sensibles o innecesarios antes de entregar el usuario a la interfaz visual
export function usuarioPublico(usuario) {
    if (!usuario) return null;
    const { hash, sal, ...publico } = usuario;
    return publico;
}

// Devuelve el objeto del usuario actualmente conectado (o null si es un visitante anónimo)
export function usuarioActual() {
    return usuarioActivo ? usuarioPublico(usuarioActivo) : null;
}

// Helper booleano: responde true si el usuario conectado tiene privilegios de administrador
export function esAdmin(usuario = usuarioActual()) {
    return Boolean(usuario && usuario.rol === ROLES.ADMIN);
}

// ------------------------------------------------------------------------------
// GUARDIAS DE SEGURIDAD EN EL CLIENTE
// ------------------------------------------------------------------------------

// Exige que haya alguien conectado. Si es un visitante no registrado, detiene la ejecución arrojando ErrorAutorizacion
export function requerirSesion() {
    const usuario = usuarioActual();
    if (!usuario) {
        throw new ErrorAutorizacion('Debes iniciar sesión para continuar.');
    }
    return usuario;
}

// Exige un rol específico (ej. requerirRol('admin')). Si el usuario es un cliente común, lo rebota
export function requerirRol(rol) {
    const usuario = requerirSesion();
    if (usuario.rol !== rol) {
        throw new ErrorAutorizacion();
    }
    return usuario;
}

// ------------------------------------------------------------------------------
// OPERACIONES PÚBLICAS (Registro, Login, Logout)
// ------------------------------------------------------------------------------

/**
 * Registra una cuenta nueva en la pastelería.
 * @param {Object} datos - { nombre, email, contrasena, confirmacion }
 * Flujo paso a paso:
 * 1. Valida campos con lógica pura (que no vengan vacíos, contraseñas coincidan y tengan letras+números).
 * 2. Llama a Firebase Auth para registrar el correo y contraseña de forma cifrada en la nube.
 * 3. Obtiene el UID asignado por Google y crea un documento en Firestore dentro de `usuarios/{uid}`.
 * 4. Fija obligatoriamente el rol como 'cliente' (nadie puede registrarse como administrador).
 * 5. Guarda la sesión en caché y devuelve el usuario listo para usarse.
 */
export async function registrar({ nombre, email, contrasena, confirmacion }) {
    // Paso 1: Validamos que los datos del formulario cumplan las reglas
    const errores = validarRegistro({ nombre, email, contrasena, confirmacion });
    if (Object.keys(errores).length > 0) {
        const error = new Error('Revisa los campos marcados.');
        error.campos = errores;
        throw error;
    }

    try {
        // Paso 2: Crear el usuario en el motor de autenticación de Google
        const credencial = await createUserWithEmailAndPassword(auth, email.trim(), contrasena);
        const uid = credencial.user.uid;

        // Paso 3: Estructuramos el perfil que vivirá en nuestra base de datos NoSQL
        const nuevoUsuario = {
            id: uid,
            nombre: nombre.trim(),
            email: email.trim().toLowerCase(),
            rol: ROLES.CLIENTE, // REGLA: Toda cuenta nueva empieza como cliente
            creadoEn: new Date().toISOString()
        };

        // Paso 4: Guardamos el documento en Cloud Firestore bajo la ruta `usuarios/{uid}`
        await setDoc(doc(db, 'usuarios', uid), nuevoUsuario);

        // Paso 5: Activamos la sesión en el navegador
        usuarioActivo = nuevoUsuario;
        localStorage.setItem(CLAVES.sesion, JSON.stringify(nuevoUsuario));
        return usuarioPublico(nuevoUsuario);

    } catch (error) {
        // Manejo amigable de errores específicos que responde Firebase
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

/**
 * Inicia sesión con correo y contraseña.
 * @param {string} email
 * @param {string} contrasena
 * Flujo paso a paso:
 * 1. Envía las credenciales a Firebase Auth para verificar si coinciden.
 * 2. Si coinciden, consulta el documento en Firestore en `usuarios/{uid}` para traer su rol ('admin' o 'cliente').
 * 3. Almacena el usuario en la sesión activa y devuelve sus datos.
 */
export async function iniciarSesion(email, contrasena) {
    try {
        // Paso 1: Verificar correo y contraseña en Firebase Auth
        const credencial = await signInWithEmailAndPassword(auth, String(email).trim(), contrasena);
        const uid = credencial.user.uid;

        // Paso 2: Ir a Firestore por el perfil y el rol del usuario
        const docRef = doc(db, 'usuarios', uid);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            throw new Error('Perfil de usuario no encontrado en la base de datos.');
        }

        // Paso 3: Guardar el perfil en la sesión del navegador
        usuarioActivo = { id: uid, ...docSnap.data() };
        localStorage.setItem(CLAVES.sesion, JSON.stringify(usuarioActivo));
        return usuarioPublico(usuarioActivo);

    } catch (error) {
        // BUENA PRÁCTICA DE CIBERSEGURIDAD:
        // No decimos si falló el correo o falló la contraseña. Damos un mensaje genérico
        // para que un atacante no pueda adivinar qué correos existen registrados en el sistema.
        throw new Error('Correo o contraseña incorrectos.');
    }
}

/**
 * Cierra la sesión activa de forma completa y segura.
 * Flujo:
 * 1. Llama a signOut de Firebase para invalidar los tokens de autenticación en la nube.
 * 2. Limpia la variable en memoria `usuarioActivo`.
 * 3. Elimina la sesión del almacenamiento local (`CLAVES.sesion`).
 * 4. Vacía el carrito del navegador para que no se mezclen compras si otra persona usa el mismo equipo.
 * 5. Notifica a toda la interfaz con el evento `carrito:cambio` para que el contador del carrito se ponga en 0.
 */
export async function cerrarSesion() {
    await signOut(auth);
    usuarioActivo = null;
    localStorage.removeItem(CLAVES.sesion);
    localStorage.removeItem(CLAVES.carrito);
    document.dispatchEvent(new CustomEvent('carrito:cambio', { detail: [] }));
}