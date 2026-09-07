// The classless build styles the semantic tags the components already render,
// so no component carries a class for the sake of the stylesheet.
import '@picocss/pico/css/pico.classless.min.css';
import { createRoot } from 'react-dom/client';
import { App } from './App';

const rootElement = document.getElementById('root');

// index.html owns this element. Saying so here turns a silent blank page into a
// message naming the cause.
if (!rootElement) {
  throw new Error('index.html has no #root element to mount into.');
}

createRoot(rootElement).render(<App />);
