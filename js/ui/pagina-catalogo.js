/* ==========================================================
   PÁGINA: CATÁLOGO Y TIENDA ONLINE (Capa UI)
   Archivo: js/ui/pagina-catalogo.js
   ----------------------------------------------------------
   ¿Para qué sirve este archivo?
   Es el corazón comercial de la pastelería "Fragola Postres".
   Gestiona cuatro grandes experiencias interactivas en una sola pantalla:

   1. Catálogo Dinámico en Vivo:
      - Descarga los postres desde Google Cloud Firestore.
      - Renderiza las tarjetas agrupadas por sus 4 categorías oficiales.
      - Aplica búsqueda inteligente con debounce (espera a que el usuario termine
        de escribir para no trabar el navegador), filtros por categoría,
        interruptor de postres disponibles y ordenamientos múltiples.

   2. Carrito de Compras Lateral (Drawer):
      - Panel deslizable con animación y bloqueo de scroll en el fondo.
      - Permite subir/bajar cantidades respetando los mínimos de venta.
      - Cruza los datos con Firestore para alertar si un postre se agotó.

   3. Modal de Compra y Facturación (Checkout):
      - Verificación de sesión: si el cliente no ha iniciado sesión, lo guía
        a ingresar y lo regresa automáticamente con su carrito intacto.
      - Selección de logística: retiro en tienda o envío a domicilio (+$3.00).
      - Control de fechas con 48h de anticipación obligatoria.
      - Selección de método de pago (tarjeta, transferencia, efectivo).
      - Creación oficial de la orden en Firestore y redirección al comprobante.
   ========================================================== */

// Importamos la configuración del negocio (categorías, sucursales, métodos de pago, costos)
import { CATEGORIAS, SUCURSALES, METODOS_PAGO, NEGOCIO } from '../config/app-config.js';

// Importamos los repositorios para consultar productos y registrar compras en Firestore
import { obtenerPostres } from '../data/postres-repo.js';
import { crearTransaccion } from '../data/transacciones-repo.js';

// Traemos el estado de la sesión actual
import { usuarioActual } from '../data/auth.js';

// Traemos las funciones puras de procesamiento de datos (búsqueda, filtros, orden y agrupación)
import { buscarPostres, filtrarPostres, ordenarPostres, agruparPorCategoria } from '../logica/procesamiento.js';

// Traemos las funciones del gestor del carrito
import {
    obtenerCarrito, agregarAlCarrito, actualizarCantidad, quitarDelCarrito,
    vaciarCarrito, detallarCarrito, contarUnidades, alCambiarCarrito
} from '../logica/carrito.js';

// Traemos las reglas de validación de entrega y la fecha mínima permitida
import { validarCheckout, fechaMinimaEntrega } from '../logica/validaciones.js';

// Traemos formateadores de moneda, sanitizador XSS y redondeo
import { dinero, escaparHTML, redondear } from '../logica/formato.js';

// Traemos herramientas comunes de interfaz (toasts, modales, spinners, estados vacíos)
import {
    iniciarPagina, mostrarCargando, mostrarVacio, mostrarError, mostrarToast,
    conCarga, confirmar, mostrarErroresCampos, limpiarErroresCampos, mensajeDeError
} from './comun.js';

// Traemos los componentes visuales de imagen y selector de opciones
import { imagenPostre, opciones } from './plantillas.js';

// Inicializamos la cabecera común de la página
iniciarPagina();

// ==========================================================
// REFERENCIAS A ELEMENTOS DEL DOM
// ==========================================================
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

// Estado local de los postres en memoria
let postres = [];

// ==========================================================
// 1. CARGA Y RENDERIZADO DEL CATÁLOGO
// ==========================================================

/* ----------------------------------------------------------
   cargarCatalogo()
   ¿Para qué sirve?
   Hace la llamada inicial a Firestore para traer los postres:
   - Pinta el estado de "Cargando el catálogo…" con su spinner.
   - Al recibir los datos, pinta las tarjetas y actualiza el carrito.
   - Si no hay internet, muestra el botón "Reintentar".
   ---------------------------------------------------------- */
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

