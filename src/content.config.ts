import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';
const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(), description: z.string(), date: z.coerce.date(),
    topic: z.enum(['开发手记', '设计思考', '生活切片']),
    tags: z.array(z.string()).min(1), minutes: z.number().positive(),
    featured: z.boolean().default(false), demo: z.boolean().default(false),
  }),
});
export const collections = { posts };
