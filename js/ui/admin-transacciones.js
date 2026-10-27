/* ==========================================================
   ADMIN · TRANSACCIONES (registro de ventas)
   Consultar con filtros, avanzar el estado, modificar,
   ver comprobante y eliminar. Las ventas nuevas se registran
   desde el catálogo con el mismo flujo de compra.
   ========================================================== */

import { ESTADOS } from '../config/app-config.js';
import { obtenerTransacciones, actualizarTransaccion, eliminarTransaccion } from '../data/transacciones-repo.js';
import { filtrarTransacciones, ordenarTransacciones } from '../logica/procesamiento.js';
import { dinero, fecha, fechaHora, escaparHTML, redondear } from '../logica/formato.js';
import {
    mostrarCargando, mostrarVacio, mostrarError, mostrarToast, confirmar, conCarga, mensajeDeError
} from './comun.js';
import { insigniaEstado, insigniaPago, opciones } from './plantillas.js';
import { abrirEdicionTransaccion } from './dialogo-transaccion.js';

const tabla = document.querySelector('#tabla-transacciones');
const filtros = document.querySelector('#filtros-transacciones');
const resumen = document.querySelector('#resumen-transacciones');

let transacciones = [];

export async function cargar() {
    mostrarCargando(tabla, 'Cargando transacciones…');
    try {
        transacciones = await obtenerTransacciones();
        pintar();
    } catch (error) {
        mostrarError(tabla, error, cargar);
    }
}

function reemplazar(actualizada) {
    transacciones = transacciones.map((t) => (t.id === actualizada.id ? actualizada : t));
    pintar();
}

function pintar() {
    const f = Object.fromEntries(new FormData(filtros));
    if (f.desde && f.hasta && f.desde > f.hasta) {
        resumen.textContent = 'La fecha "Desde" no puede ser posterior a "Hasta".';
        mostrarVacio(tabla, 'Rango de fechas inválido.');
        return;
    }
    const visibles = ordenarTransacciones(filtrarTransacciones(transacciones, f), f.orden);
    const totalVisible = redondear(visibles.filter((t) => t.estado !== 'cancelada').reduce((s, t) => s + t.total, 0));
    resumen.textContent = `${visibles.length} de ${transacciones.length} transacciones · Ventas en la selección (sin canceladas): ${dinero(totalVisible)}`;

    if (visibles.length === 0) {
        mostrarVacio(tabla, transacciones.length ? 'Ninguna transacción coincide con los filtros.' : 'Aún no hay transacciones registradas.');
        return;
    }

    tabla.removeAttribute('aria-busy');
    tabla.innerHTML = `
        <div class="tabla-desplazable">
            <table class="tabla tabla--responsiva">
                <caption class="visualmente-oculto">Transacciones registradas</caption>
                <thead>
                    <tr>
                        <th scope="col">Folio</th>
                        <th scope="col">Cliente</th>
                        <th scope="col">Productos</th>
                        <th scope="col" class="num">Total</th>
                        <th scope="col">Entrega</th>
                        <th scope="col">Estado</th>
                        <th scope="col"><span class="visualmente-oculto">Acciones</span></th>
                    </tr>
                </thead>
                <tbody>
                    ${visibles.map((t) => {
                        const siguientes = ESTADOS[t.estado].siguientes;
                        return `
                    <tr>
                        <td data-titulo="Folio"><strong>${escaparHTML(t.folio)}</strong><small>${fechaHora(t.creadaEn)}</small></td>
                        <td data-titulo="Cliente">${escaparHTML(t.clienteNombre)}<small>${escaparHTML(t.clienteEmail)}</small></td>
                        <td data-titulo="Productos">${t.items.map((i) => `${i.cantidad} × ${escaparHTML(i.nombre)}`).join('<br>')}</td>
                        <td data-titulo="Total" class="num">${dinero(t.total)}<small>${insigniaPago(t.pagado)}</small></td>
                        <td data-titulo="Entrega">${fecha(t.entrega.fecha)}<small>${t.entrega.tipo === 'domicilio' ? 'Domicilio' : escaparHTML(t.entrega.sucursal)}</small></td>
                        <td data-titulo="Estado">
                            ${insigniaEstado(t.estado)}
                            ${siguientes.length ? `
                            <label class="visualmente-oculto" for="avanzar-${t.id}">Cambiar estado de ${escaparHTML(t.folio)}</label>
                            <select id="avanzar-${t.id}" class="select-estado" data-avanzar="${t.id}">
                                <option value="">Cambiar a…</option>
                                ${opciones(siguientes.map((e) => ({ valor: e, texto: ESTADOS[e].etiqueta })))}
                            </select>` : ''}
                        </td>
                        <td class="acciones-fila">
                            <a class="boton boton--secundario boton--pequeno" href="comprobante.html?folio=${encodeURIComponent(t.folio)}">Comprobante</a>
                            <button type="button" class="boton boton--secundario boton--pequeno" data-editar="${t.id}">Editar</button>
                            <button type="button" class="boton boton--peligro boton--pequeno" data-eliminar="${t.id}">Eliminar</button>
                        </td>
                    </tr>`;
                    }).join('')}
                </tbody>
            </table>
        </div>`;
}

