import { ListingTemplate } from '../models/listing';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export function createTemplate(templates: ListingTemplate[], data: Omit<ListingTemplate, 'id'>): ListingTemplate[] {
  return [...templates, { id: generateId(), ...data }];
}

export function updateTemplate(templates: ListingTemplate[], updated: ListingTemplate): ListingTemplate[] {
  return templates.map(t => (t.id === updated.id ? updated : t));
}

export function deleteTemplate(templates: ListingTemplate[], id: string): ListingTemplate[] {
  return templates.filter(t => t.id !== id);
}
