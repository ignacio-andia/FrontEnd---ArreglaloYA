# ArreglaloYA — Frontend

Aplicación web frontend del proyecto **Servicios del Hogar**, desarrollada con Angular.

## Requisitos

Este proyecto está preparado para desarrollarse en **Windows 10/11 de 64 bits**.

Instala lo siguiente antes de ejecutar la aplicación:

| Herramienta | Versión requerida/recomendada | Uso |
|---|---:|---|
| Node.js | **26.13.1 LTS** | Entorno de ejecución |
| npm | **11.20.0** (incluido con Node.js 26.13.1) | Instalación de dependencias |
| Angular | **22.2.6** | Framework frontend |
| Angular CLI | **22.2.7** | Herramientas Angular |
| Git | Versión estable actual | Clonar y actualizar el repositorio |
| Visual Studio Code | Opcional, recomendado | Editor de código |

Angular 22 requiere Node.js `^22.22.3`, `^24.15.0` o `^26.0.0`, TypeScript `>=6.0.0 <6.1.0` y RxJS `^6.5.3` o `^7.4.0`. Las dependencias exactas del proyecto se encuentran declaradas en `package.json` y bloqueadas en `package-lock.json`.

> **Importante:** utiliza Node.js 26.13.1 para mantener el mismo entorno que el equipo. No es necesario instalar Angular CLI globalmente: el proyecto incluye Angular CLI como dependencia local y los comandos npm utilizan esa versión.

## 1. Instalar Node.js

1. Descarga el instalador oficial de Node.js 26.13.1 para Windows:
   - [Node.js 26.13.1 — instalador Windows x64 (.msi)](https://nodejs.org/dist/v26.13.1/node-v26.13.1-x64.msi)
   - Para equipos Windows ARM64, utiliza el instalador ARM64 disponible en [la página oficial de la versión](https://nodejs.org/en/download/archive/v26.13.1).
2. Ejecuta el instalador y conserva las opciones predeterminadas.
3. Cierra y vuelve a abrir PowerShell, CMD o Visual Studio Code para actualizar las rutas de la terminal.
4. Comprueba la instalación:

```powershell
node --version
npm.cmd --version
```

Resultados esperados:

```text
v26.13.1
11.20.0
```

Si Windows no reconoce `node` o `npm`, reinicia la terminal. Si continúa el problema, revisa que Node.js esté agregado al `PATH` de Windows.

## 2. Clonar el repositorio

Abre PowerShell o CMD en la carpeta donde guardarás el proyecto y ejecuta:

```powershell
git clone <URL_DEL_REPOSITORIO>
cd <CARPETA_DEL_REPOSITORIO>
```

Reemplaza `<URL_DEL_REPOSITORIO>` por la dirección HTTPS o SSH del repositorio frontend.

## 3. Instalar las dependencias

Desde la carpeta raíz del frontend —donde están `package.json` y `package-lock.json`— ejecuta:

```powershell
npm.cmd ci
```

`npm ci` instala las versiones registradas en `package-lock.json`, sin modificar el archivo de bloqueo. Es el método recomendado para preparar una copia limpia del proyecto.

Si el repositorio todavía no incluye `package-lock.json`, utiliza:

```powershell
npm.cmd install
```

### Si PowerShell bloquea `npm`

En algunos equipos, PowerShell puede mostrar un error indicando que no puede ejecutar `npm.ps1` debido a la política de ejecución de scripts.

No es necesario cambiar la política de seguridad de Windows. Utiliza el ejecutable `.cmd`:

```powershell
npm.cmd ci
```

o:

```powershell
npm.cmd install
```

También se incluyen los archivos `install.cmd` y `start.cmd` para ejecutar la instalación y el servidor sin escribir esos comandos manualmente.

## 4. Ejecutar la aplicación

Una vez instaladas las dependencias, ejecuta desde la raíz del frontend:

```powershell
npm.cmd start
```

El servidor de desarrollo estará disponible en:

**http://localhost:4200/**

Para detenerlo, vuelve a la terminal y presiona `Ctrl + C`.

También puedes iniciar la aplicación ejecutando `start.cmd` desde el Explorador de archivos o desde CMD.

## 5. Archivos auxiliares para Windows

En la raíz del proyecto se pueden mantener estos dos archivos:

- `install.cmd`: instala las dependencias usando `npm.cmd ci` (o `npm.cmd install` si no existe `package-lock.json`).
- `start.cmd`: inicia el servidor con `npm.cmd start`. Si no encuentra `node_modules`, ejecuta primero `install.cmd`.

Los archivos `.cmd` **no instalan Node.js**. Node.js debe estar instalado previamente y disponible en el `PATH`.

## 6. Comandos útiles

| Acción | Comando |
|---|---|
| Ver versión de Node.js | `node --version` |
| Ver versión de npm | `npm.cmd --version` |
| Instalar exactamente desde el lockfile | `npm.cmd ci` |
| Instalar/actualizar dependencias según package.json | `npm.cmd install` |
| Iniciar servidor de desarrollo | `npm.cmd start` |
| Compilar para producción | `npm.cmd run build` |
| Ejecutar pruebas | `npm.cmd test` |

Consulta `package.json` para ver los scripts disponibles y sus definiciones.

## 7. Conexión con el backend

El frontend se ejecuta por defecto en `http://localhost:4200/`. Para utilizar las funciones que consumen datos, también debe estar iniciado el backend NestJS.

- Frontend: `http://localhost:4200`
- Backend: utiliza la URL y el puerto configurados en el repositorio backend.

CORS se configura en el backend NestJS. El backend debe permitir el origen del frontend (`http://localhost:4200`) durante el desarrollo. La URL base de la API debe coincidir con la configuración vigente del frontend y del backend.

> La instalación del frontend no instala ni configura PostgreSQL ni inicia el backend. Consulta el README del repositorio backend para sus requisitos, variables de entorno, base de datos y comandos de ejecución.

## Solución de problemas

### `npm` no se puede ejecutar en PowerShell

Usa `npm.cmd` en lugar de `npm`:

```powershell
npm.cmd ci
npm.cmd start
```

O ejecuta `install.cmd` y `start.cmd`.

### `ng` no se reconoce como comando

No necesitas instalar Angular CLI globalmente. Utiliza los scripts del proyecto:

```powershell
npm.cmd start
```

### Error de dependencias o instalación incompleta

Desde la raíz del frontend, vuelve a instalar desde el archivo de bloqueo:

```powershell
npm.cmd ci
```

Si persiste un error, comprueba que estás en la carpeta que contiene `package.json` y `package-lock.json`, y verifica las versiones de Node.js y npm.

### El puerto 4200 está ocupado

Cierra el otro proceso que está utilizando el puerto 4200 o consulta la ayuda de Angular CLI para iniciar el servidor en otro puerto. Si se cambia el puerto, el backend deberá permitir el nuevo origen mediante CORS.

## Referencias oficiales

- [Angular — compatibilidad de versiones](https://angular.dev/reference/versions)
- [Angular — documentación](https://angular.dev/)
- [Node.js 26.13.1 — versión y descargas](https://nodejs.org/en/download/archive/v26.13.1)
- [npm — documentación](https://docs.npmjs.com/)
