# Logica completa de la aplicacion — Martos Arregla

Este documento explica en detalle como funciona internamente toda la aplicacion, tanto el backend (NestJS) como el frontend (Flutter). Esta pensado para entender el proyecto al 100% de cara a la defensa del TFG.

---

## 1. ARQUITECTURA GENERAL

La aplicacion sigue una arquitectura cliente-servidor:

```
Flutter (movil)  --->  NestJS (backend)  --->  PostgreSQL (Neon)
                          |
                    +-----+-----+--------+
                    |           |        |
              Cloudinary   Google Maps  Resend
              (imagenes)   (geocoding)  (emails)
```

**Flujo de datos:**
1. El usuario interactua con la UI de Flutter
2. Flutter llama a un Provider (ChangeNotifier) que gestiona el estado
3. El Provider llama a un Service que hace la peticion HTTP con Dio
4. Dio envia la peticion al backend NestJS (con JWT en el header si hay sesion)
5. NestJS valida la peticion, ejecuta la logica y devuelve JSON
6. Flutter recibe el JSON, lo mapea a un modelo Dart y actualiza la UI

---

## 2. AUTENTICACION Y REGISTRO

### 2.1 Registro de un nuevo usuario

Cuando un usuario pulsa "Registrarse" en la app:

**Frontend (register_page.dart → auth_provider.dart → auth_service.dart):**
1. Se recogen nombre, email y contrasena del formulario
2. `AuthProvider.register()` llama a `AuthService.register()`
3. `AuthService` hace `POST /api/v1/users/register` con `{nombre, email, clave}`

**Backend (users.controller.ts → users.service.ts):**
1. El `ValidationPipe` global valida el DTO `CreateUserDto`:
   - `nombre`: debe ser string con al menos 1 caracter
   - `email`: debe ser un email valido
   - `clave`: minimo 8 caracteres, debe contener mayuscula, minuscula y numero
   - Si alguna validacion falla, devuelve 400 con el mensaje de error en espanol
2. `UsersService.create()` se ejecuta:
   - Genera un `activationToken` con `uuid()` (ej: `a3f7b2c1-4d5e-6f7a-8b9c-0d1e2f3a4b5c`)
   - Crea el usuario con `activo: false` y `bloqueado: false`
   - El hook `@BeforeInsert()` de la entidad User hashea la contrasena con bcrypt (10 salt rounds)
   - El hook `@BeforeInsert()` convierte el email a minusculas
   - Guarda el usuario en PostgreSQL
3. Envia email de activacion en segundo plano (no bloquea la respuesta):
   - `MailService.sendActivationEmail()` llama a la API de Resend (HTTP, no SMTP)
   - El email contiene un enlace: `https://backendincidenciasnest.onrender.com/api/v1/users/activate/{token}`
   - Se usa Resend en vez de nodemailer/SMTP porque Render bloquea conexiones SMTP salientes
4. Devuelve `{id, nombre, email, mensaje: "Se ha enviado un correo de activacion..."}`

**Frontend recibe la respuesta:**
1. `AuthProvider` guarda el mensaje en `_successMessage`
2. `register_page.dart` muestra pantalla de confirmacion: "Revisa tu correo electronico"
3. El usuario NO queda logueado — debe activar la cuenta primero

### 2.2 Activacion de cuenta

Cuando el usuario pulsa el enlace del email:

1. El navegador del movil abre `GET /api/v1/users/activate/{token}`
2. `UsersController.activateAccount()` llama a `UsersService.activateAccount(token)`
3. El servicio busca en la BD un usuario con ese `activationToken`
4. Si lo encuentra: pone `activo = true` y `activationToken = null` (se borra para que no se reutilice)
5. Devuelve una pagina HTML con "Cuenta activada" que el usuario ve en el navegador
6. Si el token no existe o ya fue usado: devuelve 400 "Token de activacion invalido"

### 2.3 Login

Cuando el usuario introduce email y contrasena y pulsa "Iniciar sesion":

**Frontend (login_page.dart → auth_provider.dart → auth_service.dart):**
1. `AuthProvider.login()` llama a `AuthService.login(email, password)`
2. `AuthService` hace `POST /api/v1/users/login` con `{email, clave}`

**Backend (users.controller.ts → users.service.ts):**
1. `UsersService.login()` busca al usuario por email en la BD
   - Importante: usa `select` para traer tambien el campo `clave` (que normalmente esta oculto con `select: false`)
2. Comprueba la contrasena: `bcrypt.compareSync(claveIntroducida, hashAlmacenado)`
   - bcrypt compara el texto plano con el hash — nunca se almacena la contrasena real
3. **Orden de validacion en login** (importante — cada caso tiene mensaje distinto):
   - Usuario no existe → 401 "Este usuario no existe, registrate para comenzar"
   - Contrasena incorrecta → 401 "La contrasena no es correcta"
   - Cuenta bloqueada → 401 "El administrador ha bloqueado su cuenta. Por favor, contacte con el area responsable."
   - Cuenta no activada → 401 "Cuenta no activada. Revisa tu correo electronico."
5. Si todo es correcto, genera un JWT:
   - Payload: `{id: "uuid-del-usuario"}`
   - Firmado con `JWT_SECRET` (variable de entorno)
   - Expiracion configurable (por defecto 15 minutos)
6. Devuelve `{id, email, token}`

**Frontend recibe la respuesta:**
1. `AuthService` guarda el token en `FlutterSecureStorage` (almacenamiento cifrado del dispositivo)
2. Guarda tambien el `userId` para poder restaurar la sesion
3. Hace `GET /api/v1/users/{id}` para obtener el perfil completo (nombre, rol, etc.)
4. Crea un `UserModel` con los datos y lo asigna a `AuthProvider._user`
5. `AuthProvider` notifica a los listeners → la UI se reconstruye
6. El `GoRouter` detecta que `isLoggedIn == true` y redirige al dashboard

### 2.4 Restauracion de sesion

Cuando el usuario abre la app (no ha hecho logout):

1. `main.dart → _restoreSession()` se ejecuta tras el primer frame
2. `AuthProvider.restoreSession()` llama a `AuthService.restoreSession()`
3. `AuthService` lee el token y userId de `FlutterSecureStorage`
4. Si existen, hace `GET /api/v1/users/{userId}` con el token en el header
5. Si el token es valido → restaura la sesion (el usuario ve el dashboard directamente)
6. Si el token ha expirado → limpia storage, el usuario ve el login

### 2.5 Como funciona el JWT internamente

Cada peticion HTTP que hace Flutter incluye el token en el header:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Esto lo hace automaticamente el **interceptor de Dio** en `ApiService`:
```dart
dio.interceptors.add(InterceptorsWrapper(
  onRequest: (options, handler) async {
    final token = await _storage.read(key: 'access_token');
    if (token != null) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    handler.next(options);
  },
));
```

En el backend, cuando un endpoint esta protegido con `@UseGuards(AuthGuard())`:
1. Passport intercepta la peticion
2. `JwtStrategy.validate()` se ejecuta:
   - Extrae el token del header `Authorization: Bearer ...`
   - Lo decodifica con la clave secreta `JWT_SECRET`
   - Obtiene el `id` del payload
   - Busca al usuario en la BD por ese `id`
   - Si no existe o esta inactivo → 401 Unauthorized
   - Si es valido → inyecta el usuario en `req.user`
3. El controlador y los guards posteriores pueden acceder a `req.user`

### 2.6 Recuperacion de contrasena (forgot password)

El flujo de "olvide mi contrasena" sigue el mismo patron que la activacion por email pero con un giro: en vez de redirigir a la app, el usuario rellena un **formulario HTML servido por el propio backend**. Asi se evita la complejidad de configurar deep links en Android.

**Paso 1 — Solicitud desde la app:**

1. El usuario pulsa "¿Olvidaste tu contrasena?" en la pantalla de login
2. Se abre `ForgotPasswordPage` (ruta `/forgot-password`, marcada como auth route en el guard global)
3. El usuario introduce su email y pulsa "Enviar enlace"
4. `AuthProvider.forgotPassword()` llama a `AuthService.forgotPassword(email)`
5. Se hace `POST /api/v1/users/forgot-password` con `{email}`

**Paso 2 — Backend genera token y envia email:**

1. `UsersController.forgotPassword()` valida el `ForgotPasswordDto` (`@IsEmail`)
2. Llama a `UsersService.forgotPassword(email)`:
   - Busca al usuario por email (en minusculas, trim)
   - **Importante**: si el email NO existe, devuelve igualmente el mensaje de exito generico. Esto evita revelar a un atacante si un email esta o no registrado en el sistema (defensa contra enumeracion de usuarios)
   - Si existe, genera un `resetToken` con `uuid()`
   - Guarda en el usuario:
     - `resetToken` = el UUID generado
     - `resetTokenExpiry` = `new Date(Date.now() + 60 * 60 * 1000)` (1 hora desde ahora)
   - Envia email **en segundo plano** (no bloquea la respuesta) llamando a `MailService.sendResetPasswordEmail()`
3. Devuelve siempre `{mensaje: "Si el email existe, recibiras un enlace para restablecer tu contrasena."}`

**Paso 3 — Frontend muestra confirmacion:**

1. `ForgotPasswordPage` cambia el estado a `_emailSent = true`
2. Se muestra una pantalla con icono de email y mensaje "Revisa tu correo"

**Paso 4 — El usuario pulsa el enlace del email:**

