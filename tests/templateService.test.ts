import { describe, it, expect } from 'vitest';
import { createTemplate, updateTemplate, deleteTemplate } from '../src/services/templateService';
import { ListingTemplate } from '../src/models/listing';

describe('templateService', () => {
  const baseTemplates: ListingTemplate[] = [
    { id: 'a1', name: 'PS4 Game' },
    { id: 'b2', name: 'DVD', price: 5, condition: 'ok' },
  ];

  describe('createTemplate', () => {
    it('adds a new template with generated id', () => {
      const result = createTemplate(baseTemplates, { name: 'Book' });
      expect(result).toHaveLength(3);
      expect(result[2].name).toBe('Book');
      expect(result[2].id).toBeTruthy();
      expect(result[2].id).not.toBe('');
    });

    it('does not mutate the original array', () => {
      const result = createTemplate(baseTemplates, { name: 'Book' });
      expect(baseTemplates).toHaveLength(2);
      expect(result).not.toBe(baseTemplates);
    });
  });

  describe('updateTemplate', () => {
    it('updates the matching template', () => {
      const result = updateTemplate(baseTemplates, { id: 'a1', name: 'PS5 Game' });
      expect(result[0].name).toBe('PS5 Game');
      expect(result[1]).toEqual(baseTemplates[1]);
    });

    it('returns unchanged array if id not found', () => {
      const result = updateTemplate(baseTemplates, { id: 'x9', name: 'Ghost' });
      expect(result).toEqual(baseTemplates);
    });
  });

  describe('deleteTemplate', () => {
    it('removes the template by id', () => {
      const result = deleteTemplate(baseTemplates, 'a1');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('b2');
    });

    it('returns unchanged array if id not found', () => {
      const result = deleteTemplate(baseTemplates, 'x9');
      expect(result).toHaveLength(2);
    });
  });
});
