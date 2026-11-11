/* ==========================================================
   PÁGINA: AUTENTICACIÓN (Ingreso y Registro de Usuarios)
   Archivo: js/ui/pagina-ingresar.js
   ----------------------------------------------------------
   ¿Para qué sirve este archivo?
   Es la "puerta de entrada" para clientes y administradores.
   Controla dos flujos clave:
   1. Inicio de sesión (Login): valida correo y contraseña con Firebase Auth
      y consulta el perfil en Cloud Firestore.
   2. Creación de cuenta (Registro): registra la cuenta en Firebase Auth,
      crea el documento en Firestore con rol 'cliente' e inicia sesión de inmediato.

   Puntos clave de diseño y accesibilidad:
   - Seguridad contra Open Redirect: Si la URL trae `?volver=...`, verifica
     con una expresión regular que sea una página `.html` interna del sitio,
     impidiendo que un atacante redirija al usuario a una web falsa de phishing.
   - Pestañas accesibles (WAI-ARIA): Se puede alternar entre "Iniciar sesión"
     y "Crear cuenta" usando el ratón o las flechas izquierda/derecha del teclado.
   - Si el usuario ya está conectado y entra aquí, se le redirige automáticamente
     a su pantalla principal según su rol (admin -> admin.html, cliente -> catalogo.html).
   ========================================================== */

// Importamos las funciones de autenticación con Firebase
import { iniciarSesion, registrar, usuarioActual } from '../data/auth.js';

// Importamos las reglas de validación de formularios
import { validarLogin, validarRegistro } from '../logica/validaciones.js';

// Traemos los roles válidos
import { ROLES } from '../config/app-config.js';

// Traemos utilidades de interfaz (toasts, spinner en botón, manejo de errores y query params)
import {
    iniciarPagina, conCarga, mostrarErroresCampos, limpiarErroresCampos,
    mostrarToast, parametroURL, mensajeDeError, avisarAlLlegar
} from './comun.js';

// Inicializamos la cabecera estándar
iniciarPagina();

// Referencias a los formularios y avisos en el DOM
const formLogin = document.querySelector('#form-login');
const formRegistro = document.querySelector('#form-registro');
const aviso = document.querySelector('#aviso-acceso');

/* ----------------------------------------------------------
   destinoDespuesDeIngresar(usuario)
   ¿Para qué sirve? (Seguridad contra Phishing / Open Redirect)
   Decide a dónde mandar al usuario una vez autenticado con éxito:
   1. Si venía con un parámetro `?volver=catalogo.html#carrito`, revisa
      que solo apunte a un archivo local `.html`. Si alguien intentó poner
      `?volver=https://sitio-malicioso.com`, la expresión regular lo rechaza.
   2. Si no hay parámetro de retorno:
      - Administrador -> `admin.html`
      - Cliente -> `catalogo.html`
   ---------------------------------------------------------- */
function destinoDespuesDeIngresar(usuario) {
    const volver = parametroURL('volver');
    if (volver && /^[a-zA-Z]+\.html([?#].*)?$/.test(volver)) return volver;
    return usuario.rol === ROLES.ADMIN ? 'admin.html' : 'catalogo.html';
}

// Si el usuario ya tenía una sesión abierta en esta pestaña, lo redirigimos de una vez
const yaIngresado = usuarioActual();
if (yaIngresado) {
    location.replace(destinoDespuesDeIngresar(yaIngresado));
}

// Si llegó redirigido desde el carrito u otra página protegida, mostramos un aviso explicativo
if (parametroURL('volver')) {
    aviso.hidden = false;
    aviso.textContent = 'Inicia sesión o crea tu cuenta para continuar.';
}

// ==========================================================
// PESTAÑAS ACCESIBLES (WAI-ARIA Tablist Pattern)
// ==========================================================
const pestanas = document.querySelectorAll('[role="tab"]');

/* ----------------------------------------------------------
   activarPestana(pestana)
   Cambia de pestaña visual y actualiza los atributos de accesibilidad:
   - `aria-selected`: true en la activa, false en la otra.
   - `tabIndex`: 0 en la activa (focalizable) y -1 en la inactiva.
   - `hidden`: oculta el panel correspondiente del formulario.
   ---------------------------------------------------------- */
function activarPestana(pestana) {
    pestanas.forEach((t) => {
        const activa = t === pestana;
        t.setAttribute('aria-selected', String(activa));
        t.tabIndex = activa ? 0 : -1;
        document.getElementById(t.getAttribute('aria-controls')).hidden = !activa;
    });
    pestana.focus();
}

// Navegación con teclado usando flechas izquierda y derecha
pestanas.forEach((pestana, i) => {
    pestana.addEventListener('click', () => activarPestana(pestana));
    pestana.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
            const siguiente = pestanas[(i + (e.key === 'ArrowRight' ? 1 : -1) + pestanas.length) % pestanas.length];
            activarPestana(siguiente);
        }
    });
});

// ==========================================================
// 1. FORMULARIO DE INICIO DE SESIÓN
// ==========================================================
formLogin.addEventListener('submit', async (e) => {
    e.preventDefault();
    // Convertimos los campos del formulario en un objeto JavaScript simple
    const datos = Object.fromEntries(new FormData(formLogin));
    
    // Validación de formato antes de llamar a Firebase
    const errores = validarLogin(datos);
    if (Object.keys(errores).length) return mostrarErroresCampos(formLogin, errores);
    limpiarErroresCampos(formLogin);

    const boton = formLogin.querySelector('button[type="submit"]');
    try {
        // Bloqueamos el botón con spinner mientras Firebase Auth verifica las credenciales
        const usuario = await conCarga(boton, 'Verificando…', () => iniciarSesion(datos.email, datos.contrasena));
        // Guardamos el saludo de bienvenida para que se muestre en la siguiente página
        avisarAlLlegar(`¡Bienvenido/a, ${usuario.nombre.split(' ')[0]}!`);
        location.href = destinoDespuesDeIngresar(usuario);
    } catch (error) {
        // Si las credenciales fallan, mostramos el error sobre el campo de contraseña y lo vaciamos
        mostrarErroresCampos(formLogin, { contrasena: mensajeDeError(error) });
        formLogin.contrasena.value = '';
    }
});

// ==========================================================
// 2. FORMULARIO DE REGISTRO DE CUENTA
// ==========================================================
formRegistro.addEventListener('submit', async (e) => {
    e.preventDefault();
    const datos = Object.fromEntries(new FormData(formRegistro));
    
    // Validación de contraseñas, nombres y formato de correo
    const errores = validarRegistro(datos);
    if (Object.keys(errores).length) return mostrarErroresCampos(formRegistro, errores);
    limpiarErroresCampos(formRegistro);

    const boton = formRegistro.querySelector('button[type="submit"]');
    try {
        // Crea la cuenta en Firebase Auth y el documento en Firestore
        const usuario = await conCarga(boton, 'Creando cuenta…', () => registrar(datos));
        avisarAlLlegar('Cuenta creada. ¡Ya puedes ordenar!');
        location.href = destinoDespuesDeIngresar(usuario);
    } catch (error) {
        if (error.campos) mostrarErroresCampos(formRegistro, error.campos);
        else mostrarToast(mensajeDeError(error), 'error');
    }
});
