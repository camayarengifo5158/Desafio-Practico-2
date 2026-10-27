/* ==========================================================
   UI COMÚN
   Piezas de interfaz que usan todas las páginas: inicio de
   página con control de acceso, cabecera con sesión, avisos
   (toasts), estados de carga / vacío / error, confirmaciones
   y errores por campo en formularios.
   ========================================================== */

import { asegurarDatosIniciales } from '../data/semilla.js';
import { usuarioActual, cerrarSesion, ErrorAutorizacion } from '../data/auth.js';
import { contarUnidades, alCambiarCarrito } from '../logica/carrito.js';
import { escaparHTML } from '../logica/formato.js';
import { ROLES } from '../config/app-config.js';

// ---------- Inicio de página y control de acceso ----------
// requiere: null (pública), 'sesion' (cualquier usuario) o 'admin'
export function iniciarPagina({ requiere = null } = {}) {
    asegurarDatosIniciales();
    const usuario = usuarioActual();

    if (requiere && !usuario) {
        const volver = encodeURIComponent(location.pathname.split('/').pop() + location.search);
        location.replace(`ingresar.html?volver=${volver}`);
        return null;
    }
    if (requiere === 'admin' && usuario.rol !== ROLES.ADMIN) {
        location.replace('pedidos.html?aviso=sin-permiso');
        return null;
    }

    pintarSesionEnCabecera(usuario);
    alCambiarCarrito(() => actualizarContadorCarrito());
    mostrarAvisoPendiente();
    return usuario;
}

function pintarSesionEnCabecera(usuario) {
    const zona = document.querySelector('[data-nav-sesion]');
    if (!zona) return;

    const carrito = `
        <a class="nav-sesion__carrito" href="catalogo.html#carrito" data-abrir-carrito aria-label="Ver carrito">
            Carrito <span class="nav-sesion__contador" data-contador-carrito>0</span>
        </a>`;

    if (!usuario) {
        zona.innerHTML = `${carrito}<a class="nav-sesion__enlace" href="ingresar.html">Ingresar</a>`;
    } else {
        const primerNombre = escaparHTML(usuario.nombre.split(' ')[0]);
        const enlaceAdmin = usuario.rol === ROLES.ADMIN
            ? '<li><a href="admin.html">Panel de administración</a></li>' : '';
        zona.innerHTML = `
            ${carrito}
            <details class="nav-sesion__menu">
                <summary>Hola, ${primerNombre}${usuario.rol === ROLES.ADMIN ? ' <span class="etiqueta-rol">admin</span>' : ''}</summary>
                <ul>
                    ${enlaceAdmin}
                    <li><a href="pedidos.html">Mis pedidos</a></li>
                    <li><button type="button" data-cerrar-sesion>Cerrar sesión</button></li>
                </ul>
            </details>`;

        zona.querySelector('[data-cerrar-sesion]').addEventListener('click', async (e) => {
            e.target.disabled = true;
            e.target.textContent = 'Cerrando…';
            await cerrarSesion();
            location.href = 'index.html';
        });
    }
    actualizarContadorCarrito();
}

function actualizarContadorCarrito() {
    const contador = document.querySelector('[data-contador-carrito]');
    if (contador) contador.textContent = contarUnidades();
}

// ---------- Avisos (toasts) ----------

function contenedorToasts() {
    let zona = document.querySelector('.toasts');
    if (!zona) {
        zona = document.createElement('div');
        zona.className = 'toasts';
        zona.setAttribute('role', 'status');
        zona.setAttribute('aria-live', 'polite');
        document.body.appendChild(zona);
    }
    return zona;
}

// tipo: 'exito' | 'error' | 'info'
export function mostrarToast(mensaje, tipo = 'exito') {
    const toast = document.createElement('div');
    toast.className = `toast toast--${tipo}`;
    toast.textContent = mensaje;
    contenedorToasts().appendChild(toast);
    setTimeout(() => toast.classList.add('toast--saliendo'), 3800);
    setTimeout(() => toast.remove(), 4200);
}

// Guarda un aviso para mostrarlo en la siguiente página (después de redirigir)
export function avisarAlLlegar(mensaje, tipo = 'exito') {
    sessionStorage.setItem('fragola.aviso', JSON.stringify({ mensaje, tipo }));
}

function mostrarAvisoPendiente() {
    const pendiente = sessionStorage.getItem('fragola.aviso');
    if (!pendiente) return;
    sessionStorage.removeItem('fragola.aviso');
    const { mensaje, tipo } = JSON.parse(pendiente);
    mostrarToast(mensaje, tipo);
}

