// The ABIs React Native's Gradle build compiles native code for (`reactNativeArchitectures`).
const ARCHITECTURES = ['arm64-v8a', 'armeabi-v7a', 'x86', 'x86_64']

// The one architecture a build for this phone needs, from its `ro.product.cpu.abilist`: the first
// ABI React Native builds for; null when it lists none.
export function phoneArchitecture(abilist: string): string | null {
  return abilist.trim().split(',').find((abi) => ARCHITECTURES.includes(abi)) ?? null
}

// A release build compiles native code for every architecture in the generated
// `gradle.properties`; `expo run:android` narrows that to the phone's only on a debug build. The
// variable overrides the property for one build without touching the generated project.
export const architectureEnv = (architecture: string | null): Record<string, string> =>
  architecture === null ? {} : { ORG_GRADLE_PROJECT_reactNativeArchitectures: architecture }
