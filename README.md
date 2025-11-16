# GitHub Issues PWA

Una Progressive Web App (PWA) construida con Vue 3, TypeScript y Vite que permite listar todos los issues abiertos de tus repositorios de GitHub.

**🌐 Demo en vivo:** [https://seyacat.github.io/github-issues/](https://seyacat.github.io/github-issues/)

## 🚀 Despliegue en GitHub Pages

La aplicación se despliega automáticamente en GitHub Pages cuando se actualiza la rama `main`. El workflow está configurado en [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml).

### Configuración para GitHub Pages

1. Ve a **Settings** > **Pages** en tu repositorio
2. En **Source**, selecciona **GitHub Actions**
3. El workflow se ejecutará automáticamente en cada push a `main`
4. La aplicación estará disponible en: `https://[tu-usuario].github.io/github-issues/`

## Características

- **PWA**: Instalable y funciona offline
- **Autenticación**: Conexión con GitHub usando tokens de acceso personal
- **Almacenamiento**: Token guardado en localStorage
- **Lista de Issues**: Muestra todos los issues abiertos de todos los repositorios públicos
- **Hipervínculos**: Enlaces directos a los issues en GitHub
- **Responsive**: Diseño adaptable a diferentes dispositivos

## Requisitos

- Node.js 16 o superior
- Un token de acceso personal de GitHub

## Instalación

1. Instalar dependencias:
```bash
npm install
```

2. Ejecutar en modo desarrollo:
```bash
npm run dev
```

3. Construir para producción:
```bash
npm run build
```

## Configuración

1. Ve a [GitHub Settings > Developer settings > Personal access tokens](https://github.com/settings/tokens)
2. Genera un nuevo token con los siguientes permisos:
   - `repo` (acceso completo a repositorios)
   - `read:org` (lectura de organizaciones)
3. **Para repositorios privados y de colaboración** asegúrate de que el token tenga permisos de repositorio
4. Copia el token y pégarlo en la aplicación

**Nota sobre repositorios privados:**
- La aplicación ahora muestra **todos los repositorios** a los que tienes acceso
- Incluye repositorios propios (públicos y privados)
- Incluye repositorios de organizaciones donde eres miembro
- Incluye repositorios donde eres colaborador

## Uso

1. Abre la aplicación en tu navegador
2. Ingresa tu token de GitHub
3. Haz clic en "Cargar Issues"
4. La aplicación mostrará todos los issues abiertos de tus repositorios
5. Haz clic en cualquier issue para abrirlo en GitHub

## Estructura del Proyecto

```
src/
├── App.vue                 # Componente principal
├── main.ts                 # Punto de entrada
├── style.css              # Estilos globales
├── vite-env.d.ts          # Definiciones de TypeScript
└── services/
    └── githubService.ts   # Servicio para API de GitHub
```

## Tecnologías

- Vue 3 con Composition API
- TypeScript
- Vite
- PWA (Vite Plugin PWA)
- GitHub REST API

## Notas

- La aplicación solo muestra issues de repositorios públicos
- El token se almacena localmente en el navegador
- Los datos se obtienen en tiempo real desde GitHub API
- La aplicación es completamente cliente-side