# Checklist de tareas

Estado general: **en progreso — Etapa 1**.

## Decisiones fijadas

- [x] 1. Frontend sin build (HTML/CSS/JS nativo).
- [x] 2. `giver → receiver` = quien regala → quien recibe.
- [x] 3. Sesión 24 h con renovación deslizante.
- [x] 4. Identidad + credencial en una tabla; revocar/rotar invalida sesiones.
- [x] 5. Realtime si funciona; polling como respaldo.
- [x] 6. CLI de Supabase local, sin `sudo`.
- [x] 7. Opciones de regalo en filas ordenadas.
- [x] 8. Intercambio abierto: lectura pública total; permisos solo para escritura.

## Etapas

### Etapa 0 — Aprobación
- [x] Plan técnico aprobado por el usuario.

### Etapa 1 — Repositorio y estructura
- [x] `git init` (rama `main`).
- [x] `.gitignore` (secretos, `.env`, enlaces generados).
- [x] Carpeta `plan/` con objetivos y checklist.
- [x] Esqueleto `frontend/`, `supabase/functions/`, `supabase/migrations/`, `scripts/`.
- [ ] Commit inicial.

### Etapa 2 — Migraciones SQL
- [ ] Tablas: `participants`, `assignments`, `gift_options`, `access_identities`,
      `edit_permissions`, `sessions`.
- [ ] Claves foráneas, restricciones e índices.
- [ ] RLS: lectura pública en tablas de datos; sin escritura para `anon`.
- [ ] Privilegios SQL explícitos (revocar escrituras directas).

### Etapa 3 — Edge Functions
- [ ] `validate-link` (credencial → sesión + identidad + permisos).
- [ ] `options-write` (alta/modificación/borrado con revalidación).
- [ ] `session-info` (renovación deslizante).
- [ ] CORS limitado al dominio de GitHub Pages.

### Etapa 4 — Scripts de administración (Deno, `service_role`)
- [ ] Inicialización: participantes, asignaciones, identidades, permisos.
- [ ] Generar enlaces.
- [ ] Revocar / rotar enlaces.
- [ ] Exportar / restaurar JSON.

### Etapa 5 — Frontend
- [ ] Lectura pública (participantes, asignaciones, opciones).
- [ ] Validación del enlace y gestión de sesión.
- [ ] Edición con Guardar/Cancelar.
- [ ] Estados: cargando, guardado, error.

### Etapa 6 — Sincronización
- [ ] Realtime `postgres_changes` sobre `gift_options`.
- [ ] Respaldo por polling si Realtime complica el acceso.

### Etapa 7 — Pruebas (SETUP.md §12)
- [ ] Permiso sobre una persona / varias personas.
- [ ] Persona sin permiso sobre sí misma.
- [ ] Edición fuera de permisos (rechazada).
- [ ] Enlace inválido / revocado.
- [ ] Sesión expirada.
- [ ] Manipulación de `participant_id` en el navegador.
- [ ] Actualizaciones concurrentes.
- [ ] Sincronización entre dos navegadores.
- [ ] Exportación y restauración.

### Etapa 8 — Despliegue
- [ ] Desplegar Edge Functions.
- [ ] Configurar secretos del entorno.
- [ ] Workflow de GitHub Actions para GitHub Pages.
- [ ] Verificar conexión de la web publicada con Supabase.

### Etapa 9 — Verificación final
- [ ] Prueba end-to-end con enlaces reales (móvil y escritorio).

## Acciones manuales del usuario (pendientes)

- [ ] Crear proyecto en Supabase y facilitar Project URL + anon key.
- [ ] Crear cuenta y repositorio en GitHub.
- [ ] `supabase login` / `supabase link`.
- [ ] Rellenar `.env` local con `service_role` (no versionar).
- [ ] Ejecutar init/generación de enlaces y distribuirlos por WhatsApp.
- [ ] Habilitar GitHub Pages.