El email contiene un boton con el enlace `{HOST_API}/users/reset-password/{token}`. Al pulsarlo, el navegador del movil hace una peticion `GET` a ese endpoint del backend.

**Paso 5 — Backend devuelve un formulario HTML:**

1. `UsersController.showResetForm()` recibe el token como parametro de URL
2. Devuelve una pagina HTML con:
   - Cabecera "Restablecer contrasena"
   - Dos inputs: nueva contrasena y confirmar contrasena (ambos `type="password"`, `required`, `minlength="8"`)
   - Boton de submit que hace `POST` al mismo endpoint con el token en la URL
   - Estilos inline (sin CSS externo) imitando el diseno de la app

Importante: en este momento NO se valida si el token es valido. Eso se hace al procesar el POST. El motivo es que mostrar el formulario aunque el token ya este caducado da mejor UX que un mensaje de error directo.

**Paso 6 — Usuario rellena el formulario y pulsa "Cambiar contrasena":**

1. El navegador hace `POST /api/v1/users/reset-password/{token}` con `Content-Type: application/x-www-form-urlencoded` y los campos `clave` y `confirmar`
2. Para que NestJS pueda parsear este formato (en lugar del JSON habitual), se anadio en `main.ts`:
   ```typescript
   app.use(urlencoded({ extended: true }));
   ```
3. `UsersController.processReset()`:
   - Valida que `clave.length >= 8`
   - Valida que `clave === confirmar`
   - Si alguna validacion falla → devuelve HTML de error (en rojo)
4. Llama a `UsersService.resetPassword(token, nuevaClave)`:
   - Busca al usuario con `resetToken === token`
   - Si no existe → `BadRequestException("Token de restablecimiento invalido")`
   - Si `resetTokenExpiry < new Date()` → `BadRequestException("El enlace ha caducado")`
   - Hashea la nueva contrasena con `bcrypt.hash(nuevaClave, BCRYPT_SALT_ROUNDS)`
   - Guarda la nueva contrasena
   - Pone `resetToken = null` y `resetTokenExpiry = null` (el token se quema, no se puede reutilizar)
5. Devuelve HTML de exito (verde) con mensaje "Ya puedes iniciar sesion en la app"

**Paso 7 — Usuario vuelve a la app y entra:**

El usuario cierra el navegador, abre la app y hace login con su nueva contrasena.

### 2.7 Diferencias clave entre activacion y reset

| Aspecto | Activacion de cuenta | Reset de contrasena |
|---------|---------------------|---------------------|
| Cuando se genera | Al registrarse | Cuando el usuario pulsa "olvide mi contrasena" |
| Caducidad | No tiene (vale hasta que se use) | 1 hora |
| Campo en BD | `activationToken` | `resetToken` + `resetTokenExpiry` |
| UX al pulsar el enlace | Pagina HTML de confirmacion | Pagina HTML con formulario |
| Que actualiza | `activo: true` | Hash de la contrasena |
| Se borra tras usar | Si | Si |
| Funciona si email no real | No (no recibe el email) | No (no recibe el email) |

---

## 3. SISTEMA DE ROLES Y PERMISOS

### 3.1 Roles existentes

Hay dos roles definidos en `ValidRoles`:
- `usuario`: puede crear incidencias, ver las suyas, editar su perfil
- `admin`: puede ver todas las incidencias, gestionarlas, gestionar usuarios, ver estadisticas y mapa

### 3.2 Como se protege un endpoint

Para proteger un endpoint se usan dos decoradores y dos guards:

```typescript
@RoleProtected(ValidRoles.admin)        // Paso 1: Marca que este endpoint necesita rol "admin"
@UseGuards(AuthGuard(), UserRoleGuard)  // Paso 2: Aplica los guards
```

**AuthGuard()** (de Passport):
- Verifica que hay un JWT valido en la peticion
- Ejecuta `JwtStrategy.validate()` (descrito arriba)
- Inyecta el usuario en `req.user`

**UserRoleGuard** (custom):
- Lee el metadata `'rol'` que puso `@RoleProtected`
- `@RoleProtected(ValidRoles.admin)` guarda `['admin']` en el metadata
- El guard comprueba si `req.user.rol` esta incluido en el array de roles permitidos
- Si el usuario es admin → permite el acceso
- Si no → lanza `403 Forbidden: "No tienes permisos para realizar esta accion"`

**Detalle importante:** `@RoleProtected` pasa un array de roles (ej: `['admin']`), mientras que `@SetMetadata('rol', 'admin')` pasa un string directo. El guard soporta ambos formatos gracias a:
```typescript
const roles = Array.isArray(validRoles) ? validRoles : [validRoles];
```

### 3.3 Endpoints y sus permisos

| Endpoint | Metodo | Proteccion |
|----------|--------|-----------|
| /users/register | POST | Ninguna (publico) |
| /users/login | POST | Ninguna (publico) |
| /users/activate/:token | GET | Ninguna (publico) |
| /users/forgot-password | POST | Ninguna (publico) |
| /users/reset-password/:token | GET | Ninguna (publico, devuelve formulario HTML) |
| /users/reset-password/:token | POST | Ninguna (publico, procesa formulario) |
| /users | GET | Admin (AuthGuard + RoleGuard) |
| /users/:id | GET | Ninguna (deberia tener auth) |
| /users/:id | PATCH | Ninguna (deberia verificar propiedad) |
| /users/:id | DELETE | Admin |
| /users/:id/toggle-block | PATCH | Admin |
| /incidents | POST | Ninguna |
| /incidents | GET | Ninguna |
| /incidents/:id | GET | Ninguna |
| /incidents/:id | PATCH | Ninguna |
| /incidents/:id | DELETE | Admin |
| /incidents/:id/comments | POST | Ninguna |
| /incidents/places/autocomplete | GET | Ninguna |
| /incidents/report/excel | GET | Admin |
| /users/report/excel | GET | Auth (cualquier usuario logueado) |
| /files/incident | POST | Ninguna |
| /seed | GET | Admin |

### 3.4 Como se diferencia la UI por rol

En Flutter, `AuthProvider` expone:
```dart
bool get isAdmin => _user?.isAdmin ?? false;
```

Y `UserModel.isAdmin` comprueba:
```dart
bool get isAdmin => role == 'admin';
```

En las paginas, se usa `authProvider.isAdmin` para mostrar u ocultar elementos:
- El dashboard muestra "Abrir incidencia" solo si NO es admin
- El dashboard muestra "Mapa", "Gestionar usuarios", "Estadisticas" solo si ES admin
- El detalle de incidencia muestra controles de estado/prioridad solo si es admin
- La lista de incidencias carga "todas" (admin) o "las mias" (usuario)

---

## 4. GESTION DE INCIDENCIAS

### 4.1 Crear una incidencia

**Frontend (create_incident_page.dart → incident_provider.dart → incident_service.dart):**

1. El usuario rellena: titulo, descripcion, direccion, prioridad y fotos
2. Al pulsar "Crear incidencia":
   - `IncidentProvider.createIncident()` se ejecuta
   - Primero sube TODAS las imagenes en paralelo a Cloudinary:
     ```dart
     imageUrls = await Future.wait(
       imagePaths.map((path) => _incidentService.uploadImage(path)),
     );
     ```
   - Cada imagen se envia como `multipart/form-data` a `POST /api/v1/files/incident`
   - El backend recibe el archivo, lo sube a Cloudinary y devuelve la URL segura (HTTPS)
   - Con las URLs obtenidas, hace `POST /api/v1/incidents` con todos los datos

**Backend (incidents.controller.ts → incidents.service.ts):**

1. El `ValidationPipe` valida el `CreateIncidentDto`:
   - `titulo`: string, minimo 3 caracteres
   - `descripcion`: string, minimo 10 caracteres
   - `direccion`: string, minimo 10 caracteres
   - `imagenes`: array de strings (URLs de Cloudinary)
   - `prioridad`: opcional, enum (baja/media/alta/critica)
   - `usuario`: string (email del usuario)
2. `IncidentsService.create()`:
   - Busca al usuario por email en la BD
   - Si no existe → 404
   - **Geocodifica la direccion**: llama a `GeocodingService.geocode(direccion)`
     - Construye la query: `"{direccion}, Martos, Jaen, Espana"`
     - Llama a Google Geocoding API: `https://maps.googleapis.com/maps/api/geocode/json?...`
     - Si Google encuentra la direccion → devuelve `{latitud, longitud}`
     - **Validacion de radio**: calcula la distancia entre las coordenadas obtenidas y el centro de Martos usando la **formula Haversine**. Si la distancia supera los 5 km, se rechaza la direccion con error 400: "La direccion no es valida o no pertenece a Martos"
     - Si la direccion no existe o esta fuera de Martos → error 400 (no se crea la incidencia)
   - Crea la entidad Incident con todos los datos + coordenadas
   - Crea las entidades IncidentImage con las URLs
   - Guarda todo en la BD (cascade: true guarda imagenes automaticamente)
3. Devuelve la incidencia formateada con imagenes como array de URLs

### 4.2 Autocompletado de direcciones

Cuando el usuario escribe en el campo de direccion:

**Frontend (create_incident_page.dart → places_service.dart):**
1. Cada pulsacion de tecla dispara `_onAddressChanged()`
2. Se aplica un **debounce de 400ms** — solo busca cuando el usuario deja de escribir
3. Si el texto tiene menos de 3 caracteres, no busca
4. `PlacesService.getSuggestions()` llama a `GET /api/v1/incidents/places/autocomplete?input=Calle+Re`

