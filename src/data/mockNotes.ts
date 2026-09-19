import { NexusNote } from '../utils/graphParser';

/**
 * =======================================================================
 * BASE DE DATOS NEXUS: 28 NOTAS SINTÉTICAS INTERCONECTADAS
 * =======================================================================
 * Notas estilo Obsidian / Zettelkasten con enlaces bidireccionales [[WikiLinks]]
 * y etiquetas #tag temáticas para visualización en el motor 3D C-137.
 */

export const MOCK_NEXUS_NOTES: NexusNote[] = [
  {
    id: 'note-001',
    title: 'Protocolo C-137: Núcleo Neural',
    category: 'Arquitectura',
    tags: ['cyberpunk', 'core', 'neural'],
    updatedAt: '2026-09-15',
    content: `
# Protocolo C-137: Núcleo Neural

El núcleo neural C-137 orquesta la topología de red distribuida en un espacio tridimensional euclidiano. 
Su objetivo es servir como interfaz perceptiva de alta velocidad entre bases de conocimiento y operadores cibernéticos.

### Componentes Críticos
- Invocación del motor visual central: [[Arquitectura WebGL]].
- Integración de dinámicas no lineales: [[Simulación de Fuerzas 3D]].
- Retransmisión de paquetes: [[Criptografía Cuántica]].

\`\`\`ts
interface KernelState {
  dimension: 'RHO-C137';
  entropy: number;
  activeNodes: 150;
}
\`\`\`

Todo el sistema opera sincronizado con el [[Zustand State Store]] para persistencia reactiva en memoria.
`
  },
  {
    id: 'note-002',
    title: 'Arquitectura WebGL',
    category: 'Frontend 3D',
    tags: ['webgl', 'threejs', 'optimizacion'],
    updatedAt: '2026-09-14',
    content: `
# Arquitectura WebGL y Pipelines Gráficos

Estrategia de renderizado para proyectar miles de entidades simultáneamente sin penalización en el CPU principal.

- Técnica principal: [[InstancedMesh Rendering]].
- Sombreadores de resplandor: [[Postprocesado con Bloom]].
- Control topológico: [[BufferGeometry y Shaders]].

Las llamadas de dibujado (*draw calls*) se reducen a **1 única pasada** para toda la malla nodal.
`
  },
  {
    id: 'note-003',
    title: 'InstancedMesh Rendering',
    category: 'Frontend 3D',
    tags: ['webgl', 'rendimiento', 'gpu'],
    updatedAt: '2026-09-12',
    content: `
# InstancedMesh Rendering a 60 FPS

Al renderizar geometrías repetitivas como icosaedros y esferas, \`InstancedMesh\` almacena las matrices de transformación en búferes de memoria GPU contiguos.

### Beneficios
1. Cero overhead en el recolector de basura de JavaScript.
2. Actualización por raycast en tiempo constante $O(1)$.
3. Integración con [[Arquitectura WebGL]] y [[BufferGeometry y Shaders]].
`
  },
  {
    id: 'note-004',
    title: 'Simulación de Fuerzas 3D',
    category: 'Algoritmos',
    tags: ['matematicas', 'grafos', 'fisica'],
    updatedAt: '2026-09-11',
    content: `
# Simulación de Fuerzas 3D (d3-force-3d)

La disposición espacial del grafo se estabiliza utilizando resortes mecánicos virtuales y repulsión electrostática de Coulomb.

- **Repulsión Many-Body**: Fuerza de repulsión entre todos los nodos. Ver [[Algoritmo Barnes-Hut]].
- **Atracción por Enlace**: Ley de Hooke aplicada a los vínculos generados por [[Parser de Markdown]].
- **Centrado Espacial**: Anclaje al origen de coordenadas \`(0,0,0)\`.

Evolucionado a partir de la investigación en [[Topología de Constelaciones]].
`
  },
  {
    id: 'note-005',
    title: 'Postprocesado con Bloom',
    category: 'VFX',
    tags: ['shaders', 'vfx', 'cyberpunk'],
    updatedAt: '2026-09-10',
    content: `
# Postprocesado con Bloom Emisivo

El resplandor cibernético es indispensable para emular pantallas holográficas futuristas.

- Utiliza umbral de luminiscencia selectivo (\`luminanceThreshold: 0.12\`).
- Combinado con [[Efectos Depth of Field]] para dar profundidad focal.
- Resalta nodos definidos en la [[Estética Cyberpunk]].
`
  },
  {
    id: 'note-006',
    title: 'Efectos Depth of Field',
    category: 'VFX',
    tags: ['shaders', 'vfx', 'camara'],
    updatedAt: '2026-09-08',
    content: `
# Depth of Field y Bokeh

Emula las propiedades ópticas de una lente anamórfica de 35mm en el espacio virtual.

- Los nodos situados en el plano de enfoque permanecen ultra-nítidos.
- Las estrellas cósmicas del fondo adquieren desenfoque gaussiano suave.
- Se calibra conjuntamente con [[Postprocesado con Bloom]] y la [[Cámara Cinemática]].
`
  },
  {
    id: 'note-007',
    title: 'Cámara Cinemática',
    category: 'Frontend 3D',
    tags: ['camara', 'ux', 'threejs'],
    updatedAt: '2026-09-07',
    content: `
# Navegación y Cámara Cinemática

Al seleccionar un nodo mediante raycasting, la cámara no salta bruscamente; ejecuta una interpolación lineal (**Vector Lerp**).

- Coordenadas calculadas en base a la normal del nodo seleccionado.
- Ralentiza la rotación de la constelación para facilitar la lectura.
- Sincronizado con el panel de inspección de [[Interfaz Glassmorphism]].
`
  },
  {
    id: 'note-008',
    title: 'Zustand State Store',
    category: 'Arquitectura',
    tags: ['frontend', 'estado', 'rendimiento'],
    updatedAt: '2026-09-06',
    content: `
# Zustand State Store para Datos de Red

Gestor de estado atómico y minimalista para evitar re-renders superfluos en componentes de alta frecuencia de refresco.

- Almacena el grafo procesado por [[Parser de Markdown]].
- Gestiona el nodo seleccionado y el conjunto de vecinos activos.
- Coordina la hidratación con [[Sistemas de Memoria Distribuida]].
`
  },
  {
    id: 'note-009',
    title: 'Parser de Markdown',
    category: 'Algoritmos',
    tags: ['parser', 'pkm', 'herramientas'],
    updatedAt: '2026-09-05',
    content: `
# Parser de Markdown y Extractor de WikiLinks

Motor sintáctico que analiza notas en tiempo real para construir el grafo de conocimiento.

1. **WikiLinks**: Detecta \`[[Título]]\` y genera aristas dirigidas hacia [[Grafo de Conocimiento]].
2. **Hashtags**: Convierte \`#tag\` en nodos de concentración tipo Relé.
3. Alimenta la [[Simulación de Fuerzas 3D]] con la matriz de adyacencia resultante.
`
  },
  {
    id: 'note-010',
    title: 'Grafo de Conocimiento',
    category: 'Investigación',
    tags: ['ia', 'grafos', 'pkm'],
    updatedAt: '2026-09-04',
    content: `
# Grafo de Conocimiento Interconectado

Estructura de datos no lineal inspirada en los hipertextos de Ted Nelson y el modelo Memex de Vannevar Bush.

- Representa relaciones emergentes entre conceptos abstractos.
- Se vincula directamente con [[Protocolo C-137: Núcleo Neural]] y [[Ontología de Datos]].
- Explora patrones de agrupamiento con el [[Algoritmo Barnes-Hut]].
`
  },
  {
    id: 'note-011',
    title: 'Algoritmo Barnes-Hut',
    category: 'Algoritmos',
    tags: ['matematicas', 'fisica', 'optimizacion'],
    updatedAt: '2026-09-03',
    content: `
# Optimización Barnes-Hut para Grafos N-Body

Reduce la complejidad computacional del cálculo gravitacional de $O(N^2)$ a $O(N \\log N)$ mediante un árbol de octantes (Octree).

- Permite escalar la simulación a miles de nodos en tiempo real.
- Base algorítmica de la [[Simulación de Fuerzas 3D]].
- Empleado intensivamente en [[Topología de Constelaciones]].
`
  },
  {
    id: 'note-012',
    title: 'BufferGeometry y Shaders',
    category: 'Frontend 3D',
    tags: ['webgl', 'shaders', 'gpu'],
    updatedAt: '2026-09-02',
    content: `
# Búferes de Geometría y Shaders Personalizados

Las líneas de conexión sinápticas utilizan \`LineSegments\` con atributos \`position\` y \`color\` mapeados a memoria estática.

- Colores interpolados entre nodos de origen y destino.
- Compatible con el efecto de resplandor de [[Postprocesado con Bloom]].
- Integrado con la [[Arquitectura WebGL]].
`
  },
  {
    id: 'note-013',
    title: 'Estética Cyberpunk',
    category: 'Diseño',
    tags: ['cyberpunk', 'ux', 'diseno'],
    updatedAt: '2026-09-01',
    content: `
# Manifiesto Visual: Cyberpunk de Alta Fidelidad

Principios de diseño visual para la interfaz C-137:

- **Fondo de Vacío Profundo**: Cian oscuro azul noche (\`#020617\`).
- **Acentos Neón**: Cian (\`#00f0ff\`) para enlaces de datos, Violeta Cuántico (\`#7000ff\`) para relés y nodos de alta densidad.
- **Componentes**: [[Interfaz Glassmorphism]] con bordes sutiles y tipografía monospace técnica.
`
  },
  {
    id: 'note-014',
    title: 'Interfaz Glassmorphism',
    category: 'Diseño',
    tags: ['ux', 'diseno', 'cyberpunk'],
    updatedAt: '2026-08-30',
    content: `
# Interfaz Flotante de Vidrio Esmerilado

Paneles holográficos translúcidos que no obstruyen la inmersión del entorno 3D.

- \`backdrop-filter: blur(16px)\` con fondos oscuros \`rgba(2, 6, 23, 0.75)\`.
- Contornos nítidos de 1px con brillo cian reactivo.
- Diseñado para albergar la telemetría del [[Protocolo C-137: Núcleo Neural]].
`
  },
  {
    id: 'note-015',
    title: 'Criptografía Cuántica',
    category: 'Seguridad',
    tags: ['seguridad', 'cripto', 'core'],
    updatedAt: '2026-08-28',
    content: `
# Encriptación de Clave Cuántica (QKD)

Protocolos de intercambio de claves mediante entrelazamiento de fotones para proteger las transferencias en la red C-137.

- Inmune a ataques de factorización por computación cuántica.
- Monitorea fluctuaciones de entropía en [[Protocolo C-137: Núcleo Neural]].
- Comunica nodos satélite mediante [[Comunicaciones Sub-Espaciales]].
`
  },
  {
    id: 'note-016',
    title: 'Comunicaciones Sub-Espaciales',
    category: 'Infraestructura',
    tags: ['redes', 'hardware', 'infraestructura'],
    updatedAt: '2026-08-26',
    content: `
# Red de Enlaces Sub-Espaciales

Topología de transporte de paquetes con latencias inferiores a 1 milisegundo entre clústeres estelares.

- Utiliza enrutamiento vectorial asistido por el [[Grafo de Conocimiento]].
- Protegido mediante [[Criptografía Cuántica]].
- Desplegado a través de [[Micro-Servicios en el Borde]].
`
  },
  {
    id: 'note-017',
    title: 'Micro-Servicios en el Borde',
    category: 'Infraestructura',
    tags: ['cloud', 'infraestructura', 'rendimiento'],
    updatedAt: '2026-08-24',
    content: `
# Edge Computing y Nodos Livianos

Descentralización de cómputo para procesar consultas de grafo en las inmediaciones del cliente.

- Sincronización instantánea con [[Sistemas de Memoria Distribuida]].
- Tolerancia a particiones de red en [[Comunicaciones Sub-Espaciales]].
- Supervisado por el [[Monitor de Salud del Sistema]].
`
  },
  {
    id: 'note-018',
    title: 'Sistemas de Memoria Distribuida',
    category: 'Arquitectura',
    tags: ['arquitectura', 'cloud', 'rendimiento'],
    updatedAt: '2026-08-22',
    content: `
# Memoria Compartida Distribuida (DSM)

Capa de abstracción que unifica la memoria física de los nodos del clúster en un único espacio de direcciones virtual.

- Reduce tiempos de acceso al consultar el [[Grafo de Conocimiento]].
- Conectado a la capa local mediante [[Zustand State Store]].
`
  },
  {
    id: 'note-019',
    title: 'Topología de Constelaciones',
    category: 'Investigación',
    tags: ['matematicas', 'grafos', 'cyberpunk'],
    updatedAt: '2026-08-20',
    content: `
# Patrones Topológicos Estelares

Inspirado en la disposición natural de las constelaciones astronómicas y filamentos cósmicos.

- Fusión de modelos gravitacionales y [[Simulación de Fuerzas 3D]].
- Agrupamiento de conceptos por afinidad semántica.
- Validado a través de [[Ontología de Datos]].
`
  },
  {
    id: 'note-020',
    title: 'Ontología de Datos',
    category: 'Investigación',
    tags: ['ia', 'pkm', 'filosofia'],
    updatedAt: '2026-08-18',
    content: `
# Ontología Semántica y Taxonomía

Clasificación rigurosa de tipos de entidad, relaciones y propiedades en el ecosistema de notas.

- Vinculado al [[Parser de Markdown]] para inferencia automática de categorías.
- Proporciona estructura al [[Grafo de Conocimiento]].
`
  },
  {
    id: 'note-021',
    title: 'Monitor de Salud del Sistema',
    category: 'Operaciones',
    tags: ['telemetria', 'operaciones', 'seguridad'],
    updatedAt: '2026-08-15',
    content: `
# Telemetría y Diagnóstico en Tiempo Real

Panel de supervisión que detecta cuellos de botella de renderizado y latencia de paquetes.

- Mide métricas de framerate (meta: 60 FPS fijos).
- Supervisa los [[Micro-Servicios en el Borde]].
- Informa directamente al operador a través de [[Interfaz Glassmorphism]].
`
  },
  {
    id: 'note-022',
    title: 'Sincronización React 19',
    category: 'Frontend',
    tags: ['frontend', 'react', 'rendimiento'],
    updatedAt: '2026-08-12',
    content: `
# Concurrencia y Transiciones en React 19

Aprovechamiento de las nuevas primitivas de concurrencia y Server Actions para desacoplar el hilo de la UI del bucle WebGL.

- Las selecciones de nodos se tratan como transiciones no bloqueantes.
- Enlace directo con [[Zustand State Store]].
`
  },
  {
    id: 'note-023',
    title: 'Indexación Vectorial Semántica',
    category: 'IA',
    tags: ['ia', 'algoritmos', 'busqueda'],
    updatedAt: '2026-08-10',
    content: `
# Embeddings y Búsqueda Vectorial

Generación de vectores densos para cada nota a fin de sugerir conexiones no explícitas.

- Complementa los [[WikiLinks]] tradicionales con similitud del coseno.
- Enriquece el [[Grafo de Conocimiento]] con enlaces predictivos.
`
  },
  {
    id: 'note-024',
    title: 'Shader de Distorsión Gravitacional',
    category: 'VFX',
    tags: ['shaders', 'vfx', 'fisica'],
    updatedAt: '2026-08-08',
    content: `
# Lente Gravitacional en GLSL

Efecto de distorsión óptica de los rayos de luz al pasar cerca de nodos de masa elevada (Hubs).

- Integra matrices de proyección en [[BufferGeometry y Shaders]].
- Realza el impacto del [[Postprocesado con Bloom]].
`
  },
  {
    id: 'note-025',
    title: 'Taxonomía de Conexiones WikiLink',
    category: 'Investigación',
    tags: ['pkm', 'herramientas', 'redes'],
    updatedAt: '2026-08-05',
    content: `
# Taxonomía y Semántica de Hipervínculos

Clasificación de enlaces según direccionalidad, jerarquía e intensidad sináptica.

- Aristas jerárquicas vs aristas asociativas.
- Procesado continuo por el [[Parser de Markdown]].
- Base para la ponderación en la [[Simulación de Fuerzas 3D]].
`
  },
  {
    id: 'note-026',
    title: 'Redundancia y Tolerancia a Fallos',
    category: 'Seguridad',
    tags: ['seguridad', 'infraestructura', 'arquitectura'],
    updatedAt: '2026-08-01',
    content: `
# Protocolo de Auto-Recuperación Bizantina

Mecanismo de consenso para preservar la integridad del grafo incluso ante la caída del 33% de los nodos.

- Asegura la resiliencia en [[Protocolo C-137: Núcleo Neural]].
- Respaldo criptográfico en [[Criptografía Cuántica]].
`
  },
  {
    id: 'note-027',
    title: 'Caché de Vecindades y Proximidad',
    category: 'Algoritmos',
    tags: ['rendimiento', 'algoritmos', 'optimizacion'],
    updatedAt: '2026-07-28',
    content: `
# Tablas Hash Espaciales para Vecindad Inmediata

Permite que el evento \`pointerOver\` localice instantáneamente los nodos conectados sin iterar por todo el grafo.

- Rendimiento garantizado para [[InstancedMesh Rendering]].
- Cooperación con [[Zustand State Store]].
`
  },
  {
    id: 'note-028',
    title: 'Inmersión Háptica y Auditiva',
    category: 'Diseño',
    tags: ['ux', 'cyberpunk', 'interaccion'],
    updatedAt: '2026-07-25',
    content: `
# Feedback Multisensorial para Navegación 3D

Resonancia acústica sintetizada en frecuencias sub-graves al interactuar con nodos y cambiar el enfoque focal.

- Diseñado para acompañar la [[Cámara Cinemática]].
- Armoniza con la [[Estética Cyberpunk]].
`
  }
];
