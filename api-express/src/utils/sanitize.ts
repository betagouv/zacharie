import xss from 'xss';

export function sanitize(source: string) {
  return xss(source, {
    whiteList: {}, // empty, means filter out all tags
    stripIgnoreTag: true, // filter out all HTML not in the whilelist
    stripIgnoreTagBody: ['script'], // the script tag is a special case, we need
    // to filter out its content
  });
}
