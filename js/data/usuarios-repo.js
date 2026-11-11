/* ==========================================================
   REPOSITORIO DE USUARIOS (Capa de Datos / Firestore)
   Archivo: js/data/usuarios-repo.js
   ----------------------------------------------------------
   ¿Para qué sirve este archivo?
   Es el panel de control de usuarios para la administración.
   Permite al Administrador de la pastelería:
   1. Listar a todos los clientes y administradores registrados en la plataforma.
   2. Cambiar el rol de un usuario (por ejemplo, ascender a un cliente a "admin"
      o degradar a un admin a "cliente").

   Ambas operaciones están protegidas tanto en JavaScript con `requerirRol(ROLES.ADMIN)`
   como en las Reglas de Seguridad de Google Cloud Firestore (`firestore.rules`).
   ========================================================== */

// Importamos la lista de roles válidos ('admin', 'cliente')
import { ROLES } from '../config/app-config.js';

// Herramientas de Firestore para consultar colecciones y actualizar documentos
import { db, collection, getDocs, doc, getDoc, updateDoc } from '../config/firebase.js';

// Traemos el guardia de seguridad y la función que filtra campos sensibles
import { requerirRol, usuarioPublico } from './auth.js';

/* ----------------------------------------------------------
   obtenerUsuarios()
   ¿Para qué sirve?
   Trae la lista de todas las cuentas creadas en la pastelería.
   Se usa en la pestaña "Usuarios" del Panel de Administración.
   
   Flujo de seguridad:
   1. Revisa que el usuario actual tenga rol de Administrador. Si no, rebota.
   2. Consulta la colección 'usuarios' en Google Cloud Firestore.
   3. Pasa cada usuario por `usuarioPublico` para asegurarse de que NUNCA
      se expongan datos sensibles o contraseñas en la interfaz.
   ---------------------------------------------------------- */
export async function obtenerUsuarios() {
    // Paso 1: Guardia - solo administradores pueden ver la lista de usuarios
    requerirRol(ROLES.ADMIN);

    // Paso 2: Traemos todos los documentos de la colección 'usuarios'
    const snap = await getDocs(collection(db, 'usuarios'));
    const usuarios = [];
    snap.forEach((d) => usuarios.push({ id: d.id, ...d.data() }));

    // Paso 3: Retornamos los usuarios limpios (id, nombre, email, rol, creadoEn)
    return usuarios.map(usuarioPublico);
}

/* ----------------------------------------------------------
   cambiarRol(id, rolNuevo)
   ¿Para qué sirve?
   Permite al administrador ascender o descender a otros usuarios.
   
   Medidas de seguridad críticas:
   1. Solo administradores pueden ejecutar esta función.
   2. El rol debe ser legal (debe existir dentro del enum ROLES).
   3. Bloqueo de auto-bloqueo: el administrador NO puede cambiarse el rol
      a sí mismo. Si pudiera quitarse el rol de admin, ¡el sistema se quedaría
      sin administradores y nadie podría volver a entrar al panel!
   4. Actualiza en Firestore y vuelve a leer el documento completo para devolver
      el nombre y datos actualizados (evita que la alerta diga "undefined").
   ---------------------------------------------------------- */
export async function cambiarRol(id, rolNuevo) {
    // Paso 1: Guardia - verificamos que quien ejecuta sea admin y obtenemos sus datos
    const admin = requerirRol(ROLES.ADMIN);

    // Paso 2: Verificamos que el nuevo rol exista en la configuración
    if (!Object.values(ROLES).includes(rolNuevo)) {
        throw new Error('Rol desconocido.');
    }

    // Paso 3: Evitamos que el admin se degrade a sí mismo por error
    if (id === admin.id) {
        throw new Error('No puedes cambiar tu propio rol.');
    }

    // Paso 4: Actualizamos el campo 'rol' en el documento del usuario en Firestore
    const docRef = doc(db, 'usuarios', id);
    await updateDoc(docRef, { rol: rolNuevo });

    // Paso 5: Leemos el documento actualizado para tener su nombre y datos completos
    const snap = await getDoc(docRef);

    // Paso 6: Devolvemos el usuario público listo para actualizar la tabla y mostrar el aviso
    return usuarioPublico({ id, ...snap.data() });
}