export function iniciar() {
    document.querySelector('#estado-trx').insertAdjacentHTML('beforeend',
        opciones(Object.entries(ESTADOS).map(([valor, e]) => ({ valor, texto: e.etiqueta }))));

    let espera;
    filtros.addEventListener('input', () => { clearTimeout(espera); espera = setTimeout(pintar, 200); });
    filtros.addEventListener('submit', (e) => e.preventDefault());

    // Avanzar estado rápido desde la tabla
    tabla.addEventListener('change', async (e) => {
        const select = e.target.closest('[data-avanzar]');
        if (!select || !select.value) return;
        const t = transacciones.find((x) => x.id === select.dataset.avanzar);
        const nuevo = select.value;
        if (nuevo === 'cancelada') {
            const ok = await confirmar(`¿Cancelar el pedido ${t.folio}? Esta acción no se puede revertir.`, {
                titulo: 'Cancelar pedido', textoAceptar: 'Cancelar pedido', peligro: true
            });
            if (!ok) { select.value = ''; return; }
        }
        select.disabled = true;
        try {
            reemplazar(await actualizarTransaccion(t.id, { estado: nuevo }));
            mostrarToast(`${t.folio}: ${ESTADOS[nuevo].etiqueta}.`);
        } catch (error) {
            select.disabled = false;
            select.value = '';
            mostrarToast(mensajeDeError(error), 'error');
        }
    });

    tabla.addEventListener('click', async (e) => {
        const editar = e.target.closest('[data-editar]');
        const eliminar = e.target.closest('[data-eliminar]');

        if (editar) {
            const t = transacciones.find((x) => x.id === editar.dataset.editar);
            abrirEdicionTransaccion(t, {
                esAdmin: true,
                guardar: async (cambios) => reemplazar(await actualizarTransaccion(t.id, cambios))
            });
        }

        if (eliminar) {
            const t = transacciones.find((x) => x.id === eliminar.dataset.eliminar);
            const ok = await confirmar(`Se eliminará el registro ${t.folio} (${dinero(t.total)}) de forma permanente. Si solo quieres anularlo, mejor cámbialo a “Cancelada”.`, {
                titulo: 'Eliminar transacción', textoAceptar: 'Eliminar', peligro: true
            });
            if (!ok) return;
            try {
                await conCarga(eliminar, 'Eliminando…', () => eliminarTransaccion(t.id));
                transacciones = transacciones.filter((x) => x.id !== t.id);
                pintar();
                mostrarToast(`Transacción ${t.folio} eliminada.`, 'info');
            } catch (error) {
                mostrarToast(mensajeDeError(error), 'error');
            }
        }
    });
}
