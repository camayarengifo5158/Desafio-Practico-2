/* ==========================================================
   PÁGINA: MIS PEDIDOS (Historial de Compras del Cliente)
   Archivo: js/ui/pagina-pedidos.js
   ----------------------------------------------------------
   ¿Para qué sirve este archivo?
   Es el panel personal del cliente donde puede ver todos los postres
   que ha encargado a lo largo del tiempo.

   Capacidades del cliente en esta pantalla:
   1. Ver el estado en vivo de sus encargos (Pendiente, En preparación, Lista, Entregada).
   2. Ver si el pago ya fue registrado o si está por cobrar.
   3. Abrir e imprimir el Comprobante oficial de compra con su código de folio.
   4. Modificar la fecha, dirección, notas o cantidades MIENTRAS el pedido
      siga en estado "Pendiente".
   5. Cancelar el pedido de forma autónoma antes de que la cocina comience
      a prepararlo.
   6. Filtrar por estado y ordenar por fecha o valor.
   7. Ver el acumulado total de dinero que ha comprado en la pastelería.
   ========================================================== */

// Importamos la lista de estados del ciclo de vida de los pedidos
import { ESTADOS } from '../config/app-config.js';

// Importamos las operaciones de transacciones desde Firestore
import { obtenerTransacciones, actualizarTransaccion, cancelarTransaccion } from '../data/transacciones-repo.js';

// Traemos funciones puras para filtrar y ordenar arreglos
import { filtrarTransacciones, ordenarTransacciones } from '../logica/procesamiento.js';

// Traemos formateadores de moneda, fecha-hora, sanitizador XSS y redondeo
import { dinero, fechaHora, escaparHTML, redondear } from '../logica/formato.js';

// Traemos herramientas comunes de interfaz (guardias, modales, spinners, toasts)
import {
    iniciarPagina, mostrarCargando, mostrarVacio, mostrarError, mostrarToast,
    confirmar, conCarga, mensajeDeError, parametroURL
} from './comun.js';

// Traemos las plantillas de insignias de colores y opciones de select
import { insigniaEstado, insigniaPago, textoEntrega, textoMetodoPago, opciones } from './plantillas.js';

// Traemos el modal para editar pedidos
import { abrirEdicionTransaccion } from './dialogo-transaccion.js';

// Guardia de seguridad: Exige que el usuario haya iniciado sesión obligatoriamente
const usuario = iniciarPagina({ requiere: 'sesion' });

// Referencias a los elementos del DOM
const lista = document.querySelector('#lista-pedidos');
const filtroEstado = document.querySelector('#filtro-estado');
const orden = document.querySelector('#orden-pedidos');
const resumen = document.querySelector('#resumen-pedidos');

// Estado local de los pedidos en memoria
let pedidos = [];

// Si un cliente intentó meterse al panel de admin y fue rebotado aquí, le mostramos el aviso
if (parametroURL('aviso') === 'sin-permiso') {
    mostrarToast('Esa sección es solo para la administración.', 'error');
}

/* ----------------------------------------------------------
   cargar()
   ¿Para qué sirve?
   Hace la llamada a Firestore mediante `obtenerTransacciones()`.
   En el servidor de Google se aplica el filtro `clienteId == usuario.id`
   por lo que el cliente solo recibe sus propios pedidos, nunca los ajenos.
   ---------------------------------------------------------- */
async function cargar() {
    mostrarCargando(lista, 'Cargando tus pedidos…');
    try {
        pedidos = await obtenerTransacciones();
        pintar();
    } catch (error) {
        mostrarError(lista, error, cargar);
    }
}

/* ----------------------------------------------------------
   pintar()
   ¿Para qué sirve?
   Dibuja las tarjetas de los pedidos aplicando los filtros de estado
   y orden seleccionados por el cliente:
   - Calcula el total acumulado de compras válidas (sin contar canceladas).
   - Si no tiene pedidos, muestra un mensaje con un botón para ir al catálogo.
   - Pinta cada tarjeta con sus insignias, productos, entrega y botones de acción.
   ---------------------------------------------------------- */
