/* ==========================================================
   SUBMÓDULO: GESTIÓN DE USUARIOS Y ROLES (Capa UI / Admin)
   Archivo: js/ui/admin-usuarios.js
   ----------------------------------------------------------
   ¿Para qué sirve este archivo?
   Es el panel de administración de cuentas de la pastelería.
   Permite al Administrador:
   1. Ver el listado completo de clientes y administradores registrados en Firestore.
   2. Ver las estadísticas comerciales de cada cliente:
      - Cuántos pedidos válidos ha realizado en la historia de la tienda.
      - Cuánto dinero total ha gastado en pasteles.
   3. Cambiar el rol de un usuario (ascender a 'admin' o descender a 'cliente')
      con un selector directo y confirmación obligatoria.
   4. Protección de auto-bloqueo:
      El selector de rol del administrador actual aparece deshabilitado
      (`esYo ? 'disabled' : ''`) para evitar que se degrade a sí mismo por error
      y deje la tienda sin administradores.
   ========================================================== */

// Importamos el enum de roles ('admin', 'cliente')
import { ROLES } from '../config/app-config.js';

// Importamos las operaciones del repositorio de usuarios en Firestore
import { obtenerUsuarios, cambiarRol } from '../data/usuarios-repo.js';

// Importamos las transacciones para calcular el gasto histórico de cada cliente
import { obtenerTransacciones } from '../data/transacciones-repo.js';

// Traemos el usuario actualmente autenticado
import { usuarioActual } from '../data/auth.js';

// Traemos formateadores de moneda, fechas, sanitizador XSS y redondeo
import { dinero, fecha, escaparHTML, redondear } from '../logica/formato.js';

// Traemos herramientas de interfaz (spinner, modales de confirmación, toasts y errores)
import { mostrarCargando, mostrarError, mostrarToast, confirmar, mensajeDeError } from './comun.js';

// Traemos el generador de etiquetas <option>
import { opciones } from './plantillas.js';

// Referencia a la tabla de usuarios en el DOM
const tabla = document.querySelector('#tabla-usuarios');

/* ----------------------------------------------------------
   iniciar()
   Configura el escuchador de cambios de rol con confirmación.
   ---------------------------------------------------------- */
export function iniciar() {
    tabla.addEventListener('change', async (e) => {
        const select = e.target.closest('[data-rol]');
        if (!select) return;

        const rolAnterior = select.dataset.rolActual;
        // Pedimos confirmación al administrador antes de alterar permisos
        const ok = await confirmar(`¿Cambiar el rol de ${select.dataset.nombre} a "${select.value}"?`, {
            titulo: 'Cambiar rol', textoAceptar: 'Cambiar'
        });
        
        // Si cancela, revertimos el select al rol anterior
        if (!ok) { 
            select.value = rolAnterior; 
            return; 
        }

        select.disabled = true;
        try {
            // Actualizamos en Cloud Firestore
            const u = await cambiarRol(select.dataset.rol, select.value);
            mostrarToast(`${u.nombre} ahora es ${u.rol}.`);
            await cargar();
        } catch (error) {
            select.value = rolAnterior;
            select.disabled = false;
            mostrarToast(mensajeDeError(error), 'error');
        }
    });
}

/* ----------------------------------------------------------
   cargar()
   Descarga en paralelo los usuarios y las transacciones para
   poder correlacionar cuántos pedidos tiene cada cliente.
   ---------------------------------------------------------- */
export async function cargar() {
    mostrarCargando(tabla, 'Cargando usuarios…');
    try {
        const [usuarios, transacciones] = await Promise.all([obtenerUsuarios(), obtenerTransacciones()]);
        pintar(usuarios, transacciones);
    } catch (error) {
        mostrarError(tabla, error, cargar);
    }
}

/* ----------------------------------------------------------
   pintar(usuarios, transacciones)
   Genera la tabla responsiva de usuarios:
   - Cruza cada usuario con sus pedidos en `transacciones`.
   - Identifica con "(tú)" al administrador conectado y desactiva su selector.
   - Pinta nombre, correo, fecha de registro, cantidad de compras y gasto total.
   ---------------------------------------------------------- */
function pintar(usuarios, transacciones) {
    const yo = usuarioActual();
    const roles = Object.values(ROLES).map((r) => ({ valor: r, texto: r }));

    tabla.removeAttribute('aria-busy');
    
    tabla.innerHTML = `
        <div class="tabla-desplazable">
            <table class="tabla tabla--responsiva">
                <caption class="visualmente-oculto">Usuarios registrados</caption>
                <thead>
                    <tr>
                        <th scope="col">Nombre</th>
                        <th scope="col">Correo</th>
                        <th scope="col">Registro</th>
                        <th scope="col" class="num">Pedidos</th>
                        <th scope="col" class="num">Comprado</th>
                        <th scope="col">Rol</th>
                    </tr>
                </thead>
                <tbody>
                    ${usuarios.map((u) => {
                        // Filtramos las órdenes válidas que pertenecen a este cliente
                        const suyas = transacciones.filter((t) => t.clienteId === u.id && t.estado !== 'cancelada');
                        const esYo = u.id === yo.id;
                        
                        return `
                    <tr>
                        <td data-titulo="Nombre">
                            ${escaparHTML(u.nombre)}${esYo ? ' <small>(tú)</small>' : ''}
                        </td>
                        <td data-titulo="Correo">${escaparHTML(u.email)}</td>
                        <td data-titulo="Registro">${fecha(u.creadoEn)}</td>
                        <td data-titulo="Pedidos" class="num">${suyas.length}</td>
                        <td data-titulo="Comprado" class="num">${dinero(redondear(suyas.reduce((s, t) => s + t.total, 0)))}</td>
                        <td data-titulo="Rol">
                            <label class="visualmente-oculto" for="rol-${u.id}">Rol de ${escaparHTML(u.nombre)}</label>
                            <!-- El admin no puede cambiar su propio rol para no quedarse fuera -->
                            <select id="rol-${u.id}" data-rol="${u.id}" data-rol-actual="${u.rol}" data-nombre="${escaparHTML(u.nombre)}" ${esYo ? 'disabled title="No puedes cambiar tu propio rol"' : ''}>
                                ${opciones(roles, u.rol)}
                            </select>
                        </td>
                    </tr>`;
                    }).join('')}
                </tbody>
            </table>
        </div>`;
}
