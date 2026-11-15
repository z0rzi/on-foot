// Android starts a JS runtime for a background location delivery without rendering a route, so
// src/bootstrap, which defines the task, is imported before the routes.
import './src/bootstrap'
import 'expo-router/entry'
