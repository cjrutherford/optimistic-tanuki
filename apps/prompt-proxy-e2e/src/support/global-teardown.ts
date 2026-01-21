export default async function () {
  console.log(globalThis.__TEARDOWN_MESSAGE__ || '\nTearing down...\n');
}
