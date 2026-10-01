/** A publisher page whose article is long enough to pass the readable-prose gate. */
export function articleHtml(
  lead: string,
  options: { head?: string } = {}
): string {
  return (
    `<!doctype html><html><head>${
      options.head ?? ''
    }</head><body><nav><a href="/">Home</a> <a href="/news">News</a></nav><main><article><p>${lead}</p>` +
    '<p>Officials said the work was approved after a public hearing, and the project schedule and funding sources were published with the meeting agenda.</p>' +
    '<p>Residents with questions can contact the responsible office during business hours, and updates will be posted as the work moves forward.</p>' +
    '</article></main><footer><p>&copy; 2026 Publisher. Privacy Policy</p></footer></body></html>'
  );
}