/* ----------------------------------------------------------
   leerFiltros()
   Lee los controles de la barra superior de filtros y búsqueda.
   ---------------------------------------------------------- */
function leerFiltros() {
    const datos = new FormData(formFiltros);
    return {
        texto: datos.get('buscar') || '',
        categoria: datos.get('categoria') || 'todas',
        orden: datos.get('orden') || 'nombre',
        soloDisponibles: datos.get('soloDisponibles') === 'on'
    };
}

/* ----------------------------------------------------------
   pintarCatalogo()
   ¿Para qué sirve? (PIEZA MAESTRA DE PROGRAMACIÓN FUNCIONAL)
   Aplica un pipeline o cadena de transformaciones puras sobre la lista:
   postres original -> buscarPostres -> filtrarPostres -> ordenarPostres -> agruparPorCategoria.
   
   Luego recorre cada categoría y dibuja su cuadrícula con `tarjetaPostre()`.
   Si los filtros no arrojaron resultados, muestra un estado vacío amigable
   con un botón para limpiar los filtros.
   ---------------------------------------------------------- */
function pintarCatalogo() {
    const filtros = leerFiltros();
    
    // Encadenamiento de funciones puras
    let lista = buscarPostres(postres, filtros.texto);
    lista = filtrarPostres(lista, filtros);
    lista = ordenarPostres(lista, filtros.orden);
    const grupos = agruparPorCategoria(lista);

    // Actualizamos el contador (ej: "15 de 22 postres")
    conteo.textContent = `${lista.length} de ${postres.length} postres`;
    resultados.removeAttribute('aria-busy');

    // Estado cuando la búsqueda no coincide con nada
    if (lista.length === 0) {
        mostrarVacio(resultados, 'No encontramos postres con esos filtros.',
            'Prueba con otra palabra o cambia la categoría.',
            '<button type="button" class="boton boton--secundario" data-limpiar-filtros>Limpiar filtros</button>');
        return;
    }

    // Dibujamos las secciones de cada categoría
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

/* ----------------------------------------------------------
   tarjetaPostre(postre)
   ¿Para qué sirve?
   Genera la tarjeta visual individual de un postre:
   - Foto con carga diferida (`loading="lazy"`).
   - Si está agotado, le pone la clase oscura y el cartel "No disponible".
   - Título, descripción y desglose de precios.
   - Si tiene varias presentaciones (porción vs entero), muestra un `<select>`;
     si solo tiene una, usa un `<input type="hidden">`.
   - Control numérico de unidades fijado al mínimo de venta del postre (ej: mínimo 12).
   - Botón "Agregar" (o deshabilitado si está agotado).
   ---------------------------------------------------------- */
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

// ==========================================================
// EVENTOS DEL CATÁLOGO
// ==========================================================

/* ----------------------------------------------------------
   Búsqueda con "Debounce" (Antirrebote):
   Si el usuario escribe "Tiramisú", no ejecutamos el filtrado con cada letra
   (T, Ti, Tir, Tira...). Esperamos 250 milisegundos a que deje de teclear.
   Esto ahorra ciclos de CPU y hace que la interfaz se sienta súper fluida.
   ---------------------------------------------------------- */
let temporizadorBusqueda;
formFiltros.addEventListener('input', (e) => {
    clearTimeout(temporizadorBusqueda);
    const espera = e.target.name === 'buscar' ? 250 : 0;
    temporizadorBusqueda = setTimeout(pintarCatalogo, espera);
});
formFiltros.addEventListener('submit', (e) => e.preventDefault());

/* ----------------------------------------------------------
   Delegación de Eventos para botones "Agregar":
   En vez de colgar 22 escuchadores (uno en cada tarjeta), colgamos
   un ÚNICO escuchador en el contenedor padre `#catalogo-resultados`.
   Cuando ocurre un submit, detectamos cuál tarjeta lo originó con `.closest()`.
   Esto es una buena práctica de rendimiento web.
   ---------------------------------------------------------- */
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

// Botón para resetear todos los filtros
resultados.addEventListener('click', (e) => {
    if (e.target.matches('[data-limpiar-filtros]')) {
        formFiltros.reset();
        pintarCatalogo();
    }
});

// ==========================================================
// 2. PANEL LATERAL DEL CARRITO (Drawer)
// ==========================================================

/* ----------------------------------------------------------
   abrirCarrito() y cerrarCarrito()
   Manejan la visibilidad del panel lateral, la accesibilidad aria
   y bloquean el scroll de la página de fondo (`sin-scroll`).
   ---------------------------------------------------------- */
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
    if (location.hash === '#carrito') {
        history.replaceState(null, '', location.pathname + location.search);
    }
}

