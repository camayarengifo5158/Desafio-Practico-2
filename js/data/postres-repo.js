/* ==========================================================
   REPOSITORIO DE POSTRES (Capa de Datos / Persistencia)
   Archivo: js/data/postres-repo.js
   ----------------------------------------------------------
   ¿Para qué sirve este archivo?
   Es el "encargado de bodega" de todos los postres. Cada vez que
   la tienda necesita ver qué postres hay, agregar uno nuevo,
   cambiarle el precio o apagarlo porque se agotó, habla con
   este archivo.

   Aquí nos conectamos directamente con la base de datos en la
   nube de Google (Cloud Firestore), en la colección llamada
   "postres". Todo lo que se guarde aquí se queda guardado para
   siempre en los servidores de Google, visible al instante para
   cualquier cliente que entre a la web.
   ========================================================== */

// Traemos los roles permitidos (para saber quién es admin)
import { ROLES } from '../config/app-config.js';

// Traemos las herramientas oficiales del SDK de Firebase Firestore:
// - db: la conexión viva con nuestra base de datos en la nube
// - collection: para apuntar a una "carpeta" o tabla (ej: 'postres')
// - doc: para apuntar a un documento específico dentro de una colección
// - getDocs: para traerse todos los documentos de una colección
// - getDoc: para traerse un solo documento por su ID
// - setDoc: para guardar o sobreescribir un documento con un ID que nosotros definimos
// - updateDoc: para modificar solo ciertos campos de un documento sin borrar los demás
// - deleteDoc: para borrar un documento para siempre
import { 
    db, 
    collection, 
    getDocs, 
    getDoc, 
    doc, 
    setDoc, 
    updateDoc, 
    deleteDoc 
} from '../config/firebase.js';

// Traemos el guardia de seguridad: revisa si el usuario actual tiene permiso de administrador
import { requerirRol } from './auth.js';

// Traemos la función que revisa que los datos del postre cumplan las reglas (nombre no vacío, precio > 0, etc.)
import { validarPostre } from '../logica/validaciones.js';

// Traemos la función de redondeo para que los centavos nunca tengan decimales infinitos raros (ej. 4.7500000001)
import { redondear } from '../logica/formato.js';

/* ----------------------------------------------------------
   FUNCIÓN AUXILIAR: normalizarPostre(datos)
   ¿Por qué existe?
   A veces la gente escribe en los formularios con espacios de más
   (ej. "  Cheesecake  ") o deja campos en blanco. Esta función
   "limpia y peina" los datos antes de que toquen la base de datos.
   Garantiza que el nombre sea texto limpio, que cada variante tenga
   su precio redondeado a 2 decimales y que el mínimo sea un número real.
   ---------------------------------------------------------- */
function normalizarPostre(datos) {
    return {
        // Quitamos espacios antes y después del nombre
        nombre: String(datos.nombre ?? '').trim(),
        // Guardamos la categoría tal cual (ej. 'tartas', 'galletas')
        categoria: datos.categoria,
        // Limpiamos la descripción
        descripcion: String(datos.descripcion ?? '').trim(),
        // Limpiamos la ruta o URL de la imagen
        imagen: String(datos.imagen ?? '').trim(),
        // Recorremos cada presentación (ej: "Porción", "Entero") y redondeamos su precio
        variantes: (datos.variantes || []).map((v) => ({
            nombre: String(v.nombre ?? '').trim(),
            precio: redondear(v.precio)
        })),
        // Si no pusieron mínimo de compra o escribieron algo raro, por defecto es 1 unidad
        minimo: Number(datos.minimo) || 1,
        // Convertimos a booleano estricto (true o false) para saber si está a la venta
        disponible: Boolean(datos.disponible)
    };
}

/* ----------------------------------------------------------
   FUNCIÓN AUXILIAR: errorDeValidacion(errores)
   Crea un objeto Error pero le pega una propiedad especial
   `.campos` con el desglose de qué cajita del formulario falló.
   Así la pantalla puede pintar en rojo exactamente la cajita
   culpable y mostrarle el mensajito al usuario.
   ---------------------------------------------------------- */
function errorDeValidacion(errores) {
    const error = new Error('Revisa los campos marcados.');
    error.campos = errores;
    return error;
}

// ==========================================================
// OPERACIONES DE LECTURA (Cualquiera puede consultar el catálogo)
// ==========================================================

/* ----------------------------------------------------------
   obtenerPostres()
   ¿Para qué sirve?
   Va a Firestore, abre la colección 'postres' y se trae todos
   los que existan. Es la función que alimenta la página del
   catálogo de la pastelería y la tabla de postres del admin.
   ---------------------------------------------------------- */
export async function obtenerPostres() {
    // getDocs hace la petición a Google Firestore y nos devuelve una "instantánea" (snapshot)
    const snap = await getDocs(collection(db, 'postres'));
    const postres = [];
    
    // Recorremos cada documento que Firestore nos devolvió
    // d.id es el código único (ej: 'pst_paleo_choco')
    // d.data() son los campos reales (nombre, precio, foto, etc.)
    snap.forEach((d) => postres.push({ id: d.id, ...d.data() }));
    
    return postres;
}

/* ----------------------------------------------------------
   obtenerPostre(id)
   ¿Para qué sirve?
   Busca un postre específico usando su ID único en Firestore.
   Si alguien borró el postre mientras otra persona lo estaba
   viendo o el link está mal escrito, avisa con un error claro.
   ---------------------------------------------------------- */
