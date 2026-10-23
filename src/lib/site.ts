export const site = { name: 'Glonee', title: 'Glonee 的数字花园', description: '记录开发、设计与日常。把好奇心写成代码，把细小的发现留在这里。' };
export const base = import.meta.env.BASE_URL.replace(/\/$/, '');
export const url = (path = '') => `${base}/${path.replace(/^\/+/, '')}`;
export const postUrl = (id: string) => url(`posts/${id}/`);
export const dateLabel = (date: Date) => new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }).format(date);
