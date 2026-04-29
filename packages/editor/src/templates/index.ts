// Template system for Sveltedraw — loads pre-made drawing templates

export interface TemplateElement {
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  text?: string;
  strokeColor?: string;
  backgroundColor?: string;
  fillStyle?: string;
  strokeWidth?: number;
  [key: string]: unknown;
}

export interface Template {
  name: string;
  description: string;
  thumbnail: string;
  elements: TemplateElement[];
}

// Import templates
import flowchartData from './flowchart.json';
import wireframeData from './wireframe.json';
import orgchartData from './orgchart.json';
import mindmapData from './mindmap.json';
import kanbanData from './kanban.json';

const templates: Template[] = [
  flowchartData as Template,
  wireframeData as Template,
  orgchartData as Template,
  mindmapData as Template,
  kanbanData as Template,
];

export function getTemplates(): Template[] {
  return templates;
}

export function getTemplate(name: string): Template | undefined {
  return templates.find(t => t.name.toLowerCase() === name.toLowerCase());
}
