# SETUP — Configuración y despliegue

## 1. Objetivo

Preparar la aplicación de intercambio con GitHub Pages, Supabase, enlaces individuales de WhatsApp y permisos de edición configurables.

OpenCode debe automatizar las tareas locales que pueda realizar y guiar al usuario en los pasos que requieran cuentas, credenciales o intervención manual.

## 2. Requisitos

- Cuenta de GitHub.
- Cuenta de Supabase.
- Repositorio para el proyecto.
- Git y herramientas compatibles con el frontend elegido.
- Supabase CLI para migraciones y despliegue de funciones.

Antes de instalar dependencias, comprobar qué herramientas están disponibles. Evitar instalaciones globales y permisos de administrador innecesarios.

## 3. Crear el proyecto de Supabase

El usuario debe crear un proyecto desde el panel de Supabase.

OpenCode debe indicar dónde hacerlo y qué datos públicos del proyecto se necesitan para configurar el frontend.

No solicitar ni guardar credenciales administrativas en el repositorio.

## 4. Crear la estructura de datos

Preparar migraciones SQL reproducibles para crear las tablas necesarias.

Como mínimo, contemplar:

- Participantes.
- Asignaciones del intercambio.
- Opciones de regalo.
- Identidades de acceso.
- Credenciales protegidas y su estado de revocación.
- Relaciones entre identidades de acceso y participantes editables.

Definir claves foráneas, restricciones e índices necesarios para mantener la integridad de los datos.

Las asignaciones y los permisos de edición deben almacenarse por separado.

## 5. Configurar la seguridad

### 5.1. Políticas de base de datos

- Habilitar RLS en las tablas expuestas.
- Permitir únicamente las consultas públicas necesarias.
- No exponer las tablas internas de credenciales, sesiones o permisos.
- Revocar los privilegios de escritura directa que no sean necesarios para los visitantes.
- Ejecutar las escrituras mediante funciones de servidor que comprueben la autorización.

### 5.2. Supabase Edge Functions

Preparar funciones para:

1. Validar enlaces individuales.
2. Crear sesiones temporales.
3. Consultar los permisos asociados a una sesión.
4. Agregar, modificar y eliminar opciones de regalo.
5. Revocar enlaces y sesiones cuando corresponda.
6. Ejecutar las operaciones administrativas necesarias para preparar y respaldar el intercambio.

Cada operación de escritura debe validar la sesión, comprobar que siga vigente y confirmar que la identidad de acceso puede editar al participante solicitado.

Si se utiliza una clave secreta con privilegios elevados, debe permanecer exclusivamente en el entorno de las funciones. No incluirla en archivos públicos, variables del frontend ni repositorios.

### 5.3. Gestión de credenciales

Generar enlaces con credenciales aleatorias, largas e impredecibles.

Guardar una representación protegida de cada credencial en Supabase y mostrar el enlace completo únicamente durante su generación o regeneración autorizada.

Los enlaces no deben incluirse en los respaldos ordinarios ni en los registros de ejecución.

Documentar cómo revocar un enlace y generar uno nuevo sin alterar los datos del participante ni sus asignaciones.

## 6. Preparar los participantes y permisos

Crear un procedimiento de inicialización ejecutado por el organizador desde un entorno controlado.

Debe permitir:

- Registrar los participantes.
- Definir las asignaciones del intercambio.
- Crear una identidad de acceso por cada enlace que se distribuirá.
- Asignar a cada identidad uno o varios participantes editables.
- Generar los enlaces individuales.
- Presentar los enlaces al organizador para distribuirlos manualmente por WhatsApp.

No crear automáticamente una relación de edición entre una persona y sus propias opciones, salvo que el organizador la asigne expresamente.

La aplicación debe admitir que algunas personas no tengan permiso para editar sus propias opciones y que otra identidad administre esas opciones en su lugar.

Evitar duplicados y permitir comprobar la configuración antes de utilizar los enlaces reales.

No incluir nombres, enlaces ni datos reales en ejemplos o pruebas públicas.

## 7. Configurar las sesiones

Implementar el intercambio de la credencial inicial por una sesión temporal.

Comprobar:

- Que una credencial inválida sea rechazada.
- Que un enlace revocado no pueda crear nuevas sesiones.
- Que las sesiones expiren.
- Que una sesión no permita cambiar de identidad modificando datos del navegador.
- Que las operaciones vuelvan a comprobar los permisos actuales.
- Que los errores no revelen credenciales ni información interna.

