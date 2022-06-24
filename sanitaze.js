import { stripHtml } from 'string-strip-html'


export function sanitaze(string) {
    const sanitize = stripHtml(string).result.trim();
    return sanitize
}