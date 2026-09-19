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
  val?: any;
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
 * Construye la topología del grafo 3D (nodos y aristas) a partir de un array de notas,
 * conservando de forma estricta las coordenadas (x, y, z, vx, vy, vz) de los nodos previos.
 * Para notas nuevas, calcula su posición inicial en el centroide de sus vecinos conectados
 * o en una órbita armónica, evitando colapsos o explosiones de la constelación.
 * 
 * Esta función es PURA, no ejecuta simulaciones síncronas bloqueantes en el hilo principal,
 * dejando el cálculo de físicas al Web Worker (force.worker.ts).
 */
export function buildNexusGraphTopology(
  notes: NexusNote[],
  prevNodes?: Graph3DNode[]
): ParsedGraphResult {
  const nodes: Graph3DNode[] = [];
  const links: Graph3DLink[] = [];

  const prevMap = new Map<string, Graph3DNode>();
  if (prevNodes && prevNodes.length > 0) {
    prevNodes.forEach((n) => prevMap.set(n.slug, n));
  }

  // Mapas para resolución de ID por título y slug
  const titleToNodeIndex = new Map<string, number>();
  const idToNodeIndex = new Map<string, number>();
  const tagToNodeIndex = new Map<string, number>();

  // 1. Extraer tags únicos de todas las notas
  const uniqueTags = new Set<string>();
  notes.forEach((note) => {
    note.tags.forEach((t) => uniqueTags.add(t.toLowerCase().replace(/^#/, '')));
    const inline = extractInlineTags(note.content);
    inline.forEach((t) => uniqueTags.add(t));
  });

  // 2. Registrar nodos de notas principales (type: 'primary')
  notes.forEach((note, idx) => {
    const slug = note.id;
    const prev = prevMap.get(slug);

    let x: number, y: number, z: number;
    let vx: number | undefined, vy: number | undefined, vz: number | undefined;

    if (prev && Number.isFinite(prev.x) && Number.isFinite(prev.y) && Number.isFinite(prev.z)) {
      // CONSERVACIÓN EXACTA de coordenadas previas
      x = prev.x;
      y = prev.y;
      z = prev.z;
      vx = prev.vx;
      vy = prev.vy;
      vz = prev.vz;
    } else {
      // NOTA NUEVA: calcular posición basada en vínculos hacia notas existentes (vecindad semántica)
      const wikiLinks = extractWikiLinks(note.content);
      const connectedCoords: { x: number; y: number; z: number }[] = [];

      wikiLinks.forEach((targetTitle) => {
        const normTarget = normalizeTitle(targetTitle);
        // Buscar si existe en notas ya procesadas o en prevMap
        for (const prevNode of prevMap.values()) {
          if (normalizeTitle(prevNode.name) === normTarget && Number.isFinite(prevNode.x)) {
            connectedCoords.push({ x: prevNode.x, y: prevNode.y, z: prevNode.z });
          }
        }
      });

      if (connectedCoords.length > 0) {
        // Posicionar en el centroide de sus notas vinculadas con una suave perturbación
        const avgX = connectedCoords.reduce((acc, c) => acc + c.x, 0) / connectedCoords.length;
        const avgY = connectedCoords.reduce((acc, c) => acc + c.y, 0) / connectedCoords.length;
        const avgZ = connectedCoords.reduce((acc, c) => acc + c.z, 0) / connectedCoords.length;
        x = avgX + (Math.random() - 0.5) * 4.0;
        y = avgY + (Math.random() - 0.5) * 4.0;
        z = avgZ + (Math.random() - 0.5) * 4.0;
      } else {
        // Si no tiene enlaces previos, ubicar en órbita armónica exterior
        const angle = (idx / Math.max(notes.length, 1)) * Math.PI * 2;
        const rad = 10 + (idx % 5) * 2.8;
        x = Math.cos(angle) * rad + (Math.random() - 0.5) * 2.5;
        y = Math.sin(angle) * rad + (Math.random() - 0.5) * 2.5;
        z = (Math.random() - 0.5) * 8.0;
      }
    }

    const node: Graph3DNode = {
      id: idx,
      slug: note.id,
      name: note.title,
      type: 'primary',
      x,
      y,
      z,
      vx,
      vy,
      vz,
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

  // 3. Crear nodos para cada Tag (type: 'relay') que actúan como hubs de constelación
  let currentIdx = nodes.length;
  uniqueTags.forEach((tag) => {
    const tagSlug = `tag-${tag}`;
    const prev = prevMap.get(tagSlug);

    let x: number, y: number, z: number;
    let vx: number | undefined, vy: number | undefined, vz: number | undefined;

    if (prev && Number.isFinite(prev.x) && Number.isFinite(prev.y) && Number.isFinite(prev.z)) {
      // Conservar posición previa del tag
      x = prev.x;
      y = prev.y;
      z = prev.z;
      vx = prev.vx;
      vy = prev.vy;
      vz = prev.vz;
    } else {
      // Nuevo Hub de Tag: ubicar cerca de las notas que contienen este tag
      const memberCoords: { x: number; y: number; z: number }[] = [];
      nodes.forEach((n) => {
        if (n.tags && n.tags.some((t) => t.toLowerCase().replace(/^#/, '') === tag)) {
          memberCoords.push({ x: n.x, y: n.y, z: n.z });
        }
      });

      if (memberCoords.length > 0) {
        x = memberCoords.reduce((acc, c) => acc + c.x, 0) / memberCoords.length + (Math.random() - 0.5) * 2;
        y = memberCoords.reduce((acc, c) => acc + c.y, 0) / memberCoords.length + (Math.random() - 0.5) * 2;
        z = memberCoords.reduce((acc, c) => acc + c.z, 0) / memberCoords.length + (Math.random() - 0.5) * 2;
      } else {
        x = (Math.random() - 0.5) * 25;
        y = (Math.random() - 0.5) * 25;
        z = (Math.random() - 0.5) * 25;
      }
    }

    const tagNode: Graph3DNode = {
      id: currentIdx,
      slug: tagSlug,
      name: `#${tag.toUpperCase()}`,
      type: 'relay',
      x,
      y,
      z,
      vx,
      vy,
      vz,
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

  // 4. Conectar enlaces de WikiLinks y Tags
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
    // A. Conexiones WikiLink [[Título]]
    const wikiLinks = extractWikiLinks(note.content);
    wikiLinks.forEach((targetTitle) => {
      const targetIdx = titleToNodeIndex.get(normalizeTitle(targetTitle));
      if (targetIdx !== undefined) {
        addLink(noteIdx, targetIdx, 'wikilink', 1.2);
      }
    });

    // B. Conexiones a Tags
    const noteAllTags = new Set([
      ...note.tags.map((t) => t.toLowerCase().replace(/^#/, '')),
      ...extractInlineTags(note.content)
    ]);

    noteAllTags.forEach((tag) => {
      const tagIdx = tagToNodeIndex.get(tag);
      if (tagIdx !== undefined) {
        addLink(noteIdx, tagIdx, 'tag', 0.8);
      }
    });
  });

  // 5. Ajustar escala proporcional al grado de conexiones
  nodes.forEach((node) => {
    if (node.type === 'relay') {
      node.baseScale = Math.min(0.7, 0.35 + node.degree * 0.04);
    } else {
      node.baseScale = Math.min(0.55, 0.26 + node.degree * 0.035);
    }
  });

  return { nodes, links };
}

/**
 * Convierte un array de NexusNotes en una estructura de grafo 3D.
 * Si se especifica skipSimulation = true, solo genera la topología para delegar la física al Worker.
 * Si skipSimulation = false, corre la simulación inicial síncrona como fallback.
 */
export function parseNotesToGraph(
  notes: NexusNote[],
  prevNodes?: Graph3DNode[],
  skipSimulation = false
): ParsedGraphResult {
  const result = buildNexusGraphTopology(notes, prevNodes);

  if (skipSimulation) {
    return result;
  }

  // Fallback síncrono para entornos sin soporte de Workers o tests
  const simulation = forceSimulation(result.nodes, 3)
    .force('charge', forceManyBody().strength((d: any) => (d.type === 'relay' ? -120 : -75)).distanceMax(50))
    .force('link', forceLink(result.links).id((d: any) => d.id).distance((l: any) => l.distance).strength(0.5))
    .force('center', forceCenter(0, 0, 0))
    .stop();

  for (let i = 0; i < 180; ++i) {
    simulation.tick();
  }

  result.nodes.forEach((node, i) => {
    if (!Number.isFinite(node.x)) node.x = Math.sin(i * 1.7) * 15;
    if (!Number.isFinite(node.y)) node.y = Math.cos(i * 2.3) * 15;
    if (!Number.isFinite(node.z)) node.z = Math.sin(i * 3.1) * 15;
  });

  return result;
}
