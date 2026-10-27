/* ==========================================================
   PÁGINA: CATÁLOGO
   1. Carga los postres de forma asíncrona y los dibuja en el DOM.
   2. Búsqueda, filtro por categoría, disponibilidad y orden.
   3. Carrito lateral (agregar, cambiar cantidad, quitar, vaciar).
   4. Checkout simulado que crea la transacción y lleva al comprobante.
   ========================================================== */

import { CATEGORIAS, SUCURSALES, METODOS_PAGO, NEGOCIO } from '../config/app-config.js';
import { obtenerPostres } from '../data/postres-repo.js';
import { crearTransaccion } from '../data/transacciones-repo.js';
import { usuarioActual } from '../data/auth.js';
import { buscarPostres, filtrarPostres, ordenarPostres, agruparPorCategoria } from '../logica/procesamiento.js';
import {
    obtenerCarrito, agregarAlCarrito, actualizarCantidad, quitarDelCarrito,
    vaciarCarrito, detallarCarrito, contarUnidades, alCambiarCarrito
} from '../logica/carrito.js';
import { validarCheckout, fechaMinimaEntrega } from '../logica/validaciones.js';
import { dinero, escaparHTML, redondear } from '../logica/formato.js';
import {
    iniciarPagina, mostrarCargando, mostrarVacio, mostrarError, mostrarToast,
    conCarga, confirmar, mostrarErroresCampos, limpiarErroresCampos, mensajeDeError
} from './comun.js';
import { imagenPostre, opciones } from './plantillas.js';

iniciarPagina();

// ---------- Referencias al DOM ----------
const resultados = document.querySelector('#catalogo-resultados');
const formFiltros = document.querySelector('#filtros-catalogo');
const conteo = document.querySelector('#conteo-resultados');
const panelCarrito = document.querySelector('#carrito');
const botonCarrito = document.querySelector('#boton-carrito');
const lineasCarrito = document.querySelector('#carrito-lineas');
const subtotalCarrito = document.querySelector('#carrito-subtotal');
const botonFinalizar = document.querySelector('#boton-finalizar');
const dialogoCheckout = document.querySelector('#dialogo-checkout');
const formCheckout = document.querySelector('#form-checkout');
const resumenCheckout = document.querySelector('#resumen-checkout');

// Estado de la página
let postres = [];

// ==========================================================
// 1. CARGA Y RENDER DEL CATÁLOGO
// ==========================================================

async function cargarCatalogo() {
    mostrarCargando(resultados, 'Cargando el catálogo…');
    try {
        postres = await obtenerPostres();
        pintarCatalogo();
        pintarCarrito();
    } catch (error) {
        mostrarError(resultados, error, cargarCatalogo);
    }
}

function leerFiltros() {
    const datos = new FormData(formFiltros);
    return {
        texto: datos.get('buscar') || '',
        categoria: datos.get('categoria') || 'todas',
        orden: datos.get('orden') || 'nombre',
        soloDisponibles: datos.get('soloDisponibles') === 'on'
    };
}

function pintarCatalogo() {
    const filtros = leerFiltros();
    // Encadenamos las funciones de procesamiento: buscar → filtrar → ordenar → agrupar
    let lista = buscarPostres(postres, filtros.texto);
    lista = filtrarPostres(lista, filtros);
    lista = ordenarPostres(lista, filtros.orden);
    const grupos = agruparPorCategoria(lista);

    conteo.textContent = `${lista.length} de ${postres.length} postres`;
    resultados.removeAttribute('aria-busy');

    if (lista.length === 0) {
        mostrarVacio(resultados, 'No encontramos postres con esos filtros.',
            'Prueba con otra palabra o cambia la categoría.',
            '<button type="button" class="boton boton--secundario" data-limpiar-filtros>Limpiar filtros</button>');
        return;
    }

    resultados.innerHTML = grupos.map(({ categoria, postres: lista }, i) => `
        <section class="catalogo__categoria" aria-labelledby="titulo-${categoria.id}">
            <div class="contenedor">
                <header class="catalogo__categoria-encabezado">
                    <p class="sobretitulo catalogo__categoria-etiqueta">CATEGORÍA ${String(i + 1).padStart(2, '0')}</p>
                    <h2 class="catalogo__categoria-titulo" id="titulo-${categoria.id}">${escaparHTML(categoria.nombre)}</h2>
                    <p class="catalogo__categoria-descripcion">${escaparHTML(categoria.descripcion)}</p>
                </header>
                <div class="catalogo__grid">
                    ${lista.map(tarjetaPostre).join('')}
                </div>
            </div>
        </section>`).join('');
}

