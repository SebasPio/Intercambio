# SPEC — Especificación de la aplicación de intercambio

## 1. Objetivo

Construir una aplicación web sencilla para organizar un intercambio entre personas conocidas.

Todos los participantes pueden consultar las opciones de regalo de los demás. Los permisos de edición se asignan a cada enlace de acceso y pueden abarcar a una o varias personas.

La aplicación debe funcionar en computadoras y dispositivos móviles, sin registro ni contraseñas tradicionales.

## 2. Tecnologías

- Frontend estático alojado en GitHub Pages.
- Supabase Database para los datos.
- Supabase Edge Functions para validar enlaces y autorizar operaciones.
- Supabase Realtime para comunicar cambios.
- Supabase CLI y migraciones para administrar la estructura de la base de datos.

No añadir servicios ni infraestructura adicionales sin una necesidad justificada.

## 3. Modelo de datos y conceptos

Mantener separados estos conceptos:

### 3.1. Participante

Cada participante debe tener:

- Identificador interno estable.
- Nombre.
- Persona que le tocó en el intercambio.
- Lista de opciones de regalo.

### 3.2. Enlace de acceso

Cada enlace representa una identidad de acceso independiente y debe tener:

- Identificador interno.
- Nombre descriptivo de la persona que utilizará el enlace.
- Credencial aleatoria de acceso.
- Estado activo o revocado.
- Relación con los participantes cuyas opciones puede editar.

Una identidad de acceso no tiene que corresponder a un único participante del intercambio.

### 3.3. Permisos de edición

Mantener una relación entre los enlaces de acceso y los participantes autorizados.

Un enlace puede tener permiso para editar las opciones de uno o varios participantes.

Los permisos deben poder configurarse durante la preparación del intercambio sin modificar el frontend ni introducir un panel administrativo público.

La asignación de una persona en el intercambio no concede ni determina permisos de edición.

## 4. Acceso mediante WhatsApp

- El organizador genera un enlace individual para cada identidad de acceso.
- Los enlaces se distribuyen por WhatsApp.
- No se requiere correo electrónico, contraseña ni registro tradicional.
- La posesión del enlace concede los permisos asociados a él.
- Si una persona comparte su enlace, quien lo reciba podrá utilizar esos mismos permisos. Este comportamiento es aceptado para el alcance del proyecto.

Los enlaces deben contener credenciales aleatorias, suficientemente largas e impredecibles. No utilizar nombres, números consecutivos ni identificadores de participantes como credenciales.

### Validación del enlace

Implementar el siguiente flujo:

1. El navegador recibe el enlace individual.
2. El frontend extrae la credencial y la envía a una Supabase Edge Function de validación.
3. El servidor verifica que la credencial exista, esté activa y corresponda a una identidad de acceso válida.
4. El servidor devuelve una sesión temporal limitada para las operaciones autorizadas.
5. El frontend elimina la credencial original de la URL y utiliza la sesión temporal.
6. Las operaciones posteriores verifican la sesión y los permisos actuales en el servidor.

Preferir colocar la credencial inicial en el fragmento de la URL, después de `#`, para evitar que se envíe automáticamente en la petición HTTP inicial. No guardar credenciales en registros ni mostrarlas en mensajes de error.

Las sesiones temporales deben expirar. El mecanismo de renovación debe volver a comprobar que el enlace no haya sido revocado.

OpenCode debe elegir e implementar un mecanismo de sesión compatible con Supabase Edge Functions, documentarlo y probarlo. No aceptar un identificador de participante enviado por el cliente como prueba de identidad.

## 5. Consulta de información

Todos los participantes pueden consultar:

- Los nombres de los participantes.
- Las asignaciones del intercambio.
- Las opciones de regalo de todos.

La interfaz debe mostrar claramente:

- Un saludo con el nombre descriptivo de la identidad de acceso.
- La persona o personas que ese enlace puede editar.
- La asignación del intercambio que corresponda mostrar según la experiencia definida.
- Las opciones de regalo.
- Las acciones de edición disponibles para los participantes autorizados.

No confundir la identidad del enlace con la persona a la que le tocó alguien.

## 6. Edición de opciones

Un enlace autorizado puede administrar las opciones de regalo de todos los participantes asociados a sus permisos.

Para cada participante autorizado, permitir:

- Agregar opciones.
- Modificar opciones existentes.
- Eliminar opciones.
- Guardar cambios.
- Cancelar cambios pendientes.

Los cambios no guardados deben descartarse al cancelar.

La interfaz solo debe mostrar acciones de edición para las personas autorizadas por el enlace actual. Sin embargo, esta restricción visual es complementaria: el servidor debe volver a validar los permisos en cada operación.

No permitir que los participantes modifiquen:

- Las asignaciones del intercambio.
- Los permisos de los enlaces.
- Las credenciales de acceso.
- Los datos de otros participantes fuera de las opciones que tengan autorización para editar.

## 7. Arquitectura de seguridad

La aplicación estática utiliza la clave pública de Supabase, nunca una clave secreta.

