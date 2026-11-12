/* ARCHIVO: js/ui/pagina-admin.js
   PÁGINA: PANEL DE ADMINISTRACIÓN GENERAL (Capa UI)

   ÍNDICE:
   - usuario  (línea 20)
   - secciones  (línea 22)
   - pestanas  (línea 23)
   - mostrarSeccion()  (línea 25)
*/

import { iniciarPagina, confirmar, conCarga, avisarAlLlegar } from './comun.js';

import { restablecerDatosFirestore } from '../data/semilla.js';

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
    const boton = e.currentTarget;

    const ok = await confirmar('Se restaurará el catálogo de 22 postres y las transacciones de prueba en Cloud Firestore.', {
        titulo: 'Restablecer datos de prueba', textoAceptar: 'Restablecer', peligro: true
    });
    if (!ok) return;

    await conCarga(boton, 'Restableciendo…', async () => {
        await restablecerDatosFirestore();
    });

    avisarAlLlegar('Datos de prueba restablecidos en Firebase.');
    location.reload();
});

if (usuario) {
    Object.values(secciones).forEach((s) => s.iniciar());
    mostrarSeccion(location.hash.slice(1));
}