La implementación debe ser compatible con las funciones desplegadas y no depender de guardar una clave secreta en GitHub Pages.

## 8. Configurar Supabase Realtime

Configurar la sincronización de las opciones de regalo.

OpenCode debe probar el mecanismo de autorización de Realtime con el modelo de enlaces y sesiones de este proyecto.

No asumir que una Edge Function puede autorizar automáticamente las suscripciones.

Si Realtime requiere una configuración de autenticación adicional desproporcionada para el alcance del proyecto, proponer una alternativa sencilla de actualización automática, como la consulta periódica de cambios, y explicar la diferencia antes de adoptarla.

## 9. Configurar el frontend

Conectar el frontend con Supabase usando exclusivamente la configuración y las claves públicas necesarias.

Implementar:

- Lectura de la información compartida.
- Validación inicial del enlace.
- Manejo de la sesión temporal.
- Visualización de las personas editables.
- Formularios para agregar, modificar y eliminar opciones.
- Guardado y cancelación de cambios.
- Indicadores de carga, éxito y error.
- Sincronización automática.

Eliminar la credencial inicial de la URL una vez procesada y evitar que quede expuesta en el historial de navegación cuando sea posible.

No guardar credenciales en registros, mensajes de error ni archivos de configuración públicos.

## 10. Exportación y restauración

Crear un procedimiento administrativo local para exportar los datos del intercambio a JSON y restaurarlos posteriormente.

La exportación debe incluir los participantes, las asignaciones y las opciones necesarias para recuperar el intercambio.

No incluir credenciales, sesiones activas ni secretos.

La restauración debe validar la estructura, comprobar las referencias entre participantes y evitar duplicados o sobrescrituras accidentales.

Debe ejecutarse con autorización administrativa y nunca estar disponible para un participante ordinario a través de la aplicación pública.

Documentar cómo regenerar los enlaces cuando sea necesario.

## 11. Desplegar en GitHub Pages

Preparar el despliegue del frontend mediante GitHub Actions.

OpenCode debe:

1. Configurar el proceso de compilación, si corresponde.
2. Crear el workflow de despliegue.
3. Configurar la ruta base del repositorio.
4. Explicar cómo habilitar GitHub Pages.
5. Desplegar las Supabase Edge Functions mediante el procedimiento correspondiente.
6. Configurar los secretos del entorno desde el panel de Supabase o mediante la CLI.
7. Verificar que la aplicación publicada se conecta correctamente a Supabase.

No incluir secretos administrativos en GitHub Actions si el despliegue del frontend no los necesita.

## 12. Pruebas obligatorias

Utilizar datos ficticios para probar los siguientes casos:

- Un enlace con permiso para editar una persona.
- Un enlace con permiso para editar varias personas.
- Una persona sin permiso para editar sus propias opciones.
- Una persona que intenta editar a alguien fuera de sus permisos.
- Un enlace inválido.
- Un enlace revocado.
- Una sesión expirada.
- Una solicitud que modifica el identificador del participante en el navegador.
- Actualizaciones concurrentes de opciones.
- Sincronización entre dos navegadores.
- Exportación y restauración de datos.

Confirmar que las operaciones no autorizadas sean rechazadas en el servidor, incluso si se envían solicitudes directamente a las funciones.

## 13. Flujo de trabajo para OpenCode

1. Leer README.md y SPEC.md.
2. Revisar las herramientas y versiones disponibles.
3. Proponer la estructura mínima del proyecto.
4. Definir el modelo de identidades, permisos y sesiones.
5. Implementar las migraciones y funciones del servidor.
6. Implementar el frontend.
7. Preparar el procedimiento de inicialización y generación de enlaces.
8. Implementar el respaldo y la restauración.
9. Ejecutar las pruebas de permisos y sincronización.
10. Preparar el despliegue.
11. Guiar al usuario por la configuración externa.
12. Verificar el funcionamiento final.

No dar por completada una operación externa sin comprobar su resultado.

Cuando se necesiten contraseñas, permisos, credenciales o acciones manuales, indicar los pasos exactos y esperar la confirmación del usuario antes de continuar.

## 14. Principios de mantenimiento

- Mantener únicamente README.md, SPEC.md y SETUP.md como documentación principal.
- Incluir las migraciones, funciones y scripts necesarios en el código fuente.
- No crear un panel administrativo público.
- No añadir infraestructura adicional sin justificación.
- No ejecutar operaciones destructivas sin confirmación.
- Mantener los procedimientos de instalación, configuración y recuperación reproducibles.
