/* ==========================================================
   PÁGINA: MIS PEDIDOS (historial del usuario con sesión)
   El repositorio solo devuelve las transacciones del usuario
   actual. Permite ver el comprobante, modificar y cancelar
   pedidos pendientes.
   ========================================================== */

import { ESTADOS } from '../config/app-config.js';
import { obtenerTransacciones, actualizarTransaccion, cancelarTransaccion } from '../data/transacciones-repo.js';
import { filtrarTransacciones, ordenarTransacciones } from '../logica/procesamiento.js';
import { dinero, fechaHora, escaparHTML, redondear } from '../logica/formato.js';
import {
    iniciarPagina, mostrarCargando, mostrarVacio, mostrarError, mostrarToast,
    confirmar, conCarga, mensajeDeError, parametroURL
} from './comun.js';
import { insigniaEstado, insigniaPago, textoEntrega, textoMetodoPago, opciones } from './plantillas.js';
import { abrirEdicionTransaccion } from './dialogo-transaccion.js';

const usuario = iniciarPagina({ requiere: 'sesion' });

const lista = document.querySelector('#lista-pedidos');
const filtroEstado = document.querySelector('#filtro-estado');
const orden = document.querySelector('#orden-pedidos');
const resumen = document.querySelector('#resumen-pedidos');

let pedidos = [];

if (parametroURL('aviso') === 'sin-permiso') {
    mostrarToast('Esa sección es solo para la administración.', 'error');
}

async function cargar() {
    mostrarCargando(lista, 'Cargando tus pedidos…');
    try {
        pedidos = await obtenerTransacciones();
        pintar();
    } catch (error) {
        mostrarError(lista, error, cargar);
    }
}

function pintar() {
    const visibles = ordenarTransacciones(
        filtrarTransacciones(pedidos, { estado: filtroEstado.value }),
        orden.value
    );
    const gastado = redondear(pedidos.filter((p) => p.estado !== 'cancelada').reduce((s, p) => s + p.total, 0));
    resumen.textContent = `${visibles.length} pedido(s) · Total comprado: ${dinero(gastado)}`;

    if (pedidos.length === 0) {
        mostrarVacio(lista, 'Todavía no tienes pedidos.', 'Explora el catálogo y arma tu primer pedido.',
            '<a class="boton boton--primario" href="catalogo.html">Ir al catálogo</a>');
        return;
    }
    if (visibles.length === 0) {
        mostrarVacio(lista, 'No hay pedidos con ese estado.');
        return;
    }
    lista.removeAttribute('aria-busy');

    lista.innerHTML = visibles.map((t) => {
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

lista.addEventListener('click', async (e) => {
    const editar = e.target.closest('[data-editar]');
    const cancelar = e.target.closest('[data-cancelar]');

    if (editar) {
        const t = pedidos.find((p) => p.id === editar.dataset.editar);
        abrirEdicionTransaccion(t, {
            esAdmin: false,
            guardar: async (cambios) => {
                const actualizada = await actualizarTransaccion(t.id, cambios);
                pedidos = pedidos.map((p) => (p.id === t.id ? actualizada : p));
                pintar();
            }
        });
    }

    if (cancelar) {
        const t = pedidos.find((p) => p.id === cancelar.dataset.cancelar);
        const ok = await confirmar(`El pedido ${t.folio} se cancelará y no podrá reactivarse.`, {
            titulo: 'Cancelar pedido', textoAceptar: 'Sí, cancelar', peligro: true
        });
        if (!ok) return;
        try {
            const actualizada = await conCarga(cancelar, 'Cancelando…', () => cancelarTransaccion(t.id));
            pedidos = pedidos.map((p) => (p.id === t.id ? actualizada : p));
            pintar();
            mostrarToast(`Pedido ${t.folio} cancelado.`, 'info');
        } catch (error) {
            mostrarToast(mensajeDeError(error), 'error');
        }
    }
});

filtroEstado.insertAdjacentHTML('beforeend',
    opciones(Object.entries(ESTADOS).map(([valor, e]) => ({ valor, texto: e.etiqueta }))));
filtroEstado.addEventListener('change', pintar);
orden.addEventListener('change', pintar);

if (usuario) cargar();
