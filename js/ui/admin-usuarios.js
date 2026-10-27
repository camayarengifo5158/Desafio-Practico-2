/* ==========================================================
   ADMIN · USUARIOS Y ROLES
   ========================================================== */

import { ROLES } from '../config/app-config.js';
import { obtenerUsuarios, cambiarRol } from '../data/usuarios-repo.js';
import { obtenerTransacciones } from '../data/transacciones-repo.js';
import { usuarioActual } from '../data/auth.js';
import { dinero, fecha, escaparHTML, redondear } from '../logica/formato.js';
import { mostrarCargando, mostrarError, mostrarToast, confirmar, mensajeDeError } from './comun.js';
import { opciones } from './plantillas.js';

const tabla = document.querySelector('#tabla-usuarios');

export function iniciar() {
    tabla.addEventListener('change', async (e) => {
        const select = e.target.closest('[data-rol]');
        if (!select) return;
        const rolAnterior = select.dataset.rolActual;
        const ok = await confirmar(`¿Cambiar el rol de ${select.dataset.nombre} a "${select.value}"?`, {
            titulo: 'Cambiar rol', textoAceptar: 'Cambiar'
        });
        if (!ok) { select.value = rolAnterior; return; }

        select.disabled = true;
        try {
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

export async function cargar() {
    mostrarCargando(tabla, 'Cargando usuarios…');
    try {
        const [usuarios, transacciones] = await Promise.all([obtenerUsuarios(), obtenerTransacciones()]);
        pintar(usuarios, transacciones);
    } catch (error) {
        mostrarError(tabla, error, cargar);
    }
}

function pintar(usuarios, transacciones) {
    const yo = usuarioActual();
    const roles = Object.values(ROLES).map((r) => ({ valor: r, texto: r }));

    tabla.removeAttribute('aria-busy');
    tabla.innerHTML = `
        <div class="tabla-desplazable">
            <table class="tabla tabla--responsiva">
                <caption class="visualmente-oculto">Usuarios registrados</caption>
                <thead>
                    <tr><th scope="col">Nombre</th><th scope="col">Correo</th><th scope="col">Registro</th><th scope="col" class="num">Pedidos</th><th scope="col" class="num">Comprado</th><th scope="col">Rol</th></tr>
                </thead>
                <tbody>
                    ${usuarios.map((u) => {
                        const suyas = transacciones.filter((t) => t.clienteId === u.id && t.estado !== 'cancelada');
                        const esYo = u.id === yo.id;
                        return `
                    <tr>
                        <td data-titulo="Nombre">${escaparHTML(u.nombre)}${esYo ? ' <small>(tú)</small>' : ''}</td>
                        <td data-titulo="Correo">${escaparHTML(u.email)}</td>
                        <td data-titulo="Registro">${fecha(u.creadoEn)}</td>
                        <td data-titulo="Pedidos" class="num">${suyas.length}</td>
                        <td data-titulo="Comprado" class="num">${dinero(redondear(suyas.reduce((s, t) => s + t.total, 0)))}</td>
                        <td data-titulo="Rol">
                            <label class="visualmente-oculto" for="rol-${u.id}">Rol de ${escaparHTML(u.nombre)}</label>
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