/* ----------------------------------------------------------
   pintarCarrito()
   Dibuja la lista de postres en la bolsa lateral:
   - Llama a `detallarCarrito(postres)` para validar que los productos
     sigan disponibles y con precios correctos.
   - Pinta cada fila con su foto, variante, precio y cajita de cantidad.
   - Si algún postre fue desactivado por el admin, muestra un aviso en rojo.
   - Desactiva el botón "Finalizar compra" si hay avisos o si está vacío.
   ---------------------------------------------------------- */
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

// Botones de apertura y cierre del carrito
botonCarrito.addEventListener('click', abrirCarrito);
panelCarrito.addEventListener('click', (e) => {
    if (e.target.closest('[data-cerrar-carrito]')) cerrarCarrito();
});
// Cierre con la tecla Escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !panelCarrito.hidden) cerrarCarrito();
});

// El enlace "Carrito" del menú superior abre este panel en vez de recargar la página
document.addEventListener('click', (e) => {
    if (e.target.closest('[data-abrir-carrito]')) {
        e.preventDefault();
        abrirCarrito();
    }
});

// Cambio de cantidad desde la cajita numérica dentro del carrito
lineasCarrito.addEventListener('change', (e) => {
    if (!e.target.matches('[data-cantidad]')) return;
    const { postreId, variante } = e.target.dataset;
    const postre = postres.find((p) => p.id === postreId);
    try {
        actualizarCantidad(postre, variante, Number(e.target.value));
    } catch (error) {
        mostrarToast(error.message, 'error');
        pintarCarrito(); // Si falló (ej. puso 0 en un postre de mínimo 12), restaura el valor anterior
    }
});

// Botón "Quitar" de una fila del carrito
lineasCarrito.addEventListener('click', (e) => {
    const boton = e.target.closest('[data-quitar]');
    if (!boton) return;
    quitarDelCarrito(boton.dataset.postreId, boton.dataset.variante);
    mostrarToast('Producto quitado del carrito.', 'info');
});

// Botón para vaciar todo el carrito con modal de confirmación
document.querySelector('#boton-vaciar').addEventListener('click', async () => {
    if (obtenerCarrito().length === 0) return;
    if (await confirmar('Se quitarán todos los productos del carrito.', { titulo: 'Vaciar carrito', textoAceptar: 'Vaciar', peligro: true })) {
        vaciarCarrito();
    }
});

// Suscripción reactiva: cualquier cambio en el carrito lo vuelve a pintar de inmediato
alCambiarCarrito(pintarCarrito);

// ==========================================================
// 3. CHECKOUT (Confirmación y Pasarela de Compra)
// ==========================================================

/* ----------------------------------------------------------
   prepararFormularioCheckout()
   Llena las sucursales en el `<select>`, fija la fecha mínima
   en el calendario a 48h desde hoy y genera los botones de radio
   para los métodos de pago.
   ---------------------------------------------------------- */
function prepararFormularioCheckout() {
    formCheckout.sucursal.innerHTML = opciones(SUCURSALES.map((s) => ({ valor: s, texto: s })));
    formCheckout.fecha.min = fechaMinimaEntrega();
    formCheckout.fecha.value = fechaMinimaEntrega();
    document.querySelector('[data-costo-envio]').textContent = dinero(NEGOCIO.costoEnvio);
    document.querySelector('#opciones-pago').innerHTML = Object.entries(METODOS_PAGO).map(([valor, texto], i) =>
        `<label><input type="radio" name="metodoPago" value="${valor}" ${i === 0 ? 'checked' : ''}> ${escaparHTML(texto)}</label>`
    ).join('');
}

