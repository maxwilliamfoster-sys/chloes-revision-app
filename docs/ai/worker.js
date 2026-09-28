// Runs the offline AI model (WebLLM) in a background thread so the app stays smooth.
import { WebWorkerMLCEngineHandler } from './webllm.js';
const handler = new WebWorkerMLCEngineHandler();
self.onmessage = (msg) => handler.onmessage(msg);
