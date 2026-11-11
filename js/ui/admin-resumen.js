/* ==========================================================
   SUBMÓDULO: TABLERO EJECUTIVO Y RESUMEN (Capa UI / Admin)
   Archivo: js/ui/admin-resumen.js
   ----------------------------------------------------------
   ¿Para qué sirve este archivo?
   Es el "cuadro de mando gerencial" del negocio. Transforma las
   órdenes y postres crudos de Firestore en métricas financieras
   y gráficas visuales comprensibles para el dueño de la pastelería.

   Métricas clave calculadas y mostradas:
   1. Tarjetas de KPI (Key Performance Indicators):
      - Ventas totales netas (excluyendo cancelaciones).
      - Ticket promedio por compra.
      - Pedidos activos que requieren trabajo en cocina.
      - Dinero pendiente por cobrar.
      - Contador de postres disponibles vs total del catálogo.
   2. Gráfico de barras horizontales (CSS dinámico):
      - Ventas en dólares por cada categoría de repostería.
   3. Tabla de Top 5 postres más vendidos (por unidades despachadas).
   4. Desglose cuantitativo de pedidos por estado del flujo.
   5. Lista de las próximas 5 entregas programadas ordenadas por fecha.
   ========================================================== */

// Importamos las operaciones para consultar pedidos y catálogo desde Firestore
import { obtenerTransacciones } from '../data/transacciones-repo.js';
import { obtenerPostres } from '../data/postres-repo.js';

// Traemos las funciones de cálculo matemático de indicadores y ordenamiento
import { calcularIndicadores, ordenarTransacciones } from '../logica/procesamiento.js';

// Traemos formateadores de moneda, fecha y sanitizador XSS
import { dinero, fecha, escaparHTML } from '../logica/formato.js';

// Traemos utilidades de estado de carga y error
import { mostrarCargando, mostrarError } from './comun.js';

// Traemos la plantilla de insignias de colores
import { insigniaEstado } from './plantillas.js';

// Contenedor principal de la pestaña de resumen
const contenedor = document.querySelector('#contenido-resumen');

/* ----------------------------------------------------------
   iniciar()
   Cumple con el contrato de interfaz de los submódulos de administración.
   ---------------------------------------------------------- */
export function iniciar() {}

/* ----------------------------------------------------------
   cargar()
   ¿Para qué sirve? (OPTIMIZACIÓN DE CONSULTAS EN PARALELO)
   Para calcular los indicadores necesitamos tanto las transacciones
   como los postres.
   
   En vez de hacer:
   `await obtenerTransacciones()` (esperar 300ms) y luego `await obtenerPostres()` (esperar otros 300ms),
   usamos `Promise.all([obtenerTransacciones(), obtenerPostres()])`.
   Ambas peticiones viajan juntas a los servidores de Google y tardan
   la mitad del tiempo.
   ---------------------------------------------------------- */
export async function cargar() {
    mostrarCargando(contenedor, 'Calculando indicadores…');
    try {
        const [transacciones, postres] = await Promise.all([obtenerTransacciones(), obtenerPostres()]);
        pintar(transacciones, postres);
    } catch (error) {
        mostrarError(contenedor, error, cargar);
    }
}

/* ----------------------------------------------------------
   pintar(transacciones, postres)
   ¿Para qué sirve?
   Toma los datos crudos, invoca `calcularIndicadores()` y genera
   la cuadrícula visual de reportes.
   ---------------------------------------------------------- */
function pintar(transacciones, postres) {
    // Calculamos todas las métricas de inteligencia de negocio
    const ind = calcularIndicadores(transacciones);
    
    // Obtenemos el valor más alto entre categorías para calcular el porcentaje de las barras CSS
    const maxCategoria = Math.max(...ind.porCategoria.map((c) => c.total), 1);
    
    // Filtramos las órdenes activas y las ordenamos por fecha de entrega más próxima (primeras 5)
    const proximas = ordenarTransacciones(
        transacciones.filter((t) => ['pendiente', 'en_preparacion', 'lista'].includes(t.estado)), 'entrega'
    ).slice(0, 5);

    contenedor.removeAttribute('aria-busy');
    
    contenedor.innerHTML = `
        <!-- 1. Tarjetas de Indicadores Principales (KPIs) -->
        <div class="indicadores">
            <div class="indicador">
                <p class="indicador__etiqueta">Ventas (sin cancelados)</p>
                <p class="indicador__valor">${dinero(ind.ventasTotales)}</p>
            </div>
            <div class="indicador">
                <p class="indicador__etiqueta">Ticket promedio</p>
                <p class="indicador__valor">${dinero(ind.ticketPromedio)}</p>
            </div>
            <div class="indicador">
                <p class="indicador__etiqueta">Pedidos activos</p>
                <p class="indicador__valor">${ind.activos}</p>
            </div>
            <div class="indicador">
                <p class="indicador__etiqueta">Por cobrar</p>
                <p class="indicador__valor">${dinero(ind.porCobrar)}</p>
            </div>
            <div class="indicador">
                <p class="indicador__etiqueta">Postres disponibles</p>
                <p class="indicador__valor">${postres.filter((p) => p.disponible).length} / ${postres.length}</p>
            </div>
        </div>

        <!-- 2. Paneles de Gráficos y Tablas Detalladas -->
        <div class="paneles-resumen">
            <!-- Gráfica de barras proporcionales en CSS -->
            <section class="panel">
                <h2>Ventas por categoría</h2>
                <ul class="barras">
                    ${ind.porCategoria.map((c) => `
                    <li>
                        <span class="barras__etiqueta">${escaparHTML(c.nombre)}</span>
                        <span class="barras__pista">
                            <span class="barras__relleno" style="width:${(c.total / maxCategoria) * 100}%"></span>
                        </span>
                        <span class="barras__valor">${dinero(c.total)}</span>
                    </li>`).join('')}
                </ul>
            </section>

            <!-- Tabla de postres más vendidos -->
            <section class="panel">
                <h2>Postres más vendidos</h2>
                ${ind.topPostres.length ? `
                <table class="tabla tabla--compacta">
                    <thead>
                        <tr>
                            <th scope="col">Postre</th>
                            <th scope="col" class="num">Unidades</th>
                            <th scope="col" class="num">Ventas</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${ind.topPostres.map((p) => `
                        <tr>
                            <td>${escaparHTML(p.nombre)}</td>
                            <td class="num">${p.unidades}</td>
                            <td class="num">${dinero(p.total)}</td>
                        </tr>`).join('')}
                    </tbody>
                </table>` : '<p class="estado__texto">Aún no hay ventas.</p>'}
            </section>

            <!-- Conteo de pedidos por cada etapa del flujo -->
            <section class="panel">
                <h2>Pedidos por estado</h2>
                <ul class="lista-estados">
                    ${ind.porEstado.map((e) => `<li>${insigniaEstado(e.estado)} <strong>${e.cantidad}</strong></li>`).join('')}
                </ul>
            </section>

            <!-- Lista de entregas prioritarias para cocina y despacho -->
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