**Backend (incidents.controller.ts → geocoding.service.ts):**
1. El endpoint llama a `GeocodingService.autocomplete(input)`
2. El servicio llama a Google Places Autocomplete API:
   - `https://maps.googleapis.com/maps/api/place/autocomplete/json?input={input}, Martos&...`
   - Parametros: restringido a Espana (`components=country:es`), centrado en Martos, radio 5km, idioma espanol, tipo "address"
3. Devuelve un array de `{description, placeId}`

**Por que se enruta por el backend:** La API Key de Google Maps esta restringida a Android (Maps SDK). Las llamadas HTTP directas desde Dio no llevan la firma del certificado Android, asi que Google las rechaza. Al pasar por el backend, la peticion sale desde el servidor (que usa su propia API Key sin restriccion de plataforma).

**Frontend recibe las sugerencias:**
1. Se muestran en un dropdown debajo del campo de direccion
2. Cada sugerencia muestra un icono de ubicacion y la direccion completa
3. Al pulsar una sugerencia, se rellena el campo y se cierra el dropdown

### 4.3 Subida de imagenes

El flujo de subida de una imagen:

1. **Seleccion**: El usuario elige de galeria (`pickMultiImage`) o camara (`pickImage`)
2. **Frontend**: La imagen se guarda como `File` local en `_selectedImages`
3. **Upload**: Al crear la incidencia, se envia cada archivo como `multipart/form-data`:
   ```dart
   final formData = FormData.fromMap({
     'file': await MultipartFile.fromFile(filePath),
   });
   ```
4. **Backend** (`files.controller.ts`):
   - `FileInterceptor('file')` intercepta el archivo
   - `fileFilter` valida que sea una imagen (jpg, png, gif, etc.)
   - `CloudinaryService.uploadImage()` sube el buffer a Cloudinary usando streams
   - Se almacena en la carpeta `martos_incidents` de Cloudinary
   - Devuelve `{url: "https://res.cloudinary.com/..."}` (URL segura HTTPS)
5. Las URLs se guardan en la tabla `incident_images` con relacion a la incidencia

### 4.4 Comentarios/Timeline

Los administradores pueden dejar notas en las incidencias:

**Frontend (incident_detail_page.dart):**
1. El admin escribe una nota y pulsa enviar
2. `IncidentService.addComment(incidentId, texto, userEmail)`
3. Hace `POST /api/v1/incidents/{id}/comments` con `{texto, usuario}`

**Backend (incidents.service.ts):**
1. Busca la incidencia y el usuario (por email)
2. Crea un `IncidentComment` con el texto, la incidencia y el autor
3. Guarda en la BD

**Visualizacion:**
- Los comentarios se devuelven con cada incidencia (relacion `eager: true`)
- Se formatean con: `{id, texto, creadoEn, autor: {id, nombre}}`
- En Flutter, `CommentModel.fromJson()` extrae el autor del objeto anidado
- Se muestran como timeline ordenado por fecha

---

## 5. GESTION DE USUARIOS (ADMIN)

### 5.1 Bloqueo/Desbloqueo

1. Admin pulsa icono de candado en la tarjeta del usuario
2. Dialogo de confirmacion
3. `UserService.toggleBlock(userId)` → `PATCH /api/v1/users/{id}/toggle-block`
4. Backend: invierte el campo `bloqueado` (`true ↔ false`) y guarda
5. Devuelve `{id, bloqueado, mensaje: "Usuario bloqueado/desbloqueado"}`
6. Frontend muestra SnackBar de confirmacion

**Efecto:** Cuando un usuario bloqueado intenta hacer login:
- El backend comprueba `if (user.bloqueado)` ANTES de comprobar si esta activo
- Devuelve 401 con mensaje especifico: "El administrador ha bloqueado su cuenta..."
- Flutter muestra ese mensaje en la pantalla de login

### 5.2 Eliminacion

1. Admin pulsa icono de papelera
2. Dialogo de confirmacion
3. `UserService.deleteUser(userId)` → `DELETE /api/v1/users/{id}`
4. Backend: busca al usuario y lo elimina de la BD
5. Las incidencias del usuario quedan huerfanas (no se borran)

---

## 6. GOOGLE MAPS Y GEOCODIFICACION

### 6.1 API Keys — como funcionan

Hay DOS usos de Google Maps en la app:

**1. Maps SDK para Android (mapa visual):**
- La API Key esta en `android/app/src/main/AndroidManifest.xml`
- Se usa nativamente por el paquete `google_maps_flutter`
- Esta **restringida** a la app Android (nombre de paquete + SHA-1)
- Solo funciona desde la app instalada en un movil/emulador

**2. Geocoding + Places API (backend):**
- La API Key esta en la variable de entorno `GOOGLE_MAPS_API_KEY` de Render
- Se usa desde el servidor NestJS (no desde el movil)
- No tiene restriccion de plataforma (es una llamada HTTP servidor-a-servidor)
- Se usa para geocodificar direcciones al crear incidencias y para autocompletado

### 6.2 Restriccion geografica — Formula Haversine

Al crear una incidencia, el backend valida que la direccion pertenece a Martos:

1. Google Geocoding devuelve las coordenadas (lat/lng) de la direccion
2. Se calcula la distancia entre esas coordenadas y el centro de Martos (37.7210, -3.9720)
3. Se usa la **formula Haversine**, que calcula la distancia entre dos puntos en una esfera:
   - Convierte las diferencias de latitud y longitud a radianes
   - Aplica la formula: `d = 2R * arctan2(√a, √(1-a))` donde R = 6371 km (radio de la Tierra)
   - Devuelve la distancia en kilometros
4. Si la distancia supera 5 km → se rechaza la direccion con error 400
5. Si esta dentro del radio → se guardan las coordenadas en la incidencia

Esto impide que un usuario cree incidencias con direcciones de Madrid, Jaen capital o cualquier otra localidad.

### 6.3 Dos API Keys separadas — por que

Se usan dos API Keys de Google Maps distintas por seguridad:

| Key | Ubicacion | Restriccion | Uso |
|-----|-----------|-------------|-----|
| Key 1 (Android) | AndroidManifest.xml | Restringida a la app (paquete + SHA-1) | Mapa visual en el movil |
| Key 2 (Backend) | Variable de entorno en Render | Restringida a Geocoding + Places API | Geocodificacion y autocompletado |

La Key 1 esta en el codigo publico (GitHub) pero solo funciona desde la app Android firmada con el certificado del desarrollador. Nadie puede usarla desde otra app.

La Key 2 esta en una variable de entorno de Render, no aparece en el codigo. Solo puede llamar a Geocoding y Places API — no puede usar ningun otro servicio de Google.

### 6.4 Mapa de incidencias (admin)

`incidents_map_page.dart`:
1. Al abrir la pagina, carga todas las incidencias via `IncidentProvider.loadAllIncidents()`
2. Filtra las que tienen coordenadas (`hasCoordinates`) y no estan rechazadas (`!isRejected`)
3. Crea un `Marker` por cada incidencia con:
   - Posicion: `LatLng(latitud, longitud)`
   - Color segun estado: naranja (pendiente), azul (en progreso), verde (resuelto)
   - InfoWindow con titulo y estado — al pulsar navega al detalle
4. El mapa se centra en Martos (37.7210, -3.9720) con zoom 15

---

## 7. MODO OSCURO

### 7.1 Como funciona

1. `ThemeProvider` gestiona el estado (`ThemeMode.light` o `ThemeMode.dark`)
2. La preferencia se guarda en `FlutterSecureStorage` con clave `dark_mode`
3. Al abrir la app, `ThemeProvider.init()` lee la preferencia guardada
4. El icono sol/luna del dashboard llama a `ThemeProvider.toggle()`
5. `MaterialApp` escucha `themeProvider.themeMode` y aplica `AppTheme.light` o `AppTheme.dark`

### 7.2 Temas definidos