export async function obtenerPostre(id) {
    // Apuntamos al documento exacto dentro de la colección 'postres'
    const docRef = doc(db, 'postres', id);
    // Pedimos el documento a Firestore
    const snap = await getDoc(docRef);
    
    // Si Firestore no encontró nada con ese ID, lanzamos un error
    if (!snap.exists()) throw new Error('El postre no existe o fue eliminado.');
    
    // Devolvemos el postre con su ID incluido
    return { id: snap.id, ...snap.data() };
}

// ==========================================================
// OPERACIONES DE ESCRITURA (Exclusivas para Administradores)
// ==========================================================

/* ----------------------------------------------------------
   crearPostre(datos)
   ¿Para qué sirve?
   Permite al dueño de la pastelería agregar un nuevo postre al
   menú. Hace 4 filtros de seguridad antes de guardar:
   1. Verifica que quien llama sea Administrador.
   2. Limpia los datos y valida que no falte nada obligatorio.
   3. Revisa que no exista ya otro postre con el mismo nombre.
   4. Le genera un ID único con prefijo 'pst_' y lo guarda en Firestore.
   ---------------------------------------------------------- */
export async function crearPostre(datos) {
    // Paso 1: Guardia de seguridad (si es un cliente común, aquí se detiene todo)
    requerirRol(ROLES.ADMIN);

    // Paso 2: Limpiamos los datos que llegaron del formulario
    const limpio = normalizarPostre(datos);

    // Paso 3: Validamos con las reglas del negocio (nombre de 3 a 80 letras, precio > 0, etc.)
    const errores = validarPostre(limpio);
    if (Object.keys(errores).length) throw errorDeValidacion(errores);

    // Paso 4: Evitamos duplicados en el menú (comparamos nombres en minúsculas)
    const postres = await obtenerPostres();
    if (postres.some((p) => p.nombre.toLowerCase() === limpio.nombre.toLowerCase())) {
        throw errorDeValidacion({ nombre: 'Ya existe un postre con ese nombre.' });
    }

    // Paso 5: Estampamos la fecha y hora exacta de creación
    const ahora = new Date().toISOString();
    
    // Generamos un identificador único basado en tiempo (ej: 'pst_lh3k9x')
    const id = `pst_${Date.now().toString(36)}`;
    const nuevo = { ...limpio, creadoEn: ahora, actualizadoEn: ahora };

    // Paso 6: Guardamos en Firestore usando setDoc en la ruta 'postres/{id}'
    await setDoc(doc(db, 'postres', id), nuevo);
    
    // Devolvemos el objeto completo recién creado para que la interfaz se actualice de inmediato
    return { id, ...nuevo };
}

/* ----------------------------------------------------------
   actualizarPostre(id, cambios)
   ¿Para qué sirve?
   Modifica los datos de un postre existente (por ejemplo cambiar
   el precio de una porción, cambiar la foto o corregir la descripción).
   ---------------------------------------------------------- */
export async function actualizarPostre(id, cambios) {
    // Solo el admin puede modificar postres
    requerirRol(ROLES.ADMIN);

    // Nos traemos el postre tal como está ahorita en Firestore
    const postreActual = await obtenerPostre(id);

    // Fusionamos los datos viejos con los cambios nuevos y los limpiamos
    const limpio = normalizarPostre({ ...postreActual, ...cambios });

    // Validamos que los nuevos valores sean legales
    const errores = validarPostre(limpio);
    if (Object.keys(errores).length) throw errorDeValidacion(errores);

    // Revisamos que no le esté poniendo el nombre de OTRO postre diferente ya existente
    const todos = await obtenerPostres();
    const repetido = todos.some((p) => p.id !== id && p.nombre.toLowerCase() === limpio.nombre.toLowerCase());
    if (repetido) throw errorDeValidacion({ nombre: 'Ya existe otro postre con ese nombre.' });

    // Preparamos los datos finales con la nueva fecha de actualización
    const datosActualizados = {
        ...limpio,
        actualizadoEn: new Date().toISOString()
    };

    // Actualizamos en Firestore con updateDoc (solo toca los campos modificados)
    await updateDoc(doc(db, 'postres', id), datosActualizados);
    return { id, ...datosActualizados };
}

/* ----------------------------------------------------------
   cambiarDisponibilidad(id, disponible)
   ¿Para qué sirve?
   Es un interruptor rápido (toggle). Si en la cocina se acabó
   el queso mascarpone, el admin apaga el Tiramisú con un solo clic
   para que los clientes no puedan agregarlo al carrito.
   ---------------------------------------------------------- */
export async function cambiarDisponibilidad(id, disponible) {
    // Solo el administrador tiene permiso de prender o apagar productos
    requerirRol(ROLES.ADMIN);

    // Modificamos directamente el campo 'disponible' en Firestore
    await updateDoc(doc(db, 'postres', id), { disponible: Boolean(disponible) });
    return { id, disponible: Boolean(disponible) };
}

/* ----------------------------------------------------------
   eliminarPostre(id)
   ¿Para qué sirve?
   Borra definitivamente un postre de la base de datos de Google.
   Solo lo puede hacer el administrador.
   ---------------------------------------------------------- */
export async function eliminarPostre(id) {
    requerirRol(ROLES.ADMIN);
    
    // Apuntamos al documento y ordenamos a Firestore eliminarlo
    const docRef = doc(db, 'postres', id);
    await deleteDoc(docRef);
    return true;
}