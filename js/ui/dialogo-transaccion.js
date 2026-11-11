/* ==========================================================
   MODAL DE EDICIÓN DE PEDIDOS (Capa UI)
   Archivo: js/ui/dialogo-transaccion.js
   ----------------------------------------------------------
   ¿Para qué sirve este archivo?
   Es la ventana emergente modal que se abre cuando un cliente o
   el administrador presiona el botón "Modificar pedido".

   Inteligencia contextual según el rol y el estado del pedido:
   1. Si el pedido ya está cerrado (Entregado o Cancelado):
      Solo permite modificar las notas de observación.
   2. Si es Administrador:
      Tiene acceso a cambiar el estado del pedido (solo mostrando los
      siguientes estados legales según la máquina de estados) y marcar
      si el pago fue recibido.
   3. Si es Cliente:
      Puede cambiar la sucursal, la fecha (respetando las 48h de anticipación),
      la dirección y las cantidades de sus postres MIENTRAS la orden
      siga en estado "Pendiente" o "En preparación".
   4. Recálculo en vivo:
      Mientras el usuario sube o baja cantidades de postres o cambia
      entre "retiro" y "domicilio", el modal recalcula el total en tiempo
      real en pantalla antes de guardar.
   ========================================================== */

// Importamos los estados válidos, sucursales y costos del negocio
import { ESTADOS, SUCURSALES, TIPOS_ENTREGA, NEGOCIO } from '../config/app-config.js';

// Traemos las reglas de validación de entrega y la fecha mínima permitida
import { validarEntrega, fechaMinimaEntrega } from '../logica/validaciones.js';

// Traemos formateadores de moneda, sanitizador XSS y redondeo
import { dinero, escaparHTML, redondear } from '../logica/formato.js';

// Traemos utilidades de interfaz: spinner en botón, errores en campos, toasts y traducción de errores
import { conCarga, mostrarErroresCampos, limpiarErroresCampos, mostrarToast, mensajeDeError } from './comun.js';

// Traemos el generador de etiquetas <option>
import { opciones } from './plantillas.js';

/* ----------------------------------------------------------
   abrirEdicionTransaccion(t, { esAdmin, guardar })
   ¿Para qué sirve?
   Construye, inyecta en el DOM y abre el diálogo modal `<dialog>`.
   - `t`: el objeto completo de la transacción a editar.
   - `esAdmin`: booleano que indica si quien abre es administrador.
   - `guardar`: función asíncrona que llamará a `actualizarTransaccion()` en el repositorio.
   ---------------------------------------------------------- */
