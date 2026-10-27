/* ==========================================================
   ADMIN · RESUMEN
   Indicadores calculados con JavaScript a partir de las
   transacciones y el catálogo guardados.
   ========================================================== */

import { obtenerTransacciones } from '../data/transacciones-repo.js';
import { obtenerPostres } from '../data/postres-repo.js';
import { calcularIndicadores, ordenarTransacciones } from '../logica/procesamiento.js';
import { dinero, fecha, escaparHTML } from '../logica/formato.js';
import { mostrarCargando, mostrarError } from './comun.js';
import { insigniaEstado } from './plantillas.js';

const contenedor = document.querySelector('#contenido-resumen');

export function iniciar() {}

export async function cargar() {
    mostrarCargando(contenedor, 'Calculando indicadores…');
    try {
        // Las dos consultas se hacen en paralelo
        const [transacciones, postres] = await Promise.all([obtenerTransacciones(), obtenerPostres()]);
        pintar(transacciones, postres);
    } catch (error) {
        mostrarError(contenedor, error, cargar);
    }
}

function pintar(transacciones, postres) {
    const ind = calcularIndicadores(transacciones);
    const maxCategoria = Math.max(...ind.porCategoria.map((c) => c.total), 1);
    const proximas = ordenarTransacciones(
        transacciones.filter((t) => ['pendiente', 'en_preparacion', 'lista'].includes(t.estado)), 'entrega'
    ).slice(0, 5);

    contenedor.removeAttribute('aria-busy');
    contenedor.innerHTML = `
        <div class="indicadores">
            <div class="indicador"><p class="indicador__etiqueta">Ventas (sin cancelados)</p><p class="indicador__valor">${dinero(ind.ventasTotales)}</p></div>
            <div class="indicador"><p class="indicador__etiqueta">Ticket promedio</p><p class="indicador__valor">${dinero(ind.ticketPromedio)}</p></div>
            <div class="indicador"><p class="indicador__etiqueta">Pedidos activos</p><p class="indicador__valor">${ind.activos}</p></div>
            <div class="indicador"><p class="indicador__etiqueta">Por cobrar</p><p class="indicador__valor">${dinero(ind.porCobrar)}</p></div>
            <div class="indicador"><p class="indicador__etiqueta">Postres disponibles</p><p class="indicador__valor">${postres.filter((p) => p.disponible).length} / ${postres.length}</p></div>
        </div>

        <div class="paneles-resumen">
            <section class="panel">
                <h2>Ventas por categoría</h2>
                <ul class="barras">
                    ${ind.porCategoria.map((c) => `
                    <li>
                        <span class="barras__etiqueta">${escaparHTML(c.nombre)}</span>
                        <span class="barras__pista"><span class="barras__relleno" style="width:${(c.total / maxCategoria) * 100}%"></span></span>
                        <span class="barras__valor">${dinero(c.total)}</span>
                    </li>`).join('')}
                </ul>
            </section>

            <section class="panel">
                <h2>Postres más vendidos</h2>
                ${ind.topPostres.length ? `
                <table class="tabla tabla--compacta">
                    <thead><tr><th scope="col">Postre</th><th scope="col" class="num">Unidades</th><th scope="col" class="num">Ventas</th></tr></thead>
                    <tbody>${ind.topPostres.map((p) => `<tr><td>${escaparHTML(p.nombre)}</td><td class="num">${p.unidades}</td><td class="num">${dinero(p.total)}</td></tr>`).join('')}</tbody>
                </table>` : '<p class="estado__texto">Aún no hay ventas.</p>'}
            </section>

            <section class="panel">
                <h2>Pedidos por estado</h2>
                <ul class="lista-estados">
                    ${ind.porEstado.map((e) => `<li>${insigniaEstado(e.estado)} <strong>${e.cantidad}</strong></li>`).join('')}
                </ul>
            </section>

            <section class="panel">
                <h2>Próximas entregas</h2>
                ${proximas.length ? `
                <ul class="lista-proximas">
                    ${proximas.map((t) => `
                    <li>
                        <a href="comprobante.html?folio=${encodeURIComponent(t.folio)}">${escaparHTML(t.folio)}</a>
                        <span>${fecha(t.entrega.fecha)} · ${escaparHTML(t.clienteNombre)}</span>
                        ${insigniaEstado(t.estado)}
                    </li>`).join('')}
                </ul>` : '<p class="estado__texto">No hay entregas pendientes.</p>'}
            </section>
        </div>`;
}
