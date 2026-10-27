/* ==========================================================
   ADMIN · POSTRES (CRUD del catálogo)
   Crear, consultar, modificar, cambiar disponibilidad y
   eliminar postres. Cada operación llama al repositorio,
   que verifica que el usuario sea administrador.
   ========================================================== */

import { CATEGORIAS, IMAGENES_DISPONIBLES, IMAGEN_POR_DEFECTO } from '../config/app-config.js';
import { obtenerPostres, crearPostre, actualizarPostre, eliminarPostre, cambiarDisponibilidad } from '../data/postres-repo.js';
import { buscarPostres, filtrarPostres, ordenarPostres } from '../logica/procesamiento.js';
import { validarPostre } from '../logica/validaciones.js';
import { dinero, escaparHTML, fechaHora } from '../logica/formato.js';
import {
    mostrarCargando, mostrarVacio, mostrarError, mostrarToast, confirmar, conCarga,
    mostrarErroresCampos, limpiarErroresCampos, mensajeDeError
} from './comun.js';
import { nombreCategoria, imagenPostre, opciones } from './plantillas.js';

const tabla = document.querySelector('#tabla-postres');
const filtros = document.querySelector('#filtros-postres');
const resumen = document.querySelector('#resumen-postres');
const dialogo = document.querySelector('#dialogo-postre');
const form = document.querySelector('#form-postre');
const listaVariantes = document.querySelector('#lista-variantes');
const vistaPrevia = document.querySelector('#vista-previa');

let postres = [];
let editandoId = null; // null = creando uno nuevo

// ---------- Consultar y dibujar ----------

export async function cargar() {
    mostrarCargando(tabla, 'Cargando postres…');
    try {
        postres = await obtenerPostres();
        pintar();
    } catch (error) {
        mostrarError(tabla, error, cargar);
    }
}

function pintar() {
    const f = Object.fromEntries(new FormData(filtros));
    const visibles = ordenarPostres(filtrarPostres(buscarPostres(postres, f.buscar), { categoria: f.categoria }), f.orden);
    resumen.textContent = `${visibles.length} de ${postres.length} postres · ${postres.filter((p) => !p.disponible).length} no disponibles`;

    if (visibles.length === 0) {
        mostrarVacio(tabla, postres.length ? 'Ningún postre coincide con la búsqueda.' : 'El catálogo está vacío.',
            postres.length ? '' : 'Crea el primer postre con el botón “Nuevo postre”.');
        return;
    }
    tabla.removeAttribute('aria-busy');
    tabla.innerHTML = `
        <div class="tabla-desplazable">
            <table class="tabla tabla--responsiva">
                <caption class="visualmente-oculto">Postres del catálogo</caption>
                <thead>
                    <tr>
                        <th scope="col">Postre</th>
                        <th scope="col">Categoría</th>
                        <th scope="col">Precios</th>
                        <th scope="col" class="num">Mínimo</th>
                        <th scope="col">Disponible</th>
                        <th scope="col"><span class="visualmente-oculto">Acciones</span></th>
                    </tr>
                </thead>
                <tbody>
                    ${visibles.map((p) => `
                    <tr>
                        <td data-titulo="Postre">
                            <div class="celda-postre">
                                ${imagenPostre(p, 'celda-postre__img')}
                                <div>
                                    <strong>${escaparHTML(p.nombre)}</strong>
                                    <small>Actualizado ${fechaHora(p.actualizadoEn)}</small>
                                </div>
                            </div>
                        </td>
                        <td data-titulo="Categoría">${escaparHTML(nombreCategoria(p.categoria))}</td>
                        <td data-titulo="Precios">${p.variantes.map((v) => `${escaparHTML(v.nombre)}: ${dinero(v.precio)}`).join('<br>')}</td>
                        <td data-titulo="Mínimo" class="num">${p.minimo}</td>
                        <td data-titulo="Disponible">
                            <label class="interruptor">
                                <input type="checkbox" data-disponible="${p.id}" ${p.disponible ? 'checked' : ''}>
                                <span class="visualmente-oculto">Disponible ${escaparHTML(p.nombre)}</span>
                            </label>
                        </td>
                        <td class="acciones-fila">
                            <button type="button" class="boton boton--secundario boton--pequeno" data-editar="${p.id}">Editar</button>
                            <button type="button" class="boton boton--peligro boton--pequeno" data-eliminar="${p.id}">Eliminar</button>
                        </td>
                    </tr>`).join('')}
                </tbody>
            </table>
        </div>`;
}

