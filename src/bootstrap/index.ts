// Runs first in every JS runtime, headless or not, its imports in order.
//
// Invariant: no module loads expo-task-manager before the task is defined. A delivery that reaches
// a runtime where the SDK is loaded and the task is not makes expo-task-manager unregister the task,
// which ends the recording. Defining it here, ahead of every route, is what upholds it.
import './runtimeStarted'
import '../recording/locationTask'
