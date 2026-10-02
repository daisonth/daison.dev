import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "zod";

const notes = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/notes" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
  }),
});

const projects = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/projects" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    status: z.enum(["active", "shipped", "archived"]).default("active"),
    url: z.url().optional(),
    repo: z.url().optional(),
    tags: z.array(z.string()).default([]),
  }),
});

export const collections = { notes, projects };
