/* ==========================================================
   DIÁLOGO PARA MODIFICAR UNA TRANSACCIÓN
   Lo usan "Mis pedidos" (cliente) y el panel (administrador).
   Muestra solo los campos que cada rol puede cambiar; aun así,
   el repositorio vuelve a verificar los permisos al guardar.
   ========================================================== */

import { ESTADOS, SUCURSALES, TIPOS_ENTREGA, NEGOCIO } from '../config/app-config.js';
import { validarEntrega, fechaMinimaEntrega } from '../logica/validaciones.js';
import { dinero, escaparHTML, redondear } from '../logica/formato.js';
import { conCarga, mostrarErroresCampos, limpiarErroresCampos, mostrarToast, mensajeDeError } from './comun.js';
import { opciones } from './plantillas.js';

// guardar: función async que recibe los cambios y llama al repositorio
export function abrirEdicionTransaccion(t, { esAdmin, guardar }) {
    const cerrado = ESTADOS[t.estado].siguientes.length === 0;
    const editaProductos = !cerrado && ['pendiente', 'en_preparacion'].includes(t.estado);
    const estadosPosibles = [t.estado, ...ESTADOS[t.estado].siguientes]
        .map((e) => ({ valor: e, texto: ESTADOS[e].etiqueta }));

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

            <p class="resumen-edicion" data-total aria-live="polite"></p>

            <div class="dialogo__acciones">
                <button type="button" class="boton boton--secundario" data-cerrar>Cancelar</button>
                <button type="submit" class="boton boton--primario">Guardar cambios</button>
            </div>
        </form>`;

    document.body.appendChild(dialogo);
    const form = dialogo.querySelector('form');

    // Lee el formulario y arma solo los cambios que el rol puede enviar
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

    // Vista previa del nuevo total
    function actualizarTotal() {
        if (cerrado) return;
        const cambios = leerCambios();
        form.querySelector('[data-solo-domicilio]').hidden = cambios.entrega.tipo !== 'domicilio';
        const subtotal = cambios.items
            ? cambios.items.reduce((s, item, n) => s + t.items[n].precioUnitario * Math.max(0, item.cantidad || 0), 0)
            : t.subtotal;
        const envio = cambios.entrega.tipo === 'domicilio' ? NEGOCIO.costoEnvio : 0;
        form.querySelector('[data-total]').innerHTML =
            `Nuevo total: <strong>${dinero(redondear(subtotal + envio))}</strong> <span>(antes ${dinero(t.total)})</span>`;
    }

    form.addEventListener('input', actualizarTotal);
    form.addEventListener('change', actualizarTotal);
    dialogo.addEventListener('click', (e) => { if (e.target.closest('[data-cerrar]')) dialogo.close(); });
    dialogo.addEventListener('close', () => dialogo.remove());

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const cambios = leerCambios();

        if (cambios.entrega) {
            const errores = validarEntrega(cambios.entrega, { exigirAnticipacion: !esAdmin });
            if (Object.keys(errores).length) return mostrarErroresCampos(form, errores);
        }
        limpiarErroresCampos(form);

        try {
            await conCarga(form.querySelector('[type="submit"]'), 'Guardando…', () => guardar(cambios));
            mostrarToast(`Pedido ${t.folio} actualizado.`);
            dialogo.close();
        } catch (error) {
            if (error.campos) mostrarErroresCampos(form, error.campos);
            mostrarToast(mensajeDeError(error), 'error');
        }
    });

    actualizarTotal();
    dialogo.showModal();
}
