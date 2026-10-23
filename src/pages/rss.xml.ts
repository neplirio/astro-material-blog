import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import { site, postUrl } from '../lib/site';
export async function GET(context: { site: URL }) {
  const posts = (await getCollection('posts')).sort((a,b) => b.data.date.valueOf() - a.data.date.valueOf());
  return rss({ title:site.title, description:site.description, site:new URL(import.meta.env.BASE_URL + '/', context.site), items:posts.map(post => ({title:`${post.data.demo ? '[示例] ' : ''}${post.data.title}`, description:post.data.description, pubDate:post.data.date, link:postUrl(post.id)})), customData:'<language>zh-cn</language>' });
}
