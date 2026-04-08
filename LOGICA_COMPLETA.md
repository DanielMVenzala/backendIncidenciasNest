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

---

## 13. ESTADISTICAS (ADMIN)

La pagina de estadisticas (`statistics_page.dart`) no tiene endpoint propio en el backend. Carga todas las incidencias con `IncidentProvider.loadAllIncidents()` y calcula las estadisticas en el frontend:

1. **Tarjetas resumen**: cuenta total, pendientes, en progreso y resueltas
2. **Grafico donut** (por estado): usa `PieChart` de `fl_chart`, colores alineados con los marcadores del mapa
3. **Grafico de barras** (por prioridad): baja, media, alta, critica con colores diferenciados
4. **Grafico de barras** (por mes): muestra los ultimos 6 meses, cuenta incidencias por `createdAt.month`

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
│   │   └── login-user.dto.ts            # Validacion de login
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
    ├── login_page.dart                  # Pantalla de login
    ├── register_page.dart               # Pantalla de registro + activacion
    ├── dashboard_page.dart              # Menu principal (diferente por rol)
    ├── create_incident_page.dart        # Crear incidencia (fotos, autocompletado)
    ├── incidents_list_page.dart          # Lista con filtros y ordenacion
    ├── incident_detail_page.dart        # Detalle con carousel, zoom, timeline
    ├── profile_page.dart                # Editar nombre y contrasena
    ├── admin_users_page.dart            # Gestion usuarios (bloquear/eliminar)
    ├── incidents_map_page.dart          # Mapa Google Maps con marcadores
    ├── statistics_page.dart             # Graficos con fl_chart
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
| **API REST** | Arquitectura de comunicacion donde el cliente y el servidor intercambian datos via HTTP usando verbos (GET, POST, PATCH, DELETE) y URLs que representan recursos. |
