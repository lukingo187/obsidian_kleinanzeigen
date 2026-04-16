import { ArticleTemplate } from '../models/listing';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export function createTemplate(templates: ArticleTemplate[], data: Omit<ArticleTemplate, 'id'>): ArticleTemplate[] {
  return [...templates, { id: generateId(), ...data }];
}

export function updateTemplate(templates: ArticleTemplate[], updated: ArticleTemplate): ArticleTemplate[] {
  return templates.map(t => (t.id === updated.id ? updated : t));
}

export function deleteTemplate(templates: ArticleTemplate[], id: string): ArticleTemplate[] {
  return templates.filter(t => t.id !== id);
}

export function getTemplateById(templates: ArticleTemplate[], id: string): ArticleTemplate | undefined {
  return templates.find(t => t.id === id);
}
