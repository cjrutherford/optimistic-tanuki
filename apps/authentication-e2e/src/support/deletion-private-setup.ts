/** Never provision, restart, or silently skip verification against a shared stack. */
export default async function () {
  const port = Number(process.env['POSTGRES_PORT']);
  if (
    process.env['D00_PRIVATE_FIXTURE'] !== 'd00-private-fixture' ||
    process.env['POSTGRES_HOST'] !== '127.0.0.1' ||
    process.env['POSTGRES_USER'] !== 'd00' ||
    process.env['POSTGRES_DB'] !== 'd00' ||
    !process.env['POSTGRES_PASSWORD'] ||
    !Number.isSafeInteger(port) ||
    port < 1 ||
    port > 65535 ||
    (process.env['D05_PERMISSIONS_DB'] !== undefined &&
      process.env['D05_PERMISSIONS_DB'] !== 'd05_permissions') ||
    (process.env['D04_VIDEOS_DB'] !== undefined &&
      process.env['D04_VIDEOS_DB'] !== 'd04_videos') ||
    (process.env['D03_ASSETS_DB'] !== undefined &&
      process.env['D03_ASSETS_DB'] !== 'd03_assets') ||
    (process.env['D02_PROFILE_DB'] !== undefined &&
      process.env['D02_PROFILE_DB'] !== 'd02_profile')
  )
    throw new Error('PRIVATE_DELETION_FIXTURE_REQUIRED');
}
