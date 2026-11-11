/* ==========================================================
   SUBMÓDULO: GESTIÓN DE TRANSACCIONES / PEDIDOS (Capa UI / Admin)
   Archivo: js/ui/admin-transacciones.js
   ----------------------------------------------------------
   ¿Para qué sirve este archivo?
   Es la "torre de control de despachos y cocina" de la pastelería.
   Permite al Administrador:
   1. Visualizar todas las compras hechas por cualquier cliente.
   2. Filtrar por rango de fechas (desde / hasta), por estado y por texto (folio, nombre o email).
   3. Avanzar el estado de un pedido en un clic usando un selector rápido
      en la misma fila de la tabla (Pendiente -> En preparación -> Lista -> Entregada).
   4. Modificar cualquier detalle de la orden con el modal de edición de transacciones.
   5. Ver e imprimir el comprobante oficial de cualquier cliente.
   6. Eliminar registros de prueba con modal de confirmación.
   ========================================================== */

// Importamos la máquina de estados oficial
import { ESTADOS } from '../config/app-config.js';

// Importamos las operaciones del repositorio de transacciones en Firestore
import { obtenerTransacciones, actualizarTransaccion, eliminarTransaccion } from '../data/transacciones-repo.js';

// Traemos funciones puras para filtrar y ordenar listas
import { filtrarTransacciones, ordenarTransacciones } from '../logica/procesamiento.js';

// Traemos formateadores de moneda, fechas, sanitizador XSS y redondeo
import { dinero, fecha, fechaHora, escaparHTML, redondear } from '../logica/formato.js';

// Traemos herramientas de interfaz (spinner, modales, toasts y traducción de errores)
import {
    mostrarCargando, mostrarVacio, mostrarError, mostrarToast, confirmar, conCarga, mensajeDeError
} from './comun.js';

// Traemos plantillas de insignias de estados y pagos
import { insigniaEstado, insigniaPago, opciones } from './plantillas.js';

// Traemos el modal para editar transacciones
import { abrirEdicionTransaccion } from './dialogo-transaccion.js';

// Referencias a los elementos del DOM
const tabla = document.querySelector('#tabla-transacciones');
const filtros = document.querySelector('#filtros-transacciones');
const resumen = document.querySelector('#resumen-transacciones');

// Arreglo en memoria con todas las transacciones de Firestore
let transacciones = [];

/* ----------------------------------------------------------
   cargar()
   Descarga todas las transacciones desde Firestore y pinta la tabla.
   ---------------------------------------------------------- */
export async function cargar() {
    mostrarCargando(tabla, 'Cargando transacciones…');
    try {
        transacciones = await obtenerTransacciones();
        pintar();
    } catch (error) {
        mostrarError(tabla, error, cargar);
    }
}

/* ----------------------------------------------------------
   reemplazar(actualizada)
   Actualiza una transacción modificada en la memoria local y repinta
   la tabla sin tener que volver a llamar a Firestore por toda la lista.
   ---------------------------------------------------------- */
function reemplazar(actualizada) {
    transacciones = transacciones.map((t) => (t.id === actualizada.id ? actualizada : t));
    pintar();
}

/* ----------------------------------------------------------
   pintar()
   ¿Para qué sirve?
   Aplica filtros de búsqueda, fechas y estados sobre la lista en memoria:
   - Valida que la fecha "Desde" no sea mayor que "Hasta".
   - Calcula el total acumulado de ventas visibles (excluyendo cancelaciones).
   - Genera la tabla con folios, clientes, productos, totales, fechas
     y el selector rápido para avanzar el estado.
   ---------------------------------------------------------- */
function pintar() {
    const f = Object.fromEntries(new FormData(filtros));
    
    // Validación de coherencia de fechas
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
                        <td data-titulo="Folio">
                            <strong>${escaparHTML(t.folio)}</strong>
                            <small>${fechaHora(t.creadaEn)}</small>
                        </td>
                        <td data-titulo="Cliente">
                            ${escaparHTML(t.clienteNombre)}
                            <small>${escaparHTML(t.clienteEmail)}</small>
                        </td>
                        <td data-titulo="Productos">
                            ${t.items.map((i) => `${i.cantidad} × ${escaparHTML(i.nombre)}`).join('<br>')}
                        </td>
                        <td data-titulo="Total" class="num">
                            ${dinero(t.total)}
                            <small>${insigniaPago(t.pagado)}</small>
                        </td>
                        <td data-titulo="Entrega">
                            ${fecha(t.entrega.fecha)}
                            <small>${t.entrega.tipo === 'domicilio' ? 'Domicilio' : escaparHTML(t.entrega.sucursal)}</small>
                        </td>
                        <td data-titulo="Estado">
                            ${insigniaEstado(t.estado)}
                            <!-- Selector rápido para avanzar estado en 1 clic -->
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

// ==========================================================
// INICIALIZACIÓN DE EVENTOS
// ==========================================================
export function iniciar() {
    // Llenamos el select de filtro de estado
    document.querySelector('#estado-trx').insertAdjacentHTML('beforeend',
        opciones(Object.entries(ESTADOS).map(([valor, e]) => ({ valor, texto: e.etiqueta }))));

    // Búsqueda y filtros con pequeño retardo para no saturar
    let espera;
    filtros.addEventListener('input', () => { 
        clearTimeout(espera); 
        espera = setTimeout(pintar, 200); 
    });
    filtros.addEventListener('submit', (e) => e.preventDefault());

    // 1. Cambio de estado rápido directamente desde el selector de la tabla
    tabla.addEventListener('change', async (e) => {
        const select = e.target.closest('[data-avanzar]');
        if (!select || !select.value) return;
        
        const t = transacciones.find((x) => x.id === select.dataset.avanzar);
        const nuevo = select.value;
        
        // Si el admin decide cancelar un pedido desde la tabla, exigimos confirmación
        if (nuevo === 'cancelada') {
            const ok = await confirmar(`¿Cancelar el pedido ${t.folio}? Esta acción no se puede revertir.`, {
                titulo: 'Cancelar pedido', textoAceptar: 'Cancelar pedido', peligro: true
            });
            if (!ok) { 
                select.value = ''; 
                return; 
            }
        }
        
        select.disabled = true;
        try {
            // Actualizamos en Firestore y refrescamos la vista
            reemplazar(await actualizarTransaccion(t.id, { estado: nuevo }));
            mostrarToast(`${t.folio}: ${ESTADOS[nuevo].etiqueta}.`);
        } catch (error) {
            select.disabled = false;
            select.value = '';
            mostrarToast(mensajeDeError(error), 'error');
        }
    });

    // 2. Acciones de fila: Editar y Eliminar (Delegación de Eventos)
    tabla.addEventListener('click', async (e) => {
        const editar = e.target.closest('[data-editar]');
        const eliminar = e.target.closest('[data-eliminar]');

        // Editar con modal completo
        if (editar) {
            const t = transacciones.find((x) => x.id === editar.dataset.editar);
            abrirEdicionTransaccion(t, {
                esAdmin: true,
                guardar: async (cambios) => reemplazar(await actualizarTransaccion(t.id, cambios))
            });
        }

        // Eliminar permanentemente de Firestore
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
