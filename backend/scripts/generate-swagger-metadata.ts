/**
 * Writes src/metadata.ts: the DTO and response schemas that the Swagger CLI
 * plugin would otherwise add during `nest build`. Vercel compiles the app
 * without the Nest CLI, so the docs load this file instead.
 *
 * Run `npm run docs:metadata` after changing a DTO or a controller's return
 * types; CI fails when the committed file is out of date.
 */
import { PluginMetadataGenerator } from '@nestjs/cli/lib/compiler/plugins/plugin-metadata-generator.js';
import { ReadonlyVisitor } from '@nestjs/swagger/plugin';
import { fileURLToPath } from 'node:url';

const src = fileURLToPath(new URL('../src', import.meta.url));

new PluginMetadataGenerator().generate({
  visitors: [
    new ReadonlyVisitor({
      pathToSource: src,
      classValidatorShim: true,
      introspectComments: true,
    }),
  ],
  outputDir: src,
  watch: false,
  tsconfigPath: 'tsconfig.build.json',
});
