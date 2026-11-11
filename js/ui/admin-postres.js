/* ==========================================================
   SUBMÓDULO: CRUD DE POSTRES (Capa UI / Admin)
   Archivo: js/ui/admin-postres.js
   ----------------------------------------------------------
   ¿Para qué sirve este archivo?
   Es el panel de administración del catálogo de repostería.
   Permite al Administrador gestionar las 4 operaciones fundamentales (CRUD):
   
   1. Create (Crear): Agregar nuevos postres con fotos, categorías, descripciones,
      mínimos de compra y múltiples presentaciones dinámicas (porción vs entero).
   2. Read (Consultar): Ver la tabla completa con búsqueda en tiempo real,
      filtros por categoría y ordenamiento.
   3. Update (Modificar): Editar cualquier postre existente y cambiar su disponibilidad
      al instante mediante un interruptor rápido (toggle).
   4. Delete (Eliminar): Borrar permanentemente un postre de Google Cloud Firestore
      con confirmación de seguridad previa.
   ========================================================== */

// Importamos la lista de categorías, fotos locales predefinidas y la foto de respaldo
import { CATEGORIAS, IMAGENES_DISPONIBLES, IMAGEN_POR_DEFECTO } from '../config/app-config.js';

// Importamos las operaciones del repositorio de postres en Firestore
import { obtenerPostres, crearPostre, actualizarPostre, eliminarPostre, cambiarDisponibilidad } from '../data/postres-repo.js';

// Traemos funciones puras para buscar, filtrar y ordenar arreglos
import { buscarPostres, filtrarPostres, ordenarPostres } from '../logica/procesamiento.js';

// Traemos las reglas de validación del formulario de postres
import { validarPostre } from '../logica/validaciones.js';

// Traemos formateadores de moneda, sanitizador XSS y fecha-hora
import { dinero, escaparHTML, fechaHora } from '../logica/formato.js';

// Traemos herramientas comunes de interfaz (toasts, spinner, modal de confirmación, manejo de errores)
import {
    mostrarCargando, mostrarVacio, mostrarError, mostrarToast, confirmar, conCarga,
    mostrarErroresCampos, limpiarErroresCampos, mensajeDeError
} from './comun.js';

// Traemos plantillas visuales de categorías, fotos y opciones de select
import { nombreCategoria, imagenPostre, opciones } from './plantillas.js';

// Referencias a los elementos del DOM
const tabla = document.querySelector('#tabla-postres');
const filtros = document.querySelector('#filtros-postres');
const resumen = document.querySelector('#resumen-postres');
const dialogo = document.querySelector('#dialogo-postre');
const form = document.querySelector('#form-postre');
const listaVariantes = document.querySelector('#lista-variantes');
const vistaPrevia = document.querySelector('#vista-previa');

// Variables de estado local en memoria
let postres = [];
let editandoId = null; // null = creando postre nuevo; string = editando postre existente

// ==========================================================
// 1. CARGA Y VISUALIZACIÓN DE LA TABLA DE POSTRES
// ==========================================================

/* ----------------------------------------------------------
   cargar()
   Descarga todos los postres desde Firestore y los pinta en la tabla.
   ---------------------------------------------------------- */
export async function cargar() {
    mostrarCargando(tabla, 'Cargando postres…');
    try {
        postres = await obtenerPostres();
        pintar();
    } catch (error) {
        mostrarError(tabla, error, cargar);
    }
}

/* ----------------------------------------------------------
   pintar()
   Aplica los filtros de texto y categoría a los postres en memoria,
   actualiza el conteo general y genera la tabla responsiva con sus
   respectivos interruptores de disponibilidad y botones de acción.
   ---------------------------------------------------------- */
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
                            <!-- Interruptor interactivo rápido -->
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

// ==========================================================
// 2. FORMULARIO DE POSTRES Y PRESENTACIONES DINÁMICAS
// ==========================================================

/* ----------------------------------------------------------
   filaVariante({ nombre, precio })
   ¿Para qué sirve?
   Agrega una fila interactiva para definir una presentación de precio.
   Permite que un postre tenga múltiples precios
   (ej: Porción $5.50, Entero $42.00, Caja de 6 $18.00).
   ---------------------------------------------------------- */
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

/* ----------------------------------------------------------
   leerFormulario()
   Extrae todos los campos del modal de postre, incluyendo el arreglo
   dinámico de presentaciones y precios.
   ---------------------------------------------------------- */
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

/* ----------------------------------------------------------
   actualizarVistaPrevia()
   Muestra la foto en miniatura en vivo mientras se escribe la URL.
   ---------------------------------------------------------- */