Las Edge Functions son responsables de validar las credenciales, comprobar los permisos y ejecutar las operaciones de escritura.

Las claves secretas de Supabase solo pueden utilizarse del lado del servidor. Si una función usa una clave con privilegios elevados que omite RLS, debe comprobar explícitamente la autorización antes de cada operación.

Requisitos:

- Habilitar RLS en las tablas expuestas.
- Conceder a los visitantes únicamente permisos de consulta necesarios.
- No permitir escrituras directas desde el cliente sobre tablas protegidas.
- Validar en el servidor la identidad, el estado de la sesión, el participante objetivo y el permiso de edición.
- No confiar en nombres, identificadores ni listas de permisos enviados por el navegador.
- Guardar las credenciales iniciales en forma de hash cuando corresponda, sin almacenar innecesariamente el secreto original.
- Permitir revocar enlaces y terminar las sesiones asociadas.
- Evitar registrar tokens, enlaces completos o datos secretos.

Si las consultas públicas se realizan directamente desde el cliente, limitar su acceso a los datos que todos están autorizados a ver. Los datos internos de autenticación, credenciales y permisos no deben exponerse mediante la API pública.

## 8. Sincronización automática

Utilizar Supabase Realtime para que los cambios guardados se reflejen sin recargar la página.

La implementación debe:

- Notificar cambios en las opciones.
- Actualizar las vistas correspondientes.
- Mostrar errores de conexión.
- No afirmar que un cambio se guardó hasta recibir confirmación.
- Respetar los permisos de consulta durante la sincronización.

Como el acceso utiliza enlaces personalizados en lugar de cuentas tradicionales, OpenCode debe verificar cómo se autorizarán las suscripciones de Realtime. No asumir que la validación de una Edge Function autoriza automáticamente una conexión de Realtime.

Preferir el mecanismo compatible más sencillo y seguro. Si la configuración de Realtime resulta desproporcionada, proponer una alternativa sencilla de actualización automática y documentarla antes de ampliar la arquitectura.

## 9. Diseño visual

Crear una interfaz minimalista, clara y adaptable.

- Saludo personalizado.
- Asignación visible y fácil de identificar.
- Listas de opciones legibles.
- Acciones de edición sencillas.
- Indicadores de carga, guardado y error.
- Botones Guardar y Cancelar.
- Diseño cómodo en dispositivos móviles.

No añadir elementos decorativos o funciones que distraigan de la finalidad principal.

## 10. Exportación y restauración JSON

Permitir exportar los datos necesarios para recuperar el intercambio.

La restauración debe realizarse mediante un procedimiento autorizado fuera de la interfaz pública, sin conceder permisos administrativos a los participantes.

Antes de restaurar:

- Validar el formato.
- Comprobar participantes y asignaciones.
- Evitar duplicados y sobrescrituras accidentales.
- Informar qué datos serán modificados.

No incluir credenciales activas, hashes de acceso ni sesiones en las exportaciones ordinarias. Documentar cómo se regeneran o revocan los enlaces cuando sea necesario.

## 11. Límites del proyecto

No implementar:

- Registro o inicio de sesión tradicional.
- Contraseñas para participantes.
- Panel administrativo público.
- Chat ni mensajería.
- Roles complejos innecesarios.
- Funciones ajenas al intercambio.
- Servicios de pago o infraestructura propia sin autorización.

El organizador debe poder preparar participantes, asignaciones y permisos mediante procedimientos documentados, sin necesidad de administrar todo desde una interfaz web.

## 12. Criterios de aceptación

1. Cada enlace identifica una identidad de acceso.
2. Cada enlace puede editar las opciones de una o varias personas.
3. Los permisos no dependen de las asignaciones del intercambio.
4. Todos pueden consultar las opciones de todos.
5. Un enlace no puede editar a una persona que no figure entre sus permisos.
6. Cambiar identificadores en el navegador no permite saltarse las restricciones.
7. Los enlaces revocados dejan de autorizar nuevas operaciones.
8. Las sesiones expiran y respetan la revocación.
9. Los cambios se sincronizan automáticamente.
10. La exportación y restauración funcionan sin exponer credenciales.
11. La aplicación funciona desde GitHub Pages en dispositivos móviles y computadoras.

## 13. Instrucciones para OpenCode

Leer README.md y SETUP.md antes de implementar.

Antes de escribir el código, presentar una propuesta breve de estructura de datos, validación de enlaces, sesiones temporales, autorización de escrituras y sincronización.

Comprobar que el diseño permite asignar varios participantes editables a una sola identidad de acceso.

No inventar una solución de autenticación improvisada ni exponer claves secretas.

Si una decisión técnica necesaria no está definida, explicar la alternativa recomendada y esperar la confirmación del usuario antes de introducir complejidad adicional.

Cuando una acción requiera credenciales, permisos o intervención manual, dar instrucciones exactas y esperar la confirmación del usuario.

Mantener el proyecto alineado con esta especificación y evitar funciones adicionales.
