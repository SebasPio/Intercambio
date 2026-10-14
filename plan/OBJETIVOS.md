# Objetivos del proyecto

> Documento de trabajo. La fuente de verdad funcional y técnica son
> `intercambio-regalos-docs/README.md`, `SPEC.md` y `SETUP.md`.
> Este archivo resume el objetivo y el alcance para orientar el trabajo diario.

## Objetivo

Aplicación web estática (GitHub Pages) para organizar un intercambio entre personas
conocidas, apoyada en Supabase (Database + Edge Functions + Realtime).

- Acceso mediante **enlaces individuales** distribuidos por WhatsApp. Sin cuentas,
  contraseñas ni correo electrónico.
- **Intercambio abierto:** todos pueden consultar nombres, asignaciones y opciones de
  regalo. No hay secretismo sobre las asignaciones.
- Cada enlace es una **identidad de acceso** con permiso de edición sobre uno o varios
  participantes. Identidad y permisos son independientes de las asignaciones.
- Las **escrituras** se validan en el servidor (Edge Functions). El frontend nunca
  decide por sí solo los permisos.
- Los enlaces pueden **revocarse y rotarse**; las sesiones expiran (24 h, renovación
  deslizante mientras el enlace siga activo).

## Alcance

- Un único intercambio.
- Consulta pública de participantes, asignaciones y opciones.
- Edición de opciones (agregar, modificar, eliminar) por identidades autorizadas.
- Exportación e importación de respaldo JSON mediante procedimiento local autorizado.

## Fuera de alcance

- Cuentas, contraseñas o autenticación por correo.
- Panel administrativo público.
- Chat, comentarios o notificaciones.
- Backend propio o servicios adicionales.
- Múltiples intercambios.

## Decisiones técnicas fijadas

1. Frontend **sin build**: HTML, CSS y JavaScript nativo.
2. `assignments.giver → receiver` significa quien regala → quien recibe.
3. Sesión de **24 h** con renovación deslizante mientras el enlace siga activo.
4. Identidad y credencial en **una sola tabla**; revocar o rotar invalida sus sesiones.
5. **Supabase Realtime** si funciona; si complica el acceso, **polling**.
6. **CLI de Supabase** como binario local, sin instalación global ni `sudo`.
7. Opciones de regalo como **filas ordenadas**.

## Seguridad esencial

- Lectura pública de `participants`, `assignments` y `gift_options`.
- Sin permisos ni políticas de escritura para `anon`/`authenticated`.
- Escrituras solo por Edge Functions con `service_role`, comprobando sesión, estado
  del enlace y permiso sobre el participante objetivo.
- Credenciales y sesiones guardadas **hasheadas** y nunca en logs, respaldos ni repo.
- `service_role` solo en el entorno de las funciones y en `.env` local (ignorado).