export function abrirEdicionTransaccion(t, { esAdmin, guardar }) {
    // 1. Evaluamos si el pedido ya está en un estado final sin retorno (Entregado o Cancelado)
    const cerrado = ESTADOS[t.estado].siguientes.length === 0;

    // 2. Evaluamos si aún es legal modificar productos (solo en cocina inicial)
    const editaProductos = !cerrado && ['pendiente', 'en_preparacion'].includes(t.estado);

    // 3. Calculamos únicamente los estados a los que legalmente se puede avanzar desde el actual
    const estadosPosibles = [t.estado, ...ESTADOS[t.estado].siguientes]
        .map((e) => ({ valor: e, texto: ESTADOS[e].etiqueta }));

    // 4. Creamos el elemento nativo <dialog>
    const dialogo = document.createElement('dialog');
    dialogo.className = 'dialogo';
    dialogo.setAttribute('aria-labelledby', 'titulo-edicion');
    
    dialogo.innerHTML = `
        <form class="dialogo__cuerpo" novalidate>
            <header class="dialogo__encabezado">
                <h2 class="dialogo__titulo" id="titulo-edicion">Modificar ${escaparHTML(t.folio)}</h2>
                <button type="button" class="boton-icono" data-cerrar aria-label="Cerrar">✕</button>
            </header>
            
            ${cerrado ? `<p class="alerta alerta--info">Este pedido está "${ESTADOS[t.estado].etiqueta}". Solo puedes editar las notas.</p>` : ''}

            <!-- Sección de seguimiento: Solo visible para Administradores -->
            ${esAdmin && !cerrado ? `
            <fieldset class="grupo-campos">
                <legend>Seguimiento</legend>
                <div class="fila-campos">
                    <div class="campo-formulario">
                        <label for="ed-estado">Estado</label>
                        <select id="ed-estado" name="estado">${opciones(estadosPosibles, t.estado)}</select>
                    </div>
                    <label class="casilla casilla--campo">
                        <input type="checkbox" name="pagado" ${t.pagado ? 'checked' : ''}> Pago recibido
                    </label>
                </div>
            </fieldset>` : ''}

            <!-- Sección de entrega: Visible para todos mientras el pedido esté activo -->
            ${!cerrado ? `
            <fieldset class="grupo-campos">
                <legend>Entrega</legend>
                <div class="fila-campos">
                    <div class="campo-formulario">
                        <label for="ed-tipo">Tipo</label>
                        <select id="ed-tipo" name="tipo">${opciones(Object.entries(TIPOS_ENTREGA).map(([valor, texto]) => ({ valor, texto })), t.entrega.tipo)}</select>
                    </div>
                    <div class="campo-formulario">
                        <label for="ed-sucursal">Sucursal</label>
                        <select id="ed-sucursal" name="sucursal">${opciones(SUCURSALES.map((s) => ({ valor: s, texto: s })), t.entrega.sucursal)}</select>
                    </div>
                    <div class="campo-formulario">
                        <label for="ed-fecha">Fecha</label>
                        <input type="date" id="ed-fecha" name="fecha" value="${escaparHTML(t.entrega.fecha)}" ${esAdmin ? '' : `min="${fechaMinimaEntrega()}"`}>
                    </div>
                </div>
                <div class="campo-formulario" data-solo-domicilio ${t.entrega.tipo === 'domicilio' ? '' : 'hidden'}>
                    <label for="ed-direccion">Dirección</label>
                    <textarea id="ed-direccion" name="direccion" rows="2" maxlength="200">${escaparHTML(t.entrega.direccion)}</textarea>
                </div>
            </fieldset>` : ''}

            <!-- Sección de productos: Permite ajustar unidades conservando el precio pactado -->
            ${editaProductos ? `
            <fieldset class="grupo-campos">
                <legend>Productos</legend>
                <p class="ayuda-campo">Cambia la cantidad o escribe 0 para quitar un producto. Se conserva el precio con el que se compró.</p>
                <div class="lineas-edicion">
                    ${t.items.map((i, n) => `
                    <div class="linea-edicion">
                        <label for="ed-item-${n}">${escaparHTML(i.nombre)} <small>(${escaparHTML(i.variante)} · ${dinero(i.precioUnitario)})</small></label>
                        <input type="number" id="ed-item-${n}" min="0" step="1" value="${i.cantidad}" data-item="${n}">
                    </div>`).join('')}
                </div>
            </fieldset>` : ''}

            <div class="campo-formulario">
                <label for="ed-notas">Notas</label>
                <textarea id="ed-notas" name="notas" rows="2" maxlength="250">${escaparHTML(t.notas)}</textarea>
            </div>

            <!-- Resumen numérico reactivo que cambia mientras el usuario escribe -->
            <p class="resumen-edicion" data-total aria-live="polite"></p>

            <div class="dialogo__acciones">
                <button type="button" class="boton boton--secundario" data-cerrar>Cancelar</button>
                <button type="submit" class="boton boton--primario">Guardar cambios</button>
            </div>
        </form>`;

    document.body.appendChild(dialogo);
    const form = dialogo.querySelector('form');

    /* ----------------------------------------------------------
       leerCambios()
       Extrae únicamente los datos que el usuario actual tiene derecho a enviar.
       ---------------------------------------------------------- */
    function leerCambios() {
        const cambios = { notas: form.notas.value };
        if (cerrado) return cambios;
        
        cambios.entrega = {
            tipo: form.tipo.value,
            sucursal: form.sucursal.value,
            fecha: form.fecha.value,
            direccion: form.direccion.value
        };
        
        if (esAdmin) {
            cambios.estado = form.estado.value;
            cambios.pagado = form.pagado.checked;
        }
        
        if (editaProductos) {
            cambios.items = t.items.map((item, n) => ({
                postreId: item.postreId,
                variante: item.variante,
                cantidad: Number(form.querySelector(`[data-item="${n}"]`).value)
            }));
        }
        return cambios;
    }

    /* ----------------------------------------------------------
       actualizarTotal()
       Calcula y pinta en vivo el nuevo total proyectado de la orden.
       Muestra la comparación: "Nuevo total: $45.00 (antes $38.00)".
       ---------------------------------------------------------- */
    function actualizarTotal() {
        if (cerrado) return;
        const cambios = leerCambios();
        
        // Muestra u oculta la caja de dirección según si eligió domicilio o retiro
        form.querySelector('[data-solo-domicilio]').hidden = cambios.entrega.tipo !== 'domicilio';
        
        const subtotal = cambios.items
            ? cambios.items.reduce((s, item, n) => s + t.items[n].precioUnitario * Math.max(0, item.cantidad || 0), 0)
            : t.subtotal;
            
        const envio = cambios.entrega.tipo === 'domicilio' ? NEGOCIO.costoEnvio : 0;
        
        form.querySelector('[data-total]').innerHTML =
            `Nuevo total: <strong>${dinero(redondear(subtotal + envio))}</strong> <span>(antes ${dinero(t.total)})</span>`;
    }

    // Escuchadores de eventos para recálculo automático
    form.addEventListener('input', actualizarTotal);
    form.addEventListener('change', actualizarTotal);
    
    // Cierre del modal al presionar Cancelar o la X
    dialogo.addEventListener('click', (e) => { 
        if (e.target.closest('[data-cerrar]')) dialogo.close(); 
    });
    // Destruye el elemento del DOM al cerrarse para liberar memoria
    dialogo.addEventListener('close', () => dialogo.remove());

    // Envío del formulario
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const cambios = leerCambios();

        // Validamos la entrega en el cliente antes de llamar a Firestore
        if (cambios.entrega) {
            const errores = validarEntrega(cambios.entrega, { exigirAnticipacion: !esAdmin });
            if (Object.keys(errores).length) return mostrarErroresCampos(form, errores);
        }
        limpiarErroresCampos(form);

        try {
            // Ejecutamos con protección contra doble clic
            await conCarga(form.querySelector('[type="submit"]'), 'Guardando…', () => guardar(cambios));
            mostrarToast(`Pedido ${t.folio} actualizado.`);
            dialogo.close();
        } catch (error) {
            // Si el servidor o repositorio reportó errores en campos específicos
            if (error.campos) mostrarErroresCampos(form, error.campos);
            mostrarToast(mensajeDeError(error), 'error');
        }
    });

    // Pintamos el total inicial y mostramos el modal en pantalla
    actualizarTotal();
    dialogo.showModal();
}
