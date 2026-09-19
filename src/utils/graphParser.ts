import { 
  forceSimulation, 
  forceManyBody, 
  forceLink, 
  forceCenter 
} from 'd3-force-3d';

/**
 * =======================================================================
 * PARSER DE NOTAS Y VÍNCULOS (WikiLinks & Tags a Grafo 3D)
 * =======================================================================
 * Transforma colecciones de notas Markdown tipo Obsidian/Zustand en una
 * red topológica 3D optimizada para InstancedMesh y simulaciones de fuerza.
 */

export interface NexusNote {
  id: string;
  title: string;
  content: string;
  tags: string[];
  category?: string;
  updatedAt?: string;
}

export interface Graph3DNode {
  id: number;              // Índice numérico para InstancedMesh
  slug: string;            // ID original o tag
  name: string;            // Título o nombre
  type: 'primary' | 'relay'; // primary = Nota, relay = Tag/Hub
  x: number;
  y: number;
  z: number;
  vx?: number;
  vy?: number;
  vz?: number;
  baseScale: number;
  cluster: number;
  degree: number;
  connections: number[];
  
  // Metadatos de la nota
  content?: string;
  tags?: string[];
  category?: string;
  bandwidth?: string;
  signalStrength?: number;
}

export interface Graph3DLink {
  source: number | Graph3DNode;
  target: number | Graph3DNode;
  distance: number;
  weight: number;
  type: 'wikilink' | 'tag';
}

export interface ParsedGraphResult {
  nodes: Graph3DNode[];
  links: Graph3DLink[];
}

/**
 * Normaliza strings para matching de enlaces cruzados
 */
function normalizeTitle(title: string): string {
  return title.trim().toLowerCase();
}

/**
 * Extrae referencias cruzadas estilo WikiLink [[Título de Nota]]
 */
export function extractWikiLinks(content: string): string[] {
  const wikiLinkRegex = /\[\[(.*?)\]\]/g;
  const links: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = wikiLinkRegex.exec(content)) !== null) {
    if (match[1] && match[1].trim().length > 0) {
      links.push(match[1].trim());
    }
  }
  return links;
}

/**
 * Extrae hashtags dentro del contenido Markdown (#etiqueta)
 */
export function extractInlineTags(content: string): string[] {
  const tagRegex = /(?:^|\s)#([a-zA-Z0-9_\-]+)/g;
  const tags: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = tagRegex.exec(content)) !== null) {
    if (match[1]) {
      tags.push(match[1].trim().toLowerCase());
    }
  }
  return tags;
}

/**
 * Convierte un array de NexusNotes en una estructura de grafo 3D calculada con d3-force-3d
 */
