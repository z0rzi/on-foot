// The native fingerprint (@expo/fingerprint), as the toolkit's build command computes it. `extra`
// carries the build's own identity (app.config.ts), so it stays out of the hash; the rest are
// the library's defaults.
/** @type {import('expo/fingerprint').Config} */
const config = {
  sourceSkips: ['PackageJsonAndroidAndIosScriptsIfNotContainRun', 'ExpoConfigExtraSection'],
}
module.exports = config