// ---------- Formulario: presentaciones dinámicas ----------

function filaVariante({ nombre = '', precio = '' } = {}) {
    const fila = document.createElement('div');
    fila.className = 'fila-variante';
    const id = Math.random().toString(36).slice(2, 7);
    fila.innerHTML = `
        <div class="campo-formulario">
            <label for="var-nombre-${id}">Presentación</label>
            <input type="text" id="var-nombre-${id}" data-variante-nombre value="${escaparHTML(nombre)}" placeholder="Ej. Porción" maxlength="40">
        </div>
        <div class="campo-formulario">
            <label for="var-precio-${id}">Precio ($)</label>
            <input type="number" id="var-precio-${id}" data-variante-precio value="${precio}" min="0.01" step="0.01" placeholder="0.00">
        </div>
        <button type="button" class="boton-icono" data-quitar-variante aria-label="Quitar presentación">✕</button>`;
    listaVariantes.appendChild(fila);
}

function leerFormulario() {
    const datos = new FormData(form);
    return {
        nombre: datos.get('nombre'),
        categoria: datos.get('categoria'),
        descripcion: datos.get('descripcion'),
        imagen: datos.get('imagen'),
        minimo: Number(datos.get('minimo')),
        disponible: datos.get('disponible') === 'on',
        variantes: [...listaVariantes.querySelectorAll('.fila-variante')].map((fila) => ({
            nombre: fila.querySelector('[data-variante-nombre]').value.trim(),
            precio: Number(fila.querySelector('[data-variante-precio]').value)
        }))
    };
}

function actualizarVistaPrevia() {
    vistaPrevia.src = form.imagen.value.trim() || IMAGEN_POR_DEFECTO;
}

function abrirFormulario(postre = null) {
    editandoId = postre?.id || null;
    form.reset();
    limpiarErroresCampos(form);
    listaVariantes.innerHTML = '';
    document.querySelector('#titulo-dialogo-postre').textContent = postre ? `Editar: ${postre.nombre}` : 'Nuevo postre';

    if (postre) {
        form.nombre.value = postre.nombre;
        form.categoria.value = postre.categoria;
        form.descripcion.value = postre.descripcion;
        form.imagen.value = postre.imagen;
        form.minimo.value = postre.minimo;
        form.disponible.checked = postre.disponible;
        postre.variantes.forEach(filaVariante);
    } else {
        filaVariante();
    }
    document.querySelector('#postre-imagen-lista').value = IMAGENES_DISPONIBLES.includes(form.imagen.value) ? form.imagen.value : '';
    document.querySelector('[data-contador-descripcion]').textContent = form.descripcion.value.length;
    actualizarVistaPrevia();
    dialogo.showModal();
    form.nombre.focus();
}

// ---------- Eventos ----------

