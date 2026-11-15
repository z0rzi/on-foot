import { installGlobalErrorHandler, logEvent } from '../log'

installGlobalErrorHandler()
logEvent('info', 'launch', 'runtime started')