function tarjetaPostre(postre) {
    const variantes = postre.variantes.map((v) => ({ valor: v.nombre, texto: `${v.nombre} — ${dinero(v.precio)}` }));
    const selector = postre.variantes.length > 1
        ? `<label class="visualmente-oculto" for="var-${postre.id}">Presentación</label>
           <select id="var-${postre.id}" name="variante">${opciones(variantes)}</select>`
        : `<input type="hidden" name="variante" value="${escaparHTML(postre.variantes[0].nombre)}">`;

    return `
        <article class="catalogo__producto-card ${postre.disponible ? '' : 'catalogo__producto-card--agotado'}">
            <figure class="catalogo__producto-figura">
                ${imagenPostre(postre, 'catalogo__producto-img')}
                ${postre.disponible ? '' : '<figcaption class="etiqueta-agotado">No disponible</figcaption>'}
            </figure>
            <div class="catalogo__producto-cuerpo">
                <h3 class="catalogo__producto-titulo">${escaparHTML(postre.nombre)}</h3>
                <p class="catalogo__producto-descripcion">${escaparHTML(postre.descripcion)}</p>
                <p class="catalogo__producto-precio">${postre.variantes.map((v) => `${escaparHTML(v.nombre)}: ${dinero(v.precio)}`).join('<br>')}</p>
                ${postre.minimo > 1 ? `<p class="catalogo__minimo">Mínimo ${postre.minimo} unidades</p>` : ''}
                <form class="form-agregar" data-postre-id="${postre.id}" novalidate>
                    ${selector}
                    <div class="form-agregar__fila">
                        <label class="visualmente-oculto" for="cant-${postre.id}">Cantidad</label>
                        <input id="cant-${postre.id}" type="number" name="cantidad" min="${postre.minimo}" max="${NEGOCIO.maxCantidadPorLinea}"
                            step="1" value="${postre.minimo}" ${postre.disponible ? '' : 'disabled'}>
                        <button type="submit" class="catalogo__btn-accion" ${postre.disponible ? '' : 'disabled'}>
                            ${postre.disponible ? 'Agregar' : 'Agotado'}
                        </button>
                    </div>
                </form>
            </div>
        </article>`;
}

// ---------- Eventos del catálogo ----------

// Filtros: los selects reaccionan de inmediato; la búsqueda espera a que el usuario deje de escribir
let temporizadorBusqueda;
formFiltros.addEventListener('input', (e) => {
    clearTimeout(temporizadorBusqueda);
    const espera = e.target.name === 'buscar' ? 250 : 0;
    temporizadorBusqueda = setTimeout(pintarCatalogo, espera);
});
formFiltros.addEventListener('submit', (e) => e.preventDefault());

// Delegación de eventos: un solo listener para todos los botones "Agregar"
resultados.addEventListener('submit', (e) => {
    const form = e.target.closest('.form-agregar');
    if (!form) return;
    e.preventDefault();

    const postre = postres.find((p) => p.id === form.dataset.postreId);
    const datos = new FormData(form);
    try {
        agregarAlCarrito(postre, datos.get('variante'), Number(datos.get('cantidad')));
        mostrarToast(`${postre.nombre} se agregó al carrito.`);
    } catch (error) {
        mostrarToast(error.message, 'error');
    }
});

resultados.addEventListener('click', (e) => {
    if (e.target.matches('[data-limpiar-filtros]')) {
        formFiltros.reset();
        pintarCatalogo();
    }
});

// ==========================================================
// 2. CARRITO
// ==========================================================

function abrirCarrito() {
    panelCarrito.hidden = false;
    botonCarrito.setAttribute('aria-expanded', 'true');
    document.body.classList.add('sin-scroll');
    pintarCarrito();
    panelCarrito.querySelector('.carrito__encabezado button').focus();
}

