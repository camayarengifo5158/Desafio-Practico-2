/* ==========================================================
   PÁGINA: COMPROBANTE DE COMPRA
   Lee el folio de la URL (comprobante.html?folio=FRG-00010),
   consulta la transacción (solo su dueño o un admin pueden verla)
   y dibuja el comprobante listo para imprimir o guardar en PDF.
   ========================================================== */

import { obtenerTransaccion } from '../data/transacciones-repo.js';
import { NEGOCIO, TIPOS_ENTREGA } from '../config/app-config.js';
import { dinero, fecha, fechaHora, escaparHTML, redondear } from '../logica/formato.js';
import { iniciarPagina, mostrarCargando, mostrarError, parametroURL } from './comun.js';
import { insigniaEstado, insigniaPago, textoMetodoPago } from './plantillas.js';

const usuario = iniciarPagina({ requiere: 'sesion' });
const contenedor = document.querySelector('#comprobante');
const botonImprimir = document.querySelector('#boton-imprimir');

if (usuario?.rol === 'admin') {
    document.querySelector('.comprobante__acciones a').href = 'admin.html#transacciones';
    document.querySelector('.comprobante__acciones a').textContent = '← Panel de transacciones';
}

function pintarComprobante(t) {
    // Los precios incluyen IVA: se muestra el desglose informativo
    const baseImponible = redondear(t.total / (1 + NEGOCIO.tasaIVA));
    const iva = redondear(t.total - baseImponible);
    const esNuevo = parametroURL('nuevo') === '1';

    document.title = `Comprobante ${t.folio} · Fragola Postres`;
    contenedor.innerHTML = `
        ${esNuevo ? `
        <div class="alerta alerta--exito no-imprimir" role="status">
            <strong>¡Gracias por tu compra!</strong> Tu pedido quedó registrado con el folio ${escaparHTML(t.folio)}.
        </div>` : ''}

        <article class="comprobante" aria-labelledby="titulo-comprobante">
            <header class="comprobante__encabezado">
                <div>
                    <img class="comprobante__logo" src="img/logo-fragola.png" alt="Fragola Postres">
                    <p>Fragola Postres · Repostería artesanal</p>
                    <p>La Mascota &amp; Epic Plaza, San Salvador</p>
                </div>
                <div class="comprobante__folio">
                    <p class="sobretitulo">Comprobante de compra</p>
                    <h1 id="titulo-comprobante">${escaparHTML(t.folio)}</h1>
                    <p>${fechaHora(t.creadaEn)}</p>
                    <p>${insigniaEstado(t.estado)} ${insigniaPago(t.pagado)}</p>
                </div>
            </header>

            <section class="comprobante__datos">
                <div>
                    <h2>Cliente</h2>
                    <p>${escaparHTML(t.clienteNombre)}</p>
                    <p>${escaparHTML(t.clienteEmail)}</p>
                </div>
                <div>
                    <h2>Entrega</h2>
                    <p>${escaparHTML(TIPOS_ENTREGA[t.entrega.tipo])} · ${fecha(t.entrega.fecha)}</p>
                    <p>${t.entrega.tipo === 'domicilio' ? escaparHTML(t.entrega.direccion) : `Sucursal ${escaparHTML(t.entrega.sucursal)}`}</p>
                </div>
                <div>
                    <h2>Pago</h2>
                    <p>${escaparHTML(textoMetodoPago(t.metodoPago))}</p>
                    <p>${t.pagado ? 'Pago recibido' : 'Pendiente de cobro'}</p>
                </div>
            </section>

            <div class="tabla-desplazable">
                <table class="tabla comprobante__tabla">
                    <caption class="visualmente-oculto">Detalle de productos</caption>
                    <thead>
                        <tr><th scope="col">Producto</th><th scope="col">Presentación</th><th scope="col" class="num">Cant.</th><th scope="col" class="num">Precio</th><th scope="col" class="num">Subtotal</th></tr>
                    </thead>
                    <tbody>
                        ${t.items.map((i) => `
                        <tr>
                            <td>${escaparHTML(i.nombre)}</td>
                            <td>${escaparHTML(i.variante)}</td>
                            <td class="num">${i.cantidad}</td>
                            <td class="num">${dinero(i.precioUnitario)}</td>
                            <td class="num">${dinero(i.subtotal)}</td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>

            <section class="comprobante__totales">
                <p><span>Subtotal</span><span>${dinero(t.subtotal)}</span></p>
                <p><span>Envío</span><span>${dinero(t.envio)}</span></p>
                <p class="comprobante__total"><span>Total</span><span>${dinero(t.total)}</span></p>
                <p class="comprobante__iva"><span>IVA (13 %) incluido</span><span>${dinero(iva)}</span></p>
            </section>

            ${t.notas ? `<p class="comprobante__notas"><strong>Notas:</strong> ${escaparHTML(t.notas)}</p>` : ''}

            <footer class="comprobante__pie">
                <p>Comprobante generado por una simulación académica (Desarrollo Web I · ESEN). No tiene validez fiscal.</p>
                <p>Última actualización: ${fechaHora(t.actualizadaEn)}</p>
            </footer>
        </article>`;
    botonImprimir.disabled = false;
}

async function cargar() {
    const folio = parametroURL('folio');
    if (!folio) {
        mostrarError(contenedor, new Error('No se indicó qué comprobante mostrar.'));
        return;
    }
    mostrarCargando(contenedor, 'Generando comprobante…');
    try {
        pintarComprobante(await obtenerTransaccion(folio));
    } catch (error) {
        mostrarError(contenedor, error);
    }
}

botonImprimir.addEventListener('click', () => window.print());

if (usuario) cargar();
