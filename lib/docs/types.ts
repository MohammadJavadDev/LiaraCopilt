import { z } from "zod";

export const DocChunkSchema = z.object({
  id: z.string(),
  title: z.string(),
  section: z.string(),
  content: z.string(),
  url: z.string().url(),
  keywords: z.array(z.string()).optional(),
});

export type DocChunk = z.infer<typeof DocChunkSchema>;

export const DocChunkArraySchema = z.array(DocChunkSchema);
