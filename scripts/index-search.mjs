import * as pagefind from 'pagefind';
try {
  const created = await pagefind.createIndex();
  if (created.errors?.length || !created.index) throw new Error(JSON.stringify(created.errors));
  const result = await created.index.addDirectory({ path: 'dist', glob: 'posts/**/*.html' });
  if (result.errors?.length || result.page_count < 5) throw new Error(`搜索索引失败: ${JSON.stringify(result)}`);
  const written = await created.index.writeFiles({ outputPath: 'dist/pagefind' });
  if (written.errors?.length) throw new Error(JSON.stringify(written.errors));
  console.log(`Pagefind: indexed ${result.page_count} Chinese article pages → dist/pagefind`);
} finally { await pagefind.close(); }