export function parseNotesToGraph(notes: NexusNote[]): ParsedGraphResult {
  const nodes: Graph3DNode[] = [];
  const links: Graph3DLink[] = [];

  // Mapas para resolución de ID por título y slug
  const titleToNodeIndex = new Map<string, number>();
  const idToNodeIndex = new Map<string, number>();
  const tagToNodeIndex = new Map<string, number>();

  // 1. Registrar nodos de notas principales (type: 'primary')
  notes.forEach((note, idx) => {
    const node: Graph3DNode = {
      id: idx,
      slug: note.id,
      name: note.title,
      type: 'primary',
      x: (Math.random() - 0.5) * 30,
      y: (Math.random() - 0.5) * 30,
      z: (Math.random() - 0.5) * 30,
      baseScale: 0.35,
      cluster: idx % 5,
      degree: 0,
      connections: [],
      content: note.content,
      tags: [...note.tags],
      category: note.category || 'General',
      bandwidth: `${(2.4 + (idx * 0.7) % 6).toFixed(1)} Tbps`,
      signalStrength: 85 + (idx * 7) % 15
    };

    nodes.push(node);
    titleToNodeIndex.set(normalizeTitle(note.title), idx);
    idToNodeIndex.set(note.id, idx);
  });

  // 2. Extraer todos los tags únicos (de la propiedad tags y del contenido inline)
  const uniqueTags = new Set<string>();
  notes.forEach(note => {
    note.tags.forEach(t => uniqueTags.add(t.toLowerCase().replace(/^#/, '')));
    const inline = extractInlineTags(note.content);
    inline.forEach(t => uniqueTags.add(t));
  });

  // 3. Crear nodos para cada Tag (type: 'relay') que actuarán como hubs de constelación
  let currentIdx = nodes.length;
  uniqueTags.forEach(tag => {
    const tagNode: Graph3DNode = {
      id: currentIdx,
      slug: `tag-${tag}`,
      name: `#${tag.toUpperCase()}`,
      type: 'relay',
      x: (Math.random() - 0.5) * 35,
      y: (Math.random() - 0.5) * 35,
      z: (Math.random() - 0.5) * 35,
      baseScale: 0.45,
      cluster: (currentIdx % 4) + 1,
      degree: 0,
      connections: [],
      category: 'Tag Hub',
      bandwidth: '10.0 Tbps (Hub)',
      signalStrength: 98
    };

    nodes.push(tagNode);
    tagToNodeIndex.set(tag, currentIdx);
    currentIdx++;
  });

  // 4. Conectar enlaces de WikiLinks [[Título]]
  const existingLinks = new Set<string>();
  function addLink(sourceIdx: number, targetIdx: number, type: 'wikilink' | 'tag', weight = 1.0) {
    if (sourceIdx === targetIdx) return;
    const linkKey = sourceIdx < targetIdx ? `${sourceIdx}-${targetIdx}` : `${targetIdx}-${sourceIdx}`;
    if (existingLinks.has(linkKey)) return;
    existingLinks.add(linkKey);

    links.push({
      source: sourceIdx,
      target: targetIdx,
      distance: type === 'tag' ? 6.5 : 8.5,
      weight,
      type
    });

    nodes[sourceIdx].connections.push(targetIdx);
    nodes[targetIdx].connections.push(sourceIdx);
    nodes[sourceIdx].degree++;
    nodes[targetIdx].degree++;
  }

  notes.forEach((note, noteIdx) => {
    // A. Conexiones WikiLink
    const wikiLinks = extractWikiLinks(note.content);
    wikiLinks.forEach(targetTitle => {
      const targetIdx = titleToNodeIndex.get(normalizeTitle(targetTitle));
      if (targetIdx !== undefined) {
        addLink(noteIdx, targetIdx, 'wikilink', 1.2);
      }
    });

    // B. Conexiones a Tags
    const noteAllTags = new Set([
      ...note.tags.map(t => t.toLowerCase().replace(/^#/, '')),
      ...extractInlineTags(note.content)
    ]);

    noteAllTags.forEach(tag => {
      const tagIdx = tagToNodeIndex.get(tag);
      if (tagIdx !== undefined) {
        addLink(noteIdx, tagIdx, 'tag', 0.8);
      }
    });
  });

  // 5. Ajustar escala y brillo proporcional al grado (deg) de conexiones
  nodes.forEach(node => {
    if (node.type === 'relay') {
      // Hubs de tags crecen según cuántas notas agrupan
      node.baseScale = Math.min(0.7, 0.35 + node.degree * 0.04);
    } else {
      // Nodos de notas: escala base entre 0.28 y 0.55
      node.baseScale = Math.min(0.55, 0.26 + node.degree * 0.035);
    }
  });

  // 6. Simulación de Fuerzas 3D con d3-force-3d para estabilizar la constelación
  // IMPORTANTE: En d3-force-3d, numDimensions DEBE pasarse en el constructor forceSimulation(nodes, 3)
  // para que inicialice los vectores tridimensionales (vz) y no devuelva NaN en z.
  const simulation = forceSimulation(nodes, 3)
    .force('charge', forceManyBody().strength((d: any) => d.type === 'relay' ? -120 : -75).distanceMax(50))
    .force('link', forceLink(links).id((d: any) => d.id).distance((l: any) => l.distance).strength(0.5))
    .force('center', forceCenter(0, 0, 0))
    .stop();

  // Ejecutar ticks de relajación para convergencia inicial
  for (let i = 0; i < 180; ++i) {
    simulation.tick();
  }

  // Sanitizar coordenadas para garantizar que nunca existan valores NaN o null
  nodes.forEach((node, i) => {
    if (isNaN(node.x) || node.x === null || node.x === undefined) node.x = (Math.sin(i * 1.7) * 15);
    if (isNaN(node.y) || node.y === null || node.y === undefined) node.y = (Math.cos(i * 2.3) * 15);
    if (isNaN(node.z) || node.z === null || node.z === undefined) node.z = (Math.sin(i * 3.1) * 15);
  });

  return { nodes, links };
}