export function iniciar() {
    // Opciones de los selects
    const categorias = CATEGORIAS.map((c) => ({ valor: c.id, texto: c.nombre }));
    document.querySelector('#categoria-postre').insertAdjacentHTML('beforeend', opciones(categorias));
    form.categoria.innerHTML = `<option value="">Selecciona…</option>${opciones(categorias)}`;
    document.querySelector('#postre-imagen-lista').innerHTML = `<option value="">— Elegir de la carpeta img —</option>${opciones(IMAGENES_DISPONIBLES.map((ruta) => ({ valor: ruta, texto: ruta.replace('img/', '') })))}`;

    filtros.addEventListener('input', pintar);
    filtros.addEventListener('submit', (e) => e.preventDefault());
    document.querySelector('#boton-nuevo-postre').addEventListener('click', () => abrirFormulario());

    document.querySelector('#postre-imagen-lista').addEventListener('change', (e) => {
        if (e.target.value) form.imagen.value = e.target.value;
        actualizarVistaPrevia();
    });
    form.imagen.addEventListener('change', actualizarVistaPrevia);
    vistaPrevia.addEventListener('error', () => { vistaPrevia.src = IMAGEN_POR_DEFECTO; });
    form.descripcion.addEventListener('input', () => {
        document.querySelector('[data-contador-descripcion]').textContent = form.descripcion.value.length;
    });

    document.querySelector('#boton-agregar-variante').addEventListener('click', () => filaVariante());
    listaVariantes.addEventListener('click', (e) => {
        if (!e.target.closest('[data-quitar-variante]')) return;
        if (listaVariantes.children.length === 1) return mostrarToast('El postre necesita al menos una presentación.', 'error');
        e.target.closest('.fila-variante').remove();
    });

    dialogo.addEventListener('click', (e) => { if (e.target.closest('[data-cerrar-dialogo]')) dialogo.close(); });

    // Guardar (crear o actualizar)
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const datos = leerFormulario();
        const errores = validarPostre(datos);
        if (Object.keys(errores).length) return mostrarErroresCampos(form, errores);
        limpiarErroresCampos(form);

        const boton = document.querySelector('#boton-guardar-postre');
        try {
            const guardado = await conCarga(boton, 'Guardando…', () =>
                editandoId ? actualizarPostre(editandoId, datos) : crearPostre(datos)
            );
            mostrarToast(editandoId ? `“${guardado.nombre}” se actualizó.` : `“${guardado.nombre}” se agregó al catálogo.`);
            dialogo.close();
            await cargar();
        } catch (error) {
            if (error.campos) mostrarErroresCampos(form, error.campos);
            mostrarToast(mensajeDeError(error), 'error');
        }
    });

    // Acciones de la tabla (delegación de eventos)
    tabla.addEventListener('click', async (e) => {
        const editar = e.target.closest('[data-editar]');
        const eliminar = e.target.closest('[data-eliminar]');

        if (editar) abrirFormulario(postres.find((p) => p.id === editar.dataset.editar));

        if (eliminar) {
            const postre = postres.find((p) => p.id === eliminar.dataset.eliminar);
            const ok = await confirmar(`“${postre.nombre}” se quitará del catálogo. Los comprobantes ya emitidos no cambian.`, {
                titulo: 'Eliminar postre', textoAceptar: 'Eliminar', peligro: true
            });
            if (!ok) return;
            try {
                await conCarga(eliminar, 'Eliminando…', () => eliminarPostre(postre.id));
                mostrarToast(`“${postre.nombre}” se eliminó.`, 'info');
                await cargar();
            } catch (error) {
                mostrarToast(mensajeDeError(error), 'error');
            }
        }
    });

    tabla.addEventListener('change', async (e) => {
        const casilla = e.target.closest('[data-disponible]');
        if (!casilla) return;
        casilla.disabled = true;
        try {
            const actualizado = await cambiarDisponibilidad(casilla.dataset.disponible, casilla.checked);
            postres = postres.map((p) => (p.id === actualizado.id ? actualizado : p));
            mostrarToast(`“${actualizado.nombre}” ${actualizado.disponible ? 'está disponible' : 'ya no está disponible'}.`, 'info');
            pintar();
        } catch (error) {
            casilla.checked = !casilla.checked; // revierte el cambio visual
            mostrarToast(mensajeDeError(error), 'error');
        } finally {
            casilla.disabled = false;
        }
    });
}
