# Intercambio — Aplicación web

## Descripción

Aplicación web sencilla para organizar un intercambio entre personas conocidas. Cada participante puede consultar quién le tocó y ver las opciones de regalo de todos.

Los permisos de edición se asignan individualmente: un enlace puede autorizar a editar las opciones de una o varias personas.

La aplicación funciona desde el navegador, sin cuentas ni contraseñas tradicionales. Los enlaces de acceso se distribuyen por WhatsApp.

## Funcionamiento

- Cada persona que accede recibe un enlace individual.
- La aplicación muestra quién accede y qué participantes puede editar.
- Todos pueden consultar las opciones de regalo de todos.
- Un enlace puede autorizar la edición de varias personas.
- Las personas autorizadas pueden agregar, modificar y eliminar opciones.
- Los cambios guardados se reflejan automáticamente para los demás participantes.
- Los permisos son independientes de las asignaciones del intercambio.

## Tecnologías

- Frontend: aplicación web estática.
- Alojamiento: GitHub Pages.
- Base de datos: Supabase.
- Funciones de servidor y validación de permisos: Supabase Edge Functions.
- Sincronización: Supabase Realtime.
- Documentación principal: README.md, SPEC.md y SETUP.md.

## Acceso y permisos

Los enlaces funcionan como credenciales de acceso. Quien tenga un enlace podrá utilizar los permisos asociados a él.

Los permisos se validan en el servidor. El frontend nunca debe poder decidir por sí solo qué participantes puede editar una persona.

Los enlaces deben poder revocarse y reemplazarse si se comparten por error.

## Respaldo

El proyecto contempla exportar los datos a JSON y restaurarlos mediante un procedimiento autorizado, sin necesidad de crear un panel administrativo dentro de la aplicación.

## Principios del proyecto

- Mantener la aplicación pequeña, clara y adaptable a dispositivos móviles.
- Evitar cuentas, contraseñas y funciones innecesarias.
- Separar las asignaciones del intercambio de los permisos de edición.
- No exponer claves secretas en el frontend.
- Mantener las operaciones administrativas fuera de la interfaz pública.
- Facilitar la recuperación y el despliegue del proyecto.

## Documentación

- `README.md`: descripción general.
- `SPEC.md`: especificación funcional, visual y de permisos.
- `SETUP.md`: configuración, inicialización, pruebas, respaldo y despliegue.

## Alcance

La aplicación está diseñada para un intercambio entre personas conocidas. No pretende ser una plataforma pública ni un sistema completo de administración de eventos.
