import { describe, it, expect } from 'vitest';
import { TemplateService } from '../src/services/templateService';
import { ArticleTemplate } from '../src/models/listing';

describe('TemplateService', () => {
  const baseTemplates: ArticleTemplate[] = [
    { id: 'a1', name: 'PS4 Spiel' },
    { id: 'b2', name: 'DVD', preis: 5, zustand: 'Gut' },
  ];

  describe('create', () => {
    it('adds a new template with generated id', () => {
      const result = TemplateService.create(baseTemplates, { name: 'Buch' });
      expect(result).toHaveLength(3);
      expect(result[2].name).toBe('Buch');
      expect(result[2].id).toBeTruthy();
      expect(result[2].id).not.toBe('');
    });

    it('does not mutate the original array', () => {
      const result = TemplateService.create(baseTemplates, { name: 'Buch' });
      expect(baseTemplates).toHaveLength(2);
      expect(result).not.toBe(baseTemplates);
    });
  });

  describe('update', () => {
    it('updates the matching template', () => {
      const result = TemplateService.update(baseTemplates, { id: 'a1', name: 'PS5 Spiel' });
      expect(result[0].name).toBe('PS5 Spiel');
      expect(result[1]).toEqual(baseTemplates[1]);
    });

    it('returns unchanged array if id not found', () => {
      const result = TemplateService.update(baseTemplates, { id: 'x9', name: 'Ghost' });
      expect(result).toEqual(baseTemplates);
    });
  });

  describe('delete', () => {
    it('removes the template by id', () => {
      const result = TemplateService.delete(baseTemplates, 'a1');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('b2');
    });

    it('returns unchanged array if id not found', () => {
      const result = TemplateService.delete(baseTemplates, 'x9');
      expect(result).toHaveLength(2);
    });
  });

  describe('getById', () => {
    it('finds template by id', () => {
      expect(TemplateService.getById(baseTemplates, 'b2')?.name).toBe('DVD');
    });

    it('returns undefined for missing id', () => {
      expect(TemplateService.getById(baseTemplates, 'x9')).toBeUndefined();
    });
  });
});