function pintar() {
    // Filtramos y ordenamos la lista en memoria
    const visibles = ordenarTransacciones(
        filtrarTransacciones(pedidos, { estado: filtroEstado.value }),
        orden.value
    );
    
    // Suma financiera de compras activas
    const gastado = redondear(pedidos.filter((p) => p.estado !== 'cancelada').reduce((s, p) => s + p.total, 0));
    resumen.textContent = `${visibles.length} pedido(s) · Total comprado: ${dinero(gastado)}`;

    // Estado cuando el cliente es nuevo y nunca ha comprado
    if (pedidos.length === 0) {
        mostrarVacio(lista, 'Todavía no tienes pedidos.', 'Explora el catálogo y arma tu primer pedido.',
            '<a class="boton boton--primario" href="catalogo.html">Ir al catálogo</a>');
        return;
    }
    // Estado cuando el filtro seleccionado no coincide con ningún pedido
    if (visibles.length === 0) {
        mostrarVacio(lista, 'No hay pedidos con ese estado.');
        return;
    }
    lista.removeAttribute('aria-busy');

    // Generamos las tarjetas HTML
    lista.innerHTML = visibles.map((t) => {
        // Regla: El cliente solo puede editar o cancelar si el pedido sigue "pendiente"
        const editable = t.estado === 'pendiente';
        return `
        <article class="tarjeta-pedido">
            <header class="tarjeta-pedido__encabezado">
                <div>
                    <h2>${escaparHTML(t.folio)}</h2>
                    <p>${fechaHora(t.creadaEn)}</p>
                </div>
                <div class="tarjeta-pedido__insignias">${insigniaEstado(t.estado)} ${insigniaPago(t.pagado)}</div>
            </header>
            <ul class="tarjeta-pedido__items">
                ${t.items.map((i) => `<li>${i.cantidad} × ${escaparHTML(i.nombre)} <small>(${escaparHTML(i.variante)})</small></li>`).join('')}
            </ul>
            <p class="tarjeta-pedido__entrega">${escaparHTML(textoEntrega(t.entrega))}</p>
            <p class="tarjeta-pedido__pago">${escaparHTML(textoMetodoPago(t.metodoPago))}</p>
            <footer class="tarjeta-pedido__pie">
                <p class="tarjeta-pedido__total">${dinero(t.total)}</p>
                <div class="tarjeta-pedido__acciones">
                    <a class="boton boton--secundario boton--pequeno" href="comprobante.html?folio=${encodeURIComponent(t.folio)}">Comprobante</a>
                    ${editable ? `
                    <button type="button" class="boton boton--secundario boton--pequeno" data-editar="${t.id}">Modificar</button>
                    <button type="button" class="boton boton--peligro boton--pequeno" data-cancelar="${t.id}">Cancelar</button>` : ''}
                </div>
            </footer>
        </article>`;
    }).join('');
}

// ==========================================================
// EVENTOS: ACCIONES SOBRE LOS PEDIDOS (Delegación de Eventos)
// ==========================================================
lista.addEventListener('click', async (e) => {
    const editar = e.target.closest('[data-editar]');
    const cancelar = e.target.closest('[data-cancelar]');

    // 1. Modificar pedido pendiente
    if (editar) {
        const t = pedidos.find((p) => p.id === editar.dataset.editar);
        abrirEdicionTransaccion(t, {
            esAdmin: false, // Quien edita es un cliente
            guardar: async (cambios) => {
                const actualizada = await actualizarTransaccion(t.id, cambios);
                // Actualizamos el pedido en memoria y repintamos la pantalla
                pedidos = pedidos.map((p) => (p.id === t.id ? actualizada : p));
                pintar();
            }
        });
    }

    // 2. Cancelar pedido pendiente
    if (cancelar) {
        const t = pedidos.find((p) => p.id === cancelar.dataset.cancelar);
        // Pedimos confirmación explícita con el modal nativo
        const ok = await confirmar(`El pedido ${t.folio} se cancelará y no podrá reactivarse.`, {
            titulo: 'Cancelar pedido', textoAceptar: 'Sí, cancelar', peligro: true
        });
        if (!ok) return;
        
        try {
            // Cancelamos en Firestore con spinner en el botón
            const actualizada = await conCarga(cancelar, 'Cancelando…', () => cancelarTransaccion(t.id));
            pedidos = pedidos.map((p) => (p.id === t.id ? actualizada : p));
            pintar();
            mostrarToast(`Pedido ${t.folio} cancelado.`, 'info');
        } catch (error) {
            mostrarToast(mensajeDeError(error), 'error');
        }
    }
});

// Llenamos el filtro de estados con las opciones oficiales
filtroEstado.insertAdjacentHTML('beforeend',
    opciones(Object.entries(ESTADOS).map(([valor, e]) => ({ valor, texto: e.etiqueta }))));
    
filtroEstado.addEventListener('change', pintar);
orden.addEventListener('change', pintar);

// Si el usuario superó la guardia de sesión, cargamos sus pedidos
if (usuario) {
    cargar();
}