En `app_theme.dart`:
- `AppTheme.light`: fondos crema (#FAF7F2), superficie blanca, textos oscuros
- `AppTheme.dark`: fondos #121212, superficie #1E1E1E, textos claros

Ambos temas definen estilos para: AppBar, Card, Input, Buttons, Chips, SnackBar, Dialog, FAB.

En `app_colors.dart` hay colores separados para cada modo:
- Light: `background`, `surface`, `surfaceVariant`, `textPrimary`, `textSecondary`
- Dark: `backgroundDark`, `surfaceDark`, `surfaceVariantDark`, `textPrimaryDark`, `textSecondaryDark`

---

## 8. ENVIO DE EMAILS

### 8.1 Por que Resend y no Gmail/SMTP

Inicialmente se uso nodemailer con Gmail (SMTP). Funcionaba en local pero en Render daba `Connection timeout` porque Render bloquea conexiones SMTP salientes en el plan gratuito.

**Solucion:** Se cambio a Resend, que envia emails via API HTTP (no SMTP). La API Key de Resend se configura como variable de entorno `RESEND_API_KEY` en Render.

### 8.2 Flujo del email

1. `MailService.sendActivationEmail(to, nombre, token)`
2. Construye la URL de activacion: `{HOST_API}/users/activate/{token}`
3. Llama a `resend.emails.send()` con:
   - From: "Martos Arregla <onboarding@resend.dev>"
   - To: email del usuario
   - Subject: "Activa tu cuenta — Martos Arregla"
   - HTML: plantilla con cabecera azul degradada, boton "Activar mi cuenta" y footer
4. El envio es **asincrono** (no bloquea la respuesta del registro)

---

## 9. SEED (DATOS DE PRUEBA)

### 9.1 Como funciona

El endpoint `GET /api/v1/seed` (protegido con guard de admin):
1. `SeedService.runSeed()` ejecuta `insertIncidentsAndUsers()`
2. Borra TODAS las incidencias: `incidentService.deleteAllIncidences()`
3. Borra TODOS los usuarios: `userService.deleteAllUsers()`
4. Crea 21 usuarios en paralelo con `userService.createActive()`:
   - Se crean con `activo: true` y `bloqueado: false` (no necesitan activar por email)
   - La contrasena viene de la variable de entorno `SEED_PASSWORD`
   - Si no esta definida, usa `Seed_Default_1234` como fallback
5. Crea 35 incidencias en paralelo con imagenes de Cloudinary pre-subidas

### 9.2 Seguridad del seed

- Las contrasenas NO estan en el codigo fuente (se usan variables de entorno)
- El endpoint esta protegido — solo un admin autenticado puede ejecutarlo
- En el repositorio publico de GitHub no se expone ninguna credencial

---

## 10. VALIDACION GLOBAL (BACKEND)

En `main.ts` se configura un `ValidationPipe` global:

```typescript
app.useGlobalPipes(new ValidationPipe({
  whitelist: true,           // Elimina propiedades no declaradas en el DTO
  forbidNonWhitelisted: true, // Lanza error si llegan propiedades desconocidas
  transform: true,           // Convierte el payload al tipo del DTO
}));
```

**whitelist**: Si el frontend envia `{titulo: "x", campoFalso: "y"}`, el campo `campoFalso` se elimina antes de llegar al controlador.

**forbidNonWhitelisted**: Ademas de eliminar, lanza un error 400: "property campoFalso should not exist". Esto protege contra inyeccion de campos.

**transform**: Necesario para que los decoradores `@Transform()` funcionen. Por ejemplo, convierte un string de imagenes a un array.

---

## 11. BASE DE DATOS — RELACIONES

```
User (users)
  |
  |--- 1:N ---> Incident (incidents)     [usuario → incidentes]
  |--- 1:N ---> IncidentComment          [autor → comentarios]

Incident (incidents)
  |
  |--- 1:N ---> IncidentImage (incident_images)    [CASCADE DELETE]
  |--- 1:N ---> IncidentComment (incident_comments) [CASCADE DELETE]
  |--- N:1 ---> User (users)
```

- Si se borra una incidencia, se borran automaticamente sus imagenes y comentarios (CASCADE)
- Si se borra un usuario, sus incidencias quedan huerfanas (no se borran)
- Los comentarios tienen `onDelete: 'SET NULL'` en la relacion con el autor

---

## 12. NAVEGACION Y PROTECCION DE RUTAS (FRONTEND)

### 12.1 GoRouter

En `app_router.dart`, `createRouter()` recibe el `AuthProvider` y configura un `redirect` global:

```dart
redirect: (context, state) {
  final loggedIn = authProvider.isLoggedIn;
  final isAuthRoute = state.matchedLocation == '/login' || state.matchedLocation == '/register';

  if (!loggedIn && !isAuthRoute) return '/login';     // No logueado → al login
  if (loggedIn && isAuthRoute) return '/dashboard';    // Ya logueado → al dashboard
  return null;                                          // Sin redireccion
};
```

Esto actua como un **guard global**: es imposible acceder a ninguna pantalla sin estar logueado (excepto login y registro).

### 12.2 Rutas definidas

| Ruta | Pagina | Acceso |
|------|--------|--------|
| /login | LoginPage | Publico |
| /register | RegisterPage | Publico |
| /dashboard | DashboardPage | Autenticado |
| /create-incident | CreateIncidentPage | Autenticado (usuario) |
| /my-incidents | IncidentsListPage | Autenticado (usuario) |
| /all-incidents | IncidentsListPage | Autenticado (admin) |
| /incident/:id | IncidentDetailPage | Autenticado |
| /profile | ProfilePage | Autenticado |
| /admin-users | AdminUsersPage | Autenticado (admin) |
| /incidents-map | IncidentsMapPage | Autenticado (admin) |
| /statistics | StatisticsPage | Autenticado (admin) |
| /phones | PhonesPage | Autenticado |
| /forgot-password | ForgotPasswordPage | Publico (incluida en isAuthRoute) |

---

## 13. ESTADISTICAS (ADMIN)

La pagina de estadisticas (`statistics_page.dart`) calcula los graficos en el frontend a partir de las incidencias cargadas por `IncidentProvider.loadAllIncidents()`. Ademas, ofrece la **descarga de informes Excel** que se genera en el backend.

### 13.1 Graficos visualizados

1. **Tarjetas resumen**: cuenta total, pendientes, en progreso y resueltas
2. **Grafico donut** (por estado): usa `PieChart` de `fl_chart`, colores alineados con los marcadores del mapa
3. **Grafico de barras** (por prioridad): baja, media, alta, critica con colores diferenciados
4. **Grafico de barras** (por mes): muestra los ultimos 6 meses, cuenta incidencias por `createdAt.month`

### 13.2 Descarga de informes Excel

El admin puede descargar un informe Excel con el desglose completo de incidencias desde la propia pantalla de estadisticas.

**Flujo completo:**

1. El admin pulsa el icono de descarga (`Icons.file_download_outlined`) en el AppBar
2. Se abre un dialogo con dos `DatePicker` opcionales (desde / hasta) para filtrar por rango de fechas
3. El admin puede dejar los filtros vacios (descarga todas las incidencias) o seleccionar fechas
4. Al pulsar "Descargar":
   - `IncidentService.downloadIncidentsReport({filters})` hace `GET /api/v1/incidents/report/excel?desde=...&hasta=...`
   - **Importante**: la peticion usa `responseType: ResponseType.bytes` para que Dio reciba el binario en vez de intentar parsearlo como JSON
   - El backend genera el Excel en memoria con `exceljs` y lo devuelve como buffer
   - El frontend llama a `getTemporaryDirectory()` (de `path_provider`) para obtener un directorio temporal del dispositivo
   - Guarda el buffer en `informe_incidencias_{timestamp}.xlsx`
   - Llama a `OpenFilex.open(filePath)` para abrir el archivo con la app por defecto del dispositivo (Excel, Google Sheets, WPS, etc.)
5. Mientras tanto, el boton del AppBar muestra un `CircularProgressIndicator` y queda deshabilitado
6. Al terminar, muestra un `SnackBar` de confirmacion o error

**Backend — generacion del Excel:**

`ReportsService.generateIncidentsExcel(incidents)` crea un workbook con dos hojas:

**Hoja 1 — Resumen ejecutivo:**
- Fecha y hora de generacion del informe
- Total de incidencias
- Desglose por estado (pendientes, en progreso, resueltas, rechazadas)
- Desglose por prioridad (criticas, altas, medias, bajas)
- **Tiempo medio de resolucion** (en dias): se calcula como la media de `(actualizadoEn - creadoEn)` de las incidencias resueltas
- **Porcentaje resuelto**: `(resueltas / total) * 100`
- **Top 5 usuarios** con mas incidencias creadas
- Estilos: cabecera azul con texto blanco en negrita, secciones marcadas con `── TITULO ──`

**Hoja 2 — Listado completo:**
- 14 columnas: ID, Titulo, Descripcion, Direccion, Estado, Prioridad, Usuario, Email, Nº imagenes, Nº comentarios, Latitud, Longitud, Creada, Actualizada
- Una fila por incidencia
- Cabecera con color azul y texto blanco en negrita
- **Filtros automaticos** habilitados con `worksheet.autoFilter` (el usuario puede filtrar por cualquier columna desde Excel)
- **Primera fila congelada** con `worksheet.views = [{state: 'frozen', ySplit: 1}]` (al hacer scroll, la cabecera se queda fija)

**Backend — filtros por fecha:**

El endpoint `GET /incidents/report/excel` reutiliza el `findAllEntities()` con el `FindIncidentsQueryDto`, al que se anadieron dos campos:
```typescript
@IsOptional()
@IsDateString()
desde?: string;

@IsOptional()
@IsDateString()
hasta?: string;
```

En el query builder de `IncidentsService.findAllEntities()`:
```typescript
if (desde) {
  queryBuilder.andWhere('incident.creadoEn >= :desde', { desde });
}
if (hasta) {
  // Sumamos 1 dia al "hasta" para incluir todo el dia seleccionado
  const hastaDate = new Date(hasta);
  hastaDate.setDate(hastaDate.getDate() + 1);
  queryBuilder.andWhere('incident.creadoEn < :hasta', {
    hasta: hastaDate.toISOString(),
  });
}
```

El truco del `+1 dia` en `hasta` es importante: si el usuario selecciona "hasta el 15 de marzo", queremos incluir todas las incidencias del dia 15 (no solo las creadas a las 00:00:00). Por eso comparamos con `< 16 de marzo 00:00:00`.

### 13.3 Paquetes nuevos en el frontend

| Paquete | Para que se usa |
|---------|-----------------|
| `path_provider` | Obtener el directorio temporal del dispositivo donde guardar el Excel descargado |
| `open_filex` | Abrir el archivo con la app por defecto del dispositivo tras descargarlo |

---

## 14. TELEFONOS DE INTERES

`phones_page.dart` muestra una lista estatica de telefonos utiles del municipio (Ayuntamiento, Bomberos, etc.). Al pulsar un telefono:

1. Construye URI: `tel:953210000`
2. Llama a `launchUrl(uri)` del paquete `url_launcher`
3. Android abre la app de telefono con el numero marcado

---

## 15. ANIMACIONES Y UX

### Hero animations
- La primera imagen de cada incidencia en la lista tiene `Hero(tag: 'incident_image_{id}')`
- La misma imagen en el detalle tiene el mismo tag
- Flutter anima automaticamente la transicion entre ambas pantallas

### Zoom de imagenes
- Al pulsar una imagen en el detalle se abre a pantalla completa
- Usa `InteractiveViewer` para pinch-to-zoom
- Carrusel con `PageView` y flechas laterales

### Skeleton/Loading
- Todas las pantallas con datos muestran `CircularProgressIndicator` mientras cargan
- `RefreshIndicator` en la lista de incidencias para pull-to-refresh

---

## 16. VARIABLES DE ENTORNO

### Backend (Render)

| Variable | Que hace |
|----------|----------|
| DB_NAME | Nombre de la BD en Neon |
| DB_USERNAME | Usuario de PostgreSQL |
| DB_PASSWORD | Contrasena de PostgreSQL |
| DB_PORT | Puerto de PostgreSQL (5432) |
| HOST_API | URL publica del backend (para enlaces de activacion) |
| JWT_SECRET | Clave secreta para firmar/verificar tokens JWT |
| BCRYPT_SALT_ROUNDS | Rondas de hasheo bcrypt (10) |
| RESEND_API_KEY | API key de Resend para envio de emails |
| GOOGLE_MAPS_API_KEY | API key de Google Maps (geocoding + places) |
| SEED_PASSWORD | Contrasena generica para usuarios del seed |
| STAGE | Entorno (dev/prod) |

### Frontend

No tiene variables de entorno. La configuracion esta en `app_config.dart`:
- `baseUrl`: URL del backend
- `connectTimeout` / `receiveTimeout`: 60 segundos (Render tarda en despertar)

La API Key de Google Maps para el mapa visual esta en `AndroidManifest.xml`.

---

## 17. SEGURIDAD — MEDIDAS IMPLEMENTADAS

### 17.1 Autenticacion y contrasenas

- Contrasenas hasheadas con **bcrypt** (10 salt rounds) — nunca se almacenan en texto plano
- Autenticacion mediante **JWT** (JSON Web Token) con expiracion configurable
- Tokens almacenados en **FlutterSecureStorage** (cifrado del dispositivo, no en SharedPreferences)
- Activacion obligatoria de cuenta por email antes del primer login

### 17.2 Autorizacion

- Guards personalizados (`AuthGuard` + `UserRoleGuard`) en endpoints sensibles
- Endpoint GET /users protegido — solo admin puede listar usuarios
- Endpoint /seed protegido — solo admin puede re-ejecutar datos de prueba
- Endpoint DELETE /incidents protegido — solo admin puede borrar
- Bloqueo de usuarios por admin — impide login con mensaje especifico

### 17.3 Validacion de datos

- `ValidationPipe` global con `whitelist` y `forbidNonWhitelisted` — rechaza campos desconocidos
- DTOs con `class-validator` — validan tipos, longitudes minimas, formatos de email
- Restriccion geografica de direcciones — formula Haversine impide incidencias fuera de Martos
- `fileFilter` en subida de imagenes — solo acepta formatos de imagen validos

### 17.4 API Keys

- API Key de Google Maps (Android) restringida por nombre de paquete + SHA-1
- API Key de Google Maps (backend) restringida a Geocoding + Places API
- Contrasenas del seed en variable de entorno (no en codigo fuente)
- Todas las credenciales sensibles en variables de entorno de Render

### 17.5 Riesgos residuales aceptados (documentados para el TFG)

- Sin rate limiting en login (podria implementarse con `@nestjs/throttler`)
- PATCH /users/:id no verifica propiedad del recurso (un usuario podria modificar a otro si conoce su UUID)
- Sin refresh token (si alguien intercepta el JWT, vale hasta que expire)
- Estos puntos se documentan como "trabajo futuro / mejoras" en la memoria

---

## 18. DESPLIEGUE Y SERVICIOS CLOUD

### 18.1 Render (backend)

- Plan gratuito — el servidor se duerme tras 15 min sin trafico
- Al recibir una peticion, tarda ~30s en despertar (cold start)
- Auto-deploy activado: cada push a main en GitHub dispara un redeploy
- Build command: `yarn; yarn build`
- Start command: `node dist/main.js`
- Variables de entorno configuradas en el dashboard de Render

### 18.2 Neon (PostgreSQL)

- PostgreSQL serverless — se suspende tras 5 min sin actividad
- Almacenamiento gratuito: 512 MB
- Acceso directo via SQL Editor en la consola web de Neon
- Conexion SSL obligatoria (Render la soporta nativamente)

### 18.3 Cloudinary (imagenes)

- Plan gratuito: 25 GB almacenamiento + 25 GB bandwidth/mes
- Las imagenes se almacenan en la carpeta `martos_incidents`
- URLs seguras (HTTPS) devueltas tras la subida
- Configuracion via variables de entorno en el modulo Cloudinary de NestJS

### 18.4 Resend (emails)

- Plan gratuito: 100 emails/dia, 3000/mes
- Envia via API HTTP (no SMTP) — compatible con Render
- Dominio remitente: `onboarding@resend.dev` (plan gratuito)

### 18.5 Google Cloud Platform

- APIs habilitadas: Geocoding API, Places API, Maps SDK for Android
- Credito gratuito: 200$/mes (~28.000 llamadas)
- Dos API Keys: una para Android (restringida), otra para backend (restringida a APIs)

---

## 19. ESTRUCTURA DE FICHEROS

### Backend (NestJS)

```
src/
├── main.ts                              # Punto de entrada, ValidationPipe, Swagger
├── app.module.ts                        # Modulo raiz con imports
├── common/
│   ├── services/
│   │   ├── cloudinary-service.ts        # Subida/borrado imagenes en Cloudinary
│   │   ├── geocoding.service.ts         # Geocodificacion + autocompletado + Haversine
│   │   └── mail.service.ts              # Envio de emails con Resend
│   └── dtos/
│       ├── find-incidents-query.dto.ts  # Filtros de busqueda de incidencias
│       └── find-users-query.dto.ts      # Filtros de busqueda de usuarios
├── users/
│   ├── entities/user.entity.ts          # Entidad User (TypeORM)
│   ├── dto/
│   │   ├── create-user.dto.ts           # Validacion de registro
│   │   ├── update-user.dto.ts           # Validacion de actualizacion
│   │   ├── login-user.dto.ts            # Validacion de login
│   │   └── forgot-password.dto.ts       # Validacion de email para reset
│   ├── users.controller.ts              # Endpoints de usuarios
│   ├── users.service.ts                 # Logica de negocio de usuarios
│   ├── users.module.ts                  # Modulo de usuarios
│   ├── strategies/jwt.strategy.ts       # Estrategia JWT de Passport
│   ├── guards/user-role.guard.ts        # Guard de roles
│   ├── decorators/role-protected.ts     # Decorador @RoleProtected
│   └── interfaces/
│       ├── jwt-payload.interface.ts     # Interfaz del payload JWT
│       └── valid-roles.ts              # Enum de roles validos
├── incidents/
│   ├── entities/
│   │   ├── incident.entity.ts           # Entidad Incident
│   │   ├── incident-image.entity.ts     # Entidad IncidentImage
│   │   └── incident-comment.entity.ts   # Entidad IncidentComment
│   ├── dto/
│   │   ├── create-incident.dto.ts       # Validacion de creacion
│   │   ├── update-incident.dto.ts       # Validacion de actualizacion
│   │   └── create-comment.dto.ts        # Validacion de comentarios
│   ├── incidents.controller.ts          # Endpoints de incidencias
│   ├── incidents.service.ts             # Logica de negocio
│   └── incidents.module.ts              # Modulo de incidencias
├── files/
│   ├── files.controller.ts              # Endpoint de subida de archivos
│   ├── files.service.ts                 # Servicio de archivos
│   └── helpers/fileFilter.ts            # Filtro de tipos de archivo
├── reports/
│   └── reports.service.ts               # Generacion de informes Excel
└── seed/
    ├── seed.controller.ts               # Endpoint del seed (protegido)
    ├── seed.service.ts                  # Logica del seed
    └── data/seed-data.ts                # Datos de prueba (sin contrasenas)
```

### Frontend (Flutter)

```
lib/
├── main.dart                            # Entry point, MultiProvider, restauracion sesion
├── config/
│   ├── app_config.dart                  # URL backend, timeouts
│   ├── app_routes.dart                  # Constantes de rutas
│   ├── app_router.dart                  # GoRouter con guard de autenticacion
│   ├── app_theme.dart                   # Temas claro y oscuro (Material 3)
│   └── app_colors.dart                  # Paleta de colores (light + dark)
├── models/
│   ├── user_model.dart                  # Modelo de usuario
│   ├── incident_model.dart              # Modelo de incidencia
│   └── comment_model.dart               # Modelo de comentario/nota
├── services/
│   ├── api_service.dart                 # Dio + interceptor JWT automatico
│   ├── auth_service.dart                # Login, registro, perfil, sesion
│   ├── incident_service.dart            # CRUD incidencias + subida imagenes
│   ├── user_service.dart                # Gestion usuarios (admin)
│   └── places_service.dart              # Autocompletado direcciones (via backend)
├── providers/
│   ├── auth_provider.dart               # Estado autenticacion (ChangeNotifier)
│   ├── incident_provider.dart           # Estado incidencias (ChangeNotifier)
│   └── theme_provider.dart              # Modo claro/oscuro (ChangeNotifier)
└── presentation/pages/
    ├── login_page.dart                  # Pantalla de login (con enlace a forgot)
    ├── register_page.dart               # Pantalla de registro + activacion
    ├── forgot_password_page.dart        # Solicitar reset de contrasena por email
    ├── dashboard_page.dart              # Menu principal (diferente por rol)
    ├── create_incident_page.dart        # Crear incidencia (fotos, autocompletado)
    ├── incidents_list_page.dart          # Lista con filtros y ordenacion
    ├── incident_detail_page.dart        # Detalle con carousel, zoom, timeline
    ├── profile_page.dart                # Editar nombre y contrasena
    ├── admin_users_page.dart            # Gestion usuarios (bloquear/eliminar)
    ├── incidents_map_page.dart          # Mapa Google Maps con marcadores
    ├── statistics_page.dart             # Graficos + descarga de informes Excel
    └── phones_page.dart                 # Telefonos de interes con dial
```

---

## 20. GLOSARIO TECNICO

| Termino | Que es |
|---------|--------|
| **JWT** | JSON Web Token — token firmado digitalmente que contiene el ID del usuario. Se envia en cada peticion HTTP para identificar al usuario sin necesidad de sesiones en el servidor. |
| **bcrypt** | Algoritmo de hasheo de contrasenas. Convierte "MiClave123" en "$2b$10$xK..." de forma irreversible. Para verificar, se hashea la entrada y se compara con el hash almacenado. |
| **Geocodificacion** | Proceso de convertir una direccion de texto ("Calle Real, Martos") en coordenadas geograficas (37.7210, -3.9720). |
| **Haversine** | Formula matematica que calcula la distancia entre dos puntos en la superficie de una esfera (la Tierra), teniendo en cuenta la curvatura. |
| **ORM** | Object-Relational Mapping — TypeORM permite definir tablas de la BD como clases TypeScript (entidades) y operar sobre ellas sin escribir SQL directamente. |
| **DTO** | Data Transfer Object — clase que define la forma exacta de los datos que acepta un endpoint. Se usa para validacion automatica. |
| **Guard** | Componente de NestJS que decide si una peticion puede acceder a un endpoint. Se ejecuta antes del controlador. |
| **Provider** | Patron de estado en Flutter. Un ChangeNotifier que almacena datos y notifica a los widgets cuando cambian para que se reconstruyan. |
| **Interceptor (Dio)** | Funcion que se ejecuta automaticamente antes/despues de cada peticion HTTP. En la app, anade el JWT al header de todas las peticiones. |
| **Debounce** | Tecnica que retrasa la ejecucion de una funcion hasta que el usuario deja de escribir (400ms). Evita hacer llamadas a la API en cada pulsacion de tecla. |
| **Cold start** | Tiempo que tarda un servidor dormido (Render free) en arrancar cuando recibe la primera peticion (~30 segundos). |
| **Cascade** | Operacion de BD que propaga acciones en cadena. Si se borra una incidencia, se borran automaticamente sus imagenes y comentarios asociados. |
| **Eager loading** | Cargar relaciones automaticamente al consultar una entidad. Los comentarios de una incidencia se cargan siempre al consultar la incidencia. |
| **Multipart/form-data** | Formato de envio HTTP que permite adjuntar archivos binarios (imagenes) junto con datos de texto en la misma peticion. |
| **application/x-www-form-urlencoded** | Formato de envio HTTP que usan los formularios HTML por defecto. Los campos van en el body como `key1=value1&key2=value2`. NestJS lo soporta gracias a `app.use(urlencoded({ extended: true }))` en `main.ts`. |
| **API REST** | Arquitectura de comunicacion donde el cliente y el servidor intercambian datos via HTTP usando verbos (GET, POST, PATCH, DELETE) y URLs que representan recursos. |
| **path_provider** | Paquete Flutter que da acceso a directorios del sistema (cache, temp, documentos). En esta app se usa para guardar el Excel descargado en `getTemporaryDirectory()`. |
| **open_filex** | Paquete Flutter que abre un archivo local con la app por defecto del sistema. Se usa para abrir el Excel descargado tras solicitar el informe desde la app. |
| **exceljs** | Libreria de Node.js para generar/leer archivos Excel (.xlsx). Permite crear hojas, columnas, filas, formulas, estilos, filtros automaticos y paneles congelados desde el backend. |
| **autoFilter (exceljs)** | Propiedad de una hoja de Excel generada con exceljs que activa los desplegables de filtro en la cabecera. El usuario puede filtrar/ordenar el listado directamente en Excel. |
| **freeze panes** | Tecnica de Excel que mantiene fijas ciertas filas/columnas al hacer scroll. En el informe se congela la primera fila para que la cabecera siempre sea visible. |
| **Token de un solo uso** | Token (UUID) que solo es valido para una accion concreta y se borra/invalida tras usarse. La activacion de cuenta y el reset de contrasena usan este patron. |
| **Enumeracion de usuarios** | Vulnerabilidad en la que el sistema revela si un email esta registrado (por ejemplo, devolviendo "usuario no encontrado" en el reset). Se mitiga devolviendo siempre el mismo mensaje generico. |
| **Next.js** | Framework de React que añade renderizado en el servidor (SSR), routing automático basado en carpetas (App Router) y middleware. Usado en la web de administración. |
| **Tailwind CSS** | Framework de CSS basado en clases utilitarias (`flex`, `p-4`, `bg-blue-500`). Se compila al build para incluir solo las clases usadas. Permite construir UIs sin escribir CSS personalizado. |
| **Recharts** | Librería de gráficos para React equivalente a `fl_chart` en Flutter. Se usa en el dashboard de la web. |
| **Middleware (Next.js)** | Función que se ejecuta antes de cargar cada página. Equivalente a un guard global. En la web protege las rutas privadas comprobando la cookie del JWT. |
| **Rewrite (Next.js)** | Reescritura de rutas en el servidor de Next.js. Permite redirigir peticiones internas a otros dominios sin que el navegador lo sepa, evitando problemas de CORS. |
| **CORS** | Política de seguridad del navegador que impide que una página web haga peticiones a un dominio distinto del suyo. Se sortea en la web admin con un rewrite. |
| **App Router** | Sistema de rutas de Next.js 13+ basado en carpetas dentro de `app/`. Cada `page.tsx` es una ruta. Permite layouts anidados y server components. |

---

## 21. FOTO DE PERFIL DE USUARIO

### 21.1 Funcionamiento

Cualquier usuario autenticado (ciudadano o admin) puede subir una foto de perfil desde la pantalla `ProfilePage` de la app móvil. La foto reemplaza al avatar generado con la inicial del nombre tanto en el dashboard como en el panel de gestión de usuarios del admin.

### 21.2 Flujo paso a paso

1. El usuario pulsa el avatar circular en `ProfilePage` (con un pequeño icono de cámara superpuesto en la esquina inferior derecha)
2. Se abre un `ModalBottomSheet` con dos opciones: cámara o galería
3. `ImagePicker.pickImage()` con `maxWidth: 512`, `maxHeight: 512`, `imageQuality: 85`
4. La imagen seleccionada se sube a Cloudinary reutilizando el endpoint existente `POST /files/incident` (no se creó uno nuevo, simplificación intencional — Cloudinary almacena todo en la misma carpeta `martos_incidents`)
5. Cloudinary devuelve la URL HTTPS segura
6. Se hace `PATCH /api/v1/users/{id}` con `{fotoPerfil: url}` para guardar la URL en la BD
7. `AuthProvider` actualiza el `_user` y notifica a los listeners
8. La UI se reconstruye automáticamente con la nueva foto

### 21.3 Backend

- Campo `fotoPerfil: string | null` en la entidad `User`
- `UpdateUserDto` extiende `PartialType(CreateUserDto)` y añade explícitamente `fotoPerfil` (no estaba en el DTO original de creación)
- `formatUser()` incluye `fotoPerfil` en la respuesta JSON

### 21.4 Frontend

- `UserModel` tiene la propiedad `String? profilePhoto` y un getter `bool get hasProfilePhoto`
- En `DashboardPage` el `CircleAvatar` usa `backgroundImage: NetworkImage(user.profilePhoto!)` si existe, o muestra la inicial si no
- En `AdminUsersPage` se muestra la foto de cada usuario en su tarjeta correspondiente

### 21.5 Notas técnicas

- Las fotos se redimensionan en el cliente antes de subir (máximo 512x512) para reducir bandwidth
- Si el usuario está bloqueado, en el panel admin se muestra el icono de bloqueo en vez de la foto
- El endpoint `/files/incident` no requiere autenticación (riesgo residual documentado)

---

## 22. WEB DE ADMINISTRACIÓN

La aplicación cuenta con un **tercer cliente** además de la app móvil: un **panel web** desarrollado en Next.js destinado al uso del administrador desde un navegador. Está pensado para gestión avanzada (tablas grandes, filtros combinados, exportación rápida) que se hace incómoda en pantalla pequeña.

### 22.1 Stack tecnológico

| Tecnología | Versión | Para qué |
|------------|---------|----------|
| Next.js | 14.2 | Framework React con App Router y SSR |
| React | 18 | Librería de UI |
| TypeScript | 5.x | Tipado estático |
| Tailwind CSS | 3.4 | Estilos utilitarios |
| Axios | 1.15 | Cliente HTTP equivalente a Dio |
| Recharts | 3.8 | Gráficos del dashboard (equivalente a fl_chart) |
| js-cookie | 3.0 | Lectura/escritura de cookies para el JWT |

### 22.2 Estructura del proyecto

```
web_incidencias/
├── app/                            # App Router de Next.js
│   ├── layout.tsx                  # Layout raíz con AuthProvider
│   ├── page.tsx                    # Redirige a /dashboard
│   ├── login/page.tsx              # Login exclusivo de admins
│   ├── dashboard/
│   │   ├── layout.tsx              # Usa AdminLayout
│   │   └── page.tsx                # KPIs + 3 gráficos
│   ├── incidents/
│   │   ├── layout.tsx
│   │   ├── page.tsx                # Tabla con filtros + edición masiva
│   │   └── [id]/page.tsx           # Detalle de incidencia
│   └── users/
│       ├── layout.tsx
│       └── page.tsx                # Gestión de usuarios
├── components/
│   ├── AdminLayout.tsx             # Layout común con sidebar + header + guard
│   ├── Sidebar.tsx                 # Navegación lateral
│   ├── Header.tsx                  # Barra superior con info usuario y logout
│   ├── StatsCard.tsx               # Tarjeta KPI
│   ├── StatusBadge.tsx             # Badge coloreado por estado
│   ├── PriorityBadge.tsx           # Badge coloreado por prioridad
│   ├── StatusChart.tsx             # PieChart de Recharts (donut por estado)
│   ├── PriorityChart.tsx           # BarChart por prioridad
│   ├── MonthlyChart.tsx            # AreaChart evolución mensual
│   └── ConfirmDialog.tsx           # Modal de confirmación
├── hooks/
│   └── useAuth.tsx                 # Context API + hook de autenticación
├── services/
│   ├── api.ts                      # Axios + interceptores JWT
│   ├── auth.service.ts             # Login, logout, restoreSession
│   ├── incidents.service.ts        # CRUD incidencias
│   └── users.service.ts            # Gestión usuarios
├── middleware.ts                   # Protección de rutas a nivel de Next.js
├── next.config.mjs                 # Rewrites de API + imágenes Cloudinary
├── tailwind.config.ts              # Colores corporativos
└── public/logo.png
```

### 22.3 Páginas implementadas

#### /login
- Email + contraseña con toggle de visibilidad
- Llama a `POST /users/login`
- Después hace `GET /users/{id}` para obtener el rol
- **Si el rol no es admin → rechaza el acceso y limpia la sesión** (la web es exclusiva de administradores)
- Spinner durante la autenticación

#### /dashboard
- 4 tarjetas KPI: total, pendientes, en progreso, resueltas
- Donut chart por estado (Recharts `PieChart`)
- Bar chart por prioridad (Recharts `BarChart`)
- Area chart de evolución mensual de los últimos 6 meses (Recharts `AreaChart`)
- Todos los cálculos se hacen en cliente a partir de `GET /incidents`

#### /incidents
- **Tabla paginada** con 15 incidencias por página
- **Filtros combinados**: búsqueda por texto, estado, prioridad
- **Ordenación clickable** por columnas (fecha creación, fecha actualización, ascendente/descendente)
- **Edición en línea**: selectores de estado y prioridad directamente en cada fila
- **Sistema de cambios pendientes**: las modificaciones se acumulan en estado local y se envían al backend pulsando "Guardar cambios"
- **Indicador visual** de campos modificados (marcados en naranja)
- **Botón "Descartar cambios"** para revertir
- **Exportación a Excel** con los filtros aplicados

#### /incidents/[id]
- Datos completos de la incidencia (título, descripción, dirección, coordenadas)
- **Galería de imágenes** en grid con modal de ampliación
- **Timeline de comentarios** ordenado por fecha
- **Formulario** para añadir nuevos comentarios
- **Panel lateral** con controles de estado y prioridad
- **Botón eliminar** con `ConfirmDialog`

#### /users
- Tabla con foto de perfil, nombre, email, rol, estado y nº incidencias
- **Filtros**: búsqueda por nombre/email, filtro por rol
- **Edición masiva**: cambiar rol, bloquear/desbloquear, marcar para eliminar — todo con cambios pendientes
- **Filas tachadas en rojo** para usuarios marcados para eliminar
- **Botón "Guardar cambios"** que dispara todas las operaciones en lote
- **Exportación a Excel**

### 22.4 Sistema de autenticación

La web reutiliza al 100% los endpoints del backend. Particularidades:

**Almacenamiento del JWT**: en cookies (`access_token` y `user_id`) en vez de `localStorage`. Esto es **necesario** porque el `middleware.ts` de Next.js se ejecuta en el servidor, donde no existe `localStorage` — solo se pueden leer cookies.

**Tres niveles de protección**:

1. **`middleware.ts`** (servidor): Comprueba si la cookie `access_token` existe antes de servir cualquier ruta protegida. Si no existe, redirige a `/login` antes incluso de que se renderice el componente. Es el equivalente al `redirect` global del `GoRouter` de Flutter.

2. **`AdminLayout`** (cliente): Comprueba si `useAuth()` tiene un `user`. Si no, redirige a `/login`. Esto cubre el caso en el que la cookie existe pero el contexto aún no se ha cargado.

3. **Interceptor de Axios**: Si cualquier petición devuelve `401 Unauthorized` (token expirado o inválido), se limpian las cookies y se redirige a `/login`. Esto garantiza un cierre de sesión automático cuando el token caduca.

**Filtro de rol**: El `AuthProvider` solo acepta usuarios con `rol === 'admin'`. Si un ciudadano intenta loguearse, la sesión se limpia y se muestra un error.

### 22.5 Solución del problema de CORS

El backend está en `https://backendincidenciasnest.onrender.com` y la web se ejecuta en otro dominio. Por defecto, los navegadores bloquean las peticiones HTTP entre dominios distintos (política CORS). Habría dos soluciones:

1. Configurar CORS en el backend (cambios en NestJS)
2. **Usar un rewrite de Next.js** (cero cambios en backend) — esta es la elegida

En `next.config.mjs`:
```javascript
async rewrites() {
  return [{
    source: '/api/v1/:path*',
    destination: 'https://backendincidenciasnest.onrender.com/api/v1/:path*',
  }];
}
```

Cuando la web hace una petición a `/api/v1/incidents`, Next.js la captura **en el servidor** y la reenvía al backend real. Como la petición sale del servidor (no del navegador), CORS no aplica.

### 22.6 Sistema de cambios pendientes (batch save)

A diferencia de la app móvil, donde cada acción dispara una petición HTTP inmediata, la web admin acumula los cambios en estado local y los envía en lote al pulsar "Guardar cambios":

**Ventajas:**
- Permite editar varios usuarios o incidencias y revertir antes de guardar
- Reduce el número de peticiones al backend (importante en Render con cold start)
- Mejor UX para gestión masiva

**Implementación:**
- Las celdas editables tienen estado local controlado
- Las celdas modificadas se marcan visualmente (color naranja)
- Al guardar, se itera sobre los cambios y se hacen todas las peticiones `PATCH` y `DELETE`
- Después se recarga la lista desde el backend para sincronizar

### 22.7 Diseño y consistencia visual

La web reutiliza la **misma paleta de colores corporativa** que la app:
- Primary: `#2C5F7C` (azul petróleo)
- Accent: `#C4704B` (terracota)
- Background: `#FAF7F2` (crema)
- Estados: naranja (pendiente), azul (en progreso), verde (resuelto), rojo (rechazada)

Tipografía: **Poppins** (la misma que la app).

Esta coherencia visual hace que un admin que use ambas plataformas (móvil y web) tenga una experiencia unificada.

### 22.8 Despliegue

- **Plataforma**: Vercel (de los mismos creadores de Next.js)
- **Auto-deploy**: cada push a `main` en GitHub dispara un nuevo deploy
- **Plan gratuito**: builds ilimitados, dominio `*.vercel.app`
- **Variable de entorno**: `NEXT_PUBLIC_API_URL` (URL del backend)

### 22.9 Repositorio

- GitHub: [web-incidencias-next](https://github.com/DanielMVenzala/web-incidencias-next)
- Independiente de los repos del backend y del frontend móvil
- Los tres proyectos consumen la misma API REST del backend

---

## 23. DECISIONES TÉCNICAS RELEVANTES

Esta sección recoge las decisiones técnicas no triviales tomadas durante el desarrollo, con su contexto y justificación. Es de las secciones más valiosas para la defensa del TFG porque demuestra capacidad de análisis y resolución de problemas.

### 23.1 Resend en lugar de Nodemailer/SMTP

**Problema**: El plan gratuito de Render bloquea conexiones SMTP salientes en los puertos 25, 465 y 587. Esto provoca un `Connection timeout` cuando se intenta enviar emails de activación con Nodemailer + Gmail.

**Solución**: Migrar a Resend, que envía emails mediante una API HTTP. Las peticiones HTTP no están bloqueadas por Render. Se mantiene la misma lógica del servicio (`MailService`) pero el transporte cambia.

### 23.2 Google Places Autocomplete enrutado por el backend

**Problema**: La API Key de Google Maps está restringida al paquete Android (`com.example.front_incidencias`) + huella SHA-1. Esta restricción funciona para el `Maps SDK` (renderizado del mapa visual), pero **no** para llamadas HTTP directas a Geocoding y Places.

**Solución**: Usar **dos API Keys distintas**:
- Key 1: para Android (Maps SDK), restringida por paquete + SHA-1. Está en `AndroidManifest.xml`.
- Key 2: para el backend (Geocoding + Places), restringida solo a esas dos APIs. Está en variable de entorno de Render.

El frontend Flutter llama al backend (`GET /incidents/places/autocomplete`), y el backend llama a Google con la Key 2. Así nunca se expone una API Key sin restricción de plataforma.

### 23.3 Reset de contraseña con formulario HTML servido por el backend

**Alternativas evaluadas**:
1. Deep links nativos en Android (configurar `intent-filter` para que el enlace abra la app)
2. Página HTML servida por el backend con un formulario simple

**Decisión**: Opción 2.

**Razones**: Los deep links requieren configuración nativa (`intent-filter` en `AndroidManifest.xml`, validación de dominio con archivo `assetlinks.json` en el servidor) y son frágiles si la app no está instalada. La página HTML funciona en cualquier navegador, no requiere configuración adicional, y reutiliza la infraestructura de NestJS para servir la vista.

### 23.4 Validación geográfica con la fórmula Haversine

**Problema**: Aunque la query a Google Geocoding incluye `components=country:ES`, eso solo filtra por país. Un usuario podría introducir una dirección de Madrid o Sevilla y la geocodificación devolvería coordenadas válidas, creando una incidencia que aparecería fuera de Martos en el mapa.

**Solución**: Después de obtener las coordenadas, calcular la distancia al centro de Martos (37.7210, -3.9720) usando la fórmula Haversine. Si la distancia supera 5 km, se rechaza la dirección con error 400.

**Por qué Haversine y no distancia euclidiana**: Las coordenadas geográficas no son cartesianas. La distancia euclidiana entre dos puntos cercanos en latitud/longitud sería incorrecta porque la Tierra es una esfera. Haversine tiene en cuenta la curvatura.

### 23.5 Cookies en la web admin (en vez de localStorage)

**Problema**: El `middleware.ts` de Next.js se ejecuta **en el servidor** antes de que la página llegue al navegador. En el servidor no existe `localStorage` (es una API del navegador).

**Solución**: Almacenar el JWT en cookies. El servidor sí puede leer las cookies de la petición HTTP entrante (`request.cookies.get('access_token')`). Así el middleware puede comprobar si hay sesión antes de renderizar la página.

### 23.6 Rewrites de Next.js para evitar CORS

**Problema**: La web está en un dominio (Vercel) y el backend en otro (Render). Los navegadores bloquean peticiones HTTP entre dominios distintos por seguridad (CORS).

**Alternativas**:
1. Configurar CORS en el backend con `app.enableCors()`
2. Usar rewrites en Next.js para que las peticiones salgan del servidor

**Decisión**: Opción 2.

**Razones**: La opción 1 requiere modificar el backend, que también es consumido por la app Flutter (donde CORS no aplica porque no es un navegador). Habría que añadir whitelisting de dominios. La opción 2 es 4 líneas en `next.config.mjs` y no toca el backend para nada.

### 23.7 Token de un solo uso para activación y reset

**Decisión**: Tanto el `activationToken` como el `resetToken` se borran de la BD tras su uso (`user.resetToken = null`).

**Por qué**: Si un atacante intercepta uno de estos enlaces, lo único que puede hacer es usarlo una vez. Una vez usado, queda invalidado. Además, el `resetToken` tiene una expiración temporal de 1 hora.

### 23.8 Mitigación contra enumeración de usuarios

**Problema**: En el endpoint `/users/forgot-password`, si devolviéramos `404 "Usuario no encontrado"` cuando el email no existe, un atacante podría enumerar emails registrados (probar miles de emails y ver cuáles existen).

**Solución**: Devolver siempre el mismo mensaje genérico ("Si el email existe, recibirás un enlace...") tanto si el usuario existe como si no. El atacante no puede distinguir.

### 23.9 Dos roles solo (sin granularidad)

**Decisión**: Solo existen los roles `usuario` y `admin`, sin niveles intermedios (moderador, supervisor, etc.).

**Razón**: KISS (Keep It Simple, Stupid). Para el caso de uso real (un ayuntamiento pequeño), no hay necesidad de roles intermedios. Si en un futuro se necesitan, el sistema de guards (`@RoleProtected`) ya soporta arrays de roles, así que la migración sería trivial.

### 23.10 Sistema de cambios pendientes en la web

**Problema**: Si cada cambio en la tabla de la web (cambiar estado de una incidencia, bloquear un usuario) disparase una petición HTTP inmediata, el admin haría decenas de peticiones al editar varios elementos. En Render con cold start, cada petición tras un periodo de inactividad tarda ~30s.

**Solución**: Acumular los cambios en estado local y enviarlos en lote al pulsar "Guardar cambios". Esto reduce las peticiones, mejora la UX (se puede revertir), y reduce el coste de cold start.

---

## 24. TRABAJO FUTURO Y MEJORAS

Posibles ampliaciones documentadas como roadmap:

### 24.1 Seguridad

- **Rate limiting** en login y registro con `@nestjs/throttler` para prevenir fuerza bruta
- **Refresh tokens** además del access token, para sesiones más seguras
- **Verificación de propiedad en `PATCH /users/:id`**: comprobar que `req.user.id === params.id` para evitar que un usuario modifique a otro
- **Autenticación en `POST /incidents`** y `POST /files/incident`: actualmente públicos
- **Logs de auditoría**: registrar quién cambia qué y cuándo

### 24.2 Funcionalidades

- **Notificaciones push** al usuario cuando el admin cambia el estado de su incidencia
- **Comentarios bidireccionales**: permitir al ciudadano responder a las notas del admin
- **Categorías de incidencias** (limpieza, alumbrado, mobiliario...) para mejorar el filtrado
- **Área de cobertura configurable**: actualmente 5 km hardcodeado. Hacerlo configurable por admin
- **Modo oscuro en la web admin** (actualmente solo claro)

### 24.3 Tests automatizados

- Tests unitarios de los servicios de NestJS con Jest
- Tests de integración de los endpoints con SuperTest
- Widget tests en Flutter con `flutter_test`
- Tests E2E en la web con Playwright

### 24.4 Despliegue

- Migración del backend a un plan de pago en Render (sin cold start)
- CDN para imágenes (aunque Cloudinary ya cumple esa función)
- Métricas y alertas (Sentry, LogRocket, etc.)

### 24.5 UX

- Onboarding interactivo en la primera apertura de la app
- Skeleton screens en lugar de `CircularProgressIndicator`
- Pull-to-refresh con animación más cuidada

---

## 25. CONCLUSIONES

### 25.1 Objetivos cumplidos

El proyecto Martos Arregla cumple en su totalidad los objetivos planteados al inicio:

- Plataforma funcional de gestión de incidencias urbanas, desplegada y operativa
- App móvil nativa para Android (Flutter) con todas las funcionalidades para el ciudadano
- Panel web (Next.js) para gestión avanzada del administrador
- Backend REST (NestJS) que da servicio a ambos clientes
- Persistencia en PostgreSQL con TypeORM
- Servicios externos integrados: Cloudinary, Google Maps Platform, Resend
- Seguridad implementada en múltiples capas

### 25.2 Aprendizajes técnicos

Durante el desarrollo se ha trabajado con tecnologías y conceptos no abordados en el ciclo formativo:

- Frameworks modernos de **Flutter** (Dart) y **NestJS** (TypeScript)
- Despliegue en la nube con **Render**, **Neon**, **Vercel** y **Cloudinary**
- API REST con autenticación **JWT** y guards personalizados
- **ORM** (TypeORM) y migraciones automáticas de esquema
- **Validación geográfica** con la fórmula Haversine
- **Generación de informes Excel** desde el servidor con `exceljs`
- **Geocodificación y autocompletado** con Google Maps Platform
- Diseño responsive y multi-cliente con la **misma API**

### 25.3 Dificultades superadas

- **Bloqueo SMTP en Render**: resuelto migrando a Resend (API HTTP)
- **Restricción de la API Key de Google Maps a Android**: resuelto usando dos keys distintas y enrutando peticiones por el backend
- **CORS entre la web y el backend**: resuelto con rewrites de Next.js
- **Configuración de iconos y nombre de la app**: resuelto con `flutter_launcher_icons` y `AndroidManifest.xml`
- **Restauración de sesión con tokens caducados**: resuelto con un timeout global y limpieza automática

### 25.4 Valor académico y profesional

El proyecto demuestra capacidad para:

- Trabajar con **múltiples lenguajes y stacks** simultáneamente (Dart, TypeScript, SQL)
- Desarrollar **tres clientes** independientes (móvil, web, API) que consumen la misma fuente
- Tomar **decisiones técnicas** justificadas frente a problemas reales
- **Desplegar en la nube** y gestionar servicios de producción
- Implementar **medidas de seguridad** profesionales
- Documentar el proyecto de forma estructurada

### 25.5 Cierre

Martos Arregla es un proyecto completo, funcional y desplegado, que va más allá de los requisitos típicos de un TFG de Desarrollo de Aplicaciones Multiplataforma. La combinación de app móvil + panel web + API REST en producción ofrece una experiencia de desarrollo cercana a un entorno profesional real, y deja una base sólida sobre la que escalar funcionalidades futuras.
