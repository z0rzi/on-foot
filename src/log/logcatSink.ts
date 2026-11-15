// A release build hands `console.log` to logcat, under the `ReactNativeJS` tag.
export function toLogcat(line: string): void {
  console.log(line)
}
