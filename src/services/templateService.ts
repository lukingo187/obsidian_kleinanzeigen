import { ArticleTemplate } from '../models/listing';

export class TemplateService {
  static generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  static create(templates: ArticleTemplate[], data: Omit<ArticleTemplate, 'id'>): ArticleTemplate[] {
    const newTemplate: ArticleTemplate = { id: TemplateService.generateId(), ...data };
    return [...templates, newTemplate];
  }

  static update(templates: ArticleTemplate[], updated: ArticleTemplate): ArticleTemplate[] {
    return templates.map(t => (t.id === updated.id ? updated : t));
  }

  static delete(templates: ArticleTemplate[], id: string): ArticleTemplate[] {
    return templates.filter(t => t.id !== id);
  }

  static getById(templates: ArticleTemplate[], id: string): ArticleTemplate | undefined {
    return templates.find(t => t.id === id);
  }
}
