/* ==========================================================
   PÁGINA: PANEL DE ADMINISTRACIÓN
   Controla las pestañas y delega cada sección a su módulo:
   admin-resumen.js, admin-postres.js, admin-transacciones.js
   y admin-usuarios.js. Si el usuario no es admin, iniciarPagina
   lo redirige (y los repositorios igual rechazarían la operación).
   ========================================================== */

import { iniciarPagina, confirmar, conCarga, avisarAlLlegar } from './comun.js';
import { restablecerDatos } from '../data/semilla.js';
import { simularRed } from '../data/almacenamiento.js';
import * as resumen from './admin-resumen.js';
import * as postres from './admin-postres.js';
import * as transacciones from './admin-transacciones.js';
import * as usuarios from './admin-usuarios.js';

const usuario = iniciarPagina({ requiere: 'admin' });

const secciones = { resumen, postres, transacciones, usuarios };
const pestanas = [...document.querySelectorAll('[role="tab"][data-seccion]')];

function mostrarSeccion(nombre, { enfocar = false } = {}) {
    if (!secciones[nombre]) nombre = 'resumen';
    pestanas.forEach((tab) => {
        const activa = tab.dataset.seccion === nombre;
        tab.setAttribute('aria-selected', String(activa));
        tab.tabIndex = activa ? 0 : -1;
        document.getElementById(tab.getAttribute('aria-controls')).hidden = !activa;
        if (activa && enfocar) tab.focus();
    });
    history.replaceState(null, '', `#${nombre}`);
    // Cada vez que se abre una sección se consultan datos frescos
    secciones[nombre].cargar();
}

pestanas.forEach((tab, i) => {
    tab.addEventListener('click', () => mostrarSeccion(tab.dataset.seccion));
    tab.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        const paso = e.key === 'ArrowRight' ? 1 : -1;
        mostrarSeccion(pestanas[(i + paso + pestanas.length) % pestanas.length].dataset.seccion, { enfocar: true });
    });
});

document.querySelector('#boton-restablecer').addEventListener('click', async (e) => {
    const boton = e.currentTarget; // se guarda antes del await (después currentTarget es null)
    const ok = await confirmar('Se perderán los postres, usuarios y transacciones creados durante las pruebas.', {
        titulo: 'Restablecer datos de prueba', textoAceptar: 'Restablecer', peligro: true
    });
    if (!ok) return;
    await conCarga(boton, 'Restableciendo…', async () => {
        await simularRed();
        restablecerDatos();
    });
    avisarAlLlegar('Datos de prueba restablecidos.');
    location.reload();
});

if (usuario) {
    Object.values(secciones).forEach((s) => s.iniciar());
    mostrarSeccion(location.hash.slice(1));
}