export function mensajeDeError(error) {
    if (error instanceof ErrorAutorizacion) return `Acceso denegado: ${error.message}`;
    return error?.message || 'Ocurrió un error inesperado. Intenta de nuevo.';
}

// ---------- Estados de un contenedor ----------

export function mostrarCargando(contenedor, texto = 'Cargando…') {
    contenedor.setAttribute('aria-busy', 'true');
    contenedor.innerHTML = `
        <div class="estado estado--cargando">
            <span class="spinner" aria-hidden="true"></span>
            <p>${escaparHTML(texto)}</p>
        </div>`;
}

export function mostrarVacio(contenedor, titulo, texto = '', accionHTML = '') {
    contenedor.removeAttribute('aria-busy');
    contenedor.innerHTML = `
        <div class="estado estado--vacio">
            <p class="estado__titulo">${escaparHTML(titulo)}</p>
            ${texto ? `<p>${escaparHTML(texto)}</p>` : ''}
            ${accionHTML}
        </div>`;
}

export function mostrarError(contenedor, error, alReintentar) {
    contenedor.removeAttribute('aria-busy');
    contenedor.innerHTML = `
        <div class="estado estado--error" role="alert">
            <p class="estado__titulo">No pudimos cargar la información</p>
            <p>${escaparHTML(mensajeDeError(error))}</p>
            ${alReintentar ? '<button type="button" class="boton boton--secundario" data-reintentar>Reintentar</button>' : ''}
        </div>`;
    if (alReintentar) contenedor.querySelector('[data-reintentar]').addEventListener('click', alReintentar);
}

// ---------- Botones durante operaciones asíncronas ----------
// Deshabilita el botón, muestra un texto de progreso y lo restaura al final
export async function conCarga(boton, textoCargando, operacion) {
    const textoOriginal = boton.innerHTML;
    boton.disabled = true;
    boton.innerHTML = `<span class="spinner spinner--pequeno" aria-hidden="true"></span> ${escaparHTML(textoCargando)}`;
    try {
        return await operacion();
    } finally {
        boton.disabled = false;
        boton.innerHTML = textoOriginal;
    }
}

// ---------- Confirmación con <dialog> ----------
export function confirmar(mensaje, { titulo = '¿Estás seguro?', textoAceptar = 'Confirmar', peligro = false } = {}) {
    return new Promise((resolver) => {
        const dialogo = document.createElement('dialog');
        dialogo.className = 'dialogo dialogo--pequeno';
        dialogo.innerHTML = `
            <form method="dialog" class="dialogo__cuerpo">
                <h2 class="dialogo__titulo">${escaparHTML(titulo)}</h2>
                <p>${escaparHTML(mensaje)}</p>
                <div class="dialogo__acciones">
                    <button value="no" class="boton boton--secundario">Volver</button>
                    <button value="si" class="boton ${peligro ? 'boton--peligro' : 'boton--primario'}">${escaparHTML(textoAceptar)}</button>
                </div>
            </form>`;
        document.body.appendChild(dialogo);
        dialogo.addEventListener('close', () => {
            resolver(dialogo.returnValue === 'si');
            dialogo.remove();
        });
        dialogo.showModal();
    });
}

// ---------- Errores por campo ----------

export function limpiarErroresCampos(formulario) {
    formulario.querySelectorAll('.campo-error').forEach((el) => el.remove());
    formulario.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));
}

// errores: { nombreDelCampo: 'mensaje' } — se busca el elemento por su atributo name
export function mostrarErroresCampos(formulario, errores = {}) {
    limpiarErroresCampos(formulario);
    let primero = null;
    for (const [campo, mensaje] of Object.entries(errores)) {
        const input = formulario.querySelector(`[name="${campo}"]`) || formulario.querySelector(`[data-campo="${campo}"]`);
        if (!input) continue;
        input.setAttribute('aria-invalid', 'true');
        const aviso = document.createElement('p');
        aviso.className = 'campo-error';
        aviso.id = `error-${campo}-${Math.random().toString(36).slice(2, 6)}`;
        aviso.textContent = mensaje;
        input.setAttribute('aria-describedby', aviso.id);
        const destino = input.matches('fieldset') ? input : (input.closest('.campo-formulario') || input.parentElement);
        destino.appendChild(aviso);
        primero = primero || input;
    }
    if (primero && typeof primero.focus === 'function') primero.focus();
}

// Lee un parámetro de la URL (?folio=FRG-00001)
export function parametroURL(nombre) {
    return new URLSearchParams(location.search).get(nombre);
}