function cerrarCarrito() {
    panelCarrito.hidden = true;
    botonCarrito.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('sin-scroll');
    if (location.hash === '#carrito') history.replaceState(null, '', location.pathname + location.search);
}

function pintarCarrito() {
    const { lineas, subtotal, valido } = detallarCarrito(postres);
    document.querySelector('[data-contador-flotante]').textContent = contarUnidades();
    subtotalCarrito.textContent = dinero(subtotal);
    botonFinalizar.disabled = !valido;

    if (lineas.length === 0) {
        mostrarVacio(lineasCarrito, 'Tu carrito está vacío.', 'Agrega postres desde el catálogo.');
        return;
    }

    lineasCarrito.innerHTML = lineas.map((l) => `
        <article class="linea-carrito ${l.aviso ? 'linea-carrito--aviso' : ''}">
            ${l.postre ? imagenPostre(l.postre, 'linea-carrito__img') : ''}
            <div class="linea-carrito__info">
                <h3>${escaparHTML(l.nombre)}</h3>
                <p>${escaparHTML(l.variante)} · ${dinero(l.precioUnitario)} c/u</p>
                ${l.aviso ? `<p class="linea-carrito__aviso">${escaparHTML(l.aviso)}</p>` : ''}
                <div class="linea-carrito__controles">
                    <label class="visualmente-oculto" for="cc-${l.postreId}-${escaparHTML(l.variante)}">Cantidad</label>
                    <input type="number" id="cc-${l.postreId}-${escaparHTML(l.variante)}" min="${l.postre?.minimo || 1}" step="1"
                        value="${l.cantidad}" data-cantidad data-postre-id="${l.postreId}" data-variante="${escaparHTML(l.variante)}"
                        ${l.postre ? '' : 'disabled'}>
                    <button type="button" class="boton-texto" data-quitar data-postre-id="${l.postreId}" data-variante="${escaparHTML(l.variante)}">Quitar</button>
                </div>
            </div>
            <p class="linea-carrito__subtotal">${dinero(l.subtotal)}</p>
        </article>`).join('');
}

botonCarrito.addEventListener('click', abrirCarrito);
panelCarrito.addEventListener('click', (e) => {
    if (e.target.closest('[data-cerrar-carrito]')) cerrarCarrito();
});
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !panelCarrito.hidden) cerrarCarrito();
});
// El enlace "Carrito" de la cabecera abre el panel en vez de recargar la página
document.addEventListener('click', (e) => {
    if (e.target.closest('[data-abrir-carrito]')) {
        e.preventDefault();
        abrirCarrito();
    }
});

lineasCarrito.addEventListener('change', (e) => {
    if (!e.target.matches('[data-cantidad]')) return;
    const { postreId, variante } = e.target.dataset;
    const postre = postres.find((p) => p.id === postreId);
    try {
        actualizarCantidad(postre, variante, Number(e.target.value));
    } catch (error) {
        mostrarToast(error.message, 'error');
        pintarCarrito(); // devuelve el campo al último valor válido
    }
});

lineasCarrito.addEventListener('click', (e) => {
    const boton = e.target.closest('[data-quitar]');
    if (!boton) return;
    quitarDelCarrito(boton.dataset.postreId, boton.dataset.variante);
    mostrarToast('Producto quitado del carrito.', 'info');
});

document.querySelector('#boton-vaciar').addEventListener('click', async () => {
    if (obtenerCarrito().length === 0) return;
    if (await confirmar('Se quitarán todos los productos del carrito.', { titulo: 'Vaciar carrito', textoAceptar: 'Vaciar', peligro: true })) {
        vaciarCarrito();
    }
});

// Cualquier cambio en el carrito vuelve a dibujar el panel
alCambiarCarrito(pintarCarrito);

// ==========================================================
// 3. CHECKOUT (compra simulada)
// ==========================================================

