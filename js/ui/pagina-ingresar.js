/* ==========================================================
   PÁGINA: INGRESAR (inicio de sesión y registro)
   ========================================================== */

import { iniciarSesion, registrar, usuarioActual } from '../data/auth.js';
import { validarLogin, validarRegistro } from '../logica/validaciones.js';
import { ROLES } from '../config/app-config.js';
import {
    iniciarPagina, conCarga, mostrarErroresCampos, limpiarErroresCampos,
    mostrarToast, parametroURL, mensajeDeError, avisarAlLlegar
} from './comun.js';

iniciarPagina();

const formLogin = document.querySelector('#form-login');
const formRegistro = document.querySelector('#form-registro');
const aviso = document.querySelector('#aviso-acceso');

// Solo se permite volver a páginas de este mismo sitio (evita redirecciones a sitios externos)
function destinoDespuesDeIngresar(usuario) {
    const volver = parametroURL('volver');
    if (volver && /^[a-zA-Z]+\.html([?#].*)?$/.test(volver)) return volver;
    return usuario.rol === ROLES.ADMIN ? 'admin.html' : 'catalogo.html';
}

// Si ya hay sesión abierta, no tiene sentido mostrar el formulario
const yaIngresado = usuarioActual();
if (yaIngresado) location.replace(destinoDespuesDeIngresar(yaIngresado));

if (parametroURL('volver')) {
    aviso.hidden = false;
    aviso.textContent = 'Inicia sesión o crea tu cuenta para continuar.';
}

// ---------- Pestañas accesibles ----------
const pestanas = document.querySelectorAll('[role="tab"]');

function activarPestana(pestana) {
    pestanas.forEach((t) => {
        const activa = t === pestana;
        t.setAttribute('aria-selected', String(activa));
        t.tabIndex = activa ? 0 : -1;
        document.getElementById(t.getAttribute('aria-controls')).hidden = !activa;
    });
    pestana.focus();
}

pestanas.forEach((pestana, i) => {
    pestana.addEventListener('click', () => activarPestana(pestana));
    pestana.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
            const siguiente = pestanas[(i + (e.key === 'ArrowRight' ? 1 : -1) + pestanas.length) % pestanas.length];
            activarPestana(siguiente);
        }
    });
});

// ---------- Inicio de sesión ----------
formLogin.addEventListener('submit', async (e) => {
    e.preventDefault();
    const datos = Object.fromEntries(new FormData(formLogin));
    const errores = validarLogin(datos);
    if (Object.keys(errores).length) return mostrarErroresCampos(formLogin, errores);
    limpiarErroresCampos(formLogin);

    const boton = formLogin.querySelector('button[type="submit"]');
    try {
        const usuario = await conCarga(boton, 'Verificando…', () => iniciarSesion(datos.email, datos.contrasena));
        avisarAlLlegar(`¡Bienvenido/a, ${usuario.nombre.split(' ')[0]}!`);
        location.href = destinoDespuesDeIngresar(usuario);
    } catch (error) {
        mostrarErroresCampos(formLogin, { contrasena: mensajeDeError(error) });
        formLogin.contrasena.value = '';
    }
});

// ---------- Registro ----------
formRegistro.addEventListener('submit', async (e) => {
    e.preventDefault();
    const datos = Object.fromEntries(new FormData(formRegistro));
    const errores = validarRegistro(datos);
    if (Object.keys(errores).length) return mostrarErroresCampos(formRegistro, errores);
    limpiarErroresCampos(formRegistro);

    const boton = formRegistro.querySelector('button[type="submit"]');
    try {
        const usuario = await conCarga(boton, 'Creando cuenta…', () => registrar(datos));
        avisarAlLlegar('Cuenta creada. ¡Ya puedes ordenar!');
        location.href = destinoDespuesDeIngresar(usuario);
    } catch (error) {
        if (error.campos) mostrarErroresCampos(formRegistro, error.campos);
        else mostrarToast(mensajeDeError(error), 'error');
    }
});