/* ----------------------------------------------------------
   leerCheckout()
   Extrae los datos del formulario de entrega y pago.
   ---------------------------------------------------------- */
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

/* ----------------------------------------------------------
   pintarResumenCheckout()
   Calcula en vivo los subtotales, agrega el envío si es a domicilio
   y muestra el resumen financiero antes de pagar.
   ---------------------------------------------------------- */
function pintarResumenCheckout() {
    const { lineas, subtotal } = detallarCarrito(postres);
    const { entrega } = leerCheckout();
    const envio = entrega.tipo === 'domicilio' ? NEGOCIO.costoEnvio : 0;
    const total = redondear(subtotal + envio);

    // Muestra u oculta la caja de dirección según el tipo de entrega
    document.querySelector('[data-solo-domicilio]').hidden = entrega.tipo !== 'domicilio';
    
    resumenCheckout.innerHTML = `
        <h3>Resumen</h3>
        <ul>${lineas.map((l) => `<li><span>${l.cantidad} × ${escaparHTML(l.nombre)} (${escaparHTML(l.variante)})</span><span>${dinero(l.subtotal)}</span></li>`).join('')}</ul>
        <p><span>Subtotal</span><span>${dinero(subtotal)}</span></p>
        <p><span>Envío</span><span>${dinero(envio)}</span></p>
        <p class="resumen-compra__total"><span>Total</span><span>${dinero(total)}</span></p>`;
}

// Botón "Finalizar compra" del panel lateral
botonFinalizar.addEventListener('click', () => {
    // Regla de negocio: Solo usuarios con cuenta iniciada pueden comprar
    if (!usuarioActual()) {
        mostrarToast('Inicia sesión o crea tu cuenta para completar la compra.', 'info');
        // Redirigimos al login guardando en la URL que debe volver al carrito abierto
        setTimeout(() => {
            location.href = `ingresar.html?volver=${encodeURIComponent('catalogo.html#carrito')}`;
        }, 900);
        return;
    }
    limpiarErroresCampos(formCheckout);
    pintarResumenCheckout();
    dialogoCheckout.showModal();
});

// Al cambiar cualquier campo en el checkout, recalculamos el total (por el costo de envío)
formCheckout.addEventListener('change', pintarResumenCheckout);
dialogoCheckout.addEventListener('click', (e) => {
    if (e.target.closest('[data-cerrar-dialogo]')) dialogoCheckout.close();
});

/* ----------------------------------------------------------
   Procesamiento final de la compra:
   1. Valida los datos del formulario de entrega y pago.
   2. Deshabilita el botón con `conCarga` para evitar doble cobro.
   3. Llama a `crearTransaccion()` en el repositorio de Firestore.
   4. Vacía el carrito de compras.
   5. Redirige a `comprobante.html` con el folio generado (ej: FRG-58921).
   ---------------------------------------------------------- */
formCheckout.addEventListener('submit', async (e) => {
    e.preventDefault();
    const datos = leerCheckout();

    // Validación preventiva en el cliente
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
        // Redirigimos al comprobante oficial
        location.href = `comprobante.html?folio=${encodeURIComponent(transaccion.folio)}&nuevo=1`;
    } catch (error) {
        if (error.campos) mostrarErroresCampos(formCheckout, error.campos);
        mostrarToast(mensajeDeError(error), 'error');
        
        // Si el catálogo cambió mientras compraba (alguien agotó un postre), refrescamos los datos
        postres = await obtenerPostres();
        pintarCarrito();
        pintarResumenCheckout();
    }
});

// ==========================================================
// ARRANQUE INICIAL DE LA PÁGINA
// ==========================================================

// Llenamos el select de categorías con las opciones configuradas
document.querySelector('#filtro-categoria').insertAdjacentHTML('beforeend',
    opciones(CATEGORIAS.map((c) => ({ valor: c.id, texto: c.nombre }))));
    
prepararFormularioCheckout();

// Cargamos los postres desde Firestore
await cargarCatalogo();

// Si la URL traía el hash `#carrito`, abrimos el panel de una vez
if (location.hash === '#carrito') {
    abrirCarrito();
}