function prepararFormularioCheckout() {
    formCheckout.sucursal.innerHTML = opciones(SUCURSALES.map((s) => ({ valor: s, texto: s })));
    formCheckout.fecha.min = fechaMinimaEntrega();
    formCheckout.fecha.value = fechaMinimaEntrega();
    document.querySelector('[data-costo-envio]').textContent = dinero(NEGOCIO.costoEnvio);
    document.querySelector('#opciones-pago').innerHTML = Object.entries(METODOS_PAGO).map(([valor, texto], i) =>
        `<label><input type="radio" name="metodoPago" value="${valor}" ${i === 0 ? 'checked' : ''}> ${escaparHTML(texto)}</label>`
    ).join('');
}

function leerCheckout() {
    const datos = new FormData(formCheckout);
    return {
        entrega: {
            tipo: datos.get('tipo'),
            sucursal: datos.get('sucursal'),
            fecha: datos.get('fecha'),
            direccion: datos.get('direccion') || ''
        },
        metodoPago: datos.get('metodoPago'),
        notas: datos.get('notas') || ''
    };
}

function pintarResumenCheckout() {
    const { lineas, subtotal } = detallarCarrito(postres);
    const { entrega } = leerCheckout();
    const envio = entrega.tipo === 'domicilio' ? NEGOCIO.costoEnvio : 0;
    const total = redondear(subtotal + envio);

    document.querySelector('[data-solo-domicilio]').hidden = entrega.tipo !== 'domicilio';
    resumenCheckout.innerHTML = `
        <h3>Resumen</h3>
        <ul>${lineas.map((l) => `<li><span>${l.cantidad} × ${escaparHTML(l.nombre)} (${escaparHTML(l.variante)})</span><span>${dinero(l.subtotal)}</span></li>`).join('')}</ul>
        <p><span>Subtotal</span><span>${dinero(subtotal)}</span></p>
        <p><span>Envío</span><span>${dinero(envio)}</span></p>
        <p class="resumen-compra__total"><span>Total</span><span>${dinero(total)}</span></p>`;
}

botonFinalizar.addEventListener('click', () => {
    // Para comprar se necesita sesión: se envía al login y luego regresa al carrito
    if (!usuarioActual()) {
        mostrarToast('Inicia sesión o crea tu cuenta para completar la compra.', 'info');
        setTimeout(() => {
            location.href = `ingresar.html?volver=${encodeURIComponent('catalogo.html#carrito')}`;
        }, 900);
        return;
    }
    limpiarErroresCampos(formCheckout);
    pintarResumenCheckout();
    dialogoCheckout.showModal();
});

formCheckout.addEventListener('change', pintarResumenCheckout);
dialogoCheckout.addEventListener('click', (e) => {
    if (e.target.closest('[data-cerrar-dialogo]')) dialogoCheckout.close();
});

formCheckout.addEventListener('submit', async (e) => {
    e.preventDefault();
    const datos = leerCheckout();

    // Validación en el navegador antes de llamar al repositorio
    const errores = validarCheckout(datos);
    if (Object.keys(errores).length) {
        mostrarErroresCampos(formCheckout, errores);
        mostrarToast('Revisa los datos marcados.', 'error');
        return;
    }
    limpiarErroresCampos(formCheckout);

    const boton = document.querySelector('#boton-pagar');
    const texto = datos.metodoPago === 'tarjeta' ? 'Procesando pago…' : 'Registrando pedido…';
    try {
        const transaccion = await conCarga(boton, texto, () =>
            crearTransaccion({ ...datos, items: obtenerCarrito() })
        );
        vaciarCarrito();
        location.href = `comprobante.html?folio=${encodeURIComponent(transaccion.folio)}&nuevo=1`;
    } catch (error) {
        if (error.campos) mostrarErroresCampos(formCheckout, error.campos);
        mostrarToast(mensajeDeError(error), 'error');
        // Si el catálogo cambió (precio, disponibilidad), lo recargamos para mostrar el aviso
        postres = await obtenerPostres();
        pintarCarrito();
        pintarResumenCheckout();
    }
});

// ==========================================================
// INICIO
// ==========================================================

document.querySelector('#filtro-categoria').insertAdjacentHTML('beforeend',
    opciones(CATEGORIAS.map((c) => ({ valor: c.id, texto: c.nombre }))));
prepararFormularioCheckout();

await cargarCatalogo();
if (location.hash === '#carrito') abrirCarrito();
