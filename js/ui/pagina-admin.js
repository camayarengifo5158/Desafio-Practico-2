/* ==========================================================
   PÁGINA: PANEL DE ADMINISTRACIÓN GENERAL (Capa UI)
   Archivo: js/ui/pagina-admin.js
   ----------------------------------------------------------
   ¿Para qué sirve este archivo?
   Es el "director de orquesta" del panel de control de la pastelería.
   
   Responsabilidades:
   1. Guardia de acceso: Solo deja entrar a usuarios con rol 'admin'.
      Si entra un cliente, lo expulsa inmediatamente a pedidos.html.
   2. Navegación por pestañas accesibles (WAI-ARIA):
      - Resumen general (KPIs e indicadores de negocio).
      - Postres (CRUD del catálogo).
      - Transacciones (gestión de pedidos y cambio de estados).
      - Usuarios (cambio de roles y control de cuentas).
   3. Carga bajo demanda: Cada vez que el administrador cambia de pestaña,
      se descargan datos frescos desde Cloud Firestore.
   4. Botón de restablecimiento de datos: Permite volver a sembrar los 22 postres
      y las 9 transacciones en Firestore con confirmación y feedback visual.
   ========================================================== */

// Importamos la guardia de página, el modal de confirmación, spinner y flash messages
import { iniciarPagina, confirmar, conCarga, avisarAlLlegar } from './comun.js';

// Importamos la función de restauración completa en Cloud Firestore
import { restablecerDatosFirestore } from '../data/semilla.js';

// Importamos los cuatro submódulos especializados del panel
import * as resumen from './admin-resumen.js';
import * as postres from './admin-postres.js';
import * as transacciones from './admin-transacciones.js';
import * as usuarios from './admin-usuarios.js';

// Guardia de seguridad estricta: Solo administradores pueden ver esta pantalla
const usuario = iniciarPagina({ requiere: 'admin' });

// Diccionario de submódulos indexados por su nombre de sección
const secciones = { resumen, postres, transacciones, usuarios };
const pestanas = [...document.querySelectorAll('[role="tab"][data-seccion]')];

/* ----------------------------------------------------------
   mostrarSeccion(nombre, opciones)
   ¿Para qué sirve?
   Activa una sección específica del panel:
   - Si el nombre no existe, recurre a 'resumen' por defecto.
   - Actualiza los atributos `aria-selected` y oculta los paneles inactivos.
   - Modifica el hash en la URL (ej: `admin.html#postres`) para que si el
     administrador recarga la página, permanezca en la misma pestaña.
   - Llama a `secciones[nombre].cargar()` para traer datos frescos de Firestore.
   ---------------------------------------------------------- */
function mostrarSeccion(nombre, { enfocar = false } = {}) {
    if (!secciones[nombre]) nombre = 'resumen';
    
    pestanas.forEach((tab) => {
        const activa = tab.dataset.seccion === nombre;
        tab.setAttribute('aria-selected', String(activa));
        tab.tabIndex = activa ? 0 : -1;
        document.getElementById(tab.getAttribute('aria-controls')).hidden = !activa;
        if (activa && enfocar) tab.focus();
    });
    
    // Guardamos la pestaña actual en el hash de la URL
    history.replaceState(null, '', `#${nombre}`);
    
    // Recargamos datos frescos de la base de datos para esta sección
    secciones[nombre].cargar();
}

// Navegación con teclado (Flecha Izquierda / Flecha Derecha)
pestanas.forEach((tab, i) => {
    tab.addEventListener('click', () => mostrarSeccion(tab.dataset.seccion));
    tab.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        const paso = e.key === 'ArrowRight' ? 1 : -1;
        mostrarSeccion(pestanas[(i + paso + pestanas.length) % pestanas.length].dataset.seccion, { enfocar: true });
    });
});

/* ----------------------------------------------------------
   Botón: "Restablecer datos de prueba"
   ¿Para qué sirve?
   Es la salvación durante la defensa técnica en vivo:
   Si el profesor o los evaluadores eliminan postres, cancelan pedidos
   o cambian roles y quieren volver al estado inicial perfecto:
   1. Muestra un modal de peligro advirtiendo la acción.
   2. Con `conCarga`, deshabilita el botón y muestra "Restableciendo…".
   3. Vuelve a subir los 22 postres y 9 pedidos a Google Cloud Firestore.
   4. Recarga la página con `location.reload()` mostrando un toast de éxito.
   ---------------------------------------------------------- */
document.querySelector('#boton-restablecer').addEventListener('click', async (e) => {
    const boton = e.currentTarget; // Guardamos la referencia antes del await
    
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

// Inicialización: si superó la guardia de administrador, arranca cada submódulo
if (usuario) {
    Object.values(secciones).forEach((s) => s.iniciar());
    // Abre la pestaña indicada en el hash de la URL o 'resumen' por defecto
    mostrarSeccion(location.hash.slice(1));
}
