# Configuración necesaria para cuentas, pedidos y administración

## 1. Ejecutar la migración de la base de datos

En Supabase > SQL Editor, ejecutar `database/migracion-cuentas-clientes.sql` sobre el mismo proyecto que utiliza la tienda. No borrar tablas ni datos de pedidos existentes.

## 2. Variables de entorno en Vercel

En el proyecto correcto de Vercel > Settings > Environment Variables deben existir, al menos:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (solo backend; nunca exponer al navegador)
- `DATABASE_URL` (cadena PostgreSQL del proyecto Supabase)
- `SESSION_SECRET` (texto aleatorio de al menos 32 caracteres)

El error `Falta DATABASE_URL` significa que Vercel no está entregando esa variable a la función. Revisar que el nombre sea exactamente `DATABASE_URL`, que esté habilitada para Production (y Preview si se prueba allí), guardar y hacer un nuevo deployment. Importar un archivo `.env` local no garantiza que Vercel tenga esas variables.

No pegar claves privadas en el código ni compartirlas por capturas. No reemplazar las claves reales por valores de ejemplo.

## 3. Configurar los códigos de 6 dígitos por correo en Supabase

En Supabase > Authentication > Providers > Email:
- Mantener habilitado Email.
- Habilitar la confirmación de correo electrónico.
- Establecer la longitud del OTP en 6 dígitos, si aparece esa opción.

En Supabase > Authentication > Email Templates:
- En **Confirm signup**, usar el marcador `{{ .Token }}` en el cuerpo del correo para mostrar el código de 6 dígitos. No usar solamente `{{ .ConfirmationURL }}` si se quiere que el cliente escriba el código en la tienda.
- En **Reset Password**, también usar `{{ .Token }}` para que la recuperación entregue un código. No usar solamente `{{ .ConfirmationURL }}`.
- Guardar ambas plantillas y enviar un correo de prueba.

El registro verifica el código con el tipo `signup`. La recuperación verifica el código con el tipo `recovery`. Después de validar el código de recuperación, la tienda muestra el formulario para elegir una contraseña nueva; no debe mandar al usuario a iniciar sesión mediante un enlace.

## 4. Acceso de administrador

El panel está en `/admin.html`. El inicio de sesión consulta el rol guardado en `public.profiles.rol`; solamente el rol `admin` puede acceder a `/api/admin` y al panel. Las cuentas nuevas se crean con rol `cliente`.

No cambies el rol de otros usuarios ni borres el administrador. Si la cuenta que debe administrar la tienda no tiene rol `admin`, corregir únicamente esa fila desde Supabase SQL Editor, usando el correo real del administrador:

```sql
UPDATE public.profiles
SET rol = 'admin'
WHERE id = (
  SELECT id
  FROM auth.users
  WHERE email = 'CORREO_REAL_DEL_ADMIN'
);
```

Después cerrar sesión y volver a entrar en `/admin.html`. El enlace **Panel de administración** también aparece en la navegación de la tienda cuando la sesión tiene rol `admin`.

## 5. Perfil y pedidos

Para confirmar un pedido, el cliente debe iniciar sesión y tener completos nombre, apellido, domicilio, localidad y teléfono en **Mi cuenta**. El servidor vuelve a comprobar esos datos antes de insertar el pedido; si falta alguno, muestra qué completar en vez de fallar con un error `trim`.

La edición del perfil actualiza todos los campos tanto en Supabase como en la sesión. No se elimina el historial de pedidos.

## 6. Publicación y pruebas

Después de cambiar variables o plantillas:
1. Guardar los cambios en Supabase/Vercel.
2. Hacer un nuevo deployment en Vercel desde el repositorio correcto.
3. Probar registro y recepción del código.
4. Verificar el código y comprobar que la cuenta queda creada.
5. Cerrar sesión, probar login y luego recuperación con código y contraseña nueva.
6. Completar todos los datos del perfil y realizar un pedido de prueba.
7. Entrar en `/admin.html` con el usuario administrador y probar pedidos, productos y categorías.
8. Confirmar que una cuenta con rol `cliente` no puede entrar al panel.

La verificación por WhatsApp no está activada en esta versión: requiere configurar WhatsApp Cloud API/Coexistence y sus credenciales en Meta. Este ZIP corrige los códigos de correo solicitados.


## 9. Registro sin confirmación y recuperación mediante enlace

Para que el registro cree la sesión inmediatamente, en Supabase > Authentication > Sign In / Providers > Email desactivar **Confirm email**. No desactivar Email ni eliminar usuarios existentes.

La recuperación ahora usa un enlace (no código). En Vercel configurar `URL_DE_LA_APLICACION` con la URL pública exacta, por ejemplo `https://prueba-two-mauve.vercel.app` (sin barra final). En Supabase > Authentication > URL Configuration, agregar esa misma URL y `https://prueba-two-mauve.vercel.app/**` a Redirect URLs. Si el dominio cambia, actualizar ambos lugares.

En Authentication > Email Templates > Reset Password, usar `{{ .ConfirmationURL }}` como enlace de recuperación. No usar `{{ .Token }}` en esta plantilla para este flujo. El usuario abre el enlace, vuelve a la tienda y el formulario solicita contraseña nueva y confirmación.


## 10. Ajustes de esta versión: registro directo y recuperación con Gmail desde el backend

El registro ya no depende del interruptor **Confirm email**: el servidor crea al usuario con `email_confirm: true` mediante la clave `SUPABASE_SERVICE_ROLE_KEY`, guarda su perfil y luego inicia sesión. No se envían códigos de registro.

La recuperación genera un enlace oficial de Supabase y lo envía desde el backend con Nodemailer. En Vercel, además de las variables anteriores, configurar:

- `URL_DE_LA_APLICACION`: dominio público exacto, sin barra final (por ejemplo `https://elpibedeloscalcos.vercel.app`).
- `SMTP_HOST`: `smtp.gmail.com`
- `SMTP_PORT`: `465`
- `SMTP_SECURE`: `true`
- `SMTP_USER`: dirección completa de Gmail desde la que se enviarán los correos.
- `SMTP_PASS`: contraseña de aplicación de Google de 16 caracteres (NO la contraseña normal de Gmail).
- `MAIL_FROM`: la misma dirección Gmail de `SMTP_USER`.
- `MAIL_FROM_NAME`: `Elpibedeloscalcos` (opcional).

Para crear la contraseña de aplicación, la cuenta Google debe tener activada la verificación en dos pasos. Generar una contraseña de aplicación desde la configuración de seguridad de Google y copiarla en `SMTP_PASS`, sin espacios. No compartir esa contraseña ni subirla al repositorio.

Como los correos de recuperación ahora salen directamente desde Nodemailer, **desactivar “Enable custom SMTP” en Supabase > Authentication > Emails > SMTP Settings**. Esto no desactiva el proveedor Email ni la autenticación.

En Supabase > Authentication > URL Configuration, agregar el dominio público exacto en Site URL y en Redirect URLs (por ejemplo `https://elpibedeloscalcos.vercel.app/**`). En Vercel, las variables deben estar habilitadas para Production. Después de guardarlas, instalar dependencias y desplegar una nueva versión.

No desactivar el proveedor Email. No borrar usuarios ni modificar roles existentes.