function actualizarVistaPrevia() {
    vistaPrevia.src = form.imagen.value.trim() || IMAGEN_POR_DEFECTO;
}

/* ----------------------------------------------------------
   abrirFormulario(postre)
   ¿Para qué sirve?
   Abre el modal para crear o editar:
   - Si `postre === null`: Modo creación (limpia los campos y pone "Nuevo postre").
   - Si `postre !== null`: Modo edición (llena los campos con los datos del postre).
   ---------------------------------------------------------- */
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
        filaVariante(); // Al crear, ponemos al menos una fila vacía
    }
    
    // Si la imagen coincide con una local, la seleccionamos en el combo
    document.querySelector('#postre-imagen-lista').value = IMAGENES_DISPONIBLES.includes(form.imagen.value) ? form.imagen.value : '';
    document.querySelector('[data-contador-descripcion]').textContent = form.descripcion.value.length;
    actualizarVistaPrevia();
    dialogo.showModal();
    form.nombre.focus();
}

// ==========================================================
// 3. INICIALIZACIÓN DE EVENTOS DEL MÓDULO DE POSTRES
// ==========================================================
export function iniciar() {
    // 1. Llenamos los menús desplegables de categorías e imágenes locales
    const categorias = CATEGORIAS.map((c) => ({ valor: c.id, texto: c.nombre }));
    document.querySelector('#categoria-postre').insertAdjacentHTML('beforeend', opciones(categorias));
    form.categoria.innerHTML = `<option value="">Selecciona…</option>${opciones(categorias)}`;
    document.querySelector('#postre-imagen-lista').innerHTML = `<option value="">— Elegir de la carpeta img —</option>${opciones(IMAGENES_DISPONIBLES.map((ruta) => ({ valor: ruta, texto: ruta.replace('img/', '') })))}`;

    // 2. Filtros de búsqueda en la tabla
    filtros.addEventListener('input', pintar);
    filtros.addEventListener('submit', (e) => e.preventDefault());
    
    // 3. Botón "Nuevo postre"
    document.querySelector('#boton-nuevo-postre').addEventListener('click', () => abrirFormulario());

    // 4. Selector rápido de imágenes locales y vista previa reactiva
    document.querySelector('#postre-imagen-lista').addEventListener('change', (e) => {
        if (e.target.value) form.imagen.value = e.target.value;
        actualizarVistaPrevia();
    });
    form.imagen.addEventListener('change', actualizarVistaPrevia);
    vistaPrevia.addEventListener('error', () => { vistaPrevia.src = IMAGEN_POR_DEFECTO; });
    
    // 5. Contador en vivo de caracteres de la descripción
    form.descripcion.addEventListener('input', () => {
        document.querySelector('[data-contador-descripcion]').textContent = form.descripcion.value.length;
    });

    // 6. Botones para agregar o quitar presentaciones
    document.querySelector('#boton-agregar-variante').addEventListener('click', () => filaVariante());
    listaVariantes.addEventListener('click', (e) => {
        if (!e.target.closest('[data-quitar-variante]')) return;
        if (listaVariantes.children.length === 1) {
            return mostrarToast('El postre necesita al menos una presentación.', 'error');
        }
        e.target.closest('.fila-variante').remove();
    });

    dialogo.addEventListener('click', (e) => { 
        if (e.target.closest('[data-cerrar-dialogo]')) dialogo.close(); 
    });

    // 7. Guardar postre (Crear o Modificar)
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const datos = leerFormulario();
        
        // Validación en cliente
        const errores = validarPostre(datos);
        if (Object.keys(errores).length) return mostrarErroresCampos(form, errores);
        limpiarErroresCampos(form);

        const boton = document.querySelector('#boton-guardar-postre');
        try {
            // Guarda en Cloud Firestore con spinner
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

    // 8. Acciones de la tabla: Editar y Eliminar (Delegación de Eventos)
    tabla.addEventListener('click', async (e) => {
        const editar = e.target.closest('[data-editar]');
        const eliminar = e.target.closest('[data-eliminar]');

        // Editar
        if (editar) {
            abrirFormulario(postres.find((p) => p.id === editar.dataset.editar));
        }

        // Eliminar
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

    // 9. Interruptor rápido de disponibilidad (Toggle en la tabla)
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
            // Si Firestore rebotó el cambio, revertimos la casilla visualmente
            casilla.checked = !casilla.checked;
            mostrarToast(mensajeDeError(error), 'error');
        } finally {
            casilla.disabled = false;
        }
    });
}
