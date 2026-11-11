/* ==========================================================
   PÁGINA: COMPROBANTE OFICIAL DE COMPRA (Capa UI)
   Archivo: js/ui/pagina-comprobante.js
   ----------------------------------------------------------
   ¿Para qué sirve este archivo?
   Es el generador de la "factura o recibo digital" de la pastelería.
   Se abre automáticamente tras finalizar una compra o cuando el cliente
   o el administrador hacen clic en "Ver comprobante".

   ¿Cómo funciona?
   1. Lee el código de folio desde la URL (ej: `comprobante.html?folio=FRG-48192`).
   2. Consulta a Firestore mediante `obtenerTransaccion(folio)`.
      (Las reglas de seguridad se aseguran de que solo el cliente dueño
      o un administrador puedan ver este documento).
   3. Realiza el desglose financiero del IVA del 13% de El Salvador.
   4. Construye una factura elegante y lista para impresión en papel o PDF
      usando los estilos para impresora (`@media print` y `window.print()`).
   ========================================================== */

// Importamos la función para buscar pedidos por ID o por Folio
import { obtenerTransaccion } from '../data/transacciones-repo.js';

// Importamos constantes de negocio (tasa del 13% de IVA y tipos de entrega)
import { NEGOCIO, TIPOS_ENTREGA } from '../config/app-config.js';

// Traemos formateadores de dinero, fechas, sanitizador XSS y redondeo
import { dinero, fecha, fechaHora, escaparHTML, redondear } from '../logica/formato.js';

// Traemos herramientas de inicialización de página y manejo de estados
import { iniciarPagina, mostrarCargando, mostrarError, parametroURL } from './comun.js';

// Traemos las plantillas de insignias de colores y nombres de método de pago
import { insigniaEstado, insigniaPago, textoMetodoPago } from './plantillas.js';

// Guardia de seguridad: Se exige sesión activa para ver comprobantes
const usuario = iniciarPagina({ requiere: 'sesion' });
const contenedor = document.querySelector('#comprobante');
const botonImprimir = document.querySelector('#boton-imprimir');

// Adaptamos el botón de volver según el rol de la persona:
// - Si es administrador, lo devuelve a la tabla de transacciones del panel.
// - Si es cliente, lo devuelve a su lista de "Mis Pedidos".
if (usuario?.rol === 'admin') {
    document.querySelector('.comprobante__acciones a').href = 'admin.html#transacciones';
    document.querySelector('.comprobante__acciones a').textContent = '← Panel de transacciones';
}

/* ----------------------------------------------------------
   pintarComprobante(t)
   ¿Para qué sirve?
   Renderiza la estructura completa del comprobante:
   1. Desglose del IVA (13% en El Salvador):
      Como los precios de Fragola ya tienen el impuesto incluido,
      calculamos la base imponible (`total / 1.13`) y el monto del IVA (`total - base`).
   2. Si la URL incluye `?nuevo=1`, muestra un banner verde de felicitación
      ("¡Gracias por tu compra!").
   3. Encabezado con logotipo, folio destacado y fecha.
   4. Bloques de información: datos del cliente, método de entrega y de pago.
   5. Tabla de productos con cantidades, precios unitarios y subtotales.
   6. Totales finales y advertencia académica de validez fiscal.
   ---------------------------------------------------------- */
function pintarComprobante(t) {
    // Matemática fiscal: desglose del 13% de IVA salvadoreño
    const baseImponible = redondear(t.total / (1 + NEGOCIO.tasaIVA));
    const iva = redondear(t.total - baseImponible);
    
    // Si viene recién saliendo del proceso de compra
    const esNuevo = parametroURL('nuevo') === '1';

    // Cambiamos el título de la pestaña del navegador para que al imprimir/guardar en PDF salga con este nombre
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
                        <tr>
                            <th scope="col">Producto</th>
                            <th scope="col">Presentación</th>
                            <th scope="col" class="num">Cant.</th>
                            <th scope="col" class="num">Precio</th>
                            <th scope="col" class="num">Subtotal</th>
                        </tr>
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
        
    // Habilitamos el botón de imprimir una vez el comprobante esté dibujado
    botonImprimir.disabled = false;
}

/* ----------------------------------------------------------
   cargar()
   Lee el parámetro `folio` de la barra de direcciones y
   solicita la orden a Firestore.
   ---------------------------------------------------------- */
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

// Conectamos el botón de imprimir con la orden nativa del navegador
botonImprimir.addEventListener('click', () => window.print());

// Si el usuario tiene sesión, cargamos el comprobante
if (usuario) {
    cargar();
}
