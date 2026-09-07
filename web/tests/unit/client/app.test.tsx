import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { App } from '../../../src/client/App';

// Rendering to a string keeps this test free of a DOM environment, per the
// spec's proving table.
// SPEC-005/B3
describe('the root component', () => {
  it('renders a heading naming the app', () => {
    const markup = renderToStaticMarkup(<App />);

    expect(markup).toContain('<h1>Commission Quote App</h1>');
  });
});